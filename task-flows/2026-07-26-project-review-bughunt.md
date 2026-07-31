# 2026-07-26 全项目评审：边界能力矩阵 + bug 搜查 + 易用性/开箱即用

## 目标

评审当前项目（代码 / 易用性 / 开箱即用，不含文档），梳理边界能力支持情况，搜查 bug，产出优先级修复计划；随后逐项落实，每次落实后派独立子 agent 验收，有问题继续修，直至收口。

## 节点

- [x] 1. 基线：type-check 0 错、lint 0 错 0 警、test 88 suites / 1222 全绿（2026-07-26 实测，工作区含 temporal-drag 未提交改动）
- [x] 2. 并行评审（5 个子 agent，read-only）：
  - [x] 2a. 公共 API 易用性 / 开箱即用 —— 已返回，findings 见下方「发现记录 · A」
  - [x] 2b. 边界能力矩阵 —— 已返回，findings 见「发现记录 · B」
  - [x] 2c. drag 热路径 bug 搜查 —— 已返回，findings 见「发现记录 · D」
  - [x] 2d. scroll 热路径 bug 搜查 —— 已返回，findings 见「发现记录 · S」
  - [x] 2e. 外围模块 bug 搜查 —— 已返回，findings 见「发现记录 · E」
- [x] 3. 汇总去重（同根合并：A3=B11-NO_SCENES；E-A4=B4；E-E1=B6；B1=S-F7；B10=S-F4）；逐条核实由各修复 agent 在动手前回读源码执行，误报即上报不修
- [x] 4. 优先级计划已产出，见下方「修复计划」
- [x] 5. 逐项落实修复（每项：实现 → 单测红证 → 全量绿）—— W1~W9 全部落地
- [x] 6. 独立子 agent 验收（drag 交互路径真实浏览器 lane 受信 CDP 实测）：验收轮 1 → 9 PASS/1 FAIL → W9 修复 → 验收轮 2 全 PASS
- [x] 7. 收口自检（CLAUDE.md 完成后自检四条）+ 更新本文件

## 修复计划

### 波次 1（并行，文件分区互不相交）

- [x] **W1 scroll 修复** 完成（8/8，git-checkout 回退实测 10 断言全红后恢复绿）：S-F1 最近距离回退、S-F3 `isEditableOrInteractiveScrollKeyTarget` 抽取+capture 放行、S-F5 上报基线改「上次上报值」+端点强制上报、S-F13 isScrolling 仅 fromGesture、A3 scroll NO_SCENES emit、B11 越界 warn、B3 zone 碰撞一次性 warn（保持 last-wins）、A2 resolveDesignDimensions 兜底 750+error 去重。波次 1 合流后全仓 91 suites/1258 全绿、type-check 0。跨分区遗留：CineView.tsx:725 `designSize<=0` 分支成死代码 → 移交 W4 删除。
- [x] **W2 类型/上下文/构建** 完成：A1 前半（`DEFAULT_DRAG_TIME_SCALE=10` 常数入 types + JSDoc 修正）、A2 前半（config 可选）、A5、A6（Position/Scene 改 ForwardRefExoticComponent；Animate 本就是 FC 不动）、A8（四死类型删除，grep 红证）、A9、E-B1（resolveDesignSize 守卫+error once，revert-to-red 红证）、E-B2（debounceCancelable+cleanup cancel，红证）、E-B3（identityConvert 单例+warn once，红证）、A4（dts exclude setupTests，dist 0 泄漏，build:verify 12/12）。type-check/lint 0 错，src/context+src/types 24/24。遗留上报：utils 普通 `debounce` 现零生产消费可后续清理；DEFAULT_DRAG_TIME_SCALE 是否进 barrel 待波次 2 定夺。
- [x] **W3 预加载/动画** 完成：E-A1（!ok 抛错不入缓存可重试，红证）、E-A4（图片 15s/视频 30s 超时 + settle 幂等四出口 + priority 批并发化，红证含门卡死复现）、E-E1（`mergeTimedVariants` per-value transition，sequential/parallel 双路径，红证）、E-E2（sourceIndex 对齐，红证）、E-E3（命名常数 + 显式 duration:0 尊重）、E-E5（Unknown preset 干净警告）、E-E8（相等早退 + isMultiTokenString 守卫防不等多值坍缩，红证）。分区 22 suites/371 全绿。注：全仓 1257/1258 时两处失败为 W1 分区并行中文件（config.size 文案），待 W1 收口复跑。
- [x] **W5 站点修复** 完成：D-F3 修复（全部 stop() 后置 null + dragStart 清 pendingUnmountRef，恢复「ref 非空 ⇔ tween 存活」不变量，顺带消除 pending 骑上 driveSink(0) 的全亮卸载竞态）；D-F12 TickBar 改全宽 track 层 + `x: 0→100%`（compositor-only，零 layout invalidation）。site type-check/eslint 绿。真机验收待验收轮。

