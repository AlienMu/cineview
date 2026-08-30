# CineView 文档事实源核对单（N2，2026-08-27）

**方法论（v2 定案）**：事实源 = `DESIGN.md` 裁决节 ∩ 源码。两者冲突以**源码**为准并在此标注；DESIGN.md 的「正确性属性」章与「测试策略」章属历史层，不作为文档依据（已发现 5 处过期，见 `2026-08-27-docs-spec-gap.md`）。子 agent 报告一律**不直接采信**，凡进正文的条目须有 file:line 且我本人复核过。

状态标记：`✅` 我已亲自复核 / `📥` 子 agent 报告待复核 / `⚠️` 存疑或有冲突。

---

## 0. 现有文档的**错误内容**（优先级最高，改错 > 补漏）

| # | 错误 | 文档位置 | 真相 | 状态 |
|---|---|---|---|---|
| E1 | `onLoadProgress` 说「0 到 1」 | `advanced/03-callbacks.md:15`、`advanced/02-preload.md:46`、同页 `:52` 示例 | 实为**整数 0–100**：`Math.round((loaded/safeTotal)*100)`，`useImagePreloader.ts:219`；无资产时直接报 `100`。按 0–1 写的进度条会 100 倍溢出 | ✅ |
| E2 | `waitFor` 统一按 `calculatedDelay` 沿链累加 | `concepts/06-orchestration.md`、`concepts/02-timeline.md` | **visibility 轨不复用 `calculatedDelay`**（DESIGN.md L301 裁决），改订阅 leader 的 generation-scoped ever-entered completion + 自身 delay；代码 `useAnimateScroll.ts:405-443`（`publishEnterCompleted` / `dependencyReady`）。复用会把 leader 的 delay+duration 重算一遍 | ✅ |
| E3 | 预设数量写 41 | `reference/03-animate.md:45`（zh+en） | 43（`types/index.ts` union 与 `presets/index.ts:61-104` 各数一遍均 43）。`08-presets.md` 已写 43，页间自相矛盾；且 `en/08-presets.md`、`en/10-types.md` 根本没写数字，只改 03-animate 会留下双语不对称 | ✅ |
| E6 | `modes.drag.transitionDuration` 说成「场景切换时长」，quickstart 还注「800ms（也是默认值）」 | `reference/01-cineview.md:35`、`concepts/01-modes.md:21`、`getting-started/03-quickstart.md:56`、`04-choosing-mode.md` 对比表 | **它不控制手势翻页时长**。手势 settle/bounce 用的是引擎的 `slideDuration`，而 `DragSceneStack` **从不转发 `slideDuration`**（grep 零命中）→ 恒为 `DEFAULT_SLIDE_DURATION = 800`，公共 prop 到不了。`transitionDuration` 唯一读点是 `getSceneSettleDuration`（`CineView.tsx:109`），只喂 `isAnimating` 收尾定时器，而 `setIsAnimating(true)` 只在**程序化 `goToScene`** 路径（`useSceneManager.ts:312`）。⇒ 该 prop 只影响程序化导航的 `onSceneDidChange` 时机，对手势零影响 | ✅ |
| E7 | 退场语义按「`exitAnimation` 描述离场」讲 | `reference/03-animate.md`、`concepts/06-orchestration.md` | **反向拖拽退场根本不用 `exitAnimation`**：`useAnimateDrag.ts:364-370` 在 `direction !== 'forward'` 时插值 `initial → enterAnimate` 取 `1 - localProgress`，即**入场倒放**。且 `exitTarget` 为空时（未写 `exitAnimation`）直接 `return animateValue`——元素**保持不动**，页面照滑（`:350-353`）。任何「exitAnimation 描述离开场景」的表述对一半手势方向是错的 | ✅ |
| E8 | 「只做循环时传 `enterAnimation="never"`」 | `advanced/08-pitfalls.md:14`（zh + en 双语同错） | **`'never'` 不是预设**（`presets/index.ts` 里唯一的 "never" 是注释散文）。`InfiniteOnly` 的类型是 `enterAnimation?: never`，意思是**必须省略该 prop**。照文档写 = TS 类型错误 + 运行时 parse 失败。文档在教一个编不过的写法 | ✅ |
| E9 | `phase` 被当作通用相位读数（render-prop 与 `useAnimateTimeline` 页均如此讲） | `reference/03-animate.md`（AnimateRenderState 表）、`reference/09-use-animate-timeline.md:26`、`concepts/02-timeline.md` phase 六态表 | **scroll takeover 轨上 `phase` 恒为 `'idle'`**：测量 effect 在 `isScrollDriven` 时早退（`useAnimateScroll.ts:505-507`），visibility 状态机里全部 `setPhase` 因此不可达；scrub 轨唯一的 `setPhase` 是 `:901`（infinite-only 分支）。⇒ zone 内元素的 `state.phase` 与 `timeline.phase` 永远是 `idle`，而 `visualMotion` 正常 scrub。**且这使 CLAUDE.md 规则 6 的 canvas 指引（订阅 phase、在 `exited`/`idle` 暂停 rAF）在 takeover zone 内不安全**——照做会立刻且永久暂停。zone 内应改用 `signedProgress` / `frame.source` | ✅ |
| E4 | 坑#5「旧教程 Scene props 会报错」 | `advanced/08-pitfalls.md`、`reference/02-scene.md`「没有 legacy props」节 | 公共 `SceneProps` 已干净，用户写不出来（编译期即错）。属框架内部整洁，非用户可踩之坑 → 删 | ✅ |
| E5 | 坑#8「UMD 双倍 bundle」 | `advanced/08-pitfalls.md` | 不是坑，是入口选择的正常权衡 → 并入安装页 | ✅ |

