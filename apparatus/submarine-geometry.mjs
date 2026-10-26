import {THREE,material,box,cylinder,sphere,pipe,torus} from './kit.mjs';
import {SUB_LAYOUT as S,tankWaterLevel} from './submarine-layout.mjs';

export function buildSubmarineVessel({hull,ballast,air,vents,sail,prop}){
 const trim=material('#426e91',.45,.34),metal=material('#a0b5c2',.65,.25),gold=material('#c89b40',.5,.28);
 const glass=new THREE.MeshPhysicalMaterial({color:'#b4dcf1',transparent:true,opacity:.23,metalness:.02,roughness:.18,depthWrite:false,side:THREE.FrontSide});
 const tankGlass=glass.clone();tankGlass.opacity=.10;
 const profile=[];
 for(let i=0;i<=20;i++){const a=i*Math.PI/40;profile.push(new THREE.Vector2(S.radiusY*Math.sin(a),-S.straight/2-S.capLength*Math.cos(a)));}
 for(let i=0;i<=20;i++){const a=i*Math.PI/40;profile.push(new THREE.Vector2(S.radiusY*Math.cos(a),S.straight/2+S.capLength*Math.sin(a)));}
 const hullGeo=new THREE.LatheGeometry(profile,64);hullGeo.rotateZ(-Math.PI/2);hullGeo.scale(1,1,S.radiusZ/S.radiusY);
 const shell=new THREE.Mesh(hullGeo,glass);shell.name='sub-transparent-shell';hull.add(shell);
 // Thin longitudinal seams and end rings retain the silhouette through the glass.
 for(const x of [-S.straight/2,S.straight/2]){
  const g=new THREE.TorusGeometry(S.radiusY,.0025,8,64);g.rotateY(Math.PI/2);g.scale(1,1,S.radiusZ/S.radiusY);
  const ring=new THREE.Mesh(g,trim);ring.position.x=x;hull.add(ring);
 }
 for(const angle of [Math.PI/4,Math.PI*3/4,Math.PI*5/4,Math.PI*7/4]){
  pipe(hull,[[-S.straight/2,S.radiusY*Math.sin(angle),S.radiusZ*Math.cos(angle)],[S.straight/2,S.radiusY*Math.sin(angle),S.radiusZ*Math.cos(angle)]],.0016,trim);
 }
 // Curved meridians make the rounded bow and stern legible on a white background.
 for(const end of [-1,1])for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const points=[];for(let i=0;i<=16;i++){const a=i*Math.PI/32;points.push([end*(S.straight/2+S.capLength*Math.sin(a)),S.radiusY*Math.cos(a)*Math.sin(angle),S.radiusZ*Math.cos(a)*Math.cos(angle)]);}
  pipe(hull,points,.0015,trim);
 }
 const tanks=[];
 const ellipticCylinder=(length,ry,rz)=>{const g=new THREE.CylinderGeometry(ry,ry,length,48);g.rotateZ(Math.PI/2);g.scale(1,1,rz/ry);return g;};
 for(const x of S.tankX){
  const casing=new THREE.Mesh(ellipticCylinder(S.tankLength,S.tankRadiusY+.002,S.tankRadiusZ+.002),tankGlass);casing.position.x=x;ballast.add(casing);
  for(const dx of [-S.tankLength/2,S.tankLength/2]){
   const g=new THREE.TorusGeometry(S.tankRadiusY,.0022,8,48);g.rotateY(Math.PI/2);g.scale(1,1,S.tankRadiusZ/S.tankRadiusY);
   const rim=new THREE.Mesh(g,trim);rim.position.x=x+dx;ballast.add(rim);
  }
  const waterMat=new THREE.MeshBasicMaterial({color:'#289bc7',transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide});
  const plane=new THREE.Plane(new THREE.Vector3(0,-1,0),0);waterMat.clippingPlanes=[plane];
  const water=new THREE.Mesh(ellipticCylinder(S.tankLength,S.tankRadiusY,S.tankRadiusZ),waterMat);water.name='sub-tank-water';water.position.x=x;water.userData.connection=true;water.userData.intrinsicClip=true;ballast.add(water);
  const top=new THREE.Mesh(new THREE.PlaneGeometry(S.tankLength,1),new THREE.MeshBasicMaterial({color:'#78d7ee',transparent:true,opacity:.88,side:THREE.DoubleSide,depthWrite:false}));
  top.rotation.x=-Math.PI/2;top.position.x=x;top.userData.connection=true;ballast.add(top);tanks.push({water,top,plane});
  cylinder(vents,.014,.025,[x,-.091,0],metal);
 }
 cylinder(air,.022,.20,[0,.015,0],gold,'x');
 for(const x of [-.10,.10])sphere(air,.022,[x,.015,0],gold);
 box(air,[.22,.012,.065],[0,-.02,0],trim);
 cylinder(air,.008,.035,[0,.052,0],metal);
 const routes=[];
 for(const x of S.tankX){
  const points=[[0,.055,0],[0,.086,0],[x,.086,0],[x,.066,0]];
  pipe(air,points,.004,gold).userData.hideWhenExploded=true;
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const waterCurve=new THREE.CatmullRomCurve3([[x,-.12,.13],[x,-.12,0],[x,-.068,0]].map(p=>new THREE.Vector3(...p)));
  for(const [kind,path,color] of [['air',curve,'#dda522'],['water',waterCurve,'#168bce']]){
   const dots=[];for(let i=0;i<3;i++){const dot=new THREE.Mesh(new THREE.ConeGeometry(.008,.024,12),new THREE.MeshBasicMaterial({color,toneMapped:false}));dot.userData.hideWhenExploded=true;dot.userData.nonPickable=true;vents.add(dot);dots.push(dot);}
   routes.push({kind,path,dots});
  }
 }
 box(sail,[.18,.10,.075],[-.12,.13,0],trim);
 pipe(sail,[[-.10,.17,0],[-.10,.24,0],[-.02,.24,0]],.009,metal);
 cylinder(sail,.011,.035,[-.015,.24,0],trim,'x');
 cylinder(prop,.009,.12,[.78,0,0],metal,'x');
 const blades=new THREE.Group();blades.position.x=.84;prop.add(blades);
 cylinder(blades,.018,.025,[0,0,0],gold,'x');
 for(let i=0;i<3;i++){const blade=box(blades,[.008,.055,.020],[0,0,0],gold);const a=i*Math.PI*2/3;blade.position.set(0,.033*Math.cos(a),.033*Math.sin(a));blade.rotation.x=a;}
 const up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
 return {shell,tanks,update(t,s,rate){
  const fraction=s.ballastKg/32.8,level=tankWaterLevel(fraction);
  for(const {water,top,plane} of tanks){
   plane.constant=s.centerY+level;water.visible=water.userData.modelVisible=fraction>1e-5;
   top.visible=top.userData.modelVisible=fraction>1e-5;top.position.y=level;top.scale.y=2*S.tankRadiusZ*Math.sqrt(Math.max(0,1-(level/S.tankRadiusY)**2));
  }
  for(const {kind,path,dots} of routes)dots.forEach((dot,i)=>{
   const enabled=kind==='water'?Math.abs(rate)>.02:rate<-.02;
   const u=(t*.9+i/3)%1,v=kind==='water'&&rate<0?1-u:u;
   path.getPoint(v,dot.position);path.getTangent(v,direction);if(kind==='water'&&rate<0)direction.negate();dot.quaternion.setFromUnitVectors(up,direction.normalize());
   dot.visible=dot.userData.modelVisible=enabled&&s.centerY+dot.position.y>.125;
  });
 }};
}
