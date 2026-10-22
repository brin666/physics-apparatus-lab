import {mountLegacyPreview} from './legacy-preview.mjs';
import {COOLING_MACHINES,getCoolingLesson,coolingAt,assemblyAt,ASSEMBLY_DURATION} from './refrigeration-model.mjs';
import {createWhiteboard} from './whiteboard.mjs';
import {mountSpeedControl} from './speed-control.mjs';
import {mountCycleProgress} from './cycle-progress.mjs';
import {coolingAssemblyOwners} from './cooling-exploration.mjs';
const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
const kind=document.body.dataset.machine==='ac'?'ac':'fridge',machine=COOLING_MACHINES[kind],displayName=kind==='ac'?'空调':machine.name;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
mountSpeedControl($('#speed'));
const cycleProgress=mountCycleProgress($('#cycle-overview'));
const DEFAULT_MODE='xray';
const state={kind,operation:'cool',progress:0,playing:false,speed:1,mode:reduced.matches?DEFAULT_MODE:'cut',selected:null,view:'3d',visible:true,labels:true,reduced:reduced.matches,interaction:'lesson',chapter:'cycle',assembly:{active:!reduced.matches,time:0,running:!reduced.matches}};
const frame=$('#machine'),CYCLE_SECONDS=16;
let explorationPhase='closed',resumeAfterAssembly=false;
let ready=false,raf=0,lastTime=0,lastPost=0,hasPlayed=false,lessonOpen=false,lessonSection='structure',closeTimer=0,lastStage='',lastAssembly=-1,reveal=false,whiteboard;
$('#parts').innerHTML=machine.parts.map(part=>`<button data-part-id="${part.id}" aria-pressed="false"><span>${part.no}</span>${part.name}</button>`).join('');
$('#stages').innerHTML=getCoolingLesson(kind).stages.map((stage,i)=>`<button data-stage="${i}" aria-pressed="false">${stage.name}</button>`).join('');
$('#assembly-steps').innerHTML=machine.assemblies.map((step,i)=>`<button class="cycle-phase assembly-step" data-assembly-step="${i}" title="${step.name}" aria-label="查看第${i+1}步：${step.name}"><span class="assembly-step-label">${step.short}</span><span class="cycle-phase-meter" aria-hidden="true"><i></i></span></button>`).join('');
const assemblyProgress=mountCycleProgress($('#assembly-steps'),{pulseCycles:4});
document.documentElement.style.setProperty('--assembly-count',machine.assemblies.length);
$('#operation-switch').hidden=kind!=='ac';
const scene=()=>{try{return frame.contentWindow.coolingScene;}catch{return null;}};
const say=text=>{$('#interaction-status').textContent=text;};
const viewAction=(action,view)=>frame.contentWindow?.postMessage({type:'cooling-view',action,view},'*');
function post(force=false){
  if(!ready)return;const now=performance.now();if(!force&&now-lastPost<30)return;lastPost=now;
  frame.contentWindow.postMessage({type:'cooling-state',...state,visible:state.visible&&state.view==='3d'},'*');
}
function syncTabs(){
  $$('[data-lesson-section]').forEach(button=>{const on=button.dataset.lessonSection===lessonSection;button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;});
  $('#lesson-structure').hidden=lessonSection!=='structure';$('#lesson-cycle').hidden=lessonSection!=='cycle';
}
function showLesson(open,{instant=false}={}){
  const panel=$('#lesson-panel');clearTimeout(closeTimer);lessonOpen=open;
  $('#lesson-toggle').setAttribute('aria-expanded',String(open));panel.classList.toggle('instant',instant||state.reduced);
  if(open){
    if(state.assembly.active){state.assembly.running=false;stopClock();}
    panel.hidden=false;panel.inert=false;panel.getBoundingClientRect();panel.classList.add('is-open');
  }else{
    panel.classList.remove('is-open');panel.inert=true;
    if(panel.contains(document.activeElement))$('#lesson-toggle').focus({preventScroll:true});
    if(instant||state.reduced)panel.hidden=true;else closeTimer=setTimeout(()=>{if(!lessonOpen)panel.hidden=true;},240);
  }
  render();post(true);
}
function setLessonSection(section){
  lessonSection=section==='cycle'?'cycle':'structure';
  if(state.assembly.active)finishAssembly();
  if(lessonSection==='structure')setPlaying(false);
  state.chapter=lessonSection;syncTabs();lastStage='';render();post(true);
}
function updatePart(){
  const part=machine.parts.find(part=>part.id===state.selected);
  $$('[data-part-id]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.partId===state.selected)));
  $('.part-detail').hidden=!part;
  if(!part)return;
  $('#part-code').textContent=`${part.no} / ${part.name}`;$('#part-hint').textContent=part.hint;$('#part-text').textContent=part.text;$('#part-link').textContent=part.link;
}
function selectPart(id){
  if(id===null){state.selected=null;updatePart();if(lessonOpen&&lessonSection==='structure'&&!whiteboard?.isOpen)showLesson(false);render();post(true);return;}
  if(state.mode==='explode'&&!whiteboard?.isOpen){
    if(id==='pipes')setMode('xray');
    else id=coolingAssemblyOwners[kind][id]||id;
  }
  if(id!==null&&!machine.parts.some(part=>part.id===id))return;
  if(whiteboard?.isOpen){state.selected=id;updatePart();post(true);return;}
  if(state.assembly.active)finishAssembly();
  state.playing=false;stopClock();state.selected=id;state.chapter='structure';lessonSection='structure';syncTabs();updatePart();if(state.mode!=='explode'&&id)showLesson(true);render();post(true);
}
function showView(){state.view='3d';$('#stage-3d').hidden=false;$('.camera-tools').hidden=false;render();post(true);kick();}

function setMode(mode){
  if(!['assembled','cut','explode','xray'].includes(mode))return;
  if(mode===state.mode&&!state.assembly.active){render();post(true);return;}
  if(state.assembly.active)finishAssembly();
  const returning=state.mode==='explode'&&mode!=='explode';
  state.mode=mode;
  if(mode==='explode'||returning){state.playing=false;stopClock();resumeAfterAssembly=returning;showLesson(false);}
  if(mode==='explode'){state.chapter='structure';state.selected=null;explorationPhase='opening';resumeAfterAssembly=false;}
  if(returning)explorationPhase='closing';
  render();post(true);
}
function explorationUI(){
  const open=state.mode==='explode',busy=explorationPhase==='opening'||explorationPhase==='closing';
  document.body.classList.toggle('is-exploring',open||busy);
  $('#exploration-tools').hidden=!open||busy||state.view!=='3d';
  $('#part-reset').disabled=!state.selected;
  $('button[data-mode="explode"]').textContent=open?'装回':'拆解';
  $('#play').disabled=explorationPhase==='closing';
  const part=machine.parts.find(p=>p.id===state.selected);
  $('#part-inspector').hidden=!part||state.assembly.active||state.view!=='3d'||!open||explorationPhase!=='open';
  if(part){$('#inspector-heading').textContent=part.name;$('#inspector-function').textContent=part.hint;}
}
function setOperation(operation){
  if(kind!=='ac'||!['cool','heat'].includes(operation))return;
  if(state.assembly.active)finishAssembly();
  state.operation=operation;state.playing=false;stopClock();state.chapter='cycle';state.progress=0;lastStage='';reveal=false;
  $$('[data-operation]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.operation===operation)));
  render();post(true);say(operation==='heat'?'已切换制热，室内放热，室外吸热。':'已切换制冷，室内吸热，室外放热。');
}
function stopClock(){if(raf)cancelAnimationFrame(raf);raf=0;lastTime=0;}
function setPlaying(on){
  if(on&&(state.mode==='explode'||explorationPhase==='closing')){if(state.mode==='explode')setMode(DEFAULT_MODE);resumeAfterAssembly=true;return;}
  if(!on)resumeAfterAssembly=false;
  if(on){
    state.selected=null;updatePart();
    if(state.assembly.active)finishAssembly();if(state.view!=='3d')showView('3d');if(state.mode==='explode')setMode('cut');
    if(state.progress>=1)state.progress=0;hasPlayed=true;state.chapter='cycle';lessonSection='cycle';syncTabs();lastStage='';
  }
  state.playing=!!on;if(!on)stopClock();render();post(true);kick();
}
function setProgress(value){
  if(state.assembly.active)finishAssembly();state.playing=false;stopClock();state.progress=Math.max(0,Math.min(1,Number(value)||0));state.chapter='cycle';lessonSection='cycle';syncTabs();
  lastStage='';render();post(true);
}
function chooseStage(index){setProgress(((index+4)%4+.5)/4);}
function startAssembly(){
  state.selected=null;updatePart();
  resumeAfterAssembly=false;explorationPhase='closed';showLesson(false,{instant:true});stopClock();hasPlayed=false;state.playing=false;state.progress=0;state.chapter='cycle';state.mode='cut';state.view='3d';
  $('#stage-3d').hidden=false;$('.camera-tools').hidden=false;
  Object.assign(state.assembly,{active:true,time:state.reduced?.95*ASSEMBLY_DURATION/machine.assemblies.length:0,running:!state.reduced});lastAssembly=-1;viewAction('reset');render();post(true);kick();
}
function finishAssembly(autoplay=false){
  const wasAssembling=state.assembly.active;
  Object.assign(state.assembly,{active:false,time:ASSEMBLY_DURATION,running:false});state.playing=false;stopClock();state.chapter='cycle';lastStage='';lastAssembly=-1;
  if(wasAssembling)state.mode=DEFAULT_MODE;
  state.selected=null;updatePart();render();post(true);
  if(autoplay===true&&!state.reduced&&!whiteboard?.isOpen)setPlaying(true);
}
function seekAssembly(time){
  if(!state.assembly.active)startAssembly();
  state.assembly.running=false;stopClock();state.assembly.time=Math.max(0,Math.min(ASSEMBLY_DURATION,time));
  if(state.assembly.time>=ASSEMBLY_DURATION){finishAssembly();return;}lastAssembly=-1;render();post(true);
}
function nextAssembly(){
  const current=assemblyAt(kind,state.assembly.time);
  if(current.index===machine.assemblies.length-1){state.assembly.time=ASSEMBLY_DURATION;finishAssembly();}else seekAssembly((current.index+1.95)*ASSEMBLY_DURATION/machine.assemblies.length);
}
function toggleAssembly(){
  if(state.reduced){nextAssembly();return;}state.assembly.running=!state.assembly.running;
  if(!state.assembly.running)stopClock();render();post(true);kick();
}
function render(){
  const a=assemblyAt(kind,state.assembly.time),model=coolingAt(state),stage=model.stage,active=state.assembly.active;
  $$('button[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode)));
  document.body.classList.toggle('is-assembling',active);document.body.classList.toggle('is-playing',state.playing);
  $('#assembly-controls').hidden=!active;$('#cycle-overview').hidden=active||state.mode==='explode'||explorationPhase==='closing';$('#thermal-legend').hidden=active||state.mode==='explode'||explorationPhase==='closing';
  const running=active?state.assembly.running:state.playing;
  const playLabel=explorationPhase==='closing'?'正在组装':state.mode==='explode'?'组装运行':active?(running?'暂停组装':'继续组装'):state.playing?'暂停演示':hasPlayed?'继续演示':'开始演示';
  $('#play-text').textContent=playLabel;$('#play').setAttribute('aria-label',playLabel);$('#play').setAttribute('aria-pressed',String(running));
  $('#play').dataset.playback=active?'assembly':state.playing?'playing':hasPlayed?'paused':'idle';
  $('#lesson-play').textContent=state.playing?'暂停演示':hasPlayed?'继续演示':'开始演示';$('#lesson-play').setAttribute('aria-pressed',String(state.playing));
  $('#playback-status').textContent=state.playing?'演示中':state.progress===1?'追踪完成':hasPlayed?'已暂停':'';
  $('#heat-direction').textContent=`${model.heatFrom}吸热 → ${model.heatTo}放热`;
  cycleProgress(state.progress,state.reduced);
  assemblyProgress(active?a.progress:1,state.reduced);
  if(active){
    if(lastAssembly!==a.index){lastAssembly=a.index;}
    $('#caption-title').textContent=a.step.name;$('#caption-text').textContent=a.step.text;
    $('#stage-badge').textContent=`${displayName} · 组装入场`;
    $('#assembly-count').textContent=`0${a.index+1} / 0${machine.assemblies.length}`;
    $('#assembly-pause').textContent=state.assembly.running?'暂停':'继续';$('#assembly-pause').hidden=state.reduced;
    $('#assembly-next').textContent=a.index===machine.assemblies.length-1?'完成组装 →':'下一步 →';
  }else{
    const modeLabel={assembled:'整体构造',cut:'教学剖面',explode:'总成拆解',xray:'内部透视'}[state.mode];
    $('#stage-badge').textContent=`${displayName} · ${modeLabel}`;
    const part=machine.parts.find(part=>part.id===state.selected);
    $('#caption-title').textContent=state.chapter==='structure'?(part?.name||'认识构造'):stage.title;
    $('#caption-text').textContent=state.chapter==='structure'?(part?.hint||machine.subtitle):stage.caption;
  }
  const pct=Math.round(state.progress*100);$('#progress').value=Math.round(state.progress*1000);$('#progress-large').textContent=pct;$('#progress-output').textContent=pct+'%';
  $('#progress').style.setProperty('--progress',pct+'%');$('#progress').setAttribute('aria-valuetext',`循环观察进度${pct}%，${stage.name}`);
  const key=state.operation+':'+model.stageIndex;
  if(key!==lastStage){
    lastStage=key;reveal=false;
    $('#phase-name').textContent=stage.name;$('#phase-tag').textContent=stage.caption;
    const phases={gas:'气态',liquid:'液态',mixture:'气液混合'};const heats={work:'输入功',release:'放热',none:'近似不换热',absorb:'吸热'};
    $('#phase-in').textContent=phases[stage.phaseIn];$('#phase-out').textContent=phases[stage.phaseOut];$('#heat-state').textContent=heats[stage.heat];
    $('#phase-title').textContent=stage.title;$('#phase-text').textContent=stage.text;$('#energy-title').textContent=stage.energyTitle;$('#energy-text').textContent=stage.energy;
    $('#question').textContent=stage.question;$('#answer').textContent=stage.answer;$('#answer').hidden=true;$('#reveal').setAttribute('aria-expanded','false');$('#reveal').textContent='看看解释 ＋';
    $$('[data-stage]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.stage)===model.stageIndex)));
  }
  if(!active&&(state.mode==='explode'||explorationPhase==='closing')){
    $('#caption-title').textContent='总成拆解';
    $('#caption-text').textContent='按住零件转动观察，点击「组装运行」装回。';
  }
  $('.part-detail').hidden=!state.selected;explorationUI();syncTabs();post();
}
function kick(){if(!raf&&ready&&state.visible&&state.view==='3d'&&!whiteboard?.isOpen&&(state.playing||state.assembly.active&&state.assembly.running)){lastTime=0;raf=requestAnimationFrame(tick);}}
function tick(now){
  raf=0;const dt=lastTime?Math.min((now-lastTime)/1000,.05):0;lastTime=now;
  if(state.assembly.active&&state.assembly.running){state.assembly.time=Math.min(ASSEMBLY_DURATION,state.assembly.time+dt*1.25);if(state.assembly.time===ASSEMBLY_DURATION)finishAssembly(true);else render();}
  else if(state.playing){state.progress=(state.progress+dt*state.speed/CYCLE_SECONDS)%1;render();}
  if(ready&&state.visible&&state.view==='3d'&&!whiteboard?.isOpen&&(state.playing||state.assembly.active&&state.assembly.running))raf=requestAnimationFrame(tick);
}
function snapshot(){return {kind,operation:state.operation,progress:state.progress,mode:state.mode,view:state.view,selected:state.selected,chapter:state.chapter,lessonSection,hasPlayed,assembly:{active:state.assembly.active,time:state.assembly.time},camera:scene()?.getView()};}
function restoreSnapshot(saved){
  if(!saved||saved.kind!==kind||!Number.isFinite(saved.progress))throw Error('Invalid cooling snapshot');
  resumeAfterAssembly=false;state.playing=false;stopClock();state.operation=kind==='ac'&&saved.operation==='heat'?'heat':'cool';state.progress=Math.max(0,Math.min(1,saved.progress));
  state.mode=['assembled','cut','explode','xray'].includes(saved.mode)?saved.mode:DEFAULT_MODE;state.view='3d';
  const selected=machine.parts.some(part=>part.id===saved.selected)?saved.selected:null;
  state.selected=selected;state.chapter=saved.chapter==='structure'?'structure':'cycle';
  lessonSection=saved.lessonSection==='cycle'?'cycle':'structure';hasPlayed=!!saved.hasPlayed;
  Object.assign(state.assembly,{active:!!saved.assembly?.active,time:Math.max(0,Math.min(ASSEMBLY_DURATION,Number(saved.assembly?.time)||0)),running:false});lastAssembly=-1;lastStage='';
  $('#stage-3d').hidden=state.view!=='3d';$('.camera-tools').hidden=false;
  $$('[data-operation]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.operation===state.operation)));
  render();state.selected=selected;updatePart();post(true);scene()?.update({...state,visible:state.visible&&state.view==='3d'});
  if(saved.camera)viewAction('restore',saved.camera);
  return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}
whiteboard=createWhiteboard({
  model:$('#model-surface'),storageKey:'thermal-energy-whiteboard-'+kind,
  getContext:()=>({title:machine.name,detail:state.assembly.active?'组装 · '+assemblyAt(kind,state.assembly.time).step.name:(kind==='ac'?(state.operation==='heat'?'制热 · ':'制冷 · '):'')+coolingAt(state).stage.name+' · '+Math.round(state.progress*100)+'%',snapshot:snapshot()}),
  onOpen:()=>{resumeAfterAssembly=false;state.playing=false;state.assembly.running=false;stopClock();state.interaction='whiteboard';render();post(true);scene()?.update({...state,visible:state.visible&&state.view==='3d'});scene()?.settleView({presentation:true});},
  onClose:()=>{state.interaction='lesson';render();post(true);},
  onViewAction:action=>viewAction(action),onRestoreContext:restoreSnapshot,
  onInteractionChange:mode=>{if(mode==='draw')viewAction('settle');}
});
function keyAction(event){
  if(whiteboard.isOpen)return;
  if(event.key==='Escape'&&lessonOpen){showLesson(false,{instant:true});$('#lesson-toggle').focus();return;}
  if(/INPUT|SELECT|TEXTAREA|BUTTON|A/.test(event.target?.tagName)||event.target?.isContentEditable)return;
  if(event.key===' '){event.preventDefault();state.assembly.active?toggleAssembly():setPlaying(!state.playing);}
  else if(event.key==='ArrowRight'){event.preventDefault();state.assembly.active?nextAssembly():setProgress(state.progress+(event.shiftKey?.1:.02));}
  else if(event.key==='ArrowLeft'){event.preventDefault();state.assembly.active?seekAssembly(Math.max(0,state.assembly.time-1)):setProgress(state.progress-(event.shiftKey?.1:.02));}
  else if(event.key==='Escape')setPlaying(false);else if(event.key.toLowerCase()==='r')viewAction('reset');
}
$('#inspector-close').addEventListener('click',()=>selectPart(null));
$$('[data-explore-tool]').forEach(button=>button.addEventListener('click',()=>{
  $$('[data-explore-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  frame.contentWindow.postMessage({type:'cooling-explore-tool',tool:button.dataset.exploreTool},'*');
}));
$('#part-reset').addEventListener('click',()=>frame.contentWindow.postMessage({type:'cooling-explore-reset',id:state.selected},'*'));
$('#play').addEventListener('click',()=>state.assembly.active?toggleAssembly():setPlaying(!state.playing));
$('#lesson-play').addEventListener('click',()=>setPlaying(!state.playing));
$('#progress').addEventListener('input',event=>setProgress(Number(event.target.value)/1000));
$('#speed').addEventListener('change',event=>{state.speed=Number(event.target.value);post(true);});
$('#assembly-start').addEventListener('click',startAssembly);$('#assembly-pause').addEventListener('click',toggleAssembly);$('#assembly-next').addEventListener('click',nextAssembly);$('#assembly-exit').addEventListener('click',finishAssembly);
$('#lesson-toggle').addEventListener('click',event=>showLesson(!lessonOpen,{instant:event.detail===0}));
$('#lesson-close').addEventListener('click',event=>{showLesson(false,{instant:event.detail===0});$('#lesson-toggle').focus();});
$('#reveal').addEventListener('click',()=>{reveal=!reveal;$('#answer').hidden=!reveal;$('#reveal').setAttribute('aria-expanded',String(reveal));$('#reveal').textContent=reveal?'收起解释 −':'看看解释 ＋';});
$('#whiteboard-open').addEventListener('click',()=>whiteboard.open().catch(error=>{say('白板暂时未能打开，请重试。');console.error(error);}));
$$('[data-assembly-step]').forEach(button=>button.addEventListener('click',()=>seekAssembly((Number(button.dataset.assemblyStep)+.95)*ASSEMBLY_DURATION/machine.assemblies.length)));
$$('button[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode==='explode'&&state.mode==='explode'?DEFAULT_MODE:button.dataset.mode)));
$$('[data-camera]').forEach(button=>button.addEventListener('click',()=>viewAction(button.dataset.camera)));
$$('[data-part-id]').forEach(button=>button.addEventListener('click',()=>selectPart(button.dataset.partId)));
$$('[data-stage]').forEach(button=>button.addEventListener('click',()=>chooseStage(Number(button.dataset.stage))));
$$('[data-operation]').forEach(button=>button.addEventListener('click',()=>setOperation(button.dataset.operation)));
$$('[data-lesson-section]').forEach(button=>{button.addEventListener('click',()=>setLessonSection(button.dataset.lessonSection));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();setLessonSection(event.key==='Home'?'structure':event.key==='End'?'cycle':lessonSection==='structure'?'cycle':'structure');$('[data-lesson-section][aria-selected="true"]').focus();});});
window.addEventListener('keydown',keyAction);
window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow)return;const data=event.data;
  if(data?.type==='cooling-ready'){ready=true;post(true);requestAnimationFrame(()=>{$('#loading').hidden=true;kick();});}
  else if(data?.type==='cooling-exploration'){explorationPhase=data.phase;if(data.phase==='closed'&&resumeAfterAssembly){resumeAfterAssembly=false;if(!state.reduced&&state.interaction!=='whiteboard')setPlaying(true);}render();}
  else if(data?.type==='cooling-select')selectPart(data.id);
  else if(data?.type==='cooling-key')keyAction({key:data.key,target:{tagName:'CANVAS'},preventDefault(){}});
  else if(data?.type==='cooling-error'){state.playing=false;state.assembly.running=false;stopClock();ready=false;$('#loading').hidden=false;$('#loading').classList.add('error');$('#loading p').textContent='立体模型未能载入，请刷新页面重试。';console.error(data.message);}
});
new IntersectionObserver(entries=>{state.visible=entries.at(-1).isIntersecting&&!document.hidden;if(!state.visible)stopClock();post(true);kick();},{rootMargin:'100px 0px'}).observe($('.visual-stage'));
document.addEventListener('visibilitychange',()=>{state.visible=!document.hidden&&$('.visual-stage').getBoundingClientRect().bottom>0;if(!state.visible)stopClock();post(true);kick();});
reduced.addEventListener('change',()=>{state.reduced=reduced.matches;if(state.reduced){state.playing=false;state.assembly.running=false;stopClock();}render();post(true);});
if(window.COOLING_DOCUMENT)frame.srcdoc=window.COOLING_DOCUMENT;else frame.src='./refrigeration-machine.html?machine='+kind;
syncTabs();updatePart();render();
window.coolingDemo={state,machine,coolingAt,getCoolingLesson,setMode,setPlaying,setProgress,setOperation,selectPart,showView,showLesson,setLessonSection,startAssembly,finishAssembly,seekAssembly,whiteboard,get ready(){return ready;}};


mountLegacyPreview(()=>window.coolingDemo,kind);
