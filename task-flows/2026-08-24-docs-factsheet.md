# CineView 公共 API 事实源核对单（N2 产物，2026-08-24）

> 写文档只准用本文件的事实。每条均来自当前源码，拿不准的标 ⚠️。
> 真源：`src/index.ts` / `src/public-api.ts` / `src/types/index.ts` / 各组件源码。

## 0. 包入口（包体积相关，文档必讲）

- `cineview`（全量入口，`src/index.ts`）：CineView 运行时按 `mode` 派发，含 drag + scroll 两套引擎。
- `cineview/drag`（`src/entry-drag.ts`）：只含拖拽引擎；导出 `CineViewDragProps`。
- `cineview/scroll`（`src/entry-scroll.ts`）：只含滚动引擎；导出 `CineViewScrollProps`。
- 单文件 UMD 无法代码拆分，只用单模式时务必用按模式入口。

## 1. Barrel 导出清单（src/public-api.ts + index.ts）

- 组件：`CineView`、`Scene`(forwardRef)、`Animate`(FC)、`Position`(forwardRef)、`Container`、`Image`(forwardRef)、`AnimateVideo`
- Hooks：`useAnimateTimeline`
- 类型：全部 `src/types/index.ts` 公共类型（见 §6）+ `ImageProps`、`AnimateVideoProps`、`CineViewDragProps`、`CineViewScrollProps`

## 2. CineView

```tsx
<CineView config={{size:750}} mode="scroll" modes={{drag:{...},scroll:{...}}} scrollbar={{...}} performance={{monitor:true}} callbacks={{...}} ref={ref}>
```

来源：`src/types/index.ts:40-52,75-100,197-250,356-379,406-422`

### props（CineViewProps = mode 判别的 union；drag 默认）

| prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `config.size` | number | 750 | 设计稿宽度基准（设计 px），`scale = viewportWidth / size`。全站唯一尺子，认宽不认高，绝不形变；scroll takeover 时间预算仍 1ms=1px |
| `mode` | 'drag'\|'scroll' | 'drag' | drag 分页 / scroll 真实文档流接管 |
| `modes.drag.direction` | SlideDirection('x'\|'y') | — | 滑动方向 |
| `modes.drag.transitionDuration` | number | 800（DEFAULT_SLIDE_DURATION） | 场景切换时长 ms |
| `modes.drag.threshold` | {minVelocity,maxVelocity,minRatio,maxRatio} | — | 手势阈值 |
| `modes.drag.unit` | 'time'\|'percent' | 'time' | Scene 元素时间轴的拖拽映射单位 |
| `modes.drag.scale` | number | time=10 / percent=1 | 每拖拽 1% 的映射量 |
| `modes.drag.firstSceneTimeout` | number | 3000 | 首屏优先图等待上限 ms；超时发 FIRST_SCENE_TIMEOUT（可 preventDefault，默认回退为静态放置首场景 rest 态）|
| `modes.scroll.direction` | SlideDirection | — | |
| `modes.scroll.zoneTrigger` | 'center-lock' | — | 目前唯一 trigger |
| `modes.scroll.sceneSizing` | 'content'\|'screen' | — | 场景尺寸策略 |
| `modes.scroll.enterMargin/exitMargin` | number | 50 | visibility 闸门的全局默认（设计 px） |
| `scrollbar` | false\|ScrollbarConfig | — | {enabled, ariaLabel, width(默认6), radius, inset, trackColor, thumbColor, thumbHoverColor, autoHide} |
| `performance.monitor` | boolean | — | 仅有的 performance 字段 |
| `callbacks` | 按 mode 判别 | — | 见下 |

### callbacks（判别说：drag 模式写 scroll 回调 = 类型错误，反之亦然）

- 公共：onReady(api)、onLoadProgress(progress)、onSceneWillChange({fromIndex,toIndex,direction})、onSceneDidChange、onError({code,message,context?,preventDefault?})
- drag 专属：onDragStart(带方向，首次方向确认的手势才发)、onDragProgress、onDragBlocked({fromIndex,targetSceneIndex,direction})、onDragCommit(带 targetSceneIndex/elapsedMs/timelineDurationMs)、onDragCancel
- scroll 专属：onZoneEnter/onZoneLeave({zoneId,sceneIndex})、onZoneProgress(+progress)、onSceneVisibilityChange({sceneIndex?,visible,progress})

### 错误码（CineViewErrorCode，types/index.ts:133-141）

