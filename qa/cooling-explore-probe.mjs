import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror',e=>console.log('ERROR',e.message));
for(const [file,id] of [['refrigerator','compressor'],['air-conditioner','fan']]){
 await page.goto('http://127.0.0.1:4198/'+file+'.html');
 await page.waitForFunction(()=>window.coolingDemo?.ready);
 await page.waitForFunction(()=>!coolingDemo.state.assembly.active);
 console.log(file,await page.evaluate(()=>({playing:coolingDemo.state.playing,mode:coolingDemo.state.mode})));
 await page.screenshot({path:'qa/new-'+file+'-running.png'});
 await page.locator('button[data-mode=explode]').click();
 await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.coolingScene.exploration.phase==='open');
 await page.waitForTimeout(350);
 await page.screenshot({path:'qa/new-'+file+'-explode.png'});
 console.log('exploded',await page.evaluate(()=>({label:document.querySelector('#play').textContent,phase:document.querySelector('#machine').contentWindow.coolingScene.exploration.phase})));
}
await browser.close();
