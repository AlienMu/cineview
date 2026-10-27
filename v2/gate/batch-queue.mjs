import { mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { runCombinationBatch } from './pair-batches.mjs';

/** Run declared batches serially; existing raw records provide the resume state. */
export async function runBatchQueue({
  jobs,
  base,
  output,
  engines = ['chromium', 'webkit'],
  rounds = 3,
}) {
  await mkdir(output, { recursive: true });
  const state = {
    pid: process.pid,
    started: new Date().toISOString(),
    base,
    engines,
    rounds,
    status: 'running',
    totalBatches: jobs.length,
    completed: [],
    current: null,
  };
  const save = async () => {
    const path = join(output, 'queue.json');
    await writeFile(`${path}.tmp`, JSON.stringify(state, null, 2));
    await rename(`${path}.tmp`, path);
  };
  await writeFile(join(output, 'jobs.json'), JSON.stringify(jobs, null, 2));
  for (const job of jobs) {
    state.current = job;
    await save();
    console.log(`QUEUE order ${job.order} batch ${job.batch}`);
    try {
      const result = await runCombinationBatch({ ...job, base, engines, rounds });
      const summary = {
        ...job,
        id: result.id,
        required: result.requiredRuns,
        executed: result.executedRuns,
        failed: result.results.filter((r) => !r.pass).length,
        unexecuted: result.unexecutedRuns,
        environmentErrors: Object.fromEntries(
          Object.entries(result.enginesStatus)
            .filter(([, status]) => status.environmentError)
            .map(([engine, status]) => [engine, status.environmentError])
        ),
      };
      if (summary.failed || summary.unexecuted || Object.keys(summary.environmentErrors).length) {
        state.status = 'needs-review';
        state.result = summary;
        await save();
        return state;
      }
      state.completed.push(summary);
      await save();
    } catch (error) {
      state.status = 'error';
      state.error = error.stack;
      await save();
      return state;
    }
  }
  state.status = 'complete';
  state.current = null;
  state.finished = new Date().toISOString();
  await save();
  return state;
}
