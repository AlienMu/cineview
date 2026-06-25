# 设计文档：CineView React UI 框架

## 概述

CineView 是一款专为 React 开发的 UI 框架，用于创建影院式分页体验与滚动驱动叙事页面。该框架提供完整的场景管理、动画系统、响应式布局和图片预加载能力，支持移动端和 PC 端跨平台使用。通过声明式组件 API，开发者可以构建全屏分页页面、真实文档流叙事页面，以及两者结合的产品展示和交互式故事页面。

核心特性包括：分页切换系统（支持横向/纵向）、滚动驱动动画、场景进入/离开动画、响应式尺寸自动换算、灵活的定位系统、动画延迟关联机制、图片预加载和丰富的事件/API 接口。

## 当前架构裁决

基于当前 `drag / scroll` 两模式重构需求，CineView 的后续开发统一采用以下架构裁决：

1. `drag`、`scroll` 是两套不同引擎，由 `CineView` 根节点统一声明模式，不再把模式挂在 `Scene` 上。
2. `Scene` 的职责统一为章节级能力容器、布局边界、可视信息与 scene-owned layer 宿主，不负责决定根交互模式。
3. `drag` 模式下：
   - `Scene` 只负责分页位移、边界判断、手势状态机、release/rollback/commit
   - `Animate` 负责全部元素级视觉动画
   - 主时间语义统一为 `dragTimelineProgress`、`sharedElapsedMs`、`sharedTimelineDurationMs`
4. `scroll` 模式下：
   - 页面首先是正常文档流，`Scene` 允许小于 `100vh`
   - 滚动输入 ownership 固定为 `一个 Scene.scroll progress owner 或 native document flow`，二者不能并行或拆分消费同一段输入
   - completed scene 的反向倒放不是独立重放模式，而是同一个 scene progress 从保留的 `100%` 向 `0%` 回退
   - `scrollDriven=true` 的动画必须依附局部滚动接管区，不能各自按元素 viewport 位置单独抢控制权
   - 普通文档内容默认持续参与自然文档流，不允许被“进入 viewport 才显示”的门控规则接管
   - `scrollDriven=false` 的动画才允许按可视规则自动执行，但这种可视规则只负责补充动画，不负责决定正文内容是否可见
   - `Position.fixed` 在 scroll 下是 scene-scoped fixed layer，不允许跨 scene 漂浮
   - root 只保留真实滚动容器，不再用虚拟滚动轨道重写页面空间
5. `renderProgress` 只用于 drag 场景位移，不作为 scroll 的主语义。
6. 每个元素必须根据所属模式消费对应时间语义，禁止跨模式复用解释。
7. 已完成入场的元素，如果配置了 `infiniteAnimation`，只有在运行态允许时才持续运行。
8. `Animate` 的运行时上下文按职责拆分为 base runtime、drag timeline、scroll bridge 与 animation registry 四类类型；当前可由一个 Provider 组合承载，但新增字段必须先归入明确子上下文。
9. `waitFor`、delay 累加、重复 `animateId`、缺失依赖和循环依赖由纯 animation registry 模块计算和校验，`Scene` 只负责持有注册表并输出开发环境诊断。

这意味着：后续实现必须优先保证“语义单一、职责单一、所有权清晰”，禁止回到一个状态被多处以不同语义解释的混合模式。

## Scroll Mode

本节是 scroll 模式的唯一有效规格，旧的 V2/V3 叠加式表述全部废弃。

### 设计目标

1. `scroll` 模式必须从 `CineView` 根节点开启，而不是由 `Scene` 决定。
2. 页面默认是正常文档流，动画接管是局部能力，不是整页常驻锁定。
3. `Scene` 可以小于、等于或大于 `100vh`；框架不能把“一屏高”当作基础假设。
4. public API 要先符合页面作者心智，再映射到内部 runtime；不要求用户理解内部 `Viewport` 机制。
5. scene-scoped fixed layer 必须严格归属自己的 scene，可见、裁剪、释放都以 scene 边界为准。
6. 正文、卡片、图片和章节主体这类阅读型内容，默认应直接出现在自然文档流里；viewport 交集只能触发补充动画，不能把内容本体先隐藏再突然显示。

### 公共语义

- `CineView`: 根引擎与模式入口
- `Scene`: 可选的章节级容器，用于承载框架级 chapter 能力
- `Scene.scroll`: scroll-only 的局部滚动接管声明
- `Animate scrollDriven`: 领取所属 scene takeover 的真实滚动距离时间轴
- `Position.fixed`: scene-scoped fixed layer

`Viewport` 与 `ScrollZone` 必须从 scroll 公共入口、示例和 active runtime path 中删除。
旧的 `Scene` 扁平 mode/layout props，以及 `Animate` / `Position` 的扁平 authoring props，不再出现在主入口导出的公共 TypeScript 声明里，也不再作为主 authoring 心智保留。

### 根节点模式设计

推荐公共接口如下：

```tsx
<CineView
  mode="scroll"
  scroll={{
    direction: 'y',
    zoneTrigger: 'center-lock',
  }}
>
  <Scene />
  <Scene />
</CineView>
```

裁决如下：

1. 模式只在 `CineView` 根节点声明。
2. `scroll` 模式参数归入 `CineView.modes.scroll` 对象，不再散落到 `Scene`。
3. 普通文档内容不要求包裹在 `Scene` 中。
4. `Scene` 只在需要章节级能力时出现，如 takeover、scene-scoped fixed layer、scene 生命周期与导航。
5. `Scene.scroll` 只声明“这个 scene 会接管滚动”，不声明根模式。

### Scene 规则

在 `CineView mode="scroll"` 下，`Scene` 的规则如下：

1. `Scene` 不是 scroll 页面里所有内容的必选基础块，而是显式的章节级能力容器。
2. `Scene` 出现时，仍然是正常文档流中的一个 section，不再默认 `min-height: 100vh`。
3. `Scene` 高度由内容布局足迹决定，而不是由动画后的视觉外接框决定。
4. `Scene` 可以包含：
   - 普通文档流内容
   - scene-scoped fixed layer
   - 可选的 `scroll` takeover 声明
5. 没有 `scroll` takeover 的 `Scene` 只是一个带章节语义的普通 section，不应产生额外滚动锁定。
6. 普通文档 section、`article`、`div` 和自定义组件也可以直接存在于 `CineView mode="scroll"` 下，不要求 scene 化。
7. `Scene` 仍需对外暴露可视信号，如 `onVisibilityChange(visible, progress)`，供非 scroll-driven 动画和外部业务消费。
8. scroll 页面中的正文内容不应因为框架默认可视规则而被设置为 `opacity: 0`、`visibility: hidden`、`scale: 0` 或离开 viewport 后销毁重建。

### Scene Scroll 规则

`Scene.scroll` 是 scroll 模式下唯一推荐的局部滚动接管语义。

```tsx
<Scene
  scroll={{
    zoneId: 'hero-sequence',
    trigger: 'center-lock',
  }}
>
  <Animate />
  <Animate />
  <Animate timeline={{ driver: 'visibility' }} />
</Scene>
```

规则如下：

1. `trigger='center-lock'` 为当前唯一标准触发方式。
2. 当 scene 中心命中浏览器 viewport 中心，且该 scene 存在 scroll-driven 动画时间轴时，scene 获得滚动接管权。
3. 接管后，runtime 只维护一个公开语义：该 scene 的本地动画进度百分比 `0%..100%`。
4. 用户正向滚动时，scene progress 从当前值向 `100%` 推进；用户反向滚动时，scene progress 从当前值向 `0%` 回退。
5. 只要 scene progress 仍在 `0%..100%` 内可消费，用户输入优先用于 scene progress；真实 `scrollTop` 在该 scene 的真实 center-lock 滚动段内移动，普通文档内容不得越过当前 center-lock 段抢先接管。
6. scene progress 到达 `100%` 后，runtime 释放给自然文档流，但必须保留该 scene 的 progress 与渲染终态为 `100%`。
7. scene progress 到达 `0%` 后，runtime 释放给自然文档流，但必须保留该 scene 的 progress 与渲染起态为 `0%`。
8. 已经完成到 `100%` 的 scene，从后方真实文档流反向滚回时，只有当该 scene 回到同一个 center-lock 触发位置，runtime 才恢复该 scene 的输入接管，并以保留的 `100%` 为起点向 `0%` 回退。
9. 内部锁定、边界判断、防跳过标记等旧实现细节不属于 scroll 产品模型；文档、测试和公共 API 只描述 scene progress、输入方向、真实文档流和边界行为。
10. 对于一次大输入，runtime 必须按顺序拆分输入：先消耗到 center-lock 触发点的真实文档距离，再消耗 scene progress 对应的真实滚动距离，最后只把剩余量交还自然文档流。
11. scene progress 被消费时，Scene shell 与 scene-scoped fixed layer 必须在 viewport 内可见；如果 runtime 需要视觉补偿，该补偿只影响渲染，不改变真实 scroll metrics。
12. scene progress 的输入速率必须与真实 px 输入一致，不得被 trigger 距离、anchor overshoot 或隐藏阻尼截短。
13. 任何输入路径都不得让一次 scroll intent 从某个 completed center-lock 段的后方直接落到该段前方；若 delta 足以跨完整段，reducer 必须至少产生一个段内 progress frame，后续输入再继续移动。
14. `Scene.scroll` 不负责视觉样式，只负责时间轴归属和 center-lock 命中逻辑。
15. scene scroll-driven 动画时间轴必须表现为真实滚动容器中的 center-lock 滚动段，用来延长原生滚动距离和滚动条行程；作者不再通过 `Scene.scroll.budget` 调整速度。
16. takeover 触发时允许 scene 视觉上锁定在 viewport 中心，但不允许把整页内容映射到另一条虚拟坐标轴。

### Animate 规则

`Animate` 在 scroll 模式下只有两种明确语义，并且可以脱离 `Scene` 工作：

1. `timeline.driver='scroll'`
   - 必须依附带 `scroll` takeover 的 `Scene`
   - 在 takeover scene 内可作为默认绑定语义存在，显式声明仅用于覆盖或强调
   - 自身进度来自所属 zone 的统一时间轴
   - 不再按自己的 `getBoundingClientRect()` 独立推导进退场
   - 若脱离 scene takeover 使用，开发环境报警告，运行时不回退为旧行为
2. `timeline.driver='visibility'`
   - 不参与 scene takeover 的真实滚动距离时间轴
   - 只有这类动画允许按可视规则自动执行
   - viewport 交集只负责触发补充动画，不负责决定元素是否渲染、是否参与自然文档流
   - 这种语义不应用于门控正文可见性；正文、卡片、图片、章节主体等阅读内容应默认直接显示
   - 元素离开 viewport 后，默认不应被框架销毁、重建或硬重置为完全隐藏状态；需要重播时必须显式声明

### 时间轴与真实滚动距离规则

真实滚动距离按 `delay + waitFor 链 + enter/exitDuration` 统一结算。内部固定换算为 `1ms = 1px`，即 `totalScrollDistancePx = totalTimelineMs`。scroll 模式不暴露单独的速度或预算参数，原生文档流 px 速度是唯一速度源。

对单个 `Animate`：

- `enterTotal = delayChain + enterDuration`
- `exitTotal = exitDuration`
- `animationTotal = enterTotal + exitTotal`

滚动距离分配规则：

1. 若同时存在 enter / exit：
   - 入场滚动距离占比 = `enterTotal / animationTotal`
   - 退场滚动距离占比 = `exitTotal / animationTotal`
2. 若只有 enter：
   - enter 占 100%
   - 入场完成后保持最终态
3. 若只有 exit：
   - 本次不支持作为独立 scroll-driven 动画
   - 开发环境报警告

多动画规则：

1. `waitFor` 链进入统一滚动距离计算。
2. 某动画的实际起点 = `自身 delay + 所有 waitFor 前置动画的完整 animationTotal`。
3. 同一 zone 的总真实滚动距离 = 其内部所有 scroll-driven 动画链展开后的总时长，按 `1ms = 1px` 映射。
4. 动画总时长越长，滚动推进越“慢”；总时长越短，滚动推进越“快”。

### 长动画规则

“出现 + 消失”的长动画在 scroll 模式下是标准组合动画。

1. 例：`enterDuration=3000`、`exitDuration=3000`
   - 前 50% 滚动距离驱动入场
   - 后 50% 滚动距离驱动退场
2. 例：`enterDuration=3000`、无 `exit`
   - 整个 100% 滚动距离用于入场
   - 入场完成后保持最终态

### Scene-Scoped Fixed Layer 规则

