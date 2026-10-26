import test from 'node:test';
import assert from 'node:assert/strict';
import {electroscopeGuide,electroscopeVisual,electroscopeElectronFlow,chargeStepSeconds,chargeSequence} from './electroscope-motion.mjs';
import {modelCalculations} from './electrical-mechanical.mjs';
const state=modelCalculations.electroscopeState;
const pose=t=>electroscopeVisual({...electroscopeGuide(t),rodSign:'positive'},state);

test('electron redistribution reverses with rod polarity and stops at equilibrium',()=>{
 for(const rodSign of ['negative','positive']){
  const input={...electroscopeGuide(chargeStepSeconds+.45),rodSign};
  const flow=electroscopeElectronFlow(input,state);
  assert.equal(flow.direction,rodSign==='negative'?1:-1);
  assert(flow.progress>0&&flow.progress<1);
  assert.deepEqual(electroscopeElectronFlow(input,state),flow,'same time freezes same flow');
  assert.equal(electroscopeElectronFlow({...electroscopeGuide(chargeStepSeconds+1.3),rodSign},state).direction,0);
  assert.equal(electroscopeElectronFlow({operation:'near',rodSign},state).direction,0);
 }
 const away=electroscopeElectronFlow({...electroscopeGuide(2*chargeStepSeconds+.45),rodSign:'negative'},state);
 assert.equal(away.direction,-1,'electrons return upward when negative rod is removed');
});

test('electroscope full cycle has bounded frame motion across every operation boundary',()=>{
 let previous=pose(0),moving=0;
 for(let i=1;i<=Math.ceil(chargeStepSeconds*chargeSequence.length*60);i++){
  const current=pose(i/60),dx=Math.abs(current.rodX-previous.rodX),da=Math.abs(current.angle-previous.angle);
  assert(dx<.025,'rod must not teleport');assert(da<.008,'leaves must not jump');
  if(dx>1e-5||da>1e-5)moving++;
  assert(current.angle>=0&&current.angle<=.20000001);previous=current;
 }
 assert(moving>300,'motion spans many frames rather than isolated steps');
});

test('contact charge transfer starts only when rod reaches metal sphere',()=>{
 const start=chargeSequence.indexOf('contact')*chargeStepSeconds;
 for(const elapsed of [.05,.25,.50,.70]){
  const inputs=electroscopeGuide(start+elapsed),p=pose(start+elapsed);
  assert.equal(inputs.operation,'near');assert(p.rodX<-.092);assert(Math.abs(p.bodyCharge+2*p.leafCharge)<1e-8);
 }
 assert.equal(electroscopeGuide(start+.73).operation,'contact');assert(Math.abs(pose(start+.73).rodX+.092)<1e-10);
 const end=pose(start+1.25);assert.equal(end.angle,.19);assert.equal(end.bodyCharge+2*end.leafCharge,6);
});

test('guided pose is deterministic, manual operations settle immediately, charge sign does not change leaf angle',()=>{
 const t=8.2,first=pose(t);pose(2);pose(21);assert.deepEqual(pose(t),first);
 const positive=electroscopeVisual({...electroscopeGuide(t),rodSign:'positive'},state),negative=electroscopeVisual({...electroscopeGuide(t),rodSign:'negative'},state);
 assert.equal(positive.angle,negative.angle);assert.equal(positive.bodyCharge,-negative.bodyCharge);
 const manual=electroscopeVisual({operation:'contact-away'},state);assert.equal(manual.rodX,-.60);assert.equal(manual.angle,.19);
});
