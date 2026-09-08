import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import { chromium } from 'playwright-core';
import { inspectCurrentSceneAccessibility } from '../../site/tools/scene-accessibility.mjs';

const host = '127.0.0.1';
const port = Number(process.env.ACC_PORT || 4317);
const baseUrl = `http://${host}:${port}`;
const route = process.env.CINEVIEW_ACC_ROUTE || '/#/acceptance/drag';
const previewCommand = process.env.CINEVIEW_ACC_PREVIEW_CMD || 'pnpm';
const previewArgs =
  previewCommand === 'pnpm'
    ? [
        'exec',
        'vite',
        'preview',
        '--config',
        'vite.acceptance.config.ts',
        '--host',
        host,
        '--port',
        String(port),
        '--strictPort',
      ]
    : [];
const startupTimeoutMs = Number(process.env.CINEVIEW_ACC_STARTUP_TIMEOUT_MS || 15_000);
const assertionInjected = process.env.CINEVIEW_ACC_INJECT === 'assertion';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(condition, message, details) {
  if (!condition) {
    const suffix = details === undefined ? '' : `\n${JSON.stringify(details, null, 2)}`;
    throw new Error(`browser acceptance assertion failed: ${message}${suffix}`);
  }
}

function buildFixture() {
  if (process.env.CINEVIEW_ACC_SKIP_BUILD === '1') return;
  const result = spawnSync(
    'pnpm',
    ['exec', 'vite', 'build', '--config', 'vite.acceptance.config.ts'],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: 'utf8',
      stdio: 'pipe',
    }
  );
  if (result.status !== 0) {
    throw new Error(
      `acceptance fixture build failed\n${result.stdout || ''}\n${result.stderr || ''}`
    );
  }
}

async function waitForServer(child) {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await sleep(100);
  }
  throw new Error('preview server did not become ready');
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  const deadline = Date.now() + 2_000;
  while (child.exitCode === null && Date.now() < deadline) await sleep(50);
  if (child.exitCode === null) child.kill('SIGKILL');
}

function launchOptions() {
  if (process.env.CINEVIEW_CHROME_PATH) {
    return { executablePath: process.env.CINEVIEW_CHROME_PATH, headless: true };
  }
  return { channel: 'chrome', headless: true };
}

async function touchDriver(context, page) {
  const cdp = await context.newCDPSession(page);
  let pointerId = 1;
  return {
    async down(x, y) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y, id: pointerId, radiusX: 10, radiusY: 10, force: 1 }],
      });
    },
    async move(x, y) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y, id: pointerId, radiusX: 10, radiusY: 10, force: 1 }],
      });
    },
    async up() {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      pointerId += 1;
    },
    async cancel() {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      pointerId += 1;
    },
  };
}

async function moveSteps(driver, from, to, steps = 7) {
  for (let step = 1; step <= steps; step += 1) {
    await driver.move(195, from + ((to - from) * step) / steps);
    await sleep(24);
  }
}

async function readState(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-page="framework-drag-acceptance"]');
    if (!root) return null;
    return {
      authoredScenes: Number(root.getAttribute('data-authored-scenes')),
      current: Number(root.getAttribute('data-current-scene')),
      starts: Number(root.getAttribute('data-drag-starts')),
      blocked: Number(root.getAttribute('data-drag-blocked')),
      cancels: Number(root.getAttribute('data-drag-cancels')),
      commits: Number(root.getAttribute('data-drag-commits')),
      coldComplete: root.getAttribute('data-cold-complete') === 'true',
      coldFrames: Number(root.getAttribute('data-cold-frames')),
      coldMaximum: Number(root.getAttribute('data-cold-maximum')),
      coldMinimum: Number(root.getAttribute('data-cold-minimum')),
      coldMonotonic: root.getAttribute('data-cold-monotonic') === 'true',
      coldSawEntering: root.getAttribute('data-cold-saw-entering') === 'true',
      mountedScenes: document.querySelectorAll('[data-scene-index]').length,
      videoError: root.getAttribute('data-video-error') === 'true',
    };
  });
}

async function readRushState(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-page="framework-drag-acceptance"]');
    const sceneFrame = Array.from(document.querySelectorAll('[data-scene-index="1"]')).find(
      (element) => element instanceof HTMLElement && element.style.transform.includes('translate3d')
    );
    const video = document.querySelector('video[aria-label="acceptance-video-1"]');
    const match =
      sceneFrame instanceof HTMLElement
        ? /translate3d\((?:0|0px), (-?[\d.e-]+)%, (?:0|0px)\)/.exec(sceneFrame.style.transform)
        : null;
    return {
      commits: Number(root?.getAttribute('data-drag-commits')),
      current: Number(root?.getAttribute('data-current-scene')),
      incomingOffsetPercent: match ? Number(match[1]) : null,
      videoCurrentTime: video instanceof HTMLVideoElement ? video.currentTime : null,
    };
  });
}

