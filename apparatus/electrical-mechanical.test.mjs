import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { devices, modelCalculations, PulleyRopeCurve } from './electrical-mechanical.mjs';

const originalDocument = globalThis.document;
globalThis.document = {
  createElement(name) {
    assert.equal(name, 'canvas');
    const context = { fillText() {} };
    return { width: 0, height: 0, getContext: () => context };
  },
};
after(() => {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
});

const byId = id => devices.find(device => device.id === id);
const displayed = (readout, label) => readout.values.find(item => item.label === label)?.value;

test('four exported devices follow the shared apparatus API and have bounded controls', () => {
  assert.deepEqual(devices.map(device => device.id), ['induction-hob', 'electroscope', 'rheostat', 'pulley']);
  for (const device of devices) {
    assert.equal(typeof device.build, 'function');
    assert.equal(typeof device.readout, 'function');
    assert.ok(device.summary && device.principle && device.notes);
    assert.ok(device.sources.length > 0 && device.sources.every(source => source.url.startsWith('https://')));
    assert.ok(device.stages.length >= 3 && device.stages.length <= 6);
    for (const control of device.controls) {
      if (control.options) assert.ok(control.options.some(option => option.value === control.value));
      else assert.ok(control.value >= control.min && control.value <= control.max);
    }
    const first = device.readout(4.25, {}), second = device.readout(4.25, {});
    assert.deepEqual(first, second, `${device.id} readout must be deterministic`);
    assert.ok(Number.isInteger(first.phaseIndex));
    assert.ok(first.phaseIndex >= 0 && first.phaseIndex < device.stages.length);
    assert.ok(first.values.length > 0);
  }
});

test('built assemblies are named, independent direct children and keep runtime-owned transforms at zero', () => {
  for (const device of devices) {
    const model = device.build();
    assert.ok(model.root.isGroup);
    assert.ok(model.parts.length >= 5 && model.parts.length <= 12, device.id);
    assert.equal(model.parts.length, model.root.children.length);
    assert.equal(new Set(model.parts.map(part => part.id)).size, model.parts.length);
    for (const part of model.parts) {
      assert.equal(part.object.parent, model.root);
      assert.deepEqual(part.object.position.toArray(), [0, 0, 0]);
      assert.deepEqual(part.object.rotation.toArray(), [0, 0, 0, 'XYZ']);
      assert.ok(part.name && part.description);
      assert.equal(part.explode.length, 3);
      if (part.drag) assert.ok(device.controls.some(control => control.id === part.drag.control));
    }
    model.update(0, Object.fromEntries(device.controls.map(control => [control.id, control.value])));
    model.update(3.5, Object.fromEntries(device.controls.map(control => [control.id, control.value])));
    assert.deepEqual(model.root.position.toArray(), [0, 0, 0]);
  }
});

test('induction-hob distinguishes drive and cookware without inventing a temperature', () => {
  const readout = byId('induction-hob').readout;
  const active = readout(0, { power: 100, pan: 'steel' });
  const noPan = readout(0, { power: 100, pan: 'none' });
  const off = readout(0, { power: 0, pan: 'steel' });
  assert.equal(displayed(active, '锅底涡流（定性）'), '较强');
  assert.equal(displayed(noPan, '锅底涡流（定性）'), '无可见锅底涡流');
  assert.equal(displayed(off, '锅底涡流（定性）'), '无可见锅底涡流');
  assert.ok(active.values.every(item => !item.label.includes('温度')));

  const scene = byId('induction-hob').build();
  scene.update(2, { power: 60, pan: 'none' });
  assert.equal(scene.parts.find(part => part.id === 'cookware').object.visible, false);
  assert.equal(scene.parts.find(part => part.id === 'eddy-currents').object.visible, false);
  assert.equal(scene.parts.find(part => part.id === 'magnetic-field').object.visible, false);

  const device = byId('induction-hob');
  assert.equal(device.defaultMode, 'xray');
  for (const id of ['glass', 'cookware']) assert.equal(scene.parts.find(part => part.id === id).shell, true);
  let openPanWall = false;
  scene.parts.find(part => part.id === 'cookware').object.traverse(object => {
    if (object.geometry?.type === 'CylinderGeometry' && object.geometry.parameters.openEnded) openPanWall = true;
  });
  assert.equal(openPanWall, true, 'pan wall should leave the vessel visibly open');
  const eddyLoops = scene.parts.find(part => part.id === 'eddy-currents').object.children.filter(o=>o.isMesh);
  assert.ok(eddyLoops.every(loop => Math.abs(loop.position.y - .265) < 1e-9), 'eddy-current paths sit on the pan floor');
});

