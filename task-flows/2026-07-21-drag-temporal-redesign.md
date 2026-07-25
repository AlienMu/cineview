# `/drag` 页面「Temporal — 时间显影」主题重构设计方案稿

> 日期：2026-07-21 | 状态：方案阶段（不实现）| 模式：drag（移动端特调）
> 性质：彻底重构，非现有设计迭代

---

## 一、设计方向：暗调电影显影室

彻底抛弃现有暖白底 + 轻量感的方向，转向**暗房显影**的视觉语言：

- **深暖黑底色**（`#0c0a08`）——不是冷灰，是暗房那种吸光的深棕黑
- **琥珀金强调**（`#c9a16c`）——暗房安全灯的色调，温暖而克制
- **暖白文字**（`#ede8e0`）——不刺眼，有温度
- **机械精度感**——表盘刻度、指针、mono 时间码、齿孔

**核心隐喻**：用户不是在看一个"产品介绍页"，而是在操作一台**精密的电影剪辑台**。拖拽翻页就像在拉动胶片，每一页都是时间的一个切片。

**去 AI 味的锚点**：
- 所有文案使用电影工业实体术语（SMPTE、FPS、TAKE、ROLLING、CUT）
- 视觉元素都有物理对应（钟表刻度 ≠ 数据仪表盘，胶片齿孔 ≠ 装饰圆点）
- 允许"不完美"——手调字距、不等高元素、有机的 stagger 节奏

---

## 二、新配色体系（drag 页面局部）

```css
.drag-temporal {
  --tp-bg: #0c0a08;              /* 暗房主背景 */
  --tp-bg-elevated: #161412;      /* 稍浅，Scene 切换层级 */
  --tp-ink: #ede8e0;              /* 暖白主文字 */
  --tp-ink-soft: #9a948a;         /* 柔灰正文 */
  --tp-ink-mute: #5c564e;         /* 深灰辅助 */
  --tp-accent: #c9a16c;           /* 琥珀金强调 */
  --tp-accent-soft: #a08050;      /* 暗琥珀 */
  --tp-rec: #c44b3a;              /* REC 暗红 */
  --tp-rule: rgba(237,232,224,0.08);   /* 分割线 */
  --tp-glow: rgba(201,161,108,0.25);   /* 金色光晕 */
}
```

> 不覆盖现有 site tokens，通过 Scene 的 className 局部注入。

---

## 三、Scene 总览（4 镜 → 时间递进）

```
CineView mode="drag"
  config={{ size: 390 }}
  modes={{ drag: { direction: 'y', transitionDuration: 720, dragTimeScale: 16 } }}
├── Scene 01 "rolling"   — 显影盘（Hero / 首屏爆点）
├── Scene 02 "sync"      — 编排轴（waitFor 能力可视化）
├── Scene 03 "flux"      — 时间瀑布（视觉高潮）
└── Scene 04 "cut"       — 定格（极简收尾）
```

**时间码贯穿**：每镜顶部 HUD 的时间码递增，`00:00:00:00` → `00:00:01:00` → `00:00:02:00` → `00:00:03:00`，形成隐性叙事线。

---

## 四、逐镜详细方案

### Scene 01 — 显影盘（Debut）★ Hero 级首屏

**视觉目标**：用户进入 `/drag` 的第一眼，看到一个正在"苏醒"的精密机械表盘——60 根刻度依次亮起，指针旋转到位，像暗房里的显影定时器被启动。

#### 布局骨架

```
┌─────────────────────────────────────┐
│ ● REC  00:00:00:00          25 FPS  │  ← header HUD（全宽 flex space-between）
├─────────────────────────────────────┤
│                                     │
│         ○ ○ ○ ○ ○ ○ ○ ○ ○          │  ← 显影盘外环（60 刻度）
│       ○                 ○           │
│      ○      ┌─────┐      ○          │  ← 内环细圆 + 中心 "01"
│      ○      │  01  │      ○          │
│      ○      └──┬──┘      ○          │  ← 秒针/分针
│       ○                 ○           │
│         ○ ○ ○ ○ ○ ○ ○ ○ ○          │
│                                     │
│    CINEMATIC UI FRAMEWORK           │  ← 标题区
│         CineView                    │
│   Direct every frame...             │
│                                     │
│          ┌──┐                       │  ← 底部提示（DRAG 圆环）
│          │↑↓│                       │
│          └──┘                       │
├─────────────────────────────────────┤
│ ◖◖◖           FRAME 0001            │  ← footer（齿孔 + 帧号）
└─────────────────────────────────────┘
```

