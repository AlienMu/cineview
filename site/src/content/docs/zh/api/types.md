---
title: Types
eyebrow: API REFERENCE
---

类型字典：全部回调 Detail 载荷逐字段表、`CineViewErrorCode` 全码表（含可恢复性与 `preventDefault` 语义）、跨组件共享类型简条。事实源为 `src/types/index.ts`（公共出口经 `src/public-api.ts`）。

## 回调 Detail 载荷

九个载荷类型覆盖全部 14 个框架回调。回调本身的触发时机与互斥关系见 [CineView API](/docs/cineview-api) 与 [Callbacks 深度页](/docs/callbacks)。

### SceneChangeDetail

`onSceneWillChange` / `onSceneDidChange`（通用）的载荷。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `fromIndex` | `number` | 切换前场景下标。 |
| `toIndex` | `number` | 切换后场景下标。 |
| `direction` | `'forward' \| 'backward' \| null` | 切换方向；无方向语义时（如首场景初始化）为 `null`。 |

### DragDetail

`onDragProgress` / `onDragCancel`（drag 专属）的载荷。注意没有独立的 `DragCancelDetail`——取消复用本类型。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sceneIndex` | `number` | 拖拽起始场景下标。 |
| `progress` | `number` | 拖拽进度（有符号，方向决定正负）。 |
| `direction` | `'forward' \| 'backward' \| null` | 拖拽方向；方向未决时为 `null`（对比 `DragStartDetail.direction` 必有值）。 |

### DragStartDetail

`onDragStart`（drag 专属）的载荷。结构上是 `DragDetail` 去掉可空的 `direction` 换成必填——起始时刻方向已决。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sceneIndex` | `number` | 拖拽起始场景下标。 |
| `progress` | `number` | 起始时进度。 |
| `direction` | `'forward' \| 'backward'` | **必填**。首个方向合格位移取得所有权时已判定。 |

### DragBlockedDetail

`onDragBlocked`（drag 专属）的载荷——越界方向的拖拽被阻挡。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `fromIndex` | `number` | 被阻挡时所在场景下标。 |
| `targetSceneIndex` | `number` | 越界目标（首场景再往前 / 末场景再往后）的下标。 |
| `direction` | `'forward' \| 'backward'` | 被拒的越界方向。 |

### DragCommitDetail

`onDragCommit`（drag 专属）的载荷。结构上是 `DragDetail` 加三个字段。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sceneIndex` | `number` | 提交前场景下标。 |
| `progress` | `number` | 松手时进度。 |
| `direction` | `'forward' \| 'backward' \| null` | 提交方向。 |
| `targetSceneIndex` | `number` | 提交目标场景下标。 |
| `elapsedMs` | `number` | 本次拖拽手势总时长（ms）。 |
| `timelineDurationMs` | `number` | settle 动画的时间轴预算（ms）。 |

### ZoneDetail

`onZoneEnter` / `onZoneLeave`（scroll 专属）的载荷。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `zoneId` | `string` | zone 标识（`scroll.zoneId`，缺省回落 `sceneId`）。 |
| `sceneIndex` | `number` | 声明该 zone 的场景下标。 |

### ZoneProgressDetail

`onZoneProgress`（scroll 专属）的载荷。结构上是 `ZoneDetail` 加 `progress`。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `zoneId` | `string` | zone 标识。 |
| `sceneIndex` | `number` | 声明该 zone 的场景下标。 |
| `progress` | `number` | zone 内进度 `0..1`（真实滚动 px 的纯函数，`1ms = 1px`）。 |

### SceneVisibilityDetail

`onSceneVisibilityChange`（scroll 根级）与 `Scene.callbacks.onVisibilityChange`（Scene 级）共用的载荷。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sceneIndex` | `number` | （可选）场景下标——根级聚合路径携带；Scene 声明式路径下可缺省。 |
| `visible` | `boolean` | 是否在视口内。 |
| `progress` | `number` | 场景可视进度 `0..1`。 |

### CineViewErrorDetail

`onError`（通用）的载荷。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | `CineViewErrorCode` | 错误码联合（8 个，见下表）；对 `code` 做 switch 可获得穷尽性检查。 |
| `message` | `string` | 人读错误信息。 |
| `context` | `Record<string, unknown>` | （可选）错误上下文（如 `FIRST_SCENE_TIMEOUT` 携带 `sceneIndex`/`timeoutMs`/`loadedCount`/`totalCount`；`IMAGE_LOAD_FAILED` 携带 `url`）。 |
| `preventDefault` | `() => void` | （可选）仅在**可恢复**错误上存在。调用即接管处理、抑制框架默认回退；不调用则框架执行默认回退。 |

