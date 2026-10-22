import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4198/submarine.html');await page.waitForFunction(()=>window.apparatusDemo?.ready&&window.apparatusDemo.state.phase==='closed');
 const report=await page.evaluate(async()=>{
  const a=window.apparatusDemo;a.state.speed=2;a.setPlaying(true);
  const start=a.state.t;let prev=a.scene.model.physicsState(),prevT=a.state.t,maxSpeedFromFrames=0,sawBottom=false,sawRise=false,sawPartial=false,frames=0;
  while(a.state.t-start<24){
   await new Promise(requestAnimationFrame);const s=a.scene.model.physicsState(),dt=a.state.t-prevT;
   if(dt>0){maxSpeedFromFrames=Math.max(maxSpeedFromFrames,Math.abs(s.centerY-prev.centerY)/dt);frames++;}
   sawBottom ||= s.onBottom;sawRise ||= s.velocityY>.05;sawPartial ||= s.displacedFraction<.99;prev=s;prevT=a.state.t;
  }
  a.setPlaying(false);const before=a.scene.model.physicsState(),oldTime=a.state.t;a.setInput('ballast',0);const manual=a.scene.model.physicsState();
  const saved=a.scene.snapshot();a.state.t+=.5;a.scene.model.update(a.state.t,a.state.inputs);a.scene.restore(saved);const restored=a.scene.model.physicsState();
  return {frames,maxSpeedFromFrames,sawBottom,sawRise,sawPartial,manualDy:manual.centerY-before.centerY,manualTimeDelta:a.state.t-oldTime,restoreDy:restored.centerY-manual.centerY,restoreDv:restored.velocityY-manual.velocityY,snapshotHasModel:!!saved.model};
 });
 assert.ok(report.frames>100&&report.maxSpeedFromFrames<2.5);assert.ok(report.sawBottom&&report.sawRise&&report.sawPartial);
 for(const key of ['manualDy','manualTimeDelta','restoreDy','restoreDv'])assert.ok(Math.abs(report[key])<1e-10,key);
 assert.ok(report.snapshotHasModel);await page.waitForFunction(()=>document.querySelector('#readouts').textContent.includes('实际浮力'));
 const beforeBoard=await page.evaluate(()=>window.apparatusDemo.scene.model.snapshot());
 await page.locator('#whiteboard-open').click();await page.waitForFunction(()=>window.apparatusDemo.whiteboard.isOpen);await page.waitForTimeout(100);
 await page.evaluate(()=>window.apparatusDemo.whiteboard.close());await page.waitForFunction(()=>!window.apparatusDemo.whiteboard.isOpen);
 const afterBoard=await page.evaluate(()=>window.apparatusDemo.scene.model.snapshot());assert.deepEqual(afterBoard,beforeBoard);
 await page.screenshot({path:'qa/physics-fluids-submarine-dynamics.png'});assert.deepEqual(errors,[]);
 await writeFile('qa/physics-fluids-dynamics.md',`# Submarine runtime continuity evidence\n\nIsolated headless Chrome, actual autoplay for 24 simulation seconds. ${new Date().toISOString()}\n\n\`\`\`json\n${JSON.stringify(report,null,2)}\n\`\`\`\n\nAll assertions passed: no instantaneous depth jump, actual buoyancy UI, manual input preserved physical time/y, model snapshot restored y/v, opening/closing whiteboard preserved snapshot. No page errors.\n`);
 console.log(JSON.stringify(report));
}finally{await browser.close();}
