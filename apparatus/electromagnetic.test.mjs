import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  devices,
  motorPhysics,
  speakerPhysics,
  relayPhysics,
  generatorPhysics,
} from './electromagnetic.mjs';

const byId = Object.fromEntries(devices.map((device) => [device.id, device]));

test('four electromagnetic devices expose complete teaching metadata and deterministic readouts', () => {
  assert.deepEqual(devices.map((device) => device.id), ['dc-motor', 'speaker', 'relay', 'generator']);
  for (const device of devices) {
    assert.equal(device.category, 'electromagnetic');
    assert.ok(device.sources.length >= 1, `${device.id} needs authoritative sources`);
    assert.ok(device.stages.length >= 3, `${device.id} needs teaching moments`);
    assert.equal(device.stages.length, 4, `${device.id} needs four moments aligned to its readout phase`);
    assert.ok(device.stages.every((stage) => /\p{Script=Han}/u.test(stage.name)), `${device.id} stage names should be Chinese`);
    assert.ok(device.stages.every((stage) => !/[A-Za-z]/.test(stage.name)), `${device.id} stage names should not contain English labels`);
    assert.ok(device.controls.length >= 1, `${device.id} needs a control`);
    const first = device.readout(1.25, {});
    assert.deepEqual(device.readout(1.25, {}), first, `${device.id} readout should be pure`);
    assert.ok(first.values.length >= 2);
    assert.ok(first.values.every((value) => value.label && value.unit !== undefined));
  }
});

test('DC motor voltage changes the solved steady speed, current and back EMF together', () => {
  const stopped = motorPhysics(0, { voltage: 0 });
  const driven = motorPhysics(0, { voltage: 6 });
  assert.equal(stopped.rpm, 0);
  assert.equal(stopped.current, 0);
  assert.ok(driven.rpm > 400);
  assert.ok(driven.current > 0);
  assert.ok(driven.backEmf > 0);
  assert.ok(Math.abs(driven.voltage - driven.current * 2.4 - driven.backEmf) < 1e-10);
  assert.ok(Math.abs(.025 * driven.current - .001 * driven.omega) < 1e-10);
});

test('motor, speaker and generator phase readouts visit four matching quarter-cycle stages', () => {
  const motor = motorPhysics(0, { voltage: 4 });
  const motorRate = motor.omega * .22;
  for (let quarter = 0; quarter < 4; quarter++) {
    const t = (quarter + .25) * (Math.PI / 2) / motorRate;
    const readout = byId['dc-motor'].readout(t, { voltage: 4 });
    assert.equal(readout.phaseIndex, quarter);
    assert.equal(readout.title, byId['dc-motor'].stages[quarter].title);
  }

  const frequency = 1.5;
  for (let quarter = 0; quarter < 4; quarter++) {
    const t = (quarter + .25) / (4 * frequency);
    const readout = byId.speaker.readout(t, { level: .65, frequency });
    assert.equal(readout.phaseIndex, quarter);
    assert.equal(readout.title, byId.speaker.stages[quarter].title);
  }

  for (let quarter = 0; quarter < 4; quarter++) {
    const t = (quarter + .25) / 4;
    const readout = byId.generator.readout(t, { rpm: 60 });
    assert.equal(readout.phaseIndex, quarter);
    assert.equal(readout.title, byId.generator.stages[quarter].title);
    assert.equal(Math.sign(Number(readout.values[0].value)), [-1, 1, 1, -1][quarter]);
  }
});

test('speaker signal amplitude and frequency drive a coherent reversible cone motion', () => {
  const silent = speakerPhysics(.17, { level: 0, frequency: 2 });
  const quarter = speakerPhysics(.125, { level: 1, frequency: 2 });
  const half = speakerPhysics(.25, { level: 1, frequency: 2 });
  const slowQuarter = speakerPhysics(.125, { level: 1, frequency: 1 });
  assert.equal(silent.excursion, 0);
  assert.ok(quarter.excursion > .023);
  assert.ok(Math.abs(half.excursion) < 1e-12);
  assert.ok(Math.abs(slowQuarter.excursion - .024 * Math.sin(Math.PI / 4)) < 1e-12);
  assert.ok(quarter.relativeCurrent > 0);
  assert.ok(speakerPhysics(.375, { level: 1, frequency: 2 }).excursion < 0);
});