#### 元素清单（从上到下，精确到 Animate 特性）

**1. Header HUD 条**

| 属性 | 值 |
|---|---|
| 结构 | flex, space-between, align-center, padding 0 5cqw |
| 高度 | 48px（物理），不随 cq 变 |
| 左区 | `● REC`（红点 + mono 文字）+ 动态时间码 `00:00:00:00` |
| 右区 | `25 FPS` · `SMPTE` · `ISO 800` |
| 底边 | `1px solid var(--tp-rule)` |
| **Animate** | `enterAnimation="fade-in"`, `duration: { enter: 480 }`, `timeline: { delay: 0 }` |

> **REC 红点**：不是普通圆点，用 `infiniteAnimation="pulse"` 持续呼吸。红点外环有光晕：`box-shadow: 0 0 0 4px rgba(196,75,58,0.15)`。

> **时间码**：每个数字位（共 8 位数字 + 3 个冒号）都是**独立的 Animate 元素**，用 **stagger** 依次 reveal！这是首屏的核心彩蛋——用户会注意到时间码是逐位"滴答"出现的。
> ```tsx
> // 时间码 stagger 实现
> <Animate
>   enterAnimation={{ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }}
>   stagger={{ each: 40 }}
> >
>   {'00:00:00:00'.split('').map((ch, i) => (
>     <span key={i} className="mono">{ch}</span>
>   ))}
> </Animate>
> ```

**2. 显影盘外环 — 60 刻度阵列**

| 属性 | 值 |
|---|---|
| 直径 | 65cqw（手机壳内约 250px） |
| 刻度数 | 60 根（每秒/每帧一格） |
| 短刻度 | 1px × 10px，opacity 0.3 |
| 长刻度 | 1px × 18px，每 5 格一根，附数字标签 `05` `10`...`60` |
| 数字标签 | mono, 8px, ink-mute |
| 定位 | 绝对定位，用三角函数计算圆周坐标（`translate(-50%, -50%) rotate(Ndeg) translateY(-radius)`） |

**Animate 配置**：
```tsx
// 全部 60 根刻度共用一个 Animate + stagger
<Animate
  enterAnimation={{
    initial: { opacity: 0, scale: 0 },
    animate: { opacity: 1, scale: 1, transition: { duration: 0.25 } }
  }}
  stagger={{ each: 28 }}  // 60 × 28ms = 1680ms 总时长
  timeline={{ waitFor: 'header-hud', delay: 200 }}
>
  {ticks.map((tick, i) => (
    <div key={i} className={tick.isMajor ? 'tick-major' : 'tick-minor'} 
         style={{ '--tick-angle': `${i * 6}deg` } as React.CSSProperties}>
      {tick.isMajor && <span className="tick-label">{tick.label}</span>}
    </div>
  ))}
</Animate>
```

> **亮起效果**：每根刻度亮起时带微弱的金色光晕 `box-shadow: 0 0 6px 1px var(--tp-glow)`，像暗房里显影液逐渐显现影像。

**3. 显影盘内环 — 细圆环**

| 属性 | 值 |
|---|---|
| 直径 | 45cqw |
| stroke | 1px `rgba(237,232,224,0.1)` |
| **Animate** | custom variant：`scale: 0 → 1`，duration 1000ms，ease `[0.16, 1, 0.3, 1]` |
| **waitFor** | `timeline: { delay: 1600 }`（约等于刻度 stagger 快结束时开始） |

```tsx
<Animate
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
  <div className="inner-ring" />
</Animate>
```

**4. 中心场景编号 — `01`**

| 属性 | 值 |
|---|---|
| 字体 | Fraunces, 600 |
| 字号 | 16cqw（手机壳内约 62px） |
| 颜色 | tp-ink |
| **Animate** | **组合动画**：`blur-in` → `zoom-in` sequential |

