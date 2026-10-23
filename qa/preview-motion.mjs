import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {catalog} from '../apparatus/catalog.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4198/');
 for(const device of catalog){
  const changes=await page.evaluate(async id=>{
   const video=document.createElement('video');video.muted=true;video.preload='auto';
   const blob=await (await fetch(`./assets/previews/${id}.webm`)).blob(),url=URL.createObjectURL(blob);
   try{
    await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=reject;video.src=url;});
    const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),frames=[];
    for(const t of [.4,1.5,2.8,4.2]){
     await new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=t;});
     ctx.drawImage(video,0,0);frames.push(ctx.getImageData(0,0,canvas.width,canvas.height).data);
    }
    return frames.slice(1).map(frame=>{let count=0;for(let i=0;i<frame.length;i+=4)if(Math.max(...[0,1,2].map(c=>Math.abs(frame[i+c]-frames[0][i+c])))>25)count++;return count;});
   }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
  },device.id);
  assert(Math.max(...changes)>80,`${device.id}: motion not visible in decoded frames (${changes})`);
  console.log(`${device.id}: changed pixels ${changes.join(', ')} PASS`);
 }
}finally{await browser.close();}
