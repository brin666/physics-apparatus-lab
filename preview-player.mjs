// One playing video, at most three retained decoders. No extra WebGL scene.
export function createPreviewPlayer(stage,status,placeholder,reduced){
 const pool=new Map();let active=null,cleanup=()=>{};
 function release(video){video.pause();video.removeAttribute('src');video.load();video.remove();}
 function prepare(device){
  let video=pool.get(device.id);
  if(video?.error){pool.delete(device.id);release(video);video=null;}
  if(video){pool.delete(device.id);pool.set(device.id,video);return video;}
  video=document.createElement('video');video.muted=true;video.loop=true;video.playsInline=true;video.preload='auto';video.tabIndex=-1;
  video.setAttribute('aria-label',`${device.name}运行动态`);video.setAttribute('disablepictureinpicture','');
  const mp4=!!video.canPlayType('video/mp4; codecs="avc1.42E01E"');
  video.dataset.format=mp4?'mp4':'webm';
  const source=()=>`./assets/previews/${device.id}.${video.dataset.format}?v=0.3.2`;
  video.addEventListener('error',()=>{
   if(video.dataset.format==='mp4'){video.dataset.format='webm';video.src=source();video.load();}
   else video.dataset.failed='true';
  });
  video.src=source();pool.set(device.id,video);video.load();
  while(pool.size>3){const candidate=[...pool].find(([,v])=>v!==active&&v!==video);if(!candidate)break;pool.delete(candidate[0]);release(candidate[1]);}
  return video;
 }
 function close(){cleanup();cleanup=()=>{};if(active){active.pause();active.remove();active=null;}stage.classList.remove('is-playing');}
 function show(device,art){
  close();placeholder.replaceChildren(art.cloneNode(true));placeholder.hidden=false;status.hidden=true;
  // Reduced motion still offers an immediate model and the detail-page link.
  if(reduced.matches)return;
  const video=prepare(device);active=video;stage.append(video);
  const listeners=new AbortController();let frame=null,started=false;
  const reveal=()=>{if(active!==video||started)return;started=true;video.dataset.presented='true';clearTimeout(slow);clearTimeout(timeout);status.hidden=true;stage.classList.add('is-playing');};
  const unavailable=()=>{status.hidden=false;status.textContent='预览暂时未载入，可直接进入教具。';};
  const slow=setTimeout(()=>{status.hidden=false;status.textContent='正在准备演示…';},900);
  const timeout=setTimeout(unavailable,15000);
  let requested=false;
  const play=()=>{
   if(requested||active!==video||video.readyState<2)return;
   // A first decoded frame is not enough to sustain motion on a jittery link.
   // Keep the model visible until we have a short runway (or the whole tail).
   let ahead=0;for(let i=0;i<video.buffered.length;i++)if(video.buffered.start(i)<=video.currentTime+.05&&video.buffered.end(i)>video.currentTime)ahead=video.buffered.end(i)-video.currentTime;
   if(ahead<Math.min(1.25,Math.max(0,(video.duration||Infinity)-video.currentTime))-.03)return;
   requested=true;
   video.play().catch(()=>{if(active===video)unavailable();});
  };
  for(const event of ['loadeddata','progress','canplay','canplaythrough'])video.addEventListener(event,play,{signal:listeners.signal});
  video.addEventListener('error',()=>{requested=false;if(video.dataset.failed==='true'){clearTimeout(slow);clearTimeout(timeout);unavailable();}},{signal:listeners.signal});
  if(video.requestVideoFrameCallback)frame=video.requestVideoFrameCallback(reveal);
  else video.addEventListener('playing',reveal,{once:true,signal:listeners.signal});
  if(video.readyState>=2){if(video.dataset.presented==='true')reveal();play();}
  cleanup=()=>{listeners.abort();clearTimeout(slow);clearTimeout(timeout);if(frame!==null)video.cancelVideoFrameCallback(frame);};
 }
 function clear(){close();for(const video of pool.values())release(video);pool.clear();}
 return {show,close,clear,prepare,inspect:()=>({cached:[...pool.keys()],playing:[...pool].filter(([,v])=>!v.paused).map(([id])=>id)})};
}