test('electroscope separates polarization, contact transfer, ground isolation, and moving the rod away', () => {
  const { electroscopeState: state, electroscopeReadout: readout } = modelCalculations;
  for (const sign of ['positive', 'negative']) {
    const near = state({ operation: 'near', rodSign: sign });
    assert.equal(near.netCharge, '中性，净电荷为零');
    assert.equal(near.bodySign, sign === 'positive' ? 'negative' : 'positive');
    assert.equal(near.leafSign, sign);
    assert.equal(state({ operation: 'move-away', rodSign: sign }).angle, 0);

    const contact = state({ operation: 'contact', rodSign: sign });
    assert.equal(contact.bodySign, sign);
    assert.equal(contact.leafSign, sign);
    assert.equal(contact.contact, true);

    const isolated = state({ operation: 'isolated', rodSign: sign });
    assert.equal(isolated.bodySign, near.bodySign);
    assert.equal(isolated.rodAway, false);
    const finished = state({ operation: 'induction-done', rodSign: sign });
    assert.equal(finished.bodySign, near.bodySign);
    assert.equal(finished.rodAway, true);
    assert.equal(finished.netCharge, sign === 'positive' ? '带负电' : '带正电');
  }
  assert.match(readout(0, { operation: 'near' }).text, /净电荷仍为零/);
  assert.match(readout(0, { operation: 'grounded' }).text, /尚不能说电荷已被孤立保存/);
  assert.match(readout(0, { operation: 'induction-done' }).text, /没有接触带电棒/);

  const scene = byId('electroscope').build();
  const base = scene.parts.find(part => part.id === 'base').object;
  let baseRing;
  base.traverse(object => { if (object.geometry?.type === 'TorusGeometry') baseRing = object; });
  assert.ok(baseRing);
  assert.ok(Math.abs(baseRing.rotation.x - Math.PI / 2) < 1e-9, 'base trim ring should lie flat on the circular base');
  scene.update(0, { operation: 'near', rodSign: 'positive' });
  const leaves = scene.parts.find(part => part.id === 'gold-leaves').object.children[0];
  assert.ok(leaves.children[0].rotation.z < 0 && leaves.children[1].rotation.z > 0);
  scene.update(0, { operation: 'induction-done', rodSign: 'positive' });
  assert.equal(scene.parts.find(part => part.id === 'ground-wire').object.visible, false);
});

test('rheostat length, resistance, and series current follow the selected winding segment', () => {
  const { rheostatState: state, RHEOSTAT_HELIX_LENGTH_M: totalLength } = modelCalculations;
  const leftA = state({ position: 0, end: 'A', voltage: 6 });
  const rightA = state({ position: 1, end: 'A', voltage: 6 });
  const leftB = state({ position: 0, end: 'B', voltage: 6 });
  const rightB = state({ position: 1, end: 'B', voltage: 6 });
  assert.ok(totalLength > 20 && totalLength < 22);
  assert.equal(leftA.wireLength, 0);
  assert.equal(leftA.rheostatResistance, 0);
  assert.equal(leftA.current, 1);
  assert.ok(Math.abs(rightA.wireLength - totalLength) < 1e-9);
  assert.equal(rightA.rheostatResistance, 12);
  assert.equal(rightA.current, 1 / 3);
  assert.equal(leftB.wireLength, totalLength);
  assert.equal(rightB.wireLength, 0);
  assert.ok(Math.abs(state({ position: .25, end: 'A' }).wireLength - state({ position: .75, end: 'B' }).wireLength) < 1e-9);
  assert.ok(Math.abs(state({ position: .5, end: 'A', voltage: 6 }).current - .5) < 1e-9);
  assert.equal(state({ position: .5, end: 'A', voltage: 0 }).current, 0);

  const scene = byId('rheostat').build();
  scene.update(0, { position: .75, end: 'B', voltage: 6 });
  const motion = scene.parts.find(part => part.id === 'wiper').object.children[0];
  assert.ok(Math.abs(motion.position.x - .195) < 1e-9);
  const staticGeometry = scene.parts.flatMap(part => {
    const geometries = [];
    part.object.traverse(object => { if (object.geometry) geometries.push(object.geometry); });
    return geometries;
  });
  scene.update(2, { position: .75, end: 'B', voltage: 3 });
  const geometryAfterRepeat = scene.parts.flatMap(part => {
    const geometries = [];
    part.object.traverse(object => { if (object.geometry) geometries.push(object.geometry); });
    return geometries;
  });
  assert.deepEqual(geometryAfterRepeat, staticGeometry, 'rheostat updates should reuse authored tube geometry');
  assert.deepEqual(scene.parts.find(part => part.id === 'wiper').drag, { control: 'position', axis: 'x', scale: 1 });
  assert.equal(scene.parts.find(part => part.id === 'four-terminals').object.children.length > 0, true);
});

