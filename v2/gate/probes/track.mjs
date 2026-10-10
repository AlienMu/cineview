import { launch } from './browser.mjs';

/**
 * P2.5 scene `track="x"` (plan v3 §9.3, lexicon #5): the scene's content lays out in a row that
 * moves left 1 px per ms of scene time until its end meets the scene's end. Scroll: a zone at
 * least `travel` long (native scroll-driven where supported, direct writes in fallback); drag: on
 * the scene time the finger and then the clock advance.
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const H = 800;
const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;
const open = async (query) => {
  const warm = await browser.newPage();
  await warm.goto(`${base}/track.html?${query}`);
  await warm.waitForTimeout(800);
  await warm.close();
  const page = await browser.newPage({ viewport: { width: 400, height: H } });
  await page.goto(`${base}/track.html?${query}`);
  await page.evaluate(() => window.ready);
  return page;
};
const frames = (page, n = 3) =>
  page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);

const read = (page) =>
  page.evaluate(() => {
    const out = {};
    for (const id of ['t0', 't1', 't2', 'u0', 'u3']) {
      const r = document.getElementById(id).getBoundingClientRect();
      out[id] = { left: Math.round(r.left), top: Math.round(r.top) };
    }
    const opacity = (id) => {
      const a = document.getElementById(id);
      return +Number(getComputedStyle(a.layers.find((l) => l.source === 'scene').el).opacity).toFixed(3);
    };
    out.ta = opacity('ta');
    out.ua = opacity('ua');
    for (const id of ['t', 'u', 'n', 'w']) {
      const s = document.getElementById(id);
      out[id] = {
        travel: s.travel,
        total: s.solution.total,
        natives: s.track.getAnimations().length,
        stuck: s.hasAttribute('data-cv-stuck'),
        covered: s.hasAttribute('data-cv-covered'),
        height: Math.round(s.getBoundingClientRect().height),
      };
    }
    return out;
  });

try {
  for (const mode of ['native', 'fallback']) {
    const page = await open(mode === 'fallback' ? 'fallback' : 'x');
    const errors = await page.evaluate(() => window.cvErrors);
    check(errors.join() === 'invalid-attribute: track="y": expected x', `${mode}: an unreadable track is a cv-error`, JSON.stringify(errors));
    const warnings = await page.evaluate(() => window.warnings);
    check(warnings.some((w) => w.includes('track="x" moves the row')), `${mode}: dev warning for a row with nothing to move`, JSON.stringify(warnings));
    const at = async (y) => {
      await page.evaluate((y) => scrollTo(0, y), y);
      await frames(page, 4);
      await page.waitForTimeout(60);
      return read(page);
    };
    // Layout: p 0–800, t 800–2400 (travel 800), u 2400–4400 (travel 800, time 1200), v 4400.
    let v = await at(0);
    check(v.t.travel === 800 && v.t.total === 800 && v.t.height === 1600, `${mode}: t is a zone as long as its travel`, JSON.stringify(v.t));
    check(v.u.travel === 800 && v.u.total === 1200 && v.u.height === 2000, `${mode}: u keeps its longer time`, JSON.stringify(v.u));
    check(v.n.travel === 0 && v.n.total === 0 && v.w.travel === 0, `${mode}: no travel for n and w`, JSON.stringify({ n: v.n, w: v.w }));
    if (mode === 'native') {
      check(v.t.natives === 1 && v.u.natives === 1 && v.n.natives === 0, 'native: one scroll-driven animation per row that moves', JSON.stringify([v.t.natives, v.u.natives, v.n.natives]));
    } else {
      check(v.t.natives + v.u.natives === 0, 'fallback: no native animations', JSON.stringify([v.t.natives, v.u.natives]));
    }
    v = await at(800);
    check(v.t0.left === 0 && v.t1.left === 400 && v.t0.top === 0, `${mode}: t at the top, the row at its start`, JSON.stringify({ t0: v.t0, t1: v.t1 }));
    for (const [y, x, ta] of [[1000, -200, 0], [1200, -400, 0], [1300, -500, 0.5], [1400, -600, 1], [1600, -800, 1]]) {
      v = await at(y);
      check(v.t0.left === x && v.t1.left === x + 400 && v.t0.top === 0 && v.t.stuck === (y < 1600) && near(v.ta, ta, 0.02), `${mode}: y ${y}: the row moves 1 px per px of scroll`, JSON.stringify({ t0: v.t0, t1: v.t1, ta: v.ta, stuck: v.t.stuck }));
    }
    check(v.t2.left === 0, `${mode}: the row's end meets the scene's end as the zone ends`, JSON.stringify(v.t2));
    v = await at(2000);
    check(v.t2.left === 0 && v.t2.top === -400, `${mode}: after its zone the scene scrolls away with the row at its end`, JSON.stringify(v.t2));
    for (const [y, x, ua] of [[2800, -400, 400 / 1200], [3200, -800, 800 / 1200], [3400, -800, 1000 / 1200]]) {
      v = await at(y);
      check(v.u0.left === x && v.u0.top === 0 && near(v.ua, ua, 0.02), `${mode}: y ${y}: u's row stops at its travel while its time runs on`, JSON.stringify({ u0: v.u0, ua: v.ua }));
    }
    check(v.u3.left === 100, `${mode}: u's last panel ends at the scene's end`, JSON.stringify(v.u3));
    v = await at(4000);
    check(v.u0.top === 0 && v.u0.left === -800 && !v.u.covered, `${mode}: u held (stack) with its row at the end`, JSON.stringify({ u0: v.u0, u: v.u }));
    v = await at(4400);
    check(v.u.covered, `${mode}: u covered once v reaches the top`, JSON.stringify(v.u));
    v = await at(1000);
    check(v.t0.left === -200 && !v.u.covered, `${mode}: back up, the row follows`, JSON.stringify({ t0: v.t0, u: v.u }));
    // A wider row (content) or a narrower scene (viewport) changes the travel: the zone follows.
    await page.evaluate(() => (document.getElementById('t2').style.width = '600px'));
    v = await at(1000);
    check(v.t.travel === 1000 && v.t.total === 1000 && v.t.height === 1800 && v.t0.left === -200, `${mode}: a wider row lengthens the zone`, JSON.stringify({ t: v.t, t0: v.t0 }));
    await page.setViewportSize({ width: 300, height: H });
    await page.waitForTimeout(200);
    v = await at(1900);
    check(v.t.travel === 1100 && v.t.total === 1100 && v.t0.left === -1100 && v.t2.left === -300, `${mode}: a narrower scene lengthens the travel; the row still ends at the scene's end`, JSON.stringify({ t: v.t, t0: v.t0, t2: v.t2 }));
    await page.close();
  }

  // Drag: the row moves on scene time.
  const page = await open('drag');
  await page.waitForTimeout(600);
  let v = await read(page);
  check(v.t.travel === 800 && v.t.total === 800 && v.u.total === 1200, 'drag: travel and totals as in scroll', JSON.stringify({ t: v.t, u: v.u }));
  await page.mouse.move(200, 400);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(200, 400 - (0.55 * H * i) / 8);
    await page.waitForTimeout(16);
  }
  await frames(page, 3);
  v = await read(page);
  const x = v.t0.left - 0;
  const ta = Math.min(1, Math.max(0, (-x - 400) / 200));
  check(x < 0 && x > -800 && v.t1.left === x + 400, 'drag: the incoming row follows the finger', JSON.stringify({ t0: v.t0, t1: v.t1 }));
  check(ta > 0 && ta < 1 && near(v.ta, ta, 0.02), 'drag: the row and the scene time agree', JSON.stringify({ x, ta: v.ta, want: ta }));
  await page.mouse.up();
  await page.waitForTimeout(1600);
  await frames(page, 3);
  v = await read(page);
  check(v.t2.left === 0 && v.t0.left === -800 && v.ta === 1, 'drag: after release the row plays to its end', JSON.stringify({ t0: v.t0, t2: v.t2, ta: v.ta }));
  await page.evaluate(() => document.getElementById('s').goTo(0, { animated: false }));
  await frames(page, 3);
  await page.evaluate(() => document.getElementById('s').goTo(2, { animated: false }));
  await frames(page, 3);
  v = await read(page);
  check(v.u0.left === -800 && v.u3.left === 100, 'drag: on u, the row rests at its travel', JSON.stringify({ u0: v.u0, u3: v.u3 }));
  await page.close();
} catch (e) {
  failed++;
  console.log(`FAIL probe crashed: ${e.stack ?? e}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
