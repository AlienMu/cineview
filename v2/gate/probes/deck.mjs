import { launch } from './browser.mjs';

/**
 * P2.4 <cv-stack> (plan v3 §9.3, lexicon #6). Scroll outside zones: cards stick `step` apart and
 * later ones scroll over earlier ones; a card the next one hides is not painted; `covered` looks
 * follow the next card's approach. Zones and drag: cards after the first come up from the screen's
 * bottom edge along the scene timeline, `duration` each, and settle on the deck.
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
  await warm.goto(`${base}/deck.html?${query}`);
  await warm.waitForTimeout(800);
  await warm.close();
  const page = await browser.newPage({ viewport: { width: 400, height: H } });
  await page.goto(`${base}/deck.html?${query}`);
  await page.evaluate(() => window.ready);
  return page;
};
const frames = (page, n = 3) =>
  page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);

/** Each card: top on screen, top relative to its scene, brightness, scale, hidden. */
const read = (page) =>
  page.evaluate(() => {
    const out = {};
    for (const id of ['a0', 'a1', 'a2', 'b0', 'b1', 'b2', 'z0', 'z1', 'z2']) {
      const el = document.getElementById(id);
      const cs = getComputedStyle(el);
      const scene = el.closest('cv-scene');
      const top = el.getBoundingClientRect().top;
      const bright = /brightness\(([\d.]+)\)/.exec(cs.filter);
      out[id] = {
        top: Math.round(top),
        inScene: Math.round(top - (scene.shell ?? scene).getBoundingClientRect().top),
        bright: bright ? +Number(bright[1]).toFixed(3) : 1,
        scale: cs.scale === 'none' ? 1 : +Number(cs.scale.split(' ')[0]).toFixed(4),
        hidden: cs.visibility === 'hidden',
      };
    }
    out.dealt = ['ka', 'kb', 'kz'].map((id) => document.getElementById(id).hasAttribute('data-cv-dealt'));
    out.kz = +document.getElementById('kz').timeline.progress.toFixed(4);
    return out;
  });

