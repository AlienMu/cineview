import { launch } from './browser.mjs';

/**
 * P3.6 presets, first set (lexicon #9 draw, #13 count, #33 axis). `draw`: the shapes measure 1
 * and dash 1 with a gap of 2, and a dash offset from a hair past 1 to 0 draws them (inherited from
 * the shadow layer, or written on stagger targets); an undrawn round cap leaves no dot; the
 * author's pathLength and dashes come back when the preset goes. `count`: a copy with a wheel per
 * digit shows over the number while it counts (from zeros, 170 ms a digit, once), on the
 * original's glyphs; then the number itself. `axis`: font-variation-settings from 200 (or the
 * given start) to the text's own weight or width. Reduced motion: drawn, no count, axes at their
 * end. Scroll (native and fallback), drag.
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

const open = async (query, options = {}) => {
  const warm = await browser.newPage();
  await warm.goto(`${base}/presets.html?${query}`);
  await warm.waitForTimeout(800);
  await warm.close();
  const page = await browser.newPage({ viewport: { width: W, height: H }, ...options });
  await page.goto(`${base}/presets.html?${query}`);
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lexicon #33's sweep, cubic-bezier(.45, 0, .2, 1), at x. */
const sweep = (x) => {
  const curve = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const t = (lo + hi) / 2;
    if (curve(0.45, 0.2, t) < x) lo = t;
    else hi = t;
  }
  return curve(0, 1, (lo + hi) / 2);
};

/** Shapes of `ids`: pathLength, inline dashes and offset, computed offset. */
const shapes = (page, ids) =>
  page.evaluate(
    (ids) =>
      ids.map((id) => {
        const el = document.getElementById(id);
        return {
          length: el.getAttribute('pathLength'),
          dash: el.style.strokeDasharray,
          inline: el.style.strokeDashoffset,
          anims: el.getAnimations().length,
          offset: +parseFloat(getComputedStyle(el).strokeDashoffset).toFixed(4),
        };
      }),
    ids
  );

/** The count of `id`: structure, the copy's visibility and wheels, its animation, alignment. */
const counted = (page, id) =>
  page.evaluate((id) => {
    const a = document.getElementById(id);
    const el = a.shadowRoot.querySelector('[part=count]');
    if (!el) return { mounted: false, slotFree: !a.shadowRoot.querySelector('slot')?.closest('[part=count]') };
    const source = el.querySelector('[part=count-source]');
    const copy = el.lastElementChild;
    const line = copy.firstElementChild;
    const cs = getComputedStyle(el);
    const wheels = [...line.children].map((_, i) => +cs.getPropertyValue(`--cv-count-${i}`));
    const anims = el.getAnimations();
    const text = [...a.querySelectorAll('*')].flatMap((n) => [...n.childNodes]).find((n) => n.nodeType === 3 && n.data.trim());
    const range = document.createRange();
    const start = text.data.length - text.data.trimStart().length;
    range.setStart(text, start);
    range.setEnd(text, text.data.trimEnd().length);
    const r = range.getBoundingClientRect();
    const l = line.getBoundingClientRect();
    return {
      mounted: true,
      slotted: source?.firstElementChild?.localName === 'slot',
      hidden: copy.getAttribute('aria-hidden'),
      tabular: cs.fontVariantNumeric,
      on: cs.getPropertyValue('--cv-count-on').trim(),
      sourceOpacity: +getComputedStyle(source).opacity,
      copyOpacity: +getComputedStyle(copy).opacity,
      wheels,
      text: a.textContent.trim(),
      anims: anims.map((x) => ({ duration: x.effect.getTiming().duration, state: x.playState })),
      off: +Math.max(Math.abs(l.left - r.left), Math.abs(l.top - r.top), Math.abs(l.width - r.width)).toFixed(2),
    };
  }, id);

/** Computed font-variation-settings of the text in each element; the axis value as a number. */
const axes = (page) =>
  page.evaluate(() =>
    ['#ax h2', '#ax2 p', '#ax3 p'].map((s) => {
      const v = getComputedStyle(document.querySelector(s)).fontVariationSettings;
      return { text: v, value: +(v.match(/[\d.]+$/)?.[0] ?? NaN) };
    })
  );