## CineViewErrorCode 全码表

| 错误码 | preventDefault | 语义与未接管时的默认行为 |
| --- | --- | --- |
| `NO_SCENES` | scroll 根有；drag 根无 | CineView 没有任何 Scene 子节点。无 Scene 可渲染（作者错误）；scroll 根未接管时开发模式另有 console 告警。 |
| `IMAGE_LOAD_FAILED` | 无 | 预加载图片失败；`context.url` 指认失败的地址。后台队列继续，不阻塞其余资源。 |
| `FIRST_SCENE_TIMEOUT` | 有 | 首屏优先资源超出 `modes.drag.firstSceneTimeout`（默认 3000ms）未结算。默认回退：框架把首场景**静态落位**（不经入场动画直接就位）；`preventDefault()` 接管后可自绘重试 UI。`context` 携带 `sceneIndex`/`timeoutMs`/`loadedCount`/`totalCount`。 |
| `INVALID_ANIMATION` | 无 | 动画声明非法：`waitFor` 指向不存在的 `animateId`、未知预设名、`enterAnimation` 与 `infiniteAnimation` 都未提供，或在 scrub 轨上传入了手动控制 ref（被上报并忽略）。 |
| `CIRCULAR_DEPENDENCY` | 无 | `waitFor` 链存在循环。 |
| `INVALID_COMPONENT_HIERARCHY` | 重复 scroll zoneId 时有；重复 animateId 时无 | 组件树作者错误。重复 `animateId` 为普通上报；重复 `scroll.zoneId` 为可恢复上报（`context` 携带 `reason: 'duplicate-scroll-zone'`/`zoneId`/`ownerSceneIndex`/`rejectedSceneIndex`），默认回退为首个声明者胜出 + 开发模式 console 告警。 |
| `INVALID_DRAG_CONFIG` | 无 | drag 的 `unit` / `scale` / `enabled` 配置非法。框架**自动换用安全默认并继续**（`enabled` 非法回落 `true`），不中断运行。 |
| `ANIMATION_ASSET_LOAD_FAILED` | 无 | 动画预设依赖的资源（如 Lottie/图片类资产）加载失败；可在消费侧重试。 |

## 共享类型简条

### AnimationType

`AnimationType = PresetAnimation | CustomAnimation | ComposedAnimation`——预设名、自定义 variant、组合动画（sequential / parallel）三选一。`enterAnimation` / `exitAnimation` / `infiniteAnimation`（`Animate`、`AnimateVideo`、`Scene.transition`）都用它。组合编排见 [自定义与组合](/docs/custom)。

### PresetAnimation

43 个预设名的字符串联合（fade / slide / zoom / rotate / flip / bounce / blink / shake / blur / elastic / special 十一族）。全目录与视觉效果见 [预设动画](/docs/presets)。

### AnimateTimeline

`useAnimateTimeline()` 的返回类型：`mode` / `driver` / `progress` / `signedProgress` / `phase` / `frame` 六个只读字段，后四个为 MotionValue。逐字段说明见 [useAnimateTimeline API](/docs/use-animate-timeline-api)。

### ScrollTimelineState（内部）

scroll 接管 zone 的时间轴状态快照：`phase`（`SceneTimelinePhase` 五态：`before | enter | hold | exit | after`）+ `enterProgress` / `exitProgress` / `sceneProgress` + `rangeStart` / `rangeEnd` / `rangeLength` / `enterLength` / `exitLength`（px 预算）。**未从包出口导出**——消费者侧的对应物是 `useAnimateTimeline()`。

### SceneVariantRecords（内部）

drag / scroll 双驱动共享的编译后 variant 记录：`enterInitial` / `enterAnimate` / `exitTarget` 三字段。arrival 轨刻意保持自己的两字段形态（`{ initial, animate }`）——它没有退场概念。**未从包出口导出**，列于此仅用于理解轨道差异。

## 相关页面

- 各组件字段表 → [CineView](/docs/cineview-api) · [Scene](/docs/scene-api) · [Animate](/docs/animate-api) · [AnimateVideo](/docs/animate-video-api) · [Position](/docs/position-api) · [Container](/docs/container-api) · [Image](/docs/image-api)
- 回调触发时机、互斥关系与零重渲染模式 → [Callbacks 深度页](/docs/callbacks)
