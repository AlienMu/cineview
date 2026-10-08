import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/**
 * P1.7 first screen: CSS-first entrance and its adoption, hidden boot state with failsafe, preload
 * hold, first-scene-timeout and cv-timeout, drag boot structure, --cv-unit.
 * Serves v2/dist/cineview.css (node v2/build.mjs) at /boot.css and a slow image
 * at /slow.png (routed here).
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await chromium.launch(process.env.CV_CHROMIUM ? { executablePath: process.env.CV_CHROMIUM } : { channel: 'chrome' });
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const css = await readFile(new URL('../../dist/cineview.css', import.meta.url), 'utf8').catch(() => null);
if (!css) throw new Error('build v2 first (node v2/build.mjs)');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const open = async (query, { imageDelay = 0, viewport = { width: 375, height: 700 } } = {}) => {
  const page = await browser.newPage({ viewport });
  await page.route('**/boot.css', (r) => r.fulfill({ contentType: 'text/css', body: css }));
  await page.route('**/slow.png*', async (r) => {
    await new Promise((res) => setTimeout(res, imageDelay));
    await r.fulfill({ contentType: 'image/png', body: PNG });
  });
  // Not 'load': a held image would delay it past the moments under test.
  await page.goto(`${base}/first.html?${query}`, { waitUntil: 'domcontentloaded' });
  return page;
};

