import playwright from '../site/node_modules/playwright/index.js';

const { chromium } = playwright;

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, values) => {
    if (!value.startsWith('--')) return pairs;
    const next = values[index + 1];
    pairs.push([value.slice(2), next && !next.startsWith('--') ? next : true]);
    return pairs;
  }, [])
);

const port = Number(args.port || process.env.ACC_PORT || 4173);
const route = String(args.route || '/__acceptance/video-drag');
const headless = args.headed !== true;
const url = `http://127.0.0.1:${port}${route}`;
const viewport = { width: 430, height: 900 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function installRecorder(page) {
  await page.evaluate(() => {
    const state = {
      frames: [],
      events: [],
      seeks: [],
      longTasks: [],
      recording: false,
      fingerY: null,
    };
    window.__videoDragAcceptance = state;

    const read = () => {
      const root = document.querySelector('[data-page="video-drag-acceptance"]');
      const scenes = {};
      document.querySelectorAll('[data-scene-index]').forEach((node) => {
        scenes[node.getAttribute('data-scene-index')] = Number(
          node.getBoundingClientRect().top.toFixed(3)
        );
      });
      const videos = {};
      document.querySelectorAll('video[aria-label^="acceptance-video-"]').forEach((video) => {
        const index = video.getAttribute('aria-label').split('-').at(-1);
        videos[index] = {
          currentTime: Number(video.currentTime.toFixed(4)),
          duration: Number.isFinite(video.duration) ? Number(video.duration.toFixed(4)) : null,
          paused: video.paused,
          ended: video.ended,
          readyState: video.readyState,
        };
      });
      return {
        t: performance.now(),
        current: Number(root?.getAttribute('data-current-scene') ?? -1),
        fingerY: state.fingerY,
        drag: {
          starts: Number(root?.getAttribute('data-drag-starts') ?? 0),
          blocked: Number(root?.getAttribute('data-drag-blocked') ?? 0),
          cancels: Number(root?.getAttribute('data-drag-cancels') ?? 0),
          commits: Number(root?.getAttribute('data-drag-commits') ?? 0),
        },
        scenes,
        videos,
      };
    };

    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
      addEventListener(
        type,
        (event) => {
          if (typeof event.clientY === 'number') state.fingerY = event.clientY;
          if (state.recording) {
            state.events.push({
              t: performance.now(),
              type,
              y: event.clientY,
              isTrusted: event.isTrusted,
            });
          }
        },
        { capture: true, passive: true }
      );
    }

    document.querySelectorAll('video[aria-label^="acceptance-video-"]').forEach((video) => {
      const label = video.getAttribute('aria-label');
      video.addEventListener('seeking', () => {
        if (state.recording) {
          state.seeks.push({ t: performance.now(), label, currentTime: video.currentTime });
        }
      });
    });

    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          if (!state.recording) return;
          for (const entry of list.getEntries()) {
            state.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
          }
        });
        observer.observe({ type: 'longtask', buffered: false });
      } catch {
        // Long Task API is optional; the result reports an empty list when unavailable.
      }
    }

    const tick = () => {
      if (state.recording) state.frames.push(read());
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    window.__videoDragStart = () => {
      state.frames = [];
      state.events = [];
      state.seeks = [];
      state.longTasks = [];
      state.recording = true;
    };
    window.__videoDragStop = () => {
      state.recording = false;
      return {
        frames: state.frames,
        events: state.events,
        seeks: state.seeks,
        longTasks: state.longTasks,
        snapshot: read(),
      };
    };
    window.__videoDragSnapshot = read;
  });
}

function findStackJumps(frames) {
  const jumps = [];
  for (let index = 1; index < frames.length; index += 1) {
    const before = frames[index - 1];
    const after = frames[index];
    const shared = Object.keys(after.scenes).filter((key) => before.scenes[key] !== undefined);
    if (!shared.length) continue;
    const stackDelta =
      shared.reduce((sum, key) => sum + after.scenes[key] - before.scenes[key], 0) / shared.length;
    const fingerDelta =
      before.fingerY == null || after.fingerY == null ? 0 : after.fingerY - before.fingerY;
    if (Math.abs(stackDelta) > 140 && Math.abs(stackDelta) > Math.abs(fingerDelta) * 2) {
      jumps.push({ index, dt: after.t - before.t, stackDelta, fingerDelta });
    }
  }
  return jumps;
}

