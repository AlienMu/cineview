import { chromium } from 'playwright';

/**
 * React 19 with the 2.0 elements (P1.10): client render and SSR markup + hydration, with cineview
 * defined before or after React renders, drag and scroll input. Props reach the attributes
 * (including `after`, which every element has as ChildNode.after, and `input` / `paused`, which the
 * stage has as accessors), listeners through a ref and `stage.ready` work in every mode, oncv-*
 * props once React has attached them (client render: at once; hydration: on a later render, React
 * 19 behaviour, printed as a note), state updates reach the elements, no console errors. Hydration
 * mismatch: nothing is written to the host on connection; state attributes (data-cv-*) a build
 * writes before React hydrates the element are printed as a note (React's development build
 * reports them and leaves them in place); any other difference fails.
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await chromium.launch(process.env.CV_CHROMIUM ? { executablePath: process.env.CV_CHROMIUM } : { channel: 'chrome' });
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

try {
  // Warm the dev server (first visit optimises react and react-dom, then reloads).
  const warm = await browser.newPage();
  await warm.goto(`${base}/react.html`);
  await warm.waitForTimeout(2500);
  await warm.close();

  const cases = ['drag', 'scroll'].flatMap((input) =>
    ['client', 'hydrate'].flatMap((mode) => ['early', 'late'].map((order) => ({ input, mode, order })))
  );
  for (const { input, mode, order } of cases) {
    const label = `${input}/${mode}/${order}`;
    const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().startsWith('[cineview]')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}/react.html?mode=${mode}&order=${order}&input=${input}`);
    await page.waitForFunction(() => window.reactLog?.includes('fx-ready'), {}, { timeout: 8000 });
    await page.waitForTimeout(50);
    const state = () =>
      page.evaluate(() => {
        const s = document.getElementById('s');
        const a1 = document.getElementById('a1');
        return {
          input: s.getAttribute('input'),
          inputProp: s.input,
          paused: s.hasAttribute('paused'),
          after: a1.getAttribute('after'),
          ownAfter: Object.prototype.hasOwnProperty.call(a1, 'after'),
          afterIsMethod: typeof a1.after === 'function',
          duration: s.getAttribute('transition-duration'),
          phase: document.getElementById('a0').getAttribute('data-cv-phase'),
          log: window.reactLog.slice(),
        };
      });
    let st = await state();
    check(
      st.input === input && st.inputProp === input && st.duration === '400' && !st.paused,
      `${label}: stage props as attributes`,
      JSON.stringify(st)
    );
    check(st.after === 'intro' && !st.ownAfter && st.afterIsMethod, `${label}: after reaches the attribute, ChildNode.after intact`, JSON.stringify(st));
    check(st.log.filter((l) => l === 'fx-ready').length === 1 && !st.log.some((l) => l.startsWith('error')), `${label}: stage.ready settles, no cv-error`, JSON.stringify(st.log));
    if (mode === 'client') check(st.log.filter((l) => l === 'ready').length === 1, `${label}: oncv-ready once`, JSON.stringify(st.log));
    else console.log(`note ${label}: oncv-ready ${st.log.includes('ready') ? 'arrived' : 'not attached while hydrating (React 19)'}`);

    await page.evaluate(() => window.setPaused(true));
    await page.waitForTimeout(50);
    const pausedOn = (await state()).paused;
    await page.evaluate(() => window.setPaused(false));
    await page.waitForTimeout(50);
    check(pausedOn && !(await state()).paused, `${label}: paused state toggles the attribute`);

    await page.evaluate(() => window.setAfter('nobody'));
    await page.waitForTimeout(100);
    st = await state();
    check(st.after === 'nobody' && st.log.includes('error:missing-after'), `${label}: after update rebuilds and reports through oncv-error`, JSON.stringify(st.log));
    await page.evaluate(() => window.setAfter('intro'));

    await page.evaluate(() => window.setLang('fr'));
    await page.waitForTimeout(50);
    const text = await page.evaluate(() => [document.querySelector('#a0 p').textContent, document.getElementById('s0').getAttribute('aria-label')]);
    check(text.join() === 'Bonjour,Début', `${label}: language switch re-renders inside the elements`, text.join());

    await page.evaluate(() => document.getElementById('s').goTo(1, { animated: false }));
    await page.waitForTimeout(50);
    st = await state();
    check(st.log.includes('enter:0>1'), `${label}: oncv-enter after re-renders`, JSON.stringify(st.log));
    check(st.log.includes('fx-enter:0>1'), `${label}: cv-enter through a ref`, JSON.stringify(st.log));
    // React (development build) reports attributes a build wrote before hydration reached the
    // element; it leaves them in place. Only cineview state attributes may differ.
    const mismatch = errors.filter((e) => e.startsWith('A tree hydrated but some attributes'));
    const differing = mismatch.flatMap((e) => [...e.matchAll(/^\s*[-+]\s+([\w-]+)=/gm)].map((m) => m[1]));
    if (differing.length) console.log(`note ${label}: state attributes written before hydration: ${[...new Set(differing)].join(', ')}`);
    const unexpected = errors.filter((e) => !mismatch.includes(e)).concat(differing.some((n) => !n.startsWith('data-cv-')) ? mismatch : []);
    check(unexpected.length === 0, `${label}: no React or page errors (other than state attributes)`, JSON.stringify(unexpected));
    await page.close();
  }
} catch (e) {
  failed++;
  console.log(`FAIL ${e.stack}`);
}
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
