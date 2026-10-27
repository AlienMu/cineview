import { launch } from './browser.mjs';

/**
 * P1.8 <cv-video>: scrub under drag (gesture and continuation), native tail after a short range,
 * forward departure pauses, reverse departure plays back along the travel, cancelled reverse
 * departure restores, forwarded events, blob cache swap, release outside the window, zone scrub,
 * clock-played entrance. Fixture video: v2/fixtures/media/clip.webm (4 s, all keyframes).
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const H = 800;
const near = (a, b, tol = 0.15) => Math.abs(a - b) <= tol;
const open = async (query, prepare = null, waitForMetadata = true) => {
  const page = await browser.newPage({ viewport: { width: 400, height: H } });
  if (prepare) await prepare(page);
  await page.goto(`${base}/video.html?${query}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.ready);
  // Blob preloaded and metadata loaded.
  if (waitForMetadata) await page.waitForFunction(() => { const m = window.media(); return m && m.ready >= 1; }, {}, { timeout: 10000 });
  return page;
};
const media = (page) => page.evaluate(() => window.media());
const events = (page) => page.evaluate(() => window.events.splice(0));
const press = async (page, y, dy, { steps = 10, hold = 150, release = true } = {}) => {
  await page.mouse.move(200, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(200, y + (dy * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(hold);
  if (release) await page.mouse.up();
};

try {
  // Warm the dev server (a first visit can trigger a reload while it optimises dependencies).
  const warm = await browser.newPage();
  await warm.goto(`${base}/video.html?mode=drag`);
  await warm.waitForTimeout(1200);
  await warm.close();

  // ---- drag, full range -------------------------------------------------------------------
  let page = await open('mode=drag');
  let m = await media(page);
  check(m.src.startsWith('blob:'), 'preloaded blob replaces the network source', JSON.stringify(m));
  // Half a screen, less the 1 px direction gate → about 500 ms of 1000 → 2 s of 4 s.
  await press(page, 600, -0.5 * H, { release: false });
  await page.waitForTimeout(150);
  m = await media(page);
  check(near(m.t, (0.5 - 1 / H) * 4) && m.paused, 'gesture scrubs the incoming video', JSON.stringify(m));
  await page.mouse.move(200, 600 - 0.55 * H);
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(1200);
  m = await media(page);
  check(near(m.t, 4, 0.1) && m.paused, 'continuation scrubs to the end after release', JSON.stringify(m));
  await page.close();

  // Cancelling a partial entrance keeps its decoded video node, including at a boundary.
  page = await open('mode=drag&range=0,1');
  await page.evaluate(() => {
    document.getElementById('s').goTo(1);
  });
  await page.waitForTimeout(500);
  const partialNodeTime = await page.evaluate(() => {
    window.partialNode = document.getElementById('v').video;
    return window.partialNode.currentTime;
  });
  await press(page, 400, 80, { hold: 150 });
  await page.waitForTimeout(800);
  const cancelledPartial = await page.evaluate(() => {
    const host = document.getElementById('v');
    return { sameNode: host.video === window.partialNode, time: host.video.currentTime, ready: host.video.readyState, frame: host.timeline.frame };
  });
  check(cancelledPartial.sameNode && cancelledPartial.ready >= 2 && near(cancelledPartial.time, partialNodeTime, 0.08),
    'partial entrance cancellation preserves the decoded node and departure frame', JSON.stringify({ partialNodeTime, cancelledPartial }));
  await page.evaluate(() => document.getElementById('s').goTo(0));
  await page.waitForFunction(() => document.getElementById('s').current === 0);
  await page.evaluate(() => document.getElementById('s').goTo(1));
  await page.waitForFunction(() => document.getElementById('s').current === 1 && !window.media().paused && window.media().t > 1);
  const reenteredPartial = await page.evaluate(() => ({ fresh: document.getElementById('v').video !== window.partialNode, ...window.media() }));
  check(reenteredPartial.fresh && !reenteredPartial.paused && reenteredPartial.t > 1,
    'committed reentry still creates a fresh activation and plays the native tail', JSON.stringify(reenteredPartial));
  await page.close();

  // ---- drag, short range: native tail, departures --------------------------------------
  page = await open('mode=drag&range=0,1');
  await page.focus('#s');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(1400);
  m = await media(page);
  let ev = await events(page);
  check(!m.paused && m.t > 1.1 && ev.includes('play'), 'range end hands playback to the browser', JSON.stringify({ m, ev }));
  // Forward departure pauses.
  await press(page, 600, -0.25 * H, { release: false });
  await page.waitForTimeout(100);
  m = await media(page);
  const departed = m.t;
  check(m.paused, 'forward departure pauses', JSON.stringify(m));
  // Cancel the departure (held short drag): restore and resume, since it was playing.
  await page.mouse.up();
  await page.waitForTimeout(700);
  m = await media(page);
  check(!m.paused && m.t >= departed - 0.05, 'cancelled departure restores and resumes playback', JSON.stringify({ departed, m }));
  await page.waitForTimeout(200);
  // Reverse departure: back toward scene 0 plays back along the travel to the range start.
  await press(page, 300, 0.55 * H, { release: false, hold: 200 });
  const t0 = departed;
  m = await media(page);
  check(m.paused && m.t < t0 && m.t > 0, 'reverse departure scrubs back along the travel', JSON.stringify({ t0, m }));
  await page.mouse.up();
  await page.waitForTimeout(800);
  const idx = await page.evaluate(() => document.getElementById('s').currentIndex());
  m = await media(page);
  check(idx === 0 && near(m.t, 0, 0.05), 'committed reverse departure lands at the range start', JSON.stringify({ idx, m }));
  // Window: scenes 2 and 3 away → scene 1 leaves the window and releases its decoded frames.
  await page.keyboard.press('End');
  await page.waitForTimeout(800);
  m = await media(page);
  check(m.src === '' , 'outside the activation window the video is released', JSON.stringify(m));
  await page.keyboard.press('Home');
  await page.waitForTimeout(300);
  m = await media(page);
  check(m.src.startsWith('blob:'), 'back in the window the blob is re-attached', JSON.stringify(m));
  const errors = await page.evaluate(() => window.cvErrors);
  check(errors.length === 0, 'no cv-error', JSON.stringify(errors));
  await page.close();

  // Actual metadata can arrive after cancellation and an idle resize frame.
  let releaseMetadata;
  const metadataGate = new Promise(resolve => { releaseMetadata = resolve; });
  page = await open('mode=drag&range=0,1&preload=none', async (page) => {
    await page.route('**/media/clip.webm', async (route) => {
      const response = await route.fetch();
      await metadataGate;
      await route.fulfill({ response });
    });
  }, false);
  await page.evaluate(() => document.getElementById('s').goTo(1));
  await page.waitForTimeout(500);
  await press(page, 400, 80, { hold: 150 });
  await page.waitForTimeout(80);
  await page.setViewportSize({ width: 401, height: H });
  await page.waitForTimeout(80);
  check((await media(page)).ready === 0, 'real media stays pending until the partial entrance is idle');
  releaseMetadata();
  // Seeking after loadeddata can temporarily return readyState to HAVE_METADATA.
  // Wait for the restored frame to decode and capture media/timeline in the same task.
  const restored = await page.waitForFunction(() => {
    const host = document.getElementById('v');
    const m = window.media();
    const partial = host.timeline.frame;
    return m.ready >= 2 && !host.video.seeking && Math.abs(m.t - partial.progress) < 0.05
      ? { m, partial } : false;
  }, {}, { timeout: 10000 });
  const restoredFrame = await restored.jsonValue();
  m = restoredFrame.m;
  const partial = restoredFrame.partial;
  check(partial.phase === 'entering' && partial.source === 'idle' && partial.progress > 0.2,
    'cancelled partial entrance stays at its idle timeline frame', JSON.stringify(partial));
  check(m.ready >= 2 && m.paused && near(m.t, partial.progress, 0.05),
    'late metadata restores a partial entrance after cancellation and resize', JSON.stringify({ m, partial }));
  await page.close();

  // ---- zone ----------------------------------------------------------------------------
  page = await open('mode=zone');
  await page.evaluate(() => scrollTo(0, 500));
  await page.waitForTimeout(400);
  m = await media(page);
  check(near(m.t, 2, 0.1) && m.paused, 'zone: scroll scrubs the video', JSON.stringify(m));
  await page.close();

  // ---- enter (clock) -------------------------------------------------------------------
  page = await open('mode=enter&preload=none');
  await page.waitForTimeout(1300);
  m = await media(page);
  check(near(m.t, 4, 0.1) && !m.src.startsWith('blob:'), 'enter: clock entrance scrubs to the end; preload="none" streams', JSON.stringify(m));
  await page.close();
} catch (e) {
  failed++;
  console.log(`FAIL ${e.stack}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
