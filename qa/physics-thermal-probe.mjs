import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.goto('http://127.0.0.1:4198/engine.html');await page.waitForFunction(()=>window.thermalDemo?.ready);await page.evaluate(()=>{thermalDemo.finishAssembly(false);thermalDemo.setPlaying(false);});
 const result=await page.locator('#machine').evaluate(frame=>{
  const s=frame.contentWindow.engineScene,issues=[];let largestRodRadius=0;
  for(let angle=0;angle<720;angle+=2){
   s.update({angle,mode:'assembled',reduced:true,assembly:{active:false,time:4},playing:false});s.lab._update(0);s.lab.machine.updateWorldMatrix(true,true);
   const inv=s.lab.machine.matrixWorld.clone().invert();
   s.parts.rod.traverse(m=>{if(!m.isMesh)return;const pos=m.geometry.attributes.position;for(let i=0;i<pos.count;i++){
    const p=s.lab.camera.position.clone().fromBufferAttribute(pos,i).applyMatrix4(m.matrixWorld).applyMatrix4(inv),r=Math.hypot(p.x,p.y-.11);
    if(Math.abs(p.z)<.0365&&p.y<.179){largestRodRadius=Math.max(largestRodRadius,r);if(r>.057+1e-5&&r<.069&&issues.length<20)issues.push({angle,p:p.toArray(),r});}
   }});
  }
  return {rodVsCrankcase:issues,largestRodRadius};
 });
 console.log(JSON.stringify(result,null,2));await writeFile('qa/physics-thermal-probe.json',JSON.stringify(result,null,2));
}finally{await browser.close();}
