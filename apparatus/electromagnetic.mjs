import {
  THREE, material, box, cylinder, sphere, torus, pipe, coil, label, assembly,
} from './kit.mjs';

const M = {
  iron: material('#596775', .78, .32),
  steel: material('#a8b4bd', .82, .24),
  darkSteel: material('#343e49', .78, .34),
  copper: material('#b96a3f', .8, .28),
  brightCopper: material('#dc8950', .78, .23),
  enamel: material('#c96e47', .62, .25),
  insulator: material('#26384a', .12, .44),
  base: material('#263b50', .22, .34),
  rubber: material('#242a31', .05, .72),
  paper: material('#a88360', .03, .78),
  plastic: material('#ccd8df', .08, .3),
  red: material('#b64c48', .1, .4),
  blue: material('#397fb6', .12, .35),
  silver: material('#d2d7d7', .85, .2),
  brass: material('#c89a43', .78, .24),
};

const v3 = (v) => new THREE.Vector3(...v);
function mesh(parent, geometry, mat, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const o = new THREE.Mesh(geometry, mat);
  o.position.set(...pos);
  o.rotation.set(...rot);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
function beam(parent, a, b, width, depth, mat) {
  const va = v3(a), vb = v3(b), delta = vb.clone().sub(va);
  const o = mesh(parent, new THREE.BoxGeometry(delta.length(), width, depth), mat, va.clone().add(vb).multiplyScalar(.5).toArray());
  o.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), delta.normalize());
  return o;
}
function annulus(parent, outer, inner, depth, pos, mat, axis = 'z') {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 });
  geometry.translate(0, 0, -depth / 2);
  const rot = axis === 'y' ? [-Math.PI / 2, 0, 0] : axis === 'x' ? [0, Math.PI / 2, 0] : [0, 0, 0];
  return mesh(parent, geometry, mat, pos, rot);
}
function annularSegment(parent, inner, outer, depth, start, end, pos, mat) {
  const shape = new THREE.Shape();
  const samples = 32;
  for (let i = 0; i <= samples; i++) {
    const a = start + (end - start) * i / samples;
    const p = [outer * Math.cos(a), outer * Math.sin(a)];
    if (!i) shape.moveTo(...p); else shape.lineTo(...p);
  }
  for (let i = samples; i >= 0; i--) {
    const a = start + (end - start) * i / samples;
    shape.lineTo(inner * Math.cos(a), inner * Math.sin(a));
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: samples });
  geometry.translate(0, 0, -depth / 2);
  return mesh(parent, geometry, mat, pos);
}
function closedWire(parent, points, radius, mat) {
  const curve = new THREE.CatmullRomCurve3(points.map(v3), true, 'centripetal');
  return mesh(parent, new THREE.TubeGeometry(curve, Math.max(64, points.length * 12), radius, 8, true), mat);
}
function roundedRectLoop(x, y, z, w, h, r = .025) {
  return [
    [x - w / 2 + r, y - h / 2, z], [x, y - h / 2, z], [x + w / 2 - r, y - h / 2, z],
    [x + w / 2, y - h / 2 + r, z], [x + w / 2, y, z], [x + w / 2, y + h / 2 - r, z],
    [x + w / 2 - r, y + h / 2, z], [x, y + h / 2, z], [x - w / 2 + r, y + h / 2, z],
    [x - w / 2, y + h / 2 - r, z], [x - w / 2, y, z], [x - w / 2, y - h / 2 + r, z],
  ];
}
function addBolt(parent, pos, axis = 'y', radius = .016, mat = M.steel) {
  const head = cylinder(parent, radius, .018, pos, mat, axis);
  head.userData.fastener = true;
  return head;
}
function arrow(parent, origin, direction, length, color) {
  const g = new THREE.Group();
  g.userData.nonPickable = true;
  const a = new THREE.ArrowHelper(v3(direction).normalize(), v3(origin), length, color, length * .23, length * .14);
  g.add(a);
  parent.add(g);
  return { group: g, helper: a };
}
function safeNumber(inputs, key, fallback) {
  const n = Number(inputs?.[key]);
  return Number.isFinite(n) ? n : fallback;
}

function motorPhysics(t, inputs = {}) {
  const voltage = Math.max(0, safeNumber(inputs, 'voltage', .5));
  // Lumped classroom equivalent: armature V=IR+Ke*w, torque=Kt*I, load=b*w.
  const R = 2.4, Ke = .025, Kt = .025, b = .001;
  const omega = voltage / (Ke + R * b / Kt);
  const current = b * omega / Kt;
  const backEmf = Ke * omega;
  const rpm = omega * 60 / (2 * Math.PI);
  const shownOmega = omega * .22;
  const phase = shownOmega * t + safeNumber(inputs, '_phaseOffset', 0);
  // Brush angular half-width is < .06 rad; each insulating gap has .085
  // half-width. The idealized open interval excludes brush bridging.
  const polarity = Math.abs(Math.cos(phase)) < Math.sin(.085) ? 0 : Math.sign(Math.cos(phase));
  return { voltage, omega, current, backEmf, rpm, phase, polarity,
    torqueFactor: polarity * Math.cos(phase) };
}

function speakerPhysics(t, inputs = {}) {
  const level = THREE.MathUtils.clamp(safeNumber(inputs, 'level', .65), 0, 1);
  const frequency = Math.max(.25, safeNumber(inputs, 'frequency', 1.5));
  // Normalized teaching signal; the visible cone travel is exaggerated and the signal is slowed.
  const phase = 2 * Math.PI * frequency * t + safeNumber(inputs, '_phaseOffset', 0);
  const relativeCurrent = level * Math.sin(phase);
  const excursion = .024 * level * Math.sin(phase);
  return { level, frequency, phase, relativeCurrent, excursion, direction: Math.sign(relativeCurrent) };
}

function relayPhysics(t, inputs = {}) {
  const current = THREE.MathUtils.clamp(safeNumber(inputs, 'coilCurrent', 0), 0, 1.2);
  const pullIn = .52;
  // Normalized magnetic attraction proportional to current squared against a spring threshold.
  const forceRatio = (current / pullIn) ** 2;
  const angle = .22 * THREE.MathUtils.clamp((forceRatio - .32) / .68, 0, 1);
  const travel = .80 * Math.sin(angle);
  const closed = current >= pullIn;
  const ncClosed = angle === 0;
  return { current, pullIn, forceRatio, travel, closed, ncClosed, angle };
}

