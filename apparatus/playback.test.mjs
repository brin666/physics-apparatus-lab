import test from 'node:test';
import assert from 'node:assert/strict';
import {devices} from './registry.mjs';
import {playbackProgress,seekPlayback} from './playback.mjs';
import {createSubmarineDynamics} from './fluids.mjs';
import {previewInputs} from './preview-inputs.mjs';

test('every apparatus can seek forward, backward and to endpoints without changing playback speed',()=>{
 for(const definition of devices){
  const state={inputs:Object.fromEntries(definition.controls.map(c=>[c.id,c.value])),t:37,guideOffset:4,playing:true,speed:2};
  let updates=0;const model={update(){updates++;}};
  for(const position of [0,.25,.8,.1,1]){
   seekPlayback(definition,state,model,position);
   assert.equal(state.playing,false,definition.id+' pauses for inspection');
   assert.equal(state.speed,2);
   assert(Math.abs(playbackProgress(definition,state)-position)<1e-8,definition.id+' slider matches selected moment');
  }
  assert.equal(updates,5);
 }
});

test('phase-based seeking respects parameter-change offsets and pump cycle units',()=>{
 for(const definition of devices.filter(d=>d.phaseRate)){
  const state={inputs:Object.fromEntries(definition.controls.map(c=>[c.id,c.value])),t:123,playing:false};
  state.inputs._phaseOffset=17;
  seekPlayback(definition,state,{update(){}},.4);
  const span=definition.id==='piston-pump'?1:2*Math.PI;
  assert(Math.abs(definition.phaseRate(state.inputs)*state.t+state.inputs._phaseOffset-span*.4)<1e-8);
  state.playing=true;state.t+=.001;
  assert(Math.abs(playbackProgress(definition,state)-(.4+definition.phaseRate(state.inputs)*.001/span))<1e-8);
 }
});

test('submarine seeking replays buoyancy history and can resume continuously',()=>{
 const model=createSubmarineDynamics(),sample=t=>previewInputs('submarine',t);
 model.seek(8,sample(8),sample);const first=model.snapshot();
 model.seek(2,sample(2),sample);model.seek(8,sample(8),sample);
 assert.deepEqual(model.snapshot(),first,'repeated seeking produces the same depth and velocity');
 const next=model.update(8.01,sample(8.01));
 assert(Math.abs(next.centerY-first.y)<.01,'resume must not jump to equilibrium');
 model.seek(0,sample(0),sample);assert.equal(model.snapshot().time,0);
});
