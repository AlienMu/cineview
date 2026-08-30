import { useMemo } from 'react';
import { Animate, Position } from 'cineview';
import { useI18n } from '../i18n';
import { useDesignCanvasHeight } from '../hooks/useDesignCanvasHeight';
import type { DictKey } from '../i18n/types';
import { TimecodeAxis } from './TimecodeAxis';
import { SplitTitle, solidVariant } from './CapabilityScene';
import {
  IconDolly,
  IconFilmRoll,
  IconAperture,
  IconClapper,
  IconZoomLens,
  IconBlur,
} from './CapabilityIcons';
import './Act3DollyScene.css';

/**
 * 第三幕 · 视频推进（dolly in） — 2026-08-04
 * 规格：task-flow 2026-08-04-home-continuous-bg-act3-dolly.md（D6，v2 修订）
 *
 * ── 运动模型（v4，2026-08-15 用户指令「时间轴反向重排：标题开局显影，panel 运动倒放」）──
 * 标题**开局显影**（虚焦→实焦，0→900ms），常驻整幕、永不退场，z 序在所有 panel 之上。
 * 六个 panel 逐块接力「运动倒放」：每块在自己的相位窗起点从**画布正中、scale=peak、
 * 铺满画面**处带淡入出现（峰值起点沿用了 forward 末段的轻微失焦，读作「倒放着地前
 * 微糊、退到位清晰」），然后一边缩小、一边**退回自己的散落位**（scale=base、x/y 归零），
 * 落位后静息常驻直到本幕结束。
 *
 *     initial: { x: →中心,  y: →中心,  scale: peak, opacity: 0 }
 *     animate: { x: →0vw,  y: →0vw,  scale: peak→base, opacity: 0→1 常驻 }
 *
 * 各版差别（都由用户裁决，保留以免再犯）：
 *   v1 向外扩张（终点位移 = 起点 × K）—— 摄影机推近、边缘物体被推出画框。**已否**。
 *   v2 原位放大（x/y 恒 0）—— 主体在自己的位置上涨大到铺满。**已被 v3 取代**。
 *   v3 朝心汇聚（0→8200ms panel 接力、8200ms 后标题收尾显影）—— **已被 v4 取代**。
 *   v4 倒放重排（本版）—— 标题开局显影常驻，panel 从中心峰值退回散落位，接力密度
 *       沿用 v3 的 DOLLY_STEP；总预算 SHOT3_CLOCK_MS 不变，纯相位/次序重排。
 *
 * 平移单位用 `vw`：设计画布宽 1440 ⇒ 1 设计 px = 1/14.4 vw，**桌面与手机同一把尺**
 * （认宽不认高）。x/y 在框架 10 属性白名单内，故仍由 Animate lane 拥有，site 侧
 * 不自建驱动。数据仍只有每块一组 x/y/base/tilt + 尺寸，零运行时 layout 测量。
 *
 * peak 由 `resolvePeakScale()` 算：终点既然在正中，就只需「把自身撑到盖满画布」，
 * 不再需要旧版那个「块心到最远角」的 reach 项（那是为原位放大算的）。
 *
 * ── z 序（易错点，2026-08-06 修；2026-08-15 v4 反转方向）──────────────────
 * panel 有实体底板，倒放起点铺满整个画布，会盖住其他块。正在退回的那块必须在
 * **最上层**。v3（正放）里已演完的块早已淡出，z 取 `6 - index` 无妨；v4 里已着地的
 * 块**常驻可见**（opacity 1），若沿用 `6 - index`，先着地的块会压在正在退回的巨型块
 * 之上。故 z 取 `index + 1`：出場越晚 z 越高，正在退回的块恒在所有已着地块之上。
 * 标题常驻但**不在 panel 之上**（2026-08-15 用户裁决）：标题 Position 不带 z-index
 * （z auto，低于所有带正 z 的 panel）——峰值 panel 从标题前面穿过；重叠由字号缩小
 * 消解（.act3-titleblock .cap-title → --text-2xl）。z-index 用静态值而非动画
 * 驱动——z-index 不在框架 10 属性白名单内，且这里根本不需要动。
 *
 * ⚠️ **z-index 必须挂在 `Position` 上，不能挂在 `.a3-panel` 上**（首版的 bug）：
 * `.a3-panel` 之上有两层各自创建层叠上下文的祖先 —— `.cineview-animate`（Animate 的
 * transform）与 `Position` 的 wrapper（居中 transform），两者 `z-index` 都是 `auto`。
 * 层叠上下文会**囚禁**内部的 z-index：`.a3-panel` 的 z 只在它自己那层里比较，
 * 跨块之间实际按 **DOM 序**绘制 ⇒ DOM 末位恒在最上，`zIndex: 6-index` 是死代码。
 * 实测（`_zpaint4.mjs` 四步证伪）：f=0.10 时 01 号正在放大却被 02 号盖住；
 * 抬 `.a3-panel` 的 z 到 9999 无变化、抬 `.cineview-animate` 无变化、
 * 抬 `Position` wrapper **才生效**。
 * `Position.tsx:136` 的 `positionStyle` 是 `{...style, position, left, top, ...}` ——
 * `style` 先展开且 `zIndex` 不在其后的覆盖列表里，故 `style={{ zIndex }}` 安全。
 *
 * ── 框架边界（勿越）────────────────────────────────────────────────────
 * - scale/opacity/filter 全部由 Animate lane 拥有；site 侧不 import framer-motion、
 *   不自建 rAF、不每帧 setState（CLAUDE.md 规则 6 第二条 / 规则 2）。
 * - panel **无常驻动效**：推进本身就是运动，再叠 6 条 loopAnimation 是纯开销。
 * - 尺寸/位置一律走 --cv-u 单尺子（认宽不认高），窄屏等比收窄。
 */

