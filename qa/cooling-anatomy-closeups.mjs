import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:4});
await page.goto('http://127.0.0.1:4198/qa/cooling-anatomy-preview.html');await page.waitForFunction(()=>window.ready);
for(const kind of ['fridge','ac']) await page.locator('#'+kind).screenshot({path:'qa/cooling-anatomy-'+kind+'-4x.png'});
await page.locator('#explode').click();await page.waitForTimeout(750);
for(const kind of ['fridge','ac']) await page.locator('#'+kind).screenshot({path:'qa/cooling-anatomy-'+kind+'-apart-4x.png'});
await browser.close();