try {
  for (const mode of ['native', 'fallback']) {
    const page = await open(mode === 'fallback' ? 'fallback' : 'x');
    const errors = await page.evaluate(() => window.cvErrors);
    check(errors.join() === 'invalid-attribute: step="x": expected a distance in px such as 8', `${mode}: an unreadable step is a cv-error`, JSON.stringify(errors));
    const warnings = await page.evaluate(() => window.warnings);
    check(warnings.some((w) => w.includes('<cv-stack> inside <cv-animate>')), `${mode}: dev warning for a stack inside <cv-animate>`, JSON.stringify(warnings));
    const at = async (y) => {
      await page.evaluate((y) => scrollTo(0, y), y);
      await frames(page, 4);
      await page.waitForTimeout(60);
      return read(page);
    };
    // Layout: a 0–1600 (deck 200–1400, cards 400), b 1600–3000 (deck 1600–2800), z 3000–4600 (zone, 800).
    let v = await at(0);
    check(v.dealt.join() === 'false,false,true', `${mode}: a and b stick, the zone deck is dealt`, JSON.stringify(v.dealt));
    check(v.a0.top === 200 && v.a1.top === 600 && v.a0.bright === 1, `${mode}: cards in the flow before the deck sticks`, JSON.stringify({ a0: v.a0, a1: v.a1 }));
    v = await at(400);
    check(v.a0.top === 0 && v.a1.top === 200 && near(v.a0.bright, 0.75, 0.01), `${mode}: a0 sticks, a1 scrolls over it, a0 dims half way`, JSON.stringify({ a0: v.a0, a1: v.a1 }));
    v = await at(600);
    check(v.a1.top === 0 && v.a0.hidden && !v.a1.hidden, `${mode}: a1 rests on a0: a0 hidden (step 0)`, JSON.stringify({ a0: v.a0, a1: v.a1 }));
    v = await at(800);
    check(v.a2.top === 200 && near(v.a1.bright, 0.75, 0.01) && v.a0.hidden, `${mode}: a2 comes over a1`, JSON.stringify({ a1: v.a1, a2: v.a2 }));
    v = await at(1000);
    check(v.a2.top === 0 && v.a1.hidden && !v.a2.hidden, `${mode}: a2 rests, a1 hidden`, JSON.stringify({ a1: v.a1, a2: v.a2 }));
    v = await at(1200);
    check(v.a2.top === -200 && v.a1.hidden && v.a0.hidden, `${mode}: the deck leaves together at its end`, JSON.stringify({ a0: v.a0, a1: v.a1, a2: v.a2 }));
    v = await at(1755);
    check(v.b0.top === 40 && v.b1.top === 245 && near(v.b0.scale, 0.96, 0.003) && near(v.b0.bright, 0.85, 0.01), `${mode}: b0 sticks at --cv-stack-top, recedes toward its top edge as b1 comes`, JSON.stringify({ b0: v.b0, b1: v.b1 }));
    v = await at(1950);
    check(v.b0.top === 40 && v.b1.top === 50 && !v.b0.hidden && near(v.b0.scale, 0.92, 0.003) && near(v.b0.bright, 0.7, 0.01), `${mode}: b1 rests 10px lower; b0 stays painted, its edge shows above b1`, JSON.stringify({ b0: v.b0, b1: v.b1 }));
    // Zone z: t = y - 3000; card 1 over 0–400, card 2 over 400–800, linear; slots 0, 8, 16.
    for (const t of [0, 200, 300, 400, 600, 800]) {
      v = await at(3000 + t);
      const e1 = Math.min(1, t / 400);
      const e2 = Math.min(1, Math.max(0, (t - 400) / 400));
      const z1 = 8 + (1 - e1) * 792;
      const z2 = 16 + (1 - e2) * 784;
      const p0 = Math.min(1, Math.max(0, (300 - z1) / 292));
      const p1 = Math.min(1, Math.max(0, (308 - z2) / 292));
      check(
        v.z0.inScene === 0 && near(v.z1.inScene, z1) && near(v.z2.inScene, z2) && near(v.z0.bright, 1 - 0.5 * p0, 0.01) && near(v.z1.bright, 1 - 0.5 * p1, 0.01) && !v.z0.hidden,
        `${mode}: zone t ${t}: cards come up along zone time, dimming the one below`,
        JSON.stringify({ z0: v.z0, z1: v.z1, z2: v.z2, want: { z1, z2, p0, p1 } })
      );
    }
    v = await at(400);
    check(v.a0.top === 0 && !v.a0.hidden && near(v.a0.bright, 0.75, 0.01), `${mode}: back up, a0 shows again`, JSON.stringify(v.a0));
    await page.close();
  }

  // Drag: every deck is dealt along scene time.
  const page = await open('drag');
  await page.waitForTimeout(1600);
  await frames(page, 3);
  let v = await read(page);
  check(v.dealt.join() === 'true,true,true', 'drag: every deck is dealt', JSON.stringify(v.dealt));
  check(v.a0.inScene === 200 && v.a1.inScene === 200 && v.a2.inScene === 200 && v.a0.hidden && v.a1.hidden && !v.a2.hidden, 'drag: the first scene played its deck: all cards rest, those under the top one hidden', JSON.stringify({ a0: v.a0, a1: v.a1, a2: v.a2 }));
  await page.evaluate(() => document.getElementById('s').goTo(1, { animated: false }));
  await frames(page, 3);
  // Toward z: its time follows the finger; cards follow its timeline.
  await page.mouse.move(200, 400);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(200, 400 - (0.45 * H * i) / 8);
    await page.waitForTimeout(16);
  }
  await frames(page, 3);
  v = await read(page);
  const P = v.kz;
  const e1 = Math.min(1, Math.max(0, P * 2));
  const e2 = Math.min(1, Math.max(0, P * 2 - 1));
  check(P > 0 && P < 1, 'drag: the incoming scene is part way through its deck', String(P));
  check(near(v.z1.inScene, 8 + (1 - e1) * 792) && near(v.z2.inScene, 16 + (1 - e2) * 784), 'drag: cards follow the scene timeline', JSON.stringify({ P, z1: v.z1, z2: v.z2 }));
  await page.mouse.up();
  await page.waitForTimeout(900);
  await page.evaluate(() => document.getElementById('s').goTo(2, { animated: false }));
  await frames(page, 3);
  v = await read(page);
  check(v.z0.inScene === 0 && v.z1.inScene === 8 && v.z2.inScene === 16 && near(v.z0.bright, 0.5, 0.01) && near(v.z1.bright, 0.5, 0.01) && !v.z0.hidden, 'drag: on z, the deck rests 8px apart, lower cards dimmed', JSON.stringify({ z0: v.z0, z1: v.z1, z2: v.z2 }));
  await page.close();
} catch (e) {
  failed++;
  console.log(`FAIL probe crashed: ${e.stack ?? e}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
