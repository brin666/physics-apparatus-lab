import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {BASE,ROOT,FRAMES,FPS,applyMediaLayout,encodeFrames,writeReport} from './media-export-shared.mjs';

const WIDTH=720,HEIGHT=960;
const ASSEMBLY_START=.95,ASSEMBLY_END=5;
const machines=[
  {name:'fridge',path:'refrigerator.html'},
  {name:'ac',path:'air-conditioner.html'},
];
const errors=[];
const hash=buffer=>createHash('sha256').update(buffer).digest('hex').slice(0,16);
const dirFor=(name,clip)=>join(FRAMES,`${name}-${clip}`);
const framePath=(directory,index)=>join(directory,`${String(index).padStart(4,'0')}.png`);

await mkdir(FRAMES,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});

async function openMachine(machine){
  const page=await browser.newPage({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:1,reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(`${machine.name}: ${error.message}`));
  page.on('console',message=>{if(message.type()==='error')errors.push(`${machine.name} console: ${message.text()}`);});
  await page.goto(new URL(machine.path,BASE).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.coolingDemo?.ready,{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#machine')?.contentWindow?.coolingScene,{timeout:30000});
  await applyMediaLayout(page);
  await page.addStyleTag({content:`
    body .stage-tools,body .scene-bottom,body .playback-controls,body .whiteboard-open,
    body .mode-bar,body .camera-tools,body .assembly-control-top,body #lesson-toggle{display:none!important}
    body .scene-top{right:20px!important}
    body #operation-switch,body .scene-top button{display:none!important}
  `});
  await page.evaluate(()=>{
    const d=window.coolingDemo;
    d.showLesson(false,{instant:true});
    d.setPlaying(false);
    d.state.selected=null;d.state.labels=false;d.state.playing=false;
    d.setMode('assembled');
    const scene=document.querySelector('#machine').contentWindow.coolingScene;
    scene.viewAction('reset');
    const s=d.state;
    scene.update({...s,kind:s.kind,visible:true,view:'3d',selected:null,labels:false,reduced:false,playing:false,
      assembly:{active:false,time:5,running:false}});
    scene.settleView({presentation:true});scene.viewAction('zoom-in');scene.lab.render(0);
  });
  return page;
}

async function updateScene(page,{mode,assemblyTime,progress,finishAssembly=false}){
  return page.evaluate(({mode,assemblyTime,progress,finishAssembly})=>{
    const d=window.coolingDemo;
    const startsAssembly=!d.state.assembly.active&&(Number.isFinite(assemblyTime)||finishAssembly);
    if(finishAssembly){d.seekAssembly(5);d.finishAssembly();d.setMode('assembled');}
    else if(Number.isFinite(assemblyTime))d.seekAssembly(assemblyTime);
    if(mode)d.setMode(mode);
    if(Number.isFinite(progress))d.setProgress(progress);
    d.setPlaying(false);
    d.state.selected=null;d.state.labels=false;d.state.playing=false;
    const frame=document.querySelector('#machine').contentWindow;
    const scene=frame.coolingScene,s=d.state;
    scene.update({...s,kind:s.kind,visible:true,view:'3d',selected:null,labels:false,reduced:false,playing:false,
      assembly:{active:s.assembly.active,time:s.assembly.time,running:false}});
    scene.settleView({presentation:true});scene.lab._update(0);scene.lab.render(0);
    // startAssembly resets the user camera; apply one capture-only zoom after
    // that reset so the reset does not cancel it on the first recorded frame.
    if(startsAssembly)scene.viewAction('zoom-in');
    scene.lab.render(0);
    return {parent:{progress:s.progress,mode:s.mode,assembly:{...s.assembly}},scene:scene.inspect(),tracked:scene.trackedParcel,
      partPositions:Object.fromEntries(['shell','door','indoor-shell','outdoor-shell'].filter(id=>scene.parts[id]).map(id=>[id,scene.parts[id].position.toArray()])),
      assemblyParts:scene.assembly.parts,motion:scene.inspect().motion};
  },{mode,assemblyTime,progress,finishAssembly});
}

async function screenshot(page,directory,index){
  const buffer=await page.screenshot({path:framePath(directory,index),fullPage:false,animations:'disabled'});
  if(buffer.length<1000)throw new Error(`Unexpectedly small frame ${framePath(directory,index)}`);
  if(index===0&&buffer.readUInt32BE(16)!==WIDTH)throw new Error(`Frame width is not ${WIDTH}`);
  return hash(buffer);
}

async function sampleMachine(machine){
  const page=await openMachine(machine);
  try{
    const assemblyDir=dirFor(machine.name,'assembly');
    await mkdir(assemblyDir,{recursive:true});
    const assembly=await updateScene(page,{assemblyTime:3.2});
    const assemblyHash=await screenshot(page,assemblyDir,0);
    const operationDir=dirFor(machine.name,'operation');
    await mkdir(operationDir,{recursive:true});
    const operation=await updateScene(page,{mode:'xray',progress:.46});
    const operationHash=await screenshot(page,operationDir,0);
    console.log(`${machine.name} samples saved: assembly ${assemblyHash}, operation ${operationHash}; parcel ${JSON.stringify(operation.tracked.position)}`);
  }finally{await page.close();}
}

async function captureAssembly(machine,page){
  const directory=dirFor(machine.name,'assembly');
  await mkdir(directory,{recursive:true});
  const hashes=[];
  let telemetryStart,telemetryMid,telemetryEnd,index=0;
  const first=await updateScene(page,{assemblyTime:ASSEMBLY_START});
  telemetryStart=first;
  for(let hold=0;hold<5;hold++){
    hashes.push(await screenshot(page,directory,index++));
  }
  for(let step=1;step<=60;step++){
    const time=ASSEMBLY_START+(ASSEMBLY_END-ASSEMBLY_START)*step/60;
    const telemetry=await updateScene(page,{assemblyTime:time,finishAssembly:step===60});
    if(step===30)telemetryMid=telemetry;
    if(step===60)telemetryEnd=telemetry;
    hashes.push(await screenshot(page,directory,index++));
    if(index%25===0)console.log(`${machine.name} assembly: ${index} frames`);
  }
  for(let hold=0;hold<10;hold++)hashes.push(await screenshot(page,directory,index++));
  const uniqueFrames=new Set(hashes).size;
  const compressorProgress={start:telemetryStart.assemblyParts.compressor?.progress,mid:telemetryMid.assemblyParts.compressor?.progress,end:telemetryEnd.assemblyParts.compressor?.progress};
  if(!Number.isFinite(compressorProgress.start)||compressorProgress.mid-compressorProgress.start<.5)throw new Error(`${machine.name} compressor did not visibly advance during assembly (${JSON.stringify(compressorProgress)})`);
  if(uniqueFrames<12)throw new Error(`${machine.name} assembly sequence has too few distinct rendered frames (${uniqueFrames})`);
  return {name:`${machine.name}-assembly`,frames:index,fps:FPS,duration:index/FPS,uniqueFrames,
    movingParts:{compressorProgress,parts:{start:telemetryStart.assemblyParts,mid:telemetryMid.assemblyParts,end:telemetryEnd.assemblyParts}},
    finalPose:{mode:telemetryEnd.scene.mode,assemblyActive:telemetryEnd.scene.assemblyActive,assemblyTime:telemetryEnd.scene.assemblyTime}};
}

async function captureOperation(machine,page){
  const directory=dirFor(machine.name,'operation');
  await mkdir(directory,{recursive:true});
  const hashes=[];
  const first=await updateScene(page,{finishAssembly:true,mode:'xray',progress:0});
  const telemetryStart=first;
  let telemetryMid,telemetryEnd,index=0;
  for(let hold=0;hold<5;hold++)hashes.push(await screenshot(page,directory,index++));
  for(let step=1;step<=119;step++){
    const progress=step/119;
    const telemetry=await updateScene(page,{mode:'xray',progress});
    if(step===60)telemetryMid=telemetry;
    if(step===119)telemetryEnd=telemetry;
    hashes.push(await screenshot(page,directory,index++));
    if(index%25===0)console.log(`${machine.name} operation: ${index} frames`);
  }
  for(let hold=0;hold<9;hold++)hashes.push(await screenshot(page,directory,index++));
  const uniqueFrames=new Set(hashes).size;
  const parcelTravel=Math.hypot(...telemetryStart.tracked.position.map((v,i)=>v-telemetryMid.tracked.position[i]));
  if(uniqueFrames<90)throw new Error(`${machine.name} operation sequence has too few distinct rendered frames (${uniqueFrames})`);
  if(parcelTravel<.05)throw new Error(`${machine.name} refrigerant marker did not move enough (${parcelTravel})`);
  if(machine.name==='ac'&&Math.abs(telemetryMid.motion.fan-telemetryStart.motion.fan)<1)throw new Error('AC fan rotation did not change with progress');
  return {name:`${machine.name}-operation`,frames:index,fps:FPS,duration:index/FPS,uniqueFrames,
    trackedParcel:{start:telemetryStart.tracked.position,mid:telemetryMid.tracked.position,end:telemetryEnd.tracked.position,travelToMid:parcelTravel},
    motion:{start:telemetryStart.motion,mid:telemetryMid.motion,end:telemetryEnd.motion},
    mode:telemetryEnd.scene.mode,finalProgress:telemetryEnd.scene.progress};
}

try{
  if(process.argv.includes('--sample-only')){
    for(const machine of machines)await sampleMachine(machine);
    process.exitCode=errors.length?1:0;
  }else{
    const recordings=[];
    for(const machine of machines){
      const page=await openMachine(machine);
      try{
        const assembly=await captureAssembly(machine,page);
        const assemblyMedia=await encodeFrames(dirFor(machine.name,'assembly'),`${machine.name}-assembly`);
        const operation=await captureOperation(machine,page);
        const operationMedia=await encodeFrames(dirFor(machine.name,'operation'),`${machine.name}-operation`);
        recordings.push({assembly:{...assembly,...assemblyMedia},operation:{...operation,...operationMedia}});
      }finally{await page.close();}
    }
    const report={createdAt:new Date().toISOString(),viewport:{width:WIDTH,height:HEIGHT,deviceScaleFactor:1},fps:FPS,
      source:'running local coolingDemo/coolingScene through Playwright and installed Chrome',
      actualMotionVerified:true,recordings,errors};
    await writeReport('cooling-capture',report);
    console.log(JSON.stringify(report,null,2));
    if(errors.length)process.exitCode=1;
  }
}catch(error){
  errors.push(error.stack||String(error));
  await writeReport('cooling-capture',{createdAt:new Date().toISOString(),viewport:{width:WIDTH,height:HEIGHT,deviceScaleFactor:1},fps:FPS,actualMotionVerified:false,errors});
  console.error(error.stack||error);
  process.exitCode=1;
}finally{
  await browser.close();
}
