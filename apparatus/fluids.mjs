import { THREE, material, box, cylinder, sphere, torus, pipe, assembly } from './kit.mjs';
import {createSubmarineTeaching} from './submarine-teaching.mjs';
import {submarineActions} from './submarine-actions.mjs';
import {SUB_LAYOUT,submarineWetVolume,inverseFraction} from './submarine-layout.mjs';
import {buildSubmarineVessel} from './submarine-geometry.mjs';

// The geometry is a metre-based teaching schematic. Solver constants are
// declared beside the equations below; they are not claims about a vessel or
// pump sold by a manufacturer.
const G = 9.81;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
const value = (inputs, id, fallback) => Number.isFinite(Number(inputs?.[id])) ? Number(inputs[id]) : fallback;
const mod1 = x => ((x % 1) + 1) % 1;
const fmt = (n, digits = 1) => Number(n).toFixed(digits);
const nonPickable = mesh => { mesh.userData.nonPickable = true; return mesh; };
const addBox = (part, size, pos, mat, rot) => box(part.object, size, pos, mat, rot);
const addCylinder = (part, r, h, pos, mat, axis = 'y') => cylinder(part.object, r, h, pos, mat, axis);
const addPipe = (part, points, r, mat) => nonPickable(pipe(part.object, points, r, mat));
const nested = part => { const group = new THREE.Group(); part.object.add(group); return group; };
const boxIn = (parent, size, pos, mat, rot) => box(parent, size, pos, mat, rot);
const cylIn = (parent, r, h, pos, mat, axis = 'y') => cylinder(parent, r, h, pos, mat, axis);

// Exact boxes are used for volume accounting; decorative rounded boxes are not.
function volumeBox(parent, size, pos, mat, name = '') {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...pos); mesh.name = name; parent.add(mesh); return mesh;
}
function ring(parent, outer, inner, height, pos, mat, name = '') {
  const shape = new THREE.Shape(); shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, Math.PI * 2, true); shape.holes.push(hole);
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 48 }), mat);
  mesh.rotation.x = Math.PI / 2; mesh.position.set(pos[0], pos[1] + height / 2, pos[2]);
  mesh.name = name; mesh.userData.boreRadius = inner; parent.add(mesh); return mesh;
}
function straightTube(parent, radius, height, pos, mat, name = '') {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 64, 1, true), mat);
  mesh.position.set(...pos); mesh.name = name; parent.add(mesh); return mesh;
}
const SUB_RHO = 1025, SUB_G = G, SUB_DISPLACEMENT_M3 = 0.08, SUB_DRY_MASS_KG = 70;
const SUB_HULL_HEIGHT = 0.20, SUB_FLOOR = 0.12, SUB_AREA = 1.80 * 0.76, SUB_EMPTY_LEVEL = 1.08;
export function submarineState(t = 0, inputs = {}) {
  const ballastKg = clamp(value(inputs, 'ballast', 10), 0, 32), totalMassKg = SUB_DRY_MASS_KG + ballastKg;
  const maxBuoyancyN = SUB_RHO * SUB_G * SUB_DISPLACEMENT_M3, weightN = totalMassKg * SUB_G;
  const fullSubmergedMarginN = maxBuoyancyN - weightN;
  const displacedVolumeM3 = Math.min(totalMassKg / SUB_RHO, SUB_DISPLACEMENT_M3);
  const ballastVolumeM3 = ballastKg / SUB_RHO;
  // Exterior water plus tank water is conserved, including water drawn into ballast.
  const surfaceY = SUB_EMPTY_LEVEL + (displacedVolumeM3 - ballastVolumeM3) / SUB_AREA;
  const displacedFraction = displacedVolumeM3 / SUB_DISPLACEMENT_M3;
  const immersion=inverseFraction(displacedVolumeM3/SUB_DISPLACEMENT_M3,u=>submarineWetVolume(u*SUB_HULL_HEIGHT/2)/SUB_DISPLACEMENT_M3);
  const releaseY=surfaceY-immersion*SUB_HULL_HEIGHT/2;
  // Independent release experiment, linear drag Fd = c v, no invented equilibrium depth.
  const elapsed = Math.max(0, Number.isFinite(t) ? t : 0), drag = 120;
  const downwardN = Math.max(0, -fullSubmergedMarginN), tau = totalMassKg / drag;
  const freeFall = downwardN / drag * (elapsed - tau * (1 - Math.exp(-elapsed / tau)));
  const centerY = Math.max(SUB_FLOOR + SUB_HULL_HEIGHT / 2, releaseY - freeFall);
  const onBottom = downwardN > 0 && centerY <= SUB_FLOOR + SUB_HULL_HEIGHT / 2 + 1e-10;
  const neutralBallastKg = SUB_RHO * SUB_DISPLACEMENT_M3 - SUB_DRY_MASS_KG;
  const mode = fullSubmergedMarginN > 1e-8 ? '漂浮平衡' : fullSubmergedMarginN >= -1e-8 ? '近中性浮力' : onBottom ? '触底：底板支承' : '负浮力下沉';
  return { ballastKg, totalMassKg, maxBuoyancyN, weightN, fullSubmergedMarginN, displacedFraction,
    displacedVolumeM3, ballastVolumeM3, surfaceY, centerY, neutralBallastKg, mode, onBottom,
    sinkDepthM: releaseY - centerY, bottomReactionN: onBottom ? downwardN : 0,
    externalWaterVolumeM3: SUB_AREA * (surfaceY - SUB_FLOOR) - displacedVolumeM3 };
}
// Solve water conservation with the rounded, elliptical capsule immersion.
// A*S - A*emptyLevel = displacedVolume - ballastVolume.
export function submarineHydrostatics(centerY, ballastKg = 10, velocityY = 0) {
  ballastKg = clamp(ballastKg, 0, 32);
  const ballastVolumeM3 = ballastKg / SUB_RHO, totalMassKg = SUB_DRY_MASS_KG + ballastKg;
  const bottom = centerY - SUB_HULL_HEIGHT / 2, top = centerY + SUB_HULL_HEIGHT / 2;
  const drySurface = SUB_EMPTY_LEVEL - ballastVolumeM3 / SUB_AREA;
  const fullSurface = SUB_EMPTY_LEVEL + (SUB_DISPLACEMENT_M3 - ballastVolumeM3) / SUB_AREA;
  let surfaceY;
  if(drySurface<=bottom)surfaceY=drySurface;
  else if(fullSurface>=top)surfaceY=fullSurface;
  else{
    let lo=drySurface,hi=fullSurface;
    for(let i=0;i<32;i++){const mid=(lo+hi)/2,conserved=SUB_EMPTY_LEVEL+(submarineWetVolume(mid-centerY)-ballastVolumeM3)/SUB_AREA;if(mid<conserved)lo=mid;else hi=mid;}
    surfaceY=(lo+hi)/2;
  }
  const displacedVolumeM3=submarineWetVolume(surfaceY-centerY);
  const buoyancyN = SUB_RHO * SUB_G * displacedVolumeM3, weightN = totalMassKg * SUB_G;
  const maxBuoyancyN = SUB_RHO * SUB_G * SUB_DISPLACEMENT_M3;
  const netBuoyancyN = buoyancyN - weightN;
  const onBottom = centerY <= SUB_FLOOR + SUB_HULL_HEIGHT / 2 + 1e-9 && netBuoyancyN <= 0;
  const mode = onBottom ? '触底：底板支承' : velocityY > .005 ? '正在上浮' : velocityY < -.005 ? '正在下沉'
    : Math.abs(netBuoyancyN) < .3 ? displacedVolumeM3 < SUB_DISPLACEMENT_M3 - 1e-6 ? '漂浮平衡' : '近中性浮力'
    : netBuoyancyN > 0 ? '正浮力：开始上浮' : '负浮力：开始下沉';
  return {ballastKg,ballastVolumeM3,totalMassKg,centerY,velocityY,surfaceY,displacedVolumeM3,
    displacedFraction:displacedVolumeM3/SUB_DISPLACEMENT_M3,buoyancyN,weightN,netBuoyancyN,maxBuoyancyN,
    fullSubmergedMarginN:maxBuoyancyN-weightN,onBottom,bottomReactionN:onBottom?-netBuoyancyN:0,mode,
    externalWaterVolumeM3:SUB_AREA*(surfaceY-SUB_FLOOR)-displacedVolumeM3};
}

