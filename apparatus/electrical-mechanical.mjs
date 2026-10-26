import { THREE, material, box, cylinder, sphere, torus, pipe, coil, label, assembly } from './kit.mjs';
import {createHobSection} from './hob-section.mjs';
import {electroscopeVisual,electroscopeElectronFlow} from './electroscope-motion.mjs';

const clamp = (value, min, max) => {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
};
const number = (inputs, key, fallback, min, max) => clamp(inputs?.[key] ?? fallback, min, max);
const choice = (inputs, key, allowed, fallback) => allowed.includes(inputs?.[key]) ? inputs[key] : fallback;
const fixed = (value, digits = 2) => Number(value).toFixed(digits);
const value = (label, value, unit = '') => ({ label, value: String(value), unit });
const addMesh = (parent, geometry, mat, position = [0, 0, 0]) => {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};
const pathTube = (parent, points, radius, mat) => pipe(parent, points, radius, mat);
const makeCurveTube = (points, radius, mat, segments = 220) => {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), false, 'centripetal');
  const mesh = addMesh(new THREE.Group(), new THREE.TubeGeometry(curve, segments, radius, 10, false), mat);
  mesh.userData.nonPickable = true;
  return mesh;
};
const setTubePoints = (mesh, points, radius, segments = 220) => {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), false, 'centripetal');
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 10, false);
  mesh.geometry.dispose();
  mesh.geometry = geometry;
};
const bolt = (parent, pos, radius = .012, height = .008, mat = material('#657587', .78, .25), axis = 'y') =>
  cylinder(parent, radius, height, pos, mat, axis);

function hobReadout(_t, inputs = {}) {
  const power = number(inputs, 'power', 65, 0, 100);
  const pan = choice(inputs, 'pan', ['steel', 'none'], 'steel');
  const active = power > 0 && pan === 'steel';
  const current = active ? (power < 35 ? '较弱' : power < 70 ? '中等' : '较强') : '无可见锅底涡流';
  return {
    phaseIndex: active ? (power < 35 ? 0 : power < 70 ? 1 : 2) : 0,
    title: active ? '锅底出现感应电流' : pan === 'none' ? '没有合适锅具' : '线圈未通电',
    text: active
      ? '线圈中的交变电流产生变化磁场；磁场穿过玻璃，在适用锅具的底部形成涡流。锅底电阻使电能转为内能。'
      : pan === 'none'
        ? '无锅检测使逆变驱动停止；放回适用锅具后才恢复加热。'
        : '没有驱动电流，就没有变化磁场，也没有由此产生的锅底涡流。',
    values: [
      value('驱动设定', `${Math.round(power)}%`),
      value('锅底涡流（定性）', current),
      value('主要发热处', active ? '锅底为主' : '未显示'),
    ],
  };
}

