import { THREE } from './vendor/machine-kit/lab-kit.js';
import { engineAt } from './model.mjs';

const REST_ANGLE = 410;
const PREVIEW_WIDTH = 700;
const PREVIEW_HEIGHT = 840;

const fallback = {
  ready: false,
  play() { return false; },
  pause() {},
  reset() {},
  get running() { return false; },
  get angle() { return 0; },
};

window.homeEnginePreview = fallback;

function hasWebGL2() {
  let context;
  try {
    context = document.createElement('canvas').getContext('webgl2', { alpha: true });
  } catch {
    return false;
  }
  if (!context) return false;
  context.getExtension('WEBGL_lose_context')?.loseContext();
  return true;
}

function postToParent(type, message) {
  if (window.parent === window) return;
  let targetOrigin = '';
  try {
    targetOrigin = window.parent.location.origin;
  } catch {
    // Cross-origin parents cannot be read; srcdoc's inherited window.origin
    // still identifies the origin that embedded this trusted preview.
  }
  if (!targetOrigin || targetOrigin === 'null') targetOrigin = window.origin;
  if (!targetOrigin || targetOrigin === 'null') targetOrigin = '*';
  const payload = message ? { type, message } : { type };
  window.parent.postMessage(payload, targetOrigin);
}

function settleScene(scene) {
  scene.update({
    mode: 'assembled',
    selected: null,
    labels: false,
    visible: true,
    playing: false,
    reduced: false,
    assembly: { active: false, time: 0 },
    angle: REST_ANGLE,
  });
  scene.select(null);
  scene.state.mode = 'assembled';
  scene.state.selected = null;
  scene.state.assembly = { active: false, time: 0 };
  scene.state.labels = false;
  for (const key of ['cut', 'explode', 'xray', 'labels']) {
    scene.lab.target[key] = 0;
    scene.lab.state[key] = 0;
  }
  scene.lab.scene.background = null;
  if (scene.lab.floor) scene.lab.floor.visible = false;
  if (scene.lab._contact?.plane) scene.lab._contact.plane.visible = false;
  scene.lab.ui.style.display = 'none';
  scene.lab._assembly = 0;
  scene.lab._update(0);
}

function makeStudio(renderer) {
  const studio = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(30, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0x9c9a95, side: THREE.BackSide }),
  );
  studio.add(room);
  const studioFloor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 32),
    new THREE.MeshBasicMaterial({ color: 0xd8d6d0 }),
  );
  studioFloor.rotation.x = -Math.PI / 2;
  studioFloor.position.y = -2;
  studio.add(studioFloor);

  const softbox = (w, h, x, y, z, intensity, tint = [1, 1, 1]) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(...tint).multiplyScalar(intensity),
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
  };

  softbox(14, 10, 0, 14, 2, 2.6);
  softbox(4, 14, -12, 4, 8, 4.5, [1, 0.96, 0.9]);
  softbox(2.2, 14, 13, 5, -6, 6, [0.88, 0.94, 1]);
  softbox(2.2, 14, -11, 5, -9, 3.5);
  softbox(8, 3, 6, 1.5, 12, 1.4);
  softbox(5, 16, 12, 4, 7, 0.02);
  softbox(4, 16, -13, 4, -2, 0.02);
  softbox(16, 3, 0, -1, -14, 0.03);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, 0.02).texture;
  pmrem.dispose();
  studio.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
  });
  return environment;
}

function visibleModelBounds(scene, THREERef) {
  const box = new THREERef.Box3();
  const point = new THREERef.Vector3();
  let visibleMeshCount = 0;
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!object.isMesh || !object.visible || object.userData.studio) return;
    let ancestor = object.parent;
    while (ancestor && ancestor !== scene) {
      if (!ancestor.visible) return;
      ancestor = ancestor.parent;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const opacity = object.userData.effectiveOpacity
      ?? Math.max(...materials.map((material) => material?.opacity ?? 1));
    if (opacity <= 0.05 || !object.geometry) return;
    visibleMeshCount++;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const bounds = object.geometry.boundingBox;
    if (!bounds || bounds.isEmpty()) return;
    for (let i = 0; i < 8; i++) {
      point.set(
        i & 1 ? bounds.max.x : bounds.min.x,
        i & 2 ? bounds.max.y : bounds.min.y,
        i & 4 ? bounds.max.z : bounds.min.z,
      ).applyMatrix4(object.matrixWorld);
      box.expandByPoint(point);
    }
  });
  if (box.isEmpty()) throw new Error('No visible engine meshes');
  return { box, visibleMeshCount };
}