// Model-local history; the shared guide chooses ballast, never a depth trajectory.
export function createSubmarineDynamics() {
  let time = null, y = 0, velocity = 0, ballast = 10, current;
  const refresh = () => current = submarineHydrostatics(y,ballast,velocity);
  function reset(t = 0, inputs = {}) {
    time = Math.max(0,Number.isFinite(t)?t:0);
    ballast = clamp(value(inputs,'ballast',10),0,32);
    y = submarineState(0,{ballast}).centerY; velocity = 0; refresh();
  }
  function update(t = 0, inputs = {}) {
    t = Math.max(0,Number.isFinite(t)?t:0);
    if(time===null)reset(0,inputs);
    // Seeking backwards or across a very large gap is an explicit restart, not playback.
    if(t<time-1e-9||t-time>30){reset(t,inputs);return {...current};}
    const targetBallast=clamp(value(inputs,'ballast',10),0,32),elapsed=Math.max(0,t-time),previousBallast=ballast;
    const steps=Math.ceil(elapsed*240),dt=steps?elapsed/steps:0;
    for(let i=0;i<steps;i++){
      ballast=previousBallast+(targetBallast-previousBallast)*(i+.5)/steps;
      const s=refresh(),force=s.netBuoyancyN-120*velocity;
      velocity+=force/s.totalMassKg*dt; y+=velocity*dt;
      if(y<SUB_FLOOR+SUB_HULL_HEIGHT/2){y=SUB_FLOOR+SUB_HULL_HEIGHT/2;velocity=Math.max(0,velocity);}
    }
    time=t;ballast=targetBallast;refresh();return {...current};
  }
  function snapshot(){return {version:1,time,y,velocity,ballast};}
  function restore(saved,t=0,inputs={}){
    if(saved?.version!==1||![saved.y,saved.velocity].every(Number.isFinite)){reset(t,inputs);return;}
    time=Math.max(0,Number.isFinite(t)?t:0);y=Math.max(SUB_FLOOR+SUB_HULL_HEIGHT/2,saved.y);
    velocity=saved.velocity;ballast=clamp(value(inputs,'ballast',saved.ballast),0,32);refresh();
  }
  function seek(t,inputs,sample){
    reset(0,sample(0));
    for(let i=1;i<=Math.ceil(t*120);i++){const at=Math.min(t,i/120);update(at,sample(at));}
    update(t,inputs);
  }
  function seekFrom(saved,start,t,sample){
    restore(saved,start,sample(start));
    for(let i=1;i<=Math.ceil((t-start)*120);i++){const at=Math.min(t,start+i/120);update(at,sample(at));}
  }
  return {update,reset,snapshot,restore,seek,seekFrom,state:()=>current?{...current}:null};
}
function buildSubmarine() {
  const root=new THREE.Group(),parts=[],moving=[];
  const make=(id,name,text,offset=[0,0,0],shell=false)=>{const p=assembly(root,id,name,text,offset,shell);parts.push(p);return p;};
  const motion=part=>{const g=nested(part);moving.push(g);return g;};
  const basin=make('basin','透明教学水槽','水面是浮沉的参照；艇体运动时镜头保持固定。',[0,-.08,0]);
  const rim=material('#7494ad',.3,.45),glass=material('#b9ddeb',.03,.3,.045);
  box(basin.object,[1.84,.04,.80],[0,.10,0],rim);
  for(const z of [-.39,.39])box(basin.object,[1.84,1.18,.006],[0,.71,z],glass).userData.nonPickable=true;
  for(const x of [-.91,.91])box(basin.object,[.006,1.18,.78],[x,.71,0],glass).userData.nonPickable=true;
  const backdrop=box(basin.object,[1.8,1,.002],[0,.62,-.38],new THREE.MeshBasicMaterial({color:'#dfF2fa',transparent:true,opacity:.35,depthWrite:false}));backdrop.userData.connection=true;
  const surface=new THREE.Group();surface.name='sub-3d-waterline';surface.userData.hideWhenExploded=true;basin.object.add(surface);
  for(const z of [-.38,.38])box(surface,[1.8,.003,.003],[0,0,z],rim).userData.nonPickable=true;
  for(const x of [-.9,.9])box(surface,[.003,.003,.76],[x,0,0],rim).userData.nonPickable=true;
  const hull=make('pressure-hull','透明艇壳','透明圆头艇身包围内部舱室；轮廓、压载舱和空气瓶的位置与剖面一致。',[0,.10,0],true);
  const hullEnvelope=motion(hull);hullEnvelope.name='sub-displacement-hull';
  const ballast=make('ballast-tanks','前后压载舱','前后两只压载舱对称进排水，每舱容积16 L；蓝色水位显示充水量。',[0,0,.25],true);
  const air=make('air-bank','压缩空气瓶与分支管','中央空气瓶经上方管道把空气送入两只压载舱，将水排出艇外。',[0,.20,.12]);
  const vents=make('vents-and-floods','进排水口','压载舱底部的开口与舱外水连通；箭头显示进水或排水。',[0,-.10,.15]);
  const sail=make('sail','指挥塔与潜望镜','保留潜水艇的识别结构；薄壁附件的排水量在本教学模型中忽略。',[0,.24,0]);
  const prop=make('propulsion','螺旋桨与尾轴','尾部螺旋桨用于识别艇体方向，本演示只研究竖直浮沉。',[.20,0,0]);
  const vessel=buildSubmarineVessel({hull:hullEnvelope,ballast:motion(ballast),air:motion(air),vents:motion(vents),sail:motion(sail),prop:motion(prop)});
  vessel.shell.userData.nonPickable=true;
  const teachingPart=make('side-lesson','浮沉侧视教学图','与整体共用艇形、前后压载舱及中央空气瓶的位置。');
  teachingPart.object.userData.hideWhenExploded=true;teachingPart.object.userData.nonPickable=true;
  const teaching=createSubmarineTeaching(teachingPart.object),dynamics=createSubmarineDynamics();
  let lastTime=0,lastBallast=10,waterRate=0;
  return {root,parts,physicsState:dynamics.state,snapshot:dynamics.snapshot,restore:dynamics.restore,reset:dynamics.reset,seek:dynamics.seek,seekFrom:dynamics.seekFrom,setView:teaching.setView,
    readout:()=>submarineReadoutState(dynamics.state()||submarineHydrostatics(submarineState().centerY),waterRate),
    update(t=0,inputs={}){
      const s=dynamics.update(t,inputs);moving.forEach(g=>g.position.y=s.centerY);
      if(Number.isFinite(inputs._waterRate))waterRate=inputs._waterRate;
      else if(t>lastTime)waterRate=(s.ballastKg-lastBallast)/(t-lastTime);
      else if(t<lastTime)waterRate=0;
      lastTime=t;lastBallast=s.ballastKg;
      teaching.update(t,s,waterRate);vessel.update(t,s,waterRate);
      surface.position.y=s.surfaceY;backdrop.scale.y=s.surfaceY-SUB_FLOOR;backdrop.position.y=(s.surfaceY+SUB_FLOOR)/2;
    }
  };
}
function submarineReadoutState(s,waterRate=0) {
  const neutral=Math.abs(s.netBuoyancyN)<.3&&s.displacedFraction>.999;
  return {phaseIndex:waterRate<-.02||s.velocityY>.005?3:waterRate>.02||s.onBottom||s.velocityY<-.005?1:neutral?2:0,
    title:waterRate>.02?'压载舱进水，潜水艇变重':waterRate<-.02?'空气压入舱内，把水排出去':neutral?'重力与浮力平衡，竖直运动逐渐减弱':s.mode,
    text:s.onBottom?'艇已触底；额外重量由底板支承。排出压载水后，浮力超过重量就从底部连续上浮。'
      :waterRate>.02?'蓝色箭头表示水流入压载舱；整艇质量增加。完全浸没后，重力大于浮力就会下沉。'
      :waterRate<-.02?'金色箭头表示压缩空气进入，蓝色箭头表示排水；整艇变轻，浮力大于重力就会上浮。'
      :neutral?'完全浸没时，重力与浮力大小相等；水的阻力让剩余竖直速度逐渐减小。'
      :`压载水 ${fmt(s.ballastKg)} kg；浮力 ${fmt(s.buoyancyN,0)} N，重力 ${fmt(s.weightN,0)} N。上浮和下沉由合力与当前速度共同决定。`,
    values:[{label:'压载水质量',value:fmt(s.ballastKg),unit:'kg'},{label:'实际浮力',value:fmt(s.buoyancyN,0),unit:'N'},
      {label:'重力',value:fmt(s.weightN,0),unit:'N'},{label:'浸没比例',value:fmt(s.displacedFraction*100,0),unit:'%'}]};
}
function submarineReadout(t,inputs) {
  const reference=submarineState(t,inputs);
  return submarineReadoutState(submarineHydrostatics(reference.centerY,reference.ballastKg));
}

