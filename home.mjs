const root=document.documentElement;
const links=[...document.querySelectorAll('.apparatus')];
const engine=document.querySelector('.apparatus-engine');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const hover=matchMedia('(hover: hover) and (pointer: fine)');
const arrivalKey='physics-room-arrival-v1';
const easeOut='cubic-bezier(0.23, 1, 0.32, 1)';
let firstVisit=true;
try{firstVisit=!sessionStorage.getItem(arrivalKey);sessionStorage.setItem(arrivalKey,'1');}catch{}

let current=engine,userInteracted=false,leaving=false,hoverTimer,playIntent=0;
let frame=null,previewPromise=null,previewApi=null,previewFailed=false;
let previewError=null,arrivalPlayed=false,arriving=false,navigationTimer;
const animations=new Set();

function animate(element,keyframes,options){
  const animation=element.animate(keyframes,options);
  animations.add(animation);
  animation.finished.catch(()=>{}).finally(()=>animations.delete(animation));
  return animation;
}
function setCurrent(link=engine){
  current=link;
  for(const item of links)item.classList.toggle('is-current',item===link);
}
function finishArrival(){
  root.classList.remove('room-arriving');arriving=false;
  for(const animation of animations)animation.cancel();
  animations.clear();
}
async function arrive(){
  if(!firstVisit||reduced.matches){root.classList.remove('room-arriving');return;}
  arriving=true;arrivalPlayed=true;
  await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));
  if(!arriving||reduced.matches)return;
  const heading=animate(document.querySelector('.room-heading'),[
    {opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}
  ],{duration:340,easing:easeOut,fill:'both'});
  const order=['engine','fridge','ac'];
  const entrances=links.map(link=>animate(link.querySelector('.apparatus-display'),[
    {opacity:0,transform:'translateY(24px) scale(0.97)'},{opacity:1,transform:'translateY(0) scale(1)'}
  ],{duration:450,delay:180+order.indexOf(link.dataset.device)*60,easing:easeOut,fill:'both'}));
  await Promise.all([heading,...entrances].map(animation=>animation.finished.catch(()=>{})));
  if(!leaving)finishArrival();
}

function ensurePreview(){
  if(previewPromise)return previewPromise;
  if(previewFailed||!window.HOME_ENGINE_DOCUMENT)return Promise.resolve(null);
  previewPromise=new Promise(resolve=>{
    let settled=false;
    const created=document.createElement('iframe');
    created.className='engine-live';created.title='汽油机运行预览';
    created.setAttribute('aria-hidden','true');created.tabIndex=-1;
    frame=created;
    const complete=api=>{
      if(settled)return;settled=true;clearTimeout(timeout);
      removeEventListener('message',ready);
      if(!api){previewFailed=true;created.remove();frame=null;}
      previewApi=api;resolve(api);
    };
    const ready=event=>{
      if(event.source!==created.contentWindow)return;
      if(event.data?.type==='home-engine-ready')complete(created.contentWindow.homeEnginePreview?.ready?created.contentWindow.homeEnginePreview:null);
      if(event.data?.type==='home-engine-error')complete(null);
    };
    addEventListener('message',ready);
    created.addEventListener('load',()=>{
      try{if(created.contentWindow.homeEnginePreview?.ready)complete(created.contentWindow.homeEnginePreview);}catch{}
    });
    created.addEventListener('error',()=>complete(null),{once:true});
    const timeout=setTimeout(()=>{previewError='preview timed out';complete(null);},15000);
    created.srcdoc=window.HOME_ENGINE_DOCUMENT;
    engine.querySelector('.apparatus-preview').append(created);
  });
  return previewPromise;
}
function stopPreview(){
  const intent=++playIntent;
  clearTimeout(hoverTimer);
  previewApi?.pause();
  engine.classList.remove('is-previewing');
  setTimeout(()=>{if(intent===playIntent)previewApi?.reset();},200);
}
async function playPreview(loop=false){
  if(reduced.matches||leaving||document.hidden)return;
  const intent=++playIntent;
  const api=await ensurePreview();
  if(!api||intent!==playIntent||reduced.matches||leaving||document.hidden)return;
  try{
    api.reset();
    if(api.play({duration:2400,loop})!==false)engine.classList.add('is-previewing');
  }catch(error){previewError=error.message;stopPreview();}
}
addEventListener('message',event=>{
  if(event.source!==frame?.contentWindow)return;
  if(event.data?.type==='home-engine-ended')engine.classList.remove('is-previewing');
  if(event.data?.type==='home-engine-error'){
    previewError=String(event.data.message||'preview unavailable');
    stopPreview();
  }
});

for(const link of links){
  link.addEventListener('pointerenter',()=>{
    if(!hover.matches||leaving)return;
    userInteracted=true;setCurrent(link);clearTimeout(hoverTimer);
    if(link!==engine){stopPreview();return;}
    hoverTimer=setTimeout(()=>playPreview(true),200);
  });
  link.addEventListener('pointerleave',()=>{
    if(!hover.matches||leaving)return;
    stopPreview();
    const focused=links.find(item=>item.contains(document.activeElement));
    setCurrent(focused||engine);
  });
  link.addEventListener('focusin',()=>{
    userInteracted=true;stopPreview();setCurrent(link);
  });
  link.addEventListener('focusout',()=>{
    if(!leaving)queueMicrotask(()=>setCurrent(links.find(item=>item.contains(document.activeElement))||engine));
  });
  link.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target||link.hasAttribute('download'))return;
    userInteracted=true;stopPreview();
    // Keyboard, touch, and reduced motion retain native, immediate navigation.
    if(event.detail===0||!hover.matches||reduced.matches)return;
    event.preventDefault();if(leaving)return;
    finishArrival();leaving=true;root.classList.add('room-leaving');link.classList.add('is-opening');
    for(const item of links){
      animate(item.querySelector('.apparatus-display'),item===link?[
        {opacity:1,transform:'scale(1)'},{opacity:1,transform:'scale(1.045)'}
      ]:[{opacity:1},{opacity:0}],{duration:220,easing:easeOut,fill:'both'});
    }
    animate(document.querySelector('.room-heading'),[{opacity:1},{opacity:.25}],{duration:220,easing:easeOut,fill:'both'});
    navigationTimer=setTimeout(()=>location.assign(link.href),220);
  });
}

function restore(){
  clearTimeout(navigationTimer);leaving=false;root.classList.remove('room-leaving');
  for(const item of links)item.classList.remove('is-opening');
  finishArrival();stopPreview();setCurrent();
}
addEventListener('pageshow',event=>{if(event.persisted)restore();});
addEventListener('pagehide',stopPreview);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){stopPreview();finishArrival();}
});
reduced.addEventListener('change',()=>{if(reduced.matches){stopPreview();finishArrival();}});

const arrival=arrive();
arrival.then(()=>{
  if(firstVisit&&!userInteracted&&!reduced.matches&&!document.hidden&&!leaving){
    setTimeout(()=>{if(!userInteracted&&!leaving)playPreview();},180);
  }
});

window.homeRoom={
  get arriving(){return arriving;},get arrivalPlayed(){return arrivalPlayed;},
  get selected(){return current?.dataset.device;},get navigating(){return leaving;},
  get previewReady(){return !!previewApi?.ready;},get previewRunning(){return !!previewApi?.running;},
  get previewError(){return previewError;},get previewFrame(){return frame;}
};
