# 需求文档：CineView React UI 框架

## 简介

CineView 是一款面向 React 的叙事型 UI 框架，用于构建拖拽分页场景体验与滚动驱动内容体验。框架支持 `drag`、`scroll` 两套模式引擎，并以 root-first 的方式统一管理模式、布局、动画、滚动条、性能策略和公共事件。

本需求文档以最新设计稿为准，不再保留旧的 scene-level `slideMode`、旧版 `Viewport` 公共 API、以及 scroll 模式下默认 `100vh` 的历史口径。

## 术语表

- **CineView**: 顶级容器组件，唯一模式入口
- **Scene**: 可选的章节级容器，负责 chapter 级布局、scene-owned layer 与 takeover 所有权
- **Animate**: 动画组件，负责元素级时间语义消费
- **Position**: 定位组件，负责普通内容定位与 scene-scoped fixed layer 定位
- **Scene Scroll Takeover**: scroll 模式下由 `Scene.scroll` 声明的局部滚动接管区
- **Drag Mode**: 拖拽驱动分页与元素时间轴模式
- **Scroll Mode**: 文档流优先、局部时间轴接管的滚动模式
- **Scene-Scoped Fixed Layer**: 只归属于当前 scene 的 fixed layer
- **Design Width / Design Height**: 设计稿宽高双轴基准
- **Image Preload Pipeline**: 框架内部图片预加载管线；公共图片组件统一为 `Image`

## 需求

最终推荐写法统一为：`CineView mode + modes.*`、`Scene.scroll`、`Animate.timeline`、`Position.at/layer`。其中 `Scene` 是章节级能力容器，不要求包裹所有普通文档内容。旧字段不再作为文档主路径，也不再进入主入口导出的公共 TypeScript authoring 声明。

### 需求 1: Root-First 模式架构

**用户故事**: 作为开发者，我希望所有交互模式都由根节点统一声明，以便获得清晰、稳定且易理解的 API。

#### 验收标准

1. THE CineView SHALL 作为 `drag`、`scroll` 的唯一模式入口
2. THE 模式 SHALL 通过 `CineView.mode` 声明，而不是通过 `Scene` 声明
3. THE mode-specific 配置 SHALL 通过 `CineView.modes.drag`、`CineView.modes.scroll` 分组传入
4. THE Scene SHALL NOT 承担根模式配置职责
5. THE public API SHALL 比内部 runtime 少一层复杂度，不要求业务作者理解内部时间轴容器实现

### 需求 2: 响应式尺寸换算系统

**用户故事**: 作为开发者，我希望能够使用设计稿宽高作为基准，系统自动换算为当前视口尺寸，以便可靠地构建双轴响应式布局。

#### 验收标准

1. THE CineView SHALL 接收 `config.width` 与 `config.height` 作为设计稿双轴基准
2. THE CineView SHALL 支持 `px`、`rem`、`vw` 三种单位模式
3. THE CineView SHALL 提供 `scaleX` 与 `scaleY` 两个独立换算比例
4. THE Position SHALL 基于双轴换算而不是单一 `designSize` 进行定位
5. WHEN 视口尺寸变化时，THE CineView SHALL 重新计算双轴换算结果并更新子组件

### 需求 3: Scene 布局模型

**用户故事**: 作为开发者，我希望 Scene 只负责章节级布局和内容边界，而不是背负模式和滚动引擎职责，也不强迫普通文档内容 scene 化。

#### 验收标准