/* ── 时间预算（v4 倒放重排；总 10000ms 不变）───────────────────────────
 * 标题显影 0→900（开局），落定后常驻到本幕结束（progress 钳在 1）。
 * panel 接力段 0→8200：每块 2000ms，下一块在前一块行程 62% 处起 —— v3 的
 * 接力密度原样保留（倒放只是把每块的行程镜像，不改变谁何时起跑）。
 * 反解：末块结束 = DOLLY_MS * (1 + 5*0.62) = 4.1 * DOLLY_MS = 8200 → DOLLY_MS = 2000。 */
const DOLLY_MS = 2000;
const DOLLY_STEP = Math.round(DOLLY_MS * 0.62); // 1240
const TITLE_MS = 900;
/* 2026-08-16 用户报障「动画完成后还要无效滚动一截」：v4 反向重排把标题挪到
 * 开局后，8200ms（BLOCKS_END）起整幕静息但 zone 仍锁到 10000——那是旧布局给
 * 收尾标题留的窗口，现已空转。收到 8700 = 动画终点 + 500ms 静息读拍。
 * 分数关键帧全由绝对 ms 推导，收预算不错位。 */
const SHOT3_CLOCK_MS = 8700;

/** 设计画布（HomeSceneCanvas 的 Container 基准）。 */
const CANVAS_W = 1440;
const CANVAS_H = 900;

/** 倒放起点的轻微失焦：峰值「落地」前微糊、退回散落位后清晰（对焦语汇的倒放）。 */
const DOLLY_BLUR_OUT = 'blur(0.34vw)';

/**
 * 六块 panel：位置（相对画布中心的设计 px）+ 静息缩放 base + 盒尺寸。
 * base 刻意各不相同（0.62–0.86）→ 满足「大小不一致地出现在那」。
 *
 * ⚠️ 布局硬约束（首版实测踩到）：左上角有常驻 chrome —— REC 时间码胶囊
 * （y≈100–137）+ 镜号 slate（`.cap-slate`，top:92*cv-u、left:80*cv-u），
 * 右上角有语言切换。panel 静息态**不得压住它们**：安全区 y ≥ 190、
 * 右上角避开 x > 1340。首版把 chain 放在 y=-256（顶边落到 84），
 * 直接盖住了 REC 与 slate。
 *
 * ⚠️ 底边约束（1280×700 实测）：设计画布是 1440×900，按「认宽不认高」换算，窄高视口下
 * 画布高会**超过**视口高（1280 宽 → 画布高 800 > 700），画布底部被裁。底排 panel 的 y
 * 必须留出这份裁切余量，否则短屏上底排贴边/被切。故底排取 |y| ≤ 220（1280×700 实测
 * 底边余量 ≈ 32px）。
 *
 * ── 散落（2026-08-06 用户指令：「排列不要这么整齐，再凌乱一点，需要大小不一致」）──
 * 旧数据是三列共用 x ∈ {-470, 0, 460}、两排共用 |y| ≈ {128–148, 188–218} ⇒ 读成规整网格。
 * 现在**六块 x/y 全不相同、不共列不共排**；另给每块一个静态 tilt（±0.9°–2.4°）打破
 * 「所有边互相平行」的机械感。tilt 是静态 CSS 变量（`--a3-tilt`），不进每帧路径。
 *
 * 大小跨度是实测驱动的：旧 base 0.62–0.86 × 盒宽 356–404 ⇒ 渲染宽只有 **241–306px
 * （1.27×）**，所以六块看起来一样大。现在 base 0.58–1.02 × 盒宽 320–430 ⇒ 渲染宽
 * **186–439px（2.36×）**，大小差异一眼可辨。
 *
 * 中间留白留给常驻标题（v4：标题开局显影后整幕在场；panel 静息后不挡标题，
 * 倒放路径穿过中心由 z 序化解——标题恒在所有 panel 之上）。
 * 顺序 = 出场顺序，视线仍大致走 Z 字，但不再落在整齐的行列上。
 */
