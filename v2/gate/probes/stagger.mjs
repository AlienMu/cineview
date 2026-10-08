import { launch } from './browser.mjs';

/**
 * Stagger in a zone: child k plays over [100k, 100k + 400] ms of zone time (linear ease), so at
 * scroll offset y its opacity must be clamp((y - 100k) / 400) and its translate 40 * (1 - that).
 * Asserted on both output paths (native scroll timeline and direct writes).
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await launch();
let failed = 0;
try {
  // Vite reloads a page on its first visit (dependency optimisation); warm up before measuring.
  const warm = await browser.newPage();
  await warm.goto(`${base}/stagger.html`);
  await warm.waitForTimeout(1500);
  await warm.close();
  for (const mode of ['native', 'fallback']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${base}/stagger.html${mode === 'fallback' ? '?fallback' : ''}`);
    await page.evaluate(() => window.ready);
    const zone = await page.evaluate(() => document.getElementById('z').getBoundingClientRect().height);
    if (Math.abs(zone - (844 + 600)) > 1) {
      console.log(`FAIL ${mode} zone height ${zone}, expected ${844 + 600}`);
      failed++;
    }
    for (const y of [0, 50, 150, 250, 400, 550, 700]) {
      const values = await page.evaluate(async (y) => {
        scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300))));
        return [...document.querySelectorAll('li')].map((li) => {
          const cs = getComputedStyle(li);
          const t = cs.translate === 'none' ? [0, 0] : cs.translate.split(' ').map(parseFloat);
          return { opacity: Number(cs.opacity), y: t[1] ?? 0 };
        });
      }, y);
      values.forEach((v, k) => {
        const p = Math.min(Math.max((y - 100 * k) / 400, 0), 1);
        const ok = Math.abs(v.opacity - p) < 0.01 && Math.abs(v.y - 40 * (1 - p)) < 0.5;
        if (!ok) failed++;
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${mode} y=${y} child${k} opacity ${v.opacity.toFixed(3)} (want ${p.toFixed(3)}) y ${v.y.toFixed(2)} (want ${(40 * (1 - p)).toFixed(2)})`);
      });
    }
    const natives = await page.evaluate(() => [...document.querySelectorAll('li')].reduce((n, li) => n + li.getAnimations().length, 0));
    const errors = await page.evaluate(() => window.cvErrors);
    console.log(`${mode}: native animations on children ${natives}; cv-error ${JSON.stringify(errors)}`);
    if (mode === 'native' && natives !== 3) failed++;
    if (mode === 'fallback' && natives !== 0) failed++;
    if (errors.length) failed++;
    // Framework safety: dropping stagger must hand the children back untouched.
    const leftovers = await page.evaluate(async () => {
      document.getElementById('list').removeAttribute('stagger');
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return [...document.querySelectorAll('li')].map((li) => li.getAttribute('style') ?? '').filter(Boolean)
        .concat([...document.querySelectorAll('li')].flatMap((li) => li.getAnimations().map(() => 'animation')));
    });
    console.log(`${leftovers.length ? 'FAIL' : 'ok  '} ${mode} children clean after stagger removed ${JSON.stringify(leftovers)}`);
    if (leftovers.length) failed++;
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
