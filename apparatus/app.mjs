import {findDevice} from './registry.mjs';
import {catalog,categories} from './catalog.mjs';
import {createApparatusScene} from './scene.mjs';
import {createWhiteboard} from '../whiteboard.mjs';
import {hasGuidedOperation} from './preview-inputs.mjs';
import {mountPlaybackTimeline} from '../playback-timeline.mjs';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],params=new URLSearchParams(location.search),preview=params.has('preview'),staticView=params.has('thumbnail'),definition=findDevice(document.body.dataset.apparatus);
if(preview||staticView)document.body.classList.add('preview');
let scene,whiteboard,timeline,renderId=0,ready=false;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function controlMarkup(c){return `<label class="variable-control" for="input-${c.id}"><span>${esc(c.label)}${c.options?'':`<output id="value-${c.id}"></output>`}</span>${c.options?`<select id="input-${c.id}" data-input="${c.id}">${c.options.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select>`:`<input id="input-${c.id}" data-input="${c.id}" type="range" min="${c.min}" max="${c.max}" step="${c.step||.01}" value="${c.value}">`}</label>`;}
function selected(part){$('#part-inspector').hidden=!part;if(part){$('#part-name').textContent=part.name;$('#part-function').textContent=part.description;}$$('[data-part]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.part===part?.id)));}
function togglePanel(name,on){const panel=$(`#${name}-panel`),button=$(`#${name}-toggle`);panel.hidden=!on;button.setAttribute('aria-expanded',String(on));if(on){const other=name==='lesson'?'variables':'lesson';$(`#${other}-panel`).hidden=true;$(`#${other}-toggle`).setAttribute('aria-expanded','false');}}
function lessonReadout(){return scene.model.readout?.(scene.state.t,scene.state.inputs)??definition.readout(scene.state.t,scene.state.inputs);}
function render(){if(!scene)return;const {state}=scene,isIntro=state.phase==='intro',exploded=state.mode==='explode',moving=['opening','closing'].includes(state.phase),running=state.playing&&!moving&&!exploded;
 if(definition.actions){const actions=$('#teaching-actions');if(actions){actions.hidden=isIntro||exploded||moving;actions.querySelectorAll('button').forEach(b=>{b.disabled=state.frozen;b.setAttribute('aria-pressed',String((state.action?.id||'cycle')===b.dataset.action));});}}
 timeline?.({progress:scene.progress(),hidden:isIntro||exploded||moving,disabled:state.frozen,text:lessonReadout().title});
 document.body.classList.toggle('playing',running);document.body.classList.toggle('paused',!running||state.frozen);$('#play-text').textContent=exploded?'组装运行':moving?'正在组装':running?(isIntro?'暂停组装':'暂停演示'):(isIntro?'继续组装':'播放演示');$('#play').disabled=moving;
 $$('[data-part]').forEach(b=>{const part=scene.records.find(r=>r.id===b.dataset.part);b.hidden=part?.object.userData.modelVisible===false||!!part?.object.userData.studyHidden||!!part?.object.userData.hideWhenExploded&&(exploded||moving);});
 $('#part-tools').hidden=!exploded;$('#part-reset').disabled=!state.selected;$('.speed-label').hidden=exploded;
 $$('[data-mode]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode));if(b.dataset.mode==='explode')b.textContent=exploded?'装回':'拆解';if(b.dataset.mode==='cut')b.textContent=definition.cutLabel||'剖切';});
 const section=definition.id==='dc-motor'&&state.mode==='cut'&&!isIntro;$('#section-legend').hidden=!section;
 $('#skip-intro').hidden=!isIntro;$('#stage-subtitle').textContent=isIntro?'组装入场':exploded?'总成拆解 · 自由观察':section?'横截面示意 · 两侧有效导线截面已放大':(definition.viewDescriptions?.[state.mode]||definition.summary);
 const lesson=lessonReadout(),parts=scene.records,step=isIntro?Math.min(parts.length-1,Math.floor(state.elapsed/3.8*parts.length)):Math.max(0,Math.min(definition.stages.length-1,lesson.phaseIndex||0));
 $('#caption-title').textContent=isIntro?parts[step].name:exploded?'拆开，观察部件的连接':lesson.title;
 $('#caption-text').textContent=isIntro?parts[step].description:exploded?'按住零件旋转，切换「移动」调整位置，再组装回去。':lesson.text;
 $('#progress-label').textContent=isIntro?'正在组装':exploded?'结构观察':definition.stages[step]?.title||'';
 const stages=isIntro?parts.map(p=>({name:p.name})):definition.stages;
 const track=$('#phase-track');const key=(isIntro?'a':'s')+definition.id;if(track.dataset.key!==key){track.dataset.key=key;track.innerHTML=stages.map(s=>`<div title="${esc(s.name)}"><em>${esc(s.name)}</em><span><i></i></span></div>`).join('');}
 [...track.children].forEach((el,i)=>{el.classList.toggle('current',i===step&&!exploded);el.querySelector('i').style.transform=`scaleX(${exploded?0:isIntro?Math.max(0,Math.min(1,state.elapsed/3.8*parts.length-i)):i<step?1:i===step?.72:0})`;});
 // Each device's inputs are its own experiment; no fabricated universal measurements.
 $('#readouts').innerHTML=(lesson.values||[]).map(v=>`<div><span>${esc(v.label)}</span><strong>${esc(v.value)}<small>${esc(v.unit||'')}</small></strong></div>`).join('');
 definition.controls.forEach(c=>{const el=$(`#input-${c.id}`);if(el&&document.activeElement!==el)el.value=state.inputs[c.id];const out=$(`#value-${c.id}`);if(out)out.textContent=`${Number(state.inputs[c.id]).toFixed((String(c.step||.01).split('.')[1]||'').length)} ${c.unit||''}`;});
}
try{
 $('#category-name').textContent=categories.find(c=>c.id===catalog.find(d=>d.id===definition.id).category)?.name||'';
 $('#device-switch').innerHTML=catalog.map(d=>`<option value="${d.url}"${d.id===definition.id?' selected':''}>${d.name}</option>`).join('');$('#device-switch').addEventListener('change',e=>location.href='./'+e.target.value);
 $('#device-controls').innerHTML=definition.controls.map(controlMarkup).join('')+(hasGuidedOperation(definition.id)?'<p class="variable-hint">调节参数会暂停自动演示；点击播放继续。</p>':'');$('#principle').textContent=definition.principle;$('#model-notes').textContent=definition.notes;
 $('#source-list').innerHTML=(definition.sources||[]).map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.label)} ↗</a></li>`).join('');
 scene=createApparatusScene($('#device-canvas'),definition,{onSelect:selected,onInput:render,onChange:render,preview:preview||staticView,staticView});
 timeline=mountPlaybackTimeline($('.teaching-progress'),value=>scene.seek(value));
 if(definition.actions){const actions=document.createElement('div');actions.id='teaching-actions';actions.className='teaching-actions';actions.innerHTML=definition.actions.map(a=>`<button data-action="${a.id}">${a.label}</button>`).join('')+'<button data-action="cycle">循环演示</button>';$('.device-stage').append(actions);actions.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)scene.runAction(b.dataset.action==='cycle'?null:b.dataset.action);});}
 if(matchMedia('(prefers-reduced-motion:reduce)').matches&&!preview&&!staticView){scene.state.phase='closed';scene.state.playing=false;scene.state.mode=definition.defaultMode||'assembled';}
 $('#part-list').innerHTML=scene.records.map(p=>`<button data-part="${p.id}" aria-pressed="false">${esc(p.name)}</button>`).join('');
 $$('[data-input]').forEach(el=>el.addEventListener('input',()=>scene.setInput(el.dataset.input,el.value)));
 $$('[data-part]').forEach(b=>b.addEventListener('click',()=>{scene.select(b.dataset.part);togglePanel('lesson',false);}));
 $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{scene.mode(b.dataset.mode==='explode'&&scene.state.mode==='explode'?'assembled':b.dataset.mode);togglePanel('variables',false);}));
 $$('[data-view]').forEach(b=>b.addEventListener('click',()=>scene.view(b.dataset.view)));
 $$('[data-tool]').forEach(b=>b.addEventListener('click',()=>{scene.state.tool=b.dataset.tool;$$('[data-tool]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
 $('#part-reset').addEventListener('click',()=>scene.resetPart());$('#inspector-close').addEventListener('click',()=>scene.select(null));
 $('#play').addEventListener('click',()=>{scene.select(null);if(scene.state.mode==='explode')scene.assemble();else if(scene.state.action&&scene.state.t>=scene.state.action.start+12)scene.runAction(null);else scene.state.playing=!scene.state.playing;render();});$('#speed').addEventListener('change',e=>scene.state.speed=Number(e.target.value));
 for(const name of ['lesson','variables']){$(`#${name}-toggle`).addEventListener('click',()=>togglePanel(name,$(`#${name}-panel`).hidden));$(`#${name}-close`).addEventListener('click',()=>togglePanel(name,false));}
 $('#replay').addEventListener('click',()=>{togglePanel('lesson',false);scene.intro();});$('#skip-intro').addEventListener('click',()=>{scene.state.elapsed=3.8;scene.state.playing=true;});
 if(!preview&&!staticView){
 whiteboard=createWhiteboard({model:$('#model-surface'),storageKey:`physics-whiteboard-${definition.id}`,getContext:()=>({title:definition.name,detail:lessonReadout().title,snapshot:scene.snapshot()}),onOpen:()=>{scene.freeze(true);scene.orbit.enabled=false;render();},onClose:()=>{scene.freeze(false);scene.orbit.enabled=true;render();},onViewAction:action=>scene.view(action),onRestoreContext:saved=>{scene.restore(saved);render();},onInteractionChange:mode=>{scene.orbit.enabled=mode==='model';}});
 $('#whiteboard-open').addEventListener('click',()=>whiteboard.open());
 }
 document.addEventListener('visibilitychange',()=>scene.state.visible=!document.hidden);
 addEventListener('keydown',e=>{if(whiteboard?.isOpen)return;if(e.key==='Escape'){scene.select(null);togglePanel('lesson',false);togglePanel('variables',false);}if(e.code==='Space'&&!/INPUT|SELECT|BUTTON|A|TEXTAREA/.test(e.target.tagName)){e.preventDefault();$('#play').click();}});
 let lastUi=0;function ui(now){if(now-lastUi>100&&!document.hidden){render();lastUi=now;}renderId=requestAnimationFrame(ui);}render();renderId=requestAnimationFrame(ui);ready=true;
 window.apparatusDemo={definition,scene,state:scene.state,whiteboard,get ready(){return ready;},setMode:scene.mode,setInput:scene.setInput,setPlaying(value){scene.state.playing=!!value;render();},finishAssembly(){scene.state.elapsed=3.8;scene.state.playing=true;},selectPart:scene.select,startAssembly:scene.intro};
 addEventListener('pagehide',event=>{if(event.persisted){scene.state.visible=false;return;}cancelAnimationFrame(renderId);scene.dispose();});
 addEventListener('pageshow',()=>scene.state.visible=!document.hidden);
}catch(error){$('#load-error').hidden=false;console.error(error);window.apparatusError=error.message;}