```tsx
<Animate
  enterAnimation={{
    animations: ['blur-in', 'zoom-in'],
    mode: 'sequential',
    delay: [0, 120]
  }}
  duration={{ enter: 900 }}
  timeline={{ waitFor: 'inner-ring', delay: 200 }}
>
  <span className="scene-number">01</span>
</Animate>
```

> 先模糊再清晰——像镜头慢慢对上焦。这是电影感的关键细节。

**5. 两根指针**

| 属性 | 秒针 | 分针 |
|---|---|---|
| 尺寸 | 1px × 22cqw | 2px × 15cqw |
| 颜色 | tp-accent | tp-ink-soft |
| transform-origin | bottom center | bottom center |
| 初始角度 | 0° | 0° |
| 目标角度 | 48° | -24° |
| **Animate** | `enterAnimation="rotate-in"` | `enterAnimation="rotate-in"` |
| **waitFor** | `timeline: { waitFor: 'scene-number-01' }` | 同上 |

```tsx
<Animate
  enterAnimation="rotate-in"
  duration={{ enter: 800 }}
  timeline={{ waitFor: 'scene-number-01' }}
>
  {(state) => (
    <motion.div 
      className="hand-second"
      style={{ rotate: state.enterProgress * 48 }}
    />
  )}
</Animate>
```

> 指针从 12 点位置旋转到目标角度，像机械表上弦后的第一次走动。

**6. 标题区**（圆环下方，y 偏移约 38cqw）

| 元素 | 样式 | Animate |
|---|---|---|
| eyebrow | mono, 10px, tp-ink-mute, letter-spacing 0.22em, uppercase | `fade-in`, waitFor: pointer-group |
| 标题 `CineView` | Fraunces, 10cqw, tp-ink, letter-spacing -0.03em | **组合动画** `blur-in` → `slide-up` sequential, waitFor: eyebrow |
| 副标题 | Inter, 3.4cqw, tp-ink-soft, max-width 22ch | `slide-up`, waitFor: 标题, delay 100ms |

```tsx
{/* eyebrow */}
<Animate animateId="s1-eyebrow" enterAnimation="fade-in" timeline={{ waitFor: 'pointer-group' }}>
  <p className="eyebrow">CINEMATIC UI FRAMEWORK</p>
</Animate>

{/* 标题 — 组合动画：先模糊对焦，再滑入到位 */}
<Animate
  animateId="s1-title"
  enterAnimation={{
    animations: ['blur-in', 'slide-up'],
    mode: 'sequential',
    delay: [0, 100]
  }}
  duration={{ enter: 1000 }}
  timeline={{ waitFor: 's1-eyebrow' }}
>
  <h1 className="main-title">CineView</h1>
</Animate>

{/* 副标题 */}
<Animate
  enterAnimation="slide-up"
  duration={{ enter: 700 }}
  timeline={{ waitFor: 's1-title', delay: 100 }}
>
  <p className="subtitle">Direct every frame like a filmmaker</p>
</Animate>
```

**7. 底部提示 — DRAG 圆环**

| 属性 | 值 |
|---|---|
| 尺寸 | 直径 48px |
| border | 1px `rgba(201,161,108,0.35)` |
| 内部 | mono 8px 文字 `DRAG` + 箭头 `↓` |
| **Animate** | `fade-in` + `infiniteAnimation: float` |
| **waitFor** | 副标题 |

```tsx
<Animate
  enterAnimation="fade-in"
  infiniteAnimation="float"  // 自定义 infinite：上下浮动 6px，3s cycle
  timeline={{ waitFor: 's1-subtitle', delay: 200 }}
>
  <div className="drag-hint-ring">
    <span>DRAG</span>
    <span>↓</span>
  </div>
</Animate>
```

> float 是自定义 infiniteAnimation：
> ```css
> @keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(6px) } }
> ```

**8. 装饰元素 — Position 精确定位**

用 `Position` 在四角放置胶片工业标记：

