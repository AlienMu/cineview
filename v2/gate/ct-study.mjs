import { chromium, webkit } from 'playwright';
// N14: does WebKit handle per-frame currentTime seeking as well as direct writes? Plus the 322936 pattern.
export async function ctStudy(base = 'http://127.0.0.1:4360') {
  const out = {};
  for (const [name, engine] of [['chrome', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch(name === 'chrome' ? { channel: 'chrome' } : {});
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    await page.goto(`${base}/ct-study.html`);
    await page.evaluate(() => new Promise((r) => { const c = () => (window.studyReady ? r() : setTimeout(c, 30)); c(); }));
    const rows = [];
    for (const n of [256, 1024, 2048]) for (const mode of ['seek', 'write']) rows.push(await page.evaluate(([m, k]) => window.study(m, k, 3000), [mode, n]));
    out[name] = { rows, bug322936: await page.evaluate(() => window.bug322936()) };
    await browser.close();
  }
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(await ctStudy(), null, 1));
