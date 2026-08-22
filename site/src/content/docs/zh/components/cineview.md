---
title: CineView
eyebrow: ROOT
---

CineView 选择模式引擎、提供设计宽度上下文、调度预加载，并暴露命令式导航。

## Ref API

公共方法始终可用。goToZone 仅 scroll 模式提供，并且是 CineViewScrollRef 的必填项。

```tsx
const ref = useRef<CineViewScrollRef>(null);

ref.current?.goToScene(2, true);
ref.current?.goToZone('sequence', { animated: true });
ref.current?.refreshLayout();
ref.current?.preload(['hero']);
```

## 属性

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
| `scrollbar.autoHide` | `boolean` | `true` | 无交互时自动隐藏。 |
| `callbacks` | `DragModeCallbacks \| ScrollModeCallbacks` | — | 扁平、按 mode 判别的回调面，见下表。 |
| `performance` | `CineViewPerformanceConfig` | `{ monitor: false }` | 仅 `monitor` 一个字段：开启运行时指标采样（`getPerformanceMetrics()` 才返回真实数据）。 |
| `children` | `ReactNode` | `required` | 至少一个 `Scene` 子节点；一个都没有时上报 `NO_SCENES`。 |

### callbacks

通用回调两种模式都接受；drag/scroll 专属回调在另一模式下为 `never`（类型错误）。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `onReady` | `(api: CineViewRef) => void` | — | 通用。运行时就绪时触发一次（跨场景切换不重复触发）。 |
| `onLoadProgress` | `(progress: number) => void` | — | 通用。预加载进度 `0..1`。 |
| `onSceneWillChange` | `(detail: SceneChangeDetail) => void` | — | 通用。场景切换前。 |
| `onSceneDidChange` | `(detail: SceneChangeDetail) => void` | — | 通用。场景切换后。 |
| `onError` | `(detail: CineViewErrorDetail) => void` | — | 通用。错误上报；可恢复错误带 `preventDefault()`。 |
| `onDragStart` | `(detail: DragStartDetail) => void` | — | drag 专属。首个方向合格的位移取得拖拽所有权后触发。 |
| `onDragProgress` | `(detail: DragDetail) => void` | — | drag 专属。拖拽进度。 |
| `onDragBlocked` | `(detail: DragBlockedDetail) => void` | — | drag 专属。越界方向的拖拽被阻挡。 |
| `onDragCommit` | `(detail: DragCommitDetail) => void` | — | drag 专属。松手提交切换。 |
| `onDragCancel` | `(detail: DragDetail) => void` | — | drag 专属。拖拽取消。 |
| `onZoneEnter` | `(detail: ZoneDetail) => void` | — | scroll 专属。进入 zone。 |
| `onZoneLeave` | `(detail: ZoneDetail) => void` | — | scroll 专属。离开 zone。 |
| `onZoneProgress` | `(detail: ZoneProgressDetail) => void` | — | scroll 专属。zone 内进度 `0..1`。 |
| `onSceneVisibilityChange` | `(detail: SceneVisibilityDetail) => void` | — | scroll 专属。场景进出视口。 |

### Ref 方法

前五个方法两种模式下都必定存在（类型必填）；`goToZone` 是 scroll 专属可选。

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `goToScene` | `(index: number, animated?: boolean) => void` | 跳到指定下标的场景。 |
| `refreshLayout` | `() => void` | 重测视口与场景布局。 |
| `preload` | `(targets?: CineViewPreloadTarget[]) => Promise<void>` | 预加载。`number` 为场景下标；`string` 为 `sceneId`（scroll 模式下还可匹配 `scroll.zoneId`）。 |
| `getCurrentScene` | `() => number` | 当前场景下标。 |
| `getPerformanceMetrics` | `() => PerformanceMetrics` | 性能指标快照（需 `performance.monitor` 开启）。 |
| `goToZone` | `(zoneId: string, options?: { align?: 'center'; animated?: boolean }) => void` | scroll 专属可选。scroll 消费者可用 `CineViewScrollRef` 便捷类型取得 `goToZone` 必填的视图。 |
