import {mountLegacyPreview} from './legacy-preview.mjs';
import {engineAt,STROKES,PARTS} from './model.mjs';
import {createWhiteboard} from './whiteboard.mjs';
import {mountSpeedControl} from './speed-control.mjs';
import {mountCycleProgress} from './cycle-progress.mjs';
import {assemblyAt,ASSEMBLY_STEPS,ASSEMBLY_DURATION,ASSEMBLY_STEP_SECONDS,ASSEMBLY_MOVE_SECONDS} from './assembly-model.mjs';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
mountSpeedControl($('#speed'));
const cycleProgress=mountCycleProgress($('#cycle-overview'));
const state={angle:410,mode:'cut',selected:null,view:'3d',playing:false,speed:1,visible:true,labels:true,reduced:reduced.matches,chapter:'cycle',interaction:'lesson'};
let whiteboard=null;
let hasPlayed=false,explorationPhase='closed',resumeAfterAssembly=false;
const INTRO_RATE=1.5;
let lessonOpen=false,lessonSection='structure',lessonCloseTimer=0;
const sequence={active:!reduced.matches,time:0,running:!reduced.matches};state.assembly=sequence;
let sequenceIndex=-1,trialRemaining=0,trialActive=false,trialStartAngle=410,sequenceSeen=sequence.active;
if(sequence.active)state.chapter='assembly';
const frame=$('#machine');let ready=false,raf=0,lastTime=0,lastPhase=-1,lastPost=0,reveal=false,comparePower=false;
$('#assembly-steps').innerHTML=ASSEMBLY_STEPS.map((s,i)=>`<button class="cycle-phase assembly-step" data-assembly-step="${i}" title="${s.name}" aria-label="查看第${i+1}步：${s.name}"><span class="assembly-step-label">${s.short}</span><span class="cycle-phase-meter" aria-hidden="true"><i></i></span></button>`).join('');
const assemblyProgress=mountCycleProgress($('#assembly-steps'),{pulseCycles:4});
$('#parts').innerHTML=PARTS.map(p=>`<button data-part-id="${p.id}" aria-pressed="${p.id===state.selected}"><span>${p.no}</span>${p.name}</button>`).join('');
function post(force=false){if(!ready)return;const now=performance.now();if(!force&&now-lastPost<30)return;lastPost=now;frame.contentWindow.postMessage({type:'engine-state',...state,visible:state.visible&&state.view==='3d'},'*');}
function say(text){$('#interaction-status').textContent=text;}
function showView(){state.view='3d';$('#stage-3d').hidden=false;$('.camera-tools').hidden=false;$('.clock').hidden=sequence.active;updateCaption();updateCycleOverview();updatePartInspector();post(true);}

