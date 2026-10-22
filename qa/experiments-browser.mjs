import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),checks=[],errors=[];
page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
const demo=fn=>page.evaluate(fn),frame=()=>page.frames().find(f=>f.parentFrame());
const pose=()=>frame().evaluate(()=>{const s=experimentScene;return {progress:s.state.progress,model:s.compute(s.state),meshes:s.meshes.filter(m=>m.visible).map(m=>[m.name,m.position.toArray(),m.rotation.toArray(),m.scale.toArray()])};});
const settle=()=>frame().evaluate(()=>experimentScene.settleView({presentation:true}));
try{
 for(const [kind,file]of [['joule','joule.html'],['gas','gas-state.html']]){
  await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:4198/engine.html'+file);await page.waitForFunction(()=>window.experimentDemo?.ready);
  assert.equal(await page.locator('.machine-nav a').count(),5);assert.equal(await page.locator('.machine-nav [aria-current=page]').count(),1);
  await demo(()=>{experimentDemo.seekAssembly(1.4);});await page.waitForTimeout(80);const intro=await pose();await page.waitForTimeout(120);assert.deepEqual(await pose(),intro,'paused intro pose');
  await page.screenshot({path:`qa/${kind}-assembly-desktop.png`,fullPage:true});
  const early=await frame().evaluate(()=>experimentScene.meshes.filter(m=>m.userData.cutHide).map(m=>m.visible));assert.ok(early.every(v=>!v),'front cover waits until the end');
  await page.locator('[data-assembly="0"]').click();assert.equal(await page.locator('[data-assembly="0"]').getAttribute('aria-current'),'step');
  await demo(()=>experimentDemo.finishAssembly());await settle();assert.equal(await page.locator('#assembly-controls').isVisible(),false);assert.equal(await page.locator('#cycle-overview').isVisible(),true);
  await page.locator('#play').click();await page.waitForTimeout(200);assert.ok(await demo(()=>experimentDemo.state.progress>0));await page.locator('#play').click();await page.waitForTimeout(50);const paused=await pose();await page.waitForTimeout(150);assert.deepEqual(await pose(),paused,'playback pause freezes all machinery');
  await demo(()=>experimentDemo.setProgress(.38));await page.waitForTimeout(50);const first=await pose();await demo(()=>experimentDemo.setProgress(.8));await page.waitForTimeout(50);await demo(()=>experimentDemo.setProgress(.38));await page.waitForTimeout(50);assert.deepEqual(await pose(),first,'reverse scrubbing is deterministic');
  await page.locator('.speed-trigger').click();await page.locator('.speed-option[data-option-index="2"]').click();assert.equal(await demo(()=>experimentDemo.state.speed),2);
  await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>experimentDemo.whiteboard.isOpen);await page.waitForTimeout(100);const board=await pose();await page.waitForTimeout(160);assert.deepEqual(await pose(),board,'whiteboard freezes motion');await page.locator('#wb-exit').click();
  await page.locator('#lesson-toggle').click();await page.waitForTimeout(280);assert.equal(await page.locator('#lesson-panel').isVisible(),true);
  await page.locator('[data-section="structure"]').click();await page.locator('[data-part]').nth(2).click();assert.ok(await page.locator('[data-part]').nth(2).getAttribute('aria-pressed')==='true');
  await page.locator('[data-view="paper"]').click();assert.equal(await page.locator('#stage-paper').isVisible(),true);assert.ok(await page.locator('[data-paper-part]').count()>5);await page.screenshot({path:`qa/${kind}-paper.png`,fullPage:true});await page.locator('[data-view="3d"]').click();
  await page.locator('[data-section="experiment"]').click();const input=page.locator('[data-input]').first();await input.evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},kind==='gas'?'320':'2');assert.equal(await demo(()=>experimentDemo.state.progress),0);await page.locator('#lesson-close').click();await page.waitForTimeout(270);
  if(kind==='gas'){
   await page.locator('#plot-toggle').click();assert.equal(await page.locator('#plot-panel').isVisible(),true);
   for(const operation of ['isothermal','isobaric','isochoric']){await page.locator(`[data-operation="${operation}"]`).click();await demo(()=>experimentDemo.setProgress(.6));await page.waitForTimeout(70);assert.ok(await page.locator('#experiment-plot .curve').getAttribute('d'));await page.screenshot({path:`qa/gas-${operation}.png`,fullPage:true});}
   await page.locator('#plot-close').click();
  }
  await demo(()=>experimentDemo.setProgress(.46));
  for(const mode of ['assembled','cut','explode','xray']){await page.locator(`button[data-mode="${mode}"]`).click();await settle();await page.waitForTimeout(100);const finite=await frame().evaluate(()=>experimentScene.meshes.every(m=>[...m.position.toArray(),...m.scale.toArray()].every(Number.isFinite)));assert.ok(finite);await page.screenshot({path:`qa/${kind}-${mode}-desktop.png`,fullPage:true});}
  await page.locator('button[data-mode="cut"]').click();await settle();
  if(kind==='joule'){await page.locator('#mechanism-focus').click();await settle();assert.equal(await frame().evaluate(()=>experimentScene.getView().focused),true);assert.equal(await demo(()=>experimentDemo.state.selected),'stirrer');}
  else{await page.locator('#lesson-toggle').click();await page.waitForTimeout(270);await page.locator('[data-section="structure"]').click();await page.locator('#part-focus').click();await settle();assert.equal(await frame().evaluate(()=>experimentScene.getView().focused),true);}
  await page.waitForTimeout(100);await page.screenshot({path:`qa/${kind}-mechanism-close.png`,fullPage:true});await page.locator('[data-camera="reset"]').click();await settle();
  for(const width of [390,360]){await page.setViewportSize({width,height:844});await page.waitForTimeout(130);assert.equal(await demo(()=>document.documentElement.scrollWidth>innerWidth),false,`no horizontal overflow at ${width}`);await page.screenshot({path:`qa/${kind}-mobile-${width}.png`,fullPage:true});}
  await demo(()=>{experimentDemo.state.progress=.999;experimentDemo.state.speed=2;experimentDemo.setPlaying(true);});await page.waitForTimeout(180);assert.equal(await demo(()=>experimentDemo.state.progress),1);assert.equal(await demo(()=>experimentDemo.state.playing),false);
  checks.push(`${kind}: assembly, covers last, actual play/pause, scrub, speed, whiteboard, parts, paper, inputs, all modes, mobile, finite completion`);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.experimentDemo?.ready);assert.equal(await demo(()=>experimentDemo.state.assembly.active),false);await demo(()=>experimentDemo.startAssembly());const p=await demo(()=>experimentDemo.state.assembly.time);await page.waitForTimeout(120);assert.equal(await demo(()=>experimentDemo.state.assembly.time),p);checks.push('reduced motion opens complete, replay waits for manual steps');
 await page.context().setOffline(true);await page.goto('file:///D:/daily/thermal-machines/joule.html');await page.waitForFunction(()=>window.experimentDemo?.ready);assert.equal(await demo(()=>experimentDemo.experiment.id),'joule');await page.context().setOffline(false);checks.push('self-contained file opens offline');
 assert.deepEqual(errors,[]);writeFileSync('qa/experiments-results.json',JSON.stringify({checks,errors},null,2));console.log(checks.join('\n'));
}finally{await browser.close();}
