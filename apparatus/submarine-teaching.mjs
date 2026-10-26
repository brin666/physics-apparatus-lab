import {THREE,box,cylinder,pipe,material,label} from './kit.mjs';
import {SUB_LAYOUT as S,tankWaterLevel} from './submarine-layout.mjs';

// Longitudinal schematic shares envelope, tank centres and water level with 3D.
export function createSubmarineTeaching(parent){
 const root=new THREE.Group();root.name='submarine-side-lesson';parent.add(root);const pickable=[];
 const part=(object,id)=>{pickable.push([object,id]);return object;};
 const flat=color=>new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,toneMapped:false});
 const ink=flat('#294f72'),edge=flat('#547a99'),paper=flat('#f5f9fc'),blue=flat('#258cc1'),gold=flat('#d39d35');
 const panel=(w,h,x,y,z,mat)=>box(root,[w,h,.002],[x,y,z],mat);
 const background=panel(2.10,1,-.04,.64,-.3,flat('#edf7fc'));background.name='sub-lesson-backdrop';
 const surface=panel(2.10,.006,-.04,1.14,-.28,blue);surface.name='sub-waterline';
 const bottom=panel(2.10,.014,-.04,.12,-.26,edge);
 const waterLabel=typeof document==='undefined'?null:label(root,'水面',[-.89,1.19,-.24],.065,'#3284af');
 if(typeof document!=='undefined'){
  label(root,'进水增重',[-.32,1.40,0],.085,'#294f72');label(root,'排水减重',[.32,1.40,0],.085,'#294f72');
  label(root,'蓝色：进排水',[-.45,.055,0],.055,'#258cc1');label(root,'金色：压缩空气',[.35,.055,0],.055,'#aa7926');
 }
 for(let i=0;i<6;i++)panel(i%2?.025:.045,.003,-1.06,.20+i*.16,-.24,edge);
 const vessel=new THREE.Group();vessel.name='sub-teaching-vessel';root.add(vessel);
 const plate=(shape,z,mat,target=vessel)=>{const m=new THREE.Mesh(new THREE.ShapeGeometry(shape,40),mat);m.position.z=z;target.add(m);return m;};
 const capsule=(length,height)=>{const s=new THREE.Shape(),r=height/2,x=length/2-r;s.moveTo(-x,-r);s.lineTo(x,-r);s.absarc(x,0,r,-Math.PI/2,Math.PI/2,false);s.lineTo(-x,r);s.absarc(-x,0,r,Math.PI/2,Math.PI*1.5,false);return s;};
 part(plate(capsule(S.length,2*S.radiusY),.01,ink),'pressure-hull');part(plate(capsule(S.length-.03,2*S.radiusY-.022),.014,paper),'pressure-hull');
 // Rounded bow, control tower and tail provide an immediate submarine silhouette.
 part(box(vessel,[.18,.10,.035],[-.12,.13,.005],edge),'sail');
 pipe(vessel,[[-.10,.17,0],[-.10,.24,0],[-.02,.24,0]],.009,material('#547a99',.2,.5));
 box(vessel,[.12,.018,.02],[.78,0,0],edge);
 const prop=new THREE.Group();prop.position.set(.84,0,.01);vessel.add(prop);
 box(prop,[.016,.11,.02],[0,0,0],gold);cylinder(prop,.014,.025,[0,0,.01],ink,'z');
 for(const x of S.tankX){
  part(box(vessel,[S.tankLength,2*S.tankRadiusY+.005,.002],[x,0,.020],edge),'ballast-tanks');
  part(box(vessel,[S.tankLength-.012,2*S.tankRadiusY,.002],[x,0,.023],flat('#fffdf6')),'ballast-tanks');
 }
 const fills=S.tankX.map(x=>{const m=part(box(vessel,[.342,1,.002],[x,0,.027],blue),'ballast-tanks');m.name='sub-section-fill';return m;});
 const fillsTop=S.tankX.map(x=>box(vessel,[.342,.003,.002],[x,0,.029],flat('#74d0ec')));
 box(vessel,[.25,.095,.002],[0,-.005,.024],flat('#e6eff5'));
 part(box(vessel,[.20,.044,.02],[0,.015,.034],gold),'air-bank');
 if(typeof document!=='undefined'){
  label(vessel,'空气瓶',[0,-.040,.060],.060,'#74561c');
  label(vessel,'压载舱',[-.40,.038,.065],.070,'#174e70');label(vessel,'压载舱',[.40,.038,.065],.070,'#174e70');
  label(vessel,'密封舱',[0,-.145,.065],.060,'#547087');
 }
 const routes=[];
 for(const x of S.tankX){
  const airPath=new THREE.CatmullRomCurve3([[0,.035,.044],[0,.086,.044],[x,.086,.044],[x,.066,.044]].map(p=>new THREE.Vector3(...p)));
  const airTube=new THREE.Mesh(new THREE.TubeGeometry(airPath,32,.0035,6,false),gold);vessel.add(airTube);
  const waterPath=new THREE.LineCurve3(new THREE.Vector3(x,-.19,.05),new THREE.Vector3(x,-.068,.05));
  part(box(vessel,[.045,.022,.004],[x,-.098,.045],edge),'vents-and-floods');
  for(const [kind,path,mat] of [['water',waterPath,blue],['air',airPath,gold]]){
   const dots=[];
   for(let i=0;i<3;i++){const dot=new THREE.Mesh(new THREE.ConeGeometry(.009,.026,12),mat);vessel.add(dot);dots.push(dot);}
   routes.push({kind,path,dots});
  }
 }
 const forces=new THREE.Group();forces.name='sub-force-comparison';root.add(forces);
 const makeArrow=(x,dir,color,name)=>{
  const g=new THREE.Group();g.position.set(x,.64,.08);forces.add(g);
  const shaft=box(g,[.015,1,.008],[0,0,0],flat(color));
  const tip=new THREE.Mesh(new THREE.ConeGeometry(.030,.05,12),flat(color));g.add(tip);tip.rotation.z=dir>0?0:Math.PI;
  if(typeof document!=='undefined')label(root,name,[x,dir>0?.98:.30,.10],.070,color);
  return length=>{shaft.scale.y=length;shaft.position.y=dir*length/2;tip.position.y=dir*(length+.020);};
 };
 const buoyancy=makeArrow(.95,1,'#227eac','浮力'),weight=makeArrow(.95,-1,'#cf7754','重力');
 root.traverse(o=>o.userData.nonPickable=true);
 for(const [o,id] of pickable){o.userData.nonPickable=false;o.userData.lessonPart=id;}
 const labels=[];root.traverse(o=>{if(o.isSprite)labels.push({o,scale:o.scale.clone()});});
 let lastMode='assembled';
 const setView=({mode})=>{lastMode=mode;root.visible=mode==='cut';const size=typeof innerWidth==='number'&&innerWidth<600?2:1;for(const {o,scale} of labels)o.scale.copy(scale).multiplyScalar(size);};
 const up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
 function update(t,s,waterRate){
  vessel.position.y=s.centerY;
  const waterHeight=s.surfaceY-.12;background.scale.y=waterHeight;background.position.y=.12+waterHeight/2;surface.position.y=s.surfaceY;
  if(waterLabel)waterLabel.position.y=s.surfaceY+.045;
  const fraction=s.ballastKg/32.8,level=tankWaterLevel(fraction);
  fills.forEach((m,i)=>{m.scale.y=Math.max(.00001,level+S.tankRadiusY);m.position.y=(-S.tankRadiusY+level)/2;m.visible=fraction>1e-5;fillsTop[i].position.y=level;});
  buoyancy(s.buoyancyN/1050*.25);weight(s.weightN/1050*.25);
  for(const {kind,path,dots} of routes){
   const active=kind==='water'?Math.abs(waterRate)>.02:waterRate<-.02;
   dots.forEach((dot,i)=>{dot.visible=active;const u=(t*.9+i/3)%1,v=kind==='water'&&waterRate<0?1-u:u;path.getPoint(v,dot.position);path.getTangent(v,direction);if(kind==='water'&&waterRate<0)direction.negate();dot.quaternion.setFromUnitVectors(up,direction.normalize());});
  }
  root.visible=lastMode==='cut';
 }
 return {root,update,setView};
}
