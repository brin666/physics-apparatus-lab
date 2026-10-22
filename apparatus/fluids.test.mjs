import test from 'node:test';
import assert from 'node:assert/strict';
import { devices, submarineState, canalLockState, manometerState, pistonPumpState, createSubmarineDynamics } from './fluids.mjs';
import { THREE } from './kit.mjs';
import {previewInputs,guidedStart} from './preview-inputs.mjs';

const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) <= epsilon, `${a} differs from ${b}`);

test('all four fluid devices expose complete assemblies and pure readouts', () => {
  assert.deepEqual(devices.map(d => d.id), ['submarine', 'canal-lock', 'manometer', 'piston-pump']);
  for (const device of devices) {
    const built = device.build();
    assert.ok(built.root.isGroup);
    assert.ok(built.parts.length >= 5 && built.parts.length <= 12, `${device.id} has ${built.parts.length} groups`);
    assert.equal(built.root.children.length, built.parts.length, 'every assembly group is a direct child of its device root');
    assert.equal(new Set(built.parts.map(p => p.id)).size, built.parts.length, 'assembly ids are unique');
    const inputs = Object.fromEntries(device.controls.map(c => [c.id, c.value]));
    built.update(3.25, inputs);
    const poseA = device.readout(3.25, inputs);
    built.update(3.25, inputs);
    const poseB = device.readout(3.25, inputs);
    assert.deepEqual(poseA, poseB, `${device.id} should be deterministic for a repeated time and input`);
    assert.ok(poseA.title && poseA.text && poseA.values.length >= 3);
    for (const part of built.parts) assert.deepEqual(part.object.position.toArray(), [0, 0, 0], 'runtime-owned assembly transforms stay untouched');
  }
  const probe = devices.find(d => d.id === 'manometer').build().parts.find(p => p.id === 'pressure-probe');
  assert.deepEqual(probe.drag, { control: 'depth', axis: 'y', scale: -1 });
});

test('submarine ballast changes weight relative to the full-displacement buoyancy limit', () => {
  const empty = submarineState(0, { ballast: 0 });
  const neutral = submarineState(0, { ballast: 12 });
  const heavy = submarineState(0, { ballast: 32 });
  assert.ok(empty.fullSubmergedMarginN > 0);
  close(neutral.fullSubmergedMarginN, 0);
  assert.ok(heavy.fullSubmergedMarginN < 0);
  assert.equal(empty.mode, '漂浮平衡');
  assert.equal(neutral.mode, '近中性浮力');
  assert.equal(heavy.mode, '负浮力下沉');
  assert.ok(empty.displacedFraction < neutral.displacedFraction);
  assert.equal(heavy.displacedFraction, 1);
  assert.equal(submarineState(0, { ballast: -100 }).ballastKg, 0);
  assert.equal(submarineState(0, { ballast: 100 }).ballastKg, 32);
  assert.equal(submarineState(0, { ballast: Number.NaN }).ballastKg, 10);
});

test('ship-lock interlocks never open a gate against a mismatched level', () => {
  for (const direction of ['downstream', 'upstream']) {
    for (let i = 0; i <= 1000; i++) {
      const s = canalLockState(0, { direction, head: 3.5, progress: i / 1000 });
      assert.equal(s.safe, true, `${direction} at progress ${i / 1000}`);
      assert.ok(!(s.upperGate > 0 && s.lowerGate > 0));
      if (s.upperGate > 1e-6) close(s.level, s.highLevel);
      if (s.lowerGate > 1e-6) close(s.level, s.lowLevel);
      if (s.fillValve > 0 || s.emptyValve > 0) {
        assert.equal(s.upperGate, 0);
        assert.equal(s.lowerGate, 0);
      }
    }
  }
  const downEntry = canalLockState(0, { direction: 'downstream', head: 4 });
  const upEntry = canalLockState(0, { direction: 'upstream', head: 4 });
  assert.equal(downEntry.upperGate, 1);
  assert.equal(upEntry.lowerGate, 1);
  assert.ok(downEntry.boatX < 0 && upEntry.boatX > 0);
  close(canalLockState(0, { direction: 'downstream', head: 4, progress: 1 }).chamberHeadM, 4);
  close(canalLockState(0, { direction: 'downstream', head: 4, progress: 0.5 }).chamberHeadM, 0);
  assert.equal(canalLockState(0, { progress: -3, head: 0 }).progress, 0);
  assert.equal(canalLockState(0, { progress: 3, head: 9 }).headM, 6);
  assert.equal(canalLockState(Number.NaN, {}).progress, 0);
});

