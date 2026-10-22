import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto('http://127.0.0.1:4198/engine.html');await page.waitForFunction(()=>thermalDemo.ready);await page.waitForTimeout(800);const frame=page.frames().find(f=>f.parentFrame());
 for(const variant of ['baseline','no-contact','no-ao','tone-mapped-contact','normal-no-background','normal-output']){
  await frame.evaluate(variant=>{const {lab}=engineScene;lab._contact.plane.visible=variant!=='no-contact';lab.ao.enabled=variant!=='no-ao';lab._contact.plane.material.toneMapped=variant==='tone-mapped-contact';lab._contact.plane.material.needsUpdate=true;},variant);
  if(variant==='normal-no-background')await frame.evaluate(()=>{const {lab}=engineScene,original=lab.ao.renderOverride.bind(lab.ao);lab.ao.renderOverride=(...args)=>{const bg=lab.scene.background;lab.scene.background=null;try{return original(...args);}finally{lab.scene.background=bg;}};});
  if(variant==='normal-output')await frame.evaluate(()=>{engineScene.lab.ao.output=engineScene.lab.ao.constructor.OUTPUT.Normal;});
  await page.waitForTimeout(200);await page.locator('.visual-stage').screenshot({path:`qa/grid-${variant}.png`});
 }
 console.log(await frame.evaluate(()=>({contact:{width:engineScene.lab._contact.plane.geometry.parameters.width,height:engineScene.lab._contact.plane.geometry.parameters.height,toneMapped:engineScene.lab._contact.plane.material.toneMapped,layers:engineScene.lab._contact.plane.layers.mask},aoEnabled:engineScene.lab.ao.enabled})));
}finally{await browser.close();}