test('relay current crosses the pull-in threshold and transfers the contact state', () => {
  const released = relayPhysics(0, { coilCurrent: 0 });
  const below = relayPhysics(0, { coilCurrent: .51 });
  const picked = relayPhysics(0, { coilCurrent: .52 });
  const readoutOff = byId.relay.readout(0, { coilCurrent: .2 });
  const readoutOn = byId.relay.readout(0, { coilCurrent: .8 });
  assert.equal(released.travel, 0);
  assert.equal(released.closed, false);
  assert.equal(below.closed, false);
  assert.equal(picked.closed, true);
  assert.ok(picked.travel > below.travel);
  assert.ok(Math.abs(.80 * Math.sin(picked.angle) - picked.travel) < 1e-10, 'armature lever and moving contact should remain kinematically connected');
  assert.match(byId.relay.readout(0,{coilCurrent:.4}).values[2].value,/均断开/);
  assert.match(readoutOff.values[2].value, /NC/);
  assert.match(readoutOn.values[2].value, /NO/);
  assert.deepEqual([0, .2, .4, .52].map((coilCurrent) => byId.relay.readout(0, { coilCurrent }).phaseIndex), [0, 1, 2, 3]);
});

// Build the real meshes under a minimal canvas stub. This is not a screenshot
// substitute: it lets the tests measure rendered vertices, rather than trusting
// duplicated nominal dimensions or pre-existing readout tests.
globalThis.document = {createElement:()=>({width:0,height:0,getContext:()=>({fillText(){}})})};
const vertex = new THREE.Vector3();
function vertices(object, callback) {
  object.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;
    for(let i=0;i<p.count;i++){vertex.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);callback(vertex,o);}
  });
}
function position(root,name){return root.getObjectByName(name).getWorldPosition(new THREE.Vector3());}

test('motor and generator windings have the required area normal and real connected terminals',()=>{
  for(const [id,expected] of [['dc-motor',[0,-1,0]],['generator',[0,0,1]]]) {
    const model=byId[id].build(), prefix=id==='dc-motor'?'motor':'generator';
    const w=model.root.getObjectByName(`${prefix}-winding`),p=w.userData.path;
    const area=new THREE.Vector3();for(let i=1;i<p.length;i++)area.add(new THREE.Vector3(...p[i-1]).cross(new THREE.Vector3(...p[i])));
    assert.ok(area.normalize().dot(new THREE.Vector3(...expected))>.98,`${id}: winding area normal`);
    for(const [side,endpoint] of [['start',p[0]],['end',p.at(-1)]]){
      const lead=model.root.getObjectByName(`${prefix}-${side}-lead`),terminal=model.root.getObjectByName(`${prefix}-${side}-terminal`);
      assert.deepEqual((terminal||lead).userData.path[0],endpoint);
      if(terminal)assert.deepEqual(terminal.userData.path.at(-1),lead.userData.path[0]);
    }
    // Adjacent long runs must leave enamel clearance, rather than overlapping copper.
    assert.ok(new THREE.Vector3(...p[0]).distanceTo(new THREE.Vector3(...p[4]))>2*w.userData.radius);
  }
});

test('full-turn actual rotating mesh sweep clears both magnetic pole faces and base',()=>{
  for(const [id,prefix,rate,inputs] of [
    ['dc-motor','motor',motorPhysics(0,{voltage:4}).omega*.22,{voltage:4}],
    ['generator','generator',2*Math.PI,{rpm:60}],
  ]) {
    const m=byId[id].build();let minPole=Infinity,minBase=Infinity;
    for(let i=0;i<=180;i++) {
      m.update(i*2*Math.PI/180/rate,inputs);m.root.updateMatrixWorld(true);
      const poleBounds=[-1,1].map(sign=>new THREE.Box3().setFromObject(m.root.getObjectByName(`${prefix}-pole-${sign}`)));
      const rotor=m.root.getObjectByName(`${prefix}-rotor-motion`);
      vertices(rotor,(p,o)=>{
        if(o.name.includes('winding')||o.name.includes('lead')) {
          for(const b of poleBounds){assert.ok(!b.containsPoint(p),`${id}: conductor penetrates pole at sample ${i}`);minPole=Math.min(minPole,b.distanceToPoint(p));}
          minBase=Math.min(minBase,p.y-.15);
        }
      });
    }
    assert.ok(minPole>.007,`${id}: pole clearance ${minPole}`);
    assert.ok(minBase>.12,`${id}: base clearance ${minBase}`);
  }
});

