import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4198/';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--ignore-gpu-blocklist'],
});
const report = { checks: [], failures: [], metrics: {}, pageErrors: [], externalOfflineRequests: [] };
const errorsByPage = new WeakMap();

const qaProbe = () => {
  window.__homeMotionQaEnteredAt = performance.now();
  let clickAt = null;
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('.apparatus') : null;
    if (!target) return;
    clickAt = Date.now();
    sessionStorage.setItem('__homeMotionQaClickAt', String(clickAt));
    sessionStorage.setItem('__homeMotionQaClickDetail', String(event.detail));
  }, true);
  addEventListener('pagehide', () => {
    if (clickAt !== null) sessionStorage.setItem('__homeMotionQaExitDelay', String(Date.now() - clickAt));
  }, { once: true });
};

const motionSnapshot = (page) => page.evaluate(() => {
  const frame = window.homeRoom?.previewFrame;
  const preview = frame?.contentWindow?.homeEnginePreview;
  const scene = frame?.contentWindow?.engineScene;
  const groups = scene?.assemblyPose?.groups;
  return {
    ready: Boolean(preview?.ready),
    running: Boolean(preview?.running),
    angle: preview?.angle ?? null,
    crankZ: groups?.crank?.rotation?.[2] ?? null,
    flywheelZ: groups?.flywheel?.rotation?.[2] ?? null,
    pistonY: groups?.piston?.position?.[1] ?? null,
    frameTitle: frame?.title ?? null,
    frameAriaHidden: frame?.getAttribute('aria-hidden') ?? null,
    frameTabIndex: frame?.getAttribute('tabindex') ?? null,
    framePointerEvents: frame ? getComputedStyle(frame).pointerEvents : null,
  };
});

async function addPage(context) {
  const page = await context.newPage();
  const pageErrors = [];
  errorsByPage.set(page, pageErrors);
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
    report.pageErrors.push(error.message);
  });
  return page;
}

