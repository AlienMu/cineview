import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const launchers = { chromium, webkit };
const clamp = (n) => Math.min(1, Math.max(0, n));
async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Pair fixture deadline exceeded')), 30000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const frames = (page) =>
  page.evaluate(
    () =>
      new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))
      )
  );
async function mount(page, config) {
  await bounded(page.evaluate((c) => bench.mount(c), config));
}
async function at(page, time) {
  await page.evaluate((time) => scrollTo(0, 800 + time), time);
  await frames(page);
}
const inspect = (page) =>
  page.evaluate(() => {
    const a = document.querySelector('#pair') ?? document.querySelector('#A'),
      s = document.querySelector('#middle');
    const style = (el) => {
      const c = getComputedStyle(el);
      return {
        opacity: +c.opacity,
        translate: c.translate,
        filter: c.filter,
        clip: c.clipPath,
        font: c.fontVariationSettings,
        rotate: c.rotate,
        hue: c.getPropertyValue('--cv-hue'),
        scope: c.getPropertyValue('--scope'),
      };
    };
    return {
      scrollY,
      current: bench.snapshot().current,
      errors: bench.snapshot().errors,
      scene: { top: s.getBoundingClientRect().top, height: s.getBoundingClientRect().height },
      layers: (a?.layers ?? []).map((l) => ({
        source: l.source,
        piece: !!l.piece,
        ...style(l.el),
        fragments: [...l.el.querySelectorAll('span')].map((el) => ({
          text: el.textContent,
          font: getComputedStyle(el).fontVariationSettings,
        })),
      })),
      originalFont: a?.firstElementChild
        ? getComputedStyle(a.firstElementChild).fontVariationSettings
        : null,
      split: !!a?.shadowRoot?.querySelector('[part=split]'),
      splitVisibility: a?.shadowRoot?.querySelector('[part=split]')
        ? getComputedStyle(a.shadowRoot.querySelector('[part=split]')).visibility
        : null,
      sourceOpacity: a?.shadowRoot?.querySelector('[part=split-source]')
        ? +getComputedStyle(a.shadowRoot.querySelector('[part=split-source]')).opacity
        : 1,
      count: !!a?.shadowRoot?.querySelector('[part=count]'),
      path: a?.querySelector('path')
        ? {
            length: a.querySelector('path').getAttribute('pathLength'),
            dash: a.querySelector('path').style.strokeDasharray,
            offset: parseFloat(getComputedStyle(a.querySelector('path')).strokeDashoffset),
          }
        : null,
      rotation: document.querySelector('[data-pair-rotation]')
        ? getComputedStyle(document.querySelector('[data-pair-rotation]')).transform
        : null,
      color: document.querySelector('[data-pair-color]')
        ? getComputedStyle(document.querySelector('[data-pair-color]')).backgroundColor
        : null,
      outside: getComputedStyle(document.querySelector('#outside-scope')).getPropertyValue(
        '--scope'
      ),
    };
  });
const imageBody =
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240"><rect width="240" height="240" fill="black"/><rect x="240" width="240" height="240" fill="white"/></svg>';

async function paintedImage(page, file) {
  const clip = await page.locator('#pair img').boundingBox();
  const png = await page.screenshot({ clip, path: file });
  return page.evaluate(async (b64) => {
    const bitmap = await createImageBitmap(
      await (await fetch(`data:image/png;base64,${b64}`)).blob()
    );
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
      g = canvas.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    return [0.25, 0.75].map((x) =>
      [
        ...g.getImageData(Math.floor(bitmap.width * x), Math.floor(bitmap.height / 2), 1, 1).data,
      ].slice(0, 3)
    );
  }, png.toString('base64'));
}