function generatorPhysics(t, inputs = {}) {
  const rpm = THREE.MathUtils.clamp(safeNumber(inputs, 'rpm', 60), 0, 120);
  // Illustrative coil equivalent, not a product specification: N=80, B=.20 T, A=.012 m^2.
  const turns = 80, field = .20, area = .012, loadOhms = 10;
  const omega = 2 * Math.PI * rpm / 60;
  const phase = omega * t + safeNumber(inputs, '_phaseOffset', 0);
  const peak = turns * field * area * omega;
  const emf = peak === 0 ? 0 : -peak * Math.cos(phase);
  return { rpm, omega, phase, peak, rms: peak / Math.SQRT2, emf, current: emf / loadOhms,
    fluxLinkage: turns * field * area * Math.sin(phase) };
}

// Straight segments avoid spline overshoot into adjacent solids. Paths also form
// the geometry contract used by the full-cycle clearance tests.
function conductor(parent, points, radius, mat = M.copper, name = '') {
  const path = new THREE.CurvePath();
  for (let i = 1; i < points.length; i++) path.add(new THREE.LineCurve3(v3(points[i - 1]), v3(points[i])));
  const o = mesh(parent, new THREE.TubeGeometry(path, Math.max(64, points.length * 5), radius, 8, false), mat);
  o.name = name; o.userData.path = points; o.userData.radius = radius;
  return o;
}
function windingPoints(turns, halfWidth, halfHeight, map) {
  const corners = [[1,-1],[1,1],[-1,1],[-1,-1],[1,-1]];
  const pts = [];
  for (let n = 0; n < turns; n++) for (let k = 0; k < 4; k++) {
    const layer = .040 + .096 * (n + k / 4) / turns;
    pts.push(map(corners[k][0] * halfWidth, corners[k][1] * halfHeight, layer));
  }
  pts.push(map(halfWidth, -halfHeight, .136));
  return pts;
}
function moduleRoot() {
  const root = new THREE.Group(), parts = [];
  return { root, parts, add: (...args) => {const p = assembly(root, ...args); parts.push(p); return p.object;} };
}
function named(o, name) {o.name = name; return o;}
function boredCrossbar(parent,y) {
  const s=new THREE.Shape();s.moveTo(-.42,-.20);s.lineTo(.42,-.20);s.lineTo(.42,.20);s.lineTo(-.42,.20);s.closePath();
  const h=new THREE.Path();h.absarc(0,0,.10,0,2*Math.PI,true);s.holes.push(h);
  const g=new THREE.ExtrudeGeometry(s,{depth:.06,bevelEnabled:false,curveSegments:48});g.translate(0,0,-.03);g.rotateX(Math.PI/2);
  return mesh(parent,g,M.iron,[0,y,0]);
}