| 位置 | 内容 | Position at | Animate |
|---|---|---|---|
| 左上 | 3 个齿孔（4×6px 圆角矩形，opacity 0.2） | `{ x: 36, y: 72 }` | stagger fade-in, each 80ms |
| 右上 | `SCENE 01` / `TAKE 01` 两行 mono | `{ x: -32, y: 72, offsetX: 'right' }` | fade-in |
| 左下 | `DIRECTOR'S CUT` / `CineView` 两行 | `{ x: 36, y: -56 }` | fade-in |
| 右下 | 4 个散落齿孔 | `{ x: -52, y: -72, offsetX: 'right' }` | stagger fade-in |

所有装饰共用一个 waitFor：`timeline: { waitFor: 'drag-hint', delay: 300 }`

```tsx
<Position at={{ x: 36, y: 72 }}>
  <Animate
    enterAnimation="fade-in"
    stagger={{ each: 80 }}
    timeline={{ waitFor: 'drag-hint', delay: 300 }}
  >
    <span className="sprocket" />
    <span className="sprocket" />
    <span className="sprocket" />
  </Animate>
</Position>
```

#### Scene 01 的完整 waitFor 链

```
header HUD (fade-in, delay: 0)
  → 时间码 stagger (逐位 reveal, each 40ms, waitFor: header)
    → 外环刻度 stagger (scale-in, each 28ms, waitFor: header)
      → 内环 (scale-grow, delay: 1600)
        → 中心 "01" (blur-in→zoom-in sequential, waitFor: 内环)
          → 指针组 (rotate-in, waitFor: "01")
            → eyebrow (fade-in, waitFor: 指针)
              → 标题 (blur-in→slide-up, waitFor: eyebrow)
                → 副标题 (slide-up, waitFor: 标题, delay: 100)
                  → DRAG 提示 (fade-in + float, waitFor: 副标题, delay: 200)
                    → 装饰元素 stagger (fade-in, waitFor: DRAG 提示, delay: 300)
```

总入场时长约 4.5s，节奏由密到疏——前 2s 是密集的刻度/时间码亮起，后 2.5s 是标题和装饰的舒展。

#### 拖拽交互反馈（ Scene 01 专属）

| 反馈 | 实现 | 性能 |
|---|---|---|
| 显影盘整体微旋转 | `useTransform(progress, [0,1], [-5, 5])` → rotate deg | motionValue，零 React 渲染 |
| 刻度"被拉动" | 拖拽方向 30° 扇区内刻度 scale(1.1) + opacity(1)，反向 scale(0.85) + opacity(0.35) | useTransform 映射，零 React 渲染 |
| 指针微颤 | 秒针叠加 `shake-x`（幅度 0.3px），由 `isDragging` 状态门控 | CSS animation class toggle |
| 释放回弹 | 盘面 `elastic` 缓动回 0°（transition type: spring, stiffness: 180, damping: 14） | Framer Motion spring |
| 刻度闪烁校准 | release 后 0.5s 内，全部刻度做一次 `pulse`（infiniteAnimation 临时触发一次） | CSS animation |

---

### Scene 02 — 编排轴（Choreograph）

**核心创意**：把 `waitFor` 的时间编排能力**可视化**为一条时间轴——节点依次亮起，光点沿连接线流动，像剪辑软件里按播放键后的时间线。

**视觉**：背景 `#161412`（比首屏略浅，形成自然的 Scene 层级推进）。

#### 布局

```
┌─────────────────────────────────────┐
│ ● REC  00:00:01:00          25 FPS  │  ← header（同 Scene 01，时间码更新）
├─────────────────────────────────────┤
│         02 / CHOREOGRAPH            │  ← slate
│                                     │
│    DECLARATIVE TIMELINE             │  ← eyebrow
│    Order & position, resolved       │  ← 标题
│                                     │
│    ──○────○────○────○────○──        │  ← 时间轴 + 5 节点
│    T    S    B    I    C            │  ← 节点标签
│                                     │
│  ┌─────────────────────────────┐    │  ← 参数面板
│  │  waitFor: "title"           │    │
│  │  delay: 200ms               │    │
│  │  duration: 720ms            │    │
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│ ◖◖◖           FRAME 0042            │
└─────────────────────────────────────┘
```

#### 元素清单

**1. Header HUD**
- 时间码：`00:00:01:00`
- 其余同 Scene 01
- `enterAnimation="fade-in"`（Scene 切换时快速淡入，避免生硬）

