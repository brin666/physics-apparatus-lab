import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const cases={pulley:[{pullDistance:0},{pullDistance:.3},{pullDistance:.6}],rheostat:[{position:0,end:'A'},{position:.25,end:'B'},{position:1,end:'A'}],electroscope:[{operation:'near'},{operation:'contact'},{operation:'grounded'},{operation:'isolated'},{operation:'induction-done'},{operation:'contact-away'}],'induction-hob':[{power:65,pan:'steel'},{power:0,pan:'steel'},{power:65,pan:'none'}]};
try {for(const [id,states] of Object.entries(cases)) {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:4198/${id}.html`);await page.waitForFunction(()=>window.apparatusDemo?.ready);await page.waitForFunction(()=>window.apparatusDemo.state.phase==='closed');
 await page.evaluate(()=>window.apparatusDemo.state.playing=false);
 for(let i=0;i<states.length;i++){
  await page.evaluate(inputs=>{const d=window.apparatusDemo;d.state.playing=false;for(const [k,v] of Object.entries(inputs))d.setInput(k,v);d.scene.model.update(0,inputs);},states[i]);
  await page.waitForTimeout(150);
  const visibility=await page.evaluate(()=>Object.fromEntries(window.apparatusDemo.scene.model.parts.map(p=>[p.id,p.object.visible])));
  if(id==='electroscope') assert.equal(visibility['ground-wire'],['grounded','discharge'].includes(states[i].operation),'rendered ground follows real operation');
  if(id==='induction-hob'){const active=states[i].power>0&&states[i].pan==='steel';assert.equal(visibility.cookware,states[i].pan==='steel');assert.equal(visibility['magnetic-field'],active);assert.equal(visibility['eddy-currents'],active);}

  await page.screenshot({path:`qa/physics-mechanical-${id}-${i}.png`});
 }
 if(id==='induction-hob'){await page.evaluate(()=>{const d=window.apparatusDemo;d.setInput('pan','steel');d.setInput('power',65);d.scene.mode('assembled');});await page.waitForTimeout(1400);await page.screenshot({path:'qa/physics-mechanical-induction-hob-assembled.png'});}
 await page.evaluate(id=>{const s=window.apparatusDemo.scene;s.camera.position.copy(s.orbit.target).add({x:0,y:id==='induction-hob'?2:.15,z:3.7});s.orbit.update();},id);
 await page.screenshot({path:`qa/physics-mechanical-${id}-front.png`});
 assert.deepEqual(errors,[]);console.log(id,states.length,'states; no browser errors');await page.close();
}}finally{await browser.close();}
