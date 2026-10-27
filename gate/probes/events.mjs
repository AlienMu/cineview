import { launch } from './browser.mjs';

/**
 * P1.9 events and errors: cv-ready once, cv-enter / cv-leave with details under scroll (middle of
 * the viewport) and drag (commit), cv-progress (load, zone, page), error codes on the offending
 * element, one report per persisting error across rebuilds, state attributes (data-cv-current,
 * data-cv-active, data-cv-stuck, data-cv-direction, aria-current / data-cv-before / data-cv-after
 * on links), development-build console output (errors and craft warnings).
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const H = 800;
const open = async (mode) => {
  const page = await browser.newPage({ viewport: { width: 400, height: H } });
  const consoleOut = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') consoleOut.push(`${m.type()}: ${m.text()}`);
  });
  await page.goto(`${base}/events.html?mode=${mode}`, { waitUntil: 'domcontentloaded' });
  return { page, consoleOut };
};
const frames = (page, n = 2) =>
  page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);
const take = (page) => page.evaluate(() => ({ log: window.log.splice(0), progress: window.progress.splice(0) }));
const attrs = (page) =>
  page.evaluate(() => ({
    current: [...document.querySelectorAll('[data-cv-current]')].map((e) => e.id),
    active: [...document.querySelectorAll('cv-scene[data-cv-active]')].map((e) => e.id),
    stuck: [...document.querySelectorAll('[data-cv-stuck]')].map((e) => e.id),
    direction: document.getElementById('s').getAttribute('data-cv-direction'),
    links: Object.fromEntries(
      [...document.querySelectorAll('nav a')].map((a) => [
        a.id,
        [a.getAttribute('aria-current') && 'current', a.hasAttribute('data-cv-before') && 'before', a.hasAttribute('data-cv-after') && 'after'].filter(Boolean).join(','),
      ])
    ),
  }));
const scrollTo = async (page, y) => {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(250);
};
const enterLeave = (log) => log.filter((e) => e.type === 'cv-enter' || e.type === 'cv-leave').map((e) => `${e.type}:${e.target}:${e.detail.from}>${e.detail.to}:${e.detail.direction}`);

try {
  // Warm the dev server (a first visit can trigger a reload while it optimises dependencies).
  const warm = await browser.newPage();
  await warm.goto(`${base}/events.html?mode=empty`);
  await warm.waitForTimeout(1200);
  await warm.close();

  // ---- scroll ---------------------------------------------------------------------------------
  let { page, consoleOut } = await open('scroll');
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(400);
  let errors = await page.evaluate(() => window.cvErrors);
  const has = (code, target) => errors.some((e) => e.code === code && e.target === target);
  check(has('unknown-effect', 'e-unknown'), 'unknown preset: unknown-effect on the element', JSON.stringify(errors));
  check(has('invalid-attribute', 'e-parse'), 'unreadable from/to: invalid-attribute on the element');
  check(has('missing-after', 'e-missing'), 'after naming nothing: missing-after on the element');
  check(errors.some((e) => e.code === 'cycle' && e.target.startsWith('e-cycle')), 'after cycle: cycle on a member');
  check(has('invalid-attribute', 'e-range'), 'cv-video range: invalid-attribute on the element');
  check(has('asset-failed', 'broken'), 'failed preload image: asset-failed on the image');
  let t = await take(page);
  const load = t.progress.filter((p) => p.kind === 'load');
  check(load.length === 2 && load.at(-1).progress === 1 && load.at(-1).total === 2 && load.every((p) => p.target === 's'), 'cv-progress load per settled asset on the stage', JSON.stringify(load));
  check(t.log.filter((e) => e.type === 'cv-ready').length === 1 && enterLeave(t.log).length === 0, 'cv-ready once, no enter/leave for the opening scene', JSON.stringify(t.log.map((e) => e.type)));
  let a = await attrs(page);
  check(a.current.join() === 's0' && a.links.l0 === 'current' && a.links.l1 === 'after' && a.links.l2 === 'after' && a.links.lx === '', 'opening scene current; links marked', JSON.stringify(a));
  check(a.active.includes('s0') && a.active.includes('s1') && !a.active.includes('s3'), 'data-cv-active follows the activation window', JSON.stringify(a.active));
  const z = await page.evaluate(() => { const s = document.getElementById('s1'); return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight }; });
  const zoneStart = t.progress.filter((p) => p.kind === 'zone' && p.target === 's1');
  check(zoneStart.length === 1 && zoneStart[0].progress === 0, 'zone reports its start once', JSON.stringify(zoneStart));

  await scrollTo(page, z.top + 500);
  t = await take(page);
  a = await attrs(page);
  let zone = t.progress.filter((p) => p.kind === 'zone');
  check(zone.length > 0 && Math.abs(zone.at(-1).progress - 0.5) < 0.01 && zone.at(-1).index === 1, 'cv-progress zone on the scene, scene time / total', JSON.stringify(zone.at(-1)));
  check(a.stuck.join() === 's1', 'data-cv-stuck while the shell is pinned', JSON.stringify(a.stuck));
  check(enterLeave(t.log).join() === 'cv-leave:s0:0>1:forward,cv-enter:s1:0>1:forward', 'middle of the viewport enters the zone scene', JSON.stringify(enterLeave(t.log)));
  check(a.current.join() === 's1' && a.direction === 'forward' && a.links.l0 === 'before' && a.links.l1 === 'current', 'current, direction and links follow', JSON.stringify(a));

  await scrollTo(page, z.top + 1200);
  t = await take(page);
  a = await attrs(page);
  zone = t.progress.filter((p) => p.kind === 'zone');
  check(zone.at(-1)?.progress === 1 && a.stuck.length === 0, 'past the zone: end value reported, unstuck', JSON.stringify({ zone: zone.at(-1), stuck: a.stuck }));

  await page.evaluate(() => document.getElementById('s').goTo('inner', { animated: false }));
  await page.waitForTimeout(250);
  t = await take(page);
  a = await attrs(page);
  check(enterLeave(t.log).at(-1) === 'cv-enter:s2:1>2:forward' && a.links.l2 === 'current', 'goTo an element inside a scene: its scene is current, its link too', JSON.stringify({ el: enterLeave(t.log), links: a.links }));

  await scrollTo(page, 0);
  t = await take(page);
  a = await attrs(page);
  check(enterLeave(t.log).at(-1) === 'cv-enter:s0:2>0:backward' && a.direction === 'backward', 'scrolling back: backward from the scene left', JSON.stringify(enterLeave(t.log)));
  zone = t.progress.filter((p) => p.kind === 'zone');
  check(zone.at(-1)?.progress === 0, 'back above the zone: start value reported', JSON.stringify(zone.at(-1)));

  const before = (await page.evaluate(() => window.cvErrors.length));
  await page.evaluate(() => document.getElementById('s').setAttribute('margin', '40'));
  await frames(page, 3);
  t = await take(page);
  const after = await page.evaluate(() => window.cvErrors.length);
  check(after === before && !t.log.some((e) => e.type === 'cv-ready'), 'rebuild: no second cv-ready, persisting errors not re-sent', JSON.stringify({ before, after }));
  await page.evaluate(() => document.getElementById('e-unknown').setAttribute('fx', 'fade'));
  await frames(page, 3);
  await page.evaluate(() => document.getElementById('e-unknown').setAttribute('fx', 'nope'));
  await frames(page, 3);
  const again = await page.evaluate(() => window.cvErrors.filter((e) => e.target === 'e-unknown').length);
  check(again === 2, 'a fixed then reintroduced error is reported again', String(again));
  check(consoleOut.some((l) => l.startsWith('error: [cineview] unknown-effect')), 'dev build logs cv-error to the console');
  check(consoleOut.some((l) => l.includes('outside a <cv-scene>')), 'craft: element outside a scene', JSON.stringify(consoleOut.filter((l) => l.startsWith('warning'))));
  await page.close();

  // ---- drag -----------------------------------------------------------------------------------
  ({ page, consoleOut } = await open('drag'));
  await page.evaluate(() => window.ready);
  await frames(page, 3);
  errors = await page.evaluate(() => window.cvErrors);
  check(errors.some((e) => e.code === 'invalid-drag-config' && e.target === 's1'), 'scene unit: invalid-drag-config on the scene', JSON.stringify(errors));
  a = await attrs(page);
  check(a.current.join() === 's0' && a.active.join() === 's0,s1', 'drag: current scene, window ±1 active', JSON.stringify(a));
  await take(page);
  await page.mouse.move(200, 600);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    // Commit comfortably past the long-swipe boundary: direction locking consumes a few pixels.
    await page.mouse.move(200, 600 - (0.55 * H * i) / 10);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(150);
  t = await take(page);
  const moving = t.progress.filter((p) => p.kind === 'page');
  check(moving.length >= 5 && moving.every((p) => p.index === 0 && p.direction === 'forward' && p.target === 's') && moving.at(-1).progress > 0.4, 'cv-progress page follows the finger', JSON.stringify(moving.at(-1)));
  await page.mouse.up();
  await page.waitForTimeout(800);
  t = await take(page);
  const landed = t.progress.filter((p) => p.kind === 'page');
  a = await attrs(page);
  check(landed.at(-1)?.progress === 1 && landed.at(-1).index === 0, 'commit: progress lands at 1 against the scene left', JSON.stringify(landed.slice(-2)));
  check(enterLeave(t.log).join() === 'cv-leave:s0:0>1:forward,cv-enter:s1:0>1:forward', 'commit: leave then enter with details', JSON.stringify(enterLeave(t.log)));
  check(a.current.join() === 's1' && a.active.join() === 's0,s1,s2' && a.direction === 'forward' && a.links.l0 === 'before', 'drag: attributes after the switch', JSON.stringify(a));
  await page.evaluate(() => document.getElementById('s').goTo(3));
  await page.waitForTimeout(900);
  t = await take(page);
  a = await attrs(page);
  check(enterLeave(t.log).join() === 'cv-leave:s1:1>3:forward,cv-enter:s3:1>3:forward' && t.progress.some((p) => p.kind === 'page'), 'goTo across scenes: one leave/enter pair, progress on the slide', JSON.stringify(enterLeave(t.log)));
  check(a.links.l3 === 'current' && a.links.l2 === 'before', 'drag: links after goTo', JSON.stringify(a.links));
  check(consoleOut.some((l) => l.includes('taller than the screen')), 'craft: tall drag scene', JSON.stringify(consoleOut));
  await page.close();

  // ---- empty ----------------------------------------------------------------------------------
  ({ page } = await open('empty'));
  await page.waitForTimeout(500);
  errors = await page.evaluate(() => window.cvErrors);
  t = await take(page);
  check(errors.length === 1 && errors[0].code === 'empty-stage' && !t.log.some((e) => e.type === 'cv-ready'), 'empty stage: empty-stage, no cv-ready', JSON.stringify(errors));
  await page.close();
} catch (e) {
  failed++;
  console.log(`FAIL ${e.stack}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