test('ship-lock playback loops while paused progress keeps its exact endpoint and maps six beats to four lessons', () => {
  const options = { direction: 'downstream', head: 4, progress: 0 };
  const start = canalLockState(0, options);
  const oneCycle = canalLockState(20, options);
  assert.equal(oneCycle.progress, start.progress);
  assert.equal(oneCycle.segment, start.segment);
  assert.equal(canalLockState(40, options).progress, start.progress);
  const midCycle = canalLockState(20.5, options);
  close(midCycle.progress, 0.025);
  assert.equal(midCycle.segment, 0);

  const endpoint = canalLockState(0, { ...options, progress: 1 });
  assert.equal(endpoint.progress, 1);
  assert.equal(endpoint.segment, 5);
  assert.equal(endpoint.boatVisible, false);
  assert.ok(endpoint.upperGate > 0.99);
  assert.equal(canalLockState(0.01, { ...options, progress: 1 }).progress > 0, true,
    'playing from the endpoint wraps to the next cycle');

  const device = devices.find(d => d.id === 'canal-lock');
  const expectedPhases = [0, 1, 2, 3, 2, 0];
  expectedPhases.forEach((phase, segment) => {
    const lesson = device.readout(0, { ...options, progress: (segment + 0.5) / 6 });
    assert.equal(lesson.phaseIndex, phase, `internal beat ${segment} maps to teaching stage ${phase}`);
  });
});

test('manometer levels obey the hydrostatic relation for each gauge liquid', () => {
  for (const gauge of ['oil', 'water']) for (const depth of [0, 0.1, 0.25, 0.5]) {
    const s = manometerState(0, { gauge, depth });
    close(s.gaugePressurePa, s.waterDensity * s.g * depth);
    close(s.gaugePressurePa, s.rhoGauge * s.g * s.levelDifferenceM);
    close(s.leftLevelM + s.rightLevelM, 0);
    assert.ok(s.levelDifferenceM >= 0);
  }
  close(manometerState(0, { gauge: 'water', depth: 0.5 }).levelDifferenceM, 0.5);
  close(manometerState(0, { gauge: 'oil', depth: 0.5 }).levelDifferenceM, 1000 * 0.5 / 850);
  assert.equal(manometerState(0, { depth: -2 }).depthM, 0);
  assert.equal(manometerState(0, { depth: 2 }).depthM, 0.5);
  assert.equal(manometerState(0, { depth: Number.NaN }).depthM, 0.28);
});

test('suction pump valves alternate and the ideal atmospheric lift caps flow', () => {
  const up = pistonPumpState(0, { speed: 0.25, lift: 4 });
  const down = pistonPumpState(2, { speed: 0.25, lift: 4 });
  assert.equal(up.upstroke, true);
  assert.equal(up.inletValveOpen, true);
  assert.equal(up.pistonValveOpen, false);
  assert.equal(down.upstroke, false);
  assert.equal(down.inletValveOpen, false);
  assert.equal(down.pistonValveOpen, true);
  assert.ok(up.flowLMin > 0 && down.flowLMin > 0);
  const expectedStrokeM = 2 * 0.58 * Math.sin(0.30);
  close(up.displacedPerCycleM3, Math.PI * (0.12 / 2) ** 2 * expectedStrokeM);
  close(up.flowLMin, up.displacedPerCycleM3 * up.frequencyHz * 60 * 1000);
  close(up.chamberPressurePa, 101325 - 1000 * 9.81 * 4);
  const atLimit = pistonPumpState(0, { speed: 0.25, lift: up.theoreticalMaxLiftM });
  assert.equal(atLimit.suctionPossible, false);
  assert.equal(atLimit.flowLMin, 0);
  assert.equal(atLimit.chamberPressurePa, 0);
  assert.equal(atLimit.inletValveOpen, false, 'an unreachable source cannot supply an open inlet in the dry steady-state depiction');
  const aboveLimit = pistonPumpState(1, { speed: 2, lift: 20 });
  assert.equal(aboveLimit.suctionPossible, false);
  assert.equal(aboveLimit.flowLMin, 0);
  assert.equal(pistonPumpState(-1, { speed: 0.25, lift: -1 }).phase, 0);
});