---

## 1. DESIGN.md 有正式规格、文档零覆盖（成章依据）

见 `2026-08-27-docs-spec-gap.md` 全表。核心 18 项，每项均已 grep 确认 28 页零命中。以下为我已复核的：

| 规格 | DESIGN.md | 代码 | 状态 |
|---|---|---|---|
| `--cineview-unit: {scale}px` 是**公共消费接口** | L1319 | `CineViewContext.tsx:103`（挂在 `div.cineview-responsive-container`） | ✅ |
| 运行态六值 `inactive/entering/active/exiting/covered/parked`，且 covered/inactive/parked/exiting 默认停持续动画 | L453-461 | `useSceneRuntimeState.ts:36-65` | ✅ |
| 无 `exitAnimation` ⇒ **永不退场**，`replayOnReenter` 对其失效 | L300 | `useAnimateScroll.ts` 22 处 `hasExplicitExit` | ✅ |
| visibility 闸门迟滞死区（重叠带保持相位） | L297 | 待 Animate agent 报告落地 | 📥 |
| 超高元素预备规则（中线 / 70%，退场优先） | L298 | 同上 | 📥 |
| scroll-zone follower 不得等 visibility leader（ms/px 双时钟） | L303 | 同上 | 📥 |
| authored-but-unparsed 停在 initial 帧（刷新闪现成因） | L145-155 | 同上 | 📥 |
| 媒体单写者协议 / scrubRange 到端交还原生播放 / hysteresis | L1244-1255 | `videoPlaybackOwnership.ts`（见 §3） | 📥 |
| stagger 有效组时长 `max(duration.enter, staggerTail+itemDuration)` | L1200-1212 | 待 Animate agent | 📥 |
| 虚拟化：scroll 全部常挂载；预加载 drag 当前+相邻 / scroll 全局 | L1644-1655 | `ScrollSceneStack.tsx:26-43` 无窗口化；见 §3 预加载差异 | ✅ |

---

## 2. DESIGN.md 过期项（文档不得照抄）

| 项 | DESIGN.md | 源码真相 | 状态 |
|---|---|---|---|
| 边界橡皮筋 | 属性 18 要求钳 `[-0.2,0.2]` | 裁决节 L124「边界 progress 固定为 0」；`Scene.tsx:379-381` `return 0` | ✅ |
| `ComposedAnimation` 延迟字段 | `delay?: number[]` | `delays`（`composer.ts:112,198`） | ✅ |
| `scrollbar.enabled` | 注 default:false | 传对象即开启，仅显式 `false` 关；**省略整个 prop = 什么都不注入**（`CineView.tsx:796`） | ✅ |
| `Position.at` | 无 `anchor` | 有 `anchor: 'center'\|'center-x'\|'center-y'` | ✅ |
| `performance` | 提 preset/Lighthouse | 只剩 `monitor` | ✅ |

---

## 3. 根 / 预加载 / 媒体层（reader 报告，已抽样复核）

**冷启动与就绪**
- `onReady` 是**挂载即发**的 API 交接，不等任何资源（`useCineViewImperativeApi.ts:99-107`）。作者若用它关 loading 会过早。要等资源应看 `onLoadProgress` 到 100。📥（机制已读，与 DESIGN.md L740「仅挂载后触发一次」一致）
- `modes.drag.firstSceneTimeout`（默认 3000）**同时管 scroll 冷启动门**（`DirectScrollCineView.tsx:228`）。`ScrollModeConfig` 无此字段 → 纯 scroll 作者必须写进 `modes.drag`。✅
- 图片超时 **15000ms**（`useImagePreloader.ts:45`）、视频 fetch 超时 **30000ms**（`mediaPreloadCache.ts:135`），**都长于 3s 首屏门** → 慢资源不会挂住页面，3s 时静态揭示，超时错误更晚才到。📥
- `FIRST_SCENE_TIMEOUT` 调 `preventDefault()` ⇒ 首场景**永久停在 initial 帧**等消费者接管（`useFirstSceneEnter.ts:44-45,140-152`）。📥
- 冷启动双 boolean 是**有意设计**（`useFirstSceneEnter.ts:4-25` 头注释明写 intentionally NOT a 3-state enum）——与 CLAUDE.md 记录一致，不是待办。✅

