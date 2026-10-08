import { chromium } from 'playwright';
// Direct check of fixture (c) pages: errors, readiness time, without the full harness.
const browser = await chromium.launch({ channel: 'chrome' });
for (const [url, config] of [
  ['/v1/heavy.html', { mode: 'drag', scenes: 20, animations: 16, copy: 40 }],
  ['/v2-heavy.html', { mode: 'drag', scenes: 20, animations: 16, copy: 40, author: 'contract' }],
]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.type() + ': ' + m.text().slice(0, 200)));
  await page.goto('http://127.0.0.1:4360' + url);
  const t0 = Date.now();
  await page.evaluate((c) => window.mountFixture(c), config).catch((e) => errors.push('mount: ' + e.message));
  const ready = await Promise.race([
    page.evaluate(() => new Promise((r) => { const c = () => (window.audit?.ready ? r(true) : setTimeout(c, 50)); c(); })),
    new Promise((r) => setTimeout(() => r(false), 20000)),
  ]);
  console.log(url, 'ready', ready, 'after', Date.now() - t0, 'ms');
  console.log('  ', errors.slice(0, 6).join('\n   '));
  await page.close();
}
await browser.close();
