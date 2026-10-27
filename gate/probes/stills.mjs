import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { engine, launch } from './browser.mjs';

/**
 * P3.5 still pictures (plan v3 §6 F12; lexicon #25 blur-up, #12 focus). `develop`: a blurred
 * stand-in (the author's variant, else the image itself) covers each image until it has loaded
 * and decoded, then fades out over 1.2 s (200 ms under reduced motion). Focus on a picture over a
 * quarter of the viewport (images only): a blurred copy over it fades with the blur, so only
 * opacity animates; smaller or captioned pictures blur. The copy follows the image's source; the
 * author's pre-blurred variant replaces the static blur. A screenshot of the copy beside real blur
 * at the same progress is saved for the visual comparison. Scroll (native and fallback), drag.
 *
 * Images are made here (checkered PNGs, no binary file ships) and served at /img/; `hold=1` ones
 * wait until the probe releases them, so arrival never races the build.
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const W = 800;
const H = 700;
const out = new URL('../../review/v2-phase1-checks/', import.meta.url);
mkdirSync(out, { recursive: true });

// ---- images -------------------------------------------------------------------------------------
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
};
/** A w × h RGB PNG, checkered in 24 px squares of two colours. */
const png = (w, h, [a, b]) => {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) row.set((Math.floor(x / 24) + Math.floor(y / 24)) % 2 ? b : a, 1 + x * 3);
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};
const CHECKER = [
  [30, 60, 200],
  [240, 210, 40],
];
const GREY = [
  [120, 120, 120],
  [128, 128, 128],
];
const made = new Map();

