---
title: 预设动画总览
eyebrow: CATALOG
---

CineView 内置 43 个预设动画，分属 11 个类别。预设以字符串名引用，编译期类型检查，按类别惰性加载。

## 预设目录

每个预设所属类别由 `src/animations/presets/index.ts` 的 `animationCategoryMap` 固定；预设名本身是 `src/types/index.ts` 中的 `PresetAnimation` 字符串 union。下表的分类与数量逐一核对自这两处（及各类别模块的导出）。

| 类别 | 预设 | 数量 |
| --- | --- | --- |
| fade | `fade`、`fade-in`、`fade-out` | 3 |
| slide | `slide-up`、`slide-down`、`slide-left`、`slide-right` | 4 |
| zoom | `zoom-in`、`zoom-out`、`scale-up`、`scale-down` | 4 |
| rotate | `rotate`、`rotate-in`、`rotate-out`、`spin` | 4 |
| flip | `flip`、`flip-x`、`flip-y` | 3 |
| bounce | `bounce`、`bounce-in`、`bounce-out` | 3 |
| blink | `blink`、`flash`、`pulse` | 3 |
| shake | `shake`、`shake-x`、`shake-y`、`vibrate`、`jello` | 5 |
| blur | `blur-in`、`blur-out`、`focus-in` | 3 |
| elastic | `elastic`、`rubber-band`、`wobble`、`swing` | 4 |
| special | `heartbeat`、`tada`、`wave`、`roll-in`、`roll-out`、`hinge`、`jack-in-the-box` | 7 |
| **合计** | | **43** |

## 预设名在编译期受检

预设名不是随意的字符串，而是 `PresetAnimation` 字符串 union 的成员；`AnimationType`（即 `enterAnimation` / `exitAnimation` / `infiniteAnimation` 接受的类型）为 `PresetAnimation | CustomAnimation | ComposedAnimation`。写成 `"fade-i"` 这类笔误会先在类型层报错，轮不到运行时。

```tsx
<Animate
  animateId="title"
  enterAnimation="slide-up"
  exitAnimation="fade-out"
  duration={{ enter: 800, exit: 400 }}
>
  <h1>Opening title</h1>
</Animate>
```

同一个名字可用于 enter、exit 与 infinite 三条 lane，每条 lane 各自把名字解析成自己的 `initial` / `animate` / `exit` 变体记录。

## 预设到底是什么

每个预设解析为一个变体记录三元组（`initial`、`animate`、`exit`），**运动放在哪条记录上**决定了它的用途：

- `-in` 形态（如 `fade-in`、`bounce-in`、`roll-in`）把运动放在 `animate`：`initial` 是隐藏态，`animate` 是显影，`exit` 是保持可见的 no-op。它们是入场预设。
- `-out` 形态（如 `fade-out`、`bounce-out`、`roll-out`）互为镜像：`initial`/`animate` 静止不动，运动落在 `exit`。它们是退场预设。
- 中性形态（`fade`、`bounce`、`flip`）两端都有运动，是一个完整的往返。

```tsx
// 'fade-in' as authored in src/animations/presets/fade.ts
{
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 1 },   // holds; 'fade-out' moves the motion here instead
}
```

对 scrub 轨的一个推论：预设可以携带 Framer transition，如 `bounce` 自带弹簧（`type: 'spring', bounce: 0.5`）。在时间驱动轨（visibility、drag arrival）上弹簧按声明播放；在 scrub 轨（scroll 接管、drag 元素轨）上运行时按位置求值、忽略 transition 编排，弹簧预设读起来就是端点间的线性扫动。弹簧类别的灵魂在时间驱动轨；scrub 的入场优先用几何预设（fade/slide/zoom/blur）或显式关键帧。

## 按类别惰性加载

预设不进主包。每个类别独占一个模块（`fade.ts`、`slide.ts`……），首次使用其中任意预设时才以动态 `import()` 拉取，只做淡入淡出与滑动的应用永远不会下载 elastic 模块。

加载协调器（`src/animations/presets/index.ts`）保证：