`Position.fixed` 在 scroll 模式下的语义固定为 scene-scoped fixed layer：

1. layer 只属于自己的 scene。
2. layer 只在自己的 scene 可见区间内显示。
3. layer 不允许跟随到下一个 scene。
4. 不同 scene 的 fixed layer 不允许进入同一可见 overlay 域。
5. fixed host 负责：
   - 所有权归属
   - 可见域裁剪
   - scene 边界释放
6. fixed layer 的设计坐标参考系保持为设计 viewport，不因 host 裁剪高度变化而重解释 `x / y`。
7. scene 底部释放时，layer 应停留在 scene 内的边界位置，而不是继续跟随到下一 scene。

### Scene 高度测量规则

scroll scene 的高度测量必须按“布局足迹”完成，而不是按视觉变换结果完成。

1. 参与测量的是正常布局内容。
2. 不参与测量的是：
   - fixed layer scaffolding
   - overlay / portal host
   - debug 基础设施
   - 仅用于 runtime 的辅助节点
3. 新挂载节点、异步资源和布局变化必须重新触发测量。
4. 高度计算不能默认使用 `Math.max(measuredHeight, viewportHeight)` 这类一屏下限。
5. 对于含定位元素的 scene，应以真实布局占位和需要展示的内容边界综合求得最小可展示高度。

### Root Scroll 运行规则

scroll 模式下的根运行规则固定如下：

1. `CineView` 保留真实滚动容器，滚动条读取真实滚动指标。
2. root 不再使用整条 scene track 的 `transform` 作为主页面位移方式。
3. root 不再维护把文档滚动和 zone 进度混合后的全局虚拟滚动坐标；scene 时间轴只能以真实 center-lock 滚动段进入原生 scroll metrics。
4. 文档滚动位置与 zone 进度必须分离：
   - 文档位置决定用户正在阅读页面的哪里
   - zone 进度只决定当前接管动画推进到哪里
5. active scene 必须根据真实布局交集判定，而不是根据虚拟轨道映射结果判定。
6. wheel、touch、keyboard、scrollbar 与 browser-native scroll 都必须先归一为同一种 scroll intent；reducer 先判断该输入是否到达 center-lock 触发点，再判断当前方向是否存在可消费的 `Scene.scroll` progress。
7. scene progress 消费输入时，真实 `scrollTop` 必须沿该 scene 的真实 center-lock 滚动段移动；边界必须来自 rendered bounds、自动结算出的滚动段长度、当前方向和保留 progress，不允许来自 authored height、虚拟轨道或隐藏状态标记。
8. `wheelStep` / `touchStep` / `budget` 不属于 scroll 主 API；像素输入、scene 时间轴滚动段和滚动条展示必须处于同一 px 速率模型。
9. 已完成到 `100%` 的 scene 从后方真实文档流被反向滚回并重新到达 center-lock 滚动段时，视觉 shell 与 scene-scoped fixed layer 必须保持在 viewport 内；任何视觉 offset 只用于渲染补偿，不创建第二套虚拟滚动指标。
10. 一旦某个 scene 成为 progress owner，后续输入按真实 px delta 消费剩余 progress；center-lock trigger 只决定首次获得 ownership，不能在 ownership 期间截短、节流或重算 progress。
11. browser-native scroll 的边界修正或微小回弹不能重置当前 scene progress；只有 progress 到达 `0%` / `100%` 后，runtime 才能按方向释放给自然文档流。
12. native scroll reconciliation 与自绘 scrollbar 也必须走同一个 center-lock segment reducer；不能只修 wheel/touch 路径。

### 首屏与预加载规则

scroll 模式下的首屏体验规则固定如下：

1. 首屏布局、文本和非阻塞表面必须立即可见。
2. 首屏关键媒体可以单独等待或渐入，但不允许整页 `opacity: 0` 式隐藏。
3. 首屏进入可运行态只依赖首屏关键媒体，不依赖相邻 scene 的媒体。
4. 相邻和后续 scene 资源继续后台预加载，不阻塞首屏呈现。
5. preload 负责媒体准备，不负责把整个 viewport 当作遮罩门控。
6. 同一原则适用于后续 scroll 内容：框架不能把普通正文做成“滚到视窗才出现”的门控体验。

### Scrollbar 规则

1. `scrollbar` 的数据源必须是真实滚动容器。
2. 自定义滚动条可以是原生样式化，也可以是自绘视觉层。
3. 无论哪种策略，都不能依附虚拟滚动坐标。
4. scroll-driven scene timeline 必须写入真实 `scrollHeight` 对应的 center-lock 滚动段，使滚动条行程与 scene progress 同速。
5. overlay 若展示 takeover 内部推进，只能读取 native scroll metrics 与 scene progress 的派生值；它不能创建或依附第二套虚拟滚动坐标。

### 产品体验裁决

1. 用户不该先学“viewport runtime”才能写 scroll 页面。
2. 用户应先写正常页面结构，再声明哪一段接管滚动。
3. 短 scene、小 section、混合长短内容，必须是一等支持对象。
4. 滚动接管必须是局部能力，且优先级始终是 `动画执行 -> 文档滚动`。
5. `Animate` 必须能在普通文档节点中直接工作，而不是强制依赖 `Scene`。
6. public API 以 `CineView + Scene + Scene.scroll + Animate + Position` 为主，直接删除显式 `Viewport` 或 `ScrollZone` scroll authoring 路径。
7. scroll 阅读体验必须优先保证内容连续可读；即使快速滚动，也不应出现正文先被隐藏、再在视窗边界突然出现的框架默认行为。

### 受影响的实现点

1. `CineView` 根接口需要承接 `mode` 与 `scroll` 配置。
2. `Scene` scroll 样式中的 `minHeight: 100vh` 需要移除为默认假设。
3. `Animate` 与 `Position` 的基础能力需要支持在普通文档节点中直接运行。
4. scroll runtime 需要改回真实滚动容器，而不是虚拟 track + transform。
5. `scrollActiveSceneIndex` 与 zone ownership 的判定，需要基于真实布局与交集。
6. `Scene.scroll` 需要成为唯一主公共 takeover 语义；`Viewport` 与 `ScrollZone` 不作为 scroll runtime 兼容路径保留。
7. `Position.fixed` 的 host 坐标与裁剪逻辑需要与 scene 边界严格对齐。

## 新模式参数原则

1. 模式只在 `CineView` 根节点声明：
   - `mode="drag" | "scroll"`
   - 模式参数分别归入 `drag` / `scroll` 对象
2. 模式参数只在对应模式生效：
   - `drag` 参数不影响 `scroll`
   - `scroll` 参数不影响 `drag`
3. `Scene` 只承接布局与内容参数：
   - `sceneWidth`
   - `sceneHeight`
   - `sceneAnchor`
   - `sceneZIndex`
   - `sceneOverflow`
   - `sceneStackMode`
   - 对外声明层面统一对应为 `layout` / `stack` / `transition` / `assets` / `callbacks`
4. `scroll` 模式下不再默认要求 `sceneHeight = 100vh`。
5. 性能运行态统一为：
   - `inactive`
   - `entering`
   - `active`
   - `exiting`
   - `covered`
   - `parked`

当 scene 或 element 处于 `covered / inactive / parked / exiting` 时，默认停止持续动画。

## 当前代码评定

以下评定基于当前实现代码，而不是只基于目标规格。

### 设计漏洞

1. **模式职责仍然错位**
   - 当前实现仍以 `Scene.slideMode` 作为很多判断前提，导致 root-level `mode` 设计尚未真正落地。
   - `CineView` 内部仍通过“所有 scene 都是 scroll”来推断 scroll 引擎是否启用，这会让混合内容与根模式设计相互冲突。
2. **public API 与 runtime 结构耦合过深**
   - 当前 scroll 设计把 `Viewport`、scene transition length、element phase window 等内部机制直接暴露给业务作者，学习成本过高。
3. **同一业务逻辑字段散落**
   - 滚动节奏、滚动驱动、可视驱动、场景切换、滚动倍率、重播策略、滚动预算，分散在 `CineView`、`Scene`、`Animate` 三层。
4. **存在失真风险的坐标体系**
   - 当前 `Position` 仍以单一 `designSize` 推导横纵坐标，不适合真实的宽高分离设计稿。
5. **存在“名义 API”**
   - 当前如 `triggerAnimation` 这类能力，文义上是公共方法，但缺少稳定的真实运行模型，不应继续作为主推荐接口。

### 易用性问题

1. 用户需要同时理解 `mode`、`slideMode`、`scrollDriven`、`Viewport`、`scrollPhaseStart/End`，认知负担过高。
2. 同一类设置缺少对象分组，字段平铺过多，导致入门用户很难知道哪些参数是常用，哪些是高级。
3. `Animate` 的 scroll 能力需要用户先理解 runtime budget，违背“先写内容，再声明接管”的体验目标。
4. `Scene` 目前既承接布局，又承接模式，又承接滚动策略，边界不清晰。
5. root 层缺少 scrollbar 统一入口，无法以框架级方式控制滚动条观感和品牌一致性。

### 性能与维护风险

1. **scroll 高度测量过重**
   - 当前 scroll 高度测量会遍历 scene 全部后代并为大量节点挂 `ResizeObserver`，在内容复杂时成本过高。
2. **scroll 动画宿主查找过重**
   - 当前 `Animate` 在 scroll 下通过 DOM 查询自身宿主，且会随 scroll runtime 更新重复执行，不够优雅。
3. **React state 与 runtime state 重叠**
   - `virtualScroll`、`viewportStates`、scene runtime、interaction snapshot 多处并存，容易产生重复更新和维护负担。
4. **Scene 内部 props 爆炸**
   - `SceneInternalProps` 已经远超合理规模，说明 runtime 信息和 public props 没有正确分层。
5. **scroll 预算计算和渲染更新耦合**
   - budget 变化、zone ownership、scene visibility 都在同一大容器里协同，后续优化会越来越困难。

### 收口原则

1. public API 必须比 runtime 简单一层。
2. 模式参数全部挂在 root。
3. 同一语义的字段必须放进同一个对象。
4. 默认值优先服务“最常见页面”，高级控制延后暴露。
5. 任何 mode 专属字段，不允许泄漏到其他 mode 的主接口表面。

### 渐进式参数分级

1. **Level 1: 开箱即用**
   - `config`
   - `mode`
   - `children`
2. **Level 2: 常用调优**
   - `modes.drag`
   - `modes.scroll`
   - `scrollbar`
3. **Level 3: 运行时与观测**
   - `callbacks`
   - `performance`
   - `ref methods`
4. **Level 4: 高级动画编排**
   - `Scene.scroll`
   - `Animate.timeline`
   - 预算覆盖、依赖链、相位窗口

### 默认值策略

1. `mode` 默认 `drag`
2. `modes.drag.direction` 默认 `y`
3. `modes.drag.transitionDuration` 默认 `800`
4. `modes.scroll.direction` 默认 `y`
5. `modes.scroll.zoneTrigger` 默认 `center-lock`
6. `scrollbar` 默认禁用
7. `performance.preset` 默认 `balanced`

## 接口切换计划

本节定义 scroll 从当前实现切换到新接口体系的真实执行计划。目标是直接切换到新的 scroll 心智模型，而不是长期保留兼容桥与双轨运行时。

### 迁移目标

1. 把模式入口从 `Scene` 提升到 `CineView`
2. 把平铺参数收束成 `modes`、`callbacks`、`performance`、`scrollbar` 等对象
3. 删除 scroll 模式下的 `Viewport` 公共 API 与 active runtime path
4. 把 `Animate` 的 scroll 语义从布尔字段迁到 `timeline` 语义
5. 把 `Position` 与 `config` 从单轴 `designSize` 迁到双轴 `width` / `height`
6. 保持切换过程可验证，并在完成后只留下新口径

### 高风险断点

1. `Scene.slideMode` / `slideDirection` / `slideDuration` 向 root 迁移
2. `scrollSpeed`、`scrollEnterLength`、`scrollHoldLength`、`scrollExitLength` 等旧 scroll 参数的去场景化
3. 从 `<Viewport>` / `ScrollZone` 语义收束到 `Scene.scroll`
4. `Animate.scrollDriven`、`scrollPhaseStart`、`scrollPhaseEnd` 向 `timeline` 迁移
5. `designSize` 向 `designWidth` / `designHeight` 迁移
6. 平铺 callbacks / ref methods 向分组 callbacks / 精简 methods 迁移

### 直接切换策略

scroll 重构采用直接切换策略：

