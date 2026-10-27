/* global requestAnimationFrame, window, integrated, scrollTo, scrollY, document,
   innerHeight, innerWidth, getComputedStyle, process, integratedReady, console */
import { chromium, webkit } from 'playwright';
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { capabilities } from './combinations.mjs';
import { INIT } from './harness.mjs';
import { imageCopyRegistration } from './runtime-fixes.mjs';

/** The same content, in the contexts that change its input or layout semantics. */
export function integratedCases() {
  return [
    ...['drag', 'zone-auto', 'zone-fallback', 'enter-auto', 'enter-fallback'].map((context) => ({
      context,
      layout: 'grid',
    })),
    ...['drag', 'zone-auto', 'zone-fallback'].map((context) => ({ context, layout: 'track' })),
  ].map((c) => ({ ...c, id: `${c.layout}/${c.context}` }));
}

/** A reference is an authoring route, not an additional built-in preset. */
export function integratedInventory() {
  const page = new Set([14, 15, 16, 17, 22, 24, 26, 28, 29, 31, 34, 35, 36, 38, 39]);
  const location = {
    1: 'page-progress',
    2: 'view-note',
    3: 'middle/fixed-state',
    4: 'D',
    5: 'middle[track=x]',
    6: 'deck',
    7: 'velocity',
    8: 'material-subject/view-note',
    9: 'B',
    10: 'split-words/source labels',
    11: 'middle/after',
    12: 'focus-band',
    13: 'C',
    14: 'snap-gallery',
    15: 'snap-gallery',
    16: 'Scene anchors',
    17: 'gallery controls/Scene links',
    18: 'held-state',
    19: 'Scene aria-current',
    20: 'direction',
    21: null,
    22: 'kinetic-gallery',
    23: 'Scene anchors',
    24: 'both galleries',
    25: 'develop/pending-image',
    26: 'data-pan',
    27: 'develop',
    28: 'case-blur',
    29: 'dither',
    30: 'B',
    31: 'comparison',
    32: 'split-lines',
    33: 'split-lines',
    34: 'case-textmask',
    35: 'case-vertical',
    36: 'marquee',
    37: 'G',
    38: 'G --scope',
    39: 'F color-mix',
    40: 'inversion',
    41: 'Scene themes',
  };
  return capabilities.map(({ id, name }) => ({
    id,
    name,
    owner: id === 21 ? 'excluded' : page.has(id) ? 'page' : 'framework/composition',
    location: location[id],
    boundary:
      id === 21
        ? 'Finite Stage; no endless wrapping'
        : id === 5
          ? 'Same content in track layout; track implies zone in scroll'
          : id === 10
            ? 'Timed split/stagger adaptation; labels correspond to the source steps'
            : id === 16
              ? 'Explicit anchors; native CSS marker support is metadata only'
              : id === 18 || id === 19
                ? 'Managed Scene state, not arbitrary native CSS state queries'
                : id === 26
                  ? 'Page-owned pan/dissolve, independently paused'
                  : id === 39
                    ? 'Chosen OKLCH color-mix path, no general gamut solver'
                    : id === 40
                      ? 'Decorative short label; gray is a known contrast limitation'
                      : null,
  }));
}

const clip = (p) => Math.max(0, Math.min(1, p));
const progress = (t, a, b) => clip((t - a) / (b - a));
const frames = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      )
  );
const read = (page) => page.evaluate(() => window.integrated.read());
const timeAt = async (page, time) => {
  await page.evaluate((t) => {
    const { stage, scene } = integrated.state;
    stage.refresh();
    scrollTo(0, scene.docTop + t);
  }, time);
  await frames(page);
};
const node = (s, id) => s.nodes.find((n) => n.id === id);
const layer = (s, id, source) => node(s, id)?.layers.find((l) => l.source === source);
const variable = (s, id, key) => Number(node(s, id)?.layers.find((l) => key in l.vars)?.vars[key]);
const close = (actual, expected, tolerance = 0.006) =>
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;

/** Unsupported observer fields are unavailable; keep all original samples and supported values. */
export function integratedMetrics(metrics) {
  return {
    ...metrics,
    loaf50: metrics.supported.loaf ? metrics.loaf50 : null,
    loafMax: metrics.supported.loaf ? metrics.loafMax : null,
    loafBlocking: metrics.supported.loaf ? metrics.loafBlocking : null,
    loafNoScriptMax: metrics.supported.loaf ? metrics.loafNoScriptMax : null,
    longTasks: metrics.supported.longtask ? metrics.longTasks : null,
    longMax: metrics.supported.longtask ? metrics.longMax : null,
  };
}

async function sampleMeasure(page, phase, duration) {
  const before = await read(page);
  await page.evaluate(() => window.startMeasure());
  await page.waitForTimeout(duration);
  const stats = integratedMetrics(await page.evaluate(() => window.stopMeasure()));
  const after = await read(page);
  return {
    phase,
    requestedMs: duration,
    before: {
      clock: before.clock,
      current: before.current,
      paused: before.paused,
      own: before.own,
      compass: node(before, 'compass'),
      video: before.video,
    },
    stats,
    after: {
      clock: after.clock,
      current: after.current,
      paused: after.paused,
      own: after.own,
      compass: node(after, 'compass'),
      video: after.video,
    },
  };
}

