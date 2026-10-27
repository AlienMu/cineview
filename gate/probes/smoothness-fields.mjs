import { chromium } from 'playwright';
// PipelineReporter fields during a synthesized gesture, to define a smoothness metric valid for both
// compositor-driven (2.0 native) and main-thread-driven (1.x, 2.0 fallback, drag) animation.
const browser = await chromium.launch({ channel: 'chrome' });
for (const [label, impl, config] of [
  ['v2 native', 'v2', { mode: 'scroll', scenes: 5, animations: 64 }],
  ['v2 fallback', 'v2', { mode: 'scroll', scenes: 5, animations: 64, fallback: true }],
  ['v1', 'v1', { mode: 'scroll', scenes: 5, animations: 64 }],
]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(`http://127.0.0.1:4360/${impl === 'v1' ? 'v1/index.html' : 'v2.html'}`);
  await page.evaluate((c) => window.mountFixture(c), config);
  await page.waitForFunction(() => window.audit.ready, {}, { timeout: 60000 });
  await page.waitForTimeout(800);
  await browser.startTracing(page, { categories: ['cc', 'viz', 'benchmark'] });
  await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 600, yDistance: -1500, speed: 1000, gestureSourceType: 'touch' });
  const events = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  const tally = {};
  for (const e of events) {
    if (e.name !== 'PipelineReporter' || e.ph !== 'b' || !e.args?.frame_reporter) continue;
    const r = e.args.frame_reporter;
    const key = `${r.state}|smooth=${r.affects_smoothness}|scroll=${r.scroll_state}|comp=${r.has_compositor_animation}|main=${r.has_main_animation}`;
    tally[key] = (tally[key] || 0) + 1;
  }
  const displayed = events.filter((e) => e.name === 'Display::FrameDisplayed').length;
  console.log(label, 'displayed', displayed);
  console.log(Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `  ${v}\t${k}`).join('\n'));
  await context.close();
}
await browser.close();
