import { chromium, webkit } from 'playwright';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import { INIT, frameStates } from './harness.mjs';
import { enumerateCoverage } from './combinations.mjs';

const launchers = { chromium, webkit };
const viewport = { width: 1280, height: 800 };
const clamp = (n) => Math.min(1, Math.max(0, n));
const frames = (page, n = 3) =>
  page.evaluate(
    (n) =>
      new Promise((resolve) => {
        const next = () => (n-- ? requestAnimationFrame(next) : resolve());
        requestAnimationFrame(next);
      }),
    n
  );
const snapshot = (page) => page.evaluate(() => bench.snapshot());
const keyboardSnapshot = (page) =>
  page.evaluate(() => ({
    time: performance.now(),
    scrollY,
    maxScrollY: document.documentElement.scrollHeight - innerHeight,
    documentFocused: document.hasFocus(),
    activeElement: {
      tag: document.activeElement?.tagName,
      id: document.activeElement?.id,
    },
  }));
async function mountFixture(page, config) {
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

export const pilotCases = [
  [4, 12, 30],
  [25, 27, 33],
  [1, 8, 37],
  [10, 13, 32],
  [22, 29, 36],
  [3, 5, 11],
  [6, 9, 38],
  [14, 15, 24],
  [16, 17, 23],
  [18, 19, 20],
  [26, 28, 31],
  [34, 35, 40],
  [39, 41],
].flatMap((ids) =>
  ['drag', 'zone-auto', 'zone-fallback', 'enter-auto', 'enter-fallback']
    .filter((context) => !context.startsWith('enter') || !ids.some((id) => id === 3 || id === 5))
    .map((context) => ({ id: `${context}/${ids.join('-')}`, ids, context, placement: 'siblings' }))
);

/** Publicly callable; full catalog selection is explicit, so a pilot cannot be reported as exhaustive. */
export function canonicalCases(order = 1) {
  return enumerateCoverage({ maxOrder: order }).configs.filter((c) => c.status === 'runnable');
}

async function phase(page, name, action, measure, rows) {
  if (measure)
    await page.evaluate((name) => {
      performance.mark(`cv-phase-${name}-start`);
      startMeasure();
    }, name);
  try {
    await action();
  } finally {
    if (measure) {
      const metrics = await page.evaluate(() => stopMeasure());
      await page.evaluate((name) => performance.mark(`cv-phase-${name}-end`), name);
      rows.push({
        name,
        ...metrics,
        loaf50: metrics.supported.loaf ? metrics.loaf50 : null,
        loafMax: metrics.supported.loaf ? metrics.loafMax : null,
        loafBlocking: metrics.supported.loaf ? metrics.loafBlocking : null,
        loafNoScriptMax: metrics.supported.loaf ? metrics.loafNoScriptMax : null,
        longTasks: metrics.supported.longtask ? metrics.longTasks : null,
        longMax: metrics.supported.longtask ? metrics.longMax : null,
      });
    }
  }
}

async function drag(page, dy, { hold = 0, release = true } = {}) {
  const y = dy < 0 ? 650 : 150;
  await page.mouse.move(1100, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(1100, y + (dy * i) / 12);
    await page.waitForTimeout(16);
  }
  if (hold) await page.waitForTimeout(hold);
  if (release) await page.mouse.up();
}

/** Expected opacity uses authored ms and measured document scroll, not the runtime solver/evaluator. */
async function functionalCase(
  page,
  config,
  { measure = false, realInput = false, prepareCase } = {}
) {
  const started = performance.now(),
    checks = [],
    samples = [],
    inputSamples = [],
    phases = [];
  const check = (ok, label, detail) => checks.push({ ok: !!ok, label, ...(ok ? {} : { detail }) });
  let initial = await page.evaluate((c) => bench.mount(c), config);
  // Diagnostic intervention and evidence stay outside every metric window.
  const preparation = await prepareCase?.(page, config);
  if (prepareCase) initial = await snapshot(page);
  if (config.ids.some((id) => [26, 36].includes(id)))
    check(
      initial.ownAnimationStates.length > 0 &&
        initial.ownAnimationStates.every((state) => state === 'paused'),
      'page animations are initially paused',
      initial.ownAnimationStates
    );
  await page.evaluate(() => bench.goTo('middle'));
  const zone = config.context.startsWith('zone');
  const take = async (label) => {
    const s = await snapshot(page);
    samples.push({ label, ...s });
    return s;
  };
  if (zone) {
    for (const t of [0, 250, 500, 750, 1000, 1100, 1200, 1100, 500, 0]) {
      await phase(
        page,
        `scroll-${t}`,
        async () => {
          // The beacon's entrance is 1000 ms; its exit is 200 ms. Other nodes may extend the zone.
          await page.evaluate((t) => {
            const scene = document.getElementById('middle');
            scrollTo(0, scene.getBoundingClientRect().top + scrollY + t);
          }, t);
          await frames(page);
        },
        measure,
        phases
      );
      const s = await take(`t=${t}`),
        a = s.properties.find((a) => a.id === 'a-beacon');
      const actual = a?.layers[0]?.opacity;
      const expected = t <= 1000 ? clamp(t / 1000) : 1 - clamp((t - 1000) / 200);
      check(Math.abs(actual - expected) < 0.035, `beacon opacity at ${t}px`, { actual, expected });
    }
  } else {
    await phase(page, 'entrance', () => page.waitForTimeout(1200), measure, phases);
    const s = await take('entered');
    check(
      s.properties.find((a) => a.id === 'a-beacon')?.layers[0]?.opacity > 0.99,
      'visible completed entrance',
      s.properties
    );
  }
  let s = await take('output');
  check(s.current === 1, 'middle scene is current', s.current);
  check(s.errors.length === 0, 'no cv-error', s.errors);
  for (const id of config.ids.filter((id) =>
    [1, 2, 4, 7, 8, 9, 10, 12, 13, 25, 27, 30, 32, 33, 37, 38, 40].includes(id)
  )) {
    const nodes = s.properties.filter((a) => a.id === `a-${id}` || a.id.endsWith(`-a-${id}`));
    check(
      nodes.length === (config.copies ?? 1) && nodes.every((a) => a.layers.length > 0),
      `reference ${id} has actual animation layers`,
      nodes
    );
  }
  check(
    s.tiles.length === config.ids.length * (config.copies ?? 1) &&
      s.tiles.every((t) => t.width > 20 && t.height > 20),
    'all authored tiles have geometry',
    s.tiles
  );
  check(
    s.properties.every((a) =>
      a.layers.every((l) => Number.isFinite(l.opacity) && !/NaN|Infinity/.test(JSON.stringify(l)))
    ),
    'finite computed outputs',
    s.properties
  );
  if (config.context.includes('fallback'))
    check(s.native === 0, 'forced fallback attaches no native layers', s.native);
  if (config.context === 'drag') check(s.native === 0, 'drag uses direct output', s.native);
  const custom = await page.evaluate(() => {
    const find = (selector) => document.querySelector(selector);
    const font = find('[data-font]');
    const canvas = find('canvas');
    return {
      font: font
        ? {
            loaded: document.fonts.check('26px "CV Variable"'),
            family: getComputedStyle(font).fontFamily,
          }
        : null,
      words: find('[data-ref="10"] cv-animate')?.shadowRoot?.textContent ?? null,
      dither: canvas
        ? [...canvas.getContext('2d').getImageData(0, 0, 128, 96).data]
            .filter((_, i) => i % 4 === 0)
            .reduce((r, v) => {
              r[v] = (r[v] ?? 0) + 1;
              return r;
            }, {})
        : null,
      vertical: find('.vertical') ? getComputedStyle(find('.vertical')).writingMode : null,
      mask: find('.mask-text') ? getComputedStyle(find('.mask-text')).backgroundClip : null,
      outside: getComputedStyle(find('#outside-scope')).getPropertyValue('--scope'),
      duplicateHidden: find('[data-marquee] span:last-child')?.getAttribute('aria-hidden'),
      stop: find('.stop > div') ? getComputedStyle(find('.stop > div')).scrollSnapStop : null,
    };
  });
  if (config.ids.includes(33))
    check(
      custom.font?.loaded && custom.font.family.includes('CV Variable'),
      'real variable font loaded',
      custom.font
    );
  if (config.ids.includes(29))
    check(
      Object.keys(custom.dither ?? {}).join() === '0,255' &&
        custom.dither[0] > 1000 &&
        custom.dither[255] > 1000,
      'ordered dither produces both black and white pixels',
      custom.dither
    );
  if (config.ids.includes(35))
    check(
      custom.vertical === 'vertical-rl',
      'vertical text is actually laid out vertically',
      custom.vertical
    );
  if (config.ids.includes(34))
    check(custom.mask === 'text', 'text clipping is active', custom.mask);
  if (config.ids.includes(38))
    check(custom.outside === '', 'local variable does not leak to sibling', custom.outside);
  if (config.ids.includes(36))
    check(
      custom.duplicateHidden === 'true',
      'marquee copy is hidden from accessibility tree',
      custom.duplicateHidden
    );
  if (config.ids.includes(15))
    check(custom.stop === 'always', 'native snap-stop is declared', custom.stop);
  if (config.ids.includes(31)) {
    await page.locator('[aria-label="Compare images"]').fill('75');
    const clip = await page
      .locator('[data-compare] img:last-child')
      .evaluate((el) => getComputedStyle(el).clipPath);
    check(clip.includes('25%'), 'comparison control changes actual image clipping', clip);
  }
  if (realInput) {
    if (config.context === 'drag') {
      await phase(
        page,
        'cancel',
        async () => {
          await drag(page, -160, { hold: 180 });
          await page.waitForTimeout(850);
        },
        measure,
        phases
      );
      s = await take('cancel');
      check(
        s.current === 1 && Math.abs(s.sceneTop) < 1,
        'held short drag returns to same scene',
        s
      );
      await phase(
        page,
        'exit-forward',
        async () => {
          await drag(page, -460);
          await page.waitForTimeout(850);
        },
        measure,
        phases
      );
      s = await take('forward');
      check(s.current === 2, 'real mouse drag commits forward', s.current);
      if (s.ownAnimations)
        check(
          s.ownAnimationStates.every((state) => state === 'paused'),
          'page-owned animations pause on departure',
          s.ownAnimationStates
        );
      await phase(
        page,
        'return',
        async () => {
          await drag(page, 460);
          await page.waitForTimeout(1400);
        },
        measure,
        phases
      );
      s = await take('returned');
      if (s.ownAnimations)
        check(
          s.ownAnimationStates.every((state) => state === 'running'),
          'page-owned animations resume on return',
          s.ownAnimationStates
        );
      check(
        s.current === 1 && Math.abs(s.sceneTop) < 1,
        'real reverse drag returns readable middle',
        s
      );
      await page.locator('cv-stage').focus();
      await page.keyboard.press('Home');
      await page.waitForTimeout(900);
      check((await snapshot(page)).current === 0, 'keyboard Home navigates');
      await page.keyboard.press('End');
      await page.waitForTimeout(900);
      check((await snapshot(page)).current === 2, 'keyboard End navigates');
    } else {
      await page.evaluate(() => bench.goTo('middle'));
      const before = (await snapshot(page)).scrollY;
      await phase(
        page,
        'wheel',
        async () => {
          await page.mouse.move(1200, 500);
          for (let step = 0; step < 24; step++) {
            await page.mouse.wheel(0, 25);
            await page.waitForTimeout(16);
          }
          await page.waitForTimeout(250);
        },
        measure,
        phases
      );
      check((await snapshot(page)).scrollY > before + 100, 'real wheel moves document');
      // A range input intentionally owns paging keys while focused; test document input separately.
      await page.evaluate(() => document.activeElement?.blur());
      const beforeHome = await keyboardSnapshot(page);
      await page.keyboard.press('Home');
      await page.waitForTimeout(300);
      const keyStart = (await snapshot(page)).scrollY;
      const afterHome = await keyboardSnapshot(page);
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(400);
      const keyEnd = (await snapshot(page)).scrollY;
      const keyboard = {
        kind: 'document-keyboard',
        beforeHome,
        afterHome,
        afterPageDown: await keyboardSnapshot(page),
        keyStart,
        keyEnd,
      };
      inputSamples.push(keyboard);
      check(keyEnd > keyStart, 'real PageDown moves document', keyboard);
      if (keyEnd <= keyStart) {
        // Preserve the original failed result; observe whether native scrolling arrives later.
        await page.waitForTimeout(500);
        keyboard.afterFailureDelay = await keyboardSnapshot(page);
      }
      await page.evaluate(() => scrollTo(0, 1e6));
      await frames(page);
      const bottom = await snapshot(page);
      check(bottom.current === 2, 'large jump reaches final readable scene', bottom.current);
      await page.evaluate(() => scrollTo(0, 0));
      await frames(page);
      check((await snapshot(page)).current === 0, 'large reverse jump returns to first scene');
    }
  }
  s = await take('final');
  check(s.errors.length === 0, 'no cv-error after all interactions', s.errors);
  await page.evaluate(() => bench.unmount());
  await frames(page);
  const clean = await snapshot(page);
  check(
    clean.nodes === 0 && clean.animations === 0,
    'unmount removes nodes and document animations',
    clean
  );
  return {
    config,
    preparation,
    elapsedMs: performance.now() - started,
    initial,
    checks,
    samples,
    inputSamples,
    phases,
    proof:
      'composition-smoke; beacon numeric oracle and selected page-output assertions; dedicated feature probes remain required',
    pass: checks.every((c) => c.ok),
  };
}

/** Desktop-only runner. Write each raw result immediately; never select only the best round. */
export async function runDesktop({
  base = 'http://127.0.0.1:4380',
  output = 'review/v2-pc-validation-20261016/desktop',
  engines = ['chromium', 'webkit'],
  cases = pilotCases,
  rounds = 1,
  roundStart = 1,
  measure = false,
  realInput = true,
  caseTimeoutMs = 45000,
  trace = false,
  prepareCase,
} = {}) {
  await mkdir(output, { recursive: true });
  const summary = {
    started: new Date().toISOString(),
    base,
    viewport,
    dpr: 1,
    touch: false,
    measure,
    trace,
    rounds,
    roundStart,
    scope: 'Selected cases only; not the complete combination catalog',
    host: { platform: os.platform(), arch: os.arch(), cpus: os.cpus().length },
    engines: {},
    results: [],
  };
  for (const engine of engines) {
    let browser;
    try {
      if (!launchers[engine]) throw new Error(`Unknown engine ${engine}`);
      browser = await launchers[engine].launch(engine === 'chromium' ? { channel: 'chrome' } : {});
      summary.engines[engine] = { version: browser.version() };
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      });
      await context.addInitScript(INIT);
      const pageErrors = [];
      const open = async () => {
        const p = await context.newPage();
        p.on('pageerror', (e) => pageErrors.push(e.message));
        await p.goto(`${base}/combinations.html`);
        await p.waitForFunction(() => window.fixtureReady);
        return p;
      };
      let page = await open();
      summary.engines[engine].calibration = await page.evaluate(async () => {
        startMeasure();
        await new Promise((r) => setTimeout(r, 1000));
        return stopMeasure();
      });
      for (let round = roundStart; round < roundStart + rounds; round++)
        for (const config of cases) {
          pageErrors.length = 0;
          let row;
          let timer;
          let tracing = false;
          let reset = false;
          try {
            if (trace && engine === 'chromium') {
              await browser.startTracing(page, {
                categories: [
                  'benchmark',
                  'cc',
                  'viz',
                  'blink.user_timing',
                  'disabled-by-default-devtools.timeline.frame',
                ],
              });
              tracing = true;
            }
            row = await Promise.race([
              functionalCase(page, config, { measure, realInput, prepareCase }),
              new Promise((_, reject) => {
                timer = setTimeout(
                  () => reject(new Error(`Case timeout after ${caseTimeoutMs}ms`)),
                  caseTimeoutMs
                );
              }),
            ]);
          } catch (e) {
            row = { config, pass: false, error: e.stack };
            reset = true;
          } finally {
            clearTimeout(timer);
            if (tracing) {
              try {
                const raw = await browser.stopTracing();
                const file = join(
                  output,
                  `${engine}-${round}-${config.id.replaceAll('/', '-')}.trace.json`
                );
                await writeFile(file, raw);
                const states = frameStates(raw);
                row.trace = {
                  file,
                  frameStates:
                    states.displayed || states.presented || states.dropped ? states : null,
                  scope:
                    'diagnostic whole-case trace, including mount and checks; separate from light phase metrics',
                };
              } catch (error) {
                row.trace = { error: error.stack };
              }
            }
          }
          row = { engine, round, ...row, pageErrors: [...pageErrors] };
          if (pageErrors.length) row.pass = false;
          await appendFile(join(output, `${engine}.jsonl`), JSON.stringify(row) + '\n');
          summary.results.push({
            engine,
            round,
            id: config.id,
            pass: row.pass,
            elapsedMs: row.elapsedMs,
            failures: row.checks?.filter((c) => !c.ok),
            error: row.error,
          });
          console.log(
            `${row.pass ? 'PASS' : 'FAIL'} ${engine} r${round} ${config.id}${row.error ? ' ' + row.error.split('\n')[0] : ''}`
          );
          await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2));
          if (reset) {
            await page.close();
            page = await open();
          }
        }
      await context.close();
    } catch (e) {
      summary.engines[engine] = { environmentError: e.stack };
      console.log(`ENV ${engine}: ${e.message.split('\n')[0]}`);
    } finally {
      await browser?.close();
      await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2));
    }
  }
  summary.finished = new Date().toISOString();
  await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

