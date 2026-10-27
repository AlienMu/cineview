import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  combinationPlan,
  pairPlan,
  priorityPairs,
  readBatchRows,
  remainingCases,
  runCombinationBatch,
} from './pair-batches.mjs';
import { enumerateCoverage } from './combinations.mjs';

test('pair batches retain every concept and predeclared context status without duplicating cases', () => {
  const p = pairPlan();
  assert.equal(p.concepts, 820);
  assert.equal(p.configs, 4100);
  assert.deepEqual(p.status, { runnable: 3746, 'not-applicable': 154, unsupported: 200 });
  assert.equal(new Set(p.batches.flatMap((b) => b.concepts).map((c) => c.id)).size, 820);
  assert.equal(new Set(p.batches.flatMap((b) => b.cases).map((c) => c.id)).size, 4100);
  assert.deepEqual(
    p.batches[0].concepts.map((c) => c.ids),
    priorityPairs
  );
  assert.equal(p.batches[0].cases.filter((c) => c.status === 'runnable').length, 38);
  const selected = new Set(priorityPairs.map((ids) => ids.join('-')));
  assert.deepEqual(
    p.batches[0].cases,
    enumerateCoverage({ maxOrder: 2 }).configs.filter(
      (c) => c.order === 2 && selected.has(c.ids.join('-'))
    )
  );
});

test('single and triple batches retain every declared context exactly once', () => {
  for (const [order, concepts, configs, status] of [
    [1, 41, 205, { runnable: 196, 'not-applicable': 4, unsupported: 5 }],
    [3, 10660, 53300, { runnable: 46512, 'not-applicable': 2888, unsupported: 3900 }],
  ]) {
    const plan = combinationPlan({ order });
    assert.equal(plan.concepts, concepts);
    assert.equal(plan.configs, configs);
    assert.deepEqual(plan.status, status);
    assert.equal(new Set(plan.batches.flatMap((b) => b.concepts.map((c) => c.id))).size, concepts);
    const cases = plan.batches.flatMap((b) => b.cases);
    assert.equal(cases.length, configs);
    assert.equal(new Set(cases.map((c) => c.id)).size, configs);
    assert.ok(cases.every((c) => c.order === order));
  }
  assert.throws(() => combinationPlan({ order: 4 }), /order/);
});
test('resume skips completed failures as well as passes, and keeps unfinished cases', () => {
  const cases = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(
    remainingCases(cases, [
      { config: { id: 'a' }, pass: true },
      { config: { id: 'b' }, pass: false },
    ]),
    [{ id: 'c' }]
  );
  assert.throws(() => pairPlan({ batchSize: 0 }), /positive/);
});

test('reusing a completed batch retains its finish time and original failure', async () => {
  const output = await mkdtemp(join(tmpdir(), 'cineview-completed-batch-'));
  const selected = pairPlan().batches[0],
    cases = selected.cases.filter((c) => c.status === 'runnable'),
    directory = join(output, selected.id),
    round = join(directory, 'chromium', 'round-1'),
    started = '2026-01-01T00:00:00.000Z',
    finished = '2026-01-01T00:10:00.000Z';
  try {
    await mkdir(round, { recursive: true });
    await writeFile(join(directory, 'progress.json'), JSON.stringify({ started, finished }));
    await writeFile(
      join(round, 'chromium.jsonl'),
      cases.map((config, i) => JSON.stringify({ config, round: 1, pass: i !== 0 })).join('\n') +
        '\n'
    );
    const result = await runCombinationBatch({ output, engines: ['chromium'], rounds: 1 });
    assert.equal(result.started, started);
    assert.equal(result.finished, finished);
    assert.equal(result.unexecutedRuns, 0);
    assert.equal(result.results.filter((r) => !r.pass).length, 1);
    assert.equal(result.results.find((r) => !r.pass).id, cases[0].id);
    assert.equal(
      JSON.parse(await readFile(join(directory, 'progress.json'), 'utf8')).finished,
      finished
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('resume preserves interrupted bytes and complete failures, but rejects malformed complete records', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cineview-pair-resume-'));
  const path = join(directory, 'rows.jsonl');
  try {
    const row = { round: 2, config: { id: 'a' }, pass: false };
    await writeFile(path, JSON.stringify(row) + '\n{"round":2');
    const result = await readBatchRows(path);
    assert.deepEqual(result.rows, [row]);
    assert.equal(await readFile(result.recovery.backup, 'utf8'), '{"round":2');
    assert.equal(await readFile(path, 'utf8'), JSON.stringify(row) + '\n');
    await writeFile(path, JSON.stringify(row));
    assert.deepEqual((await readBatchRows(path)).rows, [row]);
    assert.equal(await readFile(path, 'utf8'), JSON.stringify(row) + '\n');
    await writeFile(path, 'invalid complete record\n');
    await assert.rejects(readBatchRows(path), SyntaxError);
    assert.equal(await readFile(path, 'utf8'), 'invalid complete record\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