function buildDcMotor() {
  const {root, parts, add} = moduleRoot();
  const wireRed=material('#af0920',.08,.32),wireBlue=material('#0644ba',.08,.32);
  const base = add('motor-base', '底座与电源', '绝缘接线端将直流电源接入固定电刷。', [0,-.1,0]);
  box(base,[1.12,.10,1.05],[0,.10,.02],M.base);
  for (const sign of [-1,1]) {
    box(base,[.14,.05,.12],[sign*.32,.185,.43],M.insulator);
    cylinder(base,.026,.035,[sign*.32,.225,.43],sign>0?M.red:M.blue);
    label(base,sign>0?'+':'−',[sign*.32,.29,.44],.06);
  }
  const yoke = add('motor-yoke','回磁轭','底部铁轭把两侧磁极连成磁路，避开转子扫掠空间。',[0,-.08,0]);
  box(yoke,[.84,.08,.46],[0,.245,0],M.iron);
  for (const sign of [-1,1]) {
    box(yoke,[.10,.49,.46],[sign*.37,.45,0],M.iron);
    box(yoke,[.14,.055,.30],[sign*.37,.1775,0],M.darkSteel);
  }
  const poles = add('motor-poles','定子磁极','左 N 右 S，气隙中的磁场沿 +X。',[.12,0,0]);
  for (const sign of [-1,1]) {
    named(box(poles,[.08,.40,.46],[sign*.29,.52,0],sign<0?M.blue:M.red),`motor-pole-${sign}`);
    named(label(poles,sign<0?'N':'S',[sign*.29,.55,.255],.09),`motor-pole-label-${sign}`);
  }
  const fieldMark=named(new THREE.Group(),'motor-field-direction');poles.add(fieldMark);
  fieldMark.userData.hideWhenExploded=true;
  arrow(fieldMark,[-.20,.79,0],[1,0,0],.40,0x398db8);
  const fieldLabel=label(fieldMark,'B',[0,.86,0],.06);
  const bearings = add('motor-bearings','轴承与支座','空心轴套包住转轴；支座止于轴套下方。',[0,.08,.14]);
  for (const z of [-.33,.49]) {
    box(bearings,[.17,.30,.075],[0,.30,z],M.darkSteel);
    annulus(bearings,.085,.031,.075,[0,.52,z],M.brass);
  }
  const rotor = add('motor-rotor','电枢线圈与转轴','线圈长边平行转轴，轴向导线受横向磁场力，形成绕 Z 的转矩。偏置绝缘骨架避开主轴，另一侧配重。',[0,0,-.12]);
  const rm = named(new THREE.Group(),'motor-rotor-motion'); rm.position.y=.52; rotor.add(rm);
  cylinder(rm,.028,.98,[0,0,.04],M.steel,'z');
  box(rm,[.29,.11,.36],[0,.08,0],M.insulator);
  cylinder(rm,.04,.30,[0,0,0],M.insulator,'z');
  box(rm,[.22,.08,.28],[0,-.085,0],M.darkSteel);
  // Looking from +Y, current from the positive segment enters the start of this
  // winding. Its area normal is -Y; (-Y) x (+X) gives +Z torque at phase zero.
  const pts = windingPoints(6,.16,.20,(x,z,y)=>[x,y,z]);
  conductor(rm,pts,.005,M.enamel,'motor-winding');
  conductor(rm,[pts[0],[.16,.04,-.255],[.207,.04,-.255],[.207,.04,.25],[.075,0,.29],[.09,0,.36]],.006,wireRed,'motor-start-lead');
  conductor(rm,[pts.at(-1),[.16,.136,-.265],[-.19,.055,-.265],[-.19,.055,.25],[-.075,.035,.29],[-.09,0,.36]],.006,wireBlue,'motor-end-lead');
  let sectionMode=false,currentActive=true;
  const comm = add('motor-commutator','有绝缘缝的分裂环','两条轴向绝缘缝在零转矩位置经过电刷；惯性带过死点。',[0,0,.14]);
  const cm = named(new THREE.Group(),'motor-commutator-motion');cm.position.y=.52;comm.add(cm);
  const gap=.085;
  annularSegment(cm,.045,.09,.075,-Math.PI/2+gap,Math.PI/2-gap,[0,0,.36],M.brightCopper);
  annularSegment(cm,.045,.09,.075,Math.PI/2+gap,3*Math.PI/2-gap,[0,0,.36],M.copper);
  cylinder(cm,.045,.09,[0,0,.36],M.insulator,'z');
  const brushes=add('motor-brushes','固定碳刷与绝缘刷握','窄碳刷端面接触铜环外圆；电源与转子之间只有滑动电接触。',[.10,0,.1]);
  for(const sign of [-1,1]) {
    named(box(brushes,[.08,.010,.045],[sign*.13,.52,.36],M.darkSteel),`motor-brush-${sign}`);
    box(brushes,[.07,.065,.075],[sign*.185,.52,.36],M.insulator);
    box(brushes,[.065,.28,.06],[sign*.20,.335,.36],M.insulator);
    const wire=conductor(brushes,[[sign*.17,.52,.36],[sign*.28,.45,.40],[sign*.32,.225,.43]],.009,sign>0?wireRed:wireBlue,`motor-supply-wire-${sign}`);
    wire.userData.hideWhenExploded=true;
  }
  const marks=add('motor-force','电流与力方向','轴向电流与横向磁场的叉积给出切向力；半周后换向。',[0,0,.05]);
  marks.userData.hideWhenExploded=true;
  const fa=arrow(marks,[.18,.52,.05],[0,1,0],.10,0xc46f35);
  const ia=arrow(marks,[.18,.52,-.12],[0,0,1],.16,0xd99508);
  const fb=arrow(marks,[-.18,.52,.05],[0,-1,0],.10,0xc46f35);
  const ib=arrow(marks,[-.18,.52,-.12],[0,0,-1],.16,0xd99508);
  // Two enlarged representative active-conductor sections, symmetrically
  // arranged about a fixed shaft center for the simplified sectional view.
  // Current/force signs follow the actual motor's commutation, not its leads.
  const sectionDiagram=named(new THREE.Group(),'motor-section-diagram');marks.add(sectionDiagram);sectionDiagram.visible=false;
  // A neutral schematic bridge connects the two sections behind their symbols.
  const sectionBridge=named(new THREE.Mesh(new THREE.PlaneGeometry(.32,.012),new THREE.MeshBasicMaterial({color:'#aab9c9',toneMapped:false})),'motor-section-bridge');
  sectionBridge.userData.nonPickable=true;sectionDiagram.add(sectionBridge);
  const sectionPivot=named(new THREE.Mesh(new THREE.RingGeometry(.005,.009,32),new THREE.MeshBasicMaterial({color:'#718398',toneMapped:false})),'motor-section-pivot');
  sectionPivot.position.set(0,.52,.025);sectionPivot.userData.nonPickable=true;sectionDiagram.add(sectionPivot);
  const sections=[];
  const ink=new THREE.MeshBasicMaterial({color:'#19344d',toneMapped:false});
  const forceInk=new THREE.MeshBasicMaterial({color:'#cf6522',toneMapped:false});
  for(const sign of [1,-1]){
    const g=named(new THREE.Group(),`motor-section-${sign}`);sectionDiagram.add(g);
    const fill=new THREE.MeshBasicMaterial({color:sign>0?'#ffd9d7':'#d2e5ff',toneMapped:false});
    const edge=new THREE.MeshBasicMaterial({color:sign>0?'#ca3440':'#2564b5',toneMapped:false});
    const disk=new THREE.Mesh(new THREE.CircleGeometry(.031,64),fill);g.add(disk);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.027,.032,64),edge);ring.position.z=.001;g.add(ring);
    const dot=named(new THREE.Mesh(new THREE.CircleGeometry(.008,32),ink),`motor-section-dot-${sign}`);dot.position.z=.003;g.add(dot);
    const cross=named(new THREE.Group(),`motor-section-cross-${sign}`);g.add(cross);
    for(const angle of [Math.PI/4,-Math.PI/4]){
      const stroke=new THREE.Mesh(new THREE.PlaneGeometry(.027,.0045),ink);stroke.rotation.z=angle;stroke.position.z=.003;cross.add(stroke);
    }
    const force=named(new THREE.Group(),`motor-section-force-${sign}`);sectionDiagram.add(force);
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.0025,.0025,.055,12),forceInk);stem.position.y=.0275;force.add(stem);
    const tip=new THREE.Mesh(new THREE.ConeGeometry(.010,.020,24),forceInk);tip.position.y=.065;force.add(tip);
    sectionDiagram.traverse(o=>{o.userData.nonPickable=true;});
    sections.push({sign,g,dot,cross,force});
  }
  // Surface highlights follow the real conductor paths. No bloom, extra lights,
  // or wall-clock animation: the scene's simulation time also freezes these.
  const currentBands=[];
  for(const [name,direction,rotating] of [
    ['motor-start-lead',-1,true],['motor-end-lead',1,true],
  ]) {
    const wire=root.getObjectByName(name),path=wire.geometry.parameters.path;
    const mat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,toneMapped:false,
      uniforms:{travel:{value:0},length:{value:path.getLength()}},
      vertexShader:`varying vec2 vUv; varying vec3 vNormal;
        void main(){vUv=uv;vNormal=normalize(normalMatrix*normal);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform float travel; uniform float length;
        varying vec2 vUv; varying vec3 vNormal;
        void main(){
          // One longer highlight on each colored rotor lead, two in total.
          float band=mod(vUv.x*length-travel-length*0.28,length);
          float edge=smoothstep(0.0,0.035,band)*(1.0-smoothstep(0.22,0.28,band));
          if(edge<0.015)discard;
          float reflection=pow(max(dot(normalize(vNormal),normalize(vec3(-0.3,0.8,1.0))),0.0),12.0);
          vec3 gold=mix(vec3(0.90,0.45,0.015),vec3(1.0,0.79,0.10),edge);
          gold=mix(gold,vec3(1.0,0.97,0.68),reflection*0.88);
          gl_FragColor=vec4(gold,edge);
          #include <colorspace_fragment>
        }`,
    });
    const highlight=new THREE.Mesh(new THREE.TubeGeometry(path,Math.max(96,wire.userData.path.length*10),wire.userData.radius*1.65,8,false),mat);
    highlight.name=`${name}-current`;highlight.userData.nonPickable=true;
    highlight.userData.hideWhenExploded=true;wire.add(highlight);
    currentBands.push({highlight,direction,rotating});
  }
  return {root,parts,
    viewStyle(o,part,mode){
      if(!['cut','xray'].includes(mode))return {opacity:1,pale:0};
      if(mode==='cut')return {opacity:part.id==='motor-poles'||part.id==='motor-force'?1:0,pale:0};
      if(/motor-(winding|start-lead|end-lead|supply-wire)/.test(o.name))return {opacity:1,pale:0};
      if(part.id==='motor-force')return {opacity:1,pale:0};
      if(part.id==='motor-poles')return mode==='cut'?{opacity:1,pale:0}:{opacity:.16,pale:.85};
      if(part.id==='motor-commutator'||/^motor-brush-/.test(o.name))return {opacity:mode==='cut'?.12:.72,pale:mode==='cut'?.8:.2};
      return {opacity:mode==='cut'?.055:.10,pale:.94};
    },
    setView({planar,mode}){
      sectionMode=mode==='cut';
      for(const part of parts)part.object.userData.modelVisible=!sectionMode||['motor-poles','motor-force'].includes(part.id);
      sectionDiagram.visible=sectionMode&&planar>.97;
      for(const {highlight} of currentBands)highlight.visible=highlight.userData.modelVisible=!sectionMode&&currentActive;
      for(const a of [fa,fb,ia,ib])a.group.visible=!sectionMode&&currentActive;
      for(const sign of [-1,1])poles.getObjectByName(`motor-pole-label-${sign}`).position.set(sign*.29,.55,.255);
      fieldMark.position.y=.045*planar;fieldMark.position.z=0;fieldLabel.position.z=0;
    },
    update(t,inputs={}) {
    const s=motorPhysics(t,inputs);rm.rotation.z=cm.rotation.z=s.phase;
    const c=Math.cos(s.phase),q=Math.sin(s.phase),pol=s.polarity;
    currentActive=s.current>0&&pol!==0;
    // Integral of the commutated direction, with a plateau at each insulating
    // gap. This reverses continuously, and remains deterministic on restore.
    const rotorTravel=s.omega>0?THREE.MathUtils.clamp(Math.asin(Math.sin(s.phase)),-Math.PI/2+gap,Math.PI/2-gap)*.34/(s.omega*.22):0;
    for(const {highlight,direction,rotating} of currentBands){
      highlight.material.uniforms.travel.value=direction*(rotating?rotorTravel:t*.34);
      highlight.visible=highlight.userData.modelVisible=!sectionMode&&s.current>0&&pol!==0;
    }
    for(const [sign,f,i] of [[1,fa,ia],[-1,fb,ib]]) {
      const x=sign*.16*c-.088*q,y=.52+sign*.16*q+.088*c;
      f.helper.position.set(x,y,0);f.helper.setDirection(v3([0,sign*(pol||1),0]));
      i.helper.position.set(x,y,-.12);i.helper.setDirection(v3([0,0,sign*(pol||1)]));
      f.group.visible=i.group.visible=!sectionMode&&currentActive;
    }
    sectionBridge.position.set(0,.52,.015);
    sectionBridge.rotation.z=s.phase;
    for(const {sign,g,dot,cross,force} of sections){
      const x=sign*.16*c,y=.52+sign*.16*q;
      const out=sign*pol;
      g.position.set(x,y,.02);
      g.userData.currentDirection=out;
      dot.visible=currentActive&&out>0;cross.visible=currentActive&&out<0;
      force.visible=currentActive;
      force.position.set(x,y+out*.038,.02);
      force.rotation.z=out<0?Math.PI:0;
      force.userData.forceDirection=out;
    }
    return s;
  }};
}

