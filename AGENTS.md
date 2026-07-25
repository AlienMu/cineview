# CineView — Agent Onboarding Guide

## 项目简介

CineView 是一个面向 React 的叙事型 UI 框架，支持 `drag`（拖拽分页）和 `scroll`（真实文档流滚动接管）两套模式引擎。它提供场景管理、动画编排、px2vw 单轴响应式换算（认宽不认高，绝不形变）、图片预加载和 scene-scoped fixed layer 能力。

- **工作目录**: `cineview/` （所有代码操作均在此目录内完成）
- **包管理器**: pnpm
- **构建工具**: Vite 5
- **测试框架**: Jest 29 + React Testing Library + @fast-check/jest
- **动画库**: Framer Motion 11

---

## 启动前必读

每次开始**实质性工作**前，必须按顺序：

1. 读 `DESIGN.md`（唯一有效规格）
2. 创建或读取当次任务的 `task-flows/YYYY-MM-DD-<short-slug>.md` 文件
3. 在开始实现前在 task-flow 文件中明确列出节点并逐一打勾推进

**禁止**：在没有 task-flow 的情况下跨多文件重构。

**强制**：scroll / drag 交互路径的验收，必须由独立的 agent 在真实环境（浏览器 lane，`localhost:3000/#/drag` 或 `#/scroll`）完成实测——实现 agent 与验收 agent 分开，验收不能只跑单测/type-check 就收口。单测全绿 ≠ 视觉正确。

---

## 完成后自检

每个 task-flow 节点收口后（不只是全流程末尾），必须回头审查刚改动的代码，逐条确认，不通过就不算完成：

1. **整改是否真的完成**：改动是否解决了原问题本身，而非只让测试/type-check 变绿。回读相关逻辑代码，确认行为符合意图，没有留下半程状态（TODO 占位、被注释掉的旧逻辑、只改一半的分支）。
2. **是否引入冗余**：本次是否留下死代码、重复实现、零消费的字段/导出/参数、与现有工具重叠的新工具。改动应让代码**净减负**或至少不增熵——尤其重构类任务，收口时全仓 grep 确认删净（旧字段、旧命名、旧文件的残留引用）。
3. **整体项目是否仍可控**：单文件行数、单函数职责、上下文/props 的可选字段是否因本次改动膨胀。触碰大文件时优先抽离而非追加；发现职责焊死的巨石，记录到 task-flow 待专项拆分，不放任继续生长。
4. **运行时性能是否依旧利落（重点）**：这是自检的核心。本框架是叙事型动画引擎，性能瓶颈永远在**运行时的每帧热路径**，不在构建体积或冷启动。收口时必须问：
   - **滚动 / 拖拽并发下的每帧代价**：本次改动是否让 scroll/drag 的每一帧多做了运算？高动画运算（多个 `Animate` 元素同时 scrub、`AnimateVideo` 逐帧 seek、stagger 级联）集中在滚动并发时最吃紧——这里任何一处 `useState` 每帧 setState、每帧换引用的 `useMemo`、读 layout 紧接写 style 的同步布局抖动（layout thrashing），都会放大成全场景子树重渲染或掉帧。
   - **优先 motionValue，而非 React state**：每帧变化的量（progress / elapsedMs / scroll offset）应走 `useMotionValue` + `motion.*` style 单输入映射，让位移绕过 React 渲染管线。新增每帧驱动路径时，默认用 motionValue；只有真正需要触发结构性重渲染时才用 state，并说明理由。
   - **memo 是否真的生效**：给热路径组件加/改 `useMemo`/`memo` 时，确认依赖数组里没有每帧变化的量——否则 memo 每帧失效，是纯开销。
   - **单一所有者不变量**：progress / elementElapsedMotion / dragRelease 各自唯一写者（见「关键状态唯一所有者」）。改动不得引入第二个写者或跨 scene 的共享可变状态。
   - **验证方式**：性能回归无法靠单测发现。触及 scroll/drag 热路径的改动，交由真机验收 agent 时须显式要求观测「并发滚动 + 多元素动画」场景下的掉帧 / 长任务，而非只看功能正确。

**原则**：宁可在收口时多花一轮回读，也不把"绿了就是好了"当完成标准。运行时的每帧效率是本框架的生命线。

---

## 常用命令

```bash
pnpm test                    # 运行所有测试
pnpm test:coverage           # 带覆盖率报告
pnpm build                   # 构建 ESM + UMD
pnpm type-check              # TypeScript 严格检查
pnpm lint                    # ESLint
pnpm format                  # Prettier
```

