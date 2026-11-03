// Run against the site dev server: node site/tools/home-entry-probe.mjs [base URL]
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1467, height: 832 }, locale: 'zh-CN' });
  const responses = [];
  let released = false;
  await page.route(/\/home\.js(?:\?|$)|^https:\/\/fonts\.googleapis\.com\//, route => {
    if (released) return route.continue();
    responses.push(route);
  });
  await page.goto(process.argv[2] ?? 'http://127.0.0.1:4000/', { waitUntil: 'commit' });
  // Check the title has risen into its clip while the entry module and font stylesheet are pending.
  await page.waitForFunction(() => {
    const title = document.querySelector('.row-1 .words');
    if (!title || Number(getComputedStyle(document.querySelector('.kicker')).opacity) < 0.25) return false;
    const visible = title.closest('.clip').getBoundingClientRect().bottom - title.getBoundingClientRect().top;
    return visible > title.offsetHeight / 2;
  }, undefined, { timeout: 5000 });
  const riseStart = () => document.querySelector('.row-1 .words').getAnimations()
    .find(effect => effect.animationName === 'rise-line')?.startTime;
  const start = await page.evaluate(riseStart);
  assert.equal(typeof start, 'number');
  assert(responses.some(route => new URL(route.request().url()).pathname === '/home.js'));
  assert(responses.some(route => new URL(route.request().url()).hostname === 'fonts.googleapis.com'));
  released = true;
  for (const route of responses) {
    if (new URL(route.request().url()).hostname === 'fonts.googleapis.com') {
      await route.fulfill({ contentType: 'text/css', body: '' });
    } else await route.continue();
  }
  await page.evaluate(async () => {
    await customElements.whenDefined('cv-stage');
    await document.querySelector('#home').ready;
  });
  const resumed = await page.evaluate(riseStart);
  assert.equal(typeof resumed, 'number');
  assert(Math.abs(resumed - start) <= 1, 'The headline restarted when the stage upgraded');
  // Reloading a saved scene must reveal static content even when the module never loads.
  await page.evaluate(() => scrollTo(0, document.querySelector('#time').offsetTop + 200));
  await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('hero-place') || '{}').id === 'time');
  await page.route('**/home.js', route => route.fulfill({ status: 404, body: '' }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('restoring') &&
    getComputedStyle(document.querySelector('#home')).opacity === '1', undefined, { timeout: 5000 });
  const sceneOffset = await page.evaluate(() => scrollY - document.querySelector('#time').offsetTop);
  assert(Math.abs(sceneOffset - 200) <= 2, 'Saved scene position was not restored');
  console.log('Cold entry, upgrade and saved-scene recovery with a missing module passed.');
} finally {
  await browser.close();
}
