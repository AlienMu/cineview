---
title: drag 场景布局
eyebrow: DRAG / LAYOUT
---

drag 模式下，每幕的导航高度固定为一屏（`100vh`），不提供按 Scene 修改导航高度的参数。`Scene.layout.height` 无法改变这个高度或切幕距离。幕内内容的尺寸可以单独布局。

drag 模式下，向上拖动会让当前场景离开、下一幕进入。拖到中间并停住时，两幕会同时出现在画面中；松手后，页面完成切换或回到原位。可在[快速上手](/docs/03-quickstart)的拖拽预览中体验这段过渡。

案例底部显示拖拽距离和停住后松手的结果。先拖到 20%，停住后松手，观察还原；再拖过 30%，停住后松手，观察切换。快速释放可能在 15% 到 30% 之间完成切换，快速反向释放会取消。到达第二页后向下拖动，可返回第一页。标题会移动并淡入，方形会旋转和缩放，时间读数显示它们共同推进到哪里。

## 拖到两幕之间

场景过渡和场景内的元素动画使用同一次手势。下面只声明两个 `Scene`：框架负责两幕的页面位移，第二幕里的 `Animate` 负责标题与说明的出现时间。

```tsx
import { Animate, Cineview, Scene } from 'cineview';

export function DragTransitionExample() {
  return (
    <Cineview mode="drag" direction="y" designWidth={750} unit="percent" scale={1}>
      <Scene sceneId="intro">
        <section style={{ minHeight: '100vh', background: '#f5e8d8' }}>
          <h1>向上拖动，进入下一幕</h1>
        </section>
      </Scene>
      <Scene sceneId="details">
        <section style={{ minHeight: '100vh', background: '#172626', color: '#fff' }}>
          <Animate
            animateId="title"
            enterAnimation={{ initial: { opacity: 0, y: 45 }, animate: { opacity: 1, y: 0 } }}
            duration={{ enter: 600 }}
            timeline={{ delay: 100 }}
          >
            <h1>标题先出现</h1>
          </Animate>
          <Animate
            enterAnimation={{ initial: { opacity: 0, x: 35 }, animate: { opacity: 1, x: 0 } }}
            duration={{ enter: 400 }}
            timeline={{ after: 'title', delay: 100 }}
          >
            <p>说明在标题之后出现。</p>
          </Animate>
        </section>
      </Scene>
    </Cineview>
  );
}
```

拖到两幕中间时，当前场景与目标场景各占一部分画面。这段过渡由相邻 `Scene` 的位置形成，不需要额外的分屏配置。

第二幕的元素时间线共 1200ms：标题在 100ms 开始，持续 600ms；说明等待标题结束，再延迟 100ms，从 800ms 开始。`unit="percent"` 和 `scale={1}` 让拖拽比例对应这段时间线的比例。拖动到一半时，元素时间约为 600ms，标题尚在淡入，说明还未开始。若松手确认切换，剩余动画会继续播放；若取消切换，目标场景会退回初始画面。

`Scene.layout` 控制幕内内容盒的尺寸与对齐方式。两幕之间的过渡仍由整屏导航帧决定。

## 场景默认尺寸

| 字段              | drag 默认    | scroll 默认  | 说明                             |
| ----------------- | ------------ | ------------ | -------------------------------- |
| `layout.width`    | `'100vw'`    | `'100vw'`    | 两种模式相同                     |
| `layout.height`   | `'100vh'`    | `'auto'`     | drag 占满视窗，scroll 随内容增长 |
| `layout.anchor`   | `'top-left'` | `'top-left'` | 内容对齐方式                     |
| `layout.overflow` | `'hidden'`   | `'hidden'`   | 裁切超出场景边界的内容           |

每幕导航高度固定为 `100vh`，不能通过 `layout.height` 改成半屏或长页面。该字段只影响 Scene 内部内容盒，也不会产生原生纵向滚动。建议 Scene 保持默认尺寸，将高度设置在幕内元素上：

