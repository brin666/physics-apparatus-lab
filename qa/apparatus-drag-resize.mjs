import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {partTarget} from './apparatus-target.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const id of ['rheostat','pulley','manometer']){
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(`http://127.0.0.1:4198/${id}.html`);await page.waitForFunction(()=>window.apparatusDemo?.state.phase==='closed');await page.evaluate(()=>window.apparatusDemo.setPlaying(false));
 const target=await partTarget(page,null,true);assert(target,`${id}: draggable experiment part reachable`);
 const before=await page.evaluate(key=>window.apparatusDemo.state.inputs[key],target.drag.control);
 await page.mouse.move(target.x,target.y);await page.mouse.down();await page.mouse.move(target.x+55,target.y+55,{steps:12});await page.mouse.up();
 const after=await page.evaluate(key=>window.apparatusDemo.state.inputs[key],target.drag.control);assert.notEqual(after,before,`${id}: direct manipulation changes the experimental input`);assert.equal(await page.evaluate(()=>window.apparatusDemo.state.playing),false);
 await page.locator('#inspector-close').click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(220);await page.screenshot({path:`qa/apparatus/${id}-mobile.png`});
 assert(await page.evaluate(()=>{const s=window.apparatusDemo.scene;return s.records.every(r=>{const {min,max}=r.box;return [min.x,max.x].every(x=>[min.y,max.y].every(y=>[min.z,max.z].every(z=>{const p=s.camera.position.clone().set(x,y,z).project(s.camera);return Math.abs(p.x)<1&&Math.abs(p.y)<1;})));});}),`${id}: model remains in frame after desktop-to-mobile resize`);
 const camera=await page.evaluate(()=>window.apparatusDemo.scene.camera.position.toArray());await page.locator('#whiteboard-open').click();await page.waitForTimeout(250);await page.evaluate(()=>window.apparatusDemo.whiteboard.close());await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>window.apparatusDemo.scene.camera.position.toArray()),camera,`${id}: board resizing preserves view`);
 console.log(`${id}: direct drag, mobile reframe, board view preservation PASS`);await page.close();
}}finally{await browser.close();}
