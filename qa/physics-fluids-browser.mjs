import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {catalog} from '../apparatus/catalog.mjs';
const cases=[
 ['submarine','float',0,{ballast:0}],['submarine','sinking',.8,{ballast:32}],['submarine','bottom',3,{ballast:32}],
 ['canal-lock','opening',0,{direction:'downstream',head:6,progress:.55}],['canal-lock','crossing',0,{direction:'downstream',head:6,progress:.625}],
 ['canal-lock','upstream',0,{direction:'upstream',head:6,progress:.625}],
 ['manometer','max-oil',0,{depth:.5,gauge:'oil'}],['manometer','zero',0,{depth:0,gauge:'water'}],
 ['piston-pump','upstroke',1,{speed:.25,lift:4}],['piston-pump','downstroke',3,{speed:.25,lift:4}],['piston-pump','top',2,{speed:.25,lift:4}],
];
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{
 for(const id of [...new Set(cases.map(c=>c[0]))]){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:4198/${catalog.find(d=>d.id===id).url}`);await page.waitForFunction(()=>window.apparatusDemo?.ready);await page.waitForFunction(()=>window.apparatusDemo.state.phase==='closed');
  await page.evaluate(()=>{window.apparatusDemo.setPlaying(false);window.apparatusDemo.setMode('assembled');});
  for(const [device,name,t,inputs]of cases.filter(c=>c[0]===id)){
   const readout=await page.evaluate(({t,inputs})=>{const a=window.apparatusDemo;Object.assign(a.state.inputs,inputs);a.state.t=t;a.scene.model.reset?.(0,a.state.inputs);a.scene.model.update(t,a.state.inputs);return a.scene.model.readout?.(t,a.state.inputs)??a.definition.readout(t,a.state.inputs);},{t,inputs});
   await page.waitForTimeout(120);await page.screenshot({path:`qa/physics-fluids-${device}-${name}.png`});
   results.push({device,name,t,inputs,title:readout.title});
  }
  if(id==='piston-pump'){
   const continuous=await page.evaluate(()=>{const a=window.apparatusDemo;a.state.t=7.3;Object.assign(a.state.inputs,{speed:.25,_phaseOffset:0});a.scene.model.update(a.state.t,a.state.inputs);const slider=a.scene.model.root.getObjectByName('pump-piston-slider');const y=slider.position.y;a.setInput('speed',.7);const changed=slider.position.y;a.setInput('speed',0);a.state.t+=10;a.scene.model.update(a.state.t,a.state.inputs);return {y,changed,stopped:slider.position.y};});
   assert.ok(Math.abs(continuous.y-continuous.changed)<1e-8&&Math.abs(continuous.y-continuous.stopped)<1e-8,'browser speed changes and stop preserve piston position');
  }
  assert.deepEqual(errors,[],`${id} browser errors`);console.log(`${id}: snapshot states and no browser exceptions PASS`);await page.close();
 }
}finally{await browser.close();await writeFile('qa/physics-fluids-browser.md',`# Fluid browser evidence\n\nIsolated headless Chrome, 1440 × 1000. Generated ${new Date().toISOString()}. No page errors.\n\n${results.map(r=>`- ${r.device} / ${r.name}: t=${r.t}, ${JSON.stringify(r.inputs)} — ${r.title}; [screenshot](physics-fluids-${r.device}-${r.name}.png)`).join('\n')}\n`);}
