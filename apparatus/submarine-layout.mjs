// Shared physical envelope and component locations for 3D and longitudinal view.
export const SUB_LAYOUT={length:1.56,radiusY:.10,capLength:.10,volume:.08,tankX:[-.40,.40],tankLength:.36,tankRadiusZ:.16,tankVolume:.016,airX:0};
SUB_LAYOUT.straight=SUB_LAYOUT.length-2*SUB_LAYOUT.capLength;
SUB_LAYOUT.radiusZ=SUB_LAYOUT.volume/(Math.PI*SUB_LAYOUT.radiusY*(SUB_LAYOUT.straight+4*SUB_LAYOUT.capLength/3));
SUB_LAYOUT.tankRadiusY=SUB_LAYOUT.tankVolume/(Math.PI*SUB_LAYOUT.tankRadiusZ*SUB_LAYOUT.tankLength);
const clip=u=>Math.max(-1,Math.min(1,u));
export function ellipseFraction(u){u=clip(u);return (Math.asin(u)+Math.PI/2+u*Math.sqrt(Math.max(0,1-u*u)))/Math.PI;}
export function submarineWetVolume(level){
 const s=SUB_LAYOUT,u=clip(level/s.radiusY);
 return Math.PI*s.radiusY*s.radiusZ*s.straight*ellipseFraction(u)+4/3*Math.PI*s.capLength*s.radiusY*s.radiusZ*(.5+.75*u-.25*u*u*u);
}
export function inverseFraction(f,volumeFn=ellipseFraction){
 let lo=-1,hi=1;f=Math.max(0,Math.min(1,f));if(f===0)return -1;if(f===1)return 1;
 for(let i=0;i<35;i++){const mid=(lo+hi)/2;if(volumeFn(mid)<f)lo=mid;else hi=mid;}
 return (lo+hi)/2;
}
export const tankWaterLevel=f=>SUB_LAYOUT.tankRadiusY*inverseFraction(f);
