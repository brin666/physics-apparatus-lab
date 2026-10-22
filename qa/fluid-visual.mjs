import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

// Focused geometry QA for the four fluid teaching models. The browser profile
// is isolated by Playwright; screenshots stay in the local QA folder.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir('qa/apparatus', { recursive: true });

const shots = [
  { id: 'submarine', file: 'submarine-qa-side.png', dir: [1, 0.24, 0.06], zoom: 0.78, mode: 'xray', inputs: { ballast: 10 }, t: 0 },
  { id: 'submarine', file: 'submarine-qa-xray.png', dir: [0.12, 0.32, 1], zoom: 0.78, mode: 'xray', inputs: { ballast: 26 }, t: 0 },
  { id: 'canal-lock', file: 'canal-lock-qa-fill.png', dir: [0.08, 0.8, 1], zoom: 0.78, mode: 'assembled', inputs: { direction: 'downstream', head: 4, progress: 0.42 }, t: 0 },
  { id: 'canal-lock', file: 'canal-lock-qa-gate.png', dir: [0.05, 0.48, 1], zoom: 0.78, mode: 'assembled', inputs: { direction: 'downstream', head: 4, progress: 0.58 }, t: 0 },
  { id: 'manometer', file: 'manometer-qa-front.png', dir: [0.02, 0.12, 1], zoom: 0.92, mode: 'assembled', inputs: { depth: 0.5, gauge: 'oil' }, t: 0 },
  { id: 'manometer', file: 'manometer-qa-liquid.png', dir: [0.72, 0.2, 1], zoom: 0.92, mode: 'assembled', inputs: { depth: 0.5, gauge: 'water' }, t: 0 },
  { id: 'piston-pump', file: 'piston-pump-qa-up.png', dir: [0.12, 0.22, 1], zoom: 1.08, mode: 'assembled', inputs: { speed: 0.25, lift: 4 }, t: 0 },
  { id: 'piston-pump', file: 'piston-pump-qa-down.png', dir: [0.12, 0.22, 1], zoom: 1.08, mode: 'assembled', inputs: { speed: 0.25, lift: 4 }, t: 2 },
  { id: 'piston-pump', file: 'piston-pump-qa-explode.png', dir: [0.25, 0.38, 1], zoom: 0.88, mode: 'explode', inputs: { speed: 0.25, lift: 4 }, t: 0 },
];
const requestedId = process.argv[2];
const shotsToCapture = requestedId ? shots.filter(shot => shot.id === requestedId) : shots;
if (requestedId && !shotsToCapture.length) throw new Error(`No fluid QA shots for ${requestedId}`);

try {
  const byDevice = Map.groupBy ? Map.groupBy(shotsToCapture, shot => shot.id) : shotsToCapture.reduce((map, shot) => {
    (map.get(shot.id) ?? map.set(shot.id, []).get(shot.id)).push(shot);
    return map;
  }, new Map());
  for (const [id, deviceShots] of byDevice) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:4198/${id}.html`);
    await page.waitForFunction(() => window.apparatusDemo?.ready || window.apparatusError);
    const loadError = await page.evaluate(() => window.apparatusError);
    if (loadError) throw new Error(`${id}: ${loadError}`);
    await page.waitForFunction(() => window.apparatusDemo.state.phase === 'closed');
    const baseView = await page.evaluate(() => {
      const { scene } = window.apparatusDemo;
      // The app exposes its fit after construction. Use that instead of the
      // camera's pre-resize default so each deliberate angle retains framing.
      scene.fit(false);
      return {
        camera: scene.camera.position.toArray(),
        target: scene.orbit.target.toArray(),
      };
    });
    for (const shot of deviceShots) {
      await page.evaluate(({ mode, inputs, t, dir, zoom, baseView }) => {
        const demo = window.apparatusDemo;
        demo.setPlaying(false);
        for (const [control, value] of Object.entries(inputs)) demo.setInput(control, value);
        demo.state.t = t;
        demo.scene.model.update(t, demo.state.inputs);
        demo.setMode(mode);
        if (mode !== 'explode') demo.state.phase = 'closed';
      }, { ...shot, baseView });
      if (shot.mode === 'explode') {
        await page.waitForFunction(() => window.apparatusDemo.state.phase === 'open', undefined, { timeout: 6000 });
      }
      // `setMode` starts a fit tween. Let it finish before applying the
      // deliberate QA angle, otherwise the runtime camera tween overwrites it.
      await page.waitForTimeout(1350);
      const shotView = await page.evaluate(({ mode }) => {
        const { scene } = window.apparatusDemo;
        scene.fit(mode === 'explode', false);
        return { camera: scene.camera.position.toArray(), target: scene.orbit.target.toArray() };
      }, { mode: shot.mode });
      await page.evaluate(({ dir, zoom, baseView }) => {
        const demo = window.apparatusDemo;
        const { camera, orbit } = demo.scene;
        camera.position.fromArray(baseView.camera);
        orbit.target.fromArray(baseView.target);
        const offset = camera.position.clone().sub(orbit.target);
        const distance = offset.length() / zoom;
        offset.set(...dir).normalize().multiplyScalar(distance);
        camera.position.copy(orbit.target).add(offset);
        camera.lookAt(orbit.target);
        orbit.update();
      }, { ...shot, baseView: shotView });
      await page.waitForTimeout(240);
      await page.screenshot({ path: `qa/apparatus/${shot.file}` });
      const title = await page.evaluate(() => window.apparatusDemo.definition.readout(window.apparatusDemo.state.t, window.apparatusDemo.state.inputs).title);
      if (errors.length) throw new Error(`${id}: ${errors.join('; ')}`);
      console.log(`${shot.file}: ${title}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
