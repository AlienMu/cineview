/* diag2: during held drag from scene2 into scene3, what scrubs? */
import { openPage, sleep, note, cdpDrag, cdpRelease } from './lib.mjs';

const { browser, page } = await openPage({ path: '/drag', viewport: { width: 390, height: 844 }, channel: 'chrome' });
await sleep(6500);
const cdp = await page.context().newCDPSession(page);
const box = await page.evaluate(() => {
  const r = document.querySelector('.cineview-container')?.getBoundingClientRect();
  return r ? { x: r.x + r.width / 2, y: r.y, h: r.height } : null;
});
const cx = box.x;
const H = box.h;

await cdpDrag(cdp)(cx, box.y + H * 0.75, -H * 0.5, { steps: 16, hold: 16 });
await cdpRelease(cdp, cx, box.y + H * 0.25);
await sleep(3500);

const sample = () =>
  page.evaluate(() => {
    const stage = document.querySelector('.s03-cut-stage');
    const lanes = {};
    [...document.querySelectorAll('.tp-scene--03 [data-cineview-animate-id]')].forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      lanes[el.getAttribute('data-cineview-animate-id')] = Number(getComputedStyle(el).opacity).toFixed(2);
    });
    const v = document.querySelector('.tp-scene--03 video');
    const t = {};
    for (let n = 1; n <= 4; n++) {
      const w = document.querySelector(`.tp-scene--0${n}`);
      if (w) t[n] = Math.round(w.getBoundingClientRect().top);
    }
    return { mediaMode: stage?.dataset.mediaMode ?? null, mediaTime: stage?.dataset.mediaTime ?? null, ct: v?.currentTime ?? null, lanes, tops: t };
  });

note('## diag2 scene3 enter scrub');
note(`rest=${JSON.stringify(await sample())}`);

const yS = box.y + H * 0.72;
await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: yS, button: 'left', clickCount: 1, pointerType: 'mouse' });
for (const f of [0.15, 0.25, 0.35, 0.45, 0.55, 0.65]) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: Math.round(yS - H * f), button: 'left', buttons: 1, pointerType: 'mouse' });
  await sleep(300);
  note(`hold f=${f} ${JSON.stringify(await sample())}`);
}
await cdpRelease(cdp, cx, yS - H * 0.65);
await sleep(1200);
note(`released deep=${JSON.stringify(await sample())}`);
await sleep(4000);
note(`settled=${JSON.stringify(await sample())}`);
await browser.close();