### 波次 2（W1/W2 合流后，drag 侧同文件串行）

- [x] **W4 drag 修复** 完成（8/8，stash 回退 13 测试全红后恢复绿）：D-F5 pointercancel 一律 bounce（复用既有路径，onDragCancel 时序与普通 bounce 一致）、D-F7 覆写前释放旧 capture+clearEndListeners、D-F6 programmaticNavRef 传真实 fromIndex + token 比对只清自己的 enter 指令、B2 totalScenes 收缩重钳+解挂 isAnimating、D-F2 bounce=min(progress×slideDuration,300ms) 两轨对齐、A1 后半（常数统一，useElementTrack ?? 100 已死）、A10 settle 兜底 500→DEFAULT_SLIDE_DURATION(800)、收尾删 designSize<=0 死分支+重复 performanceMonitor.start。全仓 91/1282 绿。

### 波次 3（设计级，单独推进）

- [x] **S-F2** 已修（W6）：programmatic in-flight 模型（target ref + `beginProgrammaticScroll` port 方法）；in-flight 帧跳过 intent 钳制、previousOffset 跟随真实 offset、zone 状态照常 scrub；到达 ≤1px 或用户输入（wheel/touch/keyboard/scrollbar 全路径汇入点）清 in-flight 并 auto-scrollTo 停掉 smooth。goToScrollZone 不再预置目标状态（根因）。红证 3 红（jsdom smooth 模拟器）。
- [x] **D-F1** 已修（W8，详见 task-flows/2026-07-26-drag-rush-regrab-p0.md）：方向 B（手势归属 ownsGestureRef + 最新闭包 ref）+ CineView 级共享 DragRenderLane 单槽位（防第二次急抓双写）+ useElementTrack orphaned-settle 续跑兜底 + resetDragInteraction 在 settle join 未闭合时保留 dragRelease + resolveVisualState hold 期不闪终态。链路核实：冻结/tap-snap 在 commit 后窗口同样存在，修复统一覆盖。红证 3/3（备份+逆向补丁法）。全仓 92/1287 绿。真机待验：capture 钉旧元素、急抓视觉、resume 速率、连续急抓、掉帧。
- [x] **S-F6** 已修（W7）：无显式 enter/exit 的 zone 内元素呈「已入场静止态」（set(1)+phase 'entered'），infinite 门控走 runtimeState；显式 enter/exit 元素零改动。红证（stash 回退 3 红）。
- [x] **S-F8** 已修（W7）：zone-driven 元素首次越过 enter 段终点向 per-scene 总线发布 entered（ref 门控恰一次，发布后不撤销——纯函数 scrub 模型下「曾入场」是稳定事实，与 fire-immediately 语义对齐）；未注册目标已被既有 missing-dependency 警告覆盖（driver 无关），无需新警告。红证。
- [x] **S-F4** 已修（W6）：scene wrapper 单 RO + rAF 合并；手势中只置 pending（保持手势起点单测量取舍），idle 后 flush 补测；非手势期走 refreshLayout 同路径 fromGesture=false；卸载 disconnect。红证 3 红。遗留：smooth 中内容缩短致目标不可达时无主动超时（用户输入即清，无悬挂）。

### 验收轮