1. THE Scene SHALL 作为可选的章节级容器存在，而不是所有内容的强制基础节点
2. THE Scene SHALL 支持通过 `layout` 对象传入宽度、高度、锚点和 overflow
3. THE Scene SHALL 支持通过 `stack` 对象传入 `mode` 与 `zIndex`
4. THE Scene SHALL 支持通过 `transition` 对象声明 scene 自身 enter / exit 动画
5. THE Scene SHALL 支持通过 `assets.preloadImages` 提供预加载图片
6. THE Scene SHALL 支持通过 `callbacks.onVisibilityChange` 暴露可视状态
7. THE Scene SHALL NOT 接收 `slideMode`、`slideDirection`、`scrollSpeed`、`scrollEnterLength`、`scrollHoldLength`、`scrollExitLength` 这类 mode-specific 字段
8. THE exported Scene authoring declaration SHALL 只暴露 `layout`、`stack`、`transition`、`assets`、`scroll`、`callbacks` 等 grouped props；legacy scene-level props SHALL NOT 继续作为主 authoring 声明存在

### 需求 3.5: Animate 在普通文档中的可用性

**用户故事**: 作为开发者，我希望 `Animate` 能直接用于普通文档节点和自定义组件，而不是必须嵌在 `Scene` 里面才能工作。

#### 验收标准

1. THE Animate SHALL 在 `Scene` 外部正常工作
2. WHERE 当前上下文不是 takeover scene，THE Animate default behavior SHALL 使用普通可视驱动或 auto driver
3. THE framework SHALL NOT 要求 scroll 页面中的普通 section 必须包装为 `Scene`
4. WHERE `timeline.driver = 'scroll'` 被显式声明，THE Animate SHALL 仍然要求存在带 `Scene.scroll` 的归属 scene
5. WHERE Animate 位于带 `Scene.scroll` 的 scene 内且未显式声明 driver，THE default behavior SHALL 绑定所属 takeover 时间轴
6. THE framework SHALL NOT 把普通文档内容默认做成“进入 viewport 才显示”的门控体验

### 需求 5: Drag Mode

**用户故事**: 作为开发者，我希望拖拽位移和元素时间轴实时关联，以便获得精确、可控的交互体验。

#### 验收标准

1. WHERE `CineView.mode = 'drag'`，THE root engine SHALL 统一管理 drag 手势和场景切换
2. THE drag 参数 SHALL 通过 `modes.drag` 传入
3. THE `modes.drag.transitionDuration` SHALL 作为 drag 时间轴的默认基准时长
4. THE `modes.drag.threshold` SHALL 作为拖拽阈值对象统一传入
5. THE Scene SHALL 在 drag 模式下负责位移承载，但 SHALL NOT 决定 drag 配置来源
6. THE Animate SHALL 根据 drag 时间轴、delay 与 waitFor 计算 local progress
7. WHEN 用户松手且达到切换条件，THE 目标场景 SHALL 基于当前进度继续 settle，而不是重新触发一套新的 enter 动画
8. WHEN 用户松手且未达到切换条件，THE 当前场景与相邻场景元素 SHALL 按 local progress 对称回退

### 需求 6: Scroll Mode 总体模型

**用户故事**: 作为开发者，我希望 scroll 模式以真实文档流为基础，只在局部需要时由动画时间轴优先接管滚动输入。

#### 验收标准

1. WHERE `CineView.mode = 'scroll'`，THE page SHALL 以正常文档流为基础
2. THE scroll 参数 SHALL 通过 `modes.scroll` 传入
3. THE scroll 模式下 Scene SHALL 允许小于、等于或大于 `100vh`
4. THE scroll 模式 SHALL NOT 默认把 Scene 高度钳制为最小 `100vh`
5. THE scroll runtime SHALL maintain exactly one scroll owner at a time: either native document flow or one `Scene.scroll` progress owner
6. THE animation timeline 与 document scroll SHALL NOT 并行消费或拆分消费同一段输入
7. THE root runtime SHALL normalize wheel / touch / keyboard / scrollbar / native scroll into one scroll intent pipeline before deciding whether document flow or scene progress consumes the input
8. THE scroll 模式 SHALL 允许 scene 真实内容先布局，再按需声明局部滚动接管区
9. THE root scroll implementation SHALL 使用真实滚动容器，而不是虚拟滚动轨道
10. THE framework SHALL represent each scroll-driven scene timeline as real scrollable distance in the native scroll metrics, so scrollbar movement, document px input, and scene progress use the same px model
11. THE framework SHALL NOT encode completed-scene reverse behavior as a separate public mode; it is the same scene progress model moving from preserved `100%` toward `0%`
12. THE scroll page SHALL 允许普通文档节点与显式 `Scene` 章节混合存在
13. THE framework SHALL 默认保证正文、卡片、图片与章节主体持续参与自然文档流，而不是在进入 viewport 前被框架隐藏

