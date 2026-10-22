import * as k from './vendor/anatomy-kit/iso-kit.mjs';
// Deliberately simplified paper companion: the 3D model is the geometry reference.
const W=960,H=680;
const STYLE=`<style>.paper-figure{--anatomy-paper:#f5f9ff;--anatomy-top:#e6effa;--anatomy-shade-0:#95abc5;--anatomy-shade-1:#acbfd5;--anatomy-shade-2:#c6d5e7;--anatomy-shade-3:#dae5f2;--anatomy-lo:#849bb9;--anatomy-mid:#627e9f;--anatomy-hi:#29496e;--anatomy-faint:#b7c9df}.paper-figure .iso-fill{fill:var(--anatomy-paper);stroke:none;fill-rule:evenodd}.paper-figure .iso-shade{stroke:none}.paper-figure .iso-shade[data-shade="0"]{fill:var(--anatomy-shade-0)}.paper-figure .iso-shade[data-shade="1"]{fill:var(--anatomy-shade-1)}.paper-figure .iso-shade[data-shade="2"]{fill:var(--anatomy-shade-2)}.paper-figure .iso-shade[data-shade="3"]{fill:var(--anatomy-shade-3)}.paper-figure .iso-top{fill:var(--anatomy-top);stroke:none}.paper-figure .iso-line,.paper-figure .iso-edge{fill:none;stroke:var(--anatomy-mid);stroke-width:.8}.paper-figure .iso-line[data-tone="lo"]{stroke:var(--anatomy-lo)}.paper-figure .iso-halo{fill:#8396ad;opacity:.11;filter:blur(10px);stroke:none}.paper-figure .copper{--anatomy-paper:#f4dfcd;--anatomy-top:#f2c89e;--anatomy-shade-0:#b37952;--anatomy-shade-1:#cb9569;--anatomy-shade-2:#dfb186;--anatomy-shade-3:#eac59f;--anatomy-mid:#996747}.paper-figure .steel{--anatomy-paper:#ecf0f4;--anatomy-top:#f1f4f7;--anatomy-shade-0:#8e9ba9;--anatomy-shade-1:#a6b4c2;--anatomy-shade-2:#c4cfd9;--anatomy-shade-3:#dce3eb}.paper-figure .water{--anatomy-top:#bcdcf4;--anatomy-shade-0:#6398c2;--anatomy-shade-1:#7dadd2;--anatomy-shade-2:#98c3e4;--anatomy-shade-3:#b2d4ed}.paper-figure [data-paper-part]{cursor:pointer}.paper-figure [data-paper-part]:hover{filter:drop-shadow(0 0 3px #356fdc88)}.paper-figure [data-paper-part]:focus{outline:none;filter:drop-shadow(0 0 4px #356fdc)}.paper-figure .paper-note{font:12px "Microsoft YaHei",sans-serif;fill:#7b90a9;stroke:none}.paper-figure .rope{fill:none;stroke:#526b87;stroke-width:2.3;stroke-linejoin:round}.paper-figure [data-paper-cover]{display:none}.paper-figure[data-mode="assembled"] [data-paper-cover]{display:inline}.paper-figure[data-mode="xray"] [data-paper-cover]{display:inline;opacity:.14;pointer-events:none}</style>`;
function drawing(kind,experiment){const P=k.fitProjection([[-270,-110,0],[270,110,0],[0,0,420]],W,H,{pad:100,azimuth:35}),at=xyz=>k.iso(xyz,P),solid=paths=>k.solidSvg(paths),box=(x,y,z,w,d,h)=>solid(k.slabOf({x,y,w,d,r:3},z,h,P,5,.8)),cyl=(x,y,z,r,h)=>solid(k.cylinder(x,y,r,z,h,P,48));
 const part=(id,body,cl='',extra='')=>`<g data-paper-part="${id}" tabindex="0" role="button" aria-label="${experiment.parts.find(p=>p.id===id)?.name||id}" class="${cl}" ${extra}>${body}</g>`;
 const path=points=>points.map((p,i)=>`${i?'L':'M'}${at(p).join(' ')}`).join(' ');
 let body='';
 if(kind==='joule'){
  body+=part('frame',box(-245,-90,0,490,180,16)+[-225,205].map(x=>box(x,-65,16,22,22,340)).join('')+box(-225,-65,356,452,28,16));
  body+=part('calorimeter',cyl(0,0,16,71,9)+cyl(0,0,25,64,96),'copper');
  // The open upper half makes both fixed baffles and moving paddles readable.
  body+=part('water',cyl(0,0,121,61,26),'water');
  body+=part('baffles',[-48,38].map(x=>box(x,-9,147,10,45,39)).join(''),'copper');
  body+=part('stirrer',`<g data-paper-rotor>${box(-50,-7,153,100,14,7)+box(-7,-50,170,14,100,7)}</g>`+cyl(0,0,146,5,174),'steel');
  body+=part('calorimeter',cyl(0,0,187,65,9),'copper','data-paper-cover');
  body+=part('drive',box(-52,-16,307,104,32,22)+cyl(0,0,286,17,22),'steel');
  const pulley=(cx)=>{const q=at([cx,-45,344]);return `<ellipse cx="${q[0]}" cy="${q[1]}" rx="19" ry="22" fill="#b7c7d9" stroke="#607f9f" stroke-width="1.4"/><ellipse cx="${q[0]}" cy="${q[1]}" rx="12" ry="15" fill="#eef4fb" stroke="#809ab6"/><circle cx="${q[0]}" cy="${q[1]}" r="4" fill="#6886a8"/>`;};
  body+=part('pulleys',pulley(-205)+pulley(205));
  body+=part('ropes',[-205,205].map(x=>`<path class="rope" data-rope="${x}" d="${path([[Math.sign(x)*35,-12,320],[x,-45,344],[x,-45,270]])}"/>`).join(''));
  body+=part('weights',[-205,205].map(x=>`<g data-paper-weight="${x}">${cyl(x,-45,230,19,40)+cyl(x,-45,270,7,7)}</g>`).join(''),'steel');
  body+=part('thermometer',cyl(40,0,145,3.7,118)+cyl(40,0,139,7,9),'steel');
 }else{
  body+=part('bench',box(-235,-85,0,470,170,18)+[-170,-32].map(x=>box(x,-42,18,14,16,355)).join('')+box(-170,-42,373,152,22,18));
  body+=part('bath',box(70,-60,18,115,102,95)+box(90,-68,57,58,6,28),'steel');
  body+=part('jacket',cyl(-90,0,23,57,40),'water');
  body+=part('cylinder',cyl(-90,0,63,47,9)+cyl(-90,0,72,43,240),'steel');
  body+=part('cylinder',cyl(-90,0,75,39,160),'water','data-paper-gas');
  body+=part('piston',`<g data-paper-piston>${cyl(-90,0,232,40,12)}</g>`,'steel');
  body+=part('drive',`<g data-paper-drive>${cyl(-90,0,244,5,160)+cyl(-90,0,403,28,6)}</g>`,'steel');
  body+=part('gauge',box(-15,-10,18,12,15,120)+(()=>{const [x,y]=at([-10,-10,159]);return `<circle cx="${x}" cy="${y}" r="30" fill="#f5f9ff" stroke="#8fa9c7" stroke-width="5"/><g transform="translate(${x} ${y})"><path data-paper-needle d="M0 0H21" stroke="#356fdc" stroke-width="2.8"/></g><circle cx="${x}" cy="${y}" r="3" fill="#356fdc"/>`;})(),'steel');
  body+=part('probe',`<path d="${path([[-90,0,90],[-135,0,90],[-140,-20,60],[100,-15,60]])}" class="rope"/>`);
  body+=part('jacket',`<path d="${path([[70,-18,67],[35,-18,67],[35,45,55],[-80,45,55]])}" fill="none" stroke="#8eb5d5" stroke-width="5"/>`);
 }
 // Fasteners belong to the base; their size stays small in the paper view.
 body+=part(kind==='joule'?'frame':'bench',[[-215,-72],[215,-72],[-215,65],[215,65]].map(([x,y])=>cyl(x,y,16,3,2)).join(''),'steel');
 return {body,P,at,cyl};
}
const caches=new Map();
export function experimentAnatomyMarkup(kind,experiment){const d=drawing(kind,experiment);caches.set(kind,d);return `${STYLE}<svg class="paper-figure" data-mode="cut" viewBox="0 0 ${W} ${H}" role="img" aria-label="${experiment.title}纸上结构示意"><title>${experiment.title}纸上结构示意</title><desc>可点选部件。固定等距视角，形状和比例为说明结构而简化；精确连接请观察立体模型。</desc>${d.body}<text class="paper-note" x="480" y="605" text-anchor="middle">固定等距示意 · 点选部件查看结构</text></svg>`;}
export function mountExperimentAnatomy(container,{kind,experiment,onSelect}){
 const svg=container.querySelector('svg'),d=caches.get(kind),parts=[...svg.querySelectorAll('[data-paper-part]')];
 const handler=e=>{if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;const p=e.target.closest('[data-paper-part]');if(p){if(e.type==='keydown')e.preventDefault();onSelect(p.dataset.paperPart);}};
 svg.addEventListener('click',handler);svg.addEventListener('keydown',handler);
 return {update(state,model){
  svg.dataset.mode=state.mode;
  for(const p of parts){p.classList.toggle('selected',p.dataset.paperPart===state.selected);const spec=experiment.parts.find(x=>x.id===p.dataset.paperPart),off=state.mode==='explode'?spec?.explode||[0,0,0]:[0,0,0],a=d.at([off[0]*150,off[2]*150,off[1]*150]),b=d.at([0,0,0]);p.setAttribute('transform',`translate(${a[0]-b[0]} ${a[1]-b[1]})`);}
  if(kind==='joule'){
   for(const weight of svg.querySelectorAll('[data-paper-weight]')){const v=d.at([0,0,-(model.weightFraction||0)*95]),zero=d.at([0,0,0]);weight.setAttribute('transform',`translate(${v[0]-zero[0]} ${v[1]-zero[1]})`);}
   for(const rope of svg.querySelectorAll('[data-rope]')){const x=Number(rope.dataset.rope),ps=[[Math.sign(x)*35,-12,320],[x,-45,344],[x,-45,270-(model.weightFraction||0)*95]];rope.setAttribute('d',ps.map((p,i)=>`${i?'L':'M'}${d.at(p).join(' ')}`).join(' '));}
   const projection={...d.P,azimuth:d.P.azimuth+(model.paddleAngle||0)*180/Math.PI};
   svg.querySelector('[data-paper-rotor]').innerHTML=k.solidSvg(k.slabOf({x:-50,y:-7,w:100,d:14,r:2},153,7,projection,3,.5))+k.solidSvg(k.slabOf({x:-7,y:-50,w:14,d:100,r:2},170,7,projection,3,.5));
  }else{
   const volume=model.state?.volumeM3||.0016,ratio=volume/.0016,shift=(ratio-1)*160,v=d.at([0,0,shift]),zero=d.at([0,0,0]);
   svg.querySelector('[data-paper-gas]').innerHTML=d.cyl(-90,0,75,39,160*ratio);
   for(const m of svg.querySelectorAll('[data-paper-piston],[data-paper-drive]'))m.setAttribute('transform',`translate(${v[0]-zero[0]} ${v[1]-zero[1]})`);
   svg.querySelector('[data-paper-needle]').setAttribute('transform',`rotate(${-(model.geometry?.needleAngle||0)*180/Math.PI})`);
  }
 }};
}
