import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const scene=()=>document.querySelector('#machine').contentWindow.coolingScene;
try{
 for(const [file,id] of [['refrigerator','compressor'],['air-conditioner','fan']]){
  await page.goto('http://127.0.0.1:4198/'+file+'.html');
  await page.waitForFunction(()=>window.coolingDemo?.ready);
  await page.waitForFunction(()=>!coolingDemo.state.assembly.active);
  assert.equal(await page.evaluate(()=>coolingDemo.state.playing),true);
  assert.equal(await page.evaluate(()=>coolingDemo.state.mode),'xray');
  await page.waitForTimeout(800);
  await page.screenshot({path:'qa/cooling-upgrade-'+file+'-running.png'});
  await page.locator('button[data-mode=explode]').click();
  await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.coolingScene.exploration.phase==='open');
  await page.waitForTimeout(300);
  const get=()=>page.evaluate(()=>{const s=document.querySelector('#machine').contentWindow.coolingScene;return {pose:s.exploration.snapshot(),view:s.getView(),selected:coolingDemo.state.selected,progress:coolingDemo.state.progress};});
  const point=()=>page.evaluate(id=>{const f=document.querySelector('#machine'),s=f.contentWindow.coolingScene,g=s.parts[id],r=f.getBoundingClientRect();let m;g.traverse(o=>{if(!m&&o.isMesh)m=o;});m.updateWorldMatrix(true,false);m.geometry.computeBoundingBox();const p=m.geometry.boundingBox.getCenter(m.position.clone()).applyMatrix4(m.matrixWorld).project(s.lab.camera);return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};},id);
  const before=await get(),p=await point();
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+55,p.y+30,{steps:10});await page.mouse.up();await page.waitForTimeout(500);
  const rotated=await get();assert.equal(rotated.selected,id);assert.notDeepEqual(rotated.pose[id].rotation,before.pose[id].rotation);assert.deepEqual(rotated.view.position,before.view.position);
  assert.equal(await page.locator('#part-inspector').isVisible(),true);assert.equal(await page.locator('#lesson-panel').isVisible(),false);
  await page.screenshot({path:'qa/cooling-upgrade-'+file+'-explode.png'});
  await page.locator('[data-explore-tool=move]').click();const p2=await point();await page.mouse.move(p2.x,p2.y);await page.mouse.down();await page.mouse.move(p2.x+30,p2.y-20,{steps:8});await page.mouse.up();
  assert.notDeepEqual((await get()).pose[id].offset,rotated.pose[id].offset);
  await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>coolingDemo.whiteboard.isOpen);await page.waitForTimeout(200);const held=await get();await page.waitForTimeout(250);assert.deepEqual((await get()).pose,held.pose);
  await page.evaluate(()=>coolingDemo.whiteboard.close());
  await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.coolingScene.exploration.phase==='closed'&&coolingDemo.state.playing);
  for(const r of Object.values((await get()).pose)){assert.deepEqual(r.offset,[0,0,0]);assert.ok(Math.abs(r.rotation[3]-1)<1e-8);}
  if(file==='air-conditioner'){
   await page.locator('[data-operation=heat]').click();assert.equal(await page.locator('#heat-direction').textContent(),'室外吸热 → 室内放热');
   await page.locator('[data-operation=cool]').click();assert.equal(await page.locator('#heat-direction').textContent(),'室内吸热 → 室外放热');
  }
  // Interrupt opening and closing, then replay the intro from an arbitrary pose.
  await page.evaluate(()=>coolingDemo.setMode('explode'));await page.waitForTimeout(160);await page.evaluate(()=>coolingDemo.setMode('xray'));await page.waitForTimeout(160);await page.evaluate(()=>coolingDemo.setMode('explode'));
  await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.coolingScene.exploration.phase==='open');
  await page.evaluate(()=>coolingDemo.startAssembly());await page.waitForFunction(()=>!coolingDemo.state.assembly.active);
  assert.equal(await page.evaluate(()=>coolingDemo.state.playing),true);
  console.log('PASS',file,'intro, xray, actual drag rotate/move, popup, whiteboard freeze, smooth return, interruption/replay');
 }
 await page.goto('http://127.0.0.1:4198/');assert.equal(await page.locator('.apparatus').count(),3);await page.waitForTimeout(1200);await page.screenshot({path:'qa/cooling-upgrade-home.png'});
 for(const url of ['joule.html','gas-state.html'])assert.equal((await page.request.get('http://127.0.0.1:4198/'+url)).status(),404);
 for(const file of ['refrigerator','air-conditioner']){
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:4198/'+file+'.html');await page.waitForFunction(()=>window.coolingDemo?.ready);await page.waitForFunction(()=>!coolingDemo.state.assembly.active);
  await page.screenshot({path:'qa/cooling-upgrade-'+file+'-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('button[data-mode=explode]').click();await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.coolingScene.exploration.phase==='open');await page.screenshot({path:'qa/cooling-upgrade-'+file+'-mobile-explode.png'});
 }
 assert.deepEqual(errors,[]);console.log('PASS three-device homepage, retired pages 404, mobile, no browser errors');
}finally{await browser.close();}
