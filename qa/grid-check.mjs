import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4198/engine.html?v=grid-fix');await page.waitForFunction(()=>thermalDemo.ready);const frame=page.frames().find(f=>f.parentFrame());await page.waitForTimeout(500);
 assert.equal(await frame.evaluate(()=>engineScene.lab.ao.enabled),true);assert.equal(await frame.evaluate(()=>engineScene.lab._contact.plane.visible),true);
 await page.locator('.visual-stage').screenshot({path:'qa/grid-fixed.png'});
 await frame.evaluate(()=>engineScene.lab.ao.enabled=false);await page.waitForTimeout(100);await page.locator('.visual-stage').screenshot({path:'qa/grid-reference.png'});
 await frame.evaluate(()=>engineScene.lab.ao.enabled=true);
 for(const mode of ['explode','xray','cut']){await page.locator(`[data-mode="${mode}"]`).click();await page.waitForTimeout(200);}
 await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>thermalDemo.whiteboard.isOpen&&document.querySelector('#whiteboard').getAttribute('aria-busy')!=='true');await page.waitForTimeout(200);await page.screenshot({path:'qa/grid-fixed-whiteboard.png'});await page.locator('#wb-exit').click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await page.screenshot({path:'qa/grid-fixed-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('GRID FIX: AO and contact shadow retained; modes, whiteboard, mobile render without errors');
}finally{await browser.close();}
