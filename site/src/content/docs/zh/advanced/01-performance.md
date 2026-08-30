---
title: 性能
eyebrow: ADVANCED / PERFORMANCE
---

CineView 的每帧代价只由两件事决定：多少量的变化不经过 React 渲染管线，以及冷启动就绪判定挡掉多少首帧抖动。这一页讲监控读数的真实含义、每帧量的唯一观测面，以及热路径上的回调。

## 运行时监控

给 CineView 根上传 `monitor` 开启运行时监控，指标通过 ref 读取：

```tsx
const ref = useRef<CineViewRef>(null);

<CineView designWidth={750} monitor ref={ref}>
  {/* ... */}
</CineView>;

const metrics = ref.current!.getPerformanceMetrics();
```

监控就是一个布尔，没有别的配置。它是观测手段，不改变任何动画行为。不开 `monitor` 时 `getPerformanceMetrics()` 仍然可调，但页面上没有任何实例开着监控时它拿不到帧样本，`fps` 与 `avgFrameTime` 会是 `0`。

## 四个指标字段的真相

`getPerformanceMetrics()` 返回 `PerformanceMetrics`。每个字段都有需要注意的地方：

| 字段           | 类型                | 默认/缺省           | 真实含义                                                      |
| -------------- | ------------------- | ------------------- | ------------------------------------------------------------- |
| `fps`          | number              | `0`（无样本时）     | 上限钳 60，120Hz 屏也报 60                                    |
| `avgFrameTime` | number (ms)         | `0`（无样本时）     | 最多 60 帧的均值，不是分位数                                  |
| `memoryUsage`  | number \| undefined | `undefined`         | JS 堆（MB），8 次采样的中位数；非 Chromium 内核为 `undefined` |
| `bundleSize`   | number (KB)         | `0`（无资源条目时） | 页面所有 `.js` / `.mjs` / `.css` 资源之和，不是本库体积       |

三条推论值得记住：

**`fps` 的 60 上限是写死的天花板。** 算式是 `Math.min(Math.max(1000 / avgFrameTime, 0), 60)`（`src/utils/performanceMonitor.ts:101-106`）。高刷屏上真实 90fps 与真实 60fps 读数完全一样，所以 `fps === 60` 只能证明「没掉到 60 以下」，不能证明「跑满刷新率」。

**`avgFrameTime` 不能用于卡顿检测。** 它是最近至多 60 个帧间隔的算术平均（`:44-46`、`:118-123`）。一个 200ms 的长任务混进 59 个 16ms 的帧里，均值只抬到 19ms 左右，看着完全健康。卡顿要看分位数与 long task，那得用浏览器的 Performance 面板或 `PerformanceObserver`，框架的读数给不了。

**`bundleSize` 不是本库体积。** 它遍历 `performance.getEntriesByType('resource')`，把所有代码类资源的字节加起来（`:175-204`），包含你的应用代码、第三方库、CSS，与 CineView 无关的全算进去。而且它在监控 `start()` 时算一次就永久缓存（`:166-173`），之后动态加载的 chunk 不会反映进去。要衡量 CineView 自身的体积，看构建产物而不是这个字段。

## 监控是页面级单例

监控器是一个页面级单例，配引用计数：第一个开了 `monitor` 的 CineView 挂载时启动 rAF（requestAnimationFrame）循环，最后一个卸载时停止（`src/utils/performanceMonitor.ts:217-241`）。

后果是读数是页面级的，不是实例级的。页面上有两个 CineView，它们的 `getPerformanceMetrics()` 返回同一份数据，反映的是整个页面的帧率，无法归因到某一个实例。这是有意的：帧率本身就是页面级属性，一个 rAF 循环也比 N 个便宜。

## 冷启动就绪判定

冷启动时，首屏的优先资源经预加载进入就绪判定：就绪前框架阻塞进场时间线，避免「图没到人先动」的抖动。`AnimateVideo` 的首屏媒体走同一条管线，且要求整段 blob 可 seek 才算就绪。

等待有上限：`firstSceneTimeout` 默认 3000ms。它只在 drag 模式可用，scroll 的冷启动门恒用默认值。超时触发 `FIRST_SCENE_TIMEOUT`（可恢复），默认回退为静态放置首场景的 rest 态；在 `onError` 里调 `detail.preventDefault()` 可拿回控制权自行处理（比如展示重试 UI）。完整回调语义见[回调](/docs/03-callbacks)，预加载配置见[预加载](/docs/02-preload)。

## 每帧走 MotionValue

