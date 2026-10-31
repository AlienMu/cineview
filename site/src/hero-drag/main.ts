// The drag demo (/drag/): v1's /drag experience rebuilt on cv-* elements. This module wires what v1's React
// components did per frame: the three canvases (v1 drawing code, fed by the lane's timeline), the
// dial's live hour, the scene-5 black layer, the embed messages, and the site language.
import { freezeFrames, laneValues, thawFrames } from './values';
import { mountClapperboard } from './clapperboard';
import { mountAperture } from './aperture';
import { mountWaveform } from './waveform';
import { readDialEpoch } from './dial';
import { media, ring, timecode } from './frames';
import { mountDust } from './dust';
import { LANGUAGE_STORAGE_KEY, resolveLanguage, saveLanguage } from '../i18n/language';
import type { Lang } from '../i18n/types';

const lane = (id: string): Element | null =>
  document.querySelector(`[data-cineview-animate-id="${id}"]`);

function canvases(): void {
  const jobs: Array<[string, string, typeof mountWaveform]> = [
    ['s02-clapper', '.s02-clapper-canvas', mountClapperboard],
    ['s03-waveform', '.s03-wave-canvas', mountWaveform],
    ['s04-aperture', '.s04-aperture-canvas', mountAperture],
  ];
  // Scene 1's dust reads the ambient stage's phase (v1: useAnimateTimeline().phase).
  const dust = document.querySelector<HTMLCanvasElement>('.tp-ambient__dust');
  const ambient = lane('s01-ambient');
  if (dust && ambient && !reduced) mountDust(dust, laneValues(ambient).phase);
  for (const [id, selector, mount] of jobs) {
    const host = lane(id);
    const canvas = host?.querySelector<HTMLCanvasElement>(selector);
    if (!host || !canvas) continue;
    const { progress, phase } = laneValues(host);
    mount(canvas, progress, phase);
  }
}

// v1 SceneRolling: the dial shows the reader's hour and English date (readDialEpoch, v1's helper),
// refreshed on the minute, and the hands start from the wall clock's angles.
function dial(): void {
  const hour = document.querySelector('.s01-center-number__value');
  const date = document.querySelector('.s01-date');
  const tick = (): void => {
    const now = readDialEpoch();
    if (hour) hour.textContent = now.hour;
    if (date) date.textContent = now.dateLabel;
  };
  tick();
  setInterval(tick, 60000);
  const now = readDialEpoch();
  // The calibration sweep turns one lap from the second hand's angle (v1 createHandSweepContract).
  const sweep = lane('s01-hand-second-sweep');
  if (sweep) {
    sweep.setAttribute('from', `rotate:${now.secondAngle}`);
    sweep.setAttribute('to', `rotate:${now.secondAngle + 360}`);
  }
  // The minute hand then advances to the current minute (v1 createMinuteAdvanceContract).
  const advance = lane('s01-hand-minute-advance');
  if (advance) advance.setAttribute('to', `rotate:${now.minuteAngle}`);
}

// v1 TemporalDragExperience: the scene-5 black layer follows the drag between scenes 4 and 5, and
// the page tells an embedding homepage when the last scene is reached (or left).
function stageEvents(): void {
  const stage = document.getElementById('reel');
  const black = document.querySelector<HTMLElement>('.tp-act5-black');
  if (!stage) return;
  const embedded = window.parent !== window;
  const post = (msg: string): void => {
    if (embedded) window.parent.postMessage(msg, location.origin);
  };
  const LAST = 4;
  // v1: per tick while the finger moves (no transition); on release, a linear transition to the
  // end value as long as the rest of the slide; snapped when the switch lands.
  let session: number | null = null;
  let last = 0;
  const set = (v: number, transition: string): void => {
    if (!black) return;
    if (black.style.transition !== transition) black.style.transition = transition;
    black.style.opacity = String(v);
    last = v;
  };
  stage.addEventListener('cv-progress', (e) => {
    const d = (
      e as CustomEvent<{ kind: string; index: number; progress: number; direction?: string }>
    ).detail;
    if (!black || d.kind !== 'page') return;
    if (session === null && d.direction) {
      if (d.index === LAST - 1 && d.direction === 'forward') session = LAST - 1;
      else if (d.index === LAST && d.direction === 'backward') session = LAST;
    }
    if (session === null) return;
    set(session === LAST - 1 ? d.progress : 1 - d.progress, 'none');
  });
  addEventListener(
    'pointerup',
    () => {
      if (session === null) return;
      const end = session === LAST ? 0 : 1;
      const ms = Math.min(800, Math.max(reduced ? 80 : 120, Math.abs(end - last) * 800));
      set(end, `opacity ${ms}ms linear`);
    },
    true
  );
  stage.addEventListener('cv-dragcancel', () => (session = null));
  stage.addEventListener('cv-enter', (e) => {
    const to = (e as CustomEvent<{ to: number }>).detail.to;
    session = null;
    set(to === LAST ? 1 : 0, 'none');
    post(to === LAST ? 'cineview-embed-finished' : 'cineview-embed-unfinished');
  });
  stage.addEventListener('cv-dragstart', () => post('cineview-embed-drag-start'));
  if (embedded) post('cineview-embed-ready');
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// v1's Chinese copy (site/src/i18n/zh.ts dragTemporal.*), by where v1 shows it. The markup carries
// v1's English (the page's default); a Chinese reader gets these in place before the stage plays.
const ZH_TEXT: Array<[string, string, string]> = [
  ['.s01-actions a:nth-of-type(1)', 'Read the docs', '阅读文档'],
  ['.s01-actions a:nth-of-type(2)', 'View on GitHub', '在 GitHub 查看'],
  ['.s04-title', 'The frame focuses on you', '画面聚焦于你'],
];
const ZH_WORDS: Record<string, string> = {
  CUT: '剪辑',
  DIRECT: '调度',
  CONTROL: '控制',
  PACE: '节奏',
  TIMING: '时序',
};
const ZH_CREDITS: Record<string, string> = {
  DIRECTOR: '导演',
  'Scene Engine': '场景调度引擎',
  EDITOR: '剪辑',
  'Unified Timeline': '统一时间线',
  CINEMATOGRAPHY: '摄影',
  'Scroll + Drag': '滚动与拖拽',
  'MOTION PERFORMANCE': '动态演出',
  'Reversible Motion Runtime': '可逆动效运行时',
  STARRING: '领衔主演',
  'Your Story': '你的叙事',
};
const ZH_LABELS: Array<[string, string]> = [
  ['.lang-toggle', '切换语言'],
  ['.s01-dial', '时间校准盘'],
  ['.s01-actions', '主导航'],
  ['.s02-clapper', '粒子汇聚成场记板 — ACTION'],
  ['.s03-preview', '节目预览监视器'],
  ['.s03-bed', '剪辑时间线'],
  ['.s05-curtain-call', 'Cineview 谢幕演职员表'],
];

function replaceText(root: Element, map: Record<string, string>): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent?.trim() ?? '';
    if (map[t]) n.textContent = n.textContent!.replace(t, map[t]!);
  }
}

