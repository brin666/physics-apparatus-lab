import {mkdir,writeFile,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export const BASE='http://127.0.0.1:4198/';
export const ROOT=resolve('exports/2026-10-19-social-media');
export const FRAMES=join(ROOT,'_frames');
export const FPS=15;
export const FFMPEG=resolve('.tools/media-py/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
export const MEDIA_STYLE=`
html,body{height:100%;overflow:hidden!important}
body .lab-shell{height:100vh!important;min-height:0!important;padding:0 24px 18px!important;grid-template-rows:70px minmax(0,1fr) 174px!important}
body .masthead{margin-bottom:12px;flex-wrap:nowrap!important;justify-content:flex-start!important}
body .brand{gap:14px}body .brand h1{font-size:26px!important}body .brand .room-section{font-size:13px}
body .machine-nav{display:none!important}
body .teaching-footer{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto auto;gap:12px;padding-top:16px;align-content:start}
body .current-caption h2{font-size:20px!important;line-height:1.35}
body .current-caption p{font-size:14px!important;line-height:1.65;white-space:normal;max-width:100%;overflow:visible;text-overflow:clip}
body #cycle-overview,body #assembly-controls{grid-column:1!important;grid-row:2!important;min-height:60px}
body .assembly-control-top{display:none!important}
body .cycle-phase,body .assembly-step{font-size:15px!important;line-height:1.4;min-width:0}
body .assembly-step>span:first-child{white-space:normal;word-break:keep-all}
body .scene-top{top:18px!important;left:20px!important;right:18px!important}
body .scene-top h2{font-size:18px!important;line-height:1.4}
body .scene-top>span{font-size:13px!important}
body .scene-top #lesson-toggle{display:none!important}
body .scene-bottom{display:none!important}
body .thermal-legend{left:20px;top:62px;font-size:12px;gap:12px}
body .experiment-hud{top:65px;left:20px}
body #plot-toggle,body #mechanism-focus{display:none!important}
body .experiment-readouts{gap:16px}
body .experiment-readouts span{font-size:12px}body .experiment-readouts strong{font-size:23px}
body .cycle-overview-head #heat-direction{font-size:13px}
body .cycle-phase-meter{height:5px!important}
`;
export async function prepareFolders(){for(const name of ['gifs','videos','screenshots','_frames'])await mkdir(join(ROOT,name),{recursive:true});}
export async function applyMediaLayout(page){await page.addStyleTag({content:MEDIA_STYLE});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);}
export async function encodeFrames(frameDirectory,stem){
  await prepareFolders();
  const pattern=join(frameDirectory,'%04d.png'),gif=join(ROOT,'gifs',`${stem}.gif`),video=join(ROOT,'videos',`${stem}.mp4`);
  await exec(FFMPEG,['-y','-hide_banner','-loglevel','error','-framerate',String(FPS),'-i',pattern,'-filter_complex','[0:v]split[a][b];[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',gif],{maxBuffer:3*1024*1024});
  await exec(FFMPEG,['-y','-hide_banner','-loglevel','error','-framerate',String(FPS),'-i',pattern,'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',video],{maxBuffer:3*1024*1024});
  const files=(await readdir(frameDirectory)).filter(name=>name.endsWith('.png'));
  return {stem,frames:files.length,fps:FPS,duration:files.length/FPS,gifBytes:(await stat(gif)).size,videoBytes:(await stat(video)).size,gif,video};
}
export async function writeReport(name,data){await writeFile(join(ROOT,`${name}.json`),JSON.stringify(data,null,2));}
