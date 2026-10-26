import {hasGuidedOperation,previewInputs,guidedDuration} from './preview-inputs.mjs';
const wrap=x=>((x%1)+1)%1;
export function playbackProgress(definition,state){
 if(state.seekEnd&&!state.playing)return 1;
 if(hasGuidedOperation(definition.id))return wrap((state.t+(state.guideOffset||0))/guidedDuration(definition.id));
 if(definition.phaseRate){const span=definition.id==='piston-pump'?1:Math.PI*2;return wrap((definition.phaseRate(state.inputs)*state.t+(state.inputs._phaseOffset||0))/span);}
 if(definition.id==='canal-lock'){const v=state.inputs.progress||0;return state.t===0?v:wrap(v+state.t/20);}
 return wrap(state.t/20); // Twenty-second teaching-effects loop for the hob.
}
export function seekPlayback(definition,state,model,progress){
 const p=Math.max(0,Math.min(1,Number(progress)||0));
 state.playing=false;state.seekEnd=p===1;
 if(hasGuidedOperation(definition.id)){
  state.t=p*guidedDuration(definition.id);state.guideOffset=0;
  const sample=t=>({...state.inputs,...previewInputs(definition.id,t)});
  Object.assign(state.inputs,sample(state.t));
  // Stateful buoyancy must replay its force integration, not teleport to equilibrium.
  model.seek?.(state.t,state.inputs,sample);
 }else if(definition.phaseRate){
  const span=definition.id==='piston-pump'?1:Math.PI*2;
  state.inputs._phaseOffset=p*span-definition.phaseRate(state.inputs)*state.t;
 }else if(definition.id==='canal-lock'){
  state.t=0;state.inputs.progress=p;
 }else state.t=p*20;
 model.update(state.t,state.inputs);
}
