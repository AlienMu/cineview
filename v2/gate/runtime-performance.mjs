import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import { INIT } from './harness.mjs';

const launchers = { chromium, webkit };
const contexts = ['drag', 'zone-auto', 'zone-fallback', 'enter-auto', 'enter-fallback'];
const defaultCases = [
  ...contexts.map((context) => ({
    context,
    variant: 'loop-overlap',
  })),
  { context: 'drag', variant: 'clock-chain' },
  { context: 'enter-fallback', variant: 'after-offscreen' },
  { context: 'zone-fallback', variant: 'view-ranges-split' },
];

/** Explicitly selected performance cases for the accepted loop compositions. */
export function loopPerformanceCases() {
  return [
    ...['sway, spin', 'spin, sway'].flatMap((loop, order) =>
      contexts.map((context) => ({
        id: `loop-periods/${order + 1}/${context}`,
        profileId: 'AUTH-LOOP-OWN-PERIODS',
        context,
        variant: 'loop-overlap',
        loop,
        loopDuration: null,
        activeMs: 8100,
      }))
    ),
    ...[
      'hue(90deg), wipe(left), hue(180deg), wipe(right)',
      'wipe(right), hue(180deg), wipe(left), hue(90deg)',
    ].flatMap((loop, order) =>
      contexts.map((context) => ({
        id: `loop-owners/${order + 1}/${context}`,
        profileId: 'AUTH-LAST-OWNER-CLIP-VAR',
        context,
        variant: 'loop-overlap',
        loop,
        loopDuration: 1000,
        consumeHue: true,
        activeMs: 1100,
      }))
    ),
  ];
}

const inspect = (page) =>
  page.evaluate(() => {
    const stage = document.querySelector('cv-stage');
    return {
      fixture: bench.snapshot(),
      clock: stage.clock.now(),
      paused: stage.paused,
      loops: [...document.querySelectorAll('#middle cv-animate')].map((a) => {
        const style = a.loopLayer ? getComputedStyle(a.loopLayer.el) : null;
        return {
          id: a.id,
          active: a.looping,
          periods: a.loopItems.map((item) => item.duration),
          rotate: style?.rotate,
          clip: style?.clipPath,
          hue: style?.getPropertyValue('--cv-hue'),
        };
      }),
    };
  });

/** Serial samples of repaired paths; these small fixtures are not the full performance matrix. */
export async function runRuntimePerformance({
  base,
  output,
  engines = ['chromium', 'webkit'],
  rounds = 3,
  duration = 400,
  cases = defaultCases,
  captureState = false,
}) {
  await mkdir(output, { recursive: true });
  const rows = [];
  const environment = {
    base,
    viewport: { width: 1280, height: 800 },
    dpr: 1,
    touch: false,
    node: process.version,
    platform: os.platform(),
    release: os.release(),
    cpu: os.cpus()[0]?.model,
    cores: os.cpus().length,
    memory: os.totalmem(),
    engines: {},
  };
  for (const engine of engines) {
    const browser = await launchers[engine].launch(
      engine === 'chromium' ? { channel: 'chrome' } : {}
    );
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        hasTouch: false,
      });
      await page.addInitScript(INIT);
      await page.goto(`${base}/combinations.html`);
      await page.waitForFunction(() => window.fixtureReady);
      await page.evaluate(() => startMeasure());
      await page.waitForTimeout(1000);
      environment.engines[engine] = {
        version: browser.version(),
        calibration: await page.evaluate(() => stopMeasure()),
      };
      await writeFile(join(output, 'environment.json'), JSON.stringify(environment, null, 2));
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      for (let round = 1; round <= rounds; round++)
        for (const config of cases) {
          pageErrors.length = 0;
          await page.evaluate((config) => bench.mount({ ids: [], ...config }), config);
          if (config.loop !== undefined) {
            await page.evaluate((config) => {
              const a = document.querySelector('#pair');
              a.setAttribute('loop', config.loop);
              if (config.loopDuration === null) a.removeAttribute('loop-duration');
              else a.setAttribute('loop-duration', String(config.loopDuration));
              if (config.consumeHue)
                a.firstElementChild.innerHTML =
                  'Loop output <span style="display:block;width:20px;height:20px;background:black;transform:rotate(var(--cv-hue,0deg))"></span>';
            }, config);
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve))
                  )
                )
            );
          }
          await page.evaluate(() => bench.goTo('middle'));
          if (config.loop !== undefined)
            await page.waitForFunction(() => document.querySelector('#pair')?.looping);
          const row = { engine, round, ...config, captureState, phases: [] };
          for (const phase of ['active', 'paused', 'resumed', 'departure']) {
            const requestedMs = phase === 'active' ? (config.activeMs ?? duration) : duration;
            await page.evaluate(
              ({ phase, captureState }) => {
                if (phase === 'paused') bench.pause();
                if (phase === 'resumed') bench.play();
                if (phase === 'departure') bench.goTo('after');
                if (!captureState) startMeasure();
              },
              { phase, captureState }
            );
            const before = captureState ? await inspect(page) : undefined;
            if (captureState) await page.evaluate(() => startMeasure());
            if (config.variant === 'view-ranges-split' && phase !== 'departure') {
              await page.evaluate(async (duration) => {
                const start = performance.now();
                await new Promise((resolve) => {
                  const tick = (at) => {
                    const progress = Math.min(1, (at - start) / duration);
                    scrollTo(0, 800 + 300 * progress);
                    if (progress < 1) requestAnimationFrame(tick);
                    else resolve();
                  };
                  requestAnimationFrame(tick);
                });
              }, requestedMs);
            } else await page.waitForTimeout(requestedMs);
            const metrics = await page.evaluate(() => stopMeasure());
            const after = captureState ? await inspect(page) : undefined;
            row.phases.push({
              phase,
              requestedMs,
              ...(captureState ? { before, after } : {}),
              ...metrics,
              loaf50: metrics.supported.loaf ? metrics.loaf50 : null,
              loafMax: metrics.supported.loaf ? metrics.loafMax : null,
              loafBlocking: metrics.supported.loaf ? metrics.loafBlocking : null,
              loafNoScriptMax: metrics.supported.loaf ? metrics.loafNoScriptMax : null,
              longTasks: metrics.supported.longtask ? metrics.longTasks : null,
              longMax: metrics.supported.longtask ? metrics.longMax : null,
            });
          }
          row.errors = [...(await page.evaluate(() => bench.snapshot())).errors, ...pageErrors];
          await page.evaluate(() => bench.unmount());
          row.cleanup = await page.evaluate(() => bench.snapshot());
          row.clean = row.cleanup.nodes === 0 && row.cleanup.animations === 0 && !row.errors.length;
          rows.push(row);
          await writeFile(join(output, 'results.json'), JSON.stringify(rows, null, 2));
          console.log(`MEASURED ${engine} ${round} ${config.context} ${config.variant}`);
        }
    } finally {
      await browser.close();
    }
  }
  return rows;
}
