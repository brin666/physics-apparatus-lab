// Schematic gas-state teaching rig, authored in metres. The moving boundary,
// dial needle, and volume index are driven only by gas-model.mjs output.
const PART_IDS = ['bench', 'cylinder', 'piston', 'drive', 'gauge', 'jacket', 'bath', 'plumbing', 'probe'];
const CYLINDER_X = -0.18;
const CYLINDER_Z = 0;
const CYLINDER_BASE_Y = 0.46;
const BORE_RADIUS = 0.041;
const BORE_AREA = Math.PI * BORE_RADIUS ** 2;
const CYLINDER_BOTTOM = 0.44;
const CYLINDER_TOP = 1.12;
const CYLINDER_HEIGHT = CYLINDER_TOP - CYLINDER_BOTTOM;
const SCREW_SEAT_OFFSET = 0.045;
const SCREW_SPAN = 0.60;
const WHEEL_HUB_OFFSET = 0.010;
const DIAL_MIN_KPA = -20;
const DIAL_MAX_KPA = 120;
const DIAL_START_ANGLE = 5 * Math.PI / 4;
const DIAL_SWEEP = 3 * Math.PI / 2;

const box = (GEO, w, h, d, r = 0.004) => GEO.rbox(w, h, d, Math.min(r, w / 4, h / 4, d / 4), 2);
const faceDisc = (THREE, radius, segments = 48) => new THREE.CircleGeometry(radius, segments);

function texture(THREE, draw, width = 512, height = width) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

function volumeScaleTexture(THREE) {
  return texture(THREE, (ctx, width, height) => {
    ctx.fillStyle = '#f7fbfe'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#24435a'; ctx.font = '600 32px Arial, sans-serif';
    ctx.fillText('V / mL', 18, 36);
    // These endpoints map 500 and 3000 mL to the exact piston heights
    // for the 82 mm bore: y = chamberBottom + V / boreArea.
    const left = 18, right = width - 24, top = 52, bottom = 699;
    ctx.strokeStyle = '#b8cbd8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(right, top); ctx.lineTo(right, bottom); ctx.stroke();
    for (let ml = 500; ml <= 3000; ml += 100) {
      const t = (ml - 500) / 2500;
      const y = bottom - t * (bottom - top);
      const major = ml % 500 === 0;
      ctx.strokeStyle = major ? '#365e78' : '#92aabd';
      ctx.lineWidth = major ? 3 : 1.5;
      ctx.beginPath(); ctx.moveTo(right - (major ? 42 : 22), y); ctx.lineTo(right, y); ctx.stroke();
      if (major) {
        ctx.fillStyle = '#294c64'; ctx.font = '500 28px Arial, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(String(ml), left, y);
      }
    }
  }, 320, 768);
}

function pressureDialTexture(THREE) {
  return texture(THREE, (ctx, size) => {
    const cx = size / 2, cy = size / 2, r = size * 0.435;
    ctx.fillStyle = '#f9fcfe'; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#d6e2e9'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.47, 0, Math.PI * 2); ctx.stroke();
    for (let kpa = DIAL_MIN_KPA; kpa <= DIAL_MAX_KPA; kpa += 5) {
      const f = (kpa - DIAL_MIN_KPA) / (DIAL_MAX_KPA - DIAL_MIN_KPA);
      const a = DIAL_START_ANGLE - f * DIAL_SWEEP;
      const major = kpa % 20 === 0;
      const x1 = cx + Math.cos(a) * r, y1 = cy - Math.sin(a) * r;
      const x2 = cx + Math.cos(a) * (r - (major ? 23 : 12)), y2 = cy - Math.sin(a) * (r - (major ? 23 : 12));
      ctx.strokeStyle = major ? '#31566f' : '#91a9b8'; ctx.lineWidth = major ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      if (major) {
        const tx = cx + Math.cos(a) * (r - 53), ty = cy - Math.sin(a) * (r - 53);
        ctx.fillStyle = '#29485e'; ctx.font = '600 24px Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(kpa), tx, ty);
      }
    }
    ctx.fillStyle = '#24465d'; ctx.textAlign = 'center';
    ctx.font = '600 26px Arial, sans-serif'; ctx.fillText('表压', cx, cy + 53);
    ctx.font = '500 22px Arial, sans-serif'; ctx.fillText('kPa', cx, cy + 80);
  });
}

