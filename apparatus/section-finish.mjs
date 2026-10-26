import {THREE} from './kit.mjs';

// Procedural finishes stay crisp while zooming, without image textures or bloom.
export function sectionFinish(low,high,{kind=0,axis=1,hatch=0,alpha=1}={}){
 return new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:alpha<1,depthWrite:alpha===1,toneMapped:false,
  uniforms:{low:{value:new THREE.Color(low)},high:{value:new THREE.Color(high)},kind:{value:kind},axis:{value:axis},hatch:{value:hatch},alpha:{value:alpha},signal:{value:1}},
  vertexShader:`attribute vec2 sectionUV;varying vec2 vSection;varying vec2 vLocal;varying vec2 vPath;
   void main(){vSection=sectionUV;vLocal=position.xy;vPath=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform vec3 low,high;uniform float kind,axis,hatch,alpha,signal;varying vec2 vSection,vLocal,vPath;
   void main(){
    vec2 p=vSection;float across=mix(p.x,p.y,axis);
    float sheen=.35+.35*sin(across*3.14159)+.24*exp(-pow((across-.78)*14.,2.));
    vec3 color=mix(low,high,sheen);float a=alpha;
    if(kind<.5){
     float grain=sin((vLocal.x+vLocal.y)*740.);color*=1.-hatch*smoothstep(.7,1.,grain);
    }else if(kind<1.5){
     vec2 d=p-.5;float r=length(d)*2.;
     float light=exp(-dot(d-vec2(-.22,.22),d-vec2(-.22,.22))*18.);
     color=mix(low,high,.35+.52*light+.06*sin(r*65.));
     color*=1.-.20*smoothstep(.82,1.,r);
    }else if(kind<2.5){
     color=mix(low,high,p.y*.4+.3);color=mix(color,high,.35*step(.94,p.y));
    }else if(kind<3.5){
     float dash=1.-smoothstep(.72,.82,fract(vPath.x*44.));
     color=low;a*=dash*(.45+.55*signal);
    }else if(kind<4.5){color=low;a*=signal;
    }else{
     float edge=smoothstep(0.,.08,p.x)*smoothstep(0.,.08,1.-p.x);
     float band=pow(max(0.,sin(p.y*3.14159)),.65);
     color=mix(low,high,.4+.3*signal);a*=edge*band*(.35+.45*signal);
    }
    gl_FragColor=vec4(color,a);
    #include <colorspace_fragment>
   }`});
}

export function sectionUV(geometry){
 geometry.computeBoundingBox();const b=geometry.boundingBox,p=geometry.getAttribute('position'),uv=[];
 for(let i=0;i<p.count;i++)uv.push((p.getX(i)-b.min.x)/Math.max(1e-8,b.max.x-b.min.x),(p.getY(i)-b.min.y)/Math.max(1e-8,b.max.y-b.min.y));
 geometry.setAttribute('sectionUV',new THREE.Float32BufferAttribute(uv,2));return geometry;
}