覆盖率目标：语句/分支/函数/行全部 ≥ 90%。低于阈值时 CI 构建失败（`test-threshold.js` 配置）。

---

## 架构与职责边界

### 核心组件

| 组件           | 职责                                                                        | 不负责                                         |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| `CineView`     | 唯一模式入口、px2vw 单轴换算上下文、scrollbar 注入、预加载调度              | 具体场景布局                                   |
| `Scene`        | 章节级布局边界、scene-scoped fixed layer 宿主、可视信号                     | 根模式配置、drag/scroll 参数                   |
| `Animate`      | 消费当前 mode 时间语义（drag/scroll/visibility/auto）                       | 声明根模式                                     |
| `Position`     | px2vw 单轴响应式坐标定位、scene-scoped fixed layer 挂载                     | 跨 scene 漂浮、尺寸换算（归 `Container`）      |
| `Image`        | 统一图片预加载接口                                                          | 阻塞首屏可见性                                 |
| `AnimateVideo` | 视频进度驱动帧擦除（`Animate` 薄封装，复用 render-prop 拿 `enterProgress`） | 声明模式、拥有 progress（仍是 `Animate` 所有） |
| `Container`    | px2vw 盒模型换算容器（width/height + 整块 style 长度量按设计 px 换算）      | 坐标定位（归 `Position`）                      |

### 关键上下文/运行时文件

- `src/context/CineViewContext.tsx` — px2vw 单轴换算上下文 Provider（`scale`/`convert`，认宽不认高）
- `src/components/CineView/runtimeContext.tsx` — CineView 运行时上下文（模式、drag/scroll 全局状态）
- `src/components/Scene/sceneScrollRuntime.tsx` — scroll takeover Context（`SceneScrollRuntimeContext`、`SceneScrollTimelineContext`、`SceneScrollTakeoverContext`）
- `src/components/Scene/sceneScrollBudget.ts` — scroll 动画时长 → 真实滚动距离换算（1ms=1px）
- `src/components/CineView/DirectScrollCineView.tsx` — scroll 模式根实现（真实滚动容器、center-lock reducer）
- `src/components/Animate/animateSemantics.ts` — legacy flat props → 标准 `timeline`/`duration`/`visibility` 归一化适配层

### 数据流原则

- **Drag 模式**: 双轨模型——**render 轨** `renderProgress`（全局位移，仅 render lane 写，是 commit 唯一触发器）与 **element 轨** `elementElapsedMotion`（每个 Scene 实例自持的 `MotionValue`，仅该 scene 的 `useElementTrack` 写，跨 scene 零共享）各有唯一所有者；Animate 通过 `useAnimateDrag` 用 `useTransform(visualMotion, () => resolveVisualState(...))` 单输入映射，按 scene 状态（rest/outgoing/enter/hidden）解析视觉态；delay 经 `resolveEnterLocalProgress(sceneElapsedMs, calculatedDelay, enterDuration)` 门控（`sceneElapsedMs` 即本场景 element 轨的 elapsed）
- **Scroll 模式**: 唯一 scroll owner 原则（`Scene.scroll` progress owner 或 native document flow，二者不并行）；scene progress 用真实 px（1ms=1px）表示；center-lock reducer 统一处理 wheel/touch/keyboard/scrollbar/native 路径
- **禁止**: 同一输入在两个消费者之间拆分；cross-mode 状态复用；跨 scene 的 fixed layer 漂浮

---

## 公共 API 速查

### CineView

```tsx
<CineView
  config={{ size: 750 }}                // 设计稿尺寸基准（px2vw 单尺子的唯一基准）
  mode="scroll"                        // 'drag' | 'scroll'，默认 'drag'
  modes={{
    drag: { direction: 'y', transitionDuration: 800, threshold: {...} },
    scroll: { direction: 'y', zoneTrigger: 'center-lock' },
  }}
  scrollbar={{ enabled: true, width: 6, autoHide: true }}
  callbacks={{ common: { onReady }, drag: { onDragCommit }, scroll: { onZoneProgress } }}
  performance={{ monitor: true }}
  ref={cineViewRef}
>
```

**Ref 方法**: `goToScene(index, animated?)` / `refreshLayout()` / `preload(targets?)` / `getCurrentScene()` / `getPerformanceMetrics()`（公共，必填）；`goToZone(zoneId, opts?)`（scroll 专属，可选；scroll 消费者可用 `CineViewScrollRef` 便捷类型）

