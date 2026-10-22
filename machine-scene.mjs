/**
 * Single-cylinder, two-valve four-stroke teaching engine; dimensions in metres.
 * Bore 0.080; stroke 0.072; conrod centres 0.116; piston height 0.038.
 * Crank axis Z, cylinder Y, crankcase centre y=.110, combustion deck y=.293.
 * Parts: cast crankcase and finned barrel, machined liner/head, steel crank and
 * conrod, aluminium piston, iron rings, two poppet valves and steel springs,
 * ceramic/steel spark plug, rear flywheel, intake/exhaust and a bolted cradle.
 * Kinematics are exclusively engineAt(angle): x=r sin(theta), y=r cos(theta),
 * yp=yc+sqrt(l*l-x*x), and rod length is always l. Valve lift is supplied by
 * the same 720 degree model. No local angular integration is allowed.
 * Educational simplifications: no cam drive, fuel system, lubrication circuit
 * or coolant circuit. The exploded layout separates assemblies for teaching;
 * it does not prescribe a maintenance disassembly sequence.
 */
import {THREE,Lab,MAT,GEO,setCaps,LAYER_FX,clamp,ease} from './vendor/machine-kit/lab-kit.js';
import {engineAt,ENGINE} from './model.mjs';
import {assemblyAt,ASSEMBLY_DURATION,ASSEMBLY_STEP_SECONDS,ASSEMBLY_MOVE_SECONDS} from './assembly-model.mjs';
import {createEngineExploration} from './engine-exploration.mjs';

const hostOrigin=(()=>{try{return parent!==window?parent.location.origin:location.origin;}catch{return location.origin;}})();
const trustedHttpOrigin=/^https?:\/\//.test(hostOrigin);
const messageTarget=trustedHttpOrigin?hostOrigin:'*';
const studioLab=(()=>{try{return parent!==window&&parent.document.body.classList.contains('white-lab');}catch{return false;}})();
setCaps('metal');
const BG=0xffffff;
const initialView={az:20,el:12,dist:2.2,target:[0,.184,0],fov:30,frameX:0};
const lab=new Lab({
  title:'四冲程汽油机',sub:'单缸 · 双气门',prompt:'四冲程汽油机的一个工作循环',
  no:1,size:.40,theme:'paper',frame:'center',bg:BG,autoOrbit:false,
  exposure:1.02,envIntensity:.9,saturation:.96,view:initialView,
  cut:{a:[0,0,1],b:[0,0,1],center:[0,.18,0],offset:.008,reach:.65},
});
lab.grade.uniforms.uVig.value=0;
lab.grade.uniforms.uGrain.value=0;
// The kit's neutral tone mapper leaves its inverse-mapped white at 252/255.
// A small final output correction makes the teaching paper match CSS #fff.
lab.grade.material.fragmentShader=lab.grade.material.fragmentShader.replace(
  'vec3 c = texture2D(tDiffuse, vUv).rgb;',
  'vec3 c = min(texture2D(tDiffuse, vUv).rgb * 1.012, vec3(1.0));',
);
lab.grade.material.needsUpdate=true;
lab.bloom.strength=0;lab.bloom.enabled=false;
lab.ao.blendIntensity=.42;
if(studioLab){
  lab.ao.blendIntensity=.48;
  const softRim=new THREE.DirectionalLight(0xeaf2ff,1.1);softRim.position.set(4,3,-4);lab.scene.add(softRim);
}
// The grid is a screen background, not a surface normal. GTAO's override pass
// otherwise renders its independent HDR background material into the G-buffer,
// producing a rectangular change in grid contrast around the mechanism.
const renderNormalBuffer=lab.ao.renderOverride.bind(lab.ao);
lab.ao.renderOverride=(...args)=>{
  const background=lab.scene.background;
  lab.scene.background=null;
  try{return renderNormalBuffer(...args);}
  finally{lab.scene.background=background;}
};
// Keep the local, fully lit model responsive on high-density phone screens.
const renderDensity=Math.min(devicePixelRatio,1.5);
lab.renderer.setPixelRatio(renderDensity);
lab.composer.setPixelRatio(renderDensity);
lab._resize();
if(innerWidth<600)lab.ao.enabled=false;
// The kit uses an opaque renderer and an opaque studio floor. A small HDR
// background texture gives a fixed 24 CSS-pixel grid without adding a render
// pass or drawing lines over the engine. Its separate contact-shadow plane is
// retained, so the cradle still sits naturally on the teaching paper.
const gridSize=studioLab?120:24,gridPixels=new Float32Array(gridSize*gridSize*4);
const paperColor=lab.bgColor.toArray();
for(let y=0;y<gridSize;y++)for(let x=0;x<gridSize;x++) {
  const i=(y*gridSize+x)*4,line=x%24===0||y%24===0,major=x===0||y===0;
  const tint=studioLab&&!major?[.72,.735,.75]:[.48,.495,.51];
  for(let c=0;c<3;c++)gridPixels[i+c]=paperColor[c]*(line?tint[c]:1);
  gridPixels[i+3]=1;
}
const gridTexture=new THREE.DataTexture(gridPixels,gridSize,gridSize,THREE.RGBAFormat,THREE.FloatType);
gridTexture.wrapS=gridTexture.wrapT=THREE.RepeatWrapping;
gridTexture.minFilter=gridTexture.magFilter=THREE.NearestFilter;
gridTexture.generateMipmaps=false;gridTexture.needsUpdate=true;
function resizeGrid(){gridTexture.repeat.set(innerWidth/gridSize,innerHeight/gridSize);}
resizeGrid();addEventListener('resize',resizeGrid);
lab.scene.background=gridTexture;
lab.floor.visible=false;
lab.key.color.setHex(0xffffff);
for(const light of lab.scene.children)if(light.isHemisphereLight)light.groundColor.setHex(0xe5eaf0);
lab.controlsOrbit.minDistance=2.1;
lab.controlsOrbit.maxDistance=9.8;
lab.controlsOrbit.enablePan=false;
lab.controlsOrbit.rotateSpeed=.65;
lab.controlsOrbit.zoomSpeed=.7;
lab.controlsOrbit.maxPolarAngle=Math.PI*.61;
// One-finger motion scrolls the embedding lesson; two fingers manipulate the
// engine. Explicit parent scrolling avoids trapping a vertical drag in an iframe.
lab.controlsOrbit.touches.ONE=-1;
lab.controlsOrbit.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;
const touchPointers=new Map();let touchGestureHadTwo=false,touchScrollDistance=0;
lab.renderer.domElement.addEventListener('pointerdown',event=>{
  if(event.pointerType!=='touch')return;
  touchPointers.set(event.pointerId,{y:event.screenY});
  if(touchPointers.size>1)touchGestureHadTwo=true;
  if(touchPointers.size===1)touchScrollDistance=0;
},true);
lab.renderer.domElement.addEventListener('pointermove',event=>{
  if(event.pointerType!=='touch'||!touchPointers.has(event.pointerId))return;
  const previous=touchPointers.get(event.pointerId),delta=previous.y-event.screenY;
  previous.y=event.screenY;
  if(!exploration?.active&&state.interaction==='lesson'&&touchPointers.size===1&&!touchGestureHadTwo&&parent!==window) {
    touchScrollDistance+=Math.abs(delta);
    if(touchScrollDistance>5) {event.preventDefault();try{parent.scrollBy({top:delta,left:0,behavior:'instant'});}catch{}}
  }
},{capture:true,passive:false});
function endTouch(event) {
  touchPointers.delete(event.pointerId);
  if(!touchPointers.size)touchGestureHadTwo=false;
}
lab.renderer.domElement.addEventListener('pointerup',endTouch,true);
lab.renderer.domElement.addEventListener('pointercancel',endTouch,true);

