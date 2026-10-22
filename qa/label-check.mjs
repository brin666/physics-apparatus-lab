import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4198/engine.html?v=white-grid');await page.waitForFunction(()=>thermalDemo.ready);const frame=page.frames().find(f=>f.parentFrame());
 await frame.waitForFunction(()=>getComputedStyle(document.querySelector('.lab-lab')).opacity==='1');
 await page.screenshot({path:'qa/redesign-mobile.png',fullPage:true});
 await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>thermalDemo.whiteboard.isOpen&&document.querySelector('#whiteboard').getAttribute('aria-busy')!=='true');
 assert.equal(await frame.evaluate(()=>getComputedStyle(document.querySelector('.lab-lab')).opacity),'1');await page.screenshot({path:'qa/redesign-whiteboard-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);console.log('FINAL MOBILE LABEL CONTRAST AND WHITEBOARD CHECK PASSED');
}finally{await browser.close();}