### Scene

```tsx
<Scene
  sceneId="hero"
  layout={{ width: '100%', height: '100vh', anchor: 'top-center', overflow: 'hidden' }}
  stack={{ mode: 'replace', zIndex: 1 }}
  transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out', exitDuration: 400 }}
  assets={{ preloadImages: ['/hero.jpg'] }}
  scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}  // scroll 模式下才需要
  callbacks={{ onVisibilityChange: ({ visible, progress }) => {} }}
>
```

### AnimateVideo（帧擦除，2026-07-13）

```tsx
<AnimateVideo
  src="/clip.mp4"
  duration={{ enter: 2000 }} // scrub 跨度（scroll 下即真实滚动 px）
  timeline={{ delay: 100, waitFor: 'intro' }}
  visibility={{ replayOnReenter: true }}
/>
```

drag/scroll 位置即 `currentTime`，反向倒放。原生 `<video>`，零库。首屏媒体经预加载管线纳入
`priorityComplete` 冷启动门控。（注：GIF 抽帧曾一并实现，后因与 video 功能重合 + 需第三方依赖
而砍除；如需丝滑逐帧，考虑图片序列而非 GIF。）

### Animate

```tsx
<Animate
  animateId="title"
  enterAnimation="fade-in"
  exitAnimation="fade-out"
  duration={{ enter: 800, exit: 400 }}
  timeline={{ driver: 'scroll', delay: 200, waitFor: 'subtitle' }}
  visibility={{ replayOnReenter: true }}
>
```

`timeline.driver` 默认 `'auto'`：drag 下跟随场景；scroll 下若在 `Scene.scroll` 内默认为 `'scroll'`，否则为 `'visibility'`。

### Position

```tsx
<Position
  at={{ x: 100, y: 200, offsetX: 10, offsetY: 0 }}
  layer={{ fixed: true }}   // scroll 模式下 → scene-scoped fixed layer
>
```

---

## 已知问题与当前状态（verified 2026-06-29）

### 测试状态

- **总计**: 1127 tests，**1127 全部通过**（77 suites，2026-06-30 评审整改轮实测；含新增 `directScrollHelpers.test.ts` 32 例）；`type-check` 0 错误、`lint` 0 错误 0 警告（16 个历史 warnings 已清零）；`build:verify` 8/8 通过
- scroll 核心套件 `DirectScrollCineView.test.tsx` + `.branches` 共 110/110 通过（新增「measures scene layouts once per gesture burst」回归测试）
- ⚠️ **单测全绿 ≠ 视觉验收通过**：scroll/drag 交互路径仍需独立 agent 在真实浏览器（`localhost:3000/#/scroll`）跑通完整手势后才算收口（见开发规则 4）

### 2026-06-29 评审整改（已落地）

- **（已修复）scroll 侧 `onReady` 重复触发**：`DirectScrollCineView.tsx` 的 onReady effect 原依赖 `getRuntimeApi`，而后者依赖 `activeSceneIndex`，每次切场景重触发。改为 ref 持有最新 API + 挂载时仅触发一次，对齐 drag 侧（`CineView.tsx`）语义。回归测试 "fires onReady exactly once across active-scene changes"。
- **（已修复）scrollbar 拖拽 listener 泄漏**：`handleScrollbarMouseDown` 在 window 挂 mousemove/mouseup，仅 mouseup 注销；拖拽中卸载会泄漏。改为 `scrollbarDragCleanupRef` 跟踪 + unmount effect 兜底清理 + 新 mousedown 前先清理上一次未释放的拖拽。回归测试 "removes window mousemove/mouseup listeners when unmounted mid scrollbar drag"。
- **（已修复）`CineViewContext.test.tsx` 确定性失败**：resize 测试用裸 `setTimeout(200ms)` + 同步断言，与 debounce(150ms)+act flush 竞态（确定性失败，非 flaky）。改用 `act` 包裹派发 + `waitFor` 轮询，对齐同文件通过副本。
- **（已修复）dist 类型漂移**：`dist/index.d.ts` 曾缺源码已加的 `ScrollModeConfig.enterMargin/exitMargin`、`AnimateProps.visibility.enterMargin/exitMargin`。已重新 `pnpm build:verify`（8/8 通过），dist 与源码同步。
- **（已修复 2026-06-30）ES 模块未被压缩 + console 泄漏 + 超 50 KB 目标**：`vite.config.ts` 原用 `minify: 'terser'`，但 lib 多格式（es + umd）下 terser 只压 umd、**静默跳过 es 输出**（Vite 已知问题）——es 产物 307 KB 未压缩、保留 39 处 console 调用、gzip 59.47 KB 超 50 KB 目标。改用 `minify: 'esbuild'`（Vite 默认压缩器，对两格式都可靠）+ build-only `esbuild.drop: ['console','debugger']`（用 `defineConfig(({command})=>...)` 按 `command==='build'` 门控，dev server 保留诊断 console）。删除未用的 `@rollup/plugin-terser` 与无效的 `terser` devDep。结果：es 307→178 KB、gzip **44.9 KB**（达标），无 console 调用（残留 7 处为 framer-motion 字符串字面量，非调用），UMD gzip 38.51 KB；`build:verify` 8/8。