function findStationaryMediaJumps(frames, videoIndex, startAt = 0, endAt = frames.length) {
  const jumps = [];
  for (let index = Math.max(1, startAt); index < Math.min(endAt, frames.length); index += 1) {
    const before = frames[index - 1];
    const after = frames[index];
    const beforeVideo = before.videos[videoIndex];
    const afterVideo = after.videos[videoIndex];
    if (!beforeVideo || !afterVideo) continue;
    const fingerDelta =
      before.fingerY == null || after.fingerY == null ? 0 : after.fingerY - before.fingerY;
    const mediaDelta = afterVideo.currentTime - beforeVideo.currentTime;
    if (Math.abs(fingerDelta) <= 2 && Math.abs(mediaDelta) > 1.2) {
      jumps.push({ index, dt: after.t - before.t, mediaDelta, fingerDelta });
    }
  }
  return jumps;
}

function maxFrameGap(frames) {
  let max = 0;
  for (let index = 1; index < frames.length; index += 1) {
    max = Math.max(max, frames[index].t - frames[index - 1].t);
  }
  return max;
}

async function touchDriver(context, page) {
  const cdp = await context.newCDPSession(page);
  let id = 1;
  return {
    async down(x, y) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y, id, radiusX: 12, radiusY: 12, force: 1 }],
      });
    },
    async move(x, y) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y, id, radiusX: 12, radiusY: 12, force: 1 }],
      });
    },
    async up() {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      id += 1;
    },
    async cancel() {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      id += 1;
    },
  };
}

async function drag(driver, { x = 215, from, to, steps = 8, delay = 34, release = true }) {
  await driver.down(x, from);
  await sleep(delay);
  for (let step = 1; step <= steps; step += 1) {
    await driver.move(x, from + ((to - from) * step) / steps);
    await sleep(delay);
  }
  if (release) await driver.up();
}

const browser = await chromium.launch({ headless });
const context = await browser.newContext({
  viewport,
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: false,
});
const page = await context.newPage();
const consoleMessages = [];
const pageErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    consoleMessages.push({ type: message.type(), text: message.text().slice(0, 500) });
  }
});
page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 500)));

const report = { url, phases: {}, consoleMessages, pageErrors };
let failure;

