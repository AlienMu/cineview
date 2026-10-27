import { chromium } from 'playwright';
// Which frame events does this Chrome emit? Used to pick the dropped-frame metric for the gate.
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.goto('http://127.0.0.1:4360/v2.html');
await page.evaluate((c) => window.mountFixture(c), { mode: 'scroll', scenes: 3, animations: 16, workload: 'mix' });
await page.waitForFunction(() => window.audit.ready);
await browser.startTracing(page, { categories: ['benchmark', 'disabled-by-default-devtools.timeline.frame', 'devtools.timeline', 'cc', 'viz', 'gpu'] });
for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(50); }
await page.waitForTimeout(500);
const buf = await browser.stopTracing();
const events = JSON.parse(buf.toString()).traceEvents;
const counts = {};
for (const e of events) if (/Frame|Pipeline|Drop|Present/i.test(e.name)) counts[e.name] = (counts[e.name] || 0) + 1;
console.log(counts);
for (const name of ['PipelineReporter', 'DroppedFrame', 'FramePresented', 'BeginFrame', 'DrawFrame']) {
  const list = events.filter((e) => e.name === name);
  console.log(name, list.length, JSON.stringify(list.slice(0, 2).map((e) => ({ ph: e.ph, cat: e.cat, args: e.args }))).slice(0, 500));
}
await browser.close();