test('pump lever pin stays in the moving crosshead slot on the piston axis', () => {
  const model = devices.find(d => d.id === 'piston-pump').build();
  const drive = model.parts.find(p => p.id === 'hand-lever-and-link').object;
  const pistonPart = model.parts.find(p => p.id === 'piston-and-rod-seals').object;
  const lever = drive.getObjectByName('pump-lever');
  const pistonSlider = pistonPart.getObjectByName('pump-piston-slider');
  const rod = pistonPart.getObjectByName('piston-rod');
  const guide = pistonPart.getObjectByName('pump-slider-guide');
  assert.ok(lever && pistonSlider && rod && guide);
  assert.ok(rod.geometry.parameters.height >= 0.5, 'the visible piston rod spans from piston to crosshead');
  const cylinderTop = 1.45;
  const cylinderCapBottom = cylinderTop - 0.025;
  const cylinderCapTop = cylinderTop + 0.025;
  for (let i = 0; i <= 400; i++) {
    const t = i / 100;
    const state = pistonPumpState(t, { speed: 0.25, lift: 4 });
    model.update(t, { speed: 0.25, lift: 4 });
    lever.updateMatrixWorld(true);
    guide.updateMatrixWorld(true);
    const pin = lever.position.clone().set(-0.58, 0, 0).applyMatrix4(lever.matrixWorld);
    const guideCenter = guide.getWorldPosition(new THREE.Vector3());
    close(pistonSlider.position.y, state.pistonCenterY);
    close(pin.x, state.linkageUpper.x);
    close(pin.y, state.linkageUpper.y);
    close(state.linkageUpper.y, state.linkageLower.y);
    close(guideCenter.x, state.linkageLower.x);
    close(guideCenter.y, pin.y);
    assert.ok(Math.abs(pin.x - guideCenter.x) <= 0.09, 'the lever pin remains inside the 0.18 m crosshead slot');
    assert.ok(state.pistonTopY <= cylinderCapBottom - 0.02,
      `piston clears the cylinder lid throughout its stroke at t=${t}`);
    assert.ok(state.linkageLower.y - 0.0175 >= cylinderCapTop + 0.025,
      `crosshead slot clears the cylinder lid throughout its stroke at t=${t}`);
    assert.ok(state.outletPortY - 0.025 >= state.pistonTopY,
      `outlet pipe opening stays above the piston throughout its stroke at t=${t}`);
  }
});
const bounds = object => new THREE.Box3().setFromObject(object);
const build = id => devices.find(d=>d.id===id).build();
const volume = b => Math.max(0,b.max.x-b.min.x)*Math.max(0,b.max.y-b.min.y)*Math.max(0,b.max.z-b.min.z);
const overlapVolume = (a,b) => volume(a.clone().intersect(b));

