import {writeFileSync} from 'node:fs';
import {drawing} from '../refrigeration-anatomy-build.mjs';
import * as A from '../vendor/anatomy-kit/audit.mjs';
const results={};
for(const kind of ['fridge','ac']) {
 const d=drawing(kind);
 results[kind]={entityCount:d.count,poses:{}};
 for(const mode of ['cut','assembled']) {
  const items=d.R.items.filter(i=>i.op!=='heat'&&(mode==='assembled'?(kind!=='fridge'||i.piece!=='door'||i.cover):!i.cover));
  const solids=items.flatMap(i=>i.shapes);
  const owners=new Set(solids.map(s=>s.owner).filter(Boolean));
  const pose={...d.R,items,solids,tubes:d.R.tubes.filter(t=>owners.has(t.owner)),routes:d.R.routes.filter(t=>owners.has(t.name)),settled:null};
  // Clearance is checked per visible pose. Full support/press-fit diagnostics
  // remain separate from visible pipe interference in this teaching cutaway.
  const clearance=A.clearances(pose.tubes,pose.solids);
  results[kind].poses[mode]={clearance};
  const main=clearance.filter(c=>c.kind==='through'&&!/铝翅片|阀体|感温|蒸发板|接管/.test(c.other));
  console.log(kind,mode,'clearance findings',clearance.length,'through outside fins/valve channels',main.length);
  for(const c of main.slice(0,20))console.log(c.tube,'×',c.other,c.clearance.toFixed(2),JSON.stringify(c.at));
  if(clearance.length)process.exitCode=1;
 }
}
writeFileSync('qa/cooling-anatomy-audit.json',JSON.stringify(results,null,2));
