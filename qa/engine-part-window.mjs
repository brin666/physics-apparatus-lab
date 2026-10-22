import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4198/engine.html?v=small-part-window');await page.waitForFunction(()=>window.thermalDemo?.ready);
 await page.evaluate(()=>{thermalDemo.finishAssembly(false);thermalDemo.setMode('explode');});await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.engineScene.exploration.phase==='open');
 assert.equal(await page.locator('#part-inspector').isVisible(),false);
 const width=await page.locator('#machine').evaluate(el=>el.clientWidth);
 await page.evaluate(()=>thermalDemo.selectPart('piston'));await page.waitForTimeout(250);
 assert.equal(await page.locator('#inspector-heading').textContent(),'活塞');assert.equal(await page.locator('#inspector-function').textContent(),'承受气体作用力');
 assert.equal(await page.locator('#part-preview').count(),0);assert.equal(await page.locator('#machine').evaluate(el=>el.clientWidth),width);
 assert.ok(width>1300);await page.screenshot({path:'qa/engine-small-part-window.png'});
 await page.locator('#inspector-close').click();assert.equal(await page.locator('#part-inspector').isVisible(),false);
 await page.evaluate(()=>thermalDemo.selectPart('flywheel'));assert.equal(await page.locator('#inspector-heading').textContent(),'飞轮');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:'qa/engine-small-part-window-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#play').click();await page.waitForFunction(()=>thermalDemo.state.playing);assert.equal(await page.locator('#part-inspector').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS compact text window, full-width model, close/reselect, mobile, assembly. No browser errors.');
}finally{await browser.close();}
