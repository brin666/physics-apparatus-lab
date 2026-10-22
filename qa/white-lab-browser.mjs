import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],layouts=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4198/engine.html?v=white-lab');await page.waitForFunction(()=>window.thermalDemo?.ready);await page.waitForFunction(()=>!thermalDemo.state.assembly.active);
 assert.ok(await page.evaluate(()=>thermalDemo.state.playing));
 await page.evaluate(()=>thermalDemo.setPlaying(false));await page.screenshot({path:'qa/white-lab-running.png'});
 for(const [width,height] of [[1440,1000],[1280,800],[820,1000],[390,844],[360,800]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(180);
   const metrics=await page.evaluate(()=>{
     const stage=document.querySelector('.visual-stage').getBoundingClientRect(),dock=document.querySelector('.scene-bottom').getBoundingClientRect();
     const controls=[...document.querySelectorAll('.scene-bottom button')].filter(b=>b.offsetWidth&&b.offsetHeight).map(b=>{const r=b.getBoundingClientRect();return {name:b.textContent||b.getAttribute('aria-label'),left:r.left,right:r.right,top:r.top,bottom:r.bottom}});
     return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,within:dock.left>=stage.left&&dock.right<=stage.right&&dock.bottom<=stage.bottom,controls};
   });assert.equal(metrics.overflow,false);assert.equal(metrics.within,true);
   for(let i=0;i<metrics.controls.length;i++)for(let j=i+1;j<metrics.controls.length;j++){const a=metrics.controls[i],b=metrics.controls[j];assert.ok(Math.min(a.right,b.right)-Math.max(a.left,b.left)<1||Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<1,`${width}: ${a.name} overlaps ${b.name}`);}
   layouts.push(metrics);
   if(width===390)await page.screenshot({path:'qa/white-lab-mobile-running.png'});
 }
 await page.locator('button[data-mode="explode"]').click();await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.engineScene.exploration.phase==='open');await page.evaluate(()=>thermalDemo.selectPart('piston'));await page.waitForTimeout(500);
 assert.equal(await page.locator('#part-preview').count(),0);assert.ok(await page.locator('#part-inspector').isVisible());await page.screenshot({path:'qa/white-lab-mobile-exploded.png'});
 await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(250);await page.screenshot({path:'qa/white-lab-exploded.png'});
 const focus=await page.evaluate(()=>document.querySelector('#machine').contentWindow.engineScene.exploration.focusSnapshot().piston);assert.ok(focus>.98);
 await page.locator('#play').click();await page.waitForFunction(()=>thermalDemo.state.playing);await page.evaluate(()=>thermalDemo.setPlaying(false));
 const reset=await page.evaluate(()=>document.querySelector('#machine').contentWindow.engineScene.exploration.focusSnapshot());assert.ok(Object.values(reset).every(x=>x===0));
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.thermalDemo?.ready);assert.equal(await page.evaluate(()=>thermalDemo.state.playing),false);assert.equal(await page.locator('.bench-frame').evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.deepEqual(errors,[]);console.log('PASS 5 viewport layouts, controls without overlap, focus lift and reset, no side preview, autoplay and reduced motion; no browser errors');
 writeFileSync('qa/white-lab-results.json',JSON.stringify({layouts,errors,focus,reset},null,2));
}finally{await browser.close();}
