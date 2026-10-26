import test from 'node:test';
import assert from 'node:assert/strict';
import {devices} from './registry.mjs';

globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillText(){}})})};
const ids=['relay','induction-hob','electroscope','rheostat','pulley','submarine','canal-lock','manometer','piston-pump'];
for(const id of ids)test(`${id}: study views preserve mechanism state and restore assembled materials`,()=>{
 const d=devices.find(d=>d.id===id),m=d.build(),inputs=Object.fromEntries(d.controls.map(c=>[c.id,c.value]));
 m.update(0,inputs);
 const authored=[];m.root.traverse(o=>authored.push({o,position:o.position.toArray(),quaternion:o.quaternion.toArray(),state:o.userData.modelVisible}));
 for(const mode of ['cut','xray','assembled','cut','explode','assembled']){
  m.setView({mode});
  for(const r of authored){assert.deepEqual(r.o.position.toArray(),r.position);assert.deepEqual(r.o.quaternion.toArray(),r.quaternion);assert.equal(r.o.userData.modelVisible,r.state);}
  if(mode==='cut'||mode==='xray'){const b=m.viewBounds(mode);assert(!b.isEmpty());assert([...b.min.toArray(),...b.max.toArray()].every(Number.isFinite));}
  let clips=0;m.root.traverse(o=>{if(o.isMesh&&!o.userData.intrinsicClip)for(const mat of Array.isArray(o.material)?o.material:[o.material])clips+=mat.clippingPlanes?.length||0;});
  assert.equal(clips>0,mode==='cut');
  if(mode==='assembled'||mode==='explode')m.root.traverse(o=>assert(!o.userData.studyHidden));
 }
 // Changing views must not overwrite conditional circuit/fluid visibility.
 for(const c of d.controls){const v=c.options?c.options.at(-1).value:c.max;m.update(1,{...inputs,[c.id]:v});const states=[];m.root.traverse(o=>states.push([o,o.userData.modelVisible]));m.setView({mode:'xray'});m.setView({mode:'assembled'});for(const [o,state] of states)assert.equal(o.userData.modelVisible,state);}
});

test('submarine study framing stays fixed while the hull moves, retaining a water reference',()=>{
 const m=devices.find(d=>d.id==='submarine').build();m.update(0,{});const hull=m.root.getObjectByName('sub-displacement-hull');
 const a=m.viewBounds('cut').getCenter(hull.position.clone());hull.parent.position.y+=.4;
 const b=m.viewBounds('cut').getCenter(hull.position.clone());assert(Math.abs(b.y-a.y)<1e-8);assert.equal(m.viewFollow,undefined);
 m.setView({mode:'cut'});assert(m.root.getObjectByName('submarine-side-lesson').visible);assert(m.root.getObjectByName('sub-waterline'));
});

test('hob central section matches spiral crossings, layer order and cookware detection',()=>{
 const d=devices.find(d=>d.id==='induction-hob'),m=d.build();
 assert.deepEqual(d.flatViewDirection,[0,0,1]);m.setView({mode:'cut'});
 const disks=[];m.root.traverse(o=>{if(o.name==='hob-wire-section')disks.push(o);});
 assert.equal(disks.length,27); // 13 turns intersect the centre plane twice, plus the starting end.
 const xs=disks.map(o=>o.position.x).sort((a,b)=>a-b);
 assert(Math.abs(xs[0]+(.035+.30*25/26))<1e-6);assert(Math.abs(xs.at(-1)-.335)<1e-6);
 for(const disk of disks){assert.equal(disk.position.y,.13);assert(!disk.material.clippingPlanes?.length);}
 const section=id=>m.root.getObjectByName(`${id}-section-faces`);
 const panel=section('glass').children[0],support=section('induction-coil').children[0];
 assert(.13+.009<panel.position.y-panel.geometry.parameters.height/2);
 assert(Math.abs(support.position.y+support.geometry.parameters.height/2-(.13-.009))<1e-9,'coil rests on its support');
 for(const id of ['chassis','glass','cookware','induction-coil','ferrite-core']){
  const p=m.parts.find(p=>p.id===id);assert(section(id).visible);
  assert(p.object.children.filter(o=>o!==section(id)).every(o=>!o.visible));
 }
 for(const [inputs,active] of [[{power:65,pan:'steel'},true],[{power:0,pan:'steel'},false],[{power:65,pan:'none'},false]]){
  m.update(1,inputs);assert.equal(m.root.getObjectByName('magnetic-field').visible,active);assert.equal(m.root.getObjectByName('eddy-currents').visible,active);
  assert.equal(m.root.getObjectByName('cookware').visible,inputs.pan==='steel');
 }
 m.setView({mode:'assembled'});
 assert(!section('cookware').visible);assert(m.root.getObjectByName('cookware').children[0].visible);
});

test('hob field arrows reverse at fixed locations and fade through zero',()=>{
 const m=devices.find(d=>d.id==='induction-hob').build();m.setView({mode:'cut'});
 const arrows=[];m.root.traverse(o=>{if(o.name==='hob-field-direction')arrows.push(o);});assert.equal(arrows.length,2);
 m.update(1/(4*.35),{power:65,pan:'steel'});
 const positive=arrows.map(o=>({p:o.position.clone(),q:o.quaternion.clone()}));
 m.update(3/(4*.35),{power:65,pan:'steel'});
 arrows.forEach((o,i)=>{assert(o.position.distanceTo(positive[i].p)<1e-12);assert(Math.abs(o.quaternion.angleTo(positive[i].q)-Math.PI)<1e-7);});
 m.update(0,{power:65,pan:'steel'});for(const o of arrows)assert.equal(o.material.uniforms.signal.value,0);
});

test('hob eddy currents reverse on closed top-view paths while heat transfer remains upward',()=>{
 const m=devices.find(d=>d.id==='induction-hob').build();m.setView({mode:'cut'});
 const find=name=>{const list=[];m.root.traverse(o=>{if(o.name===name)list.push(o);});return list;};
 const loops=find('hob-eddy-flow'),heat=find('hob-heat-direction');assert.equal(loops.length,2);assert.equal(heat.length,3);
 for(const loop of loops){const curve=loop.geometry.parameters.path;assert(curve.getPoint(0).distanceTo(curve.getPoint(1))<1e-8);}
 m.update(0,{power:65,pan:'steel'});for(const loop of loops)assert.equal(loop.material.uniforms.direction.value,-1);
 m.update(.5/.35,{power:65,pan:'steel'});for(const loop of loops)assert.equal(loop.material.uniforms.direction.value,1);
 for(const arrow of heat){const up=arrow.position.clone().set(0,1,0).applyQuaternion(arrow.quaternion);assert(up.y>0);assert(arrow.position.y>=.268&&arrow.position.y<=.379);}
 m.update(.25/.35,{power:65,pan:'steel'});for(const loop of loops)assert(loop.material.uniforms.strength.value<1e-7);
 for(const inputs of [{power:0,pan:'steel'},{power:65,pan:'none'}]){m.update(1,inputs);for(const o of [...loops,...heat])assert.equal(o.material.uniforms.strength.value,0);}
});
