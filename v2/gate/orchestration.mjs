import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const launchers = { chromium, webkit };
async function mount(page, config) {
  let timer;
  try {
    return await Promise.race([
      page.evaluate((c) => bench.mount(c), config),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Fixture readiness timed out after 30s')), 30000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const clamp = (p) => Math.min(1, Math.max(0, p));
// Authored expectations, kept independent of solveScene/progressIn/evalLayer.
const windows = {
  after: { A: [100, 500, 500, 600], B: [650, 950, 950, 1150], C: [750, 1050, 1050, 1350] },
  sequence: { A: [0, 200, 200, 300], B: [250, 550, 550, 650], C: [600, 1000, 1000, 1100] },
  at: { A: [0, 1000], B: [250, 750, 800, 1000] },
};
function opacity(t, [start, end, exitStart, exitEnd]) {
  const entered = clamp((t - start) / (end - start));
  return entered * (exitEnd ? 1 - clamp((t - exitStart) / (exitEnd - exitStart)) : 1);
}
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))
      )
  );
const state = (page) =>
  page.evaluate(() => ({
    ...bench.snapshot(),
    layers: [...document.querySelectorAll('#middle cv-animate')].map((a) => ({
      id: a.id,
      count: !!a.shadowRoot?.querySelector('[part=count]'),
      values: a.layers.map((l) => {
        const s = getComputedStyle(l.el);
        return { source: l.source, opacity: +s.opacity, translate: s.translate };
      }),
      rect: a.getBoundingClientRect().toJSON(),
    })),
  }));

export async function runOrchestration({
  base = 'http://127.0.0.1:4380',
  output = 'review/v2-pc-validation-20261016/orchestration',
  engines = ['chromium', 'webkit'],
} = {}) {
  await mkdir(output, { recursive: true });
  const rows = [];
  for (const engine of engines) {
    let browser;
    try {
      browser = await launchers[engine].launch(engine === 'chromium' ? { channel: 'chrome' } : {});
      const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        hasTouch: false,
      });
      await page.goto(`${base}/combinations.html`);
      await page.waitForFunction(() => window.fixtureReady);
      for (const context of ['zone-auto', 'zone-fallback'])
        for (const variant of [
          'after',
          'sequence',
          'at',
          'same-source',
          'mixed-source',
          'nested',
          'count-split',
        ]) {
          const row = { engine, context, variant, checks: [], samples: [] };
          const check = (ok, label, detail) =>
            row.checks.push({ ok: !!ok, label, ...(ok ? {} : { detail }) });
          let reset = false;
          try {
            await mount(page, { ids: [], context, variant });
            for (const t of [0, 125, 300, 500, 700, 900, 1100, 1350, 900, 500, 0]) {
              await page.evaluate((t) => {
                const s = document.getElementById('middle');
                scrollTo(0, s.getBoundingClientRect().top + scrollY + t);
              }, t);
              await settle(page);
              const s = await state(page);
              row.samples.push({ t, ...s });
              if (windows[variant])
                for (const [id, window] of Object.entries(windows[variant])) {
                  const actual = s.layers
                    .find((a) => a.id === id)
                    ?.values.reduce((p, l) => p * l.opacity, 1);
                  const expected = opacity(t, window);
                  check(Math.abs(actual - expected) < 0.03, `${id} opacity at ${t}`, {
                    actual,
                    expected,
                  });
                }
              if (variant === 'same-source') {
                const a = s.layers.find((a) => a.id === 'A'),
                  p = clamp(t / 1000),
                  exit = 1 - clamp((t - 1000) / 200);
                check(
                  a.values.length === 1 && Math.abs(a.values[0].opacity - p * p * exit) < 0.03,
                  'same-source opacity multiplies',
                  { t, a }
                );
              }
              if (variant === 'nested') {
                const composite = s.layers.reduce(
                  (v, a) => v * a.values.reduce((n, l) => n * l.opacity, 1),
                  1
                );
                check(
                  Math.abs(composite - clamp(t / 1000) ** 2) < 0.03,
                  'nested opacity multiplies',
                  { t, composite }
                );
              }
              if (variant === 'mixed-source') {
                const a = s.layers.find((a) => a.id === 'A');
                check(
                  a.values.some((l) => l.source === 'view') &&
                    a.values.some((l) => l.source === 'scene'),
                  'mixed sources retain separate layers',
                  a
                );
                check(
                  Math.abs(a.values.find((l) => l.source === 'scene')?.opacity - clamp(t / 1000)) <
                    0.03,
                  'scene opacity keeps its independent source',
                  { t, a }
                );
              }
            }
            const last = row.samples.at(-1);
            check(last.errors.length === 0, 'no cv-error after reverse path', last.errors);
            if (variant === 'count-split') {
              check(
                !last.layers.find((a) => a.id === 'A').count,
                'count copy is refused with split'
              );
              row.classification =
                'unsupported-same-host; observed refusal is not combined capability support';
            }
            row.pass = row.checks.every((c) => c.ok);
          } catch (error) {
            row.pass = false;
            row.error = error.stack;
            reset = true;
          }
          rows.push(row);
          console.log(`${row.pass ? 'PASS' : 'FAIL'} ${engine} ${context} ${variant}`);
          await writeFile(join(output, 'results.json'), JSON.stringify(rows, null, 2));
          if (reset) {
            await page.reload();
            await page.waitForFunction(() => window.fixtureReady);
          }
        }
      await browser.close();
      browser = null;
    } catch (e) {
      rows.push({ engine, environmentError: e.stack });
    } finally {
      await browser?.close();
      await writeFile(join(output, 'results.json'), JSON.stringify(rows, null, 2));
    }
  }
  return rows;
}