// Annular suspensions have a fixed outer rim and a moving inner rim. Corrugated
// surfaces deform continuously; no unattached rigid torus follows the cone.
function suspension(parent, inner, outer, z, amplitude, mat, name) {
  const rows=16,cols=72, positions=[],indices=[],weights=[];
  for(let i=0;i<=rows;i++) for(let j=0;j<=cols;j++) {
    const u=i/rows,a=j/cols*Math.PI*2,r=inner+(outer-inner)*u;
    positions.push(r*Math.cos(a),.72+r*Math.sin(a),z+amplitude*Math.sin(u*Math.PI*4));weights.push(1-u);
  }
  for(let i=0;i<rows;i++) for(let j=0;j<cols;j++){const k=i*(cols+1)+j;indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  const o=named(mesh(parent,g,mat),name); const rest=positions.slice();
  return {object:o,update(x){const p=g.attributes.position;for(let i=0;i<weights.length;i++)p.setZ(i,rest[i*3+2]+x*weights[i]);p.needsUpdate=true;g.computeVertexNormals();}};
}
function buildSpeaker() {
  const {root,parts,add}=moduleRoot();
  const base=add('speaker-base','安装脚','支脚承托篮架与磁路。',[0,-.12,0]);
  box(base,[1.20,.08,.62],[0,.06,-.15],M.base);
  for(const sign of [-1,1])beam(base,[sign*.28,.10,-.20],[sign*.20,.483,-.08],.075,.09,M.darkSteel);
  const basket=add('speaker-basket','篮架','八根径向支架连接前安装圈和后磁路支架。',[0,0,-.06]);
  annulus(basket,.64,.59,.04,[0,.72,.18],M.steel);
  annulus(basket,.33,.28,.045,[0,.72,-.08],M.darkSteel);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;beam(basket,[.30*Math.cos(a),.72+.30*Math.sin(a),-.10],[.30*Math.cos(a),.72+.30*Math.sin(a),-.18],.025,.025,M.steel);}
  for(let i=0;i<8;i++) {const a=i*Math.PI/4;
    beam(basket,[.615*Math.cos(a),.72+.615*Math.sin(a),.18],[.315*Math.cos(a),.72+.315*Math.sin(a),-.08],.025,.025,M.steel);
    addBolt(basket,[.615*Math.cos(a),.72+.615*Math.sin(a),.207],'z',.012);
  }
  const magnet=add('speaker-magnet','环形磁体与 T 形磁轭','环形铁氧体、后铁板和极柱闭合磁路；顶板内缘与极柱之间形成径向气隙。',[0,0,-.20]);
  annulus(magnet,.30,.16,.14,[0,.72,-.32],M.darkSteel);
  cylinder(magnet,.31,.045,[0,.72,-.4125],M.iron,'z');
  named(cylinder(magnet,.105,.27,[0,.72,-.255],M.iron,'z'),'speaker-pole');
  named(annulus(magnet,.31,.14,.08,[0,.72,-.21],M.steel),'speaker-top-plate');
  const moving=add('speaker-moving-system','纸盆、防尘帽与音圈','空心骨架包围极柱，环绕音圈始终悬浮在环形气隙内，纸盆喉部朝后。',[0,0,.18]);
  const dm=named(new THREE.Group(),'speaker-motion');moving.add(dm);
  const profile=[new THREE.Vector2(.118,-.055),new THREE.Vector2(.52,.18),new THREE.Vector2(.52,.186),new THREE.Vector2(.118,-.049)];
  const cg=new THREE.LatheGeometry(profile,72);cg.rotateX(Math.PI/2);mesh(dm,cg,M.paper,[0,.72,0]);
  const cap=sphere(dm,.123,[0,.72,-.045],M.rubber);cap.scale.z=.35;
  named(annulus(dm,.118,.112,.25,[0,.72,-.175],M.plastic),'speaker-former');
  const vc=named(coil(dm,.125,.13,16,[0,.72,-.21],M.brightCopper,'z'),'speaker-voice-coil');
  const surround=add('speaker-surround','悬边与弹波','两处柔性悬挂的外缘固定、内缘随音圈移动，保持音圈同轴。',[0,0,.08]);
  const su=suspension(surround,.52,.60,.18,.009,M.rubber,'speaker-surround-surface');
  const sp=suspension(surround,.118,.28,-.055,.006,M.paper,'speaker-spider-surface');
  const terminals=add('speaker-terminals','固定端子与柔性引线','软导线一端固定在篮架端子，另一端随音圈运动。',[0,-.05,.08]);
  const flexible=[];
  for(const sign of [-1,1]) {
    box(terminals,[.075,.06,.06],[sign*.27,.43,-.06],M.insulator);
    const end=[.125,.72,sign<0?-.275:-.145];
    // Separate azimuths keep the flexible wires electrically isolated. In the
    // plate depth they run inside the gap at r=.133; the rear lead rounds the
    // coil behind its first turn, never through the ferrite or other turns.
    const points=sign<0?
      [[-.27,.43,-.06],[-.22,.56,-.11],[-.15,.77,-.11],[0,.853,-.11],[0,.853,-.283],[.094,.814,-.283],end]:
      [[.27,.43,-.06],[.21,.50,-.10],[.16,.62,-.10],[.133,.72,-.12],[.133,.72,-.145],end];
    const lead=conductor(terminals,points,.003,M.copper,`speaker-flex-${sign}`);
    flexible.push({lead,points});
  }
  const field=add('speaker-field','径向磁场与轴向力','磁场从中心极柱径向朝外；负环向电流与径向磁场叉乘，得到正轴向力。',[0,0,.08]);
  for(const a of [0,Math.PI/2,Math.PI,3*Math.PI/2])arrow(field,[.108*Math.cos(a),.72+.108*Math.sin(a),-.16],[Math.cos(a),Math.sin(a),0],.065,0x4097bb);
  const force=arrow(field,[.37,.72,.22],[0,0,1],.14,0xc97a43);
  const current=arrow(field,[.125,.72,-.21],[0,-1,0],.10,0xc94f45);
  label(field,'F',[.41,.83,.25],.06);
  return {root,parts,update(t,inputs={}) {
    const s=speakerPhysics(t,inputs);dm.position.z=s.excursion;su.update(s.excursion);sp.update(s.excursion);
    for(const {lead,points} of flexible) {
      const p=points.map((v,i)=>[v[0],v[1],v[2]+s.excursion*Math.min(1,i/2)]);
      const path=new THREE.CurvePath();for(let i=1;i<p.length;i++)path.add(new THREE.LineCurve3(v3(p[i-1]),v3(p[i])));
      lead.geometry.dispose();lead.geometry=new THREE.TubeGeometry(path,64,.003,8,false);lead.userData.path=p;
    }
    force.helper.setDirection(v3([0,0,s.direction||1]));current.helper.setDirection(v3([0,-s.direction||-1,0]));
    force.group.visible=current.group.visible=Math.abs(s.relativeCurrent)>.001;return s;
  }};
}