const PANELS_DESKTOP = [
  { id: 'chain', x: -486, y: -110, base: 1.02, w: 404, h: 278, tilt: -1.6, Icon: IconDolly },
  /* 2026-08-15 用户指令「错峰级联往右上挪一点」：-78/-190 → +30/-240（更右更上，
   * 仍高于标题带顶缘——titleY 372 + 两行标题半高后 y≈-70 为界，stagger 盒底
   * -138 不侵入）。 */
  { id: 'stagger', x: 30, y: -240, base: 0.68, w: 356, h: 300, tilt: 2.1, Icon: IconFilmRoll },
  { id: 'position', x: -512, y: 190, base: 0.9, w: 366, h: 250, tilt: 1.2, Icon: IconAperture },
  { id: 'container', x: 488, y: -166, base: 0.72, w: 430, h: 262, tilt: -0.9, Icon: IconZoomLens },
  /* 2026-08-16 用户指令「资源预加载 panel 调大一点」：base 0.58→0.74（渲染宽
   * 186→237px）。新盒 x -23..211 / y 120..336：右缘 211 < scrub 左缘 253 ✓，
   * 底缘 336 < 标题带顶 370 ✓，与 chain/position 无横向交集 ✓。 */
  { id: 'image', x: 96, y: 228, base: 0.74, w: 320, h: 292, tilt: -2.4, Icon: IconBlur },
  { id: 'scrub', x: 440, y: 142, base: 0.96, w: 390, h: 262, tilt: 1.7, Icon: IconClapper },
] as const;

type PanelId = (typeof PANELS_DESKTOP)[number]['id'];

/** 一块 panel 的布局数据（桌面为常量、手机按画布高算出）。 */
interface PanelLayout {
  id: PanelId;
  x: number;
  y: number;
  base: number;
  w: number;
  h: number;
  /** 静态倾斜角（deg），破「边全平行」的机械感；不进每帧路径。 */
  tilt: number;
  Icon: (typeof PANELS_DESKTOP)[number]['Icon'];
}

/**
 * 手机版（≤600 宽）六块布局：**2 列 × 3 行**，用满竖屏。
 *
 * 为什么不能沿用桌面的 3 列散落：390 宽时 u=0.2708，桌面盒宽 392 设计 px 只有 106 screen px，
 * 字号 15 设计 px 只有 4px —— 六块成了六团灰雾（用户实测截图否掉）。手机要可读就必须
 * **放大设计 px**（本函数把盒宽提到 730、字号在 CSS 里提到 64），而放大后 3 列排不下，
 * 故改 2 列 ×3 行。块数仍是 6（用户明确要求不减）。
 *
 * y / h 按 `designH` **取比例**而非写死设计 px：手机画布高 = 一个视口高，随机型宽高比变
 * （390×844 → 3116；375×667 → 2561）。写死会在矮机型（aspect 1.78）上让行距小于盒高、
 * 三排互相叠上，或底排被裁。取比例后无论机型，行距恒 0.24H > 最大渲染高 0.224H。
 *
 * 「大小不一 + 凌乱」在手机上的实现与桌面不同（2026-08-06）：**列数不能动** ——
 * 2 列 ×3 行是可读性硬约束（390 宽下 3 列已被用户实测截图否掉，见上）。所以：
 *   - 宽度：base 0.56–0.98（1.75×），受列宽卡死，不能再宽；
 *   - 高度：额外给每块一个 `hf` 0.90–1.00，让**面积**跨度 = base² × hf 拉到 ~3×；
 *   - 位置：x/y 各自小幅抖动 + 逐块 tilt，破掉「严丝合缝的方阵」。
 * 抖动幅度由余量反推（见函数体注释），不是凭手感给的 —— 首版凭手感给 ±0.016H
 * 直接把两块抖到重叠。
 * 出场顺序仍是 Z 字：左上 → 右上 → 左中 → 右中 → 左下 → 右下。
 */
