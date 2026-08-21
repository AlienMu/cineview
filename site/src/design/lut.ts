// 柔彩 LUT 色带：全站滚动总进度 → 上下双端渐变色 + 当前镜头强调色。
// 停靠点在 tokens.css 中定义两端色；这里在相邻停靠点间线性插值。
//
// 初版机制还原（2026-08-13，用户裁决「只还原这个」）：源自 2026-06-30 站点设计
// task-flow（「全站总进度驱动 + 上下双端 linear-gradient 插值 + 停靠点数组可配」），
// f164470 快照中的本文件 + BackgroundRibbon + useScrollProgress 即该机制。
// C1（2026-08-10）曾以 600vh 色带 + 明度纱替换整套，因用户多轮报障（灰粉交替闪烁、
// 30MB 提层、无 accent 流动）于 2026-08-13 还原。
//
// 停靠点按用户三轮裁决重定：**全程暖色、单向流动、无粉**（原版的暖珊瑚/暖玫瑰
// 两个偏粉停靠被换为琥珀金/陶土橙）。accent = 每段加深一档的「当前镜头色」，
// 由 BackgroundRibbon 写入 :root，滚动条/按钮/选区随滚动流动。
// 2026-08-14 追加裁决：首屏锚回 f164470 奶白桃（#fcede4/#faf8f4，蜜桃调非灰粉），
// 与 08-13 拔掉的「灰粉交替闪烁」不同源；其余五锚维持琥珀/陶土链。

interface LutStop {
  at: number; // 0..1 滚动位置
  top: string; // 渐变上端
  bot: string; // 渐变下端
  accent: string; // 当前镜头强调色
  accentInk: string; // 强调色深一档(文字/focus)
}

const LUT: LutStop[] = [
  /* 首屏锚沿革：08-14 回 f164470 原值 #fcede4（实测更白）→ 08-16 暖桃 #fbe8d4
   * （用户仍判冷）→ 现按用户指令「参照胶带边缘的颜色」：以 act2 胶带基边的
   * accent 家族（实测 #ca8a4c，hue≈33° 琥珀陶土）为色相基准调亮——top #f8e3c6
   * （R−B=50）/ bot #f9eee0（R−B=25），与 0.2 停靠（#f7e3c8/#faf3e7）平滑衔接。
   * 其余五锚不动。 */
  { at: 0.0, top: '#f8e3c6', bot: '#f9eee0', accent: '#d59273', accentInk: '#a86247' }, // 暖蜜桃(胶带族)
  { at: 0.2, top: '#f7e3c8', bot: '#faf3e7', accent: '#cf8a56', accentInk: '#a2603f' }, // 暖杏
  { at: 0.4, top: '#f6d9ae', bot: '#faf1e0', accent: '#c98a4a', accentInk: '#985f30' }, // 琥珀金
  { at: 0.6, top: '#eec49c', bot: '#f8ebdc', accent: '#b07f4e', accentInk: '#855c36' }, // 暖陶土
  { at: 0.8, top: '#e9be9c', bot: '#f7e6d8', accent: '#a9713f', accentInk: '#7d522c' }, // 陶土橙
  { at: 1.0, top: '#f2d6c0', bot: '#f9efe4', accent: '#b5824f', accentInk: '#8a6038' }, // 奶油收尾
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
