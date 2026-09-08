---
title: CineView
eyebrow: COMPONENTS / CINEVIEW
---

CineView 管理页面中的场景，选择 drag 或 scroll 行为，并设置响应式长度使用的设计稿宽度。通过 ref 可执行导航、刷新布局、预加载资源和读取性能数据。

## Props

`CineViewProps` 是按 `mode` 判别的联合类型：`mode` 缺省即 `'drag'`，callbacks 面随 mode 收窄。

| prop          | 类型                       | 默认              | 说明                                |
| ------------- | -------------------------- | ----------------- | ----------------------------------- |
| `designWidth` | `number`                   | `750`             | 设计稿宽度基准，见 designWidth 小节 |
| `mode`        | `'drag' \| 'scroll'`       | `'drag'`          | drag 分页 / scroll 真实文档流接管   |
| `scrollbar`   | `false \| ScrollbarConfig` | 关闭              | scroll 模式的自绘滚动条             |
| `monitor`     | `boolean`                  | `false`           | 开启性能采样                        |
| `a11y`        | `{ label?: string }`       | label：`'Scenes'` | drag 容器的无障碍名称               |
| `callbacks`   | 随模式确定                 | 无                | 场景、输入与资源通知                |
| `children`    | `ReactNode`                | 必填              | 将 Scene 直接声明在 CineView 下     |

### designWidth

| 字段          | 类型     | 默认  | 说明                                                                                               |
| ------------- | -------- | ----- | -------------------------------------------------------------------------------------------------- |
| `designWidth` | `number` | `750` | 两个方向的数值型设计长度均按 `viewportWidth / designWidth` 换算，锁定区时长仍按 `1ms = 1px` 计算。 |

将其设为设计稿宽度，详见[响应式换算](/docs/05-responsive)。

### drag 专属字段（`mode='drag'` 或缺省时平铺在根级）

| 字段                 | 类型                                               | 默认                      | 说明                                                                                                                 |
| -------------------- | -------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `direction`          | `'x' \| 'y'`                                       | `'y'`                     | 拖拽方向                                                                                                             |
| `transitionDuration` | `number`                                           | `800`                     | `ref.goToScene()` 的时序，手势时序单独计算                                                                           |
| `threshold`          | `{ minVelocity, maxVelocity, minRatio, maxRatio }` | `0 / 1000 / 0.15 / 0.3`   | 提交阈值，详见[手势](/docs/02-gestures)                                                                              |
| `unit`               | `'time' \| 'percent'`                              | `'time'`                  | Scene 元素时间轴的拖拽映射单位                                                                                       |
| `scale`              | `number`                                           | `time: 10` / `percent: 1` | 每拖拽 1% 的映射量，按 `unit` 解释                                                                                   |
| `firstSceneTimeout`  | `number`                                           | `3000`                    | 首屏优先图等待上限（ms）。超时发出 `FIRST_SCENE_TIMEOUT`；不调 `preventDefault()` 时默认回退为静态放置首场景 rest 态 |

### scroll 专属字段（`mode='scroll'` 时平铺在根级）

| 字段          | 类型                    | 默认            | 说明                                     |
| ------------- | ----------------------- | --------------- | ---------------------------------------- |
| `direction`   | `SlideDirection`        | `'y'`           | 滚动方向                                 |
| `zoneTrigger` | `'center-lock'`         | `'center-lock'` | 支持的触发方式                           |
| `sceneSizing` | `'content' \| 'screen'` | `'content'`     | 普通场景按内容确定尺寸，或至少占一个视窗 |
| `enterMargin` | `number`                | `50`            | 可见性入场的默认边距，单位为设计像素     |
| `exitMargin`  | `number`                | `50`            | 可见性退场的默认边距，单位为设计像素     |
| `debug`       | `boolean`               | `false`         | 开启 scroll 参数与布局诊断               |

### scrollbar

滚动条覆盖层，scroll 模式的选配件。传对象启用，传 `false` 关闭。

