---
title: DOM 与布局契约
eyebrow: CONCEPTS / DOM
---

排查定位、裁切和层叠问题时，可检查框架渲染的包装元素。Scene 样式控制场景布局，Position 负责按设计坐标放置内容。

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
      ├ (scroll) 固定元素容器，三层 div，z-index 20
      └ 声明的子节点（children）
        └ Animate 的包装层
            scroll 下多一层 div[data-cineview-animate-host]
            内层 motion.div[data-cineview-animate-id] 应用动画样式
```

## --cineview-unit：统一视窗缩放基准

最外层包装 div 上挂着一个长度型 CSS 变量，值等于当前 1 个设计 px：

```css
.my-panel {
  padding: calc(24 * var(--cineview-unit));
  border-radius: calc(12 * var(--cineview-unit));
}
```

普通 CSS 可通过 `--cineview-unit` 使用 CineView 的响应式比例。包装层是真实的 DOM 元素，编写直接子代选择器时需要包含这一层。

## Scene 必须是直接子节点

框架只遍历一层子节点来发现场景：

| 写法                                    | 能否被发现                  |
| --------------------------------------- | --------------------------- |
| `<CineView><Scene/><Scene/></CineView>` | 可以                        |
| `{list.map(s => <Scene key={s.id}/>)}`  | 可以（数组会被 React 展平） |
| `<><Scene/><Scene/></>`                 | 不行（Fragment 不展平）     |
| `memo(Scene)` / `forwardRef` 包装       | 可以（沿类型解包至六层）    |
| `function My() { return <Scene/> }`     | 不行（框架看到的是 `My`）   |

将 Scene 直接声明在 CineView 下。把包装组件的 `displayName` 设为 `Scene` 不会让它被识别。直接 Scene 与不可识别的嵌套 Scene 混用时，可能缺少部分内容而不报空场景错误；只有找不到任何有效 Scene 时才报告 `EMPTY_SCENES`。

## 样式层叠与引擎覆盖规则

Scene 的样式合并顺序是「先展开传入的自定义 `style`，再覆写引擎受管属性」。以下属性始终由引擎统一接管：

```text
width  height  position  overflow  willChange  contain
transform  userSelect  touchAction  zIndex  pointerEvents  + anchor 键
```

其他自定义样式保留。`id`、`data-*`、`aria-*`、`role` 和 `onClick` 等标准 HTML 属性会传给场景节点。

## 层叠上下文与 z-index 规则

每个 Scene 通过 `contain: layout` 建立层叠上下文，子元素的 z-index 不会改变该 Scene 相对兄弟场景的顺序。场景内部的 transform 或显式 z-index 还可能建立其他层叠上下文。

叠加引擎内部预设的层级：

| 层                              | z-index              |
| ------------------------------- | -------------------- |
| drag 场景帧                     | 当前 `10` / 其余 `1` |
| scene fixed layer 的 clip       | `20`                 |
| 活跃锁定区（locked zone）的容器 | `30`                 |
| scrollbar 覆盖层                | `80`                 |

控制同级 Position 的顺序时，可设置 `style.zIndex`。数值增大后没有效果时，检查其祖先元素的层叠上下文。

## scroll 模式下 position: fixed 的定位边界

在 scroll 模式下，Scene 包含 `transform: translateZ(0)`，而任何非 `none` 的 transform 均会使该元素成为 `fixed` 后代元素的定位基准 (Containing Block)。锁定区场景的内容层亦包含独立的 transform。因此，直接在子树中声明原生 `position: fixed` 无法相对于浏览器可视窗口定位。

推荐采用两种标准方案：一是使用 `Position` 的 `fixed` 属性挂载至 Scene 作用域的固定层；二是将场景高度设置为 `100vh` 并使用 `position: absolute; inset: 0`。详见 [Scene 作用域固定层](/docs/04-fixed-layer)。

## 根容器背景色基准差异

drag 默认背景为 `#0d1624`，scroll 为 `#ffffff`。CineView 没有 `className` 或 `style` 属性。外部 `.cineview-container` 样式可用 `!important` 覆盖内联背景，规则应限定到目标实例。

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
[data-cineview-animate-id]     应用 Animate 样式的元素
```

普通 Scene 的 `sceneId` 也可能出现在 `data-cineview-scroll-zone` 中，因此该属性不代表锁定区已生效。自动生成的 `animateId` 在实例挂载期间保持稳定；重新挂载后仍需使用同一选择器时，应显式声明 `animateId`。

## 相关页面

- [运行态](/docs/07-runtime-states)：`pointer-events` 被置为 none 的时机
- [Scene 作用域固定层](/docs/04-fixed-layer)：fixed 的正确替代方案及其边界
- [响应式换算模型](/docs/05-responsive)：`--cineview-unit` 背后的计算逻辑
- [drag 布局契约](/docs/01-layout)：drag 模式下的固有样式规范
