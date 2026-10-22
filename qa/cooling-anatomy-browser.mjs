import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],checks=[];
for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:width===390?1100:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4198/qa/cooling-anatomy-preview.html');await page.waitForFunction(()=>window.ready,{timeout:60000});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`qa/cooling-anatomy-${width}-cool.png`,fullPage:true});
 await page.locator('#heat').click();await page.waitForTimeout(100);assert.equal(await page.locator('#ac .cooling-anatomy').getAttribute('data-operation'),'heat');
 await page.screenshot({path:`qa/cooling-anatomy-${width}-heat.png`,fullPage:true});
 await page.evaluate(()=>{state.mode='cut';state.selected=null;render();});
 const target=page.locator('#ac [data-cooling-part="compressor"][role="button"]');await target.focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>state.selected),'compressor');assert.equal(await target.getAttribute('aria-pressed'),'true');
 for(const mode of ['xray','assembled','explode','cut']){await page.locator(`#${mode}`).click();await page.waitForTimeout(700);assert.equal(await page.locator('#ac .cooling-anatomy').getAttribute('data-mode'),mode);}
 await page.evaluate(()=>{state.progress=.36;state.selected='indoor-coil';render();});await page.screenshot({path:`qa/cooling-anatomy-${width}-selected.png`,fullPage:true});
 checks.push(`${width}px viewport fits, cool/heat, all presentation modes and keyboard part selection`);
 await page.close();
}
assert.deepEqual(errors,[]);writeFileSync('qa/cooling-anatomy-results.json',JSON.stringify({checks,errors,date:new Date().toISOString()},null,2));await browser.close();console.log(checks.join('\n'));
