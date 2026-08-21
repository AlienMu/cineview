/**
 * stress-fps.mjs — 多视频多元素双模式帧率探针。
 *
 * 用法（在 examples/performance-test/stress/ 下）：
 *   node stress-fps.mjs            # build fixture → vite preview → 跑两模式 → 写 stress-fps.json
 *
 * 方法论（与 site/scripts 既有探针一致）：
 *   - rAF 帧间隔采样（页面内注入，phase 标签分桶）
 *   - drag：CDP touch 慢速 scrub（跟手）+ 快速 flick（settle）
 *   - scroll：小步连续 wheel 穿 zone（防跳过路径）+ 反向回滚 + 大 flick
 *   - 指标：样本数 / p50 / p90 / p95 / max / >32ms / >50ms / 平均 fps
 */
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const host = '127.0.0.1';
const port = Number(process.env.STRESS_FPS_PORT || 4407);
const baseUrl = `http://${host}:${port}`;
const outPath = path.resolve('stress-fps.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sh(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { cwd: process.cwd(), env: process.env, encoding: 'utf8', stdio: 'pipe', ...opts });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed\n${result.stdout || ''}\n${result.stderr || ''}`);
  return result;
}

const VITE_BIN = path.resolve('..', 'node_modules', 'vite', 'bin', 'vite.js');

function buildFixture() {
  if (process.env.STRESS_FPS_SKIP_BUILD === '1') return;
  sh(process.execPath, [VITE_BIN, 'build', '--config', 'vite.config.ts']);
}

async function startPreview() {
  const child = spawn(process.execPath, [
    VITE_BIN,
    'preview',
    '--config', 'vite.config.ts',
    '--host', host,
    '--port', String(port),
    '--strictPort',
  ], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'pipe',
  });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      const res = await fetch(baseUrl);
      if (res.ok) return child;
    } catch { /* starting */ }
    await sleep(100);
  }
  child.kill('SIGKILL');
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
  if (process.env.CINEVIEW_CHROME_PATH) return { executablePath: process.env.CINEVIEW_CHROME_PATH, headless: true };
  return { channel: 'chrome', headless: true };
}

const SAMPLER = () => {
  window.__gaps = [];
  window.__phase = 'idle';
  let last = performance.now();
  const rec = (now) => {
    window.__gaps.push([Math.round(now - last), window.__phase]);
    last = now;
    window.__raf = requestAnimationFrame(rec);
  };
  window.__raf = requestAnimationFrame(rec);
};

async function collect(page) {
  return page.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    const byPhase = {};
    for (const [gap, phase] of window.__gaps) {
      (byPhase[phase] ??= []).push(gap);
    }
    return byPhase;
  });
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function statsFor(gaps) {
  const sorted = [...gaps].sort((a, b) => a - b);
  const total = sorted.reduce((s, g) => s + g, 0);
  return {
    samples: sorted.length,
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1] ?? 0,
    over32: sorted.filter((g) => g > 32).length,
    over50: sorted.filter((g) => g > 50).length,
    avgFps: sorted.length ? Math.round((sorted.length / (total / 1000)) * 10) / 10 : 0,
  };
}

async function setPhase(page, phase) {
  await page.evaluate((p) => { window.__phase = p; }, phase);
}

async function waitReady(page, expectedVideos) {
  // 视频元数据就绪 + 首屏入场完成（waitFor 链 settle，记忆：截图/采样前须等足）。
  // 计数必须显式断言：every() 对空数组恒真，2026-08-16 曾因此测错对象。
  await page.waitForFunction(
    (n) => document.querySelectorAll('video').length >= n &&
      Array.from(document.querySelectorAll('video')).every((v) => v.readyState >= 1),
    expectedVideos,
    { timeout: 30_000 }
  );
  await sleep(6500);
}

async function runDrag(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/#/drag`, { waitUntil: 'domcontentloaded' });
  // drag 栈只挂载当前幕及邻幕：scene0 的 3 个视频必在；scene2 未必挂载
  await waitReady(page, 3);
  const cdp = await context.newCDPSession(page);
  const X = 195;
  const touchPath = async (fromY, toY, steps, stepMs, hold = false) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: X, y: fromY, id: 1, radiusX: 10, radiusY: 10, force: 1 }] });
    for (let s = 1; s <= steps; s += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: X, y: fromY + ((toY - fromY) * s) / steps, id: 1, radiusX: 10, radiusY: 10, force: 1 }],
      });
      await sleep(stepMs);
    }
    if (hold) { await sleep(250); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };

  await page.evaluate(SAMPLER);

  // 1) 慢速全幅 scrub：scene0 的 24 元素 + 3 视频并发 scrub，不 commit（回弹）
  await setPhase(page, 'drag-slow-scrub');
  await touchPath(700, 620, 12, 50, true); // ~20% 轻 scrub 后松手 → bounce
  await sleep(1800);

  // 2) 慢速深 scrub 直至 commit 门槛外一点，松手回弹
  await setPhase(page, 'drag-deep-scrub');
  await touchPath(700, 260, 44, 33, true); // ~65%
  await sleep(1800);

  // 3) 快速 flick → settle（transitionDuration 600ms 的 settle 阶段）
  await setPhase(page, 'drag-flick-settle');
  await touchPath(700, 480, 5, 16, false);
  await sleep(1600);

  // 4) commit 到 scene1 后，回拖 scrub scene1→scene0（reverse scrub + 视频倒放）
  await setPhase(page, 'drag-reverse-scrub');
  await touchPath(300, 640, 34, 33, true);
  await sleep(1800);

  // 5) 冷置（infinite pulse 空转基线）
  await setPhase(page, 'drag-idle-infinite');
  await sleep(1500);

  const byPhase = await collect(page);
  await context.close();
  return byPhase;
}

