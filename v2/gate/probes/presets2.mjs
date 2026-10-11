import { deflateSync } from 'node:zlib';
import { launch } from './browser.mjs';

/**
 * P3.7 presets, second set (lexicon #27 duotone, #35 unroll, #40 invert). `duotone`: a print of
 * each image in two inks (dark ground, light ink through a mask of the image's luminance, the
 * image's alpha masking both) sits on its content box as the image lies in it, and the track shows
 * it as opacity (900 ms on entrance; on view it follows the scroll, on the compositor where it
 * can). Named pairs, two colours or the page's custom properties; another origin needs
 * crossorigin; a late image is printed once it arrives. `unroll`: a strip moves from
 * 100cqw − 100% to its place (the window is the nearest size container, else the stage's frame),
 * the other way for text that starts at its left, and follows a resized window. `invert`: the
 * element blends by difference, white unless the page says otherwise, and its scene is isolated
 * while any element in it does. Scroll (native and fallback), reduced motion, drag.
 *
 * Images are made here (bands of grey levels, and one with a transparent half) and served at
 * /img/ on both hosts; `hold=1` waits until the probe releases it.
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
/** A w × h RGBA PNG; `pixel(x, y)` gives [r, g, b, a]. */
const png = (w, h, pixel) => {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 4);
    for (let x = 0; x < w; x++) row.set(pixel(x, y), 1 + x * 4);
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};
const made = new Map();
/** bands: equal vertical bands of the grey levels `v`; alpha: a transparent left half, black over white on the right. */
const image = (url) => {
  const w = Number(url.searchParams.get('w') ?? 100);
  const h = Number(url.searchParams.get('h') ?? 100);
  if (url.pathname.endsWith('/alpha.png')) return png(w, h, (x, y) => (x < w / 2 ? [0, 0, 0, 0] : y < h / 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
  const v = (url.searchParams.get('v') ?? '0,255').split(',').map(Number);
  return png(w, h, (x) => {
    const g = v[Math.min(v.length - 1, Math.floor((x * v.length) / w))];
    return [g, g, g, 255];
  });
};

const open = async (query, options = {}) => {
  const warm = await browser.newPage();
  await warm.goto(`${base}/presets2.html?${query}`, { waitUntil: 'domcontentloaded' });
  await warm.waitForTimeout(800);
  await warm.close();
  const page = await browser.newPage({ viewport: { width: W, height: H }, ...options });
  let release;
  const held = new Promise((r) => (release = r));
  await page.route('**/img/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('hold')) await held;
    const key = url.pathname + url.search;
    if (!made.has(key)) made.set(key, image(url));
    await route.fulfill({ contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: made.get(key) });
  });
  page.release = release;
  // Not `load`: the held image keeps it from firing.
  await page.goto(`${base}/presets2.html?${query}`, { waitUntil: 'domcontentloaded' });
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
      const r = document.getElementById(id).getBoundingClientRect();
      return Math.round(r.top + scrollY - innerHeight + p * (innerHeight + r.height));
    },
    [id, p]
  );
  await at(page, y);
};
/** Scroll so that scene `u` is at p of its contain range (its hold). */
const atHold = async (page, p) => {
  const y = await page.evaluate((p) => {
    const r = document.getElementById('u').getBoundingClientRect();
    return Math.round(r.top + scrollY + p * (r.height - innerHeight));
  }, p);
  await at(page, y);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const near = (a, b, d = 10) => a.every((v, i) => Math.abs(v - b[i]) <= d);

/** Pixels of a screenshot clip, as { w, h, d } (RGBA). */
const shoot = async (page, clip) => {
  const png = await page.screenshot({ clip });
  return page.evaluate(async (b64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    const g = c.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    return { w: bitmap.width, h: bitmap.height, d: [...g.getImageData(0, 0, bitmap.width, bitmap.height).data] };
  }, png.toString('base64'));
};
const rgb = (s, x, y) => {
  const i = (y * s.w + x) * 4;
  return [s.d[i], s.d[i + 1], s.d[i + 2]];
};
const rectOf = (page, selector) =>
  page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height, left: r.left, right: r.right };
  }, selector);

