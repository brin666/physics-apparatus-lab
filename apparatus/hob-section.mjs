import {THREE,material,label} from './kit.mjs';
import {sectionFinish,sectionUV} from './section-finish.mjs';
import {createHobEnergy} from './hob-energy.mjs';

// XY is the vertical centre section (Z = 0). Section-only faces sit just
// ahead of that plane; the full 3D assemblies remain available in other modes.
export function createHobSection(parts,spiral){
 const groups=[],originals=[],annotations=[];
 const part=id=>parts.find(p=>p.id===id).object;
 function group(id){
  const owner=part(id),g=new THREE.Group();
  originals.push(...owner.children);g.name=`${id}-section-faces`;g.visible=false;
  owner.add(g);groups.push(g);return g;
 }
 function face(parent,geometry,mat,x=0,y=0,z=.002){
  const mesh=new THREE.Mesh(sectionUV(geometry),mat);mesh.position.set(x,y,z);
  mesh.userData.sectionFace=true;parent.add(mesh);return mesh;
 }
 const rect=(p,w,h,x,y,m)=>face(p,new THREE.PlaneGeometry(w,h),m,x,y);
 const steel=sectionFinish('#687b8c','#d6dee3',{hatch:.09}),glass=sectionFinish('#182f43','#567b96',{kind:2});
 const copper=sectionFinish('#a85826','#ffe1a1',{kind:1}),copperEdge=material('#754324',.1,.6);
 const edgeMat=new THREE.LineBasicMaterial({color:'#647f94',transparent:true,opacity:.65});
 function line(parent,points,mat=edgeMat){const o=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),mat);o.userData.sectionFace=true;o.userData.nonPickable=true;parent.add(o);return o;}
 function annotate(parent,text,points){annotations.push(line(parent,points));const end=points.at(-1);annotations.push(label(parent,text,[end[0]+.075,end[1],.012],.036,'#526c82'));}
 const shell=group('chassis');
 rect(shell,1.08,.025,0,.015,steel);
 for(const x of [-.53,.53])rect(shell,.02,.13,x,.085,sectionFinish('#687b8c','#c6d3dc',{axis:0,hatch:.06}));
 line(shell,[[-.54,.15,.004],[-.54,.0025,.004],[.54,.0025,.004],[.54,.15,.004]]);
 const panel=group('glass');rect(panel,1.02,.045,0,.185,glass);
 const pan=group('cookware'),shape=new THREE.Shape();
 // A continuous tapered section, rounded base transitions and rolled lips.
 shape.moveTo(-.298,.2075);shape.lineTo(.298,.2075);shape.quadraticCurveTo(.31,.2075,.31,.2195);
 shape.lineTo(.31,.2525);shape.lineTo(.275,.5725);shape.quadraticCurveTo(.285,.589,.269,.589);shape.quadraticCurveTo(.253,.589,.263,.5725);
 shape.lineTo(.298,.267);shape.quadraticCurveTo(.298,.2615,.289,.2615);shape.lineTo(-.289,.2615);shape.quadraticCurveTo(-.298,.2615,-.298,.267);
 shape.lineTo(-.263,.5725);shape.quadraticCurveTo(-.253,.589,-.269,.589);shape.quadraticCurveTo(-.285,.589,-.275,.5725);
 shape.lineTo(-.31,.2525);shape.lineTo(-.31,.2195);shape.quadraticCurveTo(-.31,.2075,-.298,.2075);shape.closePath();
 const pot=face(pan,new THREE.ShapeGeometry(shape,40),sectionFinish('#6c7d88','#c9d2d9',{axis:0,hatch:.10}));pot.name='hob-continuous-pot-section';
 line(pan,shape.getPoints(40).map(p=>[p.x,p.y,.004]));
 line(pan,[[-.29,.218,.004],[.29,.218,.004]],new THREE.LineBasicMaterial({color:'#e2e6e8'}));
 const coil=group('induction-coil');
 rect(coil,.70,.014,0,.114,material('#b6ae98',.02,.8));
 // Derive all wire intersections from the actual spiral, not an arbitrary dot count.
 const crossings=[];
 for(let i=0;i<spiral.length-1;i++){
  const a=spiral[i],b=spiral[i+1];let x;
  if(Math.abs(a[2])<1e-8)x=a[0];
  else if(a[2]*b[2]<0)x=a[0]+(b[0]-a[0])*(-a[2]/(b[2]-a[2]));
  if(x!==undefined&&!crossings.some(v=>Math.abs(v-x)<1e-5))crossings.push(x);
 }
 const last=spiral.at(-1);if(Math.abs(last[2])<1e-8&&!crossings.some(x=>Math.abs(x-last[0])<1e-5))crossings.push(last[0]);
 for(const x of crossings){
  face(coil,new THREE.CircleGeometry(.009,24),copperEdge,x,.13);
  const disk=face(coil,new THREE.CircleGeometry(.0075,24),copper,x,.13,.0022);
  disk.name='hob-wire-section';disk.userData.centerX=x;
 }
 const ferrite=group('ferrite-core'),ferriteMat=sectionFinish('#353c49','#697485',{hatch:.06});
 for(const x of [-.18,.18])rect(ferrite,.31,.026,x,.094,ferriteMat);
 const heat=group('eddy-currents'),heatMat=sectionFinish('#d26d30','#ffc574',{kind:5,alpha:.85});
 const hot=rect(heat,.57,.030,0,.237,heatMat);hot.position.z=.005;hot.name='hob-section-heating';
 const energy=createHobEnergy({parent:heat,annotations,face,line});
 const field=group('magnetic-field'),fieldMat=sectionFinish('#398eaf','#398eaf',{kind:3,alpha:.72}),arrowMat=sectionFinish('#277ea2','#277ea2',{kind:4,alpha:.95}),arrows=[];
 for(const sign of [-1,1]){
  const points=[[.07,.13],[.075,.29],[.19,.38],[.38,.29],[.44,.13],[.33,.045],[.09,.055]].map(([x,y])=>new THREE.Vector3(sign*x,y,.006));
  const path=new THREE.CatmullRomCurve3(points,true,'centripetal');
  face(field,new THREE.TubeGeometry(path,160,.0012,6,true),fieldMat,0,0,0);
  const arrow=face(field,new THREE.ConeGeometry(.006,.018,16),arrowMat,0,0,0);arrow.name='hob-field-direction';arrow.userData.nonPickable=true;
  arrow.position.copy(path.getPointAt(.11));arrows.push({arrow,tangent:path.getTangentAt(.11)});
 }
 annotate(pan,'锅底',[ [.305,.237,.009],[.50,.31,.009],[.63,.31,.009] ]);
 annotate(panel,'微晶面板',[[.512,.185,.009],[.63,.185,.009]]);
 annotate(coil,'铜线截面',[[.335,.13,.009],[.51,.092,.009],[.63,.092,.009]]);
 annotate(ferrite,'磁芯条',[[.335,.094,.009],[.49,-.035,.009],[.63,-.035,.009]]);
 annotations.push(label(field,'交变磁场（示意）',[0,.46,.012],.034,'#3987a7'));
 return {
  setView({mode}){const cut=mode==='cut';for(const o of originals)o.visible=!cut;for(const g of groups)g.visible=cut;for(const o of annotations)o.visible=cut&&!(typeof innerWidth==='number'&&innerWidth<600);},
  update(t,power,active){
   energy.update(t,power,active);
   heatMat.uniforms.signal.value=active?power*(.8+.2*Math.sin(t*2.2)):0;
   const wave=Math.sin(t*.35*Math.PI*2),direction=wave>=0?1:-1;
   fieldMat.uniforms.signal.value=Math.abs(wave);arrowMat.uniforms.signal.value=Math.pow(Math.abs(wave),.55);
   for(const {arrow,tangent} of arrows)arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tangent.clone().multiplyScalar(direction));
  }
 };
}
