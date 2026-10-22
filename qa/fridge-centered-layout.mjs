import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
try{
 await page.goto('http://127.0.0.1:4198/refrigerator.html?v=centered-layout');await page.waitForFunction(()=>window.coolingDemo?.ready&&!coolingDemo.state.assembly.active);
 await page.locator('button[data-mode=explode]').click();await page.waitForFunction(()=>document.querySelector('#machine').contentWindow.coolingScene.exploration.phase==='open');
 for(const [width,height] of [[1440,1000],[1280,800],[820,1000],[390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(400);
  const result=await page.evaluate(()=>{const f=document.querySelector('#machine'),s=f.contentWindow.coolingScene,b={};s.lab.scene.updateMatrixWorld(true);
   const owners={filter:'condenser',expansion:'condenser',thermostat:'shell'};
   for(const m of s.meshes){if(!m.visible||m.userData.effectiveOpacity<.01)continue;const id=owners[m.userData.partId]||m.userData.partId;if(!['shell','door','evaporator','condenser','compressor'].includes(id))continue;
    const box=b[id]??={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};m.geometry.computeBoundingBox();const q=m.geometry.boundingBox;
    for(const x of [q.min.x,q.max.x])for(const y of [q.min.y,q.max.y])for(const z of [q.min.z,q.max.z]){const p=m.position.clone().set(x,y,z).applyMatrix4(m.matrixWorld).project(s.lab.camera),px=(p.x+1)*f.clientWidth/2,py=(1-p.y)*f.clientHeight/2;box.left=Math.min(box.left,px);box.right=Math.max(box.right,px);box.top=Math.min(box.top,py);box.bottom=Math.max(box.bottom,py);}
   }return{boxes:b,width:f.clientWidth,height:f.clientHeight,shell:s.parts.shell.position.toArray()};});
  const boxes=Object.entries(result.boxes);let minGap=Infinity;
  for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){
   const [ia,aa]=boxes[a],[ib,bb]=boxes[b],gap=Math.max(bb.left-aa.right,aa.left-bb.right,bb.top-aa.bottom,aa.top-bb.bottom);minGap=Math.min(minGap,gap);assert.ok(gap>2,`${width}: ${ia}/${ib} overlap or too close: ${gap}`);
  }
  assert.deepEqual(result.shell,[0,0,0]);const shell=result.boxes.shell;assert.ok(Math.abs((shell.left+shell.right)/2-result.width/2)<result.width*.04,'cabinet centered');
  assert.ok(boxes.every(([,b])=>b.left>0&&b.right<result.width&&b.top>0&&b.bottom<result.height),'all assemblies in frame');
  await page.screenshot({path:`qa/fridge-centered-${width}.png`});console.log('PASS',width,'all projected assembly bounds separate; minimum gap',minGap.toFixed(1));
 }
}finally{await browser.close();}
