import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runFxOwners } from './fx-owners.mjs';
import { runFxRangeOwners } from './fx-range-owners.mjs';
const launchers = { chromium, webkit },
  clamp = (n) => Math.min(1, Math.max(0, n));
// Fixed desktop fixture viewport; transformed images may extend beyond their clip frame.
const visibleInFrame = (r, frame) =>
  [r.x, r.y, r.width, r.height, frame.x, frame.y, frame.width, frame.height].every(
    Number.isFinite
  ) &&
  r.width > 0 &&
  r.height > 0 &&
  frame.width > 0 &&
  frame.height > 0 &&
  Math.min(1280, r.x + r.width, frame.x + frame.width) > Math.max(0, r.x, frame.x) &&
  Math.min(800, r.y + r.height, frame.y + frame.height) > Math.max(0, r.y, frame.y);

/** Live sequential-read consistency; stationary reads retain the strict .05px margin. */
export function imageCopyRegistration(before, copy, after) {
  const keys = ['x', 'y', 'width', 'height'];
  const finite = [before, copy, after].every((r) => keys.every((key) => Number.isFinite(r[key])));
  const positive = finite && [before, copy, after].every((r) => r.width > 0 && r.height > 0);
  if (!finite)
    return { finite, positive, direct: null, movement: null, outside: null, consistent: false };
  const direct = Math.max(...keys.map((key) => Math.abs(copy[key] - before[key])));
  const movement = Math.max(...keys.map((key) => Math.abs(after[key] - before[key])));
  const outside = Math.max(
    ...keys.map((key) =>
      Math.max(
        Math.min(before[key], after[key]) - copy[key],
        copy[key] - Math.max(before[key], after[key]),
        0
      )
    )
  );
  return { finite, positive, direct, movement, outside, consistent: positive && outside < 0.05 };
}
const frames = (page) =>
  page.evaluate(
    () =>
      new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))
      )
  );
async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Runtime fixture readiness timeout')), 30000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const read = (page) =>
  page.evaluate(() => {
    const stage = document.querySelector('cv-stage');
    const nodes = [...document.querySelectorAll('#middle cv-animate')].map((a) => {
      const layers = [...new Set(a.layers.map((l) => l.el))],
        styles = layers.map((el) => getComputedStyle(el));
      return {
        id: a.id,
        phase: a.timeline.phase,
        progress: a.timeline.progress,
        source: a.timeline.source,
        opacity: styles.reduce((v, s) => v * +s.opacity, 1),
        bounds: a.getBoundingClientRect().toJSON(),
        pieces: a.layers
          .filter((l) => l.piece)
          .filter((l, i, all) => all.findIndex((v) => v.el === l.el) === i)
          .map((l) => ({ opacity: +getComputedStyle(l.el).opacity })),
        loop: a.loopLayer
          ? {
              opacity: +getComputedStyle(a.loopLayer.el).opacity,
              scale: +getComputedStyle(a.loopLayer.el).scale,
              translate: getComputedStyle(a.loopLayer.el).translate,
              rotate: getComputedStyle(a.loopLayer.el).rotate,
              active: a.looping,
            }
          : null,
      };
    });
    return {
      time: stage.clock.now(),
      current: stage.current,
      scrollY,
      total: document.querySelector('#middle')?.solution.total ?? 0,
      errors: bench.snapshot().errors,
      nodes,
    };
  });

