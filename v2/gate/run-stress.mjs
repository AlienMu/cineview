import { writeFile } from 'node:fs/promises';
import { measure } from './harness.mjs';

/** Decisive test for native vs direct writes in scroll input: does compositor animation survive main-thread blocking? */
export async function runStress(output, { runs = 3 } = {}) {
  const frames = (s) => { const f = s.frameStates; const tot = f.presented + f.partial + f.dropped; return +((100 * f.presented) / tot).toFixed(1); };
  const rows = [];
  for (const [label, impl, extra] of [
    ['v1', 'v1', {}],
    ['v2 native', 'v2', {}],
    ['v2 fallback', 'v2', { fallback: true }],
  ]) {
    for (const stress of [null, { everyMs: 200, blockMs: 40 }]) {
      for (let r = 0; r < runs; r++) {
        const s = await measure({ impl, trace: true, stress, config: { mode: 'scroll', scenes: 5, animations: 128, ...extra } });
        const row = { label, stress: stress ? '40ms/200ms' : 'none', run: r + 1, completePct: s.hang ? null : frames(s), partialPct: s.hang ? null : +((100 * s.frameStates.partial) / (s.frameStates.presented + s.frameStates.partial + s.frameStates.dropped)).toFixed(1), dropped: +(s.frameStates?.droppedPct ?? 100).toFixed(1), hz: +(s.hz ?? 0).toFixed(1), p95: +(s.p95 ?? 0).toFixed(1), loaf50: s.loaf50 };
        rows.push(row);
        console.log(JSON.stringify(row));
        await writeFile(output, JSON.stringify(rows, null, 1));
      }
    }
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) await runStress(process.argv[2] ?? 'review/v2-phase0-gate-20261008/stress-chrome.json');
