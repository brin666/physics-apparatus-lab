import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try {
  for(const id of ['dc-motor','speaker','relay','generator']) {
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:4198/${id}.html`);
    await page.waitForFunction(()=>window.apparatusDemo?.ready);
    await page.evaluate(()=>window.apparatusDemo.finishAssembly());
    await page.waitForFunction(()=>window.apparatusDemo.state.phase==='closed');
    await page.evaluate(()=>window.apparatusDemo.setPlaying(false));
    // Use the actual UI input, and compare physical rotor angle/phase before and after.
    if(id!=='relay') {
      await page.locator('#variables-toggle').click();
      const result=await page.evaluate(id=>{
        const d=window.apparatusDemo,s=d.state;
        s.t=1.234;d.scene.model.update(s.t,s.inputs);
        const c=d.definition.controls.find(c=>c.id===({speaker:'frequency',generator:'rpm','dc-motor':'voltage'}[id]));
        const before=d.definition.phaseRate(s.inputs)*s.t+(s.inputs._phaseOffset||0);
        const input=document.getElementById(`input-${c.id}`);input.value=c.min;input.dispatchEvent(new Event('input',{bubbles:true}));
        const after=d.definition.phaseRate(s.inputs)*s.t+(s.inputs._phaseOffset||0);
        return {before,after};
      },id);
      assert.ok(Math.abs(result.before-result.after)<1e-9,`${id} slider changed phase`);
      await page.locator('#variables-close').click();
    }
    const states=await page.evaluate(id=>{
      const d=window.apparatusDemo,s=d.scene,states=[];
      const inputs=id==='dc-motor'?{voltage:4}:id==='generator'?{rpm:60}:id==='speaker'?{level:1,frequency:1}:{};
      const rate=d.definition.phaseRate?.(inputs)||1;
      for(let i=0;i<=96;i++){
        const t=i/96*2*Math.PI/rate,params=id==='relay'?{coilCurrent:i/96*1.2}:inputs;
        const state=s.model.update(t,params);s.model.root.updateMatrixWorld(true);
        if(i%24===0)states.push({sample:i,state});
        let bad=false;s.model.root.traverse(o=>{if(!o.matrixWorld.elements.every(Number.isFinite))bad=true;});
        if(bad)throw Error(`${id}: nonfinite mesh transform`);
      }
      Object.assign(d.state.inputs,id==='relay'?{coilCurrent:.52}:inputs,{_phaseOffset:0});
      d.state.t=id==='speaker'?.25:0;
      s.model.update(d.state.t,d.state.inputs);d.setPlaying(false);
      s.renderer.render(s.scene,s.camera);return states;
    },id);
    await page.screenshot({path:`qa/physics-em-${id}-assembled.png`});
    if(id==='speaker'||id==='relay') {
      await page.evaluate(id=>{
        const s=window.apparatusDemo.scene;
        for(const r of s.records)if(r.shell)r.pivot.visible=false;
        if(id==='speaker'){
          s.camera.position.set(1.9,1.35,-1.8);s.orbit.target.set(0,.72,-.17);
          // An inspection cutaway of the static magnetic circuit exposes the
          // moving coil/former; the intact screenshot is retained separately.
          for(const r of s.records)if(r.id==='speaker-magnet')r.pivot.visible=false;
        }
        else{s.camera.position.set(.85,1.03,1.25);s.orbit.target.set(.10,.52,.05);}
        s.orbit.update();s.renderer.render(s.scene,s.camera);
      },id);
      await page.screenshot({path:`qa/physics-em-${id}-mechanism.png`});
    }
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(120);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);results.push({id,poses:97,quarterStates:states,browserErrors:errors,phaseContinuity:id!=='relay',mobileOverflow:false});
    await page.close();
  }
} finally {await browser.close();}
await writeFile('qa/physics-em-browser.md','# Electromagnetic browser verification\n\nIsolated headless Chrome, localhost:4198. 97 poses per model, physical transforms finite; slider phase continuity passed for motor, speaker and generator; no browser exceptions; 390 px viewport has no horizontal overflow.\n\n```json\n'+JSON.stringify(results,null,2)+'\n```\n');
console.log('PASS: four models, 388 sampled poses, UI phase continuity, desktop screenshots and mobile layout.');