function buildHob() {
  const root = new THREE.Group();
  const parts = [];
  const graphite = material('#263341', .38, .30);
  const darkSteel = material('#526171', .78, .26);
  const ceramic = material('#101c2b', .18, .16);
  const copper = material('#c97a42', .82, .25);
  const ferrite = material('#302f39', .18, .52);
  const polymer = material('#334f6c', .06, .35);
  const brass = material('#c39a4f', .78, .24);

  const shell = assembly(root, 'chassis', '金属底壳与支脚', '支撑玻璃面板、线圈和功率部件的薄钢底盘。', [0, -.22, 0], true);
  parts.push(shell);
  box(shell.object,[1.08,.025,1.14],[0,.015,-.14],graphite);
  for(const x of [-.53,.53]) box(shell.object,[.02,.13,1.14],[x,.085,-.14],graphite);
  for(const z of [-.70,.42]) box(shell.object,[1.08,.13,.02],[0,.085,z],graphite);
  for (const x of [-.43, .43]) for (const z of [-.33, .33]) {
    box(shell.object, [.15, .045, .13], [x, .012, z], polymer);
    bolt(shell.object, [Math.sign(x) * .47, .14, Math.sign(z) * .37], .014, .018, darkSteel);
  }
  for (let i = 0; i < 11; i++) box(shell.object, [.035, .012, .10], [-.46 + i * .092, .08, -.64], darkSteel);

  const glass = assembly(root, 'glass', '微晶玻璃面板', '线圈上方的耐热面板；磁场可穿过玻璃作用于锅底。', [0, .12, 0], true);
  parts.push(glass);
  box(glass.object, [1.02, .045, 1.10], [0, .185, -.14], ceramic);
  torus(glass.object, .335, .006, [0, .211, 0], material('#6c8da9', .35, .3), [Math.PI / 2, 0, 0]);
  torus(glass.object, .305, .003, [0, .211, 0], material('#2d4054', .2, .4), [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    box(glass.object, [.045, .003, .008], [.322 * Math.cos(angle), .212, .322 * Math.sin(angle)], material('#91a2b2', .3, .36), [0, -angle, 0]);
  }

  const coilPart = assembly(root, 'induction-coil', '扁平铜线圈', '锅底正下方的工作线圈；示意用螺旋线表现多匝绕组。', [0, -.12, 0]);
  parts.push(coilPart);
  const spiral = [];
  const turns = 13;
  for (let i = 0; i <= turns * 48; i++) {
    const u = i / (turns * 48), angle = u * turns * Math.PI * 2, radius = .035 + .30 * u;
    spiral.push([radius * Math.cos(angle), .13, radius * Math.sin(angle)]);
  }
  cylinder(coilPart.object,.35,.014,[0,.114,0],material('#a8a395',.02,.7));
  pathTube(coilPart.object, spiral, .009, copper);

  const ferritePart = assembly(root, 'ferrite-core', '铁氧体磁芯条', '在线圈背面引导磁通，减少磁场向机壳下方扩散。', [0, -.20, 0]);
  parts.push(ferritePart);
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI * 2 / 10;
    box(ferritePart.object, [.31, .026, .045], [.18*Math.cos(angle), .094, -.18*Math.sin(angle)], ferrite, [0, angle, 0]);
  }

  const panPart = assembly(root, 'cookware', '适用锅具与锅底涡流', '铁磁性锅底承载感应涡流；涡流在锅底电阻中产生焦耳热。', [0, .27, 0], true);
  parts.push(panPart);
  const panInner = new THREE.Group(); panPart.object.add(panInner);
  cylinder(panInner, .31, .045, [0, .23, 0], darkSteel);
  // An open-sided pan lets the teaching view show its interior instead of a
  // solid cylinder cap. The separate bottom disk remains the cookware floor.
  addMesh(panInner, new THREE.CylinderGeometry(.275, .31, .32, 48, 1, true), material('#7c8b97', .82, .24), [0, .4125, 0]);
  const panRim=torus(panInner, .275, .012, [0, .577, 0], material('#b3bdc4', .85, .2),[Math.PI/2,0,0]); panRim.name='horizontal-pan-rim';
  cylinder(panInner, .286, .025, [0, .249, 0], material('#a0a9ae', .85, .24));
  box(panInner, [.27, .045, .055], [.38, .50, 0], darkSteel, [0, 0, -.12]);
  box(panInner, [.34, .075, .078], [.64, .52, 0], polymer, [0, 0, -.12]);
  for (let i = 0; i < 3; i++) box(panInner, [.02, .04, .045], [.40 + i * .08, .50, 0], brass, [0, 0, -.12]);
  const eddyPart = assembly(root, 'eddy-currents', '锅底环形涡流示意', '橙色闭合环只表示涡流路径，不代表精确流线或数值电流。', [0, .04, 0]);
  eddyPart.object.userData.connection=true; parts.push(eddyPart);
  const eddyMat = material('#e58a4d', .25, .28);
  eddyMat.emissive.set('#8b3717');
  // The loops sit on the pan floor surface, so they remain visible in the
  // open cookware while still representing currents in the bottom sheet.
  for (const radius of [.11, .19, .26]) torus(eddyPart.object, radius, .004, [0, .265, 0], eddyMat, [Math.PI / 2, 0, 0]);
  const fieldPart=assembly(root,'magnetic-field','交变磁通与回路','磁通从线圈内区穿过锅底，并从线圈外侧返回；闭合路径位于径向竖直平面。',[0,0,0]);
  fieldPart.object.userData.connection=true; parts.push(fieldPart);
  const fieldMat=material('#6fc8e9',.08,.36); fieldMat.emissive.set('#1b6c91');
  for(const angle of [0,Math.PI/2,Math.PI,3*Math.PI/2]) {
    const radial=[[.07,-.04],[.07,.13],[.08,.29],[.17,.60],[.35,.59],[.46,.33],[.47,.13],[.39,-.06],[.23,-.12]];
    const curve=new THREE.CatmullRomCurve3(radial.map(([r,y])=>new THREE.Vector3(r*Math.cos(angle),y,r*Math.sin(angle))),true,'centripetal');
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,180,.003,8,true),fieldMat); mesh.name='closed-flux-loop';mesh.userData.nonPickable=true;fieldPart.object.add(mesh);
  }

  const board = assembly(root, 'inverter', '高频逆变与功率板', '功率电子把输入电能变为高频线圈电流；元件细节为教学示意。', [.25, -.12, -.04]);
  parts.push(board);
  const boardMount=new THREE.Group(); board.object.add(boardMount); boardMount.position.set(0,0,-.28);
  box(boardMount, [.49, .025, .28], [.22, .05, -.22], material('#245c53', .08, .56));
  box(boardMount, [.30, .07, .045], [.25, .09, -.27], darkSteel);
  for (let i = 0; i < 8; i++) box(boardMount, [.018, .08, .025], [.12 + i * .037, .105, -.27], material('#768492', .75, .3));
  for (let i = 0; i < 3; i++) cylinder(boardMount, .038, .082, [.06 + i * .12, .1035, -.12], material('#263f54', .24, .28));
  for (let i = 0; i < 7; i++) box(boardMount, [.04, .018, .03], [.06 + (i % 4) * .105, .072, -.24 + Math.floor(i / 4) * .08], brass);
  for (const x of [.02, .42]) for (const z of [-.32, -.12]) cylinder(boardMount, .012, .05, [x, .045, z], material('#97a4ad', .76, .3));

  const fan = assembly(root, 'cooling-fan', '散热风扇与风道', '风扇帮助功率器件和机内空气散热；此处仅画出结构。', [-.33, -.13, -.18]);
  parts.push(fan);
  const fanMount=new THREE.Group(); fan.object.add(fanMount); fanMount.position.set(0,.025,-.28);
  cylinder(fanMount, .13, .035, [-.32, .028, -.22], darkSteel);
  const rotor = new THREE.Group(); rotor.position.set(-.32, .05, -.22); fanMount.add(rotor);
  cylinder(rotor, .022, .04, [0, 0, 0], brass);
  for (let i = 0; i < 7; i++) box(rotor, [.12, .012, .035], [.055, 0, 0], material('#8195a8', .55, .34), [0, i * Math.PI * 2 / 7, .12]);
  for (let i = 0; i < 6; i++) box(fanMount, [.025, .008, .19], [-.44 + i * .046, .13, -.22], darkSteel);

  const controls = assembly(root, 'controls', '前沿控制与指示', '旋钮和指示窗表示功率档位控制，不模拟特定产品面板。', [0, -.01, .42]);
  parts.push(controls);
  box(controls.object, [.56, .10, .13], [.18, .13, .39], graphite);
  box(controls.object, [.14, .035, .012], [.18, .16, .461], material('#72c1d4', .08, .25));
  cylinder(controls.object, .045, .025, [.38, .19, .42], brass);
  cylinder(controls.object, .012, .03, [.38, .215, .42], darkSteel);
  for (let i = 0; i < 3; i++) sphere(controls.object, .012, [.04 + i * .05, .17, .46], material(i === 2 ? '#e59b55' : '#62aeba', .1, .25));

  const mains = assembly(root, 'power-leads', '电源线与线圈引线', '把逆变板、工作线圈和供电接口连接起来。', [.3, -.04, -.38]);
  mains.object.userData.connection = true;
  parts.push(mains);
  pathTube(mains.object, [[.035,.13,0],[.035,.06,0],[.035,.055,-.47],[.10,.055,-.47]],.008,copper);
  pathTube(mains.object, [[.335,.13,0],[.36,.12,-.08],[.38,.06,-.32],[.32,.055,-.47]],.008,copper);
  pathTube(mains.object, [[-.53, .085, -.22], [-.60, .06, -.22], [-.60, .02, -.34]], .018, polymer);
  box(mains.object, [.08, .08, .08], [-.60, .02, -.35], graphite);

  const section=createHobSection(parts,spiral);
  const machine = { root, parts, setView:section.setView, update(t, inputs = {}) {
    const state = hobReadout(t, inputs);
    const power = number(inputs, 'power', 65, 0, 100) / 100;
    const pan = choice(inputs, 'pan', ['steel', 'none'], 'steel');
    panPart.object.visible = panPart.object.userData.modelVisible = pan === 'steel';
    eddyPart.object.visible = eddyPart.object.userData.modelVisible = pan === 'steel' && power > 0;
    fieldPart.object.visible = fieldPart.object.userData.modelVisible = power > 0 && pan === 'steel';
    section.update(Number(t)||0,power,power>0&&pan==='steel');
    const pulse = .75 + .25 * Math.sin(2 * Math.PI * .35 * Math.max(0, Number(t) || 0));
    eddyMat.emissiveIntensity = power * pulse;
    fieldMat.emissiveIntensity = power * pulse;
    rotor.rotation.y = power>0 && pan==='steel' ? (Number(t)||0)*.65 : 0;
    return state;
  } };
  machine.update(0, {});
  return machine;
}

