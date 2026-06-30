# Task Flow — 第二幕能力展示 重做（frontend-design 重构）

**日期**: 2026-07-06
**目标**: 用 frontend-design 原则重做第二幕「能力展示」。保留已验收的**三个独立 Scene.scroll**
架构，但从视觉/结构/文案层面重新设计，使其更贴合 CineView「滚动即胶片」的主题、更有辨识度，
并修掉现版与站点设计系统的两处不一致。

---

## 一、构筑前框架代码勘察（已完成，非猜测）

按 CLAUDE.md 规则「不靠猜测修问题」，动手前先读框架，确认硬约束：

| 约束 | 出处 | 结论 |
|---|---|---|
| 无 exit 的 scroll-driven `<Animate>` 进场后**永久停终态** | `useAnimateScroll.ts` L673-676 | 「进场即停住展示」是正确范式；不要指望中途「停留段」 |
| 单元素 exit 紧跟 enter，budget 模型里塞不进「hold」 | `sceneScrollBudget.ts` L127 `exitStartMs = enterEndMs` | 「整组停住」= 各元素进场停住；「离场」= scene 到 100% 释放后随文档流滚走 |
| scene 总滚动预算 = 内部 waitFor 链完整展开时长（1ms=1px） | `sceneScrollBudget.ts` L161 | 链越长，center-lock 锁得越久 |
| 三个独立 Scene = 文档流纵向排布，**无遮挡** | HomePage.tsx | 旧单 Scene 三层 absolute 互盖 = 「只见核心3」根因，勿回退 |
| 外层 `<Animate enter>` 包整组 → 整子树补间期半透明 | 07-05 task-flow 失败根因 #2 | 正文容器**直接渲染**，只给子元素挂 Animate |
| 可用预设 | `animations/presets` registry | fade/slide/zoom/rotate/flip/bounce/blink/shake/blur/elastic/special/focus-in/roll/rubber-band/scale（37 键） |
| `<Animate>` 支持 stagger / infiniteAnimation / render-prop | `Animate.tsx` L127/138/295/313 | stagger 需单容器 + enterVariant；render-prop 与 stagger 互斥 |

### 现版两处与设计系统的不一致（本次一并修）
1. **不一致 A — 盖掉 LUT 色带**：`CapabilityScene.css` 给三个 scene 设不透明背景
   （`#F7F4EF`/`#FBF9F5`），而站点签名正是背景 LUT 滚动色带（`global.css` `.cineview-container
   { background: transparent }` + `BackgroundRibbon`）。现版把色带盖死 → Act 2 脱离了
   全站「dawn→dusk」色彩旅程。**修**：scene 背景透明，内容浮在色带上的近白 hairline 卡面上。
2. **不一致 B — 硬编码字体字面量**：现版用 `'Courier New'` / `'Fraunces'` / `'Inter'` 字面量，
   而非 tokens.css 的 `--font-mono`（Roboto Mono）/`--font-display`/`--font-body`。**修**：全走 token 变量。

---

## 二、设计计划（frontend-design 两遍法）

### 主题锁定
CineView = 「滚动即胶片推进」的 React 叙事框架。受众：评估「能不能做电影感滚动叙事」的 React 开发者。
Act 2 的唯一职责：把三个能力（**场景编排 / 声明式时间轴 waitFor / 开箱即用预设**）演示到
「demo 本身就是证明」的程度。

### 沿用站点既定方向（这是「brief 的钉死项」，不重造）
- 调色板：`--film-white #faf8f4` / `--ink #1a1814` / 陶土 `--accent #c98a6a` `--accent-ink #9c6249`
  / hairline `--frame-line #e4dfd6`；背景 LUT 色带（dawn/sky/lavender/mint）**透出**。
- 字体：Fraunces（display 标题）/ Inter（body 正文）/ Roboto Mono（数据·时间码·代码）。

### 签名元素（唯一记忆点）
**制片场记「SHOT」序号系统**：三个 scene 各是 Act 2 序列里的一「镜」，mono eyebrow 打
`SHOT 01 ── SCENE ORCHESTRATION` + hairline 分隔线 + 随滚动进度推进的**帧计数器/时间码**。
- 为何合理（frontend-design：编号只在「内容确实是序列」时才用）：三个能力**确定按序展示**，是真序列。
- 为何专属 CineView：把「滚动 = 胶片帧」这一核心主题显性化，三镜共享同一场记体系 → Act 2 读作
  「一条被分成三镜的连续长镜」，而非三个拼贴。

### 三镜布局（ASCII 草图）

**SHOT 01 — 场景编排（电影胶片 contact sheet）**
```
SHOT 01 ── SCENE ORCHESTRATION                     REC ● 00:00:12
   ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐      ← 5 帧真实图片，随滚动依次「曝光」(zoom+fade)
   └──┘ └──┘ └──┘ └──┘ └──┘        胶带 slide-right 生长做底
   Scroll advances the reel — every frame arrives on cue.   ← Fraunces 标题
   <Scene scroll={{ trigger:'center-lock' }} />              ← mono 代码行
```

