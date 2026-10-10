import { launch } from './browser.mjs';

/**
 * P2.3 scene `covered="dim|recede"` (plan v3 §3.2, lexicon #11): while the next scene covers a
 * stacked one, a veil darkens it on the next scene's entry (`recede` also scales it back). Native
 * when the next scene scrolls, written directly when it is held, in fallback and in drag (the
 * displayed offset). The formula: veil = look * p, scale = 1 - (1 - look) * p. View progress in a
 * receding scene ignores the scale.
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const H = 800;
const LOOK = { a: [0.3, 0.92], c: [0.5, 1], d: [0.3, 0.92] };
const open = async (query, options = {}) => {
  const warm = await browser.newPage();
  await warm.goto(`${base}/covered.html?${query}`);
  await warm.waitForTimeout(800);
  await warm.close();
  const page = await browser.newPage({ viewport: { width: 400, height: H }, ...options });
  await page.goto(`${base}/covered.html?${query}`);
  await page.evaluate(() => window.ready);
  return page;
};
const frames = (page, n = 3) =>
  page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);

const read = (page) =>
  page.evaluate(() => {
    const out = {};
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      const s = document.getElementById(id);
      const cs = getComputedStyle(s);
      out[id] = {
        top: Math.round(s.getBoundingClientRect().top),
        veil: +Number(getComputedStyle(s.veil).opacity).toFixed(3),
        scale: cs.scale === 'none' ? 1 : +Number(cs.scale.split(' ')[0]).toFixed(4),
        origin: cs.transformOrigin,
        natives: s.veil.getAnimations().length + s.getAnimations().length,
        covered: s.hasAttribute('data-cv-covered'),
      };
    }
    const av = document.getElementById('av');
    out.av = +Number(getComputedStyle(av.layers.find((l) => l.source === 'view').el).opacity).toFixed(4);
    const hit = (y) => document.elementFromPoint(200, y)?.closest('cv-scene')?.id ?? null;
    out.hits = [hit(200), hit(600)];
    return out;
  });
/** The scene's look at covering progress p, against the formula. */
const looks = (v, id, p, reduced = false) => {
  const [veil, scale] = LOOK[id];
  const want = { veil: veil * p, scale: reduced ? 1 : 1 - (1 - scale) * p };
  const ok = Math.abs(v[id].veil - want.veil) < 0.02 && Math.abs(v[id].scale - want.scale) < 0.005;
  return [ok, JSON.stringify({ [id]: v[id], p: +p.toFixed(3), want })];
};
const plain = (v, ...ids) => ids.every((id) => looks(v, id, 0)[0]);

