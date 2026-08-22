/* S6 drag real pointer (v2, stack-translate model):
 * Drag stack translates per scene wrapper (matrix ty = wrapper top). Signals = wrapper tops.
 * Criteria:
 *  D1. partial drag held at 3 depths: scene2 top decreases monotonically, tracks finger
 *      (top <= 844 - depth + 120 slack), lane opacity scrubs (supplementary)
 *  D2. release below threshold: tops restored to {scene1:0, scene2:844} within ±4px (rebound)
 *  D3. long drag up (0.5h): commits scene2 — tops {scene1:-844, scene2:0} within ±4px
 *  D4. gradual reverse drag from scene2: scene2 top increases monotonically (exit scrub follows);
 *      release at 0.5h returns tops {scene1:0, scene2:844}
 *  E.  console error/warning == 0
 */
import { openPage, sleep, note, pass, fail, SHOTS, cdpDrag, cdpRelease } from './lib.mjs';

const { browser, page, consoleMsgs } = await openPage({ path: '/drag', viewport: { width: 390, height: 844 } });
await sleep(6500);
const cdp = await page.context().newCDPSession(page);
const box = await page.evaluate(() => {
  const r = document.querySelector('.cineview-container')?.getBoundingClientRect();
  return r ? { x: r.x + r.width / 2, y: r.y, h: r.height } : null;
});
const cx = box.x;
const H = box.h;

const tops = () =>
  page.evaluate(() => {
    const t = {};
    for (let n = 1; n <= 5; n++) {
      const w = document.querySelector(`.tp-scene--0${n}`);
      if (w) t[n] = Math.round(w.getBoundingClientRect().top);
    }
    return t;
  });
const lanes = () =>
  page.evaluate(() => {
    const o = {};
    [...document.querySelectorAll('.tp-scene [data-cineview-animate-id]')].forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      o[el.getAttribute('data-cineview-animate-id')] = Number(getComputedStyle(el).opacity);
    });
    return o;
  });

note(`## S6 drag real pointer v2 ${new Date().toISOString()}`);
note(`initial tops=${JSON.stringify(await tops())}`);

// ---- D1/D2 partial drag with held depths ----
const yStart = box.y + H * 0.75;
await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: yStart, button: 'left', clickCount: 1, pointerType: 'mouse' });
const held = [];
for (const frac of [0.08, 0.14, 0.2]) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: Math.round(yStart - H * frac), button: 'left', buttons: 1, pointerType: 'mouse' });
  await sleep(150);
  held.push({ frac, tops: await tops(), lanes: await lanes() });
}
await cdpRelease(cdp, cx, yStart - H * 0.2);
await sleep(1600);
const reboundTops = await tops();
await page.screenshot({ path: `${SHOTS}/s6-after-rebound.png` });

const s2t = held.map((h) => h.tops[2]);
const depths = held.map((h) => h.frac * H);
const trackOk = s2t.every((v) => v != null) && s2t[0] > s2t[1] && s2t[1] > s2t[2] && s2t[2] <= H - depths[2] + 120 && s2t[0] >= H - depths[0] - 120;
const laneIds = Object.keys(held[0].lanes);
let scrubLane = null;
for (const id of laneIds) {
  const v = held.map((h) => h.lanes[id]);
  if (v.some((x) => x == null)) continue;
  const rng = Math.max(...v) - Math.min(...v);
  if (!scrubLane || rng > scrubLane.rng) scrubLane = { id, rng, v };
}
note(`D1 held: s2tops=[${s2t}] depths=[${depths.map((d) => Math.round(d))}] lane=${scrubLane?.id}=[${scrubLane?.v?.map((v) => v.toFixed(2))}]`);
trackOk
  ? pass('D1 stack tracks finger (held)', `s2tops=[${s2t}] vs full-follow=[${depths.map((d) => Math.round(H - d)).join(',')}]`)
  : fail('D1 stack tracks finger (held)', `s2tops=[${s2t}] depths=[${depths.map((d) => Math.round(d))}]`);
scrubLane && scrubLane.rng >= 0.05
  ? pass('D1b lane scrub during drag', `lane=${scrubLane?.id} op=[${scrubLane?.v?.map((v) => v.toFixed(2))}]`)
  : fail('D1b lane scrub during drag', `lane=${scrubLane?.id} rng=${scrubLane?.rng?.toFixed(2)}`);

