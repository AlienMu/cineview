import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  mountR2Story,
  readR2Story,
  disposeR2Story,
  r2Material,
} from './authored-storyboard-page.mjs';

/** Twenty configurations, forty engine/configuration rows with the two supported PC engines. */
export function publicStoryboardCases() {
  const cases = [];
  for (const context of ['zone-auto', 'zone-fallback']) {
    for (const language of ['en', 'zh-CN'])
      for (const width of [1280, 640])
        cases.push({ kind: 'ready', context, language, width, height: width === 1280 ? 800 : 900 });
    for (const kind of ['delayed', 'failed'])
      cases.push({ kind, context, language: 'en', width: 1280, height: 800 });
  }
  for (const kind of ['reduced', 'default'])
    for (const language of ['en', 'zh-CN'])
      for (const width of [1280, 640])
        cases.push({
          kind,
          context: 'zone-fallback',
          language,
          width,
          height: width === 1280 ? 800 : 900,
        });
  return cases.map((c) => ({ ...c, id: `${c.kind}/${c.context}/${c.language}/${c.width}` }));
}

const clip = (n) => Math.max(0, Math.min(1, n));
const frames = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      )
  );
async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('R2 readiness timeout')), 30000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// This table and scroll oracle are independent of the page's update function.
const points = [
  [0, [1, 0, 0], 'A'],
  [0.1, [1, 0, 0], 'A'],
  [0.25, [1, 0, 0], 'A'],
  [0.3, [1, 0, 0], 'A'],
  [0.325, [1, 0.5, 0], 'A'],
  [0.35, [1, 1, 0], 'B'],
  [0.375, [0.5, 1, 0], 'B'],
  [0.4, [0, 1, 0], 'B'],
  [0.5, [0, 1, 0], 'B'],
  [0.65, [0, 1, 0], 'B'],
  [0.675, [0, 1, 0.5], 'B'],
  [0.7, [0, 1, 1], 'C'],
  [0.725, [0, 0.5, 1], 'C'],
  [0.75, [0, 0, 1], 'C'],
  [1, [0, 0, 1], 'C'],
];
const descriptions = {
  en: [
    'Keep the source list beside the document you are reading.',
    'Mark the passage you want to explain and keep its source visible.',
    'Review the example explanation beside the material it describes.',
  ],
  'zh-CN': [
    '把来源列表放在正在阅读的文档旁边。',
    '标出需要说明的段落，并保留对应来源。',
    '在原始资料旁查看示例说明。',
  ],
};

