import { chromium } from 'playwright';

// Real-browser smoke check of the 2.0 prototype: readiness, native vs fallback writes, drag paging.
export async function smoke(base = 'http://127.0.0.1:4360') {
  const browser = await chromium.launch({ channel: 'chrome' });
  const out = {};
  try {
    for (const [name, config] of [
      ['scroll-native', { mode: 'scroll', scenes: 3, animations: 4 }],
      ['scroll-fallback', { mode: 'scroll', scenes: 3, animations: 4, fallback: true }],
      ['scroll-mix', { mode: 'scroll', scenes: 3, animations: 8, workload: 'mix' }],
      ['drag', { mode: 'drag', scenes: 3, animations: 4 }],
    ]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(`${base}/v2.html`);
      await page.evaluate((c) => window.mountFixture(c), config);
      await page.waitForFunction(() => window.audit.ready, {}, { timeout: 15000 });
      const probe = () => page.evaluate(() => {
        const a = document.querySelector('cv-animate');
        const layers = [...a.shadowRoot.querySelectorAll('.l')].map((l) => getComputedStyle(l));
        const scene = document.querySelector('cv-scene');
        return {
          index: window.audit.api.getCurrentIndex(),
          sceneHeight: scene.getBoundingClientRect().height,
          natives: document.getAnimations().length,
          first: layers.map((c) => ({ opacity: c.opacity, translate: c.translate, scale: c.scale, filter: c.filter, clip: c.clipPath })),
          ready: Math.round(window.audit.readyAt - window.audit.mountStart),
          errors: window.audit.errors,
        };
      });
      const before = await probe();
      let after;
      if (config.mode === 'scroll') {
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(400);
        after = await probe();
      } else {
        const cdp = await context.newCDPSession(page);
        const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y, id: 1 }] });
        await touch('touchStart', 700);
        for (let i = 1; i <= 12; i++) { await touch('touchMove', 700 - i * 40); await page.waitForTimeout(16); }
        await touch('touchEnd');
        await page.waitForTimeout(1200);
        after = await probe();
      }
      out[name] = { before, after, errors };
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await smoke(), null, 1));
}