每帧都在变的量（progress、elapsed、滚动偏移）必须走 `MotionValue`，React state 只留给结构性变化。每帧 `setState` 会放大成全场景子树重渲染，这是叙事页掉帧的第一来源。

框架内已经这么做的：`Animate` 的属性映射由 MotionValue 派生，跟随滚动时不重渲染。你自己写消费方时同样适用：

- 读 progress 用 render-prop 的 `enterProgress`（见 [Animate](/docs/03-animate)）或 `useAnimateTimeline()` 返回的只读 MotionValue（见 [useAnimateTimeline](/docs/09-use-animate-timeline)），更新不经过 React 渲染管线。
- 在 `onDragProgress` / `onZoneProgress` 回调里读值没问题，把值写进 state 才有问题。要驱动 DOM 就用 ref 投影或直接消费 MotionValue。
- 不要另起 `useSpring`/`useTransform` 自行加工这些值：spring 按自己的节奏收尾，不跟随退场进度。

## scroll 下 render 路径拿到的连续量是陈旧的

这不是建议，是结构上的事实。scroll 模式把更新分成两类：React 渲染用的快照，和命令式消费者订阅的逐帧数据。

快照什么时候更新由一次比较决定，而比较刻意把连续量排除在外（`src/components/CineView/ScrollSceneSlot.tsx:74-124` 的 `areScrollSceneRenderSnapshotsEqual`）：`visualViewportOffset`、`zoneState.progressPx`、以及 `sceneProgress` / `enterProgress` / `exitProgress` 都不参与比较。所以这些字段变化不会触发重渲染，render 路径读到的是上一次结构性变化时的值。源码注释直接写了 `the React snapshot is intentionally stale`（`:190-191`）。

这样设计是为了让原生滚动的每一像素都不触发 React 渲染。代价是：**每帧数值只能经两个面观测**：

- `useAnimateTimeline()` 返回的 MotionValue（`progress` / `signedProgress` / `phase`）；
- 根的 `onZoneProgress` 回调。

连续量由独立的数据源（`src/components/runtime/scrollSceneFrameStore.ts`）发布，native scroll controller 是唯一写入方，消费者以订阅方式读取。想在 render 里读 `progressPx` 然后画个数字，会看到它停住不动，那不是 bug。

## 热路径上的两个回调

| 回调                                 | 触发频率          | 去重               |
| ------------------------------------ | ----------------- | ------------------ |
| `Scene.callbacks.onVisibilityChange` | scroll 下逐滚动帧 | 无                 |
| 根的 `onZoneProgress`                | 变化超 0.5px 时   | 有，且端点强制透出 |

`onVisibilityChange` 订阅的是逐帧数据源，每个滚动帧都会调一次，不做任何去重（`src/components/Scene/Scene.tsx:513-543`）。Scene 子树不会因此重渲染（逐帧数据不进 React，这正是它存在的意义），但你的回调体在热路径上：里面做 `setState`、写 DOM、算布局，代价按帧计。要节流就自己节流。

`onZoneProgress` 已经有 0.5px 阈值，而且比较的基线是上次上报值而不是上一帧（`src/components/CineView/useNativeScrollController.ts:96-100`）。基线选上一帧会让每帧移动 0.5px 以内的慢滚永远触发不了回调，选上次上报值就不会。终端的 0 与满值强制透出，所以你不会漏掉「刚好到端」那一帧（`:325-337`）。

## 视频 scrub 与解码帧

`AnimateVideo` 把时间轴位置映射到 `currentTime`，逐帧 seek。片源关键帧稀疏时，每次 seek 都要从最近关键帧长程解码，解码线程被打满就直接掉帧。跟随滚动的片源必须密集关键帧（最好全关键帧）编码，开发期框架会采样 seek 延迟并在中位数超 50ms 时警告。

内存侧的另一半是 `releaseOnLeave`：观众滚远后释放解码帧，回来再回挂。两者的完整规则、阈值与 ffmpeg 命令见[媒体所有权](/docs/06-media-ownership)。

## 包体积

全量入口 `cineview` 同时含 drag 与 scroll 两套引擎，运行时按 `mode` 派发。派发器静态引用两个引擎，所以 ESM 侧只用一种模式也带两套：

```tsx
import { CineView } from 'cineview/drag'; // 只含拖拽引擎，UMD/CJS
import { CineView } from 'cineview/scroll'; // 只含滚动引擎，UMD/CJS
```

按模式入口的可用范围与打包后果见[安装](/docs/02-installation)，模式选型见[选择模式](/docs/04-choosing-mode)。