test('motor commutation yields forward Lorentz torque throughout the cycle including open dead points',()=>{
  const rate=motorPhysics(0,{voltage:4}).omega*.22;
  for(let i=0;i<720;i++){
    const phase=i*Math.PI/360,s=motorPhysics(phase/rate,{voltage:4});
    const r=new THREE.Vector3(.18*Math.cos(phase),.18*Math.sin(phase),0);
    const force=new THREE.Vector3(0,0,s.polarity).cross(new THREE.Vector3(1,0,0));
    assert.ok(r.cross(force).z>=-1e-12);
  }
  assert.equal(motorPhysics(Math.PI/2/rate,{voltage:4}).polarity,0);
  assert.equal(motorPhysics(3*Math.PI/2/rate,{voltage:4}).polarity,0);
});

test('speaker coil and hollow former clear the pole and stay over the gap over maximum excursion',()=>{
  const m=byId.speaker.build();
  for(let i=0;i<=48;i++){
    m.update(i/48,{level:1,frequency:1});m.root.updateMatrixWorld(true);
    let min=Infinity,max=0,zmin=Infinity,zmax=-Infinity;
    vertices(m.root.getObjectByName('speaker-voice-coil'),p=>{const r=Math.hypot(p.x,p.y-.72);min=Math.min(min,r);max=Math.max(max,r);zmin=Math.min(zmin,p.z);zmax=Math.max(zmax,p.z);});
    assert.ok(min>.105+.005&&max<.14-.005,'coil radially inside magnetic gap');
    assert.ok(zmin<-.25&&zmax>-.17,'coil remains over full pole-plate depth');
    vertices(m.root.getObjectByName('speaker-former'),p=>assert.ok(Math.hypot(p.x,p.y-.72)>.105+.004));
    for(const name of ['speaker-surround-surface','speaker-spider-surface']){
      const mesh=m.root.getObjectByName(name),p=mesh.geometry.attributes.position;
      const expected=name.includes('surround')?.18:-.055;
      assert.ok(Math.abs(p.getZ(p.count-1)-expected)<1e-6,'outer suspension boundary fixed');
      assert.ok(Math.abs(p.getZ(0)-expected-m.root.getObjectByName('speaker-motion').position.z)<1e-6,'inner boundary moves with cone');
    }
  }
});

test('relay geometric contact distances agree with circuit state across entire armature travel',()=>{
  const m=byId.relay.build();
  for(let i=0;i<=120;i++){
    const s=m.update(0,{coilCurrent:i/100});m.root.updateMatrixWorld(true);
    const p=position(m.root,'relay-moving-contact');
    const nc=p.distanceTo(position(m.root,'relay-NC'))-.03,no=p.distanceTo(position(m.root,'relay-NO'))-.03;
    assert.ok(nc>=-1e-7&&no>=-1e-7,'contact surfaces cannot interpenetrate');
    assert.equal(Math.abs(nc)<1e-7,s.ncClosed,'NC physical contact agrees with readout');
    assert.equal(Math.abs(no)<1e-7,s.closed,'NO physical contact agrees with readout');
    const pole=new THREE.Box3().setFromObject(m.root.getObjectByName('relay-pole'));
    vertices(m.root.getObjectByName('relay-armature-motion'),v=>assert.ok(!pole.containsPoint(v),'armature must stop above pole'));
  }
});

