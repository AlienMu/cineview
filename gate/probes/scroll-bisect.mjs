import { chromium } from 'playwright';
// Which structure makes Chrome scroll the document on the main thread?
const browser = await chromium.launch({ channel: 'chrome' });
for (const v of ['vt-flow', 'css-sd', 'vt-sticky', 'vt-sticky-cover']) {
  for (const throttle of [4]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.goto(`http://127.0.0.1:4360/bisect.html?v=${v}`);
    await page.waitForTimeout(800);
    await browser.startTracing(page, { categories: ['cc', 'benchmark', 'input', 'disabled-by-default-cc.debug.scheduler'] });
    await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 600, yDistance: -1200, speed: 1000, gestureSourceType: 'touch' });
    const events = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
    const states = {};
    for (const e of events) if (e.name === 'PipelineReporter' && e.ph === 'b' && e.args?.frame_reporter) { const s = e.args.frame_reporter.scroll_state; states[s] = (states[s] || 0) + 1; }
    const reasons = new Set();
    for (const e of events) { const j = JSON.stringify(e.args || {}); const m = j.match(/main_thread_scroll(?:ing)?_reasons?[^,}]*[,}]/gi); if (m) m.forEach((x) => reasons.add(x)); }
    console.log(v, 'throttle', throttle, JSON.stringify(states), [...reasons].slice(0, 5).join(' '));
    await context.close();
  }
}
await browser.close();
