import {catalog,categories,relations} from './apparatus/catalog.mjs';
const $=s=>document.querySelector(s),popup=$('#hover-preview'),mobile=matchMedia('(max-width:600px)'),fine=matchMedia('(hover:hover) and (pointer:fine)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
// Bounds are regenerated with the front-view thumbnails.
import thumbnailBounds from './assets/home/framing.json';
// Keep the preview-free diagnostic URL available for browser troubleshooting.
const livePreviewsEnabled=new URLSearchParams(location.search).get('preview')!=='off';
const state={category:'all',query:'',selected:null};let showTimer,hideTimer,readyTimer,previewVideo,generation=0;
$('#category-tabs').innerHTML=categories.map(c=>`<button data-category="${c.id}" aria-pressed="${c.id==='all'}">${c.name}</button>`).join('');
$('#map-nodes').innerHTML=catalog.map(d=>`<a class="apparatus" data-device="${d.id}" href="./${d.url}" aria-label="${d.name}，${d.summary}"><svg class="apparatus-model" viewBox="${thumbnailBounds[d.id].slice(0,4).join(' ')}" preserveAspectRatio="xMidYMax meet" role="img" aria-label="${d.name}完整模型"><image href="${window.HOME_IMAGES?.[d.id]||d.image}" width="${thumbnailBounds[d.id][4]}" height="${thumbnailBounds[d.id][5]}"/></svg><span class="apparatus-name">${d.name}</span></a>`).join('');
const nodes=[...document.querySelectorAll('.apparatus')];
let columns=0;
function arrange(){
 const next=innerWidth<=600?2:innerWidth<=1000?3:5;
 columns=next;
 const visible=nodes.filter(n=>!n.classList.contains('is-muted'));
 const rows=[];
 for(let i=0;i<visible.length;i+=columns){
  const row=document.createElement('div');row.className='shelf-row';
  row.style.setProperty('--columns',columns);row.style.setProperty('--row',rows.length);
  row.append(...visible.slice(i,i+columns));rows.push(row);
 }
 $('#map-nodes').replaceChildren(...rows);
 $('#filtered-nodes').replaceChildren(...nodes.filter(n=>n.classList.contains('is-muted')));
}
addEventListener('resize',()=>{closePreview();if(columns!==(innerWidth<=600?2:innerWidth<=1000?3:5))arrange();});
addEventListener('scroll',()=>{if(!mobile.matches)closePreview();},{passive:true});
function filter(){closePreview();let count=0;nodes.forEach(n=>{const d=catalog.find(d=>d.id===n.dataset.device),match=(state.category==='all'||d.category===state.category)&&(!state.query||(d.name+d.summary).includes(state.query));n.classList.toggle('is-muted',!match);n.tabIndex=match?0:-1;count+=match?1:0;});$('#room-count').textContent=`${count} 件互动教具`;$('#empty-result').hidden=!!count;document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===state.category)));arrange();}
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{state.category=b.dataset.category;filter();});$('#device-search').addEventListener('input',e=>{state.query=e.target.value.trim();filter();});
function highlight(id){nodes.forEach(n=>n.classList.toggle('is-current',n.dataset.device===id));}
function closePreview(){clearTimeout(showTimer);clearTimeout(hideTimer);clearTimeout(readyTimer);generation++;popup.hidden=true;if(previewVideo){previewVideo.pause();previewVideo.removeAttribute('src');previewVideo.load();previewVideo.remove();}previewVideo=null;state.selected=null;highlight(null);}
function deferClose(){clearTimeout(showTimer);clearTimeout(hideTimer);hideTimer=setTimeout(closePreview,220);}
function positionPreview(node){if(mobile.matches)return;const r=node.getBoundingClientRect(),width=popup.offsetWidth,height=popup.offsetHeight||450;let left=r.right+14;if(left+width>innerWidth-16)left=r.left-width-14;left=Math.max(16,Math.min(left,innerWidth-width-16));const top=Math.max(16,Math.min(r.top-20,innerHeight-height-16));popup.style.left=`${left}px`;popup.style.top=`${top}px`;}
function showPreview(node){clearTimeout(hideTimer);if(!livePreviewsEnabled||!node||node.classList.contains('is-muted'))return;const d=catalog.find(d=>d.id===node.dataset.device);if(state.selected===d.id&&!popup.hidden)return;closePreview();const token=++generation;state.selected=d.id;highlight(d.id);$('#preview-name').textContent=d.name;$('#preview-enter').href='./'+d.url;$('#preview-loading').hidden=false;$('#preview-loading').textContent='正在载入运行演示…';popup.hidden=false;positionPreview(node);
 const video=document.createElement('video');previewVideo=video;
 video.muted=true;video.loop=true;video.playsInline=true;video.preload='auto';video.tabIndex=-1;
 video.setAttribute('aria-label',`${d.name}运行动态`);video.setAttribute('disablepictureinpicture','');
 video.src=`./assets/previews/${d.id}.webm?v=0.3.0`;$('#preview-stage').append(video);
 video.addEventListener('loadeddata',()=>{if(token!==generation)return;clearTimeout(readyTimer);$('#preview-loading').hidden=true;if(!reduced.matches)video.play().catch(()=>{});},{once:true});
 const unavailable=()=>{if(token!==generation)return;clearTimeout(readyTimer);$('#preview-loading').hidden=false;$('#preview-loading').textContent='预览暂时未载入，可直接进入教具。';};
 video.addEventListener('error',unavailable,{once:true});
 readyTimer=setTimeout(unavailable,15000);

}
nodes.forEach(node=>{node.addEventListener('pointerenter',()=>{if(!fine.matches||!livePreviewsEnabled)return;clearTimeout(hideTimer);clearTimeout(showTimer);showTimer=setTimeout(()=>showPreview(node),300);});node.addEventListener('pointerleave',deferClose);node.addEventListener('focus',()=>{if(!fine.matches||!livePreviewsEnabled)return;clearTimeout(showTimer);showTimer=setTimeout(()=>showPreview(node),300);});node.addEventListener('click',e=>{if(!fine.matches&&livePreviewsEnabled){e.preventDefault();showPreview(node);}});});
popup.addEventListener('pointerenter',()=>clearTimeout(hideTimer));popup.addEventListener('pointerleave',deferClose);popup.addEventListener('focusin',()=>clearTimeout(hideTimer));document.addEventListener('focusin',e=>{if(!e.target.closest('.apparatus')&&!popup.contains(e.target))closePreview();});$('#preview-close').onclick=()=>{const selected=nodes.find(n=>n.dataset.device===state.selected);closePreview();selected?.focus({preventScroll:true});clearTimeout(showTimer);};addEventListener('keydown',e=>{if(e.key==='Escape')closePreview();});document.addEventListener('pointerdown',e=>{if(!popup.contains(e.target)&&!e.target.closest('.apparatus'))closePreview();});document.addEventListener('visibilitychange',()=>{if(document.hidden)closePreview();});addEventListener('pagehide',closePreview);
window.apparatusMap={state,catalog,relations,showPreview:id=>showPreview(nodes.find(n=>n.dataset.device===id)),closePreview,fit:arrange};arrange();

$('#preview-enter').addEventListener('click',async e=>{
 if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||reduced.matches)return;
 e.preventDefault();const link=e.currentTarget,href=link.href;
 const motion=link.animate([{transform:'scale(1)'},{transform:'scale(.97)',offset:.4},{transform:'scale(1)'}],{duration:170,easing:'ease-out'});
 await motion.finished.catch(()=>{});location.assign(href);
});
