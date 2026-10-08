import { chromium, firefox, webkit } from 'playwright';
import os from 'node:os';

/**
 * Phase-0 gate harness (plan v3 §11). Same fixtures for 1.x and 2.0.
 *
 * Chrome: CDP CPU throttle, touch input, LoAF + longtask, rAF cadence,
 * trace PipelineReporter states (presented/dropped), LayerTree count/area,
 * Performance.getMetrics (heap, nodes). WebKit/Firefox: pointer/wheel input,
 * rAF cadence; a "long frame" there is a rAF gap > 50 ms (applied to 1.x too).
 */

const PAGES = { v1: '/v1/index.html', v2: '/v2.html', plain: '/plain.html', 'v1-heavy': '/v1/heavy.html', 'v2-heavy': '/v2-heavy.html' };
const ENGINES = { chrome: chromium, webkit, firefox };

const INIT = () => {
  const m = (window.measure = { frames: [], loaf: [], long: [], active: false, last: 0 });
  try {
    new PerformanceObserver((list) => {
      if (!m.active) return;
      for (const e of list.getEntries()) {
        m.loaf.push({ d: e.duration, b: e.blockingDuration, scripts: e.scripts?.length ?? 0, render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0 });
      }
    }).observe({ type: 'long-animation-frame' });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      if (m.active) for (const e of list.getEntries()) m.long.push(e.duration);
    }).observe({ type: 'longtask' });
  } catch {}
  window.startMeasure = () => {
    m.frames = []; m.loaf = []; m.long = []; m.last = 0; m.active = true; m.started = performance.now();
    const tick = (t) => { if (!m.active) return; if (m.last) m.frames.push(t - m.last); m.last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  window.stopMeasure = () => {
    m.active = false;
    const f = m.frames.slice().sort((a, b) => a - b);
    const sum = f.reduce((a, b) => a + b, 0);
    return {
      elapsed: performance.now() - m.started,
      frames: f.length,
      hz: f.length ? (1000 * f.length) / sum : 0,
      p95: f[Math.floor(f.length * 0.95)] ?? 0,
      maxGap: f.at(-1) ?? 0,
      gaps50: f.filter((t) => t > 50).length,
      loaf50: m.loaf.filter((x) => x.d > 50).length,
      loafMax: m.loaf.reduce((a, x) => Math.max(a, x.d), 0),
      loafBlocking: m.loaf.reduce((a, x) => a + (x.b || 0), 0),
      loafNoScriptMax: m.loaf.filter((x) => x.scripts === 0).reduce((a, x) => Math.max(a, x.d), 0),
      longTasks: m.long.length,
      longMax: m.long.reduce((a, b) => Math.max(a, b), 0),
    };
  };
};

/** Displayed-frame smoothness inside each marked gesture window (viz Display::FrameDisplayed). */
function windows(events) {
  const marks = new Map();
  for (const e of events) if (/^cv-g\d+-(start|end)$/.test(e.name) && (e.ph === 'R' || e.ph === 'I' || e.ph === 'n' || e.ph === 'b')) marks.set(e.name, e.ts);
  const shown = events.filter((e) => e.name === 'Display::FrameDisplayed').map((e) => e.ts).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; marks.has(`cv-g${i}-start`); i++) {
    const a = marks.get(`cv-g${i}-start`);
    const b = marks.get(`cv-g${i}-end`) ?? a;
    const f = shown.filter((t) => t >= a && t <= b);
    let maxGap = 0;
    for (let k = 1; k < f.length; k++) maxGap = Math.max(maxGap, (f[k] - f[k - 1]) / 1000);
    out.push({ ms: (b - a) / 1000, frames: f.length, hz: f.length > 1 ? (1e6 * (f.length - 1)) / (f.at(-1) - f[0]) : 0, maxGap });
  }
  return out;
}

function frameStates(traceBuffer) {
  const events = JSON.parse(traceBuffer.toString()).traceEvents ?? [];
  const out = { presented: 0, partial: 0, dropped: 0, droppedSmooth: 0, noUpdate: 0, compositorAnim: 0, mainAnim: 0, displayed: 0, displayedSpanMs: 0 };
  let first = Infinity;
  let last = 0;
  for (const e of events) {
    if (e.name === 'Display::FrameDisplayed') {
      out.displayed++;
      first = Math.min(first, e.ts);
      last = Math.max(last, e.ts);
      continue;
    }
    if (e.name !== 'PipelineReporter' || e.ph !== 'b') continue;
    const r = e.args?.frame_reporter;
    if (!r) continue;
    if (r.state === 'STATE_PRESENTED_ALL') out.presented++;
    else if (r.state === 'STATE_PRESENTED_PARTIAL') out.partial++;
    else if (r.state === 'STATE_DROPPED') {
      out.dropped++;
      if (r.affects_smoothness) out.droppedSmooth++;
    } else if (r.state === 'STATE_NO_UPDATE_DESIRED') out.noUpdate++;
    if (r.has_compositor_animation) out.compositorAnim++;
    if (r.has_main_animation) out.mainAnim++;
  }
  out.scrollStates = {};
  for (const e of events) {
    if (e.name === 'PipelineReporter' && e.ph === 'b' && e.args?.frame_reporter) {
      const k = e.args.frame_reporter.scroll_state;
      out.scrollStates[k] = (out.scrollStates[k] || 0) + 1;
    }
  }
  out.gestures = windows(events);
  out.displayedSpanMs = out.displayed > 1 ? (last - first) / 1000 : 0;
  out.displayedHz = out.displayedSpanMs ? (1000 * (out.displayed - 1)) / out.displayedSpanMs : 0;
  const shown = out.presented + out.partial;
  out.droppedPct = shown + out.dropped ? (100 * out.dropped) / (shown + out.dropped) : 0;
  return out;
}

