/* S4 keyboard + scrollbar parity with wheel.
 * Criteria:
 *  K1. ArrowDown small steps: st advances gradually (per-press jump <= 300px), reaches zone1
 *  K2. PageDown in zone1: advances <= 0.86*VH + slack, no zone skip (st <= z1End+200)
 *  K3. End from zone1 mid: clamped into zone1 segment (st <= z1End+200); repeated End presses
 *      do progress (no deadlock) and eventually can leave zone1
 *  K4. Home from zone2 mid: clamped to zone2 segment start (st in [z1End, z2.top+300])
 *  SB1. thumb drag down in 12 steps: st monotone increasing, max per-step jump <= 2500px,
 *      traverses >= 5000px total (sequential zone crossing, no teleport)
 *  SB2. thumb drag back up: st decreases, no error
 *  E.  console error/warning == 0
 */
import { openPage, sleep, note, pass, fail, scrollTop, SHOTS } from './lib.mjs';

const VH = 900;
const { browser, page, consoleMsgs } = await openPage({ path: '/' });
await sleep(3000);
await page.mouse.move(720, 450);
await page.evaluate(() => document.querySelector('[data-cineview-container="true"]').focus());

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
const z1End = z1.top + z1.h - VH;
note(`## S4 keyboard + scrollbar ${new Date().toISOString()}`);

// K1 ArrowDown
const arrowSts = [await scrollTop(page)];
let maxJump = 0;
for (let i = 0; i < 26; i++) {
  await page.keyboard.press('ArrowDown');
  await sleep(90);
  const st = await scrollTop(page);
  maxJump = Math.max(maxJump, st - arrowSts.at(-1));
  arrowSts.push(st);
}
const stK1 = arrowSts.at(-1);
note(`K1 arrowdown: 0 -> ${stK1} maxJump=${maxJump}`);
stK1 >= z1.top && maxJump <= 300
  ? pass('K1 ArrowDown gradual', `st=${stK1} maxJump=${maxJump}`)
  : fail('K1 ArrowDown gradual', `st=${stK1} maxJump=${maxJump}`);

// creep to zone1 p~0.5 via ArrowDown spam is slow; use wheel (already validated) to position
const target = z1.top + 0.5 * (z1.h - VH);
for (let i = 0; i < 120; i++) {
  const st = await scrollTop(page);
  if (st >= target - 60) break;
  await page.mouse.wheel(0, Math.min(160, Math.max(40, target - st)));
  await sleep(60);
}
await sleep(250);
const prePD = await scrollTop(page);
await page.keyboard.press('PageDown');
await sleep(500);
const postPD = await scrollTop(page);
note(`K2 PageDown: ${prePD} -> ${postPD}`);
postPD > prePD && postPD - prePD <= 0.86 * VH + 60 && postPD <= z1End + 200
  ? pass('K2 PageDown in-segment', `delta=${postPD - prePD} <= ${0.86 * VH + 60}`)
  : fail('K2 PageDown in-segment', `delta=${postPD - prePD} post=${postPD} (z1End=${z1End})`);

// K3 End
const preEnd = await scrollTop(page);
await page.keyboard.press('End');
await sleep(600);
const postEnd = await scrollTop(page);
note(`K3 End: ${preEnd} -> ${postEnd}`);
postEnd <= z1End + 200
  ? pass('K3 End clamped to segment', `post=${postEnd} <= ${z1End + 200}`)
  : fail('K3 End clamped to segment', `post=${postEnd} > ${z1End + 200} — whole-doc jump`);

let endProgress = false;
for (let i = 0; i < 6; i++) {
  await page.keyboard.press('End');
  await sleep(450);
  if ((await scrollTop(page)) > z1End + 400) { endProgress = true; break; }
}
endProgress ? pass('K3b End repeated progresses', `st=${await scrollTop(page)}`) : fail('K3b End repeated progresses', `st stuck at ${await scrollTop(page)}`);

