import { writeFile } from 'node:fs/promises';
import { capacity, passes } from './harness.mjs';

/**
 * Gate thresholds 3-5 (plan v3 §11): capacity per scene (agreed rAF criterion: mean >= 50 Hz and
 * P95 <= 25 ms, majority of 3 runs), plus dropped frames, LoAF, ready time and heap per sample.
 */
export async function runCapacitySweep(output, { engine = 'chrome', ns = [64, 128, 256, 512, 1024, 2048], runs = 3 } = {}) {
  const cases = [];
  for (const workload of ['capacity', 'mix']) {
    for (const mode of ['scroll', 'drag']) {
      cases.push({ impl: 'v1', cfg: { mode, scenes: 5, workload } });
      cases.push({ impl: 'v2', cfg: { mode, scenes: 5, workload } });
      if (mode === 'scroll') cases.push({ impl: 'v2', cfg: { mode, scenes: 5, workload, fallback: true } });
    }
  }
  const report = { started: new Date().toISOString(), engine, criterion: 'mean rAF >= 50 Hz and P95 <= 25 ms (majority of runs)', results: [] };
  for (const c of cases) {
    const r = await capacity({
      impl: c.impl, base: c.cfg, ns, runs, engine,
      log: (s) => console.log(JSON.stringify({ impl: s.impl, mode: s.mode, workload: s.workload, fallback: !!s.fallback, n: s.animations, pass: passes(s), hz: +s.hz.toFixed(1), p95: +s.p95.toFixed(1), loaf50: s.loaf50, loafMax: Math.round(s.loafMax), dropped: s.frameStates ? +s.frameStates.droppedPct.toFixed(1) : null, readyMs: Math.round(s.readyMs), heapMB: s.heapMB ? +s.heapMB.toFixed(1) : null })),
    });
    for (const step of r.results) for (const s of step.samples) delete s.frameStates?.gestures;
    report.results.push(r);
    await writeFile(output, JSON.stringify(report, null, 1));
    console.log(`CAPACITY ${c.impl}${c.cfg.fallback ? '-fallback' : ''} ${c.cfg.mode} ${c.cfg.workload}: ${r.capacity}`);
  }
  report.finished = new Date().toISOString();
  await writeFile(output, JSON.stringify(report, null, 1));
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runCapacitySweep(process.argv[2] ?? 'review/v2-phase0-gate-20261008/capacity-chrome.json');
}