const ELECTROSCOPE_ACTIONS = ['neutral', 'near', 'move-away', 'contact', 'contact-away', 'discharge', 'grounded', 'isolated', 'induction-done'];
const ROD_SIGNS = ['positive', 'negative'];
function electroscopeState(inputs = {}) {
  const action = choice(inputs, 'operation', ELECTROSCOPE_ACTIONS, 'near');
  const sign = choice(inputs, 'rodSign', ROD_SIGNS, 'positive');
  const opposite = sign === 'positive' ? 'negative' : 'positive';
  const near = ['near', 'contact', 'grounded', 'isolated'].includes(action);
  const contact = action === 'contact';
  const grounding = action === 'grounded' || action === 'discharge';
  const isolated = action === 'isolated';
  const finished = action === 'induction-done';
  const rodAway = action === 'neutral' || action === 'move-away' || action === 'contact-away' || action === 'discharge' || finished;
  let netCharge = '中性，净电荷为零', distribution = '无明显电荷分离', angle = 0;
  let bodySign = null, leafSign = null;
  if (action === 'near') {
    netCharge = '中性，净电荷为零';
    distribution = '靠近带电棒后极化；箔片同号而分开';
    bodySign = opposite; leafSign = sign; angle = .11;
  } else if (contact || action === 'contact-away') {
    netCharge = `带${sign === 'positive' ? '正' : '负'}电`;
    distribution = '接触传递电荷；箔片带同号电荷';
    bodySign = sign; leafSign = sign; angle = .19;
  } else if (action === 'grounded') {
    netCharge = '与大地相连，电荷仍可流动';
    distribution = '带电棒仍靠近；电子经地线进出';
    bodySign = opposite; leafSign = null; angle = 0;
  } else if (isolated || finished) {
    netCharge = `带${opposite === 'positive' ? '正' : '负'}电`;
    distribution = isolated ? '已断开地线，带电棒仍在附近' : '带电棒移开后，异号净电荷留在验电器上';
    bodySign = opposite; leafSign = finished ? opposite : null; angle = finished ? .20 : 0;
  }
  const polarity=sign==='positive'?1:-1;
  const leafCharge=leafSign ? (leafSign==='positive'?1:-1)*(action==='near'?3:2) : 0;
  const totalCharge=(contact || action==='contact-away') ? 6*polarity : ['grounded','isolated','induction-done'].includes(action) ? -6*polarity : 0;
  const bodyCharge=totalCharge-2*leafCharge;
  const rodChargeDelta=(contact || action==='contact-away')?-totalCharge:0;
  const earthChargeDelta=['grounded','isolated','induction-done'].includes(action)?-totalCharge:0;
  return { action, sign, opposite, near, contact, grounding, isolated, finished, rodAway, netCharge, distribution, bodySign, leafSign, angle, totalCharge, bodyCharge, leafCharge, rodChargeDelta, earthChargeDelta };
}
function electroscopeReadout(_t, inputs = {}) {
  const state = electroscopeState(inputs);
  const title = state.action === 'contact-away' ? '接触后移开，净电荷保留' : state.action === 'discharge' ? '外棒移远后接地放电' : state.action === 'near' ? '靠近会极化，不会转移净电荷'
    : state.action === 'move-away' ? '移开后，极化消失'
      : state.action === 'contact' ? '接触后，电荷发生转移'
        : state.action === 'grounded' ? '接地时，电荷可经大地流动'
          : state.action === 'isolated' ? '先断开地线，异号电荷被留下'
            : state.action === 'induction-done' ? '带电棒移开，异号净电荷仍在'
              : '未带电的验电器';
  const actionText = state.action === 'contact-away' ? '接触充电后移开带电棒，验电器与外界绝缘，同号净电荷保留，箔片仍张开。' : state.action === 'discharge' ? '将外棒移远并明确接地，原有净电荷经大地交换而消失，箔片合拢。' : state.action === 'near'
    ? '带电棒靠近金属球但不接触。金属中的电子重新分布，箔片带同号电荷而张开；整个验电器净电荷仍为零。'
    : state.action === 'move-away'
      ? '假设验电器起初中性，带电棒只曾靠近而没有接触或接地；棒移远后，电荷分布恢复，箔片合拢。'
      : state.action === 'contact'
        ? '带电棒直接接触金属球，电子转移使验电器获得与棒同号的净电荷。箔片因同号相斥而张开。'
        : state.action === 'grounded'
          ? '带电棒停在球旁并接上地线，电子可由大地流入或流出，箔片合拢。此时地线仍连接，尚不能说电荷已被孤立保存。'
          : state.action === 'isolated'
            ? '先让带电棒靠近，再接地；保持带电棒靠近时先断开地线。此时验电器留下与带电棒异号的净电荷，主要集中在靠近外棒的球端，箔片近似合拢。'
            : state.action === 'induction-done'
              ? '完整感应充电的最后一步：断开地线后再移开带电棒，验电器保留与带电棒异号的净电荷，箔片重新张开，全程没有接触带电棒。'
              : '验电器中性，金属箔片在重力作用下自然下垂。';
  return {
    phaseIndex: state.action === 'contact' ? 1 : state.action === 'grounded' ? 2 : state.action === 'isolated' ? 3 : state.action === 'induction-done' ? 4 : 0,
    title, text: actionText,
    values: [
      value('外棒状态', state.contact ? '接触' : state.rodAway ? '已移远' : '靠近但未接触'),
      value('验电器状态', state.netCharge),
      value('箔片', state.angle ? '张开（示意）' : '合拢'),
      value('地线', state.grounding ? '连接中' : '断开'),
    ],
  };
}

