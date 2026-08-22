import { openPage, readZones, sleep, note, scrollTop } from './lib.mjs';

const { browser, page, consoleMsgs } = await openPage({ path: '/' });
await sleep(3000);
let z = await readZones(page);
note(`## recon ${new Date().toISOString()}`);
note(`scrollTop=${await scrollTop(page)}`);
note(`zones=${JSON.stringify(z)}`);
const scenes = await page.evaluate(() => ({
  scrollHeight: document.querySelector('[data-cineview-container="true"]').scrollHeight,
  wrappers: [...document.querySelectorAll('[data-scene-index]')].map((s) => ({
    idx: s.getAttribute('data-scene-index'),
    id: s.getAttribute('data-scene-id') ?? null,
    h: Math.round(s.getBoundingClientRect().height),
  })),
  lanes: [...document.querySelectorAll('[data-cineview-animate-id]')].length,
  scrollbar: !!document.querySelector('[data-cineview-scrollbar-thumb], .cineview-scrollbar-thumb, [class*="scrollbar"]'),
  videos: [...document.querySelectorAll('video')].map((v) => ({ src: v.currentSrc?.split('/').pop(), dur: v.duration })),
}));
note(`scenes=${JSON.stringify(scenes)}`);
await page.screenshot({ path: '/tmp/n6-shots/recon-top.png' });
await browser.close();
