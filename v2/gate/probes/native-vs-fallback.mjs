import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
for (const fallback of [false, true]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4360/v2.html');
  await page.evaluate((c) => window.mountFixture(c), { mode: 'scroll', scenes: 3, animations: 8, workload: 'mix', fallback });
  await page.waitForFunction(() => window.audit.ready);
  const read = () => page.evaluate(() => [...document.querySelectorAll('cv-scene')[0].querySelectorAll('cv-animate')].slice(0, 4).map((a) => ({
    fx: a.getAttribute('fx'),
    layers: [...a.shadowRoot.querySelectorAll('.l')].map((l) => ({
      part: l.getAttribute('part'),
      anims: l.getAnimations().map((x) => `${x.timeline?.constructor?.name}:${x.playState}`),
      opacity: getComputedStyle(l).opacity, translate: getComputedStyle(l).translate, filter: getComputedStyle(l).filter, clip: getComputedStyle(l).clipPath,
    })),
  })));
  const before = await read();
  await page.mouse.wheel(0, 400); await page.waitForTimeout(500);
  const mid = await read();
  console.log(JSON.stringify({ fallback, before, mid }, null, 0));
  await context.close();
}
await browser.close();
