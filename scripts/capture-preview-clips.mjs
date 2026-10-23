// Capture actual teaching-model motion once, so hovering the shelf never
// constructs another WebGL renderer or a nested application iframe.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {catalog} from '../apparatus/catalog.mjs';
await mkdir('assets/previews',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const device of catalog.filter(d=>process.argv.length===2||process.argv.slice(2).includes(d.id))){
  const page=await browser.newPage({viewport:{width:600,height:520},deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:4198/${device.url}?preview=1`);
  await page.waitForFunction(()=>window.apparatusDemo?.ready||window.previewReady,{timeout:30000});
  await page.evaluate(id=>{
   const demo=window.apparatusDemo||window.thermalDemo||window.coolingDemo;
   if(id==='engine'){demo.state.speed=2;demo.setAngle(0,false);}
   if(id==='fridge'||id==='ac'){demo.state.speed=16/6;demo.setProgress(0);}
   if(id==='speaker'){demo.setInput('level',1);demo.setInput('frequency',.8);}
   demo.setPlaying(true);
  },device.id);
  await page.waitForTimeout(350);
  const clip=await page.evaluate(async(id)=>{
   const canvas=window.apparatusDemo?.scene.renderer.domElement||document.querySelector('#machine')?.contentDocument?.querySelector('canvas');
   if(!canvas)throw Error('Missing model canvas');
   // Front-facing capture; preserve the scene camera on legacy models so
   // clipping, post-processing and the animated FX layer share one projection.
   const THREE=await import('/node_modules/three/build/three.module.js');
   const detail=window.apparatusDemo?.scene;
   const legacy=document.querySelector('#machine')?.contentWindow;
   const handle=legacy?.engineScene||legacy?.coolingScene;
   handle?.settleView?.({presentation:true});
   const context=detail||handle?.lab,scene=context.scene,renderer=context.renderer;
   if(context.floor)context.floor.visible=false;
   if(context._contact?.plane)context._contact.plane.visible=false;
   scene.updateMatrixWorld(true);
   const bounds=new THREE.Box3();
   scene.traverse(object=>{
    if(!object.isMesh||!object.geometry||object.userData.studio)return;
    for(let p=object;p;p=p.parent)if(!p.visible)return;
    const mats=Array.isArray(object.material)?object.material:[object.material];
    if(mats.every(m=>m.opacity<.03))return;
    object.geometry.computeBoundingBox();bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
   });
   const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
   const aspect=600/520,half=Math.max(size.y,size.x/aspect)/.88/2;
   let camera;
   if(handle||id==='speaker'){
    camera=context.camera;camera.fov=id==='speaker'?55:26;camera.aspect=aspect;
    const distance=half/Math.tan(THREE.MathUtils.degToRad(camera.fov/2))+size.z/2;
    camera.position.copy(center).add(new THREE.Vector3(0,0,distance));camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    const orbit=context.controlsOrbit||context.orbit;orbit.target.copy(center);orbit.autoRotate=false;orbit.update();
    if(context.o)context.o.autoOrbit=false;
   }else{
    camera=new THREE.OrthographicCamera(-half*aspect,half*aspect,half,-half,.01,Math.max(100,size.z*10));
    camera.position.copy(center).add(new THREE.Vector3(0,0,Math.max(10,size.z*3)));camera.lookAt(center);camera.updateMatrixWorld(true);
    const render=renderer.render.bind(renderer);
    renderer.render=(s,c)=>{if(s===scene){camera.layers.mask=c.layers.mask;return render(s,camera);}return render(s,c);};
   }
   renderer.render(scene,camera);
   const stream=canvas.captureStream(24),chunks=[];
   const mimeType=['video/webm;codecs=vp9','video/webm;codecs=vp8'].find(type=>MediaRecorder.isTypeSupported(type));
   if(!mimeType)throw Error('No WebM recorder available');
   const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:850000});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   await new Promise((resolve,reject)=>{recorder.onerror=reject;recorder.onstop=resolve;recorder.start();setTimeout(()=>recorder.stop(),6000);});
   stream.getTracks().forEach(track=>track.stop());
   const blob=new Blob(chunks,{type:mimeType});
   return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);});
  },device.id);
  const bytes=Buffer.from(clip,'base64');
  if(bytes.length<1000)throw Error(`${device.id}: empty recording`);
  await writeFile(`assets/previews/${device.id}.webm`,bytes);
  console.log(`${device.id}: ${(bytes.length/1024).toFixed(0)} KB`);
  await page.close();
 }
}finally{await browser.close();}
