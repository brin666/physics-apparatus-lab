import {Vector3,Quaternion,Euler,Box3} from 'three';
const seeded=id=>{let n=2166136261;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0)/4294967295;};
const corners=box=>Array.from({length:8},(_,i)=>new Vector3(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z));
export function planExplodedLayout(records,{center,span,right,up,facing}){
 const visible=records.filter(r=>!r.object.userData.hideWhenExploded&&!r.explodeBox.isEmpty());
 const primary=visible.find(r=>r.object.userData.explodePrimary)||visible.find(r=>/base|frame|stand|机架|底座/.test(r.id+' '+r.name))||visible[0];
 const gap=span*.10,placed=[],bounds=new Box3(),targets=new Map();
 function shape(r,q){
  const points=corners(r.explodeBox).map(v=>v.sub(r.position).applyQuaternion(q));
  const xs=points.map(p=>p.dot(right)),ys=points.map(p=>p.dot(up));
  return {points,w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),cx:(Math.max(...xs)+Math.min(...xs))/2,cy:(Math.max(...ys)+Math.min(...ys))/2};
 }
 function place(r,q,s,x,y,depth,index){
  const position=center.clone().addScaledVector(right,x-s.cx).addScaledVector(up,y-s.cy).addScaledVector(facing,depth);
  placed.push({id:r.id,x,y,w:s.w,h:s.h});for(const p of s.points)bounds.expandByPoint(p.clone().add(position));
  targets.set(r.id,{position,quaternion:q,index,rect:placed.at(-1)});
 }
 if(!primary)return {targets,bounds,primary:null};
 const main=shape(primary,new Quaternion());place(primary,new Quaternion(),main,0,0,0,0);
 const others=visible.filter(r=>r!==primary),n=others.length;
 // Evenly cover the centre, but vary angle, radius, depth and tilt. Shapes are
 // packed using their own projected size instead of identical grid cells.
 for(let i=0;i<n;i++){
  const r=others[i],u=seeded(r.id),v=seeded(r.id+'tilt');
  const q=new Quaternion().setFromEuler(new Euler((u-.5)*.28,(v-.5)*.42,(seeded(r.id+'roll')-.5)*.40));
  const s=shape(r,q),ideal=-Math.PI*.78+i*Math.PI*2/n+(u-.5)*.22;let best;
  for(const offset of [0,-.12,.12,-.24,.24]){
   const a=ideal+offset,dx=Math.cos(a),dy=Math.sin(a)*.86;
   for(let radius=span*.20,k=0;k<240;k++,radius+=span*.045){
    const x=dx*radius,y=dy*radius;
    if(placed.some(p=>Math.abs(x-p.x)<(s.w+p.w)/2+gap&&Math.abs(y-p.y)<(s.h+p.h)/2+gap))continue;
    const cost=radius+Math.abs(offset)*span*.8;
    if(!best||cost<best.cost)best={x,y,cost};break;
   }
  }
  if(!best)throw Error(`Cannot separate ${r.id}`);
  place(r,q,s,best.x,best.y,(v-.5)*span*.08,i+1);
 }
 return {targets,bounds,primary:primary.id};
}