**预加载**
- 三入口：`Scene.assets.preloadImages`（走队列）、`ref.preload()`（**总是 priority**）、元素级 `preload` prop（**完全绕过队列**，不计入 `totalCount`、不影响 `progress` 与 `priorityComplete`；`Image.tsx:54-70` 自建 `new Image()`）。📥 ← 与现有文档「三层共用同一条管线」矛盾，须复核后改写
- priority 成员在 run 启动时**冻结**（`useImagePreloader.ts:267-271`）→ `ref.preload()` 无法重开冷启动门。📥
- 模式差异：drag priority = **当前场景**（随切场景重算，`:925-943`）；scroll priority = **仅 scene 0**。📥
- 媒体 LRU **128MB**（`mediaPreloadCache.ts:18`），`setMediaByteBudget` 未公开导出 → 对消费者等于写死。📥
- `IMAGE_LOAD_FAILED` **只在 drag 触发**（仅 `CineView.tsx:840` 接了 preloader 的 onError；scroll 未接）。📥
- 视频按**扩展名**识别（`/\.(mp4|webm|mov|m4v|ogv|ogg)/i`）→ 无扩展名/查询串遮蔽的视频 URL 会被当图片加载并失败。📥

**媒体 / AnimateVideo**
- `scrubRange` 到端会 `play()` 播放尾段（`videoPlaybackOwnership.ts:161-168`）。**反向区间 `[10,2]` 会从 t=2 正向播到片尾**，与作者意图相反，且无任何注释/类型警告。📥⚠️ 高价值，须复核
- `releaseOnLeave` 三个前置：`true` + band `far` + **已被 scrub 过至少一次**（`AnimateVideo.tsx:126-151`）；zone 外与 drag 下 `approach` 为 null 直接早退。📥
- 波段阈值写死 1.5vh 释放 / 1vh 回挂（Schmitt 排序防抖，`sceneScrollRuntime.tsx:25-27`）。📥
- 开发期慢 seek 探测：每 src 采样，≥6 样本后中位数 >50ms 即警告并给 ffmpeg 全关键帧命令（`VideoFrameRenderer.tsx:51-52,403-426`）。📥
- **多个 AnimateVideo 之间无跨实例仲裁**——同 zone 两个视频可同时自动播尾段。📥⚠️
- `AnimateVideo` prop 面显著窄于 `Animate`：无 `infiniteAnimation`/`stagger`/`enterRef`/`exitRef`/`timeline.sceneControlled`/`timeline.zoneId`/`timeline.phase`/render-prop（`AnimateVideo.tsx:23-76`，只转发 5 项）。📥
- `<video>` 硬编码 `muted playsInline`（`:630-631`）。📥

**ref API**
- 程序化 `goToScene` **会发 `onDragCommit`**（`elapsedMs:0, timelineDurationMs:0`，`useCineViewImperativeApi.ts:47-56`）——DESIGN.md L751 正是这么规定的（「手势 + ref.goToScene」）。按 `onDragCommit` 做埋点会把按钮点击算成滑动。✅
- `goToScene(i, false)` 跳过整条入场时间轴（无 `enter` release 指令 → 目标场景直接 snap 到 rest，无逐元素 delay 编排；`useSceneManager.ts:316-334`）。📥
- `getPerformanceMetrics().bundleSize` **不是本库体积**：是页面所有 `.js/.mjs/.css` 资源之和，且首次计算后**永久缓存**（`performanceMonitor.ts:175-204`）。`types/index.ts:388` 注释「Bundle 大小（KB）」名不副实。📥⚠️
- `fps` **上限钳 60**（120Hz 屏也报 60）；`avgFrameTime` 是 60 帧均值不是分位数（单个 200ms 长任务被摊薄，不能用于卡顿检测）；`memoryUsage` 非 Chromium 为 `undefined`。📥
- 性能监控是**页面级单例 + 引用计数租约**：N 个 CineView 共用一个 rAF 循环，读数是页面级而非实例级。📥

**入口与打包**
- `cineview/drag`、`cineview/scroll` **无 `import` 条件**（`package.json:14-21`）→ 类型能解析、ESM 打包解析失败。✅
- `import 'cineview/drag'` 配 `mode="scroll"` **构造时抛错**（`entry-drag.ts:35-49`）；scroll 侧刻意不镜像（scroll 引擎从不读 `props.mode`）。📥
- ESM 侧只用一种模式**仍带两套引擎**（派发器静态引用，tree-shaking 保不住）——build 脚本明确接受此代价。📥 ← 与现有文档「主入口可摇树」说法冲突，须复核后改写⚠️

---

## 3b. Scene / Position / Container / Image 层（reader 报告，已抽样复核）

**布局契约**
- `layout.height` 是**唯一按模式分叉的默认值**：drag `'100vh'` / scroll `'auto'`；`width` 两模式均 `'100vw'`（`helpers.ts:193-195`）。✅
- `layout.anchor` 九值在 scroll 下**塌缩为三种 margin 对**，纵向语义整体丢弃（`helpers.ts:35-60` 实读确认）：`*-right`→`{marginLeft:auto,marginRight:0}`、`*-center`→双 auto、`*-left`+默认→`{marginLeft:0,marginRight:auto}`。且默认 `width:100vw` 时连横向也无效——必须先收窄场景。✅
- **takeover 场景的绝对 px 尺寸被丢弃**：`resolveSpanValue(...,'takeover')` 对 number 与 `'NNNpx'` 一律返回 null（`directScrollHelpers.ts:382-393` 注释明写单尺子模型下不再有高度尺子），回退 DOM 实测；且 `ScrollSceneSlot.tsx:208-214` 在 clone 前重写 `layout`。只有 `vh`/`vw` 存活。📥
- **Animate 的 duration 会加长文档**：`flowSpan = max(visualSpan, viewportSpan) + timelineDistancePx`，1ms=1px（`useScrollSceneLayout.ts:95-96`）。作者是用 `duration` 在编排滚动距离，`AnimateProps` 对此零提示。📥
- 首场景永无 enter 相位、末场景永无 exit 相位（`index>0` / `index<len-1` 写死）；相位长度钳在一个视口内（`useScrollSceneLayout.ts:101-113`）。📥
- `stack.mode` **仅 scroll 生效**（drag 下 `useScrollSceneEngine` 早退），且真实效果是「前一场景停在 exit 帧 + 变为不可点击」，与 z 序无关；`stack.zIndex` 不发默认值，跨场景层序归包装层（drag 10/1、takeover shell 30、fixed layer 20）。📥

