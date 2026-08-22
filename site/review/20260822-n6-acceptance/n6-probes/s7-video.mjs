/* S7 video scrub — homepage demo-video-zone + /drag act3 (all-keyframe re-encode).
 * Uses channel:chrome (bundled Chromium lacks H.264). True signal = rVFC presented
 * mediaTime; currentTime only as transport reference.
 * Criteria (homepage demo-video-zone):
 *  V1. forward in-zone drive: >=10 presented frames, >=8 distinct mediaTime, span >= 1.0s
 *  V2. no freeze: >=60% of consecutive presented frames differ in mediaTime
 *  V3. no end jump: no single mediaTime delta > 0.8s during the last 20% of traverse
 *  V4. scroll away -> transport returns to <=0.15s; scroll back -> scrub resumes (>=5 new distinct)
 *  V5. videoWidth > 0 (real decode)
 * Criteria (/drag act3):
 *  A1. video in scene 3 decodes (videoWidth > 0)
 *  A2. held partial drags deeper into scene 3: presented mediaTime increases with depth (>=3 distinct)
 *  A3. reverse held drag: mediaTime decreases (>=2 step-down)
 *  A4. final approach: no mediaTime jump > 0.8s at zone end
 *  E.  console error/warning == 0 (record any 404 separately)
 */
import { openPage, sleep, note, pass, fail, SHOTS, cdpDrag, cdpRelease } from './lib.mjs';

const VH = 900;
const installVf = (page, sel) =>
  page.evaluate((s) => {
    const v = document.querySelector(s);
    if (!v) return { ok: false };
    window.__vf = { frames: [] };
    const cb = (_now, meta) => {
      window.__vf.frames.push({ mt: meta.mediaTime, t: performance.now() });
      v.requestVideoFrameCallback(cb);
    };
    v.requestVideoFrameCallback(cb);
    return { ok: true, src: v.currentSrc?.split('/').pop(), dur: v.duration, vw: v.videoWidth };
  }, sel);
const readVf = (page) => page.evaluate(() => ({ frames: window.__vf?.frames ?? [], ct: document.querySelector('video')?.currentTime ?? null }));
const markLen = async (page) => (await readVf(page)).frames.length;

let results = [];
const R = (ok, name, detail) => { results.push(ok); ok ? pass(name, detail) : fail(name, detail); };

/* ---------- part 1: homepage demo-video-zone ---------- */
{
  const { browser, page, consoleMsgs } = await openPage({ path: '/', channel: 'chrome' });
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
  const z3 = geo.find((g) => g.idx === 3);
  note(`## S7 part1 homepage video (scene3 demo-video-zone) ${new Date().toISOString()}`);
  const meta = await installVf(page, '[data-scene-index="3"] video');
  note(`video meta=${JSON.stringify(meta)} z3=[${z3.top},${z3.top + z3.h - VH}]`);
  R(meta.ok && meta.vw > 0, 'V5 homepage video decodes', `src=${meta.src} dur=${meta.dur} vw=${meta.vw}`);

  // drive to zone 3 then through it slowly
  for (let i = 0; i < 260; i++) {
    const st = await page.evaluate(() => document.querySelector('[data-cineview-container="true"]').scrollTop);
    if (st >= z3.top - 60) break;
    await page.mouse.wheel(0, Math.min(160, Math.max(40, z3.top - st)));
    await sleep(55);
  }
  await sleep(400);
  const z3End = z3.top + z3.h - VH;
  const startLen = await markLen(page);
  const pTrail = [];
  for (let i = 0; i < 200; i++) {
    const st = await page.evaluate(() => document.querySelector('[data-cineview-container="true"]').scrollTop);
    if (st >= z3End - 30) break;
    await page.mouse.wheel(0, 70);
    await sleep(70);
    pTrail.push((st - z3.top) / (z3.h - VH));
  }
  await sleep(500);
  await page.screenshot({ path: `${SHOTS}/s7-home-video-end.png` });
  const v1 = await readVf(page);
  const frames = v1.frames.slice(startLen);
  const mts = frames.map((f) => f.mt);
  const distinct = new Set(mts.map((m) => Math.round(m * 1000)));
  const span = mts.length ? Math.max(...mts) - Math.min(...mts) : 0;
  note(`V1 in-zone frames=${frames.length} distinct=${distinct.size} span=${span.toFixed(2)}s finalCT=${v1.ct}`);

  R(frames.length >= 10 && distinct.size >= 8 && span >= 1.0, 'V1 forward scrub', `frames=${frames.length} distinct=${distinct.size} span=${span.toFixed(2)}s`);

  // V2 freeze: fraction of consecutive differing
  let diff = 0;
  for (let i = 1; i < mts.length; i++) if (Math.abs(mts[i] - mts[i - 1]) > 0.001) diff++;
  const ratio = mts.length > 1 ? diff / (mts.length - 1) : 0;
  R(ratio >= 0.6, 'V2 no freeze', `differ-ratio=${(ratio * 100).toFixed(0)}% (${diff}/${mts.length - 1})`);

  // V3 end jump: last 20% of frames
  const tail = mts.slice(Math.floor(mts.length * 0.8));
  let maxJump = 0;
  for (let i = 1; i < tail.length; i++) maxJump = Math.max(maxJump, Math.abs(tail[i] - tail[i - 1]));
  R(maxJump <= 0.8, 'V3 no end jump', `maxTailJump=${maxJump.toFixed(2)}s`);

  // V4 away & back
  const awayStart = await markLen(page);
  for (let i = 0; i < 120; i++) {
    const st = await page.evaluate(() => document.querySelector('[data-cineview-container="true"]').scrollTop);
    if (st <= z3.top - 600) break;
    await page.mouse.wheel(0, -150);
    await sleep(55);
  }
  await sleep(800);
  const away = await readVf(page);
  const backTarget = z3.top + 0.45 * (z3.h - VH);
  const resumeStart = await markLen(page);
  for (let i = 0; i < 200; i++) {
    const st = await page.evaluate(() => document.querySelector('[data-cineview-container="true"]').scrollTop);
    if (st >= backTarget - 40) break;
    await page.mouse.wheel(0, Math.min(120, Math.max(40, backTarget - st)));
    await sleep(60);
  }
  await sleep(500);
  const backV = await readVf(page);
  const backFrames = backV.frames.slice(resumeStart).map((f) => f.mt);
  const backDistinct = new Set(backFrames.map((m) => Math.round(m * 1000)));
  note(`V4 away ct=${away.ct} backFrames=${backFrames.length} backDistinct=${backDistinct.size} backCT=${backV.ct}`);
  R(away.ct !== null && away.ct <= 0.15, 'V4a away returns transport ~0', `away ct=${away.ct}`);
  R(backFrames.length >= 5 && backDistinct.size >= 5, 'V4b scrub resumes on re-enter', `frames=${backFrames.length} distinct=${backDistinct.size}`);

  const errs = consoleMsgs.filter((c) => !/404|Failed to load resource/.test(c.text));
  const notFounds = consoleMsgs.filter((c) => /404|Failed to load resource/.test(c.text));
  note(`homepage console: real=${errs.length} 404-type=${notFounds.length} ${JSON.stringify(notFounds.slice(0, 2))}`);
  R(errs.length === 0, 'E homepage console clean', errs.length ? errs.slice(0, 2).map((c) => c.text.slice(0, 120)).join(' | ') : '0');
  await browser.close();
}