function buildRelay() {
  const {root,parts,add}=moduleRoot();
  const base=add('relay-base','绝缘底座','绝缘底板承托电磁铁和独立触点回路。',[0,-.1,0]);
  box(base,[1.25,.10,.68],[0,.10,0],M.base);
  const core=add('relay-core-yoke','铁芯与磁轭','左侧铰链与磁轭连接；衔铁靠近右侧工作极面，闭合磁路。',[0,0,-.12]);
  box(core,[.43,.08,.16],[-.22,.23,0],M.iron);
  box(core,[.08,.43,.16],[-.40,.425,0],M.iron);
  cylinder(core,.07,.30,[-.10,.40,0],M.iron);
  named(box(core,[.13,.035,.15],[-.10,.5375,0],M.steel),'relay-pole');
  const winding=add('relay-winding','绝缘骨架与线圈','绕组围住铁芯；两端引线分别接 A1、A2，与触点电路隔离。',[0,0,.15]);
  annulus(winding,.092,.075,.24,[-.10,.40,0],M.insulator,'y');
  const cw=coil(winding,.10,.23,20,[-.10,.40,0],M.brightCopper);
  for(const y of [.275,.525])annulus(winding,.12,.075,.018,[-.10,y,0],M.insulator,'y');
  conductor(winding,[[0,.285,0],[.02,.26,.13],[-.46,.20,.24]],.007,M.blue,'relay-A1-wire');
  conductor(winding,[[0,.515,0],[.05,.53,.17],[-.27,.20,.24]],.007,M.red,'relay-A2-wire');
  const arm=add('relay-armature','衔铁与绝缘触点座','磁性衔铁绕左侧铰链向下转动，绝缘座携带独立的公共触点。',[0,.14,0]);
  const am=named(new THREE.Group(),'relay-armature-motion');am.position.set(-.40,.66,0);arm.add(am);
  box(am,[.53,.04,.14],[.245,0,0],M.steel);
  cylinder(am,.025,.20,[0,0,0],M.brass,'z');
  beam(am,[.49,0,0],[.80,0,0],.035,.07,M.insulator);
  named(sphere(am,.015,[.80,0,.10],M.silver),'relay-moving-contact');
  conductor(am,[[.49,.022,.10],[.80,0,.10]],.012,M.brass,'relay-common-blade');
  const springPart=add('relay-release-spring','复位弹簧','弹簧下端固定在底座，上端连接衔铁，衔铁下转时压缩。',[0,0,-.12]);
  const spring=coil(springPart,.025,1,9,[0,0,0],M.steel);
  const contacts=add('relay-contacts','转换触点','先断后合：行程中两个静触点均断开，端位时分别与公共触点接触。',[0,0,.14]);
  const finalX=-.4+.8*Math.cos(.22),finalY=.66-.8*Math.sin(.22);
  const nc=[.40,.69,.10],no=[finalX,finalY-.03,.10];
  named(sphere(contacts,.015,nc,M.silver),'relay-NC');named(sphere(contacts,.015,no,M.silver),'relay-NO');
  for(const [p,end] of [[nc,[.51,.20,.24]],[no,[.33,.20,.24]]]) {
    conductor(contacts,[p,[.55,p[1],.10],[.55,.22,.19],end],.009,M.brass);
    box(contacts,[.065,.08,.08],[.55,p[1]-.045,.10],M.insulator);
  }
  // Independent routes: the NC and NO supports must not share a vertical bus.
  contacts.children.filter(o=>o.userData.path).forEach((o,i)=>{if(i===0){const p=o.userData.path;p[1]=[.61,p[1][1],.10];p[2]=[.61,.22,.19];o.geometry.dispose();const q=new THREE.CurvePath();for(let k=1;k<p.length;k++)q.add(new THREE.LineCurve3(v3(p[k-1]),v3(p[k])));o.geometry=new THREE.TubeGeometry(q,64,.009,8,false);}});
  label(contacts,'NC',[.68,.70,.10],.055);label(contacts,'NO',[.65,.43,.10],.055);
  const terminal=add('relay-terminals','五个独立端子','A1/A2 驱动线圈，COM/NC/NO 构成独立的负载开关。',[0,-.02,.18]);
  for(const [x,text,color] of [[-.46,'A1',M.blue],[-.27,'A2',M.red],[.14,'COM',M.brass],[.33,'NO',M.brass],[.51,'NC',M.brass]]) {
    box(terminal,[.10,.05,.10],[x,.175,.24],M.insulator);cylinder(terminal,.023,.035,[x,.21,.24],color);label(terminal,text,[x,.27,.29],.045);
  }
  const common=conductor(terminal,[[.14,.21,.24],[.05,.36,.24],[.09,.682,.10]],.007,M.brass,'relay-common-flex');
  const cover=add('relay-cover','透明保护罩','透明罩保护机构，可隐藏以检查触点与磁隙。',[0,.25,0],true);
  // Thin walls, not a solid block through all the internals.
  for(const x of [-.57,.72])box(cover,[.008,.62,.47],[x,.48,0],material('#c4dfed',.05,.25,.12));
  box(cover,[1.30,.008,.47],[.075,.79,0],material('#c4dfed',.05,.25,.12));
  return {root,parts,update(t,inputs={}) {
    const s=relayPhysics(t,inputs);am.rotation.z=-s.angle;
    const bottom=v3([-.24,.28,0]),top=v3([.16,-.025,0]).applyAxisAngle(v3([0,0,1]),-s.angle).add(v3([-.4,.66,0]));
    spring.position.copy(bottom.clone().add(top).multiplyScalar(.5));spring.scale.y=top.distanceTo(bottom);spring.quaternion.setFromUnitVectors(v3([0,1,0]),top.clone().sub(bottom).normalize());
    const end=v3([.49,.022,.10]).applyAxisAngle(v3([0,0,1]),-s.angle).add(v3([-.4,.66,0]));
    const pts=[[.14,.21,.24],[.05,.36,.24],end.toArray()];const path=new THREE.CurvePath();for(let i=1;i<pts.length;i++)path.add(new THREE.LineCurve3(v3(pts[i-1]),v3(pts[i])));
    common.geometry.dispose();common.geometry=new THREE.TubeGeometry(path,64,.007,8,false);common.userData.path=pts;
    return s;
  }};
}

