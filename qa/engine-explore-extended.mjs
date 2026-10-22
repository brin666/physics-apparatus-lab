import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4198/engine.html?v=explore');await page.waitForFunction(()=>window.thermalDemo?.ready);
 await page.evaluate(()=>thermalDemo.finishAssembly(false));
 await page.locator('button[data-mode="explode"]').click();await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.engineScene.exploration.phase==='open');
 await page.waitForTimeout(350);
 assert.equal(await page.locator('button[data-mode="explode"]').textContent(),'装回');
 assert.equal(await page.locator('#stage-paper svg').count()>0,true);
 await page.screenshot({path:'qa/engine-explore-desktop.png'});
 // Reverse both directions while the presentation is still travelling.
 await page.locator('#play').click();await page.waitForTimeout(180);await page.locator('button[data-mode="explode"]').click();await page.waitForTimeout(150);await page.locator('button[data-mode="cut"]').click();
 await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.engineScene.exploration.phase==='closed');await page.waitForFunction(()=>thermalDemo.state.playing);
 checks.push('mid-flight reversal returns and resumes');
 await page.evaluate(()=>{thermalDemo.setPlaying(false);thermalDemo.showView('paper');});assert.ok(await page.locator('#stage-paper svg').isVisible());checks.push('paper diagram remains intact');
 await page.evaluate(()=>thermalDemo.showView('3d'));
 await page.setViewportSize({width:390,height:844});await page.locator('button[data-mode="explode"]').click();await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.engineScene.exploration.phase==='open');await page.waitForTimeout(350);
 await page.screenshot({path:'qa/engine-explore-mobile.png',fullPage:true});
 const bounds=await page.evaluate(()=>{const s=document.querySelector('#machine').contentWindow.engineScene;const all=[];for(const m of s.hardwareMeshes){if(!m.visible)continue;m.geometry.computeBoundingBox();const b=m.geometry.boundingBox;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=m.position.clone().set(x,y,z).applyMatrix4(m.matrixWorld).project(s.lab.camera);all.push([p.x,p.y]);}}return {xmin:Math.min(...all.map(p=>p[0])),xmax:Math.max(...all.map(p=>p[0])),ymin:Math.min(...all.map(p=>p[1])),ymax:Math.max(...all.map(p=>p[1])),overflow:document.documentElement.scrollWidth>innerWidth}});
 console.log('MOBILE BOUNDS',bounds);assert.equal(bounds.overflow,false);assert.ok(bounds.xmin>=-1&&bounds.xmax<=1&&bounds.ymin>=-1&&bounds.ymax<=1,'all parts within mobile viewport');checks.push('mobile parts fit');
 const reduced=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});reduced.on('pageerror',e=>errors.push(e.message));await reduced.goto('http://127.0.0.1:4198/engine.html');await reduced.waitForFunction(()=>window.thermalDemo?.ready);assert.equal(await reduced.evaluate(()=>thermalDemo.state.playing),false);await reduced.locator('button[data-mode="explode"]').click();await reduced.waitForFunction(()=>document.querySelector('#machine').contentWindow.engineScene.exploration.phase==='open');await reduced.locator('#play').click();await reduced.waitForFunction(()=>document.querySelector('#machine').contentWindow.engineScene.exploration.phase==='closed');assert.equal(await reduced.evaluate(()=>thermalDemo.state.playing),false);checks.push('reduced motion settles without autoplay');await reduced.close();
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:4198/');await page.locator('.apparatus-engine').hover();await page.waitForFunction(()=>window.homeRoom?.previewRunning,{},{timeout:30000});await page.waitForTimeout(3000);assert.equal(await page.evaluate(()=>homeRoom.previewRunning),true);await page.mouse.move(10,10);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>homeRoom.previewRunning),false);checks.push('homepage loops on hover and stops on leave');
 assert.deepEqual(errors,[]);console.log({checks,errors});writeFileSync('qa/engine-explore-extended.json',JSON.stringify({checks,errors,bounds},null,2));
}finally{await browser.close();}