/** A screenshot of an element's box, as PNG bytes; `pixels` counts non-white ones. */
const box = async (page, id, pad = 0) => {
  const clip = await page.evaluate(
    ([id, pad]) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { x: r.left - pad, y: r.top - pad, width: r.width + 2 * pad, height: r.height + 2 * pad };
    },
    [id, pad]
  );
  return page.screenshot({ clip });
};
const pixels = (page, png) =>
  page.evaluate(async (b64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    const g = c.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    const d = g.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.min(d[i], d[i + 1], d[i + 2]) < 230) n++;
    return n;
  }, png.toString('base64'));
/** Pixels that differ clearly (> 96 in a channel) between two same-sized PNGs, and the ink in the first. */
const differ = (page, a, b) =>
  page.evaluate(
    async ([a, b]) => {
      const read = async (b64) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
        const c = new OffscreenCanvas(bitmap.width, bitmap.height);
        const g = c.getContext('2d');
        g.drawImage(bitmap, 0, 0);
        return g.getImageData(0, 0, bitmap.width, bitmap.height).data;
      };
      const [x, y] = await Promise.all([read(a), read(b)]);
      let diff = 0;
      let ink = 0;
      for (let i = 0; i < x.length; i += 4) {
        if (Math.min(x[i], x[i + 1], x[i + 2]) < 230) ink++;
        if (Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])) > 96) diff++;
      }
      return { diff, ink };
    },
    [a.toString('base64'), b.toString('base64')]
  );