/** Actual desktop pointer input, authored after chain, then composed exits and cancellation. */
export async function runDragOrchestration({
  base = 'http://127.0.0.1:4380',
  output = 'review/v2-pc-validation-20261016/orchestration-drag',
  engines = ['chromium', 'webkit'],
} = {}) {
  await mkdir(output, { recursive: true });
  const rows = [];
  for (const engine of engines) {
    const browser = await launchers[engine].launch(
      engine === 'chromium' ? { channel: 'chrome' } : {}
    );
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
        hasTouch: false,
      });
      await page.goto(`${base}/combinations.html`);
      await page.waitForFunction(() => window.fixtureReady);
      const row = { engine, checks: [], samples: [] },
        check = (ok, label, detail) =>
          row.checks.push({ ok: !!ok, label, ...(ok ? {} : { detail }) });
      try {
        await mount(page, { ids: [], context: 'drag', variant: 'after' });
        await page.mouse.move(1100, 750);
        await page.mouse.down();
        for (const p of [0.125, 0.4, 0.7, 0.85]) {
          await page.mouse.move(1100, 750 - p * 800 - 1);
          await settle(page);
          const s = await state(page);
          row.samples.push({ label: `incoming ${p}`, ...s });
          check(
            Math.abs(s.sceneTop - 800 * (1 - p)) < 2,
            'incoming Scene follows commanded pointer displacement',
            { p, top: s.sceneTop }
          );
          const t = p * 1000;
          for (const [id, window] of Object.entries(windows.after)) {
            const actual = s.layers
              .find((a) => a.id === id)
              ?.values.reduce((p, l) => p * l.opacity, 1);
            const expected = clamp((t - window[0]) / (window[1] - window[0]));
            check(Math.abs(actual - expected) < 0.04, `incoming ${id} follows pointer time`, {
              p,
              t,
              actual,
              expected,
            });
          }
        }
        await page.mouse.up();
        await page.waitForTimeout(1400);
        const entered = await state(page);
        check(
          entered.current === 1 &&
            entered.layers.every((a) => a.values.every((l) => l.opacity > 0.99)),
          'release continues whole after chain',
          entered
        );
        await page.mouse.move(1100, 650);
        await page.mouse.down();
        await page.mouse.move(1100, 489);
        await page.waitForTimeout(350);
        const departing = await state(page);
        row.samples.push({ label: 'partial exits', ...departing });
        const travel = 0.2;
        check(
          Math.abs(departing.sceneTop + 160) < 2,
          'partial departure moves the Scene by 160px',
          departing.sceneTop
        );
        for (const [id, duration] of [
          ['A', 100],
          ['B', 200],
          ['C', 300],
        ]) {
          const actual = departing.layers
              .find((a) => a.id === id)
              .values.reduce((p, l) => p * l.opacity, 1),
            expected = 1 - clamp((travel * 800) / duration);
          check(Math.abs(actual - expected) < 0.04, `departure ${id} uses its own exit duration`, {
            travel,
            actual,
            expected,
          });
        }
        await page.mouse.up();
        await page.waitForTimeout(650);
        const restored = await state(page);
        row.samples.push({ label: 'cancel restored', ...restored });
        check(
          restored.current === 1 &&
            Math.abs(restored.sceneTop) < 1 &&
            restored.layers.every((a) => a.values.every((l) => l.opacity > 0.99)),
          'cancel restores all three elements',
          restored
        );
        check(restored.errors.length === 0, 'no cv-error after gesture chain', restored.errors);
        row.pass = row.checks.every((c) => c.ok);
      } catch (error) {
        row.pass = false;
        row.error = error.stack;
      }
      rows.push(row);
      console.log(`${row.pass ? 'PASS' : 'FAIL'} ${engine} drag after/exits/cancel`);
    } finally {
      await browser.close();
      await writeFile(join(output, 'results.json'), JSON.stringify(rows, null, 2));
    }
  }
  return rows;
}