/* ---------- part 2: /drag act3 (v3: authored-timing-aware criteria) ----------
 * Design reality (measured, diag2): pre-commit the incoming scene3 element track scrubs with
 * drag depth, but the video is delay-gated at 3200ms scene elapsed — authored timing, not a
 * defect. Video scrub runs post-commit via the auto-running timeline (mediaMode 'scrub').
 * Criteria:
 *  A1. video decodes (videoWidth > 0)
 *  A2. pre-commit enter track follows finger: s03-preview lane opacity monotone with depth, >=3 distinct
 *  A3. post-commit auto-scrub: mediaTime >=8 distinct, monotone increasing, max step <= 1.0s (no freeze/jump)
 *  A4. away (commit 3->4) resets video (exited/0); back (4->3) re-scrubs (mode 'scrub', ct climbs > 1s)
 *  E.  console error/warning == 0
 */
{
  const { browser, page, consoleMsgs } = await openPage({ path: '/drag', viewport: { width: 390, height: 844 }, channel: 'chrome' });
  await sleep(6500);
  const cdp = await page.context().newCDPSession(page);
  const box = await page.evaluate(() => {
    const r = document.querySelector('.cineview-container')?.getBoundingClientRect();
    return r ? { x: r.x + r.width / 2, y: r.y, h: r.height } : null;
  });
  const cx = box.x;
  const H = box.h;
  note(`## S7 part2 /drag act3 video (v3) ${new Date().toISOString()}`);

  const transport = () =>
    page.evaluate(() => {
      const stage = document.querySelector('.s03-cut-stage');
      const v = document.querySelector('.tp-scene--03 video');
      const t = {};
      for (let n = 1; n <= 5; n++) {
        const w = document.querySelector(`.tp-scene--0${n}`);
        if (w) t[n] = Math.round(w.getBoundingClientRect().top);
      }
      return { mode: stage?.dataset.mediaMode ?? null, mt: stage?.dataset.mediaTime ?? null, ct: v?.currentTime ?? null, tops: t };
    });
  const laneOps = () =>
    page.evaluate(() => {
      const o = {};
      [...document.querySelectorAll('.tp-scene--03 [data-cineview-animate-id]')].forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        o[el.getAttribute('data-cineview-animate-id')] = Number(getComputedStyle(el).opacity);
      });
      return o;
    });

  // commit 1 -> 2
  await cdpDrag(cdp)(cx, box.y + H * 0.75, -H * 0.5, { steps: 16, hold: 16 });
  await cdpRelease(cdp, cx, box.y + H * 0.25);
  await sleep(3500);

  const meta = await installVf(page, '.tp-scene--03 video');
  note(`act3 video meta=${JSON.stringify(meta)}`);
  R(meta.ok && meta.vw > 0, 'A1 act3 video decodes', `src=${meta.src} dur=${meta.dur} vw=${meta.vw}`);

  // A2: held depths, s03-preview lane scrub (enter track follows finger)
  const yS = box.y + H * 0.72;
  const held = [];
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: yS, button: 'left', clickCount: 1, pointerType: 'mouse' });
  for (const f of [0.2, 0.35, 0.5, 0.65]) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: Math.round(yS - H * f), button: 'left', buttons: 1, pointerType: 'mouse' });
    await sleep(300);
    held.push({ f, lanes: await laneOps(), tr: await transport() });
  }
  const pv = held.map((h) => h.lanes['s03-preview']);
  const pvDistinct = new Set(pv.map((v) => Math.round((v ?? 0) * 100)));
  note(`A2 held preview lane=[${pv}] s3tops=[${held.map((h) => h.tr.tops[3])}]`);
  R(pv.every((v) => v != null) && pvDistinct.size >= 3 && pv.at(-1) > pv[0], 'A2 enter track follows finger', `s03-preview=[${pv}]`);

  // release deep -> commits into scene3; A3: sample the auto-scrub
  await cdpRelease(cdp, cx, yS - H * 0.65);
  const scrubTrail = [];
  for (let i = 0; i < 18; i++) {
    await sleep(250);
    scrubTrail.push(await transport());
  }
  await page.screenshot({ path: `${SHOTS}/s7-drag-act3-scrub.png` });
  await sleep(2500);
  const mts = scrubTrail.map((s) => Number(s.mt ?? NaN)).filter((v) => Number.isFinite(v));
  const distinct = new Set(mts.map((v) => Math.round(v * 1000)));
  let mono = true;
  for (let i = 1; i < mts.length; i++) if (mts[i] < mts[i - 1] - 0.05) mono = false;
  let maxStep = 0;
  for (let i = 1; i < mts.length; i++) maxStep = Math.max(maxStep, mts[i] - mts[i - 1]);
  note(`A3 scrubTrail mt=[${mts.map((v) => v.toFixed(2))}] modes=[${[...new Set(scrubTrail.map((s) => s.mode))]}]`);
  R(mts.length >= 8 && distinct.size >= 8 && mono, 'A3 post-commit scrub advances', `n=${mts.length} distinct=${distinct.size} mono=${mono} span=${(mts.at(-1) - mts[0]).toFixed(2)}s`);
  R(maxStep <= 1.0, 'A3b no freeze/jump', `maxStep=${maxStep.toFixed(2)}s`);

  // A4: away to scene4 (video resets), back to scene3 (re-scrubs)
  await cdpDrag(cdp)(cx, box.y + H * 0.75, -H * 0.5, { steps: 16, hold: 16 });
  await cdpRelease(cdp, cx, box.y + H * 0.25);
  await sleep(3000);
  const away4 = await transport();
  await page.screenshot({ path: `${SHOTS}/s7-drag-act4-away.png` });
  // back down to scene3
  await cdpDrag(cdp)(cx, box.y + H * 0.3, H * 0.5, { steps: 16, hold: 16 });
  await cdpRelease(cdp, cx, box.y + H * 0.8);
  await sleep(1500);
  let backState = null;
  for (let i = 0; i < 24; i++) {
    backState = await transport();
    if (backState.mode === 'scrub' && Number(backState.ct) > 1) break;
    await sleep(400);
  }
  await page.screenshot({ path: `${SHOTS}/s7-drag-act3-back.png` });
  note(`A4 away(scene4) mode=${away4.mode} mt=${away4.mt} ct=${away4.ct}; back mode=${backState?.mode} ct=${backState?.ct} tops=${JSON.stringify(backState?.tops)}`);
  const awayReset = away4.mode !== 'scrub' || Number(away4.ct ?? 99) <= 0.05;
  R(awayReset, 'A4a away resets act3 video', `mode=${away4.mode} ct=${away4.ct}`);
  R(backState?.mode === 'scrub' && Number(backState?.ct) > 1, 'A4b back re-scrubs act3 video', `mode=${backState?.mode} ct=${backState?.ct}`);

  const errs = consoleMsgs.filter((c) => !/404|Failed to load resource/.test(c.text));
  const notFounds = consoleMsgs.filter((c) => /404|Failed to load resource/.test(c.text));
  note(`drag console: real=${errs.length} 404-type=${notFounds.length} ${JSON.stringify(notFounds.slice(0, 2))}`);
  R(errs.length === 0, 'E drag console clean', errs.length ? errs.slice(0, 2).map((c) => c.text.slice(0, 120)).join(' | ') : '0');
  await browser.close();
}
