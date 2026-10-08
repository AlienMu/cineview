import { writeFile } from 'node:fs/promises';
import { measure } from './harness.mjs';

/**
 * Fixture (c) (plan v3 §11): 20 scenes with canvas particles, a video and 16 animations each.
 * Calibrate the static copy per scene until 1.x shows >= 100 ms entry frames, then compare
 * 2.0 with a naive author (everything starts at load) and with the cv-activate/cv-deactivate contract.
 */
/** Load each page once so Vite's first-visit dependency optimisation (and its reload) happens outside measurement. */
async function warmUp(paths, base = 'http://127.0.0.1:4360') {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const p of paths) {
    const page = await browser.newPage();
    await page.goto(base + p);
    await page.waitForTimeout(1500);
    await page.close();
  }
  await browser.close();
}

export async function runHeavy(output, { copies = [40, 160, 400], runs = 3 } = {}) {
  const report = { started: new Date().toISOString(), calibration: [], comparison: [] };
  await warmUp(['/v1/heavy.html', '/v2-heavy.html']);
  const frames = (s) => { const f = s.frameStates; const tot = (f.presented ?? 0) + (f.partial ?? 0) + (f.dropped ?? 0); return tot ? +((100 * (f.presented ?? 0)) / tot).toFixed(1) : null; };
  const pick = (s) => ({ hang: !!s.hang, completePct: s.hang ? null : frames(s), readyMs: Math.round(s.readyMs), hz: +(s.hz ?? 0).toFixed(1), p95: +(s.p95 ?? 0).toFixed(1), loaf50: s.loaf50, loafMax: Math.round(s.loafMax), loafNoScriptMax: Math.round(s.loafNoScriptMax), dropped: +(s.frameStates?.droppedPct ?? 100).toFixed(1), heapMB: +(s.heapMB ?? 0).toFixed(0), nodes: s.nodes, movement: s.movement, errors: s.errors?.length ?? 0 });
  let chosen = copies.at(-1);
  for (const copy of copies) {
    const s = await measure({ impl: 'v1-heavy', trace: true, config: { mode: 'drag', scenes: 20, animations: 16, copy } });
    report.calibration.push({ copy, ...pick(s) });
    console.log('calibrate', copy, JSON.stringify(pick(s)));
    if (s.loafMax >= 100) { chosen = copy; break; }
  }
  report.copy = chosen;
  const cases = [
    ['drag v1', 'v1-heavy', { mode: 'drag' }],
    ['drag v2 naive', 'v2-heavy', { mode: 'drag', author: 'naive' }],
    ['drag v2 contract', 'v2-heavy', { mode: 'drag', author: 'contract' }],
    ['scroll v1', 'v1-heavy', { mode: 'scroll' }],
    ['scroll v2 native', 'v2-heavy', { mode: 'scroll', author: 'contract' }],
    ['scroll v2 fallback', 'v2-heavy', { mode: 'scroll', author: 'contract', fallback: true }],
  ];
  for (const [label, impl, extra] of cases) {
    for (let r = 0; r < runs; r++) {
      const s = await measure({ impl, trace: true, config: { scenes: 20, animations: 16, copy: chosen, ...extra } });
      report.comparison.push({ label, run: r + 1, ...pick(s) });
      console.log(label, r + 1, JSON.stringify(pick(s)));
      await writeFile(output, JSON.stringify(report, null, 1));
    }
  }
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runHeavy(process.argv[2] ?? 'review/v2-phase0-gate-20261008/heavy-chrome.json');
}
