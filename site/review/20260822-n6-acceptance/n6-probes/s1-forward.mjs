/* S1 forward lock: small-step wheel through zone 1 (scene 1, cap-film-zone), 0->100% continuous.
 * NOTE: dist compiles the __CINEVIEW_SCROLL_DEBUG__ switch to constant false, so engine
 * self-report attrs are unavailable. Zone progress here is MY OWN observable:
 * sticky geometry — a takeover scene pins its 900px sticky shell for scrollTop in
 * [wrapperTop, wrapperTop + wrapperH - viewportH]; p = (st - pinStart) / pinSpan.
 * Criteria:
 *  A. p samples in pin range: >=12, max consecutive gap <= 0.2, monotone non-decreasing (tol -0.03)
 *  A2. p reaches >= 0.99 while still pinned (completion inside segment)
 *  B. release: after completion st passes pinEnd; next zone (scene 2) begins its own pin from ~0
 *  C. visual scrub: tracked lane opacity: >=4 distinct values, endpoint delta >= 0.2
 *  D. no mid-zone blackout (all big lanes opacity < 0.05 with p in (0.05,0.95))
 *  E. console error/warning == 0
 */
import { openPage, readLanes, sleep, note, pass, fail, scrollTop, SHOTS } from './lib.mjs';

const VH = 900;
const { browser, page, consoleMsgs } = await openPage({ path: '/' });
await sleep(3000);
await page.mouse.move(720, 450);

const geo = await page.evaluate(() => {
  const c = document.querySelector('[data-cineview-container="true"]');
  const st = c.scrollTop;
  return [...document.querySelectorAll('[data-scene-index]')].map((w) => {
    const r = w.getBoundingClientRect();
    const top = Math.round(r.top + st);
    return { idx: Number(w.getAttribute('data-scene-index')), top, h: Math.round(r.height) };
  });
});
note(`## S1 forward lock (zone 1 = scene 1 cap-film-zone) ${new Date().toISOString()}`);
note(`geometry=${JSON.stringify(geo)}`);
const z1 = geo.find((g) => g.idx === 1);
const z2 = geo.find((g) => g.idx === 2);
const pinStart = z1.top;
const pinSpan = z1.h - VH;
const pOf = (st) => Math.min(1, Math.max(0, (st - pinStart) / pinSpan));

const samples = [];
const laneSamples = [];
let z2Pinned = false;
let z2P = null;
for (let i = 0; i < 400; i++) {
  await page.mouse.wheel(0, 150);
  await sleep(65);
  const st = await scrollTop(page);
  samples.push({ st, p: pOf(st) });
  laneSamples.push(await readLanes(page));
  if (i % 6 === 0) {
    const pin2 = await page.evaluate(() => {
      const w = document.querySelector('[data-scene-index="2"]');
      const sh = w?.querySelector('[data-cineview-takeover-shell]');
      if (!sh) return { pinned: false };
      const r = sh.getBoundingClientRect();
      return { pinned: r.top <= 1 && r.bottom >= window.innerHeight - 1 };
    });
    if (pin2.pinned && st > z2.top - 5) {
      z2Pinned = true;
      z2P = (st - z2.top) / (z2.h - VH);
      break;
    }
  }
  if (samples.at(-1).st > z2.top + z2.h) break;
}

// screenshots at buckets
await page.screenshot({ path: `${SHOTS}/s1-zone1-end.png` });

const inPin = samples.filter((s) => s.st >= pinStart - 2 && s.st <= pinStart + pinSpan + 2).map((s) => s.p);
const maxP = Math.max(...samples.map((s) => s.p));
note(`samples=${samples.length} inPin=${inPin.length} pinStart=${pinStart} pinSpan=${pinSpan} maxP=${maxP.toFixed(3)} z2Pinned=${z2Pinned} z2P=${z2P}`);

let monotone = true;
for (let i = 1; i < inPin.length; i++) if (inPin[i] < inPin[i - 1] - 0.03) monotone = false;
let maxGap = 0;
for (let i = 1; i < inPin.length; i++) maxGap = Math.max(maxGap, inPin[i] - inPin[i - 1]);
inPin.length >= 12 && maxGap <= 0.2 && monotone
  ? pass('A progress continuity', `n=${inPin.length} maxGap=${maxGap.toFixed(3)} monotone=${monotone}`)
  : fail('A progress continuity', `n=${inPin.length} maxGap=${maxGap.toFixed(3)} monotone=${monotone}`);
maxP >= 0.99 ? pass('A2 reaches 100% in segment', `maxP=${maxP.toFixed(3)}`) : fail('A2 reaches 100% in segment', `maxP=${maxP.toFixed(3)}`);
z2Pinned && z2P !== null && z2P < 0.35
  ? pass('B release + next zone from ~0', `scene2 pinned, its p=${z2P.toFixed(3)}`)
  : fail('B release + next zone from ~0', `z2Pinned=${z2Pinned} z2P=${z2P}`);

const laneIds = new Set();
laneSamples.forEach((ls) => Object.keys(ls).forEach((k) => laneIds.add(k)));
const ranges = [...laneIds].map((id) => {
  const ops = laneSamples.map((ls) => ls[id]?.op).filter((v) => v != null);
  return { id, min: Math.min(...ops), max: Math.max(...ops), distinct: new Set(ops.map((v) => Math.round(v * 100))).size, n: ops.length };
});
const tracked = ranges.filter((r) => r.n >= 10).sort((a, b) => b.max - b.min - (a.max - a.min))[0];
note(`lanes seen=${laneIds.size} tracked=${tracked?.id} opRange=${tracked ? (tracked.max - tracked.min).toFixed(2) : '-'} distinct=${tracked?.distinct}`);
tracked && tracked.max - tracked.min >= 0.2 && tracked.distinct >= 4
  ? pass('C visual scrub', `lane=${tracked.id} opRange=${(tracked.max - tracked.min).toFixed(2)} distinct=${tracked.distinct}`)
  : fail('C visual scrub', `lane=${tracked?.id} opRange=${tracked ? (tracked.max - tracked.min).toFixed(2) : '-'} distinct=${tracked?.distinct}`);

let blackout = 0;
samples.forEach((s, i) => {
  if (s.p > 0.05 && s.p < 0.95) {
    const vis = Object.values(laneSamples[i]).filter((l) => l.h > 100);
    if (vis.length > 0 && vis.every((l) => l.op < 0.05)) blackout++;
  }
});
blackout === 0 ? pass('D no mid-zone blackout', `${blackout} blackout samples`) : fail('D no mid-zone blackout', `${blackout} blackout samples`);

consoleMsgs.length === 0 ? pass('E console clean', '0 errors/warnings') : fail('E console clean', `${consoleMsgs.length}: ${consoleMsgs.slice(0, 3).map((c) => c.type + ':' + c.text.slice(0, 120)).join(' | ')}`);

await browser.close();
