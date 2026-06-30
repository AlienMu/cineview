# Task Flow — 第二屏：能力展示（Capability Showcase）

**日期**: 2026-07-05
**目标**: 实现官网第二幕，用 scroll center-lock 接管展示三个核心能力，滚动进度驱动复杂动画编排。

---

## 设计锁定（grill-me 7 题对齐结果）

| 维度 | 决定 |
|---|---|
| 模式 | `Scene.scroll` center-lock 接管（高度 100vh） |
| 核心数量 | 3 个（场景编排 / 声明式时间轴 / 开箱即用） |
| 布局差异化 | 每个核心布局完全不同，避免重复 |
| 动画密度 | 多节点密集动画，不是简单淡入淡出 |
| 过渡策略 | blur + zoom + 多段依次退场/入场，前后流畅衔接 |

---

## 三个核心详细设计

### 核心1：场景编排能力（0-33% 进度）

**布局**：左右分栏
- 左侧：代码片段展示 `<Animate timeline={{waitFor: ...}}>`
- 右侧：5 个元素 + 1 条环绕胶带（持续运行动画）

**动画节点**（进度细分）：
```
0-5%    标题从右 slide + fade 入场
5-10%   副标题/描述文案淡入
10-16%  左侧代码块从右滑入
16-20%  代码关键行高亮（timeline 行）
20-24%  右侧 5 个元素依次从右 fade + slide 入场（stagger）
24-28%  胶带从中心生长，环绕 5 个元素开始持续旋转动画
28-33%  退场：5 个元素依次 zoom-out(0.1) + blur(30px) → 缩成光点
```

### 核心2：声明式时间轴（34-66% 进度）

**布局**：垂直时间线（中央竖轴，左右交替节点）

**动画节点**：
```
34-38%  入场：5 个光点（承接核心1）沿竖线排列 → de-blur 成时间线节点
38-42%  中央时间轴从上往下生长
42-50%  左右节点依次 zoom-in + 连线绘制（模拟 waitFor 链）
50-58%  节点间流动光效（模拟时间流动）
58-62%  补充文案淡入（"声明式 API，框架自动计算依赖"）
62-66%  退场：节点从下往上依次 zoom-out + blur → 最后剩顶部一个"胶囊"
```

### 核心3：开箱即用（67-100% 进度）

**布局**：预设动画画廊（3×3 网格）

**动画节点**：
```
67-71%  入场：胶囊（承接核心2）explode 成 9 个卡片，从中心向外扩散
71-76%  9 个卡片各自内部播放一个预设动画示例
        （fade/slide/zoom/rotate/flip/bounce/blur/elastic/special）
76-85%  标题"40+ 开箱即用预设"从上淡入
85-92%  画廊整体轻微 scale(1.05) + 卡片依次高亮扫过
92-100% 驻留：卡片内动画循环播放（为下一幕腾出空间）
```

---

## 关键技术点

### T1 — 滚动进度映射
- Scene 的 `onZoneProgress` 回调获取 0-100% 进度
- 用自定义 hook `useProgressPhase(progress)` 切分三段：
  ```ts
  phase1: 0-33%   → 映射为核心1 的内部 0-100%
  phase2: 34-66%  → 映射为核心2 的内部 0-100%
  phase3: 67-100% → 映射为核心3 的内部 0-100%
  ```

### T2 — 多段依次退场/入场
- 不用 Animate 的单个 exitAnimation（整体淡出）
- 而是用滚动进度直接驱动每个子元素的 motion value：
  ```tsx
  const elementProgress = useTransform(scrollProgress, [28, 33], [0, 1]);
  const opacity = useTransform(elementProgress, [0, 0.6, 1], [1, 0.5, 0]);
  const blur = useTransform(elementProgress, [0, 1], [0, 30]);
  ```

### T3 — 衔接元素身份保持
- 核心1 的 5 个光点 → 核心2 的 5 个时间线节点：同一批 DOM 元素，仅改变位置/样式
- 核心2 的胶囊 → 核心3 的画廊中心点：用 `layoutId` 保持动画连续性

### T4 — 性能优化
- 胶带动画用 CSS `@keyframes`（GPU 加速），不用 JS 驱动
- 画廊卡片内的预设动画用 `will-change: transform`
- 滚动进度回调用 rAF 节流，避免每帧重计算

---

## 实施节点

- [x] N1 创建 `CapabilityScene.tsx` 组件骨架（改用框架 Animate + waitFor 链）
- [x] N2 移除手动 useTransform 逻辑，完全基于框架能力
- [x] N3 实现核心1 布局（左代码 + 右5帧电影胶片 + 胶带背景）
- [x] N4 实现核心1 动画序列（title → desc → code → 5帧 stagger → 胶带，用 waitFor 链）
- [x] N5 实现核心2 布局（垂直时间线 + 左右交替节点）
- [x] N6 实现核心2 动画序列（title → 时间轴线 → 5节点 stagger，用 waitFor 链）
- [x] N7 实现核心3 布局（3×3 预设画廊网格）
- [x] N8 实现核心3 动画序列（title → subtitle → 9卡片 stagger，用 waitFor 链）
- [x] N9 三个核心用 waitFor 链串联（capability-1 → capability-2 → capability-3）
- [x] N10 集成到 `HomePage.tsx`，替换 placeholder-1（已完成）
- [x] N11 类型检查通过（type-check 0 错误）
- [x] N12 构建通过（vite build 成功，417 模块，135.38 kB gzip）
- [ ] N13 中英文文案接入 i18n
- [ ] N14 响应式适配（移动端布局降级）
- [ ] N15 独立 agent 真实浏览器验收（滚动流畅性 + 动画衔接 + 性能无卡顿）

