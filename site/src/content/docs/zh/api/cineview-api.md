---
title: CineView
eyebrow: API REFERENCE
---

`<CineView>` 是唯一的模式入口：选择 drag / scroll 引擎、提供设计宽度上下文、调度预加载，并暴露命令式导航。本页是全量字段参考；用法与教程见 [CineView 组件指南](/docs/cineview)。

## Props

字段与默认值逐项核对自 `src/types/index.ts`（`CineViewProps`，按 `mode` 判别的联合类型）与引擎实现。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `config` | `CineViewDesignConfig` | `{ size: 750 }` | 设计稿宽度基准（设计 px）。`scale = viewportWidth / size` 是全站唯一换算尺子：认宽不认高，绝不形变。仅 `size` 一个子字段。 |
| `mode` | `'drag' \| 'scroll'` | `'drag'` | 模式引擎选择。`mode` 与 `callbacks` 构成判别联合：向 drag 模式传 scroll 回调（或反之）是类型错误。 |
| `modes.drag.direction` | `'x' \| 'y'` | `'y'` | drag 拖拽轴。 |
| `modes.drag.transitionDuration` | `number` | `800` | 场景切换 settle 动画时长（ms）。 |
| `modes.drag.threshold` | `DragThresholdConfig` | — | 速度→提交阈值的映射。子字段默认：`minVelocity` `0`、`maxVelocity` `1000`、`minRatio` `0.15`、`maxRatio` `0.3`；松手阈值随速度在两个 ratio 间线性插值。 |
| `modes.drag.unit` | `'time' \| 'percent'` | `'time'` | 拖拽进度 → 元素时间轴的映射单位（root 默认，可被 `Scene.drag` 覆盖）。 |
| `modes.drag.scale` | `number` | `10 / 1` | `time` 单位下每 1% 拖拽进度折算的毫秒数（默认 `10`）；`percent` 单位下占该 Scene 编译时间轴的百分比（默认 `1`）。 |
| `modes.drag.firstSceneTimeout` | `number` | `3000` | 首屏优先图片最长等待（ms）。超时上报 `FIRST_SCENE_TIMEOUT`（可 `preventDefault()` 接管，否则框架把首场景静态落位）。 |
| `modes.scroll.direction` | `'x' \| 'y'` | `'y'` | scroll 滚动轴。 |
| `modes.scroll.zoneTrigger` | `'center-lock'` | `'center-lock'` | zone 触发模型（当前唯一取值）。 |
| `modes.scroll.sceneSizing` | `'content' \| 'screen'` | `'content'` | 场景高度语义：内容自然高度或一屏。 |
| `modes.scroll.enterMargin` | `number` | `50` | visibility 闸门的全局默认入场边距（设计 px）；可被单个 Animate 的 `visibility.enterMargin` 覆盖。 |
| `modes.scroll.exitMargin` | `number` | `50` | visibility 闸门的全局默认退场边距（设计 px）；可被单个 Animate 的 `visibility.exitMargin` 覆盖。 |
| `scrollbar` | `false \| ScrollbarConfig` | `false` | scroll 模式的滚动条覆盖层。传对象即启用；缺省或 `false` 关闭。 |
| `scrollbar.enabled` | `boolean` | `true` | 覆盖层开关（`scrollbar` 传对象时才生效）。 |
| `scrollbar.ariaLabel` | `string` | `'CineView scroll position'` | 覆盖层的无障碍标签。 |
| `scrollbar.width` | `number` | `6` | 滚动条厚度（px，下限 `4`）。 |
| `scrollbar.radius` | `number` | `999` | 滚动条圆角（px，下限 `0`）。 |
| `scrollbar.inset` | `number` | `0` | 距滚动容器边缘的内缩（px，下限 `0`）。 |
| `scrollbar.trackColor` | `string` | `'transparent'` | 轨道颜色。 |
| `scrollbar.thumbColor` | `string` | `'rgba(255, 255, 255, 0.28)'` | 滑块颜色。 |
| `scrollbar.thumbHoverColor` | `string` | `'rgba(255, 255, 255, 0.42)'` | 滑块悬停颜色。 |
| `scrollbar.autoHide` | `boolean` | `true` | 无交互时自动隐藏：滚动开始即刻淡入（0.08s），最后一次滚动输入约 120ms 后判定空闲，再延迟 0.15s 以 0.5s 淡出——非对称淡变，兼顾「立即出现」与「驻留缓退」。 |
| `callbacks` | `DragModeCallbacks \| ScrollModeCallbacks` | — | 扁平、按 mode 判别的回调面，见下节三张表。 |
| `performance` | `CineViewPerformanceConfig` | `{ monitor: false }` | 仅 `monitor` 一个字段：开启运行时指标采样（`getPerformanceMetrics()` 才返回真实数据）。 |
| `children` | `ReactNode` | `required` | 至少一个 `Scene` 子节点；一个都没有时上报 `NO_SCENES`。 |

