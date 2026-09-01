---
title: Scene
eyebrow: COMPONENTS / SCENE
---

Scene 是章节容器：CineView 页面由若干 Scene 组成，各 Scene 独立管理其布局边界、层叠关系、进退场转场及关联预加载资源。在 scroll 模式下，配置 `scroll` 属性的 Scene 将声明为一段锁定区（locked zone）。

## Props

| prop         | 类型                                                               | 默认 | 说明                                                   |
| ------------ | ------------------------------------------------------------------ | ---- | ------------------------------------------------------ |
| `sceneId`    | `string`                                                           | 无   | 场景标识，供 `preload`、回调 detail、zoneId 回落等引用 |
| `layout`     | 对象，见 layout 小节                                               | 无   | 布局边界与堆叠                                         |
| `transition` | 对象，见 transition 小节                                           | 无   | 场景级进退场                                           |
| `assets`     | `{ preloadImages?: string[] }`                                     | 无   | 随场景预加载的图片                                     |
| `drag`       | `SceneDragConfig`                                                  | 无   | 场景级拖拽映射，见 drag 小节                           |
| `scroll`     | `{ zoneId?: string; trigger?: 'center-lock' }`                     | 无   | scroll 模式专属；**配了 `scroll` 即声明锁定区**        |
| `callbacks`  | `{ onVisibilityChange?: (detail: SceneVisibilityDetail) => void }` | 无   | `detail = { sceneIndex?, visible, progress }`          |
| 其余         | `HTMLAttributes<HTMLDivElement>`（除 `children`）                  | 无   | 透传到场景根元素                                       |
| `children`   | `ReactNode`                                                        | 必填 | 场景内容                                               |

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

| 字段             | 类型            | 说明                                   |
| ---------------- | --------------- | -------------------------------------- |
| `enterAnimation` | `AnimationType` | 入场动画（预设名 / Custom / Composed） |
| `exitAnimation`  | `AnimationType` | 退场动画                               |
| `exitDuration`   | `number`        | 退场时长（ms）                         |

场景级 `transition` 只有整体进退场语义；逐元素的 delay / after / stagger 时间线是 [Animate](/docs/03-animate) 的职责。

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
| `zoneId`  | `string`        | 回落 `sceneId`，再回落到自动 id | zone 标识      |
| `trigger` | `'center-lock'` | `'center-lock'`                 | 唯一的 trigger |

配置 `scroll` 后，该 Scene 声明为锁定区：一段真实的滚动距离归属于其动画时间轴，跨度按 `1ms = 1px` 换算，内部 Animate 的 `duration` 与 `delay` 毫秒数值直接对应物理滚动像素。反向滚回段内时，进度以 100%→0% 连续倒放。锁定区语义详见 [center-lock](/docs/01-centerlock)。

zone 声明的是时间轴的所有权，不涉及动画样式或坐标。两个 Scene 用同一个 `zoneId` 会产生重复 zone identity，上报 `INVALID_COMPONENT_HIERARCHY`。

## 相关页面

- [CineView](/docs/01-cineview)：根组件与回调
- [双模式引擎](/docs/01-modes)：drag / scroll 下 Scene 的语义差异
- [预加载](/docs/02-preload)：`assets.preloadImages` 排队机制
