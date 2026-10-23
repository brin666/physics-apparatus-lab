import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:4198/dc-motor.html');
 await page.waitForFunction(()=>window.apparatusDemo?.state.phase==='closed');
 await page.locator('#play').click();
 const time=await page.evaluate(()=>window.apparatusDemo.state.t);
 assert.equal(await page.locator('[data-mode="cut"]').textContent(),'剖切');
 await page.locator('[data-mode="cut"]').click();await page.waitForTimeout(1500);
 assert.equal(await page.evaluate(()=>window.apparatusDemo.state.t),time);
 assert(await page.evaluate(()=>{const s=window.apparatusDemo.scene;return s.camera.isOrthographicCamera&&!s.orbit.enableRotate;}));
 assert(await page.evaluate(()=>{const s=window.apparatusDemo.scene,direction=s.orbit.target.clone().sub(s.camera.position).normalize();return direction.z<-.999&&s.model.root.getObjectByName('motor-section-diagram').visible&&s.records.filter(r=>!['motor-poles','motor-force'].includes(r.id)).every(r=>!r.object.visible);}), 'section isolates magnets and enlarged active conductors');
 assert(await page.locator('#section-legend').isVisible());
 const phases=await page.evaluate(()=>{const d=window.apparatusDemo,root=d.scene.model.root;const results=[0,Math.PI,Math.PI/2].map(phase=>{d.scene.model.update(0,{...d.state.inputs,_phaseOffset:phase});return [1,-1].map(sign=>{const g=root.getObjectByName(`motor-section-${sign}`),f=root.getObjectByName(`motor-section-force-${sign}`);return {sign,dot:root.getObjectByName(`motor-section-dot-${sign}`).visible,cross:root.getObjectByName(`motor-section-cross-${sign}`).visible,force:f.visible,current:g.userData.currentDirection,forceDirection:f.userData.forceDirection,distance:f.position.distanceTo(g.position)};});});d.scene.model.update(d.state.t,d.state.inputs);return results;});
 for(const row of phases[0]){assert.equal(row.dot,row.sign===1);assert.equal(row.cross,row.sign===-1);assert.equal(row.forceDirection,row.current);assert(Math.abs(row.distance-.038)<1e-8);}
 for(const row of phases[1]){assert.equal(row.dot,row.sign===-1);assert.equal(row.cross,row.sign===1);assert.equal(row.forceDirection,row.current);}
 assert(phases[2].every(row=>!row.dot&&!row.cross&&!row.force),'commutator gap hides current and force');
 const camera=await page.evaluate(()=>window.apparatusDemo.scene.camera.position.toArray());
 await page.mouse.move(950,400);await page.mouse.down();await page.mouse.move(1010,450,{steps:8});await page.mouse.up();
 assert.deepEqual(await page.evaluate(()=>window.apparatusDemo.scene.camera.position.toArray()),camera,'flat view cannot orbit');
 const zoom=await page.evaluate(()=>window.apparatusDemo.scene.camera.zoom);
 await page.locator('[data-view="zoom-in"]').click();assert(await page.evaluate(z=>window.apparatusDemo.scene.camera.zoom>z,zoom));
 const saved=await page.evaluate(()=>window.apparatusDemo.scene.snapshot());
 await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>window.apparatusDemo.whiteboard.isOpen);
 await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.apparatusDemo.state.t),time);
 await page.evaluate(()=>window.apparatusDemo.whiteboard.close());
 await page.locator('[data-mode="xray"]').click();await page.waitForTimeout(1500);
 const focus=await page.evaluate(()=>{const s=window.apparatusDemo.scene;return {base:s.records.find(r=>r.id==='motor-base').materials[0].mat.opacity,winding:s.model.root.getObjectByName('motor-winding').material.opacity,red:s.model.root.getObjectByName('motor-start-lead').material.opacity,rotate:s.orbit.enableRotate};});
 assert(focus.base<.11);assert(focus.winding>.999);assert(focus.red>.999);assert(focus.rotate);
 await page.screenshot({path:'qa/motor-view-xray.png'});
 await page.evaluate(saved=>window.apparatusDemo.scene.restore(saved),saved);await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>window.apparatusDemo.scene.camera.zoom),saved.cameraZoom);
 assert.equal(await page.evaluate(()=>window.apparatusDemo.scene.orbit.enableRotate),false);
 await page.screenshot({path:'qa/motor-view-cut.png'});
 await page.locator('[data-mode="assembled"]').click();await page.waitForTimeout(1500);
 assert(await page.evaluate(()=>window.apparatusDemo.scene.records.every(r=>r.materials.every(m=>Math.abs(m.mat.opacity-m.opacity)<.001&&(!m.color||['r','g','b'].every(c=>Math.abs(m.mat.color[c]-m.color[c])<.001))))));
 assert.equal(await page.evaluate(()=>window.apparatusDemo.state.t),time);
 await page.locator('[data-mode="cut"]').click();await page.waitForTimeout(1500);await page.locator('#play').click();await page.waitForTimeout(200);
 assert(await page.evaluate(t=>window.apparatusDemo.state.t>t,time),'flat mode still runs');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'qa/motor-view-flat-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: enlarged conductor sections, current dots/crosses and Lorentz-force directions, locked orbit, zoom, live playback, focus materials, phase continuity, board/snapshot restore, mobile and shader compilation');
} finally {await browser.close();}
