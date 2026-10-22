import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from 'playwright';

const source=readFileSync('home-engine-preview.source.html','utf8');
const bundle=await build({entryPoints:['home-engine-preview.mjs'],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022'});
const script=bundle.outputFiles[0].text.replaceAll('</script>','<\\/script>');
const html=source.replace('<script type="module" src="./home-engine-preview.mjs"></script>',`<script type="module">${script}</script>`);
assert.notEqual(html,source,'the isolated entry script is present in the source page');

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:700,height:840},deviceScaleFactor:1,reducedMotion:'no-preference'});
const errors=[];
let messageServer;
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.setContent(html,{waitUntil:'load'});
  await page.waitForFunction(()=>window.homeEnginePreview?.ready===true,null,{timeout:30000});

  const initial=await page.evaluate(()=>{
    window.__previewDrawCalls=0;
    const api=window.homeEnginePreview,scene=window.engineScene,canvas=document.querySelector('canvas');
    const gl=canvas.getContext('webgl2'),pixels=new Uint8Array(canvas.width*canvas.height*4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let count=0,minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      if(!pixels[(y*canvas.width+x)*4+3])continue;
      count++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    }
    const cornerAlpha=[
      pixels[3],pixels[(canvas.width-1)*4+3],
      pixels[((canvas.height-1)*canvas.width)*4+3],
      pixels[(canvas.height*canvas.width-1)*4+3],
    ];
    const dir=scene.lab.camera.position.clone().sub(scene.lab.controlsOrbit.target);
    const azimuth=Math.atan2(dir.x,dir.z)*180/Math.PI,elevation=Math.asin(dir.y/dir.length())*180/Math.PI;
    const probes=[];
    for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){
      const original=gl[name];
      gl[name]=function(...args){window.__previewDrawCalls++;return original.apply(this,args);};
      if(gl[name]!==original)probes.push(name);
    }
    return {
      canvasCount:document.querySelectorAll('canvas').length,size:[canvas.width,canvas.height],
      alphaCount:count,alphaBounds:[minX,minY,maxX,maxY],cornerAlpha,mode:scene.state.mode,
      selected:scene.state.selected,assembly:scene.state.assembly,presentation:{...scene.lab.state},
      angle:api.angle,flywheel:scene.parts.flywheel.rotation.z,pistonY:scene.parts.piston.position.y,
      azimuth,elevation,instrumented:probes.length,
    };
  });
  assert.equal(initial.canvasCount,1);
  assert.deepEqual(initial.size,[700,840]);
  assert.ok(initial.alphaCount>10000,'the transparent canvas contains the real engine model');
  assert.deepEqual(initial.cornerAlpha,[0,0,0,0],'the canvas corners remain transparent');
  const [x0,y0,x1,y1]=initial.alphaBounds;
  const coverage=Math.max((x1-x0+1)/700,(y1-y0+1)/840);
  assert.ok(coverage>0.82&&coverage<=0.88,`alpha-fit coverage is ${coverage.toFixed(3)}`);
  assert.equal(initial.mode,'assembled');
  assert.equal(initial.selected,null);
  assert.equal(initial.assembly.active,false);
  assert.equal(initial.angle,410);
  for(const key of ['cut','explode','xray','labels'])assert.equal(initial.presentation[key],0,`${key} is settled`);
  assert.ok(Math.abs(initial.azimuth-4)<0.1,`camera azimuth ${initial.azimuth}`);
  assert.ok(Math.abs(initial.elevation-10)<0.1,`camera elevation ${initial.elevation}`);
  assert.ok(initial.instrumented>0,'the stopped renderer can be observed');
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>window.__previewDrawCalls),0,'the static preview does not render while stopped');

  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>window.homeEnginePreview.play()),false,'reduced motion disables playback');
  await page.emulateMedia({reducedMotion:'no-preference'});

  mkdirSync('qa',{recursive:true});
  await page.screenshot({path:'qa/home-engine-preview.png'});
  assert.equal(await page.evaluate(()=>window.homeEnginePreview.play()),true);
  assert.deepEqual(await page.evaluate(()=>({angle:window.homeEnginePreview.angle,running:window.homeEnginePreview.running})),
    {angle:410,running:true},'play begins at the static PNG pose');
  await page.waitForTimeout(650);
  const moving=await page.evaluate(()=>({
    angle:window.homeEnginePreview.angle,flywheel:window.engineScene.parts.flywheel.rotation.z,
    pistonY:window.engineScene.parts.piston.position.y,drawCalls:window.__previewDrawCalls,
  }));
  assert.ok(moving.angle>500&&moving.angle<800,`cycle advances linearly, angle ${moving.angle}`);
  assert.ok(Math.abs(moving.flywheel)>0.5,'the physical flywheel rotates');
  assert.ok(Math.abs(moving.pistonY-initial.pistonY)>0.005,'the physical piston reciprocates');
  assert.ok(moving.drawCalls>0,'rendering occurs during playback');

  await page.evaluate(()=>window.homeEnginePreview.pause());
  const paused=await page.evaluate(()=>({
    angle:window.homeEnginePreview.angle,running:window.homeEnginePreview.running,
    flywheel:window.engineScene.parts.flywheel.rotation.z,pistonY:window.engineScene.parts.piston.position.y,
  }));
  assert.ok(paused.angle>410&&paused.angle<1130,'pause freezes the current cycle angle');
  assert.equal(paused.running,false);
  const pauseDraws=await page.evaluate(()=>window.__previewDrawCalls);
  const stoppedDraws=await page.evaluate(()=>window.__previewDrawCalls);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.__previewDrawCalls),stoppedDraws,'pause leaves rendering idle');
  assert.equal(stoppedDraws,pauseDraws,'pause does not redraw the frozen pose');
  await page.evaluate(()=>window.homeEnginePreview.reset());
  const reset=await page.evaluate(()=>({
    angle:window.homeEnginePreview.angle,
    flywheel:window.engineScene.parts.flywheel.rotation.z,
    pistonY:window.engineScene.parts.piston.position.y,
  }));
  assert.equal(reset.angle,410);
  assert.ok(Math.abs(reset.flywheel-initial.flywheel)<1e-9,'reset settles the flywheel at the PNG pose');
  assert.ok(Math.abs(reset.pistonY-initial.pistonY)<1e-9,'reset settles the piston at the PNG pose');

  assert.equal(await page.evaluate(()=>window.homeEnginePreview.play()),true);
  await page.waitForFunction(()=>window.homeEnginePreview?.running===false,null,{timeout:5000});
  const complete=await page.evaluate(()=>({angle:window.homeEnginePreview.angle,sceneAngle:window.engineScene.state.angle}));
  assert.deepEqual(complete,{angle:410,sceneAngle:410},'a complete cycle ends at the static PNG pose');
  assert.deepEqual(errors,[]);

  messageServer=createServer((request,response)=>{
    response.writeHead(200,{'content-type':'text/html; charset=utf-8'});
    response.end('<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%}iframe{border:0;width:100%;height:100%}</style></head><body><iframe id="preview"></iframe><script>window.previewMessages=[];addEventListener("message",event=>{if(event.source===document.getElementById("preview").contentWindow)window.previewMessages.push(event.data)})</script></body></html>');
  });
  await new Promise((resolve,reject)=>{
    messageServer.once('error',reject);
    messageServer.listen(0,'127.0.0.1',resolve);
  });
  const messagePage=await browser.newPage({viewport:{width:700,height:840},reducedMotion:'no-preference'});
  await messagePage.goto(`http://127.0.0.1:${messageServer.address().port}/`);
  await messagePage.locator('#preview').evaluate((iframe,srcdoc)=>{iframe.srcdoc=srcdoc;},html);
  await messagePage.waitForFunction(()=>window.previewMessages.some(message=>message.type==='home-engine-ready'),null,{timeout:10000});
  const srcdocFrame=messagePage.frames().find(frame=>frame!==messagePage.mainFrame());
  const origins=await srcdocFrame.evaluate(()=>({locationOrigin:location.origin,windowOrigin:window.origin,parentOrigin:parent.location.origin}));
  assert.equal(origins.locationOrigin,'null','about:srcdoc reports its opaque URL origin');
  assert.equal(origins.windowOrigin,origins.parentOrigin,'the inline preview inherits the HTTP parent origin');
  assert.equal(await srcdocFrame.evaluate(()=>window.homeEnginePreview.play({duration:120})),true);
  await messagePage.waitForFunction(()=>window.previewMessages.some(message=>message.type==='home-engine-ended'),null,{timeout:3000});
  assert.equal(await srcdocFrame.evaluate(()=>window.homeEnginePreview.angle),410);
  assert.deepEqual(await messagePage.evaluate(()=>window.previewMessages.map(message=>message.type).filter(type=>type.startsWith('home-engine'))),
    ['home-engine-ready','home-engine-ended'],'srcdoc sends same-origin ready and ended events');
  await messagePage.close();

  console.log('transparent 700x840 engine, capture-matched camera, assembled pose, idle rendering, reduced motion, pause, and full 720 degree cycle passed');
  console.log('same-origin HTTP parent and about:srcdoc ready/ended messages passed');
  console.log('screenshot: qa/home-engine-preview.png');
}finally{
  await browser.close();
  if(messageServer)await new Promise(resolve=>messageServer.close(resolve));
}
