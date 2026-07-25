# /drag 视觉升级增补设计稿 v2

> 日期: 2026-07-21 | 状态: 设计规范（待审，先审后实现）
> 基于: `2026-07-21-drag-temporal-redesign-detailed.md`（v1）+ 4 屏实拍评定
> 范围: site/src/components/temporal-drag/* + temporal-drag.css + i18n
> 核心指令: **黑底为主不变**（表达拍摄手法/电影感），打破"全黑白 + 单一金色"的暗淡与 AI 模板味，
>          引入**摄影仪表信号色**多强调色体系 + 质感层 + 密集点缀 + 增补动画。

---

## 0. 设计意图（去 AI 味的总纲）

实拍诊断出的"AI 味"来源：**四屏全是完美居中对称 + 近黑底 + 单一金色 + 大片留白里一个孤立主体**。
这是模板生成物的典型长相。修正策略（黑底不动，四条同时做）：

1. **多信号色**：黑机身是真实摄影器材的底色，但器材从不只有一种光——REC 红、对焦峰值绿、
   曝光琥珀金、波形蓝青、白平衡品红。每屏绑定一个**主信号色**做视觉标识，金色降级为「基准/静态」色，
   信号色负责「活跃/数据」态。四屏色彩各异 → 打破单调。
2. **质感深度**：加胶片颗粒层 + 暗角(vignette) + 扫描线，让黑底"有材质"而非纯色填充。
3. **密集点缀**：每屏补 3-6 个仪表读数/坐标标记/信号条，填充留白、强化"摄影机取景器"叙事。
4. **非对称编排**：打破正中对称——主体偏移、点缀沿边缘/网格散布、引入对角线视觉动线。

---

## 1. 信号色体系（新增 token）

### 1.1 每屏主信号色分配

| Scene | 主题 | 主信号色 | 语义（摄影对应） |
|-------|------|---------|-----------------|
| 01 Rolling | 显影盘/校准 | **琥珀金 `--tp-sig-amber`** #d8a24a（保留但提纯，作校准基准色） | 机械/时基校准 |
| 02 Choreograph | 编排轴 | **对焦绿 `--tp-sig-focus`** #6fcf7e | 对焦峰值(focus peaking)——编排=对准 |
| 03 Flux | 时间瀑布 | **波形青 `--tp-sig-cyan`** #4fd4e0 | 波形监视器/时码信号 |
| 04 Cut | 定格 | **REC 红 `--tp-sig-rec`** #e0574a（升格为主色） | 收录停止/最终定格 |

REC 红 `--tp-rec` 现有值 #c44b3a 提亮为 #e0574a 并统一到 `--tp-sig-rec`。

**饱和度基调：器材级中饱和。** 上面的值即为目标——不是霓虹高饱和（会俗、会盖过黑底电影感），
也不是灰扑扑的低饱和（就是现在"暗淡"的病根）。参照真实摄影器材的信号灯/波形/峰值色：
明确可辨、有辉光，但克制。四个主信号色亮度（L*）拉平到相近档位，确保切屏时"换了一路信号"
而非"忽明忽暗"。glow 用同色低透明度外发光承载饱和感，主体色本身不过冲。

### 1.2 新增 token（注入 `.drag-temporal`）

```css
/* 信号色（活跃/数据态，黑底上的多路信号） */
--tp-sig-amber: #d8a24a;
--tp-sig-amber-glow: rgba(216, 162, 74, 0.30);
--tp-sig-focus: #6fcf7e;
--tp-sig-focus-glow: rgba(111, 207, 126, 0.28);
--tp-sig-cyan: #4fd4e0;
--tp-sig-cyan-glow: rgba(79, 212, 224, 0.28);
--tp-sig-rec: #e0574a;
--tp-sig-rec-glow: rgba(224, 87, 74, 0.30);
--tp-sig-magenta: #c86fd4;              /* 辅助：白平衡/次级点缀，少量 */
--tp-sig-magenta-glow: rgba(200, 111, 212, 0.24);

/* 每屏通过 scene class 设一个 --tp-sig / --tp-sig-glow 别名，组件只认别名 */
/* 例：.tp-scene--02 { --tp-sig: var(--tp-sig-focus); --tp-sig-glow: var(--tp-sig-focus-glow); } */

