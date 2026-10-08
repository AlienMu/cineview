import { chromium } from 'playwright';
// Reproduce the hybrid-routing hang and pause the renderer to read the looping stack.
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Debugger.enable');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(`timeout: ${label}`)), ms))]);
async function stack() {
  const paused = new Promise((r) => cdp.once('Debugger.paused', r));
  await cdp.send('Debugger.pause');
  const e = await withTimeout(paused, 5000, 'pause');
  console.log('STACK', e.callFrames.slice(0, 8).map((f) => `${f.functionName || '(anon)'} @ ${f.url.split('/').slice(-2).join('/')}:${f.location.lineNumber + 1}`).join('\n  '));
}
try {
  await page.goto('http://127.0.0.1:4360/v2.html');
  await withTimeout(page.evaluate((n) => window.mountFixture({ mode: 'scroll', scenes: 5, animations: n }), Number(process.argv[2] || 64)), 60000, 'mount');
  await withTimeout(page.evaluate(() => new Promise((r) => { const c = () => (window.audit.ready ? r() : setTimeout(c, 50)); c(); })), 120000, 'ready');
  console.log('ready ok');
  await browser.startTracing(page, { categories: ['benchmark', 'cc', 'viz', 'blink.user_timing', 'disabled-by-default-devtools.timeline.frame'] });
  for (const [i, d] of [-1200, -1200, 1200, 1200].entries()) {
    await withTimeout(cdp.send('Input.synthesizeScrollGesture', { x: 195, y: d < 0 ? 700 : 150, yDistance: d, speed: 1200, gestureSourceType: 'touch' }), 20000, `gesture ${i}`);
    await new Promise((r) => setTimeout(r, 500));
    console.log('gesture', i, 'ok', await withTimeout(page.evaluate(() => scrollY), 5000, `evaluate ${i}`));
  }
  await withTimeout(browser.stopTracing(), 20000, 'stopTracing');
  await withTimeout(page.evaluate(() => scrollY), 5000, 'after-gesture evaluate');
  console.log('no hang at N=' + (process.argv[2] || 64));
} catch (err) {
  console.log(String(err));
  await stack().catch((e) => console.log('pause failed', String(e)));
}
await browser.close();