/** The print of `id`: its container, boxes, opacity, inks, masks and the layer driving it. */
const printed = (page, id) =>
  page.evaluate((id) => {
    const a = document.getElementById(id);
    const container = a.shadowRoot.querySelector('[part=duotone]');
    const box = container?.firstElementChild;
    const ink = box?.firstElementChild;
    const layer = a.layers.find((l) => l.el === container);
    const anims = container?.getAnimations() ?? [];
    const img = a.querySelector('img');
    const r = img.getBoundingClientRect();
    const b = box?.getBoundingClientRect();
    const cs = (el) => el && getComputedStyle(el);
    return {
      container: !!container,
      aria: container?.getAttribute('aria-hidden') ?? null,
      boxes: container?.children.length ?? 0,
      opacity: container ? +getComputedStyle(container).opacity : null,
      inline: container?.style.opacity ?? null,
      dark: cs(box)?.backgroundColor ?? null,
      light: cs(ink)?.backgroundColor ?? null,
      mask: ink?.style.getPropertyValue('mask-image') ?? null,
      modes: [box, ink].map((el) => el?.style.getPropertyValue('mask-mode') ?? null),
      size: ink?.style.getPropertyValue('mask-size') ?? null,
      position: ink?.style.getPropertyValue('mask-position') ?? null,
      layer: !!layer,
      native: !!layer?.native,
      anims: anims.map((x) => ({
        duration: x.effect.getTiming().duration,
        props: [...new Set(x.effect.getKeyframes().flatMap((k) => Object.keys(k)))].filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)),
      })),
      off: b ? +Math.max(Math.abs(b.left - r.left), Math.abs(b.top - r.top), Math.abs(b.width - r.width), Math.abs(b.height - r.height)).toFixed(2) : null,
    };
  }, id);

/**
 * The print against the picture under it, on a row through the middle of the image: each pixel
 * that is clearly black, white or the background (magenta) in the picture must be the dark ink,
 * the light ink or the background in the print. Pixels within 3 px of a change are left out.
 */
const alignment = async (page, id, dark, light) => {
  const clip = await rectOf(page, `#${id} img`);
  const hide = (on) =>
    page.evaluate(([id, on]) => {
      document.getElementById(id).shadowRoot.querySelector('[part=duotone]').style.display = on ? 'none' : '';
    }, [id, on]);
  const print = await shoot(page, clip);
  await hide(true);
  const plain = await shoot(page, clip);
  await hide(false);
  const want = (c) => (near(c, [0, 0, 0], 20) ? dark : near(c, [255, 255, 255], 20) ? light : near(c, [255, 0, 255], 20) ? [255, 0, 255] : null);
  let n = 0;
  let bad = 0;
  const kinds = new Set();
  for (const y of [Math.floor(plain.h / 4), Math.floor((plain.h * 3) / 4)]) {
    for (let x = 3; x < plain.w - 3; x++) {
      const c = rgb(plain, x, y);
      const w = want(c);
      if (!w || [-3, 3].some((dx) => want(rgb(plain, x + dx, y))?.join() !== w.join())) continue;
      n++;
      kinds.add(w.join());
      if (!near(rgb(print, x, y), w, 12)) bad++;
    }
  }
  return { n, bad, kinds: kinds.size, sample: rgb(print, Math.floor(print.w / 2), Math.floor(print.h / 2)) };
};

/** The unrolling strips: their content's left and right edges, and their windows'. */
const strips = (page) =>
  page.evaluate(() => {
    const edge = (s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { left: +r.left.toFixed(1), right: +r.right.toFixed(1), width: +r.width.toFixed(1) };
    };
    const frame = document.getElementById('s').shadowRoot.querySelector('[part=frame]').getBoundingClientRect();
    return {
      ur: edge('#ur .in'),
      w1: edge('#w1'),
      ul: edge('#ul .in'),
      w2: edge('#w2'),
      frame: { left: +frame.left.toFixed(1), right: +frame.right.toFixed(1), width: +frame.width.toFixed(1) },
      uh: edge('#uht'),
      w3: edge('#w3'),
    };
  });
const close = (a, b) => Math.abs(a - b) <= 1.5;