**框架覆盖作者样式**
- 引擎对这些键**总是覆盖**作者 `style`（合并序 `Scene.tsx:923`）：`width/height/position/overflow/willChange/contain/transform/userSelect/touchAction/zIndex/pointerEvents` + anchor 键。其余 style 存活。📥
- scroll 下 Scene 恒带 `transform: translateZ(0)`（`Scene.tsx:832-835`）→ 每个 scroll Scene 都是 `position:fixed` 的 containing block ⇒ **作者裸写 fixed 必然失效**。这与我先前更正的 z-index 归因**是两件事**：fixed 归因（transform）成立，z-index 归因（transform）不成立、真凶是 `contain:layout`。⚠️ reader 在 §3 末尾又写了旧的 z-index 归因，**不采信**，按已复核结论写。
- `contain` 值按模式不同：drag `'layout style'`、scroll `'layout style paint'`——drag 刻意省 `paint`（paint 容器会裁剪到 border box，杀掉 drag 的溢出效果）。📥

**fixed layer 机制**
- 三层 div（clip/frame/host），clip 跨整个场景滚动区间 + `overflow:hidden`，frame 是**一个视口高的窗口**按 `hostOffset` 在其内滑动 → 用 `absolute` + 算术实现「视觉钉住」，天然 scene-scoped，跨 scene 漂浮结构上不可能。三层 `pointerEvents` 全 `none`，交互只在 portal 进来的 Position 节点上恢复（`SceneFixedLayer.tsx:67-113`、`Position.tsx:140`）。📥
- **drag 下 `layer.fixed` 近乎 no-op**：无宿主、无 sticky 兜底，退化 `position:absolute`，唯一残留效果是强制 `pointerEvents:'auto'`。✅（与前次复审一致）
- scroll 下首渲染有一帧 `sticky` 窗口（`fixedLayerElement` 是 ref 回调写入的 state）。📥

**单尺子**
- `scale = window.innerWidth / config.size`——**读 window 而非 CineView 盒子**（`CineViewContext.tsx:59-61`）→ 分栏/iframe/侧边栏里按窗口缩放；且 `refreshLayout()` **不刷新 scale**。📥⚠️ 高价值
- resize 150ms debounce，只认宽（`:78-91`）。✅
- `convertStyle` 只换算 59 键白名单上的**裸 number**；`startsWith('--')` 跳过、字符串一律不动（`width:200` 换算，`width:'200px'` 不换算）；`transform/boxShadow/filter/flexBasis/lineHeight` 均在外（`styleConvert.ts:17-96`）。✅
- 三组件在 CineView 外行为**三样**：`Container` dev 期 **throw**、`Position` 与 `Image` 静默按 1:1 且无任何诊断。✅

**结构要求**
- Scene 必须是根的直接子节点；数组展平、**Fragment 不展平**；`memo`/`forwardRef` 等包装**可识别至 6 层**（`isSceneElement` 沿 `.type`/`.render` 解包，`directScrollHelpers.ts:264-295`）——第 7 层起场景消失。识别靠 `cineViewScene` 静态标记而非 `displayName`。✅（6 层解包是新事实，修正了我先前「包一层就丢」的说法：**普通包装可识别，Fragment 才丢**）
- scroll 下 `sceneIndex` **只数 Scene**，非 Scene 子节点在其间正常参与文档流 → `goToScene(n)` 指第 n 个 Scene 而非第 n 个子节点。📥
- `onVisibilityChange` 在 scroll 下**逐滚动帧触发且不去重**（`Scene.tsx:514-544`），子树不重渲染但回调在热路径上。📥⚠️
- scroll 下 `onSceneWillChange` / `onSceneDidChange` **同 tick 背靠背发出**，没有「切换中」窗口（`useNativeScrollController.ts:216-234`）。📥

**疑似框架 bug（本轮不修，记档待用户裁决）**
- `Animate.tsx:927` 用的是 `scrollResult.style` 而非 `scrollOuterStyle`；drag 孪生分支 `:952` 用的是 `dragOuterStyle`（正确）。⇒ **scroll + `stagger` + `infiniteAnimation` 三者同时出现时，`:900-905` 那段注释明令的 stagger 中和被绕过**，容器会与子元素双重动画——正是该注释要防的事。✅ 已复核（两处并列读过）。属框架缺陷，不是文档能绕的坑，也不在本轮「只动 site」的范围内。