const LOCK_LOW = 0.44;
const LOCK_FLOOR = 0.22;
const LOCK_HEAD_SCALE = 0.05;
export function canalLockState(t = 0, inputs = {}) {
  const direction = inputs.direction === 'upstream' ? 'upstream' : 'downstream';
  const headM = clamp(value(inputs, 'head', 4), 1, 6);
  // Keep a manually selected endpoint visible while paused, but cycle through
  // the six internal beats during playback instead of freezing at 100%.
  const manualProgress = clamp(value(inputs, 'progress', 0));
  const elapsedProgress = Math.max(0, Number.isFinite(t) ? t : 0) / 20;
  const progress = elapsedProgress === 0 ? manualProgress : mod1(manualProgress + elapsedProgress);
  const q = Math.min(5.999999, progress * 6);
  const segment = Math.floor(q), u = q - segment;
  const high = LOCK_LOW + headM * LOCK_HEAD_SCALE;
  const down = direction === 'downstream';
  let level, upperGate = 0, lowerGate = 0, fillValve = 0, emptyValve = 0, boatX, boatVisible = true;
  if (down) {
    if (segment === 0) { level = high; upperGate = 1; boatX = -1.10 + u * 1.10; }
    else if (segment === 1) { level = high; upperGate = 1 - u; boatX = 0; }
    else if (segment === 2) { level = high + (LOCK_LOW - high) * u; emptyValve = 1; boatX = 0; }
    else if (segment === 3) { level = LOCK_LOW; lowerGate = clamp(u / 0.40); boatX = clamp((u - 0.40) / 0.60) * 1.10; }
    else if (segment === 4) {
      const fill = clamp((u - 0.22) / 0.78);
      level = LOCK_LOW + (high - LOCK_LOW) * fill;
      lowerGate = 1 - clamp(u / 0.22);
      fillValve = u > 0.22 ? 1 : 0;
      boatX = 1.10;
      boatVisible = false;
    } else { level = high; upperGate = u; boatX = -1.10; boatVisible = false; }
  } else {
    if (segment === 0) { level = LOCK_LOW; lowerGate = 1; boatX = 1.10 - u * 1.10; }
    else if (segment === 1) { level = LOCK_LOW; lowerGate = 1 - u; boatX = 0; }
    else if (segment === 2) { level = LOCK_LOW + (high - LOCK_LOW) * u; fillValve = 1; boatX = 0; }
    else if (segment === 3) { level = high; upperGate = clamp(u / 0.40); boatX = -clamp((u - 0.40) / 0.60) * 1.10; }
    else if (segment === 4) {
      const empty = clamp((u - 0.22) / 0.78);
      level = high - (high - LOCK_LOW) * empty;
      upperGate = 1 - clamp(u / 0.22);
      emptyValve = u > 0.22 ? 1 : 0;
      boatX = -1.10;
      boatVisible = false;
    } else { level = LOCK_LOW; lowerGate = u; boatX = 1.10; boatVisible = false; }
  }
  const chamberHeadM = (level - LOCK_LOW) / LOCK_HEAD_SCALE;
  const equalUpper = Math.abs(level - high) < 1e-7;
  const equalLower = Math.abs(level - LOCK_LOW) < 1e-7;
  const safe = !(upperGate > 1e-6 && !equalUpper) && !(lowerGate > 1e-6 && !equalLower)
    && !(upperGate > 1e-6 && lowerGate > 1e-6)
    && !(fillValve > 1e-6 && (upperGate > 1e-6 || lowerGate > 1e-6))
    && !(emptyValve > 1e-6 && (upperGate > 1e-6 || lowerGate > 1e-6));
  return { direction, headM, progress, segment, segmentProgress: u, lowLevel: LOCK_LOW, highLevel: high,
    level, chamberHeadM, upperGate, lowerGate, fillValve, emptyValve, boatX, boatVisible,
    equalUpper, equalLower, safe,
    title: down
      ? ['上游闸门开启，船进入', '关闭上游闸门', '关闭闸门后放水', '水位相等，开启下游闸门', '关闭闸门后充水', '水位相等，准备下一船'][segment]
      : ['下游闸门开启，船进入', '关闭下游闸门', '关闭闸门后充水', '水位相等，开启上游闸门', '关闭闸门后放水', '水位相等，准备下一船'][segment] };
}