function buildElectroscope() {
  const root = new THREE.Group(), parts = [];
  const wood = material('#49617a', .12, .38);
  const brass = material('#c79643', .82, .22);
  const stemMetal = material('#aab7c0', .88, .2);
  const caseGlass = material('#a9c8d7', .05, .16, .16);
  caseGlass.forceSinglePass=true;
  const caseEdge = material('#58748a', .52, .32);
  const foil = material('#d7b45a', .82, .19);
  const insulation = material('#eee4cb', .05, .35);
  // Shared camera-facing sphere impostors keep polarity readable at every angle.
  // Textures are created once; no canvas allocation or text drawing per frame.
  const chargeMaterials=[1,-1].map(sign=>{
    const size=64,data=new Uint8Array(size*size*4),color=sign>0?[218,67,64]:[20,114,219];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=(x+.5-size/2)/(size/2),v=(y+.5-size/2)/(size/2),r=Math.hypot(u,v),i=(y*size+x)*4;
      const glyph=(Math.abs(u)<.49&&Math.abs(v)<.095)||(sign>0&&Math.abs(v)<.49&&Math.abs(u)<.095);
      const light=.79+.21*Math.sqrt(Math.max(0,1-r*r))+.17*Math.exp(-((u+.32)**2+(v+.38)**2)/.10);
      for(let c=0;c<3;c++)data[i+c]=glyph?255:Math.min(255,color[c]*light);
      data[i+3]=Math.round(255*Math.max(0,Math.min(1,(1-r)*size/2)));
    }
    const map=new THREE.DataTexture(data,size,size);map.colorSpace=THREE.SRGBColorSpace;map.needsUpdate=true;
    map.magFilter=map.minFilter=THREE.LinearFilter;
    return new THREE.SpriteMaterial({map,depthTest:true,depthWrite:false,toneMapped:false});
  });
  const chargeMarker=(parent,sign,pos,radius=.011)=>{
    const group=new THREE.Group();group.position.set(...pos);group.userData.chargeSign=sign;group.userData.nonPickable=true;
    const sprite=new THREE.Sprite(chargeMaterials[sign>0?0:1]);sprite.scale.set(radius*2,radius*2,1);sprite.userData.nonPickable=true;
    group.add(sprite);parent.add(group);return group;
  };

  const base = assembly(root, 'base', '绝缘底座', '支承玻璃盒并与验电器金属部分绝缘。', [0, -.2, 0]); parts.push(base);
  cylinder(base.object, .32, .09, [0, .045, 0], wood);
  torus(base.object, .28, .012, [0, .09, 0], brass, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) cylinder(base.object, .05, .025, [-.19 + i * .19, .012, .20], material('#293746', .05, .64));
  box(base.object, [.18, .035, .04], [0, .103, -.16], insulation);

  const casePart = assembly(root, 'glass-case', '玻璃防风盒', '玻璃盒挡风，减小箔片受气流扰动。', [0, 0, -.2], true); parts.push(casePart);
  box(casePart.object, [.58, .52, .018], [0, .39, -.14], caseGlass);
  box(casePart.object, [.58, .52, .018], [0, .39, .14], caseGlass);
  for (const x of [-.29, .29]) box(casePart.object, [.018, .52, .28], [x, .39, 0], caseGlass);
  for(const x of [-.1775,.1775]) box(casePart.object,[.245,.025,.30],[x,.65,0],caseEdge);
  for(const z of [-.1025,.1025]) box(casePart.object,[.11,.025,.095],[0,.65,z],caseEdge);
  for (const x of [-.29, .29]) for (const z of [-.13, .13]) cylinder(casePart.object, .018, .018, [x, .64, z], brass, 'y');

  const cap = assembly(root, 'terminal', '金属接线球', '外部带电棒靠近或接触的金属球形端子。', [0, .22, .04]); parts.push(cap);
  cylinder(cap.object, .07, .025, [0, .68, 0], brass);
  cylinder(cap.object, .035, .075, [0, .725, 0], stemMetal);
  sphere(cap.object, .072, [0, .79, 0], brass);
  torus(cap.object, .067, .007, [0, .79, 0], material('#f1d081', .78, .2));
  for (let i = 0; i < 6; i++) bolt(cap.object, [.048 * Math.cos(i * Math.PI / 3), .676, .048 * Math.sin(i * Math.PI / 3)], .006, .008, stemMetal);

  const stem = assembly(root, 'conductor', '金属杆与绝缘塞', '金属杆把接线球和两片箔连成一个导体；绝缘塞隔开玻璃盒。', [0, .02, 0]); parts.push(stem);
  cylinder(stem.object, .013, .33, [0, .57, 0], stemMetal);
  cylinder(stem.object, .054, .045, [0, .67, 0], insulation);
  cylinder(stem.object, .026, .025, [0, .685, 0], stemMetal);
  for (const y of [.48,.56]) torus(stem.object,.016,.003,[0,y,0],brass,[Math.PI/2,0,0]);

  const leavesPart = assembly(root, 'gold-leaves', '两片金属箔', '轻薄箔片悬挂在同一金属杆上；带同号电荷时相互排斥。', [0, -.04, 0]); parts.push(leavesPart);
  const hinge = new THREE.Group(); hinge.position.set(0, .405, 0); leavesPart.object.add(hinge);
  const leftLeaf = new THREE.Group(), rightLeaf = new THREE.Group(); hinge.add(leftLeaf, rightLeaf);
  box(leftLeaf, [.012, .235, .002], [-.006, -.1175, 0], foil);
  box(rightLeaf, [.012, .235, .002], [.006, -.1175, 0], foil);
  cylinder(hinge, .025, .026, [0, 0, 0], brass, 'z');
  for (let i = 0; i < 3; i++) box(leavesPart.object, [.035 + i * .012, .003, .006], [-.16 + i * .018, .20, -.09], material('#c9d4db', .35, .36));

  const scalePart = assembly(root, 'scale', '箔片张角刻度', '刻线只帮助比较张角，不对应可测电荷量。', [.32, 0, .04]); parts.push(scalePart);
  box(scalePart.object, [.006, .32, .014], [.19, .37, -.04], caseEdge);
  for (let i = 0; i < 7; i++) box(scalePart.object, [.025 + (i % 2) * .014, .004, .012], [.19 + .008 * (i % 2), .22 + i * .05, -.028], material('#c5d2d9', .25, .42));

  const rod = assembly(root, 'test-rod', '外部带电棒', '移动的棒保持不接触，或按操作选择接触金属球。', [-.33, .04, .12]); parts.push(rod);
  const rodMotion = new THREE.Group();rodMotion.name='electroscope-rod-motion'; rod.object.add(rodMotion);
  cylinder(rodMotion, .017, .40, [-.21, .79, 0], material('#d1a978', .12, .36), 'x');
  cylinder(rodMotion, .027, .07, [-.015, .79, 0], brass, 'x');
  const positiveTip = chargeMarker(rodMotion,1,[-.014,.79,.033],.018);
  const negativeTip = chargeMarker(rodMotion,-1,[-.014,.79,.033],.018);
  positiveTip.userData.nonPickable = negativeTip.userData.nonPickable = true;
  positiveTip.userData.hideWhenExploded = negativeTip.userData.hideWhenExploded = true;
  for (let i = 0; i < 4; i++) torus(rodMotion, .022, .003, [-.36 + i * .09, .79, 0], insulation, [0, Math.PI / 2, 0]);

  const ground = assembly(root, 'ground-wire', '可拆接地线', '感应充电时，在带电棒仍靠近的情况下先接地，再先断开地线。', [.34, -.15, -.1]);
  ground.object.userData.connection = true; parts.push(ground);
  pathTube(ground.object, [[.025, .73, 0], [.13, .66, -.12], [.23, .54, -.12], [.23, .13, -.12], [.32, .11, -.12], [.32,.055,-.12]], .009, material('#397b58', .25, .35));
  cylinder(ground.object, .016, .012, [.32, .10, -.12], brass, 'z');
  for (let i = 0; i < 3; i++) box(ground.object, [.13 - i * .04, .008, .008], [.32, .055 - i * .025, -.12], stemMetal);

  const bodyMarks = assembly(root, 'body-charge-markers', '金属杆电荷分布示意', '红蓝点表示电荷分布方向，不表示真实粒子数。', [0, 0, -.02]);
  bodyMarks.object.userData.nonPickable = true; parts.push(bodyMarks);
  bodyMarks.object.userData.hideWhenExploded=true;
  const bodyPositive = new THREE.Group(), bodyNegative = new THREE.Group(); bodyMarks.object.add(bodyPositive, bodyNegative);
  // Opposite pairs appear first so even a small charge spans the ball surface.
  // Both polarities use exactly the same positions, radius and units-to-markers ratio.
  const surfaceSites=[[-.037,.035,1],[.037,-.035,1],[.037,.035,1],[-.037,-.035,1],
    [0,.070,1],[0,-.070,1],[-.070,0,1],[.070,0,1],
    [-.037,.035,-1],[.037,-.035,-1],[.037,.035,-1],[-.037,-.035,-1]];
  for (const [x,y,side] of surfaceSites) {
    const pos=[x,.79+y,side*Math.sqrt(.083**2-x*x-y*y)];
    chargeMarker(bodyPositive,1,pos);chargeMarker(bodyNegative,-1,pos);
  }
  const leafPositiveL = new THREE.Group(), leafPositiveR = new THREE.Group(), leafNegativeL = new THREE.Group(), leafNegativeR = new THREE.Group();
  leftLeaf.add(leafPositiveL, leafNegativeL); rightLeaf.add(leafPositiveR, leafNegativeR);
  for(const g of [leafPositiveL,leafNegativeL,leafPositiveR,leafNegativeR])g.userData.hideWhenExploded=true;
  for (let i = 0; i < 6; i++) {
    for(const [positive,negative,x] of [[leafPositiveL,leafNegativeL,-.012],[leafPositiveR,leafNegativeR,.012]]){
      const pos=[x,-.05-.029*i,.015];
      chargeMarker(positive,1,pos);chargeMarker(negative,-1,pos);
    }
  }

  const electronFlow=new THREE.Group();electronFlow.name='electroscope-electron-flow';
  electronFlow.userData.nonPickable=true;electronFlow.userData.hideWhenExploded=true;
  bodyMarks.object.add(electronFlow);
  const electronPackets=[];
  for(const side of [-1,1])for(let i=0;i<6;i++){
    const dot=chargeMarker(electronFlow,-1,[0,0,0]);
    electronPackets.push({dot,side,index:i});
  }

  const lesson = { root, parts, update(_t, inputs = {}) {
    const state = electroscopeState(inputs);
    const visual=electroscopeVisual(inputs,electroscopeState);
    rodMotion.position.x = visual.rodX;
    positiveTip.visible = positiveTip.userData.modelVisible = state.sign === 'positive'; negativeTip.visible = negativeTip.userData.modelVisible = state.sign === 'negative';
    ground.object.visible = ground.object.userData.modelVisible = state.grounding;
    const charges=(g,amount)=>{g.visible=g.userData.modelVisible=amount>1e-6;g.children.forEach((m,i)=>{const portion=Math.max(0,Math.min(1,amount-i));m.visible=portion>1e-6;m.scale.setScalar(Math.cbrt(portion));});};
    charges(bodyPositive,2*Math.max(0,visual.bodyCharge));charges(bodyNegative,2*Math.max(0,-visual.bodyCharge));
    for(const g of [leafPositiveL,leafPositiveR])charges(g,2*Math.max(0,visual.leafCharge));
    for(const g of [leafNegativeL,leafNegativeR])charges(g,2*Math.max(0,-visual.leafCharge));
    const angle = visual.angle;
    leftLeaf.rotation.z = -angle;
    rightLeaf.rotation.z = angle;
    const flow=electroscopeElectronFlow(inputs,electroscopeState);
    electronFlow.visible=electronFlow.userData.modelVisible=flow.direction!==0;
    electronFlow.userData.direction=flow.direction;
    for(const {dot,side,index} of electronPackets){
      const travel=(flow.progress-index*.055)/.725;
      dot.visible=travel>0&&travel<1;
      const u=Math.max(0,Math.min(1,flow.direction>0?travel:1-travel));
      // Follow the conducting ball, rod and the currently rotated foil face.
      const distance=u*.59;
      if(distance<=.385){
        const y=.79-distance;
        dot.position.set(side*.009,y,y>.72?Math.sqrt(Math.max(0,.072**2-(y-.79)**2))+.012:.026);
      }else{
        const length=distance-.385;
        dot.position.set(side*(.009*Math.cos(angle)+length*Math.sin(angle)),.405+.009*Math.sin(angle)-length*Math.cos(angle),.016);
      }
      dot.scale.setScalar(Math.min(1,Math.max(0,travel)*12,Math.max(0,1-travel)*12));
    }
    return electroscopeReadout(_t, inputs);
  } };
  lesson.update(0, {});
  return lesson;
}

