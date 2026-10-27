import { launch } from './browser.mjs';

/**
 * P2.1 view sources and named ranges (plan v3 §3.4–3.5, §9.3, F7): `view(self)`, `view(#id)`, the
 * scene, and CSS named ranges, on the native path, the fallback and drag. Each element's opacity
 * (fade, linear) must equal the range formula on its subject's live rect; drag must give the same
 * values as scroll at the same scene offset.
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const H = 800;
const IDS = ['top', 'en', 'sc', 'nm', 'mix', 'bot'];
const open = async (query) => {
  const warm = await browser.newPage();
  await warm.goto(`${base}/view.html?${query}`);
  await warm.waitForTimeout(800);
  await warm.close();
  const page = await browser.newPage({ viewport: { width: 400, height: H } });
  await page.goto(`${base}/view.html?${query}`);
  await page.evaluate(() => window.ready);
  return page;
};
const frames = (page, n = 3) =>
  page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);

/** Each element's space-layer opacity and the expected value from its subject's rect. */
const read = (page) =>
  page.evaluate((ids) => {
    const vh = innerHeight;
    const span = (name, h) => {
      const lo = Math.min(h, vh), hi = Math.max(h, vh);
      return { cover: [0, vh + h], contain: [lo, hi], entry: [0, lo], exit: [hi, vh + h], 'entry-crossing': [0, h], 'exit-crossing': [vh, vh + h] }[name];
    };
    const edge = (e, h) => { const [a, b] = span(e.name, h); return a + (b - a) * e.offset; };
    const out = {};
    for (const id of ids) {
      const a = document.getElementById(id);
      const layer = a.layers.find((l) => l.source === 'view' && l.kind === 'space');
      const subject = a.viewSubject(layer);
      const r = subject.getBoundingClientRect();
      const at = vh - r.top;
      const s = layer.range ? edge(layer.range[0], r.height) : 0;
      const e = layer.range ? edge(layer.range[1], r.height) : vh + r.height;
      const expected = e <= s ? (at >= e ? 1 : 0) : Math.min(1, Math.max(0, (at - s) / (e - s)));
      out[id] = { opacity: +Number(getComputedStyle(layer.el).opacity).toFixed(3), expected: +expected.toFixed(3), native: !!layer.native, subject: subject.id };
    }
    return out;
  }, IDS);
const agree = (vals) => Object.entries(vals).every(([, v]) => Math.abs(v.opacity - v.expected) < 0.03);

try {
  for (const mode of ['native', 'fallback']) {
    const page = await open(mode === 'fallback' ? 'fallback' : 'x');
    const layout = await page.evaluate(() => {
      const mix = document.getElementById('mix');
      return {
        mix: mix.layers.map((l) => `${l.kind}:${l.range ? `${l.range[0].name}` : 'cover'}`).join(','),
        nm: document.getElementById('nm').viewSubject(document.getElementById('nm').layers[0]).id,
        sc: document.getElementById('sc').layers.map((l) => `${l.source}:${l.subject}`).join(),
        errors: window.cvErrors,
      };
    });
    if (mode === 'native') {
      check(layout.mix === 'space:entry,clip:exit', 'one layer per named range (fade entry, wipe exit)', layout.mix);
      check(layout.nm === 'target', 'view(#target) resolves to the element with that id', layout.nm);
      check(layout.sc === 'view:scene', 'a named range alone makes the item view-driven, on the scene', layout.sc);
      check(layout.errors.length === 0, 'no cv-error', JSON.stringify(layout.errors));
    }
    for (const d of [700, 500, 300, 100, -200, -500]) {
      await page.evaluate((d) => scrollTo(0, document.getElementById('s1').getBoundingClientRect().top + scrollY - d), d);
      await frames(page, 4);
      await page.waitForTimeout(80);
      const vals = await read(page);
      const nativeCount = Object.values(vals).filter((v) => v.native).length;
      check(agree(vals), `${mode}: s1 top at ${d}px — every element follows its range formula (${nativeCount} native)`, JSON.stringify(vals));
    }
    await page.close();
  }

  // Drag: hold the page part-way and compare with the formula and with scroll at the same offset.
  const page = await open('drag');
  await page.evaluate(() => document.getElementById('s').goTo(1, { animated: false }));
  await frames(page, 3);
  const rest = await read(page);
  check(agree(rest), 'drag: at rest every element follows its range formula', JSON.stringify(rest));
  for (const dy of [-0.3 * H, 0.35 * H]) {
    await page.mouse.move(200, 400);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(200, 400 + (dy * i) / 8);
      await page.waitForTimeout(16);
    }
    await frames(page, 3);
    const held = await read(page);
    const offset = await page.evaluate(() => document.getElementById('s1').getBoundingClientRect().top);
    check(Math.abs(offset) > 50 && agree(held), `drag: held at s1 offset ${Math.round(offset)}px — formula holds`, JSON.stringify(held));
    // Same offset under scroll input (F7): same values for the top and bottom elements.
    const sp = await open('fallback');
    await sp.evaluate((d) => scrollTo(0, document.getElementById('s1').getBoundingClientRect().top + scrollY - d), offset);
    await frames(sp, 4);
    const scrolled = await read(sp);
    await sp.close();
    const same = ['top', 'bot', 'en', 'sc', 'nm'].every((id) => Math.abs(scrolled[id].opacity - held[id].opacity) < 0.03);
    check(same, `drag vs scroll at the same offset (${Math.round(offset)}px): same progress`, JSON.stringify({ drag: held, scroll: scrolled }));
    await page.mouse.up();
    await page.waitForTimeout(700);
    await page.evaluate(() => document.getElementById('s').goTo(1, { animated: false }));
    await frames(page, 3);
  }
  await page.close();
} catch (e) {
  failed++;
  console.log(`FAIL probe crashed: ${e.stack ?? e}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
