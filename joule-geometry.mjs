/**
 * Original teaching geometry for Joule's paddle-wheel experiment.
 * All fixed dimensions are in metres. It is a coherent schematic mechanism,
 * not a historic replica or a scan of a museum object.
 */
import { JOULE_RIG } from './joule-model.mjs';

const boxGeo = (GEO, w, h, d, r = 0.003) => GEO.rbox(w, h, d, Math.min(r, w / 4, h / 4, d / 4), 2);
const cylinderY = (THREE, rTop, rBottom, h, n = 32) => new THREE.CylinderGeometry(rTop, rBottom, h, n, 1, false);
const cylinderZ = (THREE, rTop, rBottom, h, n = 32) => new THREE.CylinderGeometry(rTop, rBottom, h, n, 1, false).rotateX(Math.PI / 2);
const discZ = (GEO, r, h, n = 32, rIn = 0) => GEO.disc(r, h, Math.min(.002, h * .12), n, rIn).rotateX(Math.PI / 2);
const pointOn = (THREE, cx, cy, cz, r, a) => new THREE.Vector3(cx + r * Math.cos(a), cy + r * Math.sin(a), cz);

function sectorWallGeometry(THREE, innerR, outerR, y0, y1, a0, span, count = 40) {
  const positions = [], indices = [];
  const pushQuad = (a, b, c, d) => {
    const n = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d);
    indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  const pt = (r, y, a) => [r * Math.cos(a), y, r * Math.sin(a)];
  for (let i = 0; i < count; i++) {
    const a = a0 + span * i / count, b = a0 + span * (i + 1) / count;
    const ob0 = pt(outerR, y0, a), ob1 = pt(outerR, y0, b), ot0 = pt(outerR, y1, a), ot1 = pt(outerR, y1, b);
    const ib0 = pt(innerR, y0, a), ib1 = pt(innerR, y0, b), it0 = pt(innerR, y1, a), it1 = pt(innerR, y1, b);
    pushQuad(ob0, ot0, ot1, ob1); // outer wall
    pushQuad(ib0, ib1, it1, it0); // inner wall
    pushQuad(ot0, it0, it1, ot1); // top rim
    pushQuad(ob0, ob1, ib1, ib0); // bottom rim
  }
  const a = a0, b = a0 + span;
  pushQuad(pt(outerR, y0, a), pt(innerR, y0, a), pt(innerR, y1, a), pt(outerR, y1, a));
  pushQuad(pt(outerR, y0, b), pt(outerR, y1, b), pt(innerR, y1, b), pt(innerR, y0, b));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function sectorDiskGeometry(THREE, radius, y, a0, span, count = 40) {
  const positions = [0, y, 0], indices = [];
  for (let i = 0; i <= count; i++) {
    const a = a0 + span * i / count;
    positions.push(radius * Math.cos(a), y, radius * Math.sin(a));
  }
  // Reverse the fan so the basin floor's interior face points upward.
  for (let i = 0; i < count; i++) indices.push(0, i + 2, i + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function arcRoute(THREE, start, end, cx, cy, cz, radius, a0, a1, segments = 16) {
  const points = [new THREE.Vector3(...start)];
  for (let i = 1; i < segments; i++) {
    const a = a0 + (a1 - a0) * i / segments;
    points.push(pointOn(THREE, cx, cy, cz, radius, a));
  }
  points.push(new THREE.Vector3(...end));
  return new THREE.CatmullRomCurve3(points, false, 'centripetal');
}

function lidSectorGeometry(THREE, outerR, innerR, y0, thickness, centerZ, a0, a1, sensorHole) {
  // Shape-plane Y maps to world -Z after rotation; front is positive world Z.
  const shape = new THREE.Shape();
  shape.moveTo(outerR * Math.cos(a0), outerR * Math.sin(a0));
  shape.absarc(0, 0, outerR, a0, a1, false);
  shape.lineTo(innerR * Math.cos(a1), innerR * Math.sin(a1));
  shape.absarc(0, 0, innerR, a1, a0, true);
  shape.closePath();
  if (sensorHole) {
    const hole = new THREE.Path();
    hole.absarc(sensorHole.x, -sensorHole.z, sensorHole.r, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 36, steps: 1 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, centerZ);
  return geo;
}

function bevelGear(THREE, GEO, { teeth = 16, module = .0045, width = .042, bore = .009 } = {}) {
  const geo = GEO.gear({ teeth, module, width, bore, helix: 0, spokes: 0 });
  geo.computeBoundingBox();
  const p = geo.attributes.position;
  const z0 = geo.boundingBox?.min.z ?? -width / 2;
  const z1 = geo.boundingBox?.max.z ?? width / 2;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), t = Math.max(0, Math.min(1, (z - z0) / Math.max(1e-6, z1 - z0)));
    const scale = 1 - .72 * t;
    p.setXY(i, p.getX(i) * scale, p.getY(i) * scale);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function buildExperiment({ THREE, GEO, MAT, root }) {
  if (!THREE || !GEO || !MAT || !root) throw new Error('buildExperiment requires THREE, GEO, MAT, and root');

  const parts = {}, anchors = {};
  const materialCache = new Map();
  const materialFactory = {
    steel: () => MAT.stainless({ color: '#99a6a8', roughness: .28 }),
    darkSteel: () => MAT.steelDark({ color: '#39474b', roughness: .42 }),
    copper: () => MAT.copper({ color: '#d28c66', roughness: .29 }),
    darkCopper: () => MAT.copper({ color: '#a85f40', roughness: .36 }),
    brass: () => MAT.brass({ color: '#c6a04d', roughness: .27 }),
    black: () => MAT.rubber({ color: '#313a3b', roughness: .72 }),
    paint: () => MAT.paint({ color: '#e6ecea', roughness: .31, clearcoat: .38 }),
    blue: () => MAT.paint({ color: '#567b8d', roughness: .33, clearcoat: .3 }),
    glass: () => MAT.plastic({ color: '#c5e0e7', roughness: .12, transparent: true, opacity: .26, depthWrite: false }),
    water: () => MAT.fluid({ color: '#5ca8c6', roughness: .11, transparent: true, opacity: .42, depthWrite: false }),
    mercury: () => MAT.paint({ color: '#d94636', roughness: .25, clearcoat: .2 }),
    rope: () => MAT.steelDark({ color: '#56636a', roughness: .5 }),
  };
  const material = (name) => {
    if (!materialCache.has(name)) materialCache.set(name, materialFactory[name]());
    return materialCache.get(name);
  };
  const add = (id, geo, finish = 'steel', options = {}) => {
    const mesh = new THREE.Mesh(geo, material(finish));
    mesh.name = options.name || `${id}-${finish}`;
    if (options.pos) mesh.position.set(...options.pos);
    if (options.rot) mesh.rotation.set(...options.rot);
    if (options.scale) mesh.scale.set(...options.scale);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    mesh.userData.partId = id;
    mesh.userData.role = options.role || 'solid';
    mesh.userData.materialName = finish;
    if (options.shell) mesh.userData.shell = true;
    if (options.cutHide) mesh.userData.cutHide = true;
    if (options.parent) options.parent.add(mesh);
    else parts[id].add(mesh);
    return mesh;
  };
  const addBox = (id, size, finish = 'steel', options = {}) => add(id, boxGeo(GEO, ...size, options.radius ?? .003), finish, options);
  const addY = (id, rTop, rBottom, h, finish = 'steel', options = {}) => add(id, cylinderY(THREE, rTop, rBottom, h, options.segments || 32), finish, options);
  const addZ = (id, rTop, rBottom, h, finish = 'steel', options = {}) => add(id, cylinderZ(THREE, rTop, rBottom, h, options.segments || 32), finish, options);
  const addDiscZ = (id, r, h, finish = 'steel', options = {}) => add(id, discZ(GEO, r, h, options.segments || 32, options.inner || 0), finish, options);
  const line = (id, a, b, radius, finish, options = {}) => {
    const curve = new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b));
    return add(id, new THREE.TubeGeometry(curve, Math.max(8, Math.ceil(curve.getLength() * 400)), radius, 8, false), finish, options);
  };
  const addBeam = (id, a, b, width, depth, finish = 'steel') => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), delta = B.clone().sub(A);
    const mesh = addBox(id, [width, delta.length(), depth], finish, { pos: A.clone().add(B).multiplyScalar(.5).toArray() });
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  };

  const anchorMap = {
    frame: [0, .88, -.15], calorimeter: [0, .38, .06], water: [0, .35, .06], baffles: [0, .34, .06],
    stirrer: [0, .36, .06], drive: [0, 1.27, .06], pulleys: [0, 1.34, .06], ropes: [0, .90, .06],
    weights: [0, .62, .06], thermometer: [.014, .49, .083],
  };
  for (const [id, at] of Object.entries(anchorMap)) {
    anchors[id] = at;
    parts[id] = new THREE.Group();
    parts[id].name = id;
    parts[id].position.set(0, 0, 0);
    root.add(parts[id]);
  }

  // Painted steel frame, drop ruler, bearing bridge and the calorimeter cradle.
  addBox('frame', [1.38, .045, .48], 'blue', { pos: [0, .055, -.06] });
  addBox('frame', [1.28, .018, .38], 'steel', { pos: [0, .086, -.06] });
  for (const x of [-.59, .59]) {
    addBox('frame', [.038, 1.55, .042], 'blue', { pos: [x, .84, -.17], radius: .008 });
    addBox('frame', [.07, .045, .14], 'steel', { pos: [x, .112, -.17] });
    addY('frame', .027, .027, .025, 'black', { pos: [x, .022, -.07] });
    addBeam('frame', [x, .22, -.17], [x * .83, .69, -.17], .018, .024, 'steel');
    // Fine ruler ticks make the changing drop height inspectable.
    const rulerX = Math.sign(x) * .625;
    addBox('frame', [.010, .94, .006], 'brass', { pos: [rulerX, .81, .035] });
    for (let i = 0; i <= 10; i++) {
      const y = .36 + i * .09;
      addBox('frame', [i % 5 === 0 ? .046 : .026, .003, .008], 'steel', { pos: [rulerX + (x < 0 ? .022 : -.022), y, .037] });
    }
  }
  addBox('frame', [1.28, .052, .095], 'blue', { pos: [0, 1.645, -.12], radius: .008 });
  addBox('frame', [.83, .030, .12], 'steel', { pos: [0, 1.56, -.12] });
  addBeam('frame', [0, 1.56, -.12], [0, 1.56, .33], .025, .025, 'steel');
  addBox('frame', [.66, .04, .05], 'steel', { pos: [0, .285, .06] });
  for (const x of [-.19, .19]) addBox('frame', [.025, .22, .035], 'steel', { pos: [x, .195, .06] });
  for (const z of [-.21, .33]) {
    for (const x of [-.035, .035]) addBeam('frame', [x, 1.26, z], [x, 1.56, z], .016, .020, 'steel');
    addBox('frame', [.09, .018, .075], 'darkSteel', { pos: [0, 1.252, z] });
    addZ('frame', .025, .025, .08, 'darkSteel', { pos: [0, 1.56, z] });
  }
  // Cross-depth arms carry the two pulley bearings forward from the rear frame.
  for (const [cx, cy, cz] of [JOULE_RIG.pulleyLeft, JOULE_RIG.pulleyRight]) {
    const postX = Math.sign(cx) * .59;
    addBeam('frame', [postX, cy, -.13], [cx, cy, cz], .026, .030, 'steel');
    addBox('frame', [.075, .026, .045], 'steel', { pos: [cx, cy, cz] });
  }

  // Copper calorimeter, closed front and rear sectors with a wide removable front.
  const cupBottom = JOULE_RIG.cupBottomY, cupTop = JOULE_RIG.cupTopY;
  const cupInner = JOULE_RIG.cupInnerRadiusM, cupOuter = .088;
  const splitSegments = 42;
  const frontStart = -Math.PI / 9, frontSpan = 11 * Math.PI / 9;
  const rearStart = frontStart + frontSpan, rearSpan = 7 * Math.PI / 9;
  // The 220-degree removable front sector gives the camera a broad inspection window.
  const frontWall = sectorWallGeometry(THREE, cupInner, cupOuter, cupBottom, cupTop, frontStart, frontSpan, splitSegments);
  const backWall = sectorWallGeometry(THREE, cupInner, cupOuter, cupBottom, cupTop, rearStart, rearSpan, splitSegments);
  add('calorimeter', frontWall, 'copper', { pos: [0, 0, .06], shell: true, cutHide: true, name: 'copper-removable-front-sector' });
  add('calorimeter', backWall, 'copper', { pos: [0, 0, .06], shell: true, name: 'copper-rear-sector' });
  add('calorimeter', sectorDiskGeometry(THREE, cupInner, cupBottom + .004, frontStart, frontSpan, splitSegments), 'copper', { pos: [0, 0, .06], shell: true, cutHide: true, name: 'copper-front-bottom' });
  add('calorimeter', sectorDiskGeometry(THREE, cupInner, cupBottom + .004, rearStart, rearSpan, splitSegments), 'copper', { pos: [0, 0, .06], shell: true, name: 'copper-rear-bottom' });
  const lidFront = lidSectorGeometry(THREE, cupOuter + .006, .012, cupTop, .008, .06,
    -10 * Math.PI / 9, Math.PI / 9, { x: .014, z: .023, r: .0055 });
  const lidBack = lidSectorGeometry(THREE, cupOuter + .006, .012, cupTop, .008, .06,
    Math.PI / 9, 8 * Math.PI / 9);
  add('calorimeter', lidFront, 'copper', { shell: true, cutHide: true, name: 'copper-front-lid-half' });
  add('calorimeter', lidBack, 'copper', { shell: true, name: 'copper-rear-lid-half' });
  const seal = GEO.tube(.014, .010, .018, 32);
  add('calorimeter', seal, 'darkCopper', { pos: [0, cupTop + .008, .06] });
  const topRimFront = new THREE.TorusGeometry(cupOuter + .003, .0028, 8, 48, frontSpan);
  const topRimRear = new THREE.TorusGeometry(cupOuter + .003, .0028, 8, 48, rearSpan);
  topRimFront.rotateZ(frontStart); topRimRear.rotateZ(rearStart);
  topRimFront.rotateX(Math.PI / 2); topRimRear.rotateX(Math.PI / 2);
  add('calorimeter', topRimFront, 'brass', { pos: [0, cupTop + .009, .06], shell: true, cutHide: true });
  add('calorimeter', topRimRear, 'brass', { pos: [0, cupTop + .009, .06], shell: true });
  const cradle = new THREE.TorusGeometry(cupOuter + .007, .006, 8, 48);
  cradle.rotateX(Math.PI / 2);
  add('calorimeter', cradle, 'steel', { pos: [0, cupBottom + .002, .06] });
  for (const x of [-cupOuter - .004, cupOuter + .004]) {
    addBox('calorimeter', [.012, .020, .012], 'brass', { pos: [x, cupBottom + .015, .06] });
    addY('calorimeter', .004, .004, .006, 'steel', { pos: [x, cupBottom + .027, .06] });
  }
  // Split-line lugs and rivets reinforce that the vessel halves are closed pieces.
  for (const x of [-cupOuter, cupOuter]) for (const y of [.325, .355, .385, .415]) {
    addBox('calorimeter', [.012, .022, .012], 'brass', { pos: [x, y, .06] });
    addY('calorimeter', .004, .004, .005, 'steel', { pos: [x, y, .069] });
  }

  // The water volume tracks its mass at the fixed calorimeter cross-section.
  const waterFloor = cupBottom + .004;
  const water = add('water', new THREE.CylinderGeometry(cupInner * .96, cupInner * .96, 1, 56, 1, false), 'water', {
    pos: [0, waterFloor, .06], name: 'water-volume', castShadow: false,
  });
  const meniscusGeo = new THREE.TorusGeometry(cupInner * .955, .0014, 6, 56);
  meniscusGeo.rotateX(Math.PI / 2);
  const waterMeniscus = add('water', meniscusGeo, 'glass', {
    pos: [0, waterFloor, .06], name: 'water-surface-edge', castShadow: false,
  });

  // Fixed wall baffles stand close to the vessel wall without touching the rotor.
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const x = Math.cos(a) * .075, z = .06 + Math.sin(a) * .075;
    const plate = addBox('baffles', [.006, .060, .035], 'darkCopper', { pos: [x, cupBottom + .036, z] });
    plate.rotation.y = -a;
    addBox('baffles', [.013, .004, .008], 'brass', { pos: [x * 1.12, cupBottom + .068, z + (z >= .06 ? .004 : -.004)] });
  }

  // Separate rotating input and output axes let the one-way clutch freewheel on reset.
  const axis = JOULE_RIG.shaftAxis;
  const driveRotor = new THREE.Group();
  driveRotor.name = 'horizontal-drive-rotor';
  driveRotor.position.set(...axis);
  parts.drive.add(driveRotor);
  const shaft = addZ('drive', .009, .009, .47, 'steel', { pos: [0, 0, 0], parent: driveRotor });
  addZ('drive', .014, .014, .038, 'brass', { pos: [0, 0, -.238], parent: driveRotor });
  addZ('drive', .014, .014, .038, 'brass', { pos: [0, 0, .238], parent: driveRotor });
  for (const [z, color] of [[JOULE_RIG.pulleyLeft[2], 'darkSteel'], [JOULE_RIG.pulleyRight[2], 'darkSteel']]) {
    const localZ = z - axis[2];
    addZ('drive', .043, .043, .052, 'darkSteel', { pos: [0, 0, localZ], parent: driveRotor });
    for (const dz of [-.021, .021]) addZ('drive', .047, .047, .003, 'brass', { pos: [0, 0, localZ + dz], parent: driveRotor });
    addZ('drive', .034, .034, .003, 'black', { pos: [0, 0, localZ], parent: driveRotor });
  }
  const bevel = bevelGear(THREE, GEO, { teeth: 16, module: .0048, width: .042, bore: .009 });
  const horizontalGear = add('drive', bevel, 'brass', { pos: [0, 0, -.021], parent: driveRotor, name: 'horizontal-bevel-gear' });
  horizontalGear.material.side = THREE.DoubleSide;
  addZ('drive', .020, .020, .11, 'steel', { pos: [0, 0, -.27], parent: driveRotor });
  addZ('drive', .020, .020, .11, 'steel', { pos: [0, 0, .27], parent: driveRotor });
  // Bearings, caps and a legible one-way pawl at the vertical output clutch.
  addY('drive', .030, .030, .020, 'darkSteel', { pos: [0, axis[1] + .015, axis[2]] });
  addY('drive', .024, .024, .011, 'brass', { pos: [.046, axis[1] - .063, axis[2]] });
  addBeam('drive', [.046, axis[1] - .063, axis[2]], [.026, axis[1] - .065, axis[2]], .006, .008, 'steel');
  addY('drive', .003, .003, .018, 'brass', { pos: [.048, axis[1] - .071, axis[2]] });
  // A small hand lever indicates that the weights are rewound by the operator.
  addBeam('drive', [-.10, 1.27, .06], [-.16, 1.27, .06], .006, .008, 'steel');
  addZ('drive', .010, .010, .018, 'brass', { pos: [-.16, 1.27, .06] });

  // Paddle shaft and water rotor; its absolute angle only advances during a drop.
  const stirrerRotor = new THREE.Group();
  stirrerRotor.name = 'stirrer-output-rotor';
  stirrerRotor.position.set(...axis);
  parts.stirrer.add(stirrerRotor);
  addY('stirrer', .007, .009, .95, 'steel', { pos: [0, -.475, 0], parent: stirrerRotor });
  addY('stirrer', .015, .015, .022, 'brass', { pos: [0, -.94, 0], parent: stirrerRotor });
  addY('stirrer', .015, .015, .022, 'brass', { pos: [0, -.91, 0], parent: stirrerRotor });
  for (const y of [-.951, -.936]) {
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const vane = addBox('stirrer', [.0028, .015, .026], 'darkCopper', {
        pos: [Math.cos(a) * .026, y, Math.sin(a) * .026], parent: stirrerRotor,
      });
      vane.rotation.y = -a;
    }
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const spoke = addBox('stirrer', [.045, .003, .004], 'brass', {
        pos: [Math.cos(a) * .021, y, Math.sin(a) * .021], parent: stirrerRotor,
      });
      spoke.rotation.y = -a;
    }
  }
  const verticalGearRotor = new THREE.Group();
  verticalGearRotor.name = 'vertical-bevel-input';
  verticalGearRotor.position.set(...axis);
  parts.stirrer.add(verticalGearRotor);
  const verticalGear = add('stirrer', bevel.clone(), 'brass', { pos: [0, -.021, 0], rot: [-Math.PI / 2, 0, 0], parent: verticalGearRotor, name: 'vertical-bevel-gear' });
  verticalGear.material.side = THREE.DoubleSide;
  // A toothed clutch ring remains with the paddle shaft while the pinion can freewheel.
  const ratchet = GEO.gear({ teeth: 20, module: .0026, width: .010, bore: .009, spokes: 0 });
  ratchet.rotateX(-Math.PI / 2);
  add('stirrer', ratchet, 'darkSteel', { pos: [0, -.065, 0], parent: stirrerRotor, name: 'one-way-ratchet-ring' });

  // Two fixed groove pulleys. Their vertical strands sit on the outer tangencies.
  const pulleyWheels = [];
  const pulleySpecs = [
    { side: 'left', center: JOULE_RIG.pulleyLeft, outerAngle: -Math.PI, bottomAngle: -Math.PI / 2, ropeZ: JOULE_RIG.massLeft[2] },
    { side: 'right', center: JOULE_RIG.pulleyRight, outerAngle: 0, bottomAngle: -Math.PI / 2, ropeZ: JOULE_RIG.massRight[2] },
  ];
  for (const spec of pulleySpecs) {
    const [x, y, z] = spec.center;
    const wheel = new THREE.Group();
    wheel.name = `${spec.side}-pulley-wheel`;
    wheel.position.set(x, y, z);
    parts.pulleys.add(wheel);
    const rim = new THREE.TorusGeometry(.067, .006, 10, 48);
    add('pulleys', rim, 'darkSteel', { parent: wheel, name: `${spec.side}-grooved-rim` });
    const groove = new THREE.TorusGeometry(.072, .0026, 6, 48);
    add('pulleys', groove, 'brass', { parent: wheel, name: `${spec.side}-groove` });
    for (const zSide of [-.009, .009]) {
      addDiscZ('pulleys', .069, .006, 'steel', { pos: [0, 0, zSide], parent: wheel, inner: .018 });
    }
    addZ('pulleys', .013, .013, .040, 'brass', { parent: wheel });
    for (let i = 0; i < 6; i++) {
      const spoke = addBox('pulleys', [.005, .112, .008], 'steel', { parent: wheel });
      spoke.rotation.z = i * Math.PI / 3;
    }
    addDiscZ('pulleys', .021, .012, 'darkSteel', { parent: wheel, inner: .008 });
    addDiscZ('pulleys', .012, .016, 'brass', { pos: [0, 0, .020], parent: wheel });
    pulleyWheels.push(wheel);
    // Bearing ears at both axle ends and a retained pin.
    for (const dz of [-.036, .036]) {
      addDiscZ('pulleys', .021, .016, 'darkSteel', { pos: [x, y, z + dz], inner: .011 });
      addZ('pulleys', .006, .006, .011, 'brass', { pos: [x, y, z + dz + Math.sign(dz) * .01] });
    }
  }

  // Static rope runs wrap over the pulleys; the vertical legs lengthen during a drop.
  const ropeTop = [];
  for (const spec of pulleySpecs) {
    const [cx, cy, cz] = spec.center;
    const ropeZ = spec.ropeZ;
    const left = spec.side === 'left';
    const drumY = left ? axis[1] + JOULE_RIG.drumRadiusM : axis[1] - JOULE_RIG.drumRadiusM;
    const bottomY = cy - JOULE_RIG.pulleyRadiusM;
    const drumPoint = [0, drumY, ropeZ];
    const bottomPoint = [cx, bottomY, ropeZ];
    const outerX = cx + (left ? -JOULE_RIG.pulleyRadiusM : JOULE_RIG.pulleyRadiusM);
    const outerPoint = [outerX, cy, ropeZ];
    const curve = arcRoute(THREE, bottomPoint, outerPoint, cx, cy, ropeZ, JOULE_RIG.pulleyRadiusM,
      spec.bottomAngle, spec.outerAngle, 18);
    const straight = new THREE.LineCurve3(new THREE.Vector3(...drumPoint), new THREE.Vector3(...bottomPoint));
    const path = new THREE.CurvePath(); path.add(straight); path.add(curve); path.getLength();
    add('ropes', new THREE.TubeGeometry(path, 96, .0025, 8, false), 'rope', { name: `${spec.side}-fixed-rope-run` });
    const tail = new THREE.Mesh(cylinderY(THREE, .0025, .0025, 1, 8), material('rope'));
    tail.name = `${spec.side}-moving-rope-tail`;
    tail.userData.partId = 'ropes'; tail.userData.role = 'moving-cord'; tail.userData.materialName = 'rope';
    tail.castShadow = false; parts.ropes.add(tail); ropeTop.push({ tail, x: outerX, y: cy, z: ropeZ, side: spec.side });
  }

  // Detailed, equal cast-iron hanging masses move together on their own rope legs.
  const massGroups = [];
  for (const [side, at] of [['left', JOULE_RIG.massLeft], ['right', JOULE_RIG.massRight]]) {
    const group = new THREE.Group(); group.name = `${side}-hanging-mass`;
    group.position.set(...at); parts.weights.add(group);
    add('weights', GEO.lathe([[0, -.038], [.026, -.038], [.032, -.032], [.034, -.022], [.034, .020], [.030, .031], [.018, .038], [0, .038]], 40), 'darkSteel', { parent: group, name: `${side}-cast-weight-body` });
    for (const y of [-.025, -.008, .011, .026]) addY('weights', .035, .035, .004, 'brass', { pos: [0, y, 0], parent: group });
    addY('weights', .008, .008, .030, 'steel', { pos: [0, .045, 0], parent: group });
    const bail = new THREE.TorusGeometry(.012, .0027, 8, 24);
    add('weights', bail, 'brass', { pos: [0, .054, 0], parent: group, name: `${side}-bail-ring` });
    addY('weights', .006, .006, .010, 'steel', { pos: [0, .042, 0], parent: group });
    addBox('weights', [.020, .012, .002], 'paint', { pos: [0, .005, .034], parent: group });
    massGroups.push({ group, x: at[0], z: at[2], side });
  }

  // Glass thermometer with an enlarged red column so small model rises remain visible.
  const thermometerX = .014, thermometerZ = .083;
  const stemBottom = cupBottom + .006, stemTop = .79, stemHeight = stemTop - stemBottom;
  addY('thermometer', .0048, .0048, stemHeight, 'glass', { pos: [thermometerX, (stemTop + stemBottom) / 2, thermometerZ], name: 'thermometer-glass-stem', castShadow: false });
  const scalePlate = addBox('thermometer', [.031, .26, .004], 'paint', { pos: [thermometerX + .018, .665, thermometerZ - .008] });
  scalePlate.material.side = THREE.DoubleSide;
  for (let i = 0; i <= 10; i++) {
    const y = .54 + i * .024;
    addBox('thermometer', [i % 5 === 0 ? .012 : .007, .0015, .002], 'brass', { pos: [thermometerX + .005, y, thermometerZ + .001] });
  }
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.008, 16, 12), material('mercury'));
  bulb.position.set(thermometerX, stemBottom + .008, thermometerZ); bulb.name = 'thermometer-bulb';
  bulb.userData.partId = 'thermometer'; bulb.userData.role = 'sensor'; parts.thermometer.add(bulb);
  const mercury = addY('thermometer', .0018, .0018, .13, 'mercury', { pos: [thermometerX, stemBottom + .073, thermometerZ], name: 'enlarged-model-column' });
  const thermometerCollar = GEO.tube(.009, .005, .012, 24);
  add('thermometer', thermometerCollar, 'brass', { pos: [thermometerX, cupTop + .014, thermometerZ] });

  // Dynamic cylinder endpoints follow the descending / manually raised weights.
  const Y = new THREE.Vector3(0, 1, 0);
  const setSegment = (mesh, a, b) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
    mesh.position.copy(A.add(B).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(Y, d.clone().normalize());
    mesh.scale.y = Math.max(.001, d.length());
  };

  function update(model = {}) {
    const weightY = Number.isFinite(model.weightY) ? model.weightY : JOULE_RIG.initialWeightY;
    for (const mass of massGroups) mass.group.position.y = weightY;
    for (const rope of ropeTop) {
      const hookY = weightY + .060;
      setSegment(rope.tail, [rope.x, rope.y, rope.z], [rope.x, hookY, rope.z]);
    }

    const angle = Number.isFinite(model.drumAngle) ? model.drumAngle : 0;
    driveRotor.rotation.z = angle;
    // Opposite pulley directions are required by the mirrored outer tangencies.
    const wheelAngle = Number.isFinite(model.pulleyAngle) ? model.pulleyAngle : 0;
    pulleyWheels[0].rotation.z = wheelAngle;
    pulleyWheels[1].rotation.z = -wheelAngle;
    const shaftAngle = Number.isFinite(model.shaftAngle) ? model.shaftAngle : 0;
    stirrerRotor.rotation.y = Number.isFinite(model.paddleAngle) ? model.paddleAngle : -shaftAngle;
    verticalGearRotor.rotation.y = -angle;

    const h = Math.max(.002, Number.isFinite(model.waterHeightM) ? model.waterHeightM : .02);
    water.scale.y = h;
    water.position.y = waterFloor + h / 2;
    waterMeniscus.position.y = waterFloor + h;
    const rise = Math.max(0, Number.isFinite(model.temperatureRiseC) ? model.temperatureRiseC : 0);
    // The scale is intentionally amplified; the numeric model readout remains unscaled.
    const fraction = Math.max(.13, Math.min(.78, .13 + rise * .58));
    mercury.scale.y = fraction;
    mercury.position.y = stemBottom + .008 + (.13 * fraction) / 2;
    if (water.material?.color) {
      const warmth = Math.min(.16, rise * .12);
      water.material.color.setRGB(.20 + warmth, .50 - warmth * .42, .64 - warmth * .38);
    }
  }

  update({ weightY: JOULE_RIG.initialWeightY, waterHeightM: .066, temperatureRiseC: 0, shaftAngle: 0, drumAngle: 0, pulleyAngle: 0 });

  return {
    parts,
    anchors,
    update,
    size: 1.8,
    view: { az: 18, el: 24, dist: 2.9, target: [0, .86, .02], fov: 31, frameX: 0 },
    inspect: () => ({
      coordinates: 'metres',
      schematic: true,
      dropHeightM: JOULE_RIG.dropHeightM,
      drumRadiusM: JOULE_RIG.drumRadiusM,
      pulleyRadiusM: JOULE_RIG.pulleyRadiusM,
      cupInnerRadiusM: JOULE_RIG.cupInnerRadiusM,
      frontCopperSectorClosed: true,
      rearCopperSectorClosed: true,
      frontSectorSpanDegrees: 220,
      verticalRopesMoveWithWeights: true,
      oneWayResetClutch: true,
      thermometerColumnAmplified: true,
    }),
  };
}