```tsx
import { Cineview, Scene } from 'cineview';

export function DragContentLayout() {
  return (
    <Cineview mode="drag">
      <Scene sceneId="compact">
        <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
          <section style={{ height: '60vh' }}>
            <h1>幕内的短内容</h1>
          </section>
        </div>
      </Scene>
      <Scene sceneId="next">
        <h1>下一幕</h1>
      </Scene>
    </Cineview>
  );
}
```

长内容需要原生纵向滚动时，使用 scroll 模式；全屏叙事可拆成多幕。`layout.height` 的数值直接作为 CSS px，不经过 `designWidth` 换算。

`layout.overflow` 默认为 `hidden`。超出 Scene 尺寸的图片、视频和动画都会被裁切。

drag 支持九种对齐位置，包括居中和底部对齐。scroll 只使用其中的左、中、右水平对齐。完整选项见 [Scene 参考](/docs/02-scene)。

## 容器与场景样式

框架提供以下样式：

| 位置       | 样式                                                      | 效果                       |
| ---------- | --------------------------------------------------------- | -------------------------- |
| 根容器     | `height: 100vh; min-height: 100vh`                        | 页面固定为一屏高           |
| 根容器     | `overflow-x: hidden; overflow-y: hidden`                  | 根容器不滚动               |
| 根容器     | `background: '#0d1624'`                                   | 默认背景色                 |
| 每个场景帧 | `position: absolute; inset: 0; width: 100%; height: 100%` | 提供整屏导航位置           |
| 每个场景帧 | `z-index: 10`（当前场景）/ `1`（其余）                    | 当前场景显示在相邻场景上方 |
| Scene 自身 | `contain: 'layout style'`                                 | 建立层叠上下文             |

修改根容器样式时，使用 `.cineview-container` 或 `[data-cineview-container="true"]` 选择器。Cineview 不接受 `className` 或 `style`。

覆盖内联背景需要 `!important`。自定义 CSS 的响应式长度可引用 `--cineview-unit`。元素层级见 [DOM 与布局契约](/docs/06-dom-contract)。

## 当前场景与相邻场景保持挂载

当前 Scene 与相邻 Scene 保持挂载，更远的场景会卸载。返回时会重新创建本地状态、effect 与动画。需要跨导航保留的状态放在 Cineview 外部。

导航顺序按 Scene 的声明位置确定。动态列表应使用稳定的 React `key`；重排仍会改变导航索引。

## 页面移动与元素动画分别配置

drag 的页面位移跟随手势。标题、图片等元素的进退场使用子 `Animate`，视频逐帧定位使用 `AnimateVideo`。详见[页面位移与元素时间线](/docs/03-two-track)。

`Scene.transition.enterAnimation` 与 `exitAnimation` 仅用于 scroll 模式。在 drag 中配置它们会收到开发环境警告。

`transition.exitDuration` 仍影响子元素退场进度的换算。在相同页面位置，值越大，元素退场推进得越多。

`layout.overlap` 不改变 drag 行为。`layout.zIndex` 决定场景帧内部的顺序，场景帧之间的顺序由框架控制。

自绘滚动条仅在 scroll 模式显示。drag 中的 `scrollbar` 对象只隐藏原生滚动条，宽度和颜色选项没有可见效果。

`sceneSizing`、`enterMargin` 和 `exitMargin` 是 scroll 专属根属性，TypeScript 会拒绝在 drag 中使用它们。`debug` 只在 scroll 模式输出布局诊断；性能数据使用 `monitor` 和 `PerfPanel`。

首屏优先资源的等待上限由 `firstSceneTimeout` 控制。资源声明、失败处理与视频加载见[预加载](/docs/02-preload)。

## 相关页面

- [手势与阈值](/docs/02-gestures)：输入检查与拖拽距离换算
- [页面位移与元素时间线](/docs/03-two-track)：拖拽如何推进动画和视频
- [DOM 与布局契约](/docs/06-dom-contract)：元素层级与样式限制
- [Scene 参考](/docs/02-scene)：布局与转场选项
