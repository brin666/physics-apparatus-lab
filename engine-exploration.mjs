import {THREE,clamp,ease} from './vendor/machine-kit/lab-kit.js';

// Offsets are in model metres. These are teaching assemblies, not a service order.
const layout={
  case:[.215,-.045,-.035],cylinder:[.205,.015,-.025],head:[-.085,.145,-.035],
  intake:[-.235,.045,.015],exhaust:[.205,.11,.015],spark:[.065,.155,.035],
  piston:[-.135,.035,.07],rod:[-.085,-.005,.09],crank:[.035,-.015,.075],
  flywheel:[-.225,.005,-.01],
};
const tilt={case:[.08,-.25,.1],cylinder:[.12,-.22,-.12],head:[.12,.18,-.1],
  intake:[0,0,-.3],exhaust:[0,0,.3],spark:[0,0,-.18],piston:[.12,-.2,.14],
  rod:[0,-.15,-.2],crank:[.12,.25,0],flywheel:[.12,-.22,0]};
const returnOrder=['crank','flywheel','rod','piston','case','cylinder','head','intake','exhaust','spark'];

export function createEngineExploration({lab,parts,state,pickables,bearing,onSelect,onPhase,clearOrbit,focusEnabled=false,
  offsets=layout,tilts=tilt,assemblyOrder=returnOrder,moveLimit=.5,focusLift=.014,attachments={},leadIn=0}){
  const identity=new THREE.Quaternion(),records=new Map(),raycaster=new THREE.Raycaster();
  const canvas=lab.renderer.domElement;
  let blankGesture=null;
  let phase='closed',elapsed=0,amount=0,fromAmount=0,targetAmount=0,gesture=null,tool='rotate';
  const tmpQ=new THREE.Quaternion(),tmpV=new THREE.Vector3();
  const followers=Object.entries(attachments).map(([id,owner])=>({id,owner,object:parts[id],rest:parts[id].quaternion.clone()}));
  for(const [id,offset] of Object.entries(offsets)){
    const object=parts[id],box=new THREE.Box3();
    object.updateWorldMatrix(true,true);
    const inverse=object.matrixWorld.clone().invert();
    object.traverse(mesh=>{
      if(!mesh.isMesh||mesh.userData.ghost||!(mesh.layers.mask&1))return;
      mesh.geometry.computeBoundingBox();
      box.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
    });
    records.set(id,{id,object,center:box.getCenter(new THREE.Vector3()),
      rest:object.quaternion.clone(),base:object.quaternion.clone(),offset:new THREE.Vector3(),rotation:new THREE.Quaternion(),
      destination:new THREE.Vector3(...offset),tilt:new THREE.Quaternion().setFromEuler(new THREE.Euler(...(tilts[id]||[0,0,0]))),
      fromOffset:new THREE.Vector3(),fromRotation:new THREE.Quaternion(),velocity:new THREE.Vector2(),resetTween:null,focus:0});
  }
  function emit(){onPhase?.(phase);}
  function cancelGesture(){
    blankGesture=null;
    if(!gesture)return;
    const id=gesture.pointerId;gesture=null;
    if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    lab.controlsOrbit.enabled=true;clearOrbit();canvas.style.cursor='';
  }
  function request(open){
    if(open&&(phase==='open'||phase==='opening')||!open&&(phase==='closed'||phase==='closing'))return;
    cancelGesture();
    for(const r of records.values()){r.fromOffset.copy(r.offset);r.fromRotation.copy(r.rotation);r.velocity.set(0,0);r.resetTween=null;}
    elapsed=0;fromAmount=amount;targetAmount=open?1:0;phase=open?'opening':'closing';emit();
  }
  function reset(){
    cancelGesture();phase='closed';elapsed=amount=fromAmount=targetAmount=0;
    for(const r of records.values()){r.offset.set(0,0,0);r.rotation.identity();r.velocity.set(0,0);r.resetTween=null;r.focus=0;r.object.quaternion.copy(r.rest);}
    emit();
  }
  // Lab rebuilds positions and engineAt rebuilds moving joints every frame.
  // Remove our extra rotations before either runs, then apply them once afterward.
  function before(){for(const r of records.values())r.object.quaternion.copy(r.rest);for(const r of followers)r.object.quaternion.copy(r.rest);if(bearing)bearing.rotation.set(Math.PI/2,0,0);}
  function step(dt){
    if(state.interaction==='whiteboard'||state.visible===false||document.hidden){cancelGesture();return;}
    for(const r of records.values()){
      const target=focusEnabled&&phase==='open'&&state.selected===r.id?1:0;
      r.focus+=(target-r.focus)*(state.reduced?1:1-Math.exp(-dt*12));
    }
    if(state.reduced)for(const r of records.values())r.velocity.set(0,0);
    if(phase==='opening'||phase==='closing'){
      elapsed+=dt;const opening=phase==='opening',duration=opening?1.05+leadIn:1.35;
      const t=state.reduced?1:clamp(elapsed/duration);
      amount=THREE.MathUtils.lerp(fromAmount,targetAmount,ease.io(t));
      let i=0;
      for(const r of records.values()){
        const delay=opening?leadIn+i++*.018:Math.max(0,assemblyOrder.indexOf(r.id))*.028;
        const p=state.reduced?1:clamp((elapsed-delay)/(duration-(opening?leadIn:0)-Math.max(.26,(records.size-1)*.028)));
        const move=opening?ease.out(p):ease.io(clamp((p-.13)/.87));
        const turn=opening?ease.out(p):ease.io(clamp(p/.66));
        r.offset.copy(r.fromOffset).lerp(opening?r.destination:tmpV.set(0,0,0),move);
        r.rotation.copy(r.fromRotation).slerp(opening?r.tilt:identity,turn);
      }
      if(t===1){phase=opening?'open':'closed';amount=targetAmount;if(!opening)for(const r of records.values())r.focus=0;emit();}
    }else if(phase==='open'&&!gesture){
      for(const r of records.values()){
        if(r.resetTween){
          const t=r.resetTween;t.time+=dt;const p=state.reduced?1:clamp(t.time/.35),k=ease.io(p);
          r.offset.copy(t.offset).lerp(r.destination,k);r.rotation.copy(t.rotation).slerp(r.tilt,k);
          if(p===1)r.resetTween=null;continue;
        }
        if(r.velocity.lengthSq()<.00001){r.velocity.set(0,0);continue;}
        const decay=Math.exp(-14*dt),integral=(1-decay)/14;
        turn(r,r.velocity.x*integral,r.velocity.y*integral);
        r.velocity.multiplyScalar(decay);
      }
    }
  }
  function apply(){
    if(phase==='closed')return;
    for(const r of records.values()){
      const g=r.object;r.base.copy(g.quaternion);
      const basePosition=g.position.clone(),baseCenter=r.center.clone().applyQuaternion(r.base).add(basePosition);
      g.quaternion.copy(r.rotation).multiply(r.base);
      g.position.copy(baseCenter).add(r.offset).sub(tmpV.copy(r.center).applyQuaternion(g.quaternion));
      const lift=lab.camera.position.clone().sub(lab.controlsOrbit.target).normalize()
        .applyQuaternion(g.parent.getWorldQuaternion(new THREE.Quaternion()).invert()).multiplyScalar(focusLift*r.focus);
      g.position.add(lift);
      for(const follower of followers){
        if(follower.owner!==r.id)continue;
        follower.object.position.sub(baseCenter).applyQuaternion(r.rotation).add(baseCenter).add(r.offset).add(lift);
        follower.object.quaternion.premultiply(r.rotation);
      }
      // The separate front bearing belongs to the crankcase's rigid assembly.
      if(r.id==='case'&&bearing){
        bearing.position.sub(baseCenter).applyQuaternion(r.rotation).add(baseCenter).add(r.offset);
        bearing.position.add(lift);
        bearing.quaternion.setFromEuler(new THREE.Euler(Math.PI/2,0,0)).premultiply(r.rotation);
      }
    }
  }
  function hit(event){
    const rect=canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),lab.camera);
    lab.machine.updateWorldMatrix(true,true);
    return raycaster.intersectObjects(pickables,false).find(h=>{
      if(!records.has(attachments[h.object.userData.partId]||h.object.userData.partId))return false;
      for(let p=h.object;p;p=p.parent)if(!p.visible)return false;
      return true;
    });
  }
  function turn(r,dx,dy){
    const parentQ=r.object.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    const cameraQ=lab.camera.getWorldQuaternion(new THREE.Quaternion());
    const up=new THREE.Vector3(0,1,0).applyQuaternion(cameraQ).applyQuaternion(parentQ);
    const right=new THREE.Vector3(1,0,0).applyQuaternion(cameraQ).applyQuaternion(parentQ);
    tmpQ.setFromAxisAngle(up,dx);r.rotation.premultiply(tmpQ);
    tmpQ.setFromAxisAngle(right,dy);r.rotation.premultiply(tmpQ).normalize();
  }
  function movable(){return phase==='open'&&state.interaction!=='whiteboard'&&state.visible!==false;}
  canvas.addEventListener('pointerdown',event=>{
    if(blankGesture){blankGesture=null;return;}
    if(!movable()||event.button!==0||gesture)return;
    const h=hit(event);if(!h){blankGesture={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};return;}
    event.preventDefault();event.stopImmediatePropagation();clearOrbit();lab.controlsOrbit.enabled=false;
    const r=records.get(attachments[h.object.userData.partId]||h.object.userData.partId);r.velocity.set(0,0);r.resetTween=null;
    gesture={record:r,pointerId:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now(),moved:false};
    canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';
    onSelect(r.id);
  },true);
  canvas.addEventListener('pointermove',event=>{
    if(blankGesture&&event.pointerId===blankGesture.id&&Math.hypot(event.clientX-blankGesture.x,event.clientY-blankGesture.y)>7)blankGesture.moved=true;
    if(!gesture){if(movable())canvas.style.cursor=hit(event)?'grab':'';return;}
    if(event.pointerId!==gesture.pointerId)return;
    if(!movable()){cancelGesture();return;}
    event.preventDefault();event.stopImmediatePropagation();
    const {record:r}=gesture,dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    const now=performance.now(),dt=Math.max(.008,(now-gesture.time)/1000);
    if(tool==='rotate'){
      turn(r,dx*.009,dy*.009);
      r.velocity.set(THREE.MathUtils.clamp(dx*.009/dt,-4,4),THREE.MathUtils.clamp(dy*.009/dt,-4,4));
    }else{
      const distance=lab.camera.position.distanceTo(r.object.getWorldPosition(new THREE.Vector3()));
      const scale=2*distance*Math.tan(THREE.MathUtils.degToRad(lab.camera.fov/2))/canvas.clientHeight/lab.camera.zoom;
      const movement=new THREE.Vector3(dx*scale,-dy*scale,0).applyQuaternion(lab.camera.quaternion);
      const inverse=r.object.parent.matrixWorld.clone().invert();
      const origin=new THREE.Vector3().applyMatrix4(inverse);
      movement.applyMatrix4(inverse).sub(origin);r.offset.add(movement);
      // Keep moved parts within reach of the workbench and its reset control.
      r.offset.clampLength(0,moveLimit);
    }
    Object.assign(gesture,{x:event.clientX,y:event.clientY,time:now,moved:true});
  },true);
  function release(event){
    if(blankGesture&&event.pointerId===blankGesture.id){
      const blank=blankGesture;blankGesture=null;
      if(event.type==='pointerup'&&!blank.moved&&movable()&&!hit(event))onSelect(null);
      return;
    }
    if(!gesture||event.pointerId!==gesture.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(event.type!=='pointerup'||performance.now()-gesture.time>80||state.reduced)gesture.record.velocity.set(0,0);
    cancelGesture();
  }
  canvas.addEventListener('pointerup',release,true);
  canvas.addEventListener('pointercancel',release,true);
  canvas.addEventListener('lostpointercapture',()=>cancelGesture());
  addEventListener('blur',()=>{cancelGesture();for(const r of records.values())r.velocity.set(0,0);});
  return {request,reset,before,step,apply,cancelGesture,
    setTool(value){tool=value==='move'?'move':'rotate';cancelGesture();},
    resetPart(id){const r=records.get(id);if(!r||phase!=='open')return;r.velocity.set(0,0);r.resetTween={time:0,offset:r.offset.clone(),rotation:r.rotation.clone()};},
    get active(){return phase!=='closed';},get phase(){return phase;},get amount(){return amount;},
    snapshot(){return Object.fromEntries([...records].map(([id,r])=>[id,{offset:r.offset.toArray(),rotation:r.rotation.toArray()}]));},
    focusSnapshot(){return Object.fromEntries([...records].map(([id,r])=>[id,r.focus]));},
    restoreFocus(saved){for(const [id,r] of records)r.focus=Number.isFinite(saved?.[id])?clamp(saved[id]):0;},
    restore(saved,presentation){
      if(!saved)return;cancelGesture();
      for(const [id,value] of Object.entries(saved)){const r=records.get(id);if(r&&value.offset?.length===3&&value.rotation?.length===4&&[...value.offset,...value.rotation].every(Number.isFinite)){r.offset.fromArray(value.offset);r.rotation.fromArray(value.rotation).normalize();r.velocity.set(0,0);r.resetTween=null;}}
      if(Number.isFinite(presentation?.amount)){
        amount=clamp(presentation.amount);phase=amount>0?'open':'closed';
        // Restore the exact board pose. Continue an interrupted transition only
        // after leaving the board; snapshot restore itself must never animate.
        const open=state.mode==='explode';
        if((open&&amount<1)||(!open&&amount>0)){phase=open?'closed':'open';request(open);}
        else emit();
      }
    },
  };
}