1. 删除虚拟滚动轨道主路径
2. 删除 root 级全局虚拟滚动坐标主路径
3. 删除整页首屏 gate 主路径
4. 删除 `ScrollZone` 作为 scroll 主公共语义
5. 只保留必要的类型、构建、测试与浏览器验收，不保留旧心智模型、旧参数或旧 runtime 兼容路径

### Phase 1: 统一契约

**目标**

- 先让 `design.md`、`requirements.md`、未来目标 API 三者只说一套话

**范围**

- 文档层，不先动运行时

**主要动作**

1. 明确 `CineView.mode` 为唯一模式入口
2. 明确 `Scene.scroll` 为 scroll 主公共语义
3. 明确 `Scene` 不再承载 mode-specific 配置
4. 明确 scroll scene 可小于 `100vh`

**验证**

1. 文档内不再同时出现相互冲突的 scroll 公共语义
2. 文档内不再把 `Scene.slideMode` 当成现行方案

### Phase 2: 类型切换

**目标**

- 让新的公共接口能在类型层表达
- 删除旧 scroll 主路径的公共类型心智负担

**主要文件**

- `src/types/index.ts`

**主要动作**

1. 新增 root-first `CineViewProps`
2. 新增 `modes.drag` / `modes.scroll`
3. 新增 `scrollbar`、`callbacks`、`performance`
4. 把 `SceneProps` 改成 `layout` / `stack` / `transition` / `assets` / `callbacks`
5. 去掉 `ScrollZoneProps` 作为主入口类型要求
6. 让 `Scene.scroll` 成为唯一主推荐 takeover 类型入口

**验证**

1. TypeScript 编译通过
2. 新接口能完整表达需求稿中的目标配置
3. scroll 主文档类型只保留新心智模型

### Phase 3: Root Runtime 接管模式

**目标**

- 真正把 `drag` / `scroll` 的模式判定交给 `CineView`

**主要文件**

- `src/components/CineView/CineView.tsx`
- `src/hooks/useSceneManager.ts`

**主要动作**

1. 去掉通过每个 Scene 推断根模式的逻辑
2. 用 `CineView.mode` 和 `modes.*` 直接驱动 root engine
3. 把 scroll 的全局输入倍率与激活规则移到 root
4. 为 `scrollbar` 注入 root 级样式与默认值

**验证**

1. `drag` / `scroll` 两模式只走自己的引擎分支
2. scroll 下短 scene 不会被默认抬成一屏
3. root 级 `scrollbar` 开关和默认样式生效

### Phase 4: Scene 降载

**目标**

- 把 `Scene` 从模式承担者还原为 section / layer host / layout 容器

**主要文件**

- `src/components/Scene/Scene.tsx`
- `src/components/Scene/types.ts`

**主要动作**

1. 移除 `Scene` 上的 mode-specific 主配置
2. 收缩 `SceneInternalProps`
3. 保留 scene-scoped fixed layer、布局、可视信息与 scene transition

**验证**

1. scene-scoped fixed layer 行为不回归
2. `onVisibilityChange` / scene 可视语义不回归
3. Scene 边界、缝隙、固定层释放逻辑稳定

### Phase 5: Scene.scroll Public API 落地

**目标**

- 用 `Scene.scroll` 直接取代并删除 `Viewport` / `ScrollZone` scroll 写法

**主要文件**

- `src/components/Viewport/*`
- `src/components/Scene/*`
- `src/components/Animate/useAnimateScroll.ts`

**主要动作**

1. 收束 takeover 注册逻辑到 `Scene.scroll`
2. 移除 `ScrollZone` 作为主公共入口和 active runtime path
3. 迁移 orphan warning 与预算注册逻辑到新的 public 语义
4. 让 scene-owned takeover 成为唯一主叙述

**验证**

1. zone 激活、预算结算、回退逻辑通过
2. `Scene.scroll` 成为文档和类型主入口
3. scroll 主文档、示例和 active runtime 不再依赖 `Viewport` 或 `ScrollZone`

### Phase 6: Animate 语义迁移

**目标**

- 让 `Animate` 从平铺 scroll 字段升级到 `timeline` / `visibility` 语义

**主要文件**

- `src/components/Animate/Animate.tsx`
- `src/components/Animate/useAnimateScroll.ts`
- `src/components/Animate/useAnimateDrag.ts`

**主要动作**

1. 新增 `duration` 对象
2. 新增 `timeline` 对象
3. 新增 `visibility` 对象
4. 把 `scrollDriven` 映射到 `timeline.driver='scroll'`
5. 把 `scrollPhaseStart` / `scrollPhaseEnd` 映射到 `timeline.phase`

**验证**

1. scroll-driven 动画与 visibility-driven 动画分工正确
2. 只有可视驱动元素才按可视规则自动进入/退出
3. delay / waitFor / enter / exit 的预算换算正确

### Phase 7: Position 与双轴设计基准

**目标**

- 修正 `Position` 的单轴缩放问题

**主要文件**

- `src/components/Position/Position.tsx`
- `src/context/CineViewContext.tsx`
- `src/types/index.ts`

**主要动作**

1. `config.designSize` 迁移到 `config.width` / `config.height`
2. `Position` 迁移到 `at` / `layer` 对象
3. 区分横向和纵向换算

**验证**

1. 绝对定位与相对定位仍正确
2. fixed layer 坐标在 scroll 场景边界处稳定
3. 宽高比变化时不再依赖单轴碰运气

### Phase 8: 删除旧口径

**目标**

- 完成公共接口清理

**主要文件**

- `src/types/index.ts`
- `src/components/CineView/CineView.tsx`
- `src/components/Scene/Scene.tsx`
- `src/components/Animate/*`
- `src/components/Position/Position.tsx`

**主要动作**

1. 删除旧 `slideMode` 主入口
2. 删除旧平铺 scroll 参数
3. 删除主文档里的 `Viewport` 推荐口径
4. 删除 `triggerAnimation` / `reload` 主推荐语义

**验证**

1. 全量 TypeScript 编译
2. 构建通过
3. 关键单测通过
4. 真实前端验收通过

### 每阶段验收顺序

1. 先验契约一致性
2. 再验类型可表达性
3. 再验 root engine 行为
4. 再验 scroll 基础行为
5. 最后验直接切换后的回归与例子一致性

### 本计划的执行原则

1. 不先改运行时再补文档
2. scroll 不保留旧主路径与新主路径并存
3. 不在没有阶段验收的情况下跨阶段并改
4. 前端交互阶段必须由独立 agent 在真实环境（浏览器 lane）实测验收，不能只靠代码推理或单测结案；实现 agent 与验收 agent 分离，验收必须是真实环境测试而非自检

## 开发原则

### 1. 不靠猜测修问题

drag 链路的所有问题排查必须优先依赖：

- 状态所有权
- 时间轴语义
- 关键节点日志
- 可复现的 performance-test 案例

禁止通过“多试几个判断分支”或“猜测某个 progress 应该是多少”来修复问题。

### 2. 关键状态必须有唯一所有者（双轨模型，2026-06-25 起）

drag 模式不再用「单一全局 `sharedElapsedMs` 标量在 commit 时从旧场景交给新场景」的模型——那条交接缝被反复改错 ≥4 次。现拆成**两条独立轨道**：

- **render 轨（全局）`renderProgress`**：只由 drag 手势与 release 位移动画维护。驱动页面 translate。**它是 commit 的唯一触发器**（页面滑到位即 `commitDragSceneChange`，`currentScene` 切换）。
- **element 轨（每个 Scene 实例自持，单写者=该 scene）`elementElapsedMotion`**：每个 Scene 持有**自己**的 `MotionValue<number>` = 本场景入场时间轴 `T = delay+duration` 的 elapsed ms（`T` 由该场景自己的 `getTimelineDuration()` 算得）。**只有该 scene 的 `useElementTrack` 写它**，跨 scene 零共享写。
  - 拖拽跟手：incoming scene `elapsed = r × T_self`。
  - release 续跑：outgoing 在释放瞬间发布只读指令 `dragRelease`，incoming scene 据此 `animate(current → T_self)`，与 render 轨**各自时钟并行**。
  - 跨 commit：scene 实例 `key={index}` 稳定不重挂，in-flight `animate()` 不被打断 → **连续补完，非重播、非冻结**。
- **`dragRelease`（全局只读指令，非多写者标量）**：`{ token, mode:'settle'|'bounce', direction, targetSceneIndex }`，取代已删除的 `dragTransitionSnapshot`。outgoing 的 `handlePanEnd` 发布；incoming 单向消费。

单写者不变式：`renderProgress` 仅 render lane 写；每个 scene 的 `elementElapsedMotion` 仅该 scene 自己写。**若发现任何新增的跨 scene 共享写路径，立即停手——那正是反复回归的根因。**

> ⚠️ 已删除的旧机制（不要恢复）：`useSceneManager.sharedElapsedMs`、`dragTransitionSnapshot`、`needsSettleCompletion`、`clearDragTransitionSnapshot`、`useDragSceneEngine` 的 activation-settle effect、`useAnimateDrag` 的 `settling`/`firstSceneEnterActive` 分支、CineView 全局 cold-start tween。scroll 模式的 `scrollTransitionSnapshot` 与本次无关，**不触碰**。

### 3. 关键日志必须覆盖 ownership handoff

后续 drag 开发中，以下节点必须保持可追踪日志：

- drag start
- drag progress sample
- threshold decision
- release render tick（render 轨）
- element track tick（element 轨：跟手 / release 续跑 / cold-start）
- commit start / commit done
- element-track settle complete（incoming 轨到 T → `completeDragTransition` 触发 deferred `onSceneDidChange`）

日志的目标不是“多”，而是能回答这几个问题：

1. 某个 scene 的 `elementElapsedMotion` 此刻是谁在写（必须只有该 scene 自己）
2. 当前 `renderProgress` 是否已滑到位（commit 是否该触发）
3. 当前场景和目标场景谁应该处于可动画状态
4. 某个具体元素为什么没有开始、为什么被跳过、为什么直接到终态

### 4. 先恢复行为基线，再做架构迁移

当重构引发行为回归时，优先级顺序必须是：

1. 恢复用户已确认正确的行为基线
2. 用日志确认旧链路和新链路的所有权边界
3. 在行为稳定后继续做架构拆分

不能为了追求最终架构，一次性替换整条 drag 链路而牺牲当前可用性。

## 架构

### 系统架构图

```mermaid
graph TD
    A[CineView 容器组件] --> B[响应式尺寸计算引擎]
    A --> C[场景管理器]
    A --> D[事件系统]
    A --> E[图片预加载器]
    
    C --> F[Scene 场景组件]
    F --> G[滑动控制器]
    F --> H[场景动画控制器]
    F --> R[Drag 引擎]
    
    F --> I[Animate 动画组件]
    F --> J[Position 定位组件]
    
    I --> K[动画库集成层]
    I --> L[动画延迟关联管理器]
    
    R --> I
    
    B --> M[尺寸换算上下文]
    M --> J
    M --> F
    
    E --> N[首屏图片加载]
    E --> O[后续场景静默加载]
    
    D --> P[生命周期事件]
    D --> Q[API 方法]
```

### 组件层级关系

```mermaid
graph TD
    A[CineView] --> B[Scene 1]
    A --> C[Scene 2]
    A --> D[Scene N]
    
    B --> E[Animate]
    B --> F[Position]
    B --> G[自定义内容]
    
    E --> H[子元素]
    F --> I[子元素]
    
    C --> J[Animate]
    C --> K[Position]
    
    style A fill:#e1f5ff
    style B fill:#fff4e1
    style C fill:#fff4e1
    style D fill:#fff4e1
    style E fill:#e8f5e9
    style F fill:#e8f5e9
```

### 数据流图

#### Drag 模式数据流（elapsed-time 驱动）

