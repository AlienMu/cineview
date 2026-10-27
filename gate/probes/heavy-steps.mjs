import { chromium } from 'playwright';
// Replay the harness steps on fixture (c) with per-step timing and timeouts to find the blocking step.
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const T = Date.now();
const step = async (label, p, ms = 60000) => {
  const t = Date.now();
  try {
    const v = await Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('TIMEOUT')), ms))]);
    console.log(`${label.padEnd(26)} ok   ${Date.now() - t} ms`);
    return v;
  } catch (e) {
    console.log(`${label.padEnd(26)} FAIL ${e.message} after ${Date.now() - t} ms`);
    throw e;
  }
};
try {
  await step('throttle', cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }));
  await step('goto', page.goto('http://127.0.0.1:4360/v1/heavy.html'));
  await step('mount', page.evaluate(() => window.mountFixture({ mode: 'drag', scenes: 20, animations: 16, copy: 40 })));
  await step('ready', page.evaluate(() => new Promise((r) => { const c = () => (window.audit.ready ? r() : setTimeout(c, 50)); c(); })));
  await step('settle 1200', new Promise((r) => setTimeout(r, 1200)));
  await step('startTracing', browser.startTracing(page, { categories: ['benchmark', 'cc', 'viz', 'blink.user_timing', 'disabled-by-default-devtools.timeline.frame'] }));
  for (let i = 0; i < 4; i++) {
    const d = i < 2 ? -615 : 615;
    await step(`gesture ${i}`, cdp.send('Input.synthesizeScrollGesture', { x: 195, y: d < 0 ? 700 : 150, yDistance: d, speed: 1500, gestureSourceType: 'touch' }));
    await step(`index ${i}`, page.evaluate(() => window.audit.api?.getCurrentIndex?.()));
  }
  const buf = await step('stopTracing', browser.stopTracing(), 120000);
  console.log('trace bytes', buf.length);
} catch {}
console.log('total', Date.now() - T, 'ms');
await browser.close();
