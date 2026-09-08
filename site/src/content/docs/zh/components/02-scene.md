---
title: Scene
eyebrow: COMPONENTS / SCENE
---

Scene 组织共享布局、转场与预加载资源的内容，需直接声明在 CineView 内。scroll 模式下，`scroll` 声明锁定区；动画时长预算大于零时，才会增加锁定期间的滚动距离。

## Props

| prop         | 类型                                                               | 默认 | 说明                                                  |
| ------------ | ------------------------------------------------------------------ | ---- | ----------------------------------------------------- |
| `sceneId`    | `string`                                                           | 无   | `preload` 的目标标识，也是 `scroll.zoneId` 的默认标识 |
| `layout`     | 对象，见 layout 小节                                               | 无   | 布局边界与堆叠                                        |
| `transition` | 对象，见 transition 小节                                           | 无   | 场景级进退场                                          |
| `assets`     | `{ preloadImages?: string[] }`                                     | 无   | 随场景预加载的图片                                    |
| `drag`       | `SceneDragConfig`                                                  | 无   | 场景级拖拽映射，见 drag 小节                          |
| `scroll`     | `{ zoneId?: string; trigger?: 'center-lock' }`                     | 无   | scroll 模式专属；**配了 `scroll` 即声明锁定区**       |
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
  scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}
>
  ...
</Scene>
```

### layout

| 字段       | 类型                              | 默认                                 | 说明                                              |
| ---------- | --------------------------------- | ------------------------------------ | ------------------------------------------------- |
| `width`    | `number \| string`                | `'100vw'`                            | 场景宽度                                          |
| `height`   | `number \| string`                | drag：`'100vh'`；scroll：`'auto'`    | 场景高度。scroll 下默认交给内容撑开（自然文档流） |
| `anchor`   | `SceneAnchor`                     | `'top-left'`                         | 九宫格对齐基准                                    |
| `overflow` | `'hidden' \| 'visible' \| 'clip'` | `'hidden'`                           | 溢出处理                                          |
| `overlap`  | `SceneStackMode`                  | drag：`'replace'`；scroll：`'cover'` | 新场景替换旧场景，还是覆盖其上                    |
| `zIndex`   | `number`                          | 无                                   | 叠放 z 序                                         |

`SceneStackMode` 取值：`'replace' \| 'cover'`。

九宫格取值：`top-left / top-center / top-right / center-left / center / center-right / bottom-left / bottom-center / bottom-right`。

### transition

| 字段             | 类型            | 说明                                                                |
| ---------------- | --------------- | ------------------------------------------------------------------- |
| `enterAnimation` | `AnimationType` | scroll 模式的整场景入场                                             |
| `exitAnimation`  | `AnimationType` | scroll 模式的整场景退场                                             |
| `exitDuration`   | `number`        | 场景退场时序，单位 ms；drag 中的作用见 [drag 布局](/docs/01-layout) |

Scene 转场作用于整个场景。drag 模式忽略 Scene 的入退场动画配置，元素的入退场应配置在 [Animate](/docs/03-animate) 上。

### drag

场景级拖拽映射，覆盖根的 `unit` / `scale`。

| 字段      | 类型                  | 默认                      | 说明                                  |
| --------- | --------------------- | ------------------------- | ------------------------------------- |
| `enabled` | `boolean`             | `true`                    | 该场景是否可作为拖拽目标              |
| `unit`    | `'time' \| 'percent'` | `'time'`                  | 映射单位                              |
| `scale`   | `number`              | `time: 10` / `percent: 1` | 每拖拽 1% 映射到多少毫秒 / 多少百分比 |

### scroll

| 字段      | 类型            | 默认                            | 说明           |
| --------- | --------------- | ------------------------------- | -------------- |
| `zoneId`  | `string`        | 回落 `sceneId`，再回落到自动 id | 锁定区标识     |
| `trigger` | `'center-lock'` | `'center-lock'`                 | 唯一的 trigger |

跟随场景的子元素动画按 `1ms = 1px` 确定锁定区时长预算，反向滚动时进度回退。仅有循环动画的场景没有额外动画行程，详见[锁定区与时长预算](/docs/02-zones-budget)。

每个锁定区使用唯一的 `zoneId`。重复标识会报告 `INVALID_COMPONENT_HIERARCHY`，后声明的场景改为普通滚动内容。

## 相关页面

- [CineView](/docs/01-cineview)：根组件与回调
- [双模式引擎](/docs/01-modes)：drag / scroll 下 Scene 的语义差异
- [预加载](/docs/02-preload)：`assets.preloadImages` 排队机制