try {
  // CSS-first: the entrance runs before the module (delayed 400 ms) and is adopted without a jump.
  let page = await open('case=boot&delay=400');
  await page.waitForTimeout(200);
  const early = await page.evaluate(() => ({
    a: window.seen('a'),
    anim: document.getElementById('a').getAnimations().map((x) => x.animationName),
    defined: !!customElements.get('cv-animate'),
  }));
  check(!early.defined && early.anim[0] === 'cv-boot-rise' && early.a > 0 && early.a < 1, 'CSS-first entrance plays before the module runs', JSON.stringify(early));
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(1400);
  const s = await page.evaluate(() => window.samples);
  const at = s.findIndex((x) => x.live);
  const around = s.slice(Math.max(0, at - 3), at + 3).map((x) => +x.o.toFixed(3));
  const drops = s.slice(1).filter((x, i) => x.o < s[i].o - 0.03).length;
  check(at > 0 && drops === 0, 'handover to the runtime: visible opacity never steps back', JSON.stringify({ at, around, drops }));
  const done = await page.evaluate(() => ({
    a: window.seen('a'),
    b: window.seen('b'),
    hostAnims: document.getElementById('a').getAnimations().length,
    unit: document.getElementById('unit').getBoundingClientRect().width,
    errors: window.cvErrors,
  }));
  check(done.a === 1 && done.b === 1 && done.hostAnims === 0, 'entrances finish; CSS animation dropped', JSON.stringify(done));
  check(Math.abs(done.unit - 100) < 0.5, '--cv-unit: stage 375 / design-width 375 → 100 units = 100px', JSON.stringify(done));
  await page.close();

  // --cv-unit scales with the stage frame, capped at the design width.
  page = await open('case=boot&dw=750');
  await page.evaluate(() => window.ready);
  const half = await page.evaluate(() => document.getElementById('unit').getBoundingClientRect().width);
  await page.close();
  page = await open('case=boot&dw=300', { viewport: { width: 800, height: 700 } });
  await page.evaluate(() => window.ready);
  const capped = await page.evaluate(() => ({
    unit: document.getElementById('unit').getBoundingClientRect().width,
    scene: document.getElementById('s0').getBoundingClientRect().width,
  }));
  check(Math.abs(half - 50) < 0.5 && Math.abs(capped.unit - 100) < 0.5 && Math.abs(capped.scene - 300) < 0.5, '--cv-unit follows the frame; frame capped at design width', JSON.stringify({ half, capped }));
  await page.close();

  // Mixed first scene (one element has a delay): no CSS-first; everything starts hidden.
  page = await open('case=mixed&delay=400');
  await page.waitForTimeout(150);
  const mixed = await page.evaluate(() => ({ a: window.seen('a'), b: window.seen('b'), anims: document.getElementById('a').getAnimations().map((x) => x.animationName) }));
  check(mixed.a === 0 && mixed.b === 0 && mixed.anims[0] === 'cv-failsafe', 'mixed first scene starts hidden with a failsafe', JSON.stringify(mixed));
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(1400);
  const mixedDone = await page.evaluate(() => ({ a: window.seen('a'), b: window.seen('b') }));
  check(mixedDone.a === 1 && mixedDone.b === 1, 'runtime plays the hidden first screen', JSON.stringify(mixedDone));
  await page.close();

  // Failsafe: the module never loads; content shows after the failsafe delay.
  page = await open('case=mixed&delay=600000');
  await page.waitForTimeout(4300);
  const fs = await page.evaluate(() => ({ a: window.seen('a'), b: window.seen('b') }));
  check(fs.a === 1 && fs.b === 1, 'failsafe reveal without the runtime', JSON.stringify(fs));
  await page.close();

  // Preload: the entrance waits for the image.
  page = await open('case=preload', { imageDelay: 700 });
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(300);
  const held = await page.evaluate(() => window.seen('a'));
  await page.waitForTimeout(1500);
  const played = await page.evaluate(() => ({ a: window.seen('a'), timeouts: window.timeouts }));
  check(held === 0 && played.a === 1 && played.timeouts.length === 0, 'preload holds the entrance until the image is ready', JSON.stringify({ held, played }));
  await page.close();

  // Timeout: cv-timeout, then the entrance plays without the image.
  page = await open('case=preload&timeout=300', { imageDelay: 5000 });
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(1500);
  const timedOut = await page.evaluate(() => ({ a: window.seen('a'), timeouts: window.timeouts }));
  check(timedOut.a === 1 && timedOut.timeouts.length === 1 && timedOut.timeouts[0].total === 1 && timedOut.timeouts[0].loaded === 0, 'first-scene-timeout dispatches cv-timeout and plays', JSON.stringify(timedOut));
  await page.close();

  // Cancelled timeout: stays held until the asset arrives.
  page = await open('case=preload&timeout=300&prevent', { imageDelay: 1500 });
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(900);
  const kept = await page.evaluate(() => window.seen('a'));
  await page.waitForTimeout(1800);
  const later = await page.evaluate(() => window.seen('a'));
  check(kept === 0 && later === 1, 'cancelled cv-timeout keeps waiting for the assets', JSON.stringify({ kept, later }));
  await page.close();

  // Drag: CSS-first works there too; the second scene is parked below before the module runs.
  page = await open('case=drag-boot&delay=400');
  await page.waitForTimeout(150);
  const dragEarly = await page.evaluate(() => ({
    a: window.seen('a'),
    s1: document.getElementById('s1').getBoundingClientRect().top,
  }));
  check(dragEarly.a > 0 && dragEarly.a < 1 && dragEarly.s1 >= 699, 'drag: CSS-first entrance and parked second scene before the module', JSON.stringify(dragEarly));
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(1400);
  const ds = await page.evaluate(() => window.samples);
  const dragDrops = ds.slice(1).filter((x, i) => x.o < ds[i].o - 0.03).length;
  const dragDone = await page.evaluate(() => ({ a: window.seen('a'), index: document.getElementById('s').currentIndex(), errors: window.cvErrors }));
  check(dragDrops === 0 && dragDone.a === 1 && dragDone.index === 0 && dragDone.errors.length === 0, 'drag: adopted without a step back', JSON.stringify({ dragDrops, ...dragDone }));
  await page.close();

  // Drag: preload holds the first scene's clock until the image is ready.
  page = await open('case=drag-preload', { imageDelay: 700 });
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(300);
  const dragHeld = await page.evaluate(() => window.seen('a'));
  await page.waitForTimeout(1500);
  const dragPlayed = await page.evaluate(() => window.seen('a'));
  check(dragHeld === 0 && dragPlayed === 1, 'drag: preload holds the first scene until the image is ready', JSON.stringify({ dragHeld, dragPlayed }));
  await page.close();
} catch (e) {
  failed++;
  console.log(`FAIL ${e.stack}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
