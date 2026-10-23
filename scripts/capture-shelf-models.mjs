// Render the existing assembled geometry from the front. Only the homepage
// image of the air conditioner omits the outdoor unit and connecting services.
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import {catalog} from '../apparatus/catalog.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const framing={};
try {
 for(const device of catalog){
  const page=await browser.newPage({viewport:{width:700,height:700},deviceScaleFactor:1,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const legacy=['engine','fridge','ac'].includes(device.id);
  await page.goto(`http://127.0.0.1:4198/${device.id==='engine'?'machine-built.html':device.url+'?thumbnail=1'}`);
  if(device.id==='engine')await page.waitForFunction(()=>window.engineScene?.lab?.camera);
  else if(legacy){
   await page.waitForFunction(()=>window.coolingDemo?.ready);
   await page.evaluate(()=>{const demo=window.coolingDemo;demo.finishAssembly();demo.setMode('assembled');demo.setPlaying(false);});
  }else await page.waitForFunction(()=>window.apparatusDemo?.ready);
  const frame=legacy&&device.id!=='engine'?page.frames().find(f=>f!==page.mainFrame()):page.mainFrame();
  const result=await frame.evaluate(async({id,legacy})=>{
   const THREE=await import('/node_modules/three/build/three.module.js');
   let scene,renderer;
   if(legacy){
    const handle=window.engineScene||window.coolingScene,lab=handle.lab;
    handle.update({mode:'assembled',selected:null,labels:false,reduced:true,visible:true,view:'3d',progress:.35,assembly:{active:false,time:5,running:false}});
    handle.select?.(null);handle.settleView?.({presentation:true});
    for(const key of ['cut','explode','xray','labels']){lab.target[key]=0;lab.state[key]=0;}
    handle.state.mode='assembled';handle.state.assembly={active:false,time:5,running:false};lab._update?.(0);
    if(lab.fx)lab.fx.visible=false;
    if(lab.floor)lab.floor.visible=false;
    if(lab._contact?.plane)lab._contact.plane.visible=false;
    if(id==='ac'){
     const indoor=new Set(['indoor-shell','filter','indoor-coil','blower','louver']);
     for(const [key,part] of Object.entries(handle.parts))part.visible=indoor.has(key);
    }
    scene=lab.scene;renderer=lab.renderer;
   }else{
    const demo=window.apparatusDemo;demo.setPlaying(false);
    if(demo.state.mode!=='assembled')throw Error('Thumbnail is not assembled');
    scene=demo.scene.scene;renderer=demo.scene.renderer;
   }
   scene.background=null;scene.updateMatrixWorld(true);
   const bounds=new THREE.Box3();let meshes=0;
   scene.traverse(object=>{
    if(!object.isMesh||object.userData.studio||!object.geometry)return;
    for(let p=object;p;p=p.parent)if(!p.visible)return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    if(materials.every(m=>m.opacity<=.05))return;
    object.geometry.computeBoundingBox();
    bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));meshes++;
   });
   if(bounds.isEmpty())throw Error('No model geometry');
   const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
   const half=Math.max(size.x,size.y)/.84/2;
   const camera=new THREE.OrthographicCamera(-half,half,half,-half,.01,Math.max(100,size.z*10));
   camera.position.copy(center).add(new THREE.Vector3(0,0,Math.max(10,size.z*3)));
   camera.lookAt(center);camera.updateMatrixWorld(true);
   renderer.setPixelRatio(1);renderer.setSize(700,700,false);renderer.setClearColor(0xffffff,0);
   renderer.render(scene,camera);
   const canvas=renderer.domElement,gl=renderer.getContext(),pixels=new Uint8Array(700*700*4);
   gl.readPixels(0,0,700,700,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   let left=700,top=700,right=-1,bottom=-1;
   for(let y=0;y<700;y++)for(let x=0;x<700;x++)if(pixels[(y*700+x)*4+3]){
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,699-y);bottom=Math.max(bottom,699-y);
   }
   if(right<left||left<3||top<3||right>696||bottom>696)throw Error('Empty or clipped model image');
   return {data:canvas.toDataURL('image/png').split(',')[1],bounds:[left,top,right-left+1,bottom-top+1,700,700],meshes};
  },{id:device.id,legacy});
  if(errors.length)throw Error(errors.join('\n'));
  await writeFile(`assets/home/${device.id}.png`,Buffer.from(result.data,'base64'));
  framing[device.id]=result.bounds;
  console.log(`${device.id}: front, ${result.meshes} meshes, bounds ${result.bounds}`);
  await page.close();
 }
 await writeFile('assets/home/framing.json',JSON.stringify(framing,null,2)+'\n');
}finally{await browser.close();}