function buildPhonePanels(designH: number): PanelLayout[] {
  const COL_X = 344; // 列心距画布中心的设计 px
  const BOX_W = 700; // 盒宽；渲染宽 = 700 × base = 392–686 设计 px
  const BOX_H = designH * 0.222; // 盒高基准（逐块再乘 hf）
  const ROW_Y = [-0.29, -0.05, 0.19].map((f) => Math.round(designH * f));
  const JY_MAX = 0.008; // y 抖动上限（designH 的比例），见下方余量推导
  /* 横向余量：max(base)=0.98 ⇒ 半宽 700×0.98/2 = 343；343 + COL_X 344 + |jx|≤26 = 713
     < 720（画布半宽）⇒ 四边不出界。
     纵向余量：行距 0.24H；最大渲染高 = 0.222H × max(hf)=1.0 × max(base)=0.98 ≈ 0.218H
     ⇒ 净余量 0.022H ≈ 68px（designH=3116）。相邻两块各偏 ±0.008H = ±25px，
     最坏同时相向 50px < 68px ⇒ 仍留 18px 净空。
     ⚠️ 首版取 BOX_H=0.26H + jy 到 ±0.016H，净余量只有 19px 却抖了 ±50px ⇒
     04×06 实测重叠 2px。教训：抖动幅度必须由余量反推，不能凭手感给。 */
  const spec = [
    {
      id: 'chain',
      col: -1,
      row: 0,
      base: 0.98,
      hf: 0.94,
      jx: -16,
      jy: -0.006,
      tilt: -1.5,
      Icon: IconDolly,
    },
    {
      id: 'stagger',
      col: 1,
      row: 0,
      base: 0.62,
      hf: 1.0,
      jx: 20,
      jy: 0.007,
      tilt: 2,
      Icon: IconFilmRoll,
    },
    {
      id: 'position',
      col: -1,
      row: 1,
      base: 0.74,
      hf: 0.9,
      jx: 24,
      jy: -0.005,
      tilt: 1.3,
      Icon: IconAperture,
    },
    {
      id: 'container',
      col: 1,
      row: 1,
      base: 0.9,
      hf: 0.96,
      jx: -12,
      jy: 0.006,
      tilt: -0.9,
      Icon: IconZoomLens,
    },
    {
      id: 'image',
      col: -1,
      row: 2,
      base: 0.56,
      hf: 0.98,
      jx: -22,
      jy: 0.005,
      tilt: -2.2,
      Icon: IconBlur,
    },
    {
      id: 'scrub',
      col: 1,
      row: 2,
      base: 0.82,
      hf: 0.92,
      jx: 14,
      jy: -0.007,
      tilt: 1.6,
      Icon: IconClapper,
    },
  ] as const;
  return spec.map((s) => ({
    id: s.id,
    x: s.col * COL_X + s.jx,
    y: ROW_Y[s.row] + Math.round(designH * Math.max(-JY_MAX, Math.min(JY_MAX, s.jy))),
    base: s.base,
    w: BOX_W,
    // 逐块 hf：手机是 2 列固定栅格，宽度可变范围被列宽卡死，故让**高度**也参与
    // 「大小不一」——面积跨度 = base² × hf，比只调 base 拉得开。
    h: Math.round(BOX_H * s.hf),
    tilt: s.tilt,
    Icon: s.Icon,
  }));
}

/** 设计 px → vw（画布宽 1440 = 100vw，认宽不认高，桌面手机同一把尺）。 */
function designPxToVw(px: number): string {
  return `${Math.round((px / (CANVAS_W / 100)) * 1000) / 1000}vw`;
}

