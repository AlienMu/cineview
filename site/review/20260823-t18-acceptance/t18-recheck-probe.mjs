// T1.8 复审探针 — A 链序严格判据（纯链 title→subline→video）+ B 手动控制真指针循环 + C console 卫生。
// 判据口径沿用 /tmp/t18-acceptance-notes.md；基于 /tmp/t18-demo-probe.mjs 改造。
import { chromium } from '/Users/alienmu/Documents/alien/cineView/cineview/site/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:4025';
const SHOTS = '/tmp/t18-shots';
const STEP = 90;
const SETTLE = 110;

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

const sample = () =>
  page.evaluate(() => {
    const root = document.querySelector('.demo-stage [data-cineview-container]');
    const readout = document.querySelector('.demo-zone-readout__label');
    const g = (sel) => document.querySelector(sel);
    const title = g('[data-cineview-animate-id="demo-scroll-title"]');
    const subline = g('[data-cineview-animate-id="demo-scroll-subline"]');
    const card = g('[data-cineview-animate-id="demo-manual-card"]');
    const video = g('.demo-stage video');
    return {
      scrollTop: root ? Math.round(root.scrollTop) : -1,
      pct: readout ? readout.textContent.trim() : null,
      titleOp: title ? +getComputedStyle(title).opacity : null,
      subOp: subline ? +getComputedStyle(subline).opacity : null,
      cardOp: card ? +getComputedStyle(card).opacity : null,
      videoT: video ? +video.currentTime.toFixed(2) : null,
    };
  });

