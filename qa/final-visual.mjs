import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1366,height:900},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:4198/engine.html');await p.waitForFunction(()=>thermalDemo.ready);if(await p.locator('#assembly-exit').isVisible())await p.locator('#assembly-exit').click();await p.waitForTimeout(600);const f=p.frames()[1];
const playBox=await p.locator('#play').boundingBox();assert.ok(playBox.y+playBox.height<=900,'play is visible in first desktop viewport');
await p.screenshot({path:'qa/final-desktop.png',fullPage:true});await p.screenshot({path:'qa/preview.png'});
for(const mode of ['assembled','cut','explode','xray']){await p.locator(`[data-mode="${mode}"]`).click();await p.waitForTimeout(1200);await p.locator('.visual-stage').screenshot({path:`qa/round3-${mode}.png`});}
await p.locator('[data-mode="cut"]').click();await p.waitForTimeout(800);
await p.locator('[data-view="paper"]').click();await p.waitForTimeout(400);await p.locator('.visual-stage').screenshot({path:'qa/final-paper.png'});
await p.locator('[data-mode="explode"]').click();await p.waitForTimeout(700);await p.locator('.visual-stage').screenshot({path:'qa/final-paper-explode.png'});
await p.locator('[data-view="3d"]').click();await p.locator('[data-mode="cut"]').click();await p.locator('[data-stroke="0"]').click();await p.waitForTimeout(700);await p.locator('.visual-stage').screenshot({path:'qa/round3-intake.png'});
await p.evaluate(()=>thermalDemo.setAngle(360));await p.waitForTimeout(120);await p.locator('.visual-stage').screenshot({path:'qa/round3-ignition.png'});
await p.close();
// A separate 4x inspection of the two mechanism junctions.
const near=await b.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:4});await near.goto('http://127.0.0.1:4198/engine.html');await near.waitForFunction(()=>thermalDemo.ready);await near.waitForTimeout(500);const box=await near.locator('.visual-stage').boundingBox();
await near.screenshot({path:'qa/round4-upper-4x.png',clip:{x:box.x+box.width*.34,y:box.y+38,width:box.width*.34,height:box.height*.40}});
await near.screenshot({path:'qa/round4-lower-4x.png',clip:{x:box.x+box.width*.37,y:box.y+box.height*.43,width:box.width*.30,height:box.height*.49}});await near.close();
const m=await b.newPage({viewport:{width:390,height:900},deviceScaleFactor:1,isMobile:true,hasTouch:true});m.on('pageerror',e=>errors.push(e.message));await m.goto('http://127.0.0.1:4198/engine.html');await m.waitForFunction(()=>thermalDemo.ready);await m.waitForTimeout(500);await m.screenshot({path:'qa/final-mobile.png',fullPage:true});
await m.locator('[data-mode="explode"]').click();await m.waitForTimeout(1400);await m.locator('.visual-stage').screenshot({path:'qa/final-mobile-explode.png'});
assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
const mf=m.frames()[1],cam0=await mf.evaluate(()=>engineScene.lab.camera.position.toArray());await m.evaluate(()=>scrollTo(0,200));const r=await m.locator('#machine').boundingBox();const cdp=await m.context().newCDPSession(m),x=r.x+r.width/2,y=r.y+r.height*.6;
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-95}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await m.waitForTimeout(150);assert.ok(await m.evaluate(()=>scrollY)>250);assert.deepEqual(await mf.evaluate(()=>engineScene.lab.camera.position.toArray()),cam0);
assert.deepEqual(errors,[]);writeFileSync('qa/final-visual.json',JSON.stringify({errors,desktopPlayVisible:true,phoneNoOverflow:true,oneFingerScroll:true,inspection:'round3 modes/ports, round4 joints at 4x and touch device'},null,2));await b.close();console.log('FINAL VISUAL AND TOUCH CHECKS PASSED');
