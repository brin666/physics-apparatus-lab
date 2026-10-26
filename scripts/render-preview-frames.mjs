// Browser-side authoring helper. Sample the model clock directly: never record
// wall-clock RAF/MediaRecorder stalls into the homepage videos.
export async function renderPreviewFrames(id){
 const T=await import('../node_modules/three/build/three.module.js');
 const {previewInputs,guidedDuration}=await import('../apparatus/preview-inputs.mjs');
 const fps=30,width=480,height=416,aspect=width/height;
 let scene,renderer,camera,draw,span,duration,model;
 const demo=window.apparatusDemo;
 if(demo){
  const s=demo.scene,definition=demo.definition;demo.setPlaying(false);
  if(id==='speaker'){demo.setInput('level',1);demo.setInput('frequency',.8);}
  if(id==='induction-hob')s.mode('cut');
  s.seek(0);const saved=s.snapshot();saved.flatBlend=s.state.mode==='cut'?1:0;saved.focusBlend=s.state.mode==='xray'?1:0;s.restore(saved);s.freeze(true);
  ({scene,renderer,model}=s);const inputs={...s.state.inputs};delete inputs._phaseOffset;
  span=guidedDuration(id)|| (definition.phaseRate?(id==='piston-pump'?1:Math.PI*2)/definition.phaseRate(inputs):id==='canal-lock'?20:6);
  if(id==='speaker')span*=4;if(id==='generator')span*=3;
  duration=id==='electroscope'?span/2:id==='canal-lock'?10:span;
  const warm=id==='submarine'?24:0;
  if(warm){model.reset?.(0,{...inputs,...previewInputs(id,0)});for(let n=0;n<=warm*fps;n++)model.update(n/fps,{...inputs,...previewInputs(id,n/fps)});}
  const update=t=>{model.update(t+warm,{...inputs,...previewInputs(id,t+warm)});model.setView?.({mode:s.state.mode,planar:s.state.mode==='cut'?1:0});};
  update(0);scene.updateMatrixWorld(true);
  const bounds=visibleBounds(scene,T);
  if(id==='piston-pump'){bounds.min.set(-.55,.04,-.34);bounds.max.set(.44,1.96,.34);}
  if(id==='induction-hob'){bounds.min.set(-.61,-.10,-.02);bounds.max.set(.84,.70,.02);}
  const size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),half=Math.max(size.y,size.x/aspect)/.84/2;
  camera=id==='speaker'?new T.PerspectiveCamera(55,aspect,.01,100):new T.OrthographicCamera(-half*aspect,half*aspect,half,-half,.01,100);
  camera.position.copy(center).add(new T.Vector3(0,0,id==='speaker'?half/Math.tan(T.MathUtils.degToRad(55/2))+size.z/2:10));camera.lookAt(center);camera.updateMatrixWorld(true);
  renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.setClearColor(0xffffff,1);
  draw=t=>{update(t);renderer.render(scene,camera);};
 }else{
  window.previewPaused=true;const api=window.thermalDemo||window.coolingDemo;api.setPlaying(false);
  const child=document.querySelector('#machine').contentWindow,handle=child.engineScene||child.coolingScene,lab=handle.lab;
  handle.update({playing:false,visible:true,assembly:{active:false,time:0},labels:false,selected:null,mode:id==='engine'?'cut':'xray',angle:0,progress:0});handle.settleView({presentation:true});
  const render=lab.render.bind(lab);lab.render=()=>{};lab.o.autoOrbit=false;lab.controlsOrbit.autoRotate=false;
  if(lab.floor)lab.floor.visible=false;if(lab._contact?.plane)lab._contact.plane.visible=false;
  ({scene,renderer,camera}=lab);scene.updateMatrixWorld(true);
  const bounds=visibleBounds(scene,T),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),half=Math.max(size.y,size.x/aspect)/.88/2;
  camera.fov=26;camera.aspect=aspect;camera.position.copy(center).add(new T.Vector3(0,0,half/Math.tan(T.MathUtils.degToRad(13))+size.z/2));camera.lookAt(center);camera.updateProjectionMatrix();lab.controlsOrbit.target.copy(center);lab.controlsOrbit.update();
  renderer.setPixelRatio(1);lab._resize();renderer.setClearColor(0xffffff,1);
  span=1;duration=id==='engine'?6:8;
  draw=t=>{handle.update(id==='engine'?{angle:t*720,playing:false}:{progress:t,playing:false});render(0);};
 }
 const config={codec:'avc1.42001f',width,height,framerate:fps,bitrate:1000000,latencyMode:'realtime',avc:{format:'annexb'}};
 if(!(await VideoEncoder.isConfigSupported(config)).supported)throw Error('H.264 encoder unavailable');
 let encoderError;const chunks=[];
 const encoder=new VideoEncoder({output:chunk=>{const a=new Uint8Array(chunk.byteLength);chunk.copyTo(a);chunks.push(a);},error:e=>encoderError=e});encoder.configure(config);
 const count=Math.round(duration*fps);
 const flat=document.createElement('canvas');flat.width=width;flat.height=height;const ctx=flat.getContext('2d',{alpha:false});
 for(let n=0;n<count;n++){
  draw(n/count*span);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(renderer.domElement,0,0,width,height);
  const frame=new VideoFrame(flat,{timestamp:Math.round(n*1e6/fps),duration:Math.round(1e6/fps)});encoder.encode(frame,{keyFrame:n%fps===0});frame.close();
  if(n%30===29)await encoder.flush();if(encoderError)throw encoderError;
 }
 await encoder.flush();encoder.close();
 if(chunks.length!==count)throw Error(`Missing encoded frames: ${chunks.length}/${count}`);
 const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks));});
 return {data,frames:count,fps,duration:count/fps,span};
}
function visibleBounds(scene,T){
 const box=new T.Box3();scene.traverse(o=>{if(!o.isMesh||!o.geometry||o.userData.studio)return;for(let p=o;p;p=p.parent)if(!p.visible)return;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.every(m=>m.opacity<.03))return;o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});
 if(![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite))throw Error('Invalid model bounds');return box;
}
