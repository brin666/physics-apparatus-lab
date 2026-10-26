export const chargeSequence=['neutral','near','move-away','contact','contact-away','discharge','near','grounded','isolated','induction-done','discharge'];
export const chargeStepSeconds=2.4;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return Math.max(0,Math.min(1,t*t*t*(10+t*(-15+6*t))));};
const rodX=s=>s.contact?-.092:s.rodAway?-.60:-.14;
export function electroscopeGuide(t){
 const cycle=chargeSequence.length*chargeStepSeconds,time=((t%cycle)+cycle)%cycle;
 const index=Math.floor(time/chargeStepSeconds),seconds=time-index*chargeStepSeconds;
 const to=chargeSequence[index],from=chargeSequence[(index+chargeSequence.length-1)%chargeSequence.length];
 return {operation:to==='contact'&&seconds<.72?'near':to,_guideTransition:{from,to,seconds}};
}
export function electroscopeVisual(inputs,stateOf){
 const target=stateOf(inputs),g=inputs._guideTransition;
 const fixed=s=>({rodX:rodX(s),angle:s.angle,bodyCharge:s.bodyCharge,leafCharge:s.leafCharge});
 if(!g)return fixed(target);
 const from=stateOf({...inputs,operation:g.from}),to=stateOf({...inputs,operation:g.to});
 const progress=smooth(g.seconds/.95);
 let a=from,b=to,u=progress;
 if(g.to==='contact'){
  const near=stateOf({...inputs,operation:'near'});
  if(g.seconds<.72){b=near;u=smooth(g.seconds/.72);}
  else{a=near;u=smooth((g.seconds-.72)/.45);}
 }
 return {rodX:rodX(from)+(rodX(to)-rodX(from))*smooth(g.seconds/(g.to==='contact'?.72:.95)),
  angle:a.angle+(b.angle-a.angle)*u,bodyCharge:a.bodyCharge+(b.bodyCharge-a.bodyCharge)*u,
  leafCharge:a.leafCharge+(b.leafCharge-a.leafCharge)*u};
}

// Electron motion is opposite to the change in positive charge on each leaf.
// A bounded packet travels only during redistribution, never at equilibrium.
export function electroscopeElectronFlow(inputs,stateOf){
 const g=inputs._guideTransition;
 if(!g)return {direction:0,progress:0};
 let from=g.from,to=g.to,seconds=g.seconds,duration=.95;
 if(to==='contact'){
  if(seconds<.72){to='near';duration=.72;}
  else{from='near';seconds-=.72;duration=.45;}
 }
 const delta=stateOf({...inputs,operation:to}).leafCharge-stateOf({...inputs,operation:from}).leafCharge;
 return {direction:seconds>0&&seconds<duration?-Math.sign(delta):0,progress:smooth(seconds/duration)};
}