test('generator induced emf is minus the derivative of actual rotated area flux',()=>{
  const m=byId.generator.build(),normal=new THREE.Vector3(0,0,1);
  for(let i=0;i<72;i++){
    const t=i/72,s=m.update(t,{rpm:60}),rot=m.root.getObjectByName('generator-rotor-motion');
    const flux=.192*normal.clone().applyQuaternion(rot.quaternion).x;
    assert.ok(Math.abs(flux-s.fluxLinkage)<1e-12);
    const h=1e-6,df=(generatorPhysics(t+h,{rpm:60}).fluxLinkage-generatorPhysics(t-h,{rpm:60}).fluxLinkage)/(2*h);
    assert.ok(Math.abs(s.emf+df)<1e-8);
  }
});

test('real winding and rotating lead vertices clear the shaft, not just the stator poles',()=>{
  for(const [id,prefix,axis,radius] of [['dc-motor','motor','z',.028],['generator','generator','y',.024]]){
    const m=byId[id].build();m.update(0);m.root.updateMatrixWorld(true);
    for(const suffix of ['winding','start-lead','end-lead'])vertices(m.root.getObjectByName(`${prefix}-${suffix}`),v=>{
      const radial=axis==='z'?Math.hypot(v.x,v.y-.52):Math.hypot(v.x,v.z);
      assert.ok(radial>radius+.002,`${id} ${suffix} penetrates shaft: ${radial}`);
    });
  }
});

test('phase offsets preserve angle when rate changes and when rotation stops',()=>{
  for(const [id,fn,oldInputs,newInputs] of [
    ['dc-motor',motorPhysics,{voltage:4},{voltage:0}],
    ['generator',generatorPhysics,{rpm:60},{rpm:0}],
    ['speaker',speakerPhysics,{frequency:1.5},{frequency:.5}],
  ]) {
    const t=1.234,phase=fn(t,oldInputs).phase,offset=phase-byId[id].phaseRate(newInputs)*t;
    assert.ok(Math.abs(fn(t,{...newInputs,_phaseOffset:offset}).phase-phase)<1e-12);
  }
});

test('generator lower-ring lead passes through the other ring insulated bore without shorting it',()=>{
  const m=byId.generator.build();m.update(0);m.root.updateMatrixWorld(true);
  let samples=0;
  vertices(m.root.getObjectByName('generator-start-lead'),v=>{
    if(Math.abs(v.y-.38)<.018){samples++;assert.ok(Math.hypot(v.x,v.z)<.041,'lower lead must remain inside upper ring insulating bore');}
  });
  assert.ok(samples>0);
});

test('generator output leads clear brush supports and lower-ring lead uses a real sleeve opening',()=>{
  const m=byId.generator.build();m.update(0);m.root.updateMatrixWorld(true);
  const supports=[0,1].flatMap(i=>['holder','stand'].map(kind=>new THREE.Box3().setFromObject(m.root.getObjectByName(`generator-brush-${kind}-${i}`))));
  for(const i of [0,1])vertices(m.root.getObjectByName(`generator-output-wire-${i}`),v=>{
    for(const b of supports)assert.ok(b.distanceToPoint(v)>.001,'wire and gold band must clear brush supports');
  });
  const sleeve=m.root.getObjectByName('generator-ring-sleeve-1');
  const ray=new THREE.Raycaster(new THREE.Vector3(.033,.5,0),new THREE.Vector3(0,-1,0));
  assert.equal(ray.intersectObject(sleeve).length,0,'feed-through is open in the actual mesh');
  ray.ray.origin.set(0,.5,.033);assert.ok(ray.intersectObject(sleeve).length>0,'insulation remains around the opening');
  let checked=0;
  vertices(m.root.getObjectByName('generator-start-lead'),v=>{
    if(Math.abs(v.y-.38)<.0275){checked++;assert.ok(Math.hypot(v.x-.033,v.z)<.0073,'red conductor and highlight stay inside feed-through');}
  });
  assert.ok(checked>0);
  const end=m.root.getObjectByName('generator-start-lead').userData.path.at(-1);
  assert.ok(Math.abs(end[1]+.79-(.30+.018))<1e-8&&Math.hypot(end[0],end[2])>.041,'red lead terminates on its own copper ring top face');
});

