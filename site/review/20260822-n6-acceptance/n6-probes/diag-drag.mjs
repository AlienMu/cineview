/* diag: what element translates during drag; does reverse drag commit back? */
import { openPage, sleep, note, SHOTS, cdpDrag, cdpRelease } from './lib.mjs';

const { browser, page } = await openPage({ path: '/drag', viewport: { width: 390, height: 844 } });
await sleep(6500);
const cdp = await page.context().newCDPSession(page);
const box = await page.evaluate(() => {
  const r = document.querySelector('.cineview-container')?.getBoundingClientRect();
  return r ? { x: r.x + r.width / 2, y: r.y, h: r.height } : null;
});
const cx = box.x;

const stackState = () =>
  page.evaluate(() => {
    const cont = document.querySelector('.cineview-container');
    const walk = [];
    const visit = (el, depth) => {
      if (depth > 4 || walk.length > 14) return;
      const cs = getComputedStyle(el);
      const tf = cs.transform;
      if (tf && tf !== 'none') walk.push({ d: depth, cls: (el.className && String(el.className).slice(0, 60)) || el.tagName, tf: tf.slice(0, 80) });
      [...el.children].forEach((c) => visit(c, depth + 1));
    };
    [...cont.children].forEach((c) => visit(c, 1));
    const tops = {};
    for (let n = 1; n <= 5; n++) {
      const w = document.querySelector(`.tp-scene--0${n}`);
      if (w) tops[n] = Math.round(w.getBoundingClientRect().top);
    }
    return { transforms: walk, tops };
  });

note('## diag drag stack');
note(`initial=${JSON.stringify(await stackState())}`);

// commit to scene 2
await cdpDrag(cdp)(cx, box.y + box.h * 0.75, -box.h * 0.5, { steps: 16, hold: 16 });
await cdpRelease(cdp, cx, box.y + box.h * 0.25);
await sleep(2500);
note(`after fwd commit=${JSON.stringify(await stackState())}`);

// reverse drag SLOW with sampling during hold
const yS = box.y + box.h * 0.3;
await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: yS, button: 'left', clickCount: 1, pointerType: 'mouse' });
for (const f of [0.05, 0.1, 0.15, 0.25, 0.35, 0.45, 0.5]) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: Math.round(yS + box.h * f), button: 'left', buttons: 1, pointerType: 'mouse' });
  await sleep(120);
  const s = await stackState();
  note(`hold f=${f} tops=${JSON.stringify(s.tops)} tf=${JSON.stringify(s.transforms.slice(0, 2))}`);
}
await cdpRelease(cdp, cx, yS + box.h * 0.5);
await sleep(2500);
note(`after reverse release=${JSON.stringify(await stackState())}`);
await page.screenshot({ path: '/tmp/n6-shots/diag-reverse.png' });
await browser.close();
