import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {catalog} from '../apparatus/catalog.mjs';
import {partTarget} from './apparatus-target.mjs';
await mkdir('qa/apparatus',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
const requested=new Set(process.argv.slice(2));
try{for(const d of catalog.slice(3).filter(d=>!requested.size||requested.has(d.id))){
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:4198/${d.url}`);await page.waitForFunction(()=>window.apparatusDemo?.ready);await page.waitForFunction(()=>window.apparatusDemo.state.phase==='closed');
 assert.equal(await page.evaluate(()=>window.apparatusDemo.state.selected),null);assert(await page.evaluate(()=>window.apparatusDemo.state.playing));
 await page.locator('#play').click();const paused=await page.evaluate(()=>window.apparatusDemo.state.t);await page.waitForTimeout(130);assert.equal(await page.evaluate(()=>window.apparatusDemo.state.t),paused);
 // Exercise real input controls across their ranges, then restore authored defaults.
 await page.locator('#variables-toggle').click();const controls=await page.evaluate(()=>window.apparatusDemo.definition.controls);
 for(const c of controls){const values=c.options?c.options.map(o=>o.value):[c.min,c.max,c.value];for(const value of values){await page.locator(`#input-${c.id}`).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},value);assert.equal(String(await page.evaluate(id=>window.apparatusDemo.state.inputs[id],c.id)),String(value));}await page.evaluate(c=>window.apparatusDemo.setInput(c.id,c.value),c);}
 await page.locator('#variables-close').click();await page.locator('[data-mode="explode"]').click();await page.waitForFunction(()=>window.apparatusDemo.state.phase==='open');await page.waitForTimeout(200);
 // Find an actual visible mesh hit, independent of author geometry names.
 const hit=await page.evaluate(()=>{const s=window.apparatusDemo.scene,canvas=s.renderer.domElement,r=canvas.getBoundingClientRect();for(const record of s.records){let found=null;record.object.traverse(o=>{if(found||!o.isMesh||o.userData.nonPickable||!o.visible)return;const p=o.getWorldPosition(s.camera.position.clone()).project(s.camera);const x=r.left+(p.x+1)*r.width/2,y=r.top+(1-p.y)*r.height/2;if(x>r.left+270&&x<r.right-25&&y>r.top+130&&y<r.bottom-120)found={x,y,id:record.id};});if(found)return found;}return null;});
 assert(hit,`${d.id}: no mesh target`);await page.mouse.click(hit.x,hit.y);await page.waitForTimeout(100);
 // Some meshes' centers are holes: keyboard-accessible part list is the alternate selection path.
 if(!await page.locator('#part-inspector').isVisible()){await page.locator('#lesson-toggle').click();await page.locator(`[data-part="${hit.id}"]`).click();}
 assert(await page.locator('#part-inspector').isVisible());
 await page.locator('#inspector-close').click();assert.equal(await page.evaluate(()=>window.apparatusDemo.state.selected),null);
 const target=await partTarget(page);assert(target,`${d.id}: real triangle target`);
 const pose=()=>page.evaluate(id=>{const s=window.apparatusDemo.scene,r=s.records.find(r=>r.id===id);return {p:r.pivot.position.toArray(),q:r.pivot.quaternion.toArray(),camera:s.camera.position.toArray()};},target.id);
 const initialPose=await pose();await page.mouse.move(target.x,target.y);await page.mouse.down();await page.mouse.move(target.x+35,target.y+20,{steps:8});await page.mouse.up();const rotated=await pose();assert.notDeepEqual(rotated.q,initialPose.q,`${d.id}: individual rotation`);assert.deepEqual(rotated.camera,initialPose.camera);
 await page.locator('#inspector-close').click();await page.locator('[data-tool="move"]').click();const moveTarget=await partTarget(page,target.id);assert(moveTarget);await page.mouse.move(moveTarget.x,moveTarget.y);await page.mouse.down();await page.mouse.move(moveTarget.x+30,moveTarget.y-18,{steps:8});await page.mouse.up();assert.notDeepEqual((await pose()).p,rotated.p,`${d.id}: individual translation`);assert.deepEqual((await pose()).camera,rotated.camera);
 await page.locator('#inspector-close').click();
 // Freeze pose/time when board opens, including exploded placement.
 const before=await page.evaluate(()=>window.apparatusDemo.scene.snapshot());await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>window.apparatusDemo.whiteboard.isOpen);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.apparatusDemo.state.t),before.t);
 await page.evaluate(()=>window.apparatusDemo.whiteboard.close());await page.waitForFunction(()=>!window.apparatusDemo.whiteboard.isOpen);
 await page.locator('[data-mode="explode"]').click();await page.waitForFunction(()=>window.apparatusDemo.state.phase==='closed');assert(await page.evaluate(()=>window.apparatusDemo.state.playing));
 const rests=await page.evaluate(()=>window.apparatusDemo.scene.records.every(r=>r.pivot.position.distanceTo(r.position)<1e-7&&r.pivot.quaternion.angleTo(r.fromQ.clone().identity())<1e-6));assert(rests);
 await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>window.apparatusDemo.whiteboard.isOpen);const frozenTime=await page.evaluate(()=>window.apparatusDemo.state.t);await page.waitForTimeout(160);assert.equal(await page.evaluate(()=>window.apparatusDemo.state.t),frozenTime);await page.evaluate(()=>window.apparatusDemo.whiteboard.close());await page.waitForTimeout(160);assert(await page.evaluate(t=>window.apparatusDemo.state.playing&&window.apparatusDemo.state.t>t,frozenTime),`${d.id}: whiteboard resumes prior playback`);
 await page.locator('#speed').selectOption('2');assert.equal(await page.evaluate(()=>window.apparatusDemo.state.speed),2);
 for(const mode of ['cut','xray','assembled']){await page.locator(`[data-mode="${mode}"]`).click();await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>window.apparatusDemo.state.mode),mode);}
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${d.id} mobile overflow`);await page.screenshot({path:`qa/apparatus/${d.id}-mobile.png`});
 assert.deepEqual(errors,[],`${d.id} browser errors`);results.push({id:d.id,pass:true,controls:controls.length});console.log(`${d.id}: intro, inputs, pause, assembly, modes, selection, board, mobile PASS`);await page.close();
}}finally{await browser.close();await writeFile(`qa/apparatus/browser-results${requested.size?'-'+[...requested].join('-'):''}.json`,JSON.stringify(results,null,2));}