const RHEOSTAT_TOTAL_OHM = 12;
const RHEOSTAT_COIL_RADIUS_M = .095;
const RHEOSTAT_COIL_AXIAL_LENGTH_M = .78;
const RHEOSTAT_TURNS = 36;
const RHEOSTAT_HELIX_LENGTH_M = RHEOSTAT_TURNS * Math.hypot(2 * Math.PI * RHEOSTAT_COIL_RADIUS_M, RHEOSTAT_COIL_AXIAL_LENGTH_M / RHEOSTAT_TURNS);
const RHEOSTAT_TOTAL_WIRE_M = RHEOSTAT_HELIX_LENGTH_M;
function rheostatState(inputs = {}) {
  const position = Math.round(number(inputs, 'position', .5, 0, 1)*RHEOSTAT_TURNS)/RHEOSTAT_TURNS;
  const end = choice(inputs, 'end', ['A', 'B'], 'A');
  const voltage = number(inputs, 'voltage', 6, 0, 12);
  const load = 6;
  const wireFraction = end === 'A' ? position : 1 - position;
  const wireLength = RHEOSTAT_TOTAL_WIRE_M * wireFraction;
  const rheostatResistance = RHEOSTAT_TOTAL_OHM * wireFraction;
  const current = voltage / Math.max(.001, load + rheostatResistance);
  return { position, end, voltage, load, wireFraction, wireLength, rheostatResistance, current };
}
function rheostatReadout(_t, inputs = {}) {
  const state = rheostatState(inputs);
  return {
    phaseIndex: state.rheostatResistance < 4 ? 0 : state.rheostatResistance < 8 ? 1 : 2,
    title: '滑片到所选线圈端之间的电阻丝接入电路',
    text: `外电路接在绕组端 ${state.end} 和滑片端 C/D 之间；接入长度随滑片位置改变。线长、电阻和电流按均匀绕组的教学模型计算。`,
    values: [
      value('接入电阻丝长度', fixed(state.wireLength), 'm'),
      value('变阻器电阻', fixed(state.rheostatResistance), 'Ω'),
      value('串联回路电流', fixed(state.current, 3), 'A'),
      value('四个接线柱', `${state.end} 与 C/D`),
    ],
  };
}

function buildRheostat() {
  const root = new THREE.Group(), parts = [];
  const wood = material('#a57b4f', .08, .56);
  const ceramic = material('#e8deca', .05, .38);
  const nichrome = material('#9a6b45', .78, .27);
  const steel = material('#9daab4', .83, .23);
  const brass = material('#c89a4e', .82, .22);
  const cable = material('#34495d', .12, .38);

  const base = assembly(root, 'wood-base', '木质底座', '将瓷管、滑轨和四个接线柱固定在同一底板上。', [0, -.12, 0]); parts.push(base);
  box(base.object, [1.12, .075, .48], [0, .045, 0], wood);
  for (const x of [-.47, .47]) for (const z of [-.17, .17]) bolt(base.object, [x, .087, z], .014, .009, brass);
  box(base.object, [.50, .018, .06], [0, .091, .195], material('#c7b391', .04, .54));

  const tubePart = assembly(root, 'ceramic-tube', '瓷管与电阻丝', '电阻丝绕在绝缘瓷管上；所选绕组端至滑片的部分串入电路。', [0, .10, -.08]); parts.push(tubePart);
  cylinder(tubePart.object, .088, RHEOSTAT_COIL_AXIAL_LENGTH_M, [0, .34, 0], ceramic, 'x').name='rheostat-ceramic-core';
  for (const x of [-.405, .405]) torus(tubePart.object, .098, .011, [x, .34, 0], material('#c5b9a1', .08, .38), [0, Math.PI / 2, 0]);
  const windingPoints=[];
  for(let i=0;i<=RHEOSTAT_TURNS*48;i++){const u=i/(RHEOSTAT_TURNS*48),a=2*Math.PI*RHEOSTAT_TURNS*u; windingPoints.push([-.39+.78*u,.34+.095*Math.cos(a),.095*Math.sin(a)]);}
  const winding=pathTube(tubePart.object,windingPoints,.0067,nichrome); winding.name='resistance-winding';
  const activeWinding=pathTube(tubePart.object,windingPoints,.007,material('#ef8353',.3,.24)); activeWinding.name='active-winding';
  activeWinding.userData.hideWhenExploded=true;
  const activeTurnMarkers=[];
  for (const x of [-.39,.39]) pathTube(tubePart.object,[[x,.435,0],[x,.435,.19],[Math.sign(x)*.45,.193,.19]],.009,brass).userData.hideWhenExploded=true;

  const supports = assembly(root, 'porcelain-supports', '瓷质支架', '支架承托绕线瓷管和跨在其上方的金属导轨。', [0, .11, -.17]); parts.push(supports);
  for (const x of [-.45, .45]) {
    box(supports.object, [.09, .46, .25], [x, .29, 0], ceramic);
    box(supports.object, [.14, .045, .26], [x, .53, 0], brass);
    bolt(supports.object, [x, .555, -.075], .012, .012, steel);
    bolt(supports.object, [x, .555, .075], .012, .012, steel);
  }

  const rail = assembly(root, 'slider-rail', '滑片金属导轨', '导轨两端的 C、D 接线柱在模型中同属滑片电位。', [0, .22, 0]); parts.push(rail);
  cylinder(rail.object, .016, .91, [0, .52, 0], steel, 'x');
  for (const x of [-.46, .46]) {
    cylinder(rail.object, .025, .055, [x, .52, 0], brass, 'x');
    box(rail.object, [.025, .035, .045], [x, .47, -.12], brass);
  }
  for (let i = 0; i < 9; i++) torus(rail.object, .021, .003, [-.39 + i * .0975, .52, 0], material('#cad3d9', .72, .28), [0, Math.PI / 2, 0]);

  const wiper = assembly(root, 'wiper', '滑片与电刷', '滑片沿导轨移动，电刷与电阻丝接触；拖动可改变接入长度。', [0, .21, 0]);
  wiper.drag = { control: 'position', axis: 'x', scale: 1 };
  parts.push(wiper);
  const wiperMotion = new THREE.Group(); wiper.object.add(wiperMotion);
  box(wiperMotion, [.025, .045, .075], [0, .52, 0], steel);
  cylinder(wiperMotion, .022, .035, [0, .558, 0], brass);
  box(wiperMotion,[.018,.07,.018],[0,.475,0],brass);
  const shoe=box(wiperMotion,[.018,.012,.035],[0,.442,0],steel); shoe.name='contact-shoe';
  box(wiperMotion, [.055, .014, .075], [0, .58, 0], material('#788999', .82, .24));
  for (const x of [-.025, .025]) bolt(wiperMotion, [x, .588, 0], .006, .008, brass);

  const terminals = assembly(root, 'four-terminals', '四个接线柱 A、B、C、D', 'A/B 分别接电阻丝两端；C/D 通过金属导轨连到滑片。', [.42, .02, .12]); parts.push(terminals);
  const posts = [
    { id: 'A', x: -.45, z: .19, color: '#d96950' }, { id: 'B', x: .45, z: .19, color: '#4c8dc0' },
    { id: 'C', x: -.45, z: -.19, color: '#c49c55' }, { id: 'D', x: .45, z: -.19, color: '#6c9e85' },
  ];
  for (const post of posts) {
    box(terminals.object, [.105, .018, .095], [post.x, .10, post.z], material('#434f5a', .4, .32));
    cylinder(terminals.object, .036, .018, [post.x, .113, post.z], material(post.color, .12, .28));
    cylinder(terminals.object, .014, .068, [post.x, .154, post.z], brass);
    cylinder(terminals.object, .023, .018, [post.x, .193, post.z], steel);
    box(terminals.object, [.038, .008, .024], [post.x, .205, post.z], material('#e8e5dc', .03, .35));
    label(terminals.object, post.id, [post.x, .221, post.z + .002], .018, '#263b50');
  }
  const endpointLeads = assembly(root, 'terminal-links', '线圈端与滑轨引线', '铜连接片将绕组端接到 A/B，将导轨两端接到 C/D。', [.40, 0, -.2]);
  endpointLeads.object.userData.connection = true; parts.push(endpointLeads);


  pathTube(endpointLeads.object, [[-.46,.52,0],[-.52,.52,-.19],[-.52,.22,-.19],[-.45,.193,-.19]], .008, steel);
  pathTube(endpointLeads.object, [[.46,.52,0],[.52,.52,-.19],[.52,.22,-.19],[.45,.193,-.19]], .008, steel);

  const circuit = assembly(root, 'sample-circuit', '低压电源与串联负载', '用电池和固定负载形成示例串联回路；忽略连接线电阻。', [.12, -.04, .28]); parts.push(circuit);
  box(circuit.object, [.16, .09, .13], [-.18, .15, .31], material('#3b6684', .2, .34));
  for (const x of [-.22, -.14]) cylinder(circuit.object, .012, .045, [x, .205, .31], brass);
  box(circuit.object, [.15, .065, .08], [.15, .15, .31], material('#7c644f', .22, .42));
  cylinder(circuit.object, .018, .12, [.15, .15, .31], nichrome, 'x');
  for (const x of [.09,.21]) { cylinder(circuit.object,.008,.05,[x,.175,.31],brass); bolt(circuit.object,[x,.19,.31],.008,.01,brass); }
  const sourceToLoad = pathTube(circuit.object, [[-.22, .205, .31], [-.16, .23, .36], [-.02, .23, .36], [.05, .19, .31], [.09, .19, .31]], .009, material('#d75b4d', .1, .4));
  const loadToA = pathTube(circuit.object, [[.21, .19, .31], [.28, .19, .40], [-.28, .19, .40], [-.42, .16, .30], [-.45, .12, .19]], .009, material('#d75b4d', .1, .4));
  const loadToB = pathTube(circuit.object, [[.21, .19, .31], [.30, .18, .28], [.41, .15, .23], [.45, .12, .19]], .009, material('#d75b4d', .1, .4));
  const loadToSource = pathTube(circuit.object, [[-.14, .205, .31], [-.18, .12, .28], [-.22, .10, .12], [-.32, .10, -.15], [-.45, .12, -.19]], .009, material('#527da2', .1, .4));
  for (const lead of [sourceToLoad, loadToA, loadToB, loadToSource]) {lead.userData.nonPickable = true;lead.userData.hideWhenExploded=true;}
  const variableBranches = [loadToA, loadToB];

  let lastVisualKey = '';
  const lesson = { root, parts, update(_t, inputs = {}) {
    const state = rheostatState(inputs);
    const visualKey = `${state.position}|${state.end}`;
    if (visualKey !== lastVisualKey) {
      wiperMotion.position.x = -.39 + .78 * state.position;
      variableBranches[0].visible = variableBranches[0].userData.modelVisible = state.end === 'A';
      variableBranches[1].visible = variableBranches[1].userData.modelVisible = state.end === 'B';
      const cut=Math.round(state.position*(windingPoints.length-1));
      const activePoints=state.end==='A'?windingPoints.slice(0,cut+1):windingPoints.slice(cut);
      activeWinding.visible=activeWinding.userData.modelVisible=activePoints.length>1;
      if(activePoints.length>1) setTubePoints(activeWinding,activePoints,.007,Math.max(24,activePoints.length));
      lastVisualKey = visualKey;
    }
    return rheostatReadout(_t, inputs);
  } };
  lesson.update(0, {});
  return lesson;
}

