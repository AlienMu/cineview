import { chromium } from 'playwright';
// Start from the compositor-scrolling bisect page, apply pieces of the v2 fixture until scrolling flips to main thread.
const browser = await chromium.launch({ channel: 'chrome' });
const FIXTURE_CSS = '.grid{height:100%;padding:40px;display:grid;gap:2px}.cell{background:#b3ded6;height:100%;width:100%;min-height:4px}';
async function run(label, url, step) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.goto(url);
  await page.waitForTimeout(500);
  if (step) await page.evaluate(step, FIXTURE_CSS);
  await page.waitForTimeout(500);
  await browser.startTracing(page, { categories: ['cc', 'benchmark'] });
  await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 600, yDistance: -1200, speed: 1000, gestureSourceType: 'touch' });
  const events = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  const states = {};
  for (const e of events) if (e.name === 'PipelineReporter' && e.ph === 'b' && e.args?.frame_reporter) { const s = e.args.frame_reporter.scroll_state; states[s] = (states[s] || 0) + 1; }
  console.log(label.padEnd(40), JSON.stringify(states));
  await context.close();
}
const base = 'http://127.0.0.1:4360/bisect.html?v=stage-empty';
await run('bisect stage-empty', base);
await run('+ fixture CSS', base, (css) => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); });
await run('+ grid divs in scenes', base, (css) => {
  const s = document.createElement('style'); s.textContent = css; document.head.append(s);
  for (const sc of document.querySelectorAll('cv-scene')) sc.innerHTML = '<div class="grid" style="background:#23314c;grid-template-columns:repeat(2,minmax(0,1fr))"></div>';
});
await run('v2.html mountFixture N=0', 'http://127.0.0.1:4360/v2.html', () => window.mountFixture({ mode: 'scroll', scenes: 3, animations: 0 }));
await run('v2.html mountFixture N=0 zone off', 'http://127.0.0.1:4360/v2.html', () => window.mountFixture({ mode: 'scroll', scenes: 3, animations: 0, driver: 'clock' }));
await browser.close();