const state={angle:410,mode:'cut',selected:null,reduced:false,labels:true,playing:false,interaction:'lesson',visible:{},assembly:{active:parent!==window,time:0}};
let receivedParentState=parent===window;
let exploration=null;
const parts={},pickables=[],standMeshes=[],hardwareMeshes=[],materials=new Map();
const materialFactories={
  cast:()=>MAT.aluminium({color:[.58,.61,.65],roughness:studioLab?.43:.53}),
  machined:()=>MAT.aluminiumMachined({color:[.80,.82,.85],roughness:studioLab?.26:.30}),
  steel:()=>MAT.steel({roughness:.29}),
  dark:()=>MAT.steelDark({color:[.17,.19,.22],roughness:.43}),
  polished:()=>MAT.stainless({roughness:.21}),
  green:()=>MAT.paint({color:studioLab?'#71899b':'#63836b',roughness:.42,clearcoat:.22}),
  rubber:()=>MAT.rubber(),
  ceramic:()=>MAT.enamel({color:'#f1eee1',roughness:.24}),
  brass:()=>MAT.brass({roughness:.32}),
};
function material(id,kind) {
  const key=`${id||'stand'}:${kind}`;
  if(!materials.has(key)) {
    const m=materialFactories[kind]();
    m.userData.owner=id;
    m.userData.baseEmissive=m.emissive.clone();
    m.userData.baseEmissiveIntensity=m.emissiveIntensity;
    m.userData.focusBaseColor=m.color.clone();m.userData.focusAmount=0;
    m.userData.assemblyBase={opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite};
    materials.set(key,m);
  }
  return materials.get(key);
}
function assembly(id,position=[0,0,0],explode=[0,0,0]) {
  const g=new THREE.Group();g.name=id;g.position.set(...position);
  lab.add(g,{name:id,count:0,explode,delay:0});parts[id]=g;return g;
}
function solid(id,geo,kind='steel',options={}) {
  const {pos=[0,0,0],rot=[0,0,0],shell=false,parent=(id==null?parts.stand:parts[id])||lab.machine,name=id,...rest}=options;
  const m=lab.mesh(geo,material(id,kind),{name,parent,pos,rot,count:1,xray:shell?'shell':undefined,delay:0,...rest});
  m.name=name||'';
  m.userData.partId=id;
  m.userData.assemblyCastShadow=m.castShadow;
  hardwareMeshes.push(m);
  if(id==null)standMeshes.push(m);
  if(id)pickables.push(m);
  return m;
}
const axisZ=[Math.PI/2,0,0];
const axisX=[0,0,Math.PI/2];
const ring=(ro,ri,h,seg=64)=>GEO.tube(ro,ri,h,seg);
const cylinder=(r,h,n=64)=>GEO.disc(r,h,Math.min(.001,h*.15),n);
function hex(r,h) {return new THREE.CylinderGeometry(r,r,h,6);}
function closedSpring(R,wire,turns,len) {
  const coil=GEO.spring(R,wire,turns,len,180),caps=[];
  for(const [t,sign] of [[0,-1],[1,1]]) {
    const a=t*turns*2*Math.PI;
    const tangent=new THREE.Vector3(-R*Math.sin(a)*turns*2*Math.PI,len,R*Math.cos(a)*turns*2*Math.PI).normalize().multiplyScalar(sign);
    const cap=new THREE.CircleGeometry(wire,10);
    cap.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),tangent));
    cap.translate(R*Math.cos(a),t*len,R*Math.sin(a));caps.push(cap);
  }
  return GEO.merge([coil,...caps]);
}
function plateWithHoles(width,depth,height,holes=[],bevel=.00035) {
  const s=new THREE.Shape();
  const x=width/2,z=depth/2,r=.007;
  s.moveTo(-x+r,-z);s.lineTo(x-r,-z);s.quadraticCurveTo(x,-z,x,-z+r);
  s.lineTo(x,z-r);s.quadraticCurveTo(x,z,x-r,z);s.lineTo(-x+r,z);
  s.quadraticCurveTo(-x,z,-x,z-r);s.lineTo(-x,-z+r);s.quadraticCurveTo(-x,-z,-x+r,-z);s.closePath();
  for(const [hx,hz,hr] of holes) {const h=new THREE.Path();h.absarc(hx,hz,hr,0,2*Math.PI,true);s.holes.push(h);}
  const g=GEO.extrude(s,height,bevel);g.rotateX(Math.PI/2);return g;
}
// A closed head casting with two genuine side openings. This middle layer is
// extruded in Y; its side notches are the horizontal ports, and the lower layer
// connects them to the two circular valve-seat openings. The cover closes the
// ducts above. No air path is drawn through a solid cylinder-head wall.
function portDeck(height) {
  const x=.056,z=.0515,r=.0118,c=.021;
  const s=new THREE.Shape();
  s.moveTo(-x,-z);s.lineTo(x,-z);s.lineTo(x,-r);s.lineTo(c,-r);
  s.absarc(c,0,r,-Math.PI/2,-Math.PI*1.5,true);
  s.lineTo(x,r);s.lineTo(x,z);s.lineTo(-x,z);s.lineTo(-x,r);s.lineTo(-c,r);
  s.absarc(-c,0,r,Math.PI/2,-Math.PI/2,true);
  s.lineTo(-x,-r);s.closePath();
  const sparkHole=new THREE.Path();sparkHole.absarc(0,0,.0075,0,2*Math.PI,true);s.holes.push(sparkHole);
  const g=GEO.extrude(s,height,0);g.rotateX(Math.PI/2);return g;
}

