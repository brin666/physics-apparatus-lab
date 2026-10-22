import {chromium} from 'playwright';
import {copyFile, mkdir, rm} from 'node:fs/promises';
import {join, resolve, sep} from 'node:path';
import {
  BASE, ROOT, FRAMES, FPS, applyMediaLayout, encodeFrames, prepareFolders, writeReport,
} from './media-export-shared.mjs';

const WIDTH = 720;
const HEIGHT = 960;
const START_HOLD = Math.round(.33 * FPS);
const END_HOLD = Math.round(.6 * FPS);
const PREVIEW_DIR = join(ROOT, 'screenshots', 'engine-experiments-preview');
const previewOnly = process.argv.includes('--preview-only');

const clips = [
  {stem: 'engine-assembly', kind: 'engine', motion: 'assembly', file: 'engine.html', seconds: 6, representative: 3.3},
  {stem: 'engine-operation', kind: 'engine', motion: 'operation', file: 'engine.html', seconds: 8, representative: 4},
  {stem: 'joule-assembly', kind: 'joule', motion: 'assembly', file: 'joule.html', seconds: 5, representative: 2.5},
  {stem: 'joule-operation', kind: 'joule', motion: 'operation', file: 'joule.html', seconds: 7, representative: 3.5},
  {stem: 'gas-assembly', kind: 'gas', motion: 'assembly', file: 'gas-state.html', seconds: 5, representative: 2.5},
  {stem: 'gas-operation', kind: 'gas', motion: 'operation', file: 'gas-state.html', seconds: 6, operation: 'isothermal', representative: 3},
];

