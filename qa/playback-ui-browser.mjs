import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const checks=[],errors=[];
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror',e=>errors.push(e.message));
const sample=()=>page.locator('#cycle-overview').evaluate(el=>({
  elements:[...el.querySelectorAll('i,.cycle-phase-sheen,.cycle-phase-tip,.cycle-phase-tip b')].map(n=>({transform:getComputedStyle(n).transform,opacity:getComputedStyle(n).opacity})),
  animations:el.getAnimations({subtree:true}).length,
}));
try{
 for(const file of ['engine.html','refrigerator.html','air-conditioner.html']){
  const engine=file==='engine.html';
  await page.goto(`http://127.0.0.1:4198/${file}?v=playback-ui`);
  await page.waitForFunction(()=>window.coolingDemo?.ready||window.thermalDemo?.ready);
  await page.evaluate(engine=>{const d=engine?thermalDemo:coolingDemo;d.finishAssembly(false);d.showLesson(false,{instant:true});if(engine)d.setAngle(205,false);else d.setProgress(.3);},engine);
  assert.equal(await page.locator('#playback-status').evaluate(e=>getComputedStyle(e).clip),'rect(0px, 0px, 0px, 0px)');
  assert.equal(await page.locator('body').innerText().then(t=>t.includes('准备就绪')),false);
  assert.ok(await page.locator('.cycle-phase').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=15);
  assert.ok((await page.locator('.cycle-phase-meter').first().boundingBox()).height>=7);
  const trigger=page.locator('.speed-trigger'),menu=page.locator('.speed-menu');
  await trigger.click();await page.waitForTimeout(180);assert.equal(await menu.isVisible(),true);
  const buttonRect=await trigger.boundingBox(),menuRect=await menu.boundingBox(),controlRect=await page.locator('.speed-control').boundingBox();
  assert.ok(Math.abs(menuRect.width-controlRect.width)<1,'speed menu matches its control width');
  assert.ok(menuRect.y+menuRect.height<buttonRect.y,'menu opens above controls');
  await trigger.click();assert.equal(await menu.isVisible(),false,'same trigger closes its menu');await trigger.click();
  await page.getByRole('menuitemradio',{name:'2×',exact:true}).click();
  assert.equal(await page.evaluate(engine=>(engine?thermalDemo:coolingDemo).state.speed,engine),2);
  assert.equal(await page.evaluate(engine=>(engine?thermalDemo:coolingDemo).state.playing,engine),false);
  assert.equal(await menu.isVisible(),false);assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  await trigger.focus();await page.keyboard.press('ArrowDown');assert.equal(await menu.isVisible(),true);
  await page.keyboard.press('Home');assert.equal(await page.locator('#speed').inputValue(),'0.5');
  await page.keyboard.press('Escape');assert.equal(await menu.isVisible(),false);
  assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);
  await page.locator('#speed').selectOption('1');assert.equal(await page.locator('.speed-current').textContent(),'1×');
  await trigger.click();const frame=page.frames().find(f=>f.parentFrame());
  await frame.locator('canvas').first().click({position:{x:8,y:100}});assert.equal(await menu.isVisible(),false);
  await page.locator('#play').click();await page.waitForTimeout(100);const moving=await sample();
  await page.waitForTimeout(220);assert.notDeepEqual(await sample(),moving,'progress highlight advances with playback');
  await page.locator('#play').click();await page.waitForTimeout(80);const paused=await sample();
  await page.waitForTimeout(220);assert.deepEqual(await sample(),paused,'progress highlight freezes while paused');
  await page.locator('#play').click();await page.waitForTimeout(80);await page.locator('#whiteboard-open').click();
  await page.waitForFunction(()=>(window.coolingDemo||window.thermalDemo).whiteboard.isOpen);
  const board=await sample();await page.waitForTimeout(220);assert.deepEqual(await sample(),board,'whiteboard freezes progress appearance');
  await page.locator('#wb-exit').click();
  if(!engine&&file==='refrigerator.html'){
   await trigger.click();await page.waitForTimeout(180);await page.screenshot({path:'qa/playback-ui-desktop.png',fullPage:true});
   await page.keyboard.press('Escape');
  }
  checks.push(`${file}: matched menu, keyboard, iframe dismissal, speed state and frozen progress`);
 }
 for(const width of [390,360]){
  await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:4198/refrigerator.html?v=playback-ui');
  await page.waitForFunction(()=>coolingDemo?.ready);await page.evaluate(()=>{coolingDemo.finishAssembly();coolingDemo.setProgress(.36);});
  await page.locator('.speed-trigger').click();await page.waitForTimeout(180);
  const bounds=await page.locator('.speed-menu').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<844);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.ok(await page.locator('.cycle-phase').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=13);
  await page.screenshot({path:`qa/playback-ui-mobile-${width}.png`,fullPage:true});
  checks.push(`${width}px: menu and larger progress fit viewport`);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>coolingDemo?.ready);
 await page.evaluate(()=>coolingDemo.setProgress(.34));await page.locator('.speed-trigger').click();
 assert.equal(await page.locator('.speed-menu').evaluate(e=>e.getAnimations().length),0);
 assert.ok(await page.locator('.cycle-phase-sheen').evaluateAll(es=>es.every(e=>getComputedStyle(e).opacity==='0')));
 checks.push('reduced motion: static progress accents and immediate menu');assert.deepEqual(errors,[]);
 writeFileSync('qa/playback-ui-results.json',JSON.stringify({checks,errors},null,2));console.log(checks.join('\n'));
}finally{await browser.close();}
