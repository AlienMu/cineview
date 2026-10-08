import { launch } from './browser.mjs';

/**
 * P1.11 motion checks (any engine, CV_ENGINE): scroll forward and back through a zone; large
 * jumps (into zones outside the activation window, over entrances, to both ends) on the native
 * path and under `fallback`, with the computed value right from the first frame after the jump;
 * drag keyboard paging, keys from a text field, repeated keys during a slide, and multi-scene
 * navigation (the viewport always covered by two adjacent scenes, one leave/enter pair).
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const H = 800;
const clamp = (v) => Math.min(Math.max(v, 0), 1);
const near = (v, want) => Math.abs(v.opacity - want.opacity) < 0.02 && Math.abs(v.y - want.y) < 1;
const fmt = (v) => `${v.opacity.toFixed(3)}/${v.y.toFixed(1)}`;

try {
  // Warm the dev server (a first visit can reload while it optimises dependencies).
  for (const f of ['motion.html', 'drag.html']) {
    const warm = await browser.newPage();
    await warm.goto(`${base}/${f}`);
    await warm.waitForTimeout(1200);
    await warm.close();
  }

  // ---- scroll -----------------------------------------------------------------------------------
  for (const mode of ['native', 'fallback']) {
    const page = await browser.newPage({ viewport: { width: 400, height: H } });
    await page.goto(`${base}/motion.html${mode === 'fallback' ? '?fallback' : ''}`);
    await page.evaluate(() => window.ready);
    await page.waitForTimeout(400);
    const g = await page.evaluate(() =>
      Object.fromEntries(['z1', 'z3', 'e2'].map((id) => [id, document.getElementById(id).getBoundingClientRect().top + scrollY]))
    );
    // rise, linear: zone time = scroll offset into the zone; z1a lasts 400, z3a 800.
    const want = (id, y) => {
      const p = id === 'z1a' ? clamp((y - g.z1) / 400) : clamp((y - g.z3) / 800);
      return { opacity: p, y: 40 * (1 - p) };
    };
    const settled = (y, id) =>
      page.evaluate(
        ([y, id]) =>
          new Promise((r) => {
            scrollTo(0, y);
            requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => r(window.shown(id)), 50)));
          }),
        [y, id]
      );

    const path = [-100, 0, 100, 200, 300, 400, 500].map((d) => g.z1 + d);
    const bad = [];
    for (const y of [...path, ...path.slice(0, -1).reverse()]) {
      const v = await settled(y, 'z1a');
      if (!near(v, want('z1a', y))) bad.push(`y=${y - g.z1}: ${fmt(v)} want ${fmt(want('z1a', y))}`);
    }
    check(bad.length === 0, `${mode}: zone forward then back, same value at the same offset`, bad.join('; '));

    // Jumps, each in one step; frame 0 is sampled before the jump is rendered.
    await settled(0, 'z1a');
    const jumps = [
      ['top → middle of the far zone', g.z3 + 400, 'z3a'],
      ['far zone → first zone', g.z1 + 200, 'z1a'],
      ['first zone → bottom', 1e6, null],
      ['bottom → first zone', g.z1 + 100, 'z1a'],
      ['first zone → top', 0, null],
      ['top → far zone end', g.z3 + 700, 'z3a'],
      ['far zone → first zone', g.z1 + 300, 'z1a'],
    ];
    for (const [label, y, id] of jumps) {
      const frames = await page.evaluate(([y, ids]) => window.jump(y, ids, 8), [y, ['z1a', 'z3a', 'e0', 'e2']]);
      await page.waitForTimeout(250);
      if (!id) continue;
      const target = want(id, Math.min(y, 1e6));
      const off = frames.slice(1).map((f, i) => (near(f[id], target) ? null : `frame ${i + 1}: ${fmt(f[id])}`)).filter(Boolean);
      check(off.length === 0, `${mode}: ${label}: ${id} at ${fmt(target)} from the first frame`, off.join(', '));
    }
    const e = await page.evaluate(() => ({ e0: window.shown('e0'), e2: window.shown('e2'), running: document.getElementById('e2').shadowRoot.querySelector('.l').getAnimations().filter((a) => a.playState === 'running').length }));
    check(e.e0.opacity === 1, `${mode}: first-screen entrance stays entered through the jumps`, fmt(e.e0));
    check((e.e2.opacity === 0 || e.e2.opacity === 1) && !e.running, `${mode}: entrance jumped over is not left mid-way`, JSON.stringify(e));
    await settled(g.e2 - 400, 'e2');
    await page.waitForTimeout(500);
    const e2 = await page.evaluate(() => window.shown('e2'));
    check(e2.opacity === 1, `${mode}: entrance shown once scrolled into view`, fmt(e2));
    const errors = await page.evaluate(() => window.cvErrors);
    check(errors.length === 0, `${mode}: no cv-error`, JSON.stringify(errors));
    await page.close();
  }

  // ---- drag -------------------------------------------------------------------------------------
  const page = await browser.newPage({ viewport: { width: 400, height: H } });
  await page.goto(`${base}/drag.html?x&td=200`);
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(200);
  const current = () => page.evaluate(() => document.querySelector('cv-scene[data-cv-current]')?.id);
  const take = () => page.evaluate(() => window.events.splice(0).filter((e) => /^cv-(enter|leave)/.test(e)));
  await take();
  await page.focus('#s');
  const keys = [];
  for (const [key, want] of [['ArrowDown', 's1'], ['PageDown', 's2'], ['ArrowUp', 's1'], ['PageUp', 's0'], ['End', 's3'], ['Home', 's0']]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(450);
    const at = await current();
    if (at !== want) keys.push(`${key} → ${at}, want ${want}`);
  }
  check(keys.length === 0, 'keyboard: arrows, Page Up/Down, Home and End page the stage', keys.join('; '));
  await take();

  await page.evaluate(() => {
    const s = document.getElementById('s');
    for (let i = 0; i < 3; i++) s.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(450);
  let ev = await take();
  check((await current()) === 's1' && ev.join() === 'cv-leave:s0,cv-enter:s1', 'keys repeated during a slide page from the current scene (1.x)', JSON.stringify({ at: await current(), ev }));
  await page.evaluate(() => document.getElementById('s').goTo(0, { animated: false }));
  await take();

  await page.evaluate(() => {
    const field = document.createElement('input');
    field.id = 'field';
    document.getElementById('s0').append(field);
  });
  await page.focus('#field');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  await page.waitForTimeout(450);
  check((await current()) === 's0' && (await take()).length === 0, 'keys typed in a text field do not page');

  const slide = (target) =>
    page.evaluate(
      ([target, H]) =>
        new Promise((resolve) => {
          const scenes = [...document.querySelectorAll('cv-scene')];
          const rows = [];
          const tick = () => {
            const shown = scenes
              .map((s) => ({ id: s.id, r: s.getBoundingClientRect(), hidden: getComputedStyle(s).contentVisibility === 'hidden' }))
              .filter((s) => !s.hidden && s.r.bottom > 0.5 && s.r.top < H - 0.5)
              .sort((a, b) => a.r.top - b.r.top);
            // Covered: first visible scene reaches the top, each next one starts where the last ends.
            let gap = shown.length === 0 || shown[0].r.top > 0.5 || shown.at(-1).r.bottom < H - 0.5;
            for (let i = 1; i < shown.length; i++) if (Math.abs(shown[i].r.top - shown[i - 1].r.bottom) > 1) gap = true;
            rows.push({ ids: shown.map((s) => s.id).join('+'), gap });
            if (rows.length < 40) requestAnimationFrame(tick);
            else resolve(rows);
          };
          document.getElementById('s').goTo(target);
          requestAnimationFrame(tick);
        }),
      [target, H]
    );
  for (const [target, from] of [[3, 's0'], [0, 's3']]) {
    const rows = await slide(target);
    ev = await take();
    const gaps = rows.filter((r) => r.gap || r.ids.split('+').length > 2);
    const want = `s${target}`;
    check(gaps.length === 0, `goTo ${from} → ${want}: viewport covered by at most two adjacent scenes every frame`, JSON.stringify(gaps.slice(0, 3)));
    const state = await page.evaluate(() => ({
      inert: [...document.querySelectorAll('cv-scene')].filter((s) => s.inert).map((s) => s.id),
      top: Math.round(document.querySelector('cv-scene[data-cv-current]').getBoundingClientRect().top),
    }));
    check(
      (await current()) === want && ev.join() === `cv-leave:${from},cv-enter:${want}` && state.top === 0 && state.inert.length === 3 && !state.inert.includes(want),
      `goTo ${from} → ${want}: one leave/enter pair, lands in place, others inert`,
      JSON.stringify({ ev, state })
    );
  }
  const errors = await page.evaluate(() => window.cvErrors);
  check(errors.length === 0, 'drag: no cv-error', JSON.stringify(errors));
  await page.close();
} catch (e) {
  failed++;
  console.log(`FAIL ${e.stack}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : `PASS`);
process.exit(failed ? 1 : 0);