| 字段              | 类型      | 默认                         | 说明                         |
| ----------------- | --------- | ---------------------------- | ---------------------------- |
| `enabled`         | `boolean` | 传入对象时为 `true`          | 开启或关闭自绘滚动条         |
| `ariaLabel`       | `string`  | `'CineView scroll position'` | 无障碍标签                   |
| `width`           | `number`  | `6`                          | 厚度（px），最小按 4 计      |
| `radius`          | `number`  | `999`                        | 圆角，默认全圆头             |
| `inset`           | `number`  | `0`                          | 距边缘内缩（px）             |
| `trackColor`      | `string`  | `'transparent'`              | 轨道色                       |
| `thumbColor`      | `string`  | `'rgba(255,255,255,0.28)'`   | 滑块色                       |
| `thumbHoverColor` | `string`  | `'rgba(255,255,255,0.42)'`   | 滑块描边色，所有状态下均使用 |
| `autoHide`        | `boolean` | `true`                       | 空闲时自动隐藏               |

主题化示例见 [滚动条主题](/docs/05-scrollbar)。

## 回调

TypeScript 按 `mode` 检查 `callbacks`。例如 drag 不能使用 `onZoneProgress`，scroll 不能使用 `onDragEnd`。先将回调对象保存到变量再传入，也受同一检查约束。

### 公共回调（两种模式都能用）

| 回调             | detail                | 说明                                           |
| ---------------- | --------------------- | ---------------------------------------------- |
| `onReady`        | `api: CineViewRef`    | 挂载后 ref API 可用，不等待资源                |
| `onLoadProgress` | `progress: number`    | 队列请求完成比例，整数 0–100，包含失败的请求   |
| `onSceneEnter`   | `SceneChangeDetail`   | 场景切换通知，手势切换在提交时通知             |
| `onSceneLeave`   | `SceneChangeDetail`   | 场景切换的后续通知，子元素动画此时可能仍在播放 |
| `onError`        | `CineViewErrorDetail` | 错误码、消息、上下文与可选的默认处理控制       |

### drag 专属

| 回调             | detail                                                           | 说明                                                             |
| ---------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| `onDragStart`    | `DragStartDetail` `{ sceneIndex, progress, direction }`          | 仅在首次方向确认的手势取得拖拽权后触发                           |
| `onDragProgress` | `DragDetail` `{ sceneIndex, progress, direction? }`              | 拖拽进行中                                                       |
| `onDragBlocked`  | `DragBlockedDetail` `{ fromIndex, targetSceneIndex, direction }` | 拖拽被拦截（如目标场景禁用）                                     |
| `onDragEnd`      | `DragEndDetail`                                                  | 提交切换，含 `targetSceneIndex / elapsedMs / timelineDurationMs` |
| `onDragCancel`   | `DragDetail`                                                     | 手势取消、归回原场景                                             |

### scroll 专属

| 回调                      | detail                                                       | 说明           |
| ------------------------- | ------------------------------------------------------------ | -------------- |
| `onZoneEnter`             | `ZoneDetail` `{ zoneId, sceneIndex }`                        | 进入锁定区     |
| `onZoneLeave`             | `ZoneDetail`                                                 | 离开锁定区     |
| `onZoneProgress`          | `ZoneProgressDetail`（`ZoneDetail` + `progress`）            | 锁定区进度 0–1 |
| `onSceneVisibilityChange` | `SceneVisibilityDetail` `{ sceneIndex?, visible, progress }` | 场景可见性变化 |

回调写法与 `onError` 处理模式见 [回调总览](/docs/03-callbacks)。

## Ref 方法

```tsx
const ref = useRef<CineViewRef>(null);
<CineView ref={ref} mode="scroll" designWidth={750}>
  ...
</CineView>;
```

| 方法                    | 签名                                                   | 说明                                                                        |
| ----------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `goToScene`             | `(index: number, animated?: boolean) => void`          | 跳到指定场景                                                                |
| `refreshLayout`         | `() => void`                                           | 重新测量布局                                                                |
| `preload`               | `(targets?: CineViewPreloadTarget[]) => Promise<void>` | 预加载。target 为场景索引（number）或 `sceneId`；scroll 下也可匹配 `zoneId` |
| `getCurrentIndex`       | `() => number`                                         | 当前场景索引                                                                |
| `getPerformanceMetrics` | `() => PerformanceMetrics`                             | `{ fps, avgFrameTime, memoryUsage?, bundleSize }`                           |

