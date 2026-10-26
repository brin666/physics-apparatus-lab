import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {devices} from './registry.mjs';
import {planExplodedLayout} from './exploded-layout.mjs';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillText(){}})})};
for(const d of devices)test(`${d.id}: scattered assemblies keep projected clearance and repeatable poses`,()=>{
 const m=d.build();m.update(0,Object.fromEntries(d.controls.map(c=>[c.id,c.value])));m.root.updateMatrixWorld(true);
 m.root.traverse(o=>{if(o.userData.connection)o.userData.hideWhenExploded=true;});
 const b=new Box3().setFromObject(m.root),center=b.getCenter(new Vector3()),size=b.getSize(new Vector3()),span=Math.max(size.x,size.y,size.z,.4);
 const records=m.parts.map(part=>{const box=new Box3();function walk(o){if(o.userData.hideWhenExploded)return;if(o.isMesh){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}o.children.forEach(walk);}walk(part.object);return {...part,position:new Box3().setFromObject(part.object).getCenter(new Vector3()),explodeBox:box};});
 const facing=new Vector3(...(d.viewDirection||[.9,.55,1.7])).normalize(),right=new Vector3().crossVectors(new Vector3(0,1,0),facing).normalize(),up=new Vector3().crossVectors(facing,right).normalize();
 const options={center,span,right,up,facing},a=planExplodedLayout(records,options),again=planExplodedLayout(records,options);
 assert(!a.bounds.isEmpty());assert([...a.bounds.min.toArray(),...a.bounds.max.toArray()].every(Number.isFinite));
 for(const [id,t] of a.targets){assert.deepEqual(t.position.toArray(),again.targets.get(id).position.toArray());assert.deepEqual(t.quaternion.toArray(),again.targets.get(id).quaternion.toArray());assert(Math.abs(t.quaternion.length()-1)<1e-9);}
 const rects=[...a.targets.values()].map(t=>t.rect);
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const x=rects[i],y=rects[j];assert(Math.abs(x.x-y.x)>=(x.w+y.w)/2+span*.09||Math.abs(x.y-y.y)>=(x.h+y.h)/2+span*.09,`${x.id} overlaps ${y.id}`);}
 assert.equal(a.targets.get(a.primary).rect.x,0);assert.equal(a.targets.get(a.primary).rect.y,0);
 const rotations=[...a.targets.values()].filter(t=>Math.abs(t.quaternion.w-1)>1e-5);assert(rotations.length>=a.targets.size-1);
});