/** Realistic constant-speed input via Chrome's gesture synthesizer; each gesture is marked in the trace. */
async function moveGestures(page, cdp, mode) {
  const movement = [];
  const plan = mode === 'drag' ? [-615, -615, 615, 615] : [-1200, -1200, 1200, 1200];
  for (let i = 0; i < plan.length; i++) {
    await page.evaluate((n) => performance.mark(`cv-g${n}-start`), i);
    await cdp.send('Input.synthesizeScrollGesture', {
      x: 195, y: plan[i] < 0 ? 700 : 150, yDistance: plan[i], speed: mode === 'drag' ? 1500 : 1200, gestureSourceType: 'touch',
    });
    // Scroll: the window ends with the gesture (no fling). Drag: it also covers the settle and playheads.
    if (mode !== 'drag') await page.evaluate((n) => performance.mark(`cv-g${n}-end`), i);
    await page.waitForTimeout(mode === 'drag' ? 450 : 500);
    if (mode === 'drag') await page.evaluate((n) => performance.mark(`cv-g${n}-end`), i);
    movement.push(await page.evaluate(() => window.audit.api?.getCurrentIndex?.() ?? -1));
  }
  return movement;
}

async function moveChrome(page, cdp, mode) {
  const touch = (type, y) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
  const movement = [];
  for (const direction of [1, 1, -1, -1]) {
    const start = direction > 0 ? 730 : 115;
    const end = direction > 0 ? 115 : 730;
    await touch('touchStart', start);
    for (let i = 1; i <= 24; i++) {
      await touch('touchMove', start + ((end - start) * i) / 24);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd');
    await page.waitForTimeout(mode === 'drag' ? 350 : 500);
    movement.push(await page.evaluate(() => window.audit.api?.getCurrentIndex?.() ?? -1));
  }
  return movement;
}

async function movePointer(page, mode) {
  const movement = [];
  for (const direction of [1, 1, -1, -1]) {
    if (mode === 'drag') {
      const start = direction > 0 ? 730 : 115;
      const end = direction > 0 ? 115 : 730;
      await page.mouse.move(195, start);
      await page.mouse.down();
      for (let i = 1; i <= 24; i++) {
        await page.mouse.move(195, start + ((end - start) * i) / 24);
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
      await page.waitForTimeout(350);
    } else {
      await page.mouse.move(195, 420);
      for (let i = 0; i < 24; i++) {
        await page.mouse.wheel(0, direction * 26);
        await page.waitForTimeout(16);
      }
      await page.waitForTimeout(500);
    }
    movement.push(await page.evaluate(() => window.audit.api?.getCurrentIndex?.() ?? -1));
  }
  return movement;
}

/** One sample: mount, wait ready, settle, measure movement. */
/** measure() with a hard timeout: a hung page is recorded as a failed sample instead of blocking the sweep. */
export async function measure(opts) {
  const limit = opts.timeoutMs ?? 300000;
  let timer;
  const hang = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ impl: opts.impl, engine: opts.engine ?? 'chrome', ...opts.config, hang: true, hz: 0, p95: 999, loaf50: 0, loafMax: 0, frameStates: { droppedPct: 100 }, readyMs: 0, errors: ['timeout'] }), limit);
  });
  const run = measureOnce(opts);
  const result = await Promise.race([run, hang]);
  clearTimeout(timer);
  if (result.hang) run.catch(() => {});
  return result;
}

