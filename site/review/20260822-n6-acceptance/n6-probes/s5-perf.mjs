/* S5 concurrent perf: continuous input + multi-element animation, rAF gaps + longtask.
 * Criteria:
 *  P1. rAF frame gap P95 < 25ms during 6s continuous drive
 *  P2. gaps > 25ms ratio < 10%
 *  P3. longtask (>50ms) count <= 2 (baseline was 0)
 *  P4. console error/warning == 0
 * Paths: '/' wheel drive; '/drag' real pointer drag cycles.
 */
import { openPage, sleep, note, pass, fail, scrollTop, SHOTS, cdpDrag, cdpRelease } from './lib.mjs';

async function runPath(pathLabel, path, driver) {
  const { browser, page, consoleMsgs } = await openPage({ path, viewport: path === '/drag' ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    window.__perf = { gaps: [], last: 0, longtasks: [] };
    const raw = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      raw((t) => {
        if (window.__perf.last) window.__perf.gaps.push(t - window.__perf.last);
        window.__perf.last = t;
        cb(t);
      });
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__perf.longtasks.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] });
    } catch {}
  });
  // reopen to apply init script AFTER listeners (goto already happened in openPage — reload)
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector(path === '/drag' ? '.tp-scene' : '[data-cineview-container="true"]', { timeout: 20000 });
  await sleep(3000);
  await driver(page);
  await sleep(600);
  const perf = await page.evaluate(() => ({
    gaps: window.__perf?.gaps ?? [],
    longtasks: window.__perf?.longtasks ?? [],
  }));
  const gaps = perf.gaps.slice().sort((a, b) => a - b);
  const q = (p) => (gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor((p / 100) * gaps.length))] : null);
  const over25 = gaps.filter((g) => g > 25).length;
  const res = {
    n: gaps.length,
    p50: q(50)?.toFixed(1),
    p95: q(95)?.toFixed(1),
    p99: q(99)?.toFixed(1),
    max: gaps.at(-1)?.toFixed(1),
    over25,
    over25pct: gaps.length ? ((over25 / gaps.length) * 100).toFixed(1) : '-',
    longtasks: perf.longtasks,
    consoleErrs: consoleMsgs.length,
  };
  note(`## S5 perf ${pathLabel} ${new Date().toISOString()}`);
  note(`  metrics=${JSON.stringify(res)}`);
  if (path === '/') await page.screenshot({ path: `${SHOTS}/s5-scroll-end.png` });
  else await page.screenshot({ path: `${SHOTS}/s5-drag-end.png` });
  const p95n = Number(res.p95);
  Number.isFinite(p95n) && p95n < 25 ? pass(`P1 ${pathLabel} rAF P95<25ms`, `P95=${res.p95}ms P50=${res.p50} P99=${res.p99} max=${res.max}`) : fail(`P1 ${pathLabel} rAF P95<25ms`, `P95=${res.p95}ms`);
  Number(res.over25pct) < 10 ? pass(`P2 ${pathLabel} drop ratio`, `${res.over25pct}% (${res.over25}/${res.n})`) : fail(`P2 ${pathLabel} drop ratio`, `${res.over25pct}% (${res.over25}/${res.n})`);
  perf.longtasks.length <= 2 ? pass(`P3 ${pathLabel} longtasks`, `${perf.longtasks.length} ${JSON.stringify(perf.longtasks)}`) : fail(`P3 ${pathLabel} longtasks`, `${perf.longtasks.length} ${JSON.stringify(perf.longtasks.slice(0, 6))}`);
  consoleMsgs.length === 0 ? pass(`P4 ${pathLabel} console clean`, '0') : fail(`P4 ${pathLabel} console clean`, `${consoleMsgs.length}: ${consoleMsgs.slice(0, 2).map((c) => c.type + ':' + c.text.slice(0, 120)).join(' | ')}`);
  await browser.close();
  return res;
}

// driver: scroll homepage — wheel through the whole doc
await runPath('scroll /', '/', async (page) => {
  await page.mouse.move(720, 450);
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    await page.mouse.wheel(0, 220);
    await sleep(38);
  }
});

// driver: drag page — continuous up/down pointer drag cycles (scrub + commit + settle)
await runPath('drag /drag', '/drag', async (page) => {
  const cdp = await page.context().newCDPSession(page);
  const box = await page.evaluate(() => {
    const r = document.querySelector('.cineview-container')?.getBoundingClientRect();
    return r ? { x: r.x + r.width / 2, y: r.y, h: r.height } : null;
  });
  const t0 = Date.now();
  let up = true;
  while (Date.now() - t0 < 6000 && box) {
    const yFrom = box.y + box.h * (up ? 0.78 : 0.42);
    const dy = up ? -box.h * 0.34 : box.h * 0.34;
    await cdpDrag(cdp)(box.x, yFrom, dy, { steps: 9, hold: 14 });
    await cdpRelease(cdp, box.x, yFrom + dy);
    up = !up;
    await sleep(420);
  }
});
