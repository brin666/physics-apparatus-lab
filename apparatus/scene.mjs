import {THREE,clamp} from './kit.mjs';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {previewInputs,hasGuidedOperation,guidedStart} from './preview-inputs.mjs';
const smooth=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10)};
export function createApparatusScene(container,definition,{onSelect=()=>{},onInput=()=>{},onChange=()=>{},preview=false,staticView=false}={}){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.localClippingEnabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xffffff,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;container.append(renderer.domElement);renderer.domElement.setAttribute('aria-label',`${definition.name}三维模型`);renderer.domElement.tabIndex=preview?-1:0;
 const scene=new THREE.Scene(),pmrem=new THREE.PMREMGenerator(renderer),environment=new RoomEnvironment();const target=pmrem.fromScene(environment,.04);scene.environment=target.texture;environment.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xffffff,0xb8c6d5,2));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(3,5,4);scene.add(key);const rim=new THREE.DirectionalLight(0xddeaff,1.4);rim.position.set(-4,2,-3);scene.add(rim);
 const model=definition.build();scene.add(model.root);const camera=definition.flatViewDirection?new THREE.OrthographicCamera(-1,1,1,-1,.01,200):new THREE.PerspectiveCamera(34,1,.01,200);camera.aspect=1;camera.fov=34;const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=false;orbit.enablePan=true;orbit.minDistance=.3;orbit.maxDistance=30;orbit.enabled=!preview;orbit.rotateSpeed=.65;
 const inputs=Object.fromEntries(definition.controls.map(c=>[c.id,c.value]));
 const state={t:hasGuidedOperation(definition.id)&&!definition.timeContinuous?guidedStart(definition.id,inputs):0,guideOffset:definition.timeContinuous?guidedStart(definition.id,inputs):0,inputs,playing:!staticView,mode:staticView?'assembled':preview?(definition.previewMode||definition.defaultMode||'assembled'):'assembled',phase:staticView||preview?'closed':'intro',elapsed:0,speed:1,selected:null,frozen:false,tool:'rotate',visible:true};
 model.update(0,inputs);model.root.updateMatrixWorld(true);
 const originalBox=new THREE.Box3().setFromObject(model.root),center=originalBox.getCenter(new THREE.Vector3()),extent=originalBox.getSize(new THREE.Vector3()),span=Math.max(extent.x,extent.y,extent.z,.4);
 const records=model.parts.map((part,i)=>{
  const box=new THREE.Box3().setFromObject(part.object),pivot=new THREE.Group(),position=box.getCenter(new THREE.Vector3());pivot.name=`pivot-${part.id}`;model.root.add(pivot);pivot.position.copy(position);pivot.attach(part.object);
  const materials=[];part.object.traverse(o=>{o.userData.partId=part.id;if(o.isMesh){if(part.shell||model.viewStyle)o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const mat of Array.isArray(o.material)?o.material:[o.material])materials.push({mat,object:o,color:mat.color?.clone(),opacity:mat.opacity,transparent:mat.transparent,depthWrite:mat.depthWrite,flat:model.viewStyle?.(o,part,'cut'),focus:model.viewStyle?.(o,part,'xray')});}});
  return {...part,pivot,position,box,materials,fromPos:position.clone(),fromQ:new THREE.Quaternion(),toPos:position.clone().add(new THREE.Vector3(...part.explode)),order:i};
 });
 const order=[...records.filter(r=>!r.shell),...records.filter(r=>r.shell)];order.forEach((r,i)=>r.order=i);
 // Lay out assemblies in the initial camera plane. Depth-only author offsets can
 // leave objects covering each other; a fixed, spaced layout keeps every part readable.
 const facing=new THREE.Vector3(...(definition.viewDirection||[.9,.55,1.7])).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),facing).normalize(),planeUp=new THREE.Vector3().crossVectors(facing,right).normalize();
 const projectedSize=r=>{const v=r.box.getSize(new THREE.Vector3());return [Math.abs(right.x)*v.x+Math.abs(right.y)*v.y+Math.abs(right.z)*v.z,Math.abs(planeUp.x)*v.x+Math.abs(planeUp.y)*v.y+Math.abs(planeUp.z)*v.z];};
 const explodedRecords=records.filter(r=>!r.object.userData.hideWhenExploded);
 const sizes=explodedRecords.map(projectedSize),cellW=Math.max(...sizes.map(s=>s[0]))+span*.16,cellH=Math.max(...sizes.map(s=>s[1]))+span*.16,cols=explodedRecords.length>9?4:3,rows=Math.ceil(explodedRecords.length/cols);
 const primary=explodedRecords.find(r=>/base|frame|stand|机架|底座/.test(r.id+' '+r.name))||explodedRecords[0];
 const slots=Array.from({length:cols*rows},(_,i)=>({x:i%cols-(cols-1)/2,y:(rows-1)/2-Math.floor(i/cols)}));slots.sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y));
 [primary,...explodedRecords.filter(r=>r!==primary)].forEach((r,i)=>{r.toPos.copy(center).addScaledVector(right,slots[i].x*cellW).addScaledVector(planeUp,slots[i].y*cellH);});
 const explodedBox=new THREE.Box3();explodedRecords.forEach(r=>explodedBox.union(r.box.clone().translate(r.toPos.clone().sub(r.position))));
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let flatBlend=0,focusBlend=0;const paleColor=new THREE.Color('#d5dce4');let gesture=null,raf=0,last=performance.now(),disposed=false,fitMode='assembled',updatedT=0,cameraTween=null,hasSize=false,resumePlaying=false,lastViewportWidth=innerWidth,lastViewportHeight=innerHeight;
 function projection(half){if(camera.isOrthographicCamera){camera.top=half;camera.bottom=-half;camera.left=-half*camera.aspect;camera.right=half*camera.aspect;}camera.updateProjectionMatrix();}
 function flatMode(){return !!definition.flatViewDirection&&state.mode==='cut';}
 function fit(exploded=false,animateCamera=false){
  const box=exploded?explodedBox:originalBox,size=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3());
  const angle=THREE.MathUtils.degToRad(camera.fov),distance=Math.max(size.y,size.x/camera.aspect,size.z*.65)/(2*Math.tan(angle/2))*(preview?1.27:1.45)+size.z*.4;
  const direction=new THREE.Vector3(...(flatMode()?definition.flatViewDirection:definition.viewDirection||[.9,.55,1.7])).normalize();
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();
  const width=Math.abs(right.x)*size.x+Math.abs(right.y)*size.y+Math.abs(right.z)*size.z,height=Math.abs(up.x)*size.x+Math.abs(up.y)*size.y+Math.abs(up.z)*size.z;
  const half=Math.max(height,width/camera.aspect)*.62,destination=c.clone().addScaledVector(direction,distance);
  orbit.enableRotate=!flatMode();
  if(animateCamera){cameraTween={from:camera.position.clone(),to:destination,targetFrom:orbit.target.clone(),targetTo:c,time:0,halfFrom:camera.top/camera.zoom,halfTo:half};if(camera.isOrthographicCamera){projection(camera.top/camera.zoom);camera.zoom=1;}}
  else{cameraTween=null;camera.position.copy(destination);orbit.target.copy(c);camera.zoom=1;projection(half);}
  camera.near=Math.max(.005,span/1000);camera.far=Math.max(100,distance*20);camera.updateProjectionMatrix();orbit.update();
 }
 function resize(){const r=container.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;projection(camera.top);renderer.setSize(r.width,r.height,false);const viewportChanged=lastViewportWidth!==innerWidth||lastViewportHeight!==innerHeight;lastViewportWidth=innerWidth;lastViewportHeight=innerHeight;if(!hasSize||viewportChanged){fit(state.mode==='explode');hasSize=true;}}
 const observer=new ResizeObserver(resize);observer.observe(container);resize();
 function separated(){return state.mode==='explode'||['opening','open','closing'].includes(state.phase);}
 function select(id){state.selected=records.some(r=>r.id===id&&!(r.object.userData.hideWhenExploded&&separated()))?id:null;onSelect(state.selected?records.find(r=>r.id===state.selected):null);}
 function mode(next){if(!['assembled','cut','xray','explode'].includes(next))return;select(null);const wasPlaying=state.playing;state.playing=false;const previous=state.mode;state.mode=next;state.elapsed=0;state.phase=next==='explode'?'opening':previous==='explode'||state.phase==='intro'?'closing':'closed';records.forEach(r=>{r.fromPos.copy(r.pivot.position);r.fromQ.copy(r.pivot.quaternion);r.pivot.visible=true;});fitMode=next;if(next==='explode')fit(true,true);else if(previous==='explode')fit(false,true);if(state.phase==='closed'&&previous!=='explode'){state.playing=wasPlaying;fit(false,true);}onChange();}
 function assemble(){mode('assembled');state.phase='closing';}
 function intro(){select(null);state.phase='intro';state.mode='assembled';state.elapsed=0;state.playing=true;state.t=0;inputs._phaseOffset=0;state.guideOffset=definition.timeContinuous?guidedStart(definition.id,inputs):0;if(model.reset){model.reset(0,inputs);model.update(0,inputs);updatedT=0;}records.forEach(r=>r.pivot.quaternion.identity());fit(false);onChange();}
 function setInput(id,value){const c=definition.controls.find(c=>c.id===id);if(!c||state.frozen)return;const oldPhase=definition.phaseRate?definition.phaseRate(inputs)*state.t+(inputs._phaseOffset||0):0;inputs[id]=c.options?(c.options.find(o=>String(o.value)===String(value))?.value??c.value):clamp(Number(value),c.min,c.max);if(definition.phaseRate)inputs._phaseOffset=oldPhase-definition.phaseRate(inputs)*state.t;if(!preview&&hasGuidedOperation(definition.id)){state.playing=false;if(definition.timeContinuous)state.guideOffset=guidedStart(definition.id,inputs)-state.t;else state.t=guidedStart(definition.id,inputs);}model.update(state.t,inputs);updatedT=state.t;onInput(id,inputs[id]);onChange();}
 function pick(e){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(model.root.children,true).find(h=>h.object.isMesh&&!h.object.userData.nonPickable&&h.object.visible&&(()=>{for(let n=h.object;n;n=n.parent)if(!n.visible)return false;return true})()&&(!h.object.material.transparent||h.object.material.opacity>.12));}
 function down(e){if(preview||e.button!==0||state.phase==='intro'||state.phase==='opening'||state.phase==='closing')return;const hit=pick(e),record=records.find(r=>r.id===hit?.object.userData.partId);gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,record,drag:record&&(state.phase==='open'||record.drag)&&!state.frozen};if(gesture.drag){orbit.enabled=false;e.stopImmediatePropagation();renderer.domElement.setPointerCapture(e.pointerId);select(record.id);}}
 function move(e){if(!gesture||gesture.id!==e.pointerId)return;const g=gesture,dx=e.clientX-g.lastX,dy=e.clientY-g.lastY;g.lastX=e.clientX;g.lastY=e.clientY;if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>5)g.moved=true;if(!g.drag)return;e.stopImmediatePropagation();if(state.phase==='open'){if(state.tool==='move'){const v=new THREE.Vector3(dx,-dy,0).applyQuaternion(camera.quaternion).multiplyScalar(span/container.clientHeight*2.5);g.record.pivot.position.add(v);g.record.pivot.position.clampScalar(-span*5,span*5);}else{const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),dx*.009);g.record.pivot.quaternion.premultiply(q);q.setFromAxisAngle(new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),dy*.009);g.record.pivot.quaternion.premultiply(q);}}else if(g.record.drag){const d=g.record.drag;setInput(d.control,Number(inputs[d.control])+(d.axis==='y'?-dy:dx)*(d.scale||1)/container.clientWidth);} }
 function up(e){if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;orbit.enabled=!preview;if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);if(e.type==='pointerup'&&!g.moved)select(g.record?.id||null);}
 renderer.domElement.addEventListener('pointerdown',down,true);renderer.domElement.addEventListener('pointermove',move,true);renderer.domElement.addEventListener('pointerup',up,true);renderer.domElement.addEventListener('pointercancel',up,true);
 function appearance(r,introAmount=1){const split=separated();r.object.visible=r.object.userData.modelVisible!==false&&!(r.shell&&state.mode==='cut'&&state.phase==='closed');r.object.traverse(o=>{if(o.userData.hideWhenExploded)o.visible=o.userData.modelVisible!==false&&!split;else if(o.userData.connection)o.visible=o.userData.modelVisible!==false&&state.phase!=='open'&&state.phase!=='opening';});
  for(const {mat,color,opacity,transparent,depthWrite,flat,focus} of r.materials){
   const blendOpacity=1+((flat?.opacity??1)-1)*flatBlend+((focus?.opacity??1)-1)*focusBlend;
   const a=opacity*(r.shell?introAmount:1)*(r.shell&&state.mode==='xray'?.13:1)*blendOpacity;
   mat.opacity=a;mat.transparent=transparent||a<1;mat.depthWrite=depthWrite&&a>.95;
   if(color)mat.color.copy(color).lerp(paleColor,(flat?.pale||0)*flatBlend+(focus?.pale||0)*focusBlend);
  }
 }
 function animate(dt){if(state.frozen||!state.visible||document.hidden)return;
  const blend=1-Math.exp(-dt*9);flatBlend+=((flatMode()?1:0)-flatBlend)*blend;focusBlend+=((state.mode==='xray'?1:0)-focusBlend)*blend;model.setView?.({planar:flatBlend,mode:state.mode});
  if(cameraTween){cameraTween.time+=dt;const u=smooth(cameraTween.time/1.2);camera.position.lerpVectors(cameraTween.from,cameraTween.to,u);orbit.target.lerpVectors(cameraTween.targetFrom,cameraTween.targetTo,u);if(camera.isOrthographicCamera)projection(THREE.MathUtils.lerp(cameraTween.halfFrom,cameraTween.halfTo,u));orbit.update();if(u===1)cameraTween=null;}
  if(state.phase==='intro'){
   if(state.playing)state.elapsed+=dt*state.speed;const duration=3.8;
   records.forEach(r=>{const u=smooth((state.elapsed/duration*(1+records.length*.08)-r.order*.08)/.85);r.pivot.visible=u>0;r.pivot.position.copy(r.position).addScaledVector(new THREE.Vector3(...r.explode),1-u);r.pivot.quaternion.identity();appearance(r,clamp(u*3));});
   if(state.elapsed>=duration){state.phase='closed';state.mode=definition.defaultMode||'assembled';if(hasGuidedOperation(definition.id)){if(definition.timeContinuous)state.guideOffset=guidedStart(definition.id,inputs)-state.t;else state.t=guidedStart(definition.id,inputs);}state.playing=true;records.forEach(r=>{r.pivot.visible=true;r.pivot.position.copy(r.position);appearance(r);});onChange();}
  }else if(state.phase==='opening'||state.phase==='closing'){
   state.elapsed+=dt;const opening=state.phase==='opening',u=smooth(state.elapsed/(opening?1.05:1.3));
   records.forEach(r=>{r.pivot.position.lerpVectors(r.fromPos,opening?r.toPos:r.position,u);r.pivot.quaternion.copy(r.fromQ).slerp(new THREE.Quaternion(),u);appearance(r);});
   if(u===1){state.phase=opening?'open':'closed';if(!opening){state.playing=true;}onChange();}
  }else{
   if(state.playing&&state.phase==='closed')state.t+=dt*state.speed;
   if(state.t!==updatedT){if(!staticView&&state.playing)Object.assign(inputs,previewInputs(definition.id,state.t+state.guideOffset));model.update(state.t,inputs);updatedT=state.t;}records.forEach(r=>appearance(r));
  }
 }
 function loop(now){if(disposed)return;const dt=Math.min(.06,Math.max(0,(now-last)/1000));last=now;animate(dt);renderer.render(scene,camera);raf=requestAnimationFrame(loop);}
 if(staticView){records.forEach(r=>appearance(r));renderer.render(scene,camera);}raf=requestAnimationFrame(loop);
 orbit.addEventListener('start',()=>cameraTween=null);
 function snapshot(){return {id:definition.id,t:state.t,guideOffset:state.guideOffset,model:model.snapshot?.(),inputs:{...inputs},mode:state.mode,phase:state.phase,elapsed:state.elapsed,selected:state.selected,camera:camera.position.toArray(),cameraZoom:camera.zoom,cameraHalf:camera.top,flatBlend,focusBlend,target:orbit.target.toArray(),parts:records.map(r=>({id:r.id,p:r.pivot.position.toArray(),q:r.pivot.quaternion.toArray(),fromP:r.fromPos.toArray(),fromQ:r.fromQ.toArray()}))};}
 function restore(saved){if(saved?.id!==definition.id)return;state.t=saved.t;state.guideOffset=saved.guideOffset||0;Object.assign(inputs,saved.inputs);if(saved.model)model.restore?.(saved.model,state.t,inputs);state.mode=saved.mode;state.phase=saved.phase;state.elapsed=saved.elapsed;state.playing=false;cameraTween=null;flatBlend=saved.flatBlend??(flatMode()?1:0);focusBlend=saved.focusBlend??(state.mode==='xray'?1:0);model.setView?.({planar:flatBlend,mode:state.mode});orbit.enableRotate=!flatMode();camera.zoom=saved.cameraZoom||1;projection(saved.cameraHalf||camera.top);model.update(state.t,inputs);for(const r of records){const p=saved.parts.find(p=>p.id===r.id);if(p){r.pivot.position.fromArray(p.p);r.pivot.quaternion.fromArray(p.q);r.fromPos.fromArray(p.fromP||p.p);r.fromQ.fromArray(p.fromQ||p.q);}appearance(r);}camera.position.fromArray(saved.camera);orbit.target.fromArray(saved.target);orbit.update();select(saved.selected);onChange();}
 function view(action){if(action==='reset')fit(state.mode==='explode');if(action==='zoom-in'||action==='zoom-out'){if(camera.isOrthographicCamera){camera.zoom*=action==='zoom-in'?1/.85:1/1.18;camera.updateProjectionMatrix();}else camera.position.sub(orbit.target).multiplyScalar(action==='zoom-in'?.85:1.18).add(orbit.target);orbit.update();}}
 return {state,model,records,camera,renderer,scene,orbit,select,mode,assemble,intro,setInput,resize,fit,view,snapshot,restore,hitTest:pick,
  resetPart(){const r=records.find(r=>r.id===state.selected);if(r){r.pivot.position.copy(r.toPos);r.pivot.quaternion.identity();}},
  freeze(value){if(value===state.frozen)return;if(value){resumePlaying=state.playing;state.playing=false;gesture=null;orbit.enabled=!preview;}else state.playing=resumePlaying;state.frozen=value;},
  dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();orbit.dispose();target.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}});renderer.dispose();renderer.domElement.remove();}
 };
}
