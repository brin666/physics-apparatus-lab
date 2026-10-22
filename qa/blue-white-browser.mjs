import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const sample=()=>page.locator('#assembly-steps').evaluate(e=>[...e.querySelectorAll('i,.cycle-phase-sheen,.cycle-phase-tip,.cycle-phase-tip b')].map(n=>({transform:getComputedStyle(n).transform,opacity:getComputedStyle(n).opacity})));
const isBlue=color=>{const [r,g,b]=color.match(/[\d.]+/g).slice(0,3).map(Number);return b>r&&b>g;};
try{
 for(const [file,engine,count] of [['engine.html',true,8],['refrigerator.html',false,5],['air-conditioner.html',false,5]]){
  const kind=engine?'engine':file==='refrigerator.html'?'fridge':'ac';
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`http://127.0.0.1:4198/${file}?v=blue-white`);await page.waitForFunction(()=>window.coolingDemo?.ready||window.thermalDemo?.ready);
  const before=await sample();await page.waitForTimeout(120);assert.notDeepEqual(await sample(),before,'assembly meters advance with intro');
  await page.locator('#play').click();const paused=await sample();await page.waitForTimeout(120);assert.deepEqual(await sample(),paused,'assembly meters freeze on pause');
  assert.equal(await page.locator('#assembly-steps .cycle-phase-meter').count(),count);
  assert.ok(await page.locator('#assembly-steps .cycle-phase-meter').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height===8)));
  const primary=await page.locator('#play').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,ink:getComputedStyle(e).color}));
  assert.ok(isBlue(primary.bg));assert.equal(primary.ink,'rgb(255, 255, 255)');
  const selected=await page.locator('.machine-nav [aria-current=page]').evaluate(e=>getComputedStyle(e).backgroundColor);assert.ok(isBlue(selected));
  await page.locator('[data-assembly-step="2"]').click();assert.equal(await page.locator('[data-assembly-step="2"]').getAttribute('aria-current'),'step');
  await page.screenshot({path:`qa/blue-white-${kind}-assembly-desktop.png`,fullPage:true});
  await page.locator('[data-assembly-step="0"]').click();assert.equal(await page.locator('[data-assembly-step="0"]').getAttribute('aria-current'),'step');
  assert.equal(await page.locator('[data-assembly-step="2"] i').evaluate(e=>getComputedStyle(e).transform),'matrix(0, 0, 0, 1, 0, 0)');
  await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>(window.coolingDemo||window.thermalDemo).whiteboard.isOpen);
  const board=await sample();await page.waitForTimeout(120);assert.deepEqual(await sample(),board,'whiteboard retains assembly meter pose');await page.locator('#wb-exit').click();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`qa/blue-white-${kind}-assembly-mobile.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.ok(await page.locator('.assembly-step-label').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)),'assembly labels fit mobile segments');
  await page.setViewportSize({width:360,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.ok(await page.locator('.assembly-step-label').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)));
  await page.locator(`[data-assembly-step="${count-1}"]`).click();await page.locator('#assembly-next').click();
  assert.equal(await page.locator('#assembly-controls').isVisible(),false);assert.equal(await page.locator('#cycle-overview').isVisible(),true);
  assert.equal(await page.locator('.cycle-phase[aria-current=step]').count(),1,'completed assembly no longer marks a hidden current step');
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(engine=>{const d=engine?thermalDemo:coolingDemo;if(engine)d.setAngle(235,false);else d.setProgress(.36);},engine);
  await page.locator('.speed-trigger').click();await page.waitForTimeout(180);
  const menuColor=await page.locator('.speed-option[aria-checked=true]').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,ink:getComputedStyle(e).color}));
  assert.ok(isBlue(menuColor.bg)&&isBlue(menuColor.ink));
  await page.screenshot({path:`qa/blue-white-${kind}-cycle-desktop.png`,fullPage:true});await page.keyboard.press('Escape');
  checks.push(`${file}: blue controls/menu, ${count} assembly meters, pause/reverse/whiteboard, 360/390px and cycle handoff`);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>coolingDemo?.ready);
 await page.evaluate(()=>{coolingDemo.startAssembly();coolingDemo.seekAssembly(2.5);});
 const reduced=await sample();await page.waitForTimeout(150);assert.deepEqual(await sample(),reduced);
 assert.ok(await page.locator('#assembly-steps .cycle-phase-sheen').evaluateAll(es=>es.every(e=>getComputedStyle(e).opacity==='0')));
 checks.push('reduced motion: manual assembly steps keep static accents');assert.deepEqual(errors,[]);
 writeFileSync('qa/blue-white-results.json',JSON.stringify({checks,errors},null,2));console.log(checks.join('\n'));
}finally{await browser.close();}
