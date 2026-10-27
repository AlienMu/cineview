import { launch } from './browser.mjs';

/**
 * P3.4 split text (plan v3 §5, F5; lexicon #10 word scrub, #32 split reveal): `split="words|lines"`
 * plays one source's effects on the words or lines of an aria-hidden measured copy; the original
 * stays in the light DOM and shows again once the effects are complete. Lines: clipped, 950 ms,
 * 85 ms apart (or `stagger`); words on progress: windows of five units, one apart. The copy sits on
 * the original's glyphs; CJK punctuation stays with its word; refusals animate the element whole
 * with a warning; reduced motion shows the text at once; measured again on size, text, font and
 * theme changes. Scroll (native and fallback), drag.
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const H = 800;
const open = async (query, options = {}) => {
  const warm = await browser.newPage();
  await warm.goto(`${base}/split.html?${query}`);
  await warm.waitForTimeout(800);
  await warm.close();
  const page = await browser.newPage({ viewport: { width: 400, height: H }, ...options });
  await page.goto(`${base}/split.html?${query}`);
  await page.evaluate(() => window.ready);
  await page.evaluate(() => document.fonts.ready);
  return page;
};
const frames = (page, n = 3) =>
  page.evaluate(
    (n) =>
      new Promise((r) => {
        const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r());
        f(n);
      }),
    n
  );
const at = async (page, y) => {
  await page.evaluate((y) => scrollTo(0, y), y);
  await frames(page, 4);
  await page.waitForTimeout(60);
};

/** Per element: split or not, copy shown, original hidden, piece texts and opacities. */
const state = (page, id) =>
  page.evaluate((id) => {
    const a = document.getElementById(id);
    const root = a.shadowRoot;
    const copy = root.querySelector('[part=split]');
    const src = root.querySelector('[part=split-source]');
    const pieces = a.split?.pieces ?? [];
    return {
      split: !!a.split,
      copy: !!copy && copy.style.visibility !== 'hidden',
      hidden: !!src && src.style.opacity === '0',
      aria: copy?.getAttribute('aria-hidden') ?? null,
      n: pieces.length,
      texts: pieces.map((p) => p.textContent),
      op: pieces.map((p) => (p.style.opacity === '' ? 1 : Number(p.style.opacity))),
      lines: (() => {
        // Line boxes of the original: distinct tops of its text runs.
        const range = document.createRange();
        const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
        const tops = new Set();
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          range.selectNodeContents(n);
          for (const r of range.getClientRects()) if (r.width > 1) tops.add(Math.round(r.top));
        }
        return tops.size;
      })(),
    };
  }, id);

/**
 * Largest distance between the copy's glyph runs and the original's (Range rects of the same
 * text, in order), in CSS px. Pieces must be at rest (no transform) when this is read.
 */
const drift = (page, id) =>
  page.evaluate((id) => {
    const a = document.getElementById(id);
    const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let flat = '';
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      nodes.push({ n, at: flat.length });
      flat += n.data;
    }
    const pos = (i) => {
      let k = nodes.length - 1;
      while (nodes[k].at > i) k--;
      return [nodes[k].n, i - nodes[k].at];
    };
    const range = document.createRange();
    const leaves = [...a.split.pieces].flatMap((p) => [...p.querySelectorAll('span')]);
    let cursor = 0;
    let worst = 0;
    for (const leaf of leaves) {
      const text = leaf.textContent;
      const i = flat.indexOf(text, cursor);
      if (i < 0) return { worst: Infinity, text };
      cursor = i + text.length;
      // Last grapheme on both sides: the copy's runs may break inside a word (CJK).
      range.setStart(...pos(i));
      range.setEnd(...pos(i + text.length));
      const want = [...range.getClientRects()].filter((r) => r.width > 0.5).at(-1);
      range.selectNodeContents(leaf.firstChild);
      const got = [...range.getClientRects()].filter((r) => r.width > 0.5).at(-1);
      if (!want || !got) return { worst: Infinity, text };
      // Where each run starts (its right edge may differ by the kerning with the next run).
      worst = Math.max(
        worst,
        Math.abs(want.left - got.left),
        Math.abs(want.top - got.top),
        Math.abs(want.bottom - got.bottom)
      );
    }
    return { worst: +worst.toFixed(2), runs: leaves.length };
  }, id);

