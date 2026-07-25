# Temporal Drag 重构 — 执行文档

> 版本: v1.0 | 日期: 2026-07-21 | 状态: 设计冻结，待实现
> 范围: `/drag` 页面 4-Scene 暗调电影显影室主题

---

## 执行原则

1. **按节点顺序推进**，每节点完成后在本文档打勾并自检
2. **每节点必须跑通浏览器真机验收**（独立 agent，localhost:3000/#/drag）
3. **单测全绿 ≠ 视觉正确**，必须通过眼睛确认
4. **先恢复行为基线，再做架构迁移**
5. **禁止跨节点并行修改**，防止状态所有权混乱

---

## 节点总览

| 节点 | 主题 | 预估工时 | 阻塞 |
|------|------|---------|------|
| [x] **N1** | 全局样式系统 + 公共组件 | 2h | 无 |
| [x] **N2** | Scene 01 — 显影盘（已完成） | 4h | N1 |
| [x] **N3** | Scene 02 — 编排轴（已完成） | 3h | N1 |
| [~] **N4** | Scene 03 — 时间瀑布（进行中） | 2.5h | N1 |
| [ ] **N5** | Scene 04 — 定格 | 1.5h | N1 |
| [ ] **N6** | 拖拽交互反馈（刻度高亮/指针震颤/回弹） | 2h | N2 |
| [x] **N7** | 减少动态偏好适配（实现完成，待 N10 独立浏览器验收） | 1h | N2~N5 |
| [ ] **N8** | 移动端特调（≤430px 布局切换） | 1h | N2~N5 |
| [ ] **N9** | i18n 文案 + 性能优化 + Profiler 验证 | 1h | N2~N5 |
| [ ] **N10** | 全链路浏览器验收（独立 agent） | 2h | N1~N9 |

---

## 设计系统（全局）

### 色彩 Token

通过 `.drag-temporal` 类注入，不污染现有 tokens.css。

```css
.drag-temporal {
  --tp-bg: #0c0a08;
  --tp-bg-elevated: #161412;
  --tp-bg-glass: rgba(12, 10, 8, 0.72);
  --tp-ink: #ede8e0;
  --tp-ink-soft: #9a948a;
  --tp-ink-mute: #5c564e;
  --tp-ink-faint: rgba(237, 232, 224, 0.06);
  --tp-accent: #c9a16c;
  --tp-accent-soft: #a08050;
  --tp-accent-dim: rgba(201, 161, 108, 0.18);
  --tp-accent-glow: rgba(201, 161, 108, 0.28);
  --tp-rec: #c44b3a;
  --tp-rec-glow: rgba(196, 75, 58, 0.22);
  --tp-rule: rgba(237, 232, 224, 0.08);
  --tp-rule-strong: rgba(237, 232, 224, 0.14);
  --tp-border-glass: rgba(237, 232, 224, 0.06);
}
```

### 字号刻度（container-query 驱动）

| Token | 公式 | 390px | 520px | 用途 |
|-------|------|-------|-------|------|
| `--tp-text-2xs` | `clamp(8px, 2.0cqw, 11px)` | 8px | 11px | 刻度标签、帧号 |
| `--tp-text-xs` | `clamp(10px, 2.5cqw, 13px)` | 10px | 13px | slate、eyebrow、HUD |
| `--tp-text-sm` | `clamp(12px, 3.0cqw, 16px)` | 12px | 16px | 副标题、节点标签 |
| `--tp-text-md` | `clamp(16px, 4.2cqw, 22px)` | 16px | 22px | 正文、参数值 |
| `--tp-text-lg` | `clamp(24px, 6.8cqw, 42px)` | 24px | 42px | 中等标题 |
| `--tp-text-xl` | `clamp(36px, 10cqw, 64px)` | 36px | 64px | 主标题、CUT |
| `--tp-text-2xl` | `clamp(48px, 15cqw, 96px)` | 48px | 96px | 巨型时间码、中心数字 |

### 间距刻度

| Token | 公式 | 390px | 用途 |
|-------|------|-------|------|
| `--tp-space-1` | `clamp(2px, 0.6cqw, 4px)` | 2px | 极细间隙 |
| `--tp-space-2` | `clamp(4px, 1.2cqw, 8px)` | 4px | 图标间隙 |
| `--tp-space-3` | `clamp(8px, 2.0cqw, 14px)` | 8px | 小间距 |
| `--tp-space-4` | `clamp(12px, 3.0cqw, 22px)` | 12px | 标准间距 |
| `--tp-space-5` | `clamp(18px, 4.5cqw, 32px)` | 18px | 中等间距 |
| `--tp-space-6` | `clamp(24px, 6.0cqw, 42px)` | 24px | 大间距 |
| `--tp-space-7` | `clamp(36px, 9.0cqw, 64px)` | 36px | 区块间距 |
| `--tp-space-8` | `clamp(48px, 12cqw, 86px)` | 48px | 超大间距 |