// reposition to zone2 mid via wheel
const t2 = z2.top + 0.5 * (z2.h - VH);
for (let i = 0; i < 200; i++) {
  const st = await scrollTop(page);
  if (st >= t2 - 60) break;
  await page.mouse.wheel(0, Math.min(160, Math.max(40, t2 - st)));
  await sleep(55);
}
await sleep(250);
const preHome = await scrollTop(page);
await page.keyboard.press('Home');
await sleep(600);
const postHome = await scrollTop(page);
note(`K4 Home: ${preHome} -> ${postHome} (z1End=${z1End}, z2.top=${z2.top})`);
postHome >= z1End && postHome <= z2.top + 300
  ? pass('K4 Home clamped to zone2 start', `post=${postHome}`)
  : fail('K4 Home clamped to zone2 start', `post=${postHome} outside [${z1End}, ${z2.top + 300}]`);

// ---- scrollbar ----
await page.evaluate(() => document.querySelector('[data-cineview-container="true"]').scrollTop = 0);
await sleep(400);
const thumbBox = await page.evaluate(() => {
  const el = document.querySelector('[data-cineview-scrollbar-thumb="true"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
});
const railH = await page.evaluate(() => {
  const el = document.querySelector('[data-cineview-scrollbar-rail="true"]');
  return el ? el.getBoundingClientRect().height : null;
});
note(`thumb=${JSON.stringify(thumbBox)} railH=${railH}`);
if (thumbBox) {
  const st0 = await scrollTop(page);
  await page.mouse.move(thumbBox.x, thumbBox.y);
  await page.mouse.down();
  const dragSts = [st0];
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(thumbBox.x, thumbBox.y + (railH * 0.55 * i) / 12, { steps: 2 });
    await sleep(120);
    dragSts.push(await scrollTop(page));
  }
  await page.mouse.up();
  await sleep(500);
  const stEnd = await scrollTop(page);
  let mono = true;
  let maxSb = 0;
  for (let i = 1; i < dragSts.length; i++) {
    if (dragSts[i] < dragSts[i - 1] - 5) mono = false;
    maxSb = Math.max(maxSb, dragSts[i] - dragSts[i - 1]);
  }
  note(`SB1 dragSts=${JSON.stringify(dragSts.map((v) => Math.round(v)))}`);
  mono && maxSb <= 2500 && stEnd - st0 >= 5000
    ? pass('SB1 thumb drag sequential', `mono=${mono} maxStep=${maxSb} traverse=${stEnd - st0}`)
    : fail('SB1 thumb drag sequential', `mono=${mono} maxStep=${maxSb} traverse=${stEnd - st0}`);
  await page.screenshot({ path: `${SHOTS}/s4-after-scrollbar-drag.png` });

  // SB2 reverse drag
  const r0 = await scrollTop(page);
  await page.mouse.move(thumbBox.x, thumbBox.y + railH * 0.55);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(thumbBox.x, thumbBox.y + (railH * 0.55 * (10 - i)) / 10, { steps: 2 });
    await sleep(120);
  }
  await page.mouse.up();
  await sleep(500);
  const r1 = await scrollTop(page);
  note(`SB2 reverse drag: ${r0} -> ${r1}`);
  r1 < r0 && r1 >= 0
    ? pass('SB2 thumb drag reverse', `${Math.round(r0)} -> ${Math.round(r1)}`)
    : fail('SB2 thumb drag reverse', `${Math.round(r0)} -> ${Math.round(r1)}`);
} else {
  fail('SB1 thumb drag sequential', 'thumb element not found');
  fail('SB2 thumb drag reverse', 'thumb element not found');
}

consoleMsgs.length === 0 ? pass('E console clean', '0 errors/warnings') : fail('E console clean', `${consoleMsgs.length}: ${consoleMsgs.slice(0, 3).map((c) => c.type + ':' + c.text.slice(0, 120)).join(' | ')}`);

await browser.close();