/** Colours where the bars of the invert scene cross the stripes (black, white, nothing). */
const inverted = async (page) => {
  const clip = await rectOf(page, '#c .stripes');
  const s = await shoot(page, { ...clip, height: 200 });
  const bar = await page.evaluate(() => ['#inv .bar', '#inv2 .bar'].map((q) => {
    const r = document.querySelector(q).getBoundingClientRect();
    return r.top + r.height / 2;
  }));
  return bar.map((y) => [100, 300, 500].map((x) => rgb(s, x, Math.round(y - clip.y))));
};
const isolation = (page) =>
  page.evaluate(() => ['a', 'b', 'u', 'c'].map((id) => getComputedStyle(document.getElementById(id)).isolation));

const INK = { blue: ['#0f1d45', '#a9cfea'], orange: ['#1a120e', '#f08a2c'] };

try {
  for (const mode of ['native', 'fallback', 'reduced', 'drag']) {
    const query = { native: 'x', fallback: 'fallback', reduced: 'x', drag: 'drag' }[mode];
    const page = await open(query, mode === 'reduced' ? { reducedMotion: 'reduce' } : {});
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const label = (s) => `${mode}: ${s}`;
    const clock = mode === 'native' || mode === 'fallback';

    // ---- duotone on entrance (scene a) ----------------------------------------------------------
    // The late image first: until it arrives the page is loading, and screenshots wait for fonts.
    const early = await printed(page, 'dt7');
    page.release();
    const ops = [];
    for (let i = 0; i < 10; i++) {
      ops.push((await printed(page, 'dt1')).opacity);
      await sleep(60);
    }
    const dt1 = await printed(page, 'dt1');
    check(dt1.container && dt1.aria === 'true' && dt1.boxes === 1 && dt1.layer && dt1.off < 1, label('duotone: a hidden print on the image\'s box, driven by a layer of its own'), JSON.stringify(dt1));
    check(dt1.modes.join() === 'alpha,luminance' && /bands\.png/.test(dt1.mask) && dt1.size === '100% 100%', label('duotone: the ground masked by the image\'s alpha, the light ink by its luminance'), JSON.stringify({ modes: dt1.modes, mask: dt1.mask, size: dt1.size }));
    check(near(hex(INK.blue[0]), dt1.dark.match(/\d+/g).map(Number), 1) && near(hex(INK.blue[1]), dt1.light.match(/\d+/g).map(Number), 1), label('duotone: blue inks by default'), JSON.stringify({ dark: dt1.dark, light: dt1.light }));
    check(ops[0] < 1 && ops.every((o, i) => i === 0 || o >= ops[i - 1] - 1e-4), label('duotone: the print comes on, never back'), JSON.stringify(ops));
    if (clock) check(dt1.anims.length === 1 && dt1.anims[0].duration === 900 && dt1.anims[0].props.join() === 'opacity', label('duotone: on entrance 900 ms, opacity only'), JSON.stringify(dt1.anims));
    if (mode === 'reduced') check(ops.slice(5).every((o) => o === 1), label('duotone: under reduced motion the print is on within moments'), JSON.stringify(ops));
    await sleep(900);
    const end1 = await printed(page, 'dt1');
    check(end1.opacity === 1, label('duotone: then fully printed'), JSON.stringify(end1.opacity));
    if (mode !== 'drag') {
      const a1 = await alignment(page, 'dt1', hex(INK.blue[0]), hex(INK.blue[1]));
      check(a1.n > 200 && a1.bad === 0 && a1.kinds === 2, label('duotone: black prints the dark ink, white the light'), JSON.stringify(a1));
      const mid = await rectOf(page, '#dt1 img');
      const grey = rgb(await shoot(page, { x: mid.x + 140, y: mid.y + 70, width: 20, height: 10 }), 10, 5);
      const [d, l] = INK.blue.map(hex);
      check(grey.every((v, i) => v > d[i] + 20 && v < l[i] - 20), label('duotone: grey prints between the inks'), JSON.stringify(grey));
      const a2 = await alignment(page, 'dt2', hex(INK.orange[0]), hex(INK.orange[1]));
      const dt2 = await printed(page, 'dt2');
      check(a2.n > 150 && a2.bad === 0 && a2.kinds === 2 && dt2.size === 'cover' && dt2.position === '30% 22%', label('duotone: a named pair, the masks cropped as the image (cover, 30% 22%)'), JSON.stringify({ ...a2, size: dt2.size, position: dt2.position }));
      const a3 = await alignment(page, 'dt3', [32, 32, 32], [0, 255, 0]);
      check(a3.n > 200 && a3.bad === 0 && a3.kinds === 2, label('duotone: the page\'s --cv-duotone-dark and -light'), JSON.stringify(a3));
      const a4 = await alignment(page, 'dt4', hex(INK.orange[0]), hex(INK.orange[1]));
      check(a4.n > 150 && a4.bad === 0 && a4.kinds === 3, label('duotone: what is transparent or letterboxed stays so'), JSON.stringify(a4));
    }
    const dt5 = await printed(page, 'dt5');
    const dt6 = await printed(page, 'dt6');
    const warnings = await page.evaluate(() => window.cvWarnings);
    check(dt5.boxes === 0 && warnings.some((w) => /duotone: .* is from another origin; add crossorigin to print it/.test(w) && w.endsWith('#dt5')), label('duotone: an image from another origin is left as it is, with a warning'), JSON.stringify({ boxes: dt5.boxes, warnings }));
    check(dt6.boxes === 1 && /localhost/.test(dt6.mask), label('duotone: with crossorigin it is printed'), JSON.stringify({ boxes: dt6.boxes, mask: dt6.mask }));
    if (mode !== 'drag') {
      const a6 = await alignment(page, 'dt6', hex(INK.blue[0]), hex(INK.blue[1]));
      check(a6.n > 80 && a6.bad === 0 && a6.kinds === 2, label('duotone: the shared image prints like the others'), JSON.stringify(a6));
    }
    await page.waitForFunction(() => document.querySelector('#dt7 img').complete);
    await frames(page, 4);
    const late = await printed(page, 'dt7');
    check(early.boxes === 0 && late.boxes === 1 && /late\.png/.test(late.mask) && late.off < 1, label('duotone: an image that arrives late is printed then'), JSON.stringify({ early: early.boxes, late }));

    // ---- duotone on view (scene b) --------------------------------------------------------------
    if (mode !== 'drag') {
      const dv = [];
      for (const p of [0.1, 0.4, 0.7]) {
        await atProgress(page, 'dv', p);
        dv.push(await printed(page, 'dv'));
      }
      check(dv[0].opacity === 0 && Math.abs(dv[1].opacity - 0.5) < 0.08 && dv[2].opacity === 1, label('duotone: on view it follows the scroll (cover 20% to 60%)'), JSON.stringify(dv.map((d) => d.opacity)));
      if (mode === 'native') check(dv[1].native && dv[1].anims.length === 1 && dv[1].anims[0].props.join() === 'opacity', label('duotone: on view the print runs natively, opacity only'), JSON.stringify(dv[1]));
      if (mode === 'fallback') check(!dv[1].native && dv[1].inline !== '', label('duotone: without native output it is written each frame'), JSON.stringify(dv[1]));
    }

    // ---- unroll (scene u) -----------------------------------------------------------------------
    if (mode !== 'drag') {
      await atHold(page, 0);
      const s0 = await strips(page);
      await atHold(page, 0.5);
      const s5 = await strips(page);
      await atHold(page, 1);
      const s1 = await strips(page);
      check(close(s0.ur.right, s0.w1.right) && close(s5.ur.left, s5.w1.left + 0.5 * (600 - 1800)) && close(s1.ur.left, s1.w1.left), label('unroll: a vertical-rl strip starts with its right edge on its window\'s, ends with its left (600px container)'), JSON.stringify({ s0: [s0.ur, s0.w1], s5: s5.ur.left, s1: [s1.ur.left, s1.w1.left] }));
      const travel = s1.ul.left - s0.ul.left;
      check(close(s0.ul.left, s0.w2.left) && close(travel, s0.frame.width - 1500), label('unroll: a vertical-lr strip goes the other way, by the stage frame\'s width less its own'), JSON.stringify({ start: [s0.ul.left, s0.w2.left], travel, frame: s0.frame.width }));
      check(close(s0.uh.left, s0.w3.left) && close(s1.uh.right, s1.w3.right), label('unroll: a left-to-right line ends with its end on its window\'s'), JSON.stringify({ s0: [s0.uh, s0.w3], s1: [s1.uh, s1.w3] }));
      if (mode === 'native') {
        const k = await page.evaluate(() => {
          const l = document.getElementById('ur').layers[0];
          const a = l.el.getAnimations()[0];
          return { native: !!l.native, first: a ? String(a.effect.getKeyframes()[0].translate) : null };
        });
        check(k.native && /cqw/.test(k.first), label('unroll: runs natively, in container units'), JSON.stringify(k));
      }
      // The window narrows: the strip follows without a rebuild.
      await atHold(page, 0.5);
      await page.evaluate(() => (document.getElementById('w1').style.width = '500px'));
      await frames(page, 4);
      await sleep(60);
      const narrow = await strips(page);
      check(close(narrow.ur.left, narrow.w1.left + 0.5 * (500 - 1800)), label('unroll: a narrower window, the same half way'), JSON.stringify({ ur: narrow.ur.left, w1: narrow.w1.left }));
      await page.evaluate(() => (document.getElementById('w1').style.width = ''));
    }

    // ---- invert (scene c) -----------------------------------------------------------------------
    if (mode === 'drag') {
      await page.evaluate(() => document.getElementById('s').goTo(3));
      await sleep(1200);
    } else {
      await page.evaluate(() => document.getElementById('c').scrollIntoView());
      await frames(page, 4);
      await sleep(80);
    }
    const looks = await page.evaluate(() => ['inv', 'inv2'].map((id) => {
      const s = getComputedStyle(document.getElementById(id));
      return [s.mixBlendMode, s.color];
    }));
    check(looks[0].join() === 'difference,rgb(255, 255, 255)' && looks[1].join() === 'difference,rgb(0, 255, 0)', label('invert: blends by difference, white unless the page says (green)'), JSON.stringify(looks));
    check((await isolation(page)).join() === 'auto,auto,auto,isolate', label('invert: only its scene is isolated'), JSON.stringify(await isolation(page)));
    const [white, green] = await inverted(page);
    check(near(white[0], [255, 255, 255]) && near(white[1], [0, 0, 0]) && near(white[2], [255, 255, 255]), label('invert: white on black, black on white, itself over nothing (the red page behind is not blended)'), JSON.stringify(white));
    check(near(green[0], [0, 255, 0]) && near(green[1], [255, 0, 255]) && near(green[2], [0, 255, 0]), label('invert: green inverts to magenta on white'), JSON.stringify(green));
    await page.evaluate(() => document.getElementById('inv').setAttribute('fx', 'fade'));
    await frames(page, 6);
    const one = { iso: await isolation(page), blend: await page.evaluate(() => getComputedStyle(document.getElementById('inv')).mixBlendMode) };
    await page.evaluate(() => document.getElementById('inv2').removeAttribute('fx'));
    await frames(page, 6);
    await sleep(700);
    const none = { iso: await isolation(page), bars: await inverted(page) };
    check(one.iso[3] === 'isolate' && one.blend === 'normal' && none.iso[3] === 'auto' && none.bars[0].every((c) => near(c, [34, 34, 34])) && none.bars[1].every((c) => near(c, [0, 255, 0])), label('invert: the scene stays isolated while one element blends, and no longer once none does'), JSON.stringify({ one, none }));

    // ---- the preset goes ------------------------------------------------------------------------
    await page.evaluate(() => document.getElementById('dt1').setAttribute('fx', 'fade'));
    await frames(page, 6);
    const gone = await printed(page, 'dt1');
    check(!gone.container, label('duotone: the print goes with the preset'), JSON.stringify(gone));

    const cvErrors = await page.evaluate(() => window.cvErrors);
    check(!errors.length && !cvErrors.length, label('no errors'), JSON.stringify({ errors, cvErrors }));
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failed ? `\npresets2: ${failed} failed` : '\npresets2: ok');
process.exit(failed ? 1 : 0);