```mermaid
sequenceDiagram
    participant User as 用户交互
    participant SC1 as Scene 1 (当前)
    participant SC2 as Scene 2 (下一个)
    participant DE as Drag Engine
    participant A1 as Animate 组件 (Scene 1)
    participant A2 as Animate 组件 (Scene 2)
    participant TH as 智能阈值判断器
    
    Note over SC1: Drag 模式下 Scene 不执行 enter/exit 视觉动画
    Note over A1,A2: 每个 Scene 持有自己的 element 轨（elementElapsedMotion），元素只读本场景的轨
    
    User->>SC1: 开始拖拽 (onDragStart)
    SC1->>SC1: 创建/维护全局 renderProgress（render 轨）
    SC1->>A1: 注册到 animateRegistry
    SC2->>A2: 注册到 animateRegistry，计算 delay；SC2 持有自己的 element 轨
    
    loop 拖拽过程中
        User->>SC1: 拖拽移动 (onDrag)
        SC1->>DE: 计算全局 renderProgress（render 轨，驱动页面位移）
        SC2->>SC2: useElementTrack 跟手写 element 轨 elapsed = r × T_self
        
        par 实时动画同步
            DE->>A1: 当前场景元素按 render 位移映射退场进度
            Note over A1: 当前场景仅负责元素退场（读 render 位移），不做 Scene 级补间
            
            A2->>A2: incoming 元素读 SC2 自己的 element 轨算 localProgress
            Note over A2: localProgress = f(element轨.elapsed, delay, duration)
            Note over A2: 元素未到 delay 前保持 initial
        end
    end
    
    User->>SC1: 释放拖拽 (onDragEnd)
    SC1->>TH: 获取速度和进度
    TH->>TH: 综合累计位移方向 + 末端反向速度判定
    
    alt 进度 > 阈值 (切换)
        SC1->>DE: 发布 dragRelease{mode:settle}（释放瞬间，并行）
        par 两条独立时钟并行
            DE->>SC1: render 轨 renderProgress → 目标页（∝ slideDuration，唯一 commit 触发器）
            SC2->>SC2: element 轨 animate(current → T_self)（∝ T−elapsed，真实速率，自驱）
        end
        Note over SC1: render 轨滑到位 → commitDragSceneChange，currentScene++（deferred onSceneDidChange）
        Note over SC2: element 轨跨 commit 不重挂、不打断、连续补完到 T_self
        SC2->>SC1: element 轨到 T_self → completeDragTransition 触发 deferred onSceneDidChange
        SC1-->>User: 场景切换完成
        
    else 进度 <= 阈值 (回弹)
        SC1->>DE: 发布 dragRelease{mode:bounce}
        par 一起平滑回 0
            DE->>SC1: render 轨 renderProgress → 0
            SC2->>SC2: element 轨 animate(current → 0)
        end
        SC1-->>User: 回弹完成（incoming 内容连同被推回未入场态）
    end
```

#### 双向拖拽数据流

```mermaid
sequenceDiagram
    participant User as 用户交互
    participant SC1 as Scene 1 (上一个)
    participant SC2 as Scene 2 (当前)
    participant DE as Drag Engine
    
    Note over SC2: 场景状态: active
    Note over SC2: sceneOffset = 0
    Note over SC1: sceneOffset = -1
    
    User->>SC2: 向后拖拽 (向下滑动)
    SC2->>DE: 计算负向 renderProgress（render 轨）
    
    par 双向动画同步
        DE->>SC2: 当前场景元素按 render 位移执行退场或回退
        SC1->>SC1: 上一场景（incoming）读自己的 element 轨重新进入
    end
    
    User->>SC2: 释放拖拽
    
    alt 超过阈值 (返回上一场景)
        Note over SC2,SC1: Scene 自身仅分页位移，视觉动画全部由 Animate 完成
        
    else 未超过阈值 (回弹)
        Note over SC2,SC1: 各元素按本地时间轴回退
    end
```

## 组件和接口

### 组件 1: CineView（顶级容器组件）

**目的**: 提供全局配置上下文，作为唯一模式入口，并承接模式配置、滚动条配置、性能策略和统一回调

**接口**:
```typescript
interface CineViewProps {
  config: CineViewDesignConfig;
  mode?: 'drag' | 'scroll'; // default: 'drag'
  modes?: {
    drag?: DragModeConfig;
    scroll?: ScrollModeConfig;
  };
  scrollbar?: false | ScrollbarConfig;
  callbacks?: CineViewCallbacks;
  performance?: CineViewPerformanceConfig;
  children: React.ReactNode;
}

interface CineViewDesignConfig {
  width: number;                     // 设计稿宽度
  height: number;                    // 设计稿高度
  unit?: 'px' | 'rem' | 'vw';        // default: 'px'
}

interface DragModeConfig {
  direction?: 'x' | 'y';             // default: 'y'
  transitionDuration?: number;       // default: 800
  threshold?: {
    minVelocity?: number;
    maxVelocity?: number;
    minRatio?: number;
    maxRatio?: number;
    reboundDuration?: number;
  };
}

interface ScrollModeConfig {
  direction?: 'x' | 'y';             // default: 'y'
  zoneTrigger?: 'center-lock';       // default: 'center-lock'
  sceneSizing?: 'content' | 'screen'; // default: 'content'
}

interface ScrollbarConfig {
  enabled?: boolean;                 // default: false
  width?: number;                    // default: 6
  radius?: number;                   // default: 999
  inset?: number;                    // default: 0
  trackColor?: string;               // default: 'transparent'
  thumbColor?: string;               // default: 'rgba(255,255,255,0.28)'
  thumbHoverColor?: string;          // default: 'rgba(255,255,255,0.42)'
  autoHide?: boolean;                // default: true
}

interface CineViewCallbacks {
  common?: {
    onReady?: (api: CineViewRef) => void;
    onLoadProgress?: (progress: number) => void;
    onSceneWillChange?: (detail: SceneChangeDetail) => void;
    onSceneDidChange?: (detail: SceneChangeDetail) => void;
    onInteractionStateChange?: (detail: InteractionStateDetail) => void;
    onLayoutMeasured?: (detail: LayoutMeasuredDetail) => void;
    onError?: (detail: CineViewErrorDetail) => void;
  };
  drag?: {
    onDragStart?: (detail: DragDetail) => void;
    onDragProgress?: (detail: DragDetail) => void;
    onDragCommit?: (detail: DragCommitDetail) => void;
    onDragCancel?: (detail: DragDetail) => void;
  };
  scroll?: {
    onZoneEnter?: (detail: ZoneDetail) => void;
    onZoneLeave?: (detail: ZoneDetail) => void;
    onZoneProgress?: (detail: ZoneProgressDetail) => void;
    onSceneVisibilityChange?: (detail: SceneVisibilityDetail) => void;
  };
}

interface CineViewPerformanceConfig {
  preset?: 'balanced' | 'smooth' | 'strict'; // default: 'balanced'
  virtualization?: 'auto' | 'off';
  measurement?: 'observer' | 'manual';
  monitor?: boolean;
}

interface CineViewRef {
  goToScene: (index: number, animated?: boolean) => void;
  goToZone?: (
    zoneId: string,
    options?: { align?: 'center'; animated?: boolean }
  ) => void;
  refreshLayout?: () => void;
  preload?: (targets?: Array<number | string>) => Promise<void>;
  getCurrentScene: () => number;
  getPerformanceMetrics: () => PerformanceMetrics;
}
```

**职责**:
- 创建响应式尺寸换算上下文
- 作为 `drag / scroll` 的唯一模式入口
- 统一托管 mode-specific 默认值
- 注入和托管 scrollbar 样式
- scroll 模式启用框架滚动条时，浏览器原生滚动条必须默认视觉隐藏；框架只保留真实 native scroll 指标，不提供 native/overlay 多策略分支。
- 框架自绘 scrollbar 默认贴合视口边缘；只有显式配置 `inset` 时才向内收缩。
- 管理场景注册、布局测量、事件分发和预加载
- 暴露以“导航 / 刷新 / 观测”为主的稳定 API

**产品裁决**:

1. 废弃平铺的 `scrollWheelStep`、`scrollTouchStep`、`performanceMode` 这类 root 字段，统一进入对象。
2. 废弃 `triggerAnimation`、`reload` 作为主推荐方法：
   - `triggerAnimation` 不稳定，不适合作为框架级公共承诺
   - `reload` 语义过粗，应拆成 `refreshLayout` 与 `preload`
3. `scrollbar` 必须根注册：
   - 默认关闭
   - 开启时由 root 注入样式变量和默认样式
   - 默认样式保持克制、细条、自动隐藏

### 组件 2: Scene（场景组件）

**目的**: 表示一个场景 section，负责内容布局、可视边界和 scene-owned layer 宿主

**接口**:
```typescript
interface SceneProps {
  sceneId?: string;
  layout?: {
    width?: number | string;
    height?: number | string;
    anchor?: SceneAnchor;
    overflow?: 'visible' | 'hidden' | 'clip';
  };
  stack?: {
    mode?: 'replace' | 'cover';
    zIndex?: number;
  };
  transition?: {
    enterAnimation?: AnimationType;
    exitAnimation?: AnimationType;
    exitDuration?: number;
  };
  assets?: {
    preloadImages?: string[];
  };
  callbacks?: {
    onVisibilityChange?: (detail: SceneVisibilityDetail) => void;
  };
  children: React.ReactNode;
}

interface DragThresholdConfig {
  minVelocity?: number;      // 最小速度（px/s），默认 0
  maxVelocity?: number;      // 最大速度（px/s），默认 1000
  minThreshold?: number;     // 最小阈值（快速滑动），默认 0.15
  maxThreshold?: number;     // 最大阈值（慢速滑动），默认 0.3
  animationDuration?: number; // 完成/回弹动画时长（秒），默认 0.8
}

type AnimationType = 
  | PresetAnimation
  | CustomAnimation
  | ComposedAnimation;

// 预设动画类型
type PresetAnimation =
  // 基础动画
  | 'fade'              // 淡入淡出
  | 'fade-in'           // 淡入
  | 'fade-out'          // 淡出
  // 滑动动画
  | 'slide-up'          // 向上滑动
  | 'slide-down'        // 向下滑动
  | 'slide-left'        // 向左滑动
  | 'slide-right'       // 向右滑动
  // 缩放动画
  | 'zoom-in'           // 放大
  | 'zoom-out'          // 缩小
  | 'scale-up'          // 放大（弹性）
  | 'scale-down'        // 缩小（弹性）
  // 旋转动画
  | 'rotate'            // 旋转
  | 'rotate-in'         // 旋转进入
  | 'rotate-out'        // 旋转退出
  | 'spin'              // 持续旋转
  // 翻转动画
  | 'flip'              // 翻转
  | 'flip-x'            // 水平翻转
  | 'flip-y'            // 垂直翻转
  // 弹跳动画
  | 'bounce'            // 弹跳
  | 'bounce-in'         // 弹跳进入
  | 'bounce-out'        // 弹跳退出
  // 闪烁动画
  | 'blink'             // 闪烁
  | 'flash'             // 快速闪烁
  | 'pulse'             // 脉冲
  // 抖动动画
  | 'shake'             // 抖动
  | 'shake-x'           // 水平抖动
  | 'shake-y'           // 垂直抖动
  | 'vibrate'           // 震动
  | 'jello'             // 果冻抖动
  // 模糊动画
  | 'blur-in'           // 模糊进入
  | 'blur-out'          // 模糊退出
  | 'focus-in'          // 聚焦进入
  // 弹性动画
  | 'elastic'           // 弹性
  | 'rubber-band'       // 橡皮筋
  | 'wobble'            // 摇摆
  | 'swing'             // 摆动
  // 特殊效果
  | 'heartbeat'         // 心跳
  | 'tada'              // 惊喜
  | 'wave'              // 波浪
  | 'roll-in'           // 滚动进入
  | 'roll-out'          // 滚动退出
  | 'hinge'             // 铰链
  | 'jack-in-the-box'   // 弹簧盒
  // 无动画
  | 'none';

// 自定义动画
interface CustomAnimation {
  initial?: Record<string, unknown>;
  animate?: Record<string, unknown>;
  exit?: Record<string, unknown>;
}

// 组合动画
interface ComposedAnimation {
  animations: (PresetAnimation | CustomAnimation)[];
  mode?: 'sequential' | 'parallel';  // 顺序执行 | 并行执行
  delay?: number[];                   // 每个动画的延迟（仅 sequential 模式）
}

// Framer Motion 变体
type FramerMotionVariant = {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
};
```

**职责**:

- 承载章节级布局与内容
- 提供 scene-scoped fixed layer 宿主
- 暴露 scene 可视与边界信息
- 在需要时承载 scene 级导航、生命周期与 takeover 所有权
- 不再负责声明根模式

**产品裁决**:

1. `Scene` 不再接受 `slideMode`、`slideDirection`、`scrollSpeed`、`scrollEnterLength`、`scrollHoldLength`、`scrollExitLength` 等 mode 配置。
2. `Scene` 不是 scroll 页面普通内容的必选容器。
3. `Scene` 只保留布局、堆叠、资源和可视回调。
4. `Scene` 的 transition 只描述 scene 自身动画，不再背负 scroll engine 参数。

### 组件 2.5: Scene.scroll（局部滚动接管声明）

**目的**: 在 `Scene` 上声明该 scene 会在 scroll 模式下接管局部滚动，并为内部 scroll-driven 动画提供统一时间轴