// Grounded service cradle: four feet, two bearing supports and captive bolts.
assembly('stand');
solid(null,GEO.rbox(.20,.014,.16,.007),'green',{pos:[0,.012,0]});
for(const x of [-.077,.077])for(const z of [-.060,.060])
  solid(null,cylinder(.011,.006,24),'rubber',{pos:[x,.003,z]});
for(const x of [-.057,.057])
  solid(null,GEO.rbox(.026,.040,.090,.004),'green',{pos:[x,.039,0]});
for(const x of [-.058,.058])for(const z of [-.030,.030])
  solid(null,hex(.004,.004),'polished',{pos:[x,.061,z]});

const caseGroup=assembly('case',[0,ENGINE.crankY,0],[0,0,-.075]);
// The cylinder throat is open to the crankcase. A complete annulus here would
// cut through the connecting rod at every revolution.
const caseProfile=new THREE.Shape(),outerAngle=Math.acos(.055/.069),innerAngle=Math.acos(.046/.061);
caseProfile.moveTo(.055,.075);caseProfile.lineTo(.055,.069*Math.sin(outerAngle));
caseProfile.absarc(0,0,.069,outerAngle,Math.PI-outerAngle,true);
caseProfile.lineTo(-.055,.075);caseProfile.lineTo(-.046,.075);
caseProfile.lineTo(-.046,.061*Math.sin(innerAngle));
caseProfile.absarc(0,0,.061,Math.PI-innerAngle,innerAngle,false);
caseProfile.lineTo(.046,.075);caseProfile.closePath();
solid('case',GEO.extrude(caseProfile,.073,0),'cast',{shell:true,name:'open-crankcase-throat'});
solid('case',ring(.055,.041,.030),'cast',{pos:[0,.073,0],shell:true,name:'hollow-cylinder-neck'});
const coverProfile=new THREE.Shape(),coverAngle=Math.asin(.060/.069);
coverProfile.absarc(0,0,.069,coverAngle,Math.PI-coverAngle,true);coverProfile.closePath();
const journalHole=new THREE.Path();journalHole.absarc(0,0,.0105,0,Math.PI*2,true);coverProfile.holes.push(journalHole);
for(const z of [-.0405,.0405])solid('case',GEO.extrude(coverProfile,.008,0),'cast',{pos:[0,0,z],shell:true,name:'bearing-cover'});
solid('case',GEO.rbox(.098,.012,.068,.004),'cast',{pos:[0,-.064,0],shell:true});
solid('case',ring(.023,.0105,.011),'machined',{pos:[0,0,-.042],rot:axisZ,shell:true});
solid('case',ring(.023,.0105,.011),'machined',{parent:lab.machine,pos:[0,ENGINE.crankY,.042],rot:axisZ,shell:true,explode:[0,0,.10]});
for(const a of [40,140,220,320]) {
  const r=THREE.MathUtils.degToRad(a);
  solid('case',hex(.004,.005),'polished',{pos:[.061*Math.cos(r),.061*Math.sin(r),.039],rot:axisZ});
}
solid('case',hex(.005,.006),'brass',{pos:[.030,-.068,.015]});

assembly('cylinder',[0,0,0],[0,.130,0]);
solid('cylinder',ring(.055,.041,.030),'cast',{pos:[0,.190,0],shell:true});
solid('cylinder',ring(.051,.040,.090,96),'machined',{pos:[0,.248,0],shell:true});
for(const y of [.210,.226,.242,.258,.274])
  solid('cylinder',ring(.063,.050,.0035,96),'cast',{pos:[0,y,0],shell:true});
for(const x of [-.043,.043])for(const z of [-.035,.035])
  solid('cylinder',hex(.004,.006),'polished',{pos:[x,.204,z]});

assembly('head',[0,0,0],[0,.260,0]);
const lowerHead=GEO.merge([
  ring(.057,.040,.0055,96).translate(0,.29575,0),
  plateWithHoles(.112,.103,.004,[[-.021,0,.0118],[.021,0,.0118],[0,0,.0075]],0).translate(0,.3005,0),
]);
solid('head',lowerHead,'machined',{shell:true});
const upperHead=GEO.merge([
  portDeck(.017).translate(0,.311,0),
  plateWithHoles(.112,.103,.006,[[-.021,0,.0048],[.021,0,.0048],[0,0,.0075]]).translate(0,.3225,0),
]);
solid('head',upperHead,'machined',{shell:true});
for(const y of [.295,.324])
  solid('head',ring(.064,.054,.0033,96),'cast',{pos:[0,y,0],shell:true});
