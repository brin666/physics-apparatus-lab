/**
 * Qualitative, closed-loop refrigeration teaching scenes, not measured machines.
 * Geometry dimensions are authored in metres (see refrigeration-geometry.mjs).
 * Refrigeration: W + Q_cold = Q_hot; the compressor takes vapor, throttling
 * creates a liquid-vapor mixture, evaporation absorbs and condensation releases.
 * No fictitious temperature, pressure, efficiency, capacity, or RPM is displayed.
 * All moving geometry is f(parent progress, operation), never an independent clock.
 * Simplifications: schematic serpentine circuits, one bi-directional AC expansion
 * valve, no defrost / oil / control electronics simulation; fan spin is illustrative.
 */
import {THREE,Lab,MAT,GEO,setCaps,LAYER_FX,clamp,ease} from './vendor/machine-kit/lab-kit.js';
import {buildFridge,buildAC,roundedRoute,routeGeometry} from './refrigeration-geometry.mjs';
import {createEngineExploration} from './engine-exploration.mjs';
import {coolingExploration} from './cooling-exploration.mjs';
import {assemblyAt,ASSEMBLY_DURATION} from './refrigeration-model.mjs';

const bodyKind=document.body.dataset.machine;
const kind=bodyKind==='fridge'||bodyKind==='ac'?bodyKind:new URLSearchParams(location.search).get('machine')==='ac'?'ac':'fridge';
const hostOrigin=(()=>{try{return parent!==window?parent.location.origin:location.origin;}catch{return location.origin;}})();
const trustedOrigin=/^https?:\/\//.test(hostOrigin),messageTarget=trustedOrigin?hostOrigin:'*';
const send=data=>{if(parent!==window)parent.postMessage(data,messageTarget);};
setCaps('metal');
const initialView=kind==='fridge'?{az:33,el:10,dist:2.25,target:[0,.88,0],fov:30,frameX:0}:{az:15,el:10,dist:2.10,target:[.02,.91,0],fov:30,frameX:0};
const lab=new Lab({title:kind==='fridge'?'电冰箱':'热泵空调',sub:'制冷剂闭环 · 教学结构',prompt:'观察制冷剂如何搬运热量',no:kind==='fridge'?2:3,size:kind==='fridge'?1.74:2.34,theme:'paper',frame:'center',bg:0xffffff,autoOrbit:false,exposure:1.02,envIntensity:.90,saturation:.96,view:initialView});
lab.grade.uniforms.uVig.value=0;lab.grade.uniforms.uGrain.value=0;
lab.grade.material.fragmentShader=lab.grade.material.fragmentShader.replace('vec3 c = texture2D(tDiffuse, vUv).rgb;','vec3 c = min(texture2D(tDiffuse, vUv).rgb * 1.012, vec3(1.0));');lab.grade.material.needsUpdate=true;
lab.bloom.strength=0;lab.bloom.enabled=false;lab.ao.blendIntensity=.38;
// Preserve the engine scene's AO fix: the paper grid must never enter the normal buffer.
const normalBuffer=lab.ao.renderOverride.bind(lab.ao);
lab.ao.renderOverride=(...args)=>{const bg=lab.scene.background;lab.scene.background=null;try{return normalBuffer(...args);}finally{lab.scene.background=bg;}};
const density=Math.min(devicePixelRatio,1.5);lab.renderer.setPixelRatio(density);lab.composer.setPixelRatio(density);lab._resize();
if(innerWidth<600)lab.ao.enabled=false;
const gridSize=120,pixels=new Float32Array(gridSize*gridSize*4),paper=lab.bgColor.toArray();
for(let y=0;y<gridSize;y++)for(let x=0;x<gridSize;x++){const i=(y*gridSize+x)*4,major=x===0||y===0,line=x%24===0||y%24===0;for(let c=0;c<3;c++)pixels[i+c]=paper[c]*(major?[.48,.495,.51][c]:line?[.72,.735,.75][c]:1);pixels[i+3]=1;}
const grid=new THREE.DataTexture(pixels,gridSize,gridSize,THREE.RGBAFormat,THREE.FloatType);grid.wrapS=grid.wrapT=THREE.RepeatWrapping;grid.magFilter=grid.minFilter=THREE.NearestFilter;grid.generateMipmaps=false;grid.needsUpdate=true;
const resizeGrid=()=>grid.repeat.set(innerWidth/gridSize,innerHeight/gridSize);resizeGrid();addEventListener('resize',resizeGrid);lab.scene.background=grid;
lab.floor.visible=false;lab.key.color.setHex(0xffffff);
for(const light of lab.scene.children)if(light.isHemisphereLight)light.groundColor.setHex(0xe5eaf0);
lab.controlsOrbit.minDistance=2.2;lab.controlsOrbit.maxDistance=22;lab.controlsOrbit.enablePan=false;lab.controlsOrbit.rotateSpeed=.65;lab.controlsOrbit.zoomSpeed=.7;lab.controlsOrbit.maxPolarAngle=Math.PI*.61;
lab.controlsOrbit.touches.ONE=-1;lab.controlsOrbit.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;

