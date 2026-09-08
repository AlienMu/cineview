import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(new URL('../site/package.json', import.meta.url));
const { chromium } = require('playwright');
const origin = process.argv[2];
assert(origin, 'Pass the actual site URL printed by Vite.');
const output = path.resolve('output/playwright/horizontal-scroll');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { origin, runs: [] };

async function readState(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-cineview-container="true"]');
    const rect = (node) => {
      if (!node) return null;
      const value = node.getBoundingClientRect();
      return {
        left: value.left,
        top: value.top,
        width: value.width,
        height: value.height,
        bottom: value.bottom,
      };
    };
    const shell = document.querySelector('[data-cineview-takeover-shell]');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      offset: root.scrollLeft,
      maxOffset: root.scrollWidth - root.clientWidth,
      slots: [...document.querySelectorAll('[data-scene-index]')].map((slot) => ({
        width: slot.getBoundingClientRect().width,
        childWidth: slot.firstElementChild.getBoundingClientRect().width,
        left: slot.getBoundingClientRect().left + root.scrollLeft,
      })),
      flow: rect(document.querySelector('[data-flow-content]')),
      zone: {
        start: Number(shell.dataset.cineviewTakeoverSegmentStart),
        end: Number(shell.dataset.cineviewTakeoverSegmentEnd),
        budget: Number(shell.dataset.cineviewTakeoverTotalDistancePx),
        progressPx: Number(shell.dataset.cineviewTakeoverProgressPx),
        rect: rect(shell),
      },
      fixed: rect(document.querySelector('[data-horizontal-fixed]')),
      animations: [...document.querySelectorAll('[data-horizontal-animation]')].map((node) =>
        Number(getComputedStyle(node.closest('[data-cineview-animate-id]')).opacity)
      ),
      rail: rect(document.querySelector('[role="scrollbar"]')),
    };
  });
}

