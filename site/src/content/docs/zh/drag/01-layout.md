---
title: drag 布局契约
eyebrow: DRAG / LAYOUT
---

drag 模式下每个场景均呈现为铺满视窗的卡片容器，由引擎绝对定位并按整屏步长平移切换。引擎由此确立了固定的布局约束，部分在 scroll 模式下生效的属性在此模式下会被自动忽略。

## 场景默认尺寸

| 字段              | drag 默认    | scroll 默认  | 说明                   |
| ----------------- | ------------ | ------------ | ---------------------- |
| `layout.width`    | `'100vw'`    | `'100vw'`    | 两模式相同             |
| `layout.height`   | `'100vh'`    | `'auto'`     | 唯一按模式分叉的默认值 |
| `layout.anchor`   | `'top-left'` | `'top-left'` | 对齐网格基准           |
| `layout.overflow` | `'hidden'`   | `'hidden'`   | 隐藏超出场景边界的内容 |

`height` 配置项是同一段 JSX 在两套模式间迁移时产生布局断层的典型场景：drag 模式下场景默认为整屏高度，scroll 模式下则完全由内部内容自适应撑开。若将 drag 页面直接切换为 scroll 模式，原先依赖 `100vh` 撑满视窗的场景将收缩至内容实际高度。

对齐网格基准在 drag 下是绝对定位（`top`/`left`/`right`/`bottom`，居中的轴额外补 `translate`）。scroll 下九个值只解析成三种水平 margin，纵向语义整体丢弃，详见 [Scene 参考](/docs/02-scene)。

## 引擎内置固定样式

这些值没有对应的 prop，改不了：

| 位置       | 样式                                                      | 后果                                                 |
| ---------- | --------------------------------------------------------- | ---------------------------------------------------- |
| 根容器     | `height: 100vh; min-height: 100vh`                        | 页面固定为一屏高                                     |
| 根容器     | `overflow-x: hidden; overflow-y: hidden`                  | 根容器不滚动                                         |
| 根容器     | `background: '#0d1624'`                                   | 深蓝底色去不掉；scroll 侧是 `#ffffff`                |
| 每个场景帧 | `position: absolute; inset: 0; width: 100%; height: 100%` | 场景在一个整屏格子里定位                             |
| 每个场景帧 | `z-index: 10`（当前场景）/ `1`（其余）                    | 跨场景层级由引擎调度管理                             |
| Scene 自身 | `contain: 'layout style'`                                 | 建立层叠上下文，见 [DOM 契约](/docs/06-dom-contract) |

`CineView` 没有 `className` 或 `style` prop。可用的样式接缝是 `.cineview-container` 类、`[data-cineview-container="true"]` 属性选择器，以及最外层包装 div 上的 `--cineview-unit` CSS 变量。

场景的 `layout.width` / `layout.height` 作用于 Scene 元素自身，但 Scene 始终位于 `inset: 0` 的整屏宿主格内。因此小于视窗尺寸的场景表现为「居于整屏格子内部特定位置」，开发者配置的是可见卡片本身的尺寸，而非整体切屏的步长基准。

## 只渲染当前场景与相邻两屏

虚拟化窗口是 `current ± 1`，窗口外的场景不挂载。三个后果：

- 远处场景的 effect 不跑，`useEffect` 里的订阅、计时器、视频都不存在。
- 回到两屏之外的场景是重新挂载：组件 state 归零、动画注册表重建、元素时间轴从 0 开始。
- 场景按数组下标做 React key。条件渲染或重排场景会把实例身份映射到位置上，而不是跟着元素走。

## 被忽略的 prop

**`transition.enterAnimation` / `transition.exitAnimation` 在 drag 下不生效**，开发环境会警告一次：场景级进退场是 scroll 的概念，drag 的页面位移由框架跟手驱动，元素动画交给子 `Animate`。

但同一组配置中的 `transition.exitDuration` 仍然参与计算：它用于解析场景过渡时长，并在退场插值中作为分子（`renderProgress × 场景过渡时长`），分母为元素自身的 `duration.exit`。因此增大 `exitDuration` 会加快退场插值的推进速率，属于部分生效的属性。

**`stack.mode` 在 drag 下完全无效**。该属性仅被 scroll 引擎消费，drag 模式下不参与任何计算。`stack.zIndex` 作用于 Scene 元素，但跨场景的层叠关系始终由场景帧内置的 z-index 规则裁决。

**`scrollbar` 在 drag 下只注入一段隐藏原生滚动条的 CSS，不渲染任何 rail**。自绘滚动条覆盖层只在 scroll 模式挂载，所以 `width` / `radius` / `trackColor` / `thumbColor` / `autoHide` / `ariaLabel` 在 drag 下全部无效。省略整个 `scrollbar` prop 则什么都不注入。

scroll 专属的根级字段（`zoneTrigger`、`sceneSizing`、`enterMargin`、`exitMargin`）在 drag 根上不是「无效」而是类型排除：写上去无法通过类型检查。反向的 `firstSceneTimeout` 同理只属于 drag，scroll 的冷启动门固定为 3000 毫秒、不读这个字段。见 [预加载](/docs/02-preload)。

## 相关页面

- [手势与阈值](/docs/02-gestures)：输入检查、阈值公式、映射单位
- [页面位移与元素时间线](/docs/03-two-track)：两个量各自管什么
- [DOM 与布局契约](/docs/06-dom-contract)：真实 DOM 层级与 z-index 宿主
- [Scene 参考](/docs/02-scene)：`layout` / `transition` 全表
