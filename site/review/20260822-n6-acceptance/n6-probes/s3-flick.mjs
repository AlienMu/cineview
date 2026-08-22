/* S3 big flick anti-skip: one huge wheel delta must clamp into the current segment.
 * Criteria:
 *  F1. from zone1 p~0.4, single +20000px wheel: after settle st stays within zone1 pin span
 *      (<= pinEnd + 200), scene2 NOT entered (st < z2.top), p1 >= 0.9 (clamped to segment end frame)
 *  F2. clamping is per-step, not a deadlock: a further small-step drive can still cross into zone2
 *  F3. from zone2 mid, single -20000px wheel: st stays >= z2 pin start (zone1 interior NOT re-entered
 *      beyond boundary), p2 <= 0.08, p1 back to 1 (full)
 *  E.  console error/warning == 0
 */
import { openPage, sleep, note, pass, fail, scrollTop, SHOTS } from './lib.mjs';

const VH = 900;
const { browser, page, consoleMsgs } = await openPage({ path: '/' });
await sleep(3000);
await page.mouse.move(720, 450);

const geo = await page.evaluate(() => {
  const c = document.querySelector('[data-cineview-container="true"]');
  const st = c.scrollTop;
  return [...document.querySelectorAll('[data-scene-index]')].map((w) => {
    const r = w.getBoundingClientRect();
    return { idx: Number(w.getAttribute('data-scene-index')), top: Math.round(r.top + st), h: Math.round(r.height) };
  });
});
const z1 = geo.find((g) => g.idx === 1);
const z2 = geo.find((g) => g.idx === 2);
const pOf = (g, st) => Math.min(1, Math.max(0, (st - g.top) / (g.h - VH)));
const z1End = z1.top + z1.h - VH; // 14140
note(`## S3 big flick anti-skip ${new Date().toISOString()}`);
note(`z1=[${z1.top},${z1End}] z2.top=${z2.top}`);

// creep to zone1 p~0.4
const target = z1.top + 0.4 * (z1.h - VH);
for (let i = 0; i < 120; i++) {
  const st = await scrollTop(page);
  if (st >= target - 60) break;
  await page.mouse.wheel(0, Math.min(160, Math.max(40, target - st)));
  await sleep(65);
}
await sleep(300);
const pre = await scrollTop(page);

// ONE big flick
await page.mouse.wheel(0, 20000);
await sleep(800);
const post = await scrollTop(page);
await page.screenshot({ path: `${SHOTS}/s3-after-forward-flick.png` });
note(`F1 pre=${pre} (p1=${pOf(z1, pre).toFixed(2)}) post=${post} (p1=${pOf(z1, post).toFixed(3)}, p2=${pOf(z2, post).toFixed(3)})`);

const f1a = post <= z1End + 200 && post < z2.top;
const f1b = pOf(z1, post) >= 0.9;
f1a ? pass('F1a clamped in segment', `post=${post} <= ${z1End + 200}, scene2 not entered`) : fail('F1a clamped in segment', `post=${post} > ${z1End + 200} or >= z2.top ${z2.top}`);
f1b ? pass('F1b forced in-segment frame', `p1=${pOf(z1, post).toFixed(3)}`) : fail('F1b forced in-segment frame', `p1=${pOf(z1, post).toFixed(3)}`);

// F2: small-step drive can still cross
let crossed = false;
for (let i = 0; i < 80; i++) {
  await page.mouse.wheel(0, 150);
  await sleep(60);
  const st = await scrollTop(page);
  if (st > z1End + 400) { crossed = true; break; }
}
const stF2 = await scrollTop(page);
crossed && stF2 < z2.top + z2.h
  ? pass('F2 no deadlock, crosses sequentially', `st=${stF2} past zone1 end`)
  : fail('F2 no deadlock, crosses sequentially', `crossed=${crossed} st=${stF2}`);

// creep to zone2 mid
const t2 = z2.top + 0.5 * (z2.h - VH);
for (let i = 0; i < 160; i++) {
  const st = await scrollTop(page);
  if (st >= t2 - 60) break;
  await page.mouse.wheel(0, Math.min(160, Math.max(40, t2 - st)));
  await sleep(60);
}
await sleep(300);
const pre2 = await scrollTop(page);
// ONE huge reverse flick
await page.mouse.wheel(0, -20000);
await sleep(800);
const post2 = await scrollTop(page);
await page.screenshot({ path: `${SHOTS}/s3-after-reverse-flick.png` });
note(`F3 pre2=${pre2} (p2=${pOf(z2, pre2).toFixed(2)}) post2=${post2} (p1=${pOf(z1, post2).toFixed(3)}, p2=${pOf(z2, post2).toFixed(3)})`);

const f3a = post2 >= z2.top - 200 && post2 > z1End;
const f3b = pOf(z2, post2) <= 0.08;
const f3c = pOf(z1, post2) >= 0.999;
f3a ? pass('F3a reverse clamped in zone2', `post2=${post2} within [${z2.top - 200}, ...]`) : fail('F3a reverse clamped in zone2', `post2=${post2}`);
f3b ? pass('F3b reverse in-segment frame', `p2=${pOf(z2, post2).toFixed(3)}`) : fail('F3b reverse in-segment frame', `p2=${pOf(z2, post2).toFixed(3)}`);
f3c ? pass('F3c zone1 stays complete', `p1=${pOf(z1, post2).toFixed(3)}`) : fail('F3c zone1 stays complete', `p1=${pOf(z1, post2).toFixed(3)}`);

consoleMsgs.length === 0 ? pass('E console clean', '0 errors/warnings') : fail('E console clean', `${consoleMsgs.length}: ${consoleMsgs.slice(0, 3).map((c) => c.type + ':' + c.text.slice(0, 120)).join(' | ')}`);

await browser.close();