NO_SCENES / IMAGE_LOAD_FAILED / FIRST_SCENE_TIMEOUT(可恢复) / INVALID_ANIMATION(waitFor 指向不存在) / CIRCULAR_DEPENDENCY / INVALID_COMPONENT_HIERARCHY(重复 animateId 或 zone identity) / INVALID_DRAG_CONFIG(可恢复) / ANIMATION_ASSET_LOAD_FAILED(可重试)

### ref 方法（CineViewRef，406-422）

- 必填（双模式都有真实现）：`goToScene(index, animated?)` / `refreshLayout()` / `preload(targets?) => Promise<void>`（target=场景索引 number 或 sceneId；scroll 下也可匹配 zoneId）/ `getCurrentScene(): number` / `getPerformanceMetrics(): PerformanceMetrics`
- `goToZone(zoneId, {align:'center', animated?})`：scroll 专属、可选；scroll 消费者可用 `CineViewScrollRef`（goToZone 必填视图）
- PerformanceMetrics: {fps, avgFrameTime, memoryUsage?, bundleSize}

## 3. Scene（types/index.ts:427-456）

| prop | 类型 | 说明 |
|---|---|---|
| sceneId | string | |
| layout | {width, height, anchor: 九宫格 SceneAnchor, overflow:'hidden'\|'visible'\|'clip'} | |
| stack | {mode:'replace'\|'cover', zIndex} | |
| transition | {enterAnimation, exitAnimation, exitDuration} | AnimationType（见 §6） |
| assets | {preloadImages: string[]} | |
| drag | SceneDragConfig {enabled(默认true), unit('time'默认), scale(time默认10/percent默认1)} | 场景级拖拽映射 |
| scroll | {zoneId, trigger:'center-lock'} | **scroll 模式下配置了它 = takeover zone** |
| callbacks | {onVisibilityChange(detail)} | |
| 其余 | HTMLAttributes（除 children） | |

⚠️ 内部存在 `SceneLegacyCompatProps`（scrollSpeed/scrollEnterLength/scrollHoldLength/scrollExitLength/slideDirection/slideDuration），仅内部兼容，公共 SceneProps 上没有，写了会类型报错（Scene/types.ts:63,77,96；Scene.publicApi.test 守卫）。**文档不得出现这些字段。**

## 4. Animate（types/index.ts:461-596）

- `animateId`：组件唯一标识（重复 = INVALID_COMPONENT_HIERARCHY）
- `enterAnimation`/`exitAnimation`：AnimationType = PresetAnimation（41 个，types/index.ts:259-313）| CustomAnimation({initial,animate,exit} Framer variant 子集) | ComposedAnimation({animations, mode:'sequential'|'parallel', delays})
- `duration.enter/exit`：ms
- `timeline.sceneControlled`（默认 true，优雅推断）：
  - true + scroll takeover zone 内（继承 zoneId）→ zone 真实滚动预算驱动，可配 `phase`
  - true + scroll 非 zone → 降级为可见性闸门
  - true + drag → Scene 共享元素时间轴驱动
  - false + scroll → 强制独立可见性闸门（即使在 zone 内）
  - false + drag → Scene 到场后按真实时间独立播放；**不参与 registry/waitFor/T_self，忽略 exitAnimation**
- `timeline.delay`（ms）、`timeline.waitFor`（animateId 链；不存在=INVALID_ANIMATION；循环=CIRCULAR_DEPENDENCY）、`timeline.zoneId`、`timeline.phase.{start,end}`
- `visibility.replayOnReenter`、`enterMargin/exitMargin`（设计 px，默认取 modes.scroll 全局值 50；超高元素回退 center/70% 规则）
- `enterRef`：调用即立即入场、打断等待中的 waitFor/delay；传了 ref+waitFor/delay → waitFor/delay 兜底；传 ref 无 waitFor/delay → 永不自动触发
- `exitRef`：传了即禁用自动退场（scroll 离 zone / drag 切 scene 都失效），必须手动调；**不支持 delay 兜底**
- `infiniteAnimation`：常驻循环动画；与 enterAnimation 二选一或共存（InfiniteOnly 时 enterAnimation 必须为 never）。由 shouldRunInfinite 门控：只在元素处于自己 phase 且在视口内运行
- `stagger`：{each(默认40ms), from('first'默认|'last'|'center')}；framer 原生 staggerChildren 逐个揭示直接子元素；时间驱动不 scrub；设了 stagger 时 children 必须是单个 ReactElement
- render-prop children：`(state: AnimateRenderState) => ReactNode`，state = {enterProgress: 0..1, phase: 'idle'|'waiting'|'entering'|'entered'|'exiting'|'exited'}
- **适配层**：legacy flat props 会被 animateSemantics.ts 归一化为 timeline/duration/visibility

