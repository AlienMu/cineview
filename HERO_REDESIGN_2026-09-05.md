# Hero 页面重设计 - 2026-09-05

## 任务概述

根据用户要求，对 site 目录下的 hero 页面进行了重新设计，包括：

1. 微调第二幕（胶片带）- 增加视觉元素
2. 优化第三幕（推镜）- 提升视觉质感
3. 删除旧的第五幕（ProductionScene）
4. 新增第五幕（RuntimeControlScene）- 展示框架核心特性

---

## 一、第二幕（CapabilityFilmStripScene）微调

**保留原有结构**：9个预设动画、胶带机制、逐帧定格

### 新增元素（3个层次）：

1. **时间线轨道可视化**
   - 胶带下方新增水平时间轴（0s → 6s）
   - 当前激活帧用 accent 色标记
   - 进度指示器用 `loopAnimation` 平滑移动

2. **帧间过渡粒子**
   - 每次切换帧时，3-5个小圆点从旧帧飞向新帧
   - 使用 `Animate stagger` 错峰飞行
   - 颜色从 `--accent-ink` 淡化到透明
   - 强化"逐帧切换"的视觉反馈

3. **代码卡片运行状态指示**
   - 左上角绿色运行指示灯（`loopAnimation` 脉冲）
   - 底部显示 "Runtime: XXms"
   - hover 时显示 easing 曲线可视化

### 参数微调：

- 齿孔流光速度：2s → 1.8s/周期（更有节奏感）
- 帧格激活 scale：1.06 → 1.08，配合轻微上浮 2px
- caption 切换 blur：0.55vw → 0.42vw（减少昂贵的 blur）

**文件修改**：

- `site/src/components/CapabilityScene.tsx`
- `site/src/components/CapabilityScene.css`

---

## 二、第三幕（Act3DollyScene）视觉质感升级

**保留原有内容**：6个 panel、倒放机制、时间轴编排

### 视觉质感升级（4个维度）：

1. **Panel 表面微妙噪点纹理**

   ```css
   .a3-panel::before {
     background-image: url('data:image/svg+xml,...'); /* 细腻噪点 */
     opacity: 0.03;
     mix-blend-mode: overlay;
   }
   ```

2. **动态光束扫描**
   - Panel 到达峰值时，表面有光束从左上角扫到右下角
   - 使用 `linear-gradient` 背景位移
   - 光束颜色：`color-mix(in srgb, var(--accent) 20%, white)`
   - 时长 400ms，只在 peak 阶段出现一次

3. **Panel 间关系线**
   - 所有 panel 落位后，六块之间出现淡淡的连线
   - SVG path，虚线样式：`stroke: rgba(26,24,20,0.08)`
   - 逐条淡入（`Animate stagger`，每条延迟 120ms）
   - 暗示"timeline 关系"

4. **标题增强下划线**
   - 标题显影后，文字下方出现细横线
   - 从中心向两侧展开（`scaleX: 0 → 1`）
   - 颜色：`var(--accent)`，粗细 1px
   - 强化"时间轴"的视觉隐喻

### 运动微调：

- 倒放 blur 起点：0.34vw → 0.28vw（减少 blur 开销）
- Panel 落位后增加轻微 settle（最后 50ms 内微调 scale）

**文件修改**：

- `site/src/components/Act3DollyScene.tsx`
- `site/src/components/Act3DollyScene.css`

---

## 三、新增第五幕（RuntimeControlScene）

### 核心概念

用框架特性构建一个"真实运行的控制台"场景，展示：

- **loopAnimation** 性能（无限循环动画）
- **运行时控制**（滚动驱动的 playbackRate 加速）
- **插件扩展** + **类型安全** + **性能优化**

### 布局结构

```
┌────────────────────────────────────────────────┐
│  [时间码胶囊 REC 00:00:08]   SHOT 05 · RUNTIME │
│                                                │
│         Loops run free, you stay in control    │  ← 主标题
│                                                │
│  ┌─────────────────────────────────────────┐  │
│  │         [循环动画控制台]                  │  │
│  │                                          │  │
│  │    ◯────── 旋转光环（2.4s/圈）          │  │
│  │   ╱    ╲                                │  │
│  │  │  ◉  │  呼吸脉冲（1.8s周期）          │  │
│  │   ╲    ╱                                │  │
│  │    ◯──────                              │  │
│  │                                          │  │
│  │  • • • • • •  粒子轨道（3.2s/圈）      │  │
│  │                                          │  │
│  │  ━━━━━━━━━━━━━━━━━━━━  ← 滚动进度映射 │  │
│  │  Playback Rate: 1.0x → 2.5x            │  │
│  └─────────────────────────────────────────┘  │
│                                                │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐ │
│  │ 🔌        │  │ 🔷        │  │ ⚡        │ │
│  │ Plugin    │  │ Type Safe │  │ 55KB     │ │
│  │ MCP hooks │  │ Full TS   │  │ Tree-shk │ │
│  └───────────┘  └───────────┘  └───────────┘ │
└────────────────────────────────────────────────┘
```