/** Functional public-guide acceptance. Run serially while all measured workers are stopped. */
export async function runPublicStoryboard({
  base,
  output = 'review/v2-authored-profiles-20261016/public-storyboard',
  engines = ['chromium', 'webkit'],
  cases = publicStoryboardCases(),
} = {}) {
  if (!base) throw new Error('An explicit accepted V2 fixture base is required');
  await mkdir(output, { recursive: true });
  const rows = [];
  const editingKeys =
    process.platform === 'darwin'
      ? { start: 'Meta+ArrowLeft', end: 'Meta+ArrowRight' }
      : { start: 'Home', end: 'End' };
  for (const engine of engines) {
    if (!['chromium', 'webkit'].includes(engine))
      throw new Error(`Unsupported PC engine ${engine}`);
    const browser = await (engine === 'chromium'
      ? chromium.launch({ channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars'] })
      : webkit.launch());
    try {
      for (const config of cases) {
        const row = {
          profileId: 'AUTH-PUB-DA-R2-A-B-C',
          engine,
          version: browser.version(),
          platform: process.platform,
          editingKeys,
          base,
          config,
          authoring: {
            duration: 4000,
            distance: 4000,
            transitionIntervals: [
              [0.3, 0.4],
              [0.65, 0.75],
            ],
            illustration: 'synthetic SVG wireframes',
            pageOwned: [
              'image composition',
              'emphasis',
              'loading fallback',
              'static adaptation',
              'local form',
            ],
          },
          checks: [],
          samples: [],
          screenshots: [],
          input: [],
          actions: [],
          pageErrors: [],
        };
        const check = (ok, label, detail) =>
          row.checks.push({ ok: !!ok, label, ...(ok ? {} : { detail }) });
        const page = await browser.newPage({
          viewport: { width: config.width, height: config.height },
          deviceScaleFactor: 1,
          hasTouch: false,
          reducedMotion: config.kind === 'reduced' ? 'reduce' : 'no-preference',
        });
        page.on('pageerror', (error) => row.pageErrors.push(error.message));
        const asset = r2Material(config.language).assets;
        const release = {};
        const gates = Object.fromEntries(
          ['B', 'C'].map((key) => [
            key,
            new Promise((resolve) => {
              release[key] = resolve;
            }),
          ])
        );
        const requests = [];
        let pendingMount = null,
          staticTop = null;
        const take = async (label) => {
          const state = await readR2Story(page);
          row.samples.push({ label, ...state });
          check(!state.errors.length, `${label}: no framework errors across mounts`, state.errors);
          return state;
        };
        const assetsReady = async (keys, label) => {
          // Fixture readiness catches decode errors; positive image output is checked separately.
          let settled = true;
          try {
            await page.waitForFunction(
              (keys) =>
                keys.every((key) => {
                  const item = window.r2Story.items.find((item) => item.key === key);
                  return (
                    (item.image.naturalWidth > 0 &&
                      getComputedStyle(item.image).visibility === 'visible') ||
                    !item.status.hidden
                  );
                }),
              keys,
              { timeout: 5000 }
            );
          } catch {
            settled = false;
          }
          const state = await take(label);
          check(settled, `${label}: page-owned decode output settles`, state.items);
          for (const key of keys) {
            const item = state.items.find((item) => item.key === key);
            check(
              new URL(item.image.src).pathname === `/authored-r2-${config.language}-${key}.svg` &&
                item.image.complete &&
                item.image.width === 640 &&
                item.image.height === 400 &&
                item.image.visibility === 'visible' &&
                item.image.opacity === 1 &&
                !item.failureVisible,
              `${label}: ${key} is the expected decoded, visible image`,
              item
            );
          }
          return state;
        };
        const verify = (state, label, expected = null) => {
          const p = clip((state.scrollY - staticTop) / 4000);
          const alpha = expected?.[1] ?? [
            p <= 0.35 ? 1 : p >= 0.4 ? 0 : (0.4 - p) / 0.05,
            (p <= 0.3 ? 0 : p >= 0.35 ? 1 : (p - 0.3) / 0.05) *
              (p <= 0.7 ? 1 : p >= 0.75 ? 0 : (0.75 - p) / 0.05),
            p <= 0.65 ? 0 : p >= 0.7 ? 1 : (p - 0.65) / 0.05,
          ];
          const current = expected?.[2] ?? (p < 0.35 ? 'A' : p < 0.7 ? 'B' : 'C');
          const weight = [
            alpha[0] * (1 - alpha[1]) * (1 - alpha[2]),
            alpha[1] * (1 - alpha[2]),
            alpha[2],
          ];
          check(state.mode === 'enhanced' && state.zone, `${label}: enhanced local zone`, state);
          check(
            state.frame?.source === 'scroll' && Math.abs(state.frame.progress - p) < 0.0005,
            `${label}: public time follows authored scroll distance`,
            { p, frame: state.frame }
          );
          check(
            Math.abs(state.scene.height - (config.height + 4000)) < 1,
            `${label}: viewport plus authored distance`,
            state.scene
          );
          if (expected)
            check(Math.abs(p - expected[0]) < 0.0005, `${label}: commanded point reached`, {
              p,
              expected: expected[0],
              scrollY: state.scrollY,
              staticTop,
            });
          check(
            state.items
              .filter((item) => item.current === 'step')
              .map((item) => item.key)
              .join() === current,
            `${label}: one matching current step`,
            state.items
          );
          state.items.forEach((item, i) => {
            check(
              Math.abs(item.opacity - alpha[i]) < 0.012 &&
                Math.abs(item.emphasis - weight[i]) < 0.012,
              `${label}: ${item.key} image and emphasis`,
              { item, alpha: alpha[i], weight: weight[i] }
            );
            check(
              item.bodyOpacity === 1 && item.description === descriptions[config.language][i],
              `${label}: ${item.key} complete readable description`,
              item
            );
            check(
              item.imageHeading === (config.language === 'en' ? 'Source document' : '来源文档'),
              `${label}: ${item.key} shared image heading avoids overlapping step text`,
              item.imageHeading
            );
            check(
              item.image.fit === 'contain' &&
                Math.abs(item.canvas.width / item.canvas.height - 1.6) < 0.01,
              `${label}: ${item.key} uncropped 8:5 canvas`,
              item
            );
            const first = state.items[0].canvas;
            check(
              Math.abs(item.canvas.x - first.x) < 1 &&
                Math.abs(item.canvas.y - first.y) < 1 &&
                Math.abs(item.canvas.width - first.width) < 1 &&
                Math.abs(item.canvas.height - first.height) < 1,
              `${label}: ${item.key} registered image box`,
              item.canvas
            );
            if (state.scrollY >= staticTop - 0.5 && state.scrollY <= staticTop + 4000.5)
              check(
                item.copy.x >= -1 &&
                  item.copy.right <= config.width + 1 &&
                  item.copy.y >= -1 &&
                  item.copy.bottom <= config.height + 1,
                `${label}: ${item.key} text fits pinned composition`,
                item.copy
              );
            const documentMark = item.landmarks.find((mark) => mark.name === 'document')?.bounds;
            check(
              documentMark &&
                Math.abs(documentMark.x - (item.canvas.x + item.canvas.width / 8)) < 1 &&
                Math.abs(documentMark.y - (item.canvas.y + item.canvas.height / 10)) < 1,
              `${label}: ${item.key} common document landmark`,
              documentMark
            );
          });
          check(
            Math.max(...state.items.map((item) => item.opacity)) > 0.999,
            `${label}: an opaque useful image or stand-in remains`,
            state.items
          );
          if (p > 0 && p < 1)
            check(Math.abs(state.content.top) < 1, `${label}: content stays pinned`, state.content);
          return { p, alpha, weight };
        };
        const at = async (p, label = `point-${p}`, table = null) => {
          const targetY = staticTop + 4000 * p;
          await page.evaluate((y) => scrollTo(0, y), targetY);
          await frames(page);
          const state = await take(label);
          Object.assign(row.samples.at(-1), { commandedProgress: p, commandedScrollY: targetY });
          check(
            Math.abs(state.scrollY - targetY) < 1,
            `${label}: actual input reaches commanded progress`,
            { actualY: state.scrollY, targetY, p }
          );
          verify(state, label, table);
          return state;
        };
        const capture = async (state, label, expectedWeight) => {
          const name = `${engine}-${config.id.replaceAll('/', '-')}-${label}.png`;
          const image = await page.screenshot({ path: join(output, name), animations: 'allow' });
          const box = state.items[0].canvas;
          const pixel = await page.evaluate(
            async ({ png, x, y }) => {
              const img = new Image();
              img.src = `data:image/png;base64,${png}`;
              await img.decode();
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              return [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data];
            },
            {
              png: image.toString('base64'),
              x: box.x + (box.width * 124) / 640,
              y: box.y + (box.height * 104) / 400,
            }
          );
          const markerColors = [
            [184, 74, 48],
            [46, 116, 90],
            [49, 95, 164],
          ];
          const expected = [0, 1, 2].map((channel) =>
            markerColors.reduce((n, color, i) => n + color[channel] * expectedWeight[i], 0)
          );
          check(
            pixel[3] === 255 && expected.every((n, i) => Math.abs(n - pixel[i]) < 4),
            `${label}: actual rendered asset and paint order`,
            { pixel, expected }
          );
          row.screenshots.push({ label, path: join(output, name), pixel, expected });
        };
        const action = async (selector, label, keyboard = false) => {
          const button = page.locator(selector);
          await button.scrollIntoViewIfNeeded();
          const before = await page.evaluate(() => ({
            y: scrollY,
            frame: window.r2Story.source?.timeline.frame,
          }));
          if (keyboard) {
            await button.focus();
            await page.keyboard.press('Enter');
          } else await button.click();
          const opened = await page.locator('#r2-dialog').evaluate((el) => el.open);
          const fieldFocused = await page
            .locator('#r2-name')
            .evaluate((el) => document.activeElement === el && !!el.labels?.length);
          check(opened, `${label}: action opens a native dialog`);
          check(fieldFocused, `${label}: labelled field receives focus`);
          await page.locator('#r2-name').fill('');
          const value = `Field notes ${label}`;
          await page.keyboard.type(value);
          await page.keyboard.press(editingKeys.start);
          const start = await page
            .locator('#r2-name')
            .evaluate((el) => ({ selection: el.selectionStart, value: el.value }));
          check(start.selection === 0, `${label}: platform start-of-line key edits the field`);
          await page.keyboard.press(editingKeys.end);
          const end = await page
            .locator('#r2-name')
            .evaluate((el) => ({ selection: el.selectionStart, value: el.value }));
          check(
            end.selection === end.value.length,
            `${label}: platform end-of-line key edits the field`
          );
          await page.keyboard.press('Enter');
          const submitted = await page.locator('#r2-dialog output').textContent();
          check(submitted.includes(value), `${label}: submit has an observable local result`);
          const during = await page.evaluate(() => ({
            y: scrollY,
            frame: window.r2Story.source?.timeline.frame,
          }));
          check(
            Math.abs(during.y - before.y) < 1 &&
              (!before.frame || Math.abs(during.frame.progress - before.frame.progress) < 0.0001),
            `${label}: form focus and editing preserve the page`,
            { before, during }
          );
          await page.keyboard.press('Escape');
          const returnedFocus = await button.evaluate((el) => document.activeElement === el);
          const openAfterEscape = await page.locator('#r2-dialog').evaluate((el) => el.open);
          check(returnedFocus && !openAfterEscape, `${label}: Escape closes and returns focus`);
          row.actions.push({
            label,
            keyboard,
            before,
            opened,
            fieldFocused,
            value,
            start,
            end,
            submitted,
            during,
            returnedFocus,
            openAfterEscape,
          });
        };
        const staticChecks = async (label) => {
          const state = await take(label);
          check(
            state.mode === 'static' && !state.zone && !state.frame && state.diagnostic.total === 0,
            `${label}: sequential layout has no authored zone`,
            state
          );
          check(
            state.scene.height < 3500 && state.scene.height > 500,
            `${label}: no retained 4000px interval`,
            state.scene
          );
          state.items.forEach((item, i) => {
            check(
              item.opacity === 1 &&
                item.bodyOpacity === 1 &&
                item.description === descriptions[config.language][i],
              `${label}: ${item.key} complete pair retained`,
              item
            );
            check(
              item.canvas.width > 100 &&
                item.canvas.x >= -1 &&
                item.canvas.right <= config.width + 1,
              `${label}: ${item.key} image fits width`,
              item.canvas
            );
            if (i)
              check(
                item.copy.top > state.items[i - 1].canvas.bottom,
                `${label}: ${item.key} follows previous pair`,
                state.items
              );
          });
          check(
            !state.items.some((item) => item.current),
            `${label}: sequential pairs do not imply a current animation step`,
            state.items
          );
          await action('#middle [data-r2-open]', label, true);
          row.screenshots.push({
            label,
            path: join(output, `${engine}-${config.id.replaceAll('/', '-')}-${label}.png`),
          });
          await page.screenshot({ path: row.screenshots.at(-1).path, fullPage: true });
          return state;
        };
        try {
          await page.addInitScript(() => {
            window.r2ObservedErrors = [];
            document.addEventListener('cv-error', (event) =>
              window.r2ObservedErrors.push(event.detail)
            );
          });
          await page.route('**/authored-r2-*.svg*', async (route) => {
            const key = new URL(route.request().url()).pathname.match(/-([ABC])\.svg$/)?.[1];
            const request = { key, url: route.request().url(), outcome: 'pending' };
            requests.push(request);
            if (!key) {
              request.outcome = 'unmatched-abort';
              return route.abort();
            }
            if (config.kind === 'delayed' && key !== 'A') await gates[key];
            if (config.kind === 'failed' && key === 'B') {
              request.outcome = 'intentional-B-failure';
              return route.abort('failed');
            }
            await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: asset[key] });
            request.outcome = 'fulfilled';
          });
          await page.goto(`${base}/combinations.html`);
          await page.waitForFunction(() => window.fixtureReady);
          await page.addStyleTag({
            content:
              'html{overflow-y:scroll;scrollbar-gutter:stable}::-webkit-scrollbar{width:16px}::-webkit-scrollbar-track{background:#ddd}::-webkit-scrollbar-thumb{background:#555;border-radius:4px}',
          });
          pendingMount = mountR2Story(page, {
            ...config,
            presentation: config.kind === 'default' ? 'default' : 'enhanced',
            instance: `${engine}-${config.id}`,
          });
          // Observe the source while fixture.mount is still waiting for image decodes.
          const mountOutcome = pendingMount.then(
            (value) => ({ value }),
            (error) => ({ error })
          );
          await page.waitForFunction(() => window.r2Story?.initialized);
          await frames(page);
          let initial = await take('initialized');
          check(
            initial.language === config.language,
            'document language matches complete copy',
            initial.language
          );
          if (initial.mode === 'enhanced') {
            staticTop = initial.scene.top + initial.scrollY;
            check(
              Math.abs(staticTop - config.height) < 1 && initial.diagnostic.total === 4000,
              'source solves the authored distance after real introductory content',
              initial
            );
          }
          if (config.kind === 'delayed') {
            await assetsReady(['A'], 'A-loaded-before-B-C');
            const blocked = await at(0.5, 'blocked-B');
            check(
              !blocked.items[1].image.complete &&
                blocked.items[1].image.visibility === 'hidden' &&
                blocked.items[1].opacity === 1,
              'B remains meaningful before decode',
              blocked.items[1]
            );
            await capture(blocked, 'blocked-B', [0, 1, 0]);
            const c = await at(0.9, 'blocked-C');
            check(
              !c.items[2].image.complete && c.items[2].image.visibility === 'hidden',
              'C has its own useful pending stand-in',
              c.items[2]
            );
            release.B();
            await assetsReady(['A', 'B'], 'A-B-loaded-while-C-pending');
            const withB = await take('B-arrived-while-C-current');
            verify(withB, 'B arrival keeps C current');
            const beforeDispose = await page.evaluate(() => {
              window.r2Retired = window.r2Story;
              const s = window.r2Retired;
              const old = {
                updates: s.updates,
                assetWrites: s.assetWrites,
                cVisibility: s.items[2].image.style.visibility,
              };
              s.dispose();
              return old;
            });
            release.C();
            const firstOutcome = await bounded(mountOutcome);
            if (firstOutcome.error) throw firstOutcome.error;
            await frames(page);
            const retired = await page.evaluate(() => ({
              updates: window.r2Retired.updates,
              assetWrites: window.r2Retired.assetWrites,
              cVisibility: window.r2Retired.items[2].image.style.visibility,
              disposed: window.r2Retired.disposed,
            }));
            row.retiredLifecycle = { beforeDispose, retired };
            check(
              retired.disposed &&
                retired.updates === beforeDispose.updates &&
                retired.assetWrites === beforeDispose.assetWrites &&
                retired.cVisibility === beforeDispose.cVisibility,
              'obsolete completion does not write after page disposal',
              { beforeDispose, retired }
            );
            pendingMount = mountR2Story(page, { ...config, instance: `${engine}-after-disposal` });
            await bounded(pendingMount);
            await frames(page);
            await assetsReady(['A', 'B', 'C'], 'fresh-all-images-loaded');
            initial = await take('fresh-after-disposal');
            staticTop = initial.scene.top + initial.scrollY;
            await at(0.5, 'fresh-B-after-obsolete-response');
          } else {
            const outcome = await bounded(mountOutcome);
            if (outcome.error) throw outcome.error;
            await assetsReady(
              config.kind === 'failed' ? ['A', 'C'] : ['A', 'B', 'C'],
              'successful-images-after-mount'
            );
          }
          if (initial.mode === 'static') {
            await staticChecks('static-complete');
            if (config.kind === 'reduced') {
              await page.emulateMedia({ reducedMotion: 'no-preference' });
              await page.waitForFunction(
                (wide) => window.r2Story.mode === (wide ? 'enhanced' : 'static'),
                config.width === 1280
              );
              await frames(page);
              if (config.width === 1280) {
                const normal = await take('preference-to-normal');
                staticTop = normal.scene.top + normal.scrollY;
                await at(0.5, 'normal-after-reduced');
              } else await staticChecks('narrow-stays-sequential');
              await page.emulateMedia({ reducedMotion: 'reduce' });
              await page.waitForFunction(() => window.r2Story.mode === 'static');
              await frames(page);
              await staticChecks('preference-back-to-reduced');
            }
          } else {
            const states =
              config.kind === 'ready'
                ? [...points, ...points.slice(0, -1).reverse()]
                : [points[0], points[8], points.at(-1), points[8], points[0]];
            for (const [index, point] of states.entries()) {
              const state = await at(point[0], `table-${index}-${point[0]}`, point);
              if (config.kind === 'failed' && point[0] === 0.5)
                check(
                  state.items[1].failureVisible &&
                    state.items[1].image.width === 0 &&
                    state.items[1].image.visibility === 'hidden',
                  'failed B retains B wireframe and localized notice',
                  state.items[1]
                );
            }
            if (config.kind === 'ready') {
              for (const p of [0.25, 0.325, 0.5, 0.675, 0.75]) {
                const before = await at(p, `hold-before-${p}`);
                await page.waitForTimeout(350);
                const after = await take(`hold-after-${p}`);
                verify(after, `hold-${p}`);
                check(
                  after.scrollY === before.scrollY &&
                    after.frame.progress === before.frame.progress &&
                    after.items.every((item, i) => item.opacity === before.items[i].opacity),
                  `hold-${p}: stopping holds the composition`,
                  { before, after }
                );
              }
              for (const [p, label, weights] of [
                [0, 'A', [1, 0, 0]],
                [0.325, 'A-to-B', [0.5, 0.5, 0]],
                [0.5, 'B', [0, 1, 0]],
                [0.675, 'B-to-C', [0, 0.5, 0.5]],
                [0.9, 'C', [0, 0, 1]],
              ]) {
                const state = await at(p, `paint-${label}`);
                await capture(state, label, weights);
              }
              for (const p of [0.25, 0.9, 0.25, 0, 1, 0]) {
                const before = await at(p, `large-jump-${p}`);
                await page.waitForTimeout(100);
                verify(await take(`jump-held-${p}`), `jump-held-${p}`);
                check(
                  Math.abs(before.scrollY - (staticTop + 4000 * p)) < 1,
                  'large jump reaches its authored position',
                  before.scrollY
                );
              }
              for (const p of [0, 0.325, 0.5, 0.9]) {
                await at(p, `action-at-${p}`);
                await action('#middle [data-r2-open]', `action-at-${p}`, p === 0.5);
              }
              if (config.language === 'en') {
                await at(0.25, 'real-input-start');
                const inputState = async (label) => {
                  const state = await take(label);
                  const focus = await page.evaluate(() => ({
                    tag: document.activeElement?.tagName,
                    id: document.activeElement?.id,
                    maxScroll: document.documentElement.scrollHeight - innerHeight,
                  }));
                  verify(state, label);
                  row.input.push({ label, y: state.scrollY, focus });
                  return state;
                };
                let before = await inputState('wheel-before');
                await page.mouse.move(900, 400);
                await page.mouse.wheel(0, 650);
                await page.waitForTimeout(250);
                let after = await inputState('wheel-forward');
                check(after.scrollY > before.scrollY + 100, 'real wheel advances the document', {
                  before: before.scrollY,
                  after: after.scrollY,
                });
                await page.mouse.wheel(0, -650);
                await page.waitForTimeout(250);
                before = await inputState('wheel-reverse');
                check(before.scrollY < after.scrollY - 100, 'real wheel reverses the document', {
                  before: after.scrollY,
                  after: before.scrollY,
                });
                await page.evaluate(() => document.activeElement?.blur());
                for (const key of ['PageDown', 'PageUp', 'End', 'Home']) {
                  const old = await inputState(`${key}-before`);
                  await page.keyboard.press(key);
                  await page.waitForTimeout(400);
                  const next = await inputState(`${key}-after`);
                  check(
                    key === 'PageDown'
                      ? next.scrollY > old.scrollY + 100
                      : key === 'PageUp'
                        ? next.scrollY < old.scrollY - 100
                        : key === 'Home'
                          ? next.scrollY === 0
                          : Math.abs(next.scrollY - (next.documentHeight - config.height)) < 1,
                    `${key}: real keyboard document movement`,
                    { old: old.scrollY, next: next.scrollY }
                  );
                }
                await at(0.25, 'scrollbar-start');
                const moveThumb = async (state, delta) => {
                  const thumb = (config.height * config.height) / state.documentHeight;
                  const center =
                    (state.scrollY / (state.documentHeight - config.height)) *
                      (config.height - thumb) +
                    thumb / 2;
                  await page.mouse.move(config.width - 8, center);
                  await page.mouse.down();
                  await page.mouse.move(config.width - 8, center + delta, { steps: 12 });
                  await page.mouse.up();
                  await page.waitForTimeout(200);
                  return inputState(delta > 0 ? 'scrollbar-forward' : 'scrollbar-reverse');
                };
                before = await inputState('scrollbar-before');
                after = await moveThumb(before, 130);
                const reverse = await moveThumb(after, -130);
                check(
                  after.scrollY > before.scrollY + 100 && reverse.scrollY < after.scrollY - 100,
                  'real document scrollbar moves in both directions',
                  { before: before.scrollY, after: after.scrollY, reverse: reverse.scrollY }
                );
              }
            }
            await page.evaluate((y) => scrollTo(0, y), staticTop + 4000 + config.height);
            await frames(page);
            const departure = await take('real-summary-after-zone');
            check(
              (await page.locator('#after h2').isVisible()) && departure.frame.progress === 1,
              'departure retains complete C and useful summary',
              departure
            );
            await action('#after [data-r2-open]', 'summary-action', true);
            await at(0.5, 'return-B');
            await at(0.25, 'return-A');
          }
          const final = await take('before-cleanup');
          row.nativeAvailability = {
            requested: config.context === 'zone-auto' && final.mode === 'enhanced',
            observed: final.diagnostic.native,
            supported: final.diagnostic.fixture.supported,
          };
          row.requests = requests;
          const clean = await disposeR2Story(page);
          row.clean = clean;
          check(
            clean.nodes === 0 &&
              clean.animations === 0 &&
              clean.disposed &&
              !clean.pageStyle &&
              !clean.dialog,
            'page-owned work and framework DOM are disposed',
            clean
          );
          check(!row.pageErrors.length, 'no browser exceptions', row.pageErrors);
        } catch (error) {
          row.error = error.stack || String(error);
        } finally {
          release.B();
          release.C();
          if (pendingMount)
            await bounded(pendingMount).catch((error) => {
              row.pendingError = String(error);
            });
          await page.close();
        }
        row.pass =
          !row.error &&
          !row.pendingError &&
          row.checks.length > 0 &&
          row.checks.every((check) => check.ok) &&
          row.pageErrors.length === 0;
        rows.push(row);
        await writeFile(join(output, 'results.json'), JSON.stringify(rows, null, 2));
      }
    } finally {
      await browser.close();
    }
  }
  return rows;
}