**框架内部不一致（不写进文档，记档）**
- `getSceneTransitionConfig:370` 只读 legacy `sceneTransitionDuration ?? 800`，**不读公共 `transition.exitDuration`**；而 `helpers.ts:157` 读了。⇒ 作者写 `transition={{exitDuration:400}}` 能改 registry base duration，但**改不动 scroll 布局的 enter/exit 相位长度**（仍 800px）。同一概念两个解析器，只有一个认公共 API。✅ 已复核

## 3c. drag 引擎（reader 报告，已抽样复核）

**双轨与 T_self**
- `T_self = max(baseDuration, max(calculatedDelay + duration))`，drag 下 `baseDuration = 0`（`Scene.tsx:280`）⇒ **没有任何 prop 能设定 drag 场景的时间轴长度，它由子元素涌现**。无 `Animate` 的场景 T_self=0，settle 瞬间完成。📥
- **默认 `unit:'time', scale:10` ⇒ 拖满一屏只推进 1000ms 元素时钟**，与 T_self 无关（`dragTimelineMapping.ts:86`）。站点 ~6.5s 时间轴意味着拖到底只 scrub 了约 15%，其余在 settle 阶段按真实速率补完。想要「拖一半=时间轴一半」必须用 `unit:'percent'`。📥⚠️ 高价值，现有文档只写「每拖 1% 推进 10ms」，没点明这个后果
- 短元素**先于拖拽结束就完成**是设计取舍（`useAnimateDrag.ts:140-158` 注释明写接受此代价换 waitFor 正确串行）。📥
- drag 的 `waitFor` 是**编译期折叠成累加 delay**，不是运行时等待（`registry.ts:238-240`）；循环依赖丢边继续、缺失目标丢边警告。跨 driver 边被拒（`isWaitForDriverCompatible` 只许 `visibility ← scroll`）⇒ `sceneControlled:false` 的元素**根本不能参与 waitFor**。📥
- render 轨与 element 轨 release 后**并行跑在两个时钟上**：render 用页面时标（`slideDuration`），element 用自然速率跑到 T_self，谁先到不定，后到者做清理（`useSceneManager.ts:180-185`）。📥
- commit 由 render 轨到达 ±1 触发，**不看 element 轨**；跨 commit 连续性靠 Scene 实例稳定（按 index 做 key + current±1 窗口）⇒ 入场动画跨过 commit 继续跑，不重播不冻结。📥

**回调时序（与命名不符，全部高价值）**
- `onSceneWillChange` 与 `onSceneDidChange` **同批次在 commit 时刻一起发**，即 slide **结束**时，而非开始（`useSceneManager.ts:509-520`）。手势路径不存在「将要切换」的提前量。📥
- `onSceneDidChange` 发出时**来袭场景仍在入场动画中**——它不再是「稳定」信号。📥
- `onDragProgress` 在 bounce 回滚期间**会**继续发，在 settle 期间**不发**（`:476` vs `:724` + 根把 `onRenderProgressChange` 接成 undefined）。📥
- **rush re-grab 不发 `onDragStart`**（`dragSessionActiveRef` 仍为 true，`CineView.tsx:615-624` 的 `!hadActiveSession` 守卫为假）⇒ 用户明显开始了新手势，消费者收不到。📥⚠️
- `pointercancel` **永不 commit**，无论进度与速度（`:611`），且和用户主动取消一样都只报 `onDragCancel`，公共回调无法区分系统中断。📥

**手势门（我已核 threshold 与交互豁免，其余待核）**
- pointerdown 四道门：`enabled`、`isPrimary !== false`、`button === 0`（右键/中键不拖）、非交互目标。✅（交互豁免选择器与 `data-cineview-ignore-drag` 前已复核）
- 方向门：`|axisDelta| >= 1 && |axisDelta| > |crossDelta|`——亚像素与横向占优都算**轻点**。📥
- `threshold` 随速度线性下降 0.3→0.15（`minVelocity 0`→`maxVelocity 1000`）；非有限速度或 span≤0 返回 `maxRatio`。✅
- **方向反转否决速度 600px/s 写死**，不属于 `DragThresholdConfig`（`:609`）⇒ 快速回甩总是否决提交。📥
- 边界 bounce **150ms 写死**，与普通 bounce（`|p|*800` 上限 300）不一致（`:589`）。📥
- standalone Scene（CineView 外）阈值**写死 0.5**，`thresholdConfig` 整个被忽略。📥

**其他**
- drag 进度分母是 `window.innerHeight/innerWidth` 而非容器（`:376`）⇒ iframe/分栏里进度映射失真。📥（与 Scene 侧 `scale` 读 window 同源问题）
- `infiniteAnimation` 在 drag 下的运行条件：`isActive && sceneOffset===0 && !isDragging && mode∈{rest,enter} && localProgress>=1-ε`（`useAnimateDrag.ts:740-745`）。📥
- 只有 10 个属性能在 scrub 轨上动；`stagger` 是**官方逃生舱**（走 framer 原生 variant 传播，绕过白名单）。✅（前已复核）
- 场景必须首渲染就存在：`firstSceneEnterActive` 是 `useState(() => enabled)` 初始化器只跑一次 ⇒ 场景后到 ⇒ 首屏**永久失去入场动画**，直接 snap 到终态。📥⚠️ 高价值
- offset ±2 的场景被**卸载**，element 轨归零、registry 重建；场景按 index 做 key ⇒ 条件渲染会重映射实例身份。📥
- 无 prepared snapshot 时拖拽**静默拒绝**（仅 dev 警告）；而 snapshot 要等 `setTimeout(0)` + 全部异步预设解析 ⇒ 挂载后最初几次手势可能被丢弃，无运行时信号、无公共 ready 回调。📥⚠️
- `Scene.drag.enabled` 判的是**目标**场景（前已复核 ✅）。