### 2026-06-29 性能/结构整改轮（已落地，task-flow `2026-06-29-perf-structure-remediation.md`）

- **（已修复 P0）scroll 热路径 layout thrashing**：`syncNativeScrollState` 原每个 scroll 帧都调 `measureSceneLayouts()` 遍历所有 scene 做 `getBoundingClientRect`+offset 读（约 2N 次 getBoundingClientRect/帧），与 `setNativeOffset` 写交替 → 强制 reflow；wheel/touch 路径还双重测量。改为**手势起点测量一次**：`syncNativeScrollState(fromGesture)` 仅在手势首帧（`!isScrollingRef.current`）测量，连续帧读缓存 `sceneLayoutsRef`；programmatic 重同步（mount/resize/refreshLayout，调用前已自测量）传 `fromGesture=false` 不污染手势标志。依据：`getRelativeOffset` 把 `rootScroll` 加回 → `sceneStart` 等输出 scroll 不变量。回归测试「measures scene layouts once per gesture burst」（revert-to-confirm-red 验证守卫有效）。⚠️ 性能收益（真机无卡顿/无跳过）+ 手势中途内容 resize 延迟到下次手势捕获，**仍需独立 lane 浏览器验收**。
- **（已修复 P1）`SceneScrollRuntimeContext` 原地 mutate**：`DirectScrollCineView.tsx` 渲染中原地改写 `zoneRuntimeValueRef.current.zoneStates/version`（违反 React context 契约）。核实 version/zoneStates 是**死字段**（无消费者直接从 runtime context 读，活数据走已 memo 的 `SceneScrollTimelineContext`，Animate 的回退分支因两 Provider 成对挂载永不触发）→ 从 runtime context 类型删除，runtime value 改 `useMemo`（纯 5 个稳定 useCallback，永久稳定身份）。新增合并类型 `SceneScrollZoneRuntime`（= 注册 API + timeline 快照）供 `useAnimateScroll` 消费；phase/warning 测试迁移到 TimelineContext。⚠️ 「Scene 不再因 zoneStates 变化每帧重渲染」的性能收益需真机 Profiler 确认。
- **（已修复 P1）`useAnimateDrag` 每帧 11× resolveVisualState**：10 个属性 useTransform 各自重调 `resolveVisualState`（输入相同，仅 property 不同）+ updateVisualMotion 一次 = 11×/帧。改为 `updateVisualMotion` effect 把已解析的 state 直接写入一个 `useMotionValue<DragVisualState|null>`，10 个属性从它单层派生 → **1×/帧**。注：**链式 `useTransform` 方案失败**（中间层打断更新传播，属性停在 render 种子值 localProgress=1），改用 MotionValue 直写（与原架构同构，只是载荷 number→state）。注：评审称 scroll 侧同有 10× 冗余**有误**——scroll 的 transform 用 `(progress)=>` 直接消费入参做廉价 lerp，不调 resolveVisualState，无可共享重计算。
- **（已落地 P1）名义配置项从公共类型删除**：`CineViewPerformanceConfig.preset/virtualization/measurement` + `DragThresholdConfig.reboundDuration` 四字段全仓零消费（仅类型声明，会进 dist 给消费者补全却无实现）→ 删除；examples 三页的 `preset: 'smooth'` 同步移除。`PerformanceConfig` 仅保留实际消费的 `monitor`。

### 已实现的 scroll 模型（与早期 rewrite plan 有偏差，实现更简洁）