### 需求 7: Scene Scroll 局部滚动接管

**用户故事**: 作为开发者，我希望只声明“哪一段内容接管滚动”，而不是直接理解底层时间轴容器。

#### 验收标准

1. THE framework SHALL 提供 `Scene.scroll` 作为 scroll 模式下的主推荐公共语义
2. THE `Scene.scroll` SHALL expose a simple scene progress model: each scroll scene owns one local animation percentage from `0%` to `100%`
3. THE `Scene.scroll` SHALL support `zoneId` and `trigger`; it SHALL NOT expose a scroll speed or budget override in the primary scroll authoring API
4. THE `trigger` 当前 SHALL 支持 `center-lock`
5. THE scroll authoring API and runtime SHALL NOT expose or accept `replayOnReenter`, `wheelStep`, `touchStep`, or `budget` on scroll takeover paths
6. THE scroll reverse playback SHALL be mandatory behavior derived from scene progress and input direction
7. WHEN a scene that has scroll animations reaches the trigger point, THE scene SHALL obtain scroll ownership and SHALL map user input to its local progress percentage
8. WHEN the user scrolls forward while the scene owns input, THE scene progress SHALL increase toward `100%`
9. WHEN the user scrolls backward while the scene owns input, THE scene progress SHALL decrease toward `0%`
10. WHEN scene progress is between `0%` and `100%`, THE native document flow SHALL pause and all scroll input SHALL first be offered to the scene progress model
11. WHEN scene progress reaches `100%` through forward input, THE scene SHALL release ownership to natural document flow while preserving progress and rendered animation state at `100%`
12. WHEN scene progress reaches `0%` through backward input, THE scene SHALL release ownership to natural document flow while preserving progress and rendered animation state at `0%`
13. AFTER a scene has completed to `100%`, backward scrolling from the following document flow SHALL restore scene ownership when the scene reaches the same center-lock trigger point, then move the preserved progress from `100%` toward `0%`
14. THE framework SHALL NOT require authors or users to understand internal locking, boundary detection, replay flags, or owner markers; those are implementation details only
15. THE runtime MAY use internal boundaries to prevent native document flow from skipping a scene, but those boundaries SHALL only serve the public percentage model and SHALL NOT become public API semantics
16. THE rendered scene and scene-scoped fixed layer SHALL stay visually available whenever scene progress is being consumed, including backward movement from `100%` to `0%`
17. THE center-lock animation segment SHALL intentionally contribute to native `scrollHeight`; visual pinning or compensation SHALL NOT create a second virtual scroll metric
18. THE scene progress SHALL spend input at the same px rate as document scroll and SHALL NOT be clipped by unrelated trigger-distance math
19. THE same owner/progress reducer SHALL handle wheel, touch, keyboard, custom scrollbar, and browser-native scroll reconciliation
20. THE takeover progress SHALL 作为 scene 局部状态存在，而不是 root 级全局滚动坐标的一部分
21. THE scroll intent reducer SHALL NOT allow one wheel / touch / keyboard / scrollbar / native reconciliation input to jump from after a completed center-lock segment to before that same segment without producing an in-segment progress frame
22. THE framework SHALL delete old `ScrollZone` / `Viewport` / virtual-track scroll runtime paths instead of keeping them as compatibility layers
23. THE framework SHALL NOT 要求普通内容为了参与 scroll 页面而包装进 `Scene`
24. THE takeover 机制 SHALL 只改变输入消费优先级，而 SHALL NOT 把普通阅读内容改造成 viewport 门控显示