const PULLEY_G = 9.81;
const PULLEY_STRANDS = 2;
const PULLEY_RADIUS = .12;
function pulleyState(inputs = {}) {
  const pull = number(inputs, 'pullDistance', 0, 0, .60);
  const mass = number(inputs, 'mass', 2, .5, 5);
  const lift = pull / PULLEY_STRANDS;
  const loadForce = mass * PULLEY_G;
  return { pull, mass, lift, loadForce, strands: PULLEY_STRANDS, idealEffort: loadForce / PULLEY_STRANDS };
}
function pulleyReadout(_t, inputs = {}) {
  const state = pulleyState(inputs);
  return {
    phaseIndex: state.pull < .2 ? 0 : state.pull < .4 ? 1 : 2,
    title: '两段绳子共同支撑动滑轮和负载',
    text: '理想模型忽略滑轮摩擦、绳重和滑轮质量。拉绳距离是负载上升距离的两倍，所需拉力约为负载重力的一半。',
    values: [
      value('承重绳段', state.strands, '段'),
      value('拉绳距离', fixed(state.pull), 'm'),
      value('负载上升', fixed(state.lift), 'm'),
      value('负载重力', fixed(state.loadForce, 1), 'N'),
      value('理想拉力', fixed(state.idealEffort, 1), 'N'),
    ],
  };
}
export class PulleyRopeCurve extends THREE.Curve {
  constructor(centerY, freeY) { super(); this.centerY=centerY; this.freeY=freeY; this.lengths=[1.37-centerY, Math.PI*PULLEY_RADIUS, 1.16-centerY, Math.PI*PULLEY_RADIUS, 1.16-freeY]; this.total=this.lengths.reduce((a,b)=>a+b,0); }
  getLength() { return this.total; }
  getPoint(t, target = new THREE.Vector3()) {
    let d=Math.max(0,Math.min(1,t))*this.total, i=0;
    while(i<4 && d>this.lengths[i]) d-=this.lengths[i++];
    const r=PULLEY_RADIUS, c=this.centerY;
    if(i===0) return target.set(-r,1.37-d,0);
    if(i===1) { const a=Math.PI+d/r; return target.set(r*Math.cos(a),c+r*Math.sin(a),0); }
    if(i===2) return target.set(r,c+d,0);
    if(i===3) { const a=Math.PI-d/r; return target.set(2*r+r*Math.cos(a),1.16+r*Math.sin(a),0); }
    return target.set(3*r,1.16-d,0);
  }
  getPointAt(t,target) { return this.getPoint(t,target); }
}
function pulleyRopePoints(centerY, freeY) { return new PulleyRopeCurve(centerY,freeY).getPoints(500).map(p=>p.toArray()); }