**2. Slate — `02 / CHOREOGRAPH`**
- mono, 10px, tp-ink-mute
- `enterAnimation="fade-in"`

**3. eyebrow + 标题**
- eyebrow: `DECLARATIVE TIMELINE` — mono, 10px
- 标题: `Order & position, resolved` — Fraunces, 8cqw
- **Animate**：标题使用 `slide-up`，waitFor eyebrow

**4. 时间轴基线**
- 1px 水平线，tp-rule 色
- 从中心向两侧生长：`scaleX: 0 → 1`
- custom variant：duration 800ms，ease `[0.16, 1, 0.3, 1]`

**5. 节点**（5 个，沿时间轴均匀分布）

这是 Scene 02 的核心展示——**框架 waitFor 能力的可视化**：

| 节点 | 标签 | waitFor 链 |
|---|---|---|
| 1 | `T` Title | waitFor: 时间轴基线完成 |
| 2 | `S` Subtitle | waitFor: 节点 1, delay: 240ms |
| 3 | `B` Body | waitFor: 节点 2, delay: 240ms |
| 4 | `I` Image | waitFor: 节点 3, delay: 240ms |
| 5 | `C` CTA | waitFor: 节点 4, delay: 240ms |

每个节点：
- 直径 36px 圆环，border 1px tp-accent
- 内部字母：mono, 12px, tp-accent
- **Animate**：`bounce-in`（preset）
- 亮起时圆环填充 accent 色（背景从 transparent → accent at 12%）

```tsx
{nodes.map((node, i) => (
  <Animate
    key={node.id}
    animateId={`node-${node.id}`}
    enterAnimation="bounce-in"
    duration={{ enter: 500 }}
    timeline={{
      waitFor: i === 0 ? 'timeline-base' : `node-${nodes[i-1].id}`,
      delay: i === 0 ? 0 : 240
    }}
  >
    <div className="timeline-node">{node.label}</div>
  </Animate>
))}
```

> 这就是 `waitFor` 的真实用法——节点 2 等节点 1 完全入场后才触发，形成级联。

**6. 连接线光点**
- 节点之间用虚线连接：`border-bottom: 1px dashed rgba(201,161,108,0.15)`
- 光点：6px 圆，tp-accent，从上一节点 slide 到下一节点
- **Animate**：custom variant，x 从 0 到节点间距
- **waitFor**：对应源节点亮起后触发

```tsx
{connections.map((conn, i) => (
  <Animate
    key={i}
    enterAnimation={{
      initial: { x: 0, opacity: 0 },
      animate: { 
        x: conn.distance, 
        opacity: [0, 1, 1, 0],
        transition: { duration: 0.7, ease: 'linear' }
      }
    }}
    timeline={{ waitFor: `node-${conn.from}` }}
  >
    <div className="connection-light" />
  </Animate>
))}
```

**7. 节点标签**
- 每个节点下方：元素名 + 延迟值
- `Title` / `+0ms`, `Subtitle` / `+240ms`...
- mono, 2xs, tp-ink-mute
- `fade-in`, waitFor 对应节点

**8. 参数面板**
- 半透卡片：背景 `rgba(22,20,18,0.85)` + `backdrop-filter: blur(16px)`
- border：`1px solid rgba(237,232,224,0.06)`
- 内部 mono 文本，显示当前"选中"节点的参数
- 随着节点依次亮起，面板内容同步更新（用本地 state 跟踪 activeNodeIndex）
- **Animate**：`slide-up`，waitFor 所有节点亮起

**9. 装饰代码片段**
- 用 Position 定位在角落的半透明代码：
  - `<Animate timeline={{ waitFor: "title" }} />`
  - `stagger: { each: 80 }`
- opacity 0.04，mono 字体
- `fade-in`

---

### Scene 03 — 时间瀑布（Flux）

**核心创意**：视觉高潮。多层时间码以不同速度垂直流动，中央固定一个巨大的"当前时间"，像站在时间的长河里。

**视觉**：回到 `#0d0b09`。

#### 布局