const state={kind,operation:'cool',progress:.35,playing:false,speed:1,mode:'cut',selected:null,view:'3d',visible:true,labels:true,reduced:false,interaction:'lesson',assembly:{active:parent!==window,time:0,running:false}};
const parts={},meshes=[],pickables=[],materials=new Map(),links=new Map(),edgeMeshes=[];
let exploration;
let receivedState=parent===window,selectedLabel=null,lastFrameScale=1,lastFrameLift=0,lastFrameShift=0,wasAssembling=false,operationApplied=null;
const materialFactory={
  white:()=>MAT.paint({color:'#e5e9e9',roughness:.28,clearcoat:.4}),liner:()=>MAT.plastic({color:'#dee5e4',roughness:.42}),
  foam:()=>MAT.plastic({color:'#d9c99d',roughness:.9}),wall:()=>MAT.plastic({color:'#e7e4dc',roughness:.93}),
  steel:()=>MAT.stainless({color:'#929b9f',roughness:.29}),aluminium:()=>MAT.aluminium({color:'#b7cbd2',metalness:.72,roughness:.35}),
  dark:()=>MAT.steelDark({color:'#293a42',roughness:.43}),copper:()=>MAT.copper({color:'#edb08a',roughness:.24}),darkCopper:()=>MAT.copper({color:'#e4a27a',roughness:.29}),
  brass:()=>MAT.brass({color:'#bc9849',roughness:.29}),black:()=>MAT.paint({color:'#263238',roughness:.33,clearcoat:.22}),
  rubber:()=>MAT.rubber({color:'#3a4547'}),insulation:()=>MAT.rubber({color:'#39484b'}),drainHose:()=>MAT.plastic({color:'#d0d6d2',roughness:.65}),fan:()=>MAT.plastic({color:'#4c6268',roughness:.30}),
  glass:()=>MAT.plastic({color:'#acc7ca',roughness:.12,transparent:true,opacity:.30,depthWrite:false}),
  mesh:()=>MAT.plastic({color:'#3c5260',roughness:.78}),label:()=>MAT.paint({color:'#a7b6b1',roughness:.30}),
  led:()=>MAT.glow({emissive:'#82c6b2',emissiveIntensity:.18}),
};
function material(id,name,role='solid') {
  const key=`${id}:${name}:${role}`;
  if(!materials.has(key)){const m=materialFactory[name]();m.userData.owner=id;m.userData.role=role;m.userData.base={opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,emissive:m.emissive.clone(),emissiveIntensity:m.emissiveIntensity};materials.set(key,m);}return materials.get(key);
}
function group(id,explode) {const g=new THREE.Group();g.name=id;lab.add(g,{name:id,count:0,explode,delay:0});parts[id]=g;return g;}
function solid(id,geo,name='copper',options={}) {
  const {pos=[0,0,0],rot=[0,0,0],role='solid',parent:owner=parts[id]}=options;
  const m=new THREE.Mesh(geo,material(id,name,role));m.position.set(...pos);m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;owner.add(m);m.userData.partId=id;m.userData.role=role;m.userData.materialName=name;
  meshes.push(m);pickables.push(m);
  if(['cover','front','back','section','left-wall','right-wall'].includes(role)){
    const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geo,35),new THREE.LineBasicMaterial({color:0x899a9d,transparent:true,opacity:0,depthWrite:false}));edge.layers.set(LAYER_FX);edge.renderOrder=4;m.add(edge);edgeMeshes.push(edge);m.userData.edge=edge;
  }
  return m;
}
function pipe(id,points,r=.006,name='copper',options={}) {const c=roundedRoute(points,Math.max(.008,r*3)),mesh=solid(id,routeGeometry(c,r),name,options);mesh.userData.pipeCurve=c;mesh.userData.pipeRadius=r;return mesh;}
function link(id,points,phase,options={}) {
  // Keep the route for inspection; state color belongs to the tracked parcel,
  // never to a second surface painted over the physical copper pipe.
  links.set(id,{curve:roundedRoute(points,options.bendRadius??.018),phase,...options});
}
const geometry=(kind==='fridge'?buildFridge:buildAC)({lab,parts,group,solid,pipe,link});
for(const m of meshes)m.userData.basePosition=m.position.clone();
// All registered blocks are closed solids. Teaching cutaway removes front modules
// at their seams, leaving solid foam faces; rear skins fade to expose the rack.
lab._updateCut=()=>{};lab._updateXray=()=>{};lab._modes=()=>{};
const flowGroup=new THREE.Group();flowGroup.name='refrigerant-parcels';flowGroup.layers.set(LAYER_FX);lab.fx.add(flowGroup);
// Follow one parcel, with a saturated core and a rim for contrast on the grid.
const parcelColors={compression:'#b95a16',hot:'#d33f1f',condense:'#b66d09',liquid:'#ad7c08',expand:'#178b8d',mixed:'#147fae',evaporate:'#147fae',vapor:'#315eac'};
const markerMaterial=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,depthTest:false,toneMapped:false});
const parcel=new THREE.Mesh(new THREE.SphereGeometry(.015,20,14),markerMaterial(0xffffff));
parcel.name='tracked-parcel';parcel.layers.set(LAYER_FX);parcel.renderOrder=11;flowGroup.add(parcel);
const parcelRim=new THREE.Mesh(new THREE.SphereGeometry(.018,20,14),markerMaterial(0xffffff));
parcelRim.name='parcel-rim';parcelRim.layers.set(LAYER_FX);parcelRim.renderOrder=10;flowGroup.add(parcelRim);
const halo=new THREE.Mesh(new THREE.SphereGeometry(.0205,20,14),markerMaterial('#243f49',.94));halo.name='tracked-parcel-outline';halo.layers.set(LAYER_FX);halo.renderOrder=9;flowGroup.add(halo);
const parcelPulse=new THREE.Mesh(new THREE.RingGeometry(.024,.026,48),markerMaterial(0xffffff,0));
parcelPulse.name='tracked-parcel-pulse';parcelPulse.layers.set(LAYER_FX);parcelPulse.renderOrder=8;flowGroup.add(parcelPulse);
const airGroup=new THREE.Group();airGroup.layers.set(LAYER_FX);lab.fx.add(airGroup);
const airStreaks=[];
if(kind==='ac')for(let i=0;i<15;i++){
  const g=new THREE.ConeGeometry(.0045,.024,6);g.rotateX(Math.PI/2);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x70b5cb,transparent:true,opacity:.46,depthWrite:false}));m.layers.set(LAYER_FX);airGroup.add(m);airStreaks.push(m);
}
let routeCache=[];
function configureOperation(){
  if(operationApplied===state.operation)return;operationApplied=state.operation;
  routeCache=geometry.routes(state.operation).map(r=>({...r,curve:roundedRoute(r.points,r.bendRadius??.018)}));
  for(const r of routeCache){r.length=r.curve.getLength();}
  // Quarter-cycle captions and the tracked parcel share a semantic clock.
  // Path lengths determine movement inside each stage, not how long that stage lasts.
  const stageOf=p=>['compression','hot'].includes(p)?0:['condense','liquid'].includes(p)?1:['expand','mixed'].includes(p)?2:3;
  for(let stage=0;stage<4;stage++){const rs=routeCache.filter(r=>stageOf(r.phase)===stage),total=rs.reduce((s,r)=>s+r.length,0);let cursor=0;for(const r of rs){r.start=stage/4+cursor/total*.25;cursor+=r.length;r.end=stage/4+cursor/total*.25;}}
  for(const [id,l] of links){const r=routeCache.find(r=>r.id===id||r.id.startsWith('valve-')&&id===`${r.id}-${state.operation}`);if(r)l.phase=r.phase;}
}
function pointOnLoop(u){u=u===1?1-1e-9:((u%1)+1)%1;const r=routeCache.find(r=>u>=r.start&&u<r.end)||routeCache.at(-1);return {point:r.curve.getPointAt(clamp((u-r.start)/(r.end-r.start))),phase:r.phase,id:r.id};}
function select(id,notify=false){
  if(!geometry.names[id])id=null;state.selected=id;
  if(selectedLabel)selectedLabel.el.remove();lab.labels=[];selectedLabel=null;
  if(id)selectedLabel=lab.label(parts[id],geometry.names[id],{at:geometry.anchors[id]});
  lab.target.labels=id&&state.labels?1:0;if(notify)send({type:'cooling-select',id});
}
function setMode(mode){if(!['assembled','cut','explode','xray'].includes(mode))return;state.mode=mode;exploration?.request(mode==='explode');lab.target.explode=0;for(const k of ['cut','xray'])lab.target[k]=mode===k&&!exploration?.active?1:0;}
function update(payload={}){
  if(payload.kind&&payload.kind!==kind)return state;
  if(!receivedState&&!('assembly'in payload))state.assembly={active:false,time:0,running:false};receivedState=true;
  if(Number.isFinite(Number(payload.progress)))state.progress=clamp(Number(payload.progress));
  if(payload.operation)state.operation=kind==='ac'&&payload.operation==='heat'?'heat':'cool';
  if(payload.mode)setMode(payload.mode);
  for(const k of ['labels','reduced','playing'])if(k in payload)state[k]=!!payload[k];
  if('visible'in payload)state.visible=payload.visible;
  if(payload.view)state.view=payload.view;
  if('speed'in payload)state.speed=Number(payload.speed)||1;
  if(payload.interaction==='lesson'||payload.interaction==='whiteboard'){state.interaction=payload.interaction;lab.controlsOrbit.touches.ONE=state.interaction==='whiteboard'?THREE.TOUCH.ROTATE:-1;}
  if(payload.assembly&&typeof payload.assembly==='object')state.assembly={active:!!payload.assembly.active,time:clamp(Number(payload.assembly.time)||0,0,ASSEMBLY_DURATION),running:!!payload.assembly.running};
  if('selected'in payload&&payload.selected!==state.selected)select(payload.selected);
  lab.target.labels=state.labels&&state.selected?1:0;
  configureOperation();return state;
}
const assemblyGroups=kind==='fridge'?[['shell','evaporator'],['compressor','condenser'],['filter','expansion'],['pipes','thermostat'],['door']]:[['indoor-shell','indoor-coil','blower','drain'],['outdoor-shell','outdoor-coil','fan'],['compressor','accumulator'],['reversing','expansion','pipes'],['filter','louver']];
const partStep={};assemblyGroups.forEach((ids,i)=>ids.forEach(id=>partStep[id]=i));
const closureProgress=()=>!state.assembly.active?1:clamp((state.assembly.time-4.15)/.80);
const partProgress=id=>!state.assembly.active?1:(kind==='fridge'?id==='door':['filter','louver'].includes(id))?closureProgress():clamp((state.assembly.time-(partStep[id]||0))/.82);
const isClosure=(id,role)=>kind==='fridge'
  ? id==='door'||id==='shell'&&['front','section','back','left-wall','right-wall'].includes(role)
  : ['indoor-shell','outdoor-shell'].includes(id)&&['cover','front','back'].includes(role)||['filter','guard'].includes(role)||id==='louver';
