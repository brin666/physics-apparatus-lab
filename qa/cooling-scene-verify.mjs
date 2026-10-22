import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
for(const kind of ['fridge','ac']){
 await page.goto(`http://127.0.0.1:4198/refrigeration-machine.html?machine=${kind}`);await page.waitForFunction(()=>window.coolingScene);
 await page.evaluate(()=>coolingScene.update({assembly:{active:false,time:5},mode:'cut',reduced:true,selected:null,playing:false}));
 await page.evaluate(()=>coolingScene.settleView({presentation:true}));
 for(const operation of kind==='ac'?['cool','heat']:['cool']){
  await page.evaluate(operation=>coolingScene.update({operation}),operation);
  const routes=await page.evaluate(()=>coolingScene.flowRoutes);
  routes.forEach((r,i)=>assert.ok(Math.hypot(...r.end.map((v,j)=>v-routes[(i+1)%routes.length].start[j]))<1e-8,`${kind}/${operation} joins ${r.id}`));
  for(const [progress,phases] of [[.125,['compression','hot']],[.375,['condense','liquid']],[.625,['expand','mixed']],[.875,['evaporate','vapor']],[1,['vapor']]]){
   await page.evaluate(progress=>{coolingScene.update({progress});coolingScene.lab._update(0);},progress);
   assert.ok(phases.includes(await page.evaluate(()=>coolingScene.trackedParcel.phase)),`${kind}/${operation} caption clock ${progress}`);
  }
  if(kind==='ac'){
   const before=await page.evaluate(()=>{coolingScene.update({progress:.34});coolingScene.lab._update(0);return coolingScene.inspect().motion;});
   await page.waitForTimeout(180);assert.deepEqual(await page.evaluate(()=>coolingScene.inspect().motion),before);
   await page.evaluate(()=>{coolingScene.update({progress:.56});coolingScene.lab._update(0);});
   assert.notDeepEqual(await page.evaluate(()=>coolingScene.inspect().motion),before);
  }
  checks.push(`${kind}/${operation}: closed ports, four semantic stages, deterministic motion`);
 }
 // Every group uses the same five one-second step clock as its parent lesson.
 for(let i=0;i<5;i++){
  const pose=await page.evaluate(time=>{coolingScene.update({assembly:{active:true,time}});coolingScene.lab._update(0);return coolingScene.assembly;},i+.6);
  assert.equal(pose.index,i);assert.ok(Object.values(pose.parts).some(p=>p.visible));
 }
 {
  for(const time of [1.8,3.95,4.1]){
   const pose=await page.evaluate(time=>{
    const s=coolingScene;s.update({reduced:false,assembly:{active:true,time}});s.lab._update(0);
    const exterior=s.meshes.filter(m=>s.kind==='fridge'
     ?m.userData.partId==='door'||m.userData.partId==='shell'&&['front','section','back','left-wall','right-wall'].includes(m.userData.role)
     :['indoor-shell','outdoor-shell'].includes(m.userData.partId)&&['cover','front','back'].includes(m.userData.role)||['filter','guard'].includes(m.userData.role)||m.userData.partId==='louver');
    return {exterior:exterior.map(m=>m.userData.effectiveOpacity),pipes:s.meshes.filter(m=>m.userData.partId==='pipes').map(m=>m.userData.effectiveOpacity),base:s.meshes.some(m=>m.userData.partId===(s.kind==='fridge'?'shell':'outdoor-shell')&&m.userData.role==='solid'&&m.visible)};
   },time);
   assert.ok(pose.exterior.length>0&&pose.exterior.every(a=>a===0),'exterior stays absent while internal parts assemble');
   assert.ok(pose.base,'base stays visible beneath the internal parts');
   if(time>3.9)assert.ok(pose.pipes.every(a=>a>.99),'complete exposed circuit precedes enclosure closure');
  }
  const closed=await page.evaluate(()=>{const s=coolingScene;s.update({assembly:{active:true,time:4.95}});s.lab._update(0);return s.meshes.filter(m=>s.kind==='fridge'
   ?m.userData.partId==='door'||m.userData.partId==='shell'&&['front','section','back','left-wall','right-wall'].includes(m.userData.role)
   :['indoor-shell','outdoor-shell'].includes(m.userData.partId)&&['cover','front','back'].includes(m.userData.role)).map(m=>m.userData.effectiveOpacity/m.material.userData.base.opacity);});
  assert.ok(closed.every(a=>a>.99),'enclosures finish at the end of the five-second intro');
  checks.push(`${kind}: connected internals stay exposed before the final enclosure installation`);
 }
 const markers=await page.evaluate(()=>coolingScene.lab.fx.getObjectByName('refrigerant-parcels').children.map(m=>m.name));
 assert.equal(markers.filter(name=>name==='tracked-parcel').length,1);
 assert.equal(markers.filter(name=>name==='refrigerant-parcel').length,0);
 const copperBefore=await page.evaluate(()=>{
  const s=coolingScene;s.update({reduced:false,assembly:{active:true,time:3.95},selected:'pipes'});s.lab._update(0);
  return s.meshes.filter(m=>['copper','darkCopper'].includes(m.userData.materialName)).map(m=>({color:m.material.color.getHexString(),emissive:m.material.emissive.getHexString(),intensity:m.material.emissiveIntensity}));
 });
 const copperAfter=await page.evaluate(()=>{
  const s=coolingScene;s.update({reduced:true,assembly:{active:false,time:5},mode:'xray',selected:'expansion',progress:.625});s.settleView({presentation:true});
  return s.meshes.filter(m=>['copper','darkCopper'].includes(m.userData.materialName)).map(m=>({color:m.material.color.getHexString(),emissive:m.material.emissive.getHexString(),intensity:m.material.emissiveIntensity}));
 });
 assert.ok(copperBefore.length>0);assert.deepEqual(copperAfter,copperBefore,'copper keeps its material color across assembly, selection and lesson');
 assert.ok(await page.evaluate(()=>coolingScene.meshes.filter(m=>['copper','darkCopper'].includes(m.userData.materialName)).every(m=>m.renderOrder>0&&m.material.depthTest&&m.material.depthWrite)),'xray ghost skins do not wash over copper; depth occlusion remains enabled');
 checks.push(`${kind}: copper color stays fixed while the tracked parcel carries the state color`);
 await page.evaluate(()=>{coolingScene.update({assembly:{active:false,time:5},mode:'explode'});coolingScene.settleView({presentation:true});});
 if(kind==='fridge'){
  const clearance=await page.evaluate(async()=>{
   const {Box3}=await import('/node_modules/three/build/three.module.js'),s=coolingScene;
   s.lab.scene.updateMatrixWorld(true);
   const bounds=Object.entries(s.parts).map(([id,g])=>[id,new Box3().setFromObject(g)]),overlaps=[];
   const circuit=new Set(['expansion','filter','pipes']);
   for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){
    const [a,ba]=bounds[i],[b,bb]=bounds[j];
    // These three connected routes remain one circuit assembly in the teardown.
    if(!(circuit.has(a)&&circuit.has(b))&&ba.intersectsBox(bb))overlaps.push([a,b]);
   }
   const shell=s.meshes.filter(m=>m.userData.partId==='shell');
   const apron=shell.find(m=>m.userData.role==='front'&&m.userData.basePosition.y<.25);
   const pathHits=[];
   s.state.reduced=false;
   // Walk both directions, including the temporary panel opening and return.
   for(const direction of [1,-1])for(let i=0;i<=100;i++){
    const p=direction===1?i/100:1-i/100;
    s.lab.state.explode=s.lab.target.explode=p;s.lab._update(0);s.lab.scene.updateMatrixWorld(true);
    const evaporator=new Box3().setFromObject(s.parts.evaporator);
    if(shell.some(m=>evaporator.intersectsBox(new Box3().setFromObject(m))))pathHits.push({p,part:'evaporator'});
    if(new Box3().setFromObject(s.parts.compressor).intersectsBox(new Box3().setFromObject(apron)))pathHits.push({p,part:'compressor/apron'});
   }
   s.update({mode:'assembled',reduced:true});s.settleView({presentation:true});
   const returned=Object.values(s.parts).every(g=>g.position.length()<1e-10)&&s.meshes.every(m=>m.position.distanceTo(m.userData.basePosition)<1e-10);
   s.update({mode:'explode'});s.settleView({presentation:true});
   return {overlaps,pathHits,returned};
  });
  assert.deepEqual(clearance.overlaps,[],'exploded cabinet, door and internal assemblies keep separate bounds');
  assert.deepEqual(clearance.pathHits,[],'evaporator clears cabinet and compressor clears apron in both directions');
  assert.ok(clearance.returned,'temporary panel opening and group offsets reset when reassembled');
  checks.push('fridge: separated exploded assemblies, forward/reverse panel clearance and complete reassembly');
 }
 const saved=await page.evaluate(()=>coolingScene.getView());
 await page.evaluate(()=>{coolingScene.update({mode:'xray'});coolingScene.settleView({presentation:true});coolingScene.viewAction('zoom-in');});
 await page.evaluate(saved=>coolingScene.viewAction('restore',saved),saved);await page.waitForTimeout(180);
 const restored=await page.evaluate(()=>coolingScene.getView());
 for(const key of ['position','target'])saved[key].forEach((v,i)=>assert.ok(Math.abs(v-restored[key][i])<1e-12));
 for(const key of ['zoom','fov','frameScale','frameLift'])assert.equal(restored[key],saved[key]);assert.deepEqual(restored.presentation,saved.presentation);
 await page.evaluate(()=>{coolingScene.update({mode:'cut',selected:null});coolingScene.settleView({presentation:true});coolingScene.viewAction('reset');});
 await page.waitForTimeout(100);const anchor=await page.evaluate(()=>coolingScene.projectPart('compressor'));
 await page.mouse.click(anchor.x,anchor.y);assert.equal(await page.evaluate(()=>coolingScene.state.selected),'compressor');
 checks.push(`${kind}: five assembly steps, exact cross-mode camera restore, actual 3D compressor click`);
}
assert.deepEqual(errors,[]);
writeFileSync('qa/cooling-scene-verification.json',JSON.stringify({checks,errors},null,2));console.log(checks.join('\n'));await browser.close();
