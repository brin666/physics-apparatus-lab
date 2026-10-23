import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalog} from '../apparatus/catalog.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'dist');
await mkdir(output,{recursive:true});
const notice='<!-- Original project: MIT. Bundled third-party copyrights: see THIRD_PARTY_NOTICES.md and vendor/*-LICENSE. -->\n';
for(const file of ['index.html',...catalog.map(d=>d.url)]){
 const html=await readFile(resolve(root,file),'utf8');
 if(!html.includes('<html'))throw new Error(`Missing built HTML: ${file}`);
 await writeFile(resolve(output,file),notice+html);
}
for(const file of ['LICENSE','THIRD_PARTY_NOTICES.md','vendor/MACHINE-LICENSE','vendor/ANATOMY-LICENSE','vendor/THREE-LICENSE']){
 await mkdir(dirname(resolve(output,file)),{recursive:true});
 await copyFile(resolve(root,file),resolve(output,file));
}
await mkdir(resolve(output,'assets/previews'),{recursive:true});
for(const device of catalog)await copyFile(resolve(root,`assets/previews/${device.id}.webm`),resolve(output,`assets/previews/${device.id}.webm`));
await writeFile(resolve(output,'.nojekyll'),'');
console.log(`Staged ${catalog.length+1} pages, lightweight preview clips and license notices in dist/`);