function buildCanalLock() {
  const root=new THREE.Group(),parts=[];
  const concrete=material('#9faeb5',.1,.65),edge=material('#576d78',.6,.3),gateMat=material('#355c70',.5,.3);
  const brass=material('#bc9552',.7,.3),glass=material('#a0d2e6',.02,.2,.13),waterMat=material('#3294bf',.02,.2,.30);
  const make=(id,name,text,offset,shell=false)=>{const p=assembly(root,id,name,text,offset,shell);parts.push(p);return p;};
  const stage=make('foundation','透明底板与连续岸壁','透明底板显示地下涵洞；顶面为统一水位基准，近岸透明墙仍高于最高水位。',[0,-.1,0]);
  stage.object.userData.explodePrimary=true;
  volumeBox(stage.object,[2.78,.12,.76],[0,.16,0],material('#9faeb5',.1,.65,.24),'lock-floor');
  for(const z of [-.325,.325]) volumeBox(stage.object,[2.78,.68,.07],[0,.56,z],z>0?glass:concrete,'lock-bank-wall');
  for(const x of [-1.39,1.39]) volumeBox(stage.object,[.02,.68,.58],[x,.56,0],glass,'lock-end-wall');
  const pools=make('approach-pools','上游与下游水域','两侧水体一直延伸到门平面，开门等水位时与闸室连续。',[0,.15,0]);
  pools.object.userData.hideWhenExploded=true;
  const highW=nonPickable(volumeBox(pools.object,[.86,1,.58],[-.96,0,0],waterMat,'lock-high-water'));
  const lowW=nonPickable(volumeBox(pools.object,[.86,1,.58],[.96,0,0],waterMat,'lock-low-water'));
  const chamber=make('chamber','闸室水体','水位变动只发生在两端门关闭时，所有水体共用同一底板高度。',[0,.10,0]);
  chamber.object.userData.hideWhenExploded=true;
  const chamberW=nonPickable(volumeBox(chamber.object,[1.06,1,.58],[0,0,0],waterMat,'lock-chamber-water'));
  [highW,lowW,chamberW].forEach(m=>m.userData.connection=true);
  const culverts=make('culverts','两条带阀涵洞','充水通路接上游和闸室，泄水通路接闸室和下游；阀板位于各自实际管线上。',[0,-.15,.15]);
  const valveLeaves=[];
  for(const sign of [-1,1]) {
    const z=sign*.12;
    const route=[[sign*1.10,.28,z],[sign*1.10,.16,z],[sign*.30,.16,z],[sign*.30,.28,z]];
    const curve=new THREE.CurvePath();for(let i=0;i<route.length-1;i++)curve.add(new THREE.LineCurve3(new THREE.Vector3(...route[i]),new THREE.Vector3(...route[i+1])));
    const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,80,.035,16,false),material('#536e80',.25,.35,.75));culverts.object.add(tube);tube.name=sign<0?'lock-fill-pipe':'lock-empty-pipe';tube.userData.route=route;
    const flap=volumeBox(culverts.object,[.012,.07,.07],[sign*.72,.16,z],brass,sign<0?'lock-fill-valve':'lock-empty-valve');
    cylIn(culverts.object,.008,.20,[sign*.72,.29,z],brass);
    valveLeaves.push(flap);
  }
  const gates=make('mitre-gates','两端对开平面闸门','教学用对开门：两叶闭合覆盖整个河宽；等水位完全打开后船才起航。',[0,.05,.16]);
  const leaves=[];
  for(const x of [-.53,.53]) for(const side of [-1,1]) {
    const pivot=nested(gates);pivot.position.set(x,0,side*.29);pivot.name=`lock-pivot-${x}-${side}`;
    const leaf=volumeBox(pivot,[.035,.64,.29],[0,.54,-side*.145],gateMat,`lock-leaf-${x}-${side}`);
    boxIn(pivot,[.04,.025,.29],[0,.84,-side*.145],brass);leaves.push({pivot,leaf,x,side});
  }
  const frames=make('upper-gate-frame','铰轴与门框','门框支承闸门，叶片向上游岸边收拢，中央航道完全让开。',[0,.16,-.08]);
  for(const x of [-.53,.53])for(const z of [-.31,.31])cylIn(frames.object,.018,.68,[x,.55,z],edge);
  const ship=make('vessel','过闸船','船完全进入闸室才关入口；出口门完成开启后再移动，船离开整个闸门扫掠区后才复位。',[.12,.12,0]);
  const boat=nested(ship);boat.name='lock-boat';
  volumeBox(boat,[.32,.09,.14],[0,0,0],material('#b86d42',.3,.4),'lock-boat-hull');
  volumeBox(boat,[.15,.10,.12],[-.02,.095,0],material('#e7e4dc',.1,.4));
  boxIn(boat,[.19,.02,.15],[-.02,.155,0],edge);
  return {root,parts,update(t=0,inputs={}){
    const s=canalLockState(t,inputs);
    for(const [mesh,level] of [[highW,s.highLevel],[lowW,s.lowLevel],[chamberW,s.level]]){
      mesh.scale.y=level-LOCK_FLOOR;mesh.position.y=(level+LOCK_FLOOR)/2;
    }
    leaves.forEach(g=>g.pivot.rotation.y=g.side*(g.x<0?s.upperGate:s.lowerGate)*Math.PI/2);
    valveLeaves[0].position.y=.16+s.fillValve*.085;valveLeaves[1].position.y=.16+s.emptyValve*.085;
    boat.position.x=s.boatX;
    // External boats stay at their pool level while the empty chamber resets.
    const boatLevel=s.boatX<-.53?s.highLevel:s.boatX>.53?s.lowLevel:s.level;
    boat.position.y=boatLevel+.005;boat.rotation.y=s.direction==='upstream'?Math.PI:0;boat.visible=s.boatVisible;
  }};
}

function canalLockReadout(t, inputs) {
  const s = canalLockState(t, inputs), isDown = s.direction === 'downstream';
  const safeText = s.safe ? '闸门互锁正常' : '状态冲突';
  const phaseIndex = [0, 1, 2, 3, 2, 0][s.segment];
  return { phaseIndex, title: s.title,
    text: `${isDown ? '下行' : '上行'}过闸：先在水位相等时开门，船进入后关门，再用重力涵洞调节闸室水位。${safeText}。`,
    values: [
      { label: '闸室高于下游', value: fmt(s.chamberHeadM, 1), unit: 'm' },
      { label: '上下游落差', value: fmt(s.headM, 1), unit: 'm' },
      { label: '闸门互锁', value: s.safe ? '安全' : '检查', unit: '' },
    ] };
}

const MANOMETER_GAUGES = { oil: { label: '轻油', rho: 850 }, water: { label: '水', rho: 1000 } };
const MANOMETER_WATER_RHO = 1000;
export function manometerState(_t = 0, inputs = {}) {
  const depthM = clamp(value(inputs, 'depth', 0.28), 0, 0.5);
  const gauge = inputs.gauge === 'water' ? 'water' : 'oil';
  const rhoGauge = MANOMETER_GAUGES[gauge].rho;
  const gaugePressurePa = MANOMETER_WATER_RHO * G * depthM;
  const levelDifferenceM = gaugePressurePa / (rhoGauge * G);
  return { depthM, gauge, rhoGauge, waterDensity: MANOMETER_WATER_RHO, g: G,
    gaugePressurePa, levelDifferenceM, leftLevelM: levelDifferenceM / 2,
    rightLevelM: -levelDifferenceM / 2, probePressurePa: 101325 + gaugePressurePa };
}

