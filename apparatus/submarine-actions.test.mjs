import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubmarineDynamics} from './fluids.mjs';
import {submarineActionInputs} from './submarine-actions.mjs';

test('manual submarine actions fill smoothly and have no fluid flow after valves close',()=>{
 const a={start:5,target:24,inputs:{ballast:0}};
 assert.equal(submarineActionInputs(a,5).ballast,0);
 assert.equal(submarineActionInputs(a,8).ballast,24);
 assert.equal(submarineActionInputs(a,9)._waterRate,0);
 let previous=0;
 for(let i=0;i<=180;i++){const s=submarineActionInputs(a,5+i/60);assert(s.ballast>=previous&&s.ballast-previous<.21);previous=s.ballast;}
});

test('neutral action leaves bottom/surface first, then settles submerged with equal forces',()=>{
 for(const boundary of ['bottom','surface']){
  const d=createSubmarineDynamics();d.reset(0,{ballast:boundary==='bottom'?24:0});
  d.update(10,{ballast:boundary==='bottom'?24:0});
  const initial=d.snapshot(),action={start:10,target:12,preTarget:boundary==='bottom'?0:16,inputs:{ballast:initial.ballast}};
  const sample=t=>submarineActionInputs(action,t);
  d.seekFrom(initial,10,22,sample);const s=d.state();
  assert(!s.onBottom);assert(s.displacedFraction>.999);assert(Math.abs(s.velocityY)<.002);
  assert(Math.abs(s.buoyancyN-s.weightN)<.001);
  const settled=d.snapshot();d.seekFrom(initial,10,12,sample);d.seekFrom(initial,10,22,sample);
  assert.deepEqual(d.snapshot(),settled,'action timeline seeking is deterministic');
 }
});
