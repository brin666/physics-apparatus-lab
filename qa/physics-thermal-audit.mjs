import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const results={};
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4198/machine-built.html');await page.waitForFunction(()=>window.engineScene);
 results.engine=await page.evaluate(async()=>{
  const {Vector3,Raycaster,Box3}=await import('/node_modules/three/build/three.module.js'),s=engineScene,ray=new Raycaster(),direction=new Vector3(.923,.317,.217).normalize();
  s.update({angle:0,mode:'assembled',reduced:true,assembly:{active:false,time:4},playing:false});s.lab._update(0);s.lab.machine.updateWorldMatrix(true,true);
  const fixed=[];s.parts.case.traverse(m=>{if(m.isMesh){m.material.side=2;fixed.push({m,box:new Box3().setFromObject(m)});}});
  const moving=[];for(const id of ['rod','crank','piston'])s.parts[id]?.traverse(m=>{if(m.isMesh){const seen=new Set(),points=[],a=m.geometry.attributes.position;for(let i=0;i<a.count;i++){const p=new Vector3().fromBufferAttribute(a,i),key=p.toArray().map(v=>v.toFixed(7)).join(',');if(!seen.has(key)){seen.add(key);points.push(p);}}moving.push({m,points,id});}});
  let sampled=0;const collisions=[];
  for(let angle=0;angle<720;angle+=2){
   s.update({angle});s.lab._update(0);s.lab.machine.updateWorldMatrix(true,true);
   for(const {m,points,id} of moving)for(const p0 of points){const p=p0.clone().applyMatrix4(m.matrixWorld);sampled++;
    for(const f of fixed){if(!f.box.containsPoint(p))continue;ray.set(p,direction);const hits=ray.intersectObject(f.m,false).filter(h=>h.distance>1e-6),dist=[];for(const h of hits)if(!dist.length||h.distance-dist.at(-1)>1e-6)dist.push(h.distance);
     if(dist.length%2&&collisions.length<30)collisions.push({angle,part:id,fixed:f.m.name,point:p.toArray()});
    }
   }
  }
  s.update({angle:410,mode:'cut'});s.lab._update(0);
  return {sampled,angles:360,collisions,openThroat:!!s.parts.case.getObjectByName('open-crankcase-throat')};
 });
 await page.screenshot({path:'qa/physics-thermal-engine.png'});
 for(const kind of ['fridge','ac']){
  await page.goto(`http://127.0.0.1:4198/refrigeration-machine.html?machine=${kind}`);await page.waitForFunction(()=>window.coolingScene);
  results[kind]=await page.evaluate(()=>{
   const s=coolingScene;s.update({assembly:{active:false,time:5},mode:'cut',reduced:true,playing:false});s.settleView({presentation:true});
   const checks=[];let fanBounds=null;
   for(const operation of s.kind==='ac'?['cool','heat']:['cool']){
    s.update({operation});
    const rs=s.flowRoutes;let maxJoin=0;rs.forEach((r,i)=>maxJoin=Math.max(maxJoin,Math.hypot(...r.end.map((v,j)=>v-rs[(i+1)%rs.length].start[j]))));
    let matched=0,maxCenterError=0;
    for(const [id,link] of s.links){if(link.mode&&link.mode!==operation)continue;const c=link.curve,a=c.getPointAt(0),b=c.getPointAt(1);
     const pipe=s.meshes.find(m=>{const p=m.userData.pipeCurve;return p&&(p.getPointAt(0).distanceTo(a)<1e-8&&p.getPointAt(1).distanceTo(b)<1e-8||p.getPointAt(0).distanceTo(b)<1e-8&&p.getPointAt(1).distanceTo(a)<1e-8);});
     if(!pipe)continue;matched++;const pc=pipe.userData.pipeCurve,reverse=pc.getPointAt(0).distanceTo(a)>1e-8;
     for(let i=0;i<=100;i++)maxCenterError=Math.max(maxCenterError,c.getPointAt(i/100).distanceTo(pc.getPointAt(reverse?1-i/100:i/100)));
    }
    checks.push({operation,maxJoin,matched,maxCenterError});
   }
   if(s.kind==='ac'){
    const fan=s.geometry.motion.fan,blade=fan.children[0];blade.geometry.computeBoundingBox();fanBounds={front:blade.geometry.boundingBox.max.z+fan.position.z,guardBack:.2113,shaft:!!fan.getObjectByName('fan-drive-shaft'),blowerShaft:!!s.geometry.motion.blower.getObjectByName('blower-drive-shaft')};
   }
   return {checks,fanBounds};
  });
  await page.screenshot({path:`qa/physics-thermal-${kind}.png`});
 }
 results.errors=errors;await writeFile('qa/physics-thermal-audit.json',JSON.stringify(results,null,2));
 assert.deepEqual(results.engine.collisions,[],'actual moving meshes must clear crankcase over 720 degrees');
 assert(results.engine.openThroat);
 for(const kind of ['fridge','ac'])for(const c of results[kind].checks){assert(c.maxJoin<1e-8);assert(c.matched>=8);assert(c.maxCenterError<1e-6,'tracking and pipe share every bend');}
 assert(results.ac.fanBounds.shaft&&results.ac.fanBounds.blowerShaft);assert(results.ac.fanBounds.front<results.ac.fanBounds.guardBack,'fan blades clear fixed guard');
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
