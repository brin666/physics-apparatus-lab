import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const errors=[],checks=[],pass=message=>{checks.push(message);console.log('PASS',message);};
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
const open=async(file)=>{await page.goto('http://127.0.0.1:4198/engine.html'+file+'?v=cooling');await page.waitForFunction(()=>window.coolingDemo?.ready);return page.frames().find(frame=>frame.parentFrame());};
try{
  let frame=await open('refrigerator.html');
  assert.equal(await page.locator('.machine-nav a').count(),5);
  assert.equal(await page.locator('.machine-nav [aria-current=page]').textContent(),'电冰箱');
  assert.equal(await page.evaluate(()=>coolingDemo.state.assembly.active),true);
  await page.waitForFunction(()=>coolingDemo.state.assembly.time>.12);await page.locator('#play').click();
  const held=await page.evaluate(()=>coolingDemo.state.assembly.time);await page.waitForTimeout(140);assert.equal(await page.evaluate(()=>coolingDemo.state.assembly.time),held);
  await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>coolingDemo.whiteboard.isOpen);
  await frame.evaluate(()=>coolingScene.select('shell',true));await page.waitForFunction(()=>coolingDemo.state.selected==='shell');
  assert.equal(await page.evaluate(()=>coolingDemo.state.assembly.active),true);
  assert.equal(await page.evaluate(()=>coolingDemo.state.assembly.time),held);
  assert.equal(await page.locator('#lesson-toggle').getAttribute('aria-expanded'),'false');
  await page.locator('#wb-exit').click();
  for(let i=0;i<5;i++){await page.locator('[data-assembly-step="'+i+'"]').click();assert.equal(await page.locator('[data-assembly-step="'+i+'"]').getAttribute('aria-current'),'step');}
  await page.locator('#assembly-next').click();assert.equal(await page.evaluate(()=>coolingDemo.state.assembly.active),false);
  assert.equal(await page.evaluate(()=>coolingDemo.state.playing),false);
  assert.equal(await page.evaluate(()=>coolingDemo.state.mode),'xray');
  assert.equal(await page.locator('button[data-mode=xray]').getAttribute('aria-pressed'),'true');
  await frame.waitForFunction(()=>coolingScene.state.mode==='xray');
  await page.waitForTimeout(1000);await page.screenshot({path:'qa/cooling-fridge-default-xray.png',fullPage:true});
  pass('three device entrances, five-step assembly and paused refrigerator defaulting to xray');
  assert.equal(await page.locator('#operation-switch').isVisible(),false);
  await page.locator('#play').click();await page.waitForTimeout(180);const moving=await page.evaluate(()=>coolingDemo.state.progress);assert.ok(moving>0);
  await page.locator('#play').click();const paused=await page.evaluate(()=>coolingDemo.state.progress);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>coolingDemo.state.progress),paused);
  for(let i=0;i<4;i++){await page.evaluate(i=>coolingDemo.setProgress((i+.5)/4),i);assert.equal(await page.locator('.cycle-phase[aria-current=step]').getAttribute('data-phase-index'),String(i));}
  await page.evaluate(()=>coolingDemo.setProgress(1));await frame.waitForFunction(()=>coolingScene.state.progress===1);
  assert.equal(await frame.evaluate(()=>coolingScene.trackedParcel.phase),'vapor');
  assert.equal(await page.locator('#playback-status').textContent(),'追踪完成');
  await page.locator('#lesson-toggle').click();await page.locator('#lesson-tab-cycle').click();await page.locator('#progress').fill('875');assert.equal(await page.evaluate(()=>coolingDemo.state.progress),.875);
  await page.locator('#speed').selectOption('2');assert.equal(await page.evaluate(()=>coolingDemo.state.speed),2);await page.locator('#speed').selectOption('1');
  await page.locator('#reveal').click();assert.equal(await page.locator('#answer').isVisible(),true);await page.locator('#lesson-close').click();
  pass('refrigerant clock, four observations, pause, range, speed and short teaching explanations');
  for(const mode of ['assembled','explode','xray','cut']){await page.locator('button[data-mode="'+mode+'"]').click();await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>coolingDemo.state.mode),mode);await page.screenshot({path:'qa/cooling-fridge-'+mode+'.png',fullPage:true});}
  await page.evaluate(()=>{coolingDemo.showView('paper');coolingDemo.showLesson(false,{instant:true});});
  assert.equal(await page.locator('#stage-paper').isVisible(),true);assert.equal(await page.locator('#cycle-overview').isVisible(),false);await page.screenshot({path:'qa/cooling-fridge-paper.png',fullPage:true});
  await page.evaluate(()=>coolingDemo.showView('3d'));
  const identity=await frame.evaluate(()=>{window.__coolingIdentity='fridge-scene';return window.__coolingIdentity;});
  await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>coolingDemo.whiteboard.isOpen);await page.waitForFunction(()=>document.querySelector('#whiteboard').getAttribute('aria-busy')!=='true');
  assert.equal(await frame.evaluate(()=>window.__coolingIdentity),identity);
  const canvas=await page.locator('#wb-ink').boundingBox(),x=canvas.x+canvas.width*.78,y=canvas.y+canvas.height*.3;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+65,y+35,{steps:5});await page.mouse.up();
  assert.equal(await page.evaluate(()=>coolingDemo.whiteboard.inspect().record.operations.length),1);
  await page.locator('#wb-undo').click();assert.equal(await page.evaluate(()=>coolingDemo.whiteboard.inspect().record.operations.length),0);await page.locator('#wb-redo').click();
  const fridgeRecord=await page.evaluate(()=>coolingDemo.whiteboard.inspect().record);
  await page.screenshot({path:'qa/cooling-fridge-whiteboard.png',fullPage:true});await page.locator('#wb-exit').click();
  pass('all refrigerator views and live whiteboard retain the model and support vector ink');
  frame=await open('air-conditioner.html');
  assert.equal(await page.locator('.machine-nav [aria-current=page]').textContent(),'空调');
  await page.evaluate(()=>coolingDemo.finishAssembly());await page.waitForTimeout(1000);
  assert.equal(await page.locator('#operation-switch').isVisible(),true);
  assert.equal(await page.locator('#heat-direction').textContent(),'室内吸热 → 室外放热');
  await page.evaluate(()=>coolingDemo.setProgress(.375));await page.screenshot({path:'qa/cooling-ac-cool.png',fullPage:true});
  await page.locator('[data-operation=heat]').click();
  assert.equal(await page.locator('#heat-direction').textContent(),'室外吸热 → 室内放热');assert.equal(await page.evaluate(()=>coolingDemo.state.playing),false);
  await page.evaluate(()=>coolingDemo.setProgress(.375));assert.match(await page.locator('#caption-title').textContent(),/室内放热/);await page.waitForTimeout(700);
  await page.screenshot({path:'qa/cooling-ac-heat.png',fullPage:true});
  await page.evaluate(()=>coolingDemo.selectPart('reversing'));assert.equal(await page.locator('#part-code').textContent(),'10 / 四通换向阀');await page.waitForTimeout(280);await page.screenshot({path:'qa/cooling-ac-valve.png',fullPage:true});
  await page.locator('#lesson-close').click();
  for(const mode of ['assembled','explode','xray','cut']){await page.locator('button[data-mode="'+mode+'"]').click();await page.waitForTimeout(700);await page.screenshot({path:'qa/cooling-ac-'+mode+'.png',fullPage:true});}
  await page.evaluate(()=>coolingDemo.showView('paper'));await page.screenshot({path:'qa/cooling-ac-paper.png',fullPage:true});await page.evaluate(()=>coolingDemo.showView('3d'));
  assert.equal(await page.locator('body').innerText().then(text=>text.includes('拓展')),false);
  pass('heat-pump heating swaps exchanger roles; valve, complex parts and all views work without level labels');
  await page.evaluate(()=>{coolingDemo.setProgress(.625);coolingDemo.setMode('explode');});
  await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>coolingDemo.whiteboard.isOpen);await page.waitForFunction(()=>document.querySelector('#whiteboard').getAttribute('aria-busy')!=='true');
  await page.locator('#wb-pages').click();assert.equal(await page.locator('[data-wb-board="'+fridgeRecord.id+'"]').count(),0);await page.locator('#wb-library-close').click();
  const acBoardId=await page.evaluate(()=>coolingDemo.whiteboard.inspect().record.id);
  await frame.evaluate(()=>coolingScene.select('reversing',true));await page.waitForFunction(()=>coolingDemo.state.selected==='reversing');
  await page.locator('#wb-exit').click();
  const acRecord=await page.evaluate(()=>coolingDemo.whiteboard.inspect().record);assert.equal(acRecord.snapshot.operation,'heat');assert.equal(acRecord.snapshot.selected,'reversing');
  await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>coolingDemo.whiteboard.isOpen);
  assert.equal(await page.evaluate(()=>coolingDemo.whiteboard.inspect().record.id),acBoardId);
  await page.locator('#wb-exit').click();await page.reload();await page.waitForFunction(()=>coolingDemo.ready);await page.evaluate(()=>coolingDemo.finishAssembly());
  frame=page.frames().find(frame=>frame.parentFrame());await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>coolingDemo.whiteboard.isOpen);
  await page.locator('#wb-pages').click();await page.locator('[data-wb-board="'+acRecord.id+'"]').click();await page.waitForFunction(id=>coolingDemo.whiteboard.inspect().record.id===id,acRecord.id);
  assert.equal(await page.evaluate(()=>coolingDemo.state.operation),'heat');assert.equal(await page.evaluate(()=>coolingDemo.state.mode),'explode');assert.equal(await page.evaluate(()=>coolingDemo.state.progress),.625);
  assert.equal(await page.evaluate(()=>coolingDemo.state.selected),'reversing');
  const restored=await frame.evaluate(()=>coolingScene.getView());if(acRecord.snapshot.camera?.position)restored.position.forEach((value,i)=>assert.ok(Math.abs(value-acRecord.snapshot.camera.position[i])<.002));
  await page.screenshot({path:'qa/cooling-ac-whiteboard.png',fullPage:true});await page.locator('#wb-exit').click();
  pass('device-specific board history restores heat mode, exact parcel progress and settled exploded camera after reload');
  for(const [file,width] of [['refrigerator.html',390],['air-conditioner.html',390],['air-conditioner.html',360]]){
    const mobileContext=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
    const mobile=await mobileContext.newPage();mobile.on('pageerror',error=>errors.push(error.message));
    await mobile.setViewportSize({width,height:844});await mobile.goto('http://127.0.0.1:4198/engine.html'+file);await mobile.waitForFunction(()=>coolingDemo.ready);await mobile.evaluate(()=>coolingDemo.finishAssembly());await mobile.waitForTimeout(700);
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const top=await mobile.locator('.scene-top').boundingBox();assert.ok(top.x+top.width<=width);
    const mobileFrame=mobile.frames().find(frame=>frame.parentFrame());
    const fit=await mobileFrame.evaluate(()=>{
      const ids=coolingScene.kind==='ac'?['indoor-coil','outdoor-coil','compressor']:['evaporator','condenser','compressor'];
      return ids.map(id=>({id,...coolingScene.projectPart(id),width:innerWidth,height:innerHeight}));
    });
    fit.forEach(part=>{assert.ok(part.x>0&&part.x<part.width,part.id+' fits horizontal view');assert.ok(part.y>0&&part.y<part.height,part.id+' fits vertical view');});
    await mobile.screenshot({path:'qa/cooling-mobile-'+file.replace('.html','')+'-'+width+'.png',fullPage:true});
    await mobile.locator('#lesson-toggle').click();await mobile.locator('#lesson-tab-cycle').click();assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await mobileContext.close();
  }
  pass('390px refrigerator and 390/360px air-conditioner layouts retain navigation, modes and teaching card');
  await frame.evaluate(()=>parent.postMessage({type:'cooling-error',message:'verified fallback path'},'*'));
  await page.locator('#paper-fallback').click();assert.equal(await page.locator('#stage-paper').isVisible(),true);assert.equal(await page.locator('#lesson-panel').isVisible(),true);
  pass('renderer failure offers a working paper structure and lesson fallback');
  for(const file of ['refrigerator.html','air-conditioner.html']){
    const offline=await context.newPage();await offline.emulateMedia({reducedMotion:'reduce'});offline.on('pageerror',error=>errors.push(error.message));const network=[];offline.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url());});
    await offline.goto(pathToFileURL(resolve(file)).href);await offline.waitForFunction(()=>coolingDemo.ready);assert.equal(await offline.evaluate(()=>coolingDemo.state.assembly.active),false);assert.deepEqual(network,[]);
    await offline.locator('#assembly-start').evaluate(button=>button.click());assert.equal(await offline.evaluate(()=>coolingDemo.state.assembly.running),false);assert.equal(await offline.locator('#assembly-count').textContent(),'01 / 05');await offline.close();
  }
  pass('both offline pages include real 3D, SVG and whiteboard with reduced-motion manual entrance');
  assert.deepEqual(errors,[]);writeFileSync('qa/cooling-results.json',JSON.stringify({checks,errors,date:new Date().toISOString()},null,2));
}finally{await browser.close();}
