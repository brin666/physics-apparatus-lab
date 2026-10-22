import {chromium} from 'playwright';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {ROOT,BASE,prepareFolders} from './media-export-shared.mjs';

await prepareFolders();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:{width:540,height:720},deviceScaleFactor:2,reducedMotion:'reduce'});
const page=await context.newPage(),errors=[],shots=[];
page.on('pageerror',error=>errors.push(error.message));
async function save(file,title){
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(180);
  const path=join(ROOT,'screenshots',file);
  await page.screenshot({path,animations:'disabled'});
  shots.push({file,title,width:1080,height:1440,path});
  console.log(`Captured ${file}`);
}
async function device(file,kind,{mode,angle,progress}={}){
  await page.goto(BASE+file);
  await page.waitForFunction(()=>window.thermalDemo?.ready||window.coolingDemo?.ready||window.experimentDemo?.ready);
  await page.evaluate(({kind,mode,angle,progress})=>{
    const d=window.thermalDemo||window.coolingDemo||window.experimentDemo;
    d.finishAssembly(false);d.setPlaying(false);d.showLesson(false,{instant:true});
    d.state.selected=kind==='engine'?'piston':null;
    d.state.labels=kind==='engine';
    if(mode)d.setMode(mode);
    if(angle!==undefined)d.setAngle(angle,false);
    if(progress!==undefined)d.setProgress(progress);
  },{kind,mode,angle,progress});
  await page.waitForTimeout(160);
  await page.evaluate(()=>{
    const w=document.getElementById('machine').contentWindow;
    const s=w.engineScene||w.coolingScene||w.experimentScene;
    const d=window.thermalDemo||window.coolingDemo||window.experimentDemo;
    s.update({...d.state});s.settleView({presentation:true});
    s.lab.renderer.setPixelRatio(2);s.lab.composer.setPixelRatio(2);s.lab._resize();
  });
}
try{
  await page.goto(BASE);await page.waitForFunction(()=>window.homeRoom);
  await page.locator('.apparatus img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  await save('01-home.png','物理器械室首页');
  await device('engine.html','engine',{mode:'cut',angle:410});
  await save('02-engine-cut.png','汽油机：做功冲程与内部构造');
  await page.evaluate(()=>{thermalDemo.state.selected=null;thermalDemo.state.labels=false;thermalDemo.setMode('explode');});
  await page.waitForTimeout(160);
  await page.evaluate(()=>{const s=document.getElementById('machine').contentWindow.engineScene;s.select(null);s.settleView({presentation:true});});
  await save('03-engine-exploded.png','汽油机：总成拆解');
  await device('refrigerator.html','fridge',{mode:'xray',progress:.60});
  await save('04-fridge-xray.png','电冰箱：制冷循环与管路');
  await device('air-conditioner.html','ac',{mode:'xray',progress:.32});
  await save('05-ac-xray.png','空调：室内外机与制冷管路');
  await device('joule.html','joule',{mode:'cut',progress:.47});
  await save('06-joule-cut.png','焦耳实验：重物做功与搅拌机构');
  await device('gas-state.html','gas',{mode:'assembled',progress:.62});
  await save('07-gas-state.png','气体实验台：等温压缩');
  await page.locator('#plot-toggle').click();
  await save('08-gas-pv.png','气体实验台：状态轨迹');
  if(errors.length)throw new Error(errors.join('\n'));
  await writeFile(join(ROOT,'screenshots-capture.json'),JSON.stringify({viewport:{width:540,height:720},deviceScaleFactor:2,shots,errors},null,2));
}finally{await context.close();await browser.close();}
