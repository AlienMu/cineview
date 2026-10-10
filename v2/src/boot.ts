/**
 * Boot styles (plan v3 §10), shipped as cineview.css for the page <head> and injected by the module
 * when the page did not load it.
 *
 * - Structure before the module runs: custom elements are blocks; drag stages are fixed with the
 *   second scene parked below and the rest skipped (`content-visibility: hidden`, phase 0).
 * - `.cv-js` (set on <html> by the head snippet when the browser meets the baseline) gates every
 *   hiding rule, so browsers below the baseline show static content.
 * - First screen, CSS-first: in the first scene, an element whose `fx` is a single built-in preset
 *   with default parameters plays that preset as a CSS animation on the host from the first frame,
 *   provided every animated element of the scene qualifies (they then share one clock). The runtime
 *   adopts it: it starts its own animation at the elapsed time and sets `data-cv-live` in the same
 *   task, which drops the CSS animation.
 * - Any other animated element of the first scene starts hidden and is revealed by the runtime, with
 *   a CSS failsafe reveal after FAILSAFE_DELAY in case the module never runs.
 * - `--cv-unit`: one design pixel as a registered <length>, from the stage's inner frame (a size
 *   container in the stage's shadow root) and `--cv-dw` (design width, default 750).
 */
import { parseFx, presetNames, sampleKeyframes, usedProps, type Effect } from './core/fx';
import { frameCss, identityFrame } from './core/props';

/** Animated elements of the first scene become visible by then without the runtime. */
export const FAILSAFE_DELAY = 4000;
/** CSS animation names start with this; the runtime adopts their progress. */
export const BOOT_PREFIX = 'cv-boot-';
const SAMPLES = 24;

/** Attributes that change timing, parameters or the progress source: not a CSS-first element. */
const DISQUALIFY = [
  'delay',
  'after',
  'at',
  'stagger',
  'from',
  'to',
  'on',
  'duration',
  'ease',
  'display',
  'target',
];
/** A scene whose own setup changes the clock is never CSS-first. */
const SCENE_DISQUALIFY = ['preload', 'zone', 'track', 'sequence'];

const FIRST = 'cv-stage>cv-scene:first-of-type';
const not = (attrs: readonly string[]): string => `:not(${attrs.map((a) => `[${a}]`).join(',')})`;

interface BootPreset {
  name: string;
  duration: number;
  css: string;
}