for(const x of [-.043,.043])for(const z of [-.035,.035]) {
  solid('head',cylinder(.0026,.122,20),'dark',{pos:[x,.260,z]});
  solid('head',hex(.0046,.005),'polished',{pos:[x,.320,z]});
}

const valveParts={};
for(const [id,x,off] of [['intake',-.021,[0,.260,0]],['exhaust',.021,[0,.260,0]]]) {
  assembly(id,[0,0,0],off);
  const valveGeo=GEO.lathe([[0,-.004],[.0117,-.004],[.013,-.0024],[.0127,0],[.0055,.002],[.0033,.006],[.0033,.052],[0,.052]],64);
  const valve=solid(id,valveGeo,'polished',{pos:[x,.300,0]});
  const spring=solid(id,closedSpring(.0080,.00110,4.3,.017),'dark',{pos:[x,.327,0]});
  const retainer=solid(id,ring(.010,.0034,.003),'polished',{pos:[x,.345,0]});
  const seat=solid(id,ring(.0145,.0118,.0025),'dark',{pos:[x,.301,0]});
  const guide=solid(id,ring(.0055,.0034,.016),'brass',{pos:[x,.320,0]});
  const side=id==='intake'?-1:1;
  const port=solid(id,ring(.011,.0085,.042),'machined',{pos:[side*.073,.311,0],rot:axisX});
  const flange=solid(id,ring(.017,.0085,.004),'polished',{pos:[side*.094,.311,0],rot:axisX});
  valveParts[id]={valve,spring,retainer,seat,guide,port,flange,x,side};
}

assembly('spark',[0,0,0],[0,.260,0]);
solid('spark',GEO.lathe([[0,0],[.0065,0],[.0065,.004],[.0054,.006],[.0054,.023],[.0045,.026],[.003,.026],[0,.028]],64),'ceramic',{pos:[0,.319,0]});
solid('spark',GEO.lathe([[0,0],[.0066,0],[.0066,.016],[.008,.017],[.008,.022],[0,.022]],48),'polished',{pos:[0,.298,0]});
solid('spark',hex(.008,.006),'polished',{pos:[0,.322,0]});
solid('spark',GEO.pipe([[0,.297,0],[0,.294,0],[.003,.294,0],[.003,.296,0]],.00085,{seg:14,radial:8}),'dark');

assembly('piston',[0,.262,0],[0,0,0]);
solid('piston',GEO.lathe([[.033,-.016],[.0395,-.016],[.0395,.022],[0,.022],[0,.016],[.033,.016]],96),'machined');
for(const y of [.012,.007,.0015])
  solid('piston',ring(.0397,.0385,.0016,96),'dark',{pos:[0,y,0]});
const pistonPin=solid('piston',ring(.0072,.0032,.067,48),'polished',{rot:axisZ});
for(const z of [-.023,.023])
  solid('piston',ring(.0115,.0073,.010,48),'machined',{pos:[0,0,z],rot:axisZ});

assembly('rod',[0,.204,0],[0,0,0]);
const rodShape=new THREE.Shape();
const hh=ENGINE.rod/2;
rodShape.moveTo(-.012,hh);rodShape.bezierCurveTo(-.012,hh+.016,.012,hh+.016,.012,hh);
rodShape.lineTo(.006,hh-.020);rodShape.lineTo(.008,-hh+.023);
rodShape.bezierCurveTo(.029,-hh+.012,.023,-hh-.018,0,-hh-.018);
rodShape.bezierCurveTo(-.023,-hh-.018,-.029,-hh+.012,-.008,-hh+.023);
rodShape.lineTo(-.006,hh-.020);rodShape.closePath();
for(const [y,r] of [[hh,.0073],[-hh,.0095]]) {const h=new THREE.Path();h.absarc(0,y,r,0,2*Math.PI,true);rodShape.holes.push(h);}
solid('rod',GEO.extrude(rodShape,.012,.0004),'steel');
solid('rod',GEO.rbox(.031,.003,.0125,.0008),'dark',{pos:[0,-hh-.005,0]});
for(const x of [-.012,.012])
  solid('rod',hex(.003,.004),'polished',{pos:[x,-hh,.008],rot:axisZ});

assembly('crank',[0,ENGINE.crankY,0],[0,0,0]);
const web=new THREE.Shape();
web.moveTo(-.011,.036);web.bezierCurveTo(-.011,.052,.011,.052,.011,.036);
web.lineTo(.020,.005);web.quadraticCurveTo(.044,-.016,.034,-.035);
web.quadraticCurveTo(0,-.054,-.034,-.035);web.quadraticCurveTo(-.044,-.016,-.020,.005);web.closePath();
for(const z of [-.019,.019])
  solid('crank',GEO.extrude(web,.014,.001),'dark',{pos:[0,0,z]});
solid('crank',cylinder(.0094,.027),'polished',{pos:[0,ENGINE.r,0],rot:axisZ});
const journals=GEO.merge([cylinder(.010,.053).rotateX(Math.PI/2).translate(0,0,-.052),cylinder(.010,.036).rotateX(Math.PI/2).translate(0,0,.044)]);
solid('crank',journals,'polished');

assembly('flywheel',[0,ENGINE.crankY,-.089],[0,0,-.105]);
solid('flywheel',GEO.gear({teeth:64,module:.00195,width:.011,bore:.010,spokes:6,rim:.009}),'steel');
solid('flywheel',ring(.021,.010,.024),'dark',{rot:axisZ});

