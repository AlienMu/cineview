#!/usr/bin/env node
/**
 * Standalone drag route acceptance
 * Tests /#/drag route functionality and performance
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = process.env.CINEVIEW_SITE_URL ?? 'http://127.0.0.1:4174';
const output = new URL('../../output/drag-acceptance/', import.meta.url);
mkdirSync(output, { recursive: true });

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

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const results = { tests: [], errors: [] };
page.on('pageerror', (error) => results.errors.push(error.message));

await page.addInitScript(() => {
  window.__dragRafTimestamps = [];
  const rawRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    window.__dragRafTimestamps.push(performance.now());
    return rawRaf(cb);
  };
});

console.log('Testing /#/drag route...');
await page.goto(`${base}/drag`, { waitUntil: 'domcontentloaded' });
await painted(page.locator('.s01-title'));
await page.screenshot({ path: new URL('drag-scene-01.png', output).pathname });

assert.equal(await page.locator('[role="status"]').textContent(), '1 / 5');
results.tests.push({ test: 'initial-scene', passed: true });

// Navigate to end with keyboard
await page.locator('[data-cineview-container]').focus();
await page.evaluate(() => { window.__dragRafTimestamps = []; });

await page.locator('[data-cineview-container]').press('End');
await painted(page.locator('.s05-actions'));
await page.waitForTimeout(500);

assert.equal(await page.locator('[role="status"]').textContent(), '5 / 5');
await page.screenshot({ path: new URL('drag-scene-05.png', output).pathname });
results.tests.push({ test: 'keyboard-navigation-to-end', passed: true });

// Check rAF metrics during transition
const rafMetrics = await page.evaluate(() => {
  const times = window.__dragRafTimestamps;
  const deltas = [];
  for (let i = 1; i < times.length; i++) {
    deltas.push(times[i] - times[i - 1]);
  }
  deltas.sort((a, b) => a - b);
  return {
    count: times.length,
    p95: deltas[Math.floor(deltas.length * 0.95)] ?? 0,
    max: deltas[deltas.length - 1] ?? 0,
  };
});

results.tests.push({
  test: 'drag-animation-performance',
  rafCount: rafMetrics.count,
  rafP95: rafMetrics.p95,
  rafMax: rafMetrics.max,
  passed: rafMetrics.p95 < 30,
});

// Test mouse drag interaction
await page.locator('[data-cineview-container]').press('Home');
await page.waitForTimeout(800);
await painted(page.locator('.s01-title'));
assert.equal(await page.locator('[role="status"]').textContent(), '1 / 5');

const container = await page.locator('[data-cineview-container]').boundingBox();
const startY = container.y + container.height * 0.6;
const endY = container.y + container.height * 0.1;

await page.mouse.move(container.x + container.width / 2, startY);
await page.mouse.down();
await page.mouse.move(container.x + container.width / 2, endY, { steps: 20 });
await page.mouse.up();
await page.waitForTimeout(800);

const afterDrag = await page.locator('[role="status"]').textContent();
const sceneNum = parseInt(afterDrag.split('/')[0].trim());
assert(sceneNum >= 2, `Drag should advance scene, got: ${afterDrag}`);
results.tests.push({ test: 'mouse-drag-gesture', sceneAfterDrag: sceneNum, passed: true });

await page.screenshot({ path: new URL('drag-after-gesture.png', output).pathname });

console.log('\n=== Drag Route Acceptance ===');
console.log(`Tests passed: ${results.tests.filter(t => t.passed).length}/${results.tests.length}`);
console.log(`Page errors: ${results.errors.length}`);
console.log(`rAF P95 during animation: ${rafMetrics.p95.toFixed(2)}ms`);
console.log(`Scene after drag: ${sceneNum}/5`);

const outPath = new URL('results.json', output).pathname;
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`\nResults: ${outPath}`);

await browser.close();
process.exit(results.errors.length > 0 || !results.tests.every(t => t.passed) ? 1 : 0);
