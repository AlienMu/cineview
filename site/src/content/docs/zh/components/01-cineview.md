---
title: CineView
eyebrow: COMPONENTS / CINEVIEW
---

CineView 是根组件：选择模式引擎（drag 分页 / scroll 文档流接管）、设定统一的设计稿宽度基准、调度资源预加载并暴露命令式 ref。页面上的 Scene 组件均由其统一调度。

## Props

`CineViewProps` 是按 `mode` 判别的联合类型：`mode` 缺省即 `'drag'`，callbacks 面随 mode 收窄。

| prop          | 类型                       | 默认     | 说明                                |
| ------------- | -------------------------- | -------- | ----------------------------------- |
| `designWidth` | `number`                   | `750`    | 设计稿宽度基准，见 designWidth 小节 |
| `mode`        | `'drag' \| 'scroll'`       | `'drag'` | drag 分页 / scroll 真实文档流接管   |
| `scrollbar`   | `false \| ScrollbarConfig` | 无       | 滚动条覆盖层；传 `false` 关闭       |
| `monitor`     | `boolean`                  | 无       | 性能监控开关                        |
| `callbacks`   | 随 mode 判别               | 无       | 见「回调」                          |
| `children`    | `ReactNode`                | 必填     | 只认 `Scene` 子节点                 |

### designWidth

| 字段          | 类型     | 默认  | 说明                                                                                                                                                                                                                     |
| ------------- | -------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `designWidth` | `number` | `750` | 设计稿宽度基准（设计 px）。`scale = viewportWidth / designWidth`，以此为统一计算尺度：坐标与盒模型尺寸均按此比例换算，严格依据屏幕宽度缩放，纵向保持恒定比例不形变。锁定区（locked zone）的时间预算仍按 `1ms = 1px` 映射 |

`designWidth` 不是缩放开关，是设计稿基准。改它等于换一套基准，所有设计 px 的含义随之变化。详见 [响应式换算](/docs/05-responsive)。

### drag 专属字段（`mode='drag'` 或缺省时平铺在根级）

| 字段                 | 类型                                               | 默认                      | 说明                                                                                                                                        |
| -------------------- | -------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `direction`          | `SlideDirection`（`'x' \| 'y'`）                   | 无                        | 滑动方向                                                                                                                                    |
| `transitionDuration` | `number`                                           | `800`                     | **仅程序化导航生效**。手势翻页与回弹固定用引擎内部的 800ms，公共 prop 改不了它；这里只决定 `ref.goToScene()` 之后 `onSceneLeave` 的触发时机 |
| `threshold`          | `{ minVelocity, maxVelocity, minRatio, maxRatio }` | 无                        | 手势阈值，四字段均为可选 number                                                                                                             |
| `unit`               | `'time' \| 'percent'`                              | `'time'`                  | Scene 元素时间轴的拖拽映射单位                                                                                                              |
| `scale`              | `number`                                           | `time: 10` / `percent: 1` | 每拖拽 1% 的映射量，按 `unit` 解释                                                                                                          |
| `firstSceneTimeout`  | `number`                                           | `3000`                    | 首屏优先图等待上限（ms）。超时发出 `FIRST_SCENE_TIMEOUT`；不调 `preventDefault()` 时默认回退为静态放置首场景 rest 态                        |

### scroll 专属字段（`mode='scroll'` 时平铺在根级）

| 字段          | 类型                    | 默认 | 说明                                                                                   |
| ------------- | ----------------------- | ---- | -------------------------------------------------------------------------------------- |
| `direction`   | `SlideDirection`        | 无   | 滚动方向                                                                               |
| `zoneTrigger` | `'center-lock'`         | 无   | 唯一的 trigger                                                                         |
| `sceneSizing` | `'content' \| 'screen'` | 无   | 场景尺寸策略                                                                           |
| `enterMargin` | `number`                | `50` | 可见性条件的全局默认边距（设计 px），可被单个 Animate 的 `visibility.enterMargin` 覆盖 |
| `exitMargin`  | `number`                | `50` | 同上的退场半边                                                                         |

### scrollbar

滚动条覆盖层，scroll 模式的选配件。传对象启用，传 `false` 关闭。

