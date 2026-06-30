// 柔彩 LUT 色带:全站滚动总进度 → 上下双端渐变色 + 当前镜头强调色。
// 停靠点在 tokens.css 中定义两端色;这里在相邻停靠点间线性插值。

interface LutStop {
  at: number; // 0..1 滚动位置
  top: string; // 渐变上端
  bot: string; // 渐变下端
  accent: string; // 当前镜头强调色
  accentInk: string; // 强调色深一档(文字/focus)
}

// 与 tokens.css 的 --lut-* 对应。accent 取每段一个加深的"当前镜头色"。
// 第二幕(胶片带 SHOT1 + 舞台 SHOT2)几乎占满全程滚动(SHOT2 尾部到 ~0.98),故 LUT **全程暖色**,
// 在暖色内部缓慢流动色相(奶白桃 → 暖杏 → 暖珊瑚 → 暖玫瑰 → 暖琥珀 → 暖褐),
// 每幕都看得出颜色在替换、又始终暖、与陶土胶带契合;accent-ink 全程暖 → SHOT2 标题斜体也是暖褐。
const LUT: LutStop[] = [
  { at: 0.0, top: '#fcede4', bot: '#faf8f4', accent: '#d59273', accentInk: '#a86247' }, // 奶白桃
  { at: 0.2, top: '#fbe6d8', bot: '#f9f2ea', accent: '#dd8a5e', accentInk: '#a85e38' }, // 暖杏
  { at: 0.4, top: '#f9dfd2', bot: '#f7efe6', accent: '#d97a5a', accentInk: '#a5533a' }, // 暖珊瑚
  { at: 0.6, top: '#f6dbd4', bot: '#f6ede8', accent: '#cf6f60', accentInk: '#9c4e42' }, // 暖玫瑰
  { at: 0.8, top: '#f6e0cd', bot: '#f6efe4', accent: '#c9834a', accentInk: '#985f30' }, // 暖琥珀/金
  { at: 1.0, top: '#f2dcc7', bot: '#f5ece1', accent: '#bd7742', accentInk: '#925733' }, // 暖褐
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.round(n).toString(16).padStart(2, '0');
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

export function lutAt(progress: number): LutColors {
  const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;

  let lo = LUT[0];
  let hi = LUT[LUT.length - 1];
  for (let i = 0; i < LUT.length - 1; i++) {
    if (p >= LUT[i].at && p <= LUT[i + 1].at) {
      lo = LUT[i];
      hi = LUT[i + 1];
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