function buildGenerator() {
  const {root,parts,add}=moduleRoot();
  const base=add('generator-base','绝缘底座','底座支承磁轭与两端轴承。',[0,-.1,0]);
  box(base,[1.16,.10,.84],[0,.10,0],M.base);
  const yoke=add('generator-yoke','回磁轭','磁轭围住线圈扫掠空间，轴与引线从中央留孔穿过。',[0,0,-.12]);
  for(const x of [-.37,.37])box(yoke,[.10,.69,.40],[x,.79,0],M.iron);
  for(const x of [-.37,.37])box(yoke,[.10,.30,.18],[x,.30,0],M.darkSteel);
  for(const y of [.475,1.105])boredCrossbar(yoke,y);
  const poles=add('generator-poles','定子磁极','N 到 S 的横向磁场穿过转动线圈。',[.12,0,0]);
  for(const sign of [-1,1]) {
    box(poles,[.08,.47,.43],[sign*.29,.79,0],sign<0?M.blue:M.red);
    named(box(poles,[.02,.47,.43],[sign*.24,.79,0],M.steel),`generator-pole-${sign}`);
    label(poles,sign<0?'N':'S',[sign*.29,.80,.24],.09);
  }
  arrow(poles,[-.18,1.03,.23],[1,0,0],.36,0x4098bd);
  const bearings=add('generator-bearings','上下空心轴承','轴套位于绕组与滑环之外，各自留有真实轴孔。',[0,.1,0]);
  for(const y of [.22,1.16])annulus(bearings,.07,.028,.07,[0,y,0],M.brass,'y');
  for(const x of [-.06,.06])box(bearings,[.025,.07,.09],[x,.18,0],M.darkSteel);
  for(const x of [-.12,.12])beam(bearings,[x,1.105,0],[Math.sign(x)*.055,1.16,0],.025,.025,M.darkSteel);
  const rotor=add('generator-rotor','连续旋转线圈','线圈面积法线初始沿 +Z，绕 +Y 转动后磁通与 sinθ 成正比。',[0,0,-.12]);
  const rm=named(new THREE.Group(),'generator-rotor-motion');rm.position.y=.79;rotor.add(rm);
  cylinder(rm,.024,1.06,[0,-.02,0],M.steel,'y');
  box(rm,[.29,.37,.11],[0,0,.08],M.insulator);
  cylinder(rm,.04,.30,[0,0,0],M.insulator,'y');
  box(rm,[.22,.28,.08],[0,0,-.085],M.darkSteel);
  const pts=windingPoints(8,.16,.20,(x,y,z)=>[x,y,z]);
  conductor(rm,pts,.005,M.brightCopper,'generator-winding');
  conductor(rm,[pts[0],[.16,-.235,.04],[.033,-.27,0],[.033,-.49,0],[.095,-.49,0]],.006,M.red,'generator-start-lead');
  conductor(rm,[pts.at(-1),[.18,-.235,.06],[-.055,-.27,.06],[-.055,-.41,.06],[-.095,-.41,0]],.006,M.blue,'generator-end-lead');
  const rings=add('generator-slip-rings','绝缘滑环与固定电刷','两只连续铜环彼此绝缘，外圆接触固定碳刷，保留交变极性。',[0,0,.12]);
  const ringMotion=named(new THREE.Group(),'generator-ring-motion');ringMotion.position.y=.79;rings.add(ringMotion);
  for(const [index,y] of [[0,-.49],[1,-.41]]) {
    cylinder(ringMotion,.041,.055,[0,y,0],M.insulator,'y');
    named(annulus(ringMotion,.095,.041,.036,[0,y,0],index?M.copper:M.brightCopper,'y'),`generator-ring-${index}`);
    named(box(rings,[.07,.025,.025],[.13,.79+y,0],M.darkSteel),`generator-brush-${index}`);
    box(rings,[.045,.05,.07],[.185,.79+y,0],M.insulator);
    box(rings,[.04,.79+y-.15,.06],[.19,(.79+y+.15)/2,0],M.insulator);
  }
  const crank=add('generator-crank','手摇柄','手柄位于上磁轭之上，旋转包络与固定框架分离。',[0,.15,0]);
  const cm=named(new THREE.Group(),'generator-crank-motion');cm.position.y=.79;crank.add(cm);
  beam(cm,[0,.49,0],[.30,.49,0],.035,.045,M.steel);
  cylinder(cm,.035,.12,[.30,.55,0],M.rubber,'y');
  const out=add('generator-output-circuit','负载与输出端子','两个电刷通过独立导线接到教学电阻，构成闭合负载回路。',[0,0,.15]);
  for(const [i,x] of [[0,.34],[1,.48]]) {
    cylinder(out,.022,.035,[x,.20,.24],i?M.blue:M.red);
    conductor(out,[[.165,.30+i*.08,0],[.24,.30+i*.08,.16],[x,.20,.24]],.008,i?M.blue:M.red);
  }
  box(out,[.09,.045,.06],[.41,.20,.24],M.paper);
  conductor(out,[[.34,.20,.24],[.365,.20,.24]],.005,M.copper);
  conductor(out,[[.455,.20,.24],[.48,.20,.24]],.005,M.copper);
  label(out,'10 Ω',[.41,.28,.28],.05);
  return {root,parts,update(t,inputs={}) {const s=generatorPhysics(t,inputs);rm.rotation.y=ringMotion.rotation.y=cm.rotation.y=s.phase;return s;}};
}
const motorStages = [
  { name: '正向电流', title: '接近零转矩位置', text: '轴向导线受磁场力，转矩沿正转方向；接近四分之一周时准备换向。' },
  { name: '首次换向', title: '线圈电流已反向', text: '越过四分之一周死点后电刷换片，电流反向，转矩继续同向。' },
  { name: '反向电流', title: '接近下一死点', text: '反向电流维持正转转矩；接近四分之三周时再次换向。' },
  { name: '再次换向', title: '恢复正向电流', text: '越过下一死点后电流再次反向。绝缘缝处暂时断电，由惯性带过。' },
];
const speakerStages = [
  { name: '向前增程', title: '正向电流增强', text: '电流为正且逐渐增大，音圈受向前的力，纸盆从中位向前运动。' },
  { name: '向前回程', title: '正向电流减弱', text: '电流仍为正但逐渐减小；纸盆仍在前侧，并向中位回程。' },
  { name: '向后增程', title: '反向电流增强', text: '电流反向并逐渐增大，音圈受向后的力，纸盆从中位向后运动。' },
  { name: '向后回程', title: '反向电流减弱', text: '电流仍为负但逐渐接近零；纸盆仍在后侧，并向中位回程。' },
];
const relayStages = [
  { name: '断电复位', title: '释放 · NC 闭合', text: '线圈无电流，释放弹簧使衔铁回位，公共动触点接通 NC。' },
  { name: '磁力建立', title: '励磁但尚未动作', text: '线圈建立磁场；磁力尚未克服初始弹簧力，NC 仍保持接通。' },
  { name: '衔铁行程', title: '衔铁转动 · 两端断开', text: '动触点离开 NC，尚未到达 NO；采用先断后合的转换行程。' },
  { name: '触点转换', title: '吸合 · NO 闭合', text: '衔铁到达吸合位置，公共动触点离开 NC 并接通 NO。' },
];
const generatorStages = [
  { name: '正磁通增大', title: '正磁通增大 · 电压为负', text: '转过零磁通位置后，Φ 开始增大并产生负电压；停转时磁通不再变化。' },
  { name: '正磁通减小', title: '正磁通减小 · 电压为正', text: '线圈磁通从正峰值减小，磁通变化率为负，感应电压为正。' },
  { name: '负磁通加深', title: '负磁通加深 · 电压为正', text: '线圈磁通越过零点后变得更负，磁通变化率仍为负，感应电压为正。' },
  { name: '负磁通减弱', title: '负磁通减弱 · 电压为负', text: '线圈磁通从负峰值回升，磁通变化率为正，感应电压为负。' },
];