test('two-pulley block preserves the ideal force-distance relation at input boundaries', () => {
  const { pulleyState: state, pulleyReadout: readout } = modelCalculations;
  for (const input of [{ pullDistance: 0, mass: .5 }, { pullDistance: .6, mass: 5 }, { pullDistance: 1, mass: -2 }]) {
    const result = state(input);
    assert.equal(result.strands, 2);
    assert.equal(result.lift, result.pull / 2);
    assert.equal(result.idealEffort, result.loadForce / 2);
    assert.ok(result.pull >= 0 && result.pull <= .6);
    assert.ok(result.mass >= .5 && result.mass <= 5);
  }
  const example = state({ pullDistance: .6, mass: 2 });
  assert.ok(Math.abs(example.idealEffort * example.pull - example.loadForce * example.lift) < 1e-9);
  assert.equal(displayed(readout(0, { pullDistance: .6, mass: 2 }), '负载上升'), '0.30');

  const scene = byId('pulley').build();
  const initialMoving = scene.parts.find(part => part.id === 'moving-block').object.children[0];
  assert.equal(initialMoving.position.y, .60, 'default lower sheave must be mounted at its starting height');
  scene.update(1, { pullDistance: .6, mass: 2 });
  const moving = initialMoving;
  assert.ok(Math.abs(moving.position.y - .90) < 1e-9);
  const rope = scene.parts.find(part => part.id === 'continuous-rope').object.children[0];
  assert.ok(rope.geometry.attributes.position.array.every(Number.isFinite));
  const liftedGeometry = rope.geometry;
  scene.update(1.1, { pullDistance: .6, mass: 2 });
  assert.equal(rope.geometry, liftedGeometry, 'unchanged pull should not rebuild the rope tube');
  scene.update(1.2, { pullDistance: .3, mass: 2 });
  assert.notEqual(rope.geometry, liftedGeometry, 'changing pull should rebuild rope geometry to follow the sheaves');
  assert.deepEqual(scene.parts.find(part => part.id === 'effort-grip').drag, { control: 'pullDistance', axis: 'y', scale: -1 });
});

test('rope geometry is inextensible, tangent at all joins, and clears wheel hubs over full travel', () => {
  const scene=byId('pulley').build(); let referenceLength;
  for(let step=0;step<=60;step++) {
    const pull=step/100,cy=.60+pull/2,free=.95-pull;
    scene.update(0,{pullDistance:pull});
    const curve=scene.root.getObjectByName('inextensible-rope').geometry.parameters.path;
    assert(curve instanceof PulleyRopeCurve);
    referenceLength??=curve.getLength();
    assert(Math.abs(curve.getLength()-referenceLength)<1e-12,'same rope material length across travel');
    let cumulative=0;
    for(const length of curve.lengths.slice(0,-1)) {
      cumulative+=length;const t=cumulative/curve.total;
      assert(curve.getTangent(t-1e-5).dot(curve.getTangent(t+1e-5))>.99999,'tangent directions match across join');
    }
    for(let k=0;k<=1200;k++) {
      const p=curve.getPoint(k/1200);
      assert.equal(p.z,0);
      assert(Math.hypot(p.x,p.y-cy)>=.12-1e-9,'rope center stays outside moving hub');
      assert(Math.hypot(p.x-.24,p.y-1.16)>=.12-1e-9,'rope center stays outside fixed hub');
      assert(p.x>=-.1200001&&p.x<=.3600001,'rope stays inside support uprights');
    }
    const end=curve.getPoint(1); assert(Math.abs(end.x-.36)<1e-12); assert(Math.abs(end.y-free)<1e-12);
    // Load lower face and handle lower tip remain above the base throughout travel.
    assert(cy-.505>=.09); assert(free-.16>.08);
    const moving=scene.parts.find(p=>p.id==='moving-block').object.children[0];
    assert.equal(moving.position.x,0); assert.equal(moving.position.z,0);
    const lowerRotation=moving.children[0].rotation.z;
    const upperRotation=scene.parts.find(p=>p.id==='fixed-sheave').object.children[0].rotation.z;
    assert(Math.abs(pull/2-lowerRotation*.12)<1e-12,'lower anchored contact has zero displacement: lift - radius*angle = 0');
    assert(Math.abs(-upperRotation*.12-pull)<1e-12,'upper left contact rope rises by pulled length');
  }
});

