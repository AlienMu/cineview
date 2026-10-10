import { launch } from './browser.mjs';

/**
 * P3.3 states and containment (lexicon #18, #19, #23, #24, #41): a scene's `theme` becomes the
 * stage's `data-cv-theme` when the scene reaches eye level (scroll: the middle of the screen; drag:
 * past the middle of the page, before the slide lands), at once and without a rebuild when it
 * changes; `data-cv-stuck` on stacked scenes while held and on zones while their shell is pinned;
 * `data-cv-current` and link states; hash links outside the stage page under drag; the drag stage
 * contains overscroll. Scroll (native and fallback), drag.
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const H = 800;
const open = async (query) => {
  const warm = await browser.newPage();
  await warm.goto(`${base}/states.html?${query}`);
  await warm.waitForTimeout(800);
  await warm.close();
  const page = await browser.newPage({ viewport: { width: 400, height: H } });
  await page.goto(`${base}/states.html?${query}`);
  await page.evaluate(() => window.ready);
  return page;
};
const frames = (page, n = 3) =>
  page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);

const read = (page) =>
  page.evaluate(() => {
    const s = document.getElementById('s');
    const scenes = [...s.querySelectorAll('cv-scene')];
    const link = (a) => (a.getAttribute('aria-current') === 'true' ? 'now' : a.hasAttribute('data-cv-before') ? 'before' : a.hasAttribute('data-cv-after') ? 'after' : '-');
    return {
      theme: s.getAttribute('data-cv-theme'),
      current: scenes.filter((x) => x.hasAttribute('data-cv-current')).map((x) => x.id).join(),
      stuck: scenes.filter((x) => x.hasAttribute('data-cv-stuck')).map((x) => x.id).join(),
      covered: scenes.filter((x) => x.hasAttribute('data-cv-covered')).map((x) => x.id).join(),
      links: [...document.querySelectorAll('nav a')].map(link).join(' '),
    };
  });

try {
  for (const mode of ['native', 'fallback']) {
    const page = await open(mode === 'fallback' ? 'fallback' : 'x');
    const at = async (y) => {
      await page.evaluate((y) => scrollTo(0, y), y);
      await frames(page, 4);
      await page.waitForTimeout(60);
      return read(page);
    };
    // Layout: a 0–800 (stack), b 800–2200 (zone, 600 of time), c 2200–3400 (150vh, stack),
    // d 3400–4200, e 4200–5000. The current scene is the one across the middle of the screen.
    let v = await at(0);
    check(v.theme === 'dawn' && v.current === 'a' && v.stuck === '', `${mode}: at the top, a's theme on the stage; nothing held yet`, JSON.stringify(v));
    check(v.links === 'now after after after after', `${mode}: link states (aria-current, data-cv-after)`, v.links);
    v = await at(200);
    check(v.stuck === 'a' && v.theme === 'dawn', `${mode}: stacked a is stuck while b scrolls over it`, JSON.stringify(v));
    v = await at(500);
    check(v.theme === 'dusk' && v.current === 'b' && v.stuck === 'a', `${mode}: b across the middle: its theme, while a is still held`, JSON.stringify(v));
    check(v.links === 'before now after after after', `${mode}: links follow the current scene`, v.links);
    v = await at(800);
    check(v.stuck === '' && v.covered === 'a', `${mode}: covered, a is no longer stuck; zone b at its start is not`, JSON.stringify(v));
    v = await at(1100);
    check(v.stuck === 'b', `${mode}: zone b is stuck while its shell is pinned`, JSON.stringify(v));
    v = await at(1500);
    check(v.stuck === '' && v.theme === 'dusk', `${mode}: past its time, b scrolls away: not stuck`, JSON.stringify(v));
    v = await at(2000);
    check(v.current === 'c' && v.theme === null && v.stuck === '', `${mode}: c has no theme: the attribute goes; tall c is not held before its bottom arrives`, JSON.stringify(v));
    v = await at(2800);
    check(v.stuck === 'c', `${mode}: c is stuck once its bottom meets the screen's bottom`, JSON.stringify(v));
    v = await at(3100);
    check(v.theme === 'night' && v.current === 'd' && v.stuck === 'c', `${mode}: d across the middle: its theme; c still held`, JSON.stringify(v));
    v = await at(3400);
    check(v.stuck === '' && v.covered.includes('c'), `${mode}: c covered: not stuck`, JSON.stringify(v));
    const theme = await page.evaluate(async () => {
      const s = document.getElementById('s');
      const engine = s.engine;
      document.getElementById('d').setAttribute('theme', 'storm');
      const now = s.getAttribute('data-cv-theme');
      document.getElementById('b').setAttribute('theme', 'noon');
      const other = s.getAttribute('data-cv-theme');
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { now, other, rebuilt: s.engine !== engine };
    });
    check(theme.now === 'storm' && theme.other === 'storm' && !theme.rebuilt, `${mode}: a new theme on the scene at eye level shows at once, others wait; no rebuild`, JSON.stringify(theme));
    const osb = await page.evaluate(() => getComputedStyle(document.getElementById('s')).overscrollBehaviorY);
    check(osb === 'auto', `${mode}: the scroll stage leaves overscroll to the page`, osb);
    const errors = await page.evaluate(() => window.cvErrors);
    check(errors.length === 0, `${mode}: no cv-errors`, JSON.stringify(errors));
    await page.close();
  }

  {
    const page = await open('drag');
    await frames(page, 3);
    let v = await read(page);
    check(v.theme === 'dawn' && v.current === 'a' && v.links === 'now after after after after', 'drag: a current, its theme, link states', JSON.stringify(v));
    const osb = await page.evaluate(() => getComputedStyle(document.getElementById('s')).overscrollBehaviorY);
    check(osb === 'contain', 'drag: the stage contains overscroll (lexicon #24)', osb);
    const move = async (from, to) => {
      for (let i = 1; i <= 8; i++) {
        await page.mouse.move(200, from + ((to - from) * i) / 8);
        await page.waitForTimeout(16);
      }
      await frames(page, 3);
      return read(page);
    };
    await page.mouse.move(200, 600);
    await page.mouse.down();
    v = await move(600, 600 - 0.3 * H);
    check(v.stuck === 'a' && v.theme === 'dawn', 'drag: a stays put under b: stuck; a still at eye level', JSON.stringify(v));
    v = await move(600 - 0.3 * H, 600 - 0.7 * H);
    check(v.theme === 'dusk' && v.current === 'a' && v.stuck === 'a', 'drag: b past the middle of the page: its theme before the slide lands', JSON.stringify(v));
    await page.mouse.up();
    await page.waitForTimeout(900);
    v = await read(page);
    check(v.current === 'b' && v.theme === 'dusk' && v.stuck === '' && v.covered === 'a', 'drag: landed on b: a covered, nothing stuck', JSON.stringify(v));
    await page.mouse.move(200, 200);
    await page.mouse.down();
    v = await move(200, 200 + 0.7 * H);
    check(v.theme === 'dawn' && v.stuck === 'a', 'drag: back toward a past the middle: a held again, its theme', JSON.stringify(v));
    v = await move(200 + 0.7 * H, 200 + 0.1 * H);
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(900);
    v = await read(page);
    check(v.current === 'b' && v.theme === 'dusk' && v.stuck === '', 'drag: let go near b: back on b, its theme again', JSON.stringify(v));
    await page.evaluate(() => document.getElementById('s').goTo(2));
    await page.waitForTimeout(1200);
    v = await read(page);
    check(v.current === 'c' && v.theme === null && v.stuck === '', 'drag: c has no theme: the attribute goes; at rest nothing is stuck', JSON.stringify(v));
    await page.click('#to-d');
    await page.waitForTimeout(1200);
    v = await read(page);
    check(v.current === 'd' && v.theme === 'night' && v.links === 'before before before now after', 'drag: a hash link outside the stage pages to its scene (lexicon #23)', JSON.stringify(v));
    await page.click('#in');
    await page.waitForTimeout(1500);
    v = await read(page);
    check(v.current === 'b' && v.theme === 'dusk', 'drag: a hash link inside the stage pages too', JSON.stringify(v));
    const errors = await page.evaluate(() => window.cvErrors);
    check(errors.length === 0, 'drag: no cv-errors', JSON.stringify(errors));
    await page.close();
  }
} catch (e) {
  failed++;
  console.log(`FAIL probe crashed: ${e.stack ?? e}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