async function measureOnce({ impl, config, engine = 'chrome', cpuRate = 4, trace = false, gestures = true, layers = false, debug = false, stress = null, base = 'http://127.0.0.1:4360', browser: shared }) {
  const t0 = Date.now();
  const mark = (label) => debug && console.log(`  [${impl}] ${label} +${Date.now() - t0} ms`);
  const browser = shared ?? (await ENGINES[engine].launch(engine === 'chrome' ? { channel: 'chrome' } : {}));
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    // Mobile emulation only in Chrome (CDP touch); WebKit/Firefox use desktop mode so wheel and mouse drag work.
    isMobile: engine === 'chrome',
    hasTouch: engine === 'chrome',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let cdp = null;
  try {
    if (engine === 'chrome') {
      cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
      await cdp.send('Performance.enable');
    }
    mark('setup');
    await page.addInitScript(INIT);
    await page.goto(base + PAGES[impl]);
    mark('goto done');
    await page.evaluate((c) => window.mountFixture(c), config);
    mark('mounted');
    // Never page.waitForFunction here: after it runs, Chrome classifies document scrolls as
    // main-thread (SCROLL_MAIN_THREAD), which hides the native compositor path (probes/wait-artifact.mjs).
    await page.evaluate(() => new Promise((resolve, reject) => {
      const t0 = performance.now();
      const check = () => (window.audit.ready ? resolve() : performance.now() - t0 > 120000 ? reject(new Error('ready timeout')) : setTimeout(check, 50));
      check();
    }));
    mark('ready');
    const readyMs = await page.evaluate(() => window.audit.readyAt - window.audit.mountStart);
    await page.waitForTimeout(1200);
    const metric = async () =>
      cdp ? Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value])) : {};
    const before = await metric();
    mark('metrics before');
    if (trace && engine === 'chrome') {
      await browser.startTracing(page, { categories: ['benchmark', 'cc', 'viz', 'blink.user_timing', 'disabled-by-default-devtools.timeline.frame'] });
    }
    if (stress) {
      // Simulated busy author code: block the main thread for blockMs every everyMs during movement.
      await page.evaluate(({ everyMs, blockMs }) => {
        window.__stress = setInterval(() => { const t = performance.now(); while (performance.now() - t < blockMs) {} }, everyMs);
      }, stress);
    }
    await page.evaluate(() => window.startMeasure());
    mark('measuring');
    const movement =
      engine === 'chrome'
        ? gestures
          ? await moveGestures(page, cdp, config.mode)
          : await moveChrome(page, cdp, config.mode)
        : await movePointer(page, config.mode);
    mark('moved');
    const stats = await page.evaluate(() => window.stopMeasure());
    if (stress) await page.evaluate(() => clearInterval(window.__stress));
    mark('stopped');
    if (trace && engine === 'chrome') stats.frameStates = frameStates(await browser.stopTracing());
    const after = await metric();
    mark('metrics after');
    for (const k of ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration']) {
      if (k in after) stats[`${k}Ms`] = (after[k] - before[k]) * 1000;
    }
    if (cdp) {
      stats.heapMB = (after.JSHeapUsedSize ?? 0) / 1048576;
      stats.nodes = after.Nodes ?? 0;
      // LayerTree serialisation can stall Chrome with thousands of composited layers; opt-in only.
      if (layers) stats.layers = await layerStats(cdp);
    }
    const state = await page.evaluate(() => ({ errors: window.audit.errors?.length ?? 0 }));
    return { impl, engine, ...config, readyMs, ...stats, movement, state, errors };
  } finally {
    mark('closing');
    await context.close();
    mark('closed');
    if (!shared) await browser.close();
  }
}

async function layerStats(cdp) {
  const tree = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve([]), 2000);
    cdp.once('LayerTree.layerTreeDidChange', (e) => {
      clearTimeout(timer);
      resolve(e.layers ?? []);
    });
    cdp.send('LayerTree.enable').catch(() => resolve([]));
  });
  await cdp.send('LayerTree.disable').catch(() => {});
  const drawing = tree.filter((l) => l.drawsContent);
  return {
    count: tree.length,
    drawing: drawing.length,
    areaMpx: drawing.reduce((a, l) => a + l.width * l.height, 0) / 1e6,
  };
}

export const passes = (s) => s.hz >= 50 && s.p95 <= 25;

/** Capacity: largest N per scene where the majority of runs pass (same criterion as 10-07). */
export async function capacity({ impl, base: cfg, ns, runs = 3, engine = 'chrome', log = () => {} }) {
  const browser = await ENGINES[engine].launch(engine === 'chrome' ? { channel: 'chrome' } : {});
  const results = [];
  let best = 0;
  try {
    for (const n of ns) {
      const samples = [];
      for (let r = 0; r < runs; r++) {
        const s = await measure({ impl, engine, config: { ...cfg, animations: n }, browser, trace: engine === 'chrome' });
        samples.push(s);
        log(s);
      }
      const ok = samples.filter(passes).length > runs / 2;
      results.push({ n, ok, samples });
      if (ok) best = n;
      else break;
    }
  } finally {
    await browser.close();
  }
  return { impl, engine, ...cfg, capacity: best, results, cpu: os.cpus()[0].model };
}