const open = async (query, options = {}) => {
  const warm = await browser.newPage();
  await warm.goto(`${base}/stills.html?${query}`);
  await warm.waitForTimeout(800);
  await warm.close();
  const page = await browser.newPage({ viewport: { width: W, height: H }, ...options });
  const hits = new Map();
  const holds = new Map();
  const hold = (path) => {
    if (!holds.has(path)) {
      let release;
      const p = new Promise((r) => (release = r));
      holds.set(path, { p, release });
    }
    return holds.get(path);
  };
  await page.route('**/img/**', async (route) => {
    const url = new URL(route.request().url());
    const key = url.pathname + url.search;
    hits.set(key, (hits.get(key) ?? 0) + 1);
    if (url.searchParams.has('hold')) await hold(url.pathname).p;
    if (url.pathname.endsWith('/missing.png')) return route.fulfill({ status: 404, body: 'missing' });
    const w = Number(url.searchParams.get('w') ?? 100);
    const h = Number(url.searchParams.get('h') ?? 100);
    const grey = url.pathname.endsWith('/fb.png');
    const id = `${w}x${h}${grey}`;
    if (!made.has(id)) made.set(id, png(w, h, grey ? GREY : CHECKER));
    await route.fulfill({ contentType: 'image/png', body: made.get(id) });
  });
  page.release = (...paths) => paths.forEach((p) => hold(p).release());
  page.hits = hits;
  // Not `load`: held images keep it from firing.
  await page.goto(`${base}/stills.html?${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.ready);
  return page;
};
const frames = (page, n = 3) =>
  page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);
const at = async (page, y) => {
  await page.evaluate((y) => scrollTo(0, y), y);
  await frames(page, 4);
  await page.waitForTimeout(80);
};
/** Scroll so that `id` is at view progress p (cover). */
const atProgress = async (page, id, p) => {
  const y = await page.evaluate(
    ([id, p]) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      const top = r.top + scrollY;
      return Math.round(top - innerHeight + p * (innerHeight + r.height));
    },
    [id, p]
  );
  await at(page, y);
};

/** Develop boxes of an element: count, first copy's source and style, rects, fade timing. */
const developed = (page, id) =>
  page.evaluate((id) => {
    const a = document.getElementById(id);
    const img = a.querySelector('img');
    const container = a.shadowRoot.querySelector('[part=develop]');
    const boxes = container ? [...container.children] : [];
    const box = boxes[0];
    const copy = box?.querySelector('img');
    const anim = box?.getAnimations()[0];
    const r = img.getBoundingClientRect();
    const b = box?.getBoundingClientRect();
    return {
      container: !!container,
      boxes: boxes.length,
      src: copy?.src ?? null,
      srcset: copy?.getAttribute('srcset') ?? null,
      imgSrc: img.src,
      imgSrcset: img.getAttribute('srcset'),
      // WebKit picks the candidate before the image loads, Chromium once it does.
      imgCurrent: img.currentSrc || null,
      filter: copy?.style.filter ?? null,
      aria: container?.getAttribute('aria-hidden') ?? null,
      off: b ? Math.max(Math.abs(b.left - r.left), Math.abs(b.top - r.top), Math.abs(b.width - r.width), Math.abs(b.height - r.height)) : null,
      fade: anim ? { duration: anim.effect.getTiming().duration, easing: anim.effect.getTiming().easing, state: anim.playState } : null,
    };
  }, id);

/** Average colour at the centre of an element on screen (5 × 5 px). */
const centre = async (page, id) => {
  const box = await page.evaluate((id) => {
    const r = document.getElementById(id).querySelector('img').getBoundingClientRect();
    return { x: r.left + r.width / 2 - 2, y: r.top + r.height / 2 - 2 };
  }, id);
  const shot = await page.screenshot({ clip: { ...box, width: 5, height: 5 } });
  return page.evaluate(async (b64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    const g = c.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    const d = g.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += d[i + k];
    return sum.map((v) => Math.round(v / (d.length / 4)));
  }, shot.toString('base64'));
};
const magenta = ([r, g, b]) => r > 200 && b > 200 && g < 80;

/** Fade layers, the copy container's opacity, and the filters on the element's own layers. */
const focusState = (page, id) =>
  page.evaluate((id) => {
    const a = document.getElementById(id);
    const fades = a.layers.filter((l) => l.fade);
    const container = a.shadowRoot.querySelector('[part=focus-copy]');
    const copy = container?.querySelector('img:last-child');
    const filler = copy?.previousElementSibling;
    const own = [...a.shadowRoot.querySelectorAll('.l')];
    return {
      fades: fades.length,
      onContainer: fades.length > 0 && fades[0].el === container,
      native: fades.map((l) => !!l.native),
      ownNative: a.layers.filter((l) => !l.fade && !l.target && !l.piece).map((l) => !!l.native),
      opacity: container ? Number(getComputedStyle(container).opacity) : null,
      inline: container?.style.opacity ?? null,
      filters: own.map((l) => getComputedStyle(l).filter).filter((f) => f !== 'none'),
      copySrc: copy?.getAttribute('src') ?? null,
      copyFilter: copy ? getComputedStyle(copy).filter : null,
      copyScale: copy?.style.transform ?? null,
      fillerScale: filler?.style.transform ?? null,
      off: (() => {
        const box = container?.firstElementChild?.getBoundingClientRect();
        const r = a.querySelector('img').getBoundingClientRect();
        return box ? Math.max(Math.abs(box.left - r.left), Math.abs(box.top - r.top), Math.abs(box.width - r.width), Math.abs(box.height - r.height)) : null;
      })(),
    };
  }, id);

/**
 * Mean absolute difference (0–255) between the two halves of #row, inside an 8 px margin; with
 * `sharp`, the copy is hidden (the sharp picture against real blur, the baseline).
 */
const compare = async (page, name, sharp = false) => {
  const hide = (on) =>
    page.evaluate((on) => {
      const c = document.getElementById('cmpA').shadowRoot.querySelector('[part=focus-copy]');
      c.style.visibility = on ? 'hidden' : '';
    }, on);
  if (sharp) await hide(true);
  // Not the locator's screenshot: it would scroll the row, and the progress with it.
  const clip = await page.evaluate(() => {
    const r = document.getElementById('row').getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
  const shot = await page.screenshot({ clip });
  if (sharp) await hide(false);
  if (name) writeFileSync(new URL(name, out), shot);
  return page.evaluate(async (b64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    const g = c.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    const w = bitmap.width / 2;
    const d = g.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let sum = 0;
    let n = 0;
    for (let y = 8; y < bitmap.height - 8; y++) {
      for (let x = 8; x < w - 8; x++) {
        const i = (y * bitmap.width + x) * 4;
        const j = (y * bitmap.width + x + w) * 4;
        for (let k = 0; k < 3; k++) sum += Math.abs(d[i + k] - d[j + k]);
        n += 3;
      }
    }
    return +(sum / n).toFixed(2);
  }, shot.toString('base64'));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HELD = ['/img/a.png', '/img/b.png', '/img/s.png', '/img/g.png', '/img/z.png', '/img/missing.png', '/img/p.png'];

try {
  for (const mode of ['native', 'fallback', 'reduced', 'drag']) {
    const query = { native: 'x', fallback: 'fallback', reduced: 'x', drag: 'drag' }[mode];
    const page = await open(query, mode === 'reduced' ? { reducedMotion: 'reduce' } : {});
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const label = (s) => `${mode}: ${s}`;

    // ---- develop (lexicon #25) --------------------------------------------------------------
    if (mode !== 'reduced') {
      const dv = await developed(page, 'dv');
      check(dv.boxes === 1 && dv.src?.startsWith('data:image/png') && dv.aria === 'true' && dv.off !== null && dv.off < 1, label('develop: the author\'s stand-in covers the image until it arrives'), JSON.stringify({ ...dv, src: dv.src?.slice(0, 22) }));
      if (mode !== 'drag') {
        const c = await centre(page, 'dv');
        check(magenta(c), label('develop: the stand-in shows on screen'), JSON.stringify(c));
        const z = await centre(page, 'dz');
        check(magenta(z), label('develop: it also covers a positioned image'), JSON.stringify(z));
      }
      const dn = await developed(page, 'dn');
      check(dn.boxes === 1 && dn.src === dn.imgSrc && /blur\(3\.5cqi\)/.test(dn.filter), label('develop: without a stand-in, the image itself under a static blur (3.5cqi)'), JSON.stringify({ src: dn.src, filter: dn.filter }));
      const dc = await developed(page, 'dc');
      check(!dc.container, label('develop: an image that has already arrived has no stand-in'), JSON.stringify(dc));
      const ds = await developed(page, 'ds');
      check(ds.boxes === 1 && (ds.imgCurrent ? ds.src === ds.imgCurrent : ds.srcset === ds.imgSrcset), label('develop: a responsive image\'s copy takes the same candidates, or the one already picked'), JSON.stringify({ srcset: ds.srcset, src: ds.src, imgCurrent: ds.imgCurrent }));
      const dp = await developed(page, 'dp');
      check(dp.imgCurrent ? dp.boxes === 1 && dp.src === dp.imgCurrent : dp.boxes === 0, label('develop: an unpicked <picture> without a stand-in gets none; a picked one, its pick'), JSON.stringify(dp));
      const dg = await developed(page, 'dg');
      check(dg.boxes === 1 && dg.off < 1, label('develop: the stand-in moves with the element\'s layers (rise)'), JSON.stringify({ off: dg.off }));
    }
    page.release(...HELD);
    await sleep(500);
    const fading = await developed(page, mode === 'reduced' ? 'dv' : 'dn');
    const want = mode === 'reduced' ? 200 : 1200;
    if (mode === 'reduced') {
      // Arrived within 500 ms; a 200 ms fade may be over already.
      check(!fading.fade || fading.fade.duration === want, label('develop: reduced motion fades in 200 ms'), JSON.stringify(fading));
    } else {
      check(fading.fade?.duration === want && /0\.16, 0\.84, 0\.24, 1/.test(fading.fade.easing) && fading.fade.state === 'running', label('develop: once loaded and decoded, the stand-in fades over 1.2 s (settle)'), JSON.stringify(fading.fade));
    }
    await sleep(1400);
    const gone = await page.evaluate(() =>
      ['dv', 'dn', 'ds', 'dg', 'dz'].map((id) => document.getElementById(id).shadowRoot.querySelector('[part=develop]')?.children.length ?? 0)
    );
    check(gone.every((n) => n === 0), label('develop: stand-ins are removed after the fade'), JSON.stringify(gone));
    const dx = await developed(page, 'dx');
    const warned = await page.evaluate(() => window.cvWarnings.filter((w) => w.includes('develop:')));
    check(dx.boxes === 1 && warned.some((w) => w.endsWith('#dx')), label('develop: a failed image keeps its stand-in, with a warning'), JSON.stringify({ boxes: dx.boxes, warned }));
    const twice = [...page.hits].filter(([url, n]) => n > 1 && url.includes('hold=1'));
    check(!twice.length, label('develop: the copy shares the image\'s download'), JSON.stringify(twice));

    // ---- focus on large pictures (F12, lexicon #12) -------------------------------------------
    if (mode === 'drag') {
      const fl = await focusState(page, 'fl');
      check(fl.fades === 1 && fl.onContainer, label('focus: a large picture fades a copy under drag too'), JSON.stringify(fl));
    } else {
      await atProgress(page, 'fl', 0.2);
      await sleep(300);
      await atProgress(page, 'fl', 0.2);
      let fl = await focusState(page, 'fl');
      check(fl.fades === 1 && fl.onContainer && fl.copyFilter === 'blur(4.5px)' && fl.copyScale === '' && /^scale\(1\.0\d+\)$/.test(fl.fillerScale) && fl.off < 1, label('focus: a large picture gets a copy blurred 4.5px on its image, a scaled one under its edges'), JSON.stringify(fl));
      check(fl.filters.length === 0 && fl.opacity > 0.3 && fl.opacity < 0.8, label('focus: the copy\'s opacity follows the blur; nothing animates filter'), JSON.stringify({ opacity: fl.opacity, filters: fl.filters }));
      if (mode !== 'fallback') {
        check(fl.native.every(Boolean) && fl.ownNative.every(Boolean), label('focus: copy and picture run on the compositor'), JSON.stringify({ fade: fl.native, own: fl.ownNative }));
      } else {
        check(fl.native.every((n) => !n) && fl.inline !== '', label('focus: fallback writes the copy\'s opacity directly'), JSON.stringify({ inline: fl.inline }));
      }
      await atProgress(page, 'fl', 0.5);
      fl = await focusState(page, 'fl');
      check(fl.opacity < 0.01, label('focus: sharp in the middle of the passage: the copy is gone'), JSON.stringify({ opacity: fl.opacity }));
      await atProgress(page, 'fs', 0.2);
      const fs = await focusState(page, 'fs');
      check(fs.fades === 0 && fs.filters.some((f) => /blur/.test(f)), label('focus: a small picture blurs'), JSON.stringify(fs));
      await atProgress(page, 'ft', 0.2);
      const ft = await focusState(page, 'ft');
      check(ft.fades === 0 && ft.filters.some((f) => /blur/.test(f)), label('focus: a picture with a caption blurs (the caption with it)'), JSON.stringify(ft));
      await atProgress(page, 'fv', 0.2);
      const fv = await focusState(page, 'fv');
      check(fv.fades === 1 && fv.copySrc === '/img/fb.png?w=800&h=600' && fv.copyFilter === 'none' && fv.fillerScale === null, label('focus: the author\'s pre-blurred variant replaces the static blur'), JSON.stringify(fv));

      // Visual comparison: the copy (left) beside real blur (right), at full and half blur (range
      // cover 45%–65%, the row in view). Saved for a person to judge; the check only asks that the
      // copy be clearly nearer real blur than the sharp picture is.
      const save = mode === 'native' ? (p) => `stills-compare-${engine}-${p}.png` : () => null;
      await atProgress(page, 'row', 0.45);
      await sleep(200);
      const full = [await compare(page, save('full')), await compare(page, null, true)];
      await atProgress(page, 'row', 0.55);
      await sleep(200);
      const half = [await compare(page, save('half')), await compare(page, null, true)];
      const [a, b] = await Promise.all([focusState(page, 'cmpA'), focusState(page, 'cmpB')]);
      check(a.fades === 1 && b.fades === 0 && full[0] < 0.6 * full[1] && half[0] < 0.85 * half[1], label('focus: the copy is nearer real blur than the sharp picture (mean difference, copy vs sharp)'), JSON.stringify({ full, half }));

      // A zone's time.
      const zone = await page.evaluate(() => document.getElementById('c').getBoundingClientRect().top + scrollY);
      const zf = [];
      for (const t of [0, 300, 700]) {
        await at(page, Math.round(zone + t));
        await sleep(100);
        await at(page, Math.round(zone + t));
        zf.push((await focusState(page, 'zf')).opacity);
      }
      check(zf[0] > 0.95 && zf[1] > 0.2 && zf[1] < 0.8 && zf[2] === 0, label('focus: on a zone\'s time the copy fades with the scene'), JSON.stringify(zf));
    }
    // reveal on entrance (focus + wipe + push), played on the clock: sampled as it plays.
    const rvTop = await page.evaluate(() => document.getElementById('rv').getBoundingClientRect().top + scrollY);
    if (mode === 'drag') await page.evaluate(() => document.getElementById('s').goTo(3));
    else await at(page, Math.round(rvTop - 100));
    const seen = [];
    for (let i = 0; i < 40; i++) {
      seen.push(await focusState(page, 'rv'));
      await sleep(60);
    }
    const ops = seen.map((v) => v.opacity);
    if (mode === 'reduced') {
      check(seen.every((v) => v.fades === 0 && v.filters.length === 0), label('reveal: reduced motion keeps opacity only (no copy, no blur)'), JSON.stringify(seen.at(-1)));
    } else {
      check(seen.every((v) => v.fades === 1 && v.filters.length === 0) && ops.some((o) => o > 0.05 && o < 0.95), label('reveal: on entrance the copy fades with the blur; nothing animates filter'), JSON.stringify(ops.map((o) => +o.toFixed(2))));
      check(ops.at(-1) === 0, label('reveal: sharp at the end'), JSON.stringify({ end: ops.at(-1) }));
    }
    if (mode === 'reduced') {
      await atProgress(page, 'fl', 0.2);
      const fl = await focusState(page, 'fl');
      check(fl.fades === 1 && fl.opacity > 0.3, label('focus: scroll-driven focus keeps its crossfade under reduced motion'), JSON.stringify(fl));
    }

    const cvErrors = await page.evaluate(() => window.cvErrors);
    check(!errors.length && !cvErrors.length, label('no errors'), JSON.stringify({ errors, cvErrors }));
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failed ? `\nstills: ${failed} failed` : '\nstills: ok');
process.exit(failed ? 1 : 0);