function buildManometer() {
  const root = new THREE.Group(), parts = [];
  const board = material('#e6e0d2', 0.08, 0.52), steel = material('#9daeb5', 0.75, 0.27);
  const brass = material('#bd9252', 0.78, 0.23), glass = material('#b8e4ef', 0.02, 0.14, 0.17);
  const oil = material('#d8a845', 0.04, 0.18, 1), waterMat = material('#347eb1', 0.02, 0.18, 0.43);
  const make = (id, name, description, explode, shell = false) => {
    const p = assembly(root, id, name, description, explode, shell); parts.push(p); return p;
  };

  const panel = make('stand-and-scale', '刻度背板与支架', '背板固定U形玻璃管和水槽；刻度以液柱高度差为读数依据。', [0, -0.05, 0]);
  addBox(panel, [1.55, 0.08, 0.46], [0.15, 0.07, 0], board);
  addBox(panel, [1.45, 1.07, 0.035], [0.15, 0.62, -0.20], board).name='manometer-backboard';
  for (const x of [-0.59, 0.78]) addBox(panel, [0.045, 1.08, 0.06], [x, 0.63, -0.16], steel);
  for (let i = 0; i <= 6; i++) addBox(panel, [0.09 + (i % 2 === 0 ? 0.06 : 0), 0.008, 0.012], [-0.50, 0.33 + i * 0.10, -0.13], steel);

  const gaugeTube = make('u-tube', 'U形管与测压液', '一臂接密封引压管，另一臂开口通大气。两侧液面差与压差满足 Δp = ρ液 g Δh。', [-0.12, 0.04, 0.12], true);
  const tubeGlass=material('#729bab',.08,.28,.28);
  // Constant-bore U tube: the liquid bend and glass share the very same centreline.
  const bendPath=[];
  for(let i=0;i<=32;i++){const a=Math.PI+i*Math.PI/32;bendPath.push([-.20+.16*Math.cos(a),.32+.16*Math.sin(a),.045]);}
  addPipe(gaugeTube,bendPath,.025,tubeGlass).name='manometer-bend-shell';
  const bendLiquid=addPipe(gaugeTube,bendPath,.017,oil);bendLiquid.name='manometer-bend-liquid';bendLiquid.userData.connection=true;
  for(const x of [-.36,-.04]) straightTube(gaugeTube.object,.025,.70,[x,.67,.045],tubeGlass);
  ring(gaugeTube.object,.033,.025,.014,[-.04,1.02,.045],brass);
  // Seal the annulus around the smaller pressure line, retaining its air bore.
  const rubber=material('#394a53',.02,.72);
  ring(gaugeTube.object,.025,.009,.032,[-.04,1.018,.045],rubber,'manometer-pressure-stopper');
  ring(gaugeTube.object,.009,.006,.048,[-.04,1.050,.045],brass,'manometer-pressure-nipple');
  const liquidBottom=.32,liquidMaxHeight=.64;
  const leftLiquidGroup=nested(gaugeTube),rightLiquidGroup=nested(gaugeTube);
  for(const [group,x,name]of [[leftLiquidGroup,-.36,'manometer-left-liquid'],[rightLiquidGroup,-.04,'manometer-right-liquid']]){
    group.position.set(x,liquidBottom,.045);
    const slug=nonPickable(cylIn(group,.017,liquidMaxHeight,[0,liquidMaxHeight/2,0],oil));
    slug.name=name;slug.userData.connection=true;
  }

  const reference = make('atmosphere-reference', '大气端与等高基准', '左臂顶部敞开通大气；背板上的横线标出可比较同一液体压强的等高位置。', [-0.22, 0.06, -0.02]);
  ring(reference.object,.033,.025,.014,[-.36,1.02,.045],steel,'manometer-open-mouth');
  nonPickable(addBox(reference, [0.42, 0.008, 0.012], [-0.20, 0.63, -0.055], brass));
  addBox(reference, [0.03, 0.035, 0.025], [-0.36, 0.63, -0.045], steel);
  addBox(reference, [0.03, 0.035, 0.025], [-0.04, 0.63, -0.045], steel);

  const tank = make('test-tank', '开放式水槽', '水槽上表面通大气；探头所处深度决定水的静压 ρ水 g h。', [0.16, 0.10, 0], true);
  volumeBox(tank.object,[.48,.025,.34],[.58,.235,0],glass);
  for(const z of [-.16,.16])volumeBox(tank.object,[.48,.71,.02],[.58,.60,z],glass);
  for(const x of [.35,.81])volumeBox(tank.object,[.02,.71,.30],[x,.60,0],glass);
  const tankWater = nonPickable(addBox(tank, [0.43, 0.5225, 0.29], [0.58, 0.50875, 0], waterMat));
  tankWater.userData.connection = true;
  for (const x of [0.34, 0.82]) addBox(tank, [0.035, 0.72, 0.38], [x, 0.63, 0], steel);
  // The tank is open at the top; side frames do not cover the water.

  const probe = make('pressure-probe', '密封测压探头', '探头端的隔膜感受水压，经密闭引压管把压力传给U形管；水不会流进测压液。可直接拖动探头改变深度。', [0.20, 0.00, 0.16]);
  probe.drag = { control: 'depth', axis: 'y', scale: -1 };
  const pressureHose=addPipe(probe, [[-0.04, 1.050, 0.045], [-0.04, 1.075, 0.045], [-0.04, 1.10, 0.045], [0.02, 1.12, 0.045], [0.23, 1.12, 0.045], [0.33, 1.03, 0.045], [0.58, 1.03, 0.045], [0.91, 1.03, 0.045], [0.91, 0.98, 0.045], [0.68, 0.98, 0.045], [0.68, 0.77, 0.045]], 0.012, rubber);
  pressureHose.name='manometer-pressure-hose';pressureHose.userData.hideWhenExploded=true;
  ring(probe.object,.014,.012,.009,[-.04,1.057,.045],steel,'manometer-hose-clamp').userData.hideWhenExploded=true;
  addBox(probe, [0.13, 0.04, 0.09], [0.68, 0.99, 0.045], brass);
  addCylinder(probe, 0.023, 0.034, [0.68, 0.79, 0.045], steel);
  const probeExtension = nested(probe); probeExtension.position.set(0.68, 0.77, 0.045);
  const extensionTube = cylIn(probeExtension, 0.009, 0.50, [0, -0.25, 0], brass);
  const probeMotion = nested(probe); probeMotion.position.set(0.68, 0.77, 0.045);
  cylIn(probeMotion, 0.021, 0.075, [0, 0.038, 0], brass);
  const diaphragm = boxIn(probeMotion, [0.045, 0.008, 0.07], [0, 0, 0], steel);
  diaphragm.name='manometer-diaphragm';
  diaphragm.userData.nonPickable = true;
  probeMotion.name='manometer-probe';
  extensionTube.name='manometer-probe-extension';

  return { root, parts, update(t = 0, inputs = {}) {
    const s = manometerState(t, inputs), center = 0.63;
    const visualDelta = s.levelDifferenceM;
    leftLiquidGroup.scale.y = Math.max(0, (center + visualDelta / 2 - liquidBottom) / liquidMaxHeight);
    rightLiquidGroup.scale.y = Math.max(0, (center - visualDelta / 2 - liquidBottom) / liquidMaxHeight);
    leftLiquidGroup.position.y = liquidBottom;
    rightLiquidGroup.position.y = liquidBottom;
    probeExtension.scale.y = s.depthM / 0.5;
    probeMotion.position.y = 0.77 - s.depthM;
    oil.color.set(s.gauge === 'oil' ? '#d8a845' : '#347eb1');
  } };
}

function manometerReadout(t, inputs) {
  const s = manometerState(t, inputs);
  return { phaseIndex: s.depthM < 0.01 ? 0 : s.depthM < 0.26 ? 1 : 2,
    title: '液柱差读压强',
    text: `探头深度 h=${fmt(s.depthM, 2)} m；密封引压使测压液两侧压差等于探头表压。ρ水gh = ρ液gΔh。`,
    values: [
      { label: '探头表压', value: fmt(s.gaugePressurePa / 1000, 2), unit: 'kPa' },
      { label: '液面高度差', value: fmt(s.levelDifferenceM * 1000, 0), unit: 'mm' },
      { label: '测压液密度', value: String(s.rhoGauge), unit: 'kg/m³' },
    ] };
}

