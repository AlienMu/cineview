import { measure } from '../harness.mjs';
// Control: is the 2.0 scroll main-thread cadence caused by our animations, or by native touch scrolling itself?
const rows = [];
for (const [label, impl, config] of [
  ['v2 native N=1', 'v2', { mode: 'scroll', scenes: 5, animations: 1 }],
  ['v2 native N=16', 'v2', { mode: 'scroll', scenes: 5, animations: 16 }],
  ['v2 fallback N=1', 'v2', { mode: 'scroll', scenes: 5, animations: 1, fallback: true }],
  ['v2 fallback N=16', 'v2', { mode: 'scroll', scenes: 5, animations: 16, fallback: true }],
  ['v1 N=1', 'v1', { mode: 'scroll', scenes: 5, animations: 1 }],
  ['v1 N=16', 'v1', { mode: 'scroll', scenes: 5, animations: 16 }],
]) {
  for (let r = 0; r < 1; r++) {
    const s = await measure({ impl, config, trace: true });
    rows.push({ label, run: r + 1, hz: +s.hz.toFixed(1), p95: +s.p95.toFixed(1), loaf50: s.loaf50, dropped: +s.frameStates.droppedPct.toFixed(1), presented: s.frameStates.presented + s.frameStates.partial, displayed: s.frameStates.displayed, displayedHz: +s.frameStates.displayedHz.toFixed(1), elapsed: Math.round(s.elapsed), task: Math.round(s.TaskDurationMs) });
  }
}
console.table(rows);
