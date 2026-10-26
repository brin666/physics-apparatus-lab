// Recompress fixed-step 30 fps master WebM clips. This cannot repair a jittery
// recording; regenerate it with render-preview-frames.mjs first.
import {spawnSync} from 'node:child_process';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {catalog} from '../apparatus/catalog.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
let before=0,after=0;
for(const {id} of catalog){
 const source=`assets/previews/${id}.webm`,target=`assets/previews/${id}.mp4`;
 // Decode alpha explicitly and flatten on white, including legacy recordings.
 const args=['-hide_banner','-loglevel','error','-y','-c:v','libvpx-vp9','-i',source,
  '-filter_complex','[0:v]scale=480:416:flags=lanczos,fps=30,split[fg][bg];[bg]drawbox=c=white:t=fill:replace=1[white];[white][fg]overlay=shortest=1,format=yuv420p[out]',
  '-map','[out]','-an','-c:v','libx264','-preset','slow','-crf','25','-profile:v','baseline','-bf','0','-g','30','-keyint_min','30','-sc_threshold','0','-movflags','+faststart',target];
 const run=spawnSync('ffmpeg',args,{cwd:root,stdio:'inherit'});if(run.status!==0)throw Error(`Encoding failed: ${id}`);
 const a=(await stat(new URL('../'+source,import.meta.url))).size,b=(await stat(new URL('../'+target,import.meta.url))).size;
 before+=a;after+=b;console.log(`${id}: ${a} -> ${b} bytes`);
}
console.log(`Total: ${before} -> ${after} bytes (${Math.round(100*(1-after/before))}% smaller)`);
