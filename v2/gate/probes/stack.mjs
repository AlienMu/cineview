import { launch } from './browser.mjs';

/**
 * P2.2 scene `stack` (plan v3 §8, §9.3): scroll holds a stacked scene (sticky; a zone once its time
 * has run, a tall scene once its bottom arrives) until the next scene covers it; drag keeps it
 * still while the next one slides over. Covered scenes are not painted and deactivate. View
 * progress in a held scene and in a zone's shell is where the subject is on screen, on both paths.
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const H = 800;
const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;
const open = async (query) => {
  const warm = await browser.newPage();
  await warm.goto(`${base}/stack.html?${query}`);
  await warm.waitForTimeout(800);
  await warm.close();
  const page = await browser.newPage({ viewport: { width: 400, height: H } });
  await page.goto(`${base}/stack.html?${query}`);
  await page.evaluate(() => window.ready);
  return page;
};
const frames = (page, n = 3) =>
  page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);

/** Scene rects and states, view layers against the formula on their subject's live rect. */
const read = (page) =>
  page.evaluate(() => {
    const vh = innerHeight;
    const scenes = {};
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      const s = document.getElementById(id);
      scenes[id] = {
        top: Math.round(s.getBoundingClientRect().top),
        covered: s.hasAttribute('data-cv-covered'),
        hidden: getComputedStyle(s).visibility === 'hidden',
        active: s.hasAttribute('data-cv-active'),
      };
    }
    const view = {};
    for (const id of ['ap', 'bself']) {
      const a = document.getElementById(id);
      const layer = a.layers.find((l) => l.source === 'view');
      const r = a.viewSubject(layer).getBoundingClientRect();
      const expected = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      view[id] = { opacity: +Number(getComputedStyle(layer.el).opacity).toFixed(3), expected: +expected.toFixed(3), native: !!layer.native };
    }
    const shell = Math.round(document.getElementById('b').shell.getBoundingClientRect().top);
    const hit = (y) => document.elementFromPoint(200, y)?.closest('cv-scene')?.id ?? null;
    return { scenes, view, shell, br: +document.getElementById('br').timeline.progress.toFixed(3), hits: [hit(200), hit(600)], events: window.events.splice(0) };
  });
const agree = (v) => Object.values(v.view).every((x) => Math.abs(x.opacity - x.expected) < 0.03);