try {
  for (const mode of ['native', 'fallback']) {
    const page = await open(mode === 'fallback' ? 'fallback' : 'x');
    const errors = await page.evaluate(() => window.cvErrors);
    check(errors.join() === 'invalid-attribute: covered="fade": expected dim or recede', `${mode}: an unreadable value is a cv-error, nothing else`, JSON.stringify(errors));
    const at = async (y) => {
      await page.evaluate((y) => scrollTo(0, y), y);
      await frames(page, 4);
      await page.waitForTimeout(60);
      return read(page);
    };
    // Layout: a 0–800, b 800–1600, c 1600–2400, d 2400–3600 (zone, 400 of time), e 3600.
    let v = await at(0);
    const av0 = v.av;
    check(plain(v, 'a', 'c', 'd'), `${mode}: nothing covered, nothing dimmed`, JSON.stringify(v));
    if (mode === 'native') {
      check(v.a.natives === 2 && v.c.natives === 0 && v.d.natives === 2, 'native: a and d follow the next scene natively, c (under a held scene) is written directly', JSON.stringify({ a: v.a.natives, c: v.c.natives, d: v.d.natives }));
    } else {
      check(v.a.natives + v.c.natives + v.d.natives === 0, 'fallback: no native animations', JSON.stringify(v));
    }
    for (const y of [200, 400, 600]) {
      v = await at(y);
      check(...looks(v, 'a', y / H), `${mode}: y ${y}: a recedes as b covers it`);
      check(Math.abs(v.av - av0) < 0.004, `${mode}: y ${y}: view progress in the receding scene stays where it stopped`, JSON.stringify({ av0, av: v.av }));
    }
    check(v.a.origin === '200px 400px', `${mode}: a recedes toward the middle of the screen`, v.a.origin);
    v = await at(400);
    check(v.hits.join() === 'a,b', `${mode}: the veil takes no hits`, JSON.stringify(v.hits));
    v = await at(800);
    check(v.a.covered && plain(v, 'c'), `${mode}: a covered; c not dimmed`, JSON.stringify({ a: v.a, c: v.c }));
    v = await at(1600);
    check(v.c.top === 0 && plain(v, 'c'), `${mode}: c at the top, not dimmed yet`, JSON.stringify(v.c));
    for (const y of [1800, 2000, 2200]) {
      v = await at(y);
      check(...looks(v, 'c', (y - 1600) / H), `${mode}: y ${y}: c dims as d covers it`);
    }
    v = await at(2800);
    check(v.c.covered && v.d.top === -400 && plain(v, 'd'), `${mode}: zone d held after its time, not dimmed yet`, JSON.stringify(v.d));
    for (const y of [3000, 3200, 3400]) {
      v = await at(y);
      check(...looks(v, 'd', (y - 2800) / H), `${mode}: y ${y}: zone d recedes as e covers it`);
    }
    check(v.d.origin === '200px 800px', `${mode}: a held zone recedes toward the middle of its last screen`, v.d.origin);
    v = await at(3600);
    check(v.d.covered, `${mode}: d covered when e reaches the top`, JSON.stringify(v.d));
    v = await at(2000);
    check(looks(v, 'c', 0.5)[0] && plain(v, 'd') && !v.c.covered, `${mode}: back up, c shows dimmed by d, d undimmed`, JSON.stringify({ c: v.c, d: v.d }));
    v = await at(400);
    check(looks(v, 'a', 0.5)[0] && plain(v, 'c') && Math.abs(v.av - av0) < 0.004, `${mode}: back on a, receding again; c undimmed`, JSON.stringify({ a: v.a, c: v.c, av: v.av }));
    await page.close();
  }

  // Reduced motion: the veil only.
  {
    const page = await open('x', { reducedMotion: 'reduce' });
    await page.evaluate(() => scrollTo(0, 400));
    await frames(page, 4);
    await page.waitForTimeout(60);
    const v = await read(page);
    check(...looks(v, 'a', 0.5, true), 'reduced motion: recede keeps the veil, no scale');
    await page.close();
  }

  // Drag: the progress is the next scene's displayed offset over the held one.
  const page = await open('drag');
  const hold = async (dy) => {
    await page.mouse.move(200, 400);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(200, 400 + (dy * i) / 8);
      await page.waitForTimeout(16);
    }
    await frames(page, 3);
    return read(page);
  };
  const reset = async (index) => {
    await page.mouse.up();
    await page.waitForTimeout(900);
    await page.evaluate((i) => document.getElementById('s').goTo(i, { animated: false }), index);
    await frames(page, 3);
  };
  await frames(page, 3);
  let v = await read(page);
  const av0 = v.av;
  check(plain(v, 'a'), 'drag: at rest on a, a undimmed', JSON.stringify(v.a));
  v = await hold(-0.4 * H);
  check(v.b.top > 0.4 * H && v.b.top < 0.9 * H, 'drag: b slides over a', JSON.stringify(v.b));
  check(...looks(v, 'a', (H - v.b.top) / H), 'drag: a recedes with b over it');
  check(Math.abs(v.av - av0) < 0.004, 'drag: view progress in the receding scene stays at rest', JSON.stringify({ av0, av: v.av }));
  await reset(2);
  v = await read(page);
  check(v.a.covered && plain(v, 'c'), 'drag: on c, a covered and c undimmed', JSON.stringify({ a: v.a, c: v.c }));
  v = await hold(-0.3 * H);
  check(v.c.top === 0, 'drag: c holds while d slides over it', JSON.stringify(v.c));
  check(...looks(v, 'c', (H - v.d.top) / H), 'drag: c dims with d over it');
  await reset(3);
  v = await hold(-0.3 * H);
  check(Math.abs(v.d.top - (H / 2) * (1 - v.d.scale)) < 2 && v.e.top < H, 'drag: d holds while e slides over it', JSON.stringify({ d: v.d, e: v.e }));
  check(...looks(v, 'd', (H - v.e.top) / H), 'drag: d recedes with e over it');
  check(v.d.origin === '200px 400px', 'drag: d recedes toward the middle of the screen', v.d.origin);
  await reset(0);
  v = await read(page);
  check(plain(v, 'a', 'c', 'd') && !v.d.covered, 'drag: back on a, nothing dimmed', JSON.stringify(v));
  await page.close();
} catch (e) {
  failed++;
  console.log(`FAIL probe crashed: ${e.stack ?? e}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