**接口**:
```typescript
interface SceneScrollConfig {
  zoneId?: string;
  trigger?: 'center-lock';             // default: 'center-lock'
}
```

**职责**:

- 提供 scroll 模式下的 scene-owned 局部时间轴入口
- 负责 takeover 激活、真实滚动距离消费和回退
- 正向接管时发布 `0% -> 100%` 进度，完成后释放给自然文档流
- 从后方真实文档流反向回到同一个 center-lock 触发位置时，以保留的 `100%` 状态继续发布 `100% -> 0%` 进度
- 在 scene progress 到达 `0%` 或 `100%` 前阻止 native document flow 越过当前 ownership 边界
- 作为 `Animate.timeline.driver='scroll'` 的归属声明

### 模式说明

1. **拖拽模式 (drag)**:
   - 由 `CineView mode="drag"` 启用
   - 阈值、回弹、方向、时长全部进入 `modes.drag`
   - `Scene` 与 `Animate` 只消费 drag 时间语义，不再持有 drag 配置

2. **滚动模式 (scroll)**:
   - 由 `CineView mode="scroll"` 启用
   - 页面首先是真实文档流
   - `Scene` 只在需要章节级能力时出现
   - 输入 ownership 固定为 `可消费 Scene.scroll progress -> 文档滚动`
   - `Scene.scroll` 是唯一推荐的局部滚动接管语义

### 组件 3: Animate（动画组件）

**目的**: 为子元素提供统一动画语义，并以渐进方式支持 scene、scroll、visibility 三类驱动

**接口**:
```typescript
interface AnimateProps {
  animateId?: string;
  enterAnimation?: AnimationType;
  exitAnimation?: AnimationType;
  infiniteAnimation?: AnimationType;
  duration?: {
    enter?: number;                     // default: 800
    exit?: number;                      // default: 800
  };
  timeline?: {
    driver?: 'auto' | 'scene' | 'scroll' | 'visibility'; // default: 'auto'
    delay?: number;                     // default: 0
    waitFor?: string;
    zoneId?: string;
    phase?: {
      start?: number;
      end?: number;
    };
  };
  visibility?: {
    replayOnReenter?: boolean;          // default: true
    enterWhen?: 'fully-visible-bottom'; // default
    exitWhen?: 'leaving-top';           // default
  };
  children: React.ReactNode;
}
```

**自定义动画支持**:

框架支持三种动画方式：

1. **预设动画**:
```tsx
<Animate enterAnimation="shake">
  内容
</Animate>
```

2. **Framer Motion variant subset 自定义动画**:
```tsx
<Animate
  enterAnimation={{
    initial: { opacity: 0, scale: 0.5, rotate: 0 },
    animate: {
      opacity: 1,
      scale: 1,
      rotate: 360,
      transition: {
        duration: 1,
        ease: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }
  }}
>
  内容
</Animate>
```

3. **组合动画**:
```tsx
// 顺序执行：先淡入，再抖动
<Animate
  enterAnimation={{
    animations: ['fade-in', 'shake'],
    mode: 'sequential',
    delay: [0, 500]  // 淡入立即开始，抖动延迟 500ms
  }}
>
  内容
</Animate>

// 并行执行：同时放大和旋转
<Animate
  enterAnimation={{
    animations: ['zoom-in', 'rotate'],
    mode: 'parallel'
  }}
>
  内容
</Animate>

// 混合预设和自定义
<Animate
  enterAnimation={{
    animations: [
      'blur-in',
      {
        animate: {
          y: [-10, 0],
          transition: { duration: 0.5 }
        }
      }
    ],
    mode: 'sequential'
  }}
>
  内容
</Animate>
```

**预设动画库分类**:

- **基础动画**: fade, fade-in, fade-out
- **滑动动画**: slide-up, slide-down, slide-left, slide-right
- **缩放动画**: zoom-in, zoom-out, scale-up, scale-down
- **旋转动画**: rotate, rotate-in, rotate-out, spin
- **翻转动画**: flip, flip-x, flip-y
- **弹跳动画**: bounce, bounce-in, bounce-out
- **闪烁动画**: blink, flash, pulse
- **抖动动画**: shake, shake-x, shake-y, vibrate, jello
- **模糊动画**: blur-in, blur-out, focus-in
- **弹性动画**: elastic, rubber-band, wobble, swing
- **特殊效果**: heartbeat, tada, wave, roll-in, roll-out, hinge, jack-in-the-box
- **无动画**: none

**关联延迟机制说明**:

关联延迟通过 `waitFor` 参数实现，允许一个动画等待另一个动画完全执行完毕后再开始。

**核心概念**:
- **动画实际执行时间** = 延迟时间 + 动画时长
- 关联延迟就是等待前置动画的实际执行时间，然后再加上自己的延迟

**计算公式**:
```
组件的实际开始时间 = 自身 delay + 关联组件的实际执行时间

其中：
关联组件的实际执行时间 = 关联组件的实际开始时间 + 关联组件的动画时长
```

**示例**:
```tsx
// 组件1: 延迟 2s，动画 1s
// 实际开始时间 = 2s
// 实际执行时间 = 2s + 1s = 3s
<Animate animateId="comp1" delay={2000} enterDuration={1000}>
  内容1
</Animate>

// 组件2: 关联组件1，自身延迟 2s，动画 1s
// 实际开始时间 = 2s (自身) + 3s (comp1实际执行时间) = 5s
// 实际执行时间 = 5s + 1s = 6s
<Animate animateId="comp2" waitFor="comp1" delay={2000} enterDuration={1000}>
  内容2
</Animate>

// 组件3: 关联组件2，自身延迟 2s
// 实际开始时间 = 2s (自身) + 6s (comp2实际执行时间) = 8s
<Animate animateId="comp3" waitFor="comp2" delay={2000}>
  内容3
</Animate>
```

**时间轴示意**:
```
时间轴: 0s -------- 2s -------- 3s -------- 5s -------- 6s -------- 8s -------- 9s
        |           |           |           |           |           |           |
        启动        comp1开始   comp1结束   comp2开始   comp2结束   comp3开始   comp3结束
```

**职责**:
- 统一消费当前 mode 的时间语义
- 默认以“最少声明”工作：
  - drag 下默认跟随 scene
  - scroll 下若处于 takeover scene 内则默认绑定该 scene 的 takeover 时间轴，否则默认按 visibility 自动执行
- 在普通文档节点、普通 React 组件和 `Scene` 内都必须可用
- 在 takeover scene 外只有显式声明 `timeline.driver='scroll'` 时，才会触发归属校验并报警
- 负责 delay / waitFor / infinite / replay 等高级动画编排
- `CustomAnimation` 只接受 Framer Motion variant subset，不再接收 Web Animations API `keyframes/options` 格式；动画时长、缓动、延迟写入各 phase 的 `transition`
- legacy 扁平字段只允许在内部 adapter 层归一化，不得重新进入 public authoring 声明

**产品裁决**:

1. `scrollDriven`、`scrollPhaseStart`、`scrollPhaseEnd` 不再继续作为顶层字段推荐，统一归入 `timeline`。
2. `Animate` 不应默认抢占 scroll 时间轴；scroll 高级能力必须显式声明。
3. 默认值要偏向普通用户：
   - 没写 `timeline.driver` 时，不应该意外把元素卷入 scroll takeover 时间轴。

### 组件 4: Position（定位组件）

**目的**: 提供 scene 内定位与 scene-scoped fixed layer 定位，并修正坐标体系的可维护性

**接口**:
```typescript
interface PositionProps {
  at?: {
    x?: number;
    y?: number;
    offsetX?: number;
    offsetY?: number;
  };
  layer?: {
    fixed?: boolean;                    // default: false
  };
  children: React.ReactNode;
}
```

**职责**:
- 从 `CineView.config` 获取宽高设计基准
- 计算响应式定位值
- 处理绝对定位和相对定位的优先级
- 维护相对定位的累加计算链
- 在 scroll 模式下将 `layer.fixed` 绑定到 scene-scoped fixed host

**产品裁决**:

1. `Position` 计算不能再只依赖单一 `designSize`，必须切到 width / height 双轴设计基准。
2. `fixed` 语义应明确属于 `layer` 配置，而不是与坐标字段平铺。

## 数据模型

### 模型 1: CineViewContext

```typescript
interface CineViewContext {
  designWidth: number;
  designHeight: number;
  unit: 'px' | 'rem' | 'vw';
  mode: 'drag' | 'scroll';
  viewportWidth: number;
  viewportHeight: number;
  scaleX: number;
  scaleY: number;
  convertX: (size: number) => number;
  convertY: (size: number) => number;
}
```

**验证规则**:
- designWidth 和 designHeight 必须大于 0
- viewportWidth 和 viewportHeight 必须大于 0
- scaleX 根据 viewportWidth / designWidth 计算
- scaleY 根据 viewportHeight / designHeight 计算

### 模型 2: SceneState

```typescript
interface SceneState {
  currentIndex: number;                 // 当前场景索引
  totalScenes: number;                  // 总场景数
  mode: 'drag' | 'scroll';              // 当前根模式
  isAnimating: boolean;                 // 是否正在 release / settle 动画中
  isDragging: boolean;                  // 是否正在拖拽中（drag 模式）
  dragProgress: number;                 // 拖拽进度 0-1（drag 模式）
  direction: 'forward' | 'backward';    // 切换方向
  sceneStatus: 'initial' | 'entering' | 'active' | 'exiting'; // 场景状态机
  sceneOffset: number;                  // 场景偏移量（0=当前，1=下一个，-1=上一个）
  animateRegistry: Map<string, AnimateInfo>; // 当前场景内注册的 Animate 组件信息
}

interface AnimateInfo {
  delay: number;                        // 元素延迟（ms）
  duration: number;                     // 动画时长（ms）
  waitFor?: string;                     // 关联元素 ID
  calculatedDelay: number;              // 计算后的总延迟（ms）
}
```

**场景状态机**:
```
initial → entering → active → exiting → initial

状态转换规则：
- initial: 场景初始状态或已离开状态
- entering: 场景正在播放入场动画
- active: 场景入场动画完成，处于活跃状态
- exiting: 场景正在被拖拽或处于释放过渡中（drag 模式）
- 场景离开后必须重置为 initial，保证可重复播放
```

**验证规则**:
- currentIndex 范围: 0 <= currentIndex < totalScenes
- isDragging 为 true 时允许拖拽进度更新（drag 模式）
- dragProgress 范围: 0 <= dragProgress <= 1
- drag 模式下 isAnimating 仅在松手后切换时为 true
- animateRegistry 在场景切换时清空并重新注册
- sceneStatus 必须遵循状态机转换规则
- sceneOffset 用于判断场景位置：0（当前）、1（下一个）、-1（上一个）

### 模型 3: AnimationRegistry

```typescript
interface AnimationRegistry {
  [animateId: string]: {
    status: 'pending' | 'playing' | 'completed';
    startTime: number;              // 实际开始时间（相对于场景激活）
    duration: number;               // 动画时长
    executionTime: number;          // 实际执行时间 = startTime + duration
    waitFor?: string;               // 关联的组件 ID
  };
}
```

**验证规则**:
- animateId 必须唯一
- waitFor 引用的 animateId 必须存在
- 不允许循环依赖（A waitFor B, B waitFor A）
- executionTime = startTime + duration

### 模型 4: PreloadState

```typescript
interface PreloadState {
  totalImages: number;
  loadedImages: number;
  progress: number;                     // 0-100
  firstSceneLoaded: boolean;
  allLoaded: boolean;
}
```

**验证规则**:
- progress = (loadedImages / totalImages) * 100
- firstSceneLoaded 为 true 后，首屏关键媒体进入可运行态；首屏布局本身不依赖该标记才渲染
- loadedImages <= totalImages

## 错误处理

### 错误场景 1: 组件层级错误

**条件**: Scene 不在 CineView 下使用，或 Position 的 scene-scoped 能力在没有 Scene 归属时被请求
**响应**: 开发环境抛出 console.error 警告，生产环境静默失败
**恢复**: 提供清晰的错误信息指导开发者修正组件层级

### 错误场景 2: 循环依赖检测

**条件**: Animate 组件的 waitFor 形成循环依赖
**响应**: 检测到循环依赖时抛出错误，阻止动画执行
**恢复**: 提供依赖链路信息，帮助开发者定位问题

### 错误场景 3: 图片加载失败

**条件**: 预加载的图片 URL 无法访问或加载失败
**响应**: 记录失败的图片 URL，继续加载其他图片
**恢复**: 提供 onLoadError 回调，允许开发者处理失败情况

### 错误场景 4: 无效的场景索引