/** Shared-element/Scene and control correctness. Separate from canonical sibling performance. */
export async function runPairOracles({
  base = 'http://127.0.0.1:4382',
  output = 'review/v2-pc-pairs-20261016/oracles',
  engines = ['chromium', 'webkit'],
  contexts = ['zone-auto', 'zone-fallback'],
  variants = [
    'pair-view',
    'pair-draw-wipe',
    'pair-lines-axis',
    'pair-hue-rotation',
    'count-split',
    'track-cover',
    'words-count',
    'pair-develop-duotone',
    'local-controls',
  ],
} = {}) {
  await mkdir(output, { recursive: true });
  const rows = [];
  for (const engine of engines) {
    const browser = await launchers[engine].launch(
      engine === 'chromium' ? { channel: 'chrome' } : {}
    );
    try {
      for (const context of contexts)
        for (const variant of variants) {
          const page = await browser.newPage({
            viewport: { width: 1280, height: 800 },
            hasTouch: false,
          });
          const row = { engine, context, variant, checks: [], samples: [], pageErrors: [] },
            check = (ok, label, detail) =>
              row.checks.push({ ok: !!ok, label, ...(ok ? {} : { detail }) });
          page.on('pageerror', (error) => row.pageErrors.push(error.message));
          try {
            await page.goto(`${base}/combinations.html`);
            await page.waitForFunction(() => window.fixtureReady);
            if (variant === 'track-cover') {
              await mount(page, { ids: [5, 11], context });
              for (const t of [0, 250, 500, 750, 500]) {
                await at(page, t);
                const s = await page.evaluate(() => {
                  const s = document.querySelector('#middle');
                  return {
                    x: parseFloat(getComputedStyle(s.track).translate) || 0,
                    travel: s.travel,
                    nextTop: document.querySelector('#after').getBoundingClientRect().top,
                  };
                });
                check(
                  Math.abs(s.x + Math.min(t, 600)) < 1 && Math.abs(s.travel - 600) < 1,
                  `track at ${t}`,
                  s
                );
                row.samples.push({ t, ...s });
              }
              for (const y of [2000, 2200, 2400, 2600, 2790, 2800, 1300]) {
                await page.evaluate((y) => scrollTo(0, y), y);
                await frames(page);
                const s = await page.evaluate(() => {
                  const s = document.querySelector('#middle');
                  return {
                    veil: +getComputedStyle(s.veil).opacity,
                    hidden: getComputedStyle(s).visibility === 'hidden',
                    scale: getComputedStyle(s).scale,
                    x: parseFloat(getComputedStyle(s.track).translate) || 0,
                    nextTop: document.querySelector('#after').getBoundingClientRect().top,
                  };
                });
                if (y < 2800)
                  check(
                    Math.abs(s.veil - 0.5 * clamp((y - 2000) / 800)) < 0.025,
                    `cover veil at y=${y}`,
                    s
                  );
                check(s.scale === 'none' || s.scale === '1', 'dim keeps scale', s.scale);
                if (y === 2800) check(s.hidden, 'fully covered scene is hidden', s);
                if (y === 1300)
                  check(
                    !s.hidden && Math.abs(s.x + 500) < 1,
                    'reverse restores track and visibility',
                    s
                  );
                row.samples.push({ y, ...s });
              }
            } else if (variant === 'words-count') {
              await mount(page, { ids: [10, 13], context });
              for (const [t, wheels] of [
                [250, [1, 0, 5.343]],
                [500, [1, 2, 4.076]],
                [750, [1, 2, 7.408]],
                [1000, [1, 2, 8]],
              ]) {
                await at(page, t);
                const s = await page.evaluate(() => {
                  const words = document.querySelector('#a-10'),
                    count = document.querySelector('#a-13'),
                    copy = count.shadowRoot.querySelector('[part=count]'),
                    style = getComputedStyle(copy);
                  return {
                    pieces: words.layers
                      .filter((l) => l.piece)
                      .map((l) => +getComputedStyle(l.el).opacity),
                    wheels: [0, 1, 2].map((i) => +style.getPropertyValue(`--cv-count-${i}`)),
                    on: style.getPropertyValue('--cv-count-on'),
                    text: count.textContent.trim(),
                  };
                });
                check(
                  s.pieces.length === 7 &&
                    s.pieces.every((p, k) => Math.abs(p - clamp((t - 60 * k) / 1000)) < 0.025),
                  `seven word opacities at ${t}`,
                  s
                );
                check(
                  s.wheels.every((v, i) => Math.abs(v - wheels[i]) < 0.01) && s.text === '128',
                  `actual odometer wheels at ${t}`,
                  s
                );
                if (t === 1000) check(s.on === '0', 'original number remains at completion', s);
                row.samples.push({ t, ...s });
              }
            } else if (variant === 'local-controls') {
              await mount(page, { ids: [14, 22], context });
              await page.evaluate(() => bench.goTo('middle'));
              await frames(page);
              const snap = page.locator('[data-ref="14"] .scroller'),
                kinetic = page.locator('[data-ref="22"] .scroller');
              const box = await snap.boundingBox();
              await page.mouse.move(box.x + box.width / 2, box.y + 70);
              await page.mouse.wheel(700, 0);
              await page.waitForTimeout(650);
              const snapped = await snap.evaluate((el) => ({
                left: el.scrollLeft,
                width: el.clientWidth,
                offsets: [...el.children].map(
                  (child) =>
                    child.getBoundingClientRect().left -
                    el.getBoundingClientRect().left +
                    el.scrollLeft
                ),
              }));
              check(
                snapped.left > 100 &&
                  snapped.offsets.some((offset) => Math.abs(snapped.left - offset) < 1),
                'native gallery reaches an authored snap offset',
                snapped
              );
              check(
                (await kinetic.evaluate((el) => el.scrollLeft)) === 0,
                'native gallery does not move kinetic gallery'
              );
              const k = await kinetic.boundingBox(),
                x = k.x + k.width * 0.8,
                y = k.y + 70,
                current = await page.evaluate(() => bench.snapshot().current),
                scroll = await page.evaluate(() => scrollY);
              await page.mouse.move(x, y);
              await page.mouse.down();
              for (let i = 1; i <= 8; i++) {
                await page.mouse.move(x - (160 * i) / 8, y);
                await page.waitForTimeout(16);
              }
              const before = await kinetic.evaluate((el) => el.scrollLeft);
              await page.mouse.up();
              await page.waitForTimeout(450);
              const after = await kinetic.evaluate((el) => el.scrollLeft);
              check(before > 50 && after > before + 5, 'kinetic gallery continues after release', {
                before,
                after,
              });
              check(
                (await snap.evaluate((el) => el.scrollLeft)) === snapped.left,
                'kinetic gallery does not move native gallery'
              );
              check(
                (await page.evaluate(() => bench.snapshot().current)) === current &&
                  Math.abs((await page.evaluate(() => scrollY)) - scroll) < 1,
                'local controls keep Stage position'
              );
            } else if (variant === 'pair-develop-duotone') {
              let release;
              const gate = new Promise((r) => (release = r));
              await page.route('**/pair-delayed.svg', async (route) => {
                await gate;
                await route.fulfill({ contentType: 'image/svg+xml', body: imageBody });
              });
              await page.evaluate(
                (c) => {
                  window.pendingMount = bench.mount(c);
                },
                { ids: [], context, variant }
              );
              await page.waitForFunction(
                () =>
                  document.querySelector('#pair')?.shadowRoot?.querySelector('[part=develop]')
                    ?.children.length > 0
              );
              const before = await page.evaluate(() => {
                const a = document.querySelector('#pair');
                return {
                  complete: a.querySelector('img').complete,
                  standins: a.shadowRoot.querySelector('[part=develop]').children.length,
                };
              });
              check(
                !before.complete && before.standins === 1,
                'delayed real image has visible authored stand-in',
                before
              );
              release();
              await bounded(page.evaluate(() => window.pendingMount));
              await page.waitForTimeout(1350);
              await at(page, 500);
              const asset = await page.evaluate(() => {
                const a = document.querySelector('#pair'),
                  container = a.shadowRoot.querySelector('[part=duotone]'),
                  box = container.firstElementChild,
                  ink = box?.firstElementChild,
                  img = a.querySelector('img');
                return {
                  standins: a.shadowRoot.querySelector('[part=develop]')?.children.length ?? 0,
                  opacity: +getComputedStyle(container).opacity,
                  complete: img.complete,
                  naturalWidth: img.naturalWidth,
                  box: box
                    ? {
                        mode: getComputedStyle(box).maskMode,
                        mask: getComputedStyle(box).maskImage,
                        dark: getComputedStyle(box).backgroundColor,
                        width: box.getBoundingClientRect().width,
                        height: box.getBoundingClientRect().height,
                      }
                    : null,
                  ink: ink
                    ? {
                        mode: getComputedStyle(ink).maskMode,
                        light: getComputedStyle(ink).backgroundColor,
                      }
                    : null,
                  img: {
                    width: img.getBoundingClientRect().width,
                    height: img.getBoundingClientRect().height,
                  },
                };
              });
              check(
                asset.complete && asset.naturalWidth === 480 && asset.standins === 0,
                'decoded image replaces stand-in',
                asset
              );
              check(
                Math.abs(asset.opacity - 0.5) < 0.025 &&
                  asset.box?.mode === 'alpha' &&
                  asset.ink?.mode === 'luminance',
                'duotone alpha/luminance layers follow scene time',
                asset
              );
              check(
                asset.box?.dark === 'rgb(29, 24, 20)' &&
                  asset.ink?.light === 'rgb(212, 103, 63)' &&
                  asset.box.mask.includes('pair-delayed.svg'),
                'actual terracotta inks mask real image',
                asset
              );
              check(
                Math.abs(asset.box.width - asset.img.width) < 1 &&
                  Math.abs(asset.box.height - asset.img.height) < 1,
                'print keeps image geometry',
                asset
              );
              row.samples.push({ before, asset });
              await at(page, 1000);
              const painted = await paintedImage(
                page,
                join(output, `${engine}-${context}-develop-duotone.png`)
              );
              check(
                painted.every((rgb, i) =>
                  rgb.every(
                    (v, k) =>
                      Math.abs(
                        v -
                          [
                            [29, 24, 20],
                            [212, 103, 63],
                          ][i][k]
                      ) < 10
                  )
                ),
                'painted black/white image becomes the two actual inks',
                painted
              );
              row.samples.push({ painted });
            } else {
              await mount(page, { ids: [], context, variant });
              const times =
                variant === 'pair-view'
                  ? [0, 0.23, 0.5, 0.77, 1]
                  : [0, 250, 500, 750, 1000, 1100, 500];
              for (const t of times) {
                if (variant === 'pair-view') {
                  await page.evaluate((v) => scrollTo(0, v * 2800), t);
                  await frames(page);
                } else await at(page, t);
                const s = await inspect(page);
                row.samples.push({ t, ...s });
                if (variant !== 'pair-view' && variant !== 'count-split') {
                  const entranceEnd = variant === 'pair-lines-axis' ? 1060 : 1000;
                  const expected = 1 - clamp((t - entranceEnd) / 200),
                    actual = s.layers.filter((l) => !l.piece).reduce((p, l) => p * l.opacity, 1);
                  check(
                    Math.abs(actual - expected) < 0.03,
                    'composed host exit keeps the authored opacity',
                    { t, actual, expected }
                  );
                }
                if (variant === 'pair-view') {
                  const v = t,
                    a = clamp(v / 0.46),
                    b = clamp((v - 0.54) / 0.46),
                    view = s.layers.find((l) => l.source === 'view');
                  const translate = view.translate.split(/\s+/),
                    y = translate.length > 1 ? parseFloat(translate[1]) : 0;
                  check(
                    Math.abs(s.scene.height - 2000) < 1,
                    'authored Scene height stays 2000px',
                    s.scene
                  );
                  check(
                    Math.abs(y - (-3.5 + 7 * v)) < 0.025,
                    'shared view parallax uses percentage offset',
                    { v, y }
                  );
                  check(
                    Math.abs(
                      (parseFloat(view.filter.match(/blur\(([^)]+)/)?.[1]) || 0) - 4.5 * (1 - a + b)
                    ) < 0.03 && Math.abs(view.opacity - (0.34 + 0.66 * a) * (1 - 0.66 * b)) < 0.025,
                    'shared focus retains its own band',
                    { v, view }
                  );
                } else if (variant === 'pair-draw-wipe') {
                  const p = clamp(t / 1000),
                    clip = s.layers
                      .find((l) => l.clip !== 'none')
                      ?.clip.match(/[-\d.]+/g)
                      ?.map(Number);
                  check(
                    s.path?.length === '1' &&
                      s.path.dash.replaceAll(',', ' ').trim().replace(/\s+/g, ' ') === '1 2',
                    'SVG has actual normalized dash geometry',
                    s.path
                  );
                  check(
                    Math.abs(s.path.offset - 1.001 * (1 - p)) < 0.003,
                    'path inherits independently expected draw offset',
                    { t, path: s.path }
                  );
                  check(
                    clip && Math.abs((clip[1] ?? clip[0]) - 100 * (1 - p)) < 0.05,
                    'shared host applies actual clipping',
                    { t, clip }
                  );
                } else if (variant === 'pair-lines-axis') {
                  const pieces = s.layers.filter((l) => l.piece);
                  check(pieces.length === 2, 'two actual split lines', pieces);
                  for (const [k, piece] of pieces.entries()) {
                    const p = clamp((t - 60 * k) / 1000),
                      weight = 300 + 400 * p,
                      translate = piece.translate.match(/[-\d.]+/g)?.map(Number);
                    check(
                      translate && Math.abs((translate[1] ?? 0) - 105 * (1 - p)) < 0.05,
                      'line rises by expected percentage',
                      { t, k, translate: piece.translate }
                    );
                    check(
                      Math.abs((parseFloat(piece.rotate) || 0) - 2.5 * (1 - p)) < 0.01,
                      'line keeps expected rotation',
                      { t, k, rotate: piece.rotate }
                    );
                    check(
                      Math.abs(parseFloat(piece.font.match(/[-\d.]+$/)?.[0]) - weight) < 0.05,
                      'piece receives expected axis',
                      { t, k, piece }
                    );
                    check(
                      piece.fragments.length > 0 &&
                        piece.fragments.every(
                          (f) => Math.abs(parseFloat(f.font.match(/[-\d.]+$/)?.[0]) - weight) < 0.05
                        ),
                      'actual glyph fragments receive expected axis',
                      { t, k, piece }
                    );
                  }
                  if (t === 1100)
                    check(
                      s.sourceOpacity === 1
                        ? s.originalFont.includes('700')
                        : s.splitVisibility === 'visible' &&
                            pieces.every(
                              (piece) =>
                                piece.fragments.length > 0 &&
                                piece.fragments.every((f) => f.font.includes('700'))
                            ),
                      'visible text keeps final axis',
                      s
                    );
                } else if (variant === 'pair-hue-rotation') {
                  const p = clamp(t / 1000),
                    l = s.layers.find((l) => l.scope !== ''),
                    matrix = s.rotation
                      .match(/matrix\(([^)]+)\)/)?.[1]
                      .split(',')
                      .map(Number),
                    theta = (p * Math.PI) / 2;
                  check(
                    Math.abs(parseFloat(l.hue) - 180 * p) < 0.05 && Math.abs(+l.scope - p) < 0.005,
                    'explicit shared scene source writes both variables',
                    { t, l }
                  );
                  check(
                    matrix &&
                      Math.abs(matrix[0] - Math.cos(theta)) < 0.01 &&
                      Math.abs(matrix[1] - Math.sin(theta)) < 0.01,
                    'actual consumer rotates with scoped variable',
                    { t, rotation: s.rotation }
                  );
                  check(
                    s.outside === '',
                    'scoped variables do not reach outside sibling',
                    s.outside
                  );
                } else if (variant === 'count-split') {
                  check(s.split && !s.count, 'count is refused on successfully split host', s);
                  row.classification = 'refused-composition';
                }
              }
            }
            check(
              (await page.evaluate(() => bench.snapshot().errors)).length === 0,
              'no cv-error after the complete oracle path'
            );
          } catch (error) {
            row.pass = false;
            row.error = error.stack;
          } finally {
            await page.close();
            check(row.pageErrors.length === 0, 'no uncaught browser exceptions', row.pageErrors);
            row.pass = !row.error && row.checks.every((c) => c.ok);
            if (!row.pass) {
              const failed = row.checks.filter((c) => !c.ok);
              row.classification =
                variant === 'pair-lines-axis' &&
                !row.error &&
                failed.length > 0 &&
                failed.every((c) =>
                  [
                    'actual glyph fragments receive expected axis',
                    'visible text keeps final axis',
                  ].includes(c.label)
                )
                  ? 'visual-axis-failure'
                  : 'unclassified-failure';
            }
            rows.push(row);
            await writeFile(join(output, 'results.json'), JSON.stringify(rows, null, 2));
          }
          console.log(`${row.pass ? 'PASS' : 'FAIL'} ${engine} ${context} ${variant}`);
        }
    } finally {
      await browser.close();
    }
  }
  return rows;
}
