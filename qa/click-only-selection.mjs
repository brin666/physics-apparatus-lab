import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 for(const [file,part] of [['air-conditioner','fan'],['refrigerator','compressor'],['engine','piston']]){
  await page.goto('http://127.0.0.1:4198/'+file+'.html?v=click-labels');await page.waitForFunction(()=>(window.coolingDemo||window.thermalDemo)?.ready);
  assert.equal(await page.evaluate(()=>(window.coolingDemo||window.thermalDemo).state.selected),null);
  await page.waitForFunction(()=>!(window.coolingDemo||window.thermalDemo).state.assembly.active);
  assert.equal(await page.evaluate(()=>(window.coolingDemo||window.thermalDemo).state.selected),null);
  await page.evaluate(()=>{const d=window.coolingDemo||window.thermalDemo;d.setProgress?.(.7);d.setPlaying(true);});await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>(window.coolingDemo||window.thermalDemo).state.selected),null);
  await page.locator('#lesson-toggle').click();await page.locator('#lesson-tab-structure').click();await page.locator('[data-part-id="'+part+'"]').click();
  assert.equal(await page.evaluate(()=>(window.coolingDemo||window.thermalDemo).state.selected),part);
  const r=await page.locator('#machine').boundingBox(),blank={x:r.x+35,y:r.y+r.height*.54};
  await page.mouse.move(blank.x,blank.y);await page.mouse.down();await page.mouse.move(blank.x+30,blank.y+15,{steps:4});await page.mouse.move(blank.x,blank.y,{steps:4});await page.mouse.up();assert.equal(await page.evaluate(()=>(window.coolingDemo||window.thermalDemo).state.selected),part);
  await page.mouse.click(blank.x,blank.y);await page.waitForFunction(()=>(window.coolingDemo||window.thermalDemo).state.selected===null);
  assert.equal(await page.locator('.part-detail').isVisible(),false);
  await page.locator('#play').click();await page.mouse.click(blank.x,blank.y);assert.equal(await page.evaluate(()=>(window.coolingDemo||window.thermalDemo).state.playing),true);
  await page.locator('button[data-mode=explode]').click();await page.waitForFunction(()=>{const w=document.querySelector('#machine').contentWindow;return (w.coolingScene||w.engineScene).exploration.phase==='open';});
  const p=await page.evaluate(id=>{const f=document.querySelector('#machine'),s=f.contentWindow.coolingScene||f.contentWindow.engineScene,g=s.parts[id],r=f.getBoundingClientRect();let m;g.traverse(o=>{if(!m&&o.isMesh)m=o;});m.updateWorldMatrix(true,false);m.geometry.computeBoundingBox();const p=m.geometry.boundingBox.getCenter(m.position.clone()).applyMatrix4(m.matrixWorld).project(s.lab.camera);return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};},part);
  await page.mouse.click(p.x,p.y);await page.waitForFunction(()=>(window.coolingDemo||window.thermalDemo).state.selected!==null);assert.equal(await page.locator('#part-inspector').isVisible(),true);
  await page.mouse.move(blank.x,blank.y);await page.mouse.down();await page.mouse.move(blank.x+35,blank.y+20,{steps:5});await page.mouse.move(blank.x,blank.y,{steps:5});await page.mouse.up();
  assert.equal(await page.evaluate(()=>(window.coolingDemo||window.thermalDemo).state.selected),part,'orbit drag must retain selection');
  await page.mouse.click(blank.x,blank.y);await page.waitForFunction(()=>(window.coolingDemo||window.thermalDemo).state.selected===null);assert.equal(await page.locator('#part-inspector').isVisible(),false);
  await page.locator('#play').click();await page.waitForFunction(()=>(window.coolingDemo||window.thermalDemo).state.playing);assert.equal(await page.evaluate(()=>(window.coolingDemo||window.thermalDemo).state.selected),null);
  console.log('PASS',file,'no automatic labels; explicit click; blank dismiss; orbit preserves selection; playing blank click does not pause');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