### 需求 8: Scroll Driven 与 Visibility Driven 动画

**用户故事**: 作为开发者，我希望 scroll 模式下元素动画有明确分工：一种由滚动强绑定驱动，另一种仅基于可视状态自动执行。

#### 验收标准

1. THE Animate SHALL 支持 `timeline.driver = 'scroll' | 'visibility' | 'scene' | 'auto'`
2. WHERE `timeline.driver = 'scroll'`，THE Animate SHALL 依附所属 `Scene.scroll` 的统一真实滚动距离时间轴
3. WHERE `timeline.driver = 'scroll'`，THE Animate SHALL NOT 再按自身 `getBoundingClientRect()` 独立计算进退场
4. WHERE `timeline.driver = 'visibility'`，THE Animate SHALL 用「闸门触发 + 按时长补间」自动执行：元素静止在 `initial` 帧，直到进场闸门满足，再按 `enterDuration` 播放一次进场动画；退场为对称的闸门 + 补间。SHALL NOT 把位置连续映射为进度（旧 scrub 模型已废除）
   - 进场闸门（常规元素）：元素完全在滚动容器内且底边距容器底 ≥ `enterMargin`
   - 退场闸门（常规元素）：顶边距容器顶 ≤ `exitMargin`
   - 超高元素（高度 > 容器高 − `enterMargin`）改用预备规则：顶边过容器中心点触发进场，底边升过容器 70% 触发退场
   - `enterMargin` / `exitMargin` 为设计 px（经 `scaleY` 换算），默认 50；可在 `modes.scroll` 设全局默认，或在 `Animate.visibility` 按元素覆盖
   - 首屏元素受全局 `useFirstSceneEnter` 门控：优先资产就绪（或超时静态揭示）前静止在 `initial`
5. WHERE `timeline.driver = 'visibility'`，THE 可视规则 SHALL 只决定补充动画何时触发，而 SHALL NOT 决定元素是否渲染、是否参与自然文档流
6. THE framework SHALL NOT 把正文、卡片、图片、章节主体等阅读型内容默认隐藏到进入 viewport 才显示
7. WHERE 元素离开 viewport，THE framework SHALL NOT 默认销毁、重建或将其硬重置为完全隐藏；需要重播或重置时必须显式声明
8. WHERE scroll 元素未处于带 `scroll` takeover 配置的 `Scene` 内，THE framework SHALL 在开发环境报警告
9. THE exported Animate authoring declaration SHALL 优先暴露 `duration`、`timeline`、`visibility`，而不是 `enterDuration`、`delay`、`waitFor`、`scrollDriven` 这类扁平 legacy props
10. WHERE Animate 位于带 `Scene.scroll` 的 scene 内且未显式声明 driver，THE framework SHALL 默认将其视为 scroll-driven
11. THE CustomAnimation SHALL use a Framer Motion variant subset with optional `initial`、`animate`、`exit` fields
12. THE CustomAnimation SHALL NOT accept Web Animations API `keyframes/options` as the public custom animation shape

### 需求 9: Scroll 时间轴与真实滚动距离

**用户故事**: 作为开发者，我希望多个动画的真实滚动距离能够按时长、延迟和依赖关系统一自动换算，避免手调滚动速度或预算。

#### 验收标准

1. THE scene takeover zone total real scroll distance SHALL be derived from all internal scroll-driven animations' `delay + waitFor + enter/exitDuration`
2. FOR EACH scroll-driven Animate:
   - `enterTotal = delayChain + enterDuration`
   - `exitTotal = exitDuration`
   - `animationTotal = enterTotal + exitTotal`