test('submarine rendered displacement and tank water conserve total water without wetting the hull interior',()=>{
  const model=build('submarine');
  for(const ballast of [0,10,12,16,32])for(const t of [0,.5,2,20]){
    model.update(t,{ballast});const s=model.physicsState();model.root.updateMatrixWorld(true);
    const hull=new THREE.Box3(new THREE.Vector3(-.5,s.centerY-.1,-.2),new THREE.Vector3(.5,s.centerY+.1,.2));
    close(volume(hull),.08);assert.ok(hull.min.y>=.12-1e-9,'hull cannot penetrate basin floor');
    close(.4*Math.max(0,Math.min(s.surfaceY,hull.max.y)-hull.min.y),s.displacedVolumeM3);
    let outside=0,inside=0;
    model.root.traverse(m=>{
      if(m.name.startsWith('sub-water-')&&m.visible){const b=bounds(m);outside+=volume(b);assert.ok(overlapVolume(b,hull)<1e-9,'external water must exclude body volume');assert.ok(b.max.y<=s.surfaceY+1e-8);}
      if(m.name.startsWith('sub-ballast-')&&m.visible)inside+=volume(bounds(m));
    });
    close(inside,s.ballastVolumeM3,1e-8);close(outside,s.externalWaterVolumeM3,1e-8);
    close(inside+outside,1.8*.76*(1.08-.12),1e-8);
    if(s.onBottom)close(s.bottomReactionN+s.maxBuoyancyN,s.weightN);
  }
  assert.ok(submarineState(2,{ballast:32}).centerY<submarineState(1,{ballast:32}).centerY);
  assert.equal(submarineState(20,{ballast:32}).onBottom,true);
});

test('lock rendered water shares the floor and meets at gates; boat clears every sweeping leaf',()=>{
  const model=build('canal-lock'),boat=model.root.getObjectByName('lock-boat-hull');
  const leaves=[];model.root.traverse(m=>{if(m.name.startsWith('lock-leaf-'))leaves.push(m);});
  for(const name of ['lock-fill-pipe','lock-empty-pipe']){
    const curve=model.root.getObjectByName(name).geometry.parameters.path;
    for(let i=0;i<=1000;i++){const p=curve.getPointAt(i/1000);if(Math.abs(Math.abs(p.x)-.53)<.04)assert.ok(p.y+.035<.22,'culverts pass below gate and cannot tunnel through moving leaves');}
  }
  for(const direction of ['downstream','upstream'])for(const head of [1,6])for(let i=0;i<=600;i++){
    const progress=i/600,s=canalLockState(0,{direction,head,progress});model.update(0,{direction,head,progress});model.root.updateMatrixWorld(true);
    const high=bounds(model.root.getObjectByName('lock-high-water')),low=bounds(model.root.getObjectByName('lock-low-water')),chamber=bounds(model.root.getObjectByName('lock-chamber-water'));
    for(const b of [high,low,chamber])close(b.min.y,.22,1e-7);
    close(high.max.y,s.highLevel,1e-7);close(low.max.y,s.lowLevel,1e-7);close(chamber.max.y,s.level,1e-7);
    close(high.max.x,chamber.min.x,1e-7);close(low.min.x,chamber.max.x,1e-7);
    if(s.boatVisible){
      const b=bounds(boat);
      for(const leaf of leaves)assert.ok(overlapVolume(b,bounds(leaf))<1e-9,`boat/gate collision ${direction} head=${head} progress=${progress}`);
      for(const [gateX,openness] of [[-.53,s.upperGate],[.53,s.lowerGate]])if(b.min.x<gateX+.02&&b.max.x>gateX-.02)close(openness,1);
    }
    if(s.segment===3&&s.segmentProgress<.4)close(s.boatX,0);
  }
});

