import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pairPlan } from './pair-batches.mjs';
import { runBatchQueue } from './batch-queue.mjs';

async function seed(directory, fail = false) {
  const batch = pairPlan().batches[1];
  const cases = batch.cases.filter((c) => c.status === 'runnable');
  for (const engine of ['chromium', 'webkit'])
    for (let round = 1; round <= 3; round++) {
      const target = join(directory, batch.id, engine, `round-${round}`);
      await mkdir(target, { recursive: true });
      const rows = cases.map((config, index) => ({
        engine,
        round,
        config,
        pass: !(fail && engine === 'chromium' && round === 1 && index === 0),
      }));
      await writeFile(join(target, `${engine}.jsonl`), rows.map(JSON.stringify).join('\n') + '\n');
    }
  return { order: 2, batch: 2, output: directory };
}

test('queue resumes existing completed evidence and separately completes nonrunnable batches', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cineview-queue-'));
  try {
    const job = await seed(join(dir, 'results'));
    const excluded =
      pairPlan().batches.findIndex((b) => b.cases.every((c) => c.status !== 'runnable')) + 1;
    assert.ok(excluded > 0);
    const jobs = [job, { order: 2, batch: excluded, output: join(dir, 'excluded') }];
    for (let repeat = 0; repeat < 2; repeat++) {
      const result = await runBatchQueue({
        jobs,
        base: 'http://127.0.0.1:1',
        output: join(dir, 'queue'),
      });
      assert.equal(result.status, 'complete');
      assert.equal(result.completed.length, 2);
      assert.equal(result.completed[0].executed, 216);
      assert.equal(result.completed[1].required, 0);
      assert.equal(result.current, null);
    }
    const raw = await readFile(
      join(dir, 'results', 'pairs-002', 'chromium', 'round-1', 'chromium.jsonl'),
      'utf8'
    );
    assert.equal(raw.trim().split('\n').length, 36);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a retained failure stops the queue and preserves the failed raw row', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cineview-queue-failed-'));
  try {
    const job = await seed(join(dir, 'results'), true),
      next = join(dir, 'next');
    const result = await runBatchQueue({
      jobs: [job, { order: 2, batch: 3, output: next }],
      base: 'http://127.0.0.1:1',
      output: join(dir, 'queue'),
    });
    assert.equal(result.status, 'needs-review');
    assert.equal(result.result.failed, 1);
    assert.equal(result.completed.length, 0);
    await assert.rejects(readFile(join(next, 'pair-plan.json')), { code: 'ENOENT' });
    const raw = await readFile(
      join(dir, 'results', 'pairs-002', 'chromium', 'round-1', 'chromium.jsonl'),
      'utf8'
    );
    assert.equal(JSON.parse(raw.split('\n')[0]).pass, false);
    assert.equal(
      JSON.parse(await readFile(join(dir, 'queue', 'queue.json'))).status,
      'needs-review'
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('an execution error is recorded without starting a later job', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cineview-queue-error-'));
  try {
    const result = await runBatchQueue({
      jobs: [{ order: 4, batch: 1, output: join(dir, 'invalid') }],
      base: 'http://127.0.0.1:1',
      output: dir,
    });
    assert.equal(result.status, 'error');
    assert.match(result.error, /order/);
    assert.equal(result.completed.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a retained engine environment error stops the queue even when every raw row passes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cineview-queue-environment-'));
  try {
    const job = await seed(join(dir, 'results'));
    const environmentError = 'Synthetic context.close error after final raw append';
    await writeFile(
      join(job.output, 'pairs-002', 'chromium', 'round-3', 'summary.json'),
      JSON.stringify({ engines: { chromium: { environmentError } } })
    );
    const next = join(dir, 'next');
    const result = await runBatchQueue({
      jobs: [job, { order: 2, batch: 3, output: next }],
      base: 'http://127.0.0.1:1',
      output: join(dir, 'queue'),
    });
    assert.equal(result.status, 'needs-review');
    assert.equal(result.result.failed, 0);
    assert.equal(result.result.unexecuted, 0);
    assert.deepEqual(result.result.environmentErrors, { chromium: environmentError });
    assert.equal(result.completed.length, 0);
    await assert.rejects(readFile(join(next, 'pair-plan.json')), { code: 'ENOENT' });
    assert.deepEqual(
      JSON.parse(await readFile(join(dir, 'queue', 'queue.json'))).result.environmentErrors,
      { chromium: environmentError }
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
