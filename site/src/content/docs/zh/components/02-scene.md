---
title: Scene
eyebrow: COMPONENTS / SCENE
---

Scene 组织共享布局、转场与预加载资源的内容，需直接声明在 Cineview 内。scroll 模式下，`scroll` 声明锁定区（locked zone），让场景在动画播放期间保持位置。每 1ms 动画时长增加 1px 真实滚动距离；没有参与滚动的入场或退场动画时，不增加动画距离。显式设置 `duration.enter: 0` 的入场仍至少占 1px。

## Props

| prop         | 类型                                                               | 默认 | 说明                                                  |
| ------------ | ------------------------------------------------------------------ | ---- | ----------------------------------------------------- |
| `sceneId`    | `string`                                                           | 无   | `preload` 的目标标识，也是 `scroll.zoneId` 的默认标识 |
| `layout`     | 对象，见 layout 小节                                               | 无   | 布局边界与堆叠                                        |
| `transition` | 对象，见 transition 小节                                           | 无   | 场景级进退场                                          |
| `assets`     | `{ preloadImages?: string[] }`                                     | 无   | 随场景预加载的图片                                    |
| `drag`       | `SceneDragConfig`                                                  | 无   | 场景级拖拽映射，见 drag 小节                          |
| `scroll`     | `{ zoneId?: string }`                                              | 无   | scroll 模式专属；**配了 `scroll` 即声明锁定区**       |
| `callbacks`  | `{ onVisibilityChange?: (detail: SceneVisibilityDetail) => void }` | 无   | `detail = { sceneIndex?, visible, progress }`         |
| 其余         | `HTMLAttributes<HTMLDivElement>`（除 `children`）                  | 无   | 透传到场景根元素                                      |
| `children`   | `ReactNode`                                                        | 必填 | 场景内容                                              |

```tsx
<Scene
  sceneId="hero"
  layout={{
    width: '100%',
    height: '100vh',
    anchor: 'top-center',
    overflow: 'hidden',
    overlap: 'replace',
    zIndex: 1,
  }}
  transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out', exitDuration: 400 }}
  assets={{ preloadImages: ['/hero.jpg'] }}
  scroll={{ zoneId: 'hero-seq' }}
>
  ...
</Scene>
```

### layout

| 字段       | 类型                              | 默认                                 | 说明                                     |
| ---------- | --------------------------------- | ------------------------------------ | ---------------------------------------- |
| `width`    | `number \| string`                | `'100vw'`                            | 场景宽度                                 |
| `height`   | `number \| string`                | drag：`'100vh'`；scroll：`'auto'`    | 内容盒高度；不改变 drag 固定整屏导航高度 |
| `anchor`   | `SceneAnchor`                     | `'top-left'`                         | 九宫格对齐基准                           |
| `overflow` | `'hidden' \| 'visible' \| 'clip'` | `'hidden'`                           | 溢出处理                                 |
| `overlap`  | `SceneStackMode`                  | drag：`'replace'`；scroll：`'cover'` | 新场景替换旧场景，还是覆盖其上           |
| `zIndex`   | `number`                          | 无                                   | 叠放 z 序                                |

drag 场景的导航高度固定为一屏（`100vh`），不能通过 `layout.height` 修改。该字段只改变幕内内容盒，也不会产生原生纵向滚动。数值型 `layout.width` 和 `layout.height` 直接作为 CSS px，不按 `designWidth` 缩放。长内容可使用 scroll 模式或拆成多幕。参见 [drag 场景布局](/docs/01-layout)。

scroll 只使用 `anchor` 的水平对齐位置。`overlap` 在 drag 中不改变切幕行为，`zIndex` 只影响场景帧内部的层级；帧与帧之间的顺序由框架决定。

`SceneStackMode` 取值：`'replace' \| 'cover'`。

九宫格取值：`top-left / top-center / top-right / center-left / center / center-right / bottom-left / bottom-center / bottom-right`。

### transition

| 字段             | 类型            | 说明                                                                |
| ---------------- | --------------- | ------------------------------------------------------------------- |
| `enterAnimation` | `AnimationType` | scroll 模式的整场景入场                                             |
| `exitAnimation`  | `AnimationType` | scroll 模式的整场景退场                                             |
| `exitDuration`   | `number`        | 场景退场时序，单位 ms；drag 中的作用见 [drag 布局](/docs/01-layout) |

Scene 转场作用于整个场景。组合动画提供合并后的属性值，`sequential` 步骤与 `delays` 不会在转场中生成先后阶段。drag 模式忽略 Scene 的入退场动画配置，元素的入退场应配置在 [Animate](/docs/03-animate) 上。

### drag

通过 `drag.unit` 和 `drag.scale` 调整该 Scene 的拖拽距离与动画进度的关系。同时省略这两个字段时，继承 Cineview 配置。声明其中任意一个后，另一个使用该 Scene 的默认值：`unit` 为 `'time'`，`scale` 为 `time: 10` 或 `percent: 1`。

| 字段      | 类型                  | 默认                      | 说明                                  |
| --------- | --------------------- | ------------------------- | ------------------------------------- |
| `enabled` | `boolean`             | `true`                    | 该场景是否可作为拖拽目标              |
| `unit`    | `'time' \| 'percent'` | `'time'`                  | 映射单位                              |
| `scale`   | `number`              | `time: 10` / `percent: 1` | 每拖拽 1% 映射到多少毫秒 / 多少百分比 |

```tsx
<Scene drag={{ unit: 'percent', scale: 1 }}>
  <Animate enterAnimation="slide-up" duration={{ enter: 1200 }}>
    <h2>拖拽查看内容</h2>
  </Animate>
</Scene>
```

示例中，每拖拽视窗跨度的 1%，推进该 Scene 元素时间线的 1%。需要调整手势阈值或处理嵌套交互时，见[手势](/docs/02-gestures)；需要自绘画面时，见 [useAnimateTimeline](/docs/09-use-animate-timeline)。

### scroll

| 字段     | 类型     | 默认                            | 说明       |
| -------- | -------- | ------------------------------- | ---------- |
| `zoneId` | `string` | 回落 `sceneId`，再回落到自动 id | 锁定区标识 |

跟随场景的子元素动画按 `1ms = 1px` 确定锁定区时长预算，反向滚动时进度回退。仅有循环动画的场景没有额外动画行程，详见[锁定区与时长预算](/docs/02-zones-budget)。

每个锁定区使用唯一的 `zoneId`。重复标识会报告 `INVALID_COMPONENT_HIERARCHY`，后声明的场景改为普通滚动内容。

## 相关页面

- [Cineview](/docs/01-cineview)：根组件与回调
- [双模式引擎](/docs/01-modes)：drag / scroll 下 Scene 的语义差异
- [预加载](/docs/02-preload)：声明图片和视频资源