/**
 * 该块要「占据整个屏幕」需要的缩放。
 *
 * v3 起终点落在**画布正中**（见文件头运动模型），所以只需「把自身宽/高撑到盖满画布」，
 * 不再需要 v2 那个 `reach` 项（`|x| + canvasW/2` 反解「块心到最远角」）—— 那是为
 * 「原位放大、块心停在偏心位置」算的。去掉后 peak 从 3.66–4.98 降到 3.35–4.30，
 * 放大末段的 overdraw 与 blur 面积同步下降。
 *
 * 两轴都要够（取 max）：panel 长宽比与画布不同，只保证较紧那一轴会让另一轴漏底
 * （v2 实测踩过：stagger 372×288 只放到 1272×985，两侧漏出底色，读成「没铺满」）。
 *
 * `FILL` 取 1.06 而非 1.0：每块带静态 tilt（±0.9°–2.4°），旋转后的外接盒略大于
 * `w×h`，留 6% 余量确保四边不漏。2.4° 的外接盒增量约 `sin(2.4°)×h/w ≈ 3%`，6% 有富余。
 *
 * `canvasH` 是形参而非模块常量：手机版画布高 = 一个视口高（随机型宽高比变，
 * 390×844 → 3116 设计 px），桌面恒 900。仍是纯函数。
 */
function resolvePeakScale(w: number, h: number, canvasH: number): number {
  const FILL = 1.06;
  const fillScale = Math.max((CANVAS_W * FILL) / w, (canvasH * FILL) / h);
  return Math.round(fillScale * 100) / 100;
}

/**
 * 单块倒放变体（v4，v3 朝心汇聚的逐帧镜像）。四段（times 全属性对齐，共用同一进度轴）：
 *   0 → .26  峰值起点：铺满画布、带淡入，起点沿末段轻微失焦（倒放着地前微糊）
 *   .26 → .7 一边缩小回 base、一边从画布中心退回自己的散落位，渐至全程清晰
 *   .7 → 1   落位：静息位置与尺寸，opacity 1 常驻（「读内容」的时间搬到了结尾）
 *
 * 镜像规则：v3 关键帧 times [0,.30,.74,1] / 值 [静息→峰值] 反序即得
 * times [0,.26,.70,1] / 值 [峰值→静息]。opacity 反序后 [0,.92,1,1]：
 * 首段淡入（可带），其后恒 ≥0.9 常驻。
 *
 * `x/y` 从 `-(块心偏移)`（= 块心落在画布中心）走回 `0vw`（= 回到自己的散落位）。
 * 单位全程用 vw（不要混 px 与 vw，framer-motion 无法在异单位间插值）。
 * 中间关键帧保持 v3 的 0.55 配比（反向读作「先退出画心、再落回自己的位置」）。
 */
function dollyVariant(
  base: number,
  peak: number,
  x: number,
  y: number
): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  const times = [0, 0.26, 0.7, 1];
  const midX = designPxToVw(-x * 0.55);
  const midY = designPxToVw(-y * 0.55);
  const startX = designPxToVw(-x);
  const startY = designPxToVw(-y);
  return {
    initial: { x: startX, y: startY, scale: peak, opacity: 0, filter: DOLLY_BLUR_OUT },
    animate: {
      x: [startX, midX, '0vw', '0vw'],
      y: [startY, midY, '0vw', '0vw'],
      scale: [peak, base + (peak - base) * 0.52, base, base],
      /* 2026-08-16 还原验证：昨日「加快淡入」是在 will-change 未除时的对症猜测
       * （真凶是六层永久提升层的 4.3× 逐帧重光栅，已删）。还原 v3 逐帧镜像的
       * 原时序——26% 行程淡入 + 0.92 平台（柔和交叉溶解，正放淡出的忠实倒放）；
       * will-change 已删的前提下复测长帧仍 0 则保留还原版。 */
      opacity: [0, 0.92, 1, 1],
      filter: [DOLLY_BLUR_OUT, 'blur(0vw)', 'blur(0vw)', 'blur(0vw)'],
      transition: {
        x: { times },
        y: { times },
        scale: { times },
        opacity: { times },
        filter: { times },
      },
    },
  };
}

/** 开局标题：中心显影（虚焦 → 实焦 + 轻微放大），与第四幕视频的对焦语汇同源；
 * 显影后常驻整幕（progress 钳在 1，永不退场）。
 * 2026-08-14(审计 act3-3):blur 起点 0.55vw→0.42vw、scaleFrom 0.92→0.95——
 * reveal 前 20% 行程的糊影偏「肉」,起点清晰度抬一点让观众更早开始读标题
 * (en 两行标题收益更大)。times 结构/TITLE_MS 不动。 */