test('manometer rendered heights and diaphragm depth obey rho g h at every slider value',()=>{
  const model=build('manometer');
  for(const gauge of ['oil','water'])for(let i=0;i<=100;i++){
    const depth=i*.005,s=manometerState(0,{depth,gauge});model.update(0,{depth,gauge});model.root.updateMatrixWorld(true);
    const left=bounds(model.root.getObjectByName('manometer-left-liquid')),right=bounds(model.root.getObjectByName('manometer-right-liquid'));
    close(left.max.y-right.max.y,s.levelDifferenceM,1e-7);close(left.max.y+right.max.y,1.26,1e-7);
    close(left.min.y,.32,1e-7);close(right.min.y,.32,1e-7);assert.ok(right.max.y>=.32&&left.max.y<1.02);
    const membrane=model.root.getObjectByName('manometer-diaphragm').getWorldPosition(new THREE.Vector3());
    close(.77-membrane.y,depth);close(s.rhoGauge*9.81*(left.max.y-right.max.y),1000*9.81*(.77-membrane.y),.001);
    const tube=bounds(model.root.getObjectByName('manometer-probe-extension'));close(tube.min.y,membrane.y,1e-7);
  }
  const shell=model.root.getObjectByName('manometer-bend-shell').geometry.parameters.path;
  const liquid=model.root.getObjectByName('manometer-bend-liquid').geometry.parameters.path;
  for(let i=0;i<=100;i++)close(shell.getPoint(i/100).distanceTo(liquid.getPoint(i/100)),0);
});

test('pump has real valve and rod openings, fluid reaches the outlet, and the linkage remains clear',()=>{
  const model=build('piston-pump'),disk=model.root.getObjectByName('pump-perforated-piston'),lid=model.root.getObjectByName('pump-lid-rod-hole'),seat=model.root.getObjectByName('pump-base-seat');
  const ray=new THREE.Raycaster();
  for(let i=0;i<=200;i++){
    const t=i/50,s=pistonPumpState(t,{speed:.25,lift:4});model.update(t,{speed:.25,lift:4});model.root.updateMatrixWorld(true);
    // Ray through each offset hole tests the mesh triangles, not stored metadata.
    for(const z of [-.033,.033]){ray.set(new THREE.Vector3(-.36,s.pistonCenterY+.15,z),new THREE.Vector3(0,-1,0));assert.equal(ray.intersectObject(disk).length,0,'water can pass through real piston hole');}
    ray.set(new THREE.Vector3(-.36,2,0),new THREE.Vector3(0,-1,0));assert.equal(ray.intersectObject(lid).length,0);assert.equal(ray.intersectObject(seat).length,0);
    ray.set(new THREE.Vector3(-.32,s.pistonCenterY+.15,0),new THREE.Vector3(0,-1,0));assert.ok(ray.intersectObject(disk).length>0,'solid web still seals the cylinder');
    const lower=bounds(model.root.getObjectByName('pump-lower-liquid')),upper=bounds(model.root.getObjectByName('pump-upper-liquid'));
    close(lower.max.y,s.pistonCenterY-.023,1e-7);close(upper.min.y,s.pistonTopY,1e-7);close(upper.max.y,s.outletPortY,1e-7);
    const guide=bounds(model.root.getObjectByName('pump-slider-guide')),lidBox=bounds(lid);
    assert.ok(guide.min.y>lidBox.max.y+.025,'crosshead stays above actual lid');
    assert.ok(s.pistonTopY<1.375,'piston never covers side port');
    const lever=model.root.getObjectByName('pump-lever'),rod=model.root.getObjectByName('piston-rod');
    const arm=lever.children[0];assert.ok(overlapVolume(bounds(arm),bounds(rod))<1e-10,'offset arm does not sweep through rod');
  }
  const inlet=model.root.getObjectByName('pump-suction-pipe').userData.route;
  const outlet=model.root.getObjectByName('pump-outlet-pipe').userData.route;
  close(inlet.at(-1)[0],-.36);close(inlet.at(-1)[1],.60);close(outlet[0][0],-.30);close(outlet[0][1],1.40);
  model.update(1,{lift:12,speed:.25});assert.equal(model.root.getObjectByName('pump-upper-liquid').parent.visible,false);
});

test('pump frequency changes can preserve phase including zero speed',()=>{
  const device=devices.find(d=>d.id==='piston-pump'),t=7.3,oldInputs={speed:.25};
  const before=pistonPumpState(t,oldInputs);
  const changed={speed:.7,_phaseOffset:t*(device.phaseRate(oldInputs)-device.phaseRate({speed:.7}))};
  close(pistonPumpState(t,changed).phase,before.phase);
  const stopped={speed:0,_phaseOffset:changed._phaseOffset+t*device.phaseRate(changed)};
  close(pistonPumpState(t+20,stopped).phase,before.phase);close(pistonPumpState(t+20,stopped).flowLMin,0);
});