async function run() {
  buildFixture();
  const server = spawn(previewCommand, previewArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let browser;
  const consoleErrors = [];
  const pageErrors = [];

  try {
    await waitForServer(server);
    try {
      browser = await chromium.launch(launchOptions());
    } catch (error) {
      throw new Error(
        `Chrome could not be launched. Set CINEVIEW_CHROME_PATH to a Chrome/Chromium executable. ${String(error)}`
      );
    }

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: false,
    });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        consoleErrors.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    try {
      await page.waitForSelector('[data-page="framework-drag-acceptance"]', { timeout: 5_000 });
    } catch {
      throw new Error('fixture root [data-page="framework-drag-acceptance"] not found');
    }
    await page.waitForFunction(() => document.querySelectorAll('[data-scene-index]').length >= 1);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-page="framework-drag-acceptance"]')
          ?.getAttribute('data-cold-complete') === 'true',
      undefined,
      { timeout: 3_000 }
    );
    await page.waitForFunction(
      () => {
        const video = document.querySelector('video[aria-label="acceptance-video-1"]');
        return (
          video instanceof HTMLVideoElement && Number.isFinite(video.duration) && video.duration > 0
        );
      },
      undefined,
      { timeout: 8_000 }
    );
    const driver = await touchDriver(context, page);

    const initial = await readState(page);
    assert(
      initial?.authoredScenes === 3 &&
        initial.current === 0 &&
        initial.mountedScenes >= 1 &&
        initial.coldComplete &&
        initial.coldFrames >= 3 &&
        initial.coldMinimum <= 0.05 &&
        initial.coldMaximum >= 0.999 &&
        initial.coldMonotonic &&
        initial.coldSawEntering &&
        !initial.videoError,
      'fixture did not initialize',
      initial
    );

    if (process.env.CINEVIEW_ACC_INJECT === 'active-scene-hidden') {
      await page
        .locator('[data-scene-index="0"]')
        .first()
        .evaluate((wrapper) => {
          wrapper.firstElementChild?.setAttribute('inert', '');
        });
    }
    if (process.env.CINEVIEW_ACC_INJECT === 'active-scene-aria-hidden') {
      await page
        .locator('[data-scene-index="0"]')
        .first()
        .evaluate((wrapper) => {
          wrapper.firstElementChild?.setAttribute('aria-hidden', 'true');
        });
    }
    const accessibility = await page.evaluate(inspectCurrentSceneAccessibility);
    assert(
      accessibility.currentSceneFound && !accessibility.currentSceneHidden,
      'current scene is missing or hidden from assistive technology',
      accessibility
    );

    await driver.down(195, 620);
    await sleep(40);
    await driver.up();
    await sleep(80);
    const afterTap = await readState(page);
    assert(
      afterTap?.starts === 0 && afterTap.commits === 0,
      'candidate tap created a drag session',
      afterTap
    );

    await driver.down(195, 650);
    await moveSteps(driver, 650, 330);
    await driver.cancel();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-page="framework-drag-acceptance"]')
          ?.getAttribute('data-drag-cancels') === '1',
      undefined,
      { timeout: 3_000 }
    );
    const afterCancel = await readState(page);
    assert(
      afterCancel?.current === 0 && afterCancel.cancels === 1 && afterCancel.commits === 0,
      'pointercancel did not bounce exactly once',
      afterCancel
    );

    // A tap on an in-flight bounce is only a reversible candidate suspension:
    // hold both release lanes, then resume the original bounce with no new
    // ownership or terminal callback.
    await driver.down(195, 650);
    await moveSteps(driver, 650, 560, 4);
    await driver.up();
    await sleep(30);
    await driver.down(195, 420);
    const tapResumeHeldStart = await readRushState(page);
    await sleep(350);
    const tapResumeHeldEnd = await readRushState(page);
    assert(
      tapResumeHeldStart.current === 0 &&
        tapResumeHeldEnd.current === 0 &&
        tapResumeHeldEnd.commits === 0 &&
        tapResumeHeldStart.incomingOffsetPercent !== null &&
        tapResumeHeldEnd.incomingOffsetPercent !== null &&
        Math.abs(
          tapResumeHeldEnd.incomingOffsetPercent - tapResumeHeldStart.incomingOffsetPercent
        ) <= 0.75 &&
        tapResumeHeldStart.videoCurrentTime !== null &&
        tapResumeHeldEnd.videoCurrentTime !== null &&
        Math.abs(tapResumeHeldEnd.videoCurrentTime - tapResumeHeldStart.videoCurrentTime) <= 0.15,
      'candidate tap did not freeze the in-flight bounce continuation',
      { tapResumeHeldStart, tapResumeHeldEnd }
    );
    await driver.up();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-page="framework-drag-acceptance"]')
          ?.getAttribute('data-drag-cancels') === '2',
      undefined,
      { timeout: 3_000 }
    );
    const afterTapResume = await readRushState(page);
    assert(
      afterTapResume.current === 0 &&
        afterTapResume.commits === 0 &&
        afterTapResume.incomingOffsetPercent !== null &&
        afterTapResume.incomingOffsetPercent >= 99,
      'candidate tap did not resume and finish the original bounce',
      afterTapResume
    );

    await driver.down(195, 650);
    await moveSteps(driver, 650, 120, 9);
    await driver.up();
    await sleep(30);

    // Rush re-grab while the release lanes are still in flight. Candidate hold
    // must freeze both the page slide and AnimateVideo frame beyond the original
    // release completion window; the first owned frame then keeps that baseline.
    await driver.down(195, 420);
    await sleep(30);
    const rushHeldStart = await readRushState(page);
    await sleep(550);
    const rushHeldEnd = await readRushState(page);
    assert(
      rushHeldStart.current === 0 &&
        rushHeldEnd.current === 0 &&
        rushHeldEnd.commits === 0 &&
        rushHeldStart.incomingOffsetPercent !== null &&
        rushHeldEnd.incomingOffsetPercent !== null &&
        Math.abs(rushHeldEnd.incomingOffsetPercent - rushHeldStart.incomingOffsetPercent) <= 0.75 &&
        rushHeldStart.videoCurrentTime !== null &&
        rushHeldEnd.videoCurrentTime !== null &&
        Math.abs(rushHeldEnd.videoCurrentTime - rushHeldStart.videoCurrentTime) <= 0.15,
      'rush re-grab candidate did not freeze both release lanes',
      { rushHeldStart, rushHeldEnd }
    );

    await driver.move(195, 419);
    await sleep(40);
    const rushOwned = await readRushState(page);
    assert(
      rushOwned.incomingOffsetPercent !== null &&
        rushHeldEnd.incomingOffsetPercent !== null &&
        Math.abs(rushOwned.incomingOffsetPercent - rushHeldEnd.incomingOffsetPercent) <= 1 &&
        rushOwned.videoCurrentTime !== null &&
        rushHeldEnd.videoCurrentTime !== null &&
        Math.abs(rushOwned.videoCurrentTime - rushHeldEnd.videoCurrentTime) <= 0.15,
      'rush re-grab ownership baseline teleported the page or video frame',
      { rushHeldEnd, rushOwned }
    );

    await moveSteps(driver, 419, 250, 4);
    const rushAdvanced = await readRushState(page);
    assert(
      rushAdvanced.incomingOffsetPercent !== null &&
        rushHeldEnd.incomingOffsetPercent !== null &&
        rushAdvanced.incomingOffsetPercent < rushHeldEnd.incomingOffsetPercent - 1 &&
        rushAdvanced.videoCurrentTime !== null &&
        rushHeldEnd.videoCurrentTime !== null &&
        rushAdvanced.videoCurrentTime > rushHeldEnd.videoCurrentTime + 0.05,
      'rush re-grab did not resume page and video progress from the frozen baseline',
      { rushHeldEnd, rushAdvanced }
    );
    await driver.up();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-page="framework-drag-acceptance"]')
          ?.getAttribute('data-current-scene') === '1',
      undefined,
      { timeout: 3_000 }
    );
    const afterCommit = await readState(page);
    const commitCondition =
      afterCommit?.current === 1 &&
      afterCommit.starts === 3 &&
      afterCommit.cancels === 2 &&
      afterCommit.commits === 1;
    assert(
      assertionInjected ? !commitCondition : commitCondition,
      'forward drag did not commit exactly once',
      afterCommit
    );

    await driver.down(195, 650);
    await moveSteps(driver, 650, 260);
    await driver.up();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-page="framework-drag-acceptance"]')
          ?.getAttribute('data-drag-blocked') === '1',
      undefined,
      { timeout: 3_000 }
    );
    const afterBlocked = await readState(page);
    assert(
      afterBlocked?.current === 1 &&
        afterBlocked.blocked === 1 &&
        afterBlocked.commits === 1 &&
        afterBlocked.starts === 3 &&
        afterBlocked.cancels === 2,
      'disabled direction acquired ownership or emitted duplicate callbacks',
      afterBlocked
    );

    assert(consoleErrors.length === 0, 'console warnings/errors were emitted', consoleErrors);
    assert(pageErrors.length === 0, 'page errors were emitted', pageErrors);
    console.log(
      JSON.stringify({
        status: 'PASS',
        initial,
        afterTap,
        afterCancel,
        tapResumeHeldStart,
        tapResumeHeldEnd,
        afterTapResume,
        rushHeldStart,
        rushHeldEnd,
        rushOwned,
        rushAdvanced,
        afterCommit,
        afterBlocked,
      })
    );
    await context.close();
  } finally {
    await browser?.close();
    await stopServer(server);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
