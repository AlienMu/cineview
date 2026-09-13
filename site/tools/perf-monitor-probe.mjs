#!/usr/bin/env node
/**
 * Performance monitoring probe for concurrent scroll animations
 * Measures rAF P95 and long tasks during active scrolling
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const base = process.env.CINEVIEW_SITE_URL ?? 'http://127.0.0.1:4174';
const output = new URL('../../output/perf-probe/', import.meta.url);
mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.addInitScript(() => {
  window.__longTasks = [];
  window.__rafTimestamps = [];

  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch (e) {
      console.warn('PerformanceObserver longtask not supported', e);
    }
  }

  const rawRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    window.__rafTimestamps.push(performance.now());
    return rawRaf(cb);
  };
});

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// Clear metrics before scrolling
await page.evaluate(() => {
  window.__rafTimestamps = [];
  window.__longTasks = [];
});

console.log('Starting scroll performance test...');
const scrollStart = Date.now();

// Perform continuous scrolling
await page.mouse.move(720, 450);
for (let i = 0; i < 50; i++) {
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(16);
}

await page.waitForTimeout(500);
const scrollElapsed = Date.now() - scrollStart;

const metrics = await page.evaluate(() => {
  const rafTimes = window.__rafTimestamps;
  const deltas = [];
  for (let i = 1; i < rafTimes.length; i++) {
    deltas.push(rafTimes[i] - rafTimes[i - 1]);
  }
  deltas.sort((a, b) => a - b);

  const p50 = deltas[Math.floor(deltas.length * 0.50)] ?? 0;
  const p95 = deltas[Math.floor(deltas.length * 0.95)] ?? 0;
  const p99 = deltas[Math.floor(deltas.length * 0.99)] ?? 0;
  const max = deltas[deltas.length - 1] ?? 0;

  const longTasks = window.__longTasks ?? [];
  const longTaskDurations = longTasks.map(t => t.duration).sort((a, b) => a - b);

  return {
    rafCount: rafTimes.length,
    rafP50: p50,
    rafP95: p95,
    rafP99: p99,
    rafMax: max,
    longTaskCount: longTasks.length,
    longTaskMax: longTaskDurations[longTaskDurations.length - 1] ?? 0,
    longTasks: longTasks,
  };
});

const result = {
  timestamp: new Date().toISOString(),
  baseUrl: base,
  scrollDurationMs: scrollElapsed,
  wheelEvents: 50,
  metrics,
  verdict: {
    rafP95Pass: metrics.rafP95 < 25,
    longTaskPass: metrics.longTaskMax < 200,
    overall: metrics.rafP95 < 25 && metrics.longTaskMax < 200,
  },
};

console.log('\n=== Performance Results ===');
console.log(`Scroll duration: ${scrollElapsed}ms (50 wheel events)`);
console.log(`rAF samples: ${metrics.rafCount}`);
console.log(`rAF P50: ${metrics.rafP50.toFixed(2)}ms`);
console.log(`rAF P95: ${metrics.rafP95.toFixed(2)}ms`);
console.log(`rAF P99: ${metrics.rafP99.toFixed(2)}ms`);
console.log(`rAF Max: ${metrics.rafMax.toFixed(2)}ms`);
console.log(`Long tasks: ${metrics.longTaskCount}`);
console.log(`Long task max: ${metrics.longTaskMax.toFixed(2)}ms`);
console.log(`\nVerdict: ${result.verdict.overall ? 'PASS' : 'FAIL'}`);
console.log(`  rAF P95 < 25ms: ${result.verdict.rafP95Pass ? 'PASS' : 'FAIL'}`);
console.log(`  Long task < 200ms: ${result.verdict.longTaskPass ? 'PASS' : 'FAIL'}`);

const outPath = new URL('perf-metrics.json', output).pathname;
writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`\nResults written to: ${outPath}`);

await browser.close();
process.exit(result.verdict.overall ? 0 : 1);