**条件**: goToScene API 传入超出范围的索引
**响应**: 抛出警告并忽略操作
**恢复**: 限制索引范围在 [0, totalScenes - 1]

## 测试策略

### 单元测试方法

**测试框架**: Jest + React Testing Library

**核心测试用例**:

1. **CineView 组件测试**
   - 验证响应式尺寸换算逻辑
   - 验证事件回调触发时机
   - 验证 API 方法功能
   - 验证上下文正确传递
   - 验证性能模式开关
   - 验证性能指标获取
   - 验证图片预加载流程
   - 验证场景注册和索引管理
   - 验证错误边界处理

2. **Scene 组件测试**
   - 验证场景布局渲染（含小于一屏、等于一屏、大于一屏）
   - **验证 drag 模式（全新改造设计）**：
     - 验证 dragProgress MotionValue 创建和更新
     - 验证拖拽进度计算（0-1 范围）
     - 验证场景状态机转换（initial → entering → active → exiting → initial）
     - 验证智能阈值判断（线性插值算法）
     - 验证快速滑动（>800 px/s）使用 15% 阈值
     - 验证中速滑动（400-800 px/s）使用 20% 阈值
     - 验证慢速滑动（<400 px/s）使用 30% 阈值
     - 验证超过阈值时完成切换动画
     - 验证未超过阈值时回弹动画
     - 验证双向拖拽支持（向前/向后）
     - 验证边界反弹限制（首屏/尾屏 20% 橡皮筋效果）
     - 验证场景离开后重置为 initial 状态
     - 验证 sceneOffset 判断（0=当前，1=下一个，-1=上一个）
     - 验证 sceneTransitionDuration 参数传递
   - 验证场景切换逻辑
   - 验证子 Animate 组件注册表管理（Map<string, AnimateInfo>）
   - 验证滑动方向（x/y）切换
   - 验证图片预加载列表处理
   - 验证边界场景（首页、末页）

3. **Animate 组件测试**
   - 验证动画延迟计算
   - 验证 waitFor 关联机制
   - 验证循环依赖检测
   - 验证无限动画循环
   - **验证在 drag 模式下（全新改造设计）**：
     - 验证 `useTransform(visualMotion, () => resolveVisualState(...))` 单输入映射：每帧由 `resolveVisualState` 解析出 `{mode, localProgress}`，再 lerp `initial → animate`/`exit`
     - 验证延迟门控：`resolveEnterLocalProgress(sharedElapsedMs, calculatedDelay, enterDuration)`——`sharedElapsedMs ≤ calculatedDelay` 时 localProgress 保持 0
     - 验证 waitFor 累加计算：`calculatedDelay = delay + (waitForChain 时长)`
     - 验证未过延迟（`sharedElapsedMs ≤ calculatedDelay`）时保持 initial 状态
     - 验证已过延迟时按 `(sharedElapsedMs − calculatedDelay) / enterDuration` 播放动画
     - 验证智能回退：已过延迟阶段随 sharedElapsedMs 递减对称倒放
     - 验证智能回退：未过延迟阶段保持 initial
     - 验证离开动画由 `mode='outgoing'` 经 `resolveVisualState` 映射 renderProgress
     - 验证入场/续播由 `sharedElapsedMotion` 变化驱动 `updateVisualMotion`
     - 验证场景离开后重置为 initial 状态
     - 验证从 Context 获取 sharedElapsedMs / renderProgress / 场景状态
     - 验证双向拖拽时的动画行为
   - 验证向父级 Scene 注册和注销机制
   - 验证进入/离开动画时间参数
   - 验证所有预设动画类型（40+ 种）
   - 验证自定义动画（Framer Motion variant subset）
   - 验证组合动画（顺序执行）
   - 验证组合动画（并行执行）
   - 验证混合预设和自定义的组合动画
   - 验证组合动画在 drag 模式下的进度控制
   - 验证动画完成回调
   - 验证多个 Animate 组件的协调

4. **预设动画库测试**
   - 验证基础动画（fade 系列）
   - 验证滑动动画（slide 系列）
   - 验证缩放动画（zoom/scale 系列）
   - 验证旋转动画（rotate/spin 系列）
   - 验证翻转动画（flip 系列）
   - 验证弹跳动画（bounce 系列）
   - 验证闪烁动画（blink/flash/pulse）
   - 验证抖动动画（shake/vibrate/jello）
   - 验证模糊动画（blur/focus 系列）
   - 验证弹性动画（elastic/rubber-band/wobble/swing）
   - 验证特殊效果（heartbeat/tada/wave/roll/hinge/jack-in-the-box）

4. **Position 组件测试**
   - 验证绝对定位计算
   - 验证相对定位累加
   - 验证优先级处理（绝对定位优先）
   - 验证响应式换算
   - 验证 x/y 坐标计算
   - 验证 offsetX/offsetY 累加链
   - 验证边界值处理
   - 验证窗口 resize 响应

5. **Hooks 测试**
   - useResponsive: 验证尺寸换算、窗口 resize 监听
   - useSceneManager: 验证场景切换、索引管理、动画状态
   - useAnimationRegistry: 验证动画注册、依赖检测、状态管理
   - useDragProgress: 验证拖拽进度计算、节流处理
   - useImagePreloader: 验证图片加载、进度计算、错误处理

6. **Utils 测试**
   - sizeConverter: 验证各种单位转换、边界值
   - gestureDetector: 验证触摸/鼠标事件检测、方向判断
   - dependencyChecker: 验证循环依赖检测、依赖链分析
   - throttle: 验证节流函数行为
   - debounce: 验证防抖函数行为
   - performanceMonitor: 验证性能指标收集
   - animationParser: 验证自定义动画解析与 variant subset 归一化

7. **动画组合器测试**
   - 验证顺序执行组合动画
   - 验证并行执行组合动画
   - 验证组合动画延迟配置
   - 验证混合预设和自定义动画
   - 验证组合动画进度控制

7. **Context 测试**
   - 验证 Context 创建和传递
   - 验证 Context 更新触发重渲染
   - 验证 Context 默认值

**覆盖率目标**: 90% 以上（语句、分支、函数、行覆盖率均需达到 90%+）

**测试配置**:
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90
    }
  },
  coverageReporters: ['text', 'lcov', 'html']
};
```

### 属性测试方法

**属性测试库**: @fast-check/jest

**属性测试策略**:

1. **尺寸换算属性**
   - 属性: 对于任意设计稿宽高和视口宽高，横纵向换算比例应分别保持一致
   - 生成器: 随机 designWidth/designHeight (300-4000), viewportWidth/viewportHeight (320-3840)

2. **场景索引属性**
   - 属性: 场景切换后，currentIndex 始终在有效范围内
   - 生成器: 随机场景数量 (1-20), 随机切换操作序列

3. **动画延迟属性**
   - 属性: 关联延迟链的实际开始时间等于自身延迟加上所有前置动画的实际执行时间
   - 生成器: 随机动画延迟值 (0-5000ms), 随机动画时长 (100-3000ms), 随机依赖链长度 (1-10)

### 集成测试方法

**测试场景**:

1. **完整滑动流程测试**
   - 初始化 → 首屏加载 → 滑动切换 → 动画播放 → 事件触发

2. **跨平台兼容性测试**
   - 移动端触摸事件
   - PC 端鼠标滚轮事件
   - 不同屏幕尺寸响应式表现

3. **性能测试**
   - 大量场景（20+）的渲染性能
   - 图片预加载内存占用
   - 动画流畅度（60fps）
   - Lighthouse 评分验证（目标 95+）
   - Core Web Vitals 指标测试：
     - LCP (Largest Contentful Paint) < 2.5s
     - FID (First Input Delay) < 100ms
     - CLS (Cumulative Layout Shift) < 0.1
     - INP (Interaction to Next Paint) < 200ms

4. **覆盖率测试**
   - 每次 CI/CD 运行覆盖率检查
   - 覆盖率低于 90% 时构建失败
   - 生成 HTML 覆盖率报告
   - 追踪覆盖率趋势

## 性能考虑

**性能目标**: Lighthouse 评分 95+

### 虚拟化渲染

- scroll 模式默认保持所有 scene 连续挂载，优先保证真实文档流和 takeover 连续性
- 仅在远离 viewport 的场景上允许后续引入保守型卸载策略
- 不允许通过近邻 placeholder shell 改写 scene 布局连续性或 takeover 命中逻辑

### 图片加载策略

- 公共图片组件统一为 `Image`，内部预加载统一由 `useImagePreloader` 管理
- `Image` 默认 `preload = true`，可通过 `preload={false}` 使用浏览器 lazy loading
- `Image` 支持原生 `img` props、`style`、`width` 与 `height`
- `Image` 的数字 `width`、`height` 与数字 style 长度值通过 CineView 双轴上下文换算
- drag 模式预加载当前场景及相邻场景声明的 `assets.preloadImages`
- scroll 模式全局预加载所有 scene 声明的 `assets.preloadImages`
- 图片预加载不阻塞首屏整体布局，也不隐藏普通 scroll 内容

### 动画性能优化

- 使用 CSS transform 和 opacity 实现动画（GPU 加速）
- 避免触发 layout 和 paint 的属性（width, height, top, left）
- 使用 `will-change` 提示浏览器优化（谨慎使用，仅在动画期间）
- **Drag 模式性能优化（全新改造设计）**：
  - 使用 Framer Motion 的 `useMotionValue` + `useTransform` 替代手动插值
  - 拖拽进度更新使用 MotionValue，无需触发 React 重渲染
  - 单输入 `useTransform(visualMotion, () => resolveVisualState(...))`：每帧解析 `{mode, localProgress}` 后 lerp，延迟门控与智能回退由 `resolveEnterLocalProgress` 统一处理，无需额外逻辑
  - `visualMotion` 初始值在 render 阶段由 `resolveVisualState` 同步求得，避免首帧闪烁
  - 所有动画属性（opacity, y, scale, rotate 等）通过同一 `useTransform` 映射
  - 避免使用 Web Animations API 手动控制进度（旧方案）
- 动画帧率控制在 60fps
- 使用 CSS `contain` 属性隔离渲染层

### 防抖和节流

- 滑动事件使用节流（throttle）处理，16ms（60fps）
- 窗口 resize 事件使用防抖（debounce）处理，150ms
- 拖拽进度更新使用 `requestAnimationFrame` 优化

### 代码分割和懒加载

- 预设动画库按需加载（动态 import）
- 预设动画按分类代码分割（基础、滑动、缩放等）
- Vite 自动进行 Tree Shaking
- 使用 `import()` 实现路由级代码分割
- 组合动画按需加载依赖的预设动画

### 内存管理

- 场景切换时清理不可见场景的事件监听器
- 使用 WeakMap 存储组件引用，避免内存泄漏
- 及时取消未完成的图片加载请求
- 限制 animateRegistry 大小，超过阈值时警告

### Bundle 大小优化

- 目标：主包 < 50KB（gzipped）
- Vite 内置 Rollup 进行 Tree Shaking
- 外部化 React 和 React-DOM（peerDependencies）
- 使用 Terser 压缩和混淆代码
- 生产环境移除 console 和 debugger

### 首次内容绘制（FCP）优化

- 首屏关键 CSS 内联
- 避免阻塞渲染的 JavaScript
- 使用骨架屏或加载指示器
- 首屏媒体在预加载完成前显示占位符或渐入态，但不隐藏整个首屏 viewport

### 累积布局偏移（CLS）优化

- 所有图片和媒体元素设置明确的宽高
- 使用 aspect-ratio CSS 属性
- 避免在现有内容上方插入内容
- 动画使用 transform 而非改变布局属性

### 交互延迟（INP）优化

- 拖拽事件处理器使用 passive 监听
- 长任务分割（使用 scheduler.yield 或 setTimeout）
- 避免在主线程执行重计算
- 使用 Web Workers 处理复杂计算（如果需要）

### 性能监控

- 集成 Performance API 监控关键指标
- 提供性能调试模式
- 记录动画帧率和掉帧情况
- 暴露性能指标给开发者

## 安全考虑

### XSS 防护

- 所有用户提供的图片 URL 需要验证协议（http/https）
- 避免直接渲染用户提供的 HTML 内容

### 依赖安全

- 定期更新依赖包，修复已知漏洞
- 使用 npm audit 检查安全问题

### 内容安全策略

- 建议开发者配置 CSP 头，限制资源加载来源

## 代码质量和规范

### 代码清晰性原则

**单一职责原则 (SRP)**:
- 每个组件、函数、模块只负责一个明确的功能
- 组件拆分：CineView（容器）、Scene（场景）、Animate（动画）、Position（定位）各司其职
- 工具函数独立：sizeConverter、gestureDetector、dependencyChecker 等

**命名规范**:

1. **组件命名**:
   - 使用 PascalCase：`CineView`, `Scene`, `Animate`, `Position`
   - 组件文件名与组件名一致：`CineView.tsx`
   - 测试文件：`CineView.test.tsx`

2. **函数命名**:
   - 使用 camelCase：`convertSize`, `detectGesture`, `checkDependency`
   - 事件处理器：`handleSceneChange`, `onDragProgress`
   - 布尔值函数：`isAnimating`, `canStartTransition`, `hasCircularDependency`

3. **常量命名**:
   - 使用 UPPER_SNAKE_CASE：`DEFAULT_SLIDE_DURATION`, `MAX_SCENES`, `ANIMATION_FRAME_RATE`
   - 枚举值：`SlideMode.SNAP`, `SlideMode.DRAG`

4. **类型命名**:
   - 接口使用 PascalCase：`CineViewProps`, `SceneState`, `AnimationRegistry`
   - 类型别名：`AnimationType`, `PresetAnimation`
   - 避免使用 `I` 前缀（不推荐：`ICineViewProps`）

5. **文件命名**:
   - 组件文件：PascalCase（`CineView.tsx`）
   - 工具文件：camelCase（`sizeConverter.ts`）
   - 类型文件：camelCase（`index.ts` 或 `types.ts`）
   - 常量文件：camelCase（`constants.ts`）

### 逻辑复用策略

**自定义 Hooks 复用**:
```typescript
// 响应式尺寸换算
useResponsive({ width: designWidth, height: designHeight, unit })