function buildPulley() {
  const root = new THREE.Group(), parts = [];
  const frameMat = material('#35526d', .38, .32);
  const steel = material('#9ba9b2', .84, .22);
  const ropeMat = material('#c9b47f', .06, .78);
  const brass = material('#c6984d', .8, .24);
  const loadMat = material('#5a6876', .62, .33);

  const frame = assembly(root, 'support-frame', '支架与顶梁', '顶梁固定定滑轮和绳端，立柱把负载传到支承面。', [0, .22, -.2]); parts.push(frame);
  box(frame.object, [1.08, .11, .18], [0, 1.42, 0], frameMat);
  for (const x of [-.47, .47]) {
    box(frame.object, [.10, 1.40, .13], [x, .72, 0], frameMat);
    box(frame.object, [.28, .08, .28], [x, .04, 0], loadMat);
    for (let i = 0; i < 4; i++) bolt(frame.object, [x, .20 + i * .32, .071], .014, .01, brass, 'z');
  }
  for (let i = 0; i < 7; i++) box(frame.object, [.025, .10, .19], [-.42 + i * .14, 1.36, 0], material('#6d8090', .55, .32));

  const fixed = assembly(root, 'fixed-sheave', '定滑轮与轴承', '固定在顶梁的滑轮改变拉力方向；它本身不增加理想机械利益。', [.28, .05, .12]); parts.push(fixed);
  const fixedSpin = new THREE.Group(); fixedSpin.position.set(.24, 1.16, 0); fixed.object.add(fixedSpin);
  cylinder(fixedSpin, .111, .09, [0, 0, 0], steel, 'z').name='pulley-fixed-wheel-body';
  for (const z of [-.052, .052]) {
    torus(fixedSpin, .128, .012, [0, 0, z], brass);
    torus(fixedSpin, .084, .006, [0, 0, z * 1.05], steel);
  }
  cylinder(fixedSpin, .032, .19, [0, 0, 0], material('#73828d', .86, .2), 'z');
  for (const z of [-.10, .10]) cylinder(fixedSpin, .022, .045, [0, 0, z], brass, 'z');
  box(fixed.object, [.06, .25, .04], [.24, 1.285, -.12], frameMat);
  cylinder(fixed.object, .025, .25, [.24, 1.16, 0], steel, 'z');
  for (const x of [.23, .33]) bolt(fixed.object, [x-.04, 1.30, -.09], .01, .014, steel, 'z');

  const moving = assembly(root, 'moving-block', '动滑轮、滑块和负载', '动滑轮由两段绳子承托，随负载上升。', [0, -.06, .06]); parts.push(moving);
  const movingLift = new THREE.Group(); moving.object.add(movingLift);
  const wheelSpin = new THREE.Group(); wheelSpin.position.set(0, 0, 0); movingLift.add(wheelSpin);
  cylinder(wheelSpin, .111, .085, [0, 0, 0], steel, 'z').name='pulley-moving-wheel-body';
  for (const z of [-.05, .05]) {
    torus(wheelSpin, .128, .012, [0, 0, z], brass);
    torus(wheelSpin, .085, .006, [0, 0, z * 1.05], steel);
  }
  cylinder(wheelSpin, .027, .16, [0, 0, 0], brass, 'z');
  for (const z of [-.091, .091]) cylinder(wheelSpin, .018, .025, [0, 0, z], steel, 'z');
  // Fork cheeks are in front of/behind the rope plane, attached to the axle.
  for (const z of [-.10,.10]) box(movingLift,[.055,.25,.025],[0,-.11,z],frameMat);
  box(movingLift,[.055,.035,.225],[0,-.235,0],brass);
  cylinder(movingLift,.018,.09,[0,-.285,0],steel);
  const loadMotion=new THREE.Group(); movingLift.add(loadMotion);
  box(loadMotion,[.25,.20,.18],[0,-.405,0],loadMat);
  cylinder(loadMotion,.018,.045,[0,-.315,0],brass);
  for(let i=0;i<4;i++) box(loadMotion,[.19,.006,.004],[0,-.35-i*.04,.092],steel);

  const rope = assembly(root, 'continuous-rope', '连续绳索', '同一条绳：固定端 → 动滑轮下绕 → 定滑轮上绕 → 自由端。', [0, 0, -.06]);
  rope.object.userData.connection = true; parts.push(rope);
  const ropeMesh = new THREE.Mesh(new THREE.TubeGeometry(new PulleyRopeCurve(.60,.95),480,.009,10,false),ropeMat);
  ropeMesh.name="inextensible-rope";
  rope.object.add(ropeMesh);
  let lastMotionPull = Number.NaN;
  let lastRopePull = 0;

  const deadEnd = assembly(root, 'dead-end-anchor', '绳端锚固夹', '绳子的固定端锁在顶梁下方。', [-.12, .18, 0]); parts.push(deadEnd);
  box(deadEnd.object, [.12, .055, .07], [-.12, 1.39, 0], brass);
  box(deadEnd.object, [.04, .07, .04], [-.12, 1.34, 0], steel);
  for (let i = 0; i < 2; i++) bolt(deadEnd.object, [-.15 + i * .06, 1.415, .04], .01, .015, steel, 'z');

  const grip = assembly(root, 'effort-grip', '自由端拉手', '手握自由端向下拉；输入距离决定模型的拉绳位移。', [.4, -.2, -.04]);
  grip.drag = { control: 'pullDistance', axis: 'y', scale: -1 };
  parts.push(grip);
  const gripMotion = new THREE.Group(); grip.object.add(gripMotion);
  cylinder(gripMotion, .035, .10, [.36, .55, 0], loadMat);
  torus(gripMotion, .035, .006, [.36, .60, 0], brass);
  cylinder(gripMotion, .012, .08, [.36, .48, 0], steel);
  for (let i = 0; i < 4; i++) torus(gripMotion, .028, .002, [.36, .52 + i * .018, 0], brass);

  const lesson = { root, parts, update(_t, inputs = {}) {
    const state = pulleyState(inputs);
    if (state.pull !== lastMotionPull) {
      const centerY = .60 + state.lift;
      const freeY = .95 - state.pull;
      movingLift.position.set(0, centerY, 0);
      wheelSpin.rotation.z = state.pull / (2 * PULLEY_RADIUS);
      fixedSpin.rotation.z = -state.pull / PULLEY_RADIUS;
      gripMotion.position.y = freeY - .60;
      lastMotionPull = state.pull;
    }
    if (state.pull !== lastRopePull) {
      const centerY = .60 + state.lift;
      const freeY = .95 - state.pull;
      ropeMesh.geometry.dispose();
      ropeMesh.geometry = new THREE.TubeGeometry(new PulleyRopeCurve(centerY,freeY),480,.009,10,false);
      lastRopePull = state.pull;
    }
    return pulleyReadout(_t, inputs);
  } };
  lesson.update(0, {});
  return lesson;
}