const closeTo = (actual, expected, label, tolerance = 1) =>
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`
  );

async function frame(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );
}

async function wheel(page, delta) {
  await page.mouse.move(100, 300);
  await page.mouse.wheel(delta, 0);
  await frame(page);
  return readState(page);
}

async function checkLayout(page, width, screenSizing) {
  await page.waitForFunction(
    () => document.querySelector('[data-horizontal-fixture]')?.dataset.ready === 'true'
  );
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector('[data-cineview-takeover-shell]')?.dataset
          .cineviewTakeoverTotalDistancePx
      ) === 1200
  );
  await frame(page);
  const state = await readState(page);
  const ordinaryWidths = [
    width,
    screenSizing ? width : width / 2,
    screenSizing ? Math.max(width, 320) : 320,
    width * 1.3,
  ];
  ordinaryWidths.forEach((expected, index) => {
    closeTo(state.slots[index].width, expected, `scene ${index} outer width`);
    closeTo(state.slots[index].childWidth, expected, `scene ${index} inner width`);
  });
  closeTo(state.flow.width, width * 0.75, 'ordinary percentage child');
  closeTo(
    state.slots[2].left,
    ordinaryWidths[0] + ordinaryWidths[1] + width * 0.75,
    'ordinary child contributes to document flow'
  );
  closeTo(state.slots[4].width, width + 1200, 'zone uses viewport plus authored duration');
  closeTo(state.zone.end - state.zone.start, 1200, '1ms authored duration equals 1px scroll');
  assert(
    state.rail.top >= 0 && state.rail.bottom <= state.viewport.height + 1,
    'horizontal scrollbar is inside viewport'
  );
  closeTo(state.rail.bottom, state.viewport.height, 'horizontal scrollbar sits at bottom');
  return state;
}

try {
  for (const [width, height, sizing, zone] of [
    [1200, 800, 'content', 'full'],
    [390, 844, 'content', 'full'],
    [1200, 800, 'screen', 'narrow'],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.__CINEVIEW_SCROLL_DEBUG__ = true;
    });
    await page.goto(`${origin}/__acceptance/horizontal-scroll?sizing=${sizing}&zone=${zone}`);
    const run = { width, height, sizing, zone, checks: [] };
    report.runs.push(run);
    run.initial = await checkLayout(page, width, sizing === 'screen');
    run.checks.push(
      'percentage, fixed, intrinsic, ordinary-child, zone-budget and scrollbar geometry'
    );

    let state = await wheel(page, 100000);
    // Percentage layout can put the boundary on a half pixel; native scrollLeft
    // rounds the requested first interior pixel to the device's scroll grid.
    closeTo(
      state.zone.progressPx,
      1,
      'large forward input preserves first interior zone frame',
      0.51
    );
    closeTo(state.offset, state.zone.start + 1, 'zone start maps to native horizontal offset');
    run.firstInterior = { offset: state.offset, progressPx: state.zone.progressPx };
    state = await wheel(page, 299);
    closeTo(state.zone.progressPx, 300, 'horizontal wheel advances authored milliseconds');
    const fixedAtQuarter = state.fixed;
    assert(
      state.animations.length === 4 &&
        state.animations.every((opacity) => opacity > 0 && opacity < 1),
      'all concurrent animations are live'
    );
    state = await wheel(page, 300);
    closeTo(state.zone.progressPx, 600, 'zone midpoint');
    assert(state.fixed && fixedAtQuarter, 'scene fixed layer is mounted');
    closeTo(state.fixed.left, fixedAtQuarter.left, 'scene fixed layer stays horizontally stable');
    assert(state.fixed.left >= 0 && state.fixed.left < width, 'scene fixed layer is visible');
    run.midpoint = {
      offset: state.offset,
      progressPx: state.zone.progressPx,
      fixed: state.fixed,
      animations: state.animations,
    };
    await page.screenshot({ path: path.join(output, `${width}-${sizing}-${zone}-midpoint.png`) });
    run.checks.push(
      'large forward wheel, 1px first frame, concurrent animations, stable scene fixed layer'
    );

    const root = page.locator('[data-cineview-container="true"]');
    await root.focus();
    await page.keyboard.press('ArrowDown');
    await frame(page);
    let next = await readState(page);
    assert(
      next.zone.progressPx > state.zone.progressPx,
      'container keyboard advances horizontal scroll'
    );
    state = next;
    await page.evaluate(() => {
      document.querySelector('[data-cineview-container="true"]').scrollLeft += 53;
    });
    await frame(page);
    next = await readState(page);
    closeTo(next.zone.progressPx - state.zone.progressPx, 53, 'native scrollbar reconciliation');
    state = next;

    const rail = page.getByRole('scrollbar', { name: 'Horizontal acceptance scroll' });
    await rail.focus();
    await page.keyboard.press('ArrowDown');
    await frame(page);
    next = await readState(page);
    assert(next.zone.progressPx > state.zone.progressPx, 'scrollbar keyboard advances');
    await page.keyboard.press('ArrowUp');
    await frame(page);
    state = await readState(page);
    assert(state.zone.progressPx < next.zone.progressPx, 'scrollbar keyboard reverses');

    const thumb = page.locator('[data-cineview-scrollbar-thumb="true"]');
    const thumbBox = await thumb.boundingBox();
    assert(thumbBox, 'visible scrollbar thumb');
    await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(thumbBox.x + thumbBox.width / 2 + 8, thumbBox.y + thumbBox.height / 2);
    await page.mouse.up();
    await frame(page);
    next = await readState(page);
    assert(next.offset > state.offset, 'scrollbar thumb drag changes native horizontal offset');
    run.checks.push('container keyboard, native scroll, scrollbar keyboard and pointer drag');

    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: width - 70, y: 360 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: width - 130, y: 360 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await frame(page);
    state = await readState(page);
    assert(state.offset > next.offset, 'horizontal touch advances scroll');
    run.checks.push('trusted horizontal touch');

    state = await wheel(page, 100000);
    closeTo(state.zone.progressPx, 1200, 'zone reaches authored end');
    state = await wheel(page, -100000);
    closeTo(
      state.zone.progressPx,
      1199,
      'large reverse input preserves last interior zone frame',
      0.51
    );
    state = await wheel(page, -100000);
    closeTo(state.zone.progressPx, 0, 'zone returns to authored start');
    state = await wheel(page, -100000);
    closeTo(state.offset, 0, 'reverse scroll returns to document start');
    run.checks.push('large reverse input and full round trip');

    const resizedWidth = width === 1200 ? 900 : 430;
    await page.setViewportSize({ width: resizedWidth, height });
    run.resized = await checkLayout(page, resizedWidth, sizing === 'screen');
    run.checks.push('viewport resize recomputes percentage and intrinsic widths');
    assert.deepEqual(errors, [], 'browser page errors');
    await page.screenshot({ path: path.join(output, `${width}-${sizing}-${zone}.png`) });
    await context.close();
  }
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error.stack;
  throw error;
} finally {
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  console.log(
    JSON.stringify({
      passed: report.passed,
      runs: report.runs.length,
      report: path.join(output, 'report.json'),
    })
  );
}