test('electroscope charge units conserve net charge and correct grounding redistributes before leaves reopen',()=>{
  for(const rodSign of ['positive','negative']) {
    const states={};
    for(const operation of ['neutral','near','move-away','contact','contact-away','grounded','isolated','induction-done']) {
      const s=modelCalculations.electroscopeState({operation,rodSign}); states[operation]=s;
      assert.equal(s.bodyCharge+2*s.leafCharge,s.totalCharge);
      assert.equal(s.totalCharge+s.rodChargeDelta+s.earthChargeDelta,0,'charge transferred to scope must have donor');
    }
    assert.equal(states.near.totalCharge,0);
    assert.equal(states.contact.totalCharge,states['contact-away'].totalCharge);
    assert.equal(states.grounded.angle,0); assert.equal(states.isolated.angle,0);
    assert.equal(states.grounded.totalCharge,states.isolated.totalCharge);
    assert.equal(states.isolated.totalCharge,states['induction-done'].totalCharge);
    assert(states['induction-done'].angle>0);
  }
  const model=byId('electroscope').build();
  const leafPivot=model.parts.find(p=>p.id==='gold-leaves').object.children[0];
  for(const operation of ['neutral','near','contact','grounded','isolated','induction-done']) {
    model.update(0,{operation});
    for(const leaf of leafPivot.children.slice(0,2)) {
      const mesh=leaf.children[0]; mesh.geometry.computeBoundingBox();
      assert(Math.abs(mesh.geometry.boundingBox.max.y+mesh.position.y)<1e-6,'foil reaches its conducting hinge without a gap');
    }
  }
  model.update(0,{operation:'contact'});
  const rod=model.parts.find(p=>p.id==='test-rod').object.children[0];
  const metalTip=rod.children[1];
  assert(Math.abs(metalTip.position.y-.79)<1e-12);
  assert(Math.abs(rod.position.x+metalTip.position.x+.07/2-(-.072))<1e-12,'actual tip touches ball surface');
  model.update(0,{operation:'near'});
  assert(rod.position.x+metalTip.position.x+.035<-.072,'near must not accidentally contact');
});

test('rheostat shoe touches actual winding and active segment ends at that contact for both terminals',()=>{
  const model=byId('rheostat').build();
  for(const end of ['A','B']) for(let turn=0;turn<=36;turn++) {
    const position=turn/36;model.update(0,{position,end,voltage:6});model.root.updateMatrixWorld(true);
    const shoe=model.root.getObjectByName('contact-shoe'),winding=model.root.getObjectByName('resistance-winding');
    const contact=winding.geometry.parameters.path.getPoint(position);
    const top=shoe.getWorldPosition(contact.clone());
    assert(Math.abs(top.x-contact.x)<1e-7);assert(Math.abs(contact.y-.435)<1e-7);assert(Math.abs(contact.z)<1e-7);
    assert(Math.abs((top.y-.006)-(contact.y+.0067))<.007,'contact shoe overlaps wire surface');
    const active=model.root.getObjectByName('active-winding');
    if((end==='A'&&turn===0)||(end==='B'&&turn===36)) assert.equal(active.visible,false);
    else {
      const points=active.geometry.parameters.path.points;
      const boundary=end==='A'?points.at(-1):points[0];
      assert(boundary.distanceTo(contact)<1e-7,'highlighted current route ends at actual brush');
    }
  }
});

test('hob rim and eddy paths are horizontal; closed flux paths cross pan inside and return outside coil',()=>{
  const m=byId('induction-hob').build();m.root.updateMatrixWorld(true);
  assert(Math.abs(m.root.getObjectByName('horizontal-pan-rim').rotation.x-Math.PI/2)<1e-12);
  for(const mesh of m.parts.find(p=>p.id==='eddy-currents').object.children.filter(o=>o.isMesh)) {
    assert(Math.abs(mesh.rotation.x-Math.PI/2)<1e-12);
    assert(mesh.geometry.parameters.radius<.286);
  }
  for(const loop of m.parts.find(p=>p.id==='magnetic-field').object.children.filter(o=>o.isMesh)) {
    const path=loop.geometry.parameters.path;assert.equal(path.closed,true);
    assert(path.getPoint(0).distanceTo(path.getPoint(1))<1e-12);
    const cross=[];let prev=path.getPoint(0);
    for(let i=1;i<=500;i++){const p=path.getPoint(i/500);if((prev.y-.24)*(p.y-.24)<0) cross.push(Math.hypot(p.x,p.z));prev=p;}
    assert(cross.some(r=>r<.286),'flux penetrates conducting pan bottom');
    assert(cross.some(r=>r>.335),'return path outside coil instead of a floating oval beside it');
  }
});