const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist']});
const context = await browser.newContext({
  viewport: {width: WIDTH, height: HEIGHT},
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const report = {
  generatedAt: new Date().toISOString(),
  viewport: {width: WIDTH, height: HEIGHT, deviceScaleFactor: 1},
  fps: FPS,
  loopHolds: {startSeconds: START_HOLD / FPS, endSeconds: END_HOLD / FPS},
  captureMethod: 'Playwright Chrome screenshots of the live Three.js apparatus; model state is manually set per frame and the scene presentation is settled before capture.',
  clips: [],
  errors: [],
};
let currentErrors = [];
page.on('pageerror', error => {
  const entry = `${page.url()}: ${error.message}`;
  currentErrors.push(entry);
  report.errors.push(entry);
});

function frameName(index) {
  return `${String(index).padStart(4, '0')}.png`;
}

async function openClip(clip) {
  currentErrors = [];
  await page.setViewportSize({width: WIDTH, height: HEIGHT});
  await page.goto(`${BASE}${clip.file}`, {waitUntil: 'load'});
  await page.waitForFunction(kind => kind === 'engine' ? window.thermalDemo?.ready : window.experimentDemo?.ready, clip.kind, {timeout: 15000});
  await applyMediaLayout(page);
  if (clip.kind !== 'engine') {
    await page.addStyleTag({content: `
      body .experiment-hud{top:65px!important;left:auto!important;right:18px!important}
      body .experiment-readouts{gap:12px!important;padding:9px 11px!important}
    `});
  }
  const modelFrame = page.frames().find(frame => frame.parentFrame());
  if (!modelFrame) throw new Error(`${clip.stem}: embedded apparatus frame did not load`);
  await modelFrame.waitForFunction(kind => kind === 'engine' ? !!window.engineScene : !!window.experimentScene, clip.kind, {timeout: 15000});
  await modelFrame.evaluate(() => {
    const scene = window.engineScene || window.experimentScene;
    scene.viewAction?.('reset');
    scene.settleView({presentation: true});
  });
  await settlePaint(modelFrame);
  return modelFrame;
}

async function setPose(clip, modelFrame, time) {
  const assembly = clip.motion === 'assembly';
  const position = assembly
    ? Math.min(time, clip.seconds - .001)
    : Math.max(0, Math.min(1, time / clip.seconds));

  await page.evaluate(({kind, assembly, position, operation}) => {
    if (kind === 'engine') {
      const demo = window.thermalDemo;
      if (assembly) {
        if (!demo.state.assembly.active) demo.startAssembly();
        demo.seekAssembly(position);
      } else {
        if (demo.state.assembly.active) demo.finishAssembly(false);
        demo.setMode('cut');
        demo.setAngle(position * 720, false);
      }
      demo.selectPart(null, true);
      return;
    }

    const demo = window.experimentDemo;
    if (assembly) {
      if (!demo.state.assembly.active) demo.startAssembly();
      demo.seekAssembly(position);
      return;
    }
    if (demo.state.assembly.active) demo.finishAssembly();
    if (operation && demo.experiment.operations?.some(item => item.id === operation)) demo.setOperation(operation);
    demo.setMode('cut');
    demo.setProgress(position);
  }, {
    kind: clip.kind,
    assembly,
    position,
    operation: clip.operation,
  });

  await modelFrame.waitForFunction(({kind, assembly, position}) => {
    const state = (window.engineScene || window.experimentScene)?.state;
    if (!state) return false;
    if (assembly) return state.assembly?.active === true && Math.abs(state.assembly.time - position) < .0001;
    if (kind === 'engine') return state.assembly?.active !== true && Math.abs(state.angle - position * 720) < .001;
    return state.assembly?.active !== true && Math.abs(state.progress - position) < .0001;
  }, {kind: clip.kind, assembly, position}, {timeout: 3000});

  await modelFrame.evaluate(() => {
    const scene = window.engineScene || window.experimentScene;
    scene.settleView({presentation: true});
    scene.lab?.render(0);
  });
  await settlePaint(modelFrame);
}

async function settlePaint(modelFrame) {
  await modelFrame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function screenshot(path) {
  await page.screenshot({path, animations: 'disabled', caret: 'hide', scale: 'css'});
}

async function savePreviews() {
  await mkdir(PREVIEW_DIR, {recursive: true});
  for (const clip of clips) {
    const modelFrame = await openClip(clip);
    await setPose(clip, modelFrame, 0);
    await screenshot(join(PREVIEW_DIR, `${clip.stem}-start.png`));
    await setPose(clip, modelFrame, clip.representative);
    await screenshot(join(PREVIEW_DIR, `${clip.stem}-representative.png`));
    console.log(`preview ready: ${clip.stem}`);
  }
}

async function resetFrameDirectory(stem) {
  const root = resolve(FRAMES);
  const dir = resolve(FRAMES, stem);
  if (!dir.startsWith(`${root}${sep}`)) throw new Error(`Refusing frame path outside ${root}: ${dir}`);
  await rm(dir, {recursive: true, force: true});
  await mkdir(dir, {recursive: true});
  return dir;
}

async function captureClip(clip) {
  const dir = await resetFrameDirectory(clip.stem);
  const modelFrame = await openClip(clip);
  const motionFrames = Math.round(clip.seconds * FPS);
  let outputIndex = 0;
  let progressCount = 0;
  const writePose = async time => {
    await setPose(clip, modelFrame, time);
    const path = join(dir, frameName(outputIndex++));
    await screenshot(path);
    progressCount++;
    if (progressCount % 25 === 0) console.log(`${clip.stem}: ${progressCount}/${motionFrames} motion frames`);
    return path;
  };

  const first = await writePose(0);
  for (let index = 1; index < START_HOLD; index++) {
    await copyFile(first, join(dir, frameName(outputIndex++)));
  }
  for (let index = 1; index < motionFrames; index++) {
    const time = clip.seconds * index / (motionFrames - 1);
    await writePose(time);
  }
  const last = join(dir, frameName(outputIndex - 1));
  for (let index = 0; index < END_HOLD; index++) {
    await copyFile(last, join(dir, frameName(outputIndex++)));
  }

  const encoded = await encodeFrames(dir, clip.stem);
  const entry = {
    ...encoded,
    kind: clip.kind,
    motion: clip.motion,
    sourcePage: clip.file,
    modelSeconds: clip.seconds,
    motionFrames,
    startHoldFrames: START_HOLD,
    endHoldFrames: END_HOLD,
    viewport: {width: WIDTH, height: HEIGHT, deviceScaleFactor: 1},
    pageErrors: [...currentErrors],
  };
  report.clips.push(entry);
  console.log(`encoded ${clip.stem}: ${encoded.frames} frames, ${(encoded.duration).toFixed(2)} s, GIF ${(encoded.gifBytes / 1048576).toFixed(2)} MiB, MP4 ${(encoded.videoBytes / 1048576).toFixed(2)} MiB`);
}

try {
  await prepareFolders();
  await mkdir(PREVIEW_DIR, {recursive: true});
  if (previewOnly) {
    await savePreviews();
    console.log(`saved 12 preview screenshots to ${PREVIEW_DIR}`);
  } else {
    for (const clip of clips) await captureClip(clip);
    await writeReport('engine-experiments-capture', report);
    if (report.errors.length) throw new Error(`Browser errors were recorded: ${report.errors.join(' | ')}`);
    console.log(`report written: ${join(ROOT, 'engine-experiments-capture.json')}`);
  }
} catch (error) {
  if (!previewOnly) await writeReport('engine-experiments-capture', report).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