const monotone = (op) => op.every((v, k) => k === 0 || v <= op[k - 1] + 1e-6);

try {
  for (const mode of ['native', 'fallback']) {
    const page = await open(mode === 'fallback' ? 'fallback' : 'x');
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const label = (s) => `${mode}: ${s}`;

    // Lines on entrance (lexicon #32).
    let v = await state(page, 'ln');
    check(
      v.split && v.aria === 'true' && v.n === v.lines && v.n >= 3,
      label('lines: one piece per line of the original, aria-hidden copy'),
      JSON.stringify({ n: v.n, lines: v.lines, aria: v.aria })
    );
    const text = await page.evaluate(() => document.getElementById('ln').textContent.trim());
    check(
      text === 'Lines rise out of the page one after another, each a beat behind.',
      label('lines: the original text stays in the light DOM'),
      text
    );
    const timing = await page.evaluate(() =>
      document.getElementById('ln').split.pieces.map((p) => {
        const anim = p.getAnimations()[0];
        const t = anim?.effect.getTiming();
        return t ? { delay: t.delay, duration: t.duration, start: anim.startTime } : null;
      })
    );
    const ok = timing.every(Boolean);
    const gaps = ok
      ? timing
          .slice(1)
          .map((t, k) =>
            Math.round(t.delay + (t.start ?? 0) - timing[k].delay - (timing[k].start ?? 0))
          )
      : [];
    check(
      ok && timing.every((t) => Math.round(t.duration) === 950) && gaps.every((g) => g === 85),
      label('lines: 950 ms each, 85 ms apart'),
      JSON.stringify({ gaps, durations: timing.map((t) => t && Math.round(t.duration)) })
    );
    const clip = await page.evaluate(() => {
      const line = document.getElementById('ln').split.pieces[0].parentElement;
      const cs = getComputedStyle(line);
      const piece = getComputedStyle(document.getElementById('ln').split.pieces[0]);
      return {
        overflow: cs.overflowY,
        margin: cs.overflowClipMargin,
        origin: piece.transformOrigin,
        height: line.getBoundingClientRect().height,
      };
    });
    check(
      clip.overflow === 'clip' &&
        clip.margin !== '' &&
        clip.margin !== '0px' &&
        /^0px /.test(clip.origin),
      label('lines: each line clips its rising text; tilt about the bottom-left corner'),
      JSON.stringify(clip)
    );
    v = await state(page, 'ln');
    check(
      v.copy && v.hidden,
      label('lines: the copy shows while the lines rise'),
      JSON.stringify({ copy: v.copy, hidden: v.hidden })
    );
    await page.waitForTimeout(1600);
    v = await state(page, 'ln');
    check(
      !v.copy && !v.hidden,
      label('lines: once risen, the original shows again'),
      JSON.stringify({ copy: v.copy, hidden: v.hidden })
    );
    let d = await drift(page, 'ln');
    check(d.worst <= 0.75, label('lines: the copy sits on the original glyphs'), JSON.stringify(d));

    // Words on view (lexicon #10).
    await at(page, 500);
    v = await state(page, 'wd');
    // Between two words both part lit, the earlier is one unit (a fifth of its window) ahead.
    const inside = (o) => o > 0 && o < 1;
    const steps = v.op
      .slice(1)
      .flatMap((o, k) => (inside(o) && inside(v.op[k]) ? [+(v.op[k] - o).toFixed(3)] : []));
    check(
      v.copy && v.hidden && monotone(v.op) && v.op[0] === 1 && v.op.at(-1) === 0,
      label('words on view: lit from the first word on'),
      v.op.join(' ')
    );
    check(
      steps.length >= 2 && steps.every((x) => Math.abs(x - 0.2) < 0.01),
      label('words on view: windows of five units, one apart'),
      steps.join(' ')
    );
    d = await drift(page, 'wd');
    check(d.worst <= 0.75, label('words: the copy sits on the original glyphs'), JSON.stringify(d));
    v = await state(page, 'zh');
    const closing = /^[\p{Pe}\p{Pf}\p{Po}]/u;
    const bad = v.texts.filter(
      (t) => closing.test(t) || /[\p{Ps}\p{Pi}]$/u.test(t) || /^[\p{P}]+$/u.test(t)
    );
    check(
      v.n > 8 && bad.length === 0 && v.texts[0] === '「你好」，',
      label('CJK: punctuation stays with its word'),
      v.texts.join('|')
    );
    d = await drift(page, 'zh');
    check(d.worst <= 0.75, label('CJK: the copy sits on the original glyphs'), JSON.stringify(d));
    const grad = await page.evaluate(() => {
      const leaf = document.getElementById('gr').split.pieces[1].querySelector('span');
      const cs = getComputedStyle(leaf);
      return {
        image: cs.backgroundImage.slice(0, 15),
        clip: cs.webkitBackgroundClip || cs.backgroundClip,
        size: cs.backgroundSize,
      };
    });
    check(
      grad.image.startsWith('linear-gradient') && grad.clip === 'text' && /px/.test(grad.size),
      label('gradient text: the copy paints the gradient over the element box'),
      JSON.stringify(grad)
    );
    const exits = await page.evaluate(() => {
      const a = document.getElementById('ex');
      return {
        host: a.layers.filter((l) => !l.piece && l.exitEffects.length).length,
        pieces: a.layers.filter((l) => l.piece && l.exitEffects.length).length,
        n: a.split?.pieces.length ?? 0,
      };
    });
    check(
      exits.host === 1 && exits.pieces === 0 && exits.n === 3,
      label('exits stay with the whole element'),
      JSON.stringify(exits)
    );
    await at(page, 2000);
    v = await state(page, 'wd');
    check(
      !v.copy && !v.hidden,
      label('words on view: complete, the original shows'),
      JSON.stringify({ copy: v.copy, op: v.op.join(' ') })
    );
    await at(page, 900);
    v = await state(page, 'wd');
    check(
      v.copy && v.hidden && v.op.at(-1) < 1,
      label('words on view: scrolled back, the copy again'),
      v.op.join(' ')
    );

    // Words on a zone's time: c spans 1600–3000 (600 of time); pieces are stagger items.
    await at(page, 1600 + 300);
    v = await state(page, 'zw');
    check(
      v.copy && monotone(v.op) && v.op[0] > 0 && v.op.at(-1) < 1,
      label('words on a zone: scrubbed word by word'),
      v.op.join(' ')
    );
    await at(page, 3000);
    v = await state(page, 'zw');
    check(
      !v.copy && !v.hidden && v.op.every((o) => o === 1),
      label('words on a zone: at the end, the original'),
      JSON.stringify({ copy: v.copy, op: v.op.join(' ') })
    );
    await at(page, 1600 + 300);
    v = await state(page, 'zw');
    check(
      v.copy && v.hidden,
      label('words on a zone: scrolled back, the copy'),
      JSON.stringify({ copy: v.copy })
    );

    // Refusals: whole, with a reason.
    const refused = await page.evaluate(() =>
      ['fimg', 'fdec', 'frot', 'frtl'].map((id) => {
        const a = document.getElementById(id);
        return {
          id,
          split: !!a.split,
          copy: !!a.shadowRoot.querySelector('[part=split]'),
          layers: a.layers.length,
        };
      })
    );
    check(
      refused.every((r) => !r.split && !r.copy && r.layers > 0),
      label('refused: no copy; the element animates whole'),
      JSON.stringify(refused)
    );
    const warnings = await page.evaluate(() => window.cvWarnings.join('\n'));
    const reasons = [
      ['fimg', /more than text/],
      ['fdec', /text decoration/],
      ['frot', /rotated or skewed/],
      ['frtl', /right-to-left/],
      ['fnone', /needs effects/],
    ];
    const missing = reasons
      .filter(([id, re]) => !warnings.split('\n').some((w) => w.endsWith(`#${id}`) && re.test(w)))
      .map(([id]) => id);
    check(
      missing.length === 0,
      label('refused: a dev warning names the reason'),
      missing.join() || 'all five'
    );
    const cvErrors = await page.evaluate(() => window.cvErrors);
    check(
      cvErrors.length === 1 && /split="letters"/.test(cvErrors[0]),
      label('split="letters" is reported; nothing else is'),
      JSON.stringify(cvErrors)
    );

    // Lines with stagger, entered on scroll.
    await at(page, 3000);
    await page.waitForTimeout(100);
    const t2 = await page.evaluate(() =>
      document.getElementById('ln2').split.pieces.map((p) => {
        const anim = p.getAnimations()[0];
        return anim ? anim.effect.getTiming().delay + (anim.startTime ?? 0) : null;
      })
    );
    check(
      t2.length === 2 && t2.every((x) => x !== null) && Math.round(t2[1] - t2[0]) === 200,
      label('lines: stagger sets the beat between lines'),
      JSON.stringify(t2)
    );

    // Page progress, written while its scene is near: lit part way near the end, all at the end.
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    await at(page, max - 250);
    v = await state(page, 'pg');
    check(
      v.copy && monotone(v.op) && v.op[0] > 0 && v.op.at(-1) < 1,
      label('words on page: near the end, lit part way'),
      v.op.join(' ')
    );
    await at(page, max);
    v = await state(page, 'pg');
    check(
      !v.copy && v.op.every((o) => o === 1),
      label('words on page: at the end, the original'),
      JSON.stringify({ copy: v.copy, op: v.op.join(' ') })
    );

    // Measured again: the same number of pieces moves them in place.
    await at(page, 900);
    const before = await page.evaluate(() => {
      const a = document.getElementById('wd');
      window.keep = a.split.pieces;
      return a.split.pieces.map((p) => p.style.left).join();
    });
    await page.evaluate(() => (document.getElementById('wd').style.width = '330px'));
    await frames(page, 4);
    const moved = await page.evaluate(() => {
      const a = document.getElementById('wd');
      return {
        same: a.split.pieces.every((p, i) => p === window.keep[i]),
        left: a.split.pieces.map((p) => p.style.left).join(),
      };
    });
    v = await state(page, 'wd');
    d = await drift(page, 'wd');
    check(
      moved.same && moved.left !== before && d.worst <= 0.75 && v.n === v.texts.length,
      label('resized: same words, moved in place, still on the glyphs'),
      JSON.stringify({ same: moved.same, d })
    );
    await page.evaluate(() => (document.querySelector('#wd em').textContent = 'leftward'));
    await frames(page, 4);
    v = await state(page, 'wd');
    check(v.texts.includes('leftward'), label('text changed: the copy follows'), v.texts.join('|'));
    // More lines on a time source: the entrance is not replayed; extra lines join the last piece.
    await at(page, 0);
    const n0 = (await state(page, 'ln')).n;
    await page.evaluate(() => {
      window.keepSplit = document.getElementById('ln').split;
      document.getElementById('ln').style.width = '170px';
    });
    await frames(page, 6);
    await page.waitForTimeout(100);
    v = await state(page, 'ln');
    d = await drift(page, 'ln');
    const kept = await page.evaluate(() => {
      const a = document.getElementById('ln');
      return {
        same: a.split === window.keepSplit,
        running: a.split.pieces.some((p) =>
          p.getAnimations().some((x) => x.playState === 'running')
        ),
      };
    });
    check(
      kept.same && !kept.running && v.n === n0 && v.lines > n0 && !v.copy && d.worst <= 0.75,
      label('narrower, on entrance: not replayed; extra lines join the last; on the glyphs'),
      JSON.stringify({ n0, n: v.n, lines: v.lines, kept, d })
    );
    // On a progress source another number of pieces rebuilds.
    await at(page, max);
    const p0 = (await state(page, 'pl')).n;
    await page.evaluate(() => (document.getElementById('pl').style.width = '150px'));
    await frames(page, 6);
    await page.waitForTimeout(100);
    v = await state(page, 'pl');
    d = await drift(page, 'pl');
    check(
      v.split && v.n === v.lines && v.n > p0 && !v.copy && d.worst <= 0.75,
      label('narrower, on page progress: rebuilt with one piece per line, on the glyphs'),
      JSON.stringify({ p0, n: v.n, lines: v.lines, d })
    );
    // Fonts and themes: nothing else announces these.
    const lefts = () =>
      page.evaluate(() => document.getElementById('ft').split.pieces[1].style.left);
    const l0 = await lefts();
    await page.evaluate(() => (document.querySelector('#ft p').style.letterSpacing = '4px'));
    await frames(page, 4);
    const l1 = await lefts();
    await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')));
    await frames(page, 4);
    const l2 = await lefts();
    await page.evaluate(() => (document.querySelector('#ft p').style.letterSpacing = '9px'));
    await page.evaluate(() => document.getElementById('s').setAttribute('data-cv-theme', 'other'));
    await frames(page, 4);
    const l3 = await lefts();
    check(
      l0 === l1 && l2 !== l1 && l3 !== l2,
      label('fonts loaded or theme changed: measured again'),
      JSON.stringify([l0, l1, l2, l3])
    );

    // Copy coordinates must include the host's padding, for both word and line pieces.
    for (const unit of ['words', 'lines']) {
      for (const padded of [false, true]) {
        await page.evaluate(
          async ({ unit, padded, fallback }) => {
            const stage = document.createElement('cv-stage');
            stage.setAttribute('design-width', '400');
            stage.toggleAttribute('fallback', fallback);
            stage.innerHTML = `<cv-scene style="padding:0">
            <cv-animate id="padding-case" split="${unit}" on="view(self)" fx="hue(270deg)"
              style="position:absolute;left:20px;top:40px;width:320px;height:200px;margin:0;border:0;box-sizing:border-box;padding:${padded ? '144px 0 0 24px' : '0'};font:32px/48px Arial,sans-serif">MMMM MMMM</cv-animate>
            </cv-scene>`;
            document.body.replaceChildren(stage);
            await stage.ready;
            await document.fonts.ready;
            scrollTo(0, 0);
          },
          { unit, padded, fallback: mode === 'fallback' }
        );
        await frames(page, 4);
        const material = await state(page, 'padding-case');
        const aligned = await drift(page, 'padding-case');
        check(
          material.copy &&
            material.hidden &&
            material.n === (unit === 'words' ? 2 : 1) &&
            aligned.worst <= 0.75,
          label(
            `${unit}: glyphs stay aligned with ${padded ? 'host padding on both axes' : 'zero host padding'}`
          ),
          JSON.stringify({ material, aligned })
        );
      }
    }

    check(errors.length === 0, label('no page errors'), errors.join(' | '));
    await page.close();
  }

  {
    const page = await open('x', { reducedMotion: 'reduce' });
    const all = await page.evaluate(() =>
      [...document.querySelectorAll('cv-animate')]
        .filter((a) => a.split || a.shadowRoot.querySelector('[part=split]'))
        .map((a) => a.id)
    );
    check(all.length === 0, 'reduced motion: no copies; the text shows at once', all.join());
    const op = await page.evaluate(() =>
      ['ln', 'wd', 'pg'].map((id) => {
        let el = document.getElementById(id).shadowRoot.querySelector('slot');
        let o = 1;
        for (el = el.parentElement; el; el = el.parentElement)
          o *= Number(getComputedStyle(el).opacity);
        return o * Number(getComputedStyle(document.getElementById(id)).opacity);
      })
    );
    check(
      op.every((o) => o === 1),
      'reduced motion: the text is fully visible',
      op.join()
    );
    const warned = await page.evaluate(() => window.cvWarnings.filter((w) => /split/.test(w)));
    check(warned.length === 0, 'reduced motion: no split warnings', warned.join(' | '));
    await page.close();
  }

  {
    const page = await open('drag');
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let v = await state(page, 'ln2');
    check(
      v.split && v.n === 2,
      'drag: a scene outside the window is measured too',
      JSON.stringify({ n: v.n })
    );
    await page.waitForTimeout(1600);
    v = await state(page, 'ln');
    check(
      !v.copy && !v.hidden,
      'drag: lines on the first page rise, then the original',
      JSON.stringify({ copy: v.copy })
    );
    await page.evaluate(() => document.getElementById('s').goTo(3));
    await page.waitForTimeout(400);
    v = await state(page, 'ln2');
    check(v.copy && v.hidden, 'drag: paged to d, its lines rise', JSON.stringify({ copy: v.copy }));
    await page.waitForTimeout(1600);
    v = await state(page, 'ln2');
    const dd = await drift(page, 'ln2');
    check(
      !v.copy && !v.hidden && dd.worst <= 0.75,
      'drag: risen, the original; the copy was on its glyphs',
      JSON.stringify({ copy: v.copy, dd })
    );
    const cvErrors = await page.evaluate(() => window.cvErrors);
    check(
      cvErrors.length === 1 && errors.length === 0,
      'drag: no page errors, only the split="letters" report',
      JSON.stringify([...cvErrors, ...errors])
    );
    await page.close();
  }
} catch (e) {
  failed++;
  console.log(`FAIL probe crashed: ${e.stack ?? e}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