/* 质感层（强度：明显 —— 老胶片/CRT 监视器质感，非极淡） */
--tp-grain-opacity: 0.11;               /* 胶片颗粒强度（明显：0.045→0.11，约 2.4x） */
--tp-vignette: radial-gradient(ellipse 116% 86% at 50% 40%, transparent 48%, rgba(0,0,0,0.72) 100%); /* 更深暗角 */
--tp-scanline: repeating-linear-gradient(0deg, rgba(255,255,255,0.030) 0 1px, transparent 1px 3px);   /* 扫描线加重 0.014→0.030 */

/* 提升的机身层次（黑底不再是单一 #0c0a08） */
--tp-bg-deep: #08070a;                  /* 最底 */
--tp-bg: #0c0a0c;                        /* 微冷调，替换纯暖黑 */
--tp-bg-elevated: #15131a;               /* 抬升面，带极淡冷紫 */
```

> 关键：`--tp-bg` 从 #0c0a08（暖黑）改为 #0c0a0c（中性微冷），让多信号色（尤其青/绿）在其上更干净，
> 不被暖黑吃掉。金色仍协调。

### 1.3 组件用色规则

- **静态/基准结构**（刻度、边框、rule、未激活文字）：仍用 `--tp-ink-*`（黑白灰），**保持克制**。
- **活跃/数据/强调**（进度、激活节点、主标题辉光、指针、信号点）：用当屏 `--tp-sig`。
- 一屏内**只用一个主信号色 + 极少量 magenta 辅助**，避免彩虹化重新变 AI 味。

---

## 2. 质感层（新增，全局 4 屏共用）

### 2.1 结构

在 `.drag-temporal` 内、CineView 之上加一个 `pointer-events:none` 的 overlay（不进 CineView 树，纯装饰）：

```tsx
// TemporalDragExperience.tsx，包在 CineView 外层
<div className="tp-texture" aria-hidden="true">
  <div className="tp-texture__grain" />
  <div className="tp-texture__scanline" />
  <div className="tp-texture__vignette" />
</div>
```

### 2.2 CSS

```css
.tp-texture { position:absolute; inset:0; z-index:50; pointer-events:none; }
.tp-texture__grain {
  position:absolute; inset:-50%;
  background-image: url("data:image/svg+xml,...fractalNoise baseFrequency=0.9..."); /* SVG feTurbulence 颗粒 */
  opacity: var(--tp-grain-opacity);              /* 0.11 — 明显可见的胶片颗粒 */
  animation: tp-grain 0.5s steps(4) infinite;    /* 颗粒抖动，4 步更躁动 */
  mix-blend-mode: overlay;
}
.tp-texture__scanline { position:absolute; inset:0; background: var(--tp-scanline); opacity:0.7; }
.tp-texture__vignette { position:absolute; inset:0; background: var(--tp-vignette); }