function appearance(){
  const cut=lab.state.cut,xray=lab.state.xray,explode=lab.state.explode;

  for(const m of meshes){
    const id=m.userData.partId,role=m.userData.role,mat=m.material,base=mat.userData.base;
    let a=1;
    // Fade only interconnecting lines; exchanger coils remain physical parts.
    if(!state.assembly.active&&(id==='pipes'||role==='connection'))a*=1-ease.io(clamp((exploration?.amount||0)/.08));
    if(['cover','front','right-wall'].includes(role))a*=1-cut;
    if(role==='back')a*=1-cut*(kind==='fridge'?1:.94);
    if(role==='furniture'&&m.userData.materialName==='glass')a*=1-cut*.35;
    if(role==='filter')a*=1-cut*.40;
    if(['cover','front','section','back','furniture','filter','valve-case','insulation','left-wall','right-wall'].includes(role))a*=1-xray*(role==='filter'?.45:role==='insulation'?.93:.94);
    if(role==='valve-case')a*=1-cut*.77;
    const closing=state.assembly.active&&isClosure(id,role);
    let p=closing?closureProgress():partProgress(id);
    if(state.reduced&&p>0)p=1;
    // Enclosures stay absent while the connected internals are being shown.
    // Their fade and installation share a clock, so they never turn opaque early.
    const alpha=a*ease.io(clamp(closing?p:p/.48))*base.opacity;
    const copper=['copper','darkCopper'].includes(m.userData.materialName);
    // Draw copper after the ghost skins, while keeping depth testing/writing.
    // Otherwise multiple pale shell layers wash its surface color to grey.
    const clearCopper=copper&&xray>.01&&!state.assembly.active;
    const transparent=alpha<.999||base.transparent||clearCopper;
    if(mat.transparent!==transparent){mat.transparent=transparent;mat.needsUpdate=true;}
    m.renderOrder=clearCopper?5:0;
    mat.opacity=alpha;mat.depthWrite=alpha>.97&&base.depthWrite;
    mat.emissive.copy(base.emissive);mat.emissiveIntensity=base.emissiveIntensity;
    if((id==='evaporator'||id==='indoor-coil'&&state.operation==='cool'||id==='outdoor-coil'&&state.operation==='heat')&&m.userData.materialName==='aluminium'){mat.emissive.set(0x37667c);mat.emissiveIntensity=.10;}
    // Keep selected assemblies metallic; the name window provides the selection cue.
    m.userData.effectiveOpacity=alpha;m.visible=alpha>.008;m.castShadow=alpha>.75;m.userData.noAO=alpha<.5;
    m.position.copy(m.userData.basePosition);
    if(kind==='ac'){
      const shell=id==='indoor-shell'||id==='outdoor-shell';
      if(shell&&(['cover','front'].includes(role)||closing&&role==='back')){
        const off=id==='indoor-shell'?[-.18,.015,.38]:[.56,.065,.38];
        const install=state.assembly.active?1-ease.out(p):0;
        m.position.addScaledVector(new THREE.Vector3(...off),Math.max(ease.io(clamp(explode*1.35)),install));
      }
    }else if(closing&&id==='shell'){
      const at=m.userData.basePosition;
      const off=role==='left-wall'?[-.14,0,0]:role==='right-wall'||role==='front'&&at.x>.1?[.14,0,0]:role==='back'?[0,0,-.12]:at.y>1.6?[0,.13,0]:[0,-.07,.10];
      m.position.addScaledVector(new THREE.Vector3(...off),1-ease.out(p));
    }
    const edge=m.userData.edge;if(edge){edge.visible=xray>.01&&!state.assembly.active;edge.material.opacity=xray*.28;}
  }
  for(const [id,g] of Object.entries(parts)){
    const visibility=state.visible;
    g.visible=visibility===false?false:Array.isArray(visibility)?visibility.includes(id):visibility&&typeof visibility==='object'?visibility[id]!==false:true;
    if(state.assembly.active){let p=partProgress(id);if(state.reduced&&p>0)p=1;const remain=1-ease.out(p),off=geometry.moves[id];g.position.addScaledVector(new THREE.Vector3(...off),remain*.76);g.visible=g.visible&&p>0;}
  }
  if(selectedLabel){const p=partProgress(state.selected);selectedLabel.el.style.opacity=state.labels&&p>.1?'1':'0';lab.state.labels=state.labels&&p>.1?1:0;}
  const inside=Math.max(cut,xray),showFlow=(!state.assembly.active||state.assembly.time>=5)&&!exploration?.active;
  flowGroup.visible=showFlow&&inside>.14;
  airGroup.visible=kind==='ac'&&showFlow&&inside>.12;
}
function deterministicMotion(){
  configureOperation();
  if(kind==='ac'){
    geometry.motion.blower.rotation.x=state.progress*Math.PI*2*26;
    geometry.motion.fan.rotation.z=-state.progress*Math.PI*2*18;
    geometry.motion.louver.rotation.x=-.16-Math.sin(state.progress*Math.PI*4)*.10;
    airStreaks.forEach((m,i)=>{const t=(state.progress*3+i/airStreaks.length)%1;m.position.set(-.94+(i%5)*.17,1.385-t*.14,.13+t*.24);m.material.color.set(state.operation==='heat'?0xd7904f:0x69adc8);m.material.opacity=Math.sin(t*Math.PI)*.48;});
  }
  const tracked=pointOnLoop(state.progress);parcel.position.copy(tracked.point);parcel.material.color.set(parcelColors[tracked.phase]);parcelRim.position.copy(tracked.point);halo.position.copy(tracked.point);
  // One 1.6-second accent per tenth of the lesson loop. The parent progress is
  // the only clock: pause, whiteboard and history restore retain the same pose.
  const pulse=(state.progress*10)%1,wave=state.reduced?0:Math.sin(pulse*Math.PI)**2;
  const markerScale=1+.12*wave;
  for(const m of [parcel,parcelRim,halo])m.scale.setScalar(markerScale);
  parcelPulse.position.copy(tracked.point);parcelPulse.quaternion.copy(lab.camera.quaternion);
  parcelPulse.scale.setScalar(state.reduced?1:1+.9*pulse);
  parcelPulse.material.color.copy(parcel.material.color);parcelPulse.material.opacity=.60*wave;
  const separation=exploration?.amount||0;
  const intro=state.assembly.active&&!state.reduced?1-ease.io(clamp((state.assembly.time-4.1)/.9)):0;
  // Horizontal fit is aspect-aware, including narrow lesson iframes. Its value
  // is part of frameScale, so resize/whiteboard restore apply one ratio only.
  const horizontalFit=Math.max(1,(kind==='ac'?1.18:.68+.30*separation)/(innerWidth/Math.max(1,innerHeight)))*(innerWidth<600?1-.10*separation:1);
  const scale=(1+(kind==='fridge'?.70:.58)*separation)*(1+.10*intro)*horizontalFit,lift=(kind==='fridge'?.07:.004)*separation*lab.k;
  const orbit=lab.controlsOrbit;lab.camera.position.sub(orbit.target).multiplyScalar(scale/lastFrameScale).add(orbit.target);lab.camera.position.y+=lift-lastFrameLift;orbit.target.y+=lift-lastFrameLift;lastFrameScale=scale;lastFrameLift=lift;
  const shift=0;lab.camera.position.x+=shift-lastFrameShift;orbit.target.x+=shift-lastFrameShift;lastFrameShift=shift;
}
const originalUpdate=lab._update.bind(lab);
lab._update=dt=>{
  if(state.assembly.active&&exploration?.active)exploration.reset();
  exploration?.before();exploration?.step(dt);
  if(!state.assembly.active){lab.target.explode=0;for(const k of ['cut','xray'])lab.target[k]=state.mode===k&&!exploration?.active?1:0;}
  if(state.assembly.active){for(const k of ['cut','explode','xray'])lab.state[k]=lab.target[k]=0;}
  else if(wasAssembling)setMode(state.mode);
  if(state.reduced)for(const k of ['cut','explode','xray','labels'])lab.state[k]=lab.target[k];
  originalUpdate(dt);deterministicMotion();appearance();if(!state.assembly.active)exploration?.apply();lab.time=state.assembly.active?state.assembly.time:state.progress*16;wasAssembling=state.assembly.active;
};
const originalRender=lab.render.bind(lab);lab.render=dt=>{if(state.visible!==false&&state.view!=='paper')originalRender(dt);};
const originalLabels=lab._updateLabels.bind(lab);lab._updateLabels=()=>{const labels=document.querySelector('.lab-labels');if(labels)labels.style.display=exploration?.active||state.mode==='explode'?'none':'';originalLabels();if(selectedLabel)selectedLabel.el.style.opacity=state.labels&&partProgress(state.selected)>.1?'1':'0';};

