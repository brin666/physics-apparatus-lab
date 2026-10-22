import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {catalog} from '../apparatus/catalog.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4198/');await page.waitForFunction(()=>window.apparatusMap);await page.waitForTimeout(250);
 assert.equal(await page.locator('.apparatus').count(),15);assert(await page.evaluate(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)));
 for(const d of catalog){
  await page.mouse.move(10,10);await page.waitForTimeout(260);await page.evaluate(id=>window.apparatusMap.showPreview(id),d.id);await page.waitForFunction(()=>document.querySelector('#preview-loading').hidden,{timeout:25000});assert.equal(await page.locator('#hover-preview iframe').count(),1);assert.equal(await page.locator('#preview-enter').getAttribute('href'),'./'+d.url);
  await page.locator('#hover-preview').hover();await page.waitForTimeout(250);assert(await page.locator('#hover-preview').isVisible());
  await page.locator('#preview-play').click();await page.waitForTimeout(500);const playing=await page.locator('#hover-preview iframe').evaluate(f=>{const w=f.contentWindow;return (w.apparatusDemo||w.coolingDemo||w.thermalDemo).state.playing});assert.equal(playing,false,`${d.id}: preview pauses`);
  console.log(`${d.id}: preview loaded, pause and entry PASS`);await page.evaluate(()=>window.apparatusMap.closePreview());assert.equal(await page.locator('#hover-preview iframe').count(),0);
 }
 await page.locator('[data-category="fluids"]').click();assert.equal(await page.locator('.apparatus:not(.is-muted)').count(),4);await page.locator('#device-search').fill('船闸');assert.equal(await page.locator('.apparatus:not(.is-muted)').count(),1);await page.locator('#device-search').fill('');await page.locator('[data-category="all"]').click();
 await page.locator('[data-device="dc-motor"]').hover();await page.waitForTimeout(80);assert(!await page.locator('#hover-preview').isVisible());await page.waitForTimeout(500);assert(await page.locator('#hover-preview').isVisible());await page.keyboard.press('Escape');assert(!await page.locator('#hover-preview').isVisible());
 await page.screenshot({path:'qa/map-desktop.png'});assert.deepEqual(errors,[]);await page.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobile.goto('http://127.0.0.1:4198/');await mobile.locator('[data-device="engine"]').tap();await mobile.waitForFunction(()=>document.querySelector('#preview-loading').hidden);assert(await mobile.locator('#hover-preview').isVisible());assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.screenshot({path:'qa/map-mobile.png'});await mobile.locator('#preview-enter').tap();await mobile.waitForURL('**/engine.html');console.log('map: filtering, hover delay, Escape, touch preview and navigation PASS');await mobile.close();
}finally{await browser.close();}
