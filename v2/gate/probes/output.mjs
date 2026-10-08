import { chromium } from 'playwright';

/** P1.4 output behaviours, asserted against the spec (loops, pause, reduced motion, native budget). */
const base = process.argv[2] ?? 'http://127.0.0.1:4360';
const browser = await chromium.launch({ channel: 'chrome' });
let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const settle = (page, ms) => page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);
const loopState = (page, id) =>
  page.evaluate((id) => {
    const el = document.getElementById(id);
    const layer = el.shadowRoot.querySelector('[part~="loop"]');
    if (!layer) return { layer: false, anims: [] };
    return {
      layer: true,
      anims: layer.getAnimations().map((a) => ({
        state: a.playState,
        iterations: a.effect.getTiming().iterations,
        props: Object.keys(a.effect.getKeyframes()[0] ?? {}).filter((k) => !['offset', 'computedOffset', 'easing', 'composite'].includes(k)),
      })),
    };
  }, id);

try {
  const warm = await browser.newPage();
  await warm.goto(`${base}/output.html`);
  await warm.waitForTimeout(1500);
  await warm.close();

  // ---- loops and pause ------------------------------------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${base}/output.html`);
    await page.evaluate(() => window.ready);
    await settle(page, 500);
    const a1 = await loopState(page, 'a1');
    check(a1.anims.length === 1 && a1.anims[0].state === 'running' && a1.anims[0].iterations === Infinity, 'loop starts after the entrance', JSON.stringify(a1));
    const a2 = await loopState(page, 'a2');
    check(a2.anims.length === 1 && a2.anims[0].props.includes('--glow') && a2.anims[0].props.includes('opacity'), 'loop-only element loops at once, custom property in keyframes', JSON.stringify(a2));

    const zone = await page.evaluate(() => document.getElementById('z').getBoundingClientRect().top + scrollY);
    const zAt = async (t) => {
      await page.evaluate((y) => scrollTo(0, y), zone + t);
      await settle(page, 200);
      return (await loopState(page, 'z1')).anims.length;
    };
    check((await zAt(100)) === 0, 'zone loop waits for the entrance (t=100 < 300)');
    check((await zAt(350)) === 1, 'zone loop runs once the entrance is complete (t=350)');
    check((await zAt(100)) === 0, 'zone loop stops when scrubbed back (t=100)');

    await page.evaluate(() => scrollTo(0, 0));
    await settle(page, 200);
    await page.click('#p');
    await settle(page, 100);
    const paused = await page.evaluate(() => ({ attr: document.getElementById('s').hasAttribute('paused'), pressed: document.getElementById('p').getAttribute('aria-pressed') }));
    const a1p = await loopState(page, 'a1');
    check(paused.attr && paused.pressed === 'true' && a1p.anims[0]?.state === 'paused', 'cv-pause pauses clock motion and reports aria-pressed', JSON.stringify({ paused, a1p }));
    await page.keyboard.press('Enter'); // focus stays on cv-pause after click
    await settle(page, 100);
    const a1r = await loopState(page, 'a1');
    const pressed = await page.evaluate(() => document.getElementById('p').getAttribute('aria-pressed'));
    check(pressed === 'false' && a1r.anims[0]?.state === 'running', 'Enter on cv-pause resumes', JSON.stringify({ pressed, a1r }));
    const errors = await page.evaluate(() => window.cvErrors);
    check(errors.length === 0, 'no cv-error', JSON.stringify(errors));
    await page.close();
  }

  // ---- reduced motion -------------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${base}/output.html`);
    await page.evaluate(() => window.ready);
    const timing = await page.evaluate(() => {
      const a1 = document.getElementById('a1');
      const layer = a1.shadowRoot.querySelector('[part~="time"]');
      const anim = layer?.getAnimations()[0];
      const frames = anim?.effect.getKeyframes() ?? [];
      return {
        duration: anim?.effect.getTiming().duration,
        props: [...new Set(frames.flatMap((f) => Object.keys(f)).filter((k) => !['offset', 'computedOffset', 'easing', 'composite'].includes(k)))],
      };
    });
    check(timing.duration <= 200 && timing.props.join() === 'opacity', 'reduced motion: entrance is a short fade only', JSON.stringify(timing));
    await settle(page, 400);
    check((await loopState(page, 'a1')).layer === false && (await loopState(page, 'a2')).layer === false, 'reduced motion: no loops');
    const drift = await page.evaluate(() => document.getElementById('d1').shadowRoot.querySelectorAll('.l').length);
    check(drift === 0, 'reduced motion: drift removed', `layers ${drift}`);
    await context.close();
  }

  // ---- native budget --------------------------------------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${base}/output.html?budget`);
    await page.evaluate(() => window.ready);
    await settle(page, 1200);
    const count = () =>
      page.evaluate(() => {
        let live = 0;
        let direct = 0;
        for (const s of document.querySelectorAll('cv-scene[zone]')) {
          for (const a of s.querySelectorAll('cv-animate')) {
            const l = a.shadowRoot.querySelector('.l');
            if (l.getAnimations().length) live++;
            else if (l.style.opacity !== '') direct++;
          }
        }
        return { live, direct };
      });
    const before = await count();
    check(before.live === 256, 'native animations capped at 256', JSON.stringify(before));
    check(before.direct >= 44, 'overflow layers fall back to direct writes', JSON.stringify(before));
    // Values agree between the two paths at the same zone time.
    const z1 = await page.evaluate(() => document.getElementById('z1').getBoundingClientRect().top + scrollY);
    await page.evaluate((y) => scrollTo(0, y + 300), z1);
    await settle(page, 300);
    const values = await page.evaluate(() => {
      const out = new Set();
      for (const a of document.getElementById('z1').querySelectorAll('cv-animate')) {
        out.add(Number(getComputedStyle(a.shadowRoot.querySelector('.l')).opacity).toFixed(3));
      }
      return [...out];
    });
    check(values.length === 1, 'native and direct layers show the same value', JSON.stringify(values));
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failed ? `FAILED ${failed}` : 'PASS');
process.exit(failed ? 1 : 0);
