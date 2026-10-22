import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4198/air-conditioner.html');await page.waitForFunction(()=>window.coolingDemo?.ready);await page.waitForFunction(()=>!coolingDemo.state.assembly.active);
await page.evaluate(()=>{coolingDemo.state.playing=false;coolingDemo.setMode('xray');});await page.waitForTimeout(500);
await page.screenshot({path:'qa/physics-ac-indoor-overview.png'});
await page.evaluate(()=>{const s=document.querySelector('#machine').contentWindow.coolingScene;const target=s.geometry.motion.blower.getWorldPosition(s.lab.camera.position.clone());target.y+=.07;s.lab.controlsOrbit.target.copy(target);s.lab.camera.position.copy(target).add({x:.65,y:.25,z:1.1});s.lab.controlsOrbit.update();});
await page.waitForTimeout(200);await page.screenshot({path:'qa/physics-ac-indoor-close.png'});
await page.evaluate(()=>{const s=document.querySelector('#machine').contentWindow.coolingScene;const target=s.geometry.motion.blower.getWorldPosition(s.lab.camera.position.clone());target.y+=.055;s.lab.controlsOrbit.target.copy(target);s.lab.camera.position.copy(target).add({x:1.2,y:.05,z:.3});s.lab.controlsOrbit.update();});
await page.waitForTimeout(200);await page.screenshot({path:'qa/physics-ac-indoor-side.png'});
assert.deepEqual(errors,[]);console.log('Indoor AC overview and two close views: no browser errors');
}finally{await browser.close();}