const touchPointers=new Map();let hadTwo=false,scrollDistance=0;
lab.renderer.domElement.addEventListener('pointerdown',e=>{if(exploration?.active||e.pointerType!=='touch')return;touchPointers.set(e.pointerId,{y:e.screenY});if(touchPointers.size>1)hadTwo=true;if(touchPointers.size===1)scrollDistance=0;},true);
lab.renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerType!=='touch'||!touchPointers.has(e.pointerId))return;const p=touchPointers.get(e.pointerId),delta=p.y-e.screenY;p.y=e.screenY;if(state.interaction==='lesson'&&touchPointers.size===1&&!hadTwo&&parent!==window){scrollDistance+=Math.abs(delta);if(scrollDistance>5){e.preventDefault();try{parent.scrollBy({top:delta,left:0,behavior:'instant'});}catch{}}}},{capture:true,passive:false});
const endTouch=e=>{touchPointers.delete(e.pointerId);if(!touchPointers.size)hadTwo=false;};lab.renderer.domElement.addEventListener('pointerup',endTouch,true);lab.renderer.domElement.addEventListener('pointercancel',endTouch,true);
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
lab.renderer.domElement.addEventListener('pointerdown',e=>{if(down){down.moved=true;return;}if(e.button===0)down={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false};});
lab.renderer.domElement.addEventListener('pointermove',e=>{if(down&&e.pointerId===down.id&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)down.moved=true;});
lab.renderer.domElement.addEventListener('pointercancel',()=>{down=null;});
lab.renderer.domElement.addEventListener('pointerup',e=>{
  if(!down||e.pointerId!==down.id)return;const press=down;down=null;
  if(exploration?.active||press.moved||Math.hypot(e.clientX-press.x,e.clientY-press.y)>7||hadTwo)return;
  const r=lab.renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,lab.camera);
  const hits=raycaster.intersectObjects(pickables,false).filter(hit=>{let m=hit.object;while(m){if(!m.visible)return false;m=m.parent;}return hit.object.userData.effectiveOpacity>.20;});
  select(hits[0]?.object.userData.partId||null,true);
});
function clearOrbitMotion(){const o=lab.controlsOrbit;o._sphericalDelta.set(0,0,0);o._panOffset.set(0,0,0);o._scale=1;o._performCursorZoom=false;}
function getView(){return {exploration:exploration?.snapshot(),explorationFocus:exploration?.focusSnapshot(),explorationPresentation:{amount:exploration?.amount||0},position:lab.camera.position.toArray(),target:lab.controlsOrbit.target.toArray(),zoom:lab.camera.zoom,fov:lab.camera.fov,frameScale:lastFrameScale,frameLift:lastFrameLift,frameShift:lastFrameShift,presentation:Object.fromEntries(['cut','explode','xray','labels'].map(k=>[k,lab.state[k]]))};}
function settleView(options={}){if(options.presentation){for(const k of ['cut','explode','xray','labels'])lab.state[k]=lab.target[k];lab._update(0);}clearOrbitMotion();return getView();}
function viewAction(action,view){
  if(action==='settle'){settleView({presentation:true});}
  else if(action==='reset'||action==='front'){clearOrbitMotion();lab.setView(action==='front'?{...initialView,az:0,el:4}:initialView);lastFrameScale=1;lastFrameLift=0;lastFrameShift=0;}
  else if(action==='restore'){
    const valid=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);if(!view||!valid(view.position)||!valid(view.target))return;
    clearOrbitMotion();const has=['cut','explode','xray','labels'].every(k=>Number.isFinite(view.presentation?.[k]));
    for(const k of ['cut','explode','xray','labels'])lab.state[k]=lab.target[k]=has?clamp(view.presentation[k]):lab.target[k];
    exploration?.restore(view.exploration,view.explorationPresentation);exploration?.restoreFocus(view.explorationFocus);lab._update(0);lab.camera.position.fromArray(view.position);lab.controlsOrbit.target.fromArray(view.target);
    if(Number.isFinite(view.zoom)&&view.zoom>0)lab.camera.zoom=view.zoom;if(Number.isFinite(view.fov)&&view.fov>0&&view.fov<180)lab.camera.fov=view.fov;
    if(has&&Number.isFinite(view.frameScale)&&view.frameScale>0)lastFrameScale=view.frameScale;if(has&&Number.isFinite(view.frameLift))lastFrameLift=view.frameLift;if(Number.isFinite(view.frameShift))lastFrameShift=view.frameShift;
    lab.camera.updateProjectionMatrix();lab.controlsOrbit.update();
  }else if(action==='zoom-in'||action==='zoom-out'){clearOrbitMotion();const d=lab.camera.position.clone().sub(lab.controlsOrbit.target),len=clamp(d.length()*(action==='zoom-in'?.84:1.19),lab.controlsOrbit.minDistance,lab.controlsOrbit.maxDistance);lab.camera.position.copy(lab.controlsOrbit.target).add(d.setLength(len));lab.controlsOrbit.update();}
  return getView();
}
addEventListener('message',e=>{if(e.source!==parent||(trustedOrigin&&e.origin!==hostOrigin))return;try{if(e.data?.type==='cooling-state')update(e.data);if(e.data?.type==='cooling-view')viewAction(e.data.action,e.data.view);if(e.data?.type==='cooling-explore-tool')exploration.setTool(e.data.tool);if(e.data?.type==='cooling-explore-reset')exploration.resetPart(e.data.id);}catch(error){send({type:'cooling-error',message:String(error.message||error)});}});
addEventListener('keydown',e=>{if([' ','ArrowLeft','ArrowRight','r','R','Escape'].includes(e.key)){e.preventDefault();e.stopPropagation();send({type:'cooling-key',key:e.key});}},true);
addEventListener('error',e=>send({type:'cooling-error',message:e.message}));
exploration=createEngineExploration({lab,parts,state,pickables,...coolingExploration[kind],focusEnabled:true,clearOrbit:clearOrbitMotion,onSelect:id=>select(id,true),onPhase:phase=>send({type:'cooling-exploration',phase})});
setMode('cut');lab.state.cut=1;select(null);configureOperation();
lab._assembly=0;lab._update(0);lab.start();lab._assembly=0;
window.coolingScene={kind,lab,exploration,parts,state,meshes,links,geometry,update,select,getView,settleView,viewAction,
  get assembly(){return {...assemblyAt(kind,state.assembly.time),active:state.assembly.active,parts:Object.fromEntries(Object.keys(parts).map(id=>[id,{progress:partProgress(id),visible:parts[id].visible}]))};},
  get flowRoutes(){return routeCache.map(r=>({id:r.id,start:r.points[0],end:r.points.at(-1),phase:r.phase}));},
  get geometryStats(){return {meshes:meshes.length,triangles:lab.tris,materials:materials.size};},
  get trackedParcel(){const q=pointOnLoop(state.progress);return {id:q.id,phase:q.phase,position:q.point.toArray()};},
  inspect(){return {kind,operation:state.operation,progress:state.progress,mode:state.mode,assemblyIndex:assemblyAt(kind,state.assembly.time).index,assemblyTime:state.assembly.time,assemblyActive:state.assembly.active,selected:state.selected,visible:state.visible,routes:this.flowRoutes,motion:kind==='ac'?{blower:geometry.motion.blower.rotation.x,fan:geometry.motion.fan.rotation.z,louver:geometry.motion.louver.rotation.x}:{},camera:getView()};},
  projectPart(id){if(!parts[id])return null;const p=new THREE.Vector3(...geometry.anchors[id]);parts[id].updateWorldMatrix(true,false);p.applyMatrix4(parts[id].matrixWorld).project(lab.camera);return {x:(p.x*.5+.5)*innerWidth,y:(-p.y*.5+.5)*innerHeight,visible:parts[id].visible&&p.z<1};},
};
send({type:'cooling-ready'});