/** Repeated disposal/navigation check, separate from frame-rate measurement. Heap is diagnostic. */
export async function runDesktopLifecycle({
  base = 'http://127.0.0.1:4380',
  output = 'review/v2-pc-validation-20261016/lifecycle',
  engines = ['chromium', 'webkit'],
  cycles = 100,
} = {}) {
  await mkdir(output, { recursive: true });
  const rows = [];
  for (const engine of engines) {
    const browser = await launchers[engine].launch(
      engine === 'chromium' ? { channel: 'chrome' } : {}
    );
    const row = {
      engine,
      version: browser.version(),
      base,
      viewport,
      dpr: 1,
      touch: false,
      cycles,
      checks: [],
      heap: [],
      screenshots: [],
    };
    const check = (ok, label, detail) =>
      row.checks.push({ ok: !!ok, label, ...(ok ? {} : { detail }) });
    try {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: false });
      const errors = [];
      row.pageErrors = errors;
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${base}/combinations.html`);
      await page.waitForFunction(() => window.fixtureReady);
      const cdp = engine === 'chromium' ? await page.context().newCDPSession(page) : null;
      if (cdp) {
        await cdp.send('HeapProfiler.collectGarbage');
        row.heap.push({ cycle: 0, ...(await cdp.send('Runtime.getHeapUsage')) });
      }
      for (let cycle = 1; cycle <= cycles; cycle++) {
        const config = {
          ids: [
            [26, 29, 36],
            [25, 27, 33],
            [6, 10, 32],
          ][(cycle - 1) % 3],
          context: cycle % 2 ? 'drag' : 'zone-fallback',
        };
        let timer;
        try {
          await Promise.race([
            page.evaluate((c) => bench.mount(c), config),
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('Lifecycle mount timed out')), 30000);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
        for (const target of ['middle', 'after', 'middle', 'before']) {
          await page.evaluate((target) => bench.goTo(target), target);
          await frames(page, 1);
          const s = await snapshot(page);
          check(
            s.current === { middle: 1, after: 2, before: 0 }[target],
            `${cycle}: navigate ${target}`,
            s.current
          );
          check(s.errors.length === 0, `${cycle}: no cv-error`, s.errors);
        }
        await page.evaluate(() => bench.unmount());
        await frames(page, 1);
        const clean = await snapshot(page);
        check(
          clean.nodes === 0 && clean.animations === 0,
          `${cycle}: disposal leaves no fixture nodes/animations`,
          clean
        );
        if (cdp && cycle % 20 === 0)
          row.heap.push({ cycle, ...(await cdp.send('Runtime.getHeapUsage')) });
      }
      if (cdp) {
        await cdp.send('HeapProfiler.collectGarbage');
        row.heap.push({
          cycle: cycles,
          afterGC: true,
          ...(await cdp.send('Runtime.getHeapUsage')),
        });
      } else row.heapAvailability = 'N/A: no CDP heap measurement in this engine';
      check(errors.length === 0, 'no page errors through all cycles', errors);
      for (const ids of [
        [4, 12, 30],
        [25, 27, 33],
        [26, 28, 31],
      ]) {
        await mountFixture(page, { ids, context: 'drag' });
        await page.evaluate(() => bench.goTo('middle'));
        await page.waitForTimeout(1300);
        const file = join(output, `${engine}-${ids.join('-')}.png`);
        await page.screenshot({ path: file });
        row.screenshots.push(file);
      }
      row.pass = row.checks.every((c) => c.ok);
    } catch (error) {
      row.pass = false;
      row.error = error.stack;
    } finally {
      await browser.close();
      rows.push(row);
      await writeFile(join(output, 'results.json'), JSON.stringify(rows, null, 2));
    }
    console.log(`${row.pass ? 'PASS' : 'FAIL'} ${engine} lifecycle ${cycles} cycles`);
  }
  return rows;
}

/** Page-owned controls and native nested scrolling have their own acceptance, beyond co-presence. */
export async function runPageControls({
  base = 'http://127.0.0.1:4380',
  output = 'review/v2-pc-validation-20261016/page-controls',
  engines = ['chromium', 'webkit'],
} = {}) {
  await mkdir(output, { recursive: true });
  const rows = [];
  for (const engine of engines) {
    const row = { engine, checks: [], samples: [] },
      check = (ok, label, detail) =>
        row.checks.push({ ok: !!ok, label, ...(ok ? {} : { detail }) });
    const browser = await launchers[engine].launch(
      engine === 'chromium' ? { channel: 'chrome' } : {}
    );
    try {
      const page = await browser.newPage({ viewport, hasTouch: false });
      await page.goto(`${base}/combinations.html`);
      await page.waitForFunction(() => window.fixtureReady);
      for (const ids of [
        [14, 15, 24],
        [22, 29, 36],
        [16, 17, 23],
        [31, 38, 41],
        [26, 28, 33],
      ]) {
        await mountFixture(page, { ids, context: 'drag' });
        await page.evaluate(() => bench.goTo('middle'));
        await page.waitForTimeout(1250);
        if (ids.includes(14)) {
          const gallery = page.locator('[data-ref="14"] .scroller'),
            box = await gallery.boundingBox();
          await page.mouse.move(box.x + box.width / 2, box.y + 70);
          await page.mouse.wheel(700, 0);
          await page.waitForTimeout(650);
          const left = await gallery.evaluate((el) => el.scrollLeft);
          check(
            left > 100 && (await snapshot(page)).current === 1,
            'horizontal native wheel scrolls local gallery and keeps Stage current',
            { left }
          );
        }
        if (ids.includes(22)) {
          const gallery = page.locator('[data-ref="22"] .scroller'),
            box = await gallery.boundingBox(),
            x = box.x + box.width * 0.8,
            y = box.y + 70;
          await page.mouse.move(x, y);
          await page.mouse.down();
          for (let i = 1; i <= 8; i++) {
            await page.mouse.move(x - (160 * i) / 8, y);
            await page.waitForTimeout(16);
          }
          const before = await gallery.evaluate((el) => el.scrollLeft);
          await page.mouse.up();
          await page.waitForTimeout(450);
          const after = await gallery.evaluate((el) => el.scrollLeft);
          check(
            before > 50 && after > before + 5 && (await snapshot(page)).current === 1,
            'page-owned kinetic drag continues locally after release',
            { before, after }
          );
          await page.evaluate(() => bench.pause());
          const paused = await snapshot(page);
          await page.waitForTimeout(120);
          check(
            paused.ownAnimationStates.every((s) => s === 'paused'),
            'fixture pause stops page-owned marquee'
          );
          await page.evaluate(() => bench.play());
        }
        if (ids.includes(16)) {
          await page.locator('[data-ref="16"] a[href="#after"]').click();
          await page.waitForTimeout(900);
          check(
            (await snapshot(page)).current === 2,
            'explicit marker fallback navigates to final Scene'
          );
          await page.evaluate(() => bench.goTo('middle'));
          await page.locator('[data-next]').click();
          await page.waitForTimeout(900);
          check(
            (await snapshot(page)).current === 2,
            'page-owned next button uses public navigation'
          );
          const marked = await page
            .locator('[data-ref="23"] a[href="#after"]')
            .getAttribute('aria-current');
          check(marked === 'true' || marked === 'page', 'scrollspy marks final anchor', marked);
        }
        if (ids.includes(38)) {
          // A fresh zone run allows an exact authored 500ms waypoint for the scoped rotation.
          await mountFixture(page, { ids, context: 'zone-fallback' });
          await page.evaluate(() => bench.progress(500 / 1200));
          await frames(page);
          const rotation = await page
            .locator('[data-rotation]')
            .evaluate((el) => getComputedStyle(el).transform);
          const matrix = rotation
            .match(/matrix\(([^)]+)\)/)?.[1]
            .split(',')
            .map(Number);
          check(
            matrix &&
              Math.abs(matrix[0] - Math.SQRT1_2) < 0.02 &&
              Math.abs(matrix[1] - Math.SQRT1_2) < 0.02,
            'local custom variable produces an actual 45-degree rotation',
            rotation
          );
        }
        if (ids.includes(26)) {
          const opacity = await page.evaluate(() => {
            const imgs = [...document.querySelectorAll('[data-ken] img')];
            return [1000, 6000, 11000].map((t) => {
              for (const img of imgs) for (const a of img.getAnimations()) a.currentTime = t;
              return imgs.map((img) => +getComputedStyle(img).opacity);
            });
          });
          check(
            opacity[0][0] > 0.99 &&
              opacity[0][1] < 0.01 &&
              Math.abs(opacity[1][0] - 0.5) < 0.03 &&
              Math.abs(opacity[1][1] - 0.5) < 0.03 &&
              opacity[2][0] < 0.01 &&
              opacity[2][1] > 0.99,
            'authored Ken Burns has a real two-image dissolve',
            opacity
          );
        }
        const s = await snapshot(page);
        check(s.errors.length === 0, 'controls produce no cv-error', s.errors);
        row.samples.push(s);
      }
      row.pass = row.checks.every((c) => c.ok);
    } catch (error) {
      row.pass = false;
      row.error = error.stack;
    } finally {
      await browser.close();
      rows.push(row);
      await writeFile(join(output, 'results.json'), JSON.stringify(rows, null, 2));
    }
    console.log(`${row.pass ? 'PASS' : 'FAIL'} ${engine} page controls`);
  }
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runDesktop();
  process.exitCode =
    result.results.some((r) => !r.pass) ||
    Object.values(result.engines).some((e) => e.environmentError)
      ? 1
      : 0;
}
