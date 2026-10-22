import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const round=process.argv[2]||'1';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
for(const kind of ['fridge','ac']){
 await page.goto(`http://127.0.0.1:4198/refrigeration-machine.html?machine=${kind}`);
 await page.waitForFunction(()=>window.coolingScene);
 await page.evaluate(()=>coolingScene.update({assembly:{active:false,time:5},playing:false,progress:.35,selected:null,reduced:true}));
 for(const mode of ['assembled','cut','explode','xray']){
  await page.evaluate(mode=>{coolingScene.update({mode});coolingScene.settleView({presentation:true});},mode);
  await page.waitForTimeout(180);
  await page.screenshot({path:`qa/cooling-scene-r${round}-${kind}-${mode}.png`});
 }
 await page.evaluate(()=>{coolingScene.update({mode:'cut',selected:null});coolingScene.settleView({presentation:true});});
 if(kind==='fridge'){
  await page.evaluate(()=>coolingScene.lab.setView({az:155,el:9,dist:1.65,target:[0,.94,-.16]}));
  await page.screenshot({path:`qa/cooling-scene-r${round}-fridge-rear.png`});
  await page.evaluate(()=>coolingScene.lab.setView({az:35,el:12,dist:.93,target:[.10,.42,-.20]}));
 }else{
  await page.evaluate(()=>{coolingScene.update({operation:'heat'});coolingScene.lab.setView({az:13,el:10,dist:2.10,target:[.02,.91,0]});});
  await page.screenshot({path:`qa/cooling-scene-r${round}-ac-heat.png`});
  await page.evaluate(()=>coolingScene.lab.setView({az:12,el:13,dist:.93,target:[.82,.42,-.03]}));
 }
 await page.waitForTimeout(100);
 await page.screenshot({path:`qa/cooling-scene-r${round}-${kind}-joint.png`});
 if(kind==='ac'){
  await page.evaluate(()=>coolingScene.lab.setView({az:13,el:12,dist:.92,target:[-.6,1.57,.005]}));
  await page.waitForTimeout(100);await page.screenshot({path:`qa/cooling-scene-r${round}-ac-indoor-joint.png`});
 }
 console.log(kind,JSON.stringify(await page.evaluate(()=>({stats:coolingScene.geometryStats,routes:coolingScene.flowRoutes.length,kind:coolingScene.kind}))));
}
for(const width of [390,360])for(const kind of ['fridge','ac']){
 await page.setViewportSize({width,height:500});
 await page.goto(`http://127.0.0.1:4198/refrigeration-machine.html?machine=${kind}`);await page.waitForFunction(()=>window.coolingScene);
 await page.evaluate(()=>coolingScene.update({assembly:{active:false,time:5},playing:false,progress:.35,selected:null,reduced:true}));
 for(const mode of ['assembled','cut','explode']){
  await page.evaluate(mode=>{coolingScene.update({mode});coolingScene.settleView({presentation:true});},mode);await page.waitForTimeout(100);
  await page.screenshot({path:`qa/cooling-scene-r${round}-${kind}-${width}-${mode}.png`});
 }
}
console.log('errors',JSON.stringify(errors));
writeFileSync(`qa/cooling-scene-r${round}-results.json`,JSON.stringify({errors},null,2));
await browser.close();
