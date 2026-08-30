---
title: DOM 与布局契约
eyebrow: CONCEPTS / DOM
---

这一页只回答一个问题：你写的 CSS 为什么不生效。 框架在你的内容外面渲染了若干层包装，每层都带着有语义后果的样式。不知道这棵树的形状，`position: fixed` 与 `z-index` 会以看不出原因的方式失效。

## 实际渲染出的层级

```text
div.cineview-responsive-container        ← 挂 --cineview-unit
└ div.cineview-container[data-cineview-container="true"]
  │   drag: height 100vh, overflow hidden, background #0d1624
  │   scroll: height 100vh, overflow-y scroll, background #ffffff
  └ div[data-scene-index="N"]            ← 每场景一个
    │   drag: position absolute, inset 0, z-index 10（当前）/ 1
    │   scroll: position relative
    │   takeover 场景额外套两层：
    │     div[data-cineview-takeover-shell]   position sticky, overflow hidden, 活跃时 z-index 30
    │     div[data-cineview-takeover-content] 恒带 transform
    └ motion.div                        ← Scene 本体
      │   contain: 'layout style'（drag）/ 'layout style paint'（scroll）
      │   scroll 下恒带 transform: translateZ(0)
      ├ (scroll) SceneFixedLayer 三层 div，z-index 20
      └ 你的 children
        └ Animate 的包装层
            scroll 下多一层 div[data-cineview-animate-host]
            内层 motion.div[data-cineview-animate-id] 绑定属性通道
```

## --cineview-unit：共享同一个换算基准

最外层包装 div 上挂着一个长度型 CSS 变量，值等于当前 1 个设计 px：

```css
.my-panel {
  padding: calc(24 * var(--cineview-unit));
  border-radius: calc(12 * var(--cineview-unit));
}
```

这是被规格承诺的公共接口，也是普通 CSS 与框架共用同一个换算基准的正规做法，不必自己再算一遍 `viewport / size`。这个包装 div 自身不带任何布局样式，但它是树里真实的一层，写 `>` 子选择器时要算上它。

## Scene 必须是直接子节点

框架只遍历一层子节点来发现场景：

| 写法                                    | 能否被发现                  |
| --------------------------------------- | --------------------------- |
| `<CineView><Scene/><Scene/></CineView>` | 可以                        |
| `{list.map(s => <Scene key={s.id}/>)}`  | 可以（数组会被 React 展平） |
| `<><Scene/><Scene/></>`                 | 不行（Fragment 不展平）     |
| `memo(Scene)` / `forwardRef` 包装       | 可以（沿类型解包至六层）    |
| `function My() { return <Scene/> }`     | 不行（框架看到的是 `My`）   |

识别靠内部静态标记，不是 `displayName`，所以给自己的组件设 `displayName="Scene"` 不起作用（开发环境会警告这种写法）。

最难查的是混合情形：一个直接的 Scene 加一个含两个 Scene 的 Fragment，框架只发现 1 个，**零报错零警告**（`EMPTY_SCENES` 只在一个都没有时才发）。未被发现的 Scene 会回落到 drag 模式默认值，渲染成 `position: absolute` 且 `pointer-events: none`，看不见也点不动。

## 引擎覆盖你的 style

Scene 的样式合并顺序是「先展开你的 `style`，再覆写引擎的键」。以下键总是由引擎决定：

```text
width  height  position  overflow  willChange  contain
transform  userSelect  touchAction  zIndex  pointerEvents  + anchor 键
```

其余 style 存活。另外 Scene 会把它不认识的 prop 原样铺到底层 DOM 节点上：`id`、`data-*`、`aria-*`、`role`、`onClick` 都能用；反过来拼错的 prop 会变成 React 的未知属性警告，而不是被静默拦住。

## z-index 为什么不生效

给 `Animate` 或 `Position` 的子元素写 `z-index` 是死码。原因不是包装层带 transform（已落定的 `Animate` 包装层读到的是 `transform: none`），而是 Scene 自身的 `contain`：

`contain: layout` 无条件建立层叠上下文与包含块，两种模式、每个场景、永久生效。子元素的 `z-index` 只在这个上下文内部解析，对兄弟场景之间、或对跨 `Position` 的兄弟之间毫无影响。

再叠上四处写死的层级：

| 层                              | z-index              |
| ------------------------------- | -------------------- |
| drag 场景帧                     | 当前 `10` / 其余 `1` |
| scene fixed layer 的 clip       | `20`                 |
| 活跃锁定区（locked zone）的壳层 | `30`                 |
| scrollbar 覆盖层                | `80`                 |

**唯一有效的宿主是 `Position` 的 `style.zIndex`**（`Position` 展开你的 style 时不覆写 `zIndex`，所以传进去是安全的）。需要控制跨 `Position` 兄弟的绘制顺序，写在 `Position` 上。

## position: fixed 在 scroll 场景内不可能生效

scroll 下 Scene 恒带 `transform: translateZ(0)`，而**任何非 `none` 的 transform 都会让该元素成为 `fixed` 后代的包含块**。锁定区场景的 content 层还额外恒带一个 transform。所以 scroll 场景子树里的 `position: fixed` 相对的不是视口，表现为「跟着内容滚走」或位置错乱，且没有任何报错。

两种正确做法。一是用 `Position` 的 `fixed`，它 portal 进 scene 作用域的 fixed layer。二是把场景做成 `100vh`，再用 `position: absolute; inset: 0`：场景盒此时恰好等于一个视口，absolute 与视口等价。见 [Scene 作用域固定层](/docs/04-fixed-layer)。

## 根容器背景写死且两模式不同

drag 是 `#0d1624`，scroll 是 `#ffffff`，都不可配（`CineView` 既没有 `className` 也没有 `style` prop）。把页面在两个模式间搬运时这一处会突变。要改，只能靠 `.cineview-container` 类或 `[data-cineview-container="true"]` 属性选择器从外部覆盖。

## 可稳定选中的钩子

这些属性可以作为测试与样式的锚点：

```text
[data-cineview-container]      根滚动/容器
[data-scene-index]             每个场景的外层包装
[data-cineview-scroll-zone]    声明了 zone 的场景（不是锁定区的场景也会带，看到它不代表锁定区生效）
[data-cineview-takeover-shell] 锁定区的 sticky 壳
[data-cineview-takeover-content]
[data-scene-fixed-layer]       fixed layer 三层，另有 -role / -host
[data-cineview-animate-host]   scroll 下 Animate 的外层
[data-cineview-animate-id]     Animate 属性通道所在层
```

两个注意：`data-cineview-scroll-zone` 在没有锁定区的 scroll 场景上也会回落到 `sceneId`，**它的存在不代表注册了 zone**；`animateId` 不显式传时是模块级计数器生成的，跨渲染不稳定，要拿它当钩子就必须显式传 `animateId`。

## 相关页面

- [运行态](/docs/07-runtime-states)：`pointer-events` 被置为 none 的时机
- [Scene 作用域固定层](/docs/04-fixed-layer)：fixed 的正确替代方案及其边界
- [响应式换算基准](/docs/05-responsive)：`--cineview-unit` 背后的换算模型
- [drag 布局契约](/docs/01-layout)：drag 侧写死的样式清单
