import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4198/engine.html?v=explore');
 await page.waitForFunction(()=>window.thermalDemo?.ready);
 await page.waitForFunction(()=>!thermalDemo.state.assembly.active);
 assert.equal(await page.evaluate(()=>thermalDemo.state.playing),true);
 await page.locator('button[data-mode="explode"]').click();
 await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.engineScene.exploration.phase==='open');
 await page.waitForTimeout(300);
 const get=()=>page.evaluate(()=>{const s=document.querySelector('#machine').contentWindow.engineScene;return {pose:s.exploration.snapshot(),view:s.getView(),angle:thermalDemo.state.angle,selected:thermalDemo.state.selected,playing:thermalDemo.state.playing}});
 const point=()=>page.evaluate(()=>{const f=document.querySelector('#machine'),s=f.contentWindow.engineScene,g=s.parts.piston,m=g.children.find(m=>m.isMesh);m.updateWorldMatrix(true,false);m.geometry.computeBoundingBox();const p=m.geometry.boundingBox.getCenter(m.position.clone()).applyMatrix4(m.matrixWorld).project(s.lab.camera),r=f.getBoundingClientRect();return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};});
 const before=await get(),p=await point();
 await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+75,p.y+40,{steps:12});await page.mouse.up();await page.waitForTimeout(700);
 const rotated=await get();
 assert.notDeepEqual(rotated.pose.piston.rotation,before.pose.piston.rotation,'piston must rotate');
 assert.deepEqual(rotated.view.position,before.view.position,'dragging part must not orbit camera');
 assert.deepEqual(rotated.pose.piston.offset,before.pose.piston.offset,'rotation preserves part location');
 assert.equal(rotated.selected,'piston');
 assert.equal(await page.locator('#lesson-panel').isVisible(),false);
 await page.screenshot({path:'qa/engine-explore-rotated.png'});
 await page.locator('[data-explore-tool="move"]').click();
 const p2=await point();await page.mouse.move(p2.x,p2.y);await page.mouse.down();await page.mouse.move(p2.x-60,p2.y+25,{steps:10});await page.mouse.up();
 const moved=await get();assert.notDeepEqual(moved.pose.piston.offset,rotated.pose.piston.offset);
 await page.locator('#whiteboard-open').click();await page.waitForTimeout(500);const paused=await get();await page.waitForTimeout(300);assert.deepEqual((await get()).pose,paused.pose,'whiteboard freezes pose');
 await page.evaluate(()=>thermalDemo.whiteboard.close());
 await page.locator('#play').click();
 await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.engineScene.exploration.phase==='closed');
 await page.waitForFunction(()=>thermalDemo.state.playing);
 const returned=await get();for(const r of Object.values(returned.pose)){assert.deepEqual(r.offset,[0,0,0]);assert.ok(Math.abs(r.rotation[3]-1)<1e-9);}
 console.log('PASS rotation, center, independent camera, translation, whiteboard, return, auto-play');
 console.log('LABEL',await page.locator('[data-mode="explode"]').textContent());
 console.log('ERRORS',errors);
 writeFileSync('qa/engine-explore-probe.json',JSON.stringify({before,rotated,moved,returned,errors},null,2));
}finally{await browser.close();}