这些方法在两种模式中都存在。挂载前需对 `ref.current` 判空，各个方法本身无需可选调用。

`goToZone(zoneId, { align?: 'center', animated?: boolean })` 是 scroll 专属方法，在通用 ref 类型中为可选字段。scroll 应用可以使用 `CineViewScrollRef`，其中 `goToZone` 为必填字段：

```tsx
const ref = useRef<CineViewScrollRef>(null);
ref.current?.goToZone('intro-seq', { align: 'center' });
```

## 错误码

`onError` 接收 `CineViewErrorCode` 字符串联合类型。需要穷尽处理时，使用 `never` 检查。部分错误提供 `preventDefault`，可调用 `detail.preventDefault?.()` 取消默认处理，并显示应用自己的界面。

| code                          | 触发                                          | 恢复机制                                          |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------- |
| `EMPTY_SCENES`                | CineView 中没有 Scene，或 Scene 没有内容      | 添加所需内容                                      |
| `IMAGE_LOAD_FAILED`           | drag 模式中的队列资源加载失败                 | 处理资源失败                                      |
| `FIRST_SCENE_TIMEOUT`         | 首屏资源等待超时                              | 可调用 `preventDefault`；否则将首场景显示为完成态 |
| `INVALID_ANIMATION`           | 依赖目标缺失、驱动不兼容，或手动控制不受支持  | 修正报告的动画配置                                |
| `CIRCULAR_DEPENDENCY`         | `after` 链存在循环                            | 无                                                |
| `INVALID_COMPONENT_HIERARCHY` | `animateId` 或 scroll 锁定区标识重复          | 无                                                |
| `INVALID_DRAG_CONFIG`         | drag 的 `unit` / `scale` / `enabled` 配置非法 | 可恢复                                            |
| `ANIMATION_ASSET_LOAD_FAILED` | 动画预设资源加载失败                          | 可重试                                            |

## 入口与包体积

ES 模块打包器使用包含两套引擎的 `cineview`。`cineview/drag` 和 `cineview/scroll` 子路径支持 CommonJS，并分别导出对应的 props 类型。应用提供 peer 运行时后，可通过脚本加载独立的 UMD 文件。详见[安装](/docs/02-installation)。

## 相关页面

- [Scene](/docs/02-scene)：场景内容、布局与转场
- [双模式引擎](/docs/01-modes)：drag / scroll 的语义差异
- [响应式换算](/docs/05-responsive)：`designWidth` 如何决定换算

## 迁移对照（旧版旧名 → 现行名）

<!-- banned-names:begin -->

| 旧写法                              | 现行写法                              |
| ----------------------------------- | ------------------------------------- |
| `config={{ size: 750 }}`            | `designWidth={750}`                   |
| `modes={{ drag, scroll }}` 壳       | 模式专属字段平铺根级，`mode` 判别排除 |
| `performance={{ monitor }}`         | `monitor`                             |
| `timeline.waitFor`                  | `timeline.after`                      |
| `timeline.sceneControlled`          | `timeline.driver: 'scene' \| 'clock'` |
| `visibility.replayOnReenter`        | `visibility.replay`                   |
| `infiniteAnimation`                 | `loopAnimation`                       |
| `Position layer={{ fixed }}`        | `Position fixed`                      |
| `Scene stack.mode / zIndex`         | `layout.overlap` / `layout.zIndex`    |
| `onSceneWillChange`                 | `onSceneEnter`                        |
| `onSceneDidChange`                  | `onSceneLeave`                        |
| `onDragCommit` / `DragCommitDetail` | `onDragEnd` / `DragEndDetail`         |
| `getCurrentScene()`                 | `getCurrentIndex()`                   |
| `NO_SCENES`                         | `EMPTY_SCENES`                        |

<!-- banned-names:end -->
