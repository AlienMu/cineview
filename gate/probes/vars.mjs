import { launch } from './browser.mjs';

/**
 * P3.2 custom properties (plan v3 §3.3; lexicon #37, #38, #39): `--name` values in from/to and
 * loops reach the element's content (numbers with units, colours around the OKLCH hue circle),
 * view-driven ones on direct writes (never native), clock entrances and loops with a value per
 * frame; `hue` turns `--cv-hue`; nothing lands on the stage or the root; the wide-scope warning.
 * Scroll (native and fallback), drag, reduced motion.
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
  await warm.goto(`${base}/vars.html?${query}`);
  await warm.waitForTimeout(800);
  await warm.close();
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, ...options });
  const warnings = [];
  page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));
  await page.goto(`${base}/vars.html?${query}`);
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(200);
  return { page, warnings };
};
const frames = (page, n = 3) =>
  page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);

// In the page: chroma of a computed colour (oklch() as serialised, else sRGB converted to OKLab).
const HELPERS = () => {
  window.chroma = (css) => {
    const ok = /oklch\(([\d.]+%?) ([\d.]+)/.exec(css);
    if (ok) return Number(ok[2]);
    const rgb = /rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)/.exec(css);
    const srgb = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(css);
    const [r, g, b] = rgb ? rgb.slice(1).map((v) => v / 255) : srgb ? srgb.slice(1).map(Number) : [NaN, NaN, NaN];
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [R, G, B] = [lin(r), lin(g), lin(b)];
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return Math.hypot(A, Bb);
  };
  window.vals = () => {
    const cs = (id) => getComputedStyle(document.getElementById(id));
    return {
      glow: cs('vs').getPropertyValue('--glow').trim(),
      r: cs('vs').getPropertyValue('--r').trim(),
      tint: cs('vs').backgroundColor,
      hue: cs('hs').getPropertyValue('--cv-hue').trim(),
      root: getComputedStyle(document.documentElement).getPropertyValue('--glow').trim() + getComputedStyle(document.getElementById('s')).getPropertyValue('--glow').trim(),
      native: document.getElementById('v').layers.some((l) => l.native),
    };
  };
};

/** Values of a property on an element, one per frame for `ms`. */
const sample = (page, id, read, ms) =>
  page.evaluate(({ id, read, ms }) => new Promise((resolve) => {
    const out = [];
    const t0 = performance.now();
    const f = () => {
      const cs = getComputedStyle(document.getElementById(id));
      out.push(read === 'tint' ? cs.backgroundColor : cs.getPropertyValue(read).trim());
      if (performance.now() - t0 < ms) requestAnimationFrame(f);
      else resolve(out);
    };
    requestAnimationFrame(f);
  }), { id, read, ms });

try {
  for (const mode of ['native', 'fallback']) {
    const { page, warnings } = await open(mode === 'fallback' ? 'fallback' : 'x');
    await page.evaluate(HELPERS);
    // Scene a at the top of an 800 px screen: half way through its passage (cover), eased 0.5.
    let v = await page.evaluate(() => window.vals());
    check(v.glow === '0.5' && v.r === '20px', `${mode}: numbers reach the content, with their unit`, JSON.stringify(v));
    const c = await page.evaluate((t) => window.chroma(t), v.tint);
    check(c > 0.14, `${mode}: half way from #e33 to #36c the colour stays saturated (hue arc, not grey)`, `${v.tint}, chroma ${c.toFixed(3)}`);
    check(v.hue === '180deg', `${mode}: hue turns --cv-hue with the passage (linear: 180deg half way)`, JSON.stringify(v));
    check(v.root === '' && !v.native, `${mode}: written on the element's own layer (not the stage or root), on direct writes`, JSON.stringify(v));
    await page.evaluate(() => scrollTo(0, 400));
    await frames(page, 3);
    const after = await page.evaluate(() => window.vals());
    check(Number(after.glow) > 0.5 && Number(after.glow) < 1, `${mode}: the value follows the scroll`, JSON.stringify(after));
    // Scene b 100 px down (inside the enter gate, clear of the top margin): the entrance plays on
    // the clock with a value per frame, the loop turns its colour.
    await page.evaluate(() => scrollTo(0, 700));
    const glow = await sample(page, 'es', '--glow', 900);
    const distinct = new Set(glow).size;
    check(distinct >= 15 && glow.at(-1) === '1', `${mode}: a clock entrance writes a new value every frame and ends at its to-state`, `${distinct} distinct of ${glow.length}: ${glow.slice(0, 6).join(' ')} … ${glow.at(-1)}`);
    const tint = await sample(page, 'ls', 'tint', 600);
    const chromas = await page.evaluate((list) => list.map((t) => window.chroma(t)), tint);
    check(new Set(tint).size >= 15 && Math.min(...chromas) > 0.12, `${mode}: the colour loop moves every frame and stays saturated`, `${new Set(tint).size} distinct of ${tint.length}, min chroma ${Math.min(...chromas).toFixed(3)}`);
    const wide = warnings.filter((w) => w.includes('restyles all'));
    check(wide.length === 1 && wide[0].includes('--glow restyles all 1201 elements'), `${mode}: dev warning for the custom property over 1201 elements, once`, JSON.stringify(wide));
    const errors = await page.evaluate(() => window.cvErrors);
    check(errors.length === 0, `${mode}: no cv-errors`, JSON.stringify(errors));
    await page.close();
  }

  {
    const { page } = await open('drag');
    await page.evaluate(HELPERS);
    let v = await page.evaluate(() => window.vals());
    check(v.glow === '0.5' && v.hue === '180deg', 'drag: view-driven custom properties at the first scene', JSON.stringify(v));
    await page.evaluate(() => document.getElementById('s').goTo(1));
    await page.waitForTimeout(1500);
    v = await page.evaluate(() => window.vals());
    const e = await page.evaluate(() => getComputedStyle(document.getElementById('es')).getPropertyValue('--glow').trim());
    check(v.glow === '1' && e === '1', 'drag: the passage completes as scene a leaves; the entrance plays on arrival', JSON.stringify({ ...v, e }));
    const errors = await page.evaluate(() => window.cvErrors);
    check(errors.length === 0, 'drag: no cv-errors', JSON.stringify(errors));
    await page.close();
  }

  {
    const { page } = await open('x', { reducedMotion: 'reduce' });
    await page.evaluate(HELPERS);
    const v = await page.evaluate(() => window.vals());
    check(v.glow === '0.5' && v.hue === '180deg', 'reduced motion: custom properties are values, not motion: kept', JSON.stringify(v));
    await page.evaluate(() => scrollTo(0, 700));
    await page.waitForTimeout(600);
    const e = await page.evaluate(() => getComputedStyle(document.getElementById('es')).getPropertyValue('--glow').trim());
    check(e === '1', 'reduced motion: the entrance reaches its to-state', e);
    await page.close();
  }
} catch (e) {
  failed++;
  console.log(`FAIL probe crashed: ${e.stack ?? e}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
