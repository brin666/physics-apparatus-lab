// Guided operations for experiments that need an operator. On detail pages a
// manual input pauses the guide; its matching phase makes playback resume smoothly.
const waves={relay:['coilCurrent',0,1.2,5],rheostat:['position',0,1,7],pulley:['pullDistance',0,.6,7],manometer:['depth',0,.5,7],submarine:['ballast',0,32,12]};
const chargeSequence=['neutral','near','move-away','contact','contact-away','discharge','near','grounded','isolated','induction-done','discharge'];
export const hasGuidedOperation=id=>id in waves||id==='electroscope';
export function guidedStart(id,inputs){
 const w=waves[id];if(w){const [key,offset,amplitude,period]=w;return Math.acos(1-2*Math.max(0,Math.min(1,(Number(inputs[key])-offset)/amplitude)))*period/(Math.PI*2);}
 return Math.max(0,chargeSequence.indexOf(inputs.operation))*1.8;
}
export function previewInputs(id,t){
 const wave=(period=6)=>(1-Math.cos(t*Math.PI*2/period))/2;
 switch(id){
  case 'relay':return {coilCurrent:1.2*wave(5)};
  case 'rheostat':return {position:wave(7)};
  case 'pulley':return {pullDistance:.6*wave(7)};
  case 'manometer':return {depth:.5*wave(7)};
  case 'submarine':return {ballast:32*wave(12)};
  case 'electroscope':return {operation:chargeSequence[Math.floor(t/1.8)%chargeSequence.length]};
  default:return null;
 }
}
