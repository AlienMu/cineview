---
title: DOM 与布局契约
eyebrow: CONCEPTS / DOM
---

本页说明自定义样式在引擎层叠规则下的生效边界与排错方案。引擎在用户内容外层渲染了多层包装结构，各层均具备特定的布局语义与样式约束。若不了解 DOM 渲染层级，`position: fixed` 与 `z-index` 可能会产生非预期的布局表现。

## 实际渲染出的层级

```text
div.cineview-responsive-container        ← 挂 --cineview-unit
└ div.cineview-container[data-cineview-container="true"]
  │   drag: height 100vh, overflow hidden, background #0d1624
  │   scroll: height 100vh, overflow-y scroll, background #ffffff
  └ div[data-scene-index="N"]            ← 每场景一个
    │   drag: position absolute, inset 0, z-index 10（当前）/ 1
    │   scroll: position relative
    │   锁定区场景额外套两层：
    │     div[data-cineview-takeover-shell]   position sticky, overflow hidden, 活跃时 z-index 30
    │     div[data-cineview-takeover-content] 恒带 transform
    └ motion.div                        ← Scene 本体
      │   contain: 'layout style'（drag）/ 'layout style paint'（scroll）
      │   scroll 下恒带 transform: translateZ(0)
      ├ (scroll) SceneFixedLayer 三层 div，z-index 20
      └ 声明的子节点（children）
        └ Animate 的包装层
            scroll 下多一层 div[data-cineview-animate-host]
            内层 motion.div[data-cineview-animate-id] 绑定属性通道
```

## --cineview-unit：统一视窗缩放基准

最外层包装 div 上挂着一个长度型 CSS 变量，值等于当前 1 个设计 px：

```css
.my-panel {
  padding: calc(24 * var(--cineview-unit));
  border-radius: calc(12 * var(--cineview-unit));
}
```

这是规范定义的公共接口，也是外部 CSS 与框架共享单轴响应式尺度的标准方式，无需重复计算 `viewport / size`。外层包装 div 本身不包含多余布局样式，但在 DOM 结构中真实存在，编写 `>` 直接子代选择器时须计入该层。

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

当混用直接声明与 Fragment 包裹时，Fragment 内部的 Scene 无法被顶层直接识别。未识别的场景会回退至默认样式（如 `position: absolute` 且 `pointer-events: none`），导致内容不可见且无法响应交互事件。仅当完全未检测到有效 Scene 时，框架才会抛出 `EMPTY_SCENES` 错误。

## 样式层叠与引擎覆盖规则

Scene 的样式合并顺序是「先展开传入的自定义 `style`，再覆写引擎受管属性」。以下属性始终由引擎统一接管：

```text
width  height  position  overflow  willChange  contain
transform  userSelect  touchAction  zIndex  pointerEvents  + anchor 键
```

其余自定义 style 正常保留。此外，Scene 会将未识别的 HTML 属性透传至底层 DOM 节点：`id`、`data-*`、`aria-*`、`role`、`onClick` 均可正常生效；拼写错误的 prop 则由 React 抛出未知属性警告。

## 层叠上下文与 z-index 规则

在 `Animate` 或 `Position` 的子元素上直接声明 `z-index` 无法跨组件提升层级。原因在于 Scene 内部启用了 `contain: layout`，建立了独立的层叠上下文与局部定位边界：

`contain: layout` 在两种模式下为每个场景建立独立的层叠上下文。子元素的 `z-index` 仅在该上下文内部解析，对兄弟场景或跨 `Position` 组件不产生层级提升效果。

叠加引擎内部预设的层级：

| 层                              | z-index              |
| ------------------------------- | -------------------- |
| drag 场景帧                     | 当前 `10` / 其余 `1` |
| scene fixed layer 的 clip       | `20`                 |
| 活跃锁定区（locked zone）的壳层 | `30`                 |
| scrollbar 覆盖层                | `80`                 |

**唯一有效的宿主是 `Position` 的 `style.zIndex`**（`Position` 展开自定义 style 时不覆写 `zIndex`）。若需控制同级 `Position` 之间的绘制层序，须直接配置于 `Position` 之上。

## scroll 模式下 position: fixed 的定位边界

在 scroll 模式下，Scene 包含 `transform: translateZ(0)`，而任何非 `none` 的 transform 均会使该元素成为 `fixed` 后代元素的定位基准 (Containing Block)。锁定区场景的内容层亦包含独立的 transform。因此，直接在子树中声明原生 `position: fixed` 无法相对于浏览器可视窗口定位。

推荐采用两种标准方案：一是使用 `Position` 的 `fixed` 属性挂载至 Scene 作用域的固定层；二是将场景高度设置为 `100vh` 并使用 `position: absolute; inset: 0`。详见 [Scene 作用域固定层](/docs/04-fixed-layer)。

## 根容器背景色基准差异

drag 默认背景为 `#0d1624`，scroll 默认背景为 `#ffffff`，二者未暴露直接配置项（`CineView` 未提供 `className` 属性或 `style` 属性）。在跨模式迁移时需注意此项差异。若需自定义背景色，可通过 `.cineview-container` 类名或 `[data-cineview-container="true"]` 属性选择器进行外部层叠覆盖。

## 可靠的测试与样式选择器

这些属性可用于测试定位与样式选择器：

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

两项注意事项：`data-cineview-scroll-zone` 在未配置锁定区的 scroll 场景上亦会回退至 `sceneId`，**其存在并不意味着注册了锁定区**；`animateId` 若未显式传入，则由模块级自增计数器生成，跨渲染周期不具备稳定性。若需以此作为可靠定位选择器，须显式声明 `animateId`。

## 相关页面

- [运行态](/docs/07-runtime-states)：`pointer-events` 被置为 none 的时机
- [Scene 作用域固定层](/docs/04-fixed-layer)：fixed 的正确替代方案及其边界
- [响应式换算模型](/docs/05-responsive)：`--cineview-unit` 背后的计算逻辑
- [drag 布局契约](/docs/01-layout)：drag 模式下的固有样式规范