function developVariant(scaleFrom: number): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: 0, scale: scaleFrom, filter: 'blur(0.42vw)' },
    animate: {
      opacity: [0, 1, 1],
      scale: [scaleFrom, 1, 1],
      filter: ['blur(0.42vw)', 'blur(0vw)', 'blur(0vw)'],
      transition: {
        opacity: { times: [0, 0.72, 1] },
        scale: { times: [0, 0.72, 1] },
        filter: { times: [0, 0.72, 1] },
      },
    },
  };
}

/* ── panel 内容：每块一套「像真的 UI」的示意图 ──────────────────────────
 * 全部是静态 DOM（无动效）：放大时靠 panel 整体 scale 一起放大，细节随之变清楚，
 * 正是「一张图片在原位放大」的观感。用 em 单位跟随 panel 字号等比缩放。 */

/** after：三节点链，前一个完成才轮下一个。 */
function ChainBody(): JSX.Element {
  const rows = [
    { name: 'title', wait: '—', on: true },
    { name: 'subtitle', wait: 'title', on: true },
    { name: 'body', wait: 'subtitle', on: false },
  ];
  return (
    <div className="a3-chain">
      {rows.map((r, i) => (
        <div key={r.name} className="a3-chain__row">
          <span className={`a3-chain__dot${r.on ? ' is-on' : ''}`} />
          <span className="a3-chain__name">{r.name}</span>
          <span className="a3-chain__wait">after: {r.wait}</span>
          {i < rows.length - 1 ? <span className="a3-chain__wire" /> : null}
        </div>
      ))}
    </div>
  );
}

/** stagger：六格错峰，逐格延后。 */
function StaggerBody(): JSX.Element {
  return (
    <div className="a3-stagger">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="a3-stagger__cell" style={{ opacity: 1 - i * 0.14 }}>
          <span className="a3-stagger__bar" style={{ height: `${34 + i * 9}%` }} />
          <span className="a3-stagger__tick">{i * 80}</span>
        </div>
      ))}
    </div>
  );
}

/** Position：坐标十字 + 落点卡。 */
function PositionBody(): JSX.Element {
  return (
    <div className="a3-coord">
      <span className="a3-coord__axis a3-coord__axis--x" />
      <span className="a3-coord__axis a3-coord__axis--y" />
      <span className="a3-coord__pin" />
      <span className="a3-coord__label">x 480 · y 220</span>
      <span className="a3-coord__unit">1 unit = vw / 1440</span>
    </div>
  );
}

/** Container：盒模型换算，标注设计 px → vw。 */
function ContainerBody(): JSX.Element {
  return (
    <div className="a3-box">
      <span className="a3-box__outer">
        <span className="a3-box__inner" />
        <span className="a3-box__w">640 px</span>
        <span className="a3-box__h">360 px</span>
      </span>
      <span className="a3-box__note">认宽不认高 · 绝不形变</span>
    </div>
  );
}

/** Image：预加载状态网格。 */
function ImageBody(): JSX.Element {
  const states = ['done', 'done', 'done', 'load', 'idle', 'idle'];
  return (
    <div className="a3-assets">
      {states.map((s, i) => (
        <span key={i} className={`a3-assets__cell is-${s}`} />
      ))}
      <span className="a3-assets__note">priorityComplete · 冷启动门控</span>
    </div>
  );
}

/** 自定义 scrub 接管：center-lock 段 = 真实滚动距离。 */
function ScrubBody(): JSX.Element {
  return (
    <div className="a3-scrub">
      <span className="a3-scrub__track">
        <span className="a3-scrub__lock" />
        <span className="a3-scrub__head" />
      </span>
      <div className="a3-scrub__legend">
        <span>enter</span>
        <span className="is-lock">center-lock</span>
        <span>exit</span>
      </div>
      <span className="a3-scrub__note">1 ms = 1 px · 反向原样可逆</span>
    </div>
  );
}

const PANEL_BODY: Record<PanelId, () => JSX.Element> = {
  chain: ChainBody,
  stagger: StaggerBody,
  position: PositionBody,
  container: ContainerBody,
  image: ImageBody,
  scrub: ScrubBody,
};

const PANEL_CODE: Record<PanelId, string> = {
  chain: '<Animate timeline={{ after: "title", delay: 160 }} />',
  stagger: '<Animate stagger={{ each: 80 }} />',
  position: '<Position at={{ x: 480, y: 220 }} />',
  container: '<Container width={640} height={360} />',
  image: '<Image src="/hero.jpg" preload />',
  scrub: '<Scene scroll={{ trigger: "center-lock" }} />',
};

