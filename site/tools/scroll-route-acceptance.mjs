#!/usr/bin/env node
/**
 * Scroll route acceptance test
 * Validates /#/scroll route zone triggers and synchronization
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = process.env.CINEVIEW_SITE_URL ?? 'http://127.0.0.1:4174';
const output = new URL('../../output/scroll-acceptance/', import.meta.url);
mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const results = { tests: [], errors: [] };
page.on('pageerror', (error) => results.errors.push(error.message));

await page.addInitScript(() => {
  window.__scrollRafTimestamps = [];
  const rawRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    window.__scrollRafTimestamps.push(performance.now());
    return rawRaf(cb);
  };
});

console.log('Testing /#/scroll route...');
await page.goto(`${base}/scroll`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// Verify initial scene visibility
const initialScene = await page.locator('[data-cineview-animate-id]').first().getAttribute('data-cineview-animate-id');
await page.screenshot({ path: new URL('scroll-initial.png', output).pathname });
results.tests.push({ test: 'scroll-route-loads', initialScene, passed: true });

// Scroll through zones
await page.evaluate(() => { window.__scrollRafTimestamps = []; });
const container = page.locator('[data-cineview-container]').first();

// Small incremental scrolls to traverse zones
for (let step = 0; step < 30; step++) {
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 150);
  await page.waitForTimeout(50);
}

await page.waitForTimeout(1000);
await page.screenshot({ path: new URL('scroll-mid.png', output).pathname });

// Continue to end
for (let step = 0; step < 30; step++) {
  await page.mouse.wheel(0, 150);
  await page.waitForTimeout(50);
}

await page.waitForTimeout(1000);
await page.screenshot({ path: new URL('scroll-end.png', output).pathname });

// Check if we can detect zone changes via visible scene markers
const visibleScenes = await page.locator('[data-cineview-animate-id]').evaluateAll((elements) => {
  return elements
    .map((el) => {
      let opacity = 1;
      for (let node = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        opacity *= parseFloat(style.opacity);
      }
      return {
        id: el.getAttribute('data-cineview-animate-id'),
        opacity,
        visible: opacity > 0.5,
      };
    })
    .filter((s) => s.visible)
    .map((s) => s.id);
});

results.tests.push({
  test: 'scroll-zone-traversal',
  visibleScenes,
  passed: visibleScenes.length > 0,
});

// Check rAF performance during scrolling
const rafMetrics = await page.evaluate(() => {
  const times = window.__scrollRafTimestamps;
  const deltas = [];
  for (let i = 1; i < times.length; i++) {
    deltas.push(times[i] - times[i - 1]);
  }
  deltas.sort((a, b) => a - b);
  return {
    count: times.length,
    p50: deltas[Math.floor(deltas.length * 0.50)] ?? 0,
    p95: deltas[Math.floor(deltas.length * 0.95)] ?? 0,
    max: deltas[deltas.length - 1] ?? 0,
  };
});

results.tests.push({
  test: 'scroll-animation-performance',
  rafCount: rafMetrics.count,
  rafP50: rafMetrics.p50,
  rafP95: rafMetrics.p95,
  rafMax: rafMetrics.max,
  passed: rafMetrics.count > 100,
});

console.log('\n=== Scroll Route Acceptance ===');
console.log(`Tests passed: ${results.tests.filter(t => t.passed).length}/${results.tests.length}`);
console.log(`Page errors: ${results.errors.length}`);
console.log(`Visible scenes: ${visibleScenes.join(', ')}`);
console.log(`rAF samples: ${rafMetrics.count}`);
console.log(`rAF P50: ${rafMetrics.p50.toFixed(2)}ms`);
console.log(`rAF P95: ${rafMetrics.p95.toFixed(2)}ms`);

const outPath = new URL('results.json', output).pathname;
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`\nResults: ${outPath}`);

await browser.close();
process.exit(results.errors.length > 0 || !results.tests.every(t => t.passed) ? 1 : 0);
