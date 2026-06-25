# CineView — Agent Onboarding Guide

## 项目简介

CineView 是一个面向 React 的叙事型 UI 框架，支持 `drag`（拖拽分页）和 `scroll`（真实文档流滚动接管）两套模式引擎。它提供场景管理、动画编排、响应式双轴换算、图片预加载和 scene-scoped fixed layer 能力。

- **工作目录**: `cineview/` （所有代码操作均在此目录内完成）
- **包管理器**: pnpm
- **构建工具**: Vite 5
- **测试框架**: Jest 29 + React Testing Library + @fast-check/jest
- **动画库**: Framer Motion 11

---

## 启动前必读

每次开始**实质性工作**前，必须按顺序：

1. 读 `design.md` 和 `requirements.md`（理解当前有效规格）
2. 读 `AGENT_SELF_REVIEW.md`（了解历史失误，避免重蹈覆辙）
3. 创建或读取当次任务的 `task-flows/YYYY-MM-DD-<short-slug>.md` 文件
4. 在开始实现前在 task-flow 文件中明确列出节点并逐一打勾推进

**禁止**：在没有 task-flow 的情况下跨多文件重构。

**强制**：scroll / drag 交互路径的验收，必须由独立的 agent 在真实环境（浏览器 lane，`localhost:3000/#/drag` 或 `#/scroll`）完成实测——实现 agent 与验收 agent 分开，验收不能只跑单测/type-check 就收口。单测全绿 ≠ 视觉正确。

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

| 组件 | 职责 | 不负责 |
|---|---|---|
| `CineView` | 唯一模式入口、双轴换算上下文、scrollbar 注入、预加载调度 | 具体场景布局 |
| `Scene` | 章节级布局边界、scene-scoped fixed layer 宿主、可视信号 | 根模式配置、drag/scroll 参数 |
| `Animate` | 消费当前 mode 时间语义（drag/scroll/visibility/auto） | 声明根模式 |
| `Position` | 双轴响应式定位、scene-scoped fixed layer 挂载 | 跨 scene 漂浮 |
| `Image` | 统一图片预加载接口 | 阻塞首屏可见性 |
| `Container` | 双轴换算容器 | — |

### 关键上下文/运行时文件

- `src/context/CineViewContext.tsx` — 双轴换算上下文 Provider
- `src/components/CineView/runtimeContext.tsx` — CineView 运行时上下文（模式、drag/scroll 全局状态）
- `src/components/Scene/sceneScrollRuntime.tsx` — scroll takeover Context（`SceneScrollRuntimeContext`、`SceneScrollTimelineContext`、`SceneScrollTakeoverContext`）
- `src/components/Scene/sceneScrollBudget.ts` — scroll 动画时长 → 真实滚动距离换算（1ms=1px）
- `src/components/CineView/DirectScrollCineView.tsx` — scroll 模式根实现（真实滚动容器、center-lock reducer）
- `src/components/Animate/animateSemantics.ts` — legacy flat props → 标准 `timeline`/`duration`/`visibility` 归一化适配层

### 数据流原则

- **Drag 模式**: `renderProgress`（位移）、`sharedElapsedMs`（时间轴）各有唯一所有者；Animate 通过 `useAnimateDrag` 用 `useTransform(visualMotion, () => resolveVisualState(...))` 单输入映射，按 scene 状态（rest/incoming/settling/outgoing/hidden）解析视觉态；delay 经 `resolveEnterLocalProgress(sharedElapsedMs, delay, enterDuration)` 门控
- **Scroll 模式**: 唯一 scroll owner 原则（`Scene.scroll` progress owner 或 native document flow，二者不并行）；scene progress 用真实 px（1ms=1px）表示；center-lock reducer 统一处理 wheel/touch/keyboard/scrollbar/native 路径
- **禁止**: 同一输入在两个消费者之间拆分；cross-mode 状态复用；跨 scene 的 fixed layer 漂浮

---

## 公共 API 速查

### CineView

```tsx
<CineView
  config={{ width: 750, height: 1334, unit: 'px' }}
  mode="scroll"                        // 'drag' | 'scroll'，默认 'drag'
  modes={{
    drag: { direction: 'y', transitionDuration: 800, threshold: {...} },
    scroll: { direction: 'y', zoneTrigger: 'center-lock' },
  }}
  scrollbar={{ enabled: true, width: 6, autoHide: true }}
  callbacks={{ common: { onReady }, drag: { onDragCommit }, scroll: { onZoneProgress } }}
  performance={{ preset: 'balanced' }}
  ref={cineViewRef}
>
```

**Ref 方法**: `goToScene(index, animated?)` / `goToZone(zoneId, opts?)` / `refreshLayout()` / `preload(targets?)` / `getCurrentScene()` / `getPerformanceMetrics()`

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

## 已知问题与当前状态（2026-06-23）

### 测试状态

- **总计**: 817 tests，771 通过，46 失败（均在 `DirectScrollCineView.test.tsx`）
- **失败集中点**: scroll 模式 center-lock 场景**反向重入**（completed 100% → backward → 0%），programmatic `goToZone` 后的 progress 重置，以及涉及 scene 边界跨越的大输入处理

### 设计与实现偏差（按优先级）

#### P0：功能 Bug

