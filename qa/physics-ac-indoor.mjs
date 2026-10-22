import {buildAC,roundedRoute,routeGeometry} from '../refrigeration-geometry.mjs';
import {THREE} from '../vendor/machine-kit/lab-kit.js';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const root=new THREE.Group(),parts={},meshes=[];
const ctx={parts,group(id){const g=new THREE.Group();g.name=id;root.add(g);parts[id]=g;return g;},solid(id,geo,material,options={}){const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial());m.position.set(...(options.pos||[0,0,0]));m.rotation.set(...(options.rot||[0,0,0]));m.userData={id,role:options.role||'solid'};(options.parent||parts[id]).add(m);meshes.push(m);return m;},pipe(id,points,r=.006,material,options={}){const curve=roundedRoute(points,Math.max(.008,r*3));const m=this.solid(id,routeGeometry(curve,r),material,options);m.userData.points=points;return m;},link(){}};
// Factory destructures helpers: bind pipe explicitly.
ctx.pipe=ctx.pipe.bind(ctx);
const model=buildAC(ctx);root.updateMatrixWorld(true);
const fixedIds=['indoor-shell','indoor-coil','filter','drain','louver'];
const fixed=meshes.filter(m=>fixedIds.includes(m.userData.id)&&m.parent!==model.motion.louver).map(m=>({m,box:new THREE.Box3().setFromObject(m)}));
const blade=root.getObjectByName('indoor-blower-blades'),p=new THREE.Vector3();let minimum=Infinity,nearest='';
// Sample every authored blade vertex at 72 rotor phases. Box distances are
// conservative lower bounds for the actual fixed solids, never optimistic.
for(let phase=0;phase<72;phase++){
 model.motion.blower.rotation.x=phase*2*Math.PI/72;root.updateMatrixWorld(true);
 const vertices=blade.geometry.attributes.position;
 for(let i=0;i<vertices.count;i++){
  p.fromBufferAttribute(vertices,i).applyMatrix4(blade.matrixWorld);
  for(const {m,box} of fixed){const d=box.distanceToPoint(p);if(d<minimum){minimum=d;nearest=m.name||m.userData.id;}assert(d>0.001,'blade vertex enters fixed solid bounding volume: '+m.userData.id);}
 }
}
const vane=root.getObjectByName('indoor-louver-blade');let swingMinimum=Infinity,fanRadius=0;
for(let i=0;i<blade.geometry.attributes.position.count;i++){p.fromBufferAttribute(blade.geometry.attributes.position,i);fanRadius=Math.max(fanRadius,Math.hypot(p.y,p.z));}
let sweptCylinderMinimum=Infinity;
const rotorMinX=-.60-.384,rotorMaxX=-.60+.384;
for(const {m,box} of fixed){
 if(box.max.x<rotorMinX||box.min.x>rotorMaxX)continue;
 const dy=Math.max(box.min.y-model.motion.blower.position.y,0,model.motion.blower.position.y-box.max.y);
 const dz=Math.max(box.min.z-model.motion.blower.position.z,0,model.motion.blower.position.z-box.max.z);
 const gap=Math.hypot(dy,dz)-fanRadius;
 assert(gap>.005,'entire swept cylinder must clear '+m.userData.id);
 sweptCylinderMinimum=Math.min(sweptCylinderMinimum,gap);
}
for(let step=0;step<=80;step++){
 model.motion.louver.rotation.x=-.26+.20*step/80;root.updateMatrixWorld(true);
 for(let i=0;i<vane.geometry.attributes.position.count;i++){
  p.fromBufferAttribute(vane.geometry.attributes.position,i).applyMatrix4(vane.matrixWorld);
  const radialGap=Math.hypot(p.y-model.motion.blower.position.y,p.z-model.motion.blower.position.z)-fanRadius;
  assert(radialGap>.005,'louver enters blower swept cylinder');
  swingMinimum=Math.min(swingMinimum,radialGap);
  for(const {m,box} of fixed.filter(v=>v.m.name==='indoor-fixed-guide-vane'||v.m.name==='indoor-outlet-guide-base')) assert(box.distanceToPoint(p)>.005,'swinging vane strikes fixed outlet guide');
 }
}
// Water is intercepted before reaching the rotor, across the entire fin footprint.
const pan=new THREE.Box3().setFromObject(root.getObjectByName('indoor-condensate-pan-floor'));
assert(pan.min.y>model.motion.blower.position.y+fanRadius+.01);
assert(pan.max.y<1.508);assert(pan.min.x<-1.009&&pan.max.x>-.191);assert(pan.min.z<-.051&&pan.max.z>.021);
const drain=meshes.find(m=>m.userData.id==='drain'&&m.userData.points);const points=drain.userData.points;assert(points.every((p,i)=>!i||p[1]<=points[i-1][1]));
const shaft=root.getObjectByName('blower-drive-shaft');const shaftBox=new THREE.Box3().setFromObject(shaft);assert(shaftBox.min.x<-1.011&&shaftBox.max.x>-.164);
const result={sweptCylinderToStationaryLowerBoundM:sweptCylinderMinimum,rotorPhases:72,louverAngles:81,actualBladeVertices:blade.geometry.attributes.position.count,bladeToStationaryLowerBoundM:minimum,nearestStationary:nearest,louverToFullRotorEnvelopeM:swingMinimum,fullRotorRadiusM:fanRadius,panAboveFan:true,drainMonotonicallyFalls:true,bearingAndMotorShaftContinuous:true};
console.log(JSON.stringify(result,null,2));await writeFile('qa/physics-ac-indoor-results.md','# Indoor AC motion verification\n\n```json\n'+JSON.stringify(result,null,2)+'\n```\n');
