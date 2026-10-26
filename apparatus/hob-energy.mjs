import {THREE,label} from './kit.mjs';

// Qualitative, slowed teaching effects. Eddy loops live in a labelled top view;
// vertical arrows show energy transfer, never a vertical electric-current loop.
export function createHobEnergy({parent,annotations,face,line}){
 const effects=[];
 const stroke=(color,{flow=false}={})=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
  uniforms:{color:{value:new THREE.Color(color)},travel:{value:0},strength:{value:0},direction:{value:1}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform vec3 color;uniform float travel,strength,direction;varying vec2 vUv;
   void main(){float d=fract((travel-vUv.x)*direction+1.);float trail=1.-smoothstep(0.,.27,d);
    ${flow?'float a=strength*(.18+.82*trail);':'float a=strength;'}
    gl_FragColor=vec4(mix(color,vec3(1.,.88,.44),trail*.65),a);
    #include <colorspace_fragment>
   }`});
 const inset=new THREE.Group();inset.name='hob-eddy-top-view';parent.add(inset);annotations.push(inset);
 const cx=.64,cy=.49;
 const frame=new THREE.Shape();frame.moveTo(cx-.13,cy-.125);frame.lineTo(cx+.13,cy-.125);frame.quadraticCurveTo(cx+.145,cy-.125,cx+.145,cy-.11);frame.lineTo(cx+.145,cy+.145);frame.quadraticCurveTo(cx+.145,cy+.16,cx+.13,cy+.16);frame.lineTo(cx-.13,cy+.16);frame.quadraticCurveTo(cx-.145,cy+.16,cx-.145,cy+.145);frame.lineTo(cx-.145,cy-.11);frame.quadraticCurveTo(cx-.145,cy-.125,cx-.13,cy-.125);
 face(inset,new THREE.ShapeGeometry(frame,12),new THREE.MeshBasicMaterial({color:'#fffdf7',toneMapped:false}),0,0,.013);
 line(inset,frame.getPoints(12).map(p=>[p.x,p.y,.014]),new THREE.LineBasicMaterial({color:'#ddd5bd'}));
 label(inset,'锅底俯视',[cx,cy+.13,.024],.034,'#6d6142');
 const guide=new THREE.LineBasicMaterial({color:'#cdbd8f',transparent:true,opacity:.65});
 const rings=[],up=new THREE.Vector3(0,1,0);
 for(const radius of [.056,.092]){
  const path=new THREE.EllipseCurve(cx,cy,radius,radius,0,Math.PI*2,false,0);
  const points=path.getPoints(128).map(p=>new THREE.Vector3(p.x,p.y,.022));
  line(inset,points.map(p=>p.toArray()),guide);
  const curve=new THREE.CatmullRomCurve3(points.slice(0,-1),true,'centripetal'),mat=stroke('#c58a17',{flow:true});
  const loop=face(inset,new THREE.TubeGeometry(curve,128,.0024,8,true),mat,0,0,0);loop.name='hob-eddy-flow';loop.userData.nonPickable=true;
  const arrow=face(inset,new THREE.ConeGeometry(.0055,.016,12),stroke('#bd7b0c'),0,0,0);arrow.name='hob-eddy-direction';arrow.userData.nonPickable=true;
  rings.push({curve,mat,arrow});
 }
 label(inset,'感应涡流',[cx,cy-.105,.024],.027,'#a4761c');
 line(inset,[[.28,.246,.014],[.46,.35,.014],[cx-.10,cy-.125,.014]],new THREE.LineBasicMaterial({color:'#c9b98b',transparent:true,opacity:.7}));
 const flux=new THREE.Group();flux.name='hob-heat-transfer';parent.add(flux);
 // Three slow packets carry the visual cue from the inner floor into the pot.
 for(const [i,x] of [-.16,0,.16].entries()){
  const path=new THREE.CatmullRomCurve3([[x,.268,.010],[x-.009,.30,.010],[x+.009,.34,.010],[x,.379,.010]].map(p=>new THREE.Vector3(...p)));
  const mat=stroke('#df752e',{flow:true}),arrowMat=stroke('#d56b26');
  const body=face(flux,new THREE.TubeGeometry(path,64,.0026,8,false),mat,0,0,0);body.name='hob-heat-trail';body.userData.nonPickable=true;
  const arrow=face(flux,new THREE.ConeGeometry(.0065,.018,12),arrowMat,0,0,0);arrow.name='hob-heat-direction';arrow.userData.nonPickable=true;
  effects.push({path,mat,arrow,offset:i/3});
 }
 const caption=label(flux,'热量传向锅内',[0,.394,.018],.032,'#ba6a34');annotations.push(caption);
 return {update(t,power,active){
  const strength=active?Math.sqrt(Math.max(0,power)):0;
  // B ~ sin(wt), so the induced-current sign follows -dB/dt ~ -cos(wt).
  const phase=2*Math.PI*.35*t,current=-Math.cos(phase),travel=.5-.25*Math.sin(phase);
  rings.forEach(({curve,mat,arrow},i)=>{
   const u=(travel+i*.5)%1;mat.uniforms.travel.value=u;mat.uniforms.direction.value=current>=0?1:-1;mat.uniforms.strength.value=strength*Math.pow(Math.abs(current),.55);
   arrow.material.uniforms.strength.value=mat.uniforms.strength.value;
   arrow.position.copy(curve.getPointAt(u));arrow.quaternion.setFromUnitVectors(up,curve.getTangentAt(u).multiplyScalar(current>=0?1:-1));
  });
  for(const {path,mat,arrow,offset} of effects){
   const u=(t*.3+offset)%1,fade=Math.sin(Math.PI*u);
   mat.uniforms.travel.value=u;mat.uniforms.strength.value=strength*.65*fade;
   arrow.material.uniforms.strength.value=strength*fade;
   arrow.position.copy(path.getPointAt(u));arrow.quaternion.setFromUnitVectors(up,path.getTangentAt(u));
  }
 }};
}