// These translucent elements explain the working space; they are not hardware.
const gasMaterial=new THREE.MeshPhysicalMaterial({color:'#8caeb0',transparent:true,opacity:.13,roughness:.5,metalness:0,depthWrite:false,side:THREE.DoubleSide});
const gas=new THREE.Mesh(new THREE.CylinderGeometry(.0382,.0382,1,48),gasMaterial);
gas.layers.set(LAYER_FX);gas.userData.noAO=true;gas.renderOrder=2;lab.fx.add(gas);
const sparkMaterial=new THREE.MeshBasicMaterial({color:'#fff6c9',transparent:true,opacity:0,depthWrite:false});
const flash=new THREE.Mesh(new THREE.SphereGeometry(.0025,12,8),sparkMaterial);
flash.position.set(0,.295,0);flash.layers.set(LAYER_FX);flash.renderOrder=3;lab.fx.add(flash);
const flowDots={};
for(const [id,color,side] of [['intake','#668e9f',-1],['exhaust','#bc9066',1]]) {
  const group=new THREE.Group();lab.fx.add(group);flowDots[id]=group;
  const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,depthWrite:false});
  for(let i=0;i<9;i++) {const d=new THREE.Mesh(new THREE.SphereGeometry(.0006,8,6),m);d.layers.set(LAYER_FX);group.add(d);}
  group.userData.side=side;
}

