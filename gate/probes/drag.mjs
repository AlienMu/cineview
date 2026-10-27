import { launch } from './browser.mjs';

/** P1.6 drag transaction, gesture contract, navigation, window and announcement (plan v3 §9). */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
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
 * Ownership starts past the 1 px direction gate; sparse samples retain the remaining distance.
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
// cv-ready fires once per connection; a rebuild (attribute change) is in place two frames later.
const rebuilt = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

const parked = (page) => page.evaluate(() => [...document.querySelectorAll('cv-scene')]
  .filter((s) => getComputedStyle(s).contentVisibility === 'hidden')
  .every((s) => { const r = s.getBoundingClientRect(); return r.bottom <= 0 || r.top >= innerHeight; }));

try {
  let page = await open();
  const plain = await center(page, 'plain');
  check(await parked(page), 'scenes outside the window are off screen, including their backgrounds');
  await page.evaluate(() => document.getElementById('s').goTo(3, { animated: false }));
  check(await parked(page), 'far navigation parks the old scenes and their backgrounds');
  await page.evaluate(() => document.getElementById('s').goTo(0, { animated: false }));
  check(await parked(page), 'return navigation parks the later scenes and their backgrounds');
  await state(page);

  // A browser may coalesce a quick drag into one movement event.
  await drag(page, { x: plain.x, y: 0.75 * H }, -0.5 * H, { steps: 1, gap: 0 });
  await settle(page);
  let sparse = await state(page);
  check(sparse.index === 1, 'one movement sample beyond half a screen commits forward', JSON.stringify(sparse));
  await page.evaluate(() => document.getElementById('s').goTo(1, { animated: false }));
  await state(page);
  await drag(page, { x: plain.x, y: 0.25 * H }, 0.5 * H, { steps: 1, gap: 0 });
  await settle(page);
  sparse = await state(page);
  check(sparse.index === 0, 'one movement sample beyond half a screen commits backward', JSON.stringify(sparse));
  await page.evaluate(() => document.getElementById('s').goTo(0, { animated: false }));
  await state(page);

  // Long drag below half a screen cancels.
  await drag(page, plain, -0.2 * H, { hold: 200 });
  await settle(page);
  let st = await state(page);
  check(st.index === 0 && st.events.join() === 'cv-dragstart:s,cv-dragcancel:s', 'held 20% drag cancels', JSON.stringify(st));
  check(st.clicks === 0, 'click suppressed after a drag', JSON.stringify(st));

  // Element time follows the finger: half a screen, less the 1 px direction gate.
  await drag(page, plain, -0.5 * H, { release: false, hold: 50 });
  const mid = await page.evaluate(() =>
    Number(getComputedStyle(document.getElementById('a1').shadowRoot.querySelector('.l')).opacity)
  );
  check(Math.abs(mid - (0.5 - 1 / H)) < 0.03, 'incoming element time follows the finger (unit/scale)', String(mid));
  await page.waitForTimeout(150);
  await page.mouse.move(plain.x, plain.y - 0.55 * H);
  await page.waitForTimeout(150);
  await page.mouse.up();
  await settle(page);
  st = await state(page);
  check(st.index === 1 && st.events.join() === 'cv-dragstart:s,cv-leave:s0,cv-enter:s1,cv-dragend:s', 'held 55% drag commits; enter/leave on commit', JSON.stringify(st));
  const live = await page.evaluate(() => document.getElementById('s').shadowRoot?.querySelector('[aria-live]')?.textContent);
  check(live === 'One, 2 / 4', 'scene change announced', String(live));
  const win = await page.evaluate(() =>
    [...document.querySelectorAll('cv-scene')].map((s) => `${s.inert ? 'i' : 'a'}${getComputedStyle(s).contentVisibility === 'hidden' ? 'h' : 'v'}`).join(' ')
  );
  check(win === 'iv av iv ih', 'window: current active, neighbours rendered inert, rest skipped', win);

  // Back to 0, then: a short swipe commits by direction.
  await page.keyboard.press('Home');
  await settle(page);
  await state(page);
  await drag(page, plain, -0.22 * H, { steps: 4, gap: 8 });
  await settle(page);
  st = await state(page);
  check(st.index === 1, 'fast 22% flick commits', JSON.stringify(st));

  await page.evaluate(() => document.getElementById('s').goTo(0, { animated: false }));
  await state(page);
  await drag(page, { x: plain.x, y: 600 }, -24, { steps: 1, gap: 0 });
  await settle(page);
  st = await state(page);
  check(st.index === 0, 'short 3% swipe cancels after tightening the default minimum', JSON.stringify(st));
  await drag(page, { x: plain.x, y: 600 }, -63, { steps: 1, gap: 0 });
  await settle(page);
  st = await state(page);
  check(st.index === 0, 'short swipe just below 8% cancels', JSON.stringify(st));
  await drag(page, { x: plain.x, y: 600 }, -64, { steps: 1, gap: 0 });
  await settle(page);
  st = await state(page);
  check(st.index === 1, 'short swipe at 8% commits below the former 15% minimum', JSON.stringify(st));
  await drag(page, { x: plain.x, y: 400 }, 63, { steps: 1, gap: 0 });
  await settle(page);
  st = await state(page);
  check(st.index === 1, 'reverse short swipe below 8% cancels', JSON.stringify(st));
  await drag(page, { x: plain.x, y: 400 }, 64, { steps: 1, gap: 0 });
  await settle(page);
  st = await state(page);
  check(st.index === 0, 'short swipe at 8% commits backward', JSON.stringify(st));
  await drag(page, { x: plain.x, y: 600 }, -4, { steps: 1, gap: 0 });
  await settle(page);
  st = await state(page);
  check(st.index === 0 && !st.events.some(e => e.startsWith('cv-enter')), '4px finger jitter does not page', JSON.stringify(st));
  await drag(page, { x: plain.x, y: 600 }, -0.4 * H, { hold: 200 });
  await settle(page);
  st = await state(page);
  check(st.index === 0, 'held 40% long drag cancels', JSON.stringify(st));
  await drag(page, { x: plain.x, y: 600 }, -(0.5 * H + 1), { hold: 200 });
  await settle(page);
  st = await state(page);
  check(st.index === 1, 'held drag at exactly 50% page travel commits', JSON.stringify(st));

  // An explicit threshold retains its authored speed/distance behavior, even an empty attr.
  await page.evaluate(() => {
    const stage = document.getElementById('s');
    stage.goTo(0, { animated: false });
    stage.setAttribute('threshold', '');
  });
  await rebuilt(page);
  await state(page);
  await drag(page, { x: plain.x, y: 600 }, -24, { steps: 1, gap: 0 });
  await settle(page);
  st = await state(page);
  check(st.index === 0, 'explicit stage threshold retains the legacy short-swipe minimum', JSON.stringify(st));
  await page.evaluate(() => document.getElementById('s0').setAttribute('threshold', '0.02 0.02 1000'));
  await state(page);
  await drag(page, { x: plain.x, y: 600 }, -24, { steps: 1, gap: 0 });
  await settle(page);
  st = await state(page);
  check(st.index === 1, 'scene threshold overrides the stage threshold', JSON.stringify(st));
  await page.evaluate(() => {
    document.getElementById('s0').removeAttribute('threshold');
    document.getElementById('s').removeAttribute('threshold');
  });
  await rebuilt(page);
  await state(page);

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
  await rebuilt(page);
  await settle(page, 200);
  await state(page);
  await drag(page, { x: plain.x, y: 600 }, -64, { steps: 1, gap: 0 });
  await page.waitForFunction(() => {
    const travel = -Number(document.getElementById('s0').style.translate.split(' ')[1]?.replace('px', '')) / innerHeight;
    return travel > 0.6 && travel < 0.9;
  });
  await page.mouse.move(plain.x, 400);
  await page.mouse.down();
  const shortRegrab = await page.evaluate(() => -Number(document.getElementById('s0').style.translate.split(' ')[1]?.replace('px', '')) / innerHeight);
  await page.mouse.move(plain.x, 464);
  await page.waitForTimeout(120);
  await page.mouse.up();
  await settle(page, 1800);
  st = await state(page);
  check(shortRegrab > 0.5 && shortRegrab < 1, 'short re-grab starts beyond half the page while still in flight', String(shortRegrab));
  check(st.index === 0 && !st.events.some(e => e.startsWith('cv-enter')), 'short re-grab toward the current scene cancels despite the inherited page position', JSON.stringify(st));

  await drag(page, plain, -0.55 * H, { hold: 200 });
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
  await rebuilt(page);
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
