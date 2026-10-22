import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {catalog} from '../apparatus/catalog.mjs';
await mkdir('assets/home',{recursive:true});await mkdir('qa/apparatus',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const only=process.argv[2];
try{for(const d of catalog.slice(3).filter(d=>!only||d.id===only)){
 const page=await browser.newPage({viewport:{width:700,height:700},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:4198/${d.url}?thumbnail=1`);await page.waitForFunction(()=>window.apparatusDemo?.ready||window.apparatusError);const error=await page.evaluate(()=>window.apparatusError);if(error)throw Error(`${d.id}: ${error}`);
 if(await page.evaluate(()=>window.apparatusDemo.state.mode)!=='assembled')throw Error(`${d.id}: homepage thumbnail must show the assembled product`);
 await page.waitForTimeout(250);const data=await page.evaluate(()=>window.apparatusDemo.scene.renderer.domElement.toDataURL('image/png').split(',')[1]);await writeFile(`assets/home/${d.id}.png`,Buffer.from(data,'base64'));
 await page.setViewportSize({width:1280,height:900});await page.goto(`http://127.0.0.1:4198/${d.url}`);await page.waitForFunction(()=>window.apparatusDemo?.ready);await page.waitForFunction(()=>window.apparatusDemo.state.phase==='closed');await page.evaluate(()=>window.apparatusDemo.setPlaying(false));await page.screenshot({path:`qa/apparatus/${d.id}-run.png`});
 await page.locator('[data-mode="explode"]').click();await page.waitForFunction(()=>window.apparatusDemo.state.phase==='open');await page.screenshot({path:`qa/apparatus/${d.id}-explode.png`});
 const info=await page.evaluate(()=>{const a=window.apparatusDemo;return {parts:a.scene.records.length,meshes:a.scene.renderer.info.render.calls,triangles:a.scene.renderer.info.render.triangles,readout:a.definition.readout(a.state.t,a.state.inputs).title}});if(errors.length)throw Error(errors.join('\n'));console.log(d.id,JSON.stringify(info));await page.close();
}}finally{await browser.close();}
