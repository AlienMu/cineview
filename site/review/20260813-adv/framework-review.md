# 框架侧对抗复审报告（2026-08-13 · /drag 末幕黑幕退场「持续下移」）

> 独立 Explore 子 agent 产出，父 agent 落盘。

## 1. 机制结论——逐条核对

### 1.1 下移动画 = release 补间驱动 DragSceneFrame — **CONFIRMED**

- 框变换：`DragSceneStack.tsx:99-111`，`offset = (index − currentScene − clampedProgress) × 100`，`translate3d(0, offset%, 0)`，订阅 `renderProgressMotion.on('change')`。末幕回滑 rp<0 不被 clamp（:104 只钳 `rp>0`）→ offset = −rp×100 → 正 → 下移。
- settle 补间写该 MotionValue：`useDragSceneEngine.ts:708-743`（`animate(laneProgress, targetProgress)`，onUpdate `dragProgressMotion.set(latest)` :722）。
- **时长修正（我方原述 720ms 部分 REFUTED）**：settle 时长 = `|target−current| × slideDuration/1000`（:702），`slideDuration` 默认 **800ms**（DEFAULT_SLIDE_DURATION，types/index.ts:711），站点未传。满程 800ms、中段释放约 320–680ms。720ms 只是 CineView 的 settle 兜底定时器（CineView.tsx:97-114），与 release 补间无关。
- `useSceneManager.ts` 用 framer animate() — **REFUTED**：该文件无 framer import，纯 state 管理。

### 1.2 从末幕往回滑松手 → **settle（commit）** — CONFIRMED

- threshold minRatio 0.15/maxRatio 0.32（TemporalDragExperience.tsx:124-129）；低于阈值走 bounce（rp→0，框回上移）。
- 退场场景（scene 5）的 element track 不被 settle 触碰（release 只指向 targetSceneIndex=3，useElementTrack.ts:365）——黑幕位移唯一来源是 render lane。

### 1.3 currentScene 切换时机 — CONFIRMED

- settle onComplete → `commitRelease`（:673-697）→ onDragCommit → commitDragSceneChange（useSceneManager.ts:471-544）：`setCurrentScene(target)` 与 `setRenderProgress(0)` 同批。**currentScene 在补间全程保持 4**，offset 公式连续无跳变。
- ⚠️ **onDragCommit 在 settle 完成时发（:741 → :689），不是 release 起点**——site agent 的「onDragCommit = settle 补间开跑前」判断有误，已由父 agent 复核代码确认。

## 2. act5 退场路径动画全清单（settle 期间逐项）

| 动画 | 位置位移? | 证据 |
|---|---|---|
| **DragSceneFrame 框平移**（黑幕 = 场景背景随框走） | **是——唯一黑幕位移源** | DragSceneStack.tsx:99-111 + useDragSceneEngine.ts:708-743 |
| s05-beam | 否（opacity/scale；回滑退场忽略 authored exitTarget 改走 enter 反向） | useAnimateDrag.ts:368-374 |
| s05-copy-exit 组 | 否（authored exit 回滑被忽略；enter 恒 opacity1 → 反向无视觉变化） | useAnimateDrag.ts:353-377 |
| 5 条 credit 外层 y:80→0 | 幕内 ±80px 反向回退 | SceneCut.tsx:96-109 |
| THE END（y18/scale） | 幕内 18px | SceneCut.tsx:128-138 |
| 灰尘/颗粒 infinite lane | 回滑瞬间停（'outgoing' 模式 shouldRunInfinite false） | useAnimateDrag.ts:772-778 |
| Scene 级 transition.enter/exitAnimation | **drag 模式不播放**（忽略+warn，Scene.tsx:418-440；controls 被钉恒等 useDragSceneEngine.ts:196-202） | — |
| scene 5 element track | 无动画（settle 不指向它） | useElementTrack.ts:365 |

commit 后 scene 5 进 'hidden'（useAnimateDrag.ts:287-292），所有元素瞬 snap 到 enter-initial；框停在 100% 屏外。