### 结构与动效

```css
--tp-radius-sm: 4px;
--tp-radius: 8px;
--tp-radius-pill: 999px;
--tp-shadow-glow: 0 0 20px 4px var(--tp-accent-glow);
--tp-shadow-subtle: 0 4px 24px rgba(0, 0, 0, 0.4);

--tp-font-display: 'Fraunces', 'Songti SC', Georgia, serif;
--tp-font-body: 'Inter', 'PingFang SC', 'Source Han Sans SC', 'Microsoft YaHei', system-ui, sans-serif;
--tp-font-mono: 'Roboto Mono', ui-monospace, 'SF Mono', Menlo, monospace;

--tp-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--tp-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
--tp-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--tp-ease-linear-out: cubic-bezier(0.4, 0, 0.2, 1);
```

---

## 全局交互规范

### CineView 配置

```tsx
<CineView
  config={{ size: 390 }}
  mode="drag"
  modes={{
    drag: {
      direction: 'y',
      transitionDuration: 720,
      dragTimeScale: 16,
      threshold: {
        minVelocity: 0,
        maxVelocity: 1200,
        minThreshold: 0.15,
        maxThreshold: 0.32,
      },
    },
  }}
>
```

### 拖拽反馈（全局共享）

| 状态 | 效果 | 实现 |
|------|------|------|
| 拖拽中 | Scene 整体 `opacity: 0.92` | `useTransform(progress, [0,0.5,1], [1,0.92,1])` |
| 拖拽中 | 背景 0.8% 横向视差 | `useTransform(progress, [0,1], ['-0.8%', '0.8%'])` |
| 拖拽中 | 中心内容区 `scale(0.985)` | `useTransform(progress, [0,0.5,1], [1,0.985,1])` |
| 释放 settle | spring: stiffness 180, damping 14 | 框架内置 |
| 释放 bounce | spring: stiffness 220, damping 18 | 框架内置 |

### 首屏冷启动

- Scene 01 所有 Animate 参与 `firstSceneEnterReady` 门控
- Scene 02/03/04 由 Scene 切换时各自触发

### 减少动态偏好

`prefers-reduced-motion: reduce` 时：
- `infiniteAnimation` 全部停止
- stagger `each` 归零
- transition duration 压缩至 `0.08s`
- 背景流动层暂停
- 时间码停止自增

---

## 节点 1：全局样式系统 + 公共组件

### 1.1 交付物

| 文件 | 路径 |
|------|------|
| 样式文件 | `site/src/styles/temporal-drag.css` |
| 主组件 | `site/src/components/temporal-drag/TemporalDragExperience.tsx` |
| HUD | `site/src/components/temporal-drag/HeaderHUD.tsx` |
| Footer | `site/src/components/temporal-drag/FooterBar.tsx` |
| REC 徽标 | `site/src/components/temporal-drag/RecBadge.tsx` |
| 时间码 | `site/src/components/temporal-drag/TimecodeDisplay.tsx` |
| 齿孔原子 | `site/src/components/temporal-drag/Sprocket.tsx` |
| 时间码 Hook | `site/src/hooks/useTimecode.ts` |

### 1.2 自检清单

- [x] CSS 变量在 `.drag-temporal` 作用域内，不泄漏到全局
- [x] 所有字号用 `cqw` + clamp，验证 390px 和 520px 两端点
- [x] 所有间距用 `cqw` + clamp
- [x] 时间码 RAF hook 只写 ref，不触发 React 渲染
- [x] RecBadge pulse 用 CSS animation，非 JS 驱动
- [x] TimecodeDisplay 11 位 stagger 可用（容器保留 11 个字符节点）

**N1 验收证据（独立浏览器 agent，2026-07-21）**：`localhost:3000/drag` 正确实例；静置 25.59fps、拖拽 50.52fps（1.97×）、释放后 25.74fps；reduce 下 0 帧。390×844 与 520×900 HUD 三项均可见、与语言按钮重叠面积 0、无横向溢出；console error/warning/pageerror 均为 0。site type-check 与 production build 通过。自检确认 drag 每帧只写 MotionValue/DOM ref，无每帧 React state；RAF 与 listener 均有清理。

### 1.3 关键实现细节

**TimecodeDisplay 组件**：
```tsx
interface TimecodeDisplayProps {
  value: string;        // e.g. "00:00:00:00"
  animateId: string;
  waitFor?: string;
  delay?: number;
}

// 内部将字符串拆分为 11 个 span，每个 span 是一个 stagger 子项
// 冒号字符也作为独立 stagger 项
```