3. WHERE 同时存在 enter / exit，THE zone SHALL 按两段时长比例分配滚动距离
4. WHERE 只有 enter，THE enter SHALL 占 100% 滚动距离，完成后保持终态
5. WHERE 只有 exit，THE framework SHALL 在开发环境报警告，而不是把它当作独立 scroll-driven 动画主路径
6. WHERE `waitFor` 存在，THE 后置动画起点 SHALL 基于前置动画完整总时长推导
7. THE 动画总时长越长，单位滚动输入对应的时间推进 SHALL 越慢
8. THE direct scroll takeover path SHALL NOT expose `wheelStep` / `touchStep` / `budget` speed knobs in the primary scroll API; native document scroll speed SHALL be the only speed source
9. THE longer a scene's scroll-driven animation timeline is, THE longer its real center-lock scroll segment SHALL be
10. THE internal timeline-to-distance mapping SHALL be fixed at `1ms = 1px`; this mapping SHALL NOT be exposed as a public scroll speed configuration

### 需求 10: Scene-Scoped Fixed Layer

**用户故事**: 作为开发者，我希望 fixed layer 严格属于自己的 scene，不跨 scene 漂浮，也不和下一个 scene 的 layer 进入同一 overlay 域。

#### 验收标准

1. THE Position SHALL 支持 `layer.fixed`
2. WHERE `layer.fixed = true` 且当前模式为 scroll，THE 节点 SHALL 渲染到所属 scene 的 fixed host
3. THE fixed host SHALL 只在所属 scene 的可见片段内显示
4. THE fixed host SHALL 在 scene 底部边界处释放，而不是继续跟随到下一 scene
5. DIFFERENT scenes 的 fixed layer SHALL NOT 进入同一可见 overlay 域
6. THE fixed layer 的设计坐标参考系 SHALL 保持为设计 viewport，而不是随 host 裁剪高度重解释

### 需求 11: Position 定位系统

**用户故事**: 作为开发者，我希望定位 API 更整洁，并以双轴设计稿为基础可靠换算。

#### 验收标准

1. THE Position SHALL 支持 `at.x`、`at.y`、`at.offsetX`、`at.offsetY`
2. THE Position SHALL 支持 `layer.fixed`
3. WHERE 同时存在绝对定位与相对定位，THE Position SHALL 优先使用绝对定位
4. THE Position SHALL 从 CineView 上下文获取双轴换算结果
5. WHEN 视口尺寸变化时，THE Position SHALL 重新计算定位值
6. THE exported Position authoring declaration SHALL 优先暴露 `at` 与 `layer`，而不是 `x/y/offsetX/offsetY/fixed` 这类扁平 legacy props

### 需求 12: 图片预加载系统

**用户故事**: 作为开发者，我希望系统智能预加载图片，以便优化首屏体验和后续切换流畅度。

#### 验收标准

1. THE CineView SHALL 收集所有 Scene 的 `assets.preloadImages`
2. WHERE 当前模式为 `drag`，THE framework SHALL 优先预加载当前场景及相邻场景图片
3. WHERE 当前模式为 `scroll`，THE framework SHALL 全局预加载所有声明的 `assets.preloadImages`
4. THE framework SHALL 仅提供 `Image` 作为公共图片 authoring API，内部预加载 SHALL 统一由 `useImagePreloader` 管理
5. THE `Image` component SHALL 默认 `preload = true`，并允许作者通过 `preload={false}` 选择浏览器 lazy loading
6. THE `Image` component SHALL 支持原生 `img` props、`style`、`width` 与 `height`
7. THE `Image` component SHALL 通过 CineView 上下文转换数字 `width`、`height` 和数字 style 长度值
8. WHEN 加载进度更新时，THE framework SHALL 触发 `callbacks.common.onLoadProgress`
9. IF 图片加载失败，THEN THE internal image preload pipeline SHALL 记录失败 URL 并继续其他任务
10. THE framework SHALL NOT 因为 preload 而隐藏整个首屏 viewport
11. THE 首屏布局与文案 SHALL 在关键媒体未完成时仍可先渲染
12. THE same non-gating principle SHALL 适用于后续 scroll 内容；框架 SHALL NOT 因为 viewport 进入时机而延后普通内容的可见性

