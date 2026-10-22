// Regenerate only the precomputed structural geometry, preserving runtime code.
import {writeFileSync} from 'node:fs';
import {drawing} from '../refrigeration-anatomy-build.mjs';
const data={};
for(const kind of ['fridge','ac']) {
 const d=drawing(kind);
 data[kind]={P:d.P,body:d.body,count:d.count,routes:d.routes};
 console.log(kind,d.count,d.body.length);
}
writeFileSync('refrigeration-anatomy-data.mjs','// Generated from refrigeration-anatomy-build.mjs; qualitative structural geometry.\nexport const COOLING_ANATOMY_DATA = '+JSON.stringify(data)+';\n');