test('submarine guide integrates continuous buoyancy through complete filling and blowing cycles',()=>{
  const model=build('submarine'),offset=guidedStart('submarine',{ballast:10});
  model.reset(0,{ballast:10});model.update(0,{ballast:10});let previous=model.physicsState(),sawBottom=false,sawRise=false,sawPartial=false;
  for(let i=1;i<=48*60;i++){
    const t=i/60,inputs=previewInputs('submarine',t+offset);model.update(t,inputs);model.root.updateMatrixWorld(true);const s=model.physicsState();
    assert.ok(Math.abs(s.centerY-previous.centerY)<.05,`continuous position at t=${t}`);
    const hull=bounds(model.root.getObjectByName('sub-displacement-hull'));
    close((hull.min.y+hull.max.y)/2,s.centerY,1e-7);
    const envelope=new THREE.Box3(new THREE.Vector3(-.5,s.centerY-.1,-.2),new THREE.Vector3(.5,s.centerY+.1,.2));
    let outside=0,inside=0;model.root.traverse(m=>{
      if(m.name.startsWith('sub-water-')&&m.visible){const b=bounds(m);outside+=volume(b);assert.ok(overlapVolume(b,envelope)<1e-9);assert.ok(b.max.y<=s.surfaceY+1e-8);}
      if(m.name.startsWith('sub-ballast-')&&m.visible)inside+=volume(bounds(m));
    });
    close(outside+inside,1.8*.76*(1.08-.12),1e-8);
    close(s.buoyancyN,1025*9.81*.4*Math.max(0,Math.min(s.surfaceY,s.centerY+.1)-(s.centerY-.1)),1e-7);
    const values=model.readout(t,inputs).values;
    assert.ok(Math.abs(Number(values.find(v=>v.label==='实际浮力').value)-s.buoyancyN)<=.5);
    if(s.onBottom)sawBottom=true;if(s.velocityY>.05)sawRise=true;if(s.displacedFraction<.99)sawPartial=true;
    previous=s;
  }
  assert.ok(sawBottom&&sawRise&&sawPartial,'cycles include bottom contact, refloating and partial immersion');
});

test('manual ballast edits and pause preserve position; snapshots restore velocity and future motion',()=>{
  const a=createSubmarineDynamics();a.reset(0,{ballast:32});a.update(3,{ballast:32});const bottom=a.state();assert.ok(bottom.onBottom);
  const edited=a.update(3,{ballast:0});close(edited.centerY,bottom.centerY);close(edited.velocityY,bottom.velocityY);
  for(let i=0;i<20;i++)assert.deepEqual(a.update(3,{ballast:0}),edited,'paused updates must not integrate');
  const rising=a.update(3.5,{ballast:0});assert.ok(rising.centerY>bottom.centerY&&rising.velocityY>0);
  const saved=a.snapshot(),b=createSubmarineDynamics();b.restore(saved,3.5,{ballast:0});assert.deepEqual(b.state(),a.state());
  assert.deepEqual(b.update(3.6,{ballast:0}),a.update(3.6,{ballast:0}));
  const back=a.update(1,{ballast:5});b.reset(1,{ballast:5});assert.deepEqual(back,b.state(),'backward seeks restart deterministically');
});

test('submarine integration is stable across normal frame rates',()=>{
  const simulate=hz=>{const d=createSubmarineDynamics(),offset=guidedStart('submarine',{ballast:10});d.reset(0,{ballast:10});const rows=[];for(let i=1;i<=24*hz;i++){d.update(i/hz,previewInputs('submarine',i/hz+offset));if(i%hz===0)rows.push(d.state());}return rows;};
  const a=simulate(30),b=simulate(120);for(let i=0;i<a.length;i++){close(a[i].centerY,b[i].centerY,.005);close(a[i].velocityY,b[i].velocityY,.01);}
});