const box = await page.$eval('.demo-stage', (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.move(box.x, box.y);

// ── A: 小步 wheel 穿段，全程采样 ─────────────────────────────────────────
const trace = [];
await page.waitForTimeout(300);
trace.push(await sample());
let prevScroll = -1;
for (let i = 0; i < 200; i++) {
  await page.mouse.wheel(0, STEP);
  await page.waitForTimeout(SETTLE);
  const s = await sample();
  trace.push(s);
  if (i > 6 && s.scrollTop === prevScroll && s.pct === '100%') break;
  prevScroll = s.scrollTop;
}

// sanity：读数单调 0→100（原 PASS 项，作对照保留）
const pcts = trace.map((s) => (s.pct == null ? null : parseInt(s.pct, 10)));
let regressions = 0;
for (let i = 1; i < pcts.length; i++) {
  if (pcts[i] != null && pcts[i - 1] != null && pcts[i] < pcts[i - 1] - 2) regressions++;
}
note('[sanity] zone readout 0→100% monotonic', pcts.includes(100) && pcts.filter((p) => p != null)[0] <= 5 && regressions === 0,
  `max=${Math.max(...pcts.filter((p) => p != null))} regressions=${regressions} samples=${pcts.length}`);

// A 判据 1：title 完成（op≥0.95）前 subline 恒 0（全程无重叠）
const subWhileTitleIncomplete = trace.filter((s) => s.titleOp != null && s.titleOp < 0.95 && s.subOp != null);
const maxSubBeforeTitleDone = subWhileTitleIncomplete.length ? Math.max(...subWhileTitleIncomplete.map((s) => s.subOp)) : -1;
const firstMoveIdx = (key, threshold) => trace.findIndex((s) => s[key] != null && s[key] > threshold);
const completeIdx = (key, threshold) => trace.findIndex((s) => s[key] != null && s[key] >= threshold);
const titleFirst = firstMoveIdx('titleOp', 0.05);
const titleDone = completeIdx('titleOp', 0.95);
const subFirst = firstMoveIdx('subOp', 0.05);
const subDone = completeIdx('subOp', 0.95);
note('A1 STRICT: subline op==0 until title op>=0.95 (no window overlap)', maxSubBeforeTitleDone >= 0 && maxSubBeforeTitleDone < 0.02 && subFirst >= titleDone,
  `titleFirst=step${titleFirst} titleDone=step${titleDone}(op=${titleDone >= 0 ? trace[titleDone].titleOp.toFixed(2) : '-'}) subFirst=step${subFirst}(op=${subFirst >= 0 ? trace[subFirst].subOp.toFixed(2) : '-'}) maxSubBeforeTitleDone=${maxSubBeforeTitleDone.toFixed(3)} over ${subWhileTitleIncomplete.length} samples`);

// A 判据 2：subline 完成（op≥0.95）前 video 不 scrub
const videoWhileSubIncomplete = trace.filter((s) => s.subOp != null && s.subOp < 0.95 && s.videoT != null);
const maxVideoBeforeSubDone = videoWhileSubIncomplete.length ? Math.max(...videoWhileSubIncomplete.map((s) => s.videoT)) : -1;
const videoFirstScrub = trace.findIndex((s) => s.videoT != null && s.videoT > 0.05);
note('A2 STRICT: video no scrub until subline op>=0.95', maxVideoBeforeSubDone >= 0 && maxVideoBeforeSubDone <= 0.05 && videoFirstScrub >= subDone,
  `subDone=step${subDone}(op=${subDone >= 0 ? trace[subDone].subOp.toFixed(2) : '-'}) videoFirstScrub=step${videoFirstScrub} maxVideoBeforeSubDone=${maxVideoBeforeSubDone.toFixed(2)}s`);

// A 判据 3（链完整收尾）：title 与 subline 都到 1、video 完成擦洗
const final = trace[trace.length - 1];
note('A3 chain completes: title/subline full, video scrubbed', final.titleOp > 0.98 && final.subOp > 0.98 && final.videoT > 5,
  `title=${final.titleOp} sub=${final.subOp} video=${final.videoT}s pct=${final.pct}`);

// ── B: 手动控制（真指针循环）────────────────────────────────────────────
// B0：点击前卡片全程停 initial（op=0）
const cardSamples = trace.map((s) => s.cardOp).filter((o) => o != null);
note('B0 card held at initial (op=0) before any click', cardSamples.length > 10 && Math.max(...cardSamples) < 0.05,
  `samples=${cardSamples.length} maxBeforeClick=${Math.max(...cardSamples).toFixed(3)}`);

const enterBtn = page.locator('.demo-manual__buttons button').first();
const exitBtn = page.locator('.demo-manual__buttons button').nth(1);

// 确保按钮在 stage 视口内可见可点（不可见则微调滚动）
async function ensureButtonsVisible() {
  for (let i = 0; i < 40; i++) {
    const bb = await enterBtn.boundingBox();
    const stage = await page.$eval('.demo-stage', (el) => el.getBoundingClientRect());
    if (bb && bb.y > stage.y && bb.y + bb.height < stage.y + stage.height) return true;
    await page.mouse.wheel(0, 90);
    await page.waitForTimeout(110);
  }
  return false;
}
await ensureButtonsVisible();
await page.screenshot({ path: `${SHOTS}/recheck-manual-before-enter.png` });

// B1：真指针点击入场（playwright click 自带 hit-testing；超时即 FAIL，无 JS 兜底）
let b1PointerOk = true;
try {
  await enterBtn.click({ timeout: 5000 });
} catch (e) {
  b1PointerOk = false;
}
await page.waitForTimeout(900); // enter 640ms + settle
const afterEnter = await sample();
await page.screenshot({ path: `${SHOTS}/recheck-manual-after-enter.png` });
note('B1 real-pointer click enter button works (hit-test) + card enters', b1PointerOk && afterEnter.cardOp > 0.9,
  `pointerClickOk=${b1PointerOk} cardOp=${afterEnter.cardOp}`);

// B2：真指针点击退场 → fade-out 到 0
let b2PointerOk = true;
try {
  await exitBtn.click({ timeout: 5000 });
} catch (e) {
  b2PointerOk = false;
}
await page.waitForTimeout(800); // exit 400ms + settle
const afterExit = await sample();
await page.screenshot({ path: `${SHOTS}/recheck-manual-after-exit.png` });
note('B2 real-pointer click exit button → card fade-out to 0', b2PointerOk && afterExit.cardOp < 0.05,
  `pointerClickOk=${b2PointerOk} cardOp=${afterExit.cardOp}`);

// B3：再点入场 → 再次入场（可循环）
let b3PointerOk = true;
try {
  await enterBtn.click({ timeout: 5000 });
} catch (e) {
  b3PointerOk = false;
}
await page.waitForTimeout(900);
const afterReenter = await sample();
await page.screenshot({ path: `${SHOTS}/recheck-manual-after-reenter.png` });
note('B3 re-click enter → card re-enters (cycle enter/exit/enter)', b3PointerOk && afterReenter.cardOp > 0.9,
  `pointerClickOk=${b3PointerOk} cardOp=${afterReenter.cardOp}`);

// ── C: console 卫生（全程，含模式切换/穿段/点击）────────────────────────
note('C console errors/warnings = 0 (whole session incl [CineView])', consoleIssues.length === 0,
  consoleIssues.length === 0 ? 'clean' : `issues=${consoleIssues.length} first=${consoleIssues.slice(0, 3).join(' | ')}`);

const fs = await import('node:fs');
fs.writeFileSync('/tmp/t18-recheck-trace.json', JSON.stringify(trace, null, 1));

await browser.close();
const judged = results.filter((r) => r.pass !== null);
console.log('\nSUMMARY recheck-probe: ' + (judged.every((r) => r.pass) ? 'ALL PASS' : 'HAS FAILURES'));
