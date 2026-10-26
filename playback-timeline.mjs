// A native range supports mouse, touch, arrows, Home and End alike.
export function mountPlaybackTimeline(host,onSeek){
 const root=document.createElement('div');root.className='playback-timeline';
 root.innerHTML='<div class="playback-timeline-heading"><label for="demo-progress">演示进度</label><output for="demo-progress">0%</output></div><input id="demo-progress" type="range" min="0" max="1000" step="1" value="0" aria-label="演示进度" title="拖动定位，松开后暂停；点击播放继续">';
 host.append(root);const input=root.querySelector('input'),output=root.querySelector('output');
 input.addEventListener('pointerdown',e=>e.stopPropagation());
 input.addEventListener('input',()=>{if(!input.disabled)onSeek(Number(input.value)/1000);});
 return ({progress=0,hidden=false,disabled=false,text=''})=>{
  const value=Math.max(0,Math.min(1,progress)),percent=Math.round(value*100);
  root.hidden=hidden;input.disabled=disabled;
  input.value=String(Math.round(value*1000));input.style.setProperty('--played',`${value*100}%`);
  output.value=`${percent}%`;input.setAttribute('aria-valuetext',`${percent}%${text?'，'+text:''}`);
 };
}
