import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const read=()=>page.evaluate(()=>{const s=document.querySelector('#machine').contentWindow.coolingScene;
 return {mode:s.state.mode,phase:s.exploration.phase,amount:s.exploration.amount,pose:s.exploration.snapshot(),playing:coolingDemo.state.playing,
 lines:s.meshes.filter(m=>m.userData.partId==='pipes'||m.userData.role==='connection').map(m=>({visible:m.visible,opacity:m.material.opacity})),
 coils:s.meshes.filter(m=>['evaporator','condenser'].includes(m.userData.partId)&&['copper','darkCopper'].includes(m.userData.materialName)).map(m=>({visible:m.visible,opacity:m.material.opacity})),
 attached:['filter','expansion'].map(id=>{s.parts[id].updateWorldMatrix(true,false);s.parts.condenser.updateWorldMatrix(true,false);return s.parts.condenser.matrixWorld.clone().invert().multiply(s.parts[id].matrixWorld).elements;})};});
try{
 await page.goto('http://127.0.0.1:4198/refrigerator.html?v=clean-assemblies');
 await page.waitForFunction(()=>window.coolingDemo?.ready&&!coolingDemo.state.assembly.active);
 await page.waitForTimeout(800);assert.ok((await read()).lines.every(m=>m.visible&&m.opacity>.9));
 await page.locator('button[data-mode=explode]').click();await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.coolingScene.exploration.phase==='open');await page.waitForTimeout(300);
 const opened=await read();assert.equal(Object.keys(opened.pose).length,5);assert.ok(opened.lines.every(m=>!m.visible&&m.opacity===0));assert.ok(opened.coils.every(m=>m.visible&&m.opacity>.99));
 await page.screenshot({path:'qa/fridge-clean-assemblies.png'});
 // Pick the attached filter itself; it must rotate the complete condenser module.
 const pt=await page.evaluate(()=>{const f=document.querySelector('#machine'),s=f.contentWindow.coolingScene,m=s.parts.filter.children.find(x=>x.isMesh),r=f.getBoundingClientRect();m.updateWorldMatrix(true,false);m.geometry.computeBoundingBox();const p=m.geometry.boundingBox.getCenter(m.position.clone()).applyMatrix4(m.matrixWorld).project(s.lab.camera);return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};});
 await page.mouse.move(pt.x,pt.y);await page.mouse.down();await page.mouse.move(pt.x+50,pt.y+35,{steps:10});await page.mouse.up();await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>coolingDemo.state.selected),'condenser');
 const rotated=await read();assert.notDeepEqual(rotated.pose.condenser.rotation,opened.pose.condenser.rotation);
 for(let i=0;i<2;i++)for(let j=0;j<16;j++)assert.ok(Math.abs(rotated.attached[i][j]-opened.attached[i][j])<1e-7,'small parts follow their parent rigidly');
 await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>coolingDemo.whiteboard.isOpen);const held=await read();await page.waitForTimeout(350);assert.deepEqual((await read()).pose,held.pose);assert.ok((await read()).lines.every(m=>!m.visible));await page.evaluate(()=>coolingDemo.whiteboard.close());
 await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.coolingScene.exploration.phase==='closed'&&coolingDemo.state.playing);await page.waitForTimeout(400);
 const back=await read();assert.ok(back.lines.every(m=>m.visible&&m.opacity>.9));for(const r of Object.values(back.pose))assert.deepEqual(r.offset,[0,0,0]);
 // Reversing mid-transition must recover all lines and original poses.
 await page.evaluate(()=>coolingDemo.setMode('explode'));await page.waitForTimeout(350);await page.evaluate(()=>coolingDemo.setMode('xray'));await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.coolingScene.exploration.phase==='closed');assert.ok((await read()).lines.every(m=>m.visible));
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.coolingDemo?.ready);assert.equal(await page.evaluate(()=>coolingDemo.state.playing),false);await page.locator('button[data-mode=explode]').click();await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.coolingScene.exploration.phase==='open');assert.ok((await read()).lines.every(m=>!m.visible));
 assert.deepEqual(errors,[]);console.log('PASS five fridge assemblies; connection fade and restore; intact coils; attached filter drag; rigid grouping; whiteboard freeze; interruption; reduced motion');
}finally{await browser.close();}