export const devices = [
  {
    id: 'induction-hob', name: '电磁炉', category: 'electromagnetic',
    defaultMode: 'xray',
    summary: '交变线圈磁场在适用锅底产生涡流，锅底电阻使电能转为内能。',
    principle: '高频逆变电路驱动扁平线圈，变化磁场穿过微晶玻璃，在铁磁性锅底感生闭合涡流；锅底因电阻发热。玻璃不是主要发热体。',
    notes: '电磁场与锅底涡流为定性示意。功率档位不是瓦数，涡流强弱不换算成安培；没有温度数值或温升动画。线圈脉动和风扇转动放慢，不能代表真实高频电流或风扇转速。锅具、底壳、逆变板尺寸为教学造型，不对应某型号。',
    sources: [
      { label: '美国能源部：电磁炉如何工作', url: 'https://www.energy.gov/articles/making-switch-induction-stoves-or-cooktops' },
      { label: '美国能源部 EERE：下一代家电研发路线图（感应线圈与锅底涡流）', url: 'https://www1.eere.energy.gov/buildings/pdfs/next_generation_appliances_roadmap.pdf' },
    ],
    controls: [
      { id: 'power', label: '驱动档位', min: 0, max: 100, step: 5, value: 65, unit: '%' },
      { id: 'pan', label: '锅具', options: [{ value: 'steel', label: '有磁性平底锅' }, { value: 'none', label: '无锅具' }], value: 'steel' },
    ],
    stages: [
      { name: '功率电子', title: '电路向线圈供给交变电流', text: '整流和逆变电路驱动线圈。此示意图不显示具体频率、功率或电流数值。' },
      { name: '变化磁场', title: '磁场穿过玻璃面板', text: '微晶玻璃允许变化磁场作用到放在面板上的锅底。' },
      { name: '锅底涡流', title: '锅底内形成闭合感应电流', text: '适用的导电锅底中出现涡流；涡流经过材料电阻而产生焦耳热，主要由锅具发热。' },
      { name: '热量传递', title: '锅底把热传给食物', text: '热先在锅底产生，再传到锅内食物。炉面可能被热锅反向加热，但不是线圈直接加热玻璃。' },
    ],
    build: buildHob, readout: hobReadout,
  },
  {
    id: 'electroscope', name: '金属箔验电器', category: 'electromagnetic', maxRenderPixels:2400000,
    summary: '比较带电棒靠近、接触和感应充电时，金属箔片的不同状态。',
    principle: '导体中的电子能够移动。靠近而未接触会重新分布电荷但保持总净电荷；接触可传递电荷；感应充电时要在棒仍靠近时接地，先断开地线再移开棒。',
    notes: '电荷用颜色点表示分布方向，点数表示守恒的相对净电荷单位，不是电子个数。箔片张角是夸大的定性响应，没有反推静电力或净电荷。操作菜单选择完整实验中的指定状态；“只靠近后移开”和“接触后移开”分别保留各自前置过程。自动实验之间明确接地放电。',
    sources: [
      { label: '科罗拉多大学：验电器感应、接地与移棒实验', url: 'https://physicslabs.colorado.edu/demos/electricity-and-magnetism/electrostatics/induced-charge/induced-charge-on-electroscope/' },
      { label: 'OpenStax College Physics：导体、绝缘体及验电器的接触/感应充电', url: 'https://openstax.org/books/college-physics/pages/18-2-conductors-and-insulators' },
    ],
    controls: [
      { id: 'operation', label: '操作', options: [
        { value: 'neutral', label: '中性、无外棒' }, { value: 'near', label: '靠近但不接触' },
        { value: 'move-away', label: '只靠近后移开' }, { value: 'contact', label: '带电棒接触' },
        { value: 'contact-away', label: '接触后移开（保留电荷）' }, { value: 'discharge', label: '外棒移远并接地放电' }, { value: 'grounded', label: '靠近并接地' }, { value: 'isolated', label: '先断地线、棒仍靠近' },
        { value: 'induction-done', label: '再移开棒（感应完成）' },
      ], value: 'near' },
      { id: 'rodSign', label: '带电棒电性', options: [{ value: 'positive', label: '正电' }, { value: 'negative', label: '负电' }], value: 'positive' },
    ],
    stages: [
      { name: '靠近', title: '极化不等于带上净电荷', text: '金属球附近的电荷重新分布；两片箔同号而张开，整个初始中性的验电器仍为中性。' },
      { name: '接触', title: '接触会转移电荷', text: '带电棒接触金属端时，电子转移，验电器获得与棒同号的净电荷。' },
      { name: '接地', title: '接地给电子提供进出通路', text: '带电棒仍在附近时接地；电子可以从大地流入或流出。地线未断开前，电荷仍可继续流动。' },
      { name: '先断地', title: '在棒仍靠近时断开地线', text: '断地后，验电器与大地隔离，留下与带电棒异号的净电荷。' },
      { name: '移开外棒', title: '移开棒后异号电荷保留', text: '外棒没有接触验电器。移开后，已隔离的净电荷在导体上重新分布，箔片重新张开。' },
    ],
    build: buildElectroscope, readout: electroscopeReadout,
  },
  {
    id: 'rheostat', name: '滑动变阻器', category: 'electromagnetic',
    summary: '移动滑片，改变串入电路的电阻丝长度和回路电流。',
    principle: '电阻丝的一端与滑片接入串联电路时，接入电阻随有效线长改变；理想均匀导线近似 R ∝ L。系列回路电流由 I = V/(R负载 + R变阻器) 决定。四个接线柱中 A/B 是绕组两端，C/D 与滑片导轨相连。',
    notes: '滑片按36匝顶部触点定位，每匝对应一个离散接触位置。绕线尺寸为本教学模型几何。螺旋线的路径长约 21.50 m，按 L = N√((2πr)² + (ℓ/N)²) 由 36 匝、半径 0.095 m、轴向长度 0.78 m 计算。总电阻 12 Ω、固定负载 6 Ω 是用于演算的模型参数，不是实物规格；默认电源 6 V。接触电阻、导线电阻和温升效应忽略。接线采用一个绕组端 A 或 B 与一个滑片端 C/D；两端接绕组或两端接滑片均不会形成有效变阻器串联调节。',
    sources: [
      { label: 'OpenStax College Physics 2e：欧姆定律与简单电路', url: 'https://openstax.org/books/college-physics-2e/pages/20-2-ohms-law-resistance-and-simple-circuits' },
      { label: 'OpenStax University Physics 2e：串并联电阻与欧姆定律', url: 'https://openstax.org/books/university-physics-volume-2/pages/10-2-resistors-in-series-and-parallel' },
      { label: '华东师范大学《物理教学》：滑动变阻器电流路径教学模型', url: 'https://wljx.ecnu.edu.cn/assets/userfiles/PDF/127039_20220516184053.pdf' },
      { label: '人民教育出版社：电阻与均匀电阻丝长度的探究', url: 'https://www.pep.com.cn/zzggjc/wl2023/tyl/jxsj/202302/t20230222_1982320.shtml' },
    ],
    controls: [
      { id: 'position', label: '滑片位置', min: 0, max: 1, step: .01, value: .5, unit: '比例' },
      { id: 'end', label: '所选绕组端', options: [{ value: 'A', label: 'A 端' }, { value: 'B', label: 'B 端' }], value: 'A' },
      { id: 'voltage', label: '电源电压', min: 0, max: 12, step: .5, value: 6, unit: 'V' },
    ],
    stages: [
      { name: '四个接线柱', title: '先分清绕组端和滑片端', text: 'A、B 分别连接电阻丝两端；C、D 接在滑片导轨的两端，电气上属于同一个滑片节点。' },
      { name: '接入长度', title: '选一个绕组端和一个滑片端', text: '回路只经过所选绕组端到滑片之间的电阻丝；滑片位置决定有效长度。' },
      { name: '电阻变化', title: '有效电阻随长度变化', text: '本教学模型按均匀绕组近似 R = R总 × L接入/L总。反向选择另一绕组端会反转滑片移动的增减方向。' },
      { name: '电流变化', title: '串联总电阻决定回路电流', text: '串联负载和变阻器共同限制电流；在电压固定时，接入电阻越大，电流越小。' },
    ],
    build: buildRheostat, readout: rheostatReadout,
  },
  {
    id: 'pulley', name: '滑轮组', category: 'mechanics',
    summary: '一只定滑轮改变拉力方向，一只动滑轮由两段绳共同承重。',
    principle: '理想 2:1 滑轮组有两段绳子向上支撑动滑轮：F拉 = mg/2，负载上升距离 = 拉绳距离/2。真实装置还存在摩擦、绳重和滑轮惯量。',
    notes: '重力加速度取 g = 9.81 m/s²。仅展示绳子质量可忽略、不可伸长、滑轮无摩擦且动滑轮质量可忽略的理想关系；不计算效率或加速过程。拉绳距离和质量是演示输入。绳路由三条竖直公切线和两个半圆组成，运动中总绳长不变；负载与轮轴对齐。',
    sources: [
      { label: 'OpenStax College Physics：滑轮的机械利益、承重绳段与力/距离权衡', url: 'https://openstax.org/books/college-physics/pages/9-5-simple-machines' },
      { label: 'OpenStax College Physics：简单机械中的能量守恒', url: 'https://openstax.org/books/college-physics/pages/9-5-simple-machines' },
    ],
    controls: [
      { id: 'pullDistance', label: '向下拉绳', min: 0, max: .6, step: .01, value: 0, unit: 'm' },
      { id: 'mass', label: '负载质量', min: .5, max: 5, step: .1, value: 2, unit: 'kg' },
    ],
    stages: [
      { name: '固定端', title: '连续绳的一端固定在支架上', text: '绳子从顶梁固定点向下绕过动滑轮，再向上经过定滑轮。' },
      { name: '承重绳段', title: '两段绳共同拉住动滑轮', text: '动滑轮和负载受到两段向上的绳张力；理想时每段张力相等。' },
      { name: '省力与距离', title: '力减半，拉绳距离加倍', text: '负载上升一段距离时，操作者要拉出两倍长度的绳。理想机械利益为 2。' },
      { name: '负载重力', title: '质量决定所需拉力', text: '负载重力 mg 由两段绳共同承担，理想拉力为 mg/2。' },
    ],
    build: buildPulley, readout: pulleyReadout,
  },
];

export const modelCalculations = { hobReadout, electroscopeReadout, electroscopeState, rheostatReadout, rheostatState, pulleyReadout, pulleyState, RHEOSTAT_HELIX_LENGTH_M };