## Callbacks

回调面是**扁平的、按 `mode` 判别的**：`DragModeCallbacks = CineViewCommonCallbacks & CineViewDragCallbacks & { [K in keyof CineViewScrollCallbacks]?: never }`，`ScrollModeCallbacks` 是镜像。因此**向 drag 模式传 scroll 回调、或反过来，都是类型错误**，且交叉排除同时堵住两条赋值路径：inline 对象字面量被 TS 的 excess-property 检查拦下；先提取成变量再传的写法靠 `?: never` 兜住（变量不受 excess-property 检查）。

三张表共 14 个字段。所有 `detail` 载荷的逐字段说明见 [类型字典](/docs/types)。

### 通用回调（两种模式都接受）

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `onReady` | `(api: CineViewRef) => void` | — | 运行时就绪时触发**一次**（跨场景切换不重复触发）。drag 侧等首场景入场驱动权就绪；scroll 侧等首屏 `priorityComplete` 冷启动门控（含首屏优先媒体）通过。 |
| `onLoadProgress` | `(progress: number) => void` | — | 预加载进度 `0..1`。每有一张图片**结算**（成功或失败）就触发一次，无尾随 debounce；`progress = 已结算数 / 总数`。`onReady` 等的是首屏优先批的 `priorityComplete`，不是本回调走到 1。 |
| `onSceneWillChange` | `(detail: SceneChangeDetail) => void` | — | 场景切换**前**触发，载荷含 `fromIndex` / `toIndex` / `direction`。 |
| `onSceneDidChange` | `(detail: SceneChangeDetail) => void` | — | 场景切换**后**触发，载荷同上。 |
| `onError` | `(detail: CineViewErrorDetail) => void` | — | 错误上报。可恢复错误的载荷带 `preventDefault()`——调用即接管处理、抑制框架默认回退；不调用则框架执行默认回退。全部 8 个错误码的逐码语义见 [类型字典](/docs/types)。 |

### drag 专属回调（仅 `mode="drag"`；scroll 模式下为 `never`）

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `onDragStart` | `(detail: DragStartDetail) => void` | — | **首个方向合格的位移取得拖拽所有权后**才触发——按下的瞬间不触发，走出方向判定后才触发。`DragStartDetail.direction` 必有值（对比 `DragDetail.direction` 可为 `null`）。 |
| `onDragProgress` | `(detail: DragDetail) => void` | — | 拖拽进行中随进度触发，载荷含 `sceneIndex` / `progress` / `direction`。 |
| `onDragBlocked` | `(detail: DragBlockedDetail) => void` | — | 越界方向的拖拽被**阻挡**（首个场景继续往前拖、末个场景继续往后拖）。与 `onDragCancel` 互斥：被拒 ≠ 取消——blocked 后手势仍在继续，cancel 意味着手势终止且不提交。 |
| `onDragCommit` | `(detail: DragCommitDetail) => void` | — | 松手且通过速度/位移阈值，提交场景切换。载荷含 `targetSceneIndex` / `elapsedMs` / `timelineDurationMs`。与 `onDragCancel` 二选一，绝不连发。 |
| `onDragCancel` | `(detail: DragDetail) => void` | — | 拖拽被取消（未过阈值即松手、或被程序化导航打断）。与 `onDragCommit` 互斥。 |