// 场景管理
useSceneManager(totalScenes, mode)

// 动画注册表
useAnimationRegistry()

// 拖拽进度
useDragProgress(slideDirection)

// 图片组件
<Image src="/hero.png" alt="Hero" width={640} height={360} preload />
```

**工具函数复用**:
```typescript
// 尺寸转换（被多个组件使用）
convertX(size: number, scaleX: number): number
convertY(size: number, scaleY: number): number

// 手势检测（Scene 组件使用）
detectGesture(event: TouchEvent | MouseEvent): GestureType

// 依赖检查（Animate 组件使用）
checkCircularDependency(registry: AnimationRegistry, id: string): boolean

// 节流/防抖（多处使用）
throttle(fn: Function, delay: number): Function
debounce(fn: Function, delay: number): Function
```

**动画预设复用**:
```typescript
// 基础动画构建器
createFadeAnimation(direction: 'in' | 'out'): AnimationConfig
createSlideAnimation(direction: 'up' | 'down' | 'left' | 'right'): AnimationConfig
createScaleAnimation(type: 'in' | 'out', elastic?: boolean): AnimationConfig

// 组合动画构建器
composeAnimations(animations: Animation[], mode: 'sequential' | 'parallel'): ComposedAnimation
```

**Context 复用**:
```typescript
// 全局上下文（避免 prop drilling）
CineViewContext: {
  designWidth, designHeight, unit, scaleX, scaleY, convertX, convertY,
  currentScene, totalScenes, goToScene
}

// Scene 上下文（子组件共享）
SceneContext: {
  mode, isDragging, dragProgress,
  registerAnimate, unregisterAnimate
}
```

### 代码组织原则

**模块化设计**:
- 按功能分层：components / hooks / utils / animations / context / types
- 每个模块独立导出，避免循环依赖
- 使用 barrel exports（index.ts）统一导出

**DRY 原则（Don't Repeat Yourself）**:
- 重复逻辑提取为函数或 Hook
- 相似动画使用工厂函数生成
- 配置项使用常量或枚举

**关注点分离**:
- UI 逻辑与业务逻辑分离
- 动画定义与动画执行分离
- 状态管理与视图渲染分离

### 类型安全

**严格的 TypeScript 配置**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**类型定义规范**:
- 所有公共 API 必须有明确的类型定义
- 避免使用 `any`，使用 `unknown` 或泛型
- 使用联合类型和类型守卫确保类型安全
- 导出所有公共类型供用户使用

### 注释规范

**JSDoc 注释**:
```typescript
/**
 * 转换设计稿横向尺寸为实际尺寸
 * @param size - 设计稿中的尺寸值
 * @param scale - 横向缩放比例
 * @returns 转换后的实际尺寸
 * @example
 * convertX(100, 0.5) // 返回 50
 */
function convertX(size: number, scale: number): number {
  return size * scale;
}
```

**代码注释原则**:
- 注释"为什么"而不是"是什么"
- 复杂算法必须添加注释
- 公共 API 必须有 JSDoc 注释
- 避免冗余注释

### 错误处理规范

**统一的错误处理**:
```typescript
// 自定义错误类
class CineViewError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'CineViewError';
  }
}

// 错误码常量
const ErrorCodes = {
  INVALID_SCENE_INDEX: 'INVALID_SCENE_INDEX',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  INVALID_ANIMATION: 'INVALID_ANIMATION',
  IMAGE_LOAD_FAILED: 'IMAGE_LOAD_FAILED'
} as const;

// 错误处理函数
function handleError(error: Error, context: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[CineView Error] ${context}:`, error);
  }
  // 生产环境可以上报错误
}
```

### 性能优化规范

**React 性能优化**:
- 使用 `React.memo` 避免不必要的重渲染
- 使用 `useMemo` 缓存计算结果
- 使用 `useCallback` 缓存函数引用
- 避免在渲染函数中创建新对象或数组

**代码示例**:
```typescript
// 使用 memo 优化组件
export const Scene = React.memo<SceneProps>(({ children, ...props }) => {
  // 组件实现
});

// 使用 useMemo 缓存计算
const scaleX = useMemo(() => {
  return viewportWidth / designWidth;
}, [viewportWidth, designWidth]);

const scaleY = useMemo(() => {
  return viewportHeight / designHeight;
}, [viewportHeight, designHeight]);

// 使用 useCallback 缓存回调
const handleDrag = useCallback((progress: number) => {
  updateAnimationProgress(progress);
}, [updateAnimationProgress]);
```

## 依赖

### 核心依赖

- **react**: ^18.0.0 - 核心框架
- **react-dom**: ^18.0.0 - DOM 渲染

### 动画库推荐

**推荐使用**: **Framer Motion**

**理由**:
- React 生态最流行的动画库
- 声明式 API，易于集成
- 性能优秀，支持手势
- 丰富的预设动画
- TypeScript 支持完善
- 支持自定义变体和关键帧动画
- 内置动画进度控制 API

**集成方式**:
- 预设动画使用 Framer Motion 的内置变体
- 自定义动画支持 Framer Motion 变体语法
- 不再支持原生 Web Animations API `keyframes/options` 作为公共自定义动画输入；需要使用 `initial`、`animate`、`exit` 和 `transition`

**替代方案**:
- **react-spring**: 基于物理的动画，更自然
- **GSAP**: 功能强大，但体积较大
- **Web Animations API**: 可由业务侧自行使用，但不作为 CineView 公共 `CustomAnimation` 输入格式

### 开发依赖

- **typescript**: ^5.0.0 - 类型系统
- **jest**: ^29.0.0 - 测试框架
- **ts-jest**: ^29.0.0 - Jest TypeScript 支持
- **@testing-library/react**: ^14.0.0 - React 测试工具
- **@testing-library/jest-dom**: ^6.0.0 - Jest DOM 匹配器
- **@testing-library/user-event**: ^14.0.0 - 用户事件模拟
- **@fast-check/jest**: ^1.0.0 - 属性测试
- **vite**: ^5.0.0 - 构建工具
- **vite-plugin-dts**: ^3.0.0 - TypeScript 声明文件生成
- **vite-plugin-compression**: ^0.5.0 - Gzip 压缩
- **rollup-plugin-visualizer**: ^5.0.0 - Bundle 分析（Vite 内置 Rollup）

### 工具依赖

- **pnpm**: ^8.0.0 - 包管理器
- **eslint**: ^8.0.0 - 代码检查
- **@typescript-eslint/parser**: ^6.0.0 - TypeScript ESLint 解析器
- **@typescript-eslint/eslint-plugin**: ^6.0.0 - TypeScript ESLint 插件
- **eslint-plugin-react**: ^7.0.0 - React ESLint 插件
- **eslint-plugin-react-hooks**: ^4.0.0 - React Hooks ESLint 插件
- **prettier**: ^3.0.0 - 代码格式化
- **eslint-config-prettier**: ^9.0.0 - Prettier ESLint 配置
- **husky**: ^8.0.0 - Git hooks
- **lint-staged**: ^15.0.0 - 暂存文件检查

## 项目结构

```
cineview/
├── src/
│   ├── components/
│   │   ├── CineView/
│   │   │   ├── index.tsx
│   │   │   ├── CineView.tsx
│   │   │   └── CineView.test.tsx
│   │   ├── Scene/
│   │   │   ├── index.tsx
│   │   │   ├── Scene.tsx
│   │   │   └── Scene.test.tsx
│   │   ├── Animate/
│   │   │   ├── index.tsx
│   │   │   ├── Animate.tsx
│   │   │   └── Animate.test.tsx
│   │   └── Position/
│   │       ├── index.tsx
│   │       ├── Position.tsx
│   │       └── Position.test.tsx
│   ├── animations/
│   │   ├── presets/
│   │   │   ├── basic.ts       # 基础动画
│   │   │   ├── slide.ts       # 滑动动画
│   │   │   ├── scale.ts       # 缩放动画
│   │   │   ├── rotate.ts      # 旋转动画
│   │   │   ├── flip.ts        # 翻转动画
│   │   │   ├── bounce.ts      # 弹跳动画
│   │   │   ├── blink.ts       # 闪烁动画
│   │   │   ├── shake.ts       # 抖动动画
│   │   │   ├── blur.ts        # 模糊动画
│   │   │   ├── elastic.ts     # 弹性动画
│   │   │   ├── special.ts     # 特殊效果
│   │   │   └── index.ts
│   │   ├── composer.ts        # 组合动画处理器
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useResponsive.ts
│   │   ├── useSceneManager.ts
│   │   ├── useAnimationRegistry.ts
│   │   ├── useDragProgress.ts
│   │   └── useImagePreloader.ts
│   ├── context/
│   │   └── CineViewContext.tsx
│   ├── utils/
│   │   ├── sizeConverter.ts
│   │   ├── gestureDetector.ts
│   │   ├── dependencyChecker.ts
│   │   ├── throttle.ts
│   │   ├── debounce.ts
│   │   ├── performanceMonitor.ts
│   │   └── animationParser.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── jest.config.js
├── .eslintrc.js
├── .prettierrc
├── .gitignore
├── coverage/          # 测试覆盖率报告目录
├── .husky/            # Git hooks 配置
│   ├── pre-commit     # 提交前检查
│   └── pre-push       # 推送前检查
├── .eslintrc.js       # ESLint 配置
├── .prettierrc        # Prettier 配置
├── .lintstagedrc      # lint-staged 配置
└── README.md
```

## 发布配置

### package.json 配置

```json
{
  "name": "cineview",
  "version": "0.0.1-beta",
  "description": "React UI framework for creating cinematic full-screen sliding pages",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:coverage:watch": "jest --coverage --watch",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx}\"",
    "type-check": "tsc --noEmit",
    "prepublishOnly": "pnpm run type-check && pnpm run lint && pnpm run test:coverage && pnpm run build",
    "prepare": "husky install",
    "analyze": "vite build --mode analyze",
    "lighthouse": "lighthouse http://localhost:3000 --view"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "keywords": [
    "react",
    "ui",
    "framework",
    "animation",
    "fullscreen",
    "slider",
    "cinematic"
  ],
  "author": "",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": ""
  }
}
```

### pnpm link 测试流程

1. 在 cineview 项目根目录执行: `pnpm link --global`
2. 在测试项目中执行: `pnpm link --global cineview`
3. 开发时使用 `pnpm dev` 启动 Vite 开发服务器，或使用 `pnpm build --watch` 实时编译

### Vite 配置要点

**vite.config.ts** 关键配置：
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    dts({ include: ['src'] }),
    compression({ algorithm: 'gzip' }),
    visualizer({ open: true, gzipSize: true })
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'CineView',
      formats: ['es', 'umd'],
      fileName: (format) => `cineview.${format}.js`
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

### ESLint 配置

**.eslintrc.js**:
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier'
  ],
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn'
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};
```

### Prettier 配置

**.prettierrc**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### lint-staged 配置

**.lintstagedrc**:
```json
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write",
    "jest --bail --findRelatedTests"
  ]
}
```

### Husky Git Hooks

**.husky/pre-commit**:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm lint-staged
```