try {
  // Vite's HMR socket and media range requests keep the network non-idle even
  // after the acceptance app is usable. The structural + readyState gates below
  // are the authoritative readiness signal for this browser harness.
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('[data-page="video-drag-acceptance"]', { timeout: 15_000 });
  await page.waitForFunction(() => {
    const videos = [...document.querySelectorAll('video[aria-label^="acceptance-video-"]')];
    return videos.length >= 2 && videos.every((video) => video.readyState >= 1);
  });
  await sleep(1_400);
  await installRecorder(page);
  const driver = await touchDriver(context, page);
  await page.evaluate(() => window.__videoDragStart());

  // 1. Sub-threshold bounce plus candidate tap: pointer-down reversibly freezes the
  // continuation, and pointer-up without directional ownership resumes the SAME bounce.
  await drag(driver, { from: 620, to: 515, steps: 6, delay: 55 });
  const bounceRelease = await page.evaluate(() => window.__videoDragSnapshot());
  await sleep(45);
  const beforeCandidateTap = await page.evaluate(() => window.__videoDragSnapshot());
  await driver.down(215, 560);
  await sleep(120);
  const heldCandidateTap = await page.evaluate(() => window.__videoDragSnapshot());
  await driver.up();
  await sleep(750);
  const bounceEnd = await page.evaluate(() => window.__videoDragSnapshot());
  assert(bounceRelease.videos[1]?.currentTime > 0.2, 'bounce never scrubbed incoming video', {
    bounceRelease,
  });
  assert(
    Math.abs(heldCandidateTap.videos[1].currentTime - beforeCandidateTap.videos[1].currentTime) <=
      0.2,
    'candidate tap did not freeze the in-flight video continuation',
    { beforeCandidateTap, heldCandidateTap }
  );
  assert(
    heldCandidateTap.drag.starts === beforeCandidateTap.drag.starts &&
      heldCandidateTap.drag.cancels === beforeCandidateTap.drag.cancels &&
      heldCandidateTap.drag.commits === beforeCandidateTap.drag.commits,
    'candidate tap created a public drag session before ownership',
    { beforeCandidateTap, heldCandidateTap }
  );
  assert(bounceEnd.current === 0, 'candidate tap prevented bounce from resuming', { bounceEnd });
  assert(bounceEnd.videos[1]?.currentTime <= 0.15, 'resumed bounce did not rewind video to zero', {
    bounceRelease,
    bounceEnd,
  });
  report.phases.candidateTapResume = {
    release: bounceRelease,
    beforeTap: beforeCandidateTap,
    held: heldCandidateTap,
    end: bounceEnd,
  };

  // 2. A genuine CDP touchCancel above the normal commit threshold must force a
  // bounce and emit cancel, never commit.
  const beforePointerCancel = await page.evaluate(() => window.__videoDragSnapshot());
  await driver.down(215, 650);
  for (let step = 1; step <= 7; step += 1) {
    await driver.move(215, 650 - (300 * step) / 7);
    await sleep(38);
  }
  const atPointerCancel = await page.evaluate(() => window.__videoDragSnapshot());
  await driver.cancel();
  await sleep(850);
  const afterPointerCancel = await page.evaluate(() => window.__videoDragSnapshot());
  const trustedPointerCancel = await page.evaluate(() =>
    window.__videoDragAcceptance.events.findLast((event) => event.type === 'pointercancel')
  );
  assert(
    trustedPointerCancel?.isTrusted === true,
    'CDP touchCancel did not produce a trusted pointercancel event',
    { trustedPointerCancel }
  );
  assert(
    atPointerCancel.drag.starts === beforePointerCancel.drag.starts + 1,
    'touchCancel gesture never acquired ownership',
    {
      beforePointerCancel,
      atPointerCancel,
    }
  );
  assert(afterPointerCancel.current === 0, 'touchCancel committed the scene instead of bouncing', {
    afterPointerCancel,
  });
  assert(
    afterPointerCancel.drag.cancels === beforePointerCancel.drag.cancels + 1 &&
      afterPointerCancel.drag.commits === beforePointerCancel.drag.commits,
    'touchCancel did not terminate with exactly one cancel and zero commits',
    { beforePointerCancel, afterPointerCancel }
  );
  report.phases.pointerCancel = {
    before: beforePointerCancel,
    atCancel: atPointerCancel,
    event: trustedPointerCancel,
    after: afterPointerCancel,
  };

  // 3. Release into settle, then rush re-grab. Down/ownership must freeze the exact media frame.
  await drag(driver, { from: 650, to: 245, steps: 8, delay: 42 });
  await sleep(110);
  const beforeRegrab = await page.evaluate(() => window.__videoDragSnapshot());
  await driver.down(215, 520);
  await sleep(90);
  const heldRegrab = await page.evaluate(() => window.__videoDragSnapshot());
  await driver.move(215, 519);
  await sleep(55);
  const ownedRegrab = await page.evaluate(() => window.__videoDragSnapshot());
  assert(
    Math.abs(heldRegrab.videos[1].currentTime - beforeRegrab.videos[1].currentTime) <= 0.35,
    'candidate re-grab did not freeze video time',
    { beforeRegrab, heldRegrab }
  );
  assert(
    Math.abs(ownedRegrab.videos[1].currentTime - heldRegrab.videos[1].currentTime) <= 0.35,
    'first owned re-grab frame jumped video time',
    { heldRegrab, ownedRegrab }
  );
  // Keep the owned continuation physically realistic: a single 169px CDP move
  // updates the captured finger coordinate one frame before React paints the
  // matching transform, which makes the frame-local teleport detector report a
  // false positive. Step the same total travel without relaxing its 140px gate.
  for (let step = 1; step <= 6; step += 1) {
    await driver.move(215, 519 - (169 * step) / 6);
    await sleep(42);
  }
  await driver.up();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-page="video-drag-acceptance"]')
        ?.getAttribute('data-current-scene') === '1',
    undefined,
    { timeout: 3_000 }
  );
  await sleep(1_150);
  const forwardEnd = await page.evaluate(() => window.__videoDragSnapshot());
  assert(
    forwardEnd.videos[1]?.currentTime >= 9.5,
    'forward settle did not complete video timeline',
    {
      forwardEnd,
    }
  );
  report.phases.forwardRegrab = { beforeRegrab, heldRegrab, ownedRegrab, end: forwardEnd };

  // 4. Scene 2 is business-disabled. Repeated forward moves in one press must
  // emit exactly one blocked callback, never establish ownership, and never
  // create a terminal drag callback.
  const beforeBlocked = await page.evaluate(() => window.__videoDragSnapshot());
  await driver.down(215, 650);
  for (let step = 1; step <= 8; step += 1) {
    await driver.move(215, 650 - (260 * step) / 8);
    await sleep(36);
  }
  const heldBlocked = await page.evaluate(() => window.__videoDragSnapshot());
  await driver.up();
  await sleep(180);
  const afterBlocked = await page.evaluate(() => window.__videoDragSnapshot());
  assert(
    heldBlocked.drag.blocked === beforeBlocked.drag.blocked + 1 &&
      afterBlocked.drag.blocked === heldBlocked.drag.blocked,
    'disabled direction did not emit exactly one blocked callback per press',
    { beforeBlocked, heldBlocked, afterBlocked }
  );
  assert(
    afterBlocked.current === 1 &&
      afterBlocked.drag.starts === beforeBlocked.drag.starts &&
      afterBlocked.drag.cancels === beforeBlocked.drag.cancels &&
      afterBlocked.drag.commits === beforeBlocked.drag.commits,
    'disabled direction acquired ownership or emitted a terminal callback',
    { beforeBlocked, afterBlocked }
  );
  report.phases.blockedDirection = {
    before: beforeBlocked,
    held: heldBlocked,
    after: afterBlocked,
  };

  // 5. Backward return. Sample after ownership and assert continuity across the index commit.
  await driver.down(215, 250);
  await sleep(45);
  await driver.move(215, 251);
  await sleep(55);
  const backwardOwned = await page.evaluate(() => window.__videoDragSnapshot());
  for (let step = 1; step <= 8; step += 1) {
    await driver.move(215, 251 + (390 * step) / 8);
    await sleep(42);
  }
  await driver.up();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-page="video-drag-acceptance"]')
        ?.getAttribute('data-current-scene') === '0',
    undefined,
    { timeout: 3_000 }
  );
  const backwardCommit = await page.evaluate(() => window.__videoDragSnapshot());
  await sleep(1_050);
  const backwardEnd = await page.evaluate(() => window.__videoDragSnapshot());
  assert(backwardCommit.current === 0, 'backward drag did not commit to scene zero', {
    backwardCommit,
  });
  assert(
    Number.isFinite(backwardOwned.videos[0]?.currentTime) &&
      Number.isFinite(backwardCommit.videos[0]?.currentTime),
    'backward return did not expose finite video time',
    { backwardOwned, backwardCommit }
  );
  report.phases.backward = { owned: backwardOwned, commit: backwardCommit, end: backwardEnd };

  const recording = await page.evaluate(() => window.__videoDragStop());
  const stackJumps = findStackJumps(recording.frames);
  const backwardStart = recording.frames.findIndex((frame) => frame.t >= backwardOwned.t);
  const videoOneJumps = findStationaryMediaJumps(recording.frames, '1', 0, backwardStart + 1);
  const videoZeroReturnJumps = findStationaryMediaJumps(recording.frames, '0', backwardStart);
  const frameGap = maxFrameGap(recording.frames);
  const worstLongTask = Math.max(0, ...recording.longTasks.map((entry) => entry.duration));

  assert(stackJumps.length === 0, 'whole scene stack teleported', stackJumps);
  assert(
    videoOneJumps.length === 0,
    'incoming video clock jumped without finger movement',
    videoOneJumps
  );
  assert(
    videoZeroReturnJumps.length === 0,
    'returning video clock jumped after ownership',
    videoZeroReturnJumps
  );
  assert(frameGap < 250, 'recorded frame gap exceeded 250ms', { frameGap });
  assert(worstLongTask < 200, 'recorded Long Task exceeded 200ms', { worstLongTask });
  assert(recording.seeks.length > 0, 'browser emitted no media seek events', recording.seeks);
  assert(pageErrors.length === 0, 'page errors were emitted', pageErrors);
  assert(consoleMessages.length === 0, 'console warnings/errors were emitted', consoleMessages);

  report.metrics = {
    frameCount: recording.frames.length,
    maxFrameGapMs: Number(frameGap.toFixed(2)),
    longTaskCount: recording.longTasks.length,
    worstLongTaskMs: Number(worstLongTask.toFixed(2)),
    seekCount: recording.seeks.length,
    stackJumps,
    videoOneJumps,
    videoZeroReturnJumps,
  };
  report.status = 'PASS';
} catch (error) {
  failure = error;
  report.status = 'FAIL';
  report.failure = {
    message: error instanceof Error ? error.message : String(error),
    details: error?.details,
  };
} finally {
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

if (failure) process.exitCode = 1;
