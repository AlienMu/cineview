import { writeFile } from 'node:fs/promises';
import { capacity, passes } from './harness.mjs';

/** Re-run of the 2.0 native scroll cases after adding the native activation window (phase-0 fix). */
export async function runNativeWindow(output) {
  const report = { started: new Date().toISOString(), note: 'native activation window (IO rootMargin 100%)', results: [] };
  for (const workload of ['capacity', 'mix']) {
    const r = await capacity({
      impl: 'v2', base: { mode: 'scroll', scenes: 5, workload }, ns: [64, 128, 256, 512, 1024, 2048], runs: 3,
      log: (s) => console.log(JSON.stringify({ workload, n: s.animations, pass: passes(s), hz: +s.hz.toFixed(1), p95: +s.p95.toFixed(1), loaf50: s.loaf50, loafMax: Math.round(s.loafMax), dropped: +s.frameStates.droppedPct.toFixed(1), task: Math.round(s.TaskDurationMs), readyMs: Math.round(s.readyMs) })),
    });
    for (const step of r.results) for (const s of step.samples) delete s.frameStates?.gestures;
    report.results.push(r);
    await writeFile(output, JSON.stringify(report, null, 1));
    console.log(`CAPACITY v2-native-window scroll ${workload}: ${r.capacity}`);
  }
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runNativeWindow(process.argv[2] ?? 'review/v2-phase0-gate-20261008/capacity-chrome-native-window.json');
}