`SCROLL_TAKEOVER_REWRITE_PLAN.md` 设计的是 ownership-ref 记忆模型，但**实际实现未采用**。真实实现：progress 是 `scrollTop` 的纯函数（`progressPx = clamp(nativeOffset − segmentStart, 0, totalBudgetPx)`，`DirectScrollCineView.tsx` `syncZoneStatesFromNativeOffset`）。center-lock 段即真实滚动距离（`1ms=1px`），反向回段内时 `scrollTop` 从 `segmentEnd` 递减、progress 天然 `100%→0%`，**无需 ownership 记忆**——符合 design「真实 center-lock 滚动段」原则。"防跳过"由 `resolveScrollIntentOffset` 单独处理（大 delta 钳到 `segmentStart+1`/`segmentEnd−1` 强制段内帧）。注：rewrite plan 与本节属历史/现状对照，以代码为准。

### 设计与实现偏差（按优先级）

#### P0：功能 Bug

- **（已修复）Scroll 反向重入 / 大输入跨段**：center-lock reducer 重写已落地，原 46 失败全绿。反向重入靠 "段=真实距离" 的纯函数模型天然成立；大输入防跳过由 `resolveScrollIntentOffset` 保证段内帧。**仍待真实浏览器验收确认视觉无跳过。**

#### P1：API 污染（旧口径未清除）

- **（已清理 2026-06-26）`VirtualScrollPhase`**：重命名为 `SceneTimelinePhase`（`hold` 仍是活跃的进退场中段相位，非虚拟轨道坐标）。
- **（已清理 2026-06-26）`ScrollTimelineState.holdProgress/holdLength`**：纯死输出字段，已删除（含 `SceneLayoutInfo.holdLength` 内部 vestigial 字段）。
- **`SceneLegacyCompatProps` 仍可读**（`src/components/Scene/types.ts`）：`scrollSpeed`/`scrollEnterLength`/`scrollHoldLength`/`scrollExitLength`/`slideDirection`/`slideDuration` 等。**注**：公共 `SceneProps`（barrel 导出）已干净，`Scene.publicApi.test` 用 tsc fixture 证明 legacy props 会触发类型错误；这些字段仅作内部兼容存在，属内部整洁问题，非公共 API 污染。
- **（已清理 2026-06-29）`CineViewContext` 旧单轴字段**：运行时 `CineViewContextValue`（`src/context/CineViewContext.tsx`）的 `designSize`/`scale`/`convertSize` 已删除，仅保留双轴 `scaleX/scaleY/convertX/convertY`。`convertSize(s)=s·viewport/designWidth ≡ convertX`，`Image.tsx` 标量长度键归并到 `convertX`，`useConvertSize` hook 返回 `convertX`。死 CSS 变量 `--cineview-scale`/`--cineview-design-size` 同步删除。注：该接口在 `dist` 公共面 0 命中，属内部清理。另删 `types/index.ts` 死 `CineViewContext` interface + 5 个零用常量（THROTTLE_INTERVAL/DEBOUNCE_DELAY/TARGET_FPS/MAX_FRAME_TIME/MAX_BUNDLE_SIZE）。

#### P2：结构问题

- **（已收敛 2026-06-26）`SceneInternalProps` global\* 膨胀**：删除 ~20 个生产已不传的扁平 `global*` 数据 props，`globalFirstSceneEnter*` 收入 grouped `sceneRuntime`，`normalizeSceneProps` 删除 `?? props.globalX` 兜底链。两个生产入口（drag/scroll）均走 grouped 对象。**遗留**：`on*Change` 回调层仍扁平（standalone sink，待后续）；冷启动 `firstSceneEnterActive/Ready` 双 boolean 可合并为三态枚举（高风险，见 task-flow 单列项）。
- **（已修复 2026-06-26）`framer-motion` 移入 `peerDependencies`**（`>=10.0.0`）+ 保留 devDep；`vite.config.ts` 已 external，无需改。
- **（已过期）`CineViewRef.goToSceneAdvanced`**：已核实不存在，无需处理。
- **（已修复 2026-06-29）`CineViewRef` 方法全可选**：`goToScene`/`refreshLayout`/`preload`/`getCurrentScene`/`getPerformanceMetrics` 两模式均真实现，改为**必填**，消除调用点 `ref.current?.x?.()` 噪音。`goToZone` 是唯一 mode-specific 方法（drag 侧原为 no-op 空桩，已删），保持可选；新增便捷类型 `CineViewScrollRef`（`goToZone` 必填）供 scroll 消费者使用。受 React forwardRef 单 ref 类型限制，无法靠 `mode` prop 自动推断，故用「公共必填 + scroll 专属可选 + 便捷类型」方案而非完整判别共用体。

