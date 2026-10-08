import { chromium, webkit } from 'playwright';
import { createRequire } from 'node:module';

// N15: measured-mirror fidelity (pixel diff original vs mirror) and measurement cost, Chrome + WebKit.
const { PNG } = createRequire(new URL('../../site/package.json', import.meta.url))('pngjs');

/** Best integer device-pixel shift (dx, dy in -3..3) of the mirror image against the original. */
function bestShift(a, b) {
  const x = PNG.sync.read(a);
  const y = PNG.sync.read(b);
  let best = { dx: 0, dy: 0, badPct: 100 };
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    let bad = 0;
    let n = 0;
    for (let yy = 3; yy < x.height - 3; yy++) for (let xx = 3; xx < x.width - 3; xx++) {
      const i = (yy * x.width + xx) * 4;
      const j = ((yy + dy) * y.width + (xx + dx)) * 4;
      const d = Math.max(Math.abs(x.data[i] - y.data[j]), Math.abs(x.data[i + 1] - y.data[j + 1]), Math.abs(x.data[i + 2] - y.data[j + 2]));
      if (d > 48) bad++;
      n++;
    }
    const pct = (100 * bad) / n;
    if (pct < best.badPct) best = { dx, dy, badPct: +pct.toFixed(3) };
  }
  return best;
}

function diff(a, b) {
  const x = PNG.sync.read(a);
  const y = PNG.sync.read(b);
  let bad = 0;
  const total = x.width * x.height;
  for (let i = 0; i < x.data.length; i += 4) {
    const d = Math.max(Math.abs(x.data[i] - y.data[i]), Math.abs(x.data[i + 1] - y.data[i + 1]), Math.abs(x.data[i + 2] - y.data[i + 2]));
    if (d > 48) bad++;
  }
  return { badPx: bad, badPct: +((100 * bad) / total).toFixed(3) };
}

export async function mirrorSpike(base = 'http://127.0.0.1:4360') {
  const out = {};
  for (const [name, engine] of [['chrome', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch(name === 'chrome' ? { channel: 'chrome' } : {});
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(`${base}/mirror.html`);
    await page.evaluate(() => new Promise((r) => { const c = () => (window.spikeReady ? r() : setTimeout(c, 30)); c(); }));
    await page.evaluate(() => document.fonts.ready);
    const rows = {};
    for (const id of ['latin', 'cjk', 'emoji', 'gradient', 'nested']) {
      const info = await page.evaluate((i) => window.spike.build(i), id);
      const el = page.locator(`#${id}`);
      await page.evaluate((i) => window.spike.showOriginal(i), id);
      const a = await el.screenshot();
      await page.evaluate((i) => window.spike.showMirror(i), id);
      const b = await el.screenshot();
      rows[id] = { ...info, ...diff(a, b), best: bestShift(a, b) };
    }
    const cost = {};
    for (const words of [50, 200, 800]) cost[words] = +(await page.evaluate((w) => window.spike.cost(w), words)).toFixed(1);
    out[name] = { rows, measureMsByWords: cost };
    await browser.close();
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(await mirrorSpike(), null, 1));