**useTimecode hook**：
```tsx
function useTimecode(startFrame: number, isDragging: boolean): {
  timecodeRef: React.RefObject<HTMLSpanElement>;
  frameRef: React.MutableRefObject<number>;
}
// RAF 驱动，只更新 DOM ref.innerText，不返回 state
```

**HeaderHUD 组件**：
```tsx
<header className="tp-hud">
  <div className="tp-hud__left">
    <RecBadge isRecording />
    <TimecodeDisplay value="00:00:00:00" animateId="tc-rolling" />
  </div>
  <div className="tp-hud__right">
    <span className="mono">25 FPS</span>
    <span className="mono">SMPTE</span>
    <span className="mono">ISO 800</span>
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

**RecBadge CSS pulse**:
```css
@keyframes tp-rec-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
}
.tp-rec-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--tp-rec);
  box-shadow: 0 0 0 4px var(--tp-rec-glow);
  animation: tp-rec-pulse 1.8s ease-in-out infinite;
}
```

**FooterBar**:
```css
.tp-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(16px, 4cqw, 24px);
  height: 40px;
  border-top: 1px solid var(--tp-rule);
}
```

**Sprocket**:
```css
.tp-sprocket {
  display: block;
  width: 4px;
  height: 6px;
  border-radius: 1px;
  background: var(--tp-ink-faint);
}
```

---

## 节点 2：Scene 01 — 显影盘（首屏 Hero）

### 2.1 交付物

| 文件 | 路径 |
|------|------|
| Scene 01 | `site/src/components/temporal-drag/SceneRolling.tsx` |
| 显影盘刻度 | `site/src/components/temporal-drag/DialTicks.tsx` |
| 指针 | `site/src/components/temporal-drag/DialHands.tsx` |
| DRAG 提示 | `site/src/components/temporal-drag/DragHint.tsx` |
| 四角装饰 | `site/src/components/temporal-drag/CornerDecoration.tsx` |

### 2.2 自检清单

- [ ] 60 刻度用三角函数定位，`transform: rotate(θ) translateY(-r)`
- [ ] 主刻度 12 根（每 5 格），附数字标签
- [ ] 刻度 stagger each 28ms，总时长 1680ms
- [ ] 内环 `delay: 1600`，scale-grow 1000ms
- [ ] 中心 "01" 组合动画：blur-in → zoom-in sequential
- [ ] 秒针 rotate 48°，分针 rotate -24°
- [ ] 标题 blur-in → slide-up sequential
- [ ] DRAG 提示 float infiniteAnimation
- [x] 四角装饰用 Position 精确定位
- [x] 时间码 RAF 自增，isDragging 时加速到 20ms 间隔
- [ ] 拖拽反馈：盘面旋转 ±5°、刻度高亮扇区 ±30°、指针震颤（留 N6）
- [ ] 释放后刻度群 pulse 校准（留 N6）

### 2.10 完成证据（2026-07-21）

- 静态：`pnpm --dir site type-check` 0 错；`pnpm --dir site build` 成功。
- 独立浏览器 lane：390×844 / 520×900 下 60 刻度、12 主刻度、6° 均匀分布，stagger 非同时起播；内环、01、双针最终角 48° / -24°、标题链、DRAG、四角装饰、HUD/Footer 均在 viewport 内，无主体重叠和横向溢出。
- DRAG infinite 在框架内层 wrapper 连续位移约 5.99px；右上镜号与语言按钮重叠 0px²。
- 冷加载终态：左上恰有 3 枚 sprocket，opacity=1，390 下约 3.89×6.23px，520 下 5×8px，均在 viewport 内；装饰层 `pointer-events:none`，故命中下层 stage 为预期。
- 性能：约 800 个 RAF 平均 16.69ms，P95 18.6ms，最大 33.3ms，>50ms=0，Long Task=0；console error/warning/pagerror=0。

### 2.3 布局骨架

```tsx
<Scene sceneId="rolling" className="tp-scene tp-scene--01"
  layout={{ width: '100%', height: '100%', overflow: 'hidden' }}>
  <div className="tp-scene__inner">
    <HeaderHUD sceneId="rolling" timecode="00:00:00:00" frame={1} />
    <Slate text="01 / ROLLING" />

    <div className="s01-center">
      <div className="s01-dial">
        <DialTicks />
        <DialInnerRing />
        <DialCenterNumber />
        <DialHands />
      </div>

      <div className="s01-title-area">
        <Eyebrow text="CINEMATIC UI FRAMEWORK" />
        <MainTitle text="CineView" />
        <Subtitle text="Direct every frame like a filmmaker" />
      </div>

      <DragHint />
    </div>

    <CornerDecoration position="tl" />
    <CornerDecoration position="tr" />
    <CornerDecoration position="bl" />
    <CornerDecoration position="br" />

    <Footer frame={1} hint="After release, time keeps finishing" />
  </div>
