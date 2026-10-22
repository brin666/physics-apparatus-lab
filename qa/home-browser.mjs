import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const base='http://127.0.0.1:4198/';
const decode=()=>page.locator('.apparatus img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));
try{
 await page.goto(base);await decode();await page.waitForFunction(()=>window.homeRoom&&!window.homeRoom.arriving);
 assert.equal(await page.title(),'物理器械室');assert.equal(await page.locator('h1').textContent(),'物理器械室');
 assert.equal(await page.locator('.apparatus').count(),3);assert.equal(await page.locator('canvas').count(),0,'the home itself has no heavy model canvas');
 assert.ok(await page.locator('iframe').count()<=1,'only the engine can create an on-demand preview');
 assert.ok(await page.locator('.apparatus img').evaluateAll(es=>es.every(e=>e.complete&&e.naturalWidth===700&&e.naturalHeight===840)));
 const centers=await page.locator('.apparatus-name').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return b.y+b.height/2;}));
 assert.ok(centers[0]<centers[1]&&centers[1]>centers[2],'three instruments trace the requested arc');
 await page.screenshot({path:'qa/home-desktop.png',fullPage:true});
 await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('href'),'./refrigerator.html');
 assert.equal(await page.locator(':focus').evaluate(e=>getComputedStyle(e).outlineWidth),'2px');
 const preview=page.locator('.apparatus-engine .apparatus-preview');
 const restingTransform=await preview.evaluate(e=>getComputedStyle(e).transform);
 await page.locator('.apparatus-engine').hover();await page.waitForTimeout(250);
 assert.notEqual(await preview.evaluate(e=>getComputedStyle(e).transform),restingTransform,'hover lifts the instrument');await page.screenshot({path:'qa/home-hover.png',fullPage:true});
 await page.mouse.move(5,5);await page.locator(':focus').evaluate(e=>e.blur());
 for(const [width,height]of [[1920,1080],[1024,768],[768,1024],[390,844],[360,800]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`no horizontal overflow at ${width}`);
  const items=await page.locator('.apparatus').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
  assert.ok(items.every(e=>e.x>=0&&e.right<=width&&e.width>=44&&e.height>=44),'all three links retain visible touch targets');
  await page.screenshot({path:`qa/home-${width}.png`,fullPage:true});
 }
 checks.push('three assembled previews, desktop arc, hover/focus and captions, 360–1920px layouts');
 await page.setViewportSize({width:1440,height:1000});
 for(const [kind,file]of [['fridge','refrigerator.html'],['engine','engine.html'],['ac','air-conditioner.html']]){
  await page.locator('.apparatus-'+kind).click();await page.waitForURL(base+file);
  await page.waitForFunction(()=>window.thermalDemo?.ready||window.coolingDemo?.ready||window.experimentDemo?.ready);
  assert.equal(await page.locator('.room-home').getAttribute('href'),'./index.html');assert.equal(await page.locator('.room-section').textContent(),'热能实验室');
  assert.equal(await page.locator('.machine-nav [aria-current="page"]').getAttribute('href'),'./'+file);
  assert.equal(await page.locator('.machine-nav a[href="./engine.html"]').count(),1);
  if(kind==='gas'){await page.setViewportSize({width:360,height:800});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'qa/home-return-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});}
  await page.locator('.room-home').click();await page.waitForURL(base+'index.html');await decode();
  assert.equal(await page.evaluate(()=>homeRoom.arrivalPlayed),false,'returning home does not repeat arrival');
 }
 checks.push('all three preview links enter a ready model; every model returns home; engine address migrated');
 await page.emulateMedia({reducedMotion:'reduce'});await page.mouse.move(5,5);
 const reducedRest=await preview.evaluate(e=>getComputedStyle(e).transform);
 await page.locator('.apparatus-engine').hover();await page.waitForTimeout(80);
 assert.equal(await preview.evaluate(e=>getComputedStyle(e).transform),reducedRest,'reduced motion retains the static presentation scale');
 assert.equal(await page.locator('iframe').count(),0,'reduced motion does not start the live preview');
 await page.context().setOffline(true);await page.goto(pathToFileURL(resolve('index.html')).href);await decode();
 assert.equal(await page.locator('.apparatus').count(),3);assert.ok(await page.locator('.apparatus img').evaluateAll(es=>es.every(e=>e.currentSrc.startsWith('data:image/png;base64,'))));
 for(const file of ['engine','fridge','ac']){const png=readFileSync(`assets/home/${file}.png`);assert.equal(png[25],6,'RGBA preview');}
 checks.push('reduced motion is still; self-contained homepage previews work offline');
 assert.deepEqual(errors,[]);writeFileSync('qa/home-results.json',JSON.stringify({checks,errors},null,2));console.log(checks.join('\n'));
}finally{await browser.close();}
