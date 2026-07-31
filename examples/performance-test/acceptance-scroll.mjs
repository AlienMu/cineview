import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import { chromium } from 'playwright-core';

const host = '127.0.0.1';
const port = Number(process.env.SCROLL_ACC_PORT || 4318);
const baseUrl = `http://${host}:${port}`;
const route = process.env.CINEVIEW_SCROLL_ACC_ROUTE || '/#/acceptance/scroll';
const previewCommand = process.env.CINEVIEW_SCROLL_ACC_PREVIEW_CMD || 'pnpm';
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
const startupTimeoutMs = Number(process.env.CINEVIEW_SCROLL_ACC_STARTUP_TIMEOUT_MS || 15_000);
const assertionInjection = process.env.CINEVIEW_SCROLL_ACC_INJECT;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(condition, message, details) {
  if (!condition) {
    const suffix = details === undefined ? '' : `\n${JSON.stringify(details, null, 2)}`;
    throw new Error(`scroll browser acceptance assertion failed: ${message}${suffix}`);
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
      `scroll acceptance fixture build failed\n${result.stdout || ''}\n${result.stderr || ''}`
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
  throw new Error('scroll preview server did not become ready');
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
    async swipeUp(fromY, toY) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 195, y: fromY, id: pointerId, radiusX: 10, radiusY: 10, force: 1 }],
      });
      for (let step = 1; step <= 6; step += 1) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            {
              x: 195,
              y: fromY + ((toY - fromY) * step) / 6,
              id: pointerId,
              radiusX: 10,
              radiusY: 10,
              force: 1,
            },
          ],
        });
        await sleep(20);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      pointerId += 1;
    },
  };
}

async function readState(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-page="framework-scroll-acceptance"]');
    const container = document.querySelector('[data-cineview-container="true"]');
    const scrollbar = document.querySelector('[role="scrollbar"]');
    const visual = document.querySelector('[data-zone-visual="acceptance-zone-a-0"]');
    const motionNode = visual?.parentElement;
    const motionStyle = motionNode ? window.getComputedStyle(motionNode) : null;
    const fixedProbe = document.querySelector('[data-fixed-probe="acceptance-zone-a"]');
    const fixedRect = fixedProbe?.getBoundingClientRect();
    const longTasks = window.__cineviewAcceptanceLongTasks ?? [];
    if (!(root instanceof HTMLElement) || !(container instanceof HTMLElement)) return null;
    let progressHistory = [];
    try {
      progressHistory = JSON.parse(root.dataset.progressHistory ?? '[]');
    } catch {
      progressHistory = [];
    }

    return {
      ready: root.dataset.ready === 'true',
      authoredScenes: Number(root.dataset.authoredScenes),
      currentScene: Number(root.dataset.currentScene),
      zoneA: Number(root.dataset.zoneAProgress),
      zoneB: Number(root.dataset.zoneBProgress),
      zoneEnters: Number(root.dataset.zoneEnters),
      zoneLeaves: Number(root.dataset.zoneLeaves),
      progressEvents: Number(root.dataset.progressEvents),
      progressHistory,
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight,
      scrollbarNow: Number(scrollbar?.getAttribute('aria-valuenow')),
      scrollbarMax: Number(scrollbar?.getAttribute('aria-valuemax')),
      visualOpacity: Number(motionStyle?.opacity ?? Number.NaN),
      visualTransform: motionStyle?.transform ?? '',
      fixedTop: fixedRect?.top ?? Number.NaN,
      fixedBottom: fixedRect?.bottom ?? Number.NaN,
      longTaskCount: longTasks.length,
      maxLongTaskMs: longTasks.reduce((maximum, duration) => Math.max(maximum, duration), 0),
      longTaskObserverSupported: 'PerformanceObserver' in window,
    };
  });
}

async function waitForState(page, predicate, label, timeoutMs = 4_000) {
  const deadline = Date.now() + timeoutMs;
  let state = await readState(page);
  while (Date.now() < deadline) {
    if (state && predicate(state)) return state;
    await sleep(40);
    state = await readState(page);
  }
  throw new Error(
    `scroll acceptance timed out waiting for ${label}\n${JSON.stringify(state, null, 2)}`
  );
}

async function wheel(page, deltaY) {
  await page.mouse.move(195, 420);
  await page.mouse.wheel(0, deltaY);
  await sleep(170);
}