| 字段              | 类型      | 默认                         | 说明                    |
| ----------------- | --------- | ---------------------------- | ----------------------- |
| `enabled`         | `boolean` | 无                           | 开关                    |
| `ariaLabel`       | `string`  | `'CineView scroll position'` | 无障碍标签              |
| `width`           | `number`  | `6`                          | 厚度（px），最小按 4 计 |
| `radius`          | `number`  | `999`                        | 圆角，默认全圆头        |
| `inset`           | `number`  | `0`                          | 距边缘内缩（px）        |
| `trackColor`      | `string`  | `'transparent'`              | 轨道色                  |
| `thumbColor`      | `string`  | `'rgba(255,255,255,0.28)'`   | 滑块色                  |
| `thumbHoverColor` | `string`  | `'rgba(255,255,255,0.42)'`   | 滑块悬停色              |
| `autoHide`        | `boolean` | `true`                       | 空闲时自动隐藏          |

主题化示例见 [滚动条主题](/docs/05-scrollbar)。

## 回调

`callbacks` 随 `mode` 判别：drag 模式下写 `onZoneProgress` 是类型错误，scroll 模式下写 `onDragEnd` 同样报错。inline 字面量和先赋值给变量两条路径都会报（scroll 专属键在 drag 侧被标成可选 `never`），不是运行时静默忽略。

### 公共回调（两种模式都能用）

| 回调             | detail                                                               | 说明                                 |
| ---------------- | -------------------------------------------------------------------- | ------------------------------------ |
| `onReady`        | `api: CineViewRef`                                                   | 运行时就绪，挂载时触发一次           |
| `onLoadProgress` | `progress: number`                                                   | 预加载进度，整数 0-100               |
| `onSceneEnter`   | `SceneChangeDetail` `{ fromIndex, toIndex, direction? }`             | 切换前                               |
| `onSceneLeave`   | `SceneChangeDetail`                                                  | 切换后                               |
| `onError`        | `CineViewErrorDetail` `{ code, message, context?, preventDefault? }` | 集中错误出口，错误码见「错误码」小节 |

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
| `onZoneProgress`          | `ZoneProgressDetail`（`ZoneDetail` + `progress`）            | zone 进度 0-1  |
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

这 5 个方法两种模式都有真实现，是必填，调用点无需 `?.()` 判空。

`goToZone(zoneId, { align?: 'center', animated?: boolean })` 是 scroll 专属的可选方法（drag 没有 zone 概念）。scroll 消费者可用 `CineViewScrollRef`，其中 `goToZone` 是必填：

```tsx
const ref = useRef<CineViewScrollRef>(null);
ref.current?.goToZone('intro-seq', { align: 'center' });
```

## 错误码

`onError` 收到的 `code` 是 `CineViewErrorCode` 联合类型，switch 时带穷尽性检查。可恢复的错误带 `preventDefault` 方法：未调用时执行引擎默认回退策略，调用后交由外部逻辑接管（如渲染自定义重试界面）。

| code                          | 触发                                                     | 恢复机制                                                      |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| `EMPTY_SCENES`                | CineView 没有任何 `Scene` 子节点                         | 无                                                            |
| `IMAGE_LOAD_FAILED`           | 预加载图片失败                                           | 无                                                            |
| `FIRST_SCENE_TIMEOUT`         | 首屏优先资源等待超时（`firstSceneTimeout`，默认 3000ms） | 可恢复，带 `preventDefault`；默认回退为静态放置首场景 rest 态 |
| `INVALID_ANIMATION`           | Animate 的 `after` 指向不存在的组件                      | 无                                                            |
| `CIRCULAR_DEPENDENCY`         | `after` 链存在循环                                       | 无                                                            |
| `INVALID_COMPONENT_HIERARCHY` | 重复 `animateId`，或 scroll zone identity 重复           | 无                                                            |
| `INVALID_DRAG_CONFIG`         | drag 的 `unit` / `scale` / `enabled` 配置非法            | 可恢复                                                        |
| `ANIMATION_ASSET_LOAD_FAILED` | 动画预设资源加载失败                                     | 可重试                                                        |

## 入口与包体积

CineView 运行时按 `mode` 派发，全量入口 `cineview` 同时包含两套引擎。单模式场景下可引入 `cineview/drag` 或 `cineview/scroll` 按模式入口（分别导出 `CineViewDragProps` / `CineViewScrollProps`）。UMD 单文件无法代码拆分，针对浏览器 `<script>` 标签环境建议按需选择对应的单模式包。详见 [安装](/docs/02-installation) 与 [性能](/docs/01-performance)。

## 相关页面

- [Scene](/docs/02-scene)：章节容器
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