async function runScroll(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/#/scroll`, { waitUntil: 'domcontentloaded' });
  await waitReady(page, 5); // scroll 页 zone-a(3) + zone-b(2)

  const readScroll = () => page.evaluate(() => document.querySelector('[data-cineview-container="true"]')?.scrollTop ?? window.scrollY);
  const readMax = () => page.evaluate(() => {
    const c = document.querySelector('[data-cineview-container="true"]');
    return c ? c.scrollHeight - c.clientHeight : document.documentElement.scrollHeight - innerHeight;
  });
  const readProbe = () => page.evaluate(() => ({
    top: document.querySelector('[data-cineview-container="true"]')?.scrollTop ?? window.scrollY,
    videoA: document.querySelector('[data-cineview-animate-id="sa-video-0"] video')?.currentTime ?? null,
    videoB: document.querySelector('[data-cineview-animate-id="sb-video-0"] video')?.currentTime ?? null,
  }));

  const maxScroll = await readMax();
  const marks = [];
  const wheelTo = async (fraction) => {
    const target = maxScroll * fraction;
    let guard = 0;
    while ((await readScroll()) < target - 60 && guard < 600) { await page.mouse.wheel(0, 110); await sleep(16); guard += 1; }
    while ((await readScroll()) > target + 60 && guard < 1200) { await page.mouse.wheel(0, -110); await sleep(16); guard += 1; }
  };
  const wheelUpTo = async (fraction) => {
    const target = maxScroll * fraction;
    let guard = 0;
    while ((await readScroll()) > target + 60 && guard < 600) { await page.mouse.wheel(0, -110); await sleep(16); guard += 1; }
  };

  await page.evaluate(SAMPLER);

  // 阶段按总 scrollHeight 比例推进；marks 记录每阶段边界的 scrollTop 与视频 currentTime
  const phases = [
    ['scroll-fwd-a', () => wheelTo(0.18)],
    ['scroll-fwd-b', () => wheelTo(0.42)],
    ['scroll-fwd-c', () => wheelTo(0.72)],
    ['scroll-flick', async () => { await page.mouse.wheel(0, 3000); await sleep(900); }],
    ['scroll-rev-b', () => wheelUpTo(0.42)],
    ['scroll-rev-a', () => wheelUpTo(0.12)],
  ];
  marks.push({ phase: 'start', ...(await readProbe()) });
  for (const [phase, run] of phases) {
    await setPhase(page, phase);
    await run();
    await sleep(400);
    marks.push({ phase, ...(await readProbe()) });
  }

  const byPhase = await collect(page);
  await context.close();
  return { byPhase, marks, maxScroll };
}

(async () => {
  buildFixture();
  const server = await startPreview();
  const browser = await chromium.launch(launchOptions());
  const report = { generatedAt: new Date().toISOString(), baseUrl, viewport: '390x844', headless: true };
  try {
    report.drag = await runDrag(browser);
    const scrollResult = await runScroll(browser);
    report.scroll = scrollResult.byPhase;
    report.scrollMarks = scrollResult.marks;
    report.scrollMax = scrollResult.maxScroll;
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const summary = {};
  for (const mode of ['drag', 'scroll']) {
    const phases = mode === 'drag' ? report.drag : report.scroll;
    summary[mode] = Object.fromEntries(Object.entries(phases).map(([p, gaps]) => [p, statsFor(gaps)]));
  }
  report.summary = summary;
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  for (const [mode, phases] of Object.entries(summary)) {
    console.log(`\n=== ${mode.toUpperCase()} ===`);
    for (const [phase, s] of Object.entries(phases)) {
      console.log(
        `${phase.padEnd(22)} n=${String(s.samples).padStart(4)} p50=${String(s.p50).padStart(3)}ms p90=${String(s.p90).padStart(3)} p95=${String(s.p95).padStart(3)} max=${String(s.max).padStart(4)} >32ms=${String(s.over32).padStart(3)} >50ms=${String(s.over50).padStart(3)} fps=${s.avgFps}`
      );
    }
  }
  console.log(`\nreport: ${outPath}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
