import { chromium } from 'playwright';

/** P1.6 drag transaction, gesture contract, navigation, window and announcement (plan v3 §9). */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await chromium.launch(process.env.CV_CHROMIUM ? { executablePath: process.env.CV_CHROMIUM } : { channel: 'chrome' });
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const H = 800;
const open = async (query = '', hash = '') => {
  const page = await browser.newPage({ viewport: { width: 400, height: H } });
  await page.goto(`${base}/drag.html?x${query}${hash}`);
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(100);
  return page;
};
const state = (page) =>
  page.evaluate(() => {
    const s = document.getElementById('s');
    return {
      index: s.currentIndex(),
      events: window.events.splice(0),
      clicks: window.clicks,
      errors: window.cvErrors,
    };
  });
const center = async (page, id) => {
  const b = await page.locator(`#${id}`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
/**
 * Press at (x, y), move by dy in `steps` moves `gap` ms apart, optionally hold, release.
 * Ownership starts on the first move and rebases there, so the page travels dy * (steps - 1) / steps.
 */
const drag = async (page, from, dy, { steps = 10, gap = 16, hold = 0, release = true } = {}) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x, from.y + (dy * i) / steps);
    await page.waitForTimeout(gap);
  }
  if (hold) await page.waitForTimeout(hold);
  if (release) await page.mouse.up();
};
const settle = (page, ms = 600) => page.waitForTimeout(ms);