### scroll 专属回调（仅 `mode="scroll"`；drag 模式下为 `never`）

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `onZoneEnter` | `(detail: ZoneDetail) => void` | — | 进入一个 scroll 接管 zone。与 `onZoneLeave` 严格配对：反向重入时先 leave 旧 zone 再 enter 新 zone（或重 enter 同一 zone，视滚动方向与 zone 边界）。 |
| `onZoneLeave` | `(detail: ZoneDetail) => void` | — | 离开一个 scroll 接管 zone，载荷携带刚离开的 `zoneId` / `sceneIndex`。 |
| `onZoneProgress` | `(detail: ZoneProgressDetail) => void` | — | zone 内进度 `0..1`，随滚动逐帧触发。高频回调：不要在里面对 progress 做 `setState`——用 MotionValue 出口（`useAnimateTimeline()`）或在回调内做命令式更新，零重渲染模式见 [Callbacks 深度页](/docs/callbacks)。 |
| `onSceneVisibilityChange` | `(detail: SceneVisibilityDetail) => void` | — | 场景进出视口。与 `Scene.callbacks.onVisibilityChange` **同载荷**（`SceneVisibilityDetail`），但触发源不同：这里是根级聚合，覆盖所有 Scene；Scene 上的那个只对该 Scene 触发。 |

## Ref 方法

前五个方法两种模式下都必定存在（类型必填，调用点无需判空）；`goToZone` 是 scroll 专属可选。

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `goToScene` | `(index: number, animated?: boolean) => void` | 跳到指定下标的场景。 |
| `refreshLayout` | `() => void` | 重测视口与场景布局（内容动态变化后调用）。 |
| `preload` | `(targets?: CineViewPreloadTarget[]) => Promise<void>` | 预加载。`number` 为场景下标；`string` 为 `sceneId`（scroll 模式下还可匹配 `scroll.zoneId`）。 |
| `getCurrentScene` | `() => number` | 当前场景下标。 |
| `getPerformanceMetrics` | `() => PerformanceMetrics` | 性能指标快照（需 `performance.monitor` 开启，否则无实时数据）。 |
| `goToZone` | `(zoneId: string, options?: { align?: 'center'; animated?: boolean }) => void` | scroll 专属可选。scroll 消费者可用 `CineViewScrollRef` 便捷类型取得 `goToZone` 必填的视图。 |

```tsx
const ref = useRef<CineViewScrollRef>(null);

ref.current?.goToScene(2, true);
ref.current?.goToZone('sequence', { animated: true });
ref.current?.refreshLayout();
ref.current?.preload(['hero']);
```

## 相关类型

- 全部 9 个回调 Detail 载荷（`SceneChangeDetail` / `DragDetail` / `DragStartDetail` / `DragBlockedDetail` / `DragCommitDetail` / `ZoneDetail` / `ZoneProgressDetail` / `SceneVisibilityDetail` / `CineViewErrorDetail`）的逐字段表 → [类型字典](/docs/types)
- `CineViewErrorCode` 全部 8 个错误码（含可恢复性与 `preventDefault` 语义）→ [类型字典](/docs/types)
- 回调的触发时机、互斥关系与零重渲染模式 → [Callbacks 深度页](/docs/callbacks)
- 预加载管线与 `priorityComplete` 冷启动门控 → [Preload 深度页](/docs/preload)

## FAQ

**为什么传了回调却报类型错误？**
`mode` 与 `callbacks` 是判别联合的两半。`mode="drag"`（或缺省）时只接受通用 + drag 回调，scroll 回调键为 `never`；`mode="scroll"` 镜像。注意交叉排除对「先提取成变量再传」的写法同样生效，不是只拦 inline 字面量。

```tsx
/* OK: callbacks match the declared mode */
<CineView mode="scroll" callbacks={{ onReady, onZoneProgress }}>

/* Type error: onDragCommit is never in scroll mode */
<CineView mode="scroll" callbacks={{ onDragCommit }}>
```

**scroll 模式下怎么让 `goToZone` 不判空？**
用 `CineViewScrollRef` 便捷类型（`goToZone` 在其上必填）：`const ref = useRef<CineViewScrollRef>(null)` 搭配 `mode="scroll"`。受 React forwardRef 单 ref 类型限制，无法靠 `mode` prop 自动推断。

**`getPerformanceMetrics()` 返回的都是 0？**
`performance.monitor` 未开启。该字段默认 `false`，采样有运行时代价，只在需要观测时打开。

**`children` 里放非 Scene 元素会怎样？**
CineView 只识别 `Scene` 子节点。一个 `Scene` 都没有时上报 `NO_SCENES`；夹在中间的非 Scene 子节点不参与场景栈。

