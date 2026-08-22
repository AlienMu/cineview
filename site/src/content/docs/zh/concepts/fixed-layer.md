---
title: Scene 作用域 fixed 层
eyebrow: FIXED
---

`Position` 的 `layer.fixed` 在 scroll 模式下的语义固定为 **scene-scoped fixed layer**：钉住的层只属于声明它的那个 Scene，可见、裁剪、释放全部以 scene 边界为准，绝不跨章节漂浮。这是框架对「fixed」一词的裁决——不是浏览器语义的裸暴露，而是带所有权边界的钉住。

本页讲清这套语义的规则、边界与常见陷阱；`Position` 的完整 props 参考（坐标、锚点、相对链）见 components 组的 Position 页。

## 声明一个 fixed 层

```tsx
<CineView mode="scroll" config={{ size: 750 }}>
  <Scene sceneId="chapter-2" layout={{ width: '100%', height: '240vh' }}>
    {/* Pinned caption: design-viewport coordinates, held while the scene is in view. */}
    <Position at={{ x: 0, y: 90, anchor: 'center-x' }} layer={{ fixed: true }}>
      <Container width={640} height={72}>
        <h3>Chapter 2 — pinned caption</h3>
      </Container>
    </Position>

    <Container width={640} height={1600}>
      <p>The chapter body scrolls through the scene while the caption holds still.</p>
    </Container>
  </Scene>
</CineView>
```

坐标是设计 px，参考系是设计 viewport（经 `config.size` 单尺子换算），不因 host 裁剪高度变化而重新解释 `x` / `y`。`at.anchor` 的居中锚点照常可用——fixed 层与普通 Position 用同一套坐标系。

上例中 chapter-2 不需要是 takeover 场景：scene-scoped fixed host 在 scroll 模式下为每个 Scene 挂载，普通文档流场景同样可以钉住标题、进度条或角标。scene 滚出视口时，层在 scene 边界被裁剪释放，不会跟着滚进下一个章节。

## 解析：三种情形

`layer.fixed` 的最终行为取决于所在上下文：

| 情形                       | 解析结果                                                  |
| -------------------------- | --------------------------------------------------------- |
| scroll 模式 + 位于 Scene 内 | portal 进该 Scene 的 fixed host——标准 scene-scoped 行为   |
| scroll 模式 + 无 Scene 宿主 | 降级为 `position: sticky` 钉住                             |
| drag 模式                  | 无 scene-scoped 语义，按场景内定位渲染（scene 本身全屏替换） |

第三种情形不值得依赖：drag 模式下 scene 是全屏整页切换、没有文档流滚动，「钉住」没有区别性意义。真正的语义差异只存在于 scroll 模式——也只在 scroll 模式下，`layer.fixed` 才值得写。

## 什么时候用 fixed 层

fixed 层的正确用途是**章节级钉住 UI**：钉到本章节顶部/中部的标题、章节序号、角标、装饰性 HUD。判据是「这个东西是否应该与本章同生共死」——是，就用 fixed 层；它的可见性、裁剪、释放会自动对齐 scene 边界。

反过来，两类需求不该用 fixed 层：

- **跨章节的持久 UI**（全站导航、语言切换、全局进度条）：它们不属于任何 scene。放在 CineView 之外用普通 React/CSS 实现——框架外的普通 DOM 天然是全屏 fixed，且不受任何 scene 生命周期影响。
- **需要逐帧跟手的视觉**（随滚动擦除的序列、scrub 图形）：这是 `Animate` 的 scrub 语义或 `useAnimateTimeline()` 自定义渲染器的职责。fixed 层解决「钉在哪」，不解决「怎么动」——把两者混在一个手写 fixed 层里，等于绕开框架重建了一套动画驱动。

一句话判据：**位置问题用 fixed 层，动画问题用 Animate，跨章 UI 放框架外**。

## 作用域规则

scene-scoped fixed layer 的边界规则固定如下：

1. 层只属于自己的 scene。
2. 层只在自己的 scene 可见区间内显示。
3. 层不允许跟随到下一个 scene。
4. 不同 scene 的 fixed layer 不允许进入同一可见 overlay 域。
5. fixed host 负责所有权归属、可见域裁剪与 scene 边界释放。
6. 设计坐标参考系保持为设计 viewport，不因 host 裁剪高度变化而重解释 `x / y`。
7. scene 底部释放时，层停在 scene 内的边界位置，而不是继续跟随到下一个 scene。

这些规则由框架的 fixed host 强制执行，作者侧没有任何开关可以放宽——不存在「让这个层多漂一个章节」的参数。

## 为什么不跨 scene 漂浮

章节是所有权边界。若 fixed 层可以跨 scene 漂浮，会出现两类破窗：

- **陈旧内容滞留**：第一章的钉住标题盖在第三章的正文上，读者看到的是已经结束的章节的 UI。
- **overlay 域冲突**：相邻两个 scene 各自的 fixed 层同时进入同一个可见 overlay 域，层叠关系由挂载顺序而非作者意图决定，结果不可预测。

scene-scoped 语义同时消除了这两类问题：层与 scene 同生共死，可见性判定只有一条规则——「我的 scene 在不在视口里」。对作者来说，这也让心智模型保持最小：每个 scene 是一个自洽的舞台，钉住的东西属于这个舞台，谢幕时一起下台。

