import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export {THREE};
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function material(color='#a9b7c6',metalness=.25,roughness=.35,opacity=1){return new THREE.MeshStandardMaterial({color,metalness,roughness,transparent:opacity<1,opacity,depthWrite:opacity>=1,side:THREE.DoubleSide});}
const mat=m=>m?.isMaterial?m:material(m);
function mesh(parent,geo,m,pos,rotation){const o=new THREE.Mesh(geo,mat(m));o.position.set(...pos);if(rotation)o.rotation.set(...rotation);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
export function box(parent,size,pos,m,rotation){return mesh(parent,new RoundedBoxGeometry(...size,2,Math.min(...size)*.10),m,pos,rotation);}
export function cylinder(parent,radius,height,pos,m,axis='y'){return mesh(parent,new THREE.CylinderGeometry(radius,radius,height,40),m,pos,axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:undefined);}
export function sphere(parent,radius,pos,m){return mesh(parent,new THREE.SphereGeometry(radius,24,16),m,pos);}
export function torus(parent,radius,tube,pos,m,rotation){return mesh(parent,new THREE.TorusGeometry(radius,tube,12,64),m,pos,rotation);}
export function pipe(parent,points,radius,m){const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');return mesh(parent,new THREE.TubeGeometry(path,Math.max(24,points.length*8),radius,8,false),m,[0,0,0]);}
export function coil(parent,radius,length,turns,pos,m,axis='y'){const points=[];for(let i=0;i<=turns*32;i++){let u=i/(turns*32),a=u*turns*Math.PI*2;points.push([Math.cos(a)*radius,(u-.5)*length,Math.sin(a)*radius]);}const o=pipe(parent,points,Math.min(length/turns*.31,radius*.13),m);o.position.set(...pos);if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;return o;}
export function label(parent,text,pos,size=.10,color='#294c7a'){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.font='600 64px Microsoft YaHei, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(text,256,64);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const o=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false}));o.position.set(...pos);o.scale.set(size*4,size,1);o.userData.nonPickable=true;parent.add(o);return o;}
export function assembly(root,id,name,description,explode=[0,0,0],shell=false){const object=new THREE.Group();object.name=id;root.add(object);return {id,name,description,object,explode,shell};}