async function run(name, task) {
  try {
    const detail = await task();
    report.checks.push({ name, detail: detail ?? 'passed' });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.failures.push({ name, error: error.stack || error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

try {
  await run('first-visit arrival, real engine cycle, hover stop, click exit and return', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await addPage(context);
    try {
      await page.addInitScript(qaProbe);
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.homeRoom?.arrivalPlayed === true && !document.documentElement.classList.contains('room-arriving'), null, { timeout: 2600 });
      const arrivalMs = await page.evaluate(() => performance.now() - window.__homeMotionQaEnteredAt);
      assert.ok(arrivalMs < 1900, `first-visit entrance should resolve around one second; got ${arrivalMs.toFixed(0)} ms`);
      assert.equal(await page.locator('.apparatus-engine').getAttribute('aria-describedby'), 'description-engine');

      await page.waitForFunction(() => window.homeRoom?.previewRunning === true, null, { timeout: 8000 });
      const iframe = page.locator('.apparatus-engine iframe.engine-live');
      assert.equal(await iframe.count(), 1, 'first visit creates one on-demand engine iframe');
      assert.equal(await page.locator('iframe').count(), 1, 'no other home instrument creates an iframe');
      const frameAttrs = await iframe.evaluate((element) => ({
        title: element.title,
        ariaHidden: element.getAttribute('aria-hidden'),
        tabIndex: element.getAttribute('tabindex'),
        pointerEvents: getComputedStyle(element).pointerEvents,
      }));
      assert.deepEqual(frameAttrs, {
        title: '汽油机运行预览', ariaHidden: 'true', tabIndex: '-1', pointerEvents: 'none',
      });
      assert.ok(await page.locator('.apparatus-engine').evaluate((element) => element.classList.contains('is-previewing')));

      const cycleStartedAt = Date.now();
      const resting = await motionSnapshot(page);
      assert.ok(resting.angle >= 410 && resting.angle < 500, `the cycle starts near the intended 410 degree rest pose; angle=${resting.angle}`);
      assert.ok(resting.crankZ !== null && resting.flywheelZ !== null && resting.pistonY !== null, 'rest pose exposes the engine mechanism');
      await page.waitForFunction(() => {
        const preview = window.homeRoom?.previewFrame?.contentWindow?.homeEnginePreview;
        return preview?.angle >= 500;
      }, null, { timeout: 1600 });
      const moving = await motionSnapshot(page);
      assert.equal(moving.ready, true);
      assert.equal(moving.running, true);
      assert.ok(moving.crankZ !== null && moving.flywheelZ !== null && moving.pistonY !== null, 'inspectable mechanical parts are present');
      assert.ok(Math.abs(moving.crankZ - resting.crankZ) > 0.2, `crank rotation must change during the cycle; rest=${resting.crankZ}, moving=${moving.crankZ}`);
      assert.ok(Math.abs(moving.flywheelZ - resting.flywheelZ) > 0.2, `flywheel rotation must change during the cycle; rest=${resting.flywheelZ}, moving=${moving.flywheelZ}`);
      assert.ok(Math.abs(moving.pistonY - resting.pistonY) > 0.006, `piston must move during the cycle; rest=${resting.pistonY}, moving=${moving.pistonY}`);
      assert.equal(await page.locator('.apparatus-preview img').count(), 3, 'all three assembled PNG previews stay in the page');
      assert.ok(await page.locator('.apparatus-preview img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth === 700)));
      assert.ok(await page.locator('.apparatus:not(.apparatus-engine) img').evaluateAll((images) => images.every((image) => Number(getComputedStyle(image).opacity) === 1)), 'the other four instruments remain static PNGs');
      assert.ok(Number(await page.locator('.apparatus-engine img').evaluate((image) => getComputedStyle(image).opacity)) < 0.1, 'only the engine PNG is replaced during its live preview');
      await page.screenshot({ path: 'qa/home-motion-engine-playing.png', fullPage: true });

      await page.waitForFunction(() => {
        const preview = window.homeRoom?.previewFrame?.contentWindow?.homeEnginePreview;
        return preview?.ready && !preview.running && Math.abs(preview.angle - 410) < 0.01
          && !document.querySelector('.apparatus-engine')?.classList.contains('is-previewing');
      }, null, { timeout: 4800 });
      const cycleMs = Date.now() - cycleStartedAt;
      const restA = await motionSnapshot(page);
      await page.waitForTimeout(180);
      const restB = await motionSnapshot(page);
      assert.ok(cycleMs >= 1800 && cycleMs <= 4800, `automatic preview should play one short cycle; observed ${cycleMs} ms`);
      assert.equal(restA.angle, 410, 'cycle returns to the approved 410 degree rest pose');
      assert.equal(restA.running, false);
      assert.ok(Math.abs(restB.crankZ - restA.crankZ) < 1e-6, 'crank remains at rest after the cycle');
      assert.ok(Math.abs(restB.pistonY - restA.pistonY) < 1e-6, 'piston remains at rest after the cycle');

      const captionResults = [];
      for (const kind of ['fridge', 'ac']) {
        const link = page.locator(`.apparatus-${kind}`);
        await link.hover();
        await page.waitForFunction((device) => window.homeRoom?.selected === device, kind, { timeout: 1000 });
        const description = link.locator('.apparatus-description');
        await page.waitForFunction((device) => {
          const element = document.querySelector(`.apparatus-${device} .apparatus-description`);
          return element && Number(getComputedStyle(element).opacity) > 0.9;
        }, kind, { timeout: 1000 });
        captionResults.push({
          kind,
          selected: await page.evaluate(() => window.homeRoom.selected),
          text: (await description.textContent()).trim(),
        });
      }
      const engine = page.locator('.apparatus-engine');
      const replayStartedAt = Date.now();
      await engine.hover();
      await page.waitForFunction(() => window.homeRoom?.previewRunning === true, null, { timeout: 1800 });
      const replayDelayMs = Date.now() - replayStartedAt;
      await page.waitForFunction(() => {
        const caption = document.querySelector('.apparatus-engine .apparatus-description');
        return window.homeRoom?.selected === 'engine' && caption && Number(getComputedStyle(caption).opacity) > 0.9;
      }, null, { timeout: 1000 });
      captionResults.push({
        kind: 'engine', selected: await page.evaluate(() => window.homeRoom.selected),
        text: (await engine.locator('.apparatus-description').textContent()).trim(),
      });
      assert.ok(replayDelayMs >= 270 && replayDelayMs < 1200, `fine-pointer replay should wait about 350 ms; got ${replayDelayMs} ms`);
      await page.waitForFunction(() => window.homeRoom.previewFrame.contentWindow.homeEnginePreview.angle > 430, null, { timeout: 1200 });
      await page.mouse.move(5, 5);
      await page.waitForFunction(() => window.homeRoom?.previewRunning === false, null, { timeout: 600 });
      const leaveA = await motionSnapshot(page);
      assert.equal(leaveA.running, false, 'hoverleave stops the engine immediately');
      assert.ok(await page.locator('.apparatus-engine').evaluate((element) => !element.classList.contains('is-previewing')));
      await page.waitForTimeout(80);
      const leaveB = await motionSnapshot(page);
      assert.equal(leaveB.angle, leaveA.angle, 'the paused pose stays fixed through the live-to-PNG fade');
      assert.ok(Math.abs(leaveB.crankZ - leaveA.crankZ) < 1e-6, 'crank does not continue turning after hoverleave');
      assert.ok(Math.abs(leaveB.pistonY - leaveA.pistonY) < 1e-6, 'piston does not continue moving after hoverleave');
      await page.waitForTimeout(160);
      const resetA = await motionSnapshot(page);
      await page.waitForTimeout(80);
      const resetB = await motionSnapshot(page);
      assert.equal(resetA.angle, 410, 'the hidden preview returns to rest after its crossfade');
      assert.equal(resetB.angle, 410, 'the hidden preview remains at rest after reset');
      assert.equal(await page.evaluate(() => window.homeRoom.selected), 'engine', 'caption returns to the default engine selection');

      await page.evaluate(() => sessionStorage.removeItem('__homeMotionQaClickAt'));
      await page.locator('.apparatus-fridge').click();
      await page.waitForFunction(() => location.pathname.endsWith('/refrigerator.html'), null, { timeout: 4000 });
      const exitDelayMs = await page.evaluate(() => Number(sessionStorage.getItem('__homeMotionQaExitDelay')));
      assert.ok(exitDelayMs >= 170 && exitDelayMs <= 650, `pointer click exit should take about 220 ms; got ${exitDelayMs} ms`);
      await page.locator('.room-home').waitFor({ timeout: 5000 });
      await page.locator('.room-home').click();
      await page.waitForFunction(() => location.pathname.endsWith('/index.html') || location.pathname === '/', null, { timeout: 5000 });
      await page.waitForFunction(() => Boolean(window.homeRoom), null, { timeout: 2500 });
      assert.equal(await page.evaluate(() => window.homeRoom.arrivalPlayed), false, 'returning in the same tab does not replay the first-visit entrance');
      assert.equal(await page.locator('iframe').count(), 0, 'returning home does not auto-start the engine again');
      assert.deepEqual(await pageErrorsFor(page), []);
      return {
        arrivalMs: Math.round(arrivalMs), automaticCycleMs: cycleMs, hoverReplayDelayMs: replayDelayMs,
        pointerExitDelayMs: Math.round(exitDelayMs), captions: captionResults,
        automaticCycleMovement: {
          angleAtSample: moving.angle,
          crankRadians: Math.abs(moving.crankZ - resting.crankZ),
          flywheelRadians: Math.abs(moving.flywheelZ - resting.flywheelZ),
          pistonMeters: Math.abs(moving.pistonY - resting.pistonY),
        },
        hoverLeave: { frozenAngle: leaveA.angle, resetAngle: resetA.angle },
      };
    } finally {
      await context.close();
    }
  });

  await run('keyboard activation keeps native navigation', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await addPage(context);
    try {
      await page.addInitScript(qaProbe);
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.homeRoom), null, { timeout: 2000 });
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').getAttribute('href'), './refrigerator.html');
      assert.equal(await page.evaluate(() => window.homeRoom.selected), 'fridge', 'keyboard focus updates the current caption');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => location.pathname.endsWith('/refrigerator.html'), null, { timeout: 4000 });
      const exitDelayMs = await page.evaluate(() => Number(sessionStorage.getItem('__homeMotionQaExitDelay')));
      const detail = await page.evaluate(() => Number(sessionStorage.getItem('__homeMotionQaClickDetail')));
      assert.equal(detail, 0, 'keyboard activation produces a native click');
      assert.ok(exitDelayMs < 150, `keyboard activation should bypass the 220 ms visual exit; got ${exitDelayMs} ms`);
      assert.deepEqual(await pageErrorsFor(page), []);
      return { clickDetail: detail, nativeExitDelayMs: Math.round(exitDelayMs) };
    } finally {
      await context.close();
    }
  });

  await run('reduced motion skips arrival and live preview, with usable native links', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const page = await addPage(context);
    try {
      await page.addInitScript(qaProbe);
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.homeRoom), null, { timeout: 2000 });
      assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('room-arriving')), false);
      assert.equal(await page.evaluate(() => window.homeRoom.arrivalPlayed), false);
      await page.waitForTimeout(450);
      assert.equal(await page.locator('iframe').count(), 0, 'reduced-motion first visit does not create the live iframe');
      await page.locator('.apparatus-engine').hover();
      await page.waitForTimeout(500);
      assert.equal(await page.evaluate(() => window.homeRoom.previewReady), false, 'reduced-motion hover does not initialize WebGL');
      assert.equal(await page.locator('iframe').count(), 0);
      assert.ok(Number(await page.locator('.apparatus-engine .apparatus-description').evaluate((e) => getComputedStyle(e).opacity)) > 0.9, 'the hovered link remains understandable');
      await page.locator('.apparatus-engine').click();
      await page.waitForFunction(() => location.pathname.endsWith('/engine.html'), null, { timeout: 4000 });
      const exitDelayMs = await page.evaluate(() => Number(sessionStorage.getItem('__homeMotionQaExitDelay')));
      assert.ok(exitDelayMs < 150, `reduced-motion link should navigate natively; got ${exitDelayMs} ms`);
      assert.deepEqual(await pageErrorsFor(page), []);
      return { autoArrival: false, iframeCreated: false, nativeExitDelayMs: Math.round(exitDelayMs) };
    } finally {
      await context.close();
    }
  });

  await run('mobile touch takes a direct one-tap route', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await addPage(context);
    try {
      await page.addInitScript(qaProbe);
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.homeRoom), null, { timeout: 2000 });
      assert.equal(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches), false);
      await page.locator('.apparatus-engine').tap();
      await page.waitForFunction(() => location.pathname.endsWith('/engine.html'), null, { timeout: 4000 });
      const exitDelayMs = await page.evaluate(() => Number(sessionStorage.getItem('__homeMotionQaExitDelay')));
      const detail = await page.evaluate(() => Number(sessionStorage.getItem('__homeMotionQaClickDetail')));
      assert.ok(exitDelayMs < 150, `mobile touch should retain a direct route; got ${exitDelayMs} ms`);
      assert.ok(detail > 0, 'touch activation is a pointer click, not keyboard activation');
      assert.deepEqual(await pageErrorsFor(page), []);
      return { clickDetail: detail, touchExitDelayMs: Math.round(exitDelayMs) };
    } finally {
      await context.close();
    }
  });

  await run('built file homepage embeds the playable engine preview without network access', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await addPage(context);
    page.on('request', (request) => {
      if (/^https?:/i.test(request.url())) report.externalOfflineRequests.push(request.url());
    });
    try {
      await page.addInitScript(qaProbe);
      await page.goto(pathToFileURL(resolve('index.html')).href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.homeRoom), null, { timeout: 2500 });
      assert.equal(await page.locator('.apparatus').count(), 3);
      await page.waitForFunction(() => window.homeRoom?.previewRunning === true, null, { timeout: 9000 });
      const resting = await motionSnapshot(page);
      await page.waitForFunction(() => window.homeRoom.previewFrame.contentWindow.homeEnginePreview.angle > 500, null, { timeout: 1800 });
      const moving = await motionSnapshot(page);
      assert.equal(moving.ready, true);
      assert.ok(Math.abs(moving.flywheelZ - resting.flywheelZ) > 0.2, 'offline preview changes the real flywheel pose');
      assert.equal(report.externalOfflineRequests.length, 0, 'offline homepage makes no HTTP(S) requests');
      await page.screenshot({ path: 'qa/home-motion-offline-preview.png', fullPage: true });
      await page.waitForFunction(() => {
        const preview = window.homeRoom.previewFrame.contentWindow.homeEnginePreview;
        return !preview.running && Math.abs(preview.angle - 410) < 0.01;
      }, null, { timeout: 4800 });
      assert.deepEqual(await pageErrorsFor(page), []);
      return { fileProtocol: true, externalRequests: report.externalOfflineRequests.length, engineAngleDuringPlayback: moving.angle };
    } finally {
      await context.close();
    }
  });
} finally {
  await browser.close();
  writeFileSync('qa/home-motion-results.json', JSON.stringify(report, null, 2));
}

if (report.failures.length) process.exitCode = 1;
else console.log(`All ${report.checks.length} focused motion browser checks passed.`);

async function pageErrorsFor(page) {
  return errorsByPage.get(page) ?? [];
}