async function initialize() {
  if (!hasWebGL2()) {
    postToParent('home-engine-error', 'WebGL 2 is unavailable');
    return;
  }

  // machine-scene starts its kit-owned loop during module evaluation. Suppress
  // that one scheduling point, then restore RAF for this preview's play clock.
  const nativeRequestAnimationFrame = window.requestAnimationFrame;
  window.requestAnimationFrame = () => 0;
  let sceneModule;
  try {
    sceneModule = await import('./machine-scene.mjs');
  } finally {
    window.requestAnimationFrame = nativeRequestAnimationFrame;
  }

  const scene = window.engineScene ?? sceneModule.engineScene;
  if (!scene?.lab) return;
  const lab = scene.lab;
  const sourceRenderer = lab.renderer;
  const originalTarget = lab.controlsOrbit.target.clone();
  const originalDistance = lab.camera.position.distanceTo(originalTarget);
  const originalOutputColorSpace = sourceRenderer.outputColorSpace;
  const originalExposure = sourceRenderer.toneMappingExposure;
  const originalShadowType = sourceRenderer.shadowMap.type;

  settleScene(scene);

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = originalOutputColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = originalExposure;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = originalShadowType;
  lab.scene.environment = makeStudio(renderer);
  document.body.appendChild(canvas);

  // The kit's opaque canvas and interface served scene construction only.
  // Keep its scene data, replace its renderer, and leave no second RAF source.
  sourceRenderer.domElement.remove();
  lab.ui.remove();
  lab.renderer = renderer;
  lab._resize = () => {};
  document.documentElement.style.setProperty('background', 'transparent', 'important');
  document.body.style.setProperty('background', 'transparent', 'important');
  try {
    lab.composer.dispose?.();
    sourceRenderer.dispose();
    sourceRenderer.forceContextLoss?.();
  } catch {
    // The preview renderer owns the live context from here onward.
  }

  const fitCamera = (width, height) => {
    const angle = THREE.MathUtils.degToRad(4);
    const elevation = THREE.MathUtils.degToRad(10);
    const facing = new THREE.Vector3(
      Math.cos(elevation) * Math.sin(angle),
      Math.sin(elevation),
      Math.cos(elevation) * Math.cos(angle),
    );
    lab.camera.position.copy(originalTarget).addScaledVector(facing, originalDistance);
    lab.camera.up.set(0, 1, 0);
    lab.camera.lookAt(originalTarget);
    lab.camera.updateMatrixWorld(true);

    const { box } = visibleModelBounds(lab.scene, THREE);
    const center = box.getCenter(new THREE.Vector3());
    const direction = lab.camera.position.clone().sub(originalTarget).normalize();
    const forward = direction.clone().negate();
    const right = forward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    const up = right.clone().cross(forward).normalize();
    const aspect = width / height;
    const tanY = Math.tan(THREE.MathUtils.degToRad(lab.camera.fov / 2));
    const tanX = tanY * aspect;
    let distance = 0;
    for (let i = 0; i < 8; i++) {
      const corner = new THREE.Vector3(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      ).sub(center);
      const depth = corner.dot(direction);
      const x = Math.abs(corner.dot(right));
      const y = Math.abs(corner.dot(up));
      distance = Math.max(distance, depth + x / (tanX * 0.74), depth + y / (tanY * 0.74));
    }
    distance = Math.max(distance + 0.035, 0.25);
    lab.camera.aspect = aspect;
    lab.camera.position.copy(center).addScaledVector(direction, distance);
    lab.camera.up.set(0, 1, 0);
    lab.camera.lookAt(center);
    lab.camera.updateProjectionMatrix();
    lab.camera.updateMatrixWorld(true);
    lab.controlsOrbit.target.copy(center);
    lab.controlsOrbit.maxDistance = Math.max(lab.controlsOrbit.maxDistance || 0, distance * 1.1);
    return center;
  };

  let width = 0;
  let height = 0;
  let center = new THREE.Vector3();
  const pixelsForSize = (nextWidth, nextHeight) => {
    width = Math.max(1, Math.round(nextWidth));
    height = Math.max(1, Math.round(nextHeight));
    renderer.setSize(width, height, false);
    center = fitCamera(width, height);
  };

  const render = () => renderer.render(lab.scene, lab.camera);
  const measureAlpha = () => {
    const gl = renderer.getContext();
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let visible = 0;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!pixels[(y * width + x) * 4 + 3]) continue;
        const topY = height - 1 - y;
        visible++;
        minX = Math.min(minX, x); minY = Math.min(minY, topY);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, topY);
      }
    }
    return { visible, bounds: [minX, minY, maxX, maxY] };
  };

  const frameAndFit = () => {
    render();
    let alpha = measureAlpha();
    if (!alpha.visible) throw new Error('Transparent engine render');
    for (let iteration = 0; iteration < 4; iteration++) {
      const [x0, y0, x1, y1] = alpha.bounds;
      const coverage = Math.max((x1 - x0 + 1) / width, (y1 - y0 + 1) / height);
      const factor = Math.min(1.2, 0.86 / coverage);
      if (factor < 1.012) break;
      const offset = lab.camera.position.clone().sub(center);
      lab.camera.position.copy(center).addScaledVector(offset, 1 / factor);
      lab.camera.lookAt(center);
      lab.camera.updateMatrixWorld(true);
      lab.controlsOrbit.update();
      render();
      alpha = measureAlpha();
    }
  };

  pixelsForSize(PREVIEW_WIDTH, PREVIEW_HEIGHT);

  let running = false;
  let currentAngle = REST_ANGLE;
  let startedAt = 0;
  let animationFrame = 0;
  let runToken = 0;

  const setAngle = (value) => {
    const requestedAngle = Number.isFinite(Number(value)) ? Number(value) : REST_ANGLE;
    const nextAngle = THREE.MathUtils.clamp(requestedAngle, REST_ANGLE, REST_ANGLE + 720);
    const pose = engineAt(nextAngle);
    currentAngle = nextAngle;
    scene.update({
      mode: 'assembled', selected: null, labels: false, visible: true,
      playing: false, reduced: false, assembly: { active: false, time: 0 }, angle: nextAngle,
    });
    lab._update(0);
    return pose;
  };

  const settle = (draw) => {
    const wasRunning = running;
    runToken++;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    running = false;
    startedAt = 0;
    setAngle(REST_ANGLE);
    if (draw && (wasRunning || document.visibilityState !== 'hidden')) render();
    return wasRunning;
  };

  const complete = (token) => {
    if (!running || token !== runToken) return;
    animationFrame = 0;
    running = false;
    startedAt = 0;
    setAngle(REST_ANGLE);
    render();
    postToParent('home-engine-ended');
  };

  const tick = (now, token, duration, loop) => {
    if (!running || token !== runToken) return;
    const elapsed = (now - startedAt) / duration;
    const progress = loop ? elapsed % 1 : THREE.MathUtils.clamp(elapsed, 0, 1);
    if (progress >= 1) {
      complete(token);
      return;
    }
    setAngle(REST_ANGLE + progress * 720);
    render();
    animationFrame = requestAnimationFrame((nextNow) => tick(nextNow, token, duration, loop));
  };

  const api = {
    ready: true,
    play({ duration = 2400, loop = false } = {}) {
      if (running) return true;
      if (document.visibilityState === 'hidden' || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      if (!Number.isFinite(duration) || duration <= 0) return false;
      setAngle(REST_ANGLE);
      render();
      running = true;
      startedAt = performance.now();
      const token = ++runToken;
      animationFrame = requestAnimationFrame((now) => tick(now, token, duration, loop));
      return true;
    },
    pause() {
      if (!running) return;
      runToken++;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      running = false;
      startedAt = 0;
    },
    reset() {
      settle(true);
    },
    get running() { return running; },
    get angle() { return currentAngle; },
  };

  window.homeEnginePreview = api;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && running) settle(true);
  });
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  motion.addEventListener?.('change', (event) => {
    if (event.matches && running) settle(true);
  });

  // Render the static assembled pose once. Later frames are driven only by play.
  setAngle(REST_ANGLE);
  frameAndFit();
  postToParent('home-engine-ready');
}

initialize().catch((error) => {
  // The parent keeps its PNG preview when this isolated WebGL runtime cannot start.
  window.homeEnginePreview = fallback;
  postToParent('home-engine-error', String(error?.message || error));
});