async function scrollThumb(page, delta) {
  const before = await page.evaluate(() => ({
    y: scrollY,
    height: document.documentElement.scrollHeight,
    vh: innerHeight,
    vw: innerWidth,
  }));
  const size = before.vh ** 2 / before.height;
  const center = (before.y / (before.height - before.vh)) * (before.vh - size) + size / 2;
  await page.mouse.move(before.vw - 8, center);
  await page.mouse.down();
  await page.mouse.move(before.vw - 8, center + delta, { steps: 12 });
  await page.mouse.up();
  await frames(page);
  return { before, after: await page.evaluate(() => scrollY) };
}

async function drag(page, distance, hold = 350) {
  // The margin beside the content is deliberately outside interactive controls.
  await page.mouse.move(12, 650);
  await page.mouse.down();
  await page.mouse.move(12, 650 - distance, { steps: 6 });
  if (hold) await page.waitForTimeout(hold);
  const held = await read(page);
  await page.mouse.up();
  await page.waitForTimeout(900);
  await frames(page);
  return { held, released: await read(page) };
}

async function expose(page, selector, config) {
  if (config.layout !== 'track') return;
  const time = await page.evaluate((selector) => {
    const { scene } = integrated.state;
    const r = scene.querySelector(selector).getBoundingClientRect();
    const shifted = parseFloat(getComputedStyle(scene.track).translate) || 0;
    return Math.max(0, Math.min(scene.travel, r.x + r.width / 2 - shifted - innerWidth / 2));
  }, selector);
  await timeAt(page, time);
}