const PUMP_ATM_PA = 101325;
const PUMP_RHO = 1000;
const PUMP_BORE_M = 0.12;
const PUMP_LEVER_LENGTH_M = 0.58;
const PUMP_LEVER_ANGLE_RAD = 0.30;
const PUMP_ROD_LENGTH_M = 0.53;
const PUMP_PIVOT_X_M = 0.22;
const PUMP_PIVOT_Y_M = 1.70;
const PUMP_OUTLET_PORT_Y_M = 1.40;
const PUMP_STROKE_M = 2 * PUMP_LEVER_LENGTH_M * Math.sin(PUMP_LEVER_ANGLE_RAD);
export function pistonPumpState(t = 0, inputs = {}) {
  const frequencyHz = clamp(value(inputs, 'speed', 0.25), 0, 0.8);
  const liftM = clamp(value(inputs, 'lift', 4), 0, 12);
  const phase = mod1(Math.max(0, Number.isFinite(t) ? t : 0) * frequencyHz + value(inputs, '_phaseOffset', 0));
  const upstroke = phase < 0.5;
  const strokeProgress = upstroke ? phase * 2 : (1 - phase) * 2;
  const theta = PUMP_LEVER_ANGLE_RAD * Math.cos(2 * Math.PI * phase);
  const theoreticalMaxLiftM = PUMP_ATM_PA / (PUMP_RHO * G);
  const suctionPossible = liftM < theoreticalMaxLiftM;
  const displacedPerCycleM3 = Math.PI * (PUMP_BORE_M / 2) ** 2 * PUMP_STROKE_M;
  const theoreticalFlowLMin = displacedPerCycleM3 * frequencyHz * 60 * 1000;
  const flowLMin = suctionPossible ? theoreticalFlowLMin : 0;
  const inletValveOpen = upstroke && suctionPossible && frequencyHz > 0;
  const pistonValveOpen = !upstroke && suctionPossible && frequencyHz > 0;
  const suctionPressurePa = Math.max(0, PUMP_ATM_PA - PUMP_RHO * G * liftM);
  const linkageUpper = { x: PUMP_PIVOT_X_M - PUMP_LEVER_LENGTH_M * Math.cos(theta),
    y: PUMP_PIVOT_Y_M - PUMP_LEVER_LENGTH_M * Math.sin(theta) };
  const linkageLower = { x: -0.36, y: linkageUpper.y };
  const pistonCenterY = linkageUpper.y - PUMP_ROD_LENGTH_M;
  const pistonTopY = pistonCenterY + 0.023;
  const chamberPressurePa = upstroke ? suctionPressurePa : PUMP_ATM_PA + PUMP_RHO * G * (PUMP_OUTLET_PORT_Y_M - pistonTopY);
  const stage = !suctionPossible ? '吸水高度超限' : frequencyHz === 0 ? '已停机：活塞保持当前位置' : upstroke ? '上行：底阀进水、活塞阀关闭' : '下行：底阀关闭、水穿过活塞阀';
  return { frequencyHz, liftM, phase, upstroke, strokeProgress, theta, theoreticalMaxLiftM, suctionPossible,
    displacedPerCycleM3, theoreticalFlowLMin, flowLMin, inletValveOpen, pistonValveOpen,
    chamberPressurePa, pistonCenterY, pistonTopY, outletPortY: PUMP_OUTLET_PORT_Y_M, linkageUpper, linkageLower, stage };
}

function buildPistonPump() {
  const root=new THREE.Group(),parts=[];
  const cast=material('#466274',.55,.35),steel=material('#acb8bb',.70,.3),brass=material('#c49a54',.7,.3);
  const dark=material('#243a46',.5,.4),glass=material('#ffffff',0,.18,.045);
  const water=new THREE.MeshBasicMaterial({color:'#66c3e3',transparent:true,opacity:.26,depthWrite:false,side:THREE.DoubleSide});
  const surfaceWater=new THREE.MeshBasicMaterial({color:'#269bc6',transparent:true,opacity:.45,depthWrite:false,side:THREE.DoubleSide});
  const bright=new THREE.MeshBasicMaterial({color:'#087ac3',toneMapped:false}),make=(id,name,text,offset,shell=false)=>{const p=assembly(root,id,name,text,offset,shell);parts.push(p);return p;};
  const x=-.36,bottom=.59,top=1.45,rodRadius=.008,portR=.022;
  const frame=make('base-and-reservoir','开放供水槽','供水槽是远端水源示意；水源提升高度由实验参数设定，不按画面短管长度读取。',[0,-.08,0]);
  boxIn(frame.object,[.85,.08,.65],[0,.08,0],dark);
  volumeBox(frame.object,[.58,.025,.46],[-.12,.17,0],glass);
  for(const z of [-.22,.22])volumeBox(frame.object,[.58,.28,.02],[-.12,.30,z],glass);
  for(const xx of [-.40,.16])volumeBox(frame.object,[.02,.28,.44],[xx,.30,0],glass);
  nonPickable(volumeBox(frame.object,[.54,.19,.42],[-.12,.2775,0],water,'pump-source-water')).userData.connection=true;
  const sourceSurface=nonPickable(volumeBox(frame.object,[.54,.002,.42],[-.12,.3725,0],surfaceWater,'pump-source-surface'));sourceSurface.userData.connection=true;
  const barrel=make('pump-cylinder','透明泵筒、侧出水孔与导向环','内径 0.12 m；筒盖和导向环有杆孔，侧壁出水口位于活塞最高位置之上。',[-.04,.08,0],true);
  straightTube(barrel.object,.06,1.375-bottom,[x,(1.375+bottom)/2,0],glass,'pump-bore-lower');
  straightTube(barrel.object,.06,top-1.425,[x,(top+1.425)/2,0],glass,'pump-bore-upper');
  // Actual opening on +X side of the cylinder, rather than a pipe crossing a solid wall.
  const cutAngle=Math.asin(portR/.06),shell=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.05,64,1,true,Math.PI/2+cutAngle,2*Math.PI-2*cutAngle),glass);
  shell.position.set(x,1.40,0);shell.name='pump-port-wall';barrel.object.add(shell);
  ring(barrel.object,.075,.027,.03,[x,bottom,0],cast,'pump-base-seat');
  ring(barrel.object,.075,rodRadius+.002,.035,[x,top,0],cast,'pump-lid-rod-hole');
  const pipes=make('suction-and-delivery','吸水管与侧出水弯管','两条透明管路分别接底座孔和侧孔；蓝色粒子沿实际管道中心线显示流向；透明管壁与内部水体分别显示。',[.12,-.04,.12]);
  const pipeGlass=material('#ffffff',0,.18,.075);
  const inletPath=[[-.14,.27,0],[-.14,.48,0],[x,.48,0],[x,.60,0]];
  const outletPath=[[x+.06,1.40,0],[-.17,1.40,0],[-.08,1.40,.12],[-.08,1.28,.12]];
  function routedPipe(points,r,name){
    const curve=new THREE.CurvePath();for(let i=0;i<points.length-1;i++)curve.add(new THREE.LineCurve3(new THREE.Vector3(...points[i]),new THREE.Vector3(...points[i+1])));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,100,r,16,false),pipeGlass);mesh.name=name;mesh.userData.route=points;pipes.object.add(mesh);return curve;
  }
  const inletCurve=routedPipe(inletPath,.026,'pump-suction-pipe'),outletCurve=routedPipe(outletPath,portR,'pump-outlet-pipe');
  const pipeLiquids=[inletCurve,outletCurve].map((curve,i)=>{
    const liquid=new THREE.Mesh(new THREE.TubeGeometry(curve,100,i===0?.020:.016,16,false),water);
    liquid.name=i===0?'pump-suction-water':'pump-outlet-water';liquid.userData.connection=true;pipes.object.add(liquid);return liquid;
  });
  const valves=make('two-check-valves','底阀与活塞阀瓣','固定底阀在底座真实通孔上；两片活塞阀瓣盖住偏心通孔，开启时有可见水路。',[-.12,-.06,-.15]);
  const foot=nested(valves);foot.position.set(x-.027,.607,0);foot.name='pump-foot-hinge';
  const footFlap=cylIn(foot,.028,.006,[.027,.003,0],steel);footFlap.name='pump-foot-flap';
  const lowerFluid=nested(pipes);lowerFluid.position.set(x,.615,0);lowerFluid.userData.connection=true;
  cylIn(lowerFluid,.0595,1,[0,.5,0],water).name='pump-lower-liquid';
  const upperFluid=nested(pipes);upperFluid.userData.connection=true;
  ring(upperFluid,.0595,rodRadius,1,[x,.5,0],water,'pump-upper-liquid');
  const upperSurface=ring(pipes.object,.0595,rodRadius,.002,[x,PUMP_OUTLET_PORT_Y_M,0],surfaceWater,'pump-water-surface');upperSurface.userData.connection=true;
  const piston=make('piston-and-rod-seals','带通孔活塞、密封与活塞杆','活塞有两个真实偏心通孔；周缘密封贴合缸内壁，中央杆不堵阀孔。',[.1,.03,.06]);
  const slider=nested(piston);slider.name='pump-piston-slider';
  const shape=new THREE.Shape();shape.absarc(0,0,.059,0,Math.PI*2,false);
  for(const z of [-.033,.033]){const h=new THREE.Path();h.absarc(0,z,.013,0,Math.PI*2,true);shape.holes.push(h);}
  const disk=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.046,bevelEnabled:false,curveSegments:48}),steel);
  disk.rotation.x=Math.PI/2;disk.position.set(x,.023,0);disk.name='pump-perforated-piston';slider.add(disk);
  for(const y of [-.016,.016])torus(slider,.058,.002,[x,y,0],dark,[Math.PI/2,0,0]);
  const rod=cylIn(slider,rodRadius,PUMP_ROD_LENGTH_M,[x,PUMP_ROD_LENGTH_M/2,0],steel);rod.name='piston-rod';
  // Open fork: lever is behind the crosshead and its pin enters an actual slot.
  const guide=new THREE.Group();guide.position.set(x,PUMP_ROD_LENGTH_M,0);guide.name='pump-slider-guide';slider.add(guide);
  for(const y of [-.023,.023])boxIn(guide,[.18,.012,.018],[0,y,0],steel);
  for(const xx of [-.084,.084])boxIn(guide,[.012,.058,.018],[xx,0,0],steel);
  const flaps=[];
  for(const z of [-.033,.033]){
    const hinge=nested(valves);hinge.name=`pump-piston-hinge-${z}`;
    const flap=cylIn(hinge,.014,.005,[0,.0025,.014],brass);flap.name='pump-piston-flap';flaps.push({hinge,z});
  }
  const drive=make('hand-lever-and-link','后置手柄、支架与滑槽','手柄在滑槽后方转动，销穿入开口；支架也在后方，杆和出水弯管各自留出间隙。',[.05,.20,0]);
  drive.object.userData.explodePrimary=true;
  boxIn(drive.object,[.07,1.55,.07],[.22,.90,-.10],cast).name='pump-support-column';
  for(const y of [bottom,top])boxIn(drive.object,[.58,.035,.035],[-.07,y,-.09],cast).name='pump-fixed-barrel-bracket';
  cylIn(drive.object,.025,.13,[.22,1.70,-.04],brass,'z');
  const lever=nested(drive);lever.name='pump-lever';lever.position.set(PUMP_PIVOT_X_M,PUMP_PIVOT_Y_M,-.06);
  boxIn(lever,[PUMP_LEVER_LENGTH_M,.028,.025],[-PUMP_LEVER_LENGTH_M/2,0,0],cast);
  cylIn(lever,.014,.12,[-PUMP_LEVER_LENGTH_M,0,.04],brass,'z').name='pump-lever-pin';
  boxIn(lever,[.17,.035,.035],[.085,0,0],dark);
  const flow=nested(pipes);flow.userData.connection=true;
  const inDots=[],transferDots=[],outDots=[];
  for(let i=0;i<5;i++){
    inDots.push(nonPickable(sphere(flow,.010,[0,0,0],bright)));
    outDots.push(nonPickable(sphere(flow,.010,[0,0,0],bright)));
    for(const z of [-.033,.033])transferDots.push({dot:nonPickable(sphere(flow,.0075,[0,0,z],bright)),z});
  }
  [...inDots,...outDots,...transferDots.map(item=>item.dot)].forEach(dot=>{dot.userData.flowMarker=true;dot.name='pump-flow-marker';});
  return {root,parts,update(t=0,inputs={}){
    const s=pistonPumpState(t,inputs);lever.rotation.z=s.theta;slider.position.y=s.pistonCenterY;
    foot.rotation.z=s.inletValveOpen?.85:0;
    flaps.forEach(({hinge,z})=>{hinge.position.set(x,s.pistonTopY,z-.014);hinge.rotation.x=s.pistonValveOpen?-.95:0;});
    for(const liquid of [...pipeLiquids,upperSurface])liquid.visible=liquid.userData.modelVisible=s.suctionPossible;
    lowerFluid.scale.y=s.pistonCenterY-.023-.615;lowerFluid.visible=lowerFluid.userData.modelVisible=s.suctionPossible;
    upperFluid.position.y=s.pistonTopY;upperFluid.scale.y=PUMP_OUTLET_PORT_Y_M-s.pistonTopY;upperFluid.visible=upperFluid.userData.modelVisible=s.suctionPossible;
    inDots.forEach((dot,i)=>{dot.visible=s.inletValveOpen;dot.position.copy(inletCurve.getPointAt(mod1(s.phase*2+i/5)));});
    transferDots.forEach(({dot,z},i)=>{dot.visible=s.pistonValveOpen;dot.position.set(x,s.pistonCenterY-.07+mod1(s.phase*2+i/10)*.14,z);});
    outDots.forEach((dot,i)=>{dot.visible=s.suctionPossible&&s.frequencyHz>0;dot.position.copy(outletCurve.getPointAt(mod1(s.phase*(s.upstroke?2:.15)+i/5)));});
  }};
}