### 需求 13: 回调系统

**用户故事**: 作为开发者，我希望回调**扁平暴露并按 `mode` 判别**——`mode='drag'`（或省略）时只能写 common + drag 回调，`mode='scroll'` 时只能写 common + scroll 回调，写错模式的回调应在类型层报错。内部仍按职责分三类（common/drag/scroll），但不向外暴露分组结构。

#### 验收标准

1. THE `callbacks` prop SHALL 为扁平对象（无 `common`/`drag`/`scroll` 嵌套层），其可写键由 `mode` 判别共用体决定。
2. WHEN `mode='drag'` 或省略，THE `callbacks` SHALL 接受 common + drag 回调；写入 scroll 专属回调（如 `onZoneProgress`）SHALL 触发类型错误。
3. WHEN `mode='scroll'`，THE `callbacks` SHALL 接受 common + scroll 回调；写入 drag 专属回调（如 `onDragCommit`）SHALL 触发类型错误。
4. THE common 类（两模式通用）至少 SHALL 包含：
   - `onReady`
   - `onLoadProgress`
   - `onSceneWillChange`
   - `onSceneDidChange`
   - `onError`
5. THE drag 类至少 SHALL 包含：
   - `onDragStart`
   - `onDragProgress`
   - `onDragCommit`
   - `onDragCancel`
6. THE scroll 类至少 SHALL 包含：
   - `onZoneEnter`
   - `onZoneLeave`
   - `onZoneProgress`
   - `onSceneVisibilityChange`
7. `onDragCommit` SHALL 在**所有 drag 切换提交**时触发——既包括手势释放提交，也包括 `ref.goToScene` 程序化跳转（payload `{sceneIndex, targetSceneIndex, progress: 1, direction}`，无手势时省略 `elapsedMs`/`timelineDurationMs`）。`onDragStart`/`onDragProgress`/`onDragCancel` 仍为手势专属。

### 需求 14: Ref API

**用户故事**: 作为开发者，我希望 ref API 专注于导航、刷新和观测，而不是暴露不稳定的“强制触发动画”语义。

#### 验收标准

1. THE CineView SHALL 通过 ref 暴露 `goToScene`
2. WHERE 当前模式为 scroll，THE CineView MAY 通过 ref 暴露 `goToZone`
3. THE CineView SHALL 通过 ref 暴露 `refreshLayout`
4. THE CineView SHALL 通过 ref 暴露 `preload`
5. THE CineView SHALL 通过 ref 暴露 `getCurrentScene`
6. THE framework SHALL NOT 通过 ref 暴露内部 runtime snapshot 或 debug state
7. THE framework SHALL NOT 继续把 `triggerAnimation` 作为主推荐公共 API
8. THE framework SHALL NOT 继续把 `reload` 作为主推荐公共 API

### 需求 15: Scrollbar 根级配置

**用户故事**: 作为开发者，我希望在 root 层统一配置框架自绘滚动条样式，以便保持全局体验一致。

#### 验收标准

1. THE CineView SHALL 支持 `scrollbar` 配置对象
2. WHERE `scrollbar = false` 或 `scrollbar.enabled = false`，THE framework SHALL 不启用自定义滚动条
3. WHERE `scrollbar.enabled = true`，THE framework SHALL 在 root 注册滚动条样式
4. THE `scrollbar` 配置 SHALL 支持：
   - `width`
   - `radius`
   - `inset`
   - `trackColor`
   - `thumbColor`
   - `thumbHoverColor`
   - `autoHide`
5. WHERE `scrollbar.enabled = true`，THE framework SHALL 默认隐藏浏览器原生滚动条，只显示框架自绘滚动条
6. THE 默认框架滚动条 SHALL 贴合视口边缘；只有显式配置 `inset` 时才向内收缩
7. THE 默认框架滚动条样式 SHALL 为细条、圆角、低对比度、自动隐藏
8. THE scrollbar SHALL 读取真实滚动容器的滚动指标，而不是虚拟滚动坐标

