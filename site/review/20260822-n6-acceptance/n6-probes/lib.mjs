/* N6 acceptance probe shared lib — independent criteria, black-box DOM only. */
import { chromium } from '/Users/alienmu/Documents/alien/cineView/cineview/site/node_modules/playwright/index.mjs';
import { appendFileSync, mkdirSync } from 'node:fs';

export const PW = { chromium };
export const BASE = process.env.N6_BASE ?? 'http://127.0.0.1:4023';
export const SHOTS = '/tmp/n6-shots';
export const NOTES = '/tmp/n6-browser-notes.md';
mkdirSync(SHOTS, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const note = (s) => {
  appendFileSync(NOTES, s + '\n');
  console.log(s);
};
export const round = (v, d = 3) => (v == null || Number.isNaN(v) ? null : Number(v.toFixed(d)));

/** Open page with console capture. Returns { page, console: [{type,text}] }. */
export async function openPage({ path = '/', viewport = { width: 1440, height: 900 }, channel, scrollDebug = true } = {}) {
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  const page = await browser.newPage({ viewport });
  if (scrollDebug) await page.addInitScript(() => { window.__CINEVIEW_SCROLL_DEBUG__ = true; });
  const consoleMsgs = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 400) });
  });
  page.on('pageerror', (e) => consoleMsgs.push({ type: 'pageerror', text: String(e).slice(0, 400) }));
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('[data-cineview-container="true"]', { timeout: 20000 });
  return { browser, page, consoleMsgs };
}

/** Read every takeover zone shell: progress px, budget, segment bounds, active flag. */
export async function readZones(page) {
  return page.evaluate(() => {
    const shells = [...document.querySelectorAll('[data-cineview-takeover-shell]')];
    return shells.map((sh) => {
      const num = (n) => (n == null || n === '' ? null : Number(n));
      return {
        shell: Number(sh.getAttribute('data-cineview-takeover-shell')),
        progressPx: num(sh.getAttribute('data-cineview-takeover-progress-px')),
        totalPx: num(sh.getAttribute('data-cineview-takeover-total-distance-px')),
        segStart: num(sh.getAttribute('data-cineview-takeover-segment-start')),
        segEnd: num(sh.getAttribute('data-cineview-takeover-segment-end')),
        active: sh.getAttribute('data-cineview-takeover-active-zone') === 'true',
      };
    });
  });
}

/** progress fraction per zone; null when no budget yet */
export const zoneFrac = (z) => (z.totalPx && z.totalPx > 0 ? Math.min(1, Math.max(0, (z.progressPx ?? 0) / z.totalPx)) : null);

/** Sample visible animate wrappers (computed opacity + translateY), keyed by lane id. */
export async function readLanes(page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const out = {};
    [...document.querySelectorAll('[data-cineview-animate-id]')].forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const cs = getComputedStyle(el);
      const tf = cs.transform;
      let ty = null;
      if (tf && tf !== 'none') {
        const m = tf.match(/matrix\(([^)]+)\)/);
        if (m) ty = Number(m[1].split(',')[5]);
      }
      out[el.getAttribute('data-cineview-animate-id')] = {
        op: Number(cs.opacity),
        ty,
        h: Math.round(r.height),
      };
    });
    return out;
  });
}

export async function scrollTop(page) {
  return page.evaluate(() => document.querySelector('[data-cineview-container="true"]').scrollTop);
}

/** Small-step wheel drive — center-lock cancels big deltas, so creep forward. */
export async function wheelForward(page, px, { step = 120, gap = 60, onStep } = {}) {
  let sent = 0;
  while (sent < px) {
    const d = Math.min(step, px - sent);
    await page.mouse.wheel(0, d);
    sent += d;
    await sleep(gap);
    if (onStep) await onStep();
  }
}
export async function wheelBack(page, px, { step = 120, gap = 60, onStep } = {}) {
  let sent = 0;
  while (sent < px) {
    const d = Math.min(step, px - sent);
    await page.mouse.wheel(0, -d);
    sent += d;
    await sleep(gap);
    if (onStep) await onStep();
  }
}

/** real pointer drag via CDP (page coords) */
export function cdpDrag(cdp) {
  return async (x, yFrom, dy, { steps = 14, hold = 16 } = {}) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y: yFrom, button: 'left', clickCount: 1, pointerType: 'mouse' });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: Math.round(yFrom + (dy * i) / steps), button: 'left', buttons: 1, pointerType: 'mouse' });
      await sleep(hold);
    }
  };
}
export async function cdpRelease(cdp, x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y: Math.round(y), button: 'left', buttons: 0, pointerType: 'mouse' });
}

export const pass = (name, detail) => note(`  PASS ${name} — ${detail}`);
export const fail = (name, detail) => note(`  FAIL ${name} — ${detail}`);
export function verdict(lines) {
  return lines.some((l) => l.startsWith('  FAIL')) ? 'FAIL' : 'PASS';
}