function pistonPumpReadout(t, inputs) {
  const s = pistonPumpState(t, inputs);
  return { phaseIndex: !s.suctionPossible ? 2 : s.upstroke ? 0 : 1,
    title: s.stage,
    text: s.frequencyHz === 0 ? '往复频率为零，活塞停止，两只止回阀关闭；恢复频率时从当前位置继续。' : !s.suctionPossible
      ? `理想上限 hₘₐₓ = p大气/(ρg) ≈ ${fmt(s.theoreticalMaxLiftM, 2)} m；当前吸水高度超过上限，不能持续补水。`
      : s.upstroke
        ? '活塞上行扩大下腔，缸内压强降低；大气压把水推入底阀。活塞阀关闭，上方水被推向出水口。'
        : '活塞下行时底阀关闭；下腔水压开活塞阀并穿过活塞，给上腔补水。水不会从吸水管倒流；细杆进入上腔还会挤出少量水。',
    values: [
      { label: '理论流量', value: fmt(s.flowLMin, 1), unit: 'L/min' },
      { label: '每周期排量', value: fmt(s.displacedPerCycleM3 * 1000, 2), unit: 'L' },
      { label: '底阀 / 活塞阀', value: `${s.inletValveOpen ? '开' : '关'} / ${s.pistonValveOpen ? '开' : '关'}`, unit: '' },
    ] };
}

