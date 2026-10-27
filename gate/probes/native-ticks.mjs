import { chromium } from 'playwright';
// During a synthesized constant-speed touch scroll: frames displayed per second, and whether
// the compositor (impl thread) or Blink (main thread) is ticking the scroll-driven animations.
const browser = await chromium.launch({ channel: 'chrome' });
const rows = [];
for (const [label, impl, config] of [
  ['v2 native', 'v2', { mode: 'scroll', scenes: 5, animations: 16 }],
  ['v2 fallback', 'v2', { mode: 'scroll', scenes: 5, animations: 16, fallback: true }],
  ['v1', 'v1', { mode: 'scroll', scenes: 5, animations: 16 }],
]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.goto(`http://127.0.0.1:4360/${impl === 'v1' ? 'v1/index.html' : 'v2.html'}`);
  await page.evaluate((c) => window.mountFixture(c), config);
  await page.waitForFunction(() => window.audit.ready);
  await page.waitForTimeout(800);
  await browser.startTracing(page, { categories: ['cc', 'viz', 'benchmark', 'blink.animations', 'devtools.timeline', 'disabled-by-default-cc.debug'] });
  const t0 = Date.now();
  await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 600, yDistance: -1500, speed: 1000, gestureSourceType: 'touch' });
  const ms = Date.now() - t0;
  const events = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  const count = (re) => events.filter((e) => re.test(e.name)).length;
  const names = {};
  for (const e of events) if (/Animat|ScrollTimeline/i.test(e.name)) names[e.name] = (names[e.name] || 0) + 1;
  rows.push({ label, gestureMs: ms, displayed: count(/^Display::FrameDisplayed$/), mainFrames: count(/^BeginMainThreadFrame$/), implAnimTicks: count(/TickAnimations|AnimateLayers/), names: JSON.stringify(names).slice(0, 300) });
  await context.close();
}
await browser.close();
console.table(rows.map(({ names, ...r }) => r));
for (const r of rows) console.log(r.label, r.names);
