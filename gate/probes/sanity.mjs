import { measure } from '../harness.mjs';
for (const impl of ['v1', 'v2']) for (const mode of ['scroll', 'drag']) {
  const s = await measure({ impl, trace: true, config: { mode, scenes: 5, animations: 16 } });
  const { readyMs, hz, p95, maxGap, gaps50, loaf50, loafMax, loafNoScriptMax, frameStates, layers, heapMB, nodes, movement, errors, TaskDurationMs } = s;
  console.log(JSON.stringify({ impl, mode, readyMs: Math.round(readyMs), hz: +hz.toFixed(1), p95: +p95.toFixed(1), maxGap: Math.round(maxGap), gaps50, loaf50, loafMax: Math.round(loafMax), loafNoScriptMax: Math.round(loafNoScriptMax), dropped: frameStates?.droppedPct?.toFixed(1), frames: frameStates, layers, heapMB: +heapMB.toFixed(1), nodes, task: Math.round(TaskDurationMs), movement, errors }));
}