## 3d. scroll 引擎（reader 报告，已抽样复核）

**center-lock 真实模型**
- 「center-lock」**就是 CSS sticky 居中**，JS 的 segment 只是对它的**描述**而非驱动。`centerLockOffset = max(sceneStart + visualSpan/2 − viewportSpan/2, 0)` 恰是 sticky 开始钉住的 `scrollTop`；超屏场景靠 wrapper `paddingTop`、不足屏靠 shell `top` inset，两向自洽（`useScrollSceneLayout.ts:100`、`ScrollSceneSlot.tsx:200,277,309`）。📥 ← 比现有文档「真实滚动段」的说法具体得多
- `progressPx = clamp(nativeOffset − segmentStart, 0, totalBudgetPx)`，纯函数、无累加器无所有权记忆（`useNativeScrollController.ts:269`）。反向重入天然 100%→0%。📥
- `flowSpan = max(visualSpan, viewportSpan) + timelineDistancePx`——**wrapper 比视觉高出整个预算**，滚动距离物理上从这来。📥
- 防跳过：正向跨段 → 落到 `min(segmentStart+1, segmentEnd)`（**大 flick 被压成「段内一像素」**）；段内越界 → 精确钳到 `segmentEnd`；反向镜像取最近段（`directScrollHelpers.ts:177-219`）。📥
- **零预算 = 零锁定**：只有 `segmentEnd − segmentStart > 0.5px` 的段参与（`useNativeScrollController.ts:116`）。✅
- **infinite-only 元素不注册 zone 预算**（`useAnimateScroll.ts:840-848` 的 `!hasExplicitEnter && !hasExplicitExit` 早退）⇒ 一个 takeover Scene 若子元素全是 `infiniteAnimation`，**totalBudgetPx=0、无段、无锁、无 `onZoneEnter/Leave`**，退化成普通 section。✅⚠️ 高价值：作者以为声明了 zone
- 程序化滚动**刻意绕过防跳过钳**（否则纠正性 `scrollTo` 会打断平滑滚动，`:388-399`）；任何用户输入取消在途程序化滚动。📥

**四条输入路径**
- 全部汇聚到 `applyNativeScrollDelta`；scrollbar 拖拽经 `applyNativeScrollbarOffset` 转成 delta 后同样过钳。📥
- **`preventDefault` 是有条件的**——只在 delta 真被消费时才拦；在 `segmentEnd` 处钳返回零位移 ⇒ 不消费 ⇒ 浏览器原生滚动接手 ⇒ **这正是 zone 释放的机制**（`useScrollInputBindings.ts:40-42`）。📥 精妙且文档零覆盖
- **键盘有两个 handler，语义不同**：window 级要求 `activeElement` 是 body/documentElement 且**不检查嵌套滚动容器**；container 级不要求 activeElement 但检查嵌套。⇒ **scroll 模式的 CineView 会在无焦点时劫持整个文档的方向键/空格，即使根已滚出视野**（`useScrollInputBindings.ts:97-122`）。📥⚠️ 嵌入式用法的硬约束
- 键盘步长写死：Page = `viewport × 0.86`、Arrow = `80px`、Home/End = `±Infinity`；`direction:'x'` 下**按键不旋转**（ArrowDown 仍是「沿 x 正向」），且滚轮只读 `deltaX`（纯竖向滚轮无效）。📥
- 嵌套可滚动容器**优先**：同轴上有 `overflow:auto|scroll|overlay` 且该方向还有余量就接走输入，不钳不 preventDefault（`directScrollHelpers.ts:82-119`）⇒ takeover zone 内的内层滚动条会吞掉滚轮直到触底。📥

**两条发布通道（作者可观测面的根本约束）**
- React 快照通道刻意**把连续量排除在相等性比较之外**：`visualViewportOffset`、`sceneProgress`/`enterProgress`/`exitProgress`、`zoneState.progressPx` 全部不参与 diff（`ScrollSceneSlot.tsx:74-124`）⇒ **这些字段在 render 路径消费者手里是陈旧的**（源码注释直言 "the React snapshot is intentionally stale"）。📥⚠️ 高价值
- ⇒ **每帧数值只能经 MotionValue 观测**：`useAnimateTimeline()` 与根的 `onZoneProgress` 是全部的每帧面。📥
- `onZoneProgress` 阈值 0.5px 且比的是**上次上报值**而非上次帧（否则慢滚会每帧重置基线导致永不上报）；终端 0/满值强制透出。📥
- **离屏场景停止收帧更新**：dirty 集只覆盖 zone 变化、当前+上一视口交集、active±1、backdrop、gate 变化时的 scene 0。📥
- 场景级时间轴在自己 takeover 期间**冻结**（`visualViewportOffset` 钉在 `centerLockOffset`，`useScrollSceneSnapshots.ts:221-224`）⇒ 作者若期待 `Scene.callbacks.onVisibilityChange` 的 progress 在 takeover 中推进，会看到它停住。📥⚠️