try {
  for (const mode of ['native', 'fallback', 'reduced', 'drag']) {
    const query = { native: 'x', fallback: 'fallback', reduced: 'x', drag: 'drag' }[mode];
    const page = await open(query, mode === 'reduced' ? { reducedMotion: 'reduce' } : {});
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const label = (s) => `${mode}: ${s}`;
    const clock = mode === 'native' || mode === 'fallback';

    // ---- on entrance (scene a), sampled as it plays -------------------------------------------
    const start = { dr: await shapes(page, ['drp', 'drc']), ax: await axes(page), ca: await counted(page, 'ca') };
    const dts = [];
    const drs = [];
    const cas = [];
    const axs = [];
    for (let i = 0; i < 24; i++) {
      dts.push((await shapes(page, ['dt0', 'dt1', 'dt2'])).map((s) => s.offset));
      drs.push((await shapes(page, ['drp']))[0].offset);
      cas.push(await counted(page, 'ca'));
      axs.push((await axes(page))[0].value);
      if (i === 3 && mode !== 'reduced') {
        const cg = await counted(page, 'cg');
        check(cg.mounted && cg.on === '1' && cg.off < 1, label('count: the copy sits on the number while it rises'), JSON.stringify({ off: cg.off, on: cg.on }));
      }
      await sleep(70);
    }
    await sleep(600);
    const end = {
      dr: await shapes(page, ['drp', 'drc']),
      dt: await shapes(page, ['dt0', 'dt1', 'dt2']),
      ax: await axes(page),
      ca: await counted(page, 'ca'),
      cg: await counted(page, 'cg'),
    };
    const warnings = await page.evaluate(() => window.cvWarnings);

    if (mode === 'reduced') {
      check(start.dr.every((s) => s.length !== '1' && s.offset === 0), label('draw: drawn at once (nothing set on the shapes)'), JSON.stringify(start.dr));
      check(drs.every((o) => o === 0) && dts.every((d) => d.every((o) => o === 0)), label('draw: no stroke moves, stagger targets included'), JSON.stringify({ drs: drs.slice(0, 3), dts: dts.slice(0, 3) }));
      check(!start.ca.mounted && start.ca.slotFree && !(await counted(page, 'cg')).mounted, label('count: no copy; the number shows as it is'), JSON.stringify(start.ca));
      check(start.ax.map((a) => a.value).join() === '700,800,100' && axs.every((v) => v === 700), label('axis: the text holds its end axes from the start'), JSON.stringify(start.ax.map((a) => a.text)));
      check(!warnings.some((w) => /stagger|count:/.test(w)), label('no stagger or count warnings'), JSON.stringify(warnings));
    } else {
      // draw
      check(start.dr.every((s) => s.length === '1' && /^1,? 2$/.test(s.dash)), label('draw: shapes measure 1 (pathLength) and dash 1, gap 2'), JSON.stringify(start.dr));
      check(drs[0] > 0.9 && drs.every((o, i) => i === 0 || o <= drs[i - 1] + 1e-4) && end.dr.every((s) => s.offset === 0), label('draw: the dash offset goes from 1 to 0 and the stroke is drawn'), JSON.stringify({ first: drs[0], mid: drs[8], end: end.dr.map((s) => s.offset) }));
      check(start.dr.every((s) => s.inline === ''), label('draw: the offset is inherited from the shadow layer'), JSON.stringify(start.dr.map((s) => s.inline)));
      if (clock) {
        const t = await page.evaluate(() => document.getElementById('dr').layers.flatMap((l) => l.el.getAnimations().map((a) => a.effect.getTiming().duration)));
        check(t.includes(1400), label('draw: on entrance it takes 1.4 s'), JSON.stringify(t));
      }
      const staggered = dts.find((d) => d[0] < d[1] - 0.05 && d[1] < d[2] - 0.05);
      check(!!staggered && end.dt.every((s) => s.offset === 0 && (parseFloat(s.inline) === 0 || s.anims > 0) && /^1,? 2$/.test(s.dash)), label('draw: stagger targets are drawn one after another, the offset on each'), JSON.stringify({ staggered, end: end.dt }));
      check(warnings.some((w) => w.startsWith('[cineview] draw has no shapes') && w.endsWith('#dn')), label('draw: an element without shapes is reported'), JSON.stringify(warnings));
      // count
      const ca = start.ca;
      check(ca.mounted && ca.slotted && ca.hidden === 'true' && ca.tabular === 'tabular-nums' && ca.wheels.length === 4 && ca.off < 1, label('count: a hidden copy with a wheel per digit over the number; tabular figures'), JSON.stringify(ca));
      const mid = cas.find((c) => c.on === '1' && c.wheels.some((w) => w > 0) && c.wheels.join() !== '1,2,3,4');
      check(!!mid && mid.sourceOpacity === 0 && mid.copyOpacity === 1, label('count: while counting the copy shows, the number does not'), JSON.stringify(mid));
      // The value the wheels read: whole figures, and the last wheel as it turns.
      const read = (w) => w.reduce((n, v, i) => n * 10 + (i === w.length - 1 ? v : Math.floor(v)), 0);
      check(cas.every((c, i) => i === 0 || read(c.wheels) >= read(cas[i - 1].wheels) - 1e-6) && cas.every((c) => c.wheels.every((w) => w >= 0 && w <= 10)), label('count: the wheels only roll forward'), JSON.stringify(cas.map((c) => c.wheels.join('|')).slice(0, 8)));
      check(end.ca.on === '0' && end.ca.wheels.join() === '1,2,3,4' && end.ca.sourceOpacity === 1 && end.ca.copyOpacity === 0 && end.ca.text === '$1,234', label('count: then the number itself, as written'), JSON.stringify(end.ca));
      check(end.cg.wheels.join() === '1,2,3,4,5' && end.cg.on === '0', label('count: groups split by spaces count as one number'), JSON.stringify(end.cg.wheels));
      if (clock) {
        check(ca.anims.length === 1 && ca.anims[0].duration === 680, label('count: 170 ms a digit (4 digits, 680 ms)'), JSON.stringify(ca.anims));
      }
      check(warnings.some((w) => /count: its text holds more than one number/.test(w) && w.endsWith('#cx')) && !(await counted(page, 'cx')).mounted, label('count: two numbers are refused, with a warning'), JSON.stringify(warnings));
      // The copy at its final digits, made visible, against the number: glyph on glyph.
      const plain = await box(page, 'ca');
      await page.evaluate(() => {
        const el = document.getElementById('ca').shadowRoot.querySelector('[part=count]');
        el.firstElementChild.style.opacity = '0';
        el.lastElementChild.style.opacity = '1';
      });
      const copy = await box(page, 'ca');
      await page.evaluate(() => {
        const el = document.getElementById('ca').shadowRoot.querySelector('[part=count]');
        el.firstElementChild.style.opacity = 'calc(1 - var(--cv-count-on, 0))';
        el.lastElementChild.style.opacity = 'var(--cv-count-on, 0)';
      });
      const d = await differ(page, plain, copy);
      check(d.ink > 100 && d.diff <= 0.01 * d.ink, label('count: the copy\'s glyphs fall on the number\'s'), JSON.stringify(d));
      // axis
      const [ax, ax2, ax3] = start.ax;
      check(ax.value < 260 && ax2.value < 360 && ax3.value < 80, label('axis: from wght 200, the given start (300), the given width (75)'), JSON.stringify(start.ax.map((a) => a.text)));
      check(end.ax.map((a) => a.text).join() === '"wght" 700,"wght" 800,"wdth" 100', label('axis: to the text\'s own weight (700), the given end (800), its own width (100)'), JSON.stringify(end.ax.map((a) => a.text)));
      check(axs.every((v, i) => i === 0 || v >= axs[i - 1]), label('axis: the weight only grows'), JSON.stringify(axs.slice(0, 10)));
      if (clock) {
        const k = await page.evaluate(() => {
          const l = document.getElementById('ax').layers.find((l) => l.el.getAnimations().length);
          const a = l?.el.getAnimations()[0];
          const frames = a?.effect.getKeyframes() ?? [];
          const half = frames.reduce((b, f) => (Math.abs(f.offset - 0.5) < Math.abs(b.offset - 0.5) ? f : b), frames[0] ?? { offset: 9 });
          return { duration: a?.effect.getTiming().duration, offset: half.offset, value: +(String(half.fontVariationSettings).match(/[\d.]+$/)?.[0] ?? NaN) };
        });
        const want = 200 + 500 * sweep(k.offset);
        check(k.duration === 1100 && Math.abs(k.value - want) < 3, label('axis: 1.1 s on the sweep curve (.45, 0, .2, 1)'), JSON.stringify({ ...k, want: +want.toFixed(1) }));
      }
    }

    // A rebuild (an attribute, a new element, reduced motion changing) keeps entrances played.
    await page.evaluate(() => document.getElementById('s').invalidate());
    await frames(page, 4);
    await sleep(60);
    const rebuilt = {
      ax: (await axes(page)).map((a) => a.value).join(),
      dr: (await shapes(page, ['drp']))[0].offset,
      ca: await counted(page, 'ca'),
      running: await page.evaluate(() =>
        ['dr', 'ca', 'ax'].filter((id) => [...document.getElementById(id).shadowRoot.querySelectorAll('*')].some((el) => el.getAnimations().some((x) => x.playState === 'running')))
      ),
    };
    check(rebuilt.ax === '700,800,100' && rebuilt.dr === 0 && (rebuilt.ca.on ?? '0') === '0' && !rebuilt.running.length, label('a rebuild keeps played entrances as they ended'), JSON.stringify({ ...rebuilt, ca: rebuilt.ca.on }));

    // ---- below the fold (scene b) ---------------------------------------------------------------
    if (mode === 'drag') {
      const before = await counted(page, 'cb');
      check(before.on === '1' && before.wheels.join() === '0,0,0' && before.copyOpacity === 1, label('count: zeros before its scene'), JSON.stringify(before));
      await page.evaluate(() => document.getElementById('s').goTo(1));
      await sleep(1000);
      const after = await counted(page, 'cb');
      check(after.on === '0' && after.wheels.join() === '9,8,6', label('count: paged to its scene, it counts to 98.6'), JSON.stringify(after));
    } else if (mode !== 'reduced') {
      const before = await counted(page, 'cb');
      check(before.on === '1' && before.wheels.join() === '0,0,0' && before.copyOpacity === 1 && before.sourceOpacity === 0, label('count: zeros until it enters'), JSON.stringify(before));
      // The number arrives late (data loaded after the build): the count goes to the new value.
      await page.evaluate(() => (document.querySelector('#cb h2').textContent = '12.5%'));
      await frames(page, 6);
      await atProgress(page, 'cb', 0.3);
      await sleep(60);
      const playing = await counted(page, 'cb');
      if (clock) check(playing.anims.length === 1 && playing.anims[0].duration === 510, label('count: 3 digits, 510 ms'), JSON.stringify(playing.anims));
      await sleep(800);
      const after = await counted(page, 'cb');
      check(after.on === '0' && after.wheels.join() === '1,2,5' && after.text === '12.5%', label('count: a number changed before it enters counts to its new value'), JSON.stringify(after));
      await at(page, 0);
      await sleep(200);
      await atProgress(page, 'cb', 0.3);
      await sleep(100);
      const again = await counted(page, 'cb');
      check(again.on === '0' && again.wheels.join() === '1,2,5' && !again.anims.some((a) => a.state === 'running'), label('count: it plays once'), JSON.stringify(again));
      await page.evaluate(() => (document.querySelector('#cb h2').textContent = '33.3%'));
      await frames(page, 6);
      await sleep(100);
      const later = await counted(page, 'cb');
      check(later.on === '0' && later.sourceOpacity === 1 && later.wheels.join() === '3,3,3' && later.text === '33.3%' && !later.anims.some((a) => a.state === 'running'), label('count: a number changed after it counted shows at once'), JSON.stringify(later));
    }
    if (mode !== 'drag') {
      // draw on view: round caps, from half way through the passage.
      await atProgress(page, 'dd', 0.3);
      const undrawn = { s: (await shapes(page, ['ddp']))[0], ink: await pixels(page, await box(page, 'dd')) };
      check(undrawn.s.offset > 1 && undrawn.ink === 0, label('draw: undrawn, a round cap leaves no dot'), JSON.stringify(undrawn));
      await atProgress(page, 'dd', 0.7);
      const half = { s: (await shapes(page, ['ddp']))[0], ink: await pixels(page, await box(page, 'dd')) };
      check(Math.abs(half.s.offset - 0.5005) < 0.03 && half.ink > 0, label('draw: on view, half drawn half way through its range'), JSON.stringify(half));
      await atProgress(page, 'dd', 0.95);
      const drawn = (await shapes(page, ['ddp']))[0];
      check(drawn.offset === 0, label('draw: on view, drawn at the end of its range'), JSON.stringify(drawn));
      // count on view
      const cs = [];
      for (const p of [0.1, 0.4, 0.7]) {
        await atProgress(page, 'cs', p);
        cs.push(await counted(page, 'cs'));
      }
      if (mode === 'reduced') {
        check(cs.every((c) => !c.mounted), label('count: none on view either'), JSON.stringify(cs[0]));
      } else {
        check(cs[0].on === '1' && cs[0].wheels.join() === '0,0,0,0' && cs[1].on === '1' && cs[1].wheels.some((w) => w > 0) && cs[2].on === '0' && cs[2].wheels.join() === '4,0,9,6', label('count: on view it follows the scroll'), JSON.stringify(cs.map((c) => [c.on, c.wheels.join('|')])));
      }
    }

    // ---- the preset goes: shapes and the slot come back ---------------------------------------
    if (mode !== 'reduced') {
      await page.evaluate(() => {
        document.getElementById('dr').setAttribute('fx', 'rise');
        document.getElementById('ca').setAttribute('fx', 'rise');
      });
      await frames(page, 6);
      await sleep(100);
      const [p, c] = await shapes(page, ['drp', 'drc']);
      const ca = await counted(page, 'ca');
      check(p.length === null && p.dash === '' && c.length === '9' && c.dash === '' && p.offset === 0 && !ca.mounted && ca.slotFree, label('the preset goes: the author\'s pathLength and dashes, and the slot, come back'), JSON.stringify({ p, c, ca }));
    }

    const cvErrors = await page.evaluate(() => window.cvErrors);
    check(!errors.length && !cvErrors.length, label('no errors'), JSON.stringify({ errors, cvErrors }));
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failed ? `\npresets: ${failed} failed` : '\npresets: ok');
process.exit(failed ? 1 : 0);
