---
title: drag 布局契约
eyebrow: DRAG / LAYOUT
---

drag 模式下每个场景都是一张铺满视口的卡片，由框架绝对定位、按整屏步进平移。框架因此替你定下了不少布局，也让一部分你写的 prop 不再生效。

## 场景默认尺寸

| 字段              | drag 默认    | scroll 默认  | 说明                   |
| ----------------- | ------------ | ------------ | ---------------------- |
| `layout.width`    | `'100vw'`    | `'100vw'`    | 两模式相同             |
| `layout.height`   | `'100vh'`    | `'auto'`     | 唯一按模式分叉的默认值 |
| `layout.anchor`   | `'top-left'` | `'top-left'` | 九宫格锚点             |
| `layout.overflow` | `'hidden'`   | `'hidden'`   | 溢出内容被裁掉         |

`height` 那一格是同一段 JSX 在两个模式间搬运时最容易出事的地方：drag 下场景是一屏高的卡片，scroll 下高度交给内容撑开。把 drag 页面改成 scroll 时，原本靠 `100vh` 撑开的场景会塌成内容高度。

九宫格锚点在 drag 下是绝对定位（`top`/`left`/`right`/`bottom`，居中的轴额外补 `translate`）。scroll 下九个值只解析成三种水平 margin，纵向语义整体丢弃，详见 [Scene 参考](/docs/02-scene)。

## 框架写死的样式

这些值没有对应的 prop，改不了：

| 位置       | 样式                                                      | 后果                                                 |
| ---------- | --------------------------------------------------------- | ---------------------------------------------------- |
| 根容器     | `height: 100vh; min-height: 100vh`                        | 页面固定为一屏高                                     |
| 根容器     | `overflow-x: hidden; overflow-y: hidden`                  | 根容器不滚动                                         |
| 根容器     | `background: '#0d1624'`                                   | 深蓝底色去不掉；scroll 侧是 `#ffffff`                |
| 每个场景帧 | `position: absolute; inset: 0; width: 100%; height: 100%` | 场景在一个整屏格子里定位                             |
| 每个场景帧 | `z-index: 10`（当前场景）/ `1`（其余）                    | 跨场景层序不归你管                                   |
| Scene 自身 | `contain: 'layout style'`                                 | 建立层叠上下文，见 [DOM 契约](/docs/06-dom-contract) |

`CineView` 没有 `className` 或 `style` prop。可用的样式接缝是 `.cineview-container` 类、`[data-cineview-container="true"]` 属性选择器，以及最外层包装 div 上的 `--cineview-unit` CSS 变量。

场景的 `layout.width` / `layout.height` 落在 Scene 元素上，但 Scene 位于那个 `inset: 0` 的整屏格子内。所以小于一屏的场景是「在一整屏的格子里居于某处」，你设定的是可见卡片的大小，不是翻页步长。

## 只渲染当前场景与相邻两屏

虚拟化窗口是 `current ± 1`，窗口外的场景不挂载。三个后果：

- 远处场景的 effect 不跑，`useEffect` 里的订阅、计时器、视频都不存在。
- 回到两屏之外的场景是重新挂载：组件 state 归零、动画注册表重建、元素时间轴从 0 开始。
- 场景按数组下标做 React key。条件渲染或重排场景会把实例身份映射到位置上，而不是跟着元素走。

## 被忽略的 prop

**`transition.enterAnimation` / `transition.exitAnimation` 在 drag 下不生效**，开发环境会警告一次：场景级进退场是 scroll 的概念，drag 的页面位移由框架跟手驱动，元素动画交给子 `Animate`。

但同一组里的 `transition.exitDuration` 仍然生效：它参与解析场景过渡时长，而那个时长在退场 scrub 里是分子（`renderProgress × 场景过渡时长`）；除数是元素自己的 `duration.exit`。所以调大 `exitDuration` 会让退场 scrub 走得更快，不是更慢。所以这一组 prop 是「半忽略」，不要当整组无效来记。

**`stack.mode` 在 drag 下完全无效**。它只被 scroll 引擎消费，drag 下不参与任何计算。`stack.zIndex` 落在 Scene 元素上，但跨场景层序由「框架写死的样式」那张表里的场景帧决定。

**`scrollbar` 在 drag 下只注入一段隐藏原生滚动条的 CSS，不渲染任何 rail**。自绘滚动条覆盖层只在 scroll 模式挂载，所以 `width` / `radius` / `trackColor` / `thumbColor` / `autoHide` / `ariaLabel` 在 drag 下全部无效。省略整个 `scrollbar` prop 则什么都不注入。

`*` 在 drag 下同样无效，唯一例外是 `firstSceneTimeout`，它反过来也管 scroll 的冷启动门，见 [预加载](/docs/02-preload)。

## 相关页面

- [手势与阈值](/docs/02-gestures)：输入检查、阈值公式、映射单位
- [页面位移与元素时间线](/docs/03-two-track)：两个量各自管什么
- [DOM 与布局契约](/docs/06-dom-contract)：真实 DOM 层级与 z-index 宿主
- [Scene 参考](/docs/02-scene)：`layout` / `transition` 全表