test('generator colored jackets and highlights stay below the winding with connected copper tails',()=>{
  const m=byId.generator.build();m.update(0);m.root.updateMatrixWorld(true);
  const coil=m.root.getObjectByName('generator-winding'),bounds=new THREE.Box3().setFromObject(coil);
  for(const side of ['start','end']){
    const lead=m.root.getObjectByName(`generator-${side}-lead`),terminal=m.root.getObjectByName(`generator-${side}-terminal`);
    vertices(lead,v=>assert.ok(v.y<bounds.min.y-.015,'colored wire and gold must not enter or poke through copper turns'));
    const a=terminal.userData.path[0],b=terminal.userData.path.at(-1);
    assert.equal(a[0],b[0]);assert.equal(a[2],b[2]);assert.ok(b[1]<a[1]-.025,'copper exit goes straight away from winding before bending');
    assert.deepEqual(b,lead.userData.path[0]);
    const ringY=side==='start'?.30:.38,end=lead.userData.path.at(-1),radial=Math.hypot(end[0],end[2]),outer=lead.userData.radius*1.1;
    assert.ok(Math.abs(end[1]+.79-(ringY+.018))<1e-8,'lead terminates at its slip ring top surface');
    assert.ok(radial-outer>.041&&radial+outer<.095-.003,'colored terminal and gold stay inside copper ring rim');
  }
  const a=m.root.getObjectByName('generator-start-lead'),b=m.root.getObjectByName('generator-end-lead');
  for(let i=0;i<=600;i++){
    const p=a.geometry.parameters.path.getPoint(i/600);
    for(const segment of b.geometry.parameters.path.curves){
      const line=new THREE.Line3(segment.v1,segment.v2),q=line.closestPointToPoint(p,true,new THREE.Vector3());
      assert.ok(p.distanceTo(q)>(a.userData.radius+b.userData.radius)*1.1+.002,'red and blue jackets including gold have independent routes');
    }
  }
});

test('speaker flexible lead anchors remain fixed and moving endpoints stay on winding ends',()=>{
  const m=byId.speaker.build();
  for(const t of [0,.25,.5,.75,1]){
    const s=m.update(t,{level:1,frequency:1});
    for(const sign of [-1,1]){
      const p=m.root.getObjectByName(`speaker-flex-${sign}`).userData.path;
      assert.deepEqual(p[0],[sign*.27,.43,-.06]);
      assert.ok(Math.abs(p.at(-1)[2]-(sign<0?-.275:-.145)-s.excursion)<1e-12);
    }
    const a=m.root.getObjectByName('speaker-flex--1').userData.path;
    const b=m.root.getObjectByName('speaker-flex-1').userData.path;
    // Densely sample one path and measure exact point-to-segment distance on
    // the other; sample pitch <= 0.0015, versus 0.006 combined wire diameter.
    for(let i=1;i<a.length;i++) {
      const line=new THREE.Line3(new THREE.Vector3(...a[i-1]),new THREE.Vector3(...a[i]));
      const n=Math.ceil(line.distance()/.0015);
      for(let k=0;k<=n;k++){
        const p=line.at(k/n,new THREE.Vector3());
        for(let j=1;j<b.length;j++){
          const q=new THREE.Line3(new THREE.Vector3(...b[j-1]),new THREE.Vector3(...b[j])).closestPointToPoint(p,true,new THREE.Vector3());
          assert.ok(p.distanceTo(q)>.008,'separate speaker wires must not short');
        }
      }
    }
  }
});

test('hand-cranked generator obeys the flux-rate model and reverses polarity each half turn', () => {
  const stopped = generatorPhysics(.25, { rpm: 0 });
  const atStart = generatorPhysics(0, { rpm: 60 });
  const halfTurn = generatorPhysics(.5, { rpm: 60 });
  const faster = generatorPhysics(0, { rpm: 120 });
  assert.equal(stopped.emf, 0);
  assert.equal(stopped.rms, 0);
  assert.ok(atStart.emf < 0);
  assert.ok(halfTurn.emf > 0);
  assert.ok(Math.abs(faster.rms - atStart.rms * 2) < 1e-10);
  assert.ok(Math.abs(atStart.current - atStart.emf / 10) < 1e-10);
});
