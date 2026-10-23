import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.webglRequests=0;const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(/webgl/.test(type))window.webglRequests++;return original.call(this,type,...args);};});
 await page.goto('http://127.0.0.1:4198/dist/index.html');
 await page.evaluate(async()=>{const ids=window.apparatusMap.catalog.map(d=>d.id);for(let i=0;i<45;i++){window.apparatusMap.showPreview(ids[i%ids.length]);await new Promise(r=>setTimeout(r,35));}});
 await page.waitForFunction(()=>document.querySelector('#preview-loading').hidden);
 assert.equal(await page.locator('video').count(),1);assert.equal(await page.locator('iframe,canvas').count(),0);assert.equal(await page.evaluate(()=>window.webglRequests),0);
 const active=await page.locator('video').elementHandle();await page.evaluate(()=>window.apparatusMap.closePreview());assert(await active.evaluate(v=>v.paused&&!v.hasAttribute('src')));
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.apparatusMap.showPreview('engine'));await page.waitForFunction(()=>document.querySelector('#preview-loading').hidden);assert(await page.locator('video').evaluate(v=>v.paused));
 await page.evaluate(()=>window.apparatusMap.closePreview());await page.route('**/assets/previews/ac.webm*',r=>r.abort());await page.evaluate(()=>window.apparatusMap.showPreview('ac'));await page.waitForFunction(()=>document.querySelector('#preview-loading').textContent.includes('暂时'));assert(await page.locator('#preview-enter').isVisible());assert.deepEqual(errors,[]);
 console.log('PASS: staged relative video URLs; 45 rapid switches; zero WebGL/iframes; playback resource release; reduced motion; load-failure fallback');
}finally{await browser.close();}
