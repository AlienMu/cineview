// Summarise device-test/results/*.jsonl: per session and test, the answers (OK / Problem / Skip)
// with notes, errors, cv-errors, frame intervals and ready time. Prints a table and writes
// results/summary.md.
//
//   node device-test/summary.mjs
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(fileURLToPath(new URL('.', import.meta.url)), 'results');

export async function summarise() {
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.jsonl'));
  const lines = ['# 真机测试汇总', ''];
  for (const file of files) {
    const rows = (await readFile(resolve(dir, file), 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l));
    if (!rows.length) continue;
    lines.push(`## ${file.replace(/\.jsonl$/, '')}`, '', `设备：${rows[0].ua}`, '');
    lines.push('| 测试 | 结果 | 有问题的项与备注 | 报错 | cv-error | 帧间隔 P95 / 最长 / >50ms | 就绪 |', '|---|---|---|---|---|---|---|');
    const byTest = new Map();
    for (const r of rows) {
      const t = byTest.get(r.test) ?? { answers: {}, notes: {}, errors: new Set(), cv: new Set(), frames: null, ready: null };
      Object.assign(t.answers, r.answers);
      Object.assign(t.notes, r.notes);
      for (const e of r.errors ?? []) t.errors.add(e);
      for (const e of r.cvErrors ?? []) t.cv.add(e);
      if (r.frames && (!t.frames || r.frames.n > t.frames.n)) t.frames = r.frames;
      if (r.readyMs) t.ready = r.readyMs;
      byTest.set(r.test, t);
    }
    for (const [test, t] of byTest) {
      const values = Object.values(t.answers);
      const counts = ['ok', 'problem', 'skip'].map((v) => values.filter((x) => x === v).length);
      const problems = Object.entries(t.answers).filter(([, v]) => v === 'problem').map(([k]) => `${k}${t.notes[k] ? `：${t.notes[k]}` : ''}`);
      const notesOnly = Object.entries(t.notes).filter(([k]) => t.answers[k] !== 'problem').map(([k, v]) => `${k}（备注）：${v}`);
      const f = t.frames;
      lines.push(`| ${test} | 正常 ${counts[0]} / 有问题 ${counts[1]} / 没法测 ${counts[2]} | ${[...problems, ...notesOnly].join('；') || '-'} | ${[...t.errors].join('；') || '0'} | ${[...t.cv].join('；') || '0'} | ${f ? `${f.p95} / ${f.max} / ${f.over50}（${f.meanHz} Hz）` : '-'} | ${t.ready ?? '-'} ms |`);
    }
    lines.push('');
  }
  if (lines.length === 2) lines.push('还没有结果。');
  await writeFile(resolve(dir, 'summary.md'), lines.join('\n') + '\n').catch(() => {});
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(await summarise());