- [x] 全量 test/type-check/lint 绿（92 suites / 1287 tests；build:verify 12/12，ES gzip 49.12KB 逼近 50KB 上限）
- [x] 验收轮 1（真构建，受信 CDP 输入）：9 PASS / 1 FAIL。PASS：act1-5 基线、反向 scrub 跟手、TickBar transform 几何等价、Timecode、急抓接管/急 tap 恢复、光轨 +0ms 卸载、pointercancel 回弹不提交、性能 0 longtask。**教训：site 走 link:../ 消费 dist——验收前必须重建 dist 并清 site/node_modules/.vite，且探针必须走受信 CDP 输入（合成派发绕过 pointer capture，判别力不足）**。act3 是 ~11s 蒙太奇，settle 截图需等 ~12s（6.5s 经验对 act3 失效）。
- [x] **FAIL 已修（W9）**：触控急抓连击（flick 460px×6 步、释放后 180ms 内再抓 ×3）→ 2 次单帧整栈 -307px 瞬移（旧过渡瞬间收尾硬切）+ 触控/鼠标语义分叉（鼠标吸收为 scrub、触控硬切链入下一幕）。
      **根因**：`handleDragStart` 遇到 in-flight render lane 时做 **flush-commit**（瞬间收尾旧过渡）——把剩余 progress 在一帧内走完，整栈瞬移；而鼠标路径因 pointer capture 时序差异吸收为 scrub，故两种指针语义分叉。
      **修法（D-F7 takeover 语义）**：急抓不再 flush，而是把 lane **就地 stop 在当前位置**，以冻结的 render 位置作为手势基线（`gestureBaseProgressRef`，progress = base + 手指位移），提交决策交还本次手势的 `handlePanEnd` 走正常阈值；scrub 回 0 则判定为「放弃过渡」并发布 bounce 回绕（`gestureTookOverRef`）。element 轨由各 scene 自己的 `useElementTrack` 就地接管，单写者不变量不破。
      **红证**：`drag-rush-regrab.test.tsx` 4 例（接管不瞬移/tap 重释放续跑/scrub 回 0 放弃/连续推进二次提交）+ `useDragSceneEngine.branches.test.ts` takeover 用例；`dragModeSettleHandshake.test.tsx` 第三例由 flush 语义改写为 takeover 语义。
      全仓 **92 suites / 1289 tests 全绿**，type-check 0、lint 0、build:verify 12/12（ES gzip 49.57KB）。
- [x] 验收轮 2（W9 修后回验，重建 dist + 受信 CDP 输入，`localhost:4003/drag`，430×900）：**全 PASS，硬切消失**。
      - 主项 B1-test3：三次急抓连击 → 触控/鼠标**均为 2 次提交、终落 act3**（原触控 3 提交冲到 act4）；快帧（dt<40ms）内最大整栈位移 ~30px（settle easing 量级），**零 >150px 瞬移**（原 2 次 -307px）；触控与鼠标数值差 ~1px，**语义分叉消除**。每次 re-grab 的 `idxAtGrab` 均等于抓取前索引 → 抓取本身不再推进场景。
      - 放弃路径：progress≈0.68 处急抓后 scrub 回 rest、阈下释放 → 回 index 0 静止、不提交、无 console 噪声（两种指针一致）。
      - 无回归扫描：前进/后退提交、阈下回弹、首幕后退回弹、末幕前进钳制、受信 `touchCancel` 中途打断（index 保持、offset 归 0）、0→4→0 全程走查（各幕内容与 Animate 子项均正常解析）、act2 canvas rAF 活跃期 38880 draw ops / 离场后**恰好 0**（phase 门控有效）全部通过；console 全程干净。
      - 附带观察（非缺陷，待产品确认）：急抓后**原地无位移释放**仍会提交（0.667/0.958 progress 均落 index 1）——与「保留 in-flight 进度」的双门语义自洽，但属可裁决行为。
- [x] 验收轮 3（独立复验，受信 CDP 输入，`localhost:4000/drag`，430×900，touch + mouse 双跑）：**全 PASS，与验收轮 2 结论一致**。
      - A 急抓连击 ×3：touch/mouse **均 2 次提交、终落 act3**；`findJumps`（>120px 且 >2× 手指位移）**两种指针均为空**；全程最大单帧整栈位移 -76.7px @dt≈16ms（= settle easing 峰值速率，非瞬移）；每次 re-grab 前后索引一致（抓取不推进场景）；console/pageErrors 全净。
      - C 接管三分支（touch）：C1 继续上推 → 单次提交落 index 1；C3 接管后原地 tap → 同样提交落 index 1（与轮 2 的「可裁决行为」观察一致）；C2 scrub 回 rest → **零 indexChange**、停在 index 0。
      - C2 残留态复核：终态 scene-1 元素 opacity（`timecode-slate`=1、`s02-clapper`=1、其余 0）与**从未拖拽过的 pristine 首屏逐项完全一致** → 非「放弃路径元素泄漏」，是该场景静止态的正常读数（此前疑点排除）。
      - D 无回归扫描（touch + mouse 各一轮，4685/4640 帧）：0→4 前进、4→0 后退各 4 次提交索引序列完全正确；末幕前进/首幕后退均被钳制（索引不变、offset 归 0）；阈下慢拖回弹不提交；各幕内容解析正常（act3 的 5 个 `s03-strip-*-dissolve` opacity 0 为编排预期）；at-rest pointerEvents 契约正确（active=auto/z10，非 active=none/z1）；`findJumps` 空；console/pageErrors 全净；两种指针输出逐项等价。
      - 仓库门：**92 suites / 1289 tests 全绿**，type-check 0 错，lint 0 错 0 警。

