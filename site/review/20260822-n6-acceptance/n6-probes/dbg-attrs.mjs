import { openPage, sleep, note, scrollTop } from './lib.mjs';

const { browser, page } = await openPage({ path: '/' });
await sleep(3000);
await page.mouse.move(720, 450);
for (const target of [800, 2000, 4000, 7000, 10000, 13000, 15000, 17000, 20000, 23000, 26000, 29000, 31000]) {
  let last = -1;
  for (let i = 0; i < 90; i++) {
    const st = await scrollTop(page);
    if (st >= target - 60 || st === last) break;
    last = st;
    await page.mouse.wheel(0, Math.min(160, Math.max(40, target - st)));
    await sleep(65);
  }
  await sleep(200);
  const dump = await page.evaluate(() => {
    return [...document.querySelectorAll('[data-cineview-takeover-shell]')].map((sh) => ({
      shell: sh.getAttribute('data-cineview-takeover-shell'),
      prog: sh.getAttribute('data-cineview-takeover-progress-px'),
      total: sh.getAttribute('data-cineview-takeover-total-distance-px'),
      segS: sh.getAttribute('data-cineview-takeover-segment-start'),
      segE: sh.getAttribute('data-cineview-takeover-segment-end'),
      active: sh.getAttribute('data-cineview-takeover-active-zone'),
    }));
  });
  note(`st=${await scrollTop(page)} ${JSON.stringify(dump)}`);
}
await browser.close();