export const devices = [
  {
    id: 'submarine', name: '潜水艇教学模型', category: 'fluids', timeContinuous: true,
    summary: '调节压载水质量，观察艇体由漂浮、近中性到负浮力下沉。',
    principle: '主压载舱进水会增加艇的总质量；压缩空气把水排出会减轻艇的总质量。浸没后浮力由排开的水重决定。',
    defaultMode: 'assembled',viewDirection:[.5,.35,1.6],actions:submarineActions,
    notes: '整体和侧视剖面共用长1.56 m、高0.20 m的椭圆截面圆头艇身，排水体积0.080 m³；前后两只椭圆柱压载舱各16 L，中央为空气瓶。干重70 kg，海水密度1025 kg/m³，中性压载水12 kg。水面、实际浸没体积及舱内水量按水量守恒计算；艇体按重力、浮力与水阻力连续运动。艇壳透明仅为教学观察，真实艇壳不透明；指挥塔、潜望镜及管路的附加体积忽略。箭头定性表示进排水与空气通路，未计算空气热力过程。调到悬浮先离开水面或底部，再调至12 kg；竖直速度逐渐衰减。',
    sources: [
      { label: 'NAVSEA · 深潜器 Alvin 稳性试验', url: 'https://www.navsea.navy.mil/Media/News/Article/3068901/carderock-engineer-supports-stability-tests-for-deep-submergence-vehicle/' },
      { label: 'NAVSEA · Main Ballast Tank 与吹除操作资料', url: 'https://www.navsea.navy.mil/Portals/103/Documents/SUPSALV/SalvageReports/Submarine%20Salvage%20Manual%201970.pdf' },
    ],
    controls: [
      { id: 'ballast', label: '压载水质量', min: 0, max: 32, step: 0.5, value: 10, unit: 'kg' },
    ],
    stages: [
      { name: '浮在水面', title: '水面下的排水量与艇重平衡', text: '艇只浸入一部分时，排开水的体积随浸没深度增加，浮力逐渐增大直到与重力平衡。' },
      { name: '继续进水', title: '负浮力使艇下沉', text: '主压载舱水增加质量；当艇已完全浸没，浮力不再随深度增加，超过排水浮力的重量会使艇下沉。' },
      { name: '调到悬浮', title: '重力与浮力平衡', text: '完全浸没时，压载水为12 kg的教学艇达到中性浮力；剩余竖直速度在水的阻力作用下逐渐减小。' },
      { name: '吹除压载水', title: '压缩空气把水排出舱外', text: '打开吹除管路后，压缩空气进入压载舱并把水向外排；艇的总质量降低，恢复正浮力。' },
    ],
    build: buildSubmarine,
    readout: submarineReadout,
  },
  {
    id: 'canal-lock', name: '船闸', category: 'fluids',
    summary: '用重力涵洞升降闸室水位；船闸开门受两侧水位相等条件约束。',
    principle: '先关闸门，再通过充水或泄水涵洞调整闸室水位；水位与目标河段相等后，才打开相应闸门。',
    notes: '1–6 m落差统一按0.05 m/m映射；20 s循环含下一船复位。平面对开教学闸门完全开启后船才过门；近岸透明墙仍高于最高水位。匀速水位变化是操作顺序示意，不求涵洞流量、船排水、闸门载荷与瞬态波。',
    sources: [
      { label: '美国陆军工程兵团 · How Navigation Locks Operate', url: 'https://www.publications.usace.army.mil/Portals/76/Publications/EngineerPamphlets/EP_870-1-20.pdf' },
      { label: '美国陆军工程兵团 Tulsa District · Locking', url: 'https://www.swt.usace.army.mil/Missions/Navigation/Locking.aspx' },
    ],
    controls: [
      { id: 'direction', label: '过闸方向', options: [{ value: 'downstream', label: '顺流下行' }, { value: 'upstream', label: '逆流上行' }], value: 'downstream' },
      { id: 'head', label: '上下游落差', min: 1, max: 6, step: 0.1, value: 4, unit: 'm' },
      { id: 'progress', label: '过闸进度', min: 0, max: 1, step: 0.01, value: 0, unit: '' },
    ],
    stages: [
      { name: '船入闸', title: '水位相等后开启入口闸门', text: '顺流船在上游水位入闸，逆流船在下游水位入闸；另一端保持关闭。' },
      { name: '关闭闸门', title: '船完全进入后关门', text: '关严入口闸门，把闸室与原河段隔开，涵洞阀保持关闭。' },
      { name: '调节水位', title: '用重力充水或泄水', text: '需要下降时打开泄水涵洞；需要上升时打开充水涵洞。两端闸门继续关闭。' },
      { name: '船出闸', title: '目标水位相等后开出口', text: '闸室达到目标河段水位后，关闭涵洞阀，再打开出口闸门让船离开。' },
    ],
    build: buildCanalLock,
    readout: canalLockReadout,
  },
  {
    id: 'manometer', name: 'U形管压强计', category: 'fluids',
    summary: '把密封探头放到水下不同深度，以液柱高度差读出水的静压。',
    principle: '水下探头表压 p=ρ水gh；密封引压将压力传给一端，另一端通大气，液柱满足 Δp=ρ液gΔh。',
    notes: '密封探头接U管一臂，另一臂通大气；按 p=ρ水gh、Δh=p/(ρ液g) 计算。液面差与探头深度均按1:1米制几何显示；两臂截面积相同、测压液体积守恒。理想隔膜引压忽略气体自重、压缩与毛细作用；轻油850 kg/m³，水1000 kg/m³。',
    sources: [
      { label: 'OpenStax · University Physics 1：14.2 Measuring Pressure', url: 'https://openstax.org/books/university-physics-volume-1/pages/14-2-measuring-pressure' },
      { label: 'OpenStax · Chemistry：9.1 Gas Pressure', url: 'https://openstax.org/books/chemistry/pages/9-1-gas-pressure' },
    ],
    controls: [
      { id: 'depth', label: '探头深度', min: 0, max: 0.5, step: 0.01, value: 0.28, unit: 'm' },
      { id: 'gauge', label: '测压液', options: [{ value: 'oil', label: '轻油' }, { value: 'water', label: '水' }], value: 'oil' },
    ],
    stages: [
      { name: '零点', title: '两臂都受大气压', text: '探头位于水面时，引压端与开口端压强相同，液面差为零。' },
      { name: '下探', title: '水深增加，探头表压增加', text: '水柱越深，探头受到的静压越大；密封隔膜把压力传到U形管的一臂。' },
      { name: '读高度差', title: '液柱差换算压强', text: '同一测压液内同高度处压强相同，因此表压可由液体密度、重力加速度和两侧液面差求出。' },
    ],
    build: buildManometer,
    readout: manometerReadout,
  },
  {
    id: 'piston-pump', name: '活塞式抽水机', category: 'fluids',
    summary: '观察上行进水、下行过活塞阀；大气压推动水进入泵筒。',
    principle: '活塞上行使下腔压强降低，大气压把水推过底阀；下行时底阀关闭，水穿过活塞止回阀进入上腔。',
    notes: '单作用桶式泵，预先灌水；活塞偏心孔、底座孔、杆孔和侧出水孔均为真实开口。后置手柄销沿开口横槽滑动。缸径0.12 m、行程0.343 m；平均理想流量含下行时细杆排水。管路采用缩短示意，水源提升高度是等效输入，不按短管读数。水体显示到侧出水口高度，出水口上方保留空气空间；活塞上下腔在灌水后的正常工作中均有水。无损、无汽化理想上限 p大气/(ρg)，实际允许高度更低；超限显示失水状态。',
    sources: [
      { label: 'FAO · Water Lifting Devices: Piston or Bucket Pumps', url: 'https://www.fao.org/4/ah810e/ah810e06.htm' },
      { label: 'Michigan State University · Check Valves and Pumps', url: 'https://www.egr.msu.edu/~lira/supp/steam/pump.htm' },
      { label: 'U.S. Department of Energy · Pumping System Performance Sourcebook', url: 'https://www.energy.gov/sites/prod/files/2014/05/f16/pump.pdf' },
    ],
    controls: [
      { id: 'speed', label: '往复频率', min: 0, max: 0.8, step: 0.05, value: 0.25, unit: '周/s' },
      { id: 'lift', label: '等效吸水高度（长管省略）', min: 0, max: 12, step: 0.1, value: 4, unit: 'm' },
    ],
    stages: [
      { name: '活塞上行', title: '下腔压强降低，大气压推水入筒', text: '底阀打开，水从水源进入活塞下方；活塞内的止回阀关闭，上腔水被推向出水口。' },
      { name: '活塞下行', title: '底阀关闭，水通过活塞阀', text: '活塞压迫下腔水，底阀阻止倒流；活塞内止回阀打开，水穿过活塞进入上腔。' },
      { name: '吸水高度限制', title: '大气压给出理想提升上限', text: '泵筒压强不能低于真空；当水源高度超过 p大气/(ρg)，单靠吸水式活塞泵无法持续把水送上来。' },
    ],
    phaseRate: inputs => clamp(value(inputs, 'speed', 0.25), 0, 0.8),
    build: buildPistonPump,
    readout: pistonPumpReadout,
  },
];