### backlog（能力缺口，需产品裁决，不在本轮）

direction:'x' scroll 横向布局（当前为死配置：要么实现横排布局要么类型面收回）、drag 模式 wheel 输入、history/popstate 支持、exit lane per-element delay、公共 release 回调、S-F12 per-zone timeline store、drag 下静默降级项加 dev warn（B8）、E-F1 死模块清理、E-F3 performanceMonitor 单例、A12 peer 上界、iOS momentum 实测（S-F10）、S-F9/S-F11 真机复现

## 发现记录

### A. 公共 API 易用性（agent 已核实源码，待我方复核）

- **A1 P0** `dragTimeScale` 默认值三处矛盾：types/index.ts:66-73 JSDoc 说 100（full drag=10000ms）；CineView.tsx:62-65 `DEFAULT_DRAG_TIME_SCALE=10`（实际 1000ms）；useElementTrack.ts:99 兜底 `?? 100`。真实生效 10，与公共承诺差 10 倍。→ 统一常数 + 修 JSDoc。
- **A2 P1** `config` 必填但字段全可选；JS 消费者漏传 → directScrollHelpers.ts:312-317 解引用 `config.size` 首帧 TypeError。→ 改可选 + 兜底。
- **A3 P1** `NO_SCENES` 错误码只在 drag 侧发出（CineView.tsx:248-254），scroll 侧（DirectScrollCineView）静默空渲染。→ scroll 侧镜像 emitError。
- **A4 P1** dist 类型泄漏：dist/index.d.ts:531-533 `declare global { var act ... }`（setupTests.ts 被 dts 卷入）+ :526 内部 `ScrollbarOverlay` namespace 泄漏。→ dts exclude setupTests，重跑 build:verify。
- **A5 P1** `AnimateStaggerConfig` 已 export 但未进 barrel（src/index.ts），消费者拿不到类型。→ 加入 barrel。
- **A6 P1** Position/Scene 实为 forwardRef 但 barrel cast 成 `FC` 抹掉 ref 类型（src/index.ts:17-20）。→ 改 ForwardRefExoticComponent。
- **A7 P2** 「CineView 外使用」防御四组件四种行为（Container throw / Scene console.error / Position 静默 / Animate 静默 fallback）。→ 统一 dev warn + 静默降级。
- **A8 P2** types/index.ts 尾部死类型：`SceneState`(:591 与 Scene/types 同名冲突)、`AnimationRegistryItem/Registry`、`PreloadState` 零消费。→ 删。
- **A9 P2** stagger JSDoc 悬空（types/index.ts:476-484 注释后无成员，hover 拿不到）。→ 移到字段上。
- **A10 P2** transition 默认时长两处不同：CineView.tsx:92,97 兜底 500 vs directScrollHelpers.ts:330 兜底 800（DESIGN 说 800）。→ 统一 800。
- **A11 P2** monitor 关闭时 `getPerformanceMetrics()` 返回全 0 无提示；CineView.tsx:729-732 dev effect 重复 `performanceMonitor.start()` 无对应 stop。→ 加 monitoring 字段 + 删重复 start。
- **A12 P2** framer-motion peer `>=10.0.0` 上不封顶。→ 收敛 `>=10 <13`。
- **A13 P2** drag 侧无 `goToZone`，误调裸崩 "not a function"。→ dev-only 桩 warn。

（良好项：mode 判别共用体 + optional-never、waitFor 三类误用警告、exports 三件套、examples 无已删字段。）

