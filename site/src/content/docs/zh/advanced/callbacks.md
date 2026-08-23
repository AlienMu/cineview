---
title: 回调与错误处理
eyebrow: OBSERVABILITY
---

回调按语义时机分组：实时采样、边界、生命周期与错误。本页讲每个回调的语义与触发时机；回调字段与 Detail 载荷的全量表在 API 参考（[/docs/cineview-api](/docs/cineview-api) 的 Callbacks 分节）与载荷字典（[/docs/types](/docs/types)）。

## 边界回调

onReady 对每个挂载的根只触发一次。onSceneWillChange 在有效切换发生前触发。onSceneDidChange 在 render commit 时触发。同一次手势中 onDragCommit 与 onDragCancel 互斥。

## 实时回调

onDragProgress 与 onZoneProgress 在所有者边界处采样，无尾随 debounce，保留终值。

## onLoadProgress 的采样契约

onLoadProgress 在每张资源（图片，以及经预加载管线登记的首屏媒体）settle 的那一刻同步上报——没有尾随 debounce，也没有去重，连续相同的舍入值会重复到达。数值是 **0–100 的整数百分比**（`Math.round(loaded / total * 100)`），不是 0..1；空预加载计划会立刻上报一次 100。

时序上它不参与 onReady：onReady 在挂载后一次性触发，不等任何资源，onLoadProgress 在其后继续跳动。真正消费加载进度的是冷启动门——首屏优先资源全部 settle（失败也算 settle）后 `priorityComplete` 放行首场景入场；超时则发出可恢复的 `FIRST_SCENE_TIMEOUT`。这套门控的完整语义见[冷启动与预加载](/docs/preload)。

```tsx
const [loadPercent, setLoadPercent] = useState(0);

<CineView
  mode="drag"
  callbacks={{
    onLoadProgress: (progress) => setLoadPercent(progress), // low frequency: once per asset, setState is fine
  }}
>
```

与 onZoneProgress 的对照：onLoadProgress 按资源结算触发，频率天然低，进 state 没问题；onZoneProgress 逐帧触发，必须走 ref 投影（见下）。

## onDragStart：所有权边界

按下指针本身不触发任何回调。首个**方向合格移动**——主轴位移达到 1px 且严格大于横轴位移——才会请求手势所有权，onDragStart 只在所有权请求**成功后**触发，载荷 `progress` 恒为 0。每次按压会话至多一次；同一按压中途接管（rush re-grab）不会重复触发。

`DragStartDetail.direction` 必有值（`'forward' | 'backward'`）——这与 `DragDetail` 不同：onDragProgress / onDragCancel 的 `direction` 可为 `null`（progress 恰为 0 时）。把 onDragStart 当作「手势已经合法开始、方向已确定」的唯一可靠信号；被拒的方向不会到达这里，它们走 onDragBlocked。纯点击（无方向合格移动）从头到尾零回调。字段表见 [/docs/cineview-api](/docs/cineview-api)。

## onDragBlocked：被拒不等于取消

onDragBlocked 在所有权请求指向 `Scene.drag.enabled === false` 的目标时触发，载荷为 `{ fromIndex, targetSceneIndex, direction }`（direction 必有值）。每次按压每个方向至多触发一次——同一方向被拒后记入本次按压的去重集合，抬指针清空。

两个容易误判的相邻路径：**物理边界**（首/末场景之外）不触发 onDragBlocked——所有权照常取得、渲染橡皮筋，释放回弹到静息时由 onDragCancel 收尾；目标「未内部就绪」只在 dev 构建打告警，无回调。

被拒与取消的区别一句话：onDragBlocked 表示该方向的所有权**从未被授予**（手势没有开始）；onDragCancel 表示一个**已经取得所有权**的手势未经 commit 回到静息。因此一次按压可以先收到 onDragBlocked（某个方向被拒）、随后反向拖拽成功 commit——两者不互斥，互斥的是 onDragCommit 与 onDragCancel。典型用法是边界提示：

