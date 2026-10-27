import { launch } from './browser.mjs';

/**
 * P3.8 `fx="keyframes(name)"` (plan v3 §3.3): the page's @keyframes rule, read into keyframe data
 * and played on a shadow layer of its own, outside the element's other layers; the element's own
 * box is left alone, so a rule that flies in from below still enters. On entrance it is a clock
 * animation of the rule (the element's duration); on view and zone time a native scroll-driven
 * animation where there is one, else a paused animation seeked to the progress (the fallback path
 * and drag). The rule a media query picks; a keyframe's own timing function; a missing name and a
 * rule only in a stylesheet from another origin report `unknown-keyframes`; keyframes() in exit is
 * refused. Under reduced motion an entrance rule is left out, a view rule stays. Scroll (native
 * and fallback), reduced motion, drag.
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
const FAR = '@keyframes far { to { opacity: .5 } }';

const open = async (query, options = {}) => {
  const warm = await browser.newPage();
  await warm.route('**/far.css', (route) => route.fulfill({ contentType: 'text/css', body: FAR }));
  await warm.goto(`${base}/keyframes.html?${query}`);
  await warm.waitForTimeout(800);
  await warm.close();
  const page = await browser.newPage({ viewport: { width: W, height: H }, ...options });
  await page.route('**/far.css', (route) => route.fulfill({ contentType: 'text/css', body: FAR }));
  await page.goto(`${base}/keyframes.html?${query}`);
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.ready);
  return page;
};
const frames = (page, n = 3) =>
  page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const at = async (page, y) => {
  await page.evaluate((y) => scrollTo(0, y), y);
  await frames(page, 4);
  await sleep(80);
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
/** Scroll to p of zone z's time (1000 px of scroll). */
const atZone = async (page, p) => {
  const y = await page.evaluate((p) => Math.round(document.getElementById('z').getBoundingClientRect().top + scrollY + p * 1000), p);
  await at(page, y);
};
const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
const near = (a, b, d = 4) => a.every((v, i) => Math.abs(v - b[i]) <= d);

/** The rule's layer, its animations and the styles they write; animations on the element itself. */
const host = (page, id) =>
  page.evaluate((id) => {
    const a = document.getElementById(id);
    const layer = a.layers.find((l) => l.rule);
    const s = getComputedStyle(layer?.el ?? a);
    return {
      own: a.getAnimations().length,
      phase: a.getAttribute('data-cv-phase'),
      anims: (layer?.el.getAnimations() ?? []).map((x) => ({
        duration: x.effect.getTiming().duration,
        state: x.playState,
        timeline: x.timeline?.constructor.name ?? null,
        props: [...new Set(x.effect.getKeyframes().flatMap((k) => Object.keys(k)))].filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)).sort(),
        easing: x.effect.getKeyframes()[0]?.easing ?? null,
      })),
      host: layer ? { first: a.layers[0] === layer, el: layer.el.parentNode === a.shadowRoot && layer.el.getAttribute('part') === 'layer keyframes', native: !!layer.native, seek: layer.seek ? { state: layer.seek.playState, time: Number(layer.seek.currentTime) } : null } : null,
      inner: a.layers.filter((l) => !l.rule).map((l) => !!layer && layer.el.contains(l.el) && l.el !== layer.el),
      opacity: +s.opacity,
      transform: s.transform,
      translate: s.translate,
      color: s.color,
      background: s.backgroundColor,
    };
  }, id);

/** Translate of k7 with its rule's animation at `t` ms of 1000 (the clock animation, else the seeked one). */
const jumpAt = (page, t) =>
  page.evaluate((t) => {
    const el = document.getElementById('k7').layers[0].el;
    const anim = el.getAnimations()[0];
    const was = anim.currentTime;
    anim.currentTime = t;
    const v = parseFloat(getComputedStyle(el).translate) || 0;
    anim.currentTime = was;
    return v;
  }, t);