</Scene>
```

### 2.4 显影盘 Dial 精确规格

**外环刻度（DialTicks）**：
- 半径 `r = 32.5cqw`，直径 `65cqw`
- 60 根刻度，`θ = i × 6°`
- 主刻度 12 根：1px × 18px，颜色 `var(--tp-ink-mute)`，附数字标签
- 次刻度 48 根：1px × 10px，颜色 `var(--tp-ink-faint)`
- 数字标签：mono, `var(--tp-text-2xs)`, 刻度外侧 14px

```css
.tick {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(calc(var(--i) * 6deg)) translateY(calc(var(--r) * -1));
}

.tick__bar {
  width: 1px;
  background: var(--tp-ink-faint);
}

.tick--major .tick__bar {
  height: 18px;
  background: var(--tp-ink-mute);
}

.tick:not(.tick--major) .tick__bar {
  height: 10px;
}
```

**刻度 Animate**：
```tsx
<Animate
  animateId="dial-ticks"
  enterAnimation={{
    initial: { opacity: 0, scale: 0 },
    animate: {
      opacity: 1, scale: 1,
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

**内环（DialInnerRing）**：
- 直径 `45cqw`，border `1px solid rgba(237,232,224,0.1)`
- `delay: 1600`，scale 0→1，duration 1000ms

```tsx
<Animate
  animateId="dial-inner-ring"
  enterAnimation={{
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } }
  }}
  timeline={{ delay: 1600 }}
>
  <div className="s01-inner-ring" />
</Animate>
```

**中心数字 "01"**：
- Fraunces 600，`var(--tp-text-2xl)`，`-0.04em` 字间距

```tsx
<Animate
  animateId="scene-number-01"
  enterAnimation={{
    animations: [
      { initial: { opacity: 0, filter: 'blur(12px)' },
        animate: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } },
      { initial: { scale: 0.7 },
        animate: { scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } }
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

**指针（DialHands）**：
- 秒针：1px × 22cqw，`var(--tp-accent)`，rotate 48°
- 分针：2px × 15cqw，`var(--tp-ink-soft)`，rotate -24°

```tsx
<Animate animateId="hand-second" enterAnimation="rotate-in" duration={{ enter: 800 }}
  timeline={{ waitFor: 'scene-number-01' }}>
  {(state) => <motion.div className="s01-hand s01-hand--second"
    style={{ rotate: state.enterProgress * 48 }} />}
</Animate>

<Animate animateId="hand-minute" enterAnimation="rotate-in" duration={{ enter: 800 }}
  timeline={{ waitFor: 'scene-number-01', delay: 120 }}>
  {(state) => <motion.div className="s01-hand s01-hand--minute"
    style={{ rotate: state.enterProgress * -24 }} />}
</Animate>
```

**指针震颤 CSS**：
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

### 2.5 标题区精确规格

**Eyebrow**：
- 文字: `"CINEMATIC UI FRAMEWORK"`
- mono, `var(--tp-text-xs)`, `var(--tp-ink-mute)`, `0.22em` 字间距, uppercase

```tsx
<Animate animateId="s01-eyebrow" enterAnimation="fade-in" duration={{ enter: 500 }}
  timeline={{ waitFor: 'hand-second' }}>
  <p className="s01-eyebrow">CINEMATIC UI FRAMEWORK</p>
</Animate>
```

**主标题 "CineView"**：
- Fraunces 600, `var(--tp-text-xl)`, `var(--tp-ink)`, `-0.03em` 字间距

```tsx
<Animate
  animateId="s01-title"
  enterAnimation={{
    animations: [
      { initial: { opacity: 0, filter: 'blur(8px)' },
        animate: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } },
      { initial: { y: '18%', opacity: 0 },
        animate: { y: 0, opacity: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } }
    ],
    mode: 'sequential',
    delay: [0, 80]
  }}
  duration={{ enter: 1100 }}
  timeline={{ waitFor: 's01-eyebrow' }}>
  <h1 className="s01-title">CineView</h1>
</Animate>
```

**副标题**：
- Inter, `var(--tp-text-sm)`, `var(--tp-ink-soft)`, max-width 22ch, center

```tsx
<Animate animateId="s01-subtitle" enterAnimation="slide-up" duration={{ enter: 700 }}
  timeline={{ waitFor: 's01-title', delay: 100 }}>
  <p className="s01-subtitle">Direct every frame like a filmmaker</p>
</Animate>
```

### 2.6 DRAG 提示精确规格

- 直径 48px，border `1px solid rgba(201,161,108,0.35)`，border-radius 50%
- 内部 flex-column, center, gap 2px
- "DRAG": mono, 8px, `var(--tp-accent)`, `0.14em` 字间距
- "↓": mono, 10px, `var(--tp-accent)`

```tsx
<Animate
  animateId="drag-hint"
  enterAnimation="fade-in"
  duration={{ enter: 520 }}
  infiniteAnimation={{
    animate: { y: [0, 6, 0] },
    transition: { duration: 3, ease: 'easeInOut', repeat: Infinity }
  }}
  timeline={{ waitFor: 's01-subtitle', delay: 200 }}>
  <div className="s01-drag-hint">
    <span>DRAG</span>
    <span>↓</span>
  </div>
</Animate>
```

### 2.7 四角装饰（Position 精确定位）

| 位置 | 坐标 | 内容 | Animate |
|------|------|------|---------|
| 左上 | `{ x: 36, y: 72 }` | 3 个 sprocket 垂直排列，gap 8px | stagger fade-in, each 80ms |
| 右上 | `{ x: -32, y: 72, offsetX: 'right' }` | "SCENE 01" / "TAKE 01" 两行 mono | fade-in |
| 左下 | `{ x: 36, y: -56 }` | "DIRECTOR'S CUT" / "CineView" 两行 | fade-in |
| 右下 | `{ x: -52, y: -72, offsetX: 'right' }` | 4 个 sprocket 2×2 网格，gap 10px | stagger fade-in, each 100ms |

所有装饰共用 waitFor: `drag-hint`, delay: 300~400ms

### 2.8 拖拽交互反馈（精确数值）

| 反馈 | 触发 | 数值 | 实现 |
|------|------|------|------|
| 显影盘微旋转 | isDragging | `rotate = progress × 5°` | `useTransform(progress, [0,1], [-5, 5])` |
| 刻度高亮扇区 | isDragging | 拖拽方向 ±30° 扇区 scale(1.08) opacity(1) | 角度差计算 + data 属性 |
| 刻度压暗 | isDragging | 反向扇区 scale(0.92) opacity(0.3) | 同上 |
| 秒针震颤 | isDragging | 0.3px 幅度，6.7Hz | CSS `.is-shaking` class toggle |
| 释放回弹 | onDragEnd | spring stiffness 180, damping 14 | 框架内置 |
| 刻度群校准闪 | onDragCommit 后 0.5s | opacity 0.3→1→0.3→1，0.4s | CSS animation 一次性触发 |
| 时间码加速 | isDragging | 自增间隔 40ms → 20ms | RAF 间隔调整 |

### 2.9 Scene 01 入场时序甘特图

```
0ms      500ms    1000ms   1500ms   2000ms   2500ms   3000ms   3500ms   4000ms   4500ms
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

## 节点 3：Scene 02 — 编排轴

### 3.1 交付物

| 文件 | 路径 |
|------|------|
| Scene 02 | `site/src/components/temporal-drag/SceneSync.tsx` |
| 时间轴节点 | `site/src/components/temporal-drag/TimelineNode.tsx` |
| 连接线光点 | `site/src/components/temporal-drag/ConnectionLight.tsx` |
| 参数面板 | `site/src/components/temporal-drag/ParamPanel.tsx` |

### 3.2 自检清单

- [~] 背景 `var(--tp-bg-elevated)`，与 Scene 01 形成层级（N3 进行中）
- [ ] 时间轴基线 scaleX: 0→1，gradient 两端 transparent
- [ ] 5 节点均匀分布，25% 间隔
- [ ] 节点 bounce-in，waitFor 链级联（每节点 +240ms delay）
- [ ] 节点亮起时填充 `var(--tp-accent-dim)`
- [ ] 连接线光点 x-slide + opacity fade，700ms
- [ ] 节点标签 stagger fade-in
- [ ] 参数面板玻璃态（backdrop-filter blur(16px)）
- [ ] 面板内容随 activeNodeIndex state 更新

### 3.3 5 节点 waitFor 链

| 节点 | ID | 标签 | waitFor | delay |
|------|-----|------|---------|-------|
| 1 | `node-title` | T | `timeline-base` | 0 |
| 2 | `node-subtitle` | S | `node-title` | 240ms |
| 3 | `node-body` | B | `node-subtitle` | 240ms |
| 4 | `node-image` | I | `node-body` | 240ms |
| 5 | `node-cta` | C | `node-image` | 240ms |

```tsx
<Animate
  animateId="node-title"
  enterAnimation="bounce-in"
  duration={{ enter: 500 }}
  timeline={{ waitFor: 'timeline-base' }}>
  {(state) => (
    <div className={`s02-node ${state.phase === 'entered' ? 'is-active' : ''}`}>T</div>
  )}
</Animate>
```

### 3.4 连接线光点

- 6px 圆，`var(--tp-accent)`，`box-shadow: 0 0 8px 2px var(--tp-accent-glow)`
- 从上一节点 x 滑动到下一节点 x，700ms linear

```tsx
<Animate
  animateId={`light-${conn.from}-${conn.to}`}
  enterAnimation={{
    initial: { x: 0, opacity: 0, scale: 0 },
    animate: {
      x: conn.distance, opacity: [0, 1, 1, 0], scale: [0, 1, 1, 0.5],
      transition: { duration: 0.7, ease: 'linear' }
    }
  }}
  timeline={{ waitFor: `node-${conn.from}` }}>
  <div className="s02-light" />
</Animate>
```

### 3.5 参数面板

- 宽度 `min(88%, 380px)`，padding `var(--tp-space-4)`
- background `var(--tp-bg-glass)`，backdrop-filter `blur(16px)`
- border `1px solid var(--tp-border-glass)`，border-radius `var(--tp-radius)`
- 内部参数行：mono, `var(--tp-text-2xs)`, `var(--tp-ink-soft)`, line-height 2
- 进度条：2px 高，background `var(--tp-rule)`，fill `var(--tp-accent)`

---

## 节点 4：Scene 03 — 时间瀑布

### 4.1 交付物

| 文件 | 路径 |
|------|------|
| Scene 03 | `site/src/components/temporal-drag/SceneFlux.tsx` |
| 背景流动层 | `site/src/components/temporal-drag/TimeStreams.tsx` |
| 进度环 | `site/src/components/temporal-drag/ProgressRing.tsx` |
| 刻度条 | `site/src/components/temporal-drag/TickBar.tsx` |

### 4.2 自检清单

- [ ] 3 列 CSS `@keyframes` 流动层，零 JS
- [ ] 左列 24s / 中列 14s / 右列 8s
- [ ] 移动端（≤430px）隐藏中列
- [ ] 巨型时间码 11 位逐位 flip-in stagger
- [ ] SVG 进度环 `pathLength` 动画，2200ms
- [ ] 20 刻度条 stagger scaleY
- [ ] 标记位置用 `useTransform(dragProgress, [0,1], ['0%', '100%'])`

### 4.3 背景流动层 CSS

```css
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
```

### 4.4 巨型时间码

- Fraunces 600, `var(--tp-text-2xl)`, `var(--tp-accent)`, `-0.03em` 字间距

```tsx
<Animate
  animateId="main-timecode"
  enterAnimation="flip"
  stagger={{ each: 100 }}
  timeline={{ delay: 400 }}>
  {'00:00:02:00'.split('').map((ch, i) => (
    <span key={i} className="mono s03-timecode-char">{ch}</span>
  ))}
</Animate>
```

### 4.5 刻度条

- 20 个刻度，1px 宽，8px 高（主刻度 12px）
- 高亮标记 2px × 14px，`var(--tp-accent)`
- 标记位置由 `useTransform(dragProgress, [0,1], ['0%', '100%'])` 驱动

---

## 节点 5：Scene 04 — 定格

### 5.1 交付物

| 文件 | 路径 |
|------|------|
| Scene 04 | `site/src/components/temporal-drag/SceneCut.tsx` |
| 按钮组 | 内联于 SceneCut |
| 底部齿孔条 | 内联于 SceneCut |

### 5.2 自检清单

- [ ] REC 点变灰 solid，停止 pulse
- [ ] CUT 标题组合动画：blur-in → zoom-in sequential，1300ms
- [ ] accent 细线 scaleX，宽度 12cqw
- [ ] THE END fade-in
- [ ] 双按钮 stagger slide-up
- [ ] 12 齿孔条 stagger fade-in，其中 3 个标 END

### 5.3 CUT 标题

```tsx
<Animate
  animateId="cut-title"
  enterAnimation={{
    animations: [
      { initial: { opacity: 0, filter: 'blur(14px)' },
        animate: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } } },
      { initial: { scale: 0.75 },
        animate: { scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } }
    ],
    mode: 'sequential',
    delay: [0, 200]
  }}
  duration={{ enter: 1300 }}
  timeline={{ delay: 300 }}>
  <h1 className="s04-cut-title">CUT</h1>
</Animate>
```

### 5.4 按钮样式

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

---

## 节点 6：拖拽交互反馈

### 6.1 交付物

交互逻辑直接写入各 Scene 组件，无独立文件。

### 6.2 自检清单

- [ ] 显影盘整体旋转：`useTransform(progress, [0,1], [-5, 5])` → 绑定 dial 容器
- [ ] 刻度高亮扇区：计算拖拽方向角度，±30° 内 data-highlight="true"
- [ ] 刻度压暗：反向扇区 data-highlight="false"
- [ ] 秒针震颤：`.is-shaking` class toggle，非 state
- [ ] 释放回弹：框架 spring
- [ ] 刻度群校准闪：CSS animation 一次性触发
- [ ] 时间码加速：RAF 间隔调整

### 6.3 刻度高亮算法

```typescript
// 伪代码
function getHighlightedTickIndices(
  dragProgress: number,  // 0..1
  direction: 'forward' | 'backward',
  totalTicks: number
): Set<number> {
  const centerAngle = direction === 'forward' ? 90 : 270; // 拖拽方向对应的圆周角度
  const highlightSet = new Set<number>();

  for (let i = 0; i < totalTicks; i++) {
    const tickAngle = i * 6; // 每根刻度的角度
    const diff = Math.abs(tickAngle - centerAngle);
    const wrappedDiff = Math.min(diff, 360 - diff);
    if (wrappedDiff <= 30) {
      highlightSet.add(i);
    }
  }
  return highlightSet;
}
```

---

## 节点 7：减少动态偏好适配

### 7.1 自检清单

- [x] `@media (prefers-reduced-motion: reduce)` 覆盖所有 animation
- [x] pulse/float/infinite 全部停止
- [x] stagger each 归零
- [x] transition duration 压缩至 0.08s
- [x] 背景流动层 `animation: none`
- [x] 时间码停止自增

**N7 静态证据（2026-07-21）**：`TemporalMotionProvider` 在 `.drag-temporal` 内包裹
`CineView`；temporal-drag 下全部 15 个 `Animate` 消费 `useTemporalMotion`，`duration.enter`、
`timeline.delay`、`stagger.each` 与 custom transition 秒值分别经 timing 映射，普通模式保持原值。
reduce 下 DragHint 不再传 infiniteAnimation，SceneRolling 角度直接固定为 0；CSS 媒体查询严格限定
`.drag-temporal`，统一停止 animation（包含 REC、float、shake、calibration、s03 streams）并把
transition duration 压至 0.08s。全目录残留扫描无裸 numeric custom transition duration；
`pnpm --dir site type-check` 0 错，Prettier 检查通过。按本次要求未运行耗时浏览器验收，视觉证据
留待 N10 独立 agent。自检确认未新增每帧 React state、未改变 MotionValue 所有权。

### 7.2 CSS 媒体查询

```css
@media (prefers-reduced-motion: reduce) {
  .tp-rec-dot,
  .s01-drag-hint,
  .s03-stream {
    animation: none !important;
  }
  /* stagger 归零由 JS 侧检测 matchMedia 后传 each: 0 */
}
```

---

## 节点 8：移动端特调

### 8.1 自检清单

- [ ] ≤430px 时显影盘直径 82cqw（更大）
- [ ] ≤430px 时刻度数从 60 → 30（每 2 帧一格）
- [ ] ≤430px 时时间轴节点垂直排列（非水平）
- [ ] ≤430px 时背景流动层 2 列（去中列）
- [ ] 触控目标 ≥ 44px
- [ ] DRAG 提示上移 20px
- [ ] 按钮触控目标 48px

### 8.2 响应式断点

```css
@media (max-width: 430px) {
  .s01-dial { --dial-scale: 1.26; } /* 65cqw → 82cqw */
  .s02-timeline { flex-direction: column; }
  .s03-stream--center { display: none; }
  .tp-btn { min-height: 48px; }
}
```

---

## 节点 9：i18n + 性能优化 + Profiler 验证

### 9.1 i18n 文案

```ts
// 新增 key（中英双语）
'dragTemporal.s01.slate': '01 / ROLLING',
'dragTemporal.s01.eyebrow': 'CINEMATIC UI FRAMEWORK',
'dragTemporal.s01.title': 'CineView',
'dragTemporal.s01.subtitle': 'Direct every frame like a filmmaker',
'dragTemporal.s01.footerHint': 'After release, time keeps finishing',

'dragTemporal.s02.slate': '02 / CHOREOGRAPH',
'dragTemporal.s02.eyebrow': 'DECLARATIVE TIMELINE',
'dragTemporal.s02.title': 'Order & position, resolved',
'dragTemporal.s02.footerHint': 'Elements arrive in turn',

'dragTemporal.s03.smpteLabel': 'SMPTE TIME CODE',
'dragTemporal.s03.equation.line1': 'SCROLL DISTANCE = TIME',
'dragTemporal.s03.equation.line2': '1ms = 1px',
'dragTemporal.s03.footerHint': 'Scroll distance = time',

'dragTemporal.s04.title': 'CUT',
'dragTemporal.s04.theEnd': 'THE END',
'dragTemporal.s04.btnHome': 'Back to home',
'dragTemporal.s04.btnDocs': 'Read docs',
'dragTemporal.s04.footerHint': 'END',
```

### 9.2 性能预算

| 指标 | 目标 | 验证 |
|------|------|------|
| TTI | < 1.5s | Lighthouse |
| 帧率 | 60fps | Chrome Performance |
| 长任务 | 无 > 50ms | Chrome Performance |
| 内存 | 无泄漏 | Memory Profiler |
| 增量体积 | < 15KB gzipped | Bundle analyzer |

### 9.3 热路径最终检查

| 路径 | 风险 | 方案 | 状态 |
|------|------|------|------|
| 60 刻度 stagger | 60 个 motion 元素 | 框架 stagger 原生优化 | ✅ |
| 时间码 RAF | 每帧触发 | 只更新 ref.innerText | ✅ |
| 背景流动层 | 3 列无限滚动 | 纯 CSS @keyframes | ✅ |
| 拖拽刻度高亮 | 每帧计算 | useTransform 映射 | ✅ |
| 指针震颤 | 每帧 CSS transform | CSS class toggle | ✅ |
| 进度环 SVG | pathLength 动画 | Framer Motion SVG | ✅ |
| 刻度条标记 | 随 progress 移动 | useTransform 映射 | ✅ |

### 9.4 禁止项（最终确认）

- [ ] 无 RAF/timeInterval 中调用 `setState`
- [ ] 无拖拽回调中创建新对象/数组引用
- [ ] 无 > 20 个元素使用独立 `useTransform`
- [ ] 无 `useMemo` 依赖包含每帧变化量
- [ ] 无拖拽热路径中读取 layout

---

## 节点 10：全链路浏览器验收

### 10.1 验收标准

由**独立 agent**在 `localhost:3000/#/drag` 实测：

| 检查项 | 通过标准 |
|--------|---------|
| 首屏入场 | 60 刻度依次亮起，无跳帧，无闪烁 |
| 时间码 | 末两位自增流畅，不卡顿 |
| 拖拽 Scene 01 | 盘面微旋转自然，刻度高亮扇区正确 |
| 拖拽释放 | 弹簧回弹到位，无刻度残留高亮 |
| 切到 Scene 02 | 过渡流畅，节点依次 bounce-in |
| Scene 02 等待 | 光点沿连接线流动，参数面板更新同步 |
| 切到 Scene 03 | 背景时间码流动自然，巨型时间码 flip-in |
| 拖拽 Scene 03 | 刻度条标记随拖拽移动，无抖动 |
| 切到 Scene 04 | CUT 标题 blur→zoom 清晰，按钮可点 |
| 反向拖拽 | 从 04 → 03 → 02 → 01，反向动画正确 |
| 移动端 | ≤430px 布局切换正确，触控目标可点 |
| 减少动态 | `prefers-reduced-motion` 下所有动画停止 |
| 性能 | 60fps 稳定，无掉帧 |

### 10.2 验收流程

1. 独立 agent 打开 `localhost:3000/#/drag`
2. 观察首屏完整入场（约 4.5s）
3. 拖拽上/下，测试 Scene 切换
4. 测试反向拖拽
5. 测试快速/慢速拖拽，验证阈值
6. 切换 DevTools 到移动端视口，重复测试
7. 开启 `prefers-reduced-motion`，验证适配
8. 录制 Performance 面板，验证 60fps

---

## 文件结构总览

```
site/src/
├── pages/
│   └── DragPage.tsx                    # 入口
├── components/temporal-drag/
│   ├── TemporalDragExperience.tsx      # 主组件
│   ├── SceneRolling.tsx                # N2
│   ├── SceneSync.tsx                   # N3
│   ├── SceneFlux.tsx                   # N4
│   ├── SceneCut.tsx                    # N5
│   ├── HeaderHUD.tsx                   # N1
│   ├── FooterBar.tsx                   # N1
│   ├── RecBadge.tsx                    # N1
│   ├── TimecodeDisplay.tsx             # N1
│   ├── DialTicks.tsx                   # N2
│   ├── DialHands.tsx                   # N2
│   ├── DragHint.tsx                    # N2
│   ├── CornerDecoration.tsx            # N2
│   ├── TimelineNode.tsx                # N3
│   ├── ConnectionLight.tsx             # N3
│   ├── ParamPanel.tsx                  # N3
│   ├── TimeStreams.tsx                 # N4
│   ├── ProgressRing.tsx                # N4
│   ├── TickBar.tsx                     # N4
│   ├── Sprocket.tsx                    # N1
│   └── index.ts                        # barrel
├── styles/
│   └── temporal-drag.css               # N1
└── hooks/
    └── useTimecode.ts                  # N1
```

---

*文档冻结。进入实现阶段后，每完成一个节点在此文档打勾并更新 git。*