/**
 * 窄屏（≤600 宽）用的**短版**代码行。
 *
 * 为什么需要（2026-08-08，对抗验收 P2-8 报的裁切，我复验后发现比它报的更严重）：
 * 静息态 390×844 实测 `.a3-panel__code` 的 `scrollWidth / clientWidth` 是
 * 354/186、227/186、239/186、251/186、220/186、293/186 —— **六块全部**超宽。
 * 该元素带 `white-space: nowrap` + `text-overflow: ellipsis`，所以矩形永远等于盒宽、
 * 量矩形永远发现不了；只有比 `scrollWidth` 才看得见。用户在窄屏上看到的是
 * 一行被省略号砍断的代码。
 *
 * 为什么不改成折行：panel 高度余量只有 4px（`act3-overflow-check.mjs` 实测 chain
 * 纵溢 −4），折成两行会直接撑破 panel（那 panel 有 `overflow: hidden`，会变成
 * 文字被裁半行——比省略号更糟）。
 *
 * 所以改**内容**：短版保留每个 API 最能说明问题的那一个参数，去掉包装标签与次要参数。
 * 语义仍成立（它示意的是「这个能力长什么样」，不是可复制的完整调用）。
 * 最长一条 `scroll={{ trigger: "center-lock" }}` 约 32 字符，186px / 10.1px 字宽 ≈ 18 字符
 * —— 仍不够，故进一步压到 ≤18 字符的核心形式。
 */
const PANEL_CODE_NARROW: Record<PanelId, string> = {
  chain: 'after: "title"',
  stagger: 'stagger: 80ms',
  position: 'at: 480, 220',
  container: '640 × 360',
  image: 'preload',
  scrub: 'center-lock',
};