### B. 边界能力矩阵 — 重大缺口（agent 已核实源码，待我方复核）

1. **B1** scroll direction:'x' 实际不可用：输入/测量层 direction-aware，但 scene wrapper 纵向 block 流无横排布局（ScrollSceneSlot.tsx:214-230）；键盘无 ArrowLeft/Right（directScrollHelpers.ts:119-146）；x 测试全 mock 几何。
2. **B2** drag 下 active scene 被条件卸载 → 索引不重钳（useSceneManager.ts:131-133）→ 空白视口 + isAnimating 永久卡死；scroll 侧自愈但无测试。
3. **B3** 重复 sceneId 在 scroll 下 zone Map last-wins 静默摧毁 takeover（useSceneScrollTakeover.ts:26、useScrollZoneRegistry.ts:157-180），无警告。
4. **B4** 预加载无超时：悬挂 priority 资源无限期阻塞 priorityComplete → 首屏门永不放行（useImagePreloader.ts:148-180）。（与 E-A4 同根）
5. **B5** 浏览器 history 回退/前进零支持（popstate/scrollRestoration 零命中）。
6. **B6** sequential 组合动画时序在所有 scrub 路径被丢弃（composer 折叠为单段 lerp + last-wins）。（与 E-E1 同根，且比 E 组更广：scrub 路径也失效）
7. **B7** drag 模式无 wheel 输入路径：触控板/滚轮用户无法翻页。
8. **B8** 静默模式退化无警告：replayOnReenter / enterMargin/exitMargin 在 drag 下静默忽略；Position layer.fixed 在 drag 下静默降级；Scene 外标准 Animate 在 drag 下完全静止。
9. **B9** 嵌套 CineView：键盘双实例双消费（useScrollInputBindings.ts:86-111 无 defaultPrevented 检查）；外层 framer pan 未被内层挡板门控。
10. **B10** scroll 侧无内容级 ResizeObserver，异步内容增高延迟到下次手势才重测（违 DESIGN.md:233；CLAUDE.md P3 描述与代码不符）。
11. **B11** 一致性小缺口：scroll 根不发 NO_SCENES（=A3）；scroll goToScene 越界静默无 warn；exit-only scroll 动画缺 DESIGN.md:186-188 要求的 dev 警告；scrollbar 仅 onMouseDown（触控不可拖）；SSR 无 renderToString 测试。
- 其他 ⚠️：drag 下 replayOnReenter 不消费；zone 内容超视口未经真实验证；scroll touch preventDefault 后无合成惯性；AnimateVideo 渲染器无 video onerror。
- 横切观察：失败模式高度一致——几乎无崩溃路径，但大量**静默 no-op/降级**；jsdom 对几何依赖路径系统性失明。

### D. drag 热路径（agent 已核实代码链路，待我方复核）