### 需求 16: 性能配置

**用户故事**: 作为开发者，我希望性能策略可配置，但默认值服务于大多数真实项目，而不是为了极端 case 把 API 搞复杂。

#### 验收标准

1. THE CineView SHALL 通过 `performance` 对象接收性能配置
2. THE `performance` 对象 SHALL 支持：
   - `preset`
   - `virtualization`
   - `measurement`
   - `monitor`
3. THE `preset` 默认值 SHALL 为 `balanced`
4. THE framework SHALL 支持 `balanced`、`smooth`、`strict` 三种预设
5. THE framework SHALL 将旧的 `performanceMode` 迁移为 `performance.preset` 体系

### 需求 17: 性能实现要求

**用户故事**: 作为开发者，我希望框架在复杂场景下仍保持流畅，并避免明显的布局测量和运行时开销陷阱。

#### 验收标准

1. THE framework SHALL 避免在 scroll 模式下对 scene 全量后代进行高频重复测量
2. THE framework SHALL 避免通过频繁 DOM 查询查找 Animate 宿主节点
3. THE framework SHALL 尽量减少 React state 与 runtime state 的重复存储
4. THE framework SHALL 将 public props 与 internal runtime props 分层，避免 Scene internal props 持续膨胀
5. THE framework SHALL 优先使用 transform 与 opacity 做动画，以启用 GPU 加速
6. THE 动画和交互帧率目标 SHALL 为 60fps

### 需求 18: 虚拟化与渲染策略

**用户故事**: 作为开发者，我希望大场景数量下仍保持合理的渲染成本。

#### 验收标准

1. WHERE 当前模式为 `drag`，THE framework SHALL 支持虚拟化渲染当前场景及其相邻场景
2. WHERE 当前模式为 `scroll`，THE framework SHALL 根据内容连续性决定是否关闭或调整分页式虚拟化策略
3. THE 未渲染场景 SHALL 不占用不必要的 DOM 节点
4. THE framework SHALL 使用合适的可见性优化策略减少非活跃内容开销

### 需求 19: 事件与错误处理

**用户故事**: 作为开发者，我希望框架在错误场景下给出清晰提示，并在生产环境保持稳健降级。

#### 验收标准

1. IF Scene 不在 CineView 下使用，THEN THE framework SHALL 在开发环境输出清晰错误
2. IF scene-scoped Position behavior is requested without a Scene owner, THEN THE framework SHALL 在开发环境输出清晰错误
3. IF scroll-driven Animate 不在带 `Scene.scroll` 的 Scene 中使用，THEN THE framework SHALL 在开发环境输出警告
4. IF 检测到动画循环依赖，THEN THE framework SHALL 阻止执行并输出依赖错误
5. IF `goToScene` 传入无效目标，THEN THE framework SHALL 输出警告并忽略请求
6. WHERE 环境为生产环境，THE framework SHALL 以稳健降级为主，而不是直接崩溃

### 需求 20: TypeScript 类型支持

**用户故事**: 作为开发者，我希望框架提供完整且与最新设计一致的 TypeScript 类型定义。

#### 验收标准

1. THE framework SHALL 导出所有公共接口的 TypeScript 类型定义
2. THE 类型定义 SHALL 包含 `CineViewProps`、`SceneProps`、`AnimateProps`、`PositionProps`
3. THE 类型定义 SHALL 包含所有公共回调和 ref 方法签名
4. THE 类型定义 SHALL 与 root-first 模式设计保持一致
5. THE 类型定义文件 SHALL 随 npm 包一起发布

### 需求 21: 代码质量与可维护性

**用户故事**: 作为框架维护者，我希望代码结构清晰、职责单一，以便长期演进。

#### 验收标准

