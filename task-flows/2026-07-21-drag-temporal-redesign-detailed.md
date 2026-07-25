# Temporal Drag 详细设计规范

> 版本: v1.0 | 日期: 2026-07-21 | 状态: 设计规范（不实现）
> 范围: `/drag` 页面 4-Scene drag 体验，暗调电影显影室主题

---

## 目录

1. [全局设计系统](#1-全局设计系统)
2. [全局交互规范](#2-全局交互规范)
3. [公共组件规范](#3-公共组件规范)
4. [Scene 01 — 显影盘 (Debut)](#4-scene-01--显影盘-debut)
5. [Scene 02 — 编排轴 (Choreograph)](#5-scene-02--编排轴-choreograph)
6. [Scene 03 — 时间瀑布 (Flux)](#6-scene-03--时间瀑布-flux)
7. [Scene 04 — 定格 (Cut)](#7-scene-04--定格-cut)
8. [动画时序总表](#8-动画时序总表)
9. [文件结构与实现顺序](#9-文件结构与实现顺序)
10. [性能预算与热路径清单](#10-性能预算与热路径清单)

---

## 1. 全局设计系统

### 1.1 色彩 Token（局部作用域）

通过 `.drag-temporal` 类注入，不污染全局 tokens.css。

```css
.drag-temporal {
  /* 背景 */
  --tp-bg: #0c0a08;
  --tp-bg-elevated: #161412;
  --tp-bg-glass: rgba(12, 10, 8, 0.72);

  /* 文字 */
  --tp-ink: #ede8e0;
  --tp-ink-soft: #9a948a;
  --tp-ink-mute: #5c564e;
  --tp-ink-faint: rgba(237, 232, 224, 0.06);

  /* 强调 */
  --tp-accent: #c9a16c;
  --tp-accent-soft: #a08050;
  --tp-accent-dim: rgba(201, 161, 108, 0.18);
  --tp-accent-glow: rgba(201, 161, 108, 0.28);

  /* 功能色 */
  --tp-rec: #c44b3a;
  --tp-rec-glow: rgba(196, 75, 58, 0.22);

  /* 结构与线 */
  --tp-rule: rgba(237, 232, 224, 0.08);
  --tp-rule-strong: rgba(237, 232, 224, 0.14);
  --tp-border-glass: rgba(237, 232, 224, 0.06);
}
```

### 1.2 字号刻度（drag viewport，container-query 驱动）

drag viewport 声明 `container-type: inline-size`。所有字号基于 `cqw`（容器查询宽度百分比）。

设计基准: `config.size = 390`（手机壳逻辑宽度）。

| Token | 公式 | 390px 下 | 520px 下 | 用途 |
|-------|------|---------|---------|------|
| `--tp-text-2xs` | `clamp(8px, 2.0cqw, 11px)` | 7.8px→8px | 10.4px | 刻度标签、帧号、辅助读数 |
| `--tp-text-xs` | `clamp(10px, 2.5cqw, 13px)` | 9.75px→10px | 13px | slate、eyebrow、HUD 文字 |
| `--tp-text-sm` | `clamp(12px, 3.0cqw, 16px)` | 11.7px→12px | 15.6px→16px | 副标题、节点标签、按钮 |
| `--tp-text-md` | `clamp(16px, 4.2cqw, 22px)` | 16.4px→16px | 21.8px→22px | 正文、参数值、时间码读数 |
| `--tp-text-lg` | `clamp(24px, 6.8cqw, 42px)` | 26.5px→24px | 35.4px | 中等标题、节点大标题 |
| `--tp-text-xl` | `clamp(36px, 10cqw, 64px)` | 39px→36px | 52px | 主标题、CUT |
| `--tp-text-2xl` | `clamp(48px, 15cqw, 96px)` | 58.5px→48px | 78px | 巨型时间码、中心数字 |

> **规则**: 在 390px 下 clamp 取下限（min），在 520px+ 下取上限（max）。中间值由 `cqw` 线性插值。确保文字在任何容器宽度下都不溢出且比例协调。

### 1.3 间距刻度

| Token | 公式 | 390px 下 | 用途 |
|-------|------|---------|------|
| `--tp-space-1` | `clamp(2px, 0.6cqw, 4px)` | 2.3px→2px | 极细间隙 |
| `--tp-space-2` | `clamp(4px, 1.2cqw, 8px)` | 4.7px→4px | 图标与文字间隙 |
| `--tp-space-3` | `clamp(8px, 2.0cqw, 14px)` | 7.8px→8px | 小间距 |
| `--tp-space-4` | `clamp(12px, 3.0cqw, 22px)` | 11.7px→12px | 标准间距 |
| `--tp-space-5` | `clamp(18px, 4.5cqw, 32px)` | 17.6px→18px | 中等间距 |
| `--tp-space-6` | `clamp(24px, 6.0cqw, 42px)` | 23.4px→24px | 大间距 |
| `--tp-space-7` | `clamp(36px, 9.0cqw, 64px)` | 35.1px→36px | 区块间距 |
| `--tp-space-8` | `clamp(48px, 12cqw, 86px)` | 46.8px→48px | 超大间距 |

### 1.4 圆角与阴影

```css
--tp-radius-sm: 4px;
--tp-radius: 8px;
--tp-radius-pill: 999px;
--tp-shadow-glow: 0 0 20px 4px var(--tp-accent-glow);
--tp-shadow-subtle: 0 4px 24px rgba(0, 0, 0, 0.4);
```

### 1.5 字体栈

```css
--tp-font-display: 'Fraunces', 'Songti SC', Georgia, serif;
--tp-font-body: 'Inter', 'PingFang SC', 'Source Han Sans SC', 'Microsoft YaHei', system-ui, sans-serif;
--tp-font-mono: 'Roboto Mono', ui-monospace, 'SF Mono', Menlo, monospace;
```

### 1.6 缓动曲线

```css
--tp-ease-out: cubic-bezier(0.16, 1, 0.3, 1);      /* 主要出场 */
--tp-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);  /* 生长/展开 */
--tp-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* 弹性 */
--tp-ease-linear-out: cubic-bezier(0.4, 0, 0.2, 1); /* 刻度亮起 */
```

---

## 2. 全局交互规范

### 2.1 拖拽行为（CineView 层）

```tsx
<CineView
  config={{ size: 390 }}
  mode="drag"
  modes={{
    drag: {
      direction: 'y',
      transitionDuration: 720,   // Scene 切换动画时长 ms
      dragTimeScale: 16,         // 每 1% 拖拽 = 1600ms element 轨推进
      threshold: {
        minVelocity: 0,
        maxVelocity: 1200,
        minThreshold: 0.15,      // 快速滑动 (>800px/s)
        maxThreshold: 0.32,      // 慢速滑动 (<400px/s)
      },
    },
  }}
>
```

### 2.2 拖拽反馈（每 Scene 共享）

| 状态 | 效果 | 实现 | 性能 |
|------|------|------|------|
| **拖拽中** | 当前 Scene 整体 `opacity: 0.92` | `useTransform(progress, [0,0.5,1], [1,0.92,1])` 绑定到 Scene 容器 | motionValue，零渲染 |
| **拖拽中** | 背景有 0.8% 横向视差位移 | `useTransform(progress, [0,1], ['-0.8%', '0.8%'])` 绑定到背景层 | motionValue |
| **拖拽中** | 中心内容区微缩放 `scale(0.985)` | `useTransform(progress, [0,0.5,1], [1,0.985,1])` | motionValue |
| **释放 settle** | 弹簧回弹：`stiffness: 180, damping: 14` | 框架内置 release 动画 | Framer Motion spring |
| **释放 bounce** | 弹性回弹：`stiffness: 220, damping: 18` | 框架内置 | Framer Motion spring |

### 2.3 Scene 切换过渡

- 过渡方向: `y` 轴（上下拖拽）
- 当前 Scene exit: `fade-out` + `slide-down`（被拖走方向）
- 下一 Scene enter: `fade-in` + `slide-up`（从下方进入）
- 重叠: 无显式重叠，由框架 drag 引擎自然处理（renderProgress 连续位移）

### 2.4 首屏冷启动门控

Scene 01 的所有 Animate 元素参与 `firstSceneEnterReady` 冷启动门控：
- 首屏关键资产（字体已预加载，无需额外等待）就绪前，所有元素停在 `initial` 态
- 就绪后统一触发入场链
- Scene 02/03/04 不受首屏门控，由 Scene 切换时各自触发

### 2.5 减少动态偏好

`prefers-reduced-motion: reduce` 时：
- 所有 `infiniteAnimation` 停止（REC pulse、DRAG float、齿孔环旋转）
- 所有 stagger `each` 归零（瞬间展开）
- 所有 transition duration 压缩至 `0.08s`
- 背景流动层暂停
- 时间码停止自增，显示静态值

---

## 3. 公共组件规范

### 3.1 Header HUD（4 镜共用）

**结构**:
```tsx
<header className="tp-hud">
  <div className="tp-hud__left">
    <RecBadge isRecording={isRecording} />
    <TimecodeDisplay value={timecode} animateId={`tc-${sceneId}`} />
  </div>
  <div className="tp-hud__right">
    <HudReadout label="FPS" value="25" />
    <HudReadout label="SMPTE" />
    <HudReadout label="ISO" value="800" />
  </div>
</header>
```

**CSS**:
```css
.tp-hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 clamp(16px, 4cqw, 24px);
  border-bottom: 1px solid var(--tp-rule);
  position: relative;
  z-index: 10;
}

.tp-hud__left,
.tp-hud__right {
  display: flex;
  align-items: center;
  gap: var(--tp-space-3);
}

.tp-hud__right {
  gap: var(--tp-space-4);
}
```

**Animate**（Header 整体）:
```tsx
<Animate
  animateId={`hud-${sceneId}`}
  enterAnimation="fade-in"
  duration={{ enter: 480 }}
  timeline={{ delay: 0 }}
>
  <header className="tp-hud">...</header>
</Animate>
```

#### 3.1.1 RecBadge

| 属性 | 值 |
|------|-----|
| 结构 | flex, align-center, gap: 8px |
| 红点 | 7px × 7px, border-radius: 50%, background: var(--tp-rec) |
| 红点光晕 | `box-shadow: 0 0 0 4px var(--tp-rec-glow)` |
| 文字 | "REC", mono, var(--tp-text-2xs), color: var(--tp-rec), letter-spacing: 0.12em |
| **Animate** | `enterAnimation="fade-in"`, duration: 400ms |
| **infinite** | `infiniteAnimation="pulse"`（仅在 `isRecording=true` 时） |

**CSS pulse**:
```css
@keyframes tp-rec-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
}
.tp-rec-dot {
  animation: tp-rec-pulse 1.8s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .tp-rec-dot { animation: none; opacity: 1; }
}
```

#### 3.1.2 TimecodeDisplay

| 属性 | 值 |
|------|-----|
| 结构 | 11 个独立 span（8 位数字 + 3 个冒号），mono 字体 |
| 字号 | var(--tp-text-xs) |
| 颜色 | var(--tp-ink-soft) |
| 字间距 | 0.08em |
| **Animate** | `enterAnimation` 逐位 stagger fade-in + slide-up |

**精确 Animate 配置**:
```tsx
<Animate
  animateId={`tc-${sceneId}`}
  enterAnimation={{
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  }}
  stagger={{ each: 40 }}
  timeline={{ waitFor: `hud-${sceneId}`, delay: 120 }}
>
  {timecode.split('').map((ch, i) => (
    <span key={i} className="mono">{ch}</span>
  ))}
</Animate>
```

> timecode 字符串示例: `"00:00:00:00"` → 11 个字符。stagger each 40ms = 总 440ms。

#### 3.1.3 HudReadout

| 属性 | 值 |
|------|-----|
| 结构 | 两行 flex-column（label 在上，value 在下）或单行 `label value` |
| label | mono, var(--tp-text-2xs), color: var(--tp-ink-mute), uppercase |
| value | mono, var(--tp-text-xs), color: var(--tp-ink-soft) |
| **Animate** | `fade-in`, waitFor: `tc-${sceneId}` |

### 3.2 Footer 条（4 镜共用）

**结构**:
```tsx
<footer className="tp-footer">
  <SprocketStrip count={3} />
  <span className="tp-footer__frame mono">FRAME {frameNumber}</span>
  <span className="tp-footer__hint">{hintText}</span>
</footer>
```

**CSS**:
```css
.tp-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(16px, 4cqw, 24px);
  height: 40px;
  border-top: 1px solid var(--tp-rule);
}

.tp-footer__frame {
  font-family: var(--tp-font-mono);
  font-size: var(--tp-text-2xs);
  color: var(--tp-ink-mute);
  letter-spacing: 0.1em;
}

.tp-footer__hint {
  font-family: var(--tp-font-mono);
  font-size: var(--tp-text-2xs);
  color: var(--tp-ink-mute);
  letter-spacing: 0.06em;
}
```

#### 3.2.1 SprocketStrip

| 属性 | 值 |
|------|-----|
| 单个齿孔 | 4px × 6px, border-radius: 1px, background: var(--tp-ink-faint) |
| 排列 | flex, gap: 6px |
| **Animate** | `fade-in`, stagger: { each: 60 } |

### 3.3 Slate 标签

| 属性 | 值 |
|------|-----|
| 结构 | 单行 mono 文字 |
| 字号 | var(--tp-text-xs) |
| 颜色 | var(--tp-ink-mute) |
| 字间距 | 0.16em |
| 文字变换 | uppercase |
| **位置** | 紧接 Header 下方，padding-top: var(--tp-space-3), padding-left: clamp(16px, 4cqw, 24px) |
| **Animate** | `fade-in`, waitFor: `hud-${sceneId}` |

### 3.4 装饰齿孔（Sprocket）

| 属性 | 值 |
|------|-----|
| 尺寸 | 4px × 6px（标准）/ 3px × 5px（小）/ 5px × 7px（大） |
| 圆角 | 1px |
| 背景 | var(--tp-ink-faint) |
| 悬停/亮起 | background: var(--tp-accent-dim) |
| **Position 定位** | 见各 Scene 具体坐标 |

---

## 4. Scene 01 — 显影盘 (Debut)

### 4.1 整体结构

```tsx
<Scene
  sceneId="rolling"
  className="tp-scene tp-scene--01"
  layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
>
  <div className="tp-scene__inner">
    <HeaderHUD sceneId="rolling" timecode="00:00:00:00" frame={1} />
    <Slate text="01 / ROLLING" />

    <div className="s01-center">
      {/* 显影盘 */}
      <div className="s01-dial">
        <DialTicks />
        <DialInnerRing />
        <DialCenterNumber />
        <DialHands />
      </div>

      {/* 标题区 */}
      <div className="s01-title-area">
        <Eyebrow text="CINEMATIC UI FRAMEWORK" />
        <MainTitle text="CineView" />
        <Subtitle text="Direct every frame like a filmmaker" />
      </div>

      {/* DRAG 提示 */}
      <DragHint />
    </div>

    {/* 四角装饰 */}
    <CornerDecoration position="tl" />
    <CornerDecoration position="tr" />
    <CornerDecoration position="bl" />
    <CornerDecoration position="br" />

    <Footer frame={1} hint="After release, time keeps finishing" />
  </div>
</Scene>
```

**Scene CSS**:
```css
.tp-scene--01 {
  background: var(--tp-bg);
  color: var(--tp-ink);
}

.tp-scene__inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.s01-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--tp-space-6);
  min-height: 0;
  padding: var(--tp-space-4) 0;
}
```

### 4.2 显影盘 Dial

#### 4.2.1 外环刻度 (DialTicks)

**结构**: 60 个 `div.tick` 绝对定位在圆周上。

**数学**: 半径 `r = 32.5cqw`（直径 65cqw）。每根刻度角度 `θ = i × 6°`（i = 0..59）。

定位公式（CSS custom property）:
```css
.tick {
  position: absolute;
  left: 50%;
  top: 50%;
  transform:
    translate(-50%, -50%)
    rotate(calc(var(--i) * 6deg))
    translateY(calc(var(--r) * -1));
}
```

**刻度规格**:

| 类型 | 数量 | 尺寸 | 颜色 | 标签 |
|------|------|------|------|------|
| 主刻度 | 12 根（每 5 格） | 1px × 18px | var(--tp-ink-mute) | 有数字标签 `05` `10`...`60` |
| 次刻度 | 48 根 | 1px × 10px | var(--tp-ink-faint) | 无 |

**数字标签**:
- 位置: 刻度外侧 14px
- 字体: mono, var(--tp-text-2xs)
- 颜色: var(--tp-ink-mute)
- 旋转修正: `rotate(calc(var(--i) * -6deg))`（保持数字正向）

**Animate 配置**:
```tsx
<Animate
  animateId="dial-ticks"
  enterAnimation={{
    initial: { opacity: 0, scale: 0 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
    }
  }}
  stagger={{ each: 28 }}
  timeline={{ waitFor: 'hud-rolling', delay: 200 }}
>
  {ticks.map((tick, i) => (
    <div key={i} className={`tick ${tick.isMajor ? 'tick--major' : ''}`} style={{ '--i': i }}>
      <div className="tick__bar" />
      {tick.isMajor && <span className="tick__label mono">{tick.label}</span>}
    </div>
  ))}
</Animate>
```

**亮起效果**（CSS，非动画，静态样式）:
```css
.tick__bar {
  width: 1px;
  background: var(--tp-ink-faint);
  transition: background 0.3s ease, box-shadow 0.3s ease;
}

.tick--major .tick__bar {
  height: 18px;
  background: var(--tp-ink-mute);
}

.tick:not(.tick--major) .tick__bar {
  height: 10px;
}

/* 被"拉动"时的拖拽反馈 — 由 JS 通过 data 属性控制 */
.tick[data-highlight='true'] .tick__bar {
  background: var(--tp-accent);
  box-shadow: 0 0 6px 1px var(--tp-accent-glow);
}
```

#### 4.2.2 内环 (DialInnerRing)

| 属性 | 值 |
|------|-----|
| 直径 | 45cqw（半径 22.5cqw） |
| 边框 | 1px solid rgba(237,232,224,0.1) |
| border-radius | 50% |
| **Animate** | scale: 0→1, opacity: 0→1 |

```tsx
<Animate
  animateId="dial-inner-ring"
  enterAnimation={{
    initial: { scale: 0, opacity: 0 },
    animate: {
      scale: 1,
      opacity: 1,
      transition: { duration: 1, ease: [0.16, 1, 0.3, 1] }
    }
  }}
  timeline={{ delay: 1600 }}
>
  <div className="s01-inner-ring" />
</Animate>
```

**CSS**:
```css
.s01-inner-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 45cqw;
  height: 45cqw;
  border: 1px solid rgba(237, 232, 224, 0.1);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
```

#### 4.2.3 中心数字 "01"

| 属性 | 值 |
|------|-----|
| 字体 | Fraunces, 600 |
| 字号 | var(--tp-text-2xl) |
| 颜色 | var(--tp-ink) |
| 字间距 | -0.04em |

**Animate**（组合动画：blur-in → zoom-in sequential）:
```tsx
<Animate
  animateId="scene-number-01"
  enterAnimation={{
    animations: [
      {
        initial: { opacity: 0, filter: 'blur(12px)' },
        animate: {
          opacity: 1,
          filter: 'blur(0px)',
          transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
        }
      },
      {
        initial: { scale: 0.7 },
        animate: {
          scale: 1,
          transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
        }
      }
    ],
    mode: 'sequential',
    delay: [0, 120]
  }}
  duration={{ enter: 1100 }}
  timeline={{ waitFor: 'dial-inner-ring', delay: 200 }}
>
  <span className="s01-center-number">01</span>
</Animate>
```

#### 4.2.4 指针 (DialHands)

**秒针**:

| 属性 | 值 |
|------|-----|
| 宽度 | 1px |
| 高度 | 22cqw |
| 背景 | var(--tp-accent) |
| transform-origin | bottom center |
| 初始角度 | 0°（12 点方向） |
| 目标角度 | 48° |

**分针**:

| 属性 | 值 |
|------|-----|
| 宽度 | 2px |
| 高度 | 15cqw |
| 背景 | var(--tp-ink-soft) |
| transform-origin | bottom center |
| 初始角度 | 0° |
| 目标角度 | -24° |

```tsx
{/* 秒针 */}
<Animate
  animateId="hand-second"
  enterAnimation="rotate-in"
  duration={{ enter: 800 }}
  timeline={{ waitFor: 'scene-number-01' }}
>
  {(state) => (
    <motion.div
      className="s01-hand s01-hand--second"
      style={{ rotate: state.enterProgress * 48 }}
    />
  )}
</Animate>

{/* 分针 */}
<Animate
  animateId="hand-minute"
  enterAnimation="rotate-in"
  duration={{ enter: 800 }}
  timeline={{ waitFor: 'scene-number-01', delay: 120 }}
>
  {(state) => (
    <motion.div
      className="s01-hand s01-hand--minute"
      style={{ rotate: state.enterProgress * -24 }}
    />
  )}
</Animate>
```

**CSS**:
```css
.s01-hand {
  position: absolute;
  left: 50%;
  bottom: 50%;
  transform-origin: bottom center;
  border-radius: 1px;
}

.s01-hand--second {
  width: 1px;
  height: 22cqw;
  background: var(--tp-accent);
  margin-left: -0.5px;
}

.s01-hand--minute {
  width: 2px;
  height: 15cqw;
  background: var(--tp-ink-soft);
  margin-left: -1px;
}
```

**拖拽反馈**: 拖拽时秒针叠加微小震颤。通过添加/移除 CSS class `.is-shaking` 控制，不经过 React state。

```css
.s01-hand--second.is-shaking {
  animation: tp-hand-shake 0.15s ease-in-out infinite;
}
@keyframes tp-hand-shake {
  0%, 100% { transform: rotate(var(--base-angle)) translateX(0); }
  25% { transform: rotate(var(--base-angle)) translateX(0.3px); }
  75% { transform: rotate(var(--base-angle)) translateX(-0.3px); }
}
```

### 4.3 标题区

#### 4.3.1 Eyebrow

| 属性 | 值 |
|------|-----|
| 文字 | "CINEMATIC UI FRAMEWORK" |
| 字体 | mono |
| 字号 | var(--tp-text-xs) |
| 颜色 | var(--tp-ink-mute) |
| 字间距 | 0.22em |
| 文字变换 | uppercase |

```tsx
<Animate
  animateId="s01-eyebrow"
  enterAnimation="fade-in"
  duration={{ enter: 500 }}
  timeline={{ waitFor: 'hand-second' }}
>
  <p className="s01-eyebrow">CINEMATIC UI FRAMEWORK</p>
</Animate>
```

#### 4.3.2 主标题 "CineView"

| 属性 | 值 |
|------|-----|
| 字体 | Fraunces, 600 |
| 字号 | var(--tp-text-xl) |
| 颜色 | var(--tp-ink) |
| 字间距 | -0.03em |
| margin-top | var(--tp-space-3) |

```tsx
<Animate
  animateId="s01-title"
  enterAnimation={{
    animations: [
      {
        initial: { opacity: 0, filter: 'blur(8px)' },
        animate: {
          opacity: 1,
          filter: 'blur(0px)',
          transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
        }
      },
      {
        initial: { y: '18%', opacity: 0 },
        animate: {
          y: 0,
          opacity: 1,
          transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
        }
      }
    ],
    mode: 'sequential',
    delay: [0, 80]
  }}
  duration={{ enter: 1100 }}
  timeline={{ waitFor: 's01-eyebrow' }}
>
  <h1 className="s01-title">CineView</h1>
</Animate>
```

#### 4.3.3 副标题

| 属性 | 值 |
|------|-----|
| 文字 | "Direct every frame like a filmmaker" |
| 字体 | Inter |
| 字号 | var(--tp-text-sm) |
| 颜色 | var(--tp-ink-soft) |
| max-width | 22ch |
| text-align | center |
| margin-top | var(--tp-space-3) |
| line-height | 1.5 |

```tsx
<Animate
  animateId="s01-subtitle"
  enterAnimation="slide-up"
  duration={{ enter: 700 }}
  timeline={{ waitFor: 's01-title', delay: 100 }}
>
  <p className="s01-subtitle">Direct every frame like a filmmaker</p>
</Animate>
```

### 4.4 DRAG 提示

| 属性 | 值 |
|------|-----|
| 尺寸 | 直径 48px |
| 边框 | 1px solid rgba(201,161,108,0.35) |
| border-radius | 50% |
| 内部布局 | flex-column, align-center, justify-center, gap: 2px |
| 文字 "DRAG" | mono, 8px, var(--tp-accent), letter-spacing: 0.14em |
| 箭头 "↓" | mono, 10px, var(--tp-accent) |
| margin-top | var(--tp-space-5) |

```tsx
<Animate
  animateId="drag-hint"
  enterAnimation="fade-in"
  duration={{ enter: 520 }}
  infiniteAnimation={{
    animate: { y: [0, 6, 0] },
    transition: { duration: 3, ease: 'easeInOut', repeat: Infinity }
  }}
  timeline={{ waitFor: 's01-subtitle', delay: 200 }}
>
  <div className="s01-drag-hint">
    <span>DRAG</span>
    <span>↓</span>
  </div>
</Animate>
```

**CSS**:
```css
.s01-drag-hint {
  width: 48px;
  height: 48px;
  border: 1px solid rgba(201, 161, 108, 0.35);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.s01-drag-hint span:first-child {
  font-family: var(--tp-font-mono);
  font-size: 8px;
  color: var(--tp-accent);
  letter-spacing: 0.14em;
}

.s01-drag-hint span:last-child {
  font-family: var(--tp-font-mono);
  font-size: 10px;
  color: var(--tp-accent);
}
```

### 4.5 四角装饰（CornerDecoration）

#### 4.5.1 左上 — 3 个齿孔

| 属性 | 值 |
|------|-----|
| Position at | `{ x: 36, y: 72 }` |
| 内容 | 3 个 sprocket，垂直排列，gap: 8px |
| **Animate** | stagger fade-in, each: 80ms |

```tsx
<Position at={{ x: 36, y: 72 }}>
  <Animate
    enterAnimation="fade-in"
    stagger={{ each: 80 }}
    timeline={{ waitFor: 'drag-hint', delay: 300 }}
  >
    <span className="tp-sprocket" />
    <span className="tp-sprocket" />
    <span className="tp-sprocket" />
  </Animate>
</Position>
```

#### 4.5.2 右上 — 场记信息

| 属性 | 值 |
|------|-----|
| Position at | `{ x: -32, y: 72, offsetX: 'right' }` |
| 内容 | 两行 mono 文字 |
| 行1 | "SCENE 01" |
| 行2 | "TAKE 01" |
| 字号 | var(--tp-text-2xs) |
| 颜色 | var(--tp-ink-mute) |
| 字间距 | 0.1em |
| text-align | right |

```tsx
<Position at={{ x: -32, y: 72, offsetX: 'right' }}>
  <Animate
    enterAnimation="fade-in"
    duration={{ enter: 500 }}
    timeline={{ waitFor: 'drag-hint', delay: 300 }}
  >
    <div className="tp-corner-info" style={{ textAlign: 'right' }}>
      <div className="mono">SCENE 01</div>
      <div className="mono">TAKE 01</div>
    </div>
  </Animate>
</Position>
```

#### 4.5.3 左下 — 导演标记

| 属性 | 值 |
|------|-----|
| Position at | `{ x: 36, y: -56 }` |
| 内容 | 两行 mono 文字 |
| 行1 | "DIRECTOR'S CUT" |
| 行2 | "CineView" |
| 字号 | var(--tp-text-2xs) |
| 颜色 | var(--tp-ink-mute) / var(--tp-accent-soft) |

```tsx
<Position at={{ x: 36, y: -56 }}>
  <Animate
    enterAnimation="fade-in"
    duration={{ enter: 500 }}
    timeline={{ waitFor: 'drag-hint', delay: 300 }}
  >
    <div className="tp-corner-info">
      <div className="mono" style={{ color: 'var(--tp-ink-mute)' }}>
        DIRECTOR'S CUT
      </div>
      <div className="mono" style={{ color: 'var(--tp-accent-soft)' }}>
        CineView
      </div>
    </div>
  </Animate>
</Position>
```

#### 4.5.4 右下 — 散落齿孔

| 属性 | 值 |
|------|-----|
| Position at | `{ x: -52, y: -72, offsetX: 'right' }` |
| 内容 | 4 个 sprocket，2×2 网格，gap: 10px |
| **Animate** | stagger fade-in, each: 100ms |

```tsx
<Position at={{ x: -52, y: -72, offsetX: 'right' }}>
  <Animate
    enterAnimation="fade-in"
    stagger={{ each: 100 }}
    timeline={{ waitFor: 'drag-hint', delay: 400 }}
  >
    <span className="tp-sprocket" />
    <span className="tp-sprocket" />
    <span className="tp-sprocket" />
    <span className="tp-sprocket" />
  </Animate>
</Position>
```

### 4.6 Scene 01 拖拽交互反馈（精确数值）

| 反馈 | 触发条件 | 数值 | 实现 |
|------|---------|------|------|
| 显影盘整体微旋转 | `isDragging` | `rotate = progress × 5°`（±5° 范围） | `useTransform(progress, [0,1], [-5, 5])` → 绑定 dial 容器 style.rotate |
| 刻度高亮扇区 | `isDragging` | 拖拽方向 ±30° 扇区内刻度：scale(1.08), opacity(1) | 计算角度差，通过 data 属性控制 |
| 刻度压暗 | `isDragging` | 反向扇区刻度：scale(0.92), opacity(0.3) | 同上 |
| 秒针震颤 | `isDragging` | 幅度 0.3px，频率 6.7Hz（0.15s cycle） | CSS class toggle `.is-shaking` |
| 释放回弹 | `onDragEnd` | spring: stiffness 180, damping 14 | 框架内置 |
| 刻度群校准闪 | `onDragCommit` 后 0.5s | 全部刻度 opacity 0.3→1→0.3→1，0.4s | CSS animation 一次性触发 |
| 时间码加速 | `isDragging` | 自增间隔从 40ms → 20ms（2x 速度） | RAF 间隔调整 |

### 4.7 Scene 01 时间码自增逻辑

```tsx
// 伪代码 — 说明实现思路，非真实代码
function useTimecode(startFrame: number, isDragging: boolean) {
  const timecodeRef = useRef(startFrame);
  const rafRef = useRef<number>();

  useEffect(() => {
    const interval = isDragging ? 20 : 40; // ms per frame
    let last = performance.now();

    const tick = (now: number) => {
      if (now - last >= interval) {
        timecodeRef.current += 1;
        // 直接写入 DOM ref，不触发 React 渲染
        if (domRef.current) {
          domRef.current.textContent = formatTimecode(timecodeRef.current);
        }
        last = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isDragging]);
}
```

### 4.8 Scene 01 入场时序甘特图

```
时间轴 (ms)
0        500      1000     1500     2000     2500     3000     3500     4000     4500
├─HUD────┤
│        ├─timecode stagger─────┤ (11×40ms)
│        ├─ticks stagger────────────────────────────────────┤ (60×28ms=1680ms)
│                 │        ├─inner-ring───┤
│                          │              ├─"01" blur→zoom─┤ (1100ms)
│                                         │                ├─hands rotate─┤
│                                                          │              ├─eyebrow─┤
│                                                                        │         ├─title blur→slide─┤
│                                                                                    │                ├─subtitle─┤
│                                                                                                     │          ├─DRAG hint─┤
│                                                                                                                  │         ├─corners stagger─┤
```

---

## 5. Scene 02 — 编排轴 (Choreograph)

### 5.1 整体结构

```tsx
<Scene
  sceneId="sync"
  className="tp-scene tp-scene--02"
  layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
>
  <div className="tp-scene__inner">
    <HeaderHUD sceneId="sync" timecode="00:00:01:00" frame={42} />
    <Slate text="02 / CHOREOGRAPH" />

    <div className="s02-center">
      <Eyebrow text="DECLARATIVE TIMELINE" />
      <MainTitle text="Order & position, resolved" />

      <div className="s02-timeline">
        <TimelineBase />
        <TimelineNodes />
        <ConnectionLights />
      </div>

      <NodeLabels />
      <ParamPanel />
    </div>

    <Footer frame={42} hint="Elements arrive in turn" />
  </div>
</Scene>
```

**Scene CSS**:
```css
.tp-scene--02 {
  background: var(--tp-bg-elevated);
  color: var(--tp-ink);
}

.s02-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--tp-space-5);
  padding: var(--tp-space-4) clamp(16px, 4cqw, 32px);
}

.s02-timeline {
  position: relative;
  width: min(88%, 420px);
  height: 80px;
  margin-top: var(--tp-space-5);
}
```

### 5.2 时间轴基线 (TimelineBase)

| 属性 | 值 |
|------|-----|
| 宽度 | 100% |
| 高度 | 1px |
| 背景 | linear-gradient(90deg, transparent 0%, var(--tp-rule) 10%, var(--tp-rule) 90%, transparent 100%) |
| 位置 | 绝对定位，垂直居中于 timeline 容器 |
| **Animate** | scaleX: 0→1 |

```tsx
<Animate
  animateId="timeline-base"
  enterAnimation={{
    initial: { scaleX: 0 },
    animate: {
      scaleX: 1,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
    }
  }}
  timeline={{ waitFor: 's02-title', delay: 200 }}
>
  <div className="s02-timeline-base" />
</Animate>
```

### 5.3 时间轴节点 (TimelineNodes)

5 个节点，沿基线均匀分布。

| 节点 | ID | 标签 | 位置 | waitFor 链 |
|------|-----|------|------|-----------|
| 1 | `node-title` | T | left: 0% | `timeline-base` |
| 2 | `node-subtitle` | S | left: 25% | `node-title` + 240ms delay |
| 3 | `node-body` | B | left: 50% | `node-subtitle` + 240ms delay |
| 4 | `node-image` | I | left: 75% | `node-body` + 240ms delay |
| 5 | `node-cta` | C | left: 100% | `node-image` + 240ms delay |

**节点样式**:
```css
.s02-node {
  position: absolute;
  top: 50%;
  width: 36px;
  height: 36px;
  margin-left: -18px;
  margin-top: -18px;
  border: 1px solid var(--tp-accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--tp-font-mono);
  font-size: 12px;
  color: var(--tp-accent);
  background: transparent;
  transition: background 0.3s ease;
}

.s02-node.is-active {
  background: var(--tp-accent-dim);
}
```

**Animate 配置（节点 1）**:
```tsx
<Animate
  animateId="node-title"
  enterAnimation="bounce-in"
  duration={{ enter: 500 }}
  timeline={{ waitFor: 'timeline-base' }}
>
  {(state) => (
    <div className={`s02-node ${state.phase === 'entered' ? 'is-active' : ''}`}>
      T
    </div>
  )}
</Animate>
```

**Animate 配置（节点 2-5）**:
```tsx
<Animate
  animateId="node-subtitle"
  enterAnimation="bounce-in"
  duration={{ enter: 500 }}
  timeline={{ waitFor: 'node-title', delay: 240 }}
>
  {(state) => (
    <div className={`s02-node ${state.phase === 'entered' ? 'is-active' : ''}`}>
      S
    </div>
  )}
</Animate>
```

（节点 3-5 同理，waitFor 链依次后推）

### 5.4 连接线光点 (ConnectionLights)

4 个光点，在相邻节点间流动。

| 属性 | 值 |
|------|-----|
| 尺寸 | 6px × 6px, border-radius: 50% |
| 背景 | var(--tp-accent) |
| box-shadow | `0 0 8px 2px var(--tp-accent-glow)` |
| 移动 | 从上一节点 x 位置到下一节点 x 位置 |
| 时长 | 700ms |

```tsx
{connections.map((conn, i) => (
  <Animate
    key={i}
    animateId={`light-${conn.from}-${conn.to}`}
    enterAnimation={{
      initial: { x: 0, opacity: 0, scale: 0 },
      animate: {
        x: conn.distance,
        opacity: [0, 1, 1, 0],
        scale: [0, 1, 1, 0.5],
        transition: { duration: 0.7, ease: 'linear' }
      }
    }}
    timeline={{ waitFor: `node-${conn.from}` }}
  >
    <div className="s02-light" />
  </Animate>
))}
```

**CSS**:
```css
.s02-light {
  position: absolute;
  top: 50%;
  left: calc(var(--from-pct) * 1%);
  width: 6px;
  height: 6px;
  margin-top: -3px;
  margin-left: -3px;
  border-radius: 50%;
  background: var(--tp-accent);
  box-shadow: 0 0 8px 2px var(--tp-accent-glow);
}
```

### 5.5 节点标签 (NodeLabels)

每个节点下方显示元素名和延迟值。

| 属性 | 值 |
|------|-----|
| 布局 | flex, space-between, width: min(88%, 420px) |
| 每个标签 | flex-column, align-center |
| 元素名 | mono, var(--tp-text-2xs), var(--tp-ink-soft) |
| 延迟值 | mono, var(--tp-text-2xs), var(--tp-accent-soft) |
| margin-top | 12px（相对于节点） |

```tsx
<Animate
  enterAnimation="fade-in"
  stagger={{ each: 80 }}
  timeline={{ waitFor: 'node-cta', delay: 200 }}
>
  {nodes.map(node => (
    <div key={node.id} className="s02-node-label">
      <span className="mono">{node.name}</span>
      <span className="mono">+{node.delay}ms</span>
    </div>
  ))}
</Animate>
```

### 5.6 参数面板 (ParamPanel)

半透明卡片，显示当前"选中"节点的参数。

| 属性 | 值 |
|------|-----|
| 宽度 | min(88%, 380px) |
| padding | var(--tp-space-4) |
| background | var(--tp-bg-glass) |
| backdrop-filter | blur(16px) |
| border | 1px solid var(--tp-border-glass) |
| border-radius | var(--tp-radius) |
| margin-top | var(--tp-space-6) |

**内部结构**:
```
┌────────────────────────────────────┐
│  waitFor: "title"                  │
│  delay: 200ms                      │
│  duration: 720ms                   │
│                                    │
│  ━━━━━━━━━━━━━━━━ 68%              │
└────────────────────────────────────┘
```

| 行 | 样式 |
|----|------|
| 参数行 | mono, var(--tp-text-2xs), var(--tp-ink-soft), line-height: 2 |
| 进度条 | 2px 高, background: var(--tp-rule), border-radius: 1px |
| 进度填充 | height: 100%, background: var(--tp-accent), width 由 activeNodeIndex 决定 |
| 进度百分比 | mono, var(--tp-text-2xs), var(--tp-accent), margin-top: 8px |

**Animate**:
```tsx
<Animate
  animateId="param-panel"
  enterAnimation="slide-up"
  duration={{ enter: 600 }}
  timeline={{ waitFor: 'node-cta', delay: 300 }}
>
  <div className="s02-param-panel">
    <div className="s02-param-row mono">waitFor: "title"</div>
    <div className="s02-param-row mono">delay: 200ms</div>
    <div className="s02-param-row mono">duration: 720ms</div>
    <div className="s02-param-progress">
      <div className="s02-param-bar" />
      <div className="s02-param-fill" style={{ width: '68%' }} />
    </div>
    <div className="s02-param-pct mono">68%</div>
  </div>
</Animate>
```

**面板内容更新**: 随着节点依次亮起，面板内容通过本地 state 同步更新 activeNode。state 更新在 `onVisibilityChange` 或 Animate 的 render-prop 中完成，不阻塞动画。

---

## 6. Scene 03 — 时间瀑布 (Flux)

### 6.1 整体结构

```tsx
<Scene
  sceneId="flux"
  className="tp-scene tp-scene--03"
  layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
>
  <div className="tp-scene__inner">
    <HeaderHUD sceneId="flux" timecode="00:00:02:00" frame={68} />

    {/* 背景流动层 — 纯 CSS */}
    <TimeStreams />

    <div className="s03-center">
      <MainTimecode value="00:00:02:00" />
      <ProgressRing />
      <SmpteLabel />
      <ScrollEquation />
    </div>

    <TickBar />
    <Footer frame={68} hint="Scroll distance = time" />
  </div>
</Scene>
```

**Scene CSS**:
```css
.tp-scene--03 {
  background: var(--tp-bg);
  color: var(--tp-ink);
}

.s03-center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--tp-space-4);
  z-index: 2;
}
```

### 6.2 背景流动层 (TimeStreams)

3 列垂直滚动的时间码，纯 CSS `@keyframes`，零 JS。

**结构**:
```tsx
<div className="s03-streams" aria-hidden="true">
  <div className="s03-stream s03-stream--left">
    {/* 时间码列表，复制一份实现无缝循环 */}
  </div>
  <div className="s03-stream s03-stream--center">
    {/* ... */}
  </div>
  <div className="s03-stream s03-stream--right">
    {/* ... */}
  </div>
</div>
```

**CSS**:
```css
.s03-streams {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.s03-stream {
  position: absolute;
  top: 0;
  font-family: var(--tp-font-mono);
  font-size: 11px;
  line-height: 2.6;
  white-space: nowrap;
  will-change: transform;
}

.s03-stream--left {
  left: 6%;
  color: rgba(237, 232, 224, 0.04);
  animation: s03-stream-up 24s linear infinite;
}

.s03-stream--center {
  left: 50%;
  transform: translateX(-50%);
  color: rgba(237, 232, 224, 0.055);
  animation: s03-stream-up 14s linear infinite;
}

.s03-stream--right {
  right: 6%;
  color: rgba(237, 232, 224, 0.07);
  animation: s03-stream-up 8s linear infinite;
}

@keyframes s03-stream-up {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}

/* 移动端减少为 2 列 */
@media (max-width: 430px) {
  .s03-stream--center { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .s03-stream { animation: none; }
}
```

**时间码内容**: 每列 20 行时间码字符串，格式 `"00:00:01:12"` ~ `"00:00:03:08"`，递增帧。复制一份实现无缝循环（40 行总高度 = 2 × 20 行）。

### 6.3 中央时间码 (MainTimecode)

| 属性 | 值 |
|------|-----|
| 文字 | `"00:00:02:00"` |
| 字体 | Fraunces, 600 |
| 字号 | var(--tp-text-2xl) |
| 颜色 | var(--tp-accent) |
| 字间距 | -0.03em |

**Animate**（逐位 flip-in stagger）:
```tsx
<Animate
  animateId="main-timecode"
  enterAnimation="flip"
  stagger={{ each: 100 }}
  timeline={{ delay: 400 }}
>
  {'00:00:02:00'.split('').map((ch, i) => (
    <span key={i} className="mono s03-timecode-char">{ch}</span>
  ))}
</Animate>
```

**CSS**:
```css
.s03-timecode-char {
  display: inline-block;
  font-family: var(--tp-font-display);
  font-size: var(--tp-text-2xl);
  font-weight: 600;
  color: var(--tp-accent);
  letter-spacing: -0.03em;
}
```

### 6.4 进度环 (ProgressRing)

SVG 圆环，stroke-dasharray 映射进度。

| 属性 | 值 |
|------|-----|
| 直径 | 76cqw |
| stroke | var(--tp-accent) at 20% opacity |
| stroke-width | 1px |
| fill | none |
| **Animate** | pathLength: 0→1 |

```tsx
<Animate
  animateId="progress-ring"
  enterAnimation={{
    initial: { pathLength: 0, opacity: 0 },
    animate: {
      pathLength: 1,
      opacity: 1,
      transition: { duration: 2.2, ease: [0.16, 1, 0.3, 1] }
    }
  }}
  timeline={{ waitFor: 'main-timecode' }}
>
  <motion.svg
    className="s03-progress-ring"
    viewBox="0 0 200 200"
    style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
  >
    <motion.circle
      cx="100"
      cy="100"
      r="98"
      fill="none"
      stroke="var(--tp-accent)"
      strokeWidth="1"
      strokeOpacity="0.2"
      strokeLinecap="round"
    />
  </motion.svg>
</Animate>
```

**CSS**:
```css
.s03-progress-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 76cqw;
  height: 76cqw;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: -1;
}
```

### 6.5 SMPTE 标签

| 属性 | 值 |
|------|-----|
| 文字 | "SMPTE TIME CODE" |
| 字体 | mono |
| 字号 | var(--tp-text-2xs) |
| 颜色 | var(--tp-ink-mute) |
| 字间距 | 0.25em |
| 文字变换 | uppercase |

```tsx
<Animate
  animateId="smpte-label"
  enterAnimation="fade-in"
  duration={{ enter: 500 }}
  timeline={{ waitFor: 'main-timecode', delay: 200 }}
>
  <span className="s03-smpte-label mono">SMPTE TIME CODE</span>
</Animate>
```

### 6.6 滚动方程 (ScrollEquation)

| 属性 | 值 |
|------|-----|
| 行1 | "SCROLL DISTANCE = TIME" |
| 行2 | "1ms = 1px" |
| 字体 | mono |
| 字号 | var(--tp-text-2xs) |
| 颜色 | var(--tp-ink-mute) |
| 字间距 | 0.12em |
| text-align | center |

```tsx
<Animate
  animateId="scroll-equation"
  enterAnimation="fade-in"
  duration={{ enter: 500 }}
  timeline={{ waitFor: 'smpte-label', delay: 120 }}
>
  <div className="s03-equation mono">
    <div>SCROLL DISTANCE = TIME</div>
    <div>1ms = 1px</div>
  </div>
</Animate>
```

### 6.7 底部刻度条 (TickBar)

20 个等距刻度 + 一个可移动的 accent 高亮标记。

| 属性 | 值 |
|------|-----|
| 容器宽度 | min(90%, 400px) |
| 刻度数量 | 20 |
| 刻度宽 | 1px |
| 刻度高 | 8px（主刻度 12px，每 5 个一根） |
| 刻度色 | var(--tp-ink-faint) |
| 高亮标记 | 2px × 12px, background: var(--tp-accent), border-radius: 1px |
| 高亮位置 | `left: ${progress * 100}%` |
| margin-top | var(--tp-space-6) |

```tsx
<div className="s03-tickbar">
  {Array.from({ length: 20 }, (_, i) => (
    <div
      key={i}
      className={`s03-tick ${i % 5 === 0 ? 's03-tick--major' : ''}`}
    />
  ))}
  <motion.div
    className="s03-tickbar-marker"
    style={{ left: useTransform(dragProgress, [0, 1], ['0%', '100%']) }}
  />
</div>
```

**刻度 Animate**:
```tsx
<Animate
  enterAnimation={{
    initial: { scaleY: 0 },
    animate: { scaleY: 1, transition: { duration: 0.3 } }
  }}
  stagger={{ each: 40 }}
  timeline={{ waitFor: 'scroll-equation' }}
>
  {ticks.map((_, i) => (
    <div key={i} className={`s03-tick ${i % 5 === 0 ? 's03-tick--major' : ''}`} />
  ))}
</Animate>
```

**CSS**:
```css
.s03-tickbar {
  position: relative;
  width: min(90%, 400px);
  height: 16px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 0 auto;
  margin-top: var(--tp-space-6);
}

.s03-tick {
  width: 1px;
  height: 8px;
  background: var(--tp-ink-faint);
  transform-origin: bottom center;
}

.s03-tick--major {
  height: 12px;
}

.s03-tickbar-marker {
  position: absolute;
  bottom: 0;
  width: 2px;
  height: 14px;
  background: var(--tp-accent);
  border-radius: 1px;
  margin-left: -1px;
  box-shadow: 0 0 6px 1px var(--tp-accent-glow);
}
```

---

## 7. Scene 04 — 定格 (Cut)

### 7.1 整体结构

```tsx
<Scene
  sceneId="cut"
  className="tp-scene tp-scene--04"
  layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
>
  <div className="tp-scene__inner">
    <HeaderHUD sceneId="cut" timecode="00:00:03:00" frame={96} isRecording={false} />

    <div className="s04-center">
      <CutTitle />
      <AccentLine />
      <TheEnd />
      <ButtonGroup />
    </div>

    <SprocketEndStrip />
    <Footer frame={96} hint="END" />
  </div>
</Scene>
```

**Scene CSS**:
```css
.tp-scene--04 {
  background: var(--tp-bg);
  color: var(--tp-ink);
}

.s04-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--tp-space-5);
}
```

### 7.2 CUT 标题

| 属性 | 值 |
|------|-----|
| 文字 | "CUT" |
| 字体 | Fraunces, 600 |
| 字号 | var(--tp-text-xl) |
| 颜色 | var(--tp-ink) |
| 字间距 | 0.08em |

**Animate**（组合动画：blur-in → zoom-in sequential）:
```tsx
<Animate
  animateId="cut-title"
  enterAnimation={{
    animations: [
      {
        initial: { opacity: 0, filter: 'blur(14px)' },
        animate: {
          opacity: 1,
          filter: 'blur(0px)',
          transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
        }
      },
      {
        initial: { scale: 0.75 },
        animate: {
          scale: 1,
          transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
        }
      }
    ],
    mode: 'sequential',
    delay: [0, 200]
  }}
  duration={{ enter: 1300 }}
  timeline={{ delay: 300 }}
>
  <h1 className="s04-cut-title">CUT</h1>
</Animate>
```

### 7.3 Accent 细线

| 属性 | 值 |
|------|-----|
| 宽度 | 12cqw |
| 高度 | 1px |
| 背景 | var(--tp-accent) |
| **Animate** | scaleX: 0→1 |

```tsx
<Animate
  animateId="accent-line"
  enterAnimation={{
    initial: { scaleX: 0 },
    animate: {
      scaleX: 1,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
  }}
  timeline={{ waitFor: 'cut-title', delay: 100 }}
>
  <div className="s04-accent-line" />
</Animate>
```

**CSS**:
```css
.s04-accent-line {
  width: 12cqw;
  height: 1px;
  background: var(--tp-accent);
  transform-origin: center center;
}
```

### 7.4 THE END

| 属性 | 值 |
|------|-----|
| 文字 | "THE END" |
| 字体 | mono |
| 字号 | var(--tp-text-xs) |
| 颜色 | var(--tp-ink-mute) |
| 字间距 | 0.35em |
| 文字变换 | uppercase |

```tsx
<Animate
  animateId="the-end"
  enterAnimation="fade-in"
  duration={{ enter: 500 }}
  timeline={{ waitFor: 'accent-line', delay: 120 }}
>
  <span className="s04-the-end mono">THE END</span>
</Animate>
```

### 7.5 按钮组

两个 pill 按钮，水平排列。

| 属性 | 值 |
|------|-----|
| 布局 | flex, gap: var(--tp-space-4), margin-top: var(--tp-space-6) |
| 触控目标 | min-height: 44px, min-width: 120px |

**按钮 1 — Ghost**:
- 边框: 1px solid var(--tp-rule-strong)
- 背景: transparent
- 文字: var(--tp-ink-soft), mono, var(--tp-text-xs)
- padding: 12px 28px
- border-radius: var(--tp-radius-pill)
- hover: border-color var(--tp-accent), color var(--tp-accent)

**按钮 2 — Primary**:
- 背景: var(--tp-accent)
- 文字: var(--tp-bg), mono, var(--tp-text-xs)
- padding: 12px 28px
- border-radius: var(--tp-radius-pill)
- hover: background var(--tp-accent-soft)

```tsx
<Animate
  animateId="cut-buttons"
  enterAnimation="slide-up"
  stagger={{ each: 100 }}
  timeline={{ waitFor: 'the-end', delay: 200 }}
>
  <Link className="tp-btn tp-btn--ghost" to="/">Back to home</Link>
  <Link className="tp-btn tp-btn--primary" to="/docs">Read docs</Link>
</Animate>
```

**CSS**:
```css
.tp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  min-width: 120px;
  font-family: var(--tp-font-mono);
  font-size: var(--tp-text-xs);
  letter-spacing: 0.08em;
  border-radius: var(--tp-radius-pill);
  transition: all 0.3s var(--tp-ease-out);
  cursor: pointer;
  text-decoration: none;
}

.tp-btn--ghost {
  border: 1px solid var(--tp-rule-strong);
  color: var(--tp-ink-soft);
  background: transparent;
  padding: 12px 28px;
}

.tp-btn--ghost:hover {
  border-color: var(--tp-accent);
  color: var(--tp-accent);
}

.tp-btn--primary {
  background: var(--tp-accent);
  color: var(--tp-bg);
  border: none;
  padding: 12px 28px;
}

.tp-btn--primary:hover {
  background: var(--tp-accent-soft);
}
```

### 7.6 底部齿孔条 (SprocketEndStrip)

12 个齿孔水平排列，其中几个标 `END`。

| 属性 | 值 |
|------|-----|
| 布局 | flex, justify-center, gap: 10px |
| 位置 | footer 上方，padding-bottom: var(--tp-space-4) |
| 齿孔尺寸 | 4px × 6px |
| END 标记 | 每隔 4 个齿孔上方有一个 "END" 标签，mono 2xs，ink-mute |

```tsx
<Animate
  enterAnimation="fade-in"
  stagger={{ each: 80 }}
  timeline={{ waitFor: 'cut-buttons', delay: 200 }}
>
  {Array.from({ length: 12 }, (_, i) => (
    <div key={i} className="s04-end-sprocket-wrapper">
      {i % 4 === 2 && <span className="mono s04-end-label">END</span>}
      <span className="tp-sprocket" />
    </div>
  ))}
</Animate>
```

### 7.7 Header HUD 特殊处理

Scene 04 的 REC 点不再 pulse，变为 solid gray：

```tsx
<RecBadge isRecording={false} />
```

当 `isRecording={false}` 时：
- 红点颜色变为 `var(--tp-ink-mute)`
- 停止 pulse animation
- 文字变为 `"REC"`（不变）但颜色同步 muted

---

## 8. 动画时序总表

### 8.1 Scene 01 完整时序

| animateId | enterAnimation | duration | waitFor | delay | 实际开始(ms) | 实际结束(ms) |
|-----------|---------------|----------|---------|-------|-------------|-------------|
| hud-rolling | fade-in | 480 | — | 0 | 0 | 480 |
| tc-rolling | stagger fade-in | 300 | hud-rolling | 120 | 480 | 920 |
| dial-ticks | stagger scale-in | 250×60 | hud-rolling | 200 | 480 | 2160 |
| dial-inner-ring | scale-grow | 1000 | — | 1600 | 1600 | 2600 |
| scene-number-01 | blur→zoom sequential | 1100 | dial-inner-ring | 200 | 2800 | 3900 |
| hand-second | rotate-in | 800 | scene-number-01 | 0 | 3900 | 4700 |
| hand-minute | rotate-in | 800 | scene-number-01 | 120 | 4020 | 4820 |
| s01-eyebrow | fade-in | 500 | hand-second | 0 | 4700 | 5200 |
| s01-title | blur→slide sequential | 1100 | s01-eyebrow | 0 | 5200 | 6300 |
| s01-subtitle | slide-up | 700 | s01-title | 100 | 6400 | 7100 |
| drag-hint | fade-in + float | 520 | s01-subtitle | 200 | 7300 | 7820 |
| corners-tl | stagger fade-in | 300×3 | drag-hint | 300 | 8300 | 9200 |
| corners-tr | fade-in | 500 | drag-hint | 300 | 8300 | 8800 |
| corners-bl | fade-in | 500 | drag-hint | 300 | 8300 | 8800 |
| corners-br | stagger fade-in | 300×4 | drag-hint | 400 | 8400 | 9300 |

> 注：实际开始 = waitFor 元素结束时间 + delay。若有 stagger，结束时间 = 开始 + duration + (n-1)×each。

### 8.2 Scene 02 完整时序

| animateId | enterAnimation | duration | waitFor | delay | 实际开始(ms) |
|-----------|---------------|----------|---------|-------|-------------|
| hud-sync | fade-in | 480 | — | 0 | 0 |
| tc-sync | stagger fade-in | 300 | hud-sync | 120 | 480 |
| slate-sync | fade-in | 400 | hud-sync | 0 | 480 |
| s02-eyebrow | fade-in | 500 | slate-sync | 100 | 980 |
| s02-title | slide-up | 800 | s02-eyebrow | 0 | 1480 |
| timeline-base | scaleX | 800 | s02-title | 200 | 2480 |
| node-title | bounce-in | 500 | timeline-base | 0 | 3280 |
| node-subtitle | bounce-in | 500 | node-title | 240 | 3780 |
| node-body | bounce-in | 500 | node-subtitle | 240 | 4280 |
| node-image | bounce-in | 500 | node-body | 240 | 4780 |
| node-cta | bounce-in | 500 | node-image | 240 | 5280 |
| light-0-1 | x-slide | 700 | node-title | 0 | 3780 |
| light-1-2 | x-slide | 700 | node-subtitle | 0 | 4280 |
| light-2-3 | x-slide | 700 | node-body | 0 | 4780 |
| light-3-4 | x-slide | 700 | node-image | 0 | 5280 |
| node-labels | stagger fade-in | 300×5 | node-cta | 200 | 5980 |
| param-panel | slide-up | 600 | node-cta | 300 | 6080 |

### 8.3 Scene 03 完整时序

| animateId | enterAnimation | duration | waitFor | delay | 实际开始(ms) |
|-----------|---------------|----------|---------|-------|-------------|
| hud-flux | fade-in | 480 | — | 0 | 0 |
| tc-flux | stagger fade-in | 300 | hud-flux | 120 | 480 |
| main-timecode | stagger flip | 400×11 | — | 400 | 400 |
| progress-ring | pathLength | 2200 | main-timecode | 0 | 1900 |
| smpte-label | fade-in | 500 | main-timecode | 200 | 2100 |
| scroll-equation | fade-in | 500 | smpte-label | 120 | 2720 |
| tickbar | stagger scaleY | 300×20 | scroll-equation | 0 | 3320 |

### 8.4 Scene 04 完整时序

| animateId | enterAnimation | duration | waitFor | delay | 实际开始(ms) |
|-----------|---------------|----------|---------|-------|-------------|
| hud-cut | fade-in | 480 | — | 0 | 0 |
| tc-cut | stagger fade-in | 300 | hud-cut | 120 | 480 |
| cut-title | blur→zoom sequential | 1300 | — | 300 | 300 |
| accent-line | scaleX | 600 | cut-title | 100 | 1700 |
| the-end | fade-in | 500 | accent-line | 120 | 2420 |
| cut-buttons | stagger slide-up | 600×2 | the-end | 200 | 3220 |
| end-sprockets | stagger fade-in | 300×12 | cut-buttons | 200 | 4120 |

---

## 9. 文件结构与实现顺序

### 9.1 文件结构

```
site/src/
├── pages/
│   └── DragPage.tsx              # 入口，路由 /drag
├── components/
│   └── temporal-drag/
│       ├── TemporalDragExperience.tsx   # 主组件，含 CineView + 4 Scene
│       ├── SceneRolling.tsx             # Scene 01
│       ├── SceneSync.tsx                # Scene 02
│       ├── SceneFlux.tsx                # Scene 03
│       ├── SceneCut.tsx                 # Scene 04
│       ├── HeaderHUD.tsx                # 公共 HUD
│       ├── FooterBar.tsx                # 公共 Footer
│       ├── RecBadge.tsx                 # REC 徽标
│       ├── TimecodeDisplay.tsx          # 时间码（逐位 stagger）
│       ├── DialTicks.tsx                # 显影盘刻度
│       ├── DialHands.tsx                # 指针
│       ├── TimelineNode.tsx             # 时间轴节点
│       ├── ConnectionLight.tsx          # 连接线光点
│       ├── ParamPanel.tsx               # 参数面板
│       ├── TimeStreams.tsx              # 背景流动层
│       ├── ProgressRing.tsx             # SVG 进度环
│       ├── TickBar.tsx                  # 底部刻度条
│       ├── CornerDecoration.tsx         # 四角装饰
│       ├── DragHint.tsx                 # DRAG 提示
│       ├── Sprocket.tsx                 # 齿孔原子
│       └── index.ts                     # barrel export
├── styles/
│   └── temporal-drag.css         # 全部样式（按 Scene 分区）
└── hooks/
    └── useTimecode.ts            # 时间码自增 RAF hook
```

### 9.2 实现优先级

| 优先级 | 内容 | 预估工时 |
|--------|------|---------|
| P0 | 全局样式系统 + 公共组件（HeaderHUD, Footer, RecBadge, Sprocket） | 2h |
| P0 | Scene 01 — 显影盘完整实现（含拖拽反馈） | 4h |
| P1 | Scene 02 — 编排轴（含 waitFor 链可视化） | 3h |
| P1 | Scene 03 — 时间瀑布 | 2.5h |
| P1 | Scene 04 — 定格 | 1.5h |
| P2 | 拖拽交互反馈（刻度高亮、指针震颤、回弹校准） | 2h |
| P2 | 减少动态偏好适配 | 1h |
| P3 | 移动端特调（≤430px 布局切换） | 1h |
| P3 | 性能优化与 Profiler 验证 | 1h |

---

## 10. 性能预算与热路径清单

### 10.1 性能预算

| 指标 | 目标 | 验证方式 |
|------|------|---------|
| 首屏可交互时间 (TTI) | < 1.5s | Lighthouse |
| 动画帧率 | 60fps 稳定 | Chrome DevTools Performance |
| 长任务 (Long Tasks) | 无 > 50ms | Chrome DevTools |
| 内存占用 | 无持续增长 | Memory Profiler |
| 包体积增量 | < 15KB gzipped | Bundle analyzer |

### 10.2 热路径检查表

| 路径 | 风险 | 方案 | 状态 |
|------|------|------|------|
| 60 刻度 stagger | 60 个 motion 元素同时 mount | 框架 stagger 原生优化，非手动循环 setState | ✅ 安全 |
| 时间码自增 RAF | RAF 每帧触发 | 仅更新 ref.innerText，不触发 React 渲染 | ✅ 安全 |
| 背景流动层 CSS | 3 列无限滚动 | 纯 CSS @keyframes，GPU 加速 | ✅ 安全 |
| 拖拽刻度高亮 | 每帧计算角度差 | 纯 useTransform 映射，零 setState | ✅ 安全 |
| 指针震颤 CSS | 每帧 CSS transform | CSS animation class toggle，非 JS 驱动 | ✅ 安全 |
| 进度环 SVG | pathLength 动画 | Framer Motion SVG 优化路径 | ✅ 安全 |
| 刻度条标记位移 | 随 progress 移动 | useTransform 映射 left 百分比 | ✅ 安全 |
| Scene 切换 exit | 上一 Scene 元素退场 | 框架内置，不手动操作 DOM | ✅ 安全 |

### 10.3 禁止项

- [ ] 禁止在 RAF/timeInterval 中调用 `setState`
- [ ] 禁止在拖拽回调中创建新的对象/数组引用
- [ ] 禁止对 > 20 个元素使用独立 `useTransform`（应共用输入 motionValue）
- [ ] 禁止在 `useMemo` 依赖中包含每帧变化的量
- [ ] 禁止在拖拽热路径中读取 layout（getBoundingClientRect）

---

## 11. i18n 文案建议

### 11.1 新增文案 Key

```ts
// en.ts / zh.ts 新增

'dragTemporal.s01.slate': '01 / ROLLING',
'dragTemporal.s01.eyebrow': 'CINEMATIC UI FRAMEWORK',
'dragTemporal.s01.title': 'CineView',
'dragTemporal.s01.subtitle': 'Direct every frame like a filmmaker',
'dragTemporal.s01.dragHint': 'DRAG',
'dragTemporal.s01.footerHint': 'After release, time keeps finishing',

'dragTemporal.s02.slate': '02 / CHOREOGRAPH',
'dragTemporal.s02.eyebrow': 'DECLARATIVE TIMELINE',
'dragTemporal.s02.title': 'Order & position, resolved',
'dragTemporal.s02.node.title': 'Title',
'dragTemporal.s02.node.subtitle': 'Subtitle',
'dragTemporal.s02.node.body': 'Body',
'dragTemporal.s02.node.image': 'Image',
'dragTemporal.s02.node.cta': 'CTA',
'dragTemporal.s02.param.waitFor': 'waitFor',
'dragTemporal.s02.param.delay': 'delay',
'dragTemporal.s02.param.duration': 'duration',
'dragTemporal.s02.footerHint': 'Elements arrive in turn',

'dragTemporal.s03.timecode': '00:00:02:00',
'dragTemporal.s03.smpteLabel': 'SMPTE TIME CODE',
'dragTemporal.s03.equation.line1': 'SCROLL DISTANCE = TIME',
'dragTemporal.s03.equation.line2': '1ms = 1px',
'dragTemporal.s03.footerHint': 'Scroll distance = time',

'dragTemporal.s04.title': 'CUT',
'dragTemporal.s04.theEnd': 'THE END',
'dragTemporal.s04.btnHome': 'Back to home',
'dragTemporal.s04.btnDocs': 'Read docs',
'dragTemporal.s04.footerHint': 'END',

'dragTemporal.hud.fps': '25 FPS',
'dragTemporal.hud.smpte': 'SMPTE',
'dragTemporal.hud.iso': 'ISO 800',
'dragTemporal.hud.rec': 'REC',
```

---

## 12. 设计稿与实现对照速查

| 设计元素 | 所在 Scene | 对应组件 | 核心 Animate 特性 |
|----------|-----------|---------|-------------------|
| 60 刻度显影盘 | 01 | DialTicks | stagger (60 个), custom variant (scale) |
| 时间码逐位 reveal | 01/02/03/04 | TimecodeDisplay | stagger (11 个), fade-in + slide-up |
| 指针旋转 | 01 | DialHands | rotate-in, render-prop 映射 rotate |
| 标题 blur→slide | 01 | MainTitle | 组合动画 sequential (blur-in + slide-up) |
| DRAG 浮动提示 | 01 | DragHint | fade-in + infiniteAnimation (float) |
| 时间轴节点链 | 02 | TimelineNode | bounce-in, waitFor 链级联 |
| 连接线光点 | 02 | ConnectionLight | custom variant (x-slide + opacity) |
| 参数面板 | 02 | ParamPanel | slide-up, 内容随 state 更新 |
| 背景时间码流动 | 03 | TimeStreams | 纯 CSS @keyframes |
| 巨型时间码 flip | 03 | MainTimecode | stagger (11 个), flip preset |
| SVG 进度环 | 03 | ProgressRing | custom variant (pathLength) |
| 刻度条标记 | 03 | TickBar | stagger (20 个) + useTransform 映射位置 |
| CUT 定格 | 04 | CutTitle | 组合动画 sequential (blur-in + zoom-in) |
| accent 细线 | 04 | AccentLine | scaleX |
| 按钮组 | 04 | ButtonGroup | stagger slide-up |
| 底部齿孔条 | 04 | SprocketEndStrip | stagger (12 个) |

---

*规范完。所有数值、时序、坐标、颜色均精确到实现可直接参考的级别。*