```
┌─────────────────────────────────────┐
│ ● REC  00:00:02:00          25 FPS  │
├─────────────────────────────────────┤
│  00:00:01:12  ← 快速流动层           │
│  00:00:01:18                        │
│  00:00:01:24                        │
│                                     │
│      00:00:02:00    ← 中央固定        │  ← 视觉中心
│      ━━━━━━━━━━                     │
│      SMPTE TIME CODE                │
│                                     │
│  00:00:02:06  ← 慢速流动层           │
│  00:00:02:12                        │
│                                     │
├─────────────────────────────────────┤
│ ◖◖◖           FRAME 0068            │
└─────────────────────────────────────┘
```

#### 元素清单

**1. 背景流动层（3 列，纯 CSS，零 JS）**

| 列 | 位置 | 速度 | opacity | 方向 |
|---|---|---|---|---|
| 左 | x: 8% | 24s / cycle | 0.04 | 向上 |
| 中 | x: 50% | 14s / cycle | 0.06 | 向上 |
| 右 | x: 82% | 8s / cycle | 0.08 | 向上 |

实现：CSS `@keyframes` + 内容复制一份实现无缝循环。

```css
.time-stream {
  position: absolute;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--tp-ink-mute);
  line-height: 2.4;
  animation: stream-up var(--speed) linear infinite;
}
@keyframes stream-up {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
```

> 纯 CSS 动画，不经过 React，不影响性能。

**2. 中央固定时间码**

| 属性 | 值 |
|---|---|
| 内容 | `00:00:02:00` |
| 字体 | Fraunces, 600 |
| 字号 | 13cqw（约 50px） |
| 颜色 | tp-accent |
| **Animate** | **逐位 stagger flip-in** |

```tsx
<Animate
  enterAnimation="flip"
  stagger={{ each: 100 }}
  timeline={{ delay: 400 }}
>
  {'00:00:02:00'.split('').map((ch, i) => (
    <span key={i} className="mono">{ch}</span>
  ))}
</Animate>
```

> 逐位 flip-in——像翻页时钟的机械翻牌，每一格"啪"地翻过来。

**3. 进度环**（围绕中央时间码）

- SVG 圆环，stroke tp-accent at 20% opacity
- stroke-dasharray 映射进度
- **Animate**：custom variant 控制 `pathLength`（Framer Motion SVG 属性）

```tsx
<Animate
  enterAnimation={{
    initial: { pathLength: 0, opacity: 0 },
    animate: { 
      pathLength: 1, 
      opacity: 1,
      transition: { duration: 2.2, ease: [0.16, 1, 0.3, 1] }
    }
  }}
  timeline={{ waitFor: 'timecode-center' }}
>
  <motion.circle
    cx="50%" cy="50%" r="38cqw"
    fill="none"
    stroke="var(--tp-accent)"
    strokeWidth="1"
    strokeOpacity="0.2"
  />
</Animate>
```

**4. 标签 — `SMPTE TIME CODE`**
- mono, 9px, tp-ink-mute, letter-spacing 0.25em
- `fade-in`, waitFor 时间码

**5. 底部信息**
- `SCROLL DISTANCE = TIME`
- `1ms = 1px`
- mono, xs
- `fade-in`

**6. 底部刻度条**
- 水平细线，20 个等距刻度
- 一个 accent 高亮标记随拖拽进度移动
- 刻度 stagger `scaleY: 0 → 1`
- 标记位置：`left: ${progress * 100}%`

---

### Scene 04 — 定格（Cut）

**核心创意**：极简收尾。像电影结束时的黑场，只有一个大字 `CUT`，然后缓缓亮起结束信息。

**视觉**：`#0d0b09`。

#### 布局

```
┌─────────────────────────────────────┐
│ ● REC  00:00:03:00          25 FPS  │  ← REC 点变灰 solid
├─────────────────────────────────────┤
│                                     │
│                                     │
│              CUT                    │  ← 视觉中心，巨大
│           ───────                   │  ← accent 细线
│                                     │
│            THE END                  │
│                                     │
│    [Back to home]  [Read docs]      │  ← 按钮组
│                                     │
│                                     │
├─────────────────────────────────────┤
│ ◖◖◖ ◖◖◖ ◖◖◖ END ◖◖◖ ◖◖◖           │  ← 底部胶片齿孔条
└─────────────────────────────────────┘
```

#### 元素清单

