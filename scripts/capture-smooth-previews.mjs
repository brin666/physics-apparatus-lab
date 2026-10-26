// Authoring entry point: supply an existing ego-browser Page from your task.
// Requires the local development server, WebCodecs and FFmpeg; no new browser
// or task space is created here. Published pages only consume the output files.
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {catalog} from '../apparatus/catalog.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function captureSmoothPreviews(page,ids=catalog.map(d=>d.id),baseURL='http://127.0.0.1:4198'){
 await mkdir(new URL('../.tools/smooth-previews/',import.meta.url),{recursive:true});
 const encode=args=>{const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{cwd:root,encoding:'utf8'});if(r.error||r.status!==0)throw Error(r.error?.message||r.stderr);};
 for(const id of ids){
  const device=catalog.find(d=>d.id===id);if(!device)throw Error(`Unknown apparatus: ${id}`);
  await page.cdp('Emulation.setDeviceMetricsOverride',{width:480,height:416,deviceScaleFactor:1,mobile:false});
  await page.goto(`${baseURL}/${device.url}?preview=1`);
  await page.waitForFunction(()=>window.apparatusDemo?.ready||window.previewReady,undefined,{timeout:30000});
  const result=await page.evaluate(async id=>(await import('/scripts/render-preview-frames.mjs')).renderPreviewFrames(id),id);
  const raw=`.tools/smooth-previews/${id}.h264`;
  await writeFile(new URL('../'+raw,import.meta.url),Buffer.from(result.data,'base64'));delete result.data;
  encode(['-r',String(result.fps),'-i',raw,'-an','-c:v','libx264','-preset','slow','-crf','25','-profile:v','baseline','-bf','0','-pix_fmt','yuv420p','-g',String(result.fps),'-movflags','+faststart',`assets/previews/${id}.mp4`]);
  encode(['-i',`assets/previews/${id}.mp4`,'-c:v','libvpx-vp9','-b:v','0','-crf','34','-row-mt','1','-threads','2','-an',`assets/previews/${id}.webm`]);
  console.log({id,...result});
 }
}