1. THE 代码 SHALL 遵循单一职责原则
2. THE 模式引擎 SHALL 与 Scene 布局职责分离
3. THE public API 层 SHALL 与 runtime 层分离
4. THE 同一业务逻辑字段 SHALL 聚合到同一个对象中，而不是在多个组件顶层平铺
5. THE 代码 SHALL 通过 ESLint、Prettier 和 TypeScript 严格模式检查
6. THE Animate legacy flat props SHALL be normalized in an internal adapter layer rather than inside the render component body
7. THE animation runtime context SHALL separate base scene state, drag timeline state, scroll bridge state, and animation registry ownership at the type/module boundary
8. THE animation registry SHALL be testable as a pure module and SHALL report missing dependencies, duplicate ids, and circular waitFor chains deterministically

### 需求 22: 测试覆盖率

**用户故事**: 作为框架维护者，我希望关键路径具有高测试覆盖率，以便确保重构安全。

#### 验收标准

1. THE 单元测试覆盖率 SHALL 达到 90% 以上
2. THE 语句覆盖率 SHALL 达到 90% 以上
3. THE 分支覆盖率 SHALL 达到 90% 以上
4. THE 函数覆盖率 SHALL 达到 90% 以上
5. THE 行覆盖率 SHALL 达到 90% 以上
6. WHERE 覆盖率低于 90%，THE CI/CD 构建 SHALL 失败
7. THE 测试 SHALL 覆盖 root mode、Scene.scroll takeover、scene-scoped fixed layer、scroll timeline distance、callbacks、scrollbar 配置

### 需求 23: 跨平台兼容性

**用户故事**: 作为开发者，我希望框架在移动端和桌面端都保持稳定交互。

#### 验收标准

1. THE framework SHALL 支持触摸事件检测
2. THE framework SHALL 支持鼠标事件检测
3. THE framework SHALL 支持鼠标滚轮输入
4. THE framework SHALL 在不同屏幕尺寸下正确执行双轴换算
5. THE framework SHALL 在 iOS Safari、Android Chrome、Desktop Chrome、Desktop Firefox、Desktop Safari 中正常工作

### 需求 24: 构建与发布

**用户故事**: 作为框架维护者，我希望构建、类型、测试和发布流程稳定自动化。

#### 验收标准

1. THE 构建系统 SHALL 使用 Vite
2. THE 构建输出 SHALL 包含 ES 模块与 UMD 模块
3. THE 构建输出 SHALL 包含 TypeScript 类型定义文件
4. THE 构建 SHALL 在发布前自动运行类型检查、代码检查和测试
5. THE 主包大小目标 SHALL 控制在合理范围，并持续监控

### 需求 25: 安全性

**用户故事**: 作为开发者，我希望框架避免引入常见安全风险。

#### 验收标准

1. THE internal image preload pipeline SHALL 验证图片 URL 协议为 `http` 或 `https`
2. THE framework SHALL 避免直接渲染不可信 HTML
3. THE 框架维护者 SHALL 定期更新依赖并检查漏洞
4. THE 文档 SHALL 建议开发者配置 CSP 约束资源来源

### 需求 26: Scroll Runtime 直接切换

**用户故事**: 作为框架维护者，我希望 scroll 模式直接切换到新的真实文档流架构，而不是长期维护一套兼容旧模型的双轨系统。

#### 验收标准

1. THE framework SHALL 对 scroll runtime 采用直接切换，而不是兼容桥长期并存
2. THE framework SHALL 删除虚拟滚动轨道作为 scroll 主路径
3. THE framework SHALL 删除把 takeover 滚动距离编码进虚拟 root 全局坐标的主路径; takeover distance SHALL be represented only as real center-lock scroll distance in the native document metrics
4. THE framework SHALL 以 `Scene.scroll` 作为唯一主推荐 takeover 公共语义
5. THE framework SHALL delete `<Viewport>` / `ScrollZone` from the scroll public authoring path, examples, and active runtime path
6. THE rewrite SHALL 具备对应的类型、构建、测试和浏览器验收检查
7. THE framework SHALL 在完成直接切换后只保留新的 scroll 心智模型作为主文档口径