**1. Header HUD**
- REC 点停止 pulse，变为 solid gray（`tp-ink-mute`）
- 时间码 `00:00:03:00`

**2. 主文字 — `CUT`**

| 属性 | 值 |
|---|---|
| 字体 | Fraunces, 600 |
| 字号 | 18cqw（约 70px） |
| 颜色 | tp-ink |
| **Animate** | **组合动画**：`blur-in` → `zoom-in` sequential |

```tsx
<Animate
  enterAnimation={{
    animations: ['blur-in', 'zoom-in'],
    mode: 'sequential',
    delay: [0, 200]
  }}
  duration={{ enter: 1200 }}
>
  <h1 className="cut-title">CUT</h1>
</Animate>
```

> 先模糊（像镜头失焦），再推近清晰（像重新对焦），最后定格。这是全片最后的视觉动作。

**3. accent 细线**
- 1px，tp-accent，宽度 12cqw
- `scaleX: 0 → 1`，waitFor `CUT`

**4. `THE END`**
- mono, 10px, tp-ink-mute, letter-spacing 0.35em
- `fade-in`, waitFor 细线

**5. 按钮组**

| 按钮 | 样式 | Animate |
|---|---|---|
| Back to home | ghost：border 1px tp-rule，text tp-ink-soft | `slide-up` |
| Read docs | primary：bg tp-accent，text tp-bg | `slide-up` |

```tsx
<Animate
  enterAnimation="slide-up"
  stagger={{ each: 100 }}
  timeline={{ waitFor: 'the-end' }}
>
  <Link className="btn btn--ghost" to="/">Back to home</Link>
  <Link className="btn btn--primary" to="/docs">Read docs</Link>
</Animate>
```

> 按钮样式沿用现有 `.btn` 体系，但适配暗调（ghost 边框更淡，primary 用琥珀金）。

**6. 底部胶片齿孔条**
- 12 个齿孔水平排列，其中几个标 `END`
- stagger `fade-in`，each 80ms

---

## 五、排版体系（暗调特调）

### 字号刻度（drag viewport，container-type: inline-size）

```
--tp-text-2xs: clamp(8px,  2.0cqw, 11px)   /* 帧号、刻度标签 */
--tp-text-xs:  clamp(10px, 2.5cqw, 13px)   /* slate、eyebrow、HUD */
--tp-text-sm:  clamp(12px, 3.0cqw, 16px)   /* 副标题、节点标签 */
--tp-text-md:  clamp(16px, 4.0cqw, 22px)   /* 正文、参数值 */
--tp-text-lg:  clamp(24px, 6.5cqw, 40px)   /* Scene 标题 */
--tp-text-xl:  clamp(36px, 10cqw, 64px)    /* 主标题、CUT */
--tp-text-2xl: clamp(48px, 16cqw, 120px)   /* 中心时间码、01 */
```

### 间距刻度

```
--tp-space-1: clamp(2px,  0.5cqw, 4px)
--tp-space-2: clamp(4px,  1.0cqw, 8px)
--tp-space-3: clamp(8px,  1.8cqw, 14px)
--tp-space-4: clamp(12px, 2.8cqw, 20px)
--tp-space-5: clamp(18px, 4.2cqw, 32px)
--tp-space-6: clamp(24px, 5.8cqw, 48px)
--tp-space-7: clamp(36px, 8.0cqw, 72px)
```

---

## 六、Animate 特性使用总表

| 特性 | 使用位置 | 具体做法 |
|---|---|---|
| **waitFor** | Scene 01 全链 / Scene 02 节点链 | 建立精确的级联时序依赖，节点 2 等节点 1 完成 |
| **stagger** | Scene 01 刻度(60个) / 时间码(11位) / 装饰 | 批量错峰，each 28~100ms |
| **stagger** | Scene 02 节点标签 / Scene 04 齿孔 | 级联揭示 |
| **infiniteAnimation** | Scene 01 REC 点(pulse) / DRAG 提示(float) | 持续氛围动画 |
| **custom variant** | Scene 01 内环(scale-grow) / 指针(rotate) | 精确控制 transform + ease |
| **custom variant** | Scene 02 光点(x-slide) / Scene 03 进度环(pathLength) | SVG/特殊属性动画 |
| **preset combo** | Scene 01 标题(blur-in→slide-up sequential) | 组合入场：先对焦再滑入 |
| **preset combo** | Scene 01 中心 01(blur-in→zoom-in sequential) | 先模糊再推近 |
| **preset combo** | Scene 04 CUT(blur-in→zoom-in sequential) | 高潮收尾：失焦→定格 |
| **duration/delay** | 所有元素 | 精确控制节奏，前密后疏 |
| **Position** | 所有装饰元素（齿孔、标记、代码片段） | 精确定位在四角的"取景器标记" |
| **exitAnimation** | Scene 间切换 | 当前 Scene exit 时元素 fade-out，为下一幕让路 |