const nameMap={case:'曲轴箱与轴承',cylinder:'气缸与缸套',head:'气缸盖',intake:'进气门',exhaust:'排气门',spark:'火花塞',piston:'活塞与活塞环',rod:'连杆',crank:'曲轴',flywheel:'飞轮'};
const anchors={case:[.05,0,.008],cylinder:[.045,.251,.008],head:[.043,.312,.008],intake:[-.021,.337,0],exhaust:[.021,.337,0],spark:[0,.338,0],piston:[.029,.012,.005],rod:[.009,0,.007],crank:[.024,-.018,.008],flywheel:[.044,.034,0]};
let sim=engineAt(state.angle),activeLabel=null,lastFrameScale=1,lastFrameLift=0;
let assemblyFrame=null,assemblyWasActive=false;
// Small assembly-axis moves, all relative to the normal pose rebuilt by Lab.
// The sequence illustrates structure; it is not a production assembly process.
const assemblyPaths={
  stand:[0,.026,0],crank:[0,.016,-.026],flywheel:[0,0,-.040],
  rod:[0,.025,0],piston:[0,.042,0],case:[0,0,-.038],
  cylinder:[0,.080,0],head:[0,.050,0],intake:[0,0,0],exhaust:[0,0,0],spark:[0,.034,0],
};
const caseFrontBearing=hardwareMeshes.find(m=>m.userData.partId==='case'&&m.parent===lab.machine);
function setAssemblyMaterial(m,opacity,transparent,depthWrite) {
  if(m.transparent!==transparent) {m.transparent=transparent;m.needsUpdate=true;}
  m.opacity=opacity;m.depthWrite=depthWrite;
}
function restoreAssemblyAppearance() {
  for(const m of materials.values()) {
    const b=m.userData.assemblyBase;
    setAssemblyMaterial(m,b.opacity,b.transparent,b.depthWrite);
  }
  for(const m of hardwareMeshes)m.castShadow=m.userData.assemblyCastShadow;
}
function assemblyPart(id) {
  const p=assemblyFrame?.parts[id]||{visible:false,progress:0};
  return {visible:!!p.visible,progress:state.reduced&&p.visible?1:clamp(Number(p.progress)||0)};
}
function moveAssemblyObject(object,offset,progress) {
  const remaining=1-ease.out(progress);
  object.position.x+=offset[0]*remaining;
  object.position.y+=offset[1]*remaining;
  object.position.z+=offset[2]*remaining;
}
function applyAssemblyPose() {
  assemblyFrame=assemblyAt(state.assembly.time);
  for(const [id,g] of Object.entries(parts)) {
    const p=assemblyPart(id);
    g.visible=g.visible&&p.visible&&p.progress>0;
    const motionProgress=id==='piston'?clamp(p.progress/.75):p.progress;
    moveAssemblyObject(g,assemblyPaths[id]||[0,0,0],motionProgress);
  }
  // The front bearing is registered directly on machine, rather than inside
  // the crankcase group, so it needs its own owner pose and visibility.
  if(caseFrontBearing)moveAssemblyObject(caseFrontBearing,[0,0,.025],assemblyPart('case').progress);
  // Install the poppet from below the seat; the top hardware and side ports
  // approach along their own axes rather than pushing a valve head through the
  // small stem hole in an already seated cylinder head.
  for(const id of ['intake','exhaust']) {
    const p=assemblyPart(id),v=valveParts[id];
    moveAssemblyObject(v.valve,[0,-.026,0],p.progress);
    moveAssemblyObject(v.seat,[0,-.012,0],p.progress);
    for(const top of [v.spring,v.retainer,v.guide])moveAssemblyObject(top,[0,.022,0],p.progress);
    for(const port of [v.port,v.flange])moveAssemblyObject(port,[v.side*.030,0,0],p.progress);
  }
  const pistonProgress=assemblyPart('piston').progress;
  moveAssemblyObject(pistonPin,[0,0,-.026],state.reduced?pistonProgress:clamp((pistonProgress-.55)/.45));
  for(const mesh of hardwareMeshes) {
    const id=mesh.userData.partId||'stand',p=assemblyPart(id);
    mesh.visible=p.visible&&p.progress>0;
    const fade=ease.io(clamp(p.progress/.30));
    mesh.castShadow=mesh.userData.assemblyCastShadow&&fade>.72;
  }
  for(const m of materials.values()) {
    const p=assemblyPart(m.userData.owner||'stand'),fade=ease.io(clamp(p.progress/.30));
    const base=m.userData.assemblyBase;
    setAssemblyMaterial(m,base.opacity*fade,fade<.999||base.transparent,fade>.999&&base.depthWrite);
  }
  if(activeLabel) {
    const selected=assemblyPart(state.selected);
    lab.state.labels=state.labels&&selected.visible?clamp(selected.progress/.3):0;
  }
  // Combustion and flow have no role before the hardware has all arrived.
  if(!assemblyFrame.done) {
    gas.visible=false;flash.visible=false;
    for(const flow of Object.values(flowDots))flow.visible=false;
  }
}
function labelValue() {
  if(exploration?.active)return '按住拖动 · 单独观察';
  switch(state.selected) {
    case 'intake':return `升程 ${(sim.intakeLift*1000).toFixed(1)} mm`;
    case 'exhaust':return `升程 ${(sim.exhaustLift*1000).toFixed(1)} mm`;
    case 'piston':return `距上止点 ${sim.travelMm.toFixed(1)} mm`;
    case 'rod':return `两销中心距 ${(ENGINE.rod*1000).toFixed(0)} mm`;
    case 'crank':return `曲柄半径 ${(ENGINE.r*1000).toFixed(0)} mm`;
    case 'cylinder':return `缸径 ${(ENGINE.bore*1000).toFixed(0)} mm`;
    default:return '';
  }
}
function select(id,notify=false) {
  if(!nameMap[id])id=null;
  state.selected=id;
  for(const m of materials.values()) {
    m.emissive.copy(m.userData.baseEmissive);m.emissiveIntensity=m.userData.baseEmissiveIntensity;
  }
  if(activeLabel)activeLabel.el.remove();
  lab.labels=[];activeLabel=null;
  if(id)activeLabel=lab.label(parts[id],nameMap[id],{at:anchors[id],value:labelValue});
  lab.target.labels=id&&state.labels?1:0;
  if(notify&&parent!==window)parent.postMessage({type:'engine-select',id},messageTarget);
}
function setMode(mode) {
  if(!['assembled','cut','explode','xray'].includes(mode))return;
  state.mode=mode;
  exploration?.request(mode==='explode');
  lab.target.cut=mode==='cut'&&!exploration?.active?1:0;
  lab.target.explode=lab.state.explode=0;
  lab.target.xray=mode==='xray'&&!exploration?.active?1:0;
}
function update(payload={}) {
  // An embedded scene starts at the empty assembly frame, avoiding a flash of
  // the complete engine before its parent supplies the first clock message.
  // Existing embedding callers without an assembly field keep the normal view.
  if(!receivedParentState&&!('assembly'in payload))state.assembly={active:false,time:0};
  receivedParentState=true;
  if(Number.isFinite(Number(payload.angle)))state.angle=Number(payload.angle);
  if(payload.mode)setMode(payload.mode);
  if('labels'in payload) {state.labels=!!payload.labels;lab.target.labels=state.selected&&state.labels?1:0;}
  if('reduced'in payload)state.reduced=!!payload.reduced;
  if('playing'in payload){state.playing=!!payload.playing;document.body.classList.toggle('is-playing',state.playing);}
  if(payload.interaction==='lesson'||payload.interaction==='whiteboard') {
    state.interaction=payload.interaction;
    lab.controlsOrbit.touches.ONE=state.interaction==='whiteboard'?THREE.TOUCH.ROTATE:-1;
  }
  if('visible'in payload&&payload.visible!=null)state.visible=payload.visible;
  if(payload.assembly&&typeof payload.assembly==='object') {
    state.assembly={active:!!payload.assembly.active,time:Math.max(0,Number(payload.assembly.time)||0)};
    if(state.assembly.active&&exploration?.active)exploration.reset();
  }
  if('selected'in payload&&payload.selected!==state.selected)select(payload.selected);
  sim=engineAt(state.angle);
  return sim;
}
function placeAt(object,p) {lab.place(object,p[0],p[1],p[2]);}
function updateMechanics() {
  sim=engineAt(state.angle);
  placeAt(parts.piston,[0,sim.pistonPinY,0]);
  const rodY=(sim.pistonPinY+sim.crankY)/2;
  placeAt(parts.rod,[sim.crankX/2,rodY,0]);
  parts.rod.rotation.z=Math.atan2(sim.crankX,sim.pistonPinY-sim.crankY);
  parts.crank.rotation.z=-sim.rad;
  parts.flywheel.rotation.z=-sim.rad;
  for(const id of ['intake','exhaust']) {
    const v=valveParts[id],lift=id==='intake'?sim.intakeLift:sim.exhaustLift;
    placeAt(v.valve,[v.x,.300-lift,0]);
    placeAt(v.retainer,[v.x,.345-lift,0]);
    v.spring.scale.y=(.017-lift)/.017;
  }
  const h=Math.max(.001,ENGINE.headY+.005-sim.pistonCrownY);
  gas.scale.y=h;gas.position.set(0,sim.pistonCrownY+h/2,0);
  const color=sim.gasColor;
  if(Array.isArray(color))gasMaterial.color.setRGB(...color);else if(color)gasMaterial.color.set(color);
  gasMaterial.opacity=sim.strokeIndex===2?.20:sim.strokeIndex===1?.16:.10;
  const inside=Math.max(lab.state.cut,lab.state.xray);
  gas.visible=inside>.1&&!exploration?.active;
  flash.visible=sim.spark>0&&inside>.1&&!exploration?.active;
  sparkMaterial.opacity=clamp(Number(sim.spark))*inside;
  flash.scale.setScalar(1+clamp(Number(sim.spark))*.8);
  for(const id of ['intake','exhaust']) {
    const group=flowDots[id],lift=id==='intake'?sim.intakeLift:sim.exhaustLift;
    // The small dots fit through the open curtain around the poppet rim. They
    // appear only once the gap is wide enough for this visual aid to be legible.
    const active=lift>.0035;
    group.visible=active&&inside>.3&&!exploration?.active;
    const side=group.userData.side;
    const route=[
      [side*.094,.311,0],[side*.049,.311,.0015],
      [side*.0317,.309,.0015],[side*.0317,.3015,.0015],
      [side*.0317,.2995-lift*.50,.0015],
      [side*.0365,.2995-lift*.55,.0015],[side*.0365,.287,.0015],
    ];
    group.children.forEach((d,i)=>{
      let t=((state.angle/90+i/group.children.length)%1+1)%1;
      if(id==='exhaust')t=1-t;
      const u=t*(route.length-1),j=Math.min(Math.floor(u),route.length-2),f=u-j;
      d.position.set(...route[j].map((v,k)=>v+(route[j+1][k]-v)*f));
    });
  }
  // Follow the same eased separation as the physical assemblies. The extra head
  // room includes the spark plug. Undoing this relative transform preserves the
  // user's current orbit and zoom when the assemblies return together.
  const separation=exploration?.amount||0;
  // This framing also uses only the parent's assembly time, so pausing or
  // scrubbing never leaves a camera animation running on a second clock.
  // Framing settles over the final arrivals, independently of the brief pause
  // between parts; a short intro must not collapse the camera in its last frame.
  const assemblyHold=.9;
  const assemblyOutro=clamp((state.assembly.time-(ASSEMBLY_DURATION-assemblyHold))/assemblyHold);
  const assemblyRoom=state.assembly.active?(state.reduced?0:1-ease.io(assemblyOutro)):0;
  const spreadScale=Math.max(1.6,Math.min(2.7,1.75/lab.camera.aspect));
  const dockRoom=studioLab&&innerWidth<600;
  const frameScale=(1+(spreadScale-1)*separation)*(1+.18*assemblyRoom)*(dockRoom?1.12:1);
  const frameLift=(.04*separation+.012*assemblyRoom-(dockRoom?.012:0))*lab.k;
  const ratio=frameScale/lastFrameScale;
  const orbit=lab.controlsOrbit;
  orbit.maxDistance=9.8*frameScale;
  lab.camera.position.sub(orbit.target).multiplyScalar(ratio).add(orbit.target);
  const rise=frameLift-lastFrameLift;
  lab.camera.position.y+=rise;orbit.target.y+=rise;
  lastFrameScale=frameScale;lastFrameLift=frameLift;
  if(state.reduced)for(const k of ['cut','explode','xray','labels'])lab.state[k]=lab.target[k];
}
lab.onTick(updateMechanics);
const originalXray=lab._updateXray.bind(lab);
lab._updateXray=()=>{
  if(!state.assembly.active) {originalXray();return;}
  for(const mesh of lab.ghosts) {
    const ghost=mesh.userData.ghost;
    if(ghost) {ghost.visible=false;ghost.userData.edges.visible=false;}
    mesh.userData.noAO=false;
  }
};
const originalUpdate=lab._update.bind(lab);
const focusPaper=new THREE.Color('#e8eef5');
lab._update=dt=>{
  exploration?.before();
  exploration?.step(dt);
  lab.target.cut=state.mode==='cut'&&!exploration?.active?1:0;
  lab.target.xray=state.mode==='xray'&&!exploration?.active?1:0;
  const assembling=state.assembly.active;
  if(assembling!==assemblyWasActive)restoreAssemblyAppearance();
  if(assembling) {
    // A steady teaching section applies to the installed structure and every
    // incoming part. No +Z entry path crosses from discarded to visible space.
    lab.state.cut=lab.target.cut=1;
    lab.state.explode=lab.target.explode=0;
    lab.state.xray=lab.target.xray=0;
  } else if(assemblyWasActive)setMode(state.mode);
  originalUpdate(dt);
  for(const [id,g] of Object.entries(parts)) {
    const v=state.visible;
    g.visible=Array.isArray(v)?v.includes(id):typeof v==='object'?v[id]!==false:true;
  }
  // The crankcase follows the cylinder visibility control.
  if(state.visible&&typeof state.visible==='object'&&!Array.isArray(state.visible)&&state.visible.cylinder===false)parts.case.visible=false;
  if(lab.state.xray>.5&&state.selected)for(const mesh of lab.ghosts) {
    if(mesh.userData.partId===state.selected)mesh.material.opacity=Math.max(mesh.material.opacity,.14);
  }
  if(assembling) {applyAssemblyPose();lab.time=state.assembly.time;}else assemblyFrame=null;
  if(!assembling)exploration?.apply();
  if(studioLab){
    const focusing=!assembling&&state.mode==='explode'&&!!state.selected;
    const frozen=state.interaction==='whiteboard'||state.visible===false;
    const blend=state.reduced?1:frozen?0:1-Math.exp(-dt*10);
    for(const m of materials.values()){
      const wanted=focusing&&m.userData.owner!==state.selected?.26:0;
      m.userData.focusAmount+=(wanted-m.userData.focusAmount)*blend;
      m.color.copy(m.userData.focusBaseColor).lerp(focusPaper,m.userData.focusAmount);
    }
  }
  assemblyWasActive=assembling;
};
const originalLabels=lab._updateLabels.bind(lab);
lab._updateLabels=()=>{
  const hidden=state.mode==='explode'||exploration?.active;
  lab.ui.querySelector('.lab-labels').style.display=hidden?'none':'';
  if(hidden)return;
  originalLabels();
  // The kit eases the labels value and also transitions DOM opacity. Keep its
  // part/projection visibility checks, but show the one selected callout at
  // full contrast as soon as it is eligible to appear on the teaching paper.
  if(activeLabel)activeLabel.el.style.opacity=state.labels&&Number(activeLabel.el.style.opacity)>0?'1':'0';
};
const originalRender=lab.render.bind(lab);
lab.render=dt=>{if(state.visible!==false)originalRender(dt);};

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
lab.renderer.domElement.addEventListener('pointerdown',e=>{if(down){down.moved=true;return;}if(e.button===0)down={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false};});
lab.renderer.domElement.addEventListener('pointermove',e=>{if(down&&e.pointerId===down.id&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)down.moved=true;});
lab.renderer.domElement.addEventListener('pointercancel',()=>{down=null;});
lab.renderer.domElement.addEventListener('pointerup',e=>{
  if(!down||e.pointerId!==down.id)return;const press=down;down=null;
  if(exploration?.active||press.moved||Math.hypot(e.clientX-press.x,e.clientY-press.y)>7)return;
  const rect=lab.renderer.domElement.getBoundingClientRect();
  pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,lab.camera);
  const cutZ=lab.size*.65*(1-ease.io(lab.state.cut))+.008;
  const hits=raycaster.intersectObjects(pickables,false).filter(hit=>{
    let p=hit.object;while(p){if(!p.visible)return false;p=p.parent;}
    if(lab.state.cut>.001) {const local=lab.machine.worldToLocal(hit.point.clone());if(local.z>cutZ+.0001)return false;}
    if(lab.state.xray>.5&&lab.ghosts.includes(hit.object))return false;
    return true;
  });
  let id=hits[0]?.object.userData.partId;
  if(id==='case')id='cylinder';
  select(id||null,true);
});
function getView() {
  return {position:lab.camera.position.toArray(),target:lab.controlsOrbit.target.toArray(),
    zoom:lab.camera.zoom,fov:lab.camera.fov,frameScale:lastFrameScale,frameLift:lastFrameLift,
    presentation:Object.fromEntries(['cut','explode','xray','labels'].map(key=>[key,lab.state[key]])),exploration:exploration?.snapshot(),explorationFocus:exploration?.focusSnapshot(),explorationPresentation:{amount:exploration?.amount||0}};
}
function clearOrbitMotion() {
  // three@0.170 retains damped deltas after a drag. Clear them so restoring a
  // board snapshot does not drift before the next rendered frame.
  lab.controlsOrbit._sphericalDelta.set(0,0,0);
  lab.controlsOrbit._panOffset.set(0,0,0);
  lab.controlsOrbit._scale=1;
  lab.controlsOrbit._performCursorZoom=false;
}
function settleView(options={}) {
  if(options?.presentation) {
    for(const key of ['cut','explode','xray','labels'])lab.state[key]=lab.target[key];
    // Zero dt applies the parent's current pose and framing without advancing
    // either the mechanical clock or its assembly sequence.
    lab._update(0);
  }
  clearOrbitMotion();return getView();
}
function viewAction(action,view) {
  if(action==='settle') {
    settleView();
  } else if(action==='reset'||action==='front') {
    clearOrbitMotion();
    lab.setView(action==='front'?{...initialView,az:0,el:5}:initialView);
    lastFrameScale=1;lastFrameLift=0;
  } else if(action==='restore') {
    const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
    if(!view||!vector(view.position)||!vector(view.target))return;
    clearOrbitMotion();
    const hasPresentation=['cut','explode','xray','labels'].every(key=>Number.isFinite(view.presentation?.[key]));
    for(const key of ['cut','explode','xray','labels']) {
      const value=hasPresentation?clamp(view.presentation[key]):lab.target[key];
      lab.state[key]=lab.target[key]=value;
    }
    // Rebuild the visible pose first. Its framing move is intentionally
    // replaced by the saved camera below, rather than appearing next frame.
    lab._update(0);
    exploration?.restore(view.exploration,view.explorationPresentation);exploration?.restoreFocus(view.explorationFocus);lab._update(0);
    lab.camera.position.fromArray(view.position);lab.controlsOrbit.target.fromArray(view.target);
    if(Number.isFinite(view.zoom)&&view.zoom>0)lab.camera.zoom=view.zoom;
    if(Number.isFinite(view.fov)&&view.fov>0&&view.fov<180)lab.camera.fov=view.fov;
    if(hasPresentation&&Number.isFinite(view.frameScale)&&view.frameScale>0)lastFrameScale=view.frameScale;
    if(hasPresentation&&Number.isFinite(view.frameLift))lastFrameLift=view.frameLift;
    lab.camera.updateProjectionMatrix();lab.controlsOrbit.update();
  } else if(action==='zoom-in'||action==='zoom-out') {
    const direction=lab.camera.position.clone().sub(lab.controlsOrbit.target);
    const d=clamp(direction.length()*(action==='zoom-in'?.84:1.19),lab.controlsOrbit.minDistance,lab.controlsOrbit.maxDistance);
    lab.camera.position.copy(lab.controlsOrbit.target).add(direction.setLength(d));
    lab.controlsOrbit.update();
  }
}
addEventListener('message',event=>{
  if(event.source!==parent||(trustedHttpOrigin&&event.origin!==hostOrigin))return;
  try {
    if(event.data?.type==='engine-state')update(event.data);
    if(event.data?.type==='engine-view')viewAction(event.data.action,event.data.view);
    if(event.data?.type==='engine-explore-tool')exploration?.setTool(event.data.tool);
    if(event.data?.type==='engine-explore-reset')exploration?.resetPart(state.selected);
  } catch(error) {if(parent!==window)parent.postMessage({type:'engine-error',message:String(error.message||error)},messageTarget);}
});
addEventListener('keydown',event=>{
  if([' ','ArrowLeft','ArrowRight','r','R','Escape'].includes(event.key)) {
    event.preventDefault();event.stopPropagation();
    if(parent!==window)parent.postMessage({type:'engine-key',key:event.key},messageTarget);
  }
},true);
addEventListener('error',event=>{if(parent!==window)parent.postMessage({type:'engine-error',message:event.message},messageTarget);});

// Hide the kit's default English controls, including its keyboard mode toggles.
lab._modes=()=>{};
lab.state.cut=lab.target.cut=1;
select(null);
lab._assembly=0;updateMechanics();lab._update(0);
exploration=createEngineExploration({lab,parts,state,pickables,bearing:caseFrontBearing,clearOrbit:clearOrbitMotion,focusEnabled:studioLab,
  onSelect:id=>select(id,true),onPhase:phase=>{if(parent!==window)parent.postMessage({type:'engine-exploration',phase},messageTarget);}});
lab.start();lab._assembly=0;
window.engineScene={
  lab,parts,state,update,select,viewAction,getView,settleView,exploration,get sim(){return sim;},get assembly(){return assemblyFrame;},
  get assemblyPose(){
    return {...(assemblyFrame||assemblyAt(state.assembly.time)),active:state.assembly.active,
      groups:Object.fromEntries(Object.entries(parts).map(([id,g])=>[id,{visible:g.visible,position:g.position.toArray(),rotation:g.rotation.toArray()}]))};
  },
  hardwarePartCount:lab.partCount(),valveParts,gas,standMeshes,hardwareMeshes,
};
if(parent!==window)parent.postMessage({type:'engine-ready'},messageTarget);