try {
  for (const mode of ['native', 'fallback']) {
    const page = await open(mode === 'fallback' ? 'fallback' : 'x');
    const errors = await page.evaluate(() => window.cvErrors);
    check(errors.length === 0, `${mode}: no cv-error`, JSON.stringify(errors));
    const at = async (y) => {
      await page.evaluate((y) => scrollTo(0, y), y);
      await frames(page, 4);
      await page.waitForTimeout(60);
      return read(page);
    };
    // Layout: a 0–800, b 800–2200 (zone, 600 of time), c 2200–3400 (150vh), d 3400, e 4200.
    let v = await at(0);
    const ap0 = v.view.ap.opacity;
    v = await at(400);
    check(v.scenes.a.top === 0 && v.scenes.b.top === 400 && !v.scenes.a.covered && !v.scenes.a.hidden, `${mode}: a holds while b scrolls over it`, JSON.stringify(v.scenes));
    check(v.hits.join() === 'a,b', `${mode}: the held part is hit-tested in a, the covering part in b`, JSON.stringify(v.hits));
    check(agree(v) && near(v.view.ap.opacity, ap0, 0.02), `${mode}: view progress of the held scene stays where it stopped`, JSON.stringify({ ap0, view: v.view }));
    v = await at(800);
    check(v.scenes.a.covered && v.scenes.a.hidden && !v.scenes.a.active, `${mode}: a covered once b's top reaches the top: not painted, deactivated`, JSON.stringify(v.scenes.a));
    check(v.events.includes('cv-deactivate:a'), `${mode}: cv-deactivate on the covered scene`, JSON.stringify(v.events));
    v = await at(1100);
    check(v.scenes.b.top === -300 && v.shell === 0 && near(v.br, 0.5, 0.01), `${mode}: zone b runs its time with the shell pinned`, JSON.stringify({ b: v.scenes.b, shell: v.shell, br: v.br }));
    const bself = v.view.bself.opacity;
    check(agree(v) && !v.view.bself.native, `${mode}: view(self) in a zone's shell follows the screen position (written directly)`, JSON.stringify(v.view));
    v = await at(1300);
    check(agree(v) && near(v.view.bself.opacity, bself, 0.02), `${mode}: view(self) in the pinned shell stands still`, JSON.stringify(v.view));
    v = await at(1600);
    check(v.scenes.b.top === -600 && v.shell === 0 && v.scenes.c.top === 600 && near(v.br, 1, 0.01), `${mode}: b holds after its time with its bottom at the screen's bottom, c covers it`, JSON.stringify({ scenes: v.scenes, shell: v.shell, br: v.br }));
    v = await at(2200);
    check(v.scenes.b.covered && v.scenes.b.hidden, `${mode}: b covered when c reaches the top`, JSON.stringify(v.scenes.b));
    v = await at(2400);
    check(v.scenes.c.top === -200 && !v.scenes.c.covered, `${mode}: a tall stacked scene scrolls until its bottom arrives`, JSON.stringify(v.scenes.c));
    v = await at(2800);
    check(v.scenes.c.top === -400 && v.scenes.d.top === 600, `${mode}: then holds with its bottom at the screen's bottom while d covers it`, JSON.stringify(v.scenes));
    v = await at(3400);
    check(v.scenes.c.covered, `${mode}: c covered when d reaches the top`, JSON.stringify(v.scenes.c));
    v = await at(4000);
    check(v.scenes.d.top === -600 && v.scenes.e.top === 200 && !v.scenes.d.covered, `${mode}: d does not stack: it scrolls away`, JSON.stringify(v.scenes));
    v = await at(400);
    check(!v.scenes.a.covered && !v.scenes.a.hidden && v.scenes.a.active && v.scenes.a.top === 0 && !v.scenes.b.covered, `${mode}: back up, a shows and holds again`, JSON.stringify(v.scenes));
    check(v.events.includes('cv-activate:a'), `${mode}: cv-activate when it shows again`, JSON.stringify(v.events));
    await page.close();
  }

  // Drag: the stacked scene stays still while the next one slides over it.
  const page = await open('drag');
  const errors = await page.evaluate(() => window.cvErrors);
  check(errors.length === 0, 'drag: no cv-error', JSON.stringify(errors));
  const hold = async (dy) => {
    await page.mouse.move(200, 400);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(200, 400 + (dy * i) / 8);
      await page.waitForTimeout(16);
    }
    await frames(page, 3);
    return read(page);
  };
  const reset = async (index) => {
    await page.mouse.up();
    await page.waitForTimeout(900);
    await page.evaluate((i) => document.getElementById('s').goTo(i, { animated: false }), index);
    await frames(page, 3);
  };
  await frames(page, 3);
  let v = await read(page);
  const ap0 = v.view.ap.opacity;
  v = await hold(-0.4 * H);
  check(v.scenes.a.top === 0 && v.scenes.b.top > 0.5 * H && v.scenes.b.top < 0.8 * H && !v.scenes.a.covered, 'drag: forward from a, a stays put and b slides over it', JSON.stringify(v.scenes));
  check(near(v.view.ap.opacity, ap0, 0.02), 'drag: view progress of the held scene is its value at rest', JSON.stringify({ ap0, ap: v.view.ap }));
  await reset(1);
  v = await read(page);
  check(v.scenes.a.top === 0 && v.scenes.a.covered && v.scenes.a.hidden && v.scenes.b.top === 0, 'drag: on b, a is covered', JSON.stringify(v.scenes));
  v = await hold(0.3 * H);
  check(v.scenes.a.top === 0 && !v.scenes.a.covered && !v.scenes.a.hidden && v.scenes.b.top > 0.2 * H, 'drag: back from b, a shows in place and b slides off it', JSON.stringify(v.scenes));
  await reset(3);
  v = await read(page);
  check(v.scenes.c.covered && v.scenes.a.covered && v.scenes.b.covered && v.scenes.d.top === 0, 'drag: on d, the stacked scenes before it are covered', JSON.stringify(v.scenes));
  v = await hold(-0.4 * H);
  check(v.scenes.d.top < -0.2 * H && v.scenes.e.top > 0.5 * H && !v.scenes.d.covered, 'drag: d does not stack: it moves away', JSON.stringify(v.scenes));
  await reset(0);
  v = await read(page);
  check(!v.scenes.a.covered && !v.scenes.b.covered && !v.scenes.c.covered && v.scenes.a.top === 0, 'drag: back on a, nothing covered', JSON.stringify(v.scenes));
  await page.close();
} catch (e) {
  failed++;
  console.log(`FAIL probe crashed: ${e.stack ?? e}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