try {
  let page = await open();
  const plain = await center(page, 'plain');

  // Held short drag: below the slow threshold, no velocity → cancel.
  await drag(page, plain, -0.2 * H, { hold: 200 });
  await settle(page);
  let st = await state(page);
  check(st.index === 0 && st.events.join() === 'cv-dragstart:s,cv-dragcancel:s', 'held 20% drag cancels', JSON.stringify(st));
  check(st.clicks === 0, 'click suppressed after a drag', JSON.stringify(st));

  // Element time follows the finger: 45% of a screen at unit=time scale=10 → 450 ms of 1000.
  await drag(page, plain, -0.5 * H, { release: false, hold: 50 });
  const mid = await page.evaluate(() =>
    Number(getComputedStyle(document.getElementById('a1').shadowRoot.querySelector('.l')).opacity)
  );
  check(Math.abs(mid - 0.45) < 0.03, 'incoming element time follows the finger (unit/scale)', String(mid));
  await page.waitForTimeout(150);
  await page.mouse.up();
  await settle(page);
  st = await state(page);
  check(st.index === 1 && st.events.join() === 'cv-dragstart:s,cv-leave:s0,cv-enter:s1,cv-dragend:s', 'held 50% drag commits; enter/leave on commit', JSON.stringify(st));
  const live = await page.evaluate(() => document.getElementById('s').shadowRoot?.querySelector('[aria-live]')?.textContent);
  check(live === 'One, 2 / 4', 'scene change announced', String(live));
  const win = await page.evaluate(() =>
    [...document.querySelectorAll('cv-scene')].map((s) => `${s.inert ? 'i' : 'a'}${getComputedStyle(s).contentVisibility === 'hidden' ? 'h' : 'v'}`).join(' ')
  );
  check(win === 'iv av iv ih', 'window: current active, neighbours rendered inert, rest skipped', win);

  // Back to 0, then: a fast short flick commits (~17%: past the fast ratio, short of the slow one).
  await page.keyboard.press('Home');
  await settle(page);
  await state(page);
  await drag(page, plain, -0.22 * H, { steps: 4, gap: 8 });
  await settle(page);
  st = await state(page);
  check(st.index === 1, 'fast 17% flick commits', JSON.stringify(st));

  // Keyboard paging.
  await page.keyboard.press('ArrowDown');
  await settle(page);
  st = await state(page);
  check(st.index === 2 && st.events.join() === 'cv-leave:s1,cv-enter:s2', 'ArrowDown pages forward, no drag events', JSON.stringify(st));
  await page.keyboard.press('Home');
  await settle(page);
  st = await state(page);
  check(st.index === 0, 'Home goes to the first scene', JSON.stringify(st));

  // Boundary: backward from the first scene is rejected (no session).
  await drag(page, plain, 0.4 * H);
  await settle(page);
  st = await state(page);
  check(st.index === 0 && st.events.length === 0, 'backward drag at the first scene is rejected', JSON.stringify(st));

  // Interactive target and nested scroller keep the gesture.
  await drag(page, await center(page, 'btn'), -0.5 * H);
  await settle(page);
  st = await state(page);
  check(st.index === 0 && st.events.length === 0, 'press on a button never pages', JSON.stringify(st));
  await drag(page, await center(page, 'scroller'), -0.5 * H);
  await settle(page);
  st = await state(page);
  check(st.index === 0 && st.events.length === 0, 'nested scroller that can scroll keeps the gesture', JSON.stringify(st));

  // Re-grab during the commit slide takes over in place; dragging back cancels without flushing.
  await page.evaluate(() => document.getElementById('s').setAttribute('transition-duration', '1500'));
  await page.evaluate(() => window.ready = new Promise((r) => document.addEventListener('cv-ready', r, { once: true })));
  await page.evaluate(() => window.ready);
  await settle(page, 200);
  await state(page);
  await drag(page, plain, -0.5 * H, { hold: 150 });
  await page.waitForTimeout(150);
  const regrab = await page.evaluate(() => {
    const s1 = document.getElementById('s1');
    return Number(s1.style.translate.split(' ')[1]?.replace('px', ''));
  });
  await drag(page, plain, 0.6 * H, { hold: 200 });
  await settle(page, 1200);
  st = await state(page);
  check(regrab > 0 && regrab < 0.5 * H, 'commit slide in flight when re-grabbed', String(regrab));
  check(st.index === 0 && !st.events.some((e) => e.startsWith('cv-enter')), 're-grab takes over without flushing the switch', JSON.stringify(st));
  check(st.events.filter((e) => e.startsWith('cv-dragstart')).length === 1 && st.events.at(-1) === 'cv-dragcancel:s', 'one session across the re-grab, ends cancelled', JSON.stringify(st));
  await page.evaluate(() => document.getElementById('s').setAttribute('transition-duration', '400'));
  await page.evaluate(() => window.ready = new Promise((r) => document.addEventListener('cv-ready', r, { once: true })));
  await page.evaluate(() => window.ready);
  await state(page);

  // Hash link → goTo.
  await page.evaluate(() => document.getElementById('s').goTo(0, { animated: false }));
  await state(page);
  await page.click('#link3');
  await settle(page, 1200);
  st = await state(page);
  const hash = await page.evaluate(() => location.hash);
  check(st.index === 3 && hash === '#s3', 'hash link pages to its scene', JSON.stringify({ ...st, hash }));

  // stage.goTo by id, not animated.
  await page.evaluate(() => document.getElementById('s').goTo('s1', { animated: false }));
  st = await state(page);
  check(st.index === 1 && st.events.join() === 'cv-leave:s3,cv-enter:s1', 'stage.goTo(id, {animated:false}) switches at once', JSON.stringify(st));
  check(st.errors.length === 0, 'no cv-error', JSON.stringify(st.errors));
  await page.close();

  // drag="off" on the next scene.
  page = await open('&off');
  await page.focus('#s');
  await page.keyboard.press('ArrowDown');
  await settle(page);
  await state(page);
  await drag(page, await center(page, 'a1'), -0.5 * H);
  await settle(page);
  st = await state(page);
  check(st.index === 1 && st.events.join() === 'cv-dragblocked:s', 'drag="off" scene blocks dragging into it, reported once', JSON.stringify(st));
  await page.close();

  // :target entry.
  page = await open('', '#s2');
  st = await state(page);
  check(st.index === 2, 'hash entry starts at its scene', JSON.stringify(st));
  await page.close();
} catch (e) {
  failed++;
  console.log(`FAIL ${e.stack}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