async function advanceWithWheel(page, predicate, deltaY, label) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const state = await readState(page);
    if (state && predicate(state)) return state;
    await wheel(page, deltaY);
  }
  return waitForState(page, predicate, label);
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
    await context.addInitScript(() => {
      window.__cineviewAcceptanceLongTasks = [];
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              window.__cineviewAcceptanceLongTasks.push(entry.duration);
            }
          });
          observer.observe({ type: 'longtask', buffered: true });
        } catch {
          // Older Chromium builds may not expose longtask entries.
        }
      }
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
      await page.waitForSelector('[data-page="framework-scroll-acceptance"]', { timeout: 5_000 });
    } catch {
      throw new Error('fixture root [data-page="framework-scroll-acceptance"] not found');
    }
    const initial = await waitForState(
      page,
      (state) => state.ready && state.scrollbarMax > 0,
      'fixture readiness'
    );
    assert(
      initial.authoredScenes === 5 && initial.zoneA === 0 && initial.zoneB === 0,
      'fixture did not initialize at both zone origins',
      initial
    );
    await page.evaluate(() => {
      window.__cineviewAcceptanceLongTasks = [];
    });

    await page.locator('[data-acceptance-action="go-zone-a"]').evaluate((button) => button.click());
    const atZoneAStart = await waitForState(
      page,
      (state) => state.zoneA === 0 && state.scrollTop > 0,
      'zone A exact segmentStart positioning'
    );

    await wheel(page, 100_000);
    const afterForwardFlick = await waitForState(
      page,
      (state) => state.zoneA > 0 && state.zoneA < 1 && state.zoneB === 0,
      'forward large-input anti-skip frame'
    );
    const firstForwardEvent = afterForwardFlick.progressHistory
      .slice(atZoneAStart.progressHistory.length)
      .find((event) => event.zoneId === 'acceptance-zone-a');
    const forwardFlickCondition =
      firstForwardEvent?.progress > 0 &&
      firstForwardEvent.progress < 1 &&
      firstForwardEvent.scrollTop === atZoneAStart.scrollTop + 1 &&
      afterForwardFlick.zoneB === 0;
    assert(
      assertionInjection === 'assertion' ? !forwardFlickCondition : forwardFlickCondition,
      'large forward input skipped the first center-lock segment',
      { atZoneAStart, firstForwardEvent, afterForwardFlick }
    );

    const container = page.locator('[data-cineview-container="true"]');
    await container.focus();
    await page.keyboard.press('ArrowDown');
    const afterKeyboard = await waitForState(
      page,
      (state) => state.zoneA > afterForwardFlick.zoneA,
      'container keyboard progress'
    );

    const touch = await touchDriver(context, page);
    await touch.swipeUp(620, 500);
    const afterTouch = await waitForState(
      page,
      (state) => state.zoneA > afterKeyboard.zoneA,
      'touch progress'
    );

    await page.evaluate(() => {
      const scrollRoot = document.querySelector('[data-cineview-container="true"]');
      if (!(scrollRoot instanceof HTMLElement)) return;
      scrollRoot.scrollTop += 53;
      scrollRoot.dispatchEvent(new Event('scroll'));
    });
    const afterNative = await waitForState(
      page,
      (state) => state.zoneA > afterTouch.zoneA,
      'native scroll reconciliation'
    );
    assert(
      afterNative.visualOpacity > 0 &&
        afterNative.visualOpacity < 1 &&
        afterNative.fixedTop >= 0 &&
        afterNative.fixedBottom <= afterNative.clientHeight,
      'concurrent animations or scene-scoped fixed layer did not remain live in the takeover shell',
      afterNative
    );

    const afterZoneAComplete = await advanceWithWheel(
      page,
      (state) => state.zoneA === 1,
      360,
      'zone A completion'
    );
    assert(
      afterZoneAComplete.zoneA === 1 && afterZoneAComplete.visualOpacity > 0.99,
      'zone A did not reach its exact visual endpoint',
      afterZoneAComplete
    );
    const zoneABudgetPx = afterZoneAComplete.scrollTop - atZoneAStart.scrollTop;
    const forwardProgressCondition =
      zoneABudgetPx > 1 &&
      firstForwardEvent !== undefined &&
      Math.abs(firstForwardEvent.progress - 1 / zoneABudgetPx) < 0.000001;
    assert(
      assertionInjection === 'forward-progress'
        ? !forwardProgressCondition
        : forwardProgressCondition,
      'zone A first forward interior frame did not publish exact one-pixel progress',
      { atZoneAStart, firstForwardEvent, afterZoneAComplete, zoneABudgetPx }
    );

    const reverseHistoryStart = afterZoneAComplete.progressHistory.length;
    await wheel(page, -100_000);
    const afterZoneAEndpointReverse = await waitForState(
      page,
      (state) => state.zoneA > 0 && state.zoneA < 1,
      'zone A reverse anti-skip frame from exact endpoint'
    );
    const firstReverseEvent = afterZoneAEndpointReverse.progressHistory
      .slice(reverseHistoryStart)
      .find((event) => event.zoneId === 'acceptance-zone-a');
    const reverseEndpointCondition =
      firstReverseEvent?.scrollTop === afterZoneAComplete.scrollTop - 1 &&
      Math.abs(firstReverseEvent.progress - (1 - 1 / zoneABudgetPx)) < 0.000001;
    assert(
      assertionInjection === 'reverse-endpoint'
        ? !reverseEndpointCondition
        : reverseEndpointCondition,
      'zone A exact endpoint reverse skipped its required segment-interior frame',
      { afterZoneAComplete, firstReverseEvent, afterZoneAEndpointReverse, zoneABudgetPx }
    );
    await advanceWithWheel(page, (state) => state.zoneA === 1, 360, 'zone A recompletion');

    await wheel(page, 100_000);
    const afterZoneBCross = await waitForState(
      page,
      (state) => state.zoneA === 1 && state.zoneB > 0 && state.zoneB < 1,
      'zone B forward anti-skip frame'
    );

    const scrollbar = page.getByRole('scrollbar', {
      name: 'Framework scroll acceptance timeline',
    });
    await scrollbar.focus();
    await page.keyboard.press('ArrowDown');
    const afterScrollbarForward = await waitForState(
      page,
      (state) => state.zoneB > afterZoneBCross.zoneB,
      'scrollbar forward progress'
    );
    await page.keyboard.press('ArrowUp');
    const afterScrollbarBackward = await waitForState(
      page,
      (state) => state.zoneB < afterScrollbarForward.zoneB && state.zoneB > 0,
      'scrollbar backward progress'
    );
    assert(
      afterScrollbarBackward.zoneB < afterScrollbarForward.zoneB,
      'scrollbar did not use the same reversible reducer',
      { afterScrollbarForward, afterScrollbarBackward }
    );

    await page.keyboard.press('End');
    const afterZoneBComplete = await waitForState(
      page,
      (state) => state.zoneB === 1,
      'zone B completion through scrollbar'
    );
    await wheel(page, 320);
    const inTail = await waitForState(
      page,
      (state) => state.scrollTop > afterZoneBComplete.scrollTop && state.zoneB === 1,
      'native tail release'
    );

    await wheel(page, -100_000);
    const afterReverseFlickB = await waitForState(
      page,
      (state) => state.zoneB > 0 && state.zoneB < 1 && state.zoneA === 1,
      'zone B reverse re-lock frame'
    );
    const afterZoneBReset = await advanceWithWheel(
      page,
      (state) => state.zoneB === 0,
      -360,
      'zone B reverse completion'
    );

    await wheel(page, -100_000);
    const afterReverseFlickA = await waitForState(
      page,
      (state) => state.zoneB === 0 && state.zoneA > 0 && state.zoneA < 1,
      'zone A reverse re-lock after zone B'
    );
    const finalState = await advanceWithWheel(
      page,
      (state) => state.zoneA === 0 && state.zoneB === 0,
      -360,
      'zone A reverse completion'
    );

    assert(
      afterReverseFlickB.zoneB > 0 &&
        afterZoneBReset.zoneB === 0 &&
        afterReverseFlickA.zoneA > 0 &&
        afterReverseFlickA.zoneB === 0 &&
        finalState.zoneA === 0,
      'multiple zones did not replay in reverse document order',
      { inTail, afterReverseFlickB, afterZoneBReset, afterReverseFlickA, finalState }
    );
    assert(
      finalState.zoneEnters >= 4 && finalState.zoneLeaves >= 4,
      'zone enter/leave callbacks did not cover forward and reverse ownership',
      finalState
    );
    assert(
      !finalState.longTaskObserverSupported || finalState.maxLongTaskMs < 200,
      'concurrent scroll animations produced a blocking long task',
      finalState
    );
    assert(consoleErrors.length === 0, 'console warnings/errors were emitted', consoleErrors);
    assert(pageErrors.length === 0, 'page errors were emitted', pageErrors);

    console.log(
      JSON.stringify({
        status: 'PASS',
        initial,
        atZoneAStart,
        afterForwardFlick,
        afterKeyboard,
        afterTouch,
        afterNative,
        afterZoneAComplete,
        afterZoneAEndpointReverse,
        afterZoneBCross,
        afterScrollbarForward,
        afterScrollbarBackward,
        afterZoneBComplete,
        inTail,
        afterReverseFlickB,
        afterZoneBReset,
        afterReverseFlickA,
        finalState,
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