- **D-F1 P0 CONFIRMED** commit 前窗口（release→页面滑到位）内再次抓取 → 手势死亡链：useDragSceneEngine.ts:220-240 flush 分支同步 commit → scene 失活换 handler，但 pointer capture 钉在旧 scene（useNativePointerDrag.ts:120）→ 整个手势 handlePan 不执行；globalIsDragging=true 触发 useElementTrack.ts:177-181 preempt 停住新 active scene 的 settle 补完动画且无人再驱动（冻结）；pointerup 旧闭包 tiny-progress 分支 → resetDragInteraction 清 dragRelease → 冻结元素瞬间 snap 终态。
- **D-F2 P1 CONFIRMED** 下压阈值 bounce 的 render lane 时长用元素时间轴 T_self（useDragSceneEngine.ts:504），站点 T_self≈6.5s 时回弹≈1s，与边界 bounce 0.15s 不一致；且元素轨 bounce 上限 300ms → 两轨解耦回弹。
- **D-F3 P1 CONFIRMED（站点）** TemporalDragExperience.tsx:97-101 `sinkTweenRef.stop()` 后不置 null；stop 不触发 onComplete → unmountWhenDark 永远以为 tween 在飞 → ambient rig 永不卸载：半亮光轨 + 4 条 CSS infinite + dust rAF 常驻 acts 2-5。
- **D-F4 P1 PLAUSIBLE（站点）** onDragCancel 在 bounce 结束才回调（受 F2 放大至 ~1s），期间 release 光轨停在错误状态。
- **D-F5 P1 CONFIRMED** pointercancel 走 handlePanEnd 同 pointerup（useNativePointerDrag.ts:125-127），系统打断可导致意外 commit；应回弹。
- **D-F6 P1 CONFIRMED** goToScene(animated) 路径 onAfterChange 载荷 fromIndex===toIndex（useSceneManager.ts:331-347 + CineView.tsx:306-308）；settle 定时器无条件 `setDragRelease(null)` 与手势 settle 竞态（PLAUSIBLE）。
- **D-F7 P1 CONFIRMED（罕见）** 鼠标+触摸双主指针：onPointerDown 覆写 cleanupRef 不先清旧 → 每次泄漏 4 个 listener。
- **D-F8 P2 CONFIRMED** useAnimateDrag：shouldRunInfinite effect 二次 resolveVisualState（:584，2×/帧）；两 effect deps 含每帧变化的 sceneContext → 每 drag 帧全量 teardown+resubscribe。
- **D-F9 P2 CONFIRMED** enter 未完成被抓走 → outgoing lerp 起点恒为全 animate 态（useAnimateDrag.ts:192-203），半入场元素瞬跳全入场再退场。
- **D-F10 P2 CONFIRMED** useDragSceneEngine.ts:150-194 每 drag 帧对 3 scene 各执行恒定值 5 属性 controls.set，纯冗余。
- **D-F11 P2（站点规则 6）** TemporalDragExperience.tsx:3 直接 import framer-motion animate 自建 sink tween + 自建 root pointerup release 事件（正解：框架补公共 release 回调）；ambient rig 4 条 CSS infinite 自授豁免；AmbientStage.tsx import motion（树外灰区待裁决）。
- **D-F12 P2 杂项** gestureDetector.ts 死模块；TickBar.tsx:36-40 每帧写 left（layout invalidation）；DragTimecode commit 瞬间读数跳变；useElementTrack animate onUpdate 双写。
- 框架能力缺口（agent 指出）：exit lane 无 per-element delay（站点退场反向编排只能近似）；公共回调面缺 release 事件。

### S. scroll 热路径（agent 已核实源码，待我方复核）

- **S-F1 P1 CONFIRMED** useNativeScrollController.ts:143-152 gap 回退：viewport center 落在 scene 间普通文档流内容时 `containingIndex===-1` 且不小于 layouts[0].sceneStart → active 跳到**最后一个** scene（应取最近距离）。假事件 0→N、backdrop 错位。
- **S-F2 P1 CONFIRMED** goToZone(animated:true)/goToScene(animated) smooth 滚动被 reducer 自我取消：goToScrollZone 预置 previousScrollOffsetRef=目标 → 首个 scroll 事件巨型反向 delta → crossed-segment 钳制 setNativeOffset 中止 smooth 滚动，停在中间段。根因：reducer 无法区分用户手势与自家 programmatic smooth 滚动。测试只覆盖 animated:false。
- **S-F3 P1 CONFIRMED** DirectScrollCineView.tsx:377-399 容器 onKeyDownCapture 缺 `shouldIgnoreGlobalScrollKey` 防护：焦点在容器内 input/textarea 时 Space/方向键被吞（无法输入空格/移动光标），页面反而滚动。
- **S-F4 P1 CONFIRMED** scroll 根无任何 ResizeObserver（仅 drag 根有）：异步内容撑高后所有 sceneStart/segmentStart 过期，直到下次手势首帧才自愈；违 DESIGN 测量规则 #3；CLAUDE.md P3 描述失实。（=B10）
- **S-F5 P2 CONFIRMED** onZoneProgress 阈值基线每次 sync 无条件覆盖（:237）而非「上次上报值」：慢速滚动（每帧 ≤0.5px）下回调饿死，0/1 终值可被吞。
- **S-F6 P2 CONFIRMED** 只有 infiniteAnimation 的 Animate 在 takeover zone 内不注册（useAnimateScroll.ts:597-605）→ visualMotion 停 0 → opacity initial 默认 0 → 永久不可见；与开发规则 6 自相矛盾。
- **S-F7 P2 CONFIRMED** direction:'x' 无水平布局根基（容器仅 overflowX，scene wrapper 纵向 block）→ 全部 x 分支不可达，死配置。（=B1）
- **S-F8 P2 CONFIRMED** 跨 driver waitFor 死锁：markAnimateEntered 只在 visibility 路径发布，zone-driven leader 永不发布 → visibility follower 卡 'entering' opacity 0。
- **S-F9 P2 PLAUSIBLE** bfcache/历史恢复的 scrollTop 被 mount sync 当巨型手势 delta 钳回第一段 segmentStart+1。
- **S-F10 P2 PLAUSIBLE** iOS momentum 中程序化 scrollTop 写入不可靠 → 大 flick 防跳过可能失效（浏览器验收须加 iOS momentum 用例）。
- **S-F11 P2 PLAUSIBLE** touch 首帧未 preventDefault 后 native 滚动与手动 delta 双重消费（~2× 速度）。
- **S-F12 P2 CONFIRMED（性能）** 全局 timeline store 每帧整体换 snapshot → 所有 zone 的 scroll-driven Animate 每滚动帧全部重渲染 + 重跑两个 effect；应 per-zone 收敛 fan-out。
- **S-F13 P3 CONFIRMED** mount/resize/refreshLayout 无条件置 isScrolling=true 120ms：scrollbar 闪现、isSceneAnimating 假报。
- 排除项：手势首帧单测量取舍自洽；resolveScrollIntentOffset 边界对称；fixed layer 不进布局足迹（P3 担忧可关闭）；listener 配对完整。

