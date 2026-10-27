import { chromium, webkit } from 'playwright';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const frames = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      )
  );
const clamp = (value) => Math.max(0, Math.min(1, value));
const copy = {
  en: {
    heading: 'From material to an explanation',
    intro: 'Collect material, highlight details, and review the explanation.',
    steps: ['Collect material', 'Highlight details', 'Review the explanation'],
    action: 'Get started',
    received: 'Action received',
  },
  'zh-CN': {
    heading: '从资料到说明',
    intro: '收集资料、标记重点，再查看对应说明。',
    steps: ['收集资料', '标记重点', '查看说明'],
    action: '开始使用',
    received: '已收到操作',
  },
};

/** Shared illustrative opening material; options only adapt this test page. */
export function publicHeroMaterial(
  language = 'en',
  { narrow = false, presentation = 'enhanced', height = 800 } = {}
) {
  const text = copy[language];
  if (!text) throw Error(`Unknown profile language: ${language}`);
  let html = `<section class="r1-opening">
              <h1 data-r1-static>${text.heading}</h1><p data-r1-static>${text.intro}</p>
              <button id="r1-action" type="button">${text.action}</button><output id="r1-result"></output>
              <figure><div class="r1-diagram" role="img" aria-label="${text.intro}">
                <svg width="960" height="180" viewBox="0 0 960 180" aria-hidden="true">
                  <g fill="#f8f3e9" stroke="#173c38" stroke-width="2">
                    <rect x="0" y="20" width="220" height="140" rx="8"/>
                    <rect x="360" y="20" width="220" height="140" rx="8"/>
                    <rect x="720" y="20" width="220" height="140" rx="8"/>
                  </g><g fill="#173c38" font-family="system-ui,sans-serif" font-size="19" text-anchor="middle">
                    ${text.steps.map((step, i) => `<text data-r1-static x="${110 + i * 360}" y="96">${step}</text>`).join('')}
                  </g></svg>
                <cv-animate id="r1-link-a" name="first-link" fx="draw" duration="650" ease="linear" margin="0">
                  <svg width="960" height="180" viewBox="0 0 960 180" aria-hidden="true"><path d="M220 90H360" fill="none" stroke="#306558" stroke-width="5"/></svg>
                </cv-animate>
                <cv-animate id="r1-link-b" fx="draw" after="first-link" duration="650" ease="linear" margin="0">
                  <svg width="960" height="180" viewBox="0 0 960 180" aria-hidden="true"><path d="M580 90H720" fill="none" stroke="#306558" stroke-width="5"/></svg>
                </cv-animate>
              </div><figcaption data-r1-static>${text.steps.join(' → ')}</figcaption></figure>
            </section>`;
  let css = `.r1-opening{min-height:800px;padding:48px 64px;background:#e9e3d6;color:#172b29}
              .r1-opening h1{font-size:44px;margin:0 0 16px}.r1-opening p{margin:0 0 24px}
              .r1-opening button{height:48px;padding:0 24px;background:#173c38;color:#f3eddc;font:inherit;border:0;border-radius:6px}
              .r1-opening output{margin-left:20px}.r1-opening figure{margin:40px 0 0}
              .r1-diagram{position:relative;width:960px;height:180px}.r1-diagram>svg{display:block}
              .r1-diagram cv-animate{position:absolute;inset:0;display:block;pointer-events:none}
              .r1-opening figcaption{margin-top:16px}.r1-following{min-height:800px;padding:80px 64px}`;
  if (presentation === 'default') {
    html = html
      .replace(
        /<cv-animate id="r1-link-([ab])"[^>]*>/g,
        '<div id="r1-link-$1" class="r1-connection">'
      )
      .replaceAll('</cv-animate>', '</div>');
    css +=
      '.r1-diagram .r1-connection{position:absolute;inset:0;display:block;pointer-events:none}';
  }
  if (narrow) {
    const first = html.indexOf('<div class="r1-diagram"');
    const last = html.indexOf('</div><figcaption', first) + '</div>'.length;
    html =
      html.slice(0, first) +
      `<ol class="r1-process">${text.steps.map((step) => `<li data-r1-static>${step}</li>`).join('')}</ol>` +
      html.slice(last);
    css += `.r1-opening{min-height:${height}px;padding:32px}.r1-opening h1{font-size:32px}
      .r1-process{list-style:none;padding:0;margin:0;max-width:100%}.r1-process li{position:relative;padding:24px;border:2px solid #173c38;border-radius:8px;background:#f8f3e9;font-size:19px}
      .r1-process li+li{margin-top:26px}.r1-process li+li::before{content:"";position:absolute;left:50%;top:-28px;height:26px;border-left:3px solid #306558}`;
  } else if (height !== 800) css += `.r1-opening{min-height:${height}px}`;
  return { text, html, css };
}