/** Serial, finite functional acceptance with raw performance observations of this one case. */
export async function runIntegrated({
  base,
  output,
  engines = ['chromium', 'webkit'],
  cases = integratedCases(),
  measureMs = 400,
  loopWitness = true,
} = {}) {
  if (!base || !output)
    throw new Error('Provide the production fixture URL and a fresh evidence directory');
  await mkdir(output, { recursive: false });
  const sources = [
    'fixtures/integrated.html',
    'fixtures/integrated.js',
    'fixtures/integrated.css',
    'fixtures/combinations.js',
    'gate/integrated.mjs',
    'gate/desktop-site.mjs',
    'gate/runtime-fixes.mjs',
    'src/media/stills.ts',
    'src/input/scroll.ts',
    'src/input/engine.ts',
    'src/elements/scene.ts',
    'src/elements/fixed.ts',
  ];
  for (const source of sources) {
    const dest = join(output, 'source', source);
    await mkdir(join(dest, '..'), { recursive: true });
    await copyFile(source, dest);
  }
  await writeFile(join(output, 'inventory.json'), JSON.stringify(integratedInventory(), null, 2));
  const rows = [];
  for (const engine of engines) {
    if (!['chromium', 'webkit'].includes(engine)) throw new Error(`Unsupported engine ${engine}`);
    const browser = await (engine === 'chromium'
      ? chromium.launch({ channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars'] })
      : webkit.launch());
    try {
      for (const config of cases) {
        const id = `${engine}-${config.layout}-${config.context}`;
        const directory = join(output, id);
        await mkdir(directory);
        const row = {
          id,
          engine,
          version: browser.version(),
          platform: process.platform,
          base,
          config,
          checks: [],
          states: [],
          images: [],
          measurements: [],
          pageErrors: [],
          resources: [],
          coverage: {
            nativeRequested: config.context.endsWith('auto'),
            track: config.layout === 'track',
            ordinary: config.context.startsWith('enter'),
            pageOwned: integratedInventory()
              .filter((i) => i.owner === 'page')
              .map((i) => i.id),
            excluded: [21],
          },
        };
        const check = (ok, label, detail) => row.checks.push({ ok: !!ok, label, detail });
        const fixedCheck = (s, label) => {
          const f = s.fixed,
            keys = ['x', 'y', 'width', 'height'];
          check(
            [f.host, f.layer].every((r) => keys.every((k) => close(r[k], f.shell[k], 0.05))) &&
              f.label.width > 0 &&
              f.label.height > 0 &&
              f.label.x >= f.shell.x &&
              f.label.right <= f.shell.right &&
              f.label.y >= f.shell.y &&
              f.label.bottom <= f.shell.bottom &&
              (s.current !== 1 ||
                (f.label.right > 0 &&
                  f.label.x < s.viewport.width &&
                  f.label.bottom > 0 &&
                  f.label.y < s.viewport.height)),
            `${label}: fixed frame and real label stay in the stationary Scene shell`,
            f
          );
        };
        const imageCheck = (s, label, pending = false, painted = true) => {
          const comparison = imageCopyRegistration(
            s.compare.before,
            s.compare.copy,
            s.compare.after
          );
          check(comparison.consistent, `${label}: comparison images share the frame`, comparison);
          const part = s.imageCopies.find((p) => p.part === (pending ? 'develop' : 'duotone'));
          const registrations =
            part?.items.map((p) => ({
              copy: imageCopyRegistration(
                pending
                  ? {
                      x: p.before.x - p.before.width * 0.075,
                      y: p.before.y - p.before.height * 0.075,
                      width: p.before.width * 1.15,
                      height: p.before.height * 1.15,
                    }
                  : p.before,
                p.copy,
                pending
                  ? {
                      x: p.after.x - p.after.width * 0.075,
                      y: p.after.y - p.after.height * 0.075,
                      width: p.after.width * 1.15,
                      height: p.after.height * 1.15,
                    }
                  : p.after
              ),
              box: imageCopyRegistration(p.before, p.box, p.after),
            })) ?? [];
          check(
            registrations.length === 1 &&
              registrations.every((p) => p.copy.consistent && p.box.consistent),
            `${label}: actual ${pending ? 'stand-in' : 'duotone'} copies remain registered`,
            { part, registrations }
          );
          if (!pending) {
            const ink = part?.items[0];
            check(
              ink?.mode === 'alpha' &&
                ink.inkMode === 'luminance' &&
                ink.dark === 'rgb(29, 24, 20)' &&
                ink.light === 'rgb(212, 103, 63)' &&
                ink.mask.includes('integrated-document-') &&
                ink.inkMask === ink.mask &&
                (!painted || part.opacity > 0),
              `${label}: real image masks carry both duotone inks`,
              part
            );
          }
        };
        const context = await browser.newContext({
          viewport: { width: 1280, height: 800 },
          deviceScaleFactor: 1,
          reducedMotion: 'no-preference',
        });
        const page = await context.newPage();
        page.on('pageerror', (error) => row.pageErrors.push(error.stack));
        page.on('response', (response) => {
          if (response.url().includes('/assets/'))
            row.resources.push({ url: response.url(), status: response.status() });
        });
        await page.addInitScript(INIT);
        let releaseImage;
        const controlled = engine === 'chromium' && config.id === 'grid/zone-fallback';
        if (controlled) {
          const wait = new Promise((resolve) => {
            releaseImage = resolve;
          });
          await page.route('**/integrated-document-*.svg', async (route) => {
            await wait;
            await route.continue();
          });
        }
        const capture = async (label) => {
          await frames(page);
          const s = await read(page);
          row.states.push({ label, ...s });
          return s;
        };
        const shot = async (label) => {
          await frames(page);
          const path = join(directory, `${label}.png`);
          await page.screenshot({ path });
          row.images.push(path);
        };
        const attempt = async (label, fn) => {
          try {
            await fn();
          } catch (error) {
            check(false, label, { error: error.stack });
          }
        };
        try {
          await page.goto(
            `${base}/integrated.html?context=${config.context}&layout=${config.layout}`,
            { waitUntil: 'commit' }
          );
          if (controlled) {
            await page.waitForFunction(() => window.integrated?.state?.stage?.isConnected);
            await page.evaluate(() => integrated.state.stage.ready);
            await page.evaluate(() => {
              integrated.state.stage.pause();
              integrated.goTo(1);
            });
            await frames(page);
            const pending = await capture('image-pending');
            check(
              pending.images.some((i) => i.id === 'pending-image' && !i.complete),
              'pending material is actually pending',
              pending.images
            );
            imageCheck(pending, 'pending material', true);
            check(
              (await page.locator('#comparison').isVisible()) &&
                (await page.locator('#save-example').isVisible()),
              'controls remain visible before the image resolves'
            );
            await shot('pending');
            releaseImage();
          }
          await page.waitForFunction(() => window.integratedReady);
          await page.addStyleTag({
            content:
              'html{overflow-y:scroll;scrollbar-gutter:stable}::-webkit-scrollbar{width:16px}::-webkit-scrollbar-track{background:#ddd}::-webkit-scrollbar-thumb{background:#526b5d;border-radius:4px}',
          });
          await page.evaluate(() => {
            integrated.state.stage.pause();
            integrated.goTo('middle');
          });
          await frames(page);
          const initial = await capture('main-entered');
          fixedCheck(initial, 'entered');
          if (config.layout === 'track') {
            // Two 28px paddings, a 280px header, six 340px modules, a 340px footer, seven 24px gaps.
            const width = 2 * 28 + 280 + 6 * 340 + 340 + 7 * 24;
            check(
              close(initial.sheet.width, width, 0.05) &&
                close(initial.travel, width - initial.scene.width, 1),
              'track overflow matches the independently authored content width',
              { width, sheet: initial.sheet, scene: initial.scene, travel: initial.travel }
            );
          }
          check(
            initial.total === 2400,
            'authored input total is 2400, autonomous clocks do not grow it',
            initial.total
          );
          const windows = {
            A: [100, 500],
            B: [560, 860],
            C: [920, 1120],
            D: [650, 950],
            E: [660, 960],
            F: [0, 2400],
            G: [600, 1800],
            'split-lines': [500, 1160],
            'split-words': [500, 1220],
            'target-labels': [500, 820],
          };
          for (const [id, [start, end]] of Object.entries(windows)) {
            const w = node(initial, id)?.solved;
            check(w?.start === start && w.end === end, `independent authored window ${id}`, {
              expected: [start, end],
              actual: w,
            });
          }
          check(
            node(initial, 'CA').clockSolved.start === 0 &&
              node(initial, 'CA').clockSolved.end === 500 &&
              node(initial, 'CB').clockSolved.start === 400 &&
              node(initial, 'CB').clockSolved.end === 800,
            'clock overlap stays in its own timeline'
          );
          check(
            node(initial, 'split-lines').splitCount === 2 &&
              node(initial, 'split-words').splitCount === 3,
            'actual two lines and three words, not whole-text fallback',
            { lines: node(initial, 'split-lines'), words: node(initial, 'split-words') }
          );
          check(
            await page.evaluate(() => document.fonts.check('16px "Field Mono"')),
            'local variable font has loaded'
          );
          check(
            initial.ditherBlack > 0 && initial.ditherBlack < 48 * 80,
            'Bayer canvas contains both colors',
            initial.ditherBlack
          );
          check(
            node(initial, 'D').layers.some((l) => l.source === 'view') &&
              node(initial, 'D').layers.some((l) => ['scene', 'enter'].includes(l.source)),
            'mixed-source composition retains separate layers'
          );
          check(
            node(initial, 'compass').periods.join(',') === '5000,8000',
            'overlapping loops retain their own periods',
            node(initial, 'compass').periods
          );
          row.coverage.nativeAttached = initial.nodes
            .flatMap((n) => n.layers)
            .filter((l) => l.native).length;
          row.coverage.platform = initial.supported;
          if (
            row.coverage.nativeRequested &&
            initial.supported.viewTimeline &&
            config.context.startsWith('zone')
          )
            check(
              row.coverage.nativeAttached > 0,
              'auto transport actually attaches native layers',
              row.coverage.nativeAttached
            );
          if (!row.coverage.nativeRequested)
            check(
              row.coverage.nativeAttached === 0,
              'explicit fallback/drag has no native scroll layers',
              row.coverage.nativeAttached
            );

          if (config.context.startsWith('zone')) {
            for (const time of [0, 300, 650, 750, 1000, 1400, 1800, 2100, 2300, 2400, 750]) {
              await timeAt(page, time);
              const s = await capture(`time-${time}`);
              const t = clip((s.scrollY - s.docTop) / 2400) * 2400;
              check(
                close(variable(s, 'F', '--chapter'), t / 2400, 0.008),
                'input variable follows actual independent scroll distance',
                { time, t, actual: variable(s, 'F', '--chapter') }
              );
              const a = progress(t, 100, 500) ** 2 * (1 - progress(t, 500, 700));
              check(
                close(Number(layer(s, 'A', 'scene')?.opacity), a, 0.012),
                'fade+rise composition and raw exit',
                { t, expected: a, actual: layer(s, 'A', 'scene') }
              );
              const d = progress(t, 650, 950) * (1 - progress(t, 950, 1150));
              check(
                close(Number(layer(s, 'D', 'scene')?.opacity), d, 0.012),
                'after positive offset, delay, and composed departure',
                { t, expected: d, actual: layer(s, 'D', 'scene') }
              );
              check(
                close(variable(s, 'G', '--scope'), progress(t, 600, 1800), 0.008),
                'at window is distinct from view hue',
                { t, actual: variable(s, 'G', '--scope') }
              );
              if ([650, 750, 1000].includes(time))
                check(
                  s.video?.ready >= 2 &&
                    !s.video.seeking &&
                    close(s.video.time, progress(t, 500, 1500), 0.055),
                  'video seeks to independently authored input time, including reverse',
                  { t, video: s.video }
                );
              if (time === 650) {
                const targets = node(s, 'target-labels').layers;
                check(
                  targets.length === 3 &&
                    targets.every(
                      (l, i) =>
                        l.text === ['A', 'B', 'C'][i] &&
                        l.bounds.width > 0 &&
                        close(Number(l.opacity), progress(t, 500 + i * 60, 700 + i * 60), 0.012)
                    ),
                  'actual target children stagger independently',
                  targets
                );
                const lines = node(s, 'split-lines').layers.filter((l) => l.piece);
                check(
                  lines.length === 2 &&
                    lines.every((l, i) =>
                      close(
                        parseFloat(l.font.match(/wght"?\s+([\d.]+)/)?.[1]),
                        300 + 400 * progress(t, 500 + i * 60, 1100 + i * 60),
                        1
                      )
                    ),
                  'rendered line pieces interpolate the variable font axis',
                  lines
                );
              }
              if (time === 750 || time === 2100) imageCheck(s, `input ${time}`);
              if (time === 2100) {
                const lines = node(s, 'split-lines').layers.filter((l) => l.piece);
                check(
                  lines.length === 2 &&
                    lines.every(
                      (l) =>
                        l.bounds.width > 0 &&
                        l.bounds.height > 0 &&
                        close(parseFloat(l.font.match(/wght"?\s+([\d.]+)/)?.[1]), 700, 1) &&
                        Number(l.opacity) > 0.99
                    ),
                  'completed line pieces retain visible text and final font weight',
                  lines
                );
              }
              if (time === 750) {
                const path = await page.evaluate(() => {
                  const p = document.querySelector('#B path');
                  return {
                    length: p.getTotalLength(),
                    unit: p.getAttribute('pathLength'),
                    dash: parseFloat(getComputedStyle(p).strokeDashoffset),
                    clip: getComputedStyle(
                      document.getElementById('B').layers.find((l) => l.kind === 'clip').el
                    ).clipPath,
                  };
                });
                check(
                  path.length > 300 &&
                    path.unit === '1' &&
                    close(path.dash, 1.001 * (1 - progress(t, 560, 860)), 0.012),
                  'real SVG draw with concurrent wipe',
                  path
                );
                check(
                  close(
                    parseFloat(path.clip.match(/^inset\([^ ]+ ([\d.]+)%/)?.[1]),
                    100 * (1 - progress(t, 560, 860)),
                    0.15
                  ),
                  'actual wipe clips alongside the drawn SVG',
                  path
                );
              }
              if (time === 750 || time === 2100) await shot(`time-${time}-${row.images.length}`);
            }
            if (config.layout === 'track') {
              check(
                initial.travel > 300 && initial.travel < 2400,
                'track has real overflow within authored budget',
                initial.travel
              );
              for (const time of [0, Math.round(initial.travel / 2), initial.travel]) {
                await timeAt(page, time);
                const s = await capture(`track-${time}`);
                const actual = await page.evaluate(
                  () => parseFloat(getComputedStyle(integrated.state.scene.track).translate) || 0
                );
                check(
                  close(actual, -Math.min(Math.max(s.scrollY - s.docTop, 0), s.travel), 1),
                  'track follows actual overflow distance',
                  { time, actual, travel: s.travel }
                );
                if (time === initial.travel)
                  check(
                    close(s.footer.right, initial.scene.width - 28, 1),
                    'track endpoint leaves only authored trailing padding',
                    s.footer
                  );
                fixedCheck(s, `track ${time}`);
                await shot(`track-${time}`);
              }
            } else {
              await timeAt(page, 2100);
              const s = await read(page);
              check(
                s.modules.every((m) => m.x >= 0 && m.right <= 1280 && m.y >= 0 && m.bottom <= 800),
                'all six modules fit the actual PC viewport',
                s.modules
              );
              const fixed = await page.evaluate(() =>
                document
                  .getElementById('fixed-state')
                  .shadowRoot.querySelector('[part=layer]')
                  .getBoundingClientRect()
                  .toJSON()
              );
              check(
                Math.abs(fixed.y) < 1 && fixed.height === 800,
                'Scene fixed frame remains aligned',
                fixed
              );
            }
          } else if (config.context.startsWith('enter')) {
            const admission = initial.clock;
            await page.locator('#case-pause').click();
            await page.waitForFunction(
              (origin) => integrated.state.stage.clock.now() >= origin + 750,
              admission
            );
            await page.locator('#case-pause').click();
            await frames(page);
            const s = await capture('ordinary-after-chain');
            const t = s.clock - admission;
            imageCheck(s, 'ordinary input');
            check(
              close(s.video?.time, progress(t, 500, 1500), 0.075),
              'ordinary video follows the admitted dependency clock',
              { t, video: s.video }
            );
            check(
              close(variable(s, 'F', '--chapter'), t / 2400, 0.035),
              'ordinary dependency chain advances from the admitted root clock',
              { t, chapter: variable(s, 'F', '--chapter') }
            );
            check(
              close(Number(layer(s, 'D', 'enter')?.opacity), progress(t, 650, 950), 0.065),
              'ordinary after overlap uses chain time',
              { t, layer: layer(s, 'D', 'enter') }
            );
            check(
              await page.evaluate(
                () => !document.getElementById('deck').hasAttribute('data-cv-dealt')
              ),
              'ordinary deck uses sticky flow, not dealt cards'
            );
            await shot('ordinary-mid');
            await page.locator('#case-pause').click();
            await page.waitForFunction(
              (origin) => integrated.state.stage.clock.now() >= origin + 2500,
              admission
            );
            await page.locator('#case-pause').click();
            await frames(page);
            check(
              node(await read(page), 'split-lines').splitCount === 2,
              'ordinary completion retains actual split lines'
            );
          } else {
            await page.evaluate(() => integrated.goTo(0));
            await frames(page);
            const incoming = await drag(page, 450, 350);
            row.states.push({ label: 'incoming-held', ...incoming.held });
            fixedCheck(incoming.held, 'held entry');
            check(
              incoming.held.current === 0,
              'held drag remains a preview before release',
              incoming.held.current
            );
            check(
              incoming.released.current === 1,
              'held gesture beyond half-screen commits and completes',
              incoming.released.current
            );
            await page.waitForFunction(
              () => document.getElementById('F').timeline.progress >= 0.9999
            );
            const completed = await capture('incoming-completed');
            fixedCheck(completed, 'completed entry');
            if (config.layout === 'track')
              check(
                close(completed.footer.right, completed.scene.width - 28, 1),
                'completed drag track aligns the final content with authored padding',
                completed.footer
              );
            check(
              close(variable(completed, 'F', '--chapter'), 1, 0.01),
              'drag completion advances element time to the end'
            );
            if (config.layout === 'track') {
              check(
                incoming.held.travel > 300 && incoming.held.travel < 2400,
                'drag track measures real overflow',
                incoming.held.travel
              );
              const x = parseFloat(incoming.held.trackTranslate) || 0;
              check(
                close(x, -Math.min((449 / 800) * 2400, incoming.held.travel), 2),
                'incoming drag drives track on mapped element time',
                { x, travel: incoming.held.travel }
              );
            }
            const canceled = await drag(page, 120, 350);
            row.states.push({ label: 'cancelled', ...canceled.released });
            check(
              canceled.released.current === 1 &&
                canceled.released.events.some((e) => e.type === 'cv-dragcancel'),
              'held short travel cancels and restores current Scene'
            );
            const reversed = await drag(page, -450, 350);
            check(
              reversed.released.current === 0,
              'reverse gesture returns to before Scene',
              reversed.released.current
            );
            await page.evaluate(() => integrated.goTo(1));
            await frames(page);
            await shot('drag-return');
          }

          await attempt('shared subject view, media and custom drawing', async () => {
            if (config.context.startsWith('zone')) await timeAt(page, 750);
            const data = await page.evaluate(() => {
              const r = document.getElementById('material-subject').getBoundingClientRect();
              const a = document.getElementById('view-note');
              const v = document.getElementById('media').video;
              return {
                subject: { top: r.top, height: r.height },
                opacity: Number(getComputedStyle(a.layers[0].el).opacity),
                entry: Number(
                  getComputedStyle(document.getElementById('entry-note').layers[0].el).opacity
                ),
                svg: document.getElementById('drawing-fill').getAttribute('d'),
                video: v
                  ? {
                      time: v.currentTime,
                      ready: v.readyState,
                      duration: v.duration,
                      error: v.error?.message ?? null,
                    }
                  : null,
              };
            });
            check(
              close(
                data.opacity,
                clip((800 - data.subject.top) / (800 + data.subject.height)),
                0.025
              ),
              'shared subject has independently computed view progress',
              data
            );
            check(
              close(
                data.entry,
                clip((800 - data.subject.top) / Math.min(800, data.subject.height)),
                0.025
              ),
              'entry range differs from the shared subject cover range',
              data
            );
            check(
              data.video?.ready >= 2 && data.video.duration > 1 && !data.video.error,
              'real video decoded without media error',
              data.video
            );
            check(
              (await read(page)).subscribedFrames > 0 && data.svg !== 'M1 24H1',
              'custom SVG received actual timeline frames',
              data.svg
            );
          });

          // Early track content in drag is observable during entry; it is not reachable at rest.
          // Test these same controls in the grid and in both scroll-track transports.
          if (!(config.layout === 'track' && config.context === 'drag')) {
            await attempt('comparison native keyboard and pointer', async () => {
              await expose(page, '#comparison', config);
              const before = await read(page);
              await page.locator('#comparison').focus();
              await page.keyboard.press('Home');
              await frames(page);
              check((await read(page)).compare.value === '0', 'range Home reaches zero');
              await page.keyboard.press('End');
              await page.keyboard.press('ArrowLeft');
              await frames(page);
              let s = await read(page);
              check(
                s.compare.value === '99' && s.compare.clip === 'inset(0px 1% 0px 0px)',
                'range End/Left updates aligned clipping',
                s.compare
              );
              const box = await page.locator('#comparison').boundingBox();
              await page.mouse.click(box.x + box.width * 0.4, box.y + box.height / 2);
              await frames(page);
              s = await read(page);
              check(
                Number(s.compare.value) > 20 && Number(s.compare.value) < 60,
                'real pointer changes comparison',
                s.compare
              );
              check(
                s.current === before.current && close(s.scrollY, before.scrollY, 1),
                'range controls do not navigate the Stage',
                { before: before.current, after: s.current, y: s.scrollY }
              );
            });
            await attempt('native gallery and local inertia', async () => {
              await expose(page, '#snap-gallery', config);
              await page.locator('#gallery-next').click();
              await frames(page);
              let s = await read(page);
              check(
                close(s.gallery.left, s.gallery.width, 2),
                'native snap gallery advances one aligned item',
                s.gallery
              );
              await page.locator('#gallery-prev').focus();
              await page.keyboard.press('Enter');
              await frames(page);
              s = await read(page);
              check(s.gallery.left < 2, 'gallery button Enter returns to first item', s.gallery);
              const box = await page.locator('#kinetic-gallery').boundingBox(),
                before = await read(page);
              await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
              await page.mouse.down();
              await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 });
              await page.mouse.up();
              await page.waitForTimeout(300);
              await frames(page);
              s = await read(page);
              check(
                s.gallery.kinetic > 80,
                'local horizontal drag scrolls its own content',
                s.gallery
              );
              check(
                s.current === before.current && close(s.scrollY, before.scrollY, 1),
                'local drag does not move the outer Stage',
                { current: s.current, y: s.scrollY }
              );
            });
          } else
            row.coverage.restingControls =
              'Early track controls tested in grid; drag preview and end geometry only in this layout';

          await attempt('pause, clock and page-owned animation lifecycle', async () => {
            if (config.layout === 'track' && config.context !== 'drag')
              await expose(page, '#framework-pause', config);
            await page.locator('#case-pause').click();
            await frames(page);
            row.measurements.push(
              await sampleMeasure(page, 'active', loopWitness && controlled ? 8100 : measureMs)
            );
            await page.locator('#case-pause').click();
            await frames(page);
            const held = await read(page);
            row.measurements.push(await sampleMeasure(page, 'paused', measureMs));
            const after = await read(page);
            check(
              close(after.clock, held.clock, 0.01) &&
                after.own.every(
                  (a, i) =>
                    a.state === 'paused' && close(Number(a.time), Number(held.own[i].time), 2)
                ),
              'one control pauses the Clock and all page-owned WAAPI',
              {
                held: { clock: held.clock, own: held.own },
                after: { clock: after.clock, own: after.own },
              }
            );
            const rotation = node(held, 'compass').layers[0]?.rotate,
              afterRotation = node(after, 'compass').layers[0]?.rotate;
            check(rotation === afterRotation, 'overlapping loop rotation holds while paused', {
              rotation,
              afterRotation,
            });
            check(
              held.video?.paused &&
                after.video?.paused &&
                close(after.video.time, held.video.time, 0.055),
              'mapped video holds with unchanged input during pause',
              { before: held.video, after: after.video }
            );
            await page.locator('#case-pause').click();
            await frames(page);
            row.measurements.push(await sampleMeasure(page, 'resumed', measureMs));
            const resumed = await read(page);
            check(
              resumed.clock > after.clock + 50 && resumed.own.every((a) => a.state === 'running'),
              'resume advances Clock and page-owned motion'
            );
            const active = row.measurements.find((m) => m.phase === 'active');
            check(
              active.after.own.every(
                (a, i) => Number(a.time) > Number(active.before.own[i].time) + 50
              ) &&
                active.after.compass.layers[0]?.rotate !==
                  active.before.compass.layers[0]?.rotate &&
                resumed.own.every((a, i) => Number(a.time) > Number(after.own[i].time) + 50),
              'running loops and page-owned animations actually advance',
              active
            );
            await page.locator('#case-pause').click();
            await frames(page);
            if (config.layout !== 'track' || config.context !== 'drag') {
              await page.locator('#framework-pause').focus();
              await page.keyboard.press('Enter');
              await frames(page);
              check(!(await read(page)).paused, 'cv-pause keyboard resumes the same Stage');
              await page.keyboard.press('Space');
              await frames(page);
              check((await read(page)).paused, 'cv-pause Space pauses the same Stage');
            }
          });

          await attempt('navigation, departure, reverse and return', async () => {
            if (config.context === 'drag') {
              await page.locator('cv-stage').focus();
              await page.keyboard.press('End');
              await page.waitForTimeout(1000);
              await frames(page);
              check(
                (await read(page)).current === 2,
                'drag keyboard End navigates to actual after content'
              );
              await page.keyboard.press('Home');
              await page.waitForTimeout(1000);
              await frames(page);
              check((await read(page)).current === 0, 'drag keyboard Home returns to before');
            } else {
              await page.evaluate(() => document.activeElement?.blur());
              await page.mouse.move(1200, 400);
              await page.mouse.wheel(0, 10000);
              await page.waitForTimeout(200);
              await frames(page);
              check((await read(page)).current === 2, 'large wheel moves to after Scene');
              await page.mouse.wheel(0, -10000);
              await page.waitForTimeout(200);
              await frames(page);
              check((await read(page)).current === 0, 'large reverse wheel returns to before');
              await page.evaluate(() => {
                document.body.tabIndex = -1;
                document.body.focus({ preventScroll: true });
              });
              await page.keyboard.press('End');
              await page.waitForFunction(
                () => scrollY >= document.documentElement.scrollHeight - innerHeight - 8
              );
              await frames(page);
              const end = await capture('keyboard-end');
              check(end.current === 2, 'document keyboard End reaches after', {
                y: end.scrollY,
                current: end.current,
              });
              await page.keyboard.press('Home');
              await page.waitForFunction(() => scrollY <= 1);
              await frames(page);
              const home = await capture('keyboard-home');
              check(home.current === 0, 'document keyboard Home returns', {
                y: home.scrollY,
                current: home.current,
              });
              await page.evaluate(() => integrated.goTo(1));
              await frames(page);
              const forward = await scrollThumb(page, 100),
                reverse = await scrollThumb(page, -100);
              row.scrollbar = { forward, reverse };
              check(
                forward.after > forward.before.y + 50 && reverse.after < reverse.before.y - 50,
                'actual scrollbar thumb moves forward and backward',
                row.scrollbar
              );
            }
            await page.evaluate(() => integrated.goTo(2));
            await frames(page);
            const left = await capture('departed');
            row.measurements.push(await sampleMeasure(page, 'departed', measureMs));
            check(
              left.own.every((a) => a.state === 'paused') && !node(left, 'compass').looping,
              'departure pauses authored motion and releases covered loops',
              left.own
            );
            check(
              await page.locator('#after h2').isVisible(),
              'after Scene contains actual readable content'
            );
            await page.evaluate(() => integrated.goTo(1));
            await frames(page);
            const returned = await capture('returned');
            fixedCheck(returned, 'returned');
            imageCheck(returned, 'returned material', false, config.context === 'drag');
            if (config.context.startsWith('zone')) {
              check(
                close(
                  returned.imageCopies.find((p) => p.part === 'duotone').opacity,
                  progress(returned.scrollY - returned.docTop, 500, 1100),
                  0.012
                ),
                'return restores duotone to the independently authored input position',
                { y: returned.scrollY, top: returned.docTop, copies: returned.imageCopies }
              );
              // Reacquisition decodes asynchronously, especially after WebKit releases a covered Scene.
              await timeAt(page, 1000);
              await page.waitForFunction(
                () => document.getElementById('media').video?.readyState >= 2
              );
              await frames(page);
              const media = await capture('returned-video');
              check(
                close(media.video.time, progress(media.scrollY - media.docTop, 500, 1500), 0.055),
                'return restores decoded video to the authored input position',
                media.video
              );
            }
            check(
              returned.current === 1 && returned.theme === 'middle',
              'return restores current Scene and complete palette',
              returned.theme
            );
            await shot('returned');
            await expose(page, '#save-example', config);
            await page.locator('#save-example').click();
            check((await read(page)).saved, 'primary action stays available');
          });
          row.inputEpisodes = [{ language: 'en', ...(await read(page)) }];
          if (config.id === 'grid/zone-fallback')
            await attempt('reduced motion and bilingual controls', async () => {
              await page.emulateMedia({ reducedMotion: 'reduce' });
              await page.waitForTimeout(180);
              await frames(page);
              const s = await read(page);
              check(
                s.own.every((a) => a.state === 'paused'),
                'page-owned motion follows a changed reduced-motion preference',
                s.own
              );
              check(
                await page.locator('#comparison').isVisible(),
                'reduced presentation retains comparison control'
              );
              await shot('reduced');
              await page.locator('#case-language').click();
              await page.waitForFunction(
                () => integrated.state.language === 'zh-CN' && integratedReady
              );
              await frames(page);
              check(
                (await page.locator('h1').allTextContents()).some((t) => t.includes('资料')),
                'Chinese labels are actual rendered text'
              );
              await page.evaluate(() => integrated.goTo(1));
              await frames(page);
              await shot('chinese');
            });
          const final = await read(page);
          if (final.language !== 'en')
            row.inputEpisodes.push({ language: final.language, ...final });
          const errors = row.inputEpisodes.flatMap((s) => s.errors);
          check(
            errors.length === 0 && row.pageErrors.length === 0,
            'no authoring or uncaught runtime errors',
            { errors, pageErrors: row.pageErrors }
          );
          row.finalErrors = errors;
          row.finalInputs = row.inputEpisodes.flatMap((s) => s.inputs);
          row.finalEvents = row.inputEpisodes.flatMap((s) => s.events);
          check(
            row.finalInputs.some(
              (i) => i.trusted && ['pointerdown', 'wheel', 'keydown'].includes(i.type)
            ),
            'trusted input was actually captured'
          );
        } catch (error) {
          row.error = error.stack;
        } finally {
          releaseImage?.();
          try {
            await page.evaluate(() => {
              integrated.dispose();
            });
            await frames(page);
            row.cleanup = await page.evaluate(() => ({
              nodes: document.getElementById('root').querySelectorAll('*').length,
              animations: document.getAnimations().length,
              controls: document.getElementById('case-controls').childElementCount,
              disposed: integrated.state.disposed,
              localRaf: integrated.state.localRaf,
            }));
            check(
              row.cleanup.nodes === 0 &&
                row.cleanup.animations === 0 &&
                row.cleanup.controls === 0 &&
                row.cleanup.disposed &&
                row.cleanup.localRaf === 0,
              'owned content, animations, controls and local work are disposed',
              row.cleanup
            );
          } catch (error) {
            row.cleanupError = error.stack;
          }
          await context.close();
          row.pass =
            !row.error &&
            !row.cleanupError &&
            !row.pageErrors.length &&
            row.checks.every((c) => c.ok);
          rows.push(row);
          await writeFile(join(directory, 'result.json'), JSON.stringify(row, null, 2));
          await writeFile(join(output, 'results.json'), JSON.stringify(rows, null, 2));
          console.log(
            `${row.pass ? 'PASS' : 'FAIL'} ${id} ${row.checks.filter((c) => c.ok).length}/${row.checks.length}`
          );
        }
      }
    } finally {
      await browser.close();
    }
  }
  const sourceChanges = [];
  for (const file of sources)
    if (!(await readFile(file)).equals(await readFile(join(output, 'source', file))))
      sourceChanges.push(file);
  const summary = {
    rows: rows.length,
    passed: rows.filter((r) => r.pass).length,
    checks: rows.reduce((n, r) => n + r.checks.length, 0),
    failed: rows
      .filter((r) => !r.pass)
      .map((r) => ({
        id: r.id,
        error: r.error,
        checks: r.checks.filter((c) => !c.ok),
        cleanupError: r.cleanupError,
        pageErrors: r.pageErrors,
      })),
    sourceChanges,
    scope:
      'One authored case; native attachments and raw callback cadence recorded separately from displayed frames, general performance or physical-device acceptance.',
  };
  await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}