**.husky/pre-push**:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm run type-check
pnpm run test:coverage
```

## 正确性属性

*属性是一种特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: 尺寸换算一致性

*对于任意*设计稿尺寸和视口宽度，换算后的实际尺寸与视口宽度的比例应该等于元素尺寸与设计稿尺寸的比例

**验证需求**: 需求 1.5

**形式化表达**:
```
∀ designWidth dw, viewportWidth vw, elementWidth ew:
  convertedWidth = (ew / dw) * vw
  
验证: convertedWidth / vw = ew / dw
```

### 属性 2: 场景索引边界安全

*对于任意*场景切换操作，执行后的当前场景索引必须始终在有效范围内

**验证需求**: 需求 2.7

**形式化表达**:
```
∀ operation op, currentIndex i, totalScenes n:
  0 ≤ i < n (初始状态)
  执行 op 后: 0 ≤ i' < n (后续状态)
```

### 属性 3: 动画延迟传递性

*对于任意*动画依赖链，每个动画的实际开始时间等于自身延迟加上关联动画的实际执行时间

**验证需求**: 需求 8.4, 8.5

**形式化表达**:
```
∀ animations A, B, C:
  A.waitFor = B.id ∧ B.waitFor = C.id
  
  定义实际执行时间:
  executionTime(X) = startTime(X) + X.duration
  
  定义实际开始时间:
  startTime(X) = X.delay + (X.waitFor ? executionTime(waitForTarget) : 0)
  
  则:
  startTime(A) = A.delay + executionTime(B)
  startTime(B) = B.delay + executionTime(C)
  startTime(C) = C.delay
```

### 属性 4: 图片加载进度单调性

*对于任意*两个时间点，后一个时间点的加载进度必须大于或等于前一个时间点的加载进度

**验证需求**: 需求 11.6

**形式化表达**:
```
∀ time t1, t2:
  t1 < t2 ⟹ progress(t1) ≤ progress(t2)
  progress ∈ [0, 100]
```

### 属性 5: 相对定位累加性

*对于任意*使用相对定位的组件序列，每个组件的最终位置等于所有前置组件位置的累加

**验证需求**: 需求 10.4

**形式化表达**:
```
∀ components C1, C2, ..., Cn:
  Ci.offsetX 存在 ⟹ Ci.finalX = Σ(Cj.x + Cj.offsetX) for j ∈ [1, i]
```

### 属性 6: Drag Release 连续性（释放期并行补完，单程）

*对于任意*在 drag 模式下的成功释放：**render 轨**（页面位移，全局）按 `slideDuration` 跑 `releaseProgress→target`，跑到位即 commit（切 `currentScene` 索引）——render 轨是**唯一 commit 触发器**。**element 轨**（incoming scene 自持的入场时间轴 elapsed）在**同一释放瞬间**独立启动，从 `releaseProgress×T` 按真实创作速率续跑到 `T`（`T = delay + duration`）。两轨**同时启动、各自时钟并行**，谁先完成都行——不是「先过渡完再播动画」的串行两段。

element 轨**一条到底，跨 commit 不中断**：commit 只改 `currentScene` 索引，scene 实例 `key` 稳定（不重挂），in-flight `animate()` 不被打断、不冻结、不重播、不从 0 重启（连续补完）。`onSceneDidChange` 被**延迟**到 element 轨抵达 `T` 时由 incoming scene 自己触发（`completeDragTransition`）。

换言之：**不再有「commit 时把单一 `sharedElapsedMs` 标量从旧场景 release 链交给新场景 activation-settle」的交接缝**。element 轨从拖拽跟手到补完全程归 incoming scene 单写者所有，没有第二段、没有 snapshot。

**验证需求**: 需求 3.2

**形式化表达**:
```
∀ time t, scene S_out (outgoing), S_in (incoming):
  mode = 'drag' ∧ releaseInProgress(t)
  ⟹ renderTrack: animate(renderProgress → target, dur ∝ slideDuration)
   ∧ S_in.elementTrack: animate(elapsed → T, dur ∝ (T − releaseProgress×T))   // 同帧并行启动，各自时钟
   ∧ renderTrack.dur ⊥ elementTrack.dur                                      // 两时钟独立
∧ commit(t) ⟺ renderTrack.done(t)                                            // render 轨是唯一 commit 触发器
  ⟹ currentScene 自增；S_in.elementTrack 不中断（同一 animate 继续）
∧ ∀ t' across commit: S_in.elementTrack.elapsed(t') 单调不减            // 无归零、无重播、无冻结
∧ onSceneDidChange 仅在 S_in.elementTrack.elapsed 抵达 T 时触发一次       // 延迟提交
∧ ¬∃ 任何跨 scene 共享的 element elapsed 标量                            // 单写者：每 scene 自持自驱
```

**实现锚点**: 释放链（`useDragSceneEngine.handlePanEnd`）在释放瞬间发布全局只读指令 `dragRelease = {token, mode:'settle', direction, targetSceneIndex}`，并启动 render lane（`renderProgress→target`，`dur ∝ slideDuration`）；render lane 完成即 `onDragCommit`（commit）。incoming scene 的 `useElementTrack` 监听 `dragRelease.token`，对**自己持有的** `elementElapsedMotion` 启动 `animate(current→T_self, dur=(T_self−current)/1000, ease:'linear')`，与 render lane 并行、各自时钟；抵达 `T_self` 时调 `onSettleComplete`→`completeDragTransition`（触发延迟的 `onSceneDidChange`）。`T_self = getTimelineDuration() = max(baseDuration, calculatedDelay + duration)`，故补完时长天然含 delay。**单写者不变式**：`renderProgress` 仅 render lane 写；每个 scene 的 `elementElapsedMotion` 仅该 scene 的 `useElementTrack` 写——跨 scene 零共享写（取代被删的 `sharedElapsedMs` 单标量 + `dragTransitionSnapshot` + activation-settle 交接机制）。

### 属性 7: 场景切换互斥性

*对于任意*时刻，当场景切换动画正在执行时，不能开始新的场景切换

**验证需求**: 需求 3.4

**形式化表达**:
```
∀ time t, state s:
  s.isAnimating = true ⟹ ¬canStartNewTransition(t)
```

### 属性 8: 循环依赖不可达性

*对于任意*动画依赖关系，不存在形成环路的依赖链

**验证需求**: 需求 8.6

**形式化表达**:
```
∀ animations A1, A2, ..., An:
  ¬∃ 路径 P: A1 → A2 → ... → An → A1
  其中 → 表示 waitFor 关系
```

### 属性 9: 拖拽进度与动画进度一致性

*对于任意*在 drag 模式下的场景，拖拽进度必须与场景离开动画进度以及所有子 Animate 组件的离开动画进度保持一致

**验证需求**: 需求 4.3, 4.4

**形式化表达**:
```
∀ time t, scene S, dragProgress p:
  mode = 'drag' ∧ S.isDragging = true
  ⟹ S.exitAnimationProgress = p
    ∧ ∀ animate A ∈ S.animateRegistry:
        A.exitAnimationProgress = p
  其中 p ∈ [0, 1]
```

### 属性 10: 拖拽模式下进入动画延迟触发

*对于任意*在 drag 模式下的场景，下一个场景的进入动画只在松手完成切换后触发，拖拽过程中不触发

**验证需求**: 需求 4.5, 4.6

**形式化表达**:
```
∀ scene S, time t:
  mode = 'drag' ∧ isDragging = true
  ⟹ ¬S.enterAnimationTriggered
  
  mode = 'drag' ∧ isDragging = false ∧ transitionCompleted
  ⟹ S.enterAnimationTriggered
```

### 属性 11: 动画帧率稳定性

*对于任意*动画帧，在正常负载下帧时间不应超过 16.67ms，平均帧率应达到 60fps

**验证需求**: 需求 14.10

**形式化表达**:
```
∀ frame f, frameTime t:
  normalLoad ⟹ t ≤ 16.67ms
  fps = 1000 / avgFrameTime ≥ 60
```

### 属性 12: Bundle 大小限制

*对于任意*构建输出，主包的 gzipped 大小不应超过 50KB

**验证需求**: 需求 15.4

**形式化表达**:
```
size(mainBundle.gzip) ≤ 50KB
```

### 属性 13: 测试覆盖率要求

*对于任意*覆盖率指标（语句、分支、函数、行），覆盖率必须达到 90% 以上

**验证需求**: 需求 22.1, 22.2, 22.3, 22.4, 22.5

**形式化表达**:
```
∀ metric m ∈ {statements, branches, functions, lines}:
  coverage(m) ≥ 90%
```


### 属性 14: Drag 模式延迟门控正确性

*对于任意*在 drag 模式下的 Animate 组件，其 enter 本地进度必须以共享时间轴 `sharedElapsedMs` 扣除自身延迟后归一

**验证需求**: 需求 4.7, 4.8

**形式化表达**:
```
∀ animate A, calculatedDelay d, enterDuration e, sharedElapsedMs m:
  mode = 'drag'
  ⟹ localProgress(A) = clamp((m - d) / e, 0, 1)        (m > d, e > 0)
     localProgress(A) = 0                                (m ≤ d)

  waitFor 存在时:
  calculatedDelay = delay + executionTime(waitForTarget)
```

### 属性 15: Drag 模式智能阈值单调性

*对于任意*拖拽速度，阈值必须随速度单调递减

**验证需求**: 需求 4.9

**形式化表达**:
```
∀ velocity v1, v2:
  v1 < v2 ⟹ threshold(v1) > threshold(v2)
  
  threshold(v) = maxThreshold - (v / maxVelocity) * (maxThreshold - minThreshold)
  
  其中:
  minThreshold = 0.15 (快速滑动)
  maxThreshold = 0.3 (慢速滑动)
  maxVelocity = 1000 px/s
```

### 属性 16: Drag 模式智能回退对称性

*对于任意*在 drag 模式下的动画，已过延迟阶段的元素回退动画必须对称倒放

**验证需求**: 需求 4.10

**形式化表达**:
```
∀ animate A, calculatedDelay d, enterDuration e, sharedElapsedMs m:
  mode = 'drag' ∧ m > d (已过延迟阶段)
  ⟹ localProgress(m) = clamp((m - d) / e, 0, 1)

  回弹时（共享时间轴回退 m' < m）:
  m' > d ⟹ localProgress(m') = clamp((m' - d) / e, 0, 1)

  对称性（同一 enter 窗口内）:
  localProgress(m) - localProgress(m') = (m - m') / e
```

### 属性 17: Drag 模式场景状态机正确性

*对于任意*场景状态转换，必须遵循状态机规则

**验证需求**: 需求 4.11

**形式化表达**:
```
∀ scene S, state s, nextState s':
  validTransitions = {
    (initial, entering),
    (entering, active),
    (active, exiting),
    (exiting, initial),
    (exiting, active)  // 回弹情况
  }
  
  transition(s, s') ⟹ (s, s') ∈ validTransitions
```

### 属性 18: Drag 模式边界反弹限制

*对于任意*边界场景的拖拽，拖拽进度必须限制在 [-0.2, 0.2] 范围内

**验证需求**: 需求 4.12

**形式化表达**:
```
∀ scene S, dragProgress p:
  (S.isFirstScene ∧ p < 0) ⟹ p ≥ -0.2
  (S.isLastScene ∧ p > 0) ⟹ p ≤ 0.2
```

### 属性 19: Drag 模式双向拖拽一致性

*对于任意*双向拖拽操作，向前和向后拖拽的动画行为必须一致

**验证需求**: 需求 4.13

**形式化表达**:
```
∀ scene S1, S2, dragProgress p:
  // 向前拖拽：S1 → S2
  sceneOffset(S1) = 0 ∧ sceneOffset(S2) = 1 ∧ p > 0
  ⟹ S1.exitAnimationProgress = p ∧ S2.enterAnimationProgress = p
  
  // 向后拖拽：S2 → S1
  sceneOffset(S2) = 0 ∧ sceneOffset(S1) = -1 ∧ p < 0
  ⟹ S2.exitAnimationProgress = |p| ∧ S1.enterAnimationProgress = |p|
```

### 属性 20: useTransform 映射连续性

*对于任意*使用 useTransform 的动画属性，输出值必须随输入值连续变化

**验证需求**: 需求 4.14

**形式化表达**:
```
∀ visualMotion v1, v2, ε > 0:
  |v1 - v2| < δ ⟹ |transform(v1) - transform(v2)| < ε

  其中 transform 为 useTransform(visualMotion, () => resolveVisualState(...)) 映射函数
```