@keyframes tp-grain {
  0%{transform:translate(0,0)} 25%{transform:translate(-3%,1%)} 50%{transform:translate(2%,-2%)}
  75%{transform:translate(-1%,2%)} 100%{transform:translate(0,0)}
}
@media (prefers-reduced-motion: reduce){ .tp-texture__grain{ animation:none } }
```

> **强度=明显**（你的决策）：颗粒用 SVG feTurbulence 内联 data-uri（`baseFrequency≈0.9` 细密颗粒），
> 零额外请求。opacity 0.11（约现有 2x），近看是清晰的胶片/CRT 颗粒质感、远看不糊内容。
> scanline 加重（0.030 + repeat 3px，opacity 0.7）——老监视器扫描线明显但不刺眼。
> vignette 加深（角落 0.68 黑）把注意力聚到画面中上部、强化"透过取景器看"的包裹感。
> 注意：明显质感的风险是"显脏"，收口真机验收须专门确认颗粒不劣化文字可读性、不产生 moiré。

---

## 3. 逐屏升级

### 3.1 Scene 01 — 显影盘（琥珀基准 + 校准动态）

**你反馈"显影盘不好看"**。诊断：现在盘面太空——只有细刻度 + 两根针 + 中心数字，中间大片纯黑，
外圈刻度纤细到几乎看不见。升级：

**A. 盘面加层次（点缀）**
- **双环结构**：现有 inner-ring 外，再加一圈**虚线校准环**（`stroke-dasharray`），
  半径介于刻度与内环之间，极淡琥珀。
- **12 个主刻度加"数值刻度盘"质感**：主刻度加短径向渐变辉光；主刻度数字（05/10.../60）
  当前是 ink-mute，改为激活区（拖拽方向扇区）点亮为 `--tp-sig-amber`。
- **中心区**：数字 "01" 下方加一行极小 mono 副读数 `f/2.8 · 1/50 · ISO800`（摄影参数点缀），
  和一个 2px 高的"曝光条"微动画（琥珀，轻微呼吸）。
- **盘心 pin** 加十字分划线（rangefinder 十字），延伸到内环，强化"取景校准"。

**B. 补动画**
- **持续微动**（新增 infinite）：
  - 秒针入场后**保持极慢连续扫动**（真实秒针感，60s 一圈的 1/10 速率即可，或 stepped 抖动），
    而非入场后完全静止。用 CSS animation（非每帧 JS）。
  - 外圈虚线校准环**极慢反向旋转**（40s/圈），制造"仪器在工作"的活感。
  - 中心曝光条呼吸（opacity 0.4↔1，2.4s）。
- **入场更丰富**：主刻度点亮做一次"扫描点亮"——从 12 点位置顺时针**逐个点亮一圈**
  （用 stagger 的 `from` + 现有 tick stagger 已有基础，改成带辉光的点亮而非纯 scale）。
- **退场更戏剧**：盘面整体**快门收拢**——所有刻度向心收缩 + 内环缩小 + 中心数字放大冲出，
  像快门叶片闭合（现有已有 scale 退场，强化为带 clip 感 + 更快的向心）。

**C. 布局修正（实拍 bug）**
- 标题区与 DRAG 提示之间大片留白：把 `s01-stage` 从"钉顶绝对定位"改为**盘面偏上、
  标题区紧随、DRAG 提示锚底**的三段式，中间留白压缩。或用 `justify-content` 让整体视觉重心居中偏上。

### 3.2 Scene 02 — 编排轴（对焦绿 + 修复布局 bug）

**A. 修复实拍 P0 bug**
- **CTA 节点切边**：节点位置从 `0/25/50/75/100%` 改为 **`4/26/50/74/96%`**（内缩），
  或时间轴容器两端留 `padding: 0 24px`，让首尾节点圆圈 + 标签完整可见。
- **ParamPanel 缺失**：核实 enter 是否触发（waitFor 链 `node-cta` 是否 resolve）。
  修复后确保 rest 态可见。**同时重新设计面板**（见下）。

**B. 用色 + 点缀**
- 节点激活色从金改为 **`--tp-sig-focus`（对焦绿）**——"对焦=编排对准"的隐喻。
- 连接线光点、激活节点辉光、timeline-base 渐变全部改对焦绿。
- **ParamPanel 重设计**：现在太朴素。改为**对焦峰值监视器**风格——
  - 顶部加一行波形/直方图微装饰（纯 CSS，几根高低不一的绿色竖条）。
  - 参数值用绿色 mono，label 灰色。
  - 加一个"FOCUS LOCKED"状态徽标（绿点 + 文字），随 activeNode 到 CTA 时点亮。
- **补点缀**：时间轴上方加**刻度尺**（细密 tick + 每节点位置的数值标记 `00:00 / 00:24 / ...`），
  让"声明时间轴"更像真实剪辑时间线。

**C. 补动画**
- 节点入场：现有 bounce-in 基础上，激活时**辐射一圈 focus-ring 脉冲**（绿色圆环扩散消失，CSS）。
- 连接线光点：现在只走一次，改为**激活后沿线段持续流动**（infinite，低频）。
- 波形装饰竖条轻微起伏（infinite）。

### 3.3 Scene 03 — 时间瀑布（波形青，已最佳，微增强）

实拍已是最好的一屏。小幅增强即可：
- 进度环、巨型时码、方程改用 **`--tp-sig-cyan`**（现在是金；青更贴"时码信号/波形监视"主题，
  也和 01 的琥珀拉开对比）。
- 背景时码流：中列改为极淡青，左右保留灰——制造色彩纵深。
- **补点缀**：环外加**波形监视器刻度**（环周围一圈短径向 tick，像示波器）+ 环上一个
  沿环运动的"扫描点"（infinite，青色辉光点绕环）。
- 巨型时码：加**极轻的 RGB 分离/色差**（text-shadow 青+品红双向偏移 0.5px），CRT 监视器质感。
- 底部刻度条 marker 保留随拖拽移动。

### 3.4 Scene 04 — 定格（REC 红升格为主色）

- CUT 标题保持白，但 accent 细线、THE END、primary 按钮、END 齿孔改 **`--tp-sig-rec`（红）**——
  "收录停止/红色定格"的强烈收尾。REC 徽标此屏本就该是停止态。
- **补点缀 + 修留白**：CUT 上方（现在全空）加一个**"胶片尾料"视觉**——
  几帧空胶片格（带齿孔的矩形序列）横向排布 + "END OF REEL" 标记，填充上半屏、呼应"定格/杀青"。
- **补动画**：
  - CUT 入场后加一次**红色快门闪**（全屏极短红色 flash，0.12s，像按下停止键）。
  - accent 线加 infinite 微扫光。
  - 按钮 hover 已有，加 focus-visible 红色辉光。
- 布局：CUT + 按钮组整体上移居中，压缩下半留白。

---

## 4. 拖拽中的丰富反馈（跨屏，你之前也可选，此处补）

- **拖拽方向指示**：拖拽时屏幕对应边缘（上/下）浮现一条**当屏信号色的渐隐光带**（表示"下一格在这个方向"）。
- **进度信号**：HUD 时码在拖拽时加速已有；补一个**顶部/底部的细进度线**随 renderProgress 填充（当屏信号色）。
- 这些走 motionValue，零 React 渲染（遵守热路径规范）。

---

## 5. 动画时序增补总表（新增项）

| Scene | 新增动画 | 类型 | 驱动 |
|-------|---------|------|------|
| 01 | 秒针慢扫 | infinite | CSS |
| 01 | 校准环反向旋转 | infinite | CSS |
| 01 | 曝光条呼吸 | infinite | CSS |
| 01 | 主刻度扫描点亮 | enter stagger | 框架 |
| 01 | 快门收拢退场 | exit | 框架 renderProgress |
| 02 | focus-ring 脉冲 | enter（激活时） | CSS |
| 02 | 连接线光点持续流动 | infinite | CSS |
| 02 | 波形竖条起伏 | infinite | CSS |
| 03 | 环上扫描点绕行 | infinite | CSS |
| 03 | 时码 RGB 色差 | 静态 | CSS |
| 04 | 红色快门闪 | enter（一次） | 框架/CSS |
| 04 | accent 微扫光 | infinite | CSS |
| 全局 | 胶片颗粒抖动 | infinite | CSS |
| 全局 | 拖拽边缘光带 | 拖拽反馈 | motionValue |

> 所有 infinite 均受 `prefers-reduced-motion` 门控关闭（现有 TemporalMotion + CSS media 双保险）。
> 所有每帧驱动走 motionValue，不新增 setState。

---

## 6. 布局 bug 修复清单（实拍发现，纳入本轮）

| # | 屏 | 问题 | 修法 |
|---|----|------|------|
| P0 | 02 | CTA 节点右半被切 | 节点位置内缩 4/26/50/74/96% 或容器留 padding |
| P0 | 02 | ParamPanel 完全不可见 | 核实 waitFor 链触发 + 重设计为对焦监视器 |
| P1 | 01/04 | 竖向大片留白、内容钉顶 | 三段式重心居中偏上，压缩留白 |
| P2 | 全 | 黑底单一、缺质感 | 质感层 + 微冷黑 + 多信号色 |

---

## 7. 不改动（守住的约束）

- CineView 配置（size 390 / dragTimeScale 16 / threshold）不动。
- 双轨 drag 模型、单一所有者不变量不碰。
- 已接入的 i18n 结构不回退；新增文案（摄影参数、状态徽标、END OF REEL 等）
  按"术语英文、叙事中译"规则加 key。
- 热路径规范：颗粒/扫描/信号动画全走 CSS 或 motionValue，禁止每帧 setState。
- 术语母题保留英文（REC/SMPTE/f-stop/ISO/FOCUS LOCKED/END OF REEL 等）。

---

## 8. 实现顺序（审批通过后）

1. 全局：token 体系 + 质感层 + 微冷黑底（P0 基础，四屏共享）。
2. Scene 02 布局 bug 修复（P0 功能）。
3. 逐屏用色切换 + 点缀 + 动画（01→02→03→04）。
4. 拖拽边缘反馈（跨屏）。
5. i18n 补 key。
6. type-check / build / format。
7. 真机验收（独立 agent）：**这次显式要求评定视觉还原度 + 每屏点缀/动画是否到位 + 4 视口 +
   中英切换**，不再只查功能。

---

*增补稿完。核心：黑底电影感不动，用摄影仪表信号色 + 质感层 + 密集点缀 + 增补动画破除暗淡与 AI 味，
并修复实拍暴露的 Scene 02 布局 bug 与四屏留白。待你审批。*
