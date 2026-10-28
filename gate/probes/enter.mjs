import { launch } from './browser.mjs';

/** P1.5 normal-flow entrances (1.x gate semantics), page source and activation events. */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const settle = (page, ms) => page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);
const layerState = (page, id) =>
  page.evaluate((id) => {
    const l = document.getElementById(id).shadowRoot.querySelector('.l');
    const anims = l.getAnimations();
    return {
      opacity: Number(getComputedStyle(l).opacity),
      anims: anims.map((a) => ({ delay: a.effect.getTiming().delay, duration: a.effect.getTiming().duration, state: a.playState })),
    };
  }, id);
const scrollToEl = (page, id, offsetFromTop) =>
  page.evaluate(([id, off]) => {
    const top = document.getElementById(id).getBoundingClientRect().top + scrollY;
    scrollTo(0, top - off);
  }, [id, offsetFromTop]);

for (const mode of ['native', 'fallback']) {
  const q = mode === 'fallback' ? '&fallback' : '';
  try {
    const warm = await browser.newPage();
    await warm.goto(`${base}/enter.html`);
    await warm.waitForTimeout(1200);
    await warm.close();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    if (mode === 'fallback') await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.getElementById('s')?.setAttribute('fallback', '')));
    await page.goto(`${base}/enter.html?x${q}`);
    await page.evaluate(() => window.ready);
    const title = await layerState(page, 'title');
    const sub = await layerState(page, 'sub');
    check(title.anims[0]?.duration === 400, `${mode}: first-screen title plays on load`, JSON.stringify(title));
    check(Math.abs((sub.anims[0]?.delay ?? -1) - 300) < 20, `${mode}: after="t -100" starts 300 ms after the title`, JSON.stringify(sub));
    const ex0 = await layerState(page, 'ex');
    check(ex0.opacity === 0 && ex0.anims.length === 0, `${mode}: element below the fold waits hidden`, JSON.stringify(ex0));

    await scrollToEl(page, 'ex', 400); // fully in view, clear of both margins
    await settle(page, 450);
    const ex1 = await layerState(page, 'ex');
    check(ex1.opacity === 1, `${mode}: enters when fully in view`, JSON.stringify(ex1));
    // Leaving through the top: the top edge crosses above the viewport. (Inside [0, exitMargin]
    // both gates hold — the 1.x hysteresis band — so the phase is kept there.)
    await scrollToEl(page, 'ex', 10);
    await settle(page, 450);
    const band = await layerState(page, 'ex');
    check(band.opacity === 1, `${mode}: holds inside the top hysteresis band`, JSON.stringify(band));
    await scrollToEl(page, 'ex', -10);
    await settle(page, 450);
    const ex2 = await layerState(page, 'ex');
    check(ex2.opacity === 0, `${mode}: declared exit plays when leaving through the top`, JSON.stringify(ex2));
    await scrollToEl(page, 'ex', 400);
    await settle(page, 450);
    const ex3 = await layerState(page, 'ex');
    check(ex3.opacity === 1, `${mode}: entering again replays`, JSON.stringify(ex3));

    await scrollToEl(page, 'rp', 400);
    await settle(page, 300);
    const rp1 = await layerState(page, 'rp');
    await page.evaluate(() => scrollTo(0, 0)); // rp far below: off screen
    await settle(page, 200);
    const rp2 = await layerState(page, 'rp');
    check(rp1.opacity === 1 && rp2.opacity === 0, `${mode}: replay re-arms off screen`, JSON.stringify({ rp1, rp2 }));

    await scrollToEl(page, 'eye', 500); // top 500: below the 45% line (380)
    await settle(page, 300);
    const eye1 = await layerState(page, 'eye');
    await scrollToEl(page, 'eye', 330); // straddles the line
    await settle(page, 300);
    const eye2 = await layerState(page, 'eye');
    check(eye1.opacity === 0 && eye2.opacity === 1, `${mode}: eye plays when the element reaches eye level`, JSON.stringify({ eye1, eye2 }));

    const pg = await page.evaluate(async () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      scrollTo(0, max / 2);
      await new Promise((r) => setTimeout(r, 300));
      const l = document.getElementById('pg').shadowRoot.querySelector('.l');
      return { opacity: Number(getComputedStyle(l).opacity), want: scrollY / max };
    });
    check(Math.abs(pg.opacity - pg.want) < 0.02, `${mode}: page source follows document progress`, JSON.stringify(pg));
    const events = await page.evaluate(() => window.events);
    check(events.includes('cv-activate:s0') && events.includes('cv-activate:s1'), `${mode}: activation events`, JSON.stringify(events));
    const errors = await page.evaluate(() => window.cvErrors);
    check(errors.length === 0, `${mode}: no cv-error`, JSON.stringify(errors));
    await page.close();

    // Restored scroll position: elements already above show their final frame, no animation.
    const restored = await browser.newPage({ viewport: { width: 390, height: 844 } });
    if (mode === 'fallback') await restored.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.getElementById('s')?.setAttribute('fallback', '')));
    await restored.goto(`${base}/enter.html?at=2400${q}`);
    await restored.evaluate(() => window.ready);
    const above = await layerState(restored, 'ex');
    const title2 = await layerState(restored, 'title');
    check(above.opacity === 1 && above.anims.length === 0 && title2.opacity === 1, `${mode}: restored position shows passed elements final`, JSON.stringify({ above, title2 }));
    await restored.close();
  } catch (e) {
    failed++;
    console.log(`FAIL ${mode}: ${e.message}`);
  }
}
// A once follower retains its final frame on return while its normal tail keeps its original
// start window. Cover visibility roots and scene-entry clocks in scroll and drag.
for (const query of ['chain=enter', 'chain=clock', 'chain=clock&drag']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${base}/enter.html?${query}`);
    await page.evaluate(() => window.ready);
    await page.waitForTimeout(800);
    check((await layerState(page, 'sub')).opacity === 1, `${query}: once follower completes its first entrance`);
    await page.evaluate(() => document.getElementById('s').goTo(1, { animated: false }));
    await page.waitForFunction(() => document.getElementById('s').current === 1);
    await page.waitForTimeout(100);
    await page.evaluate(() => document.getElementById('s').goTo(0, { animated: false }));
    await page.waitForFunction(() => document.getElementById('s').current === 0);
    await page.waitForTimeout(80);
    const follower = await layerState(page, 'sub'), tail = await layerState(page, 'tail');
    check(follower.opacity === 1 && tail.opacity === 0,
      `${query}: once follower stays visible without advancing its tail`, JSON.stringify({ follower, tail }));
    await page.waitForTimeout(700);
    check((await layerState(page, 'tail')).opacity === 1, `${query}: tail finishes on its scheduled run`);
    check((await page.evaluate(() => window.cvErrors)).length === 0, `${query}: no cv-error`);
  } catch (e) { failed++; console.log(`FAIL ${query}: ${e.stack}`); }
  await page.close();
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
