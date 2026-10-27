import { webkit } from 'playwright';
// Save WebKit original vs mirror screenshots (latin, cjk) to judge whether the pixel mismatch is visible.
const out = process.argv[2];
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:4360/mirror.html');
await page.evaluate(() => new Promise((r) => { const c = () => (window.spikeReady ? r() : setTimeout(c, 30)); c(); }));
await page.evaluate(() => document.fonts.ready);
for (const id of ['latin', 'cjk']) {
  await page.evaluate((i) => window.spike.build(i), id);
  await page.evaluate((i) => window.spike.showOriginal(i), id);
  await page.locator(`#${id}`).screenshot({ path: `${out}/webkit-${id}-original.png` });
  await page.evaluate((i) => window.spike.showMirror(i), id);
  await page.locator(`#${id}`).screenshot({ path: `${out}/webkit-${id}-mirror.png` });
}
await browser.close();
