import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {catalog} from './apparatus/catalog.mjs';
const bundle=async(entry)=>{const r=await build({entryPoints:[entry],bundle:true,write:false,format:'iife',target:'es2022',minify:true,legalComments:'inline'});return r.outputFiles[0].text;};
const scriptSafe=s=>s.replace(/<\/script/gi,'<\\/script');
const inlineStyles=html=>html.replace(/<link rel="stylesheet" href="\.\/([^"]+)">/g,(_,file)=>`<style>${readFileSync(file,'utf8')}</style>`);
function inlineMachine(file,script){
  const html=readFileSync(file,'utf8').replace(/<script\s+type=["']importmap["'][\s\S]*?<\/script>/gi,'').replace(/<script\s+(?:type=["']module["']\s+src=["'][^"']+["']|src=["'][^"']+["']\s+type=["']module["'])[^>]*>\s*<\/script>/gi,()=>`<script>${scriptSafe(script)}</script>`);
  if(/<script[^>]*type=["']module["']/.test(html))throw Error('Machine entry was not inlined: '+file);
  return html;
}
const devices=[['engine','engine.html','汽油机'],['fridge','refrigerator.html','电冰箱'],['ac','air-conditioner.html','空调']];
const navigation=kind=>`<nav class="machine-nav" aria-label="选择热学设备">${devices.map(([id,url,label])=>`<a href="./${url}"${id===kind?' aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
const [engineJs,engineApp,coolingJs,coolingApp]=await Promise.all([bundle('machine-scene.mjs'),bundle('app.mjs'),bundle('refrigeration-scene.mjs'),bundle('cooling-app.mjs')]);
const engineMachine=inlineMachine('machine.html',engineJs);
let html=inlineStyles(readFileSync('engine.source.html','utf8')).replace(/<nav class="machine-nav"[\s\S]*?<\/nav>/,navigation('engine')).replace('<script type="module" src="./app.mjs"></script>',()=>`<script>window.MACHINE_DOCUMENT=${JSON.stringify(engineMachine).replace(/</g,'\\u003c')};</script><script>${scriptSafe(engineApp)}</script>`);
writeFileSync('engine.html',html);writeFileSync('machine-built.html',engineMachine);
const coolingTemplate=inlineMachine('refrigeration-machine.html',coolingJs);
const coolingShell=inlineStyles(readFileSync('cooling.source.html','utf8'));
for(const [kind,file,name] of devices.slice(1,3)){
  const machine=coolingTemplate.replaceAll('__COOLING_MACHINE__',kind);
  const nav=navigation(kind);
  const page=coolingShell.replaceAll('__COOLING_MACHINE__',kind).replaceAll('__COOLING_NAME__',name).replace('__MACHINE_NAV__',nav).replace('<script type="module" src="./cooling-app.mjs"></script>',()=>`<script>window.COOLING_DOCUMENT=${JSON.stringify(machine).replace(/</g,'\\u003c')};</script><script>${scriptSafe(coolingApp)}</script>`);
  writeFileSync(file,page);
  console.log(`Built offline ${file} (${(Buffer.byteLength(page)/1024/1024).toFixed(2)} MB)`);
}
mkdirSync('qa',{recursive:true});
const newApp=await bundle('apparatus/app.mjs');
const newShell=inlineStyles(readFileSync('apparatus.source.html','utf8'));
for(const device of catalog.slice(3)){
 const page=newShell.replaceAll('__APPARATUS_ID__',device.id).replaceAll('__APPARATUS_NAME__',device.name).replace('<script type="module" src="./apparatus/app.mjs"></script>',()=>`<script>${scriptSafe(newApp)}</script>`);
 writeFileSync(device.url,page);
 console.log(`Built ${device.url}`);
}
const images=Object.fromEntries(catalog.filter(d=>existsSync(d.image)).map(d=>[d.id,'data:image/png;base64,'+readFileSync(d.image).toString('base64')]));
const homeJs=await bundle('map-home.mjs');
const home=inlineStyles(readFileSync('map-home.source.html','utf8')).replace('<script type="module" src="./map-home.mjs"></script>',()=>`<script>window.HOME_IMAGES=${JSON.stringify(images)};</script><script>${scriptSafe(homeJs)}</script>`);
writeFileSync('index.html',home);
console.log(`Built fifteen-device shelves (${(Buffer.byteLength(home)/1024).toFixed(0)} KB; ${Object.keys(images).length} assembled thumbnails)`);
