import { writeFile } from 'node:fs/promises';
import { measure } from './harness.mjs';

/**
 * Gate in WebKit and Firefox (plan v3 §11): no CPU throttling there, so fixed-N same-machine comparisons.
 * Long frame = rAF gap > 50 ms (applied to 1.x the same way). Firefox has no scroll-driven animations,
 * so 2.0 runs its direct-write path automatically.
 */
export async function runEngines(output, { runs = 3, engines = ['webkit', 'firefox'] } = {}) {
  const rows = [];
  const cases = [];
  for (const engine of engines) {
    for (const [mode, workload, n] of [['scroll', 'capacity', 512], ['scroll', 'mix', 256], ['drag', 'capacity', 512], ['drag', 'mix', 256]]) {
      cases.push({ engine, label: `${mode} ${workload} ${n} v1`, impl: 'v1', cfg: { mode, workload, scenes: 5, animations: n } });
      cases.push({ engine, label: `${mode} ${workload} ${n} v2`, impl: 'v2', cfg: { mode, workload, scenes: 5, animations: n } });
      if (mode === 'scroll' && engine === 'webkit') cases.push({ engine, label: `${mode} ${workload} ${n} v2 fallback`, impl: 'v2', cfg: { mode, workload, scenes: 5, animations: n, fallback: true } });
    }
    for (const mode of ['drag', 'scroll']) {
      cases.push({ engine, label: `heavy ${mode} v1`, impl: 'v1-heavy', cfg: { mode, scenes: 20, animations: 16, copy: 400 } });
      cases.push({ engine, label: `heavy ${mode} v2`, impl: 'v2-heavy', cfg: { mode, scenes: 20, animations: 16, copy: 400, author: 'contract' } });
    }
  }
  for (const c of cases) {
    for (let r = 0; r < runs; r++) {
      const s = await measure({ impl: c.impl, engine: c.engine, config: c.cfg, timeoutMs: 180000 });
      const row = { engine: c.engine, label: c.label, run: r + 1, hang: !!s.hang, hz: +(s.hz ?? 0).toFixed(1), p95: +(s.p95 ?? 0).toFixed(1), gaps50: s.gaps50 ?? null, maxGap: Math.round(s.maxGap ?? 0), readyMs: Math.round(s.readyMs ?? 0), movement: s.movement, errors: s.errors?.length ?? 0 };
      rows.push(row);
      console.log(JSON.stringify(row));
      await writeFile(output, JSON.stringify(rows, null, 1));
    }
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runEngines(process.argv[2] ?? 'review/v2-phase0-gate-20261008/engines.json', { engines: (process.argv[3] ?? 'webkit,firefox').split(',') });
}