const modeHints={assembled:'先看整体轮廓，再剖开内部',cut:'移去前侧外壁，看见内部连接',explode:'沿安装轴分开总成，观察相互位置',xray:'外壳变透明，保留整体关系'};
function stopTrial(){if(!trialActive)return;trialActive=false;trialRemaining=0;setPlaying(false);$('#mode-hint').textContent='试运行已暂停 · 现在可以仔细观察';}
function setMode(mode){
  if(mode===state.mode&&!sequence.active){render();post(true);return;}
  stopTrial();if(sequence.active)finishAssembly(false);
  const returning=state.mode==='explode'&&mode!=='explode';
  state.mode=mode;
  if(mode==='explode'||returning){state.playing=false;resumeAfterAssembly=returning;showLesson(false);}
  if(mode==='explode'){state.chapter='structure';state.selected=null;explorationPhase='opening';resumeAfterAssembly=false;}
  if(returning)explorationPhase='closing';
  $$('button[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===mode));
  $('#mode-hint').textContent=modeHints[mode];render();post(true);
}
function explorationUI(){
  const open=state.mode==='explode',busy=explorationPhase==='opening'||explorationPhase==='closing';
  document.body.classList.toggle('is-exploring',open||busy);
  $('#exploration-tools').hidden=!open||busy||state.view!=='3d';
  $('#part-reset').disabled=!state.selected;
  $('button[data-mode="explode"]').textContent=open?'装回':'拆解';
  $('#play').disabled=explorationPhase==='closing';
  updatePartInspector();
}
function updatePartInspector(){
  const part=PARTS.find(p=>p.id===state.selected);
  const visible=!!part&&!sequence.active&&state.view==='3d'&&state.mode==='explode'&&explorationPhase==='open';
  $('#part-inspector').hidden=!visible;
  if(part){$('#inspector-heading').textContent=part.name;$('#inspector-function').textContent=part.hint;}
}
$('#inspector-close').addEventListener('click',()=>{selectPart(null);$('#part-reset').disabled=true;});
function reassemble(){setMode('cut');resumeAfterAssembly=true;}
function selectPart(id,fromAssembly=false){if(id===null){state.selected=null;$$('[data-part-id]').forEach(b=>b.setAttribute('aria-pressed','false'));$('.part-detail').hidden=true;if(!fromAssembly&&lessonOpen&&lessonSection==='structure'&&!whiteboard?.isOpen)showLesson(false);updateCaption();explorationUI();post(true);return;}if(!fromAssembly)stopTrial();if(sequence.active&&!fromAssembly&&!whiteboard?.isOpen)finishAssembly(false);const p=PARTS.find(p=>p.id===id);state.selected=p?id:null;$$('[data-part-id]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.partId===id));$('.part-detail').hidden=!p;if(p){$('#part-code').textContent=`${p.no} / ${p.name}`;$('#part-hint').textContent=p.hint;$('#part-text').textContent=p.text;$('#part-link').textContent=p.link;if(!fromAssembly)say(`已选中${p.name}，${p.hint}。`);}post(true);if(!fromAssembly){if(!whiteboard?.isOpen&&state.mode!=='explode'){lessonSection='structure';state.chapter='structure';syncLessonTabs();showLesson(true);}updateCaption();}explorationUI();}
function updatePlayControls(){
  const running=sequence.active?sequence.running:state.playing;
  const exploring=state.mode==='explode',closing=explorationPhase==='closing';
  const label=closing?'正在组装':exploring?'组装运行':sequence.active?(running?'暂停组装':'继续组装'):(state.playing?'暂停演示':hasPlayed?'继续演示':'开始演示');
  $('#play-text').textContent=label;
  $('#play').setAttribute('aria-label',label);
  $('#play').setAttribute('aria-pressed',String(running&&!exploring&&!closing));
  explorationUI();
  $('#play').dataset.playback=sequence.active?'assembly':state.playing?'playing':hasPlayed?'paused':'idle';
  const cardPlay=$('#lesson-play');
  cardPlay.textContent=state.playing?'暂停演示':hasPlayed?'继续演示':'开始演示';
  cardPlay.setAttribute('aria-label',state.playing?'暂停四冲程演示':hasPlayed?'继续四冲程演示':'开始四冲程演示');
  cardPlay.setAttribute('aria-pressed',String(state.playing));
  document.body.classList.toggle('is-playing',state.playing&&!sequence.active);
}
function updateCycleOverview(){
  $('#cycle-overview').hidden=sequence.active||state.mode==='explode'||explorationPhase==='closing'||state.view!=='3d';
  const atEnd=state.angle===720;
  $('#playback-status').textContent=state.playing?'演示中':atEnd?'本循环结束':hasPlayed?'已暂停':'';
  cycleProgress(state.angle/720,state.reduced);
}
function assemblyUI(){
  const active=sequence.active,s=assemblyAt(sequence.time),step=ASSEMBLY_STEPS[s.index];
  $('#assembly-controls').hidden=!active;
  for(const selector of ['.transport','.cycle-footer','.live-state'])$(selector).hidden=active;
  updatePlayControls();
  $('.clock').hidden=active;
  $('.lesson-panel').classList.toggle('is-assembling',active);
  document.body.classList.toggle('is-assembling',active);
  $('#assembly-start').textContent=sequenceSeen?'重播入场':'播放组装';
  $('#assembly-start').removeAttribute('aria-pressed');
  $('.lesson-top>.eyebrow').textContent=active?'从零件到完整机器':'跟着运动理解原理';
  assemblyProgress(active?s.progress:1,state.reduced);
  if(!active)return;
  lastPhase=-1;
  $('#assembly-count').textContent=`${String(s.index+1).padStart(2,'0')} / 08`;
  $('#assembly-step-title').textContent=step.name;
  $('#assembly-pause').textContent=sequence.running?'暂停':'继续';$('#assembly-pause').hidden=state.reduced;
  $('#assembly-next').textContent=s.index===7?'完成组装 →':'下一步 →';
  $('#assembly-note').textContent=state.reduced?'已按系统设置关闭滑入动画，可逐步查看。':'约4秒组装入场，落位后开始运行。';
  document.documentElement.style.setProperty('--phase','#356fdc');
  $('#stage-badge').textContent='汽油机 · 组装入场';
  $('#mode-hint').textContent=sequence.running?'一个总成落位，再进入下一步':'已暂停 · 可以逐步查看';
  if(sequenceIndex!==s.index){
    sequenceIndex=s.index;
    $('#phase-name').textContent=step.name;$('#phase-no').textContent=`${String(s.index+1).padStart(2,'0')} / 08`;
    $('#phase-tag').textContent='先看它在哪里，再看它连接谁';
    $('#phase-title').textContent=step.title;$('#phase-text').textContent=step.text;
    $('.energy-label').textContent='这一处的连接';$('#energy-title').textContent=step.connection;$('#energy-text').textContent=step.detail;
    say(`组装第${s.index+1}步，共8步：${step.name}。${step.title}`);
  }
}
function startAssembly(){
  selectPart(null,true);
  showLesson(false);state.chapter='assembly';hasPlayed=false;resumeAfterAssembly=false;explorationPhase='closed';
  sequence.active=false;sequence.running=false;trialRemaining=0;trialActive=false;state.playing=false;
  showView('3d');setMode('cut');resumeAfterAssembly=false;state.angle=410;sequenceIndex=-1;sequenceSeen=true;
  Object.assign(sequence,{active:true,time:state.reduced?ASSEMBLY_MOVE_SECONDS:0,running:!state.reduced});
  frame.contentWindow?.postMessage({type:'engine-view',action:'reset'},'*');render();post(true);kick();
}
function finishAssembly(trial=false){
  if(state.chapter==='assembly')state.chapter='cycle';
  sequence.active=false;sequence.running=false;sequence.time=ASSEMBLY_DURATION;sequenceIndex=-1;lastPhase=-1;
  $('.energy-label').textContent='此刻的能量';trialRemaining=0;trialActive=false;assemblyUI();selectPart(null,true);render();post(true);
  if(trial&&!state.reduced){setPlaying(true);$('#mode-hint').textContent='组装完成 · 正在运行';say('组装完成，开始运行。可以暂停或点击拆解观察零件。');}
  else {$('#mode-hint').textContent=modeHints[state.mode];say('组装结束。完整结构已显示，可以选择部件继续观察。');}
}
function seekAssembly(time){if(!sequence.active)startAssembly();sequence.running=false;sequence.time=Math.max(0,Math.min(ASSEMBLY_DURATION,time));if(sequence.time>=ASSEMBLY_DURATION){finishAssembly(false);return;}sequenceIndex=-1;render();post(true);}
function nextAssembly(){const s=assemblyAt(sequence.time);if(s.index===7){finishAssembly(false);$('#play').focus({preventScroll:true});return;}seekAssembly((s.index+1)*ASSEMBLY_STEP_SECONDS+ASSEMBLY_MOVE_SECONDS);}
function toggleAssembly(){if(state.reduced){nextAssembly();return;}sequence.running=!sequence.running;render();post(true);say(sequence.running?'继续组装演示。':`组装已暂停在第${assemblyAt(sequence.time).index+1}步。`);kick();}
function render(){
  assemblyUI();updateCaption();updateCycleOverview();
  if(sequence.active){post();return;}
  const s=engineAt(state.angle),phase=STROKES[s.strokeIndex],shown=Math.floor(state.angle);
  document.documentElement.style.setProperty('--phase',phase.color);
  $('#angle-large').textContent=shown;$('#angle-output').textContent=`${shown}°`;
  $('#angle').value=shown;
  // While playing, the native range value remains current without a stale prose override.
  // Announce the complete angle and stage when the user pauses or scrubs.
  if(state.playing)$('#angle').removeAttribute('aria-valuetext');
  else $('#angle').setAttribute('aria-valuetext',`${shown}度，${state.angle===720?'本循环结束，回到吸气开始':phase.name+'冲程'}`);
  $('#angle').style.setProperty('--progress',`${state.angle/720*100}%`);
  $('#piston-direction').textContent=s.direction+(s.direction==='下行'?' ↓':s.direction==='上行'?' ↑':'');
  $('#intake-state').textContent=s.intakeLift>.00001?'开启':'关闭';
  $('#exhaust-state').textContent=s.exhaustLift>.00001?'开启':'关闭';
  if(lastPhase!==s.strokeIndex){
    lastPhase=s.strokeIndex;$('#phase-name').textContent=phase.name;
    $('#phase-no').textContent=`0${s.strokeIndex+1} / 04`;$('#phase-tag').textContent=phase.tag;
    $('#phase-title').textContent=phase.title;$('#phase-text').textContent=phase.text;
    $('#energy-title').textContent=phase.energyTitle;$('#energy-text').textContent=phase.energy;
    $('#question').textContent=phase.question;$('#answer').textContent=phase.answer;$('#answer').hidden=!reveal;
    $$('[data-stroke]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.stroke)===s.strokeIndex));
  }
  post();
}
function kick(){if(!raf&&ready&&(state.playing||(sequence.active&&sequence.running))&&state.visible&&state.view==='3d'){lastTime=0;raf=requestAnimationFrame(tick);}}
function tick(now){raf=0;const dt=lastTime?Math.min((now-lastTime)/1000,.05):0;lastTime=now;if(state.visible&&state.view==='3d'){
  if(sequence.active&&sequence.running){sequence.time=Math.min(ASSEMBLY_DURATION,sequence.time+dt*INTRO_RATE);if(sequence.time>=ASSEMBLY_DURATION)finishAssembly(true);else render();}
  else if(state.playing){let advance=dt*60*state.speed;if(trialActive){advance=Math.min(advance,trialRemaining);trialRemaining-=advance;}state.angle=(state.angle+advance)%720;render();if(trialActive&&trialRemaining<=0){trialActive=false;state.angle=trialStartAngle;setPlaying(false);$('#mode-hint').textContent='试运行结束 · 可以继续观察或重看组装';say('试运行结束，曲轴已完成两圈并停止。可以选择部件继续观察，或重看组装。');}}
  if(!raf&&(state.playing||(sequence.active&&sequence.running)))raf=requestAnimationFrame(tick);
}}
function setPlaying(on){if(on&&(state.mode==='explode'||explorationPhase==='closing')){if(state.mode==='explode')reassemble();else resumeAfterAssembly=true;return;}if(!on)resumeAfterAssembly=false;if(on){selectPart(null,true);hasPlayed=true;state.chapter='cycle';if(!trialActive){lessonSection='cycle';syncLessonTabs();}if(sequence.active)finishAssembly(false);if(state.view!=='3d')showView('3d');if(state.mode==='explode')setMode('cut');}state.playing=on;if(!on&&raf){cancelAnimationFrame(raf);raf=0;}render();post(true);if(on)kick();}
function setAngle(a,announce=true){state.chapter='cycle';lessonSection='cycle';syncLessonTabs();if(sequence.active)finishAssembly(false);trialRemaining=0;trialActive=false;setPlaying(false);if(state.mode==='explode')setMode('cut');state.angle=Math.max(0,Math.min(720,a));render();const s=engineAt(state.angle);if(announce)say(`${Math.floor(state.angle)}度，${STROKES[s.strokeIndex].name}冲程`);post(true);}
function chooseStroke(i){setAngle(i*180+90);}
function keyAction(e){if(whiteboard?.isOpen){if(e.key==='Escape')whiteboard.close();return;}if(e.key==='Escape'&&lessonOpen){showLesson(false,{instant:true});$('#lesson-toggle').focus();return;}if(/INPUT|SELECT|TEXTAREA|BUTTON|A/.test(e.target?.tagName)||e.target?.isContentEditable)return;if(sequence.active){if(e.key===' '){e.preventDefault?.();toggleAssembly();}if(e.key==='ArrowRight'){e.preventDefault?.();nextAssembly();}if(e.key==='ArrowLeft'){e.preventDefault?.();seekAssembly(Math.max(0,assemblyAt(sequence.time).index-1)*ASSEMBLY_STEP_SECONDS+ASSEMBLY_MOVE_SECONDS);}if(e.key==='Escape')finishAssembly(false);return;}if(e.key===' '){e.preventDefault?.();setPlaying(!state.playing);}if(e.key==='ArrowRight'){e.preventDefault?.();setAngle(state.angle+(e.shiftKey?30:5));}if(e.key==='ArrowLeft'){e.preventDefault?.();setAngle(state.angle-(e.shiftKey?30:5));}if(e.key==='r'||e.key==='R'){state.angle=410;setMode('cut');setPlaying(false);frame.contentWindow?.postMessage({type:'engine-view',action:'reset'},'*');}if(e.key==='Escape'){setPlaying(false);}}
$$('button[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode==='explode'&&state.mode==='explode'?'cut':b.dataset.mode)));
$$('[data-explore-tool]').forEach(b=>b.addEventListener('click',()=>{
  $$('[data-explore-tool]').forEach(item=>item.setAttribute('aria-pressed',String(item===b)));
  $('#exploration-hint').textContent=b.dataset.exploreTool==='move'?'按住零件，移动位置':'按住零件，自由转动';
  frame.contentWindow.postMessage({type:'engine-explore-tool',tool:b.dataset.exploreTool},'*');
}));
$('#part-reset').addEventListener('click',()=>frame.contentWindow.postMessage({type:'engine-explore-reset'},'*'));
$$('[data-part-id]').forEach(b=>b.addEventListener('click',()=>selectPart(b.dataset.partId)));
$$('[data-stroke]').forEach(b=>b.addEventListener('click',()=>chooseStroke(Number(b.dataset.stroke))));
$$('[data-camera]').forEach(b=>b.addEventListener('click',()=>frame.contentWindow.postMessage({type:'engine-view',action:b.dataset.camera},'*')));
$('#play').addEventListener('click',()=>sequence.active?toggleAssembly():state.mode==='explode'?reassemble():setPlaying(!state.playing));$('#next').addEventListener('click',()=>chooseStroke((engineAt(state.angle).strokeIndex+1)%4));$('#speed').addEventListener('change',e=>{state.speed=Number(e.target.value);});$('#angle').addEventListener('input',e=>setAngle(Number(e.target.value),false));$('#angle').addEventListener('change',()=>setAngle(state.angle));
$('#assembly-start').addEventListener('click',()=>{startAssembly();$('#play').focus({preventScroll:true});});$('#assembly-replay').addEventListener('click',startAssembly);$('#assembly-pause').addEventListener('click',toggleAssembly);$('#assembly-next').addEventListener('click',nextAssembly);$('#assembly-exit').addEventListener('click',()=>finishAssembly(false));$$('[data-assembly-step]').forEach(b=>b.addEventListener('click',()=>seekAssembly(Number(b.dataset.assemblyStep)*ASSEMBLY_STEP_SECONDS+ASSEMBLY_MOVE_SECONDS)));
$('#reveal').addEventListener('click',()=>{reveal=!reveal;$('#answer').hidden=!reveal;$('#reveal').setAttribute('aria-expanded',reveal);$('#reveal').innerHTML=`${reveal?'收起解释':'看看解释'} <span>${reveal?'−':'＋'}</span>`;});
$$('[data-focus]').forEach(b=>b.addEventListener('click',()=>{selectPart(b.dataset.focus);showView('3d');setMode(b.dataset.focus==='flywheel'?'explode':'cut');$('#experiment').scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});}));

window.addEventListener('message',e=>{if(e.source!==frame.contentWindow)return;const d=e.data;if(d?.type==='engine-ready'){ready=true;post(true);requestAnimationFrame(()=>{$('#loading').hidden=true;kick();});}else if(d?.type==='engine-select'){selectPart(d.id);explorationUI();}else if(d?.type==='engine-exploration'){explorationPhase=d.phase;if(d.phase==='closed'&&resumeAfterAssembly){resumeAfterAssembly=false;if(!state.reduced&&state.interaction!=='whiteboard')setPlaying(true);}render();}else if(d?.type==='engine-key'){keyAction({key:d.key,preventDefault(){},target:{tagName:'CANVAS'}});}else if(d?.type==='engine-error'){console.error('Engine renderer:',d.message);$('#loading').classList.add('error');$('#loading').querySelector('p').textContent='立体模型未能载入，请刷新页面重试。';}});
window.addEventListener('keydown',keyAction);
new IntersectionObserver(entries=>{state.visible=entries.at(-1).isIntersecting;if(!state.visible&&raf){cancelAnimationFrame(raf);raf=0;}post(true);if(state.visible)kick();},{rootMargin:'100px 0px'}).observe($('.visual-stage'));
document.addEventListener('visibilitychange',()=>{if(document.hidden){state.visible=false;if(raf){cancelAnimationFrame(raf);raf=0;}}else state.visible=$('.visual-stage').getBoundingClientRect().bottom>0;post(true);kick();});
reduced.addEventListener('change',()=>{state.reduced=reduced.matches;if(reduced.matches){setPlaying(false);if(sequence.active){sequence.running=false;sequence.time=assemblyAt(sequence.time).index*ASSEMBLY_STEP_SECONDS+ASSEMBLY_MOVE_SECONDS;render();}}post(true);});

const shortCaptions=['进气门开启，活塞下行，混合气进入气缸。','两气门关闭，活塞上行，压缩混合气。','两气门关闭，高温高压气体膨胀，推动活塞。','排气门开启，活塞上行，将废气排出。'];
const shortEnergy=['飞轮释放动能，曲轴带动活塞吸入混合气。','活塞对气体做功，气体内能增加。','燃烧释放能量，气体对活塞做功。','飞轮带动排气，废气带走一部分能量。'];
function syncLessonTabs(){
  $$('[data-lesson-section]').forEach(button=>{
    const selected=button.dataset.lessonSection===lessonSection;
    button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
  });
  $('#lesson-structure').hidden=lessonSection!=='structure';
  $('#lesson-cycle').hidden=lessonSection!=='cycle';
}
function showLesson(open,{instant=false}={}){
  const panel=$('#lesson-panel'),trigger=$('#lesson-toggle');
  clearTimeout(lessonCloseTimer);lessonOpen=open;
  trigger.setAttribute('aria-expanded',String(open));
  panel.classList.toggle('instant',instant||state.reduced);
  if(open){
    if(trialActive)stopTrial();
    if(sequence.active){
      sequence.running=false;
      if(raf){cancelAnimationFrame(raf);raf=0;}
      render();post(true);
    }
    if(lessonSection==='cycle'&&sequence.active)finishAssembly(false);
    if(!sequence.active)state.chapter=lessonSection;
    syncLessonTabs();updateCaption();
    const wasHidden=panel.hidden;panel.hidden=false;panel.inert=false;
    if(wasHidden){panel.classList.remove('is-open');panel.getBoundingClientRect();}
    panel.classList.add('is-open');
  }else{
    panel.classList.remove('is-open');panel.inert=true;
    if(panel.contains(document.activeElement))trigger.focus({preventScroll:true});
    if(instant||state.reduced)panel.hidden=true;
    else lessonCloseTimer=setTimeout(()=>{if(!lessonOpen)panel.hidden=true;},240);
  }
}
function setLessonSection(section){
  lessonSection=section==='cycle'?'cycle':'structure';
  if(lessonSection==='cycle'){
    if(sequence.active)finishAssembly(false);
  }else if(state.playing)setPlaying(false);
  if(!sequence.active)state.chapter=lessonSection;
  syncLessonTabs();render();post(true);
}
function updateCaption(){
  const s=engineAt(state.angle),phase=STROKES[s.strokeIndex],part=PARTS.find(p=>p.id===state.selected);
  $('#energy-flow').hidden=state.chapter!=='energy'||sequence.active;
  const energyStep=s.strokeIndex===2?2:s.strokeIndex===1?1:0;
  $$('#energy-flow span').forEach((b,i)=>b.classList.toggle('is-current',i===energyStep));
  if(state.mode==='explode'&&!sequence.active||explorationPhase==='closing'){
    $('#stage-badge').textContent='汽油机 · 零件探索';
    $('#caption-title').textContent='拆开，发现机械的连接';
    $('#caption-text').textContent='拖动零件旋转观察，在小视窗查看名称与功能。';
  }else if(sequence.active){
    const a=assemblyAt(sequence.time),step=ASSEMBLY_STEPS[a.index];
    $('#caption-title').textContent=step.name;$('#caption-text').textContent=step.title;
  }else{
    $('#caption-title').textContent=state.chapter==='structure'?(part?.name||'认识构造'):state.chapter==='energy'?phase.energyTitle:phase.name+'冲程';
    $('#caption-text').textContent=state.chapter==='structure'?(part?part.hint+'，'+part.link:'点击部件，查看它的位置与作用。'):state.chapter==='energy'?shortEnergy[s.strokeIndex]:shortCaptions[s.strokeIndex];
    $('#stage-badge').textContent={assembled:'汽油机 · 整体构造',cut:'汽油机 · 教学剖面',explode:'汽油机 · 总成拆解',xray:'汽油机 · 内部透视'}[state.mode];
  }
}
function setChapter(chapter){
  if(chapter==='assembly'){startAssembly();return;}
  setLessonSection(chapter==='structure'?'structure':'cycle');showLesson(true);
}
$('#lesson-toggle').addEventListener('click',event=>{
  const open=!lessonOpen;showLesson(open,{instant:event.detail===0});
  if(open&&event.detail===0)$('[data-lesson-section][aria-selected="true"]').focus();
});
$('#lesson-close').addEventListener('click',event=>{showLesson(false,{instant:event.detail===0});$('#lesson-toggle').focus();});
$$('[data-lesson-section]').forEach(button=>{
  button.addEventListener('click',()=>setLessonSection(button.dataset.lessonSection));
  button.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const section=event.key==='Home'?'structure':event.key==='End'?'cycle':lessonSection==='structure'?'cycle':'structure';
    setLessonSection(section);$('[data-lesson-section][aria-selected="true"]').focus();
  });
});
$('#lesson-play').addEventListener('click',()=>setPlaying(!state.playing));
$('#previous').addEventListener('click',()=>chooseStroke((engineAt(state.angle).strokeIndex+3)%4));
$('#reset').addEventListener('click',()=>{setAngle(0);frame.contentWindow?.postMessage({type:'engine-view',action:'reset'},'*');});
function snapshot(){
  let camera;try{camera=frame.contentWindow.engineScene?.getView();}catch{}
  return {angle:state.angle,mode:state.mode,view:state.view,selected:state.selected,chapter:state.chapter,lessonSection,hasPlayed,assembly:{active:sequence.active,time:sequence.time},camera};
}
function restoreSnapshot(saved){
  if(!saved||!Number.isFinite(saved.angle))throw Error('Invalid teaching snapshot');
  state.angle=Math.max(0,Math.min(720,saved.angle));
  state.mode=['assembled','cut','explode','xray'].includes(saved.mode)?saved.mode:'cut';
  state.view='3d';state.selected=PARTS.some(p=>p.id===saved.selected)?saved.selected:null;
  state.chapter=['structure','assembly','cycle','energy'].includes(saved.chapter)?saved.chapter:'cycle';
  lessonSection=saved.lessonSection==='structure'||(!saved.lessonSection&&saved.chapter==='structure')?'structure':'cycle';syncLessonTabs();
  state.playing=false;hasPlayed=!!saved.hasPlayed;trialActive=false;trialRemaining=0;
  Object.assign(sequence,{active:!!saved.assembly?.active,time:Math.max(0,Math.min(ASSEMBLY_DURATION,Number(saved.assembly?.time)||0)),running:false});
  sequenceIndex=-1;lastPhase=-1;
  $('#stage-3d').hidden=state.view!=='3d';
  $('.camera-tools').hidden=false;
  $$('button[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===state.mode));
  selectPart(state.selected,true);render();post(true);
  if(saved.camera)frame.contentWindow?.postMessage({type:'engine-view',action:'restore',view:saved.camera},'*');
  return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}
whiteboard=createWhiteboard({
  model:$('#model-surface'),
  getContext:()=>({title:'汽油机',detail:sequence.active?`逐步组装 · ${ASSEMBLY_STEPS[assemblyAt(sequence.time).index].name}`:`${STROKES[engineAt(state.angle).strokeIndex].name}冲程 · ${Math.floor(state.angle)}°`,snapshot:snapshot()}),
  onOpen:()=>{resumeAfterAssembly=false;state.playing=false;sequence.running=false;trialActive=false;trialRemaining=0;state.interaction='whiteboard';if(raf)cancelAnimationFrame(raf);raf=0;render();post(true);try{const scene=frame.contentWindow.engineScene;scene?.update({...state,visible:state.visible&&state.view==='3d'});scene?.settleView({presentation:true});}catch{}},
  onClose:()=>{state.interaction='lesson';render();post(true);},
  onViewAction:action=>frame.contentWindow?.postMessage({type:'engine-view',action},'*'),
  onRestoreContext:restoreSnapshot,
  onInteractionChange:mode=>{if(mode==='draw')frame.contentWindow?.postMessage({type:'engine-view',action:'settle'},'*');}
});
$('#whiteboard-open').addEventListener('click',()=>whiteboard.open().catch(error=>{say('白板暂时未能打开，请重试。');console.error(error);}));

// The build inlines the renderer and UI dependencies: opening engine.html needs no network.
if(window.MACHINE_DOCUMENT)frame.srcdoc=window.MACHINE_DOCUMENT;else frame.src='./machine.html?embed=1';
syncLessonTabs();if(!sequence.active)selectPart(null,true);render();
window.thermalDemo={state,engineAt,setAngle,setMode,setPlaying,showView,selectPart,startAssembly,finishAssembly,seekAssembly,setChapter,showLesson,setLessonSection,whiteboard,get ready(){return ready;}};

mountLegacyPreview(()=>window.thermalDemo,'engine');