/** Exact loop/range formulas plus autonomous-clock and dependency lifecycle browser acceptance. */
export async function runRuntimeFixes({
  base = 'http://127.0.0.1:4383',
  output = 'review/v2-runtime-fixes-20261016/browser',
  engines = ['chromium', 'webkit'],
  groups = ['loops', 'clock', 'after', 'exit', 'ranges'],
} = {}) {
  await mkdir(output, { recursive: true });
  const rows = [];
  for (const engine of engines) {
    const browser = await launchers[engine].launch(
      engine === 'chromium' ? { channel: 'chrome' } : {}
    );
    try {
      for (const group of groups)
        for (const context of ['decl-after', 'drag-entry-cancel', 'lp-drag-details'].includes(group)
          ? ['drag']
          : ['after', 'after-roots', 'exit'].includes(group)
            ? ['enter-auto', 'enter-fallback']
            : ['drag', 'zone-auto', 'zone-fallback', 'enter-auto', 'enter-fallback']) {
          const page = await browser.newPage({
            viewport: { width: 1280, height: 800 },
            hasTouch: false,
          });
          const row = {
            engine,
            version: browser.version(),
            base,
            group,
            context,
            checks: [],
            samples: [],
            pageErrors: [],
          };
          const check = (ok, label, detail) =>
            row.checks.push({ ok: !!ok, label, ...(ok ? {} : { detail }) });
          page.on('pageerror', (e) => row.pageErrors.push(e.message));
          const mount = async (variant, extra = {}) => {
            await bounded(
              page.evaluate((c) => bench.mount(c), { ids: [], context, variant, ...extra })
            );
          };
          const take = async () => {
            const s = await read(page);
            row.samples.push(s);
            return s;
          };
          try {
            await page.goto(`${base}/combinations.html`);
            await page.waitForFunction(() => window.fixtureReady);
            if (group === 'loops') {
              for (const reverse of [false, true]) {
                await mount('loop-overlap', { reverse, manualClock: true });
                await page.evaluate(() => bench.goTo('middle'));
                await page.waitForFunction(() => document.querySelector('#pair').looping);
                for (const t of [0, 250, 500, 750, 1000, 1500]) {
                  await page.evaluate((t) => (window.fixtureClockTime = t), t);
                  await frames(page);
                  const s = await take(),
                    loop = s.nodes[0].loop,
                    p = (t % 1000) / 1000,
                    triangle = p <= 0.5 ? p * 2 : (1 - p) * 2;
                  check(
                    Math.abs(loop.opacity - (1 - 0.4 * triangle) * (1 - 0.6 * triangle)) < 0.015,
                    'loop opacity multiplies',
                    { t, reverse, loop }
                  );
                  check(
                    Math.abs(loop.scale - (1 + 0.04 * triangle) * (1 + 0.08 * triangle)) < 0.015,
                    'loop scales multiply',
                    { t, reverse, loop }
                  );
                  const y = loop.translate.match(/[-\d.]+/g)?.map(Number)?.[1] ?? 0;
                  check(Math.abs(y + 24 * triangle) < 0.03, 'loop translations add', {
                    t,
                    reverse,
                    loop,
                  });
                }
              }
              await mount('loop-overlap');
              await page.evaluate(() => bench.goTo('middle'));
              await page.waitForTimeout(180);
              await page.evaluate(() => bench.pause());
              await frames(page);
              const held = await take();
              await page.waitForTimeout(200);
              const still = await take();
              check(
                JSON.stringify(held.nodes[0].loop) === JSON.stringify(still.nodes[0].loop),
                'composed loop holds under Stage pause'
              );
              await page.evaluate(() => bench.play());
              await page.waitForTimeout(180);
              const resumed = await take();
              check(
                Math.abs(resumed.nodes[0].loop.opacity - still.nodes[0].loop.opacity) > 0.02,
                'loop resumes after pause'
              );
            } else if (group === 'loop-periods') {
              row.profileId = 'AUTH-LOOP-OWN-PERIODS';
              row.periods = [];
              const rotationOf = (loop) =>
                loop?.rotate === 'none' ? 0 : Number.parseFloat(loop?.rotate);
              const setLoops = (reverse = false) =>
                page.evaluate((reverse) => {
                  const a = document.querySelector('#pair');
                  a.setAttribute('loop', reverse ? 'spin, sway' : 'sway, spin');
                  a.removeAttribute('loop-duration');
                }, reverse);
              for (const reverse of [false, true]) {
                await mount('loop-overlap', { manualClock: true });
                await setLoops(reverse);
                await frames(page);
                await page.evaluate(() => bench.goTo('middle'));
                await page.waitForFunction(() => document.querySelector('#pair').looping);
                const periods = await page.evaluate(() =>
                  document.querySelector('#pair').loopItems.map((item) => item.duration)
                );
                row.periods.push({ reverse, periods });
                check(
                  JSON.stringify(periods) === JSON.stringify(reverse ? [8000, 5000] : [5000, 8000]),
                  'each loop retains its own default period',
                  { reverse, periods }
                );
                // Authored sway is linear between [0, 3, 0, -3, 0] over 5000ms;
                // spin adds 360 degrees over 8000ms. Do not use the runtime evaluator as oracle.
                for (const [t, expected] of [
                  [625, 29.625],
                  [1250, 59.25],
                  [1875, 85.875],
                  [3125, 139.125],
                  [4375, 195.375],
                  [5000, 225],
                  [10000, 90],
                ]) {
                  await page.evaluate((t) => (window.fixtureClockTime = t), t);
                  await frames(page);
                  const s = await take(),
                    loop = s.nodes[0].loop,
                    angle = rotationOf(loop);
                  check(
                    loop?.active && Math.abs(angle - expected) < 0.03,
                    'own-period rotations add',
                    {
                      t,
                      reverse,
                      expected,
                      loop,
                    }
                  );
                }
              }
              // A fresh mount restores the real Clock for lifecycle checks.
              await mount('loop-overlap');
              await setLoops();
              await frames(page);
              await page.evaluate(() => bench.goTo('middle'));
              await page.waitForFunction(() => document.querySelector('#pair').looping);
              await page.waitForTimeout(180);
              await page.evaluate(() => bench.pause());
              await frames(page);
              const held = await take();
              await page.waitForTimeout(200);
              const still = await take();
              check(
                held.nodes[0].loop?.active &&
                  still.nodes[0].loop?.active &&
                  Number.isFinite(rotationOf(held.nodes[0].loop)) &&
                  Number.isFinite(rotationOf(still.nodes[0].loop)) &&
                  held.nodes[0].loop.rotate === still.nodes[0].loop.rotate,
                'own-period loop holds under Stage pause',
                { held, still }
              );
              await page.evaluate(() => bench.play());
              await page.waitForTimeout(180);
              const resumed = await take();
              check(
                resumed.nodes[0].loop?.active &&
                  Number.isFinite(rotationOf(resumed.nodes[0].loop)) &&
                  Number.isFinite(rotationOf(still.nodes[0].loop)) &&
                  Math.abs(rotationOf(resumed.nodes[0].loop) - rotationOf(still.nodes[0].loop)) > 1,
                'own-period loop resumes on the real Clock',
                { still, resumed }
              );
              const errors = row.samples.flatMap((s) => s.errors);
              check(!errors.length, 'no cv-error across own-period mounts', errors);
            } else if (group === 'loop-owners') {
              row.profileId = 'AUTH-LAST-OWNER-CLIP-VAR';
              row.outputs = [];
              for (const reverse of [false, true]) {
                await mount('loop-overlap', { manualClock: true });
                await page.evaluate((reverse) => {
                  const a = document.querySelector('#pair'),
                    items = ['hue(90deg)', 'wipe(left)', 'hue(180deg)', 'wipe(right)'];
                  a.setAttribute('loop', (reverse ? items.reverse() : items).join(', '));
                  a.setAttribute('loop-duration', '1000');
                  a.firstElementChild.innerHTML =
                    'Loop output <span id="loop-consumer" style="display:block;width:20px;height:20px;background:black;transform:rotate(var(--cv-hue,0deg))"></span>';
                }, reverse);
                await frames(page);
                await page.evaluate(() => bench.goTo('middle'));
                await page.waitForFunction(() => document.querySelector('#pair').looping);
                for (const [t, fraction] of [
                  [125, 0.25],
                  [250, 0.5],
                  [500, 1],
                  [750, 0.5],
                  [1000, 0],
                ]) {
                  await page.evaluate((t) => (window.fixtureClockTime = t), t);
                  await frames(page);
                  const state = await take(),
                    output = await page.evaluate(() => {
                      const a = document.querySelector('#pair'),
                        style = getComputedStyle(a.loopLayer.el),
                        subject = a.firstElementChild,
                        bounds = subject.getBoundingClientRect(),
                        matrix = new DOMMatrixReadOnly(
                          getComputedStyle(document.querySelector('#loop-consumer')).transform
                        );
                      return {
                        active: a.looping,
                        hue: style.getPropertyValue('--cv-hue'),
                        clip: style.clipPath,
                        matrix: [matrix.a, matrix.b, matrix.c, matrix.d],
                        bounds: bounds.toJSON(),
                        hits: [0.125, 0.875].map((x) =>
                          subject.contains(
                            document.elementFromPoint(
                              bounds.left + bounds.width * x,
                              bounds.top + bounds.height / 2
                            )
                          )
                        ),
                      };
                    }),
                    expectedHue = (reverse ? 90 : 180) * fraction,
                    radians = (expectedHue * Math.PI) / 180,
                    expectedMatrix = [
                      Math.cos(radians),
                      Math.sin(radians),
                      -Math.sin(radians),
                      Math.cos(radians),
                    ],
                    inset = 100 * (1 - fraction),
                    expectedClip = reverse ? [0, inset, 0, 0] : [0, 0, 0, inset],
                    numbers = output.clip.match(/[-\d.]+/g)?.map(Number) ?? [],
                    actualClip = [
                      numbers[0],
                      numbers[1] ?? numbers[0],
                      numbers[2] ?? numbers[0],
                      numbers[3] ?? numbers[1] ?? numbers[0],
                    ],
                    expectedHits = [
                      fraction === 1 || (fraction > 0 && reverse),
                      fraction === 1 || (fraction > 0 && !reverse),
                    ];
                  row.outputs.push({
                    t,
                    reverse,
                    ...output,
                    expectedHue,
                    expectedClip,
                    expectedHits,
                  });
                  check(
                    state.nodes[0].loop?.active &&
                      output.active &&
                      Math.abs(Number.parseFloat(output.hue) - expectedHue) < 0.03,
                    'later loop owns the same-name variable',
                    { t, reverse, expectedHue, output }
                  );
                  check(
                    output.matrix.every((n, i) => Math.abs(n - expectedMatrix[i]) < 0.005),
                    'author child consumes the inherited loop variable',
                    { t, reverse, expectedMatrix, output }
                  );
                  check(
                    output.clip.startsWith('inset(') &&
                      actualClip.every((n, i) => Math.abs(n - expectedClip[i]) < 0.03),
                    'later loop owns the clip inset',
                    { t, reverse, expectedClip, output }
                  );
                  check(
                    output.bounds.width > 0 &&
                      output.bounds.height > 0 &&
                      output.bounds.left >= 0 &&
                      output.bounds.right <= 1280 &&
                      output.bounds.top >= 0 &&
                      output.bounds.bottom <= 800 &&
                      output.hits.every((hit, i) => hit === expectedHits[i]),
                    'clip excludes the hidden region from hit testing',
                    { t, reverse, expectedHits, output }
                  );
                }
              }
              const errors = row.samples.flatMap((s) => s.errors);
              check(!errors.length, 'no cv-error across loop-owner mounts', errors);
            } else if (group === 'fx-range-owners') {
              await runFxRangeOwners({ page, row, check, frames, bounded, output });
            } else if (group === 'fx-owners') {
              await runFxOwners({ page, row, check, frames, bounded, output });
            } else if (group === 'source-order') {
              row.profileId = 'AUTH-SOURCE-ORDER-MATRIX';
              const enter = context.startsWith('enter-'),
                zone = context.startsWith('zone-'),
                near = (a, b, tolerance = 0.75) =>
                  Number.isFinite(a) && Math.abs(a - b) <= tolerance,
                initialByOrder = [];
              row.authoring = {
                fx: ['push(1.6,1.2,25% 75%)', 'drift(80px)'],
                duration: 4000,
                ease: 'linear',
                box: [320, 200],
                origin: [80, 150],
              };
              await page.emulateMedia({ reducedMotion: 'no-preference' });
              for (const reverse of [false, true]) {
                await bounded(
                  page.evaluate(
                    async ({ context, enter, reverse }) => {
                      history.replaceState(null, '', location.pathname + location.search);
                      const ready = bench.mount({ ids: [], context, variant: 'mixed-source' }),
                        stage = document.querySelector('cv-stage'),
                        a = document.querySelector('#A');
                      if (context === 'drag') {
                        stage.setAttribute('unit', 'percent');
                        stage.setAttribute('scale', '1');
                      }
                      if (enter) stage.pause();
                      a.setAttribute(
                        'fx',
                        reverse
                          ? 'drift(80px), push(1.6,1.2,25% 75%)'
                          : 'push(1.6,1.2,25% 75%), drift(80px)'
                      );
                      a.setAttribute('duration', '4000');
                      a.setAttribute('ease', 'linear');
                      a.style.cssText =
                        'position:absolute;left:240px;top:200px;width:320px;height:200px;margin:0;padding:0;border:0';
                      a.firstElementChild.style.cssText =
                        'display:block;width:320px;height:200px;margin:0;padding:0;border:0';
                      document.querySelector('#middle .sheet').style.cssText =
                        'display:flow-root;position:relative;padding:0;margin:0;border:0;height:800px;min-height:800px';
                      await ready;
                    },
                    { context, enter, reverse }
                  )
                );
                await frames(page);
                const documentTop = await page.evaluate(
                  () => document.querySelector('#middle').getBoundingClientRect().top + scrollY
                );
                const capture = async (u, v, tag, measuredScale = null) => {
                  const state = await page.evaluate(() => {
                    const a = document.querySelector('#A'),
                      stage = document.querySelector('cv-stage'),
                      physical = [...a.shadowRoot.querySelectorAll('[part~="layer"]')];
                    return {
                      base: a.getBoundingClientRect().toJSON(),
                      probe: a.firstElementChild.getBoundingClientRect().toJSON(),
                      scene: document.querySelector('#middle').getBoundingClientRect().toJSON(),
                      scrollY,
                      current: stage.current,
                      stageHeight: stage.clientHeight,
                      paused: stage.paused,
                      clock: stage.clock.now(),
                      frame: { ...a.timeline.frame },
                      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
                      nested: physical.length === 2 && physical[0].contains(physical[1]),
                      details: physical.map((el) => {
                        const css = getComputedStyle(el);
                        return {
                          part: el.getAttribute('part'),
                          scale: css.scale,
                          translate: css.translate,
                          origin: css.transformOrigin,
                          transform: css.transform,
                          rotate: css.rotate,
                        };
                      }),
                      sources: a.layers.map((l) => l.source),
                      native: a.layers.map((l) => ({ source: l.source, attached: !!l.native })),
                      errors: bench.snapshot().errors,
                    };
                  });
                  const scale = measuredScale ?? 1.6 - 0.4 * u,
                    translation = -80 + 160 * v,
                    expected = [
                      scale,
                      0,
                      0,
                      scale,
                      80 * (1 - scale),
                      150 * (1 - scale) + translation,
                    ],
                    swapped = [...expected];
                  swapped[5] = 150 * (1 - scale) + scale * translation;
                  const actual = [
                    state.probe.width / 320,
                    0,
                    0,
                    state.probe.height / 200,
                    state.probe.left - state.base.left,
                    state.probe.top - state.base.top,
                  ];
                  Object.assign(state, {
                    reverse,
                    tag,
                    u,
                    v,
                    scale,
                    translation,
                    actual,
                    expected,
                    swapped,
                    scaleOracle: measuredScale === null ? 'authored' : 'measured-factor',
                  });
                  row.samples.push(state);
                  check(
                    !state.reduced && near(state.base.width, 320) && near(state.base.height, 200),
                    'untransformed authored base box remains fixed',
                    state
                  );
                  check(
                    actual.every((n, i) => near(n, expected[i], i === 0 || i === 3 ? 0.003 : 0.75)),
                    'browser output matches independently composed view-outside-time matrix',
                    state
                  );
                  check(
                    state.nested &&
                      state.details[0]?.part === 'layer space' &&
                      state.details[1]?.part === 'layer time' &&
                      state.sources.join(',') === (enter ? 'view,enter' : 'view,scene'),
                    'natural sources retain canonical physical nesting',
                    state
                  );
                  const time = state.details[1],
                    space = state.details[0],
                    origin = time?.origin.split(/\s+/).map(Number.parseFloat) ?? [],
                    xy =
                      space?.translate === 'none'
                        ? [0, 0]
                        : (space?.translate.split(/\s+/).map(Number.parseFloat) ?? []);
                  check(
                    state.details.every((d) => d.transform === 'none' && d.rotate === 'none') &&
                      near(Number.parseFloat(time?.scale), scale, 0.003) &&
                      near(origin[0], 80, 0.01) &&
                      near(origin[1], 150, 0.01) &&
                      xy.length > 0 &&
                      near(xy[0], 0) &&
                      near(xy[1] ?? 0, translation),
                    'individual CSS factors and noncentral origin match the authored composition',
                    state
                  );
                  if (Math.abs((scale - 1) * translation) > 3)
                    check(
                      Math.abs(actual[5] - swapped[5]) > 2,
                      'actual geometry excludes the swapped noncommuting order',
                      state
                    );
                  return state;
                };
                const initial = [];
                if (context === 'drag') {
                  await page.mouse.move(1100, 760);
                  await page.mouse.down();
                  try {
                    await page.mouse.move(1100, 759);
                    await frames(page);
                    for (const fraction of [0.25, 0.5, 0.75, 0.5, 0.25]) {
                      await page.mouse.move(1100, 759 - 800 * fraction);
                      await frames(page);
                      const state = await capture(fraction, fraction / 2, `fraction=${fraction}`);
                      initial.push(state.actual);
                      check(
                        state.stageHeight === 800 &&
                          state.current === 0 &&
                          near(state.scene.top, 800 * (1 - fraction)) &&
                          near(state.scene.height, 800) &&
                          state.frame.source === 'gesture' &&
                          near(state.frame.progress, fraction, 0.002),
                        'held drag independently supplies time and Scene geometry',
                        state
                      );
                    }
                    await page.waitForTimeout(350);
                  } finally {
                    await page.mouse.up();
                  }
                } else if (zone) {
                  for (const fraction of [0.25, 0.5, 0.75, 0.5, 0.25]) {
                    await page.evaluate((y) => scrollTo(0, y), documentTop + 4000 * fraction);
                    await frames(page);
                    const state = await capture(
                      fraction,
                      (800 + 4000 * fraction) / 5600,
                      `fraction=${fraction}`
                    );
                    initial.push(state.actual);
                    check(
                      near(state.scrollY, documentTop + 4000 * fraction) &&
                        near(state.scene.top, -4000 * fraction) &&
                        near(state.scene.height, 4800) &&
                        state.frame.source === 'scroll' &&
                        near(state.frame.progress, fraction, 0.002),
                      'zone uses authored time and the whole extended Scene for view progress',
                      state
                    );
                  }
                } else {
                  await page.evaluate((y) => scrollTo(0, y), documentTop - 300);
                  await page.waitForFunction(
                    () => document.querySelector('#A').timeline.phase === 'entering'
                  );
                  await frames(page);
                  const positions = async (measuredScale = null) => {
                    for (const top of [300, 200, 100, 200, 300]) {
                      await page.evaluate((y) => scrollTo(0, y), documentTop - top);
                      await frames(page);
                      const state = await capture(
                        measuredScale === null ? 0 : null,
                        (800 - top) / 1600,
                        `${measuredScale === null ? 'held-zero' : 'held-played'}/top=${top}`,
                        measuredScale
                      );
                      if (measuredScale === null) initial.push(state.actual);
                      check(
                        state.paused &&
                          near(state.scene.top, top) &&
                          near(state.scene.height, 800) &&
                          state.frame.source === 'visibility' &&
                          (measuredScale !== null || near(state.frame.progress, 0, 0.002)),
                        'ordinary entrance holds time while view passage moves in both directions',
                        state
                      );
                    }
                  };
                  await positions();
                  await page.evaluate(() => document.querySelector('cv-stage').play());
                  await page.waitForFunction(
                    () => document.querySelector('#A').timeline.progress >= 0.25,
                    null,
                    { timeout: 6000 }
                  );
                  await page.evaluate(() => document.querySelector('cv-stage').pause());
                  await frames(page);
                  const measuredScale = await page.evaluate(() =>
                    Number.parseFloat(
                      getComputedStyle(
                        document.querySelector('#A').shadowRoot.querySelector('[part="layer time"]')
                      ).scale
                    )
                  );
                  check(
                    measuredScale >= 1.19 && measuredScale < 1.57,
                    'played entrance supplies a nonidentity held scale factor',
                    measuredScale
                  );
                  await positions(measuredScale);
                }
                initialByOrder.push(initial);
                const discriminating = row.samples.filter(
                  (s) => s.reverse === reverse && Math.abs((s.scale - 1) * s.translation) > 3
                );
                check(
                  discriminating.length >= 3,
                  'each declaration order has discriminating geometry samples'
                );
              }
              check(
                initialByOrder[0].length === 5 &&
                  initialByOrder[1].length === 5 &&
                  initialByOrder[0].every((matrix, j) =>
                    matrix.every((n, i) =>
                      near(n, initialByOrder[1][j][i], i === 0 || i === 3 ? 0.003 : 0.75)
                    )
                  ),
                'declaration reversal preserves equal authored-state output',
                initialByOrder
              );
              const requested =
                context === 'zone-auto'
                  ? ['view', 'scene']
                  : context === 'enter-auto'
                    ? ['view']
                    : [];
              row.nativeCoverage = {
                requested,
                available: requested.length
                  ? requested.every((source) =>
                      row.samples.every((s) =>
                        s.native?.some((l) => l.source === source && l.attached)
                      )
                    )
                  : null,
              };
              const errors = row.samples.flatMap((s) => s.errors ?? []);
              check(!errors.length, 'no cv-error across source-order mounts', errors);
            } else if (group === 'range-keys') {
              row.profileId = 'AUTH-RANGE-KEYBOARD-ISOLATION';
              const keys = [
                ['ArrowRight', 51],
                ['ArrowLeft', 50],
                ['Home', 0],
                ['End', 100],
                ['ArrowLeft', 99],
                ['Home', 0],
                ['ArrowRight', 1],
              ];
              // This document has no runtime, so platform behavior is observed independently.
              await page.goto('about:blank');
              await page.setContent(
                '<!doctype html><html><body style="margin:0"><div style="height:2400px;padding-top:900px;box-sizing:border-box"><label for="native-range">Compare images</label><input id="native-range" type="range" min="0" max="100" value="50"></div></body></html>'
              );
              await page.evaluate(() => {
                scrollTo(0, 800);
                document.querySelector('input').focus();
              });
              await frames(page);
              const nativeStart = await page.evaluate(() => ({
                scrollY,
                value: +document.querySelector('input').value,
                noRuntime: typeof bench === 'undefined' && !document.querySelector('cv-stage'),
              }));
              check(
                nativeStart.noRuntime && nativeStart.scrollY === 800 && nativeStart.value === 50,
                'native range starts in an independent scrollable document',
                nativeStart
              );
              row.nativeKeys = [];
              for (const [key, expected] of keys) {
                await page.locator('#native-range').press(key);
                await page.waitForTimeout(250);
                await frames(page);
                const s = await page.evaluate(() => ({
                  value: +document.querySelector('input').value,
                  scrollY,
                  focused: document.activeElement === document.querySelector('input'),
                }));
                row.nativeKeys.push({ key, expected, ...s });
                check(
                  s.value === expected &&
                    s.focused &&
                    Math.abs(s.scrollY - nativeStart.scrollY) < 0.5,
                  'native range key changes its value while document position holds',
                  { key, expected, s }
                );
              }
              await page.goto(`${base}/combinations.html`);
              await page.waitForFunction(() => window.fixtureReady);
              await mount(undefined, { ids: [31] });
              await page.evaluate(() => bench.goTo('middle'));
              await page.waitForTimeout(1300);
              await page.locator('[data-ref="31"] input').focus();
              await frames(page);
              const rangeState = () =>
                page.evaluate(() => {
                  const input = document.querySelector('[data-ref="31"] input'),
                    images = [...document.querySelectorAll('[data-compare] img')];
                  return {
                    value: input.valueAsNumber,
                    clip: getComputedStyle(images[1]).clipPath,
                    label: input.getAttribute('aria-label'),
                    focused: document.activeElement === input,
                    sceneTop: document.querySelector('#middle').getBoundingClientRect().top,
                    frame: document
                      .querySelector('[data-compare]')
                      .getBoundingClientRect()
                      .toJSON(),
                    visibility: getComputedStyle(document.querySelector('[data-compare]'))
                      .visibility,
                    images: images.map((img) => ({
                      bounds: img.getBoundingClientRect().toJSON(),
                      alt: img.alt,
                      complete: img.complete,
                      naturalWidth: img.naturalWidth,
                      naturalHeight: img.naturalHeight,
                      source: img.currentSrc,
                    })),
                  };
                });
              const before = { ...(await take()), ...(await rangeState()) };
              check(
                before.value === 50 &&
                  before.focused &&
                  before.label === 'Compare images' &&
                  before.nodes.length === 1 &&
                  before.nodes[0].id === 'a-beacon',
                'comparison slider has its initial value, accessible name and progress witness',
                before
              );
              row.rangeKeys = [];
              for (const [key, expected] of keys) {
                await page.locator('[data-ref="31"] input').press(key);
                await page.waitForTimeout(250);
                await frames(page);
                const s = { ...(await take()), ...(await rangeState()) };
                row.rangeKeys.push({ key, expected, ...s });
                const tokens = /^inset\(([^)]+)\)$/.exec(s.clip)?.[1].trim().split(/\s+/),
                  sides = tokens && [
                    tokens[0],
                    tokens[1] ?? tokens[0],
                    tokens[2] ?? tokens[0],
                    tokens[3] ?? tokens[1] ?? tokens[0],
                  ];
                check(
                  s.value === expected &&
                    sides?.length === 4 &&
                    sides.every(
                      (v, i) =>
                        Number.isFinite(parseFloat(v)) &&
                        (i === 1
                          ? (parseFloat(v) === 0 || v.endsWith('%')) &&
                            Math.abs(parseFloat(v) - (100 - expected)) < 0.01
                          : parseFloat(v) === 0)
                    ),
                  'range value and comparison clip follow the independent key table',
                  { key, expected, s }
                );
                check(
                  s.focused &&
                    s.current === before.current &&
                    s.current === 1 &&
                    Math.abs(s.scrollY - before.scrollY) < 0.5 &&
                    Math.abs(s.sceneTop - before.sceneTop) < 0.5 &&
                    s.nodes.length === before.nodes.length &&
                    s.nodes.every(
                      (a) =>
                        Math.abs(a.progress - before.nodes.find((b) => b.id === a.id).progress) <
                        0.00001
                    ),
                  'slider keys preserve focus, Stage, document and element progress',
                  { key, before, s }
                );
                check(
                  s.visibility === 'visible' &&
                    s.images.length === 2 &&
                    s.images.every(
                      (img) =>
                        img.complete &&
                        img.naturalWidth === 480 &&
                        img.naturalHeight === 240 &&
                        img.source === s.images[0].source &&
                        visibleInFrame(img.bounds, s.frame)
                    ) &&
                    ['x', 'y', 'width', 'height'].every(
                      (p) => Math.abs(s.images[0].bounds[p] - s.images[1].bounds[p]) < 0.01
                    ) &&
                    s.images[0].alt === 'Geometric subject' &&
                    s.images[1].alt === 'Processed result',
                  'comparison images stay decoded, registered, exposed and identified',
                  s.images
                );
                check(!s.errors.length, 'comparison input has no cv-error', s.errors);
              }
            } else if (group === 'image-return') {
              row.profileId = 'AUTH-IMAGE-COPY-RETURN';
              row.registrationOracle =
                'Live sequential-read consistency within image-before/after bounds plus strict .05px; stationary registration is exact within the original margin, not instantaneous moving-paint proof.';
              row.authoring = {
                ids: [26, 27],
                copies: 2,
                navigation: 'programmatic',
                seek: 'page-owned WAAPI currentTime',
                points: [1000, 6000, 11000],
              };
              await mount(undefined, { ids: [26, 27], copies: 2 });
              await page.evaluate(() => bench.goTo('middle'));
              await page.waitForTimeout(1300);
              const imageState = async (label) => {
                const s = await page.evaluate(() => ({
                  current: document.querySelector('cv-stage').current,
                  errors: bench.snapshot().errors,
                  galleries: [...document.querySelectorAll('[data-ken]')].map((g) => ({
                    frame: g.getBoundingClientRect().toJSON(),
                    visibility: getComputedStyle(g).visibility,
                    images: [...g.querySelectorAll('img')].map((img) => ({
                      opacity: +getComputedStyle(img).opacity,
                      alt: img.alt,
                      complete: img.complete,
                      naturalWidth: img.naturalWidth,
                      naturalHeight: img.naturalHeight,
                      bounds: img.getBoundingClientRect().toJSON(),
                      animations: img
                        .getAnimations()
                        .map((a) => ({ time: a.currentTime, state: a.playState })),
                    })),
                  })),
                  prints: [...document.querySelectorAll('[data-ref="27"] cv-animate')].map(
                    (host) => ({
                      image: host.querySelector('img').getBoundingClientRect().toJSON(),
                      alt: host.querySelector('img').alt,
                      frame: host.getBoundingClientRect().toJSON(),
                      visibility: getComputedStyle(host).visibility,
                      containers: [...host.shadowRoot.querySelectorAll('[part="duotone"]')].map(
                        (part) => ({
                          hidden: part.getAttribute('aria-hidden'),
                          boxes: [...part.children].map((box) => {
                            const image = host.querySelector('img');
                            const beforeTime = performance.now();
                            const before = image.getBoundingClientRect().toJSON();
                            const copyTime = performance.now();
                            const bounds = box.getBoundingClientRect().toJSON();
                            const afterTime = performance.now();
                            const after = image.getBoundingClientRect().toJSON();
                            return {
                              bounds,
                              registration: { before, after, beforeTime, copyTime, afterTime },
                              mask: getComputedStyle(box).maskImage,
                              inks: box.children.length,
                            };
                          }),
                        })
                      ),
                    })
                  ),
                }));
                s.label = label;
                for (const print of s.prints)
                  for (const container of print.containers)
                    for (const box of container.boxes)
                      Object.assign(
                        box.registration,
                        imageCopyRegistration(
                          box.registration.before,
                          box.bounds,
                          box.registration.after
                        )
                      );
                (row.imageSamples ??= []).push(s);
                check(
                  s.galleries.length === 2 &&
                    s.galleries.every(
                      (g) =>
                        g.images.length === 2 &&
                        g.images.every(
                          (img) =>
                            img.complete &&
                            img.naturalWidth === 480 &&
                            img.naturalHeight === 240 &&
                            img.alt === 'Geometric subject' &&
                            img.animations.length === 1
                        )
                    ),
                  'each dissolve retains two decoded original images and its own animations',
                  s
                );
                check(
                  s.prints.length === 2 &&
                    s.prints.every(
                      (p) =>
                        p.alt === 'Geometric subject' &&
                        p.containers.length === 1 &&
                        p.containers[0].hidden === 'true' &&
                        p.containers[0].boxes.length === 1 &&
                        p.containers[0].boxes[0].inks === 1 &&
                        p.containers[0].boxes[0].mask !== 'none' &&
                        p.containers[0].boxes[0].registration.consistent
                    ),
                  'duotone has one hidden print registered to each original',
                  s.prints
                );
                check(
                  s.galleries.every((g) =>
                    ['x', 'y', 'width', 'height'].every(
                      (k) => Math.abs(g.images[0].bounds[k] - g.images[1].bounds[k]) < 0.05
                    )
                  ),
                  'both dissolve originals retain the same registered rectangle',
                  s.galleries
                );
                if (s.current === 1)
                  check(
                    s.galleries.every(
                      (g) =>
                        g.visibility === 'visible' &&
                        g.images.every((img) => visibleInFrame(img.bounds, g.frame))
                    ) &&
                      s.prints.every(
                        (p) =>
                          p.visibility === 'visible' &&
                          visibleInFrame(p.image, p.frame) &&
                          visibleInFrame(p.containers[0].boxes[0].bounds, p.frame)
                      ),
                    'current image compositions have positive geometry within the visible clip and viewport',
                    s
                  );
                check(!s.errors.length, 'image sample has no cv-error', s.errors);
                return s;
              };
              await page.evaluate(() => bench.pause());
              for (const [t, expected] of [
                [1000, [1, 0]],
                [6000, [0.5, 0.5]],
                [11000, [0, 1]],
              ]) {
                await page.evaluate((t) => {
                  for (const img of document.querySelectorAll('[data-ken] img'))
                    for (const animation of img.getAnimations()) animation.currentTime = t;
                }, t);
                const s = await imageState(`seek-${t}`);
                check(
                  s.current === 1 &&
                    s.galleries.every((g) =>
                      g.images.every(
                        (img, i) =>
                          img.animations[0].state === 'paused' &&
                          Math.abs(img.animations[0].time - t) < 0.01 &&
                          Math.abs(img.opacity - expected[i]) < 0.03
                      )
                    ),
                  'paused dissolve matches independent authored opacity values',
                  { t, expected, s }
                );
                if (t === 6000) {
                  const file = join(output, `${engine}-${context}-image-return.png`);
                  await page.screenshot({ path: file });
                  (row.screenshots ??= []).push(file);
                }
              }
              await page.evaluate(() => bench.play());
              for (let cycle = 1; cycle <= 2; cycle++) {
                await page.evaluate(() => bench.goTo('after'));
                await page.waitForFunction(() => document.querySelector('cv-stage').current === 2);
                await frames(page);
                const away = await imageState(`away-${cycle}`);
                await page.waitForTimeout(150);
                const held = await imageState(`away-held-${cycle}`);
                check(
                  held.current === 2 &&
                    held.galleries.every((g, gi) =>
                      g.images.every(
                        (img, i) =>
                          img.animations[0].state === 'paused' &&
                          Math.abs(
                            img.animations[0].time - away.galleries[gi].images[i].animations[0].time
                          ) < 0.01
                      )
                    ),
                  'departure holds page-owned image time without accumulating prints',
                  { away, held }
                );
                await page.evaluate(() => bench.goTo('middle'));
                await page.waitForFunction(() => document.querySelector('cv-stage').current === 1);
                await frames(page);
                await page.waitForTimeout(150);
                const returned = await imageState(`returned-${cycle}`);
                check(
                  returned.galleries.every((g, gi) =>
                    g.images.every(
                      (img, i) =>
                        img.animations[0].state === 'running' &&
                        img.animations[0].time >
                          held.galleries[gi].images[i].animations[0].time + 80
                    )
                  ),
                  'return resumes page-owned image time and keeps one print per original',
                  { held, returned }
                );
              }
              await page.evaluate(() => {
                window.retiredImages = {
                  originals: [...document.querySelectorAll('#middle img')],
                  hosts: [...document.querySelectorAll('[data-ref="27"] cv-animate')],
                  animations: [...document.querySelectorAll('[data-ken] img')].flatMap((img) =>
                    img.getAnimations()
                  ),
                };
                bench.unmount();
              });
              await frames(page);
              row.imageCleanup = await page.evaluate(() => ({
                originals: retiredImages.originals.map((img) => ({
                  connected: img.isConnected,
                  alt: img.alt,
                })),
                remainingCopies: retiredImages.hosts.map(
                  (host) => host.shadowRoot.querySelectorAll('[part="duotone"]').length
                ),
                animations: retiredImages.animations.map((a) => a.playState),
                fixture: bench.snapshot(),
              }));
              check(
                row.imageCleanup.originals.length === 6 &&
                  row.imageCleanup.originals.every(
                    (img) => !img.connected && img.alt === 'Geometric subject'
                  ) &&
                  row.imageCleanup.remainingCopies.length === 2 &&
                  row.imageCleanup.remainingCopies.every((n) => n === 0) &&
                  row.imageCleanup.animations.length === 4 &&
                  row.imageCleanup.animations.every((s) => s === 'idle') &&
                  row.imageCleanup.fixture.nodes === 0 &&
                  row.imageCleanup.fixture.animations === 0,
                'unmount removes prints and cancels owned animations while preserving original alt text',
                row.imageCleanup
              );
              // Keep the common final read/error/disposal checks after the inspected teardown.
              await mount(undefined);
            } else if (group === 'lp-drag-details') {
              row.profileId = 'AUTH-PUB-LP-DRAG-DETAILS';
              row.authoring = {
                windows: { A: [0, 950], B: [850, 1450], C: [1300, 1900] },
                unit: 'time',
                scales: [25, 40],
                transition: 800,
                exit: 400,
                ease: 'linear',
                material: 'Synthetic diagram with two labelled landmarks and permanent body text',
              };
              const windows = [
                ['A', 0, 950],
                ['B', 850, 1450],
                ['C', 1300, 1900],
              ];
              const authoredMount = async (scale) => {
                await bounded(
                  page.evaluate(async (scale) => {
                    const pending = bench.mount({ ids: [], context: 'drag', exits: false });
                    const stage = document.querySelector('cv-stage');
                    stage.setAttribute('unit', 'time');
                    stage.setAttribute('scale', String(scale));
                    document.querySelector('#before .bookend').textContent = 'Read the diagram';
                    document.querySelector('#after .bookend').textContent =
                      'Summary: A identifies the source; B identifies its selected detail.';
                    document.querySelector('#middle').innerHTML = `
                    <style>
                      #lp-story{box-sizing:border-box;height:800px;padding:48px;background:#fcfbf7;color:#172219;font:18px/1.4 system-ui}
                      #lp-story h1{margin:0;font-size:36px;line-height:1.2}
                      #lp-body{max-width:960px;margin:20px 0 26px}
                      #lp-diagram{position:relative;width:960px;height:440px}
                      #lp-picture{display:block;width:960px;height:440px}
                      #lp-story .annotation{position:absolute;width:250px}
                      #B{left:224px;top:124px} #C{left:684px;top:234px}
                      #lp-story .badge{box-sizing:border-box;display:grid;place-items:center;width:32px;height:32px;border:2px solid #172219;border-radius:50%;background:#fcfbf7;font-weight:700}
                      #lp-story .annotation p{margin:12px 0 0;padding:8px;background:#fcfbf7;font-size:17px}
                    </style>
                    <article id="lp-story">
                      <cv-animate id="A" name="title" on="scene" fx="fade" duration="950" ease="linear" exit="fade" exit-duration="400"><h1>Locate two details in the diagram</h1></cv-animate>
                      <p id="lp-body">Keep the source visible while you inspect its selected detail. The diagram and this explanation remain available throughout the chapter.</p>
                      <div id="lp-diagram">
                        <svg id="lp-picture" role="img" aria-labelledby="lp-picture-title" width="960" height="440" viewBox="0 0 960 440">
                          <title id="lp-picture-title">A source connected to its selected detail</title>
                          <rect x="1" y="1" width="958" height="438" rx="16" fill="#e7eee5" stroke="#52694f"/>
                          <path d="M240 140H480V250H700" fill="none" stroke="#52694f" stroke-width="3"/>
                          <rect x="96" y="70" width="260" height="280" rx="8" fill="#fcfbf7" stroke="#52694f"/>
                          <path d="M128 100H304M128 280H270M128 302H304" stroke="#9cae97" stroke-width="6"/>
                          <rect x="580" y="160" width="300" height="240" rx="8" fill="#fcfbf7" stroke="#52694f"/>
                          <path d="M612 190H834M612 350H800M612 372H834" stroke="#9cae97" stroke-width="6"/>
                          <circle id="lp-marker-a" cx="240" cy="140" r="14" fill="#52694f"/>
                          <circle id="lp-marker-b" cx="700" cy="250" r="14" fill="#52694f"/>
                        </svg>
                        <cv-animate class="annotation" id="B" name="detail-a" on="scene" fx="fade" duration="600" after="title -100" ease="linear" exit="fade" exit-duration="400"><div><span class="badge" data-target="lp-marker-a">A</span><p>A identifies the source document.</p></div></cv-animate>
                        <cv-animate class="annotation" id="C" on="scene" fx="fade" duration="600" after="detail-a -150" ease="linear" exit="fade" exit-duration="400"><div><span class="badge" data-target="lp-marker-b">B</span><p>B identifies the selected detail.</p></div></cv-animate>
                      </div>
                    </article>`;
                    window.lpSnap = () => {
                      const middle = document.querySelector('#middle');
                      const center = (node) => {
                        const r = node.getBoundingClientRect();
                        return [r.x + r.width / 2, r.y + r.height / 2];
                      };
                      return {
                        stamp: performance.now(),
                        sceneTop: middle.getBoundingClientRect().top,
                        height: stage.clientHeight,
                        current: stage.current,
                        total: middle.solution.total,
                        errors: bench.snapshot().errors,
                        nodes: [...middle.querySelectorAll('cv-animate')].map((a) => ({
                          id: a.id,
                          phase: a.timeline.phase,
                          progress: a.timeline.progress,
                          signedProgress: a.timeline.signedProgress,
                          source: a.timeline.source,
                          opacity: [...new Set(a.layers.map((l) => l.el))].reduce(
                            (p, el) => p * +getComputedStyle(el).opacity,
                            1
                          ),
                        })),
                        body: {
                          text: document.querySelector('#lp-body').textContent,
                          opacity: +getComputedStyle(document.querySelector('#lp-body')).opacity,
                        },
                        picture: {
                          opacity: +getComputedStyle(document.querySelector('#lp-picture')).opacity,
                          width: document.querySelector('#lp-picture').getBoundingClientRect()
                            .width,
                          height: document.querySelector('#lp-picture').getBoundingClientRect()
                            .height,
                        },
                        annotations: [...middle.querySelectorAll('.badge')].map((b) => ({
                          label: b.textContent,
                          text: b.nextElementSibling.textContent,
                          badge: center(b),
                          marker: center(document.getElementById(b.dataset.target)),
                        })),
                      };
                    };
                    await pending;
                  }, scale)
                );
                const initial = await snapshot(`mount-${scale}`);
                check(
                  initial.current === 0 && initial.total === 1900 && initial.nodes.length === 3,
                  'three authored entrances solve to 1900ms without adding drag exits',
                  initial
                );
              };
              const permanent = (s) => {
                check(
                  s.body.opacity === 1 &&
                    s.body.text.includes('remain available') &&
                    s.picture.opacity === 1 &&
                    Math.abs(s.picture.width - 960) < 0.01 &&
                    Math.abs(s.picture.height - 440) < 0.01,
                  'diagram and complete body retain their authored readable state',
                  s
                );
                check(
                  s.annotations.length === 2 &&
                    s.annotations.every(
                      (a, i) =>
                        a.label === ['A', 'B'][i] &&
                        a.text.startsWith(`${a.label} identifies`) &&
                        a.badge.every((value, axis) => Math.abs(value - a.marker[axis]) < 0.1)
                    ),
                  'each label and explanation remain registered to their own SVG landmark',
                  s.annotations
                );
                check(!s.errors.length, 'authored sample has no cv-error', s.errors);
              };
              const snapshot = async (label) => {
                const s = await page.evaluate(() => window.lpSnap());
                s.label = label;
                row.samples.push(s);
                permanent(s);
                return s;
              };
              const entrance = (s, t) => {
                for (const [id, start, end] of windows) {
                  const a = s.nodes.find((n) => n.id === id),
                    expected = clamp((t - start) / (end - start));
                  check(
                    a &&
                      Math.abs(a.progress - expected) < 0.002 &&
                      Math.abs(a.opacity - expected) < 0.015,
                    'independent authored entrance interval matches frame and painted opacity',
                    { label: s.label, id, t, expected, actual: a }
                  );
                }
              };
              const departure = (s, travel) => {
                const expected = 1 - clamp(2 * Math.abs(travel));
                check(
                  Math.abs(s.sceneTop + 800 * travel) < 1 && s.current === 1,
                  'outgoing Scene follows signed commanded page displacement',
                  { travel, s }
                );
                for (const a of s.nodes)
                  check(
                    a.phase === 'exiting' &&
                      Math.abs(a.progress - Math.abs(travel)) < 0.002 &&
                      Math.abs(a.signedProgress - travel) < 0.002 &&
                      Math.abs(a.opacity - expected) < 0.015,
                    'forward declared exit or backward entrance reversal matches independent opacity',
                    { travel, expected, actual: a }
                  );
              };
              const begin = async (direction) => {
                const downY = direction === 1 ? 760 : 40;
                await page.evaluate(() => {
                  window.lpInput = {};
                  window.lpRelease = null;
                  window.addEventListener(
                    'pointerdown',
                    (e) => {
                      window.lpInput.down = { y: e.clientY, time: e.timeStamp };
                    },
                    { once: true }
                  );
                  window.addEventListener(
                    'pointerup',
                    () => {
                      window.lpInput.releaseBefore = performance.now();
                    },
                    { once: true, capture: true }
                  );
                  window.addEventListener(
                    'pointerup',
                    (e) => {
                      const input = window.lpInput;
                      input.up = { y: e.clientY, time: e.timeStamp };
                      input.duration = e.timeStamp - input.down.time;
                      input.threshold = document
                        .querySelector('cv-stage')
                        .getAttribute('threshold');
                      input.sceneThreshold = document
                        .querySelector('#middle')
                        .getAttribute('threshold');
                      window.lpRelease = window.lpSnap();
                    },
                    { once: true }
                  );
                });
                await page.mouse.move(1170, downY);
                await page.mouse.down();
                // Give ownership its first pixel before applying known page displacement.
                await page.mouse.move(1170, downY - direction);
                await frames(page);
                return downY - direction;
              };
              const move = async (origin, travel, label) => {
                await page.mouse.move(1170, origin - 800 * travel);
                await frames(page);
                const s = await snapshot(label);
                check(
                  s.height === 800 && s.nodes.every((a) => a.source === 'gesture'),
                  'held sample uses actual pointer input at the authored viewport',
                  s
                );
                return s;
              };
              const release = async (held, ratio, direction) => {
                await page.waitForTimeout(350);
                await page.mouse.up();
                const input = await page.evaluate(() => ({
                  ...window.lpInput,
                  release: window.lpRelease,
                }));
                (row.inputs ??= []).push(input);
                check(
                  input.duration > 300 &&
                    input.threshold === null &&
                    input.sceneThreshold === null &&
                    Math.abs((input.down.y - input.up.y - direction) / 800 - ratio) < 0.00001,
                  'release uses the intended default long gesture with expired velocity',
                  input
                );
                check(
                  input.release.nodes.length === 3 &&
                    input.release.nodes.every((a) => {
                      const previous = held.nodes.find((n) => n.id === a.id);
                      return (
                        Math.abs(a.progress - previous.progress) < 0.002 &&
                        Math.abs(a.opacity - previous.opacity) < 0.005
                      );
                    }),
                  'release preserves all three interrupted displayed values',
                  { held, release: input.release }
                );
                return input;
              };
              const captureContinuation = async (label, input) => {
                const samples = await page.evaluate(
                  () =>
                    new Promise((resolve) => {
                      const start = performance.now(),
                        samples = [];
                      const tick = (frameTime) => {
                        samples.push({ ...window.lpSnap(), frameTime });
                        if (performance.now() - start >= 700) resolve(samples);
                        else requestAnimationFrame(tick);
                      };
                      requestAnimationFrame(tick);
                    })
                );
                (row.continuations ??= []).push({ label, releaseTime: 1250, input, samples });
                check(
                  input.releaseBefore <= input.release.stamp,
                  'pointer-up observations bracket the real-time continuation start',
                  input
                );
                for (const [i, s] of samples.entries()) {
                  s.label = `${label}/${i}`;
                  permanent(s);
                  // Runtime rAF uses its timestamp; capture listeners bracket its release.
                  // The oracle uses authored time and browser timestamps, not runtime progress.
                  const lower = Math.min(
                    1900,
                    1250 + Math.max(0, s.frameTime - input.release.stamp)
                  );
                  const upper = Math.min(
                    1900,
                    1250 + Math.max(0, s.frameTime - input.releaseBefore)
                  );
                  s.expectedTime = [lower, upper];
                  for (const [id, start, end] of windows) {
                    const a = s.nodes.find((n) => n.id === id),
                      lo = clamp((lower - start) / (end - start)),
                      hi = clamp((upper - start) / (end - start));
                    check(
                      a.progress >= lo - 0.003 &&
                        a.progress <= hi + 0.003 &&
                        a.opacity >= lo - 0.015 &&
                        a.opacity <= hi + 0.015,
                      'post-release output follows independently elapsed authored time',
                      { label, i, id, lower, upper, actual: a }
                    );
                  }
                }
                check(
                  samples.some(
                    (s) =>
                      s.nodes.find((a) => a.id === 'C').progress > 0.005 &&
                      s.nodes.find((a) => a.id === 'C').progress < 0.95 &&
                      s.nodes.every((a) => a.source === 'continuation')
                  ),
                  'unfinished follower visibly advances through nonterminal continuation frames',
                  { label }
                );
                check(
                  samples.some(
                    (s) =>
                      s.current === 1 &&
                      Math.abs(s.sceneTop) < 1 &&
                      s.nodes.find((a) => a.id === 'C').progress > 0 &&
                      s.nodes.find((a) => a.id === 'C').progress < 0.95
                  ),
                  'element time continues after the page has settled and before the follower finishes',
                  { label }
                );
              };
              const captureReturn = async (label, kind, scale = 25) => {
                const samples = await page.evaluate(
                  () =>
                    new Promise((resolve) => {
                      const start = performance.now(),
                        samples = [];
                      const tick = () => {
                        samples.push(window.lpSnap());
                        if (performance.now() - start >= 450) resolve(samples);
                        else requestAnimationFrame(tick);
                      };
                      requestAnimationFrame(tick);
                    })
                );
                (row.returns ??= []).push({ label, kind, scale, samples });
                for (const [i, s] of samples.entries()) {
                  s.label = `${label}/${i}`;
                  permanent(s);
                  if (kind === 'entrance') entrance(s, 100 * scale * clamp(1 - s.sceneTop / 800));
                  else if (Math.abs(s.sceneTop) > 0.001) departure(s, -s.sceneTop / 800);
                  else entrance(s, 1900);
                }
                check(
                  samples.length > 1 &&
                    samples.every(
                      (s, i) =>
                        !i ||
                        s.nodes.every((a) => {
                          const prior = samples[i - 1].nodes.find((n) => n.id === a.id);
                          return kind === 'entrance'
                            ? a.opacity <= prior.opacity + 0.005
                            : a.opacity >= prior.opacity - 0.005;
                        })
                    ),
                  'sampled cancellation has no opacity overshoot',
                  { label, kind }
                );
              };
              const entered = async (label) => {
                await page.waitForFunction(
                  () =>
                    document.querySelector('cv-stage').current === 1 &&
                    [...document.querySelectorAll('#middle cv-animate')].every(
                      (a) => a.timeline.phase === 'entered'
                    )
                );
                const s = await snapshot(label);
                entrance(s, 1900);
                check(
                  Math.abs(s.sceneTop) < 1,
                  'committed entrance settles the complete composition on screen',
                  s
                );
                return s;
              };
              const shot = async (label) => {
                const file = join(output, `${engine}-lp-${label}.png`);
                await page.screenshot({ path: file });
                (row.screenshots ??= []).push({ label, file });
              };

              await authoredMount(25);
              let origin = await begin(1),
                held;
              for (const t of [
                0, 475, 850, 950, 1300, 1425, 1450, 1900, 1450, 1425, 1300, 950, 850, 475, 1250,
              ]) {
                held = await move(origin, t / 2500, `entrance/${t}`);
                check(
                  Math.abs(held.sceneTop - (800 - (800 * t) / 2500)) < 1,
                  'incoming Scene geometry matches independently commanded element time',
                  { t, held }
                );
                entrance(held, t);
              }
              check(
                held.nodes.find((a) => a.id === 'B').progress > 0 &&
                  held.nodes.find((a) => a.id === 'B').progress < 1 &&
                  held.nodes.find((a) => a.id === 'C').progress === 0,
                'half-page release leaves both follower entrances unfinished',
                held
              );
              await captureContinuation('forward-continuation', await release(held, 0.5, 1));
              await entered('committed-continuation');
              await shot('complete');

              for (const direction of [1, -1]) {
                origin = await begin(direction);
                for (const r of [0.125, 0.25, 0.375, 0.25]) {
                  held = await move(origin, direction * r, `exit/${direction}/${r}`);
                  departure(held, direction * r);
                }
                await shot(direction === 1 ? 'forward-quarter' : 'backward-quarter');
                await release(held, direction * 0.25, direction);
                await captureReturn(`exit-cancel/${direction}`, 'departure');
                const restored = await entered(`exit-restored/${direction}`);
                check(
                  restored.nodes.every((a) => a.opacity > 0.99),
                  'cancelled departure restores all completed groups',
                  restored
                );
              }
              for (const direction of [1, -1]) {
                origin = await begin(direction);
                held = await move(origin, direction * 0.5, `exit-commit/${direction}`);
                departure(held, direction * 0.5);
                await release(held, direction * 0.5, direction);
                await page.waitForFunction(
                  (index) => document.querySelector('cv-stage').current === index,
                  1 + direction
                );
                await frames(page);
                const departed = await snapshot(`departed/${direction}`);
                check(
                  departed.current === 1 + direction &&
                    Math.abs(departed.sceneTop + direction * 800) < 1 &&
                    departed.nodes.every(
                      (a) =>
                        a.phase === 'exited' && a.signedProgress === direction && a.opacity < 0.01
                    ),
                  'committed departure leaves the recorded signed terminal state',
                  departed
                );
                check(
                  await page.evaluate((direction) => {
                    const node = document.querySelector(
                      direction === 1 ? '#after .bookend' : '#before .bookend'
                    );
                    const r = node.getBoundingClientRect();
                    return r.top >= 0 && r.bottom <= 800 && node.textContent.length > 10;
                  }, direction),
                  'adjacent Scene contains visible useful content'
                );
                if (direction === 1) {
                  origin = await begin(-1);
                  held = await move(origin, -0.5, 'backward-reentry/1250');
                  entrance(held, 1250);
                  check(
                    Math.abs(held.sceneTop + 400) < 1,
                    'backward incoming Scene uses independent geometry',
                    held
                  );
                  await captureContinuation('backward-continuation', await release(held, -0.5, -1));
                  await entered('backward-reentry-complete');
                }
              }
              await authoredMount(40);
              origin = await begin(1);
              for (const t of [475, 850, 1300, 1400, 1350]) {
                held = await move(origin, t / 4000, `partial/${t}`);
                entrance(held, t);
                check(
                  Math.abs(held.sceneTop - (800 - (800 * t) / 4000)) < 1,
                  'partial incoming Scene follows independently commanded time',
                  { t, held }
                );
              }
              check(
                held.nodes.every((a) => a.progress > 0) &&
                  held.nodes.find((a) => a.id === 'C').progress < 1,
                'partial reversal includes the second follower before release',
                held
              );
              await release(held, 0.3375, 1);
              await captureReturn('partial-cancel', 'entrance', 40);
              await page.waitForTimeout(150);
              const reset = await snapshot('partial-reset-held');
              entrance(reset, 0);
              check(
                reset.current === 0 &&
                  Math.abs(reset.sceneTop - 800) < 1 &&
                  reset.nodes.every((a) => a.progress === 0),
                'cancelled partial entrance stays reset after the return',
                reset
              );
            } else if (group === 'decl-after' || group === 'drag-entry-cancel') {
              const cancel = group === 'drag-entry-cancel',
                scale = cancel ? 40 : 16;
              row.profileId = cancel ? 'AUTH-DRAG-PARTIAL-ENTRY-CANCEL' : 'AUTH-DECL-INTRO-AFTER';
              row.authoring = {
                unit: 'time',
                scale,
                ease: 'linear',
                title: { fx: 'rise', name: 'title', duration: 950 },
                explanation: { fx: 'fade, drift(soft)', duration: 600, after: 'title -150' },
                windows: { A: [0, 950], B: [800, 1400] },
              };
              await bounded(
                page.evaluate(async (scale) => {
                  const ready = bench.mount({ ids: [], context: 'drag', variant: 'after' });
                  const stage = document.querySelector('cv-stage'),
                    a = document.querySelector('#A'),
                    b = document.querySelector('#B');
                  stage.setAttribute('unit', 'time');
                  stage.setAttribute('scale', String(scale));
                  for (const node of [a, b])
                    for (const attr of ['delay', 'exit', 'exit-duration'])
                      node.removeAttribute(attr);
                  a.setAttribute('name', 'title');
                  a.setAttribute('fx', 'rise');
                  a.setAttribute('duration', '950');
                  b.setAttribute('fx', 'fade, drift(soft)');
                  b.setAttribute('duration', '600');
                  b.setAttribute('after', 'title -150');
                  a.firstElementChild.textContent = 'Arrange a page as scenes';
                  b.firstElementChild.textContent =
                    'Give each element a progress source and a timing relationship.';
                  document.querySelector('#C').remove();
                  await ready;
                }, scale)
              );
              const initial = await take();
              check(
                initial.current === 0 && initial.total === 1400 && initial.nodes.length === 2,
                'authored overlap solves to 1400ms before the pointer starts',
                initial
              );

              const at = async (t) => {
                // At 800px height, time mode advances 100*scale ms per screen.
                // Ownership discards one initial pixel: down at 760, origin at 759.
                const pointerY = 759 - (800 * t) / (100 * scale);
                await page.mouse.move(1100, pointerY);
                await frames(page);
                const s = await take();
                Object.assign(
                  s,
                  { commandedTime: t, pointerY },
                  await page.evaluate(() => ({
                    sceneTop: document.querySelector('#middle').getBoundingClientRect().top,
                    stageHeight: document.querySelector('cv-stage').clientHeight,
                    layers: [...document.querySelectorAll('#middle cv-animate')].map((a) => ({
                      id: a.id,
                      values: a.layers.map((l) => ({
                        source: l.source,
                        translate: getComputedStyle(l.el).translate,
                      })),
                    })),
                  }))
                );
                check(
                  s.stageHeight === 800 &&
                    Math.abs(s.sceneTop - (800 - (800 * t) / (100 * scale))) < 1,
                  'Scene follows the commanded displacement',
                  { t, s }
                );
                for (const [id, start, end] of [
                  ['A', 0, 950],
                  ['B', 800, 1400],
                ]) {
                  const node = s.nodes.find((a) => a.id === id),
                    expected = clamp((t - start) / (end - start));
                  check(
                    node.source === 'gesture' &&
                      Math.abs(node.progress - expected) < 0.002 &&
                      Math.abs(node.opacity - expected) < 0.015,
                    'authored window matches public progress and actual opacity',
                    { id, t, expected, node }
                  );
                }
                const title = s.layers
                    .find((a) => a.id === 'A')
                    .values.find((l) => l.source === 'scene'),
                  translation =
                    title?.translate === 'none'
                      ? ['0', '0']
                      : (title?.translate.split(/\s+/) ?? []),
                  y = translation.length ? Number.parseFloat(translation[1] ?? '0') : Number.NaN;
                check(
                  Number.isFinite(y) && Math.abs(y - 40 * (1 - clamp(t / 950))) < 0.05,
                  'title rise follows its independent linear formula',
                  { t, y }
                );
                const sources = s.layers.find((a) => a.id === 'B').values.map((l) => l.source);
                check(
                  sources.includes('scene') && sources.includes('view'),
                  'explanation retains separate time and view effects',
                  sources
                );
                return s;
              };
              await page.evaluate(() => {
                window.fixtureDragInput = {};
                window.fixtureRelease = null;
                window.addEventListener(
                  'pointerdown',
                  (e) => {
                    window.fixtureDragInput.down = { time: e.timeStamp, y: e.clientY };
                  },
                  { once: true }
                );
                window.addEventListener(
                  'pointerup',
                  (e) => {
                    const input = window.fixtureDragInput;
                    input.up = { time: e.timeStamp, y: e.clientY };
                    input.duration = e.timeStamp - input.down.time;
                    input.height = document.querySelector('cv-stage').clientHeight;
                    input.threshold = document.querySelector('cv-stage').getAttribute('threshold');
                    window.fixtureRelease = [
                      ...document.querySelectorAll('#middle cv-animate'),
                    ].map((a) => ({
                      id: a.id,
                      progress: a.timeline.progress,
                      opacity: [...new Set(a.layers.map((l) => l.el))].reduce(
                        (p, el) => p * +getComputedStyle(el).opacity,
                        1
                      ),
                    }));
                  },
                  { once: true }
                );
              });
              await page.mouse.move(1100, 760);
              await page.mouse.down();
              for (const t of cancel
                ? [0, 475, 800, 900, 875]
                : [0, 475, 800, 875, 950, 1100, 1400, 950, 875, 800])
                await at(t);
              // A >300ms hold ensures the default long-gesture branch at any refresh rate
              // and exceeds the 100ms velocity window.
              await page.waitForTimeout(350);
              const held = await take();
              await page.mouse.up();
              row.input = await page.evaluate(() => window.fixtureDragInput);
              const releasedRatio = (row.input.down.y - row.input.up.y - 1) / row.input.height;
              check(
                row.input.duration > 300 &&
                  row.input.threshold === null &&
                  row.input.height === 800 &&
                  Math.abs(releasedRatio - (cancel ? 0.21875 : 0.5)) < 0.00001,
                'release exercises the intended default long-gesture branch',
                row.input
              );
              if (cancel) {
                row.release = await page.evaluate(() => window.fixtureRelease);
                check(
                  row.release?.length === 2 &&
                    row.release.every((a) => {
                      const before = held.nodes.find((n) => n.id === a.id);
                      return (
                        Math.abs(a.progress - before.progress) < 0.002 &&
                        Math.abs(a.opacity - before.opacity) < 0.005
                      );
                    }),
                  'pointer release preserves the interrupted displayed values',
                  { release: row.release, held }
                );
                row.cancelFrames = await page.evaluate(
                  () =>
                    new Promise((resolve) => {
                      const samples = [];
                      const tick = () => {
                        samples.push(
                          [...document.querySelectorAll('#middle cv-animate')].map((a) => ({
                            id: a.id,
                            progress: a.timeline.progress,
                            opacity: [...new Set(a.layers.map((l) => l.el))].reduce(
                              (p, el) => p * +getComputedStyle(el).opacity,
                              1
                            ),
                          }))
                        );
                        if (samples.length === 16) resolve(samples);
                        else requestAnimationFrame(tick);
                      };
                      requestAnimationFrame(tick);
                    })
                );
                check(
                  row.cancelFrames.every((sample, i) =>
                    sample.every((a) => {
                      const previous = (i ? row.cancelFrames[i - 1] : row.release).find(
                        (n) => n.id === a.id
                      );
                      return (
                        Number.isFinite(a.progress) &&
                        a.progress >= 0 &&
                        a.progress <= previous.progress + 0.002 &&
                        a.opacity >= 0 &&
                        a.opacity <= previous.opacity + 0.005
                      );
                    })
                  ),
                  'sampled cancellation returns without progress or opacity overshoot',
                  row.cancelFrames
                );
                await page.waitForFunction(
                  () =>
                    document.querySelector('cv-stage').current === 0 &&
                    [...document.querySelectorAll('#middle cv-animate')].every(
                      (a) => a.timeline.progress === 0
                    )
                );
                await page.waitForTimeout(150);
                const end = await take();
                check(
                  end.current === 0 && end.nodes.every((a) => a.progress === 0 && a.opacity < 0.01),
                  'cancelled partial entrance remains reset',
                  end
                );
              } else {
                await page.waitForFunction(
                  () =>
                    document.querySelector('cv-stage').current === 1 &&
                    [...document.querySelectorAll('#middle cv-animate')].every(
                      (a) => a.timeline.phase === 'entered'
                    )
                );
                const end = await take();
                const top = await page.evaluate(
                  () => document.querySelector('#middle').getBoundingClientRect().top
                );
                check(
                  held.nodes.find((a) => a.id === 'A').progress < 1 &&
                    held.nodes.find((a) => a.id === 'B').progress === 0 &&
                    end.current === 1 &&
                    Math.abs(top) < 1 &&
                    end.nodes.every((a) => a.progress === 1 && a.opacity > 0.99),
                  'committed release continues the unfinished entrances to readable final values',
                  { held, end, top }
                );
              }
            } else if (group === 'after-roots') {
              row.profileId = 'AUTH-AFTER-ROOT-VIEW-GATES';
              await mount('after-offscreen');
              await page.waitForTimeout(950);
              const below = await take();
              check(
                below.nodes.find((a) => a.id === 'A').bounds.top >= 800 &&
                  below.nodes.every((a) => a.progress === 0 && a.opacity < 0.01) &&
                  below.nodes.find((a) => a.id === 'A').phase === 'idle',
                'below-viewport root does not start its dependency chain',
                below
              );
              await page.evaluate(() => bench.goTo('middle'));
              await page.waitForFunction(
                () => document.querySelector('#A').timeline.phase === 'entering'
              );
              await page.waitForTimeout(950);
              await page.evaluate(() => bench.pause());
              await frames(page);
              const played = await take(),
                root = played.nodes.find((a) => a.id === 'A');
              check(
                root.bounds.top >= 0 &&
                  root.bounds.bottom <= 800 &&
                  played.nodes.filter((a) => a.id !== 'A').every((a) => a.bounds.top > 800) &&
                  played.nodes.every(
                    (a) => a.phase === 'entered' && a.progress === 1 && a.opacity > 0.99
                  ),
                'visible root completes the chain while followers stay offscreen',
                played
              );
              const rule = await page.addStyleTag({
                content: '#middle #A {position:relative;top:-1400px}',
              });
              // Pause before the first build. A normal entrance cannot finish merely
              // because the test waited; a non-replay root already above must reveal.
              await bounded(
                page.evaluate(async (context) => {
                  const ready = bench.mount({ ids: [], context, variant: 'after-offscreen' });
                  document.querySelector('#A').removeAttribute('replay');
                  document.querySelector('cv-stage').pause();
                  await ready;
                }, context)
              );
              await frames(page);
              const above = await take();
              check(
                above.nodes.find((a) => a.id === 'A').bounds.bottom < 0 &&
                  above.nodes.every(
                    (a) => a.phase === 'entered' && a.progress === 1 && a.opacity > 0.99
                  ),
                'initially passed non-replay root reveals all dependencies while paused',
                above
              );
              await page.waitForTimeout(150);
              const held = await take();
              check(
                (await page.evaluate(() => document.querySelector('cv-stage').paused)) &&
                  Math.abs(held.time - above.time) < 0.01 &&
                  held.nodes.every((a) => a.progress === 1 && a.opacity > 0.99),
                'initial above-root result is held with the Stage clock',
                { above, held }
              );
              await rule.evaluate((el) => el.remove());
              const errors = row.samples.flatMap((s) => s.errors);
              check(!errors.length, 'no cv-error across root-gate mounts', errors);
            } else if (group === 'clock' || group === 'after') {
              await mount(group === 'clock' ? 'clock-chain' : 'after-offscreen');
              await page.evaluate(() => bench.pause());
              await page.evaluate(() => bench.goTo('middle'));
              await page.waitForFunction(() => document.querySelector('cv-stage').current === 1);
              await page.waitForFunction(
                () => document.querySelector('#A').timeline.phase === 'entering'
              );
              const start = await take();
              if (group === 'clock')
                check(start.total === 0, 'clock does not grow Scene input duration', start.total);
              else
                check(
                  start.nodes.find((a) => a.id === 'B').bounds.top > 800,
                  'after follower starts outside viewport'
                );
              await page.evaluate(() => bench.play());
              for (const wait of [250, 200, 300]) {
                await page.waitForTimeout(wait);
                await page.evaluate(() => bench.pause());
                await frames(page);
                const s = await take(),
                  elapsed = s.time - start.time;
                for (const [id, from, to] of [
                  ['A', 100, 500],
                  ['B', 400, 700],
                  ['C', 600, 800],
                ]) {
                  const a = s.nodes.find((a) => a.id === id),
                    expected = clamp((elapsed - from) / (to - from));
                  check(
                    Math.abs(a.opacity - expected) < 0.07,
                    'authored dependency window matches actual opacity',
                    { id, elapsed, expected, actual: a.opacity }
                  );
                  if (group === 'clock')
                    check(a.source === 'clock', 'explicit clock reports clock source', a);
                }
                const held = await take();
                await page.waitForTimeout(100);
                const still = await take();
                check(
                  Math.abs(held.time - still.time) < 0.01 &&
                    held.nodes.every(
                      (a, i) => Math.abs(a.opacity - still.nodes[i].opacity) < 0.005
                    ),
                  'paused dependency run holds'
                );
                await page.evaluate(() => bench.play());
              }
              await page.evaluate(() => bench.pause());
              if (group === 'clock') {
                const beforeBuild = await take();
                await page.evaluate(() =>
                  document.querySelector('cv-stage').append(document.createElement('cv-scene'))
                );
                await page.waitForFunction(
                  () => document.querySelector('cv-stage').ordered.length === 4
                );
                await frames(page);
                const rebuilt = await take();
                check(
                  rebuilt.current === 1 &&
                    rebuilt.nodes.every(
                      (a, i) =>
                        Math.abs(a.progress - beforeBuild.nodes[i].progress) < 0.02 &&
                        Math.abs(a.opacity - beforeBuild.nodes[i].opacity) < 0.03
                    ),
                  'structural rebuild preserves current clock run',
                  { beforeBuild, rebuilt }
                );
              }
              await page.evaluate(() => bench.goTo('after'));
              await frames(page);
              await page.evaluate(() => bench.goTo('middle'));
              await frames(page);
              await page.waitForFunction(
                () => document.querySelector('#A').timeline.progress < 0.1
              );
              const restarted = await take();
              check(
                restarted.nodes.every((a) => a.progress === 0 && a.opacity < 0.03),
                'reentry restarts root and all dependencies',
                restarted
              );
              await mount(group === 'clock' ? 'clock-completed-loop' : 'after-long-follower');
              await page.evaluate(() => bench.goTo('middle'));
              await page.waitForTimeout(340);
              await page.evaluate(() => bench.pause());
              await frames(page);
              const beforeRebuild = await take();
              if (group === 'after')
                check(
                  beforeRebuild.nodes[1].progress > 0 && beforeRebuild.nodes[1].progress < 0.8,
                  'rebuild starts with an unfinished offscreen follower',
                  beforeRebuild
                );
              await page.evaluate(() =>
                document.querySelector('cv-stage').append(document.createElement('cv-scene'))
              );
              await page.waitForFunction(
                () => document.querySelector('cv-stage').ordered.length === 4
              );
              await frames(page);
              const afterRebuild = await take();
              check(
                afterRebuild.current === 1 &&
                  afterRebuild.nodes.every(
                    (a, i) =>
                      Math.abs(a.progress - beforeRebuild.nodes[i].progress) < 0.02 &&
                      Math.abs(a.opacity - beforeRebuild.nodes[i].opacity) < 0.03
                  ),
                'paused rebuild preserves complete root and active followers',
                { beforeRebuild, afterRebuild }
              );
              if (group === 'clock') {
                const state = await page.evaluate(() => {
                  const a = document.querySelector('#A');
                  return {
                    phase: a.getAttribute('data-cv-phase'),
                    complete: a.clockComplete,
                    looping: a.looping,
                  };
                });
                check(
                  state.phase === 'entered' && state.complete && state.looping,
                  'completed clock restores phase and loop while paused',
                  state
                );
                await page.evaluate(() => {
                  const stage = document.querySelector('cv-stage');
                  for (const child of [...stage.children].slice(1)) child.remove();
                });
                await page.waitForFunction(
                  () => document.querySelector('cv-stage').ordered.length === 1
                );
                await frames(page);
                check(
                  await page.evaluate(
                    () =>
                      scrollY === 0 &&
                      document.querySelector('cv-stage').shadowRoot.querySelector('.frame')
                        .offsetHeight <=
                        innerHeight + 1
                  ),
                  'height reservation permits legitimate structural shrinkage'
                );
              }
            } else if (group === 'exit') {
              await mount('exit-interruption');
              await page.evaluate(() => bench.goTo('middle'));
              await page.waitForFunction(
                () => document.querySelector('#A').timeline.progress > 0.25
              );
              const before = await take();
              await page.evaluate(() => scrollTo(0, 0));
              await page.waitForFunction(
                () => document.querySelector('#A').timeline.phase === 'exiting'
              );
              const leaving = await take();
              check(
                Math.abs(leaving.nodes[0].opacity - before.nodes[0].opacity) < 0.08,
                'interrupted exit starts at displayed opacity',
                { before, leaving }
              );
              await page.waitForTimeout(130);
              const fading = await take();
              check(
                fading.nodes[0].opacity < leaving.nodes[0].opacity,
                'exit continues fading from partial entrance'
              );
              await page.evaluate(() => scrollTo(0, 800));
              await page.waitForFunction(
                () => document.querySelector('#A').timeline.phase === 'entering'
              );
              await page.waitForTimeout(130);
              const back = await take();
              check(
                back.nodes[0].opacity < 0.2,
                'return cancels exit and starts one fresh entrance',
                back
              );
              await page.evaluate(() => scrollTo(0, 0));
              await page.waitForTimeout(500);
              const end = await take();
              check(
                end.nodes[0].phase === 'exited' && end.nodes[0].opacity < 0.01,
                'declared exit reaches final frame'
              );
            } else if (group === 'ranges') {
              for (const variant of ['view-ranges', 'view-ranges-split'])
                for (const reverse of [false, true]) {
                  await mount(variant, { reverse });
                  await page.evaluate(() => bench.goTo('middle'));
                  await frames(page);
                  const initial = await take(),
                    a0 = initial.nodes[0];
                  if (context === 'drag') {
                    await page.mouse.move(1100, 650);
                    await page.mouse.down();
                    await page.mouse.move(1100, 390);
                    await page.waitForTimeout(350);
                  } else
                    await page.evaluate(() => {
                      const a = document.querySelector('#pair');
                      scrollTo(0, scrollY + a.getBoundingClientRect().top + 70);
                    });
                  await frames(page);
                  const s = await take(),
                    a = s.nodes[0],
                    top = a.bounds.top,
                    h = a.bounds.height;
                  if (context === 'drag')
                    check(
                      Math.abs(top - (a0.bounds.top - 259)) < 2,
                      'Scene follows commanded pointer before range comparison',
                      { top, before: a0.bounds.top }
                    );
                  const entry = clamp((800 - top) / Math.min(800, h)),
                    exit = clamp(-top / Math.min(800, h));
                  if (!a.pieces.length)
                    check(
                      Math.abs(a.opacity - entry * exit) < 0.03,
                      'whole-element named ranges multiply once',
                      { a, entry, exit }
                    );
                  else
                    a.pieces.forEach((piece, k) => {
                      const unit = 1 / (a.pieces.length + 4),
                        expected =
                          clamp((entry - k * unit) / (5 * unit)) *
                          clamp((exit - k * unit) / (5 * unit));
                      check(
                        Math.abs(piece.opacity - expected) < 0.03,
                        'split named ranges compose per piece',
                        { k, actual: piece.opacity, expected }
                      );
                    });
                  if (context === 'drag') {
                    await page.mouse.up();
                    await page.waitForTimeout(850);
                  }
                }
            }
            const last = await take();
            check(!last.errors.length, 'no cv-error after complete case', last.errors);
            await page.evaluate(() => bench.unmount());
            await frames(page);
            const clean = await page.evaluate(() => bench.snapshot());
            check(
              clean.nodes === 0 && clean.animations === 0,
              'teardown removes nodes and animations',
              clean
            );
          } catch (e) {
            row.error = e.stack;
          } finally {
            await page.close();
            check(!row.pageErrors.length, 'no uncaught page exceptions', row.pageErrors);
            row.pass = !row.error && row.checks.every((c) => c.ok);
            rows.push(row);
            await writeFile(join(output, 'results.json'), JSON.stringify(rows, null, 2));
          }
          console.log(
            `${row.pass ? 'PASS' : 'FAIL'} ${engine} ${group} ${context}${row.error ? ` ${row.error.split('\n')[0]}` : ''}`
          );
        }
    } finally {
      await browser.close();
    }
  }
  return rows;
}