try {
  for (const mode of ['native', 'fallback', 'reduced', 'drag']) {
    const query = { native: 'x', fallback: 'fallback', reduced: 'x', drag: 'drag' }[mode];
    const page = await open(query, mode === 'reduced' ? { reducedMotion: 'reduce' } : {});
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const label = (s) => `${mode}: ${s}`;
    const clock = mode === 'native' || mode === 'fallback';

    // ---- on entrance (scene a) ------------------------------------------------------------------
    const ops = [];
    for (let i = 0; i < 8; i++) {
      ops.push((await host(page, 'k1')).opacity);
      await sleep(60);
    }
    const k1 = await host(page, 'k1');
    if (mode !== 'reduced') {
      check(k1.host?.first && k1.host.el && k1.own === 0, label('keyframes: a layer of its own, outermost; nothing on the element itself'), JSON.stringify({ host: k1.host, own: k1.own }));
      check(ops[0] < 1 && ops.every((o, i) => i === 0 || o >= ops[i - 1] - 1e-4), label('keyframes: the rule plays on entrance, forward only'), JSON.stringify(ops));
    }
    if (clock) {
      check(k1.anims.length === 1 && k1.anims[0].duration === 800 && k1.anims[0].props.join() === 'opacity,transform' && !k1.host.native, label('keyframes: on entrance a clock animation of the rule, the element\'s 800 ms'), JSON.stringify(k1.anims));
    }
    await sleep(1000);
    const end1 = await host(page, 'k1');
    const identity = (m) => m === 'none' || m === 'matrix(1, 0, 0, 1, 0, 0)';
    if (mode === 'reduced') {
      check(!end1.host && !end1.anims.length && !end1.own && end1.opacity === 1 && end1.transform === 'none', label('keyframes: under reduced motion an entrance rule is left out; the element shows as it is'), JSON.stringify(end1));
    } else {
      check(end1.opacity === 1 && identity(end1.transform), label('keyframes: it ends on the rule\'s last frame'), JSON.stringify({ opacity: end1.opacity, transform: end1.transform }));
      const k8 = await host(page, 'k8');
      check(k8.phase === 'entered' && identity(k8.transform), label('keyframes: a rule that flies in from below the viewport still enters'), JSON.stringify({ phase: k8.phase, transform: k8.transform, host: k8.host }));
    }
    if (mode === 'drag') {
      check(end1.host?.seek?.state === 'paused' && end1.host.seek.time === 1000 && !end1.host.native, label('keyframes: under drag a paused animation of the rule, seeked to the end'), JSON.stringify(end1.host));
    }
    const k2 = await host(page, 'k2');
    if (mode !== 'reduced') {
      check(k2.host?.first && k2.host.el && k2.inner.length > 0 && k2.inner.every(Boolean) && identity(k2.transform), label('keyframes: outside the element\'s other layers (rise inside it)'), JSON.stringify({ host: k2.host, inner: k2.inner, transform: k2.transform }));
    } else {
      check(!k2.host && k2.inner.length > 0, label('keyframes: under reduced motion only the other layers are left'), JSON.stringify(k2));
    }
    const k3 = await host(page, 'k3');
    const k3text = await page.evaluate(() => getComputedStyle(document.querySelector('#k3 span')).color);
    check(mode === 'reduced' ? k3text === 'rgb(34, 34, 34)' : k3.color === 'rgb(0, 128, 0)' && k3text === k3.color, label('keyframes: the rule its media query picks, inherited by the content'), JSON.stringify({ layer: k3.color, text: k3text }));
    const k5 = await host(page, 'k5');
    check(!k5.host && !k5.anims.length && !k5.own, label('keyframes: a rule it cannot read plays nothing'), JSON.stringify(k5));
    if (mode !== 'reduced') {
      const k7 = await host(page, 'k7');
      const steps = [await jumpAt(page, 300), await jumpAt(page, 600), await jumpAt(page, 1000)];
      check(k7.anims.length === 1 && /^steps\(2/.test(k7.anims[0].easing) && steps.join() === '0,50,100', label('keyframes: a keyframe\'s own timing function times its segment (steps)'), JSON.stringify({ anims: k7.anims, steps }));
    }

    // ---- on view (scene b) and zone time (scene z) -----------------------------------------------
    if (mode !== 'drag') {
      const kv = [];
      for (const p of [0.1, 0.4, 0.7]) {
        await atProgress(page, 'kv', p);
        kv.push(await host(page, 'kv'));
      }
      const colours = kv.map((k) => rgb(k.background));
      check(near(colours[0], [255, 0, 0]) && near(colours[1], [128, 0, 128]) && near(colours[2], [0, 0, 255]), label('keyframes: on view it follows the scroll (cover 20% to 60%)'), JSON.stringify(colours));
      if (mode === 'fallback') {
        check(!kv[1].host.native && kv[1].host.seek?.state === 'paused' && kv[1].anims.length === 1, label('keyframes: without native output a paused animation, seeked each frame'), JSON.stringify(kv[1]));
      } else {
        check(kv[1].host.native && kv[1].anims.length === 1 && kv[1].anims[0].timeline === 'ViewTimeline' && !kv[1].host.seek, label('keyframes: on view a native scroll-driven animation of the rule'), JSON.stringify(kv[1]));
      }
      const kz = [];
      for (const p of [0, 0.5, 1]) {
        await atZone(page, p);
        await sleep(200);
        kz.push(await host(page, 'kz'));
      }
      const zc = kz.map((k) => rgb(k.background));
      check(near(zc[0], [255, 0, 0]) && near(zc[1], [128, 0, 128], 8) && near(zc[2], [0, 0, 255]), label('keyframes: on zone time it follows the scroll'), JSON.stringify(zc));
      check(mode === 'fallback' ? !kz[1].host.native && !!kz[1].host.seek : kz[1].host.native, label(`keyframes: zone time ${mode === 'fallback' ? 'seeked' : 'native'}`), JSON.stringify(kz[1].host));
    } else {
      await page.evaluate(() => document.getElementById('s').goTo(2));
      await sleep(1600);
      const kz = await host(page, 'kz');
      check(near(rgb(kz.background), [0, 0, 255]) && kz.host?.seek?.state === 'paused', label('keyframes: under drag a scene\'s rule plays to its end, seeked'), JSON.stringify(kz));
    }

    // ---- the preset goes ------------------------------------------------------------------------
    await page.evaluate(() => document.getElementById('k1').setAttribute('fx', 'fade'));
    await frames(page, 6);
    await sleep(100);
    const gone = await host(page, 'k1');
    const parts = await page.evaluate(() => [...document.getElementById('k1').shadowRoot.querySelectorAll('[part]')].map((e) => e.getAttribute('part')));
    check(!gone.host && !gone.own && !parts.includes('layer keyframes'), label('keyframes: the rule goes with the preset'), JSON.stringify({ gone, parts }));

    const cvErrors = await page.evaluate(() => window.cvErrors);
    // The page has one stylesheet it cannot read, so a missing name says so too.
    const unread = '; 1 stylesheet from another origin could not be read: load it with crossorigin (and CORS), or move the rule';
    const expected = [
      `unknown-keyframes: keyframes(nope): no @keyframes nope in the page's stylesheets${unread}`,
      `unknown-keyframes: keyframes(far): no @keyframes far in the page's stylesheets${unread}`,
      'invalid-attribute: keyframes(pop) plays in fx, not exit',
    ];
    check(cvErrors.length === 3 && expected.every((e) => cvErrors.includes(e)), label('keyframes: a missing rule, an unreadable one and keyframes() in exit report cv-error'), JSON.stringify(cvErrors));
    check(!errors.length, label('no page errors'), JSON.stringify(errors));
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failed ? `\nkeyframes: ${failed} failed` : '\nkeyframes: ok');
process.exit(failed ? 1 : 0);