### E. 外围模块（agent 已核实源码，待我方复核）

P1（7 项）：
- **E-A1 P1** mediaPreloadCache.ts:104-110 video 预加载 fetch 不检查 `response.ok`，404 HTML 被当 blob 缓存并标 ready，永久污染不可重试，错误不进 errors/onError。
- **E-A2 P1** mediaPreloadCache.ts:78-91 LRU 逐出无引用计数，revoke 正被挂载 `<video>` 使用的 objectURL（>128MB 时）；VideoFrameRenderer 不订阅逐出、不回退网络 src。
- **E-A3 P1** VideoFrameRenderer.tsx:157-167 首挂载 `src={src}`+`preload="auto"` 与 effect `preloadMedia(src)` 双份下载同一视频。
- **E-A4 P1** useImagePreloader.ts:291-300 预加载无超时：一张挂起 priority 图 → progress 冻结、background 永不开载、onComplete 不触发（首屏门控本身有 timeoutMs 兜底不死锁）。priority 批串行加载（延迟为和非最大）。
- **E-B1 P1** `config.size=0/负` → scale=Infinity/负：CineViewContext.tsx:44-47 无守卫，`0 ?? 750` 穿透；drag 侧仅 dev warn，scroll 侧连 dev 检查都无。
- **E-E1 P1** composer.ts:35-43,74-97 `mergeVariants` 用 Object.assign，`transition` 整键覆盖 → sequential/parallel 组合的逐步 delay 全被最后一项覆盖，编排语义失效（时间驱动路径显形）。需 per-value transition。
- **E-E8 P1** animationHelpers.ts:136-141 `interpolateVariant` 把 `'50% 100%'` transformOrigin 坍缩成 `'50%'`（缺 startVal===endVal 早退）；且 animateInterpolation.ts 白名单不含 transformOrigin → scrub 下 origin 静默丢弃。

P2 精选：E-B2 CineViewContext debounce 无 cancel（而 debounceCancelable 零消费）；E-B3 useConvertSize fallback 每渲染新函数+重复 warn；E-C2 Position fixed-layer host 就绪时 inline→portal 迁移致 children 重挂；E-C4 center 锚点下 PositionContext 传播语义错；E-E2 composer 无效项 delays 索引错位；E-E3 sequential 假设每动画 1s；E-E4 `PresetAnimation` 同名双定义+名称联合三处手抄；E-E5 未知 preset 走 TypeError 误归因；E-E6 flip 与 flip-y 完全相同；E-E7 关键帧数组预设 scrub 下半程跳变；E-F1 死模块（throttle.ts 整模、debounceCancelable、gestureDetector.ts 整模；CLAUDE.md 列的 dependencyChecker/gestureHandlers 已不存在=文档漂移）；E-F3 performanceMonitor 全局单例多实例互踩+fps 硬夹 60+frameCount 死字段；E-F4 styleConvert 白名单缺 flexBasis/textIndent 等；E-D1~D3 VideoFrameRenderer seek 采样污染/无 seeking 门控/preload=false 永久黑屏。