**其他**
- **`scrollbar` 必须传对象**：`scrollbar={true}` 过不了 `typeof === 'object'` 判断（`DirectScrollCineView.tsx:455`）。📥 现有文档只写「传对象启用/传 false 关闭」，没说 `true` 无效
- `zoneTrigger` 与 `Scene.scroll.trigger` **解析后从未被读取**，完全 inert。✅
- `goToZone` 的 `align?: 'center'` 在公共类型里有、实现**丢弃**（`useNativeScrollController.ts:518`），且目标恒为 `centerLockOffset` 即**进度 0，不是 zone 中点**。✅⚠️ 公共类型说谎
- `S-F6`：takeover zone 内 infinite-only 元素停在 **entered** 帧而非 initial（否则空变体默认 opacity 0 → 永久不可见），且 phase 强制 `'entered'` 以免 `waitFor` 死锁（`useAnimateScroll.ts:888-897`）。📥
- takeover 场景**被视口裁剪而非可滚动**：shell `maxHeight:100vh; overflow:hidden` + content 补偿 `translateY` ⇒ 超出一屏的内容围绕垂直中心被裁掉。📥
- 三层祖先建立 containing block（takeover content 的无条件 transform、Scene 的 `translateZ(0)`、`contain:layout style paint`）⇒ **`position:fixed` 在 scroll Scene 内结构上不可能**。✅
- z-index 阶梯写死：fixed clip 20、活跃 takeover shell 30、scrollbar overlay 80。📥

**未被发现的 Scene 会静默消失（最高价值）**
- Scene 必须是根的**直接** JSX 子节点（Fragment 与自定义包装组件都不行）。未被发现时不注入 `sceneRuntime` ⇒ `normalizeSceneProps` 回落 `'drag'`（`helpers.ts:154`）⇒ 渲染成 `position:absolute` + `runtimeState:'inactive'` ⇒ `pointerEvents:'none'`（`Scene.tsx:876-880`），子 `Animate` 走 drag 轨但无 drag runtime、停在 initial 帧。**且不发任何警告**——`displayName` 检查管的是另一个错误，「Scene 必须在 CineView 内」查的是 `CineViewContext`（透过包装组件仍然存在）。✅ 已复核

## 3e. 编排与预算层（reader 报告，关键项已复核）

**waitFor 分轨机制（E2 的源码证据，已复核 ✅）**
- 两套机制在**同一个函数**里由 driver 对选择（`registry.ts:235-240`）：
  ```ts
  const runtimeCompletionOnly = info.driver === 'visibility' && waitForInfo.driver === 'scroll';
  if (!runtimeCompletionOnly && !circularFollowers.has(animateId)) {
    totalDelay += waitForDelay + waitForInfo.duration;   // ← scrub 轨：编译期累加
  }
  ```
- **scrub 轨**（drag / scroll-zone）：`calculatedDelay(f) = delay(f) + calculatedDelay(L) + duration(L)`，递归累加，**运行时零等待、零订阅**。
- **visibility 轨**：跳过累加项，`calculatedDelay` 只剩自身 `delay`；串行化改由 `observeWaitFor` 订阅 leader 的 `enterCompleted`——**一次性置真、永不撤回**（反向 scrub 也不回退）。
- **兼容矩阵**（`registry.ts:3-11`，已复核）：允许 drag→drag、scroll→scroll、visibility→visibility、**visibility follower → scroll leader**；其余全拒（含 scroll→visibility、drag↔任何跨轨）。
- **拒绝理由是 ms/px 双时钟不可通约**（DESIGN.md L303）：scroll-zone follower 不能等 visibility leader，因为 wall-clock completion 没有对应的滚动坐标，进不了确定性的 1ms=1px 预算。反向可以，是因为那条边退化成「运行时完成事实」。
- **补充修正**：drag 下 `sceneControlled:false` 的元素只 `declareAnimateDriver('visibility')` 而不注册；因 drag 注册恒为 `driver:'drag'` 且只有 `visibility←scroll` 跨轨 ⇒ **它既不能当 leader 也不能当 follower**，报 `incompatible-driver` 而非 `missing`。📥
- 失效 leader **不阻塞、立即放行**（任何非 pending 结论都置 `dependencyReady`）；且晚订阅者必须立刻消费终态结论，否则永久 pending。📥