export const devices = [
  {
    id: 'dc-motor', name: '直流电动机', category: 'electromagnetic',
    cutLabel:'剖切',flatViewDirection:[0,0,1],
    summary: '直流电流经电刷和换向器进入转子线圈，磁场力产生连续转矩。',
    principle: '磁场中的通电线圈受到力矩；分裂环换向器每半周反转线圈电流，使转矩方向保持一致。',
    notes: '几何是比例教学模型，并非某台电机的测绘复刻。转速读数采用直流电机稳态等效式：V=IR+Keω、τ=KtI、τload=bω；显示电流和反电动势由同一稳态解得出。线圈旋转动画按计算转速的 22% 播放以便看清换向，读数仍为模型转速。R、Ke、Kt、b 是平均课堂等效参数，不代表产品实测规格。单线圈瞬时转矩并不恒定，绝缘缝处暂时为零；以惯性近似维持匀速，不能从任意死点自启动。线圈平面平行 Z 轴，偏置绕组与配重避开主轴；磁场沿 X，实际换向位置为 θ=π/2 与 3π/2。',
    sources: [
      { label: 'OpenStax University Physics 2, torque on a current loop and DC motor commutator', url: 'https://openstax.org/books/university-physics-volume-2/pages/11-5-force-and-torque-on-a-current-loop' },
    ],
    controls: [{ id: 'voltage', label: '电枢电压', min: 0, max: 6, step: .1, value: .5, unit: 'V' }],
    stages: motorStages,
    build: buildDcMotor,
    phaseRate: inputs => motorPhysics(0, inputs).omega * .22,
    readout(t, inputs = {}) {
      const s = motorPhysics(t, inputs);
      const phase = ((s.phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const phaseIndex = Math.floor(phase / (Math.PI / 2));
      return {
        phaseIndex,
        title: s.voltage === 0 ? '未通电' : motorStages[phaseIndex].title,
        text: s.voltage === 0 ? '电枢无输入电压，转子处于静止状态。' : motorStages[phaseIndex].text,
        values: [
          { label: '稳态转速', value: Math.round(s.rpm), unit: 'rpm' },
          { label: '电枢电流', value: s.current.toFixed(2), unit: 'A' },
          { label: '反电动势', value: s.backEmf.toFixed(2), unit: 'V' },
        ],
      };
    },
  },
  {
    id: 'speaker', name: '动圈扬声器', category: 'electromagnetic',
    summary: '音频电流驱动音圈在磁隙中往复运动，纸盆推动空气形成声波。',
    principle: '磁隙中的音圈受洛伦兹力 F=BLI；音圈与纸盆相连，弹波和悬边约束轴向运动。',
    notes: '模型展示常见圆锥动圈单元，篮架、磁路、音圈、纸盆、悬边、弹波和引线均有分件。信号幅度为归一化教学输入，纸盆行程被放大为可见的 ±24 mm；演示频率范围远低于音频频带，以便直接观察往复运动。位移采用刚度控制的准静态示意 x=24 mm·level·sin(2πft)，相当于弹性回复力近似平衡电磁驱动力；并非把电磁力直接当成加速度。未计算质量、阻尼或相位滞后，不代表实际扬声器行程或频响。几何是示意比例而非具体产品。',
    sources: [
      { label: 'Eminence Speaker, How Speakers Work', url: 'https://eminence.com/pages/how-speakers-work' },
      { label: 'OpenStax University Physics 1, sound waves from an oscillating speaker cone', url: 'https://openstax.org/books/university-physics-volume-1/pages/17-1-sound-waves' },
    ],
    controls: [
      { id: 'level', label: '信号幅度', min: 0, max: 1, step: .01, value: .65, unit: '相对值' },
      { id: 'frequency', label: '演示频率', min: .25, max: 3, step: .05, value: 1.5, unit: 'Hz' },
    ],
    stages: speakerStages,
    build: buildSpeaker,
    phaseRate: inputs => 2 * Math.PI * speakerPhysics(0, inputs).frequency,
    readout(t, inputs = {}) {
      const s = speakerPhysics(t, inputs);
      const cycle = ((s.phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const phaseIndex = Math.floor(cycle / (Math.PI / 2));
      return {
        phaseIndex,
        title: s.level === 0 ? '静音 · 纸盆静止' : speakerStages[phaseIndex].title,
        text: s.level === 0 ? '信号幅度为零，音圈中无驱动电流，纸盆停在中位。' : speakerStages[phaseIndex].text,
        values: [
          { label: '线圈电流', value: s.relativeCurrent.toFixed(2), unit: '相对值' },
          { label: '纸盆位移', value: (s.excursion * 1000).toFixed(1), unit: 'mm' },
          { label: '演示频率', value: s.frequency.toFixed(2), unit: 'Hz' },
        ],
      };
    },
  },
  {
    id: 'relay', name: '电磁继电器', category: 'electromagnetic',
    summary: '较小的线圈电流磁化铁芯并吸合衔铁，以机械触点切换另一电路。',
    principle: '线圈电流建立磁通；铁芯吸引衔铁克服释放弹簧，动触点由常闭端转向常开端。',
    notes: '采用单线圈、铰链衔铁、弹簧复位的教学用转换触点结构。线圈电流仅作为归一化演示输入，吸力比按 (I/Ipull-in)^2 计算，并用静态角度映射与固定阈值近似吸合；行程中 NC 与 NO 均断开，未模拟真实继电器的突跳和释放滞回；不模拟磁路饱和、线圈电感、触点弹跳或具体继电器的时序参数。衔铁行程、接点间距和几何均是示意值，不是产品规格。',
    sources: [
      { label: 'OMRON, General-purpose Relays: structure and operating principle', url: 'https://www.ia.omron.com/support/guide/36/introduction.html' },
      { label: 'OMRON, Technical Explanation for General-purpose Relays', url: 'https://www.ia.omron.com/data_pdf/guide/36/generalrelay_tg_e_10_4.pdf' },
    ],
    controls: [{ id: 'coilCurrent', label: '线圈电流', min: 0, max: 1.2, step: .01, value: 0, unit: 'A（演示）' }],
    stages: relayStages,
    build: buildRelay,
    readout(t, inputs = {}) {
      const s = relayPhysics(t, inputs);
      const phaseIndex = s.closed ? 3 : s.current === 0 ? 0 : s.forceRatio <= .32 ? 1 : 2;
      return {
        phaseIndex,
        title: relayStages[phaseIndex].title,
        text: relayStages[phaseIndex].text,
        values: [
          { label: '吸力比', value: s.forceRatio.toFixed(2), unit: '相对阈值' },
          { label: '衔铁行程', value: (s.travel * 1000).toFixed(0), unit: 'mm' },
          { label: '输出触点', value: s.closed ? 'NO 闭合' : s.ncClosed ? 'NC 闭合' : '均断开', unit: '' },
        ],
      };
    },
  },
  {
    id: 'generator', name: '手摇交流发电机', category: 'electromagnetic',
    summary: '手柄带动线圈在磁场中转动，磁通变化产生交变电动势。',
    principle: '线圈磁通 Φ=N B A sinθ；依照法拉第定律 e=−dΦ/dt，匀速转动时输出正弦交流电。',
    notes: '可见绕组是少匝示意线圈，读数模型采用 N=80、B=0.20 T、A=0.012 m² 的教学等效参数，二者并不尝试一一对应。读数按 θ=ωt、Epeak=N B Aω、e=−Epeak cosθ、Vrms=Epeak/√2 计算；另以 10 Ω 纯电阻负载示范 I=e/R。参数不是某台发电机的实测规格，忽略线圈电阻、电感、磁场非均匀和机械损耗。手柄转速动画与电压相位使用同一个角度，没有时间缩放。',
    sources: [
      { label: 'OpenStax College Physics 2e, electric generators', url: 'https://openstax.org/books/college-physics-2e/pages/23-5-electric-generators' },
      { label: 'OpenStax University Physics Volume 2, electric generators and back EMF', url: 'https://openstax.org/books/university-physics-volume-2/pages/13-6-electric-generators-and-back-emf' },
      { label: 'OpenStax University Physics 2, Faraday’s law', url: 'https://openstax.org/books/university-physics-volume-2/pages/13-1-faradays-law' },
    ],
    controls: [{ id: 'rpm', label: '手柄转速', min: 0, max: 120, step: 1, value: 60, unit: 'rpm' }],
    stages: generatorStages,
    build: buildGenerator,
    phaseRate: inputs => generatorPhysics(0, inputs).omega,
    readout(t, inputs = {}) {
      const s = generatorPhysics(t, inputs);
      const phase = ((s.phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const phaseIndex = Math.floor(phase / (Math.PI / 2));
      return {
        phaseIndex,
        title: s.rpm === 0 ? '线圈静止 · 无感应电压' : generatorStages[phaseIndex].title,
        text: s.rpm === 0 ? '线圈没有转动，磁通不变，因此没有感应电压。' : generatorStages[phaseIndex].text,
        values: [
          { label: '瞬时电压', value: s.emf.toFixed(2), unit: 'V' },
          { label: '有效值', value: s.rms.toFixed(2), unit: 'V' },
          { label: '负载电流', value: s.current.toFixed(2), unit: 'A' },
        ],
      };
    },
  },
];

export { motorPhysics, speakerPhysics, relayPhysics, generatorPhysics };
