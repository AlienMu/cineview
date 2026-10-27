import { launch } from './browser.mjs';

/**
 * P3.1 signal sources (plan v3 §3.5, F14; lexicon #7, #20): `velocity` leans content with the
 * reader's speed, mirrored backward, and settles to rest once the reader stops; `direction` turns
 * after a dead zone and drives `data-cv-direction`; `page` under drag follows the continuous scene
 * position. Scroll (native and fallback) and drag; reduced motion drops signal deformation.
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const open = async (query, options = {}) => {
  const warm = await browser.newPage();
  await warm.goto(`${base}/signals.html?${query}`);
  await warm.waitForTimeout(800);
  await warm.close();
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, ...options });
  await page.goto(`${base}/signals.html?${query}`);
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(200);
  return page;
};
const frames = (page, n = 3) =>
  page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);

const read = (page) =>
  page.evaluate(() => {
    const layer = (id, kind) => document.getElementById(id).shadowRoot.querySelector(`[part~="${kind}"]`);
    const skew = (el) => (el ? Number(/skew\([-\d.]+deg, ([-\d.]+)deg\)/.exec(el.style.transform)?.[1] ?? NaN) : null);
    // translate serialises "0px 0px" as "0px".
    const dy = (el) => (el ? Number(/^[-\d.]+px(?: ([-\d.]+)px)?$/.exec(el.style.translate)?.[1] ?? (el.style.translate ? 0 : NaN)) : null);
    const page = layer('p', 'space');
    return {
      skew: skew(layer('k', 'signal')),
      dir: dy(layer('d', 'signal')),
      page: page ? getComputedStyle(page).translate : null,
      heading: document.getElementById('s').getAttribute('data-cv-direction'),
      y: scrollY,
    };
  });

/** Scroll by `dy` px per frame for `n` frames; the values two frames after the last step. */
const scrollFor = async (page, dy, n) => {
  await page.evaluate(({ dy, n }) => new Promise((r) => {
    let k = 0;
    const f = () => { scrollBy(0, dy); if (++k < n) requestAnimationFrame(f); else r(); };
    requestAnimationFrame(f);
  }), { dy, n });
  await frames(page, 2);
  return read(page);
};

try {
  for (const mode of ['native', 'fallback']) {
    const page = await open(mode === 'fallback' ? 'fallback' : 'x');
    let v = await read(page);
    check(v.skew === 0 && v.dir === 0 && v.heading === null, `${mode}: at rest before any movement (no lean, direction progress 0, no heading)`, JSON.stringify(v));
    v = await scrollFor(page, 60, 10);
    check(v.skew < -1.5 && v.skew >= -4, `${mode}: scrolling forward leans the content (velocity)`, JSON.stringify(v));
    // About 200 ms into a 240 ms turn when read (frame timing varies): at least half way.
    check(v.heading === 'forward' && v.dir < -25, `${mode}: heading forward; the direction layer is turning`, JSON.stringify(v));
    await page.waitForTimeout(3000);
    v = await read(page);
    check(v.skew === 0 && v.dir === -50, `${mode}: after the reader stops, the lean settles to 0 and direction rests at its end`, JSON.stringify(v));
    const writes = await page.evaluate(() => new Promise((r) => {
      const el = document.getElementById('k').shadowRoot.querySelector('[part~="signal"]');
      let n = 0;
      const mo = new MutationObserver((m) => { n += m.length; });
      mo.observe(el, { attributes: true });
      setTimeout(() => { mo.disconnect(); r(n); }, 500);
    }));
    check(writes === 0, `${mode}: no writes while resting`, `${writes} style mutations in 500 ms`);
    v = await scrollFor(page, -60, 6);
    check(v.skew > 1.5 && v.heading === 'backward', `${mode}: scrolling back leans the other way, heading backward`, JSON.stringify(v));
    await page.waitForTimeout(3000);
    // Dead zone (6 px): 4 px against the heading do not turn it, 8 px do.
    v = await scrollFor(page, 2, 2);
    check(v.heading === 'backward', `${mode}: 4 px forward stay inside the dead zone`, JSON.stringify(v));
    v = await scrollFor(page, 2, 2);
    check(v.heading === 'forward', `${mode}: 8 px forward turn the heading`, JSON.stringify(v));
    // Near the top the reader counts as heading back (a hidden bar comes back there).
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(3000);
    v = await scrollFor(page, 3, 10);
    check(v.y === 30 && v.heading === 'backward', `${mode}: moving forward within 40 px of the top counts as heading back`, JSON.stringify(v));
    await page.waitForTimeout(600);
    // Half way down the document (3200 px, 800 px screen), with a symmetric ease: half the travel.
    await page.evaluate(() => scrollTo(0, 0));
    await frames(page, 3);
    const p0 = (await read(page)).page;
    await page.evaluate(() => scrollTo(0, 1200));
    await frames(page, 3);
    const p1 = (await read(page)).page;
    check(p0 === '0px' && p1 === '50px', `${mode}: page follows the document's scroll progress`, JSON.stringify({ p0, p1 }));
    const errors = await page.evaluate(() => window.cvErrors);
    check(errors.length === 0, `${mode}: no cv-errors`, JSON.stringify(errors));
    await page.close();
  }

  {
    const page = await open('drag');
    let v = await read(page);
    check(v.skew === 0 && v.page === '0px', 'drag: at rest on the first scene, page 0', JSON.stringify(v));
    await page.mouse.move(200, 600);
    await page.mouse.down();
    let during = null;
    for (let k = 1; k <= 12; k++) {
      await page.mouse.move(200, 600 - k * 30);
      await frames(page, 1);
      if (k === 10) during = await read(page);
    }
    check(during.skew < -0.3 && during.heading === 'forward', 'drag: the gesture leans the content forward and sets the heading', JSON.stringify(during));
    await page.mouse.up();
    await page.waitForTimeout(3500);
    v = await read(page);
    check(v.skew === 0, 'drag: the lean settles after the page lands', JSON.stringify(v));
    await page.evaluate(() => document.getElementById('s').goTo(0, { animated: false }));
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('s').goTo(1));
    await page.waitForTimeout(1500);
    v = await read(page);
    check(v.page === '50px', 'drag: page follows the scene position (scene 2 of 3: half way)', JSON.stringify(v));
    const errors = await page.evaluate(() => window.cvErrors);
    check(errors.length === 0, 'drag: no cv-errors', JSON.stringify(errors));
    await page.close();
  }

  {
    const page = await open('x', { reducedMotion: 'reduce' });
    const kinds = await page.evaluate(() => ['k', 'd'].map((id) => [...document.getElementById(id).shadowRoot.querySelectorAll('[part]')].map((l) => l.getAttribute('part'))));
    check(kinds.every((k) => !k.some((p) => p.includes('signal'))), 'reduced motion: no signal layers', JSON.stringify(kinds));
    const v = await scrollFor(page, 30, 10);
    check(v.heading === 'forward', 'reduced motion: data-cv-direction still follows the reader', JSON.stringify(v));
    await page.close();
  }
} catch (e) {
  failed++;
  console.log(`FAIL probe crashed: ${e.stack ?? e}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
