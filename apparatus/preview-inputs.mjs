// Guided operations for experiments that need an operator. On detail pages a
// manual input pauses the guide; its matching phase makes playback resume smoothly.
const waves={relay:['coilCurrent',0,1.2,5],rheostat:['position',0,1,7],pulley:['pullDistance',0,.6,7],manometer:['depth',0,.5,7],submarine:['ballast',0,32,12]};
import {chargeSequence,chargeStepSeconds,electroscopeGuide} from './electroscope-motion.mjs';
export const hasGuidedOperation=id=>id in waves||id==='electroscope';
export const guidedDuration=id=>id==='electroscope'?chargeSequence.length*chargeStepSeconds:waves[id]?.[3];
export function guidedStart(id,inputs){
 const w=waves[id];if(w){const [key,offset,amplitude,period]=w;return Math.acos(1-2*Math.max(0,Math.min(1,(Number(inputs[key])-offset)/amplitude)))*period/(Math.PI*2);}
 return Math.max(0,chargeSequence.indexOf(inputs.operation))*chargeStepSeconds+1.25;
}
export function previewInputs(id,t){
 const wave=(period=6)=>(1-Math.cos(t*Math.PI*2/period))/2;
 switch(id){
  case 'relay':return {coilCurrent:1.2*wave(5)};
  case 'rheostat':return {position:wave(7)};
  case 'pulley':return {pullDistance:.6*wave(7)};
  case 'manometer':return {depth:.5*wave(7)};
  case 'submarine':return {ballast:32*wave(12),_waterRate:32*Math.PI/12*Math.sin(t*Math.PI*2/12)};
  case 'electroscope':return electroscopeGuide(t);
  default:return null;
 }
}
