import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { chromium } from 'playwright-core';

const cwd = fileURLToPath(new URL('.', import.meta.url));
const base = 'http://127.0.0.1:4319';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const runs = Number(process.env.CINEVIEW_PROFILE_RUNS || 3);
if (!Number.isInteger(runs) || runs < 1 || runs > 10) throw new Error('runs must be 1–10');
if (process.env.CINEVIEW_ACC_SKIP_BUILD !== '1') {
  const build = spawnSync('pnpm', ['build:acceptance'], { cwd, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(`fixture build failed: ${build.stdout}${build.stderr}`);
}
const server = spawn(
  'pnpm',
  [
    'exec',
    'vite',
    'preview',
    '--config',
    'vite.acceptance.config.ts',
    '--host',
    '127.0.0.1',
    '--port',
    '4319',
    '--strictPort',
  ],
  { cwd, stdio: 'pipe' }
);
let serverOutput = '';
server.stdout.on('data', (data) => {
  serverOutput += data;
});
server.stderr.on('data', (data) => {
  serverOutput += data;
});
let browser;
try {
  const deadline = Date.now() + 15000;
  let ready = false;
  while (Date.now() < deadline && server.exitCode === null) {
    try {
      ready = (await fetch(base)).ok;
    } catch {
      /* Startup in progress. */
    }
    if (ready) break;
    await sleep(100);
  }
  if (!ready || server.exitCode !== null)
    throw new Error(`preview startup failed: ${serverOutput}`);
  browser = await chromium.launch(
    process.env.CINEVIEW_CHROME_PATH
      ? { executablePath: process.env.CINEVIEW_CHROME_PATH }
      : { channel: 'chrome' }
  );
  const samples = [];
  for (let run = 0; run < runs; run += 1) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.__profile = { longTasks: [], frames: [], last: 0, measuring: false };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__profile.longTasks.push({ start: entry.startTime, duration: entry.duration });
        }
      }).observe({ type: 'longtask', buffered: true });
      const tick = (now) => {
        const state = window.__profile;
        if (state.measuring && state.last) state.frames.push(now - state.last);
        state.last = state.measuring ? now : 0;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto(`${base}/#/acceptance/scroll`);
    await page.locator('[data-page="framework-scroll-acceptance"][data-ready="true"]').waitFor();
    const readyMs = await page.evaluate(() => performance.now());
    await page.waitForFunction(
      () => performance.getEntriesByName('first-contentful-paint').length > 0
    );
    await page.mouse.move(195, 400);
    await page.evaluate(() => {
      window.__profile.measuring = true;
      window.__profile.started = performance.now();
    });
    if (process.env.CINEVIEW_PROFILE_INJECT === 'long-task') {
      // Schedule a page task: a DevTools evaluation itself is not consistently
      // exposed through the browser's Long Tasks observer.
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              const end = performance.now() + 300;
              while (performance.now() < end) {
                /* Deliberate gate failure. */
              }
              resolve();
            }, 0);
          })
      );
    }
    for (let step = 0; step < 40; step += 1) {
      await page.mouse.wheel(0, step < 25 ? 100 : -100);
      await sleep(40);
    }
    await sleep(100);
    const sample = await page.evaluate(() => {
      const state = window.__profile;
      state.measuring = false;
      const frames = state.frames.slice().sort((a, b) => a - b);
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
      return {
        fcpMs: fcp,
        frameCount: frames.length,
        averageFps: (frames.length * 1000) / frames.reduce((sum, value) => sum + value, 0),
        p95FrameMs: frames[Math.floor(frames.length * 0.95)],
        maxLongTaskMs: Math.max(
          0,
          ...state.longTasks
            .filter((task) => task.start >= state.started)
            .map((task) => task.duration)
        ),
        progressEvents: Number(
          document
            .querySelector('[data-page="framework-scroll-acceptance"]')
            ?.getAttribute('data-progress-events')
        ),
      };
    });
    samples.push({ run: run + 1, readyMs, ...sample, errors });
    await context.close();
  }
  console.log(
    JSON.stringify(
      {
        browser: browser.version(),
        node: process.version,
        platform: `${os.platform()} ${os.arch()}`,
        cpu: os.cpus()[0]?.model,
        viewport: '390x844',
        network: 'loopback, fresh context per run',
        workload: '40 real wheel inputs, 8 concurrent animations per zone',
        budgets: { fcpMs: 2000, readyMs: 3000, maxLongTaskMs: 200 },
        samples,
      },
      null,
      2
    )
  );
  for (const sample of samples) {
    if (
      sample.errors.length ||
      !Number.isFinite(sample.fcpMs) ||
      sample.fcpMs > 2000 ||
      sample.readyMs > 3000 ||
      sample.maxLongTaskMs > 200 ||
      sample.frameCount < 20 ||
      sample.progressEvents < 1
    ) {
      throw new Error('production profile budget or workload check failed');
    }
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  const deadline = Date.now() + 2000;
  while (server.exitCode === null && Date.now() < deadline) await sleep(50);
  if (server.exitCode === null) server.kill('SIGKILL');
}