---

## ⚠️ 架构大改（2026-07-05，废弃上文单 Scene 分带方案）

**上文「单 Scene + 进度分带切层 + layoutId 衔接 + 手动 useTransform」方案已全部废弃。**
实施中反复失败，逐一读框架源码后确认根因，与用户对齐后改为**三个独立 Scene**。

### 失败根因（读源码确认，非猜测）

1. **「只见核心3」根因 = 跨核心遮挡（非动画 bug）**：三个核心共用
   `.capability-full { position:absolute; top:0; left:0 }` + 各自不透明背景，按 1→2→3
   渲染无 z-index → 核心3 物理盖住核心1/2。与 waitFor/scroll 无关。
2. **「全程半透明」根因 = 外层 Animate 包整组**：给三个核心套外层 `<Animate enterAnimation>`
   会让整个子树在入场补间期间半透明。正文容器应直接渲染（design.md：正文默认直接显示，
   viewport 交集只触发补充动画，不隐藏正文本体）。
3. **框架 scroll 引擎的硬约束**（`sceneScrollBudget.ts` L127 `exitStartMs = enterEndMs`）：
   单个元素**退场紧跟进场**，中间塞不进「停留」。但 `waitFor + delay` 能做停留
   （无 exit 的 scroll-driven 元素进场后永久停终态，`useAnimateScroll.ts` L673-676），
   「整组停住展示」= 各元素进场停住；「整组离场」= scene 到 100% 释放后随文档流自然滚走。

### 最终架构（用户拍板「改为三个 Scene」）

- 三个核心 = 三个独立 `<Scene scroll={{ zoneId, trigger:'center-lock' }}>`（见 `HomePage.tsx`）
- 三个 scene 是自然文档流里的独立 section → **无遮挡**，各自 center-lock 接管、播完 waitFor 链再释放
- `.capability-full` 改 `position:relative`（不再 absolute 堆叠）
- 每个核心内部：子元素 `<Animate>` + waitFor 链依次进场，**均无 exitAnimation**（进场后停住）
- 每个 scene 总滚动预算 = 内部 waitFor 链完整展开时长（1ms=1px）

---

## 当前状态（2026-07-05，重构后）

**已完成 + 真实浏览器验收通过**：
- ✅ 三个独立 `<Scene scroll>`：`cap-film` / `cap-timeline` / `cap-gallery`
  - 核心1（电影胶卷）：REC 时间码 + 35MM 规格 + 胶带 slide-right 生长 + 5帧真实
    Unsplash 图片（日出→夜色）依次 zoom-in + 标题/副标题/代码
  - 核心2（时间轴）：标题 + 中轴 slide-down 生长 + 5个左右交错节点依次入场 + 说明
  - 核心3（画廊）：标题/副标题/hint + 9个预设卡片 3×3 grid 依次 zoom-in（悬停播放
    对应预设动画）+ 电影主题内联 SVG 图标（光圈/场记板/胶片盘）
- ✅ TypeScript 0 错误 + vite build 通过（gzip 136.24 kB）
- ✅ **独立 agent 真实浏览器验收（Playwright, 1440×900）两轮通过**：
  - 首轮：核心1/2 PASS；三个历史 bug（跨核心遮挡 / 半透明 / 过渡重叠抢拍）确认消失；
    抓出核心3 header 被首行卡片遮挡的新布局缺陷
  - 修复：画廊 grid 从 `anchor:center` 改 `anchor:center-x y=300`（header 带下方），
    卡片缩至 168px 高 → 3行 544px 底边 864<900 不裁剪
  - 复验：header 三元素 hit-test 全部命中自身（`coveredByOther:false`）、9卡片无重叠、
    悬停 demo-fade-in 触发、核心1/2 无回归、console 0 error

**待完成**：
- [ ] N13 中英文文案接入 i18n（当前硬编码中英混排）
- [ ] N14 响应式适配（移动端布局降级）

---

## 验收标准（重构后实测结果）

- ✓ 三个核心各自 center-lock 接管，播完 waitFor 链再释放（独立 scene，无 overlap）
- ✓ 无跨核心遮挡（三个 scene 文档流纵向排布，均达完整揭示）
- ✓ 无半透明（每个核心子元素进场后 opacity=1 停住）
- ✓ 核心1 五帧真实图片加载（naturalWidth>0）+ 胶带生长
- ✓ 核心2 时间轴 + 5 节点左右交错依次入场
- ✓ 核心3 九卡片 3×3 grid 无重叠 + header 可读（不被卡片遮挡）+ 悬停播放预设动画
- ✓ 反向滚动三核心重新揭示，无永久消失
- ✓ console 0 error
- ⏳ 中英文切换（待 i18n 接入后验）
