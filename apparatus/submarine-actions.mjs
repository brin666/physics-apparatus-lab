export const submarineActions=[
 {id:'dive',label:'进水下潜',ballast:24},
 {id:'hover',label:'调到悬浮',ballast:12},
 {id:'rise',label:'排水上浮',ballast:0}
];
export function submarineActionInputs(action,t){
 const elapsed=t-action.start;
 let from=action.inputs.ballast,to=action.target,start=0,duration=3;
 // Neutral buoyancy alone cannot lift a vessel off the bottom or submerge it
 // from the surface. First leave that boundary, then balance the weight.
 if(action.preTarget!==null&&action.preTarget!==undefined){
  if(elapsed<1.8){to=action.preTarget;duration=1;}
  else{from=action.preTarget;start=1.8;duration=2.2;}
 }
 const u=Math.max(0,Math.min(1,(elapsed-start)/duration)),blend=u*u*(3-2*u);
 return {...action.inputs,ballast:from+(to-from)*blend,
  _waterRate:(to-from)*6*u*(1-u)/duration};
}