function translate(lang: Lang): void {
  for (const [sel, en, zh] of ZH_TEXT) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode())
      if (n.textContent?.trim() === (lang === 'zh' ? en : zh))
        n.textContent = lang === 'zh' ? zh : en;
  }
  const words = (map: Record<string, string>): Record<string, string> =>
    lang === 'zh' ? map : Object.fromEntries(Object.entries(map).map(([en, zh]) => [zh, en]));
  for (const sel of ['.s03-preview__subtitles', '.s03-tracks']) {
    const el = document.querySelector(sel);
    if (el) replaceText(el, words(ZH_WORDS));
  }
  const credits = document.querySelector('.s05-credits');
  if (credits) replaceText(credits, words(ZH_CREDITS));
}

// Apply text in place so a manual switch also works when storage is unavailable.
function language(): void {
  let lang: Lang = 'en'; // The static markup contains English.
  const button = document.querySelector<HTMLButtonElement>('.lang-toggle');
  const code = button?.querySelector('.lang-toggle__code');
  const title = button?.getAttribute('title') ?? '';
  const labels = ZH_LABELS.map(([selector, zh]) => {
    const element = document.querySelector(selector);
    return { element, zh, en: element?.getAttribute('aria-label') ?? '' };
  });
  const apply = (next: Lang): void => {
    if (next !== lang) translate(next);
    lang = next;
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    if (code) code.textContent = lang === 'zh' ? 'EN' : 'ZH';
    button?.setAttribute('title', lang === 'zh' ? '切换语言' : title);
    for (const { element, en, zh } of labels)
      element?.setAttribute('aria-label', lang === 'zh' ? zh : en);
  };
  apply(resolveLanguage());
  button?.addEventListener('click', () => {
    const next = lang === 'zh' ? 'en' : 'zh';
    saveLanguage(next);
    apply(next);
    if (window.parent !== window)
      window.parent.postMessage(`cineview-embed-lang:${next}`, location.origin);
  });
  window.addEventListener('storage', (event) => {
    if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) apply(resolveLanguage());
  });
  window.addEventListener('message', (event) => {
    if (window.parent === window || event.origin !== location.origin || event.source !== window.parent)
      return;
    if (typeof event.data !== 'string' || !event.data.startsWith('cineview-site-lang:')) return;
    const next = event.data.slice('cineview-site-lang:'.length);
    if (next === 'zh' || next === 'en') apply(next);
  });
}

// v1 embed protocol (Scene5Cinema): with ?deferred the page waits as a dark shell, announces
// cineview-embed-ready, and starts on cineview-activate (the first scene plays from zero at the
// reveal); cineview-freeze pauses it again. Same-origin messages from the parent only.
function deferred(): void {
  const stage = document.getElementById('reel');
  if (!stage || !new URLSearchParams(location.search).has('deferred') || window.parent === window)
    return;
  stage.setAttribute('paused', '');
  document.documentElement.classList.add('drag-deferred');
  // Embedded, the frame never scrolls (the demo moves by dragging): hand the wheel to the page
  // around it, so a reader whose cursor rests on the phone can still scroll on (same origin).
  addEventListener(
    'wheel',
    (e) => {
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      window.parent.scrollBy(e.deltaX * unit, e.deltaY * unit);
    },
    { passive: true }
  );
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    if (e.data === 'cineview-activate') {
      document.documentElement.classList.remove('drag-deferred');
      stage.removeAttribute('paused');
      thawFrames();
    } else if (e.data === 'cineview-freeze') {
      stage.setAttribute('paused', '');
      freezeFrames();
    }
  });
}

language();
dial();
deferred();
customElements.whenDefined('cv-animate').then(() => {
  canvases();
  timecode();
  ring();
  media(reduced);
  stageEvents();
});