const reboundOk = Math.abs((reboundTops[1] ?? 999)) <= 4 && Math.abs((reboundTops[2] ?? -999) - H) <= 4;
reboundOk
  ? pass('D2 rebound restores scene1', `tops=${JSON.stringify(reboundTops)}`)
  : fail('D2 rebound restores scene1', `tops=${JSON.stringify(reboundTops)}`);

// ---- D3 long drag commits ----
await cdpDrag(cdp)(cx, box.y + H * 0.75, -H * 0.5, { steps: 16, hold: 16 });
await cdpRelease(cdp, cx, box.y + H * 0.25);
await sleep(2200);
const commitTops = await tops();
await page.screenshot({ path: `${SHOTS}/s6-committed-scene2.png` });
await sleep(6500);
const commitSettled = await tops();
await page.screenshot({ path: `${SHOTS}/s6-committed-scene2-settled.png` });
const commitOk = Math.abs((commitTops[2] ?? -999)) <= 4 && Math.abs((commitTops[1] ?? 999) + H) <= 4 && Math.abs((commitSettled[2] ?? -999)) <= 4;
commitOk
  ? pass('D3 long drag commits scene2', `tops=${JSON.stringify(commitTops)} settled=${JSON.stringify(commitSettled)}`)
  : fail('D3 long drag commits scene2', `tops=${JSON.stringify(commitTops)} settled=${JSON.stringify(commitSettled)}`);

// ---- D4 gradual reverse drag ----
const yS = box.y + H * 0.3;
await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: yS, button: 'left', clickCount: 1, pointerType: 'mouse' });
const heldRev = [];
for (const f of [0.08, 0.16, 0.24, 0.32, 0.4, 0.48]) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: Math.round(yS + H * f), button: 'left', buttons: 1, pointerType: 'mouse' });
  await sleep(130);
  heldRev.push({ f, tops: await tops(), lanes: await lanes() });
}
await cdpRelease(cdp, cx, yS + H * 0.5);
await sleep(2200);
const backTops = await tops();
await page.screenshot({ path: `${SHOTS}/s6-reversed-scene1.png` });

const s2r = heldRev.map((h) => h.tops[2]);
const revMono = s2r.every((v) => v != null) && s2r[0] < s2r.at(-1) && s2r.every((v, i) => i === 0 || v >= s2r[i - 1] - 2);
const revLaneIds = Object.keys(heldRev[0].lanes);
let revLane = null;
for (const id of revLaneIds) {
  const v = heldRev.map((h) => h.lanes[id]);
  if (v.some((x) => x == null)) continue;
  const rng = Math.max(...v) - Math.min(...v);
  if (!revLane || rng > revLane.rng) revLane = { id, rng, v };
}
note(`D4 reverse held: s2tops=[${s2r}] lane=${revLane?.id}=[${revLane?.v?.map((v) => v.toFixed(2))}] final=${JSON.stringify(backTops)}`);
revMono
  ? pass('D4 reverse exit scrub follows finger', `scene2 tops=[${s2r}]`)
  : fail('D4 reverse exit scrub follows finger', `scene2 tops=[${s2r}]`);
revLane && revLane.rng >= 0.05
  ? pass('D4b reverse lane scrub', `lane=${revLane?.id} op=[${revLane?.v?.map((v) => v.toFixed(2))}]`)
  : fail('D4b reverse lane scrub', `lane=${revLane?.id} rng=${revLane?.rng?.toFixed(2)}`);
const backOk = Math.abs(backTops[1] ?? 999) <= 4 && Math.abs((backTops[2] ?? -999) - H) <= 4;
backOk
  ? pass('D4c reverse commit returns scene1', `tops=${JSON.stringify(backTops)}`)
  : fail('D4c reverse commit returns scene1', `tops=${JSON.stringify(backTops)}`);

consoleMsgs.length === 0 ? pass('E console clean', '0 errors/warnings') : fail('E console clean', `${consoleMsgs.length}: ${consoleMsgs.slice(0, 3).map((c) => c.type + ':' + c.text.slice(0, 120)).join(' | ')}`);

await browser.close();
