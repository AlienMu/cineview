import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.CINEVIEW_SITE_URL ?? 'http://127.0.0.1:4174';
const output = new URL('../../output/playwright/2026-09-09-cineview-update/', import.meta.url);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
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

async function fits(locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      fits:
        rect.width > 0 &&
        rect.height > 0 &&
        rect.x >= -1 &&
        rect.y >= -1 &&
        rect.right <= innerWidth + 1 &&
        rect.bottom <= innerHeight + 1 &&
        element.scrollWidth <= element.clientWidth + 1 &&
        !element.closest('[inert], [aria-hidden="true"]'),
      rect: rect.toJSON(),
      text: element.textContent,
    };
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

async function newWindow(page, link, expected) {
  const original = page.url();
  const popupReady = page.context().waitForEvent('page');
  await link.click();
  const popup = await popupReady;
  await popup.waitForURL(expected, { waitUntil: 'commit' });
  assert.equal(page.url(), original);
  await popup.close();
}

const requested = process.env.CINEVIEW_VIEWPORT;
const viewports = requested
  ? [requested.split('x').map(Number)]
  : [
      [1440, 900],
      [390, 844],
      [390, 667],
      [844, 390],
    ];
try {
  for (const [width, height] of viewports) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: touch,
      hasTouch: touch,
    });
    // Check the real popup request without depending on GitHub's network availability.
    await context.route('https://github.com/AlienMu/cineview', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>GitHub navigation target</title>' })
    );
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(base);
      await page.waitForTimeout(1600);
      assert.equal(await page.locator('.home-debug-toggle, .cineview-perf-panel').count(), 0);
      await scrollToCinema(page);
      const iframe = page.locator('.scene5-cinema__iframe');
      const frame = await (await iframe.elementHandle()).contentFrame();
      const hint = page.locator('.scene5-cinema__drag-hint');
      await painted(hint);
      const hintRect = await hint.boundingBox();
      const phoneRect = await page.locator('.phone-mockup').boundingBox();
      assert(hintRect.x >= 0 && hintRect.x + hintRect.width < phoneRect.x);
      await painted(frame.locator('.s01-title'));
      await page.screenshot({ path: new URL(`hint-${width}x${height}.png`, output).pathname });

      await frame.evaluate(() => {
        window.acceptanceDocument = document;
      });
      await page.locator('.lang-toggle').click();
      await frame.waitForFunction(() => document.documentElement.lang === 'zh-CN');
      await page.waitForFunction(() => {
        const root = document.querySelector('[data-cineview-container]');
        return root.scrollTop >= root.scrollHeight - root.clientHeight - 1;
      });
      assert(await frame.evaluate(() => window.acceptanceDocument === document));
      assert.equal(
        await frame.locator('.drag-temporal').getAttribute('data-embed'),
        'deferred-live'
      );
      assert.equal(await hint.getAttribute('data-dismissed'), 'false');
      await gesture(page, iframe, true);
      assert.equal(await hint.getAttribute('data-dismissed'), 'true');
      assert.equal(await frame.locator('[role="status"]').textContent(), '2 / 5');
      await gesture(page, iframe, false);
      assert.equal(await frame.locator('[role="status"]').textContent(), '1 / 5');
      await frame.locator('[data-cineview-container]').focus();
      await frame.locator('[data-cineview-container]').press('End');
      await painted(frame.locator('.s05-the-end'));
      await painted(page.locator('.scene5-cinema__cta'));
      assert.equal(await frame.locator('[role="status"]').textContent(), '5 / 5');
      for (const locator of [
        page.locator('.scene5-cinema__text-col'),
        frame.locator('.s05-the-end'),
      ]) {
        const geometry = await fits(locator);
        assert(geometry.fits, JSON.stringify(geometry));
      }
      await page.screenshot({
        path: new URL(`closing-zh-${width}x${height}.png`, output).pathname,
      });
      await page.locator('.lang-toggle').click();
      await frame.waitForFunction(() => document.documentElement.lang === 'en');
      assert(await frame.evaluate(() => window.acceptanceDocument === document));
      assert.equal(await frame.locator('[role="status"]').textContent(), '5 / 5');
      await painted(frame.locator('.s05-the-end'));
      for (const locator of [
        page.locator('.scene5-cinema__text-col'),
        frame.locator('.s05-the-end'),
      ]) {
        const geometry = await fits(locator);
        assert(geometry.fits, JSON.stringify(geometry));
      }
      await page.screenshot({
        path: new URL(`closing-en-${width}x${height}.png`, output).pathname,
      });
      assert.equal(await frame.locator('.s05-curtain-call a, .s05-curtain-call button').count(), 0);
      await newWindow(page, page.locator('.scene5-cinema__btn--primary'), /\/docs\/03-quickstart$/);
      assert(await frame.evaluate(() => window.acceptanceDocument === document));
      await page.mouse.move(12, 200);
      for (let step = 0; step < 12; step++) {
        await page.mouse.wheel(0, -3000);
        await page.waitForTimeout(140);
      }
      await page.waitForTimeout(1600);
      if (width === 1440) {
        const rail = page.locator('[data-cineview-scrollbar-rail]');
        const bounds = await rail.boundingBox();
        // Scrollbar input follows the same zone-boundary ordering as wheel input.
        for (let step = 0; step < 20; step++) {
          await rail.click({ position: { x: bounds.width / 2, y: bounds.height - 1 } });
          await page.waitForTimeout(100);
          if (
            await page
              .locator('[data-cineview-container]')
              .first()
              .evaluate((root) => root.scrollTop >= root.scrollHeight - root.clientHeight - 1)
          )
            break;
        }
        await page.waitForFunction(() => {
          const root = document.querySelector('[data-cineview-container]');
          return root.scrollTop >= root.scrollHeight - root.clientHeight - 1;
        });
      }
      await scrollToCinema(page);
      await painted(hint);
      assert.equal(await hint.getAttribute('data-dismissed'), 'false');
      assert.deepEqual(errors, []);
      results.push({ viewport: `${width}x${height}`, touch, passed: true });
      console.log('PASS', `${width}x${height}`);
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
  await painted(page.locator('.s05-the-end'));
  assert.equal(await page.locator('[role="status"]').textContent(), '5 / 5');
  await page.screenshot({ path: new URL('standalone-drag-closing.png', output).pathname });
  for (const fixture of ['horizontal-scroll', 'video-drag']) {
    await page.goto(`${base}/__acceptance/${fixture}?debug=true`);
    const panel = page.locator('.cineview-perf-panel');
    await panel.waitFor();
    assert.equal(await panel.evaluate((node) => getComputedStyle(node).position), 'fixed');
    await page.screenshot({ path: new URL(`debug-${fixture}.png`, output).pathname });
  }
  await page.goto(`${base}/docs`);
  assert.equal(await page.locator('.docs-shell__demo, .docs-toc__end').count(), 0);
  assert((await page.locator('.docs-code button').count()) > 0);
  await page.screenshot({ path: new URL('docs.png', output).pathname });
  results.push({ debugAndDocs: true });
} finally {
  writeFileSync(
    new URL(
      requested ? `results-${requested}${touch ? '-touch' : ''}.json` : 'results.json',
      output
    ),
    `${JSON.stringify(results, null, 2)}\n`
  );
  await browser.close();
}
