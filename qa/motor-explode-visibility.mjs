import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}});
 await page.goto('http://127.0.0.1:4198/dc-motor.html');await page.waitForFunction(()=>window.apparatusDemo?.ready&&window.apparatusDemo.state.phase==='closed');
 const check=async expected=>{
  const result=await page.evaluate(()=>{const s=window.apparatusDemo.scene;const targets=[];s.model.root.traverse(o=>{if(o.userData.hideWhenExploded)targets.push({name:o.name,visible:o.visible});});return {targets,brushes:s.records.find(r=>r.id==='motor-brushes').object.visible,rotor:s.records.find(r=>r.id==='motor-rotor').object.visible};});
  const physicalTargets=result.targets.filter(o=>!o.name.endsWith('-current'));
  assert.equal(physicalTargets.length,4);assert(physicalTargets.every(o=>o.visible===expected),JSON.stringify(result));
  // Current highlights can blink off at the commutator gap when assembled.
  if(!expected)assert(result.targets.every(o=>!o.visible),JSON.stringify(result));
  assert(result.brushes&&result.rotor);
 };
 await check(true);await page.locator('[data-mode="explode"]').click();await page.waitForTimeout(180);await check(false);await page.waitForFunction(()=>window.apparatusDemo.state.phase==='open');await check(false);
 await page.evaluate(()=>window.apparatusDemo.scene.select('motor-force'));assert.equal(await page.evaluate(()=>window.apparatusDemo.state.selected),null);
 await page.screenshot({path:'qa/motor-clean-explode.png'});
 const snapshot=await page.evaluate(()=>window.apparatusDemo.scene.snapshot());
 await page.locator('[data-mode="explode"]').click();await page.waitForTimeout(180);await check(false);await page.waitForFunction(()=>window.apparatusDemo.state.phase==='closed');await page.waitForTimeout(80);await check(true);
 await page.evaluate(saved=>window.apparatusDemo.scene.restore(saved),snapshot);await check(false);
 console.log('PASS: arrows, B mark and supply wires hidden through explode/reassembly; physical parts retained; restore stays hidden; assembled indicators restored');
}finally{await browser.close();}
