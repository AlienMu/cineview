import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { enumerateCoverage } from './combinations.mjs';
import { runDesktop } from './desktop.mjs';

export const priorityPairs = [
  [4, 12],
  [10, 13],
  [25, 27],
  [9, 30],
  [32, 33],
  [5, 11],
  [14, 22],
  [37, 38],
];
const key = (ids) => ids.map((id) => String(id).padStart(2, '0')).join('-');

const labelOf = (order) => ({ 1: 'single', 2: 'pair', 3: 'triple' })[order];

export function combinationPlan({ order = 2, batchSize = 8 } = {}) {
  if (!Number.isInteger(order) || !labelOf(order)) throw new RangeError('order must be 1, 2 or 3');
  if (!Number.isInteger(batchSize) || batchSize < 1)
    throw new RangeError('batchSize must be positive');
  const coverage = enumerateCoverage({ maxOrder: order });
  const concepts = coverage.concepts.filter((c) => c.order === order);
  const ranks = new Map(order === 2 ? priorityPairs.map((ids, index) => [key(ids), index]) : []);
  concepts.sort(
    (a, b) =>
      (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity) || a.id.localeCompare(b.id)
  );
  const configs = coverage.configs.filter((c) => c.order === order);
  const batches = [],
    byConcept = new Map();
  for (let i = 0; i < concepts.length; i += batchSize) {
    const selected = concepts.slice(i, i + batchSize);
    const batch = {
      id: `${labelOf(order)}s-${String(batches.length + 1).padStart(3, '0')}`,
      concepts: selected,
      cases: [],
    };
    batches.push(batch);
    for (const concept of selected) byConcept.set(concept.id, batch);
  }
  // Partition once while retaining the original config order, including priority pair batches.
  for (const config of configs) byConcept.get(key(config.ids)).cases.push(config);
  return {
    order,
    concepts: concepts.length,
    configs: configs.length,
    status: configs.reduce((s, c) => ((s[c.status] = (s[c.status] ?? 0) + 1), s), {}),
    batches,
    scope:
      'Canonical sibling co-presence and standard-load measurements. Shared-element, Scene and control oracles are additional evidence, not inferred from co-presence.',
  };
}

export function pairPlan(options = {}) {
  return combinationPlan({ ...options, order: 2 });
}

export function remainingCases(cases, rows) {
  const completed = new Set(rows.map((row) => row.config.id));
  return cases.filter((c) => !completed.has(c.id));
}
async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

/** Preserve an interrupted final append before resuming; malformed complete lines still fail. */
export async function readBatchRows(path) {
  let source;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { rows: [] };
    throw error;
  }
  const end = source.lastIndexOf('\n') + 1;
  const rows = source.slice(0, end).split('\n').filter(Boolean).map(JSON.parse);
  const tail = source.slice(end);
  if (!tail) return { rows };
  let last;
  try {
    last = JSON.parse(tail);
  } catch {
    const backup = `${path}.incomplete-${Date.now()}.txt`;
    await writeFile(backup, tail, { flag: 'wx' });
    await writeFile(path, source.slice(0, end));
    return {
      rows,
      recovery: { file: path, backup, action: 'Incomplete final record kept pending' },
    };
  }
  rows.push(last);
  await appendFile(path, '\n');
  return {
    rows,
    recovery: { file: path, action: 'Completed final record lacked newline; appended newline' },
  };
}

/** One approved sub-batch. Each round has its own raw file; interrupted work resumes by case ID. */
export async function runCombinationBatch({
  order = 2,
  batch = 1,
  base = 'http://127.0.0.1:4382',
  output = `review/v2-pc-${labelOf(order)}s-20261016`,
  engines = ['chromium', 'webkit'],
  rounds = 3,
} = {}) {
  const plan = combinationPlan({ order }),
    selected = plan.batches[batch - 1];
  if (!selected) throw new RangeError('Unknown combination batch');
  await mkdir(output, { recursive: true });
  await writeFile(join(output, `${labelOf(order)}-plan.json`), JSON.stringify(plan, null, 2));
  const directory = join(output, selected.id);
  await mkdir(directory, { recursive: true });
  const previous = await readJson(join(directory, 'progress.json'), {});
  const records = new Map(),
    recovered = [];
  // Read all existing evidence before replacing progress, so malformed records cannot erase it.
  for (const engine of engines)
    for (let round = 1; round <= rounds; round++) {
      const file = join(directory, engine, `round-${round}`, `${engine}.jsonl`);
      const result = await readBatchRows(file);
      records.set(file, result.rows);
      if (result.recovery) recovered.push(result.recovery);
    }
  const cases = selected.cases.filter((c) => c.status === 'runnable');
  const progress = {
    id: selected.id,
    order,
    started: previous.started ?? new Date().toISOString(),
    ...(previous.started ? { resumed: new Date().toISOString() } : {}),
    base,
    rounds,
    engines,
    concepts: selected.concepts,
    contextStatuses: selected.cases,
    requiredRuns: cases.length * rounds * engines.length,
    roundIsolation: 'Fresh browser/context for each engine and round',
    enginesStatus: Object.fromEntries(
      engines
        .filter((engine) => previous.enginesStatus?.[engine])
        .map((engine) => [engine, previous.enginesStatus[engine]])
    ),
    recoveries: [...(previous.recoveries ?? []), ...recovered],
    results: [],
  };
  const save = async () => {
    const path = join(directory, 'progress.json');
    await writeFile(`${path}.tmp`, JSON.stringify(progress, null, 2));
    await rename(`${path}.tmp`, path);
  };
  let ranBrowser = false;
  for (const engine of engines)
    for (let round = 1; round <= rounds; round++) {
      const target = join(directory, engine, `round-${round}`),
        file = join(target, `${engine}.jsonl`);
      const stored = await readJson(join(target, 'summary.json'), {});
      if (stored.engines?.[engine]) progress.enginesStatus[engine] = stored.engines[engine];
      const existing = records.get(file),
        remaining = remainingCases(cases, existing);
      if (remaining.length) {
        ranBrowser = true;
        console.log(`BATCH ${selected.id} ${engine} round ${round}: ${remaining.length} remaining`);
        const result = await runDesktop({
          base,
          output: target,
          engines: [engine],
          cases: remaining,
          rounds: 1,
          roundStart: round,
          measure: true,
          realInput: true,
        });
        const status = result.engines[engine];
        progress.enginesStatus[engine] = status;
        if (status?.environmentError) {
          progress.results.push(
            ...(await readBatchRows(file)).rows.map((row) => ({
              engine,
              round: row.round,
              id: row.config.id,
              pass: row.pass,
              elapsedMs: row.elapsedMs,
            }))
          );
          await save();
          break;
        }
      }
      const rows = (await readBatchRows(file)).rows;
      progress.results.push(
        ...rows.map((row) => ({
          engine,
          round: row.round,
          id: row.config.id,
          pass: row.pass,
          elapsedMs: row.elapsedMs,
          failures: row.checks?.filter((c) => !c.ok),
          error: row.error,
        }))
      );
      await save();
    }
  progress.finished =
    !ranBrowser && previous.finished ? previous.finished : new Date().toISOString();
  progress.executedRuns = progress.results.length;
  progress.unexecutedRuns = progress.requiredRuns - progress.executedRuns;
  await save();
  return progress;
}

export function runPairBatch(options = {}) {
  return runCombinationBatch({ ...options, order: 2 });
}
