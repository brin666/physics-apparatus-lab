import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:900},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4198/engine.html?v=parts');await page.waitForFunction(()=>window.thermalDemo?.ready);await page.evaluate(()=>{thermalDemo.finishAssembly(false);thermalDemo.setMode('explode')});await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.engineScene.exploration.phase==='open');
 await page.evaluate(()=>thermalDemo.setMode('explode'));assert.ok(await page.locator('#exploration-tools').isVisible());
 await page.evaluate(()=>thermalDemo.startAssembly());await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>thermalDemo.state.assembly.active),true);await page.waitForFunction(()=>!thermalDemo.state.assembly.active);assert.equal(await page.evaluate(()=>thermalDemo.state.playing),true);
 await page.locator('button[data-mode="explode"]').click();await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.engineScene.exploration.phase==='open');
 const p=await page.evaluate(()=>{const f=document.querySelector('#machine'),s=f.contentWindow.engineScene,m=s.parts.piston.children.find(m=>m.isMesh);m.updateWorldMatrix(true,false);m.geometry.computeBoundingBox();const v=m.geometry.boundingBox.getCenter(m.position.clone()).applyMatrix4(m.matrixWorld).project(s.lab.camera),r=f.getBoundingClientRect();return{x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2};});
 const get=()=>page.evaluate(()=>{const s=document.querySelector('#machine').contentWindow.engineScene;return {pose:s.exploration.snapshot().piston,view:s.getView()}});const initial=await get();
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
 for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+i*5,y:p.y+i*2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(700);
 const rotated=await get();assert.notDeepEqual(initial.pose.rotation,rotated.pose.rotation);assert.deepEqual(initial.view.position,rotated.view.position);
 await page.locator('#part-reset').click();await page.waitForTimeout(500);const reset=await get();assert.deepEqual(initial.pose,reset.pose);
 await page.mouse.move(420,700);await page.mouse.down();await page.mouse.move(500,730,{steps:10});await page.mouse.up();await page.waitForTimeout(350);const orbit=await get();assert.notDeepEqual(orbit.view.position,reset.view.position);
 assert.deepEqual(errors,[]);console.log('PASS replay from disassembly, repeated mode, touch part rotation, smooth part reset, empty-space camera orbit; no browser errors');
}finally{await browser.close();}
