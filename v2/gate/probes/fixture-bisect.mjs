import { chromium } from 'playwright';
// Bisect the real 2.0 fixture: which runtime feature turns document scrolling into main-thread scrolling?
const browser = await chromium.launch({ channel: 'chrome' });
async function run(label, config, prep) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.goto('http://127.0.0.1:4360/v2.html');
  await page.evaluate((c) => window.mountFixture(c), config);
  await page.waitForFunction(() => window.audit.ready);
  if (prep) await page.evaluate(prep);
  await page.waitForTimeout(600);
  await browser.startTracing(page, { categories: ['cc', 'benchmark'] });
  await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 600, yDistance: -1200, speed: 1000, gestureSourceType: 'touch' });
  const events = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  const states = {};
  for (const e of events) if (e.name === 'PipelineReporter' && e.ph === 'b' && e.args?.frame_reporter) { const s = e.args.frame_reporter.scroll_state; states[s] = (states[s] || 0) + 1; }
  console.log(label.padEnd(34), JSON.stringify(states));
  await context.close();
}
await run('fixture N=4', { mode: 'scroll', scenes: 3, animations: 4 });
await run('fixture N=4, no window scroll listener', { mode: 'scroll', scenes: 3, animations: 4 }, () => { const s = document.querySelector('cv-stage'); window.removeEventListener('scroll', s.onScroll); });
await run('fixture N=4, animations cancelled', { mode: 'scroll', scenes: 3, animations: 4 }, () => { for (const a of document.querySelectorAll('cv-animate')) a.cancelNatives(); });
await run('fixture N=0', { mode: 'scroll', scenes: 3, animations: 0 });
await browser.close();