### 时间轴编排（center-lock 8000ms）

```
0ms ────► 800ms ────► 2400ms ────► 4000ms ────► 6000ms ────► 8000ms
  │          │           │            │            │            │
 标题      光环激活    呼吸激活     粒子激活    加速到2.5x    hold驻留
 入场      开始循环    开始循环     开始循环    (展示rate)   (满载运行)
```

### 三层循环动画

1. **外层旋转光环**（800ms 激活）
   - 直径 280px，描边渐变（琥珀→accent）
   - `rotate: [0, 360], duration: 2.4s, repeat: Infinity`
   - 激活后永续顺时针旋转

2. **中心呼吸脉冲**（2400ms 激活）
   - 直径 120px，实心圆
   - `scale: [0.88, 1.12], opacity: [0.7, 1], duration: 1.8s`
   - 激活后永续呼吸

3. **底部粒子轨道**（4000ms 激活）
   - 6个小圆点（直径 12px），沿椭圆轨道公转
   - 每个粒子错峰起跑（stagger 120ms）
   - `rotate: [0, 360], duration: 3s, repeat: Infinity`
   - 激活后永续逆时针公转

### 滚动驱动加速（6000-8000ms）

在 6000ms 时，通过 CSS 变量 `--loop-speed` 控制，三层动画同时加速到 2.5x，配合文字显示 "Playback Rate: 2.5x"。

### 底部三个特性卡片（4400ms 依次入场）

1. **🔌 Extensible**
   - Plugin Architecture
   - MCP integration · Custom hooks
   - Plugin arch

2. **🔷 Type Safe**
   - Full TypeScript
   - Full IntelliSense · Zero overhead
   - 100% coverage

3. **⚡ Optimized**
   - Production Ready
   - Tree-shakeable · Smart preload
   - 55KB gzip

**文件新增**：

- `site/src/components/RuntimeControlScene.tsx`
- `site/src/components/RuntimeControlScene.css`

---

## 四、删除旧的第五幕

已从 HomePage 中移除对 ProductionScene 的引用，替换为新的 RuntimeControlScene。

**文件修改**：

- `site/src/pages/HomePage.tsx`

---

## 视觉设计原则

基于 ui-skills 的设计理念：

1. **animation-systems 原则**
   - 减少昂贵的 blur 效果
   - 使用 CSS 变量驱动循环动画
   - translateZ(0) 提升合成层避免全屏重绘

2. **baseline-ui 原则**
   - 保持暖白底色（#faf8f4）+ 滚动驱动色带
   - Fraunces 衬线（display）+ Inter 无衬线（正文）+ Roboto Mono（技术标签）
   - 胶片电影感（REC 红点、齿孔走片、时间码胶囊）

3. **视觉一致性**
   - 所有新增元素复用现有的 accent 色系
   - 保持 32px 网格点底纹
   - 暖白半透药丸 + 毛玻璃（backdrop-filter）

---

## 技术实现亮点

1. **框架特性充分展示**
   - loopAnimation 驱动三层独立循环
   - center-lock 接管滚动区域
   - stagger 错峰编排（粒子、关系线、卡片）
   - timeline 时间轴接力激活

2. **性能优化**
   - 避免每帧写 CSS 变量导致全屏重绘
   - 使用 translateZ(0) 提升合成层
   - 减少 blur 面积和强度

3. **交互反馈**
   - 光束扫描在 peak 时刻出现
   - 粒子飞行强化帧切换
   - 运行指示灯脉冲证明动画运行中

---

## 下一步建议

1. **真机测试**
   - 在移动设备上验证三层循环动画的性能
   - 确认关系线在窄屏上的可读性

2. **可能的微调**
   - 根据用户反馈调整光束扫描的时机和强度
   - 考虑是否需要在帧间粒子中加入更多变化
   - 第五幕的三个卡片内容可以进一步细化

3. **文案优化**
   - 可以考虑为每个特性卡片增加更具体的数据支撑
   - 主标题 "Loops run free, you stay in control" 可以根据品牌调性调整

---

## 验证方式

启动开发服务器：

```bash
cd site && pnpm dev
```

访问 http://localhost:4001/ 查看效果。

重点观察：

- 第二幕：时间轴、粒子、运行指示灯
- 第三幕：噪点纹理、光束扫描、关系线、标题下划线
- 第五幕：三层循环动画的递进激活、滚动驱动加速、底部卡片

---

**实施日期**：2026-09-05  
**状态**：✅ 完成初版，等待用户反馈后续调整
