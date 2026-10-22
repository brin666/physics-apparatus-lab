import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const checks=[],errors=[],devices=[];
const pass=message=>{checks.push(message);console.log('PASS',message);};
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
const url=file=>'http://127.0.0.1:4198/engine.html'+file+'?qa=tracked-marker-motion';
const child=()=>page.frames().find(frame=>frame.parentFrame());
const waitBoard=()=>page.waitForFunction(()=>coolingDemo.whiteboard.isOpen&&document.querySelector('#whiteboard').getAttribute('aria-busy')!=='true');
const settle=async()=>{
  const progress=await page.evaluate(()=>coolingDemo.state.progress);
  await child().waitForFunction(value=>coolingScene.state.progress===value,progress);
  await child().evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
};
const sample=()=>child().evaluate(()=>{
  const {lab,state}=coolingScene;
  const marker=lab.fx.getObjectByName('tracked-parcel');
  const pulse=lab.fx.getObjectByName('tracked-parcel-pulse');
  if(!marker||!pulse)throw Error('Built page is missing the tracked marker or pulse');
  const named=[];lab.fx.traverse(mesh=>{if(mesh.name==='tracked-parcel')named.push(mesh);});
  return {
    progress:state.progress,reduced:state.reduced,playing:state.playing,
    markerCount:named.length,position:marker.position.toArray(),
    coreScale:marker.scale.toArray(),rimScale:lab.fx.getObjectByName('parcel-rim').scale.toArray(),
    outlineScale:lab.fx.getObjectByName('tracked-parcel-outline').scale.toArray(),
    pulsePosition:pulse.position.toArray(),pulseScale:pulse.scale.toArray(),
    pulseOpacity:pulse.material.opacity,coreColor:marker.material.color.getHex(),pulseColor:pulse.material.color.getHex(),
    flowVisible:marker.parent.visible,
  };
});
const pose=value=>{
  const {progress,reduced,playing,markerCount,...appearance}=value;
  return appearance;
};
const assertOne=value=>{
  assert.equal(value.markerCount,1,'one tracked parcel body');
  assert.deepEqual(value.position,value.pulsePosition,'pulse remains centered on the same parcel');
  assert.equal(value.coreColor,value.pulseColor,'pulse follows parcel state color');
};
const frozen=async(message)=>{
  await settle();const before=await sample();
  await page.waitForTimeout(450);const after=await sample();
  assert.equal(after.progress,before.progress,message+' progress');
  assert.deepEqual(pose(after),pose(before),message+' appearance');
  assertOne(after);return after;
};
const setProgress=async value=>{await page.evaluate(value=>coolingDemo.setProgress(value),value);await settle();};
let failure;
try{
  for(const file of ['refrigerator.html','air-conditioner.html']){
    const kind=file==='refrigerator.html'?'fridge':'ac';
    await page.goto(url(file));await page.waitForFunction(()=>window.coolingDemo?.ready);
    await child().waitForFunction(()=>!!coolingScene.lab.fx.getObjectByName('tracked-parcel-pulse'));
    await page.evaluate(()=>{coolingDemo.finishAssembly();coolingDemo.setMode('xray');coolingDemo.showLesson(false,{instant:true});});
    await page.waitForTimeout(750);await setProgress(.012);
    const start=await sample();assertOne(start);assert.equal(start.flowVisible,true);
    await page.locator('#play').click();
    const moving=[];
    for(let i=0;i<7;i++){await page.waitForTimeout(130);moving.push(await sample());}
    assert.ok(moving.at(-1).progress>moving[0].progress,'play advances the parent clock');
    const span=values=>Math.max(...values)-Math.min(...values);
    assert.ok(span(moving.map(item=>item.coreScale[0]))>.025,'core visibly breathes during playback');
    assert.ok(span(moving.map(item=>item.pulseScale[0]))>.2,'ring expands during playback');
    assert.ok(span(moving.map(item=>item.pulseOpacity))>.15,'ring opacity changes during playback');
    assert.ok(moving.some(item=>item.position.some((v,i)=>Math.abs(v-moving[0].position[i])>.005)),'parcel moves along the loop');
    moving.forEach(assertOne);
    await page.locator('#play').click();const paused=await frozen(kind+' pause');
    assert.equal(paused.playing,false);
    pass(kind+': real play/pause changes parcel position, body size and ring size/opacity, then freezes the exact phase');
    for(const speed of ['0.5','2']){
      await page.locator('#speed').selectOption(speed);
      assert.equal(await page.evaluate(()=>coolingDemo.state.speed),Number(speed));
      const held=await frozen(kind+' paused '+speed+'x');
      assert.equal(held.progress,paused.progress);assert.deepEqual(pose(held),pose(paused));
    }
    await page.locator('#speed').selectOption('1');
    pass(kind+': selecting 0.5x and 2x while paused does not jump the marker or accent phase');
    await setProgress(.045);const visiblePulse=await sample();assert.ok(visiblePulse.pulseOpacity>.5);
    if(kind==='fridge')await page.screenshot({path:'qa/tracked-marker-fridge-pulse.png',fullPage:true});

    await page.locator('#play').click();await page.waitForTimeout(170);
    assert.equal(await page.evaluate(()=>coolingDemo.state.playing),true);
    await page.locator('#whiteboard-open').click();await waitBoard();
    const boardPose=await frozen(kind+' open whiteboard');
    assert.equal(await page.evaluate(()=>coolingDemo.state.playing),false);
    assert.equal(boardPose.playing,false);
    const record=await page.evaluate(()=>coolingDemo.whiteboard.inspect().record);
    assert.equal(record.snapshot.progress,boardPose.progress);
    if(kind==='fridge')await page.screenshot({path:'qa/tracked-marker-fridge-whiteboard.png',fullPage:true});
    await page.locator('#wb-exit').click();
    const exited=await frozen(kind+' exit whiteboard');
    assert.equal(await page.evaluate(()=>coolingDemo.state.playing),false);
    assert.deepEqual(pose(exited),pose(boardPose));
    pass(kind+': opening the real whiteboard during playback freezes the accent; exiting keeps it paused');

    await setProgress(.276);await page.locator('#whiteboard-open').click();await waitBoard();
    assert.notEqual(await page.evaluate(()=>coolingDemo.whiteboard.inspect().record.id),record.id);
    await page.locator('#wb-pages').click();await page.locator('[data-wb-board="'+record.id+'"]').click();
    await page.waitForFunction(id=>coolingDemo.whiteboard.inspect().record.id===id,record.id);await waitBoard();
    const history=await frozen(kind+' history restore');
    assert.equal(history.progress,record.snapshot.progress);assert.deepEqual(pose(history),pose(boardPose));
    await page.locator('#wb-exit').click();
    await page.reload();await page.waitForFunction(()=>window.coolingDemo?.ready);
    await page.evaluate(()=>coolingDemo.finishAssembly());
    await page.locator('#whiteboard-open').click();await waitBoard();await page.locator('#wb-pages').click();
    await page.locator('[data-wb-board="'+record.id+'"]').click();
    await page.waitForFunction(id=>coolingDemo.whiteboard.inspect().record.id===id,record.id);await waitBoard();
    const reloaded=await frozen(kind+' reload history');
    assert.equal(reloaded.progress,record.snapshot.progress);assert.deepEqual(pose(reloaded),pose(boardPose));
    await page.locator('#wb-exit').click();
    pass(kind+': local whiteboard history reconstructs the same progress and accent phase, including after reload');
    devices.push({kind,start,moving,paused,visiblePulse,boardPose,history,reloaded});

    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>coolingDemo.state.reduced);
    await setProgress(.015);const reducedA=await sample();await setProgress(.075);const reducedB=await sample();
    for(const value of [reducedA,reducedB]){
      assertOne(value);assert.equal(value.reduced,true);assert.deepEqual(value.coreScale,[1,1,1]);
      assert.deepEqual(value.rimScale,[1,1,1]);assert.deepEqual(value.outlineScale,[1,1,1]);
      assert.deepEqual(value.pulseScale,[1,1,1]);assert.equal(value.pulseOpacity,0);
    }
    await page.locator('#play').click();await page.waitForTimeout(220);const reducedPlaying=await sample();
    assert.ok(reducedPlaying.progress>reducedB.progress);assert.deepEqual(reducedPlaying.coreScale,[1,1,1]);
    assert.deepEqual(reducedPlaying.pulseScale,[1,1,1]);assert.equal(reducedPlaying.pulseOpacity,0);assertOne(reducedPlaying);
    await page.locator('#play').click();await frozen(kind+' reduced pause');
    devices.at(-1).reduced={reducedA,reducedB,reducedPlaying};
    await page.emulateMedia({reducedMotion:'no-preference'});
    pass(kind+': reduced motion keeps one fixed-size body and hides diffusion even during explicit playback');
  }
  assert.deepEqual(errors,[],'no browser page errors');
}catch(error){failure=error;console.error(error.stack||error);}
finally{
  writeFileSync('qa/tracked-marker-motion.json',JSON.stringify({ok:!failure,checks,errors,devices,failure:failure?String(failure.stack||failure):null},null,2));
  await context.close();await browser.close();
}
if(failure)throw failure;