- **跨根共享**：加载成功的模块与永久失败跨进程级缓存，页面上所有 CineView 实例共用。
- **请求合并**：同一类别的并发请求复用同一个 in-flight promise，不互相竞速。
- **超时**：类别加载超过 3000ms 以 `ANIMATION_ASSET_LOAD_FAILED` 失败。这是**瞬时失败**：不会永久缓存，后续请求可以重试。
- **永久失败**：未知预设名、未知类别、或类别模块里缺该导出，均以 `INVALID_ANIMATION` 失败并永久缓存（缓存清理前同一名字不再重复加载）。

## 失败上报

预设加载失败经 CineView 的 `onError` 回调上报，不会击穿组件树。与预设相关的两个错误码：

| 错误码 | 含义 | 可重试 |
| --- | --- | --- |
| `INVALID_ANIMATION` | 未知预设名（或类别模块缺该导出）。 | 否——永久 |
| `ANIMATION_ASSET_LOAD_FAILED` | 类别 chunk 加载失败或超时。 | 是——瞬时 |

```tsx
<CineView
  mode="scroll"
  callbacks={{
    onError: (detail) => {
      if (detail.code === 'ANIMATION_ASSET_LOAD_FAILED') {
        // A category chunk failed; the next request for that category retries.
      }
    },
  }}
>
  <Scene sceneId="hero">
    <Animate enterAnimation="zoom-in">
      <div>Hero content</div>
    </Animate>
  </Scene>
</CineView>
```

## 如何挑选预设

从目录里选型的两条实践提示：

- **入场与退场的对称性**。很多类别有成对的入场向/退场向形态（`fade-in` / `fade-out`、`bounce-in` / `bounce-out`、`roll-in` / `roll-out`）。`fade`、`bounce` 等中性形态服务于通用 lane；编排级联时，退场请使用镜像的对应形态，让反向回放读起来像有意的收束（级联编排见 waitFor 页）。
- **注意力类预设归 infinite lane**。`blink`、`flash`、`pulse`、`heartbeat`、`tada`、`wave` 等表达持续生命感，请经 `infiniteAnimation` 声明，运行时会把它门控到元素自身 phase 且在视口内才运行；CSS `animation: … infinite` 会在退场中、卸载后照跑，该门控防的就是这种破窗。

```tsx
<Animate
  animateId="rec-dot"
  enterAnimation="fade-in"
  infiniteAnimation={{ animate: { opacity: [1, 0.3, 1], transition: { duration: 1.2, repeat: Infinity } } }}
>
  <span className="rec-dot" />
</Animate>
```

## 各类别适合的场景

目录内可自由混用，下表是编写习惯，不是 API 规则：

| 类别 | 适合 |
| --- | --- |
| fade / slide / zoom / blur | scrub 的入场与退场——纯几何，位置驱动。 |
| rotate / flip | 入场点缀；`spin` 作表盘、胶片盘上的慢速 infinite。 |
| bounce / elastic | 时间驱动轨（visibility、arrival）——弹簧即灵魂。 |
| blink / shake | 注意力与反馈时刻；`vibrate`/`jello` 作短促反馈。 |
| special | 戏剧性节拍——`roll-in`/`hinge` 做有个性的退场，`heartbeat`/`tada`/`wave` 上 infinite lane。 |

一个混用多条 lane 的完整场景，scrub 跨度按真实滚动 px 声明：

```tsx
<Scene sceneId="hero" scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}>
  <Animate
    animateId="hero-bg"
    enterAnimation="zoom-in"
    duration={{ enter: 1600 }}
  >
    <div className="hero-bg" />
  </Animate>
  <Animate
    animateId="hero-title"
    enterAnimation="slide-up"
    exitAnimation="fade-out"
    duration={{ enter: 800, exit: 400 }}
    timeline={{ waitFor: 'hero-bg', delay: 200 }}
  >
    <h1>CineView</h1>
  </Animate>
</Scene>
```

当预设的形状不合用时，下一页讲如何自写自定义变体。