#### P3：性能（未验证）

- **scroll 场景高度测量范围**：`DirectScrollCineView` 用 `ResizeObserver` 监听 scene 容器，design.md 要求只测「布局足迹」，排除 fixed layer scaffolding/overlay/portal host。当前过滤精度需验证（`helpers.ts` 的 `ay()` measure-ignore 过滤是否覆盖全部场景）。

---

## 开发规则（摘自 design.md）

1. **不靠猜测修问题**：drag/scroll 链路排查必须依赖状态所有权 + 时间轴语义 + 关键节点日志
2. **关键状态唯一所有者**：`renderProgress`（render 轨，仅 render lane 写）/ 每个 scene 自持的 `elementElapsedMotion`（element 轨，仅该 scene 的 `useElementTrack` 写）/ `dragRelease`（全局只读指令，仅 `useSceneManager` 写）各自只有一个写入方。（历史：旧的单一全局 `sharedElapsedMs` 标量 + `dragTransitionSnapshot` 交接机制已删除，见 DESIGN.md 双轨模型）
3. **先恢复行为基线，再做架构迁移**：重构引发行为回归时，先修回归再继续拆分
4. **验收必须多 agent 真实环境实测**：scroll/drag 交互路径不能只靠实现者自跑单测收口；必须由独立 agent 在真实浏览器环境（独立 lane）跑通用户描述的完整手势/输入路径后才算验收通过
5. **每节点完成后立即读 task-flow**：不停在已通过节点上，检查下一个可执行节点

---

## 项目文件布局

```
cineview/
├── src/
│   ├── components/
│   │   ├── CineView/          # 根容器，含 DirectScrollCineView（scroll 模式实现）
│   │   ├── Scene/             # 场景组件，含 sceneScrollBudget / sceneScrollRuntime
│   │   ├── Animate/           # 动画组件，含 useAnimateDrag / useAnimateScroll / animateSemantics
│   │   ├── Position/          # 定位组件
│   │   ├── Image/             # 统一图片组件
│   │   └── Container/         # px2vw 盒模型换算容器
│   ├── animations/
│   │   ├── presets/           # 40+ 预设动画（fade/slide/zoom/rotate/flip/bounce/blink/shake/blur/elastic/special）
│   │   ├── registry.ts        # 纯模块：waitFor 链计算 + 循环依赖检测
│   │   ├── composer.ts        # 组合动画（sequential/parallel）处理器
│   │   └── animationParser.ts # 动画解析（string → variant）
│   ├── hooks/
│   │   ├── useSceneManager.ts # 场景索引 + drag/scroll transition snapshot
│   │   ├── useImagePreloader.ts
│   │   └── imagePreloadCache.ts
│   ├── context/
│   │   └── CineViewContext.tsx
│   ├── utils/
│   │   ├── gestureDetector.ts / dependencyChecker.ts / styleConvert.ts
│   │   ├── throttle.ts / debounce.ts / performanceMonitor.ts / animationHelpers.ts
│   │   └── gestureHandlers.ts
│   ├── types/index.ts         # 所有公共类型（注意：含待清理旧字段，见已知问题）
│   └── index.ts               # barrel 导出
├── design.md                  # 架构裁决（唯一有效规格）
├── requirements.md            # 需求文档（验收标准）
├── AGENT_SELF_REVIEW.md       # 历史失误记录（必读）
├── AGENTS.md                  # 本文件
└── task-flows/                # 每次任务的执行节点跟踪文件
```

---

## 下一步重点工作（按优先级）

1. **scroll 真实浏览器验收**（最高优先级 / 未完成）：自动化全绿后，按 AGENTS.md 规则 4 由独立 agent 在 `localhost:3000/#/scroll` 实测完整路径——正向锁定 `0→100%`、释放、反向重锁 `100%→0%`、键盘/scrollbar 同行为、大 flick 防跳过、多 zone 倒序重放。单测全绿 ≠ 视觉正确。

   **注**：本轮（2026-06-29 评审整改）的 scroll 运行时改动（`onReady` fire-once、scrollbar listener cleanup）虽有单测红证，仍计入此项待验收范围。

2. **冷启动 `firstSceneEnter` 三态合并**（高风险，需配 drag 浏览器验收）：双 boolean → `'waiting' | 'driving' | 'done'` 枚举，消除非法态。位于历史回归高发区，单列推进。
