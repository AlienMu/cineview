// T1.8 Part B.3 — Demo Hub scroll-mode probe.
// Zone readout monotonicity, waitFor 3-level chain, video frame scrub + reverse,
// enterRef manual slot, console hygiene.
import { chromium } from '/Users/alienmu/Documents/alien/cineView/cineview/site/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:4024';
const SHOTS = '/tmp/t18-shots';
const STEP = 90; // px per wheel notch — small steps so no-skip clamps never trigger
const SETTLE = 110; // ms settle per step

const results = [];
const note = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name} | ${detail}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const consoleIssues = [];
page.on('pageerror', (e) => consoleIssues.push('pageerror: ' + String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleIssues.push(`${m.type()}: ${m.text()}`);
});

await page.goto(`${BASE}/demo`, { waitUntil: 'load' });
await page.waitForSelector('.demo-switcher', { timeout: 15000 });
await page.waitForTimeout(600);

// switch to scroll mode
await page.click('.demo-switcher button[role="tab"]:nth-child(2)');
await page.waitForSelector('.demo-stage [data-cineview-container]', { timeout: 15000 });
await page.waitForTimeout(800);

// instrument rVFC on the video
await page.evaluate(() => {
  window.__vfc = { mediaTime: -1, count: 0 };
  const v = document.querySelector('.demo-stage video');
  if (v && 'requestVideoFrameCallback' in v) {
    const cb = (_now, meta) => {
      window.__vfc.mediaTime = meta.mediaTime;
      window.__vfc.count += 1;
      v.requestVideoFrameCallback(cb);
    };
    v.requestVideoFrameCallback(cb);
  }
});

const sample = () =>
  page.evaluate(() => {
    const root = document.querySelector('.demo-stage [data-cineview-container]');
    const readout = document.querySelector('.demo-zone-readout__label');
    const g = (sel) => document.querySelector(sel);
    const title = g('[data-cineview-animate-id="demo-scroll-title"]');
    const subline = g('[data-cineview-animate-id="demo-scroll-subline"]');
    const card = g('[data-cineview-animate-id="demo-manual-card"]');
    const video = g('.demo-stage video');
    const num = (tf) => {
      const m = /matrix\(.*?\)/.exec(tf || '');
      return m ? m[0] : tf;
    };
    return {
      scrollTop: root ? Math.round(root.scrollTop) : -1,
      pct: readout ? readout.textContent.trim() : null,
      titleOp: title ? +getComputedStyle(title).opacity : null,
      subOp: subline ? +getComputedStyle(subline).opacity : null,
      subTf: subline ? num(getComputedStyle(subline).transform) : null,
      cardOp: card ? +getComputedStyle(card).opacity : null,
      videoT: video ? +video.currentTime.toFixed(2) : null,
      vfcT: window.__vfc ? +window.__vfc.mediaTime.toFixed(3) : null,
      vfcN: window.__vfc ? window.__vfc.count : 0,
    };
  });

