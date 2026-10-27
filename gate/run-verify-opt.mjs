import { writeFile } from 'node:fs/promises';
import { measure } from './harness.mjs';

/** Re-check after the idle-creation and boot-style optimisations. */
const complete = (s) => { const f = s.frameStates; const t = f.presented + f.partial + f.dropped; return +((100 * f.presented) / t).toFixed(1); };
const rows = [];
for (const [label, impl, cfg, stress] of [
  ['scroll native 128', 'v2', { mode: 'scroll', scenes: 5, animations: 128 }, null],
  ['scroll native 128 stress', 'v2', { mode: 'scroll', scenes: 5, animations: 128 }, { everyMs: 200, blockMs: 40 }],
  ['scroll native mix 256', 'v2', { mode: 'scroll', scenes: 5, animations: 256, workload: 'mix' }, null],
  ['heavy drag v2 contract', 'v2-heavy', { mode: 'drag', scenes: 20, animations: 16, copy: 400, author: 'contract' }, null],
]) {
  for (let r = 0; r < 3; r++) {
    const s = await measure({ impl, trace: true, stress, config: cfg });
    const row = { label, run: r + 1, completePct: s.hang ? null : complete(s), dropped: +(s.frameStates?.droppedPct ?? 100).toFixed(1), hz: +(s.hz ?? 0).toFixed(1), p95: +(s.p95 ?? 0).toFixed(1), loaf50: s.loaf50, loafMax: Math.round(s.loafMax ?? 0), readyMs: Math.round(s.readyMs ?? 0) };
    rows.push(row);
    console.log(JSON.stringify(row));
    await writeFile('review/v2-phase0-gate-20261008/verify-opt-chrome.json', JSON.stringify(rows, null, 1));
  }
}
