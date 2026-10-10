import { launch } from './browser.mjs';

/**
 * P2.6 <cv-fixed> (plan v3 §8, F11): a frame over the whole scene, always clipped, with its
 * content stuck to the top of the screen while the scene passes; it arrives with the scene's top
 * edge and leaves with its bottom edge. The frame takes no pointer events, its content does.
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const H = 800;
const open = async (query) => {
  const warm = await browser.newPage();
  await warm.goto(`${base}/fixed.html?${query}`);
  await warm.waitForTimeout(800);
  await warm.close();
  const page = await browser.newPage({ viewport: { width: 400, height: H } });
  await page.goto(`${base}/fixed.html?${query}`);
  await page.evaluate(() => window.ready);
  return page;
};
const frames = (page, n = 3) =>
  page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);

const read = (page) =>
  page.evaluate(() => {
    const out = {};
    const box = (id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { top: Math.round(r.top), height: Math.round(r.height) };
    };
    for (const id of ['a', 'b', 'c', 'z', 'fa', 'fb', 'fc', 'fz', 'la', 'la2', 'lb', 'lc', 'lc2', 'lz']) out[id] = box(id);
    const hit = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return el ? el.id || el.closest('[id]')?.id || el.localName : null;
    };
    out.hit = (points) => points.map(([x, y]) => hit(x, y));
    out.hits = [[100, 320], [100, 50], [200, 750]].map(([x, y]) => hit(x, y));
    const cs = getComputedStyle(document.getElementById('fa'));
    out.frame = { position: cs.position, overflow: cs.overflow, willChange: cs.willChange, pointer: cs.pointerEvents };
    return out;
  });

try {
  {
    const page = await open('x');
    const warnings = await page.evaluate(() => window.warnings);
    check(warnings.some((w) => w.includes('<cv-fixed> inside <cv-animate>')), 'dev warning for a fixed layer inside <cv-animate>', JSON.stringify(warnings));
    check(warnings.some((w) => w.includes('<cv-fixed> holds content within its scene')), 'dev warning for a fixed layer outside a scene', JSON.stringify(warnings));
    const errors = await page.evaluate(() => window.cvErrors);
    check(errors.length === 0, 'no cv-errors', JSON.stringify(errors));
    const at = async (y) => {
      await page.evaluate((y) => scrollTo(0, y), y);
      await frames(page, 3);
      return read(page);
    };
    // Layout: a 0–1600, b 1600–2400, c 2400–2800 (400 high), z 2800–4000 (zone 400), e 4000.
    let v = await at(0);
    check(v.frame.position === 'absolute' && v.frame.overflow === 'clip' && v.frame.willChange === 'transform' && v.frame.pointer === 'none', 'the frame: absolute, clipped, will-change transform, no pointer events', JSON.stringify(v.frame));
    check(v.fa.top === 0 && v.fa.height === 1600 && v.fb.height === 800 && v.fc.height === 400 && v.fz.height === 800, 'each frame covers its scene (a zone: its one-screen shell)', JSON.stringify({ fa: v.fa, fb: v.fb, fc: v.fc, fz: v.fz }));
    check(v.la.top === 0 && v.la2.top === 700, 'a: the layer is one screen at the top', JSON.stringify({ la: v.la, la2: v.la2 }));
    check(v.hits[0] === 'under' && v.hits[1] === 'la', 'clicks pass the frame to the scene; the layer content takes its own', JSON.stringify(v.hits));
    for (const y of [400, 800]) {
      v = await at(y);
      check(v.a.top === -y && v.la.top === 0 && v.la2.top === 700, `y ${y}: a scrolls, its layer holds`, JSON.stringify({ a: v.a, la: v.la }));
    }
    v = await at(1000);
    check(v.la.top === -200 && v.la2.top === 500 && v.lb.top === 600, 'y 1000: a\'s bottom edge carries its layer away; b\'s layer arrives at its top edge', JSON.stringify({ la: v.la, la2: v.la2, lb: v.lb }));
    v = await at(1600);
    check(v.lb.top === 0 && v.b.top === 0, 'y 1600: b at the top with its layer', JSON.stringify({ b: v.b, lb: v.lb }));
    v = await at(2400);
    const lowHit = await page.evaluate(() => document.elementFromPoint(200, 750)?.closest('cv-scene')?.id);
    check(v.c.top === 0 && v.lc.top === 0 && v.lc2.top === 700 && lowHit === 'z', 'c is shorter than its layer: the frame clips it', JSON.stringify({ c: v.c, lc: v.lc, lc2: v.lc2, lowHit }));
    v = await at(3000);
    check(v.z.top === -200 && v.fz.top === 0 && v.lz.top === 0, 'z: the layer holds in the pinned shell', JSON.stringify({ z: v.z, fz: v.fz, lz: v.lz }));
    v = await at(0);
    check(v.la.top === 0, 'back to the top', JSON.stringify(v.la));
    await page.close();
  }

  // Drag: the layer stays at the scene's top and moves with the scene.
  const page = await open('drag');
  await page.waitForTimeout(600);
  let v = await read(page);
  check(v.la.top === 0 && v.fa.height === 800, 'drag: the layer at the top of the one-screen scene', JSON.stringify({ la: v.la, fa: v.fa }));
  check(v.hits[0] === 'under' && v.hits[1] === 'la', 'drag: clicks pass the frame', JSON.stringify(v.hits));
  await page.mouse.move(200, 400);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(200, 400 - (0.4 * H * i) / 8);
    await page.waitForTimeout(16);
  }
  await frames(page, 3);
  v = await read(page);
  check(v.a.top < -100 && v.la.top === v.a.top && v.lb.top === v.b.top && v.b.top < H, 'drag: each layer moves with its scene', JSON.stringify({ a: v.a, la: v.la, b: v.b, lb: v.lb }));
  await page.mouse.up();
  await page.close();
} catch (e) {
  failed++;
  console.log(`FAIL probe crashed: ${e.stack ?? e}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