// stage center for wheel target
const box = await page.$eval('.demo-stage', (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.move(box.x, box.y);

// ── Phase 1: forward pass through the whole zone, small steps ────────────
const trace = [];
await page.waitForTimeout(300);
trace.push(await sample());
let prevScroll = -1;
for (let i = 0; i < 200; i++) {
  await page.mouse.wheel(0, STEP);
  await page.waitForTimeout(SETTLE);
  const s = await sample();
  trace.push(s);
  if (i > 6 && s.scrollTop === prevScroll && s.pct === '100%') break; // reached the end and settled
  prevScroll = s.scrollTop;
}
const final = trace[trace.length - 1];

// 1) zone readout monotonic 0→100
const pcts = trace.map((s) => (s.pct == null ? null : parseInt(s.pct, 10)));
const maxSeen = Math.max(...pcts.filter((p) => p != null));
const reached100 = pcts.includes(100);
const reachedLowStart = pcts.filter((p) => p != null)[0] <= 5;
// monotonic check on the forward pass: allow plateaus, no significant regressions
let regressions = 0;
for (let i = 1; i < pcts.length; i++) {
  if (pcts[i] != null && pcts[i - 1] != null && pcts[i] < pcts[i - 1] - 2) regressions++;
}
note('zone readout 0→100% monotonic', reached100 && reachedLowStart && regressions === 0,
  `max=${maxSeen} start=${pcts.filter((p) => p != null)[0]} regressions=${regressions} samples=${pcts.length}`);

// 2) waitFor chain: title vs subline
// title window: [360,2160]px of budget; subline window [600,1200]px; video [1200,7200]px
// budget = 7200px; zone scroll span maps 1:1 onto px after the zone locks.
// Determine chain empirically from opacity traces:
const firstMoveIdx = (key, threshold) => trace.findIndex((s) => s[key] != null && s[key] > threshold);
const completeIdx = (key, threshold) => trace.findIndex((s) => s[key] != null && s[key] >= threshold);
const titleFirst = firstMoveIdx('titleOp', 0.05);
const titleDone = completeIdx('titleOp', 0.95);
const subFirst = firstMoveIdx('subOp', 0.05);
const subDone = completeIdx('subOp', 0.95);
const videoFirstScrub = trace.findIndex((s) => s.videoT != null && s.videoT > 0.05);
const videoLastScrub = [...trace].reverse().find((s) => s.videoT != null && s.videoT > 0.05);

const subStartsAfterTitleMoves = titleFirst >= 0 && subFirst > titleFirst;
// strict teaching claim: subline does not move before title COMPLETES
const subAfterTitleComplete = titleDone >= 0 && subFirst >= titleDone;
const videoAfterSubComplete = subDone >= 0 && videoFirstScrub >= subDone;
note('chain: subline starts after title starts', subStartsAfterTitleMoves,
  `titleFirstMove=step${titleFirst} subFirstMove=step${subFirst}`);
note('chain STRICT: subline idle until title completes', subAfterTitleComplete,
  `titleDone(≥0.95)=step${titleDone} op@done=${titleDone >= 0 ? trace[titleDone].titleOp.toFixed(2) : '-'} subFirstMove=step${subFirst} op=${subFirst >= 0 ? trace[subFirst].subOp.toFixed(2) : '-'} (overlap window 600–1200px of 7200px budget per sceneScrollBudget math)`);
note('chain: video scrubs only after subline completes', videoAfterSubComplete,
  `subDone=step${subDone} videoFirstScrub=step${videoFirstScrub}`);

// 3) video scrub forward: currentTime advanced monotonically with frames presented
const vfcGrew = final.vfcN > 0 && final.vfcT > 0.5;
const videoAdvanced = final.videoT > 5; // 6000ms enter scrub → near end of a multi-second clip
note('AnimateVideo forward scrub (rVFC frames presented)', vfcGrew && videoAdvanced,
  `rVFC count=${final.vfcN} mediaTime=${final.vfcT}s currentTime=${final.videoT}s`);

// ── Phase 2: enterRef manual slot (checked mid-trace: card held at initial) ─
const cardInitialSamples = trace.filter((s) => s.cardOp != null).map((s) => s.cardOp);
const cardHeldBeforeClick = cardInitialSamples.every((o) => o < 0.05);
note('manual card held at initial (opacity 0) before click', cardHeldBeforeClick && cardInitialSamples.length > 10,
  `samples=${cardInitialSamples.length} maxOpacityBeforeClick=${Math.max(...cardInitialSamples).toFixed(3)}`);

// click the manual enter button
await page.screenshot({ path: `${SHOTS}/demo-zone-before-enterref.png` });
const btn = page.locator('.demo-manual button');
// NOTE: real pointer click is intercepted — the card's slide-up INITIAL transform
// (translateY offset, opacity 0) overlays the button and catches hit-testing.
// Recorded as a demo UX finding; probe proceeds with a JS click (same React handler).
let pointerIntercepted = false;
try {
  await btn.click({ timeout: 2500 });
} catch (e) {
  pointerIntercepted = true;
  await btn.evaluate((el) => el.click());
}
results.push({ name: 'OBSERVED: real pointer click on enterRef button intercepted by invisible initial-offset card', pass: null, detail: String(pointerIntercepted) });
console.log(`OBSERVED | pointer click intercepted by initial-offset card | ${pointerIntercepted}`);
await page.waitForTimeout(900);
const afterClick = await sample();
await page.screenshot({ path: `${SHOTS}/demo-zone-after-enterref.png` });
note('enterRef click plays enter', afterClick.cardOp > 0.9, `cardOpacity=${afterClick.cardOp}`);

// ── Phase 3: scroll out of viewport (into outro) and back — replay check ──
// continue wheeling to the end (outro fully covers stage)
for (let i = 0; i < 60; i++) {
  await page.mouse.wheel(0, STEP);
  await page.waitForTimeout(SETTLE);
  const s = await sample();
  if (s.scrollTop === prevScroll) break;
  prevScroll = s.scrollTop;
}
const outState = await sample();
await page.waitForTimeout(400);
// wheel back into the zone
for (let i = 0; i < 120; i++) {
  await page.mouse.wheel(0, -STEP);
  await page.waitForTimeout(SETTLE);
  const s = await sample();
  if (i > 6 && s.pct === '100%' && s.videoT < 0.3) break;
}
await page.waitForTimeout(600);
const backState = await sample();

// video reverse: currentTime decreased from its forward peak
note('AnimateVideo reverse scrub', backState.videoT < final.videoT - 0.5,
  `peak=${final.videoT}s afterReverse=${backState.videoT}s rVFC=${backState.vfcT}s`);

// replay check: after leaving viewport and returning, card re-entered (replayOnReenter)
// The card exits when out of viewport; on re-enter the visibility gate replays enter.
const cardExitsWhenOut = outState.cardOp;
note('enterRef replay on viewport re-enter', backState.cardOp > 0.5,
  `cardOp out-of-view=${cardExitsWhenOut} cardOp back-in-view=${backState.cardOp}`);

await page.screenshot({ path: `${SHOTS}/demo-scroll-reverse.png` });

// console hygiene
const cineviewPrefixed = consoleIssues.filter((t) => t.includes('[CineView'));
note('console errors/warnings = 0 (incl [CineView] prefix)', consoleIssues.length === 0,
  consoleIssues.length === 0 ? 'clean' : `issues=${consoleIssues.length} first=${consoleIssues.slice(0, 3).join(' | ')}`);

// dump trace for the record
const fs = await import('node:fs');
fs.writeFileSync('/tmp/t18-demo-trace.json', JSON.stringify(trace, null, 1));

await browser.close();
console.log('\nSUMMARY demo-probe: ' + (results.filter((r) => r.pass !== null).every((r) => r.pass) ? 'ALL PASS' : 'HAS FAILURES'));
