---
title: drag 布局契约
eyebrow: DRAG / LAYOUT
---

drag 场景按整屏位置导航。场景自身可以小于视窗，但这不会改变页面位置之间的距离。

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

以下样式由框架提供：

| 位置       | 样式                                                      | 后果                                                 |
| ---------- | --------------------------------------------------------- | ---------------------------------------------------- |
| 根容器     | `height: 100vh; min-height: 100vh`                        | 页面固定为一屏高                                     |
| 根容器     | `overflow-x: hidden; overflow-y: hidden`                  | 根容器不滚动                                         |
| 根容器     | `background: '#0d1624'`                                   | 默认内联背景，scroll 默认白色                        |
| 每个场景帧 | `position: absolute; inset: 0; width: 100%; height: 100%` | 场景在一个整屏格子里定位                             |
| 每个场景帧 | `z-index: 10`（当前场景）/ `1`（其余）                    | 跨场景层级由引擎调度管理                             |
| Scene 自身 | `contain: 'layout style'`                                 | 建立层叠上下文，见 [DOM 契约](/docs/06-dom-contract) |

CineView 没有 `className` 或 `style` 属性。外部 CSS 可使用 `.cineview-container` 或 `[data-cineview-container="true"]` 选择器；覆盖内联背景时使用 `!important`。自定义 CSS 的响应式长度可引用 `--cineview-unit`。

`Scene.layout.width` 与 `height` 决定整屏导航位置中的场景内容尺寸。

## 只渲染当前场景与相邻两屏

当前 Scene 与相邻 Scene 保持挂载，更远的场景会卸载。返回时会重新创建本地状态、effect 与动画。需要跨导航保留的状态放在 CineView 外部。

场景身份按数组位置确定，重排或条件插入场景可能改变每个位置对应的实例。

## 被忽略的 prop

**`transition.enterAnimation` / `transition.exitAnimation` 在 drag 下不生效**，开发环境会警告一次：场景级进退场是 scroll 的概念，drag 的页面位移由框架跟手驱动，元素动画交给子 `Animate`。

`transition.exitDuration` 在 drag 中仍影响子元素退场进度的换算。页面位置相同时，值越大，元素的退场进度推进得越多。

`layout.overlap` 不改变 drag 行为。`layout.zIndex` 决定场景帧内部的顺序，场景帧之间的顺序由框架控制。

自绘滚动条仅在 scroll 模式中提供。drag 中的 `scrollbar` 对象仅注入隐藏原生滚动条的样式，宽度和颜色等选项不会产生可见的自绘滚动条。

TypeScript 不允许 drag 使用 scroll 专属根属性，包括 `zoneTrigger`、`sceneSizing`、`enterMargin`、`exitMargin` 和 `debug`。`firstSceneTimeout` 为 drag 专属，scroll 的初始资源等待上限为 3000ms。详见[预加载](/docs/02-preload)。

## 相关页面

- [手势与阈值](/docs/02-gestures)：输入检查、阈值公式、映射单位
- [页面位移与元素时间线](/docs/03-two-track)：两个量各自管什么
- [DOM 与布局契约](/docs/06-dom-contract)：真实 DOM 层级与 z-index 宿主
- [Scene 参考](/docs/02-scene)：`layout` / `transition` 全表
