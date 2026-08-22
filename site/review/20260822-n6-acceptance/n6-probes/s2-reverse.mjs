/* S2 release & reverse relock + multi-zone reverse replay.
 * Criteria (geometry-based progress, same as S1):
 *  R1. forward: zone1 completes (p1>=0.99), zone2 completes (p2>=0.99)
 *  R2. reverse from zone2: p2 monotone non-increasing down to <=0.02 while pinned (relock at 0)
 *  R3. continuing reverse: zone1 re-pins and p1 walks 1->0 monotone to <=0.02 (full reverse replay)
 *  R4. same-curve recovery: tracked zone1 lane opacity forward vs reverse at matched p buckets, max |diff| <= 0.3
 *  R5. visual reverse completes: final reverse opacity within 0.15 of initial forward value
 *  E.  console error/warning == 0
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
    return { idx: Number(w.getAttribute('data-scene-index')), top: Math.round(r.top + st), h: Math.round(r.height) };
  });
});
const z1 = geo.find((g) => g.idx === 1);
const z2 = geo.find((g) => g.idx === 2);
const pOf = (g, st) => Math.min(1, Math.max(0, (st - g.top) / (g.h - VH)));

note(`## S2 release + reverse relock ${new Date().toISOString()}`);

// ---- forward through zone1 (record lanes vs p1) then zone2 to completion ----
const fwd1 = []; // {p, lanes}
let p2max = 0;
for (let i = 0; i < 500; i++) {
  await page.mouse.wheel(0, 150);
  await sleep(60);
  const st = await scrollTop(page);
  const p1 = pOf(z1, st);
  if (p1 > 0 && p1 < 1) fwd1.push({ p: p1, lanes: await readLanes(page) });
  p2max = Math.max(p2max, pOf(z2, st));
  if (p2max >= 0.995 && pOf(z2, st) >= 0.99) break;
  if (st > z2.top + z2.h) break;
}
await page.screenshot({ path: `${SHOTS}/s2-zone2-full.png` });

// ---- reverse: small steps back through zone2 then zone1 to top ----
const rev2 = [];
const rev1 = [];
for (let i = 0; i < 600; i++) {
  await page.mouse.wheel(0, -120);
  await sleep(60);
  const st = await scrollTop(page);
  const p1 = pOf(z1, st);
  const p2 = pOf(z2, st);
  if (p2 > 0 && p2 <= 1 && st >= z2.top - 2 && st <= z2.top + z2.h) rev2.push({ p: p2, lanes: await readLanes(page) });
  else if (st < z2.top && p1 > 0) rev1.push({ p: p1, lanes: await readLanes(page) });
  if (st <= 2) break;
}
await page.screenshot({ path: `${SHOTS}/s2-reversed-top.png` });

const p2s = rev2.map((s) => s.p);
const p1s = rev1.map((s) => s.p);
note(`p2max=${p2max.toFixed(3)} rev2 n=${p2s.length} [${p2s[0]?.toFixed(3)}..${p2s.at(-1)?.toFixed(3)}] rev1 n=${p1s.length} [${p1s[0]?.toFixed(3)}..${p1s.at(-1)?.toFixed(3)}]`);

p2max >= 0.99 ? pass('R1 zones complete forward', `p2max=${p2max.toFixed(3)}`) : fail('R1 zones complete forward', `p2max=${p2max.toFixed(3)}`);

let mono2 = true;
for (let i = 1; i < p2s.length; i++) if (p2s[i] > p2s[i - 1] + 0.03) mono2 = false;
p2s.length >= 8 && mono2 && Math.min(...p2s) <= 0.02
  ? pass('R2 reverse relock zone2', `n=${p2s.length} monotone=${mono2} min=${Math.min(...p2s).toFixed(3)}`)
  : fail('R2 reverse relock zone2', `n=${p2s.length} monotone=${mono2} min=${p2s.length ? Math.min(...p2s).toFixed(3) : '-'}`);

let mono1 = true;
for (let i = 1; i < p1s.length; i++) if (p1s[i] > p1s[i - 1] + 0.03) mono1 = false;
p1s.length >= 8 && mono1 && Math.min(...p1s) <= 0.02
  ? pass('R3 multi-zone reverse replay zone1', `n=${p1s.length} monotone=${mono1} min=${Math.min(...p1s).toFixed(3)}`)
  : fail('R3 multi-zone reverse replay zone1', `n=${p1s.length} monotone=${mono1} min=${p1s.length ? Math.min(...p1s).toFixed(3) : '-'}`);

// R4 same-curve: pick lane with max fwd opacity range among lanes present both ways
const laneIds = new Set([...fwd1, ...rev1].flatMap((s) => Object.keys(s.lanes)));
let best = null;
for (const id of laneIds) {
  const f = fwd1.map((s) => s.lanes[id]?.op).filter((v) => v != null);
  const r = rev1.map((s) => s.lanes[id]?.op).filter((v) => v != null);
  if (f.length < 10 || r.length < 10) continue;
  const rng = Math.max(...f) - Math.min(...f);
  if (!best || rng > best.rng) best = { id, rng, f: fwd1.map((s) => ({ p: s.p, op: s.lanes[id]?.op })).filter((x) => x.op != null), r: rev1.map((s) => ({ p: s.p, op: s.lanes[id]?.op })).filter((x) => x.op != null) };
}
if (best) {
  const bucket = (arr) => {
    const m = new Map();
    for (const { p, op } of arr) {
      const b = Math.min(9, Math.floor(p * 10));
      if (!m.has(b)) m.set(b, []);
      m.get(b).push(op);
    }
    return new Map([...m].map(([b, v]) => [b, v.reduce((a, x) => a + x, 0) / v.length]));
  };
  const fb = bucket(best.f);
  const rb = bucket(best.r);
  let maxDiff = 0;
  let diffs = [];
  for (const b of fb.keys()) if (rb.has(b)) { const d = Math.abs(fb.get(b) - rb.get(b)); diffs.push(`b${b}:${d.toFixed(2)}`); maxDiff = Math.max(maxDiff, d); }
  maxDiff <= 0.3 ? pass('R4 same-curve recovery', `lane=${best.id} buckets=${diffs.join(',')}`) : fail('R4 same-curve recovery', `lane=${best.id} maxDiff=${maxDiff.toFixed(2)} buckets=${diffs.join(',')}`);
  const firstFwd = best.f[0].op, lastRev = best.r.at(-1).op;
  Math.abs(firstFwd - lastRev) <= 0.15 ? pass('R5 visual reverse completes', `fwdStart=${firstFwd.toFixed(2)} revEnd=${lastRev.toFixed(2)}`) : fail('R5 visual reverse completes', `fwdStart=${firstFwd.toFixed(2)} revEnd=${lastRev.toFixed(2)}`);
} else {
  fail('R4 same-curve recovery', 'no lane with >=10 samples both directions');
  fail('R5 visual reverse completes', 'no lane');
}

consoleMsgs.length === 0 ? pass('E console clean', '0 errors/warnings') : fail('E console clean', `${consoleMsgs.length}: ${consoleMsgs.slice(0, 3).map((c) => c.type + ':' + c.text.slice(0, 120)).join(' | ')}`);

await browser.close();
