import { chromium } from 'playwright';
// Does the way the harness waits for readiness change Chrome's scroll classification?
const browser = await chromium.launch({ channel: 'chrome' });
async function run(label, wait) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.goto('http://127.0.0.1:4360/v2.html');
  await page.evaluate(() => window.mountFixture({ mode: 'scroll', scenes: 3, animations: 0 }));
  await wait(page);
  await page.waitForTimeout(600);
  await browser.startTracing(page, { categories: ['cc', 'benchmark'] });
  await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 600, yDistance: -1200, speed: 1000, gestureSourceType: 'touch' });
  const events = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  const states = {};
  for (const e of events) if (e.name === 'PipelineReporter' && e.ph === 'b' && e.args?.frame_reporter) { const s = e.args.frame_reporter.scroll_state; states[s] = (states[s] || 0) + 1; }
  console.log(label.padEnd(36), JSON.stringify(states));
  await context.close();
}
await run('waitForFunction (raf polling)', (p) => p.waitForFunction(() => window.audit.ready));
await run('waitForFunction (100ms polling)', (p) => p.waitForFunction(() => window.audit.ready, {}, { polling: 100 }));
await run('fixed 500ms wait', (p) => p.waitForTimeout(500));
await run('evaluate await cv-ready', (p) => p.evaluate(() => window.audit.ready || new Promise((r) => document.querySelector('cv-stage').addEventListener('cv-ready', r, { once: true }))));
await browser.close();