## 3. scroll 首页反向核查——「scroll 页没有黑幕下移动画」成立

- scroll 模式视觉全部是 scrollTop 纯函数：useScrollSceneEngine 只用 `controls.set`（即时）；纠正性 scrollTo 一律 `behavior:'auto'`；smooth 仅限 goToScrollZone（首页未用）。
- Scene 根 `transform: translateZ(0)` 恒定、无 transition；ScrollSceneSlot takeover transform 恒定。
- HomeBackdrop：scroll 事件单次 rAF 投影、空闲零 rAF、scrollTop 纯函数——输入停止即静止。
- `scroll-behavior: smooth`（tokens.css:90）只影响编程滚动/锚点。
- 输入停止后仍持续的动画仅三处，均与黑幕下移无关：熄灯 overlay `opacity 1.05s`（仅 opacity）；分栏 gap/标题 translateY(16)（一次性、水平/微上浮）；星光变量 lane（opacity 变量）。

## 4. 修复选项评估（对照 DESIGN.md 双轨/transaction 不变量）

### (a) site 根级黑层 — **可行，推荐（修正编排）**

- 回调契约实测：`onDragProgress` 在 pan 每帧发（useDragSceneEngine.ts:386-389）**且在 bounce 每 tick 发（:477），但 settle 期间不发**（:711-737 不调用）；`onDragCommit` 在 **settle 完成时**发；`onSceneDidChange` 在 commit 后发。
- **编排（z-1 静态黑层）**：黑层放 `.drag-temporal` 第一个子元素、`position:absolute; inset:0; z-index:1`（高于容器背景、低于全部场景框 z 10/1）；`.tp-scene--05` 背景改透明。opacity：手势期 `onDragProgress` 直写（退场 1−progress、进场 progress），commit 时 snap（此刻 act4 框已铺满、黑层被完全盖住，snap 不可见）；bounce 回程 onDragProgress 每 tick 发 ⇒ cancel 时黑层自动淡回 1。零框架改动、不碰单写者不变式。
- 残余：settle 期间黑层 opacity 冻结在释放值（act4 不透明框从上方盖下，视觉连续）；credits 仍随框滑（用户只反对黑幕滑，内容滑属正常 drag 过渡）。
- ⚠️ site agent 的 z-60 蒙版变体**不可行**：onDragCommit 太晚（settle 完成后才发），蒙版无法在松手时刻点亮盖住补间；且 z-60 会盖住颗粒/内容。

### (b) 框架原生选项 — **全部 REFUTED**

- drag 模式 Scene 级 transition.enter/exit 不播放（Scene.tsx:418-440 忽略+warn）。
- stack.mode 'cover'/'replace' 在 drag 模式无任何实现（effectiveSceneStackMode 只走 scroll 路径）。
- 场景级「不随框平移」机制只存在于 scroll（SceneFixedLayer 仅 scroll 渲染，Scene.tsx:906-912）。
- ⇒ 做 (b) 等于给 drag 加 backdrop 概念，改动面大，本轮不做（列入待专项）。

### (c) 场景内反平移 — 可行但脆弱

- 依赖未成文默认值 800/800 隐性耦合、违反规则 6「不在框架外复刻框架机制」精神。否决。

## 5. 推荐 + 待拍板

**推荐 (a) 完整变体**：z-1 根级黑层（保渐变）+ .tp-scene--05 透明 + onDragProgress 跟手 opacity + commit snap。零框架改动。

决策点：
1. 黑幕琥珀渐变是否保留（推荐保留：同款渐变迁到黑层，零成本）。
2. 淡出节奏：跟手 scrub（推荐）+ 黑层加短 CSS transition（~250ms）平滑尾巴。
3. 进场对称：黑幕也静止、跟手淡入（推荐对称；否则进场仍随框滑入、和退场割裂）。
4. 长线：框架 drag 模式 backdrop/fixed-layer 原生能力——记 task-flow 待专项，不在本轮做。