export function Act3DollyScene(): JSX.Element {
  const { t, lang } = useI18n();
  /* zh 错位换行（2026-08-16）：\n 断行 + ±44u 行内横移（hero persist 同款）；
   * en 文案无 \n，保持 SplitTitle 的 balance 两行。 */
  const titleLines = t('cap.shot3.title').split('\n');
  // 手机（≤600 宽）画布 = 一个视口高 ⇒ 六块改 2 列 ×3 行、收尾标题下移。
  // resize-only，不进 scrub 每帧路径（见 useDesignCanvasHeight 注释）。
  const { phone, designH } = useDesignCanvasHeight();
  const canvasH = phone ? designH : CANVAS_H;
  const panels = useMemo<readonly PanelLayout[]>(
    () => (phone ? buildPhonePanels(designH) : PANELS_DESKTOP),
    [phone, designH]
  );
  // 标题（v4 常驻居中）:`anchor:'center-x'` 下 y 是「距画布顶」的偏移,不是相对中心。
  // 桌面 372(900 高画布内,标题块 ~159 高 ⇒ 块心落在 0.50H,居中)。
  // 手机取 0.446H,让块心同样落在 0.50H —— 标题常驻后与静息 panel 长期共处,
  // 共处由 z 序保证(标题恒在所有 panel 之上),散落布局的中心留白负责视觉不打架。
  /* 手机：标题 y 挪到底部空带（0.86H）。原 0.446H 恰好压在中排两卡（row2 =
   * 0.45H，position/container）上——标题 z 降低后（用户裁决不在最上）静息态
   * 被两张不透明卡片盖死（对抗复审 HIGH：0/26 网格点可见）。2×3 网格的空带
   * 只在顶（<0.10H，与 cap-slate 胶囊打架）与底（row3 底缘 ≈0.80H 之后），
   * 取底带。桌面 372 不变（中心空档零相交已验）。 */
  const titleY = phone ? Math.round(designH * 0.86) : 372;

  return (
    <div className="capability-full act3-dolly" data-lang={lang}>
      {/* 时钟轨:本幕唯一预算所有者(10s) */}
      <Animate
        animateId="shot3-clock"
        enterAnimation={solidVariant()}
        duration={{ enter: SHOT3_CLOCK_MS }}
        timeline={{ delay: 0 }}
      >
        <TimecodeAxis shotIndex={2} seconds={10} />
      </Animate>
      <div className="cap-slate">{t('cap.shot3.slate')}</div>

      {/* 六块 panel（v4 倒放）：逐块接力从画布中心峰值退回自己的散落位，落位后常驻。 */}
      {panels.map((panel, index) => {
        const { Icon } = panel;
        const Body = PANEL_BODY[panel.id];
        const peak = resolvePeakScale(panel.w, panel.h, canvasH);
        // anchor:'center' 下，偏移量必须走 at.x / at.y —— 它们被当作「相对屏幕中心的
        // 设计 px 偏移」(Position.tsx:102 `calc(50% + offsetPx)`)。
        // at.offsetX / at.offsetY 是完全不同的语义(相对**上一个** Position 的偏移，走
        // parentPosition.lastX)，在这里传它们等于没传：六块会全部叠在正中。
        return (
          <Position
            key={panel.id}
            at={{ anchor: 'center', x: panel.x, y: panel.y }}
            /* z-index 必须在这一层 —— 挂到内层会被 Animate/Position 的层叠上下文囚禁
               （见文件头 z 序说明的四步证伪）。v4 取 index+1：正在退回的块（出场最晚、
               仍铺满画布）恒在已着地块之上；标题 Position 再高一层。 */
            style={{ zIndex: index + 1 }}
          >
            <Animate
              animateId={`shot3-block-${panel.id}`}
              enterAnimation={dollyVariant(panel.base, peak, panel.x, panel.y)}
              duration={{ enter: DOLLY_MS }}
              timeline={{ delay: index * DOLLY_STEP }}
            >
              <div
                className="a3-panel"
                style={{
                  width: `calc(${panel.w} * var(--cv-u))`,
                  height: `calc(${panel.h} * var(--cv-u))`,
                  // 静态倾斜，打破「所有边互相平行」的机械感。CSS 变量而非行内 transform：
                  // transform 归 Animate lane 所有，这里只提供 tilt 供 CSS 叠加。
                  ['--a3-tilt' as string]: `${panel.tilt}deg`,
                }}
              >
                <div className="a3-panel__bar">
                  <span className="a3-panel__icon">
                    <Icon />
                  </span>
                  <span className="a3-panel__label">
                    {t(`cap.shot3.card.${panel.id}.label` as DictKey)}
                  </span>
                  <span className="a3-panel__no">{String(index + 1).padStart(2, '0')} / 06</span>
                </div>
                <div className="a3-panel__body">
                  <Body />
                </div>
                {/* 窄屏用短版：长版在 390 宽下六块全部被省略号砍断（见 PANEL_CODE_NARROW）。
                    复用已有的 `phone` 断点（`useDesignCanvasHeight`，≤600 宽），
                    不另引入一个阈值 —— 两套阈值会漂移。 */}
                <code className="a3-panel__code">
                  {phone ? PANEL_CODE_NARROW[panel.id] : PANEL_CODE[panel.id]}
                </code>
              </div>
            </Animate>
          </Position>
        );
      })}

      {/* 标题（v4 开局显影）：虚焦→实焦后常驻整幕、永不退场。
          2026-08-15 用户裁决：z **不再压在 panel 之上**（panel zIndex 1-6，标题
          z auto 在下）——panel 峰值穿过中心时从标题前面过；重叠交给字号缩小
          消解（.act3-titleblock .cap-title 降到 --text-2xl，en 行1 695→~505px，
          与 chain 底缘的 ~84px 重叠带清零）。 */}
      <Position at={{ anchor: 'center-x', y: titleY }}>
        <div className="act3-titleblock">
          <Animate
            animateId="shot3-title"
            enterAnimation={developVariant(0.95)}
            duration={{ enter: TITLE_MS }}
            timeline={{ delay: 0 }}
          >
            {/* 2026-08-16 用户指令「也和英文一样换行，但是错位换行，参照首页」：
                zh 含 \n 时按首页 hero 的 persist 手法分行渲染（行内 ±44u 静态横移，
                HeroScene.tsx 同款）；en 无 \n 走原 SplitTitle（balance 两行）。 */}
            {titleLines.length > 1 ? (
              <h2 className="cap-title act3-title-stagger">
                {titleLines.map((line, i) => (
                  <span
                    key={i}
                    className="act3-title-stagger__line"
                    style={{
                      transform: `translateX(calc(${i === 0 ? -44 : 44} * var(--cv-u)))`,
                    }}
                  >
                    {line}
                  </span>
                ))}
              </h2>
            ) : (
              <SplitTitle text={t('cap.shot3.title')} />
            )}
          </Animate>
        </div>
      </Position>
    </div>
  );
}