## takeover 场景内 fixed 的降级

有一个约束必须单独记住：**手写的 `position: fixed` 在 takeover 场景内必然降级**。

takeover 场景（带 `Scene.scroll` 配置、进入 center-lock 的场景）的 shell 恒带 transform——它随 scrub 位移。而 CSS 规范规定：transform 祖先内部元素的 `position: fixed` 相对该祖先定位，而不是视口。结果就是「钉住」钉在了一个正在移动的容器上，视觉上等同于 absolute，还附赠难查的偏移 bug。

正确做法有两条路。第一条就是本页的 `layer.fixed`——框架把层 portal 到 scene 自己的 fixed host，钉住语义由框架恢复。第二条是绕开 fixed，用全屏 scene + 绝对定位覆盖层：

```tsx
{/* Inside a takeover scene the shell always carries a transform:
    raw CSS position: fixed pins to the transformed ancestor, not the viewport.
    The full-bleed pattern is a 100vh scene plus an absolute inset layer. */}
<Scene
  sceneId="hero"
  layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
  scroll={{ zoneId: 'hero', trigger: 'center-lock' }}
>
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    <Overlay />
  </div>
</Scene>
```

两条路的取舍：`layer.fixed` 给你设计 viewport 坐标系与自动边界裁剪；absolute inset 覆盖层给你完全的手工控制（适合全屏 overlay、遮罩、光效），代价是要自己保证它不溢出 scene 的 `overflow: hidden`。

在 takeover 场景里用 `layer.fixed` 时还有一条框架级保证：scene progress 被消费的整个过程中，Scene shell 与 scene-scoped fixed layer 必须保持在 viewport 内。也就是说 center-lock 滚动段内无论怎么 scrub，钉住层都不会突然消失或跳出视口——它跟随的是 zone 的 frame，不是原始文档流位置。这条保证让「带钉住 HUD 的 takeover 章节」成为安全组合，不需要作者自己做可见性补偿。

## z-index 写在哪里

与降级约束同源的另一条纪律：Animate 与 Position 的包装层恒带 transform，transform 会创建层叠上下文，于是**子元素的 `z-index` 是死码**——写了不生效，层叠关系由包装层决定。唯一有效的宿主是 Position 自己的 `style`：

```tsx
{/* z-index belongs on the Position wrapper; a child's z-index is dead
    inside the transform-based stacking context the wrapper creates. */}
<Position at={{ x: 0, y: 0 }} layer={{ fixed: true }} style={{ zIndex: 4 }}>
  <Overlay />
</Position>
```

排查「为什么这个元素压不住那个元素」时，先检查 z-index 是不是写在了 Position 的子元素上——那是这类问题最常见的原因。

## fixed 层坐标速查

| 字段                    | 语义                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| `at.x` / `at.y`         | 设计 px 绝对坐标，参考系为设计 viewport                          |
| `at.anchor`             | `'center' \| 'center-x' \| 'center-y'`；居中轴上 `x`/`y` 变为相对中心的偏移 |
| `at.offsetX` / `at.offsetY` | 相对定位链：基于上一个 Position 的位置累加                     |

fixed 层建议用显式绝对坐标（或 anchor 居中）声明。相对链依赖父 Position 的上下文，而钉住层的 DOM 已 portal 到 scene 的 fixed host——跨 portal 边界的相对链容易得到与预期不符的基准。需要一组钉住元素相对排布时，把它们包进同一个 Position 的 children 里，让相对关系发生在层内部，而不是横跨层边界。

## 测量与释放

fixed 层的存在不改变 scene 的几何。scroll 模式的 scene 高度测量按「布局足迹」完成：

- 参与测量的是正常布局内容。
- fixed layer scaffolding、overlay / portal host、debug 基础设施与纯 runtime 辅助节点不参与测量。
- 不使用 `Math.max(measuredHeight, viewportHeight)` 这类一屏下限。
- 新挂载节点、异步资源与布局变化会重新触发测量；含定位元素的 scene 以真实布局占位与需要展示的内容边界综合求得最小可展示高度。

也就是说，一个 240vh 的 scene 内钉了多少 fixed 层，都不会把它撑高或压矮；钉住层的出现与消失也不触发 scene 高度重测。

释放行为同样确定：scene 底部释放时，层停在 scene 内的边界位置（规则 7）；已完成到 100% 的 scene 从后方被反向滚回时，视觉 shell 与 fixed layer 必须保持在 viewport 内——任何视觉 offset 只用于渲染补偿，不创建第二套虚拟滚动指标。反向滚回时你看到的层，就是当初正向离开时停在边界的那个层。

## 小结

fixed 层的五条速记：

1. `layer.fixed` 只在 scroll 模式有 scene-scoped 语义；声明即钉住，边界即释放。
2. 层属于声明它的 Scene，绝无跨章节漂浮；不同 scene 的层不共享 overlay 域。
3. takeover 场景内手写 `position: fixed` 必然降级——用 `layer.fixed` 或 100vh + `absolute inset: 0`。
4. z-index 写在 Position 的 `style` 上，子元素的 z-index 是死码。
5. fixed scaffolding 不参与 scene 高度测量，钉多少层都不改变 scene 几何。