/** Built-in presets that play as a single time effect with a default duration. */
function bootPresets(): BootPreset[] {
  const out: BootPreset[] = [];
  for (const name of presetNames()) {
    if (!/^[a-z][a-z-]*$/.test(name)) continue;
    let failed = false;
    const effects: Effect[] = parseFx(name, () => (failed = true));
    if (failed || !effects.length) continue;
    if (effects.some((e) => e.own !== null || e.duration === null || e.viewRange)) continue;
    const duration = Math.max(...effects.map((e) => e.duration ?? 0));
    const used = usedProps(effects, 'all');
    const frames = sampleKeyframes(
      effects,
      'all',
      (f) => frameCss(f, used),
      identityFrame(),
      SAMPLES
    );
    const body = frames
      .map(({ offset, ...css }) => {
        const decl = Object.entries(css)
          .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${String(v)}`)
          .join(';');
        return `${Math.round((offset as number) * 1e4) / 100}%{${decl}}`;
      })
      .join('');
    out.push({ name, duration, css: `@keyframes ${BOOT_PREFIX}${name}{${body}}` });
  }
  return out;
}

let cached: string | null = null;

/** The whole boot stylesheet. Pure: also run at build time to write cineview.css. */
export function bootCss(): string {
  if (cached !== null) return cached;
  const presets = bootPresets();
  const eligible = presets.map((p) => `[fx="${p.name}" i]`).join(',');
  const qualifies = `:is(${eligible})${not(DISQUALIFY)}`;
  const animated = 'cv-animate:is([fx],[from])';
  // Every animated element of the scene qualifies (`:has` is in the baseline).
  const bootScene = `.cv-js ${FIRST}${not(SCENE_DISQUALIFY)}:not(:has(${animated}:not(${qualifies})))`;
  let css =
    '@property --cv-unit{syntax:"<length>";inherits:true;initial-value:1px}' +
    // Sentinel the module reads to skip injecting these rules a second time.
    ':root{--cv-boot:1}' +
    'cv-stage,cv-scene,cv-animate{display:block}' +
    'cv-stage{--cv-dw:750}' +
    'cv-scene{--cv-unit:calc(min(100cqi,var(--cv-dw) * 1px) / var(--cv-dw))}' +
    'cv-pause{cursor:pointer}' +
    'cv-stage[input=drag]{position:fixed;inset:0;overflow:hidden}' +
    'cv-stage[input=drag]>cv-scene{position:absolute;inset:0}' +
    'cv-stage[input=drag]>cv-scene:nth-of-type(2){translate:0 100%}' +
    'cv-stage[input=drag]>cv-scene:nth-of-type(n+3){content-visibility:hidden}' +
    `@keyframes cv-failsafe{from{opacity:0}to{opacity:1}}` +
    `.cv-js ${FIRST} ${animated}:not([on]):not([data-cv-live]){animation:cv-failsafe 1ms ${FAILSAFE_DELAY}ms both}`;
  let rules = '';
  for (const p of presets) {
    css += p.css;
    rules += `${bootScene} cv-animate[fx="${p.name}" i]${not(DISQUALIFY)}:not([data-cv-live]){animation:${BOOT_PREFIX}${p.name} ${p.duration}ms linear both}`;
  }
  css += `@media (prefers-reduced-motion:no-preference){${rules}}`;
  return (cached = css);
}

/**
 * The head snippet: marks `.cv-js` when the browser meets the baseline (Safari 16.4, Chrome 111,
 * Firefox 128: `:has`, `lh`, `color-mix`). Inline it in <head> before cineview.css.
 */
export const HEAD_SNIPPET =
  "(function(s){if(s&&s('selector(:has(*))')&&s('width:1lh')&&s('color:color-mix(in srgb,red,red)'))document.documentElement.classList.add('cv-js')})(window.CSS&&CSS.supports);";

/** The CSS-first entrance running on this element, or null when none runs. */
function bootAnimation(el: Element): Animation | null {
  for (const a of el.getAnimations()) {
    const name = (a as CSSAnimation).animationName;
    if (typeof name === 'string' && name.startsWith(BOOT_PREFIX)) return a;
  }
  return null;
}

/** Elapsed time (ms) of a CSS-first entrance, on its timeline's clock. */
function elapsedOf(a: Animation): number {
  const t = a.currentTime;
  const local = typeof t === 'number' ? t : t === null ? 0 : Number(t.to('ms').value);
  return local - Number(a.effect?.getTiming().delay ?? 0);
}

/** When the CSS-first entrance started (performance.now() scale); null when none runs. */
let bootStart: number | null = null;
const shifted = new Set<HTMLElement>();

/**
 * Call before the elements upgrade. Attaching a shadow root to an ancestor restarts the CSS
 * animations below it in Blink (WebKit keeps them), and the stage and scenes attach theirs on
 * upgrade. So note when the CSS-first entrance started, and return a function that puts restarted
 * animations back in step (a negative animation-delay) right after the upgrade, in the same task.
 */
export function captureBoot(): () => void {
  const els = [
    ...document.querySelectorAll<HTMLElement>(`${FIRST} cv-animate:not([data-cv-live])`),
  ];
  // Animation time follows the document timeline, which holds still between rendering updates:
  // measured against performance.now(), the start would come out late by the time since the last
  // update, and the adopted entrance would step back by as much.
  const timeline = document.timeline.currentTime;
  const now = typeof timeline === 'number' ? timeline : performance.now();
  const running = els.map(bootAnimation);
  for (const a of running) {
    if (a) bootStart = Math.min(bootStart ?? now, now - elapsedOf(a));
  }
  return () => {
    if (bootStart === null) return;
    const elapsed = performance.now() - bootStart;
    for (const [i, el] of els.entries()) {
      const a = bootAnimation(el);
      // The same animation kept running: a negative delay would move it ahead of the clock.
      if (!a || a === running[i]) continue;
      el.style.animationDelay = `${-elapsed}ms`;
      shifted.add(el);
    }
  };
}

/**
 * Adopt the CSS-first entrance: how far in it is (ms), once. The caller sets `data-cv-live` on the
 * elements in the same task, which drops the CSS animation.
 */
export function adoptBoot(): number {
  const offset = bootStart === null ? 0 : performance.now() - bootStart;
  bootStart = null;
  for (const el of shifted) el.style.removeProperty('animation-delay');
  shifted.clear();
  return offset;
}