**SHOT 02 — 声明式时间轴（代码 → cue 链，左右对照）**
```
SHOT 02 ── DECLARATIVE TIMELINE
 ┌ code ────────┐      ● title            ← 左：真实 waitFor 代码块（当前触发行高亮）
 │ title        │      ● subtitle   ┐       右：cue 节点沿生长中轴 top→down 依次点亮
 │  delay:160   │      ● frames     ┘       节点文案 = 该 cue（waitFor/delay/duration）
 │ subtitle     │      ● settled            代码高亮行 ↔ 当前点亮节点 一一对应
 │  waitFor: ▸  │
 └──────────────┘   The framework resolves the chain for you.
```

**SHOT 03 — 开箱即用（预设 contact sheet，非通用 SaaS 网格）**
```
SHOT 03 ── READY TO USE                            40+ PRESETS
 ┌01──┐ ┌02──┐ ┌03──┐    ← 9 个预设做成「印样/contact sheet」：帧号 01-09 + 齿孔边
 └────┘ └────┘ └────┘      悬停播放对应预设 demo（克制：仅 hover，不全部空转）
 ┌04──┐ ┌05──┐ ┌06──┐
 └────┘ └────┘ └────┘      标题保持安静（boldness 已花在 shot 01/02）
```

### 花在一处的「险」（frontend-design：取一个可辩护的风险）
让 **LUT 背景色带透出三镜**（scene 背景透明）→ Act 2 并入全站连续色彩旅程；风险是移动/浅色
背景上的对比度，靠「内容全落在近白 hairline 卡面」化解。此举同时修掉不一致 A，且由既有设计系统背书。

### 克制自检（Chanel「出门前摘一件」）
- 每镜最多一个环境循环动画（shot1 REC 闪烁；shot3 hover demo）。不加粒子/网格/浮动装饰
  （现版已把 `.timeline-particles`/`.timeline-grid` 设 display:none，说明曾加又删——不再加回）。
- 标题只在 em 上着陶土色，其余克制。

---

## 三、i18n
现版硬编码中英混排。本次文案改为**英文场记 + 中文正文**的克制混排，并抽入 `zh.ts`/`en.ts`
（新增 `cap.*` 键），消除硬编码。

---

## 四、实施节点

- [x] N0 读框架 + 设计计划成文（本文件）+ 与用户对齐设计方向
- [x] N1 i18n：`zh.ts`/`en.ts` 增补 `cap.shot1/2/3.*` 键（17 键，中英同构校验通过）
- [x] N2 重写 `CapabilityScene.css`：透明背景 + token 字体变量 + 场记 eyebrow + contact-sheet 卡面
- [x] N3 重写 SHOT 01（场记 eyebrow + 帧号 01-05 + 胶带生长 + 5 帧依次曝光）
- [x] N4 重写 SHOT 02（左代码块 + 右 cue 链；代码行用 render-prop `enterProgress>0.5` 切 `is-active`，与右侧同 index 节点靠 waitFor 链天然同步）
- [x] N5 重写 SHOT 03（预设 contact sheet，帧号 01-09 + 顶部齿孔 + hover/focus demo）
- [x] N6 type-check 0 错误
- [x] N7 vite build 通过（`site` 构建 627ms，无报错）
- [ ] N8 **独立 agent 真实浏览器验收**（localhost:4000 `#/` 滚动实测；见验收标准）

### 实现记录（踩坑修正）
- SHOT 02 代码块最初误写 `<Animate render>` + `{({ progress }) => …}`：框架**无 `render` 布尔 prop**（函数 children 即触发 render-prop），且状态字段是 `enterProgress` 非 `progress`（`AnimateRenderState = { enterProgress, phase }`，见 types.ts）。已改为函数 children + `enterProgress > 0.5` 判活。
- 站点 dev/预览端口是 **4000**（非 CLAUDE.md 写的 3000——那是另一个 Next 应用）。验收 URL 用 `localhost:4000/#/`。

---

## 五、验收标准（按 CLAUDE.md 规则 4，须独立 agent 真机实测）

- [ ] 三镜各自 center-lock 接管，播完 waitFor 链再释放，无跨镜遮挡
- [ ] 无半透明（子元素进场后 opacity=1 停住）
- [ ] LUT 背景色带透出三镜（scene 背景透明，与 Hero/其余幕色彩连续）
- [ ] SHOT 01 五帧真实图片加载 + 依次曝光 + 胶带生长
- [ ] SHOT 02 代码高亮行与当前点亮节点一一对应
- [ ] SHOT 03 九预设 contact sheet 无重叠 + header 可读 + 悬停播放 demo
- [ ] 反向滚动三镜重新揭示，无永久消失
- [ ] 中英文切换文案正确（i18n 接入后验）
- [ ] console 0 error
