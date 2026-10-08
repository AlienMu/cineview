import { measure } from '../harness.mjs';
const rows = [];
for (const [label, impl, config] of [
  ['plain', 'plain', { mode: 'scroll', scenes: 5, animations: 0 }],
  ['v1 N=16', 'v1', { mode: 'scroll', scenes: 5, animations: 16 }],
  ['v2 native N=16', 'v2', { mode: 'scroll', scenes: 5, animations: 16 }],
  ['v2 fallback N=16', 'v2', { mode: 'scroll', scenes: 5, animations: 16, fallback: true }],
  ['v1 N=64', 'v1', { mode: 'scroll', scenes: 5, animations: 64 }],
  ['v2 native N=64', 'v2', { mode: 'scroll', scenes: 5, animations: 64 }],
  ['v2 fallback N=64', 'v2', { mode: 'scroll', scenes: 5, animations: 64, fallback: true }],
]) {
  const s = await measure({ impl, config, trace: true });
  const g = s.frameStates.gestures;
  rows.push({ label, rafHz: +s.hz.toFixed(1), loaf50: s.loaf50, gestureHz: g.map((x) => Math.round(x.hz)).join('/'), maxGapMs: g.map((x) => Math.round(x.maxGap)).join('/'), scroll: Object.keys(s.frameStates.scrollStates).filter((k) => k !== 'SCROLL_NONE').join(','), dropped: +s.frameStates.droppedPct.toFixed(1), task: Math.round(s.TaskDurationMs ?? 0) });
}
console.table(rows);
