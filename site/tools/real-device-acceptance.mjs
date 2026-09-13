#!/usr/bin/env node
/**
 * Real-device acceptance for drag/scroll paths
 * Focuses on the main viewport tests, skips debug fixtures that may not exist
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.CINEVIEW_SITE_URL ?? 'http://127.0.0.1:4174';
const output = new URL('../../output/acceptance-run/', import.meta.url);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const results = [];
const touch = process.env.CINEVIEW_TOUCH === '1';

async function painted(locator) {
  await locator.waitFor();
  await locator.evaluate(async (element) => {
    const deadline = performance.now() + 16000;
    while (performance.now() < deadline) {
      let opacity = 1;
      for (let node = element; node; node = node.parentElement) {
        opacity *= Number(getComputedStyle(node).opacity);
      }
      if (opacity > 0.98 && !element.closest('[inert]')) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Not painted: ${element.className}`);
  });
}

async function scrollToCinema(page) {
  await page.mouse.move(12, 200);
  for (let step = 0; step < 45; step++) {
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(140);
    const atEnd = await page
      .locator('[data-cineview-container]')
      .first()
      .evaluate((root) => root.scrollTop >= root.scrollHeight - root.clientHeight - 1);
    if (atEnd) break;
  }
  await page.locator('.scene5-cinema__iframe-slot.is-live iframe').waitFor();
}

async function gesture(page, iframe, forward) {
  const rect = await iframe.boundingBox();
  assert(rect);
  const x = rect.x + rect.width * 0.04;
  const y = rect.y + rect.height * (forward ? 0.65 : 0.2);
  const end = rect.y + rect.height * (forward ? 0.05 : 0.9);
  if (touch) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 12; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y + ((end - y) * step) / 12 }],
      });
      await page.waitForTimeout(20);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, end, { steps: 20 });
    await page.mouse.up();
  }
  await page.waitForTimeout(1100);
}

const viewports = [
  [1440, 900],
  [390, 844],
];

try {
  for (const [width, height] of viewports) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: touch,
      hasTouch: touch,
    });
    const page = await context.newPage();
    const errors = [];
    const rafMetrics = [];

    page.on('pageerror', (error) => errors.push(error.message));

    await page.addInitScript(() => {
      const raw = window.requestAnimationFrame.bind(window);
      window.__rafTimes = [];
      window.requestAnimationFrame = (cb) => {
        window.__rafTimes.push(performance.now());
        return raw(cb);
      };
    });

    try {
      await page.goto(base);
      await page.waitForTimeout(1600);

      await page.evaluate(() => {
        window.__rafTimes = [];
      });

      await scrollToCinema(page);
      const iframe = page.locator('.scene5-cinema__iframe');
      const frame = await (await iframe.elementHandle()).contentFrame();
      const hint = page.locator('.scene5-cinema__drag-hint');
      await painted(hint);
      await painted(frame.locator('.s01-title'));

      await page.screenshot({ path: new URL(`hint-${width}x${height}.png`, output).pathname });

      await gesture(page, iframe, true);
      assert.equal(await frame.locator('[role="status"]').textContent(), '2 / 5');

      await gesture(page, iframe, false);
      assert.equal(await frame.locator('[role="status"]').textContent(), '1 / 5');

      await frame.locator('[data-cineview-container]').focus();
      await frame.locator('[data-cineview-container]').press('End');
      await painted(frame.locator('.s05-actions'));
      assert.equal(await frame.locator('[role="status"]').textContent(), '5 / 5');

      await page.screenshot({ path: new URL(`closing-${width}x${height}.png`, output).pathname });

      const rafSamples = await page.evaluate(() => window.__rafTimes);
      const deltas = [];
      for (let i = 1; i < rafSamples.length; i++) {
        deltas.push(rafSamples[i] - rafSamples[i - 1]);
      }
      deltas.sort((a, b) => a - b);
      const p95Index = Math.floor(deltas.length * 0.95);
      const rafP95 = deltas.length > 0 ? deltas[p95Index] : 0;

      rafMetrics.push({
        viewport: `${width}x${height}`,
        sampleCount: rafSamples.length,
        rafP95,
        maxDelta: deltas.length > 0 ? deltas[deltas.length - 1] : 0,
      });

      assert.deepEqual(errors, []);
      results.push({
        viewport: `${width}x${height}`,
        touch,
        passed: true,
        rafP95,
        rafSampleCount: rafSamples.length,
      });
      console.log(`PASS ${width}x${height} | rAF P95: ${rafP95.toFixed(2)}ms`);
    } catch (error) {
      await page.screenshot({ path: new URL(`failure-${width}x${height}.png`, output).pathname });
      results.push({
        viewport: `${width}x${height}`,
        passed: false,
        error: error.message,
        pageErrors: errors,
      });
      throw error;
    } finally {
      await context.close();
    }
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${base}/drag`);
  await painted(page.locator('.s01-title'));
  await page.locator('[data-cineview-container]').focus();
  await page.locator('[data-cineview-container]').press('End');
  await painted(page.locator('.s05-actions'));
  assert.equal(await page.locator('[role="status"]').textContent(), '5 / 5');
  await page.screenshot({ path: new URL('standalone-drag-closing.png', output).pathname });

  await page.goto(`${base}/docs`);
  assert((await page.locator('.docs-code button').count()) > 0);
  await page.screenshot({ path: new URL('docs.png', output).pathname });
  results.push({ dragStandalone: true, docs: true });
} finally {
  writeFileSync(
    new URL('results.json', output),
    `${JSON.stringify(results, null, 2)}\n`
  );
  await browser.close();
}