```tsx
const [edgeHint, setEdgeHint] = useState<string | null>(null);

<CineView
  mode="drag"
  callbacks={{
    onDragBlocked: ({ fromIndex, targetSceneIndex }) =>
      setEdgeHint(`No chapter to enter beyond scene ${fromIndex + 1}`),
    onDragStart: () => setEdgeHint(null), // a legal opposite-direction start clears the hint
  }}
>
```

## onZoneEnter 与 onZoneLeave：进出配对

两个回调共用 `ZoneDetail` 载荷（`{ zoneId, sceneIndex }`），在 zone 的 active 布尔**翻转帧**触发：inactive→active 是 onZoneEnter，active→inactive 是 onZoneLeave。对照 onZoneProgress 的逐帧上报，这对回调是 O(阈值穿越) 的——只在翻转那帧到达，不会每帧刷。

active 的判据是「严格在段内」：滚动偏移落在 `(segmentStart + 0.5, segmentEnd - 0.5)` 且进度严格介于两端之间。由此得出反向重入的触发序：段内回滚到自身起点边界时（进度在容差内 snap 到 0）active 翻 false、触发 onZoneLeave；再次严格向内则触发 onZoneEnter。所以同一次滚动会话里，一个 zone 可以产生多对 Enter/Leave——把它们当「穿越边界」事件用，不要假设一进一出。

```tsx
<CineView
  mode="scroll"
  callbacks={{
    onZoneEnter: ({ zoneId }) => telemetry.track('zone:enter', { zoneId }),
    onZoneLeave: ({ zoneId }) => telemetry.track('zone:leave', { zoneId }),
  }}
>
```

## onZoneProgress 的正确读数

onZoneProgress 在 zone 有移动的每一帧都会上报——绝不把它镜像进 state。并发滚动下扛得住的模式：回调身份保持稳定（空依赖）、过滤到你关心的 zone、再经 ref 把数值投影进 DOM。

```tsx
const readoutRef = useRef<ZoneReadoutHandle>(null);

const handleZoneProgress = useCallback((detail: ZoneProgressDetail): void => {
  if (detail.zoneId !== 'demo-scroll-zone') return;
  readoutRef.current?.project(detail.progress);
}, []);
```

`project` 直接写 `style.transform` 与 `textContent`——每帧零重渲染；React 只渲染一次读数外壳。Demo 页的 ZoneReadout 就是这一模式的活例。

## onSceneVisibilityChange：根级的可见性汇聚

onSceneVisibilityChange 与 `Scene.callbacks.onVisibilityChange` 共用同一载荷（`SceneVisibilityDetail`：`sceneIndex?` / `visible` / `progress`，`visible = progress > 0.001`）——事实源只有一个：每个 Scene 自身的可见性计算，scroll 根在装配时把同一份 detail 同时转发给 scene 级回调和根级回调。写一处即可，不要在两层重复挂逻辑；在根级用 `detail.sceneIndex` 过滤目标场景。

两者的差异在触发面：scene 级 `onVisibilityChange` 两种模式都存在（drag 走渲染同步路径，scroll 订阅命令式帧通道、零逐像素子树重渲染）；根级 onSceneVisibilityChange 只在 scroll 模式的回调面存在——类型判别联合会在 drag 模式下直接拒绝这个字段。需要跨场景做全局埋点/懒加载时用根级，单场景内部逻辑用 scene 级。

```tsx
<CineView
  mode="scroll"
  callbacks={{
    onSceneVisibilityChange: ({ sceneIndex, visible }) => {
      if (!visible) return;
      telemetry.track('scene:seen', { sceneIndex });
    },
  }}
>
```

## 错误上报与 dev 告警

onError 收到带类型的 `code`（`CineViewErrorCode` 联合）、message 与 `context` 对象；可恢复的错误额外带 `preventDefault()`。同样的条件在非生产构建下还会向 console 打出 `[CineView]` 前缀的诊断——console 行是回调在开发期的镜像，不是第二个可供解析的通道。生产产物会整体丢弃 console 输出，所以程序化处理一律走 `onError`。错误码逐条与可恢复性标注见 [/docs/types](/docs/types)。
