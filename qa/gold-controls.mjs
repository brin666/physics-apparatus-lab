import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const errors=[],checks=[];
const pass=message=>{checks.push(message);console.log('PASS',message);};
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4198/engine.html?v=gold-controls');
  await page.waitForFunction(()=>thermalDemo.ready);
  await page.evaluate(()=>thermalDemo.finishAssembly(false));
  const frame=page.frames().find(f=>f.parentFrame());
  await frame.waitForFunction(()=>document.querySelector('.lab-lab small'));
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('#play-text').textContent(),'开始演示');
  assert.equal(await page.locator('#cycle-overview').isVisible(),true);
  assert.equal(await page.locator('#playback-status').textContent(),'准备就绪');
  assert.equal(await page.locator('#whiteboard-open').innerText(),'');
  assert.ok(await page.locator('#whiteboard-open').getAttribute('aria-label'));
  await page.screenshot({path:'qa/gold-idle-desktop.png',fullPage:true});
  const idlePlay=await page.locator('#play').boundingBox();
  const footer=await page.locator('.teaching-footer').boundingBox();
  await page.locator('#play').click();
  await frame.waitForFunction(()=>document.body.classList.contains('is-playing'));
  await page.waitForTimeout(220);
  assert.equal(await frame.locator('.lab-lab small').isVisible(),false);
  assert.equal(await frame.locator('.lab-lab').isVisible(),true);
  assert.equal(await page.locator('#play-text').textContent(),'暂停演示');
  assert.equal(await page.locator('#play').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#playback-status').textContent(),'演示中');
  assert.equal(await page.locator('.cycle-phase[aria-current="step"]>span').first().textContent(),'做功');
  const playingPlay=await page.locator('#play').boundingBox();
  assert.equal(playingPlay.width,idlePlay.width);assert.equal(playingPlay.height,idlePlay.height);
  assert.equal((await page.locator('.teaching-footer').boundingBox()).height,footer.height);
  await page.screenshot({path:'qa/gold-playing-desktop.png',fullPage:true});
  await page.locator('#play').click();
  await frame.waitForFunction(()=>!document.body.classList.contains('is-playing'));
  assert.equal(await frame.locator('.lab-lab small').isVisible(),true);
  assert.equal(await page.locator('#play-text').textContent(),'继续演示');
  assert.equal(await page.locator('#playback-status').textContent(),'已暂停');
  const pausedAngle=await page.evaluate(()=>thermalDemo.state.angle);
  await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>thermalDemo.state.angle),pausedAngle);
  pass('idle, play and pause keep button/footer size; only moving measurements hide, then return');

  for(let i=0;i<4;i++){
    await page.evaluate(i=>thermalDemo.setAngle(i*180+90),i);
    assert.equal(await page.locator('.cycle-phase[aria-current="step"]').getAttribute('data-phase-index'),String(i));
    assert.match(await page.locator('.cycle-phase').nth(i).locator('i').getAttribute('style'),/scaleX\(0\.5\)/);
  }
  await page.evaluate(()=>thermalDemo.setAngle(720));
  assert.equal(await page.locator('.cycle-phase[aria-current]').count(),0);
  assert.equal(await page.locator('.cycle-phase[data-status="done"]').count(),4);
  pass('all four phases follow the engine clock, with a completed 720-degree cycle');

  await page.evaluate(()=>thermalDemo.showView('paper'));
  assert.equal(await page.locator('#cycle-overview').isVisible(),false);
  await page.evaluate(()=>thermalDemo.showView('3d'));
  assert.equal(await page.locator('#cycle-overview').isVisible(),true);

  await page.evaluate(()=>thermalDemo.setAngle(270));await page.locator('#play').click();
  await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>thermalDemo.whiteboard.isOpen);
  assert.equal(await page.evaluate(()=>thermalDemo.state.playing),false);
  assert.equal(await frame.locator('.lab-lab small').isVisible(),true);
  await page.locator('#wb-exit').click();
  assert.equal(await page.locator('#play-text').textContent(),'继续演示');
  await page.screenshot({path:'qa/gold-paused-desktop.png',fullPage:true});
  pass('gold pen opens the live whiteboard, pauses playback and restores the measurement');

  for(const width of [390,360]){
    const mobile=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
    mobile.on('pageerror',e=>errors.push(e.message));
    await mobile.goto('http://127.0.0.1:4198/engine.html?v=gold-controls');await mobile.waitForFunction(()=>thermalDemo.ready);
    await mobile.evaluate(()=>thermalDemo.finishAssembly(false));await mobile.waitForTimeout(800);
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const play=await mobile.locator('#play').boundingBox(),tools=await mobile.locator('.stage-tools').boundingBox();
    assert.ok(play.x+play.width<=tools.x);
    assert.ok(tools.x+tools.width<=width);
    for(const mode of ['assembled','cut','explode','xray'])assert.equal(await mobile.locator(`.mode-bar>button[data-mode="${mode}"]`).isVisible(),true);
    const height=(await mobile.locator('.teaching-footer').boundingBox()).height;
    await mobile.locator('#play').click();await mobile.waitForTimeout(150);
    assert.equal((await mobile.locator('.teaching-footer').boundingBox()).height,height);
    await mobile.screenshot({path:`qa/gold-mobile-${width}.png`,fullPage:true});
    await mobile.close();
  }
  pass('390px and 360px touch layouts retain all model modes, separate controls and stable playback footer');
  assert.deepEqual(errors,[]);
  writeFileSync('qa/gold-results.json',JSON.stringify({checks,errors,date:new Date().toISOString()},null,2));
} finally {await browser.close();}