export function publicHeroCases() {
  return ['en', 'zh-CN'].flatMap((language) =>
    [false, true].map((reduced) => ({ language, reduced }))
  );
}

/** The guide's R1 opening, separate from the existing R2/R3 protocol and default queue. */
export async function runPublicHero({
  base,
  output = 'review/my-public-hero',
  engines = ['chromium', 'webkit'],
  cases = publicHeroCases(),
} = {}) {
  if (!base) throw Error('An explicit served V2 fixture base is required');
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output);
  await copyFile(new URL(import.meta.url), join(output, 'runner-used.mjs.txt'));
  await writeFile(
    join(output, 'execution.json'),
    JSON.stringify(
      {
        started: new Date().toISOString(),
        pid: process.pid,
        base,
        engines,
        cases,
        scope: 'R1 functional authoring profile; no standard or performance runs.',
      },
      null,
      2
    )
  );
  const rows = [];
  for (const engine of engines) {
    const launcher = { chromium, webkit }[engine];
    if (!launcher) throw Error(`Engine is outside this profile: ${engine}`);
    const browser = await launcher.launch(engine === 'chromium' ? { channel: 'chrome' } : {});
    try {
      for (const config of cases) {
        const text = copy[config.language];
        if (!text) throw Error(`Unknown profile language: ${config.language}`);
        const page = await browser.newPage({
          viewport: { width: 1280, height: 800 },
          hasTouch: false,
          reducedMotion: config.reduced ? 'reduce' : 'no-preference',
        });
        const row = {
          engine,
          version: browser.version(),
          base,
          config,
          profileId: 'AUTH-PUB-DA-R1-DRAW',
          checks: [],
          samples: [],
          actions: [],
          screenshots: [],
          pageErrors: [],
        };
        const check = (ok, label, detail) =>
          row.checks.push({ ok: !!ok, label, ...(detail === undefined ? {} : { detail }) });
        page.on('pageerror', (error) => row.pageErrors.push(error.message));
        const take = async (label) => {
          await frames(page);
          const state = await page.evaluate(() => {
            const stage = document.querySelector('cv-stage'),
              hero = document.querySelector('#before');
            const visible = (el) => {
              const bounds = el.getBoundingClientRect(),
                css = getComputedStyle(el);
              return {
                text: el.textContent,
                bounds: bounds.toJSON(),
                opacity: +css.opacity,
                display: css.display,
                visibility: css.visibility,
                hit: el.contains(
                  document.elementFromPoint(
                    bounds.left + bounds.width / 2,
                    bounds.top + bounds.height / 2
                  )
                ),
              };
            };
            return {
              clock: stage.clock.now(),
              paused: stage.paused,
              current: stage.current,
              viewport: [innerWidth, innerHeight],
              dpr: devicePixelRatio,
              scrollY,
              hero: hero.getBoundingClientRect().toJSON(),
              total: hero.solution.total,
              language: document.documentElement.lang,
              reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
              bootOffset: stage.bootOffset,
              input: stage.input,
              zone: hero.hasAttribute('zone'),
              content: [...hero.querySelectorAll('[data-r1-static]')].map(visible),
              button: {
                ...visible(hero.querySelector('button')),
                disabled: hero.querySelector('button').disabled,
              },
              actions: window.r1State.actions,
              links: [...hero.querySelectorAll('cv-animate')].map((a) => {
                const path = a.querySelector('path'),
                  css = getComputedStyle(path);
                return {
                  id: a.id,
                  on: a.getAttribute('on'),
                  solved: a.solved,
                  frame: { ...a.timeline.frame },
                  phase: a.timeline.phase,
                  host: a.getBoundingClientRect().toJSON(),
                  path: path.getBoundingClientRect().toJSON(),
                  pathLength: path.getAttribute('pathLength'),
                  geometryLength: path.getTotalLength(),
                  dash: css.strokeDasharray,
                  offset: Number.parseFloat(css.strokeDashoffset),
                  stroke: css.stroke,
                  width: css.strokeWidth,
                  strokeOpacity: +css.strokeOpacity,
                  opacity: +css.opacity,
                  visibility: css.visibility,
                  layers: a.layers.map((l) => ({
                    source: l.source,
                    used: [...l.used],
                    native: !!l.native,
                  })),
                  animations: a.getAnimations({ subtree: true }).map((animation) => ({
                    currentTime: animation.currentTime,
                    playState: animation.playState,
                    pending: animation.pending,
                  })),
                };
              }),
              errors: bench.snapshot().errors,
            };
          });
          Object.assign(state, { label });
          row.samples.push(state);
          return state;
        };
        const staticChecks = (state) => {
          check(
            state.content.length === 6 &&
              state.content.every(
                (item) =>
                  item.bounds.width > 0 &&
                  item.bounds.height > 0 &&
                  item.bounds.left >= 0 &&
                  item.bounds.top >= 0 &&
                  item.bounds.right <= 1280 &&
                  item.bounds.bottom <= 800 &&
                  item.opacity === 1 &&
                  item.display !== 'none' &&
                  item.visibility === 'visible'
              ),
            'complete purpose and three-step diagram remain readable',
            state.content
          );
          check(
            !state.button.disabled &&
              state.button.hit &&
              state.button.opacity === 1 &&
              state.button.bounds.top >= 0 &&
              state.button.bounds.bottom <= 800 &&
              state.button.text === text.action,
            'primary action is visible and receives input',
            state.button
          );
          check(
            state.links.every((link) => link.on === null),
            'ordinary entrances use the existing default source'
          );
          check(
            state.links.length === 2 &&
              state.links.map((link) => link.id).join(',') === 'r1-link-a,r1-link-b' &&
              state.links.every(
                (link) =>
                  Math.abs(link.geometryLength - 140) < 0.01 &&
                  Math.abs(link.path.width - 140) < 0.01 &&
                  link.host.width === 960 &&
                  link.host.height === 180 &&
                  link.stroke !== 'none' &&
                  Number.parseFloat(link.width) > 0 &&
                  link.strokeOpacity === 1 &&
                  link.opacity === 1 &&
                  link.visibility === 'visible'
              ),
            'both authored connections retain their stroke material and geometry',
            state.links
          );
          check(!state.errors.length, 'no cv-error at this state', state.errors);
        };
        const capture = async (label) => {
          const path = join(
            output,
            `${engine}-${config.language}-${config.reduced ? 'reduced' : 'normal'}-${label}.png`
          );
          await page.screenshot({ path });
          row.screenshots.push({ label, path });
        };
        const activate = async (keyboard) => {
          const before = await page.evaluate(() => window.r1State.actions);
          if (keyboard) {
            await page.locator('#r1-action').focus();
            await page.keyboard.press('Enter');
          } else await page.locator('#r1-action').click();
          const after = await page.evaluate(() => window.r1State.actions);
          row.actions.push({ keyboard, before, after });
          check(
            after === before + 1,
            'native primary action responds before waiting for decoration',
            row.actions.at(-1)
          );
        };
        try {
          await page.goto(`${base}/combinations.html`);
          await page.waitForFunction(() => window.fixtureReady);
          row.modules = await page
            .locator('script[src]')
            .evaluateAll((nodes) => nodes.map((node) => node.src));
          await page.evaluate(
            async ({ text, language, material }) => {
              const pending = bench.mount({ ids: [], context: 'enter-fallback', exits: false });
              const stage = document.querySelector('cv-stage');
              stage.pause();
              const controller = new AbortController();
              window.r1State = {
                actions: 0,
                controller,
                previousLanguage: document.documentElement.lang,
              };
              document.documentElement.lang = language;
              document.querySelector('#before').innerHTML = material.html;
              document.querySelector('#middle').innerHTML =
                `<section class="r1-following"><h2>${text.steps[0]}</h2><p>${text.intro}</p></section>`;
              document.querySelector('#after').innerHTML =
                `<section class="r1-following"><h2>${text.steps[2]}</h2><p>${text.intro}</p></section>`;
              const style = document.createElement('style');
              style.textContent = material.css;
              stage.append(style);
              document.querySelector('#r1-action').addEventListener(
                'click',
                () => {
                  window.r1State.actions++;
                  document.querySelector('#r1-result').textContent =
                    `${text.received} ${window.r1State.actions}`;
                },
                { signal: controller.signal }
              );
              await pending;
            },
            { text, language: config.language, material: publicHeroMaterial(config.language) }
          );
          await page.waitForFunction(
            () => document.querySelector('#r1-link-a').timeline.phase !== 'idle'
          );
          const initial = await take('initial');
          check(
            initial.paused &&
              initial.current === 0 &&
              initial.input === 'scroll' &&
              !initial.zone &&
              initial.bootOffset === 0 &&
              initial.viewport.join(',') === '1280,800' &&
              initial.dpr === 1 &&
              initial.hero.top === 0 &&
              initial.language === config.language &&
              initial.reduced === config.reduced,
            'first-screen ordinary entrance is prepared with a held document Clock',
            initial
          );
          staticChecks(initial);
          await activate(false);
          await activate(true);
          await capture('initial');
          const origin = initial.clock;
          if (config.reduced) {
            check(
              initial.links.every(
                (link) =>
                  link.offset === 0 &&
                  link.dash === 'none' &&
                  !link.layers.some((layer) => layer.used.includes('draw'))
              ),
              'reduced motion keeps complete connections without the draw effect',
              initial.links
            );
          } else {
            check(
              initial.total === 1300 &&
                initial.links[0].solved.start === 0 &&
                initial.links[0].solved.end === 650 &&
                initial.links[1].solved.start === 650 &&
                initial.links[1].solved.end === 1300,
              'two sequential entrances solve to the authored windows',
              initial.links
            );
            check(
              initial.links.every(
                (link) =>
                  Math.abs(link.offset - 1.001) < 0.001 && Math.abs(link.frame.progress) < 1e-12
              ),
              'held first-screen entrances start with both connections undrawn',
              initial.links
            );
            for (const target of [325, 650, 975, 1400]) {
              await page.evaluate(() => document.querySelector('cv-stage').play());
              await page.waitForFunction(
                ({ origin, target }) =>
                  document.querySelector('cv-stage').clock.now() - origin >= target,
                { origin, target },
                { timeout: 6000 }
              );
              await page.evaluate(() => document.querySelector('cv-stage').pause());
              const state = await take(`clock-${target}`),
                elapsed = state.clock - origin;
              state.elapsed = elapsed;
              staticChecks(state);
              for (let i = 0; i < 2; i++) {
                const progress = clamp((elapsed - i * 650) / 650),
                  link = state.links[i];
                const dash = link.dash
                  .split(/[,\s]+/)
                  .filter(Boolean)
                  .map(Number.parseFloat);
                check(
                  link.pathLength === '1' &&
                    Math.abs(link.geometryLength - 140) < 0.01 &&
                    dash.length === 2 &&
                    dash[0] === 1 &&
                    dash[1] === 2 &&
                    Math.abs(link.path.width - 140) < 0.01 &&
                    link.host.width === 960 &&
                    link.host.height === 180 &&
                    Math.abs(link.offset - 1.001 * (1 - progress)) < 0.003 &&
                    Math.abs(link.frame.progress - progress) < 0.003 &&
                    link.layers.some(
                      (layer) => layer.source === 'enter' && layer.used.includes('draw')
                    ),
                  'SVG stroke and public frame match independently elapsed Clock time',
                  { elapsed, progress, link }
                );
              }
              await page.waitForTimeout(180);
              const held = await take(`held-${target}`);
              // Clock.now recomputes paused time; floating subtraction can change its last bits.
              check(
                Math.abs(held.clock - state.clock) < 1e-9 &&
                  held.links.every((link, i) => link.offset === state.links[i].offset),
                'pausing holds the displayed connections and Clock',
                { before: state, after: held }
              );
              if (target === 325 || target === 1400) await capture(String(target));
            }
          }
          const complete = await take('complete');
          check(
            complete.links.every((link) => Math.abs(link.offset) < 0.003),
            'complete process connections remain visible',
            complete.links
          );
          await page.mouse.move(1100, 600);
          await page.mouse.wheel(0, 1000);
          await page.waitForFunction(() => scrollY >= 800);
          const away = await take('wheel-away');
          await page.locator('#r1-action').evaluate((el) => el.blur());
          await page.keyboard.press('Home');
          await page.waitForFunction(() => scrollY === 0);
          const returned = await take('keyboard-return');
          staticChecks(returned);
          check(
            away.hero.bottom <= 0 && returned.links.every((link) => Math.abs(link.offset) < 0.003),
            'actual document input leaves and restores the completed non-replay opening',
            { away, returned }
          );
          await activate(true);
          await capture('returned');
        } catch (error) {
          row.error = error.stack;
        } finally {
          try {
            row.listenerCleanup = await page.evaluate(() => {
              window.r1State?.controller.abort();
              const aborted = window.r1State?.controller.signal.aborted ?? false;
              if (window.r1State) document.documentElement.lang = window.r1State.previousLanguage;
              return { aborted };
            });
          } catch (error) {
            row.listenerCleanupError = error.stack;
          }
          try {
            await page.evaluate(() => bench.unmount());
          } catch (error) {
            row.unmountError = error.stack;
          }
          try {
            await frames(page);
            row.cleanup = await page.evaluate(() => bench.snapshot());
          } catch (error) {
            row.cleanupSnapshotError = error.stack;
          }
          try {
            await page.close();
          } catch (error) {
            row.closeError = error.stack;
          }
          check(
            row.listenerCleanup?.aborted &&
              row.cleanup?.nodes === 0 &&
              row.cleanup?.animations === 0,
            'cleanup releases the page listener, nodes and animations',
            { listener: row.listenerCleanup, snapshot: row.cleanup }
          );
          check(!row.pageErrors.length, 'no uncaught page exceptions', row.pageErrors);
          row.finalizationErrors = [
            'listenerCleanupError',
            'unmountError',
            'cleanupSnapshotError',
            'closeError',
          ].filter((key) => row[key]);
          row.pass =
            !row.error && !row.finalizationErrors.length && row.checks.every((item) => item.ok);
          rows.push(row);
          await writeFile(join(output, 'results.json'), JSON.stringify(rows, null, 2));
          console.log(
            `${row.pass ? 'PASS' : 'FAIL'} ${engine} R1 ${config.language} ${config.reduced ? 'reduced' : 'normal'}`
          );
        }
      }
    } finally {
      try {
        await browser.close();
      } catch (error) {
        await writeFile(join(output, `${engine}-close-error.txt`), error.stack);
        throw error;
      }
    }
  }
  return rows;
}