**预算与 phase**
- `SCROLL_PX_PER_MS = 1`，px 字段就是 ms 字段（`sceneScrollBudget.ts:38,285-291`）。`enterDuration` 被强制**最小 1ms/1px**（`:145`）⇒ 写 0 仍占 1px。📥
- **写了 `phase` 会把 authored exit 搬到 zone 尾部**（已复核 `:317-332`）：`exitEndPx = totalBudgetPx`、`exitStartPx = max(phaseEndPx, totalBudgetPx − exitDurationPx)`；exit 的时长只剩「最小 1px 尾窗」的意义。⚠️ 高价值，文档零覆盖
- **`phase` 一经声明，分数就变成 zone 相对而非元素相对**（`:298-299`）。作者以为 `phase:{start:0.5}` 是「自身入场的一半」，实为「整个 zone 预算的一半」。⚠️
- 链式 follower 锚定 leader 的**enter 窗口关闭点**（`phaseEndPx`），不是 exit——注释记着 PROBE1 实测若锚 exit，zone 会膨胀到约 600,000px（`:169-181`）。📥
- 不动点迭代仅在有 `phase` 时启动，`phase.end < 1` 是压缩映射几何收敛；100000 上限只兜 `phase.end → 1` 的退化链。reader 实测 `phase.end:1` + follower 会耗尽上限、产出 **3000 万 px 的 zone**（约 110ms 挂载停顿）——比注释说的「defined, never-entering state」更严重。📥⚠️

**stagger**
- 三条轨各有订阅器，全部**时间驱动、不 scrub**（`StaggerContainer.tsx:13-15` 明写）；arrival 轨无 exit。📥
- 有效组时长 `effectiveDurationMs = max(authoredDuration, tailDuration + itemDuration)`，且**变体自带的 `transition.duration` 优先于 `duration.enter`**（`:66-72`）。registry、drag element 轨、visibility 完成通知、scroll zone 预算**必须消费同一个有效时长**，否则下游 waitFor 会在最后一个子项视觉完成前启动（DESIGN.md L1207-1210）。📥
- 只有**直接元素子节点**参与错峰；子元素重建时**只保留 key/className/style/children，其余 props 全丢**（`:219-228`）⇒ 给错峰的 `<span>` 挂 `onClick`/`data-*` 会静默失效。📥⚠️
- 无 authored exit 时子元素退回**enter 变体的 initial**，顺序不反转。📥

**组合动画**
- **sequential 的未声明时长步骤按 1 秒计**（`composer.ts:44-49` + `:134-138`，已复核 ✅）：framer 的隐式时长编排期读不出，故取 1s 作文档化假设；显式写 0 按真值。⇒ 作者不写 `transition.duration` 会得到意外的 1 秒间隔。
- `delays[]` 按**书写位置**索引，无效项被跳过也不移位。📥
- **组合的时间编排对 scrub 轨结构性不可见**（`composer.ts:84-90`：scrub 按值 lerp、忽略 transition）⇒ 在 takeover zone 里用 `ComposedAnimation` 的 delays 不生效。📥⚠️
- 预设失败分两类：**永久**（未知分类/名字不在 map/模块缺该导出）→ `INVALID_ANIMATION` 且永久缓存不再重试；**可重试**（3000ms 超时或其他 import 失败）→ `ANIMATION_ASSET_LOAD_FAILED` 且**不缓存**。📥
- **预设数 43** 经三路独立核对（map 43 条、union、各模块导出数逐类相符）。✅

## 3f. N4 写作轮回源码发现的补正（已复核）

- **`onZoneProgress` 的 `progress` 是归一化 0–1**，不是 px：`state.totalBudgetPx > 0 ? clamp(state.progressPx / state.totalBudgetPx, 0, 1) : 0`（`useNativeScrollController.ts:337-338`）。而**上报阈值用的是原始 px**（`|lastReportedProgressPx − progressPx| > 0.5`，`:330`）。同一处代码里两个单位并存，文档必须分别写明。✅
- **`Home` / `End` 不保证到达文档两端**：键盘步长虽是 `±Infinity`、`target` 先算成 `maxNativeOffset`/`0`（`directScrollHelpers.ts:166-171`），但随后仍**落入段钳制逻辑**。若两端之间存在 takeover 段，会被钳在段内。故描述应为「先算端点、再过钳」，不能写成「直接跳到文档末尾」。✅
- `Scene.scroll.trigger` **确实被读取**（`useSceneScrollTakeover.ts:31`）并传进 `registerZone`，但存进注册表后**没有任何消费者读它**。所以「解析后从未被读取」在行为上成立、在机制上略不精确；文档按行为写（inert）。✅

## 4. 死代码 / 陷阱源（文档绝不能引用）

- **`src/utils/gestureDetector.ts` 零消费**（全仓非测试文件仅自引用，已复核 ✅）。它自带 `minSwipeDistance:50 / maxSwipeTime:300` 的 `DEFAULT_CONFIG`——**看似手势阈值文档，实际框架从不使用**。谁照它写 drag 阈值文档就会全错。
- `CLAUDE.md` 文件布局节列的 `utils/throttle.ts`、`gestureHandlers.ts`、`dependencyChecker.ts` **均不存在**。📥（顺手可修 CLAUDE.md，属独立小改）
- `interpolateVariant` 对多值字符串（如 `transformOrigin: '50% 100%'`）**退化为 0.5 阈值切换**而非插值（`animationHelpers.ts:131-136`，注释说明是为避免语义坍缩）。用这类属性写自定义动画不会平滑 scrub。✅

---

## 5. 待办

- 四份 reader 报告（drag / scroll / Animate / Scene）回来后并入本文件，逐条复核升级为 ✅
- 复核标 ⚠️ 的四项：反向 scrubRange 自动播、多视频无仲裁、bundleSize 语义、ESM 摇树说法
- 与「元素级 preload 绕过队列」冲突的现有文档表述（`advanced/02-preload.md:6`）改写