## 5. AnimateVideo（AnimateVideo.tsx:23-77）

帧擦除：滚动/拖拽进度 ↔ video.currentTime（反向=倒放）。原生 `<video>`，Animate 薄封装。
props：src（scrub 片源建议密集关键帧/全关键帧编码）、aria-label、width/height（数字=设计 px）、style、preload（填共享预载缓存）、poster、playbackRate、scrubRange([from,to] 秒，支持反向区间)、releaseOnLeave（scroll takeover zone 专属，默认 false：离开 zone 超 1.5 视口释放解码帧 pause+removeAttribute('src')+load()，回到 1 视口内重挂 blob 零网络；Schmitt 排序防抖动）、animateId、duration、enterAnimation/exitAnimation（默认中性 variant，擦除本身是动画）、timeline{delay,waitFor}、visibility{replayOnReenter,enterMargin,exitMargin}

## 6. Position / Container / Image

- **Position**（types/index.ts:653-680）：`at.{x,y,offsetX,offsetY}` 设计 px 单尺子换算；`at.anchor: 'center'|'center-x'|'center-y'` 居中锚点（居中后 x/y 变成相对中心的偏移，被居中轴忽略 offset 链）；`layer.fixed`: scroll 模式下进入 scene-scoped fixed layer（portal 到 SceneFixedLayerContext，Position.tsx:43,52,152-153）；forwardRef 到根 div
- **Container**：`width`/`height`（设计 px）+ style 内所有长度量（padding/margin/gap/borderRadius/fontSize...）按单尺子换算
- **Image**：src/alt 必填；width/height 数字按 convert 换算；`preload`: 入共享预载缓存

## 7. Hooks 与内部（勿写进公共文档的除外）

- `useAnimateTimeline()`（animateTimeline.tsx:26）：必须在 `<Animate>` children 内，否则 throw。返回 `AnimateTimeline`：{mode, driver('drag'|'scroll'|'visibility'), progress, signedProgress, phase, frame}——全部 MotionValue，只读，更新绕过 React 渲染管线（做连续值/canvas 自绘用这个，不要自建 useSpring）
- 常量：DEFAULT_SLIDE_DURATION=800, DEFAULT_ANIMATION_DURATION=600
- `useCineViewContext`/`useConvertSize` 在 context 文件里但是**非 barrel 导出**，文档不写

## 8. 坑与排错素材（已逐条 grep 验证存在）

1. **scroll takeover scene 内裸写 position:fixed 会被祖先 transform 吃掉**：滚动接管走的是真实 transform，fixed 相对的不是视口。正解：Position 传 `layer={{fixed:true}}`，portal 进 scene-scoped fixed layer（Position.tsx:43,52,152-153）
2. **infiniteAnimation 受门控**：shouldRunInfinite——元素退出自己 phase 或滚出视口即停（useAnimateScroll.ts）；CSS `animation: ... infinite` 不受 phase 约束，禁用
3. **enterRef/exitRef 是时间驱动轨的手动控制**：enterRef 有 waitFor/delay 兜底语义；exitRef 没有兜底、且禁用全部自动退场（types/index.ts:502-560）
4. **sceneControlled 见 §4 五行表**：尤其 `false + drag` 会忽略 exitAnimation——文档要亮出来
5. **scroll takeover 预算 1ms=1px**：duration 毫秒数 = 真实滚动距离 px（sceneScrollBudget.ts 双轨字段 startMs/startPx 同值）；反向回段进度天然 100%→0%，无跳转
6. **legacy Scene props 不存在于公共面**：scrollSpeed/scrollEnterLength/slideDirection 等会让 tsc 报错，别再从旧教程抄
7. **waitFor 只能指向已存在的 animateId**，循环 = CIRCULAR_DEPENDENCY；zone 内 stagger 是时间驱动不 scrub（要 scrub 的逐元素揭示用 render-prop 的 enterProgress）
8. **waitFor 入场链必须有对应退场编排**：只写 enterAnimation 链会导致所有元素 exit 同时触发（打包回滚）
9. **UMD 单文件无代码拆分**：单模式消费者用 `cineview/drag` 或 `cineview/scroll` 入口

## 9. 待验证（写正文遇到再查）

- ⚠️ scrollbar 各字段默认值（width:6 来自 AGENTS.md 速查，未在源码复核）
- ⚠️ Scene.layout.width/height 的默认值行为
- ⚠️ zones 组件注册与 zoneId 继承细节（子 Animate 如何继承 zoneId）