1. **Scroll 反向重入 bug**（`DirectScrollCineView.test.tsx` 失败核心）  
   scene 完成到 100% 后，从后方文档流反向回到 center-lock 触发点时，progress 未从保留的 100% 向 0% 回退，而是没有恢复接管权或重置为 0。  
   定位：`DirectScrollCineView.tsx` center-lock reducer 的反向 ownership 恢复逻辑。

2. **大输入跨越 center-lock 段处理**  
   requirements 7.21 / design 「Root Scroll 运行规则」第 13 条：一次 delta 足够跨完整段时，reducer 必须产生一个段内 progress frame，后续输入再移动。当前行为疑似直接跳过。

#### P1：API 污染（旧口径未清除）

3. **`SceneLegacyCompatProps` 仍可读**（`src/components/Scene/types.ts`）  
   包含 `scrollSpeed`、`scrollEnterLength`、`scrollHoldLength`、`scrollExitLength`、`slideDirection`、`slideDuration` 等已废弃字段，requirements 3.7 / 7.22 要求删除。  
   当前状态：作为内部兼容 props 存在，未从 public API 入口删除。

4. **`VirtualScrollPhase` 仍在 public types**（`src/types/index.ts` line 21）  
   这是虚拟滚动轨道的内部概念，requirements 26 要求删除虚拟滚动轨道路径。

5. **`ScrollTimelineState` 包含 `holdProgress/holdLength`**  
   `hold` 是旧虚拟 3-phase 模型概念，与新的 `0%→100%` scene progress 模型不一致，混淆读代码者。

6. **`CineViewContext` 接口同时含旧字段**（`src/types/index.ts` 约 432 行）  
   `designSize`、`scale`、`convertSize` 是单轴旧 API，与 `scaleX/scaleY/convertX/convertY` 双轴 API 共存，应废弃旧字段。

#### P2：结构问题

7. **`SceneInternalProps` 过度膨胀**（`src/components/Scene/types.ts`）  
   `global*` 前缀字段多达 18+ 个，设计文档明确指出这是性能与维护风险。应将 runtime 状态通过 Context 传递而非 prop drilling。

8. **`framer-motion` 应为 peerDependency**  
   当前在 `dependencies` 中，会导致用户项目重复安装 framer-motion，违背库设计惯例。应移入 `peerDependencies`（建议 `"framer-motion": ">=10.0.0"`）。

9. **`CineViewRef.goToSceneAdvanced` 超出规格**  
   requirements 14 只定义了 `goToScene`、`goToZone`、`refreshLayout`、`preload`、`getCurrentScene`。`goToSceneAdvanced` 属于未声明扩展，若保留需在 requirements 中补充。

#### P3：性能

10. **scroll 场景高度测量范围**  
    `DirectScrollCineView` 使用 `ResizeObserver` 监听 scene 容器，但 design.md 要求只测量「布局足迹」，排除 fixed layer scaffolding、overlay/portal host 等节点。当前是否精确过滤需验证。

---

## 开发规则（摘自 design.md）

1. **不靠猜测修问题**：drag/scroll 链路排查必须依赖状态所有权 + 时间轴语义 + 关键节点日志
2. **关键状态唯一所有者**：`renderProgress` / `sharedElapsedMs` / `dragTransitionSnapshot` 各自只有一个写入方
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
│   │   └── Container/         # 双轴换算容器
│   ├── animations/
│   │   ├── presets/           # 40+ 预设动画（fade/slide/zoom/rotate/flip/bounce/blink/shake/blur/elastic/special）
│   │   ├── registry.ts        # 纯模块：waitFor 链计算 + 循环依赖检测
│   │   ├── composer.ts        # 组合动画（sequential/parallel）处理器
│   │   └── animationParser.ts # 动画解析（string → variant）
│   ├── hooks/
│   │   ├── useResponsive.ts   # 双轴换算 + resize 监听
│   │   ├── useSceneManager.ts # 场景索引 + drag/scroll transition snapshot
│   │   ├── useImagePreloader.ts
│   │   └── imagePreloadCache.ts
│   ├── context/
│   │   └── CineViewContext.tsx
│   ├── utils/
│   │   ├── sizeConverter.ts / gestureDetector.ts / dependencyChecker.ts
│   │   ├── throttle.ts / debounce.ts / performanceMonitor.ts / animationHelpers.ts
│   │   └── gestureHandlers.ts
│   ├── types/index.ts         # 所有公共类型（注意：含待清理旧字段，见已知问题）
│   └── index.ts               # barrel 导出
├── design.md                  # 架构裁决（唯一有效规格）
├── requirements.md            # 需求文档（验收标准）
├── AGENT_SELF_REVIEW.md       # 历史失误记录（必读）
├── CLAUDE.md                  # 本文件
└── task-flows/                # 每次任务的执行节点跟踪文件
```

---

## 下一步重点工作（按优先级）

1. **修复 scroll 反向重入 bug**（DirectScrollCineView.test.tsx 46 失败的根因）
2. **清理 legacy compat 公开类型**：删除 `VirtualScrollPhase`、`holdProgress/holdLength`，废弃 `CineViewContext` 旧单轴字段
3. **将 framer-motion 移入 peerDependencies**
4. **收缩 SceneInternalProps**：global* 字段改为通过专用 Context 传递
