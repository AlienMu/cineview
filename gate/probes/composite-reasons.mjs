import { chromium } from 'playwright';
// Why are native scroll-driven animations not composited? Read Blink's per-animation failure reasons.
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.goto('http://127.0.0.1:4360/v2.html');
await browser.startTracing(page, { categories: ['devtools.timeline', 'blink.animations', 'disabled-by-default-devtools.timeline', 'cc', 'benchmark'] });
await page.evaluate((c) => window.mountFixture(c), { mode: 'scroll', scenes: 2, animations: 4 });
await page.waitForFunction(() => window.audit.ready);
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(60); }
const events = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
const anim = events.filter((e) => e.name === 'Animation' || /composit/i.test(e.name));
const shapes = {};
for (const e of anim) { const k = e.name + '|' + e.ph + '|' + Object.keys(e.args || {}).join(',') + '|' + Object.keys(e.args?.data || {}).join(','); shapes[k] = (shapes[k] || 0) + 1; }
console.log(shapes);
const withFail = anim.filter((e) => e.args?.data && ('compositeFailed' in e.args.data || 'unsupportedProperties' in e.args.data));
console.log('with failure fields', withFail.length, JSON.stringify(withFail.slice(0, 4).map((e) => e.args.data)));
const reasons = {};
for (const e of anim) {
  const d = e.args?.data;
  if (!d) continue;
  const key = JSON.stringify({ compositeFailed: d.compositeFailed, unsupported: d.unsupportedProperties });
  reasons[key] = (reasons[key] || 0) + 1;
}
console.log('animation events', anim.length, reasons);
console.log(JSON.stringify(anim.filter((e) => e.args?.data).slice(0, 3).map((e) => e.args), null, 0).slice(0, 1200));
await browser.close();