function addMesh(THREE, parent, id, geometry, material, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], name = id, shell = false, cutHide = false } = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  mesh.scale.set(...scale);
  mesh.userData.partId = id;
  if (shell) mesh.userData.shell = true;
  if (cutHide) mesh.userData.cutHide = true;
  parent.add(mesh);
  return mesh;
}

export function buildExperiment({ THREE, GEO, MAT, root } = {}) {
  if (!THREE || !GEO || !MAT) throw new Error('buildExperiment requires THREE, GEO, and MAT.');
  const parts = Object.fromEntries(PART_IDS.map((id) => {
    const group = new THREE.Group(); group.name = id; group.position.set(0, 0, 0); group.userData.partId = id;
    root?.add?.(group); return [id, group];
  }));

  const mats = {
    steel: MAT.stainless({ color: [0.70, 0.73, 0.77], roughness: 0.24 }),
    brightSteel: MAT.aluminiumMachined({ color: [0.84, 0.87, 0.90], roughness: 0.22 }),
    darkSteel: MAT.steelDark({ color: [0.18, 0.22, 0.26], roughness: 0.40 }),
    blueMetal: MAT.paint({ color: '#4c86a8', roughness: 0.28, clearcoat: 0.45 }),
    white: MAT.enamel({ color: '#f1f5f8', roughness: 0.24 }),
    brass: MAT.brass({ color: [0.86, 0.67, 0.36], roughness: 0.28 }),
    rubber: MAT.rubber({ color: [0.045, 0.055, 0.065] }),
    glass: MAT.glass({ color: '#d8f1fb', transmission: 0, opacity: 0.14, transparent: true, depthWrite: false, roughness: 0.12 }),
    water: MAT.fluid({ color: '#75c6e8', opacity: 0.20, transparent: true, depthWrite: false, roughness: 0.16 }),
    gas: MAT.fluid({ color: '#7ec9ef', opacity: 0.09, transparent: true, depthWrite: false, roughness: 0.16, noCap: true }),
    red: MAT.paint({ color: '#b95d59', roughness: 0.56 }),
    blue: MAT.paint({ color: '#357fbb', roughness: 0.48 }),
    face: MAT.paint({ color: '#ffffff', roughness: 0.84 }),
    pointer: MAT.paint({ color: '#c84a43', roughness: 0.38, clearcoat: 0.25 }),
    screen: MAT.paint({ color: '#e5f3fa', roughness: 0.26, clearcoat: 0.7 }),
  };
  const add = (id, geometry, material, options = {}) => addMesh(THREE, parts[id], id, geometry, material, options);
  const addBox = (id, size, pos, material, options = {}) => add(id, box(GEO, ...size), material, { pos, ...options });
  const addPipe = (id, points, radius, material) => add(id, GEO.pipe(points, radius, { seg: 72, radial: 12, tension: 0.38 }), material);
  const anchors = {
    bench: [0, 0.34, 0], cylinder: [CYLINDER_X, 0.78, 0], piston: [CYLINDER_X, 0.77, 0],
    drive: [CYLINDER_X, 1.43, 0], gauge: [0.18, 0.96, 0.06], jacket: [CYLINDER_X, 0.75, 0],
    bath: [0.37, 0.55, -0.02], plumbing: [0.07, 0.66, 0.10], probe: [-0.13, 0.60, 0.08],
  };

  // Rigid bench, rubber isolation pads, and the fixed two-column reaction frame.
  addBox('bench', [1.02, 0.055, 0.50], [0.0, 0.366, 0], mats.white, { name: 'Powder-coated worktop' });
  for (const x of [-0.43, 0.43]) for (const z of [-0.19, 0.19]) {
    addBox('bench', [0.035, 0.32, 0.035], [x, 0.177, z], mats.steel, { name: 'Bench leg' });
    addBox('bench', [0.065, 0.018, 0.068], [x, 0.018, z], mats.rubber, { name: 'Rubber foot' });
    addBox('bench', [0.070, 0.012, 0.073], [x, 0.030, z], mats.darkSteel, { name: 'Foot plate' });
  }
  addBox('bench', [0.82, 0.018, 0.025], [0, 0.135, -0.19], mats.darkSteel, { name: 'Rear stretcher' });
  addBox('bench', [0.82, 0.018, 0.025], [0, 0.135, 0.19], mats.darkSteel, { name: 'Front stretcher' });
  addBox('bench', [0.28, 0.022, 0.18], [CYLINDER_X, 0.407, -0.03], mats.blueMetal, { name: 'Cylinder mounting plate' });
  for (const x of [CYLINDER_X - 0.108, CYLINDER_X + 0.108]) {
    addBox('bench', [0.026, 0.78, 0.042], [x, 0.795, -0.035], mats.steel, { name: 'Reaction-frame upright' });
    addBox('bench', [0.038, 0.018, 0.055], [x, 0.414, -0.035], mats.darkSteel, { name: 'Upright foot' });
  }
  addBox('bench', [0.27, 0.052, 0.085], [CYLINDER_X, 1.177, -0.035], mats.blueMetal, { name: 'Screw crosshead' });
  add('bench', GEO.tube(0.030, 0.011, 0.050, 48), mats.brass, { pos: [CYLINDER_X, 1.195, -0.035], name: 'Threaded guide nut' });
  for (const p of [[CYLINDER_X - 0.105, 0.43, 0.053], [CYLINDER_X + 0.105, 0.43, 0.053], [CYLINDER_X - 0.105, 0.43, -0.12], [CYLINDER_X + 0.105, 0.43, -0.12]]) {
    add('bench', GEO.disc(0.006, 0.007, 0.001, 16), mats.brass, { pos: p, name: 'Mounting bolt' });
  }

  // Gas cylinder has a closed annular barrel, sealed ends, a visible cut-hide window,
  // and a translucent interior volume that follows the solved piston boundary.
  add('cylinder', GEO.tube(0.050, BORE_RADIUS, CYLINDER_HEIGHT, 72), mats.glass, {
    pos: [CYLINDER_X, (CYLINDER_TOP + CYLINDER_BOTTOM) / 2, CYLINDER_Z], shell: true, name: 'Closed transparent pressure barrel',
  });
  add('cylinder', GEO.tube(0.062, 0.047, 0.022, 48), mats.steel, { pos: [CYLINDER_X, 0.453, CYLINDER_Z], name: 'Lower barrel flange' });
  add('cylinder', GEO.tube(0.062, 0.047, 0.022, 48), mats.steel, { pos: [CYLINDER_X, 1.107, CYLINDER_Z], name: 'Head flange' });
  add('cylinder', GEO.tube(0.052, 0.013, 0.030, 40), mats.brightSteel, { pos: [CYLINDER_X, 1.122, CYLINDER_Z], name: 'Rod packing gland' });
  const barrelWindow = addBox('cylinder', [0.098, 0.58, 0.006], [CYLINDER_X, 0.785, 0.052], mats.glass, { cutHide: true, name: 'Closed front inspection window' });
  barrelWindow.renderOrder = 4;
  const gasVolume = add('cylinder', new THREE.CylinderGeometry(0.039, 0.039, 1, 48, 1, false), mats.gas, {
    pos: [CYLINDER_X, 0.70, CYLINDER_Z], name: 'Translucent solved gas volume',
  });
  gasVolume.renderOrder = 2;
  const volumeBoard = addBox('cylinder', [0.112, 0.58, 0.009], [-0.018, 0.785, 0.083], mats.white, { name: 'Volume scale backing' });
  volumeBoard.renderOrder = 5;
  const scaleMap = volumeScaleTexture(THREE);
  add('cylinder', new THREE.PlaneGeometry(0.104, 0.562), MAT.paint({ color: '#ffffff', map: scaleMap, roughness: 0.88 }), {
    pos: [-0.018, 0.785, 0.089], name: 'Printed volume graduation',
  }).renderOrder = 6;
  const scaleIndex = addBox('cylinder', [0.126, 0.0045, 0.006], [-0.015, 0.76, 0.099], mats.pointer, { name: 'Live volume index' });
  scaleIndex.renderOrder = 7;
  add('cylinder', GEO.tube(0.006, 0.003, 0.018, 24), mats.brass, { pos: [CYLINDER_X + 0.047, 0.535, 0.005], rot: [0, 0, Math.PI / 2], name: 'Pressure take-off gland' });

  // Piston and anti-rotation thrust seat. The separate screw may turn while the
  // piston head remains level; the faces stay in contact at every solved state.
  const pistonHead = add('piston', GEO.disc(0.0395, 0.026, 0.002, 64), mats.brightSteel, { pos: [CYLINDER_X, 0.78, CYLINDER_Z], name: 'Piston crown' });
  const pistonSealA = add('piston', new THREE.TorusGeometry(0.039, 0.0021, 10, 64), mats.rubber, { pos: [CYLINDER_X, 0.78, CYLINDER_Z], rot: [Math.PI / 2, 0, 0], name: 'Lower piston seal' });
  const pistonSealB = add('piston', new THREE.TorusGeometry(0.039, 0.0015, 10, 64), mats.rubber, { pos: [CYLINDER_X, 0.78, CYLINDER_Z], rot: [Math.PI / 2, 0, 0], name: 'Upper piston seal' });
  const thrustCup = add('piston', GEO.tube(0.026, 0.012, 0.018, 40), mats.steel, { pos: [CYLINDER_X, 0.80, CYLINDER_Z], name: 'Rotary thrust seat' });
  const thrustRace = add('piston', GEO.tube(0.021, 0.011, 0.006, 40), mats.brass, { pos: [CYLINDER_X, 0.81, CYLINDER_Z], name: 'Thrust bearing race' });
  // Handwheel, coarse threaded screw, and lower contact pad. Mesh transforms are
  // updated from the solver output; no local clock or accumulated angle is used.
  const shaftLength = SCREW_SPAN;
  const shaft = add('drive', GEO.disc(0.0095, shaftLength, 0.001, 32), mats.steel, { pos: [CYLINDER_X, 1.05, CYLINDER_Z], name: 'Lead screw core' });
  const thread = add('drive', GEO.spring(0.0123, 0.00125, 27, shaftLength, 720), mats.brass, { pos: [CYLINDER_X, 0.80, CYLINDER_Z], name: 'Lead screw thread' });
  const screwContact = add('drive', GEO.disc(0.0105, 0.012, 0.0015, 32), mats.brass, { pos: [CYLINDER_X, 0.80, CYLINDER_Z], name: 'Screw contact pad' });
  const wheelGeometryParts = [];
  const wheelRing = new THREE.TorusGeometry(0.086, 0.0043, 10, 80); wheelRing.rotateX(Math.PI / 2); wheelGeometryParts.push(wheelRing);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const spoke = box(GEO, 0.090, 0.007, 0.010, 0.002);
    spoke.rotateY(a); spoke.translate(0.040 * Math.cos(a), 0, 0.040 * Math.sin(a)); wheelGeometryParts.push(spoke);
  }
  wheelGeometryParts.push(GEO.tube(0.023, 0.010, 0.020, 40));
  const wheel = add('drive', GEO.merge(wheelGeometryParts), mats.steel, { pos: [CYLINDER_X, 1.45, CYLINDER_Z], name: 'Six-spoke handwheel' });
  const grip = add('drive', GEO.disc(0.009, 0.032, 0.003, 24), mats.darkSteel, { pos: [CYLINDER_X + 0.086, 1.45, CYLINDER_Z], name: 'Handwheel grip' });

  // Calibrated pressure dial: dial face and labels are directly on its front plane.
  const gaugeX = 0.18, gaugeY = 0.955, gaugeZ = 0.045;
  add('gauge', GEO.disc(0.069, 0.031, 0.003, 64), mats.darkSteel, { pos: [gaugeX, gaugeY, gaugeZ], rot: [Math.PI / 2, 0, 0], name: 'Pressure gauge case' });
  add('gauge', new THREE.CircleGeometry(0.061, 64), mats.brass, { pos: [gaugeX, gaugeY, gaugeZ + 0.018], name: 'Brass gauge bezel' });
  const dialMap = pressureDialTexture(THREE);
  add('gauge', faceDisc(THREE, 0.056, 72), MAT.paint({ color: '#ffffff', map: dialMap, roughness: 0.88 }), { pos: [gaugeX, gaugeY, gaugeZ + 0.020], name: 'Printed pressure dial face' }).renderOrder = 5;
  const needleShape = new THREE.Shape();
  needleShape.moveTo(-0.007, -0.0025); needleShape.lineTo(0.048, 0); needleShape.lineTo(-0.007, 0.0025); needleShape.closePath();
  const needle = add('gauge', GEO.extrude(needleShape, 0.002, 0), mats.pointer, { pos: [gaugeX, gaugeY, gaugeZ + 0.024], name: 'Live pressure needle' });
  needle.renderOrder = 7;
  add('gauge', new THREE.SphereGeometry(0.007, 20, 14), mats.brass, { pos: [gaugeX, gaugeY, gaugeZ + 0.027], name: 'Needle pivot' });
  add('gauge', GEO.tube(0.005, 0.0032, 0.018, 24), mats.brass, { pos: [gaugeX, gaugeY - 0.047, gaugeZ - 0.006], rot: [Math.PI / 2, 0, 0], name: 'Gauge inlet connector' });
  addPipe('gauge', [
    [CYLINDER_X + 0.052, 0.535, 0.005], [CYLINDER_X + 0.105, 0.535, 0.035],
    [-0.012, 0.555, 0.047], [0.105, 0.675, 0.047], [0.17, 0.82, 0.047], [gaugeX, gaugeY - 0.055, gaugeZ - 0.008],
  ], 0.0031, mats.brass);

  // Water jacket is a closed annular vessel around the lower cylinder.
  const jacketCenterY = 0.748, jacketHeight = 0.478;
  add('jacket', GEO.tube(0.078, 0.052, jacketHeight, 64), mats.glass, {
    pos: [CYLINDER_X, jacketCenterY, CYLINDER_Z], shell: true, name: 'Closed jacket shell',
  });
  add('jacket', GEO.tube(0.074, 0.053, jacketHeight - 0.026, 64), mats.water, {
    pos: [CYLINDER_X, jacketCenterY, CYLINDER_Z], shell: true, name: 'Circulating bath-water annulus',
  });
  for (const y of [jacketCenterY - jacketHeight / 2 + 0.012, jacketCenterY + jacketHeight / 2 - 0.012]) {
    add('jacket', GEO.tube(0.086, 0.052, 0.018, 48), mats.steel, { pos: [CYLINDER_X, y, CYLINDER_Z], name: 'Jacket clamp collar' });
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      add('jacket', GEO.disc(0.0034, 0.004, 0.0006, 12), mats.brass, {
        pos: [CYLINDER_X + 0.083 * Math.cos(a), y, CYLINDER_Z + 0.083 * Math.sin(a)], name: 'Jacket flange bolt',
      });
    }
  }
  add('jacket', GEO.tube(0.011, 0.006, 0.022, 24), mats.brass, { pos: [CYLINDER_X + 0.075, 0.92, 0], rot: [0, 0, Math.PI / 2], name: 'Upper jacket port' });
  add('jacket', GEO.tube(0.011, 0.006, 0.022, 24), mats.brass, { pos: [CYLINDER_X + 0.075, 0.57, 0], rot: [0, 0, Math.PI / 2], name: 'Lower jacket port' });

  // Supported, transparent reservoir with a visible water line and thermostat panel.
  const bathX = 0.37, bathY = 0.545, bathZ = -0.018;
  addBox('bath', [0.235, 0.026, 0.225], [bathX, 0.405, bathZ], mats.blueMetal, { name: 'Bath tank plinth' });
  for (const x of [bathX - 0.108, bathX + 0.108]) for (const z of [bathZ - 0.101, bathZ + 0.101]) {
    addBox('bath', [0.012, 0.25, 0.012], [x, bathY, z], mats.steel, { name: 'Tank frame post' });
  }
  for (const y of [0.425, 0.665]) for (const z of [bathZ - 0.101, bathZ + 0.101]) {
    addBox('bath', [0.235, 0.014, 0.014], [bathX, y, z], mats.steel, { name: 'Tank frame rail' });
  }
  const bathShell = addBox('bath', [0.208, 0.212, 0.188], [bathX, 0.548, bathZ], mats.glass, { shell: true, name: 'Closed acrylic bath vessel' });
  bathShell.renderOrder = 3;
  const water = addBox('bath', [0.177, 0.134, 0.155], [bathX, 0.515, bathZ], mats.water, { name: 'Bath reservoir liquid' });
  water.renderOrder = 4;
  addBox('bath', [0.192, 0.005, 0.170], [bathX, 0.584, bathZ], mats.blue, { name: 'Bath liquid level line' });
  const controlBody = addBox('bath', [0.155, 0.072, 0.018], [bathX, 0.447, 0.105], mats.white, { name: 'Thermostat control panel' });
  controlBody.renderOrder = 5;
  add('bath', box(GEO, 0.075, 0.040, 0.003), mats.screen, { pos: [bathX - 0.022, 0.447, 0.117], name: 'Bath temperature display window' });
  add('bath', new THREE.CircleGeometry(0.009, 20), mats.blueMetal, { pos: [bathX + 0.051, 0.447, 0.118], name: 'Bath setpoint knob' });
  for (const x of [bathX - 0.045, bathX - 0.022, bathX + 0.001]) add('bath', new THREE.CircleGeometry(0.003, 12), mats.pointer, { pos: [x, 0.445, 0.120], name: 'Controller indicator' });

  // Two separate, capped hoses join matching upper/lower jacket and bath ports.
  addPipe('plumbing', [[0.252, 0.625, -0.02], [0.205, 0.64, 0.075], [0.03, 0.64, 0.115], [-0.085, 0.78, 0.105], [-0.105, 0.92, 0.035]], 0.0060, mats.red);
  addPipe('plumbing', [[-0.105, 0.57, 0.035], [-0.075, 0.49, 0.105], [0.08, 0.475, 0.115], [0.205, 0.49, 0.075], [0.252, 0.505, -0.02]], 0.0060, mats.blue);
  for (const [x, y, z] of [[0.252, 0.625, -0.02], [-0.105, 0.92, 0.035], [-0.105, 0.57, 0.035], [0.252, 0.505, -0.02]]) {
    add('plumbing', GEO.tube(0.010, 0.0058, 0.016, 24), mats.steel, { pos: [x, y, z], rot: [0, 0, Math.PI / 2], name: 'Hose ferrule' });
  }

  // Probe enters through the jacket wall and cylinder wall, with compression
  // glands at each boundary; its tip ends inside the gas rather than crossing it.
  add('probe', GEO.disc(0.005, 0.095, 0.001, 24), mats.steel, { pos: [-0.129, 0.592, 0.010], rot: [0, 0, Math.PI / 2], name: 'Immersed temperature probe' });
  add('probe', GEO.tube(0.012, 0.005, 0.014, 32), mats.brass, { pos: [-0.129, 0.592, 0.010], rot: [0, 0, Math.PI / 2], name: 'Barrel probe compression gland' });
  add('probe', GEO.tube(0.012, 0.005, 0.014, 32), mats.brass, { pos: [-0.101, 0.592, 0.010], rot: [0, 0, Math.PI / 2], name: 'Jacket probe compression gland' });
  add('probe', GEO.tube(0.009, 0.005, 0.010, 28), mats.steel, { pos: [-0.086, 0.592, 0.010], rot: [0, 0, Math.PI / 2], name: 'Probe strain relief' });
  addPipe('probe', [[-0.081, 0.592, 0.010], [-0.045, 0.57, 0.105], [0.018, 0.51, 0.128], [0.118, 0.445, 0.128]], 0.0028, mats.darkSteel);
  addBox('probe', [0.105, 0.064, 0.026], [0.145, 0.432, 0.116], mats.blueMetal, { name: 'Probe indicator housing' });
  addBox('probe', [0.072, 0.031, 0.004], [0.142, 0.435, 0.131], mats.screen, { name: 'Probe display window' });
  add('probe', new THREE.CircleGeometry(0.004, 14), mats.pointer, { pos: [0.187, 0.431, 0.132], name: 'Probe power indicator' });

  // Shared scene framing expects the longest dimension as a scalar.
  const size = 1.78;
  const dimensions = [1.05, 1.78, 0.52];
  const view = { az: 18, el: 9, dist: 2.95, target: [0.02, 0.91, 0], fov: 32 };

  function update(model = {}) {
    const state = model.geometry ?? model;
    const pistonFaceY = Number.isFinite(state.pistonFaceY)
      ? state.pistonFaceY
      : CYLINDER_BASE_Y + (Number.isFinite(state.volumeM3) ? state.volumeM3 : 1.6e-3) / BORE_AREA;
    const needleAngle = Number.isFinite(state.needleAngle) ? state.needleAngle : DIAL_START_ANGLE;
    const wheelY = Number.isFinite(state.wheelY)
      ? state.wheelY
      : pistonFaceY + SCREW_SEAT_OFFSET + SCREW_SPAN + WHEEL_HUB_OFFSET;
    const wheelAngle = Number.isFinite(state.wheelAngle) ? state.wheelAngle : 0;
    const gasH = Math.max(0.01, pistonFaceY - CYLINDER_BASE_Y);

    gasVolume.position.y = CYLINDER_BASE_Y + gasH / 2;
    gasVolume.scale.y = gasH;
    pistonHead.position.y = pistonFaceY + 0.013;
    pistonSealA.position.y = pistonFaceY + 0.005;
    pistonSealB.position.y = pistonFaceY + 0.020;
    thrustCup.position.y = pistonFaceY + 0.035;
    thrustRace.position.y = pistonFaceY + 0.045;
    scaleIndex.position.y = pistonFaceY;
    const screwLowY = pistonFaceY + SCREW_SEAT_OFFSET;
    shaft.position.y = screwLowY + shaftLength / 2;
    shaft.rotation.y = wheelAngle;
    thread.position.y = screwLowY;
    thread.rotation.y = wheelAngle;
    screwContact.position.y = screwLowY + 0.006;
    screwContact.rotation.y = wheelAngle;
    wheel.position.y = wheelY;
    wheel.rotation.y = wheelAngle;
    grip.position.y = wheelY;
    grip.rotation.y = wheelAngle;
    needle.rotation.z = needleAngle;
  }

  update({ geometry: { pistonFaceY: 0.46 + 1.6e-3 / BORE_AREA, wheelAngle: 0, needleAngle: DIAL_START_ANGLE } });

  return {
    parts,
    anchors,
    update,
    size,
    dimensions,
    view,
    inspect: () => ({
      partIds: [...PART_IDS],
      boreRadiusM: BORE_RADIUS,
      boreAreaM2: BORE_AREA,
      initialVolumeAtDefaultM3: BORE_AREA * (0.46 + 1.6e-3 / BORE_AREA - CYLINDER_BASE_Y),
      shellCount: Object.values(parts).reduce((count, group) => count + group.children.filter((mesh) => mesh.userData.shell).length, 0),
      cutHideCount: Object.values(parts).reduce((count, group) => count + group.children.filter((mesh) => mesh.userData.cutHide).length, 0),
    }),
  };
}