---

## 七、拖拽交互美学（全局）

| 交互 | 效果 | 实现 |
|---|---|---|
| **拖拽中** | 当前 Scene 整体 opacity 0.92，营造"被拉动"的沉重感 | `useTransform(progress, [0,0.5,1], [1,0.92,1])` |
| **拖拽中** | 背景有极微弱的横向位移（视差），像暗房里的幻灯片被拉动 | `useTransform(progress, [0,1], ['-1%', '1%'])` |
| **释放** | 过渡动画使用 `transitionDuration: 720` + spring 缓动，不是线性 | 框架内置 |
| **跨 Scene** | 上一 Scene 的 exit 和下一 Scene 的 enter 有 120ms 重叠，避免黑场 | 框架内置 drag 切换逻辑 |

---

## 八、移动端特调

| 特调项 | 桌面 | 手机（≤430px） |
|---|---|---|
| 显影盘直径 | 65cqw | 82cqw（更大，更震撼） |
| 刻度数 | 60 | 30（每 2 帧一格，避免过密） |
| 节点排列 | 水平 5 个 | 垂直 5 个（y 轴堆叠） |
| 标题字号 | 10cqw | 12cqw |
| 时间码字号 | 13cqw | 15cqw |
| 底部提示 | 底部居中 | 上移 20px，避拇指 |
| 背景流动层 | 3 列 | 2 列（去中列） |
| 按钮触控目标 | 44px | 48px |
| 拖拽反馈 | 刻度 scale 1.08 | 刻度 scale 1.15（更明显） |

---

## 九、性能热路径自检

| 检查项 | 方案 | 风险 |
|---|---|---|
| 60 刻度 stagger | 框架原生 stagger，一次性入场，不持续 | 无 |
| 时间码自增 | `requestAnimationFrame` + ref 直写 | 无 |
| REC pulse / float | CSS `animation`，class toggle | 无 |
| 背景流动层 | CSS `@keyframes`，纯 GPU | 无 |
| 拖拽视差 | `useTransform(progress, ...)` | 无 |
| 刻度高亮 | `useTransform` 映射 scale/opacity | 无 |
| 指针旋转 | `useTransform` 映射 rotate | 无 |
| 进度环 | Framer Motion SVG `pathLength` | 无 |

**结论：零每帧 setState，零每帧 useMemo 失效，零 layout thrashing。**

---

## 十、去 AI 味终审

| 检查项 | 状态 |
|---|---|
| 无「智能」「AI」「助手」「推荐」等词 | ✅ 全部使用电影工业术语 |
| 无抽象数据可视化 | ✅ 无刻度盘/饼图/折线，只有实体钟表 |
| 无渐变 blob / 流体背景 | ✅ 纯暗调 + 细线 + 几何 |
| 无玻璃拟态堆叠卡片 | ✅ 无卡片，全屏沉浸式 |
| 无聊天气泡 / 对话框 | ✅ 无任何对话式 UI |
| 无「开始体验」等空洞 CTA | ✅ 操作提示是具体动作 `DRAG ↑↓` |
| 有手工质感 | ✅ 手调 stagger 节奏、不等高元素、有机排列 |
| 有工业术语 | ✅ SMPTE、FPS、ISO、TAKE、ROLLING、CUT |
| 有情绪起伏 | ✅ 暗调神秘(01) → 编排节奏(02) → 流动高潮(03) → 极简定格(04) |
| 有物理隐喻 | ✅ 钟表、胶片、齿孔、剪辑台、暗房 |

---

方案完。
