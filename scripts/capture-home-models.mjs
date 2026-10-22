import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const baseUrl=(process.argv.find((arg,index)=>process.argv[index-1]==='--base-url')||'http://127.0.0.1:4198').replace(/\/$/,'');
const outputDir=resolve('assets/home');
const width=700,height=840,fill=0.74;
const models=[
  {name:'engine',path:'/machine-built.html',scene:'engineScene',mode:'assembled',az:4,el:10},
  {name:'fridge',path:'/refrigerator.html',scene:'coolingScene',mode:'assembled',az:-22,el:11},
  {name:'ac',path:'/air-conditioner.html',scene:'coolingScene',mode:'assembled',az:20,el:12},
];
const selectedDevice=process.argv.find((arg,index)=>process.argv[index-1]==='--device');
if(selectedDevice&&!models.some(model=>model.name===selectedDevice))throw new Error('Unknown device: '+selectedDevice);

await mkdir(outputDir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
try{
  for(const model of models.filter(model=>!selectedDevice||model.name===selectedDevice)){
    const page=await browser.newPage({viewport:{width:width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
    page.on('pageerror',error=>console.error(`${model.name}: ${error.message}`));
    await page.goto(baseUrl+model.path,{waitUntil:'domcontentloaded'});
    if(model.name==='engine'){
      await page.waitForFunction(()=>!!window.engineScene?.lab?.camera,{timeout:30000});
    }else{
      await page.waitForFunction(()=>window.coolingDemo?.ready||window.experimentDemo?.ready,{timeout:30000});
      await page.waitForFunction(()=>document.getElementById('machine')?.contentWindow?.coolingScene||document.getElementById('machine')?.contentWindow?.experimentScene,{timeout:30000});
      await page.evaluate(()=>{
        const demo=window.coolingDemo||window.experimentDemo;
        demo.finishAssembly?.();
        demo.setMode?.('assembled');
        if(demo.state){
          demo.state.mode='assembled';demo.state.selected=null;demo.state.labels=false;demo.state.playing=false;
          demo.state.assembly={active:false,time:5,running:false};
        }
      });
    }
    const frame=model.name==='engine'?page.mainFrame():page.frames().find(item=>item!==page.mainFrame());
    const captured=await frame.evaluate(async({sceneName,mode,width,height,fill,az,el})=>{
      const sceneHandle=window[sceneName];
      if(!sceneHandle)throw new Error(`Missing ${sceneName}`);
      const lab=sceneHandle.lab;
      if(sceneName==='engineScene'){
        sceneHandle.update({mode,selected:null,labels:false,visible:true,assembly:{active:false,time:0}});
      }else if(sceneName==='coolingScene'){
        sceneHandle.update({mode,selected:null,labels:false,reduced:true,visible:true,view:'3d',progress:.35,assembly:{active:false,time:0,running:false}});
      }else{
        sceneHandle.update({mode,selected:null,reduced:true,visible:true,view:'3d',progress:0,assembly:{active:false,time:0,running:false}});
      }
      sceneHandle.select?.(null);
      sceneHandle.settleView?.({presentation:true});
      for(const key of ['cut','explode','xray','labels']){
        lab.target[key]=0;
        lab.state[key]=0;
      }
      sceneHandle.state.mode='assembled';
      if(sceneHandle.state.assembly)sceneHandle.state.assembly={active:false,time:5,running:false};
      lab._update?.(0);
      if(sceneName==='coolingScene'){
        lab.fx.visible=false;
      }
      if(sceneHandle.state.mode!=='assembled'||sceneHandle.state.assembly?.active)throw new Error('Scene did not settle in assembled mode');
      for(const key of ['cut','explode','xray'])if(Math.abs(lab.state[key])>.001||Math.abs(lab.target[key])>.001)throw new Error(`${key} presentation did not settle to zero`);
      const enclosureChecks={};
      if(sceneName==='coolingScene'){
        const enclosureIds=sceneHandle.kind==='fridge'?['shell','door']:['indoor-shell','outdoor-shell'];
        for(const id of enclosureIds){
          const enclosure=sceneHandle.parts[id];
          if(!enclosure?.visible)throw new Error(`Assembled enclosure ${id} is hidden`);
          let visibleMeshes=0,opaqueMeshes=0;
          enclosure.traverse(object=>{if(!object.isMesh||!object.visible)return;visibleMeshes++;if((object.material?.opacity??1)>.95)opaqueMeshes++;});
          if(!visibleMeshes||!opaqueMeshes)throw new Error(`Assembled enclosure ${id} has no visible outer panels`);
          enclosureChecks[id]={visibleMeshes,opaqueMeshes};
        }
        if(sceneHandle.kind==='fridge'){
          const door=sceneHandle.parts.door;
          if(door.position.length()>.02)throw new Error('Refrigerator door is not in its closed position');
          enclosureChecks.doorPosition=door.position.toArray();
        }
      }
      lab.scene.background=null;
      if(lab.floor)lab.floor.visible=false;
      if(lab._contact?.plane)lab._contact.plane.visible=false;
      if(lab.ui)lab.ui.style.display='none';

      const THREE=await import('/node_modules/three/build/three.module.js');
      const oldTarget=lab.controlsOrbit.target.clone();
      const originalDistance=lab.camera.position.distanceTo(oldTarget);
      const angle=THREE.MathUtils.degToRad(az),elevation=THREE.MathUtils.degToRad(el);
      const facing=new THREE.Vector3(Math.cos(elevation)*Math.sin(angle),Math.sin(elevation),Math.cos(elevation)*Math.cos(angle));
      lab.camera.position.copy(oldTarget).addScaledVector(facing,originalDistance);
      lab.camera.up.set(0,1,0);lab.camera.lookAt(oldTarget);lab.camera.updateMatrixWorld(true);
      const box=new THREE.Box3();
      const point=new THREE.Vector3();
      let visibleMeshCount=0;
      lab.scene.updateMatrixWorld(true);
      lab.scene.traverse(object=>{
        if(!object.isMesh||!object.visible||object.userData.studio||object===lab._contact?.plane)return;
        let ancestor=object.parent;
        while(ancestor&&ancestor!==lab.scene){if(!ancestor.visible)return;ancestor=ancestor.parent;}
        const mats=Array.isArray(object.material)?object.material:[object.material];
        const visualOpacity=object.userData.effectiveOpacity??Math.max(...mats.map(material=>material?.opacity??1));
        if(visualOpacity<=.05||!object.geometry)return;
        visibleMeshCount++;
        if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
        const bounds=object.geometry.boundingBox;
        if(!bounds||bounds.isEmpty())return;
        for(let i=0;i<8;i++){
          point.set(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z).applyMatrix4(object.matrixWorld);
          box.expandByPoint(point);
        }
      });
      if(box.isEmpty())throw new Error('No visible model meshes found');
      const center=box.getCenter(new THREE.Vector3());
      const direction=lab.camera.position.clone().sub(lab.controlsOrbit.target).normalize();
      const forward=direction.clone().negate();
      const worldUp=new THREE.Vector3(0,1,0);
      const right=forward.clone().cross(worldUp).normalize();
      const up=right.clone().cross(forward).normalize();
      const aspect=width/height,tanY=Math.tan(THREE.MathUtils.degToRad(lab.camera.fov/2)),tanX=tanY*aspect;
      let distance=0;
      for(let i=0;i<8;i++){
        const corner=new THREE.Vector3(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).sub(center);
        const depth=corner.dot(direction),x=Math.abs(corner.dot(right)),y=Math.abs(corner.dot(up));
        distance=Math.max(distance,depth+x/(tanX*fill),depth+y/(tanY*fill));
      }
      distance=Math.max(distance+.035,.25);
      lab.camera.aspect=aspect;
      lab.camera.position.copy(center).addScaledVector(direction,distance);
      lab.camera.up.set(0,1,0);
      lab.camera.lookAt(center);
      lab.camera.updateProjectionMatrix();
      lab.camera.updateMatrixWorld(true);
      lab.controlsOrbit.target.copy(center);
      lab.controlsOrbit.maxDistance=Math.max(lab.controlsOrbit.maxDistance||0,distance*1.1);

      const renderer=new THREE.WebGLRenderer({canvas:document.createElement('canvas'),alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
      renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.setClearColor(0x000000,0);
      renderer.outputColorSpace=lab.renderer.outputColorSpace;
      renderer.toneMapping=THREE.NeutralToneMapping;
      renderer.toneMappingExposure=lab.renderer.toneMappingExposure;
      renderer.localClippingEnabled=true;
      renderer.shadowMap.enabled=true;
      renderer.shadowMap.type=lab.renderer.shadowMap.type;
      const studio=new THREE.Scene();
      const room=new THREE.Mesh(new THREE.SphereGeometry(30,32,16),new THREE.MeshBasicMaterial({color:0x9c9a95,side:THREE.BackSide}));studio.add(room);
      const studioFloor=new THREE.Mesh(new THREE.CircleGeometry(30,32),new THREE.MeshBasicMaterial({color:0xd8d6d0}));studioFloor.rotation.x=-Math.PI/2;studioFloor.position.y=-2;studio.add(studioFloor);
      const softbox=(w,h,x,y,z,intensity,tint=[1,1,1])=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(...tint).multiplyScalar(intensity),side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.lookAt(0,0,0);studio.add(mesh);};
      softbox(14,10,0,14,2,2.6);softbox(4,14,-12,4,8,4.5,[1,.96,.9]);softbox(2.2,14,13,5,-6,6,[.88,.94,1]);softbox(2.2,14,-11,5,-9,3.5);softbox(8,3,6,1.5,12,1.4);softbox(5,16,12,4,7,.02);softbox(4,16,-13,4,-2,.02);softbox(16,3,0,-1,-14,.03);
      const pmrem=new THREE.PMREMGenerator(renderer);
      lab.scene.environment=pmrem.fromScene(studio,.02).texture;
      pmrem.dispose();
      const canvas=renderer.domElement,gl=renderer.getContext(),pixels=new Uint8Array(width*height*4);
      const alphaBounds=()=>{
        gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let visible=0,opaque=0,minX=width,minY=height,maxX=-1,maxY=-1;
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){
          const alpha=pixels[(y*width+x)*4+3];
          if(alpha){const topY=height-1-y;visible++;if(alpha===255)opaque++;minX=Math.min(minX,x);minY=Math.min(minY,topY);maxX=Math.max(maxX,x);maxY=Math.max(maxY,topY);}
        }
        return {visible,opaque,bounds:[minX,minY,maxX,maxY]};
      };
      renderer.render(lab.scene,lab.camera);
      let alpha=alphaBounds();
      if(!alpha.visible)throw new Error('Render is fully transparent');
      for(let iteration=0;iteration<4;iteration++){
        const [x0,y0,x1,y1]=alpha.bounds;
        const coverage=Math.max((x1-x0+1)/width,(y1-y0+1)/height);
        const factor=Math.min(1.2,.86/coverage);
        if(factor<1.012)break;
        const offset=lab.camera.position.clone().sub(center);
        lab.camera.position.copy(center).addScaledVector(offset,1/factor);
        lab.camera.lookAt(center);lab.camera.updateMatrixWorld(true);
        lab.controlsOrbit.update();
        renderer.render(lab.scene,lab.camera);
        alpha=alphaBounds();
      }
      const dataUrl=canvas.toDataURL('image/png');
      renderer.dispose();
      return {dataUrl,alpha,meshCount:visibleMeshCount,distance,enclosureChecks,mode:sceneHandle.state.mode,presentation:{cut:lab.state.cut,explode:lab.state.explode,xray:lab.state.xray}};
    },{sceneName:model.scene,mode:model.mode,width,height,fill,az:model.az,el:model.el});
    const png=Buffer.from(captured.dataUrl.slice('data:image/png;base64,'.length),'base64');
    if(png.readUInt32BE(16)!==width||png.readUInt32BE(20)!==height||png[25]!==6)throw new Error(`${model.name} output is not a ${width}x${height} RGBA PNG`);
    await writeFile(resolve(outputDir,`${model.name}.png`),png);
    const [x0,y0,x1,y1]=captured.alpha.bounds;
    const enclosureInfo=Object.keys(captured.enclosureChecks).length?`; enclosures ${JSON.stringify(captured.enclosureChecks)}`:'';
    console.log(`${model.name}.png ${width}x${height} RGBA; mode ${captured.mode}; cut/xray/explode ${captured.presentation.cut}/${captured.presentation.xray}/${captured.presentation.explode}; ${captured.meshCount} scene meshes; alpha bounds ${x0},${y0}–${x1},${y1}; ${captured.alpha.visible} nontransparent pixels${enclosureInfo}; ${png.length} bytes`);
    await page.close();
  }
}finally{
  await browser.close();
}
