// Soft-color LUT ribbon: site-wide scroll progress → dual-end gradient colors + current shot accent color.
// Anchor points define the two end colors in tokens.css; this file linearly interpolates between adjacent anchors.
//
// Initial mechanism restoration (2026-08-13, user verdict "restore only this"): originated from 2026-06-30 site design
// task-flow ("site-wide total progress drives + dual-end linear-gradient interpolation + configurable anchor array"),
// this file + BackgroundRibbon + useScrollProgress from f164470 snapshot comprise that mechanism.
// C1 (2026-08-10) replaced the entire system with a 600vh ribbon + luminance veil, then due to multiple user-reported
// issues (gray-pink alternating flicker, 30MB layer promotion, no accent flow) was restored on 2026-08-13.
//
// Anchor points redefined per three user verdicts: **all-warm, unidirectional flow, no pink** (original warm coral/warm rose
// two pinkish anchors replaced with amber gold/terracotta orange). accent = "current shot color" one stop darker per segment,
// written to :root by BackgroundRibbon, scrollbar/buttons/selection flow with scroll.
// 2026-08-14 additional verdict: first-screen anchor back to f164470 creamy peach (#fcede4/#faf8f4, peach tone not gray-pink),
// different origin from "gray-pink alternating flicker" removed on 08-13; remaining five anchors maintain amber/terracotta chain.

interface LutStop {
  at: number; // 0..1 scroll position
  top: string; // gradient top end
  bot: string; // gradient bottom end
  accent: string; // current shot accent color
  accentInk: string; // accent color one stop darker (text/focus)
}

const LUT: LutStop[] = [
  /* First-screen anchor evolution: 08-14 back to f164470 original #fcede4 (tested whiter) → 08-16 warm peach #fbe8d4
   * (user still judged cold) → now per user directive "reference the tape edge color": using act2 tape base edge
   * accent family (tested #ca8a4c, hue≈33° amber terracotta) as hue baseline, brightened—top #f8e3c6
   * (R−B=50) / bot #f9eee0 (R−B=25), smoothly connects with 0.2 anchor (#f7e3c8/#faf3e7).
   * Remaining five anchors unchanged. */
  { at: 0.0, top: '#f7dfbd', bot: '#fcf1e3', accent: '#d59273', accentInk: '#9e6344' },
  { at: 0.2, top: '#f6dbb8', bot: '#fbefdf', accent: '#cf8a56', accentInk: '#995c3d' },
  { at: 0.4, top: '#f3d0a2', bot: '#faead5', accent: '#c47d44', accentInk: '#8e542f' },
  { at: 0.6, top: '#edc89f', bot: '#f8e8d5', accent: '#b36e3c', accentInk: '#814b2d' },
  { at: 0.8, top: '#e8c4a1', bot: '#f6e3d0', accent: '#a9623d', accentInk: '#794329' },
  { at: 1.0, top: '#f1d5ba', bot: '#fbefe1', accent: '#b9784a', accentInk: '#885435' },
];

const HOME_LUT: LutStop[] = [
  { at: 0.0, top: '#f2dcc2', bot: '#fff9ef', accent: '#d59273', accentInk: '#994f36' },
  { at: 0.2, top: '#f5e3cc', bot: '#fff9ef', accent: '#d59273', accentInk: '#994f36' },
  { at: 0.4, top: '#faeddb', bot: '#fffaf3', accent: '#d59273', accentInk: '#994f36' },
  { at: 0.6, top: '#f6e3ca', bot: '#fff9ef', accent: '#d59273', accentInk: '#994f36' },
  { at: 0.8, top: '#f9ebd8', bot: '#fff9ef', accent: '#d59273', accentInk: '#994f36' },
  { at: 1.0, top: '#f2dcc2', bot: '#fff9ef', accent: '#d59273', accentInk: '#994f36' },
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number): string => Math.round(n).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export interface LutColors {
  top: string;
  bot: string;
  accent: string;
  accentInk: string;
}

export function lutAt(progress: number, homepage = false): LutColors {
  const stops = homepage ? HOME_LUT : LUT;
  const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;

  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i].at && p <= stops[i + 1].at) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }

  const span = hi.at - lo.at;
  const t = span > 0 ? (p - lo.at) / span : 0;

  return {
    top: lerpHex(lo.top, hi.top, t),
    bot: lerpHex(lo.bot, hi.bot, t),
    accent: lerpHex(lo.accent, hi.accent, t),
    accentInk: lerpHex(lo.accentInk, hi.accentInk, t),
  };
}
