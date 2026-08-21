# 2026-08-17 Adversarial Remediation Round 2

## 目标

修复 `2026-08-17-adversarial-fix-code-latest.md` 与独立浏览器验收确认的剩余阻断，保持媒体/scroll/drag 状态唯一所有者，并用本轮新测试和真实浏览器证据证明行为与性能，而不是继承上一轮 PASS。

## 当前基线

- Git：`4660d96` 加当前未提交工作树；保留全部用户现有改动，不回滚无关文件。
- 代码复审：`task-flows/2026-08-17-adversarial-fix-code-latest.md`，结论 `FAIL`。
- 浏览器验收：`task-flows/2026-08-17-adversarial-fix-browser-latest.md`，核心 drag/scroll 功能 PASS，但实际 `/drag` warm 交互出现 53/131ms Long Task 与 283.2ms rAF gap，整体 `FAIL`。
- 本轮不把上一轮 116 suites / 1541 tests、type/lint/build 绿灯当作当前修复后的证据；实现完成后全部重跑。

## 待修阻断

1. native `media-ended` 无 activation/source token，旧媒体事件可污染新 source。
2. active scroll Scene 的连续 timeline snapshot 仍经 `useSyncExternalStore -> ScrollSceneSlot -> Scene` 进入 React。
3. BackgroundRibbon 在同 pathname 替换 CineView 容器后丢 listener，且路由离开时 root inline LUT 变量不清。
4. Scene5 的 offscreen finished/freeze 竞态、unfinished transform 跳变、隐藏链接可聚焦及重开跳过四拍时序。
5. 既有 P2：PhoneMockup 静态 reduced-motion 与 stagger batched settled reentry；在 P1 收口后评估能否同轮净化，不能静默忽略。

## 诊断假设（按优先级）

### Scroll 热路径

1. 若主因是 `sceneTimelineState/visualViewportOffset` 每帧进入 render snapshot，则只把连续值改成稳定 MotionValue/外部 store 后，active `ScrollSceneSlot` render count 应从“每 progress frame”降为只在离散 phase/visibility/active 边界变化。
2. 若主因是 `isScrolling/scrollDirection`，固定连续 timeline 后仍会在每帧 render；需把 gesture burst 状态与每帧 offset 分开。
3. 若主因来自 Scene callbacks/context 对象换引用，即使 snapshot 相等也会 rerender；稳定 callback/runtime identity 后才会消失。

### 站点性能

1. 若 warm 131ms Long Task 来自实际 scene 首次激活/资源工作，而非 scroll snapshot，则单独修 scroll 不会消除 `/drag` 五幕长任务；必须用 trace/阶段样本定位，不拿不相关优化冒充修复。
2. 若主要是多元素首次解析/React commit，则预热或稳定结构会改变峰值；若是 canvas/media 解码，则主线程 trace 会落在对应 owner。

## 节点

- [x] 1. 读取规格、历史失误、最新失败报告并确认工作树
- [x] 2. 媒体 native terminal event activation 隔离 + 红绿回归（独立复审整改完成）
- [x] 3. active scroll Scene 连续 progress 脱离 React + render-count/性能回归（独立复审整改完成）
- [x] 4. BackgroundRibbon 容器换代与 root 变量生命周期
- [x] 5. Scene5 生命周期、transform、focus 与重开时序（独立复审整改完成）
- [x] 6. P2 边界回读与必要净化（reduced-motion / stagger batch edge，独立复审整改完成）
- [x] 7. 定向测试、完整测试、type-check、type-check:site、lint、build:verify、dist
- [x] 8. 全新独立代码对抗复审（FAIL，已进入整改）
- [x] 8a. 修复本次独立复审反例并重跑节点 7 门禁
- [x] 8b. 整改后再次启动全新独立代码对抗复审（FAIL，反例已进入 8c）
- [x] 8c. 修复 8b 的媒体/scroll/frame-lane 反例并重跑全部门禁
- [ ] 8d. 8c 后再次启动全新独立代码对抗复审
- [ ] 9. 全新独立真实浏览器验收（drag/scroll/站点专项/性能）
- [ ] 10. 最终回读与 PASS / FAIL / BLOCKED

## 节点 1 证据与自检

- 已完整读取 `DESIGN.md`、`CLAUDE.md`、`AGENT_SELF_REVIEW.md` 与适用的 diagnose/playwright 技能；媒体 token 规格依据为 DESIGN 组件 3.5，scroll 依据为 Root Scroll/性能/单写者规则。
- 已运行 `git status --short`、`git diff --stat`、`git diff --name-only`、`git log -5 --oneline`；基线仍为 `4660d96`，47 个 tracked path 有改动并有多批 untracked 证据/flow，均按用户工作保留。
- 已回读两份 latest 独立报告和真实浏览器 JSON；不再沿用已被剔除的旧误报。
- 当前所有旧 Agent 均已 completed，4000/4317/4318 无 listener；本轮重新创建独立实现与验收角色。
- 节点自检：本节点未改生产代码；范围覆盖所有当前 P1 与两个明确 P2，不以自动化绿灯缩小目标。节点 1：PASS。

## 证据日志

后续每个节点完成后立即追加：红证、实现、命令、回读、状态所有权、性能影响与结论。

## 节点 2：媒体 native terminal event activation 隔离

- 红证：旧实现的 `VideoFrameRenderer` native `ended` 路径发送无 token 的
  `media-ended`；source A listener 在 source B 替换后可直接污染新 activation。此前
  reducer-only 测试无法覆盖 retained `<video>` 节点上的旧 listener 闭包。
- 实现：`videoPlaybackOwnership.ts` 要求 `media-ended.activationId`，`media-pause`
  支持 activation guard；`VideoFrameRenderer.tsx` 为 native pause/ended listener 捕获
  `activationId + mediaGeneration`，source/objectURL 变化在 render 阶段先使旧闭包失效，
  React `onPause/onEnded` 仅转发用户回调。未引入 `key={src}`，保留既有 source-swap 的
  DOM 节点语义；旧闭包由 guard 丢弃。
- 红转绿命令：
  `pnpm test --runInBand src/media/VideoFrameRenderer.test.tsx src/media/videoPlaybackOwnership.test.ts`
  → 2 suites / 56 tests PASS；新增测试真实抓取 source A 的 native `ended` listener，
  source B rerender 后直接调用旧闭包，再把 B 推到 endpoint，确认只发生一次合法 play。
  `pnpm type-check` PASS；`git diff --check` PASS。
- 状态/性能回读：`currentTime` 与 ownership 仍由 renderer 的纯 reducer/命令执行路径
  唯一写入；activation/generation 只在 source、reset、enter handoff 边界更新，不在每帧
  写 React state。listener cleanup 在 source/objectURL/epoch/unmount 路径均有对称移除。
  反向 scroll/visibility reclaim 的 hysteresis 仍由同一 reducer 处理。
- 残余边界：若浏览器把旧事件重新伪造为新 listener 且不携带可识别 source 元数据，DOM
  本身无法区分；本节点覆盖实际可达的 queued old-listener 闭包模型，需真实浏览器继续验收。
- 节点自检：原问题已由真实 listener 回归锁定；未发现第二个媒体进度写者或未清 listener。
  节点 2：PASS（视觉/真实浏览器证据留至节点 9）。

## 节点 3 红证（实现前）

- 新增生产形状回归探针 `src/components/CineView/ScrollSceneStack.test.tsx`，用带
  `cineViewScene` 标记的真实 Stack child 计数父 Scene render。
- 命令：`pnpm test --runInBand src/components/CineView/ScrollSceneStack.test.tsx`。
- 当前基线结果：探针在连续 `sceneProgress 0.1 -> 0.2`、`visualViewportOffset 100 -> 200`
  后观察到 Scene 第二次 render（断言 `sceneRenders > rendersAtRest` 通过）。这确认
  active Scene 的连续帧仍穿过 `useSyncExternalStore -> ScrollSceneSlot -> cloneElement`。
- 本证据只证明问题存在，尚未证明修复；实现完成后同一探针必须改为并证明 render count
  不增加，同时补充 frame-lane 视觉消费者验证。
- 节点自检：红证未改生产逻辑，未引入第二个 progress writer；下一步仅拆离消费路径，
  保持 native scroll controller 为唯一连续进度写者。

## 节点 3 实现、绿证与回读

- 实现：新增 `scrollSceneFrameStore.ts`。native offset 仍由
  `useNativeScrollController -> updateSceneRenderSnapshots` 唯一驱动；frame store 按
  scene key 原地发布连续 `timelineState/progress/visualViewportOffset`，普通帧不复制
  全量 scene 数组，也不被 `useSyncExternalStore` 订阅。
- `ScrollSceneSlot` 的 render equality 现在只比较 phase、布局/active/gesture 等离散值；
  timeline progress、zone progressPx、live viewport offset 均交给 frame lane。phase/active/
  layout 变化仍会触发 clone 和 React 更新。
- `useScrollSceneEngine` 订阅 frame lane，视觉控制通过 `controls.set` 更新；用
  `lastSceneStateRef` 只在离散 SceneState 改变时调用 React setter。`SceneFixedLayer` 和
  Scene visibility callback 同样改为 frame subscription + imperative DOM/callback 更新。
- 绿证命令：
  `pnpm test --runInBand src/components/CineView/ScrollSceneStack.test.tsx src/components/CineView/useScrollSceneSnapshots.test.tsx src/components/CineView/ScrollSceneSlot.test.ts src/components/Scene/useScrollSceneEngine.test.ts src/components/Scene/Scene.test.tsx src/components/Scene/Scene.scrollRuntimeBridge.test.tsx`
  （6 suites / 108 tests PASS）。新增探针证明连续帧 Scene render count 不增加；新增
  engine 测试证明连续 frame 更新 controls 但不重复发布 SceneState。
- 静态证据：定向 ESLint PASS；`git diff --check` PASS；定向 Prettier PASS。`rg` 回读显示
  只有 frame store 发布方法写入 frame，Scene/engine/fixed-layer/visibility 只读订阅；
  未发现第二个 native progress writer。
- 节点自检：
  - 真正解决问题：连续 scroll frame 不再通过 Slot/clone/Scene React 树，视觉和回调仍有
    imperative 消费者；phase/active 边界保留 React 语义。
  - 功能语义：timeline phase、scene-level enter/exit、fixed layer clip、visibility
    callback 均保留；debug data 属性仍是离散快照值，需在浏览器验收确认是否足够（不作为
    用户行为依据）。
  - 状态所有权：frame store 没有独立计算/写入 progress，只承载 controller 计算结果；
    `Animate` zone store 与 scene frame store 是同一 native owner 的两种消费通道。
  - 热路径：普通帧仅遍历 dirty scenes、比较 frame 字段并按 key 通知；无每帧 React state、
    layout read 或全量 frame array clone。仍需真实浏览器 Profiler/Long Task 证据确认整体
    site 性能，不能由本节点单测宣称 PASS。
- 节点 3：PASS（框架级证据完成；真实浏览器性能留到节点 9）。

## 节点 4：BackgroundRibbon 生命周期

- 实现回读：`BackgroundRibbon.tsx` 保持单一 scroll listener + ResizeObserver，MutationObserver
  监听 `[data-cineview-container]` 的增删/属性变化；`reconcile()` 发现同 pathname 的新容器
  时先 `detach()` 旧节点，再绑定新节点并重算真实 scroll metrics。没有每帧 React state 或
  自建 rAF，LUT 只在 scroll/resize 的量化键变化时写 root inline 变量。
- 反例测试：`src/__tests__/site/backgroundRibbon.test.tsx` 覆盖同路由替换（旧 listener
  不再生效、新容器生效）、离开无 CineView 路由清理四个 root LUT 变量、unmount 清理
  MutationObserver/ResizeObserver/scroll listener。
- 命令：
  `pnpm test --runInBand src/__tests__/site/backgroundRibbon.test.tsx`（3 tests PASS）；
  同本轮定向组合命令合计 13 suites / 197 tests PASS；`git diff --check` PASS；
  `pnpm type-check:site` PASS。
- 状态/性能自检：LUT writer 仍只有 BackgroundRibbon；detach/cleanup 路径对旧节点、observer
  和 root variables 对称，路由 effect 重新执行不会留下旧变量。量化写入不读取布局后同步
  写样式，且不是 scroll 每帧 React 重渲染。
- 节点自检：原始容器替换与跨路由泄漏均由真实 DOM fixture 锁定；视觉色彩连续性和真实
  浏览器滚动路径仍交由独立验收 Agent。节点 4：PASS（浏览器专项留至节点 9）。

## 节点 5：Scene5 生命周期、transform、focus 与重开时序

- 实现回读：`scene5Lifecycle.ts` 成为离散 lifecycle 的唯一 reducer owner；消息、zone
  progress 和 IntersectionObserver 都经 `lifecycleDispatchRef` 进入。`generation` 校验
  freeze/exit 延迟回调，`lastWinsTimerSequence` 取消旧 sequence 并拒绝已入队 stale callback。
  offscreen/freezePending 时 late `finished` 直接忽略，不会取消资源清理；finished/unfinished/
  progress `.95` replay 都明确取消旧 sequence。
- 视觉/accessibility：`freezeScene5Element()` 先读取 computed transform/visibility，再
  摘掉 CSS animation，避免 unfinished 在 delay/rise 中跳回静态 transform；collapsed text
  column 同时设置 `inert`、`aria-hidden` 与显式 `tabIndex=-1`，并在收拢时 blur 当前焦点。
  `.95` 重开递增 `replayKey`，keyed Fragment 重新挂载四拍 CSS entrance。
- 反例测试：
  `src/__tests__/site/scene5Lifecycle.test.ts` 7 tests（含 late finished 不取消 freeze、
  stale generation、computed transform freeze、collapsed focus、replay generation）与
  `src/__tests__/site/lastWinsTimerSequence.test.ts` 2 tests PASS；`pnpm type-check:site`
  和 `pnpm --dir site build` PASS。
- 同轮定向命令：13 suites / 197 tests PASS；`git diff --check` PASS。
- 状态/时序自检：scene5 lifecycle 只有一个 reducer 写者；连续 progress 仍由 Animate/MotionValue
  scrub owner 写，React state 只投影离散 lifecycle/stage/live/interactive。freeze 与 exit
  sequence 共用 generation 防护且卸载 cleanup 取消 timers；未增加每帧 setState 或第二个
  zone progress writer。
- 节点自检：原始 offscreen race、transform snap、隐藏链接焦点和重开跳过四拍均有纯 reducer/
  DOM seam 证据；真实 iframe/postMessage/IntersectionObserver 视觉时序仍必须由独立浏览器
  Agent 验收。节点 5：PASS（浏览器证据留至节点 9）。

## 节点 6：P2 reduced-motion 与 stagger batch edge

- Stagger 红证：新增同步 burst 测试，在 group 已 settled 后同一 `act` 内发送
  `animate -> exit -> animate`；旧 `[phase]` effect 看不到中间 exit，子项保持
  `{duration:0, delay:0}`，测试明确 FAIL（Expected 0.4/0.08，Received 0/0）。
- Stagger 实现：`useStaggerPhase` 仅在派生 phase 边界变化时递增 revision；
  `useStaggerSettled` 同时依赖 `phase + revision`。因此同步往返即使最终 phase 字符串相同
  也重新建立一次 completion clock；普通 MotionValue 连续值留在同一 phase 时不 setState，
  未把 progress 每帧引入 React。
- Stagger 绿证：
  `pnpm test --runInBand src/components/Animate/StaggerContainer.test.tsx`
  → 21/21 PASS；新例确认 479ms 前保持 authored timing，480ms 才 instant settled。
- Reduced-motion 实现：新增共享 `site/src/hooks/usePrefersReducedMotion.ts`，以
  `useSyncExternalStore` 订阅现代/legacy matchMedia change；`PhoneMockup`、Hero、Timecode、
  Capability、TemporalDragExperience 与 TemporalMotionProvider 全部改为动态消费，删除全站
  `PREFERS_REDUCED` 模块快照和 TemporalMotion 内重复订阅实现。偏好改变只触发离散结构更新，
  不成为动画 progress 写者。
- Reduced-motion 证据：
  `pnpm test --runInBand src/__tests__/site/usePrefersReducedMotion.test.tsx`
  → 2/2 PASS（现代 change + legacy addListener/removeListener/unmount）；`rg` 确认 site
  无 `PREFERS_REDUCED` 残留；`pnpm type-check:site` PASS。
- 节点自检：stagger timer 每次 committed entry 仍只有一个 owner并有 cleanup；共享媒体查询
  hook 消除了静态/动态两个 owner 和重复逻辑。动态 OS 切换后无限 lane 是否在真实 Scene 中
  即时停止/恢复仍由节点 9 浏览器验收。节点 6：PASS（代码与回归 seam）。

## 独立代码复审 FAIL 与节点重开（2026-08-17）

- 独立报告：`task-flows/2026-08-17-adversarial-remediation-round-2-code.md`，结论
  `VERDICT: FAIL`。该结论不由实现 Agent 自证，已逐项回读完整报告。
- 节点 2 重开：`mediaGenerationRef` 在 render 阶段递增；若并发 render 被中止，已提交 source
  的 native listener 会被错误失效。React `onEnded` 用户回调也未与 generation/activation
  使用同一门控，旧 source 的 queued ended 仍可能冒充新 source 回调。
- 节点 3 重开：连续 frame 已脱离 Scene React 树，但 debug 模式下的
  `data-cineview-takeover-progress-px` 与 `data-cineview-takeover-viewport-offset` 仍从故意忽略
  连续值的 React snapshot 渲染，导致同 phase 内探针陈旧；必须由 frame store 命令式更新，
  不能恢复每帧 React render。
- 节点 5 重开：Scene5 在 progress `< 0.90` 即 collapse，但 closing scrub opacity 在
  `0.85 -> 1` 窗口内，此时约仍有 0.33 可见内容；CSS 注释与实际数学不符，存在可见跳变。
- 节点 6 重开：phase revision 能看到同步 `exit -> animate`，但旧 `settled=true` 只在 passive
  effect 清零；新 animate revision 的第一次 commit 仍会以 `instant=true` 写入 terminal variant。
  现有测试只观察 effect flush 后最终 DOM，未观察决定性的首次 commit。
- 非阻断清洁项：site 定向 ESLint 在 `Scene5Cinema.tsx` 与 `scene5Lifecycle.ts` 各有一个缺少
  显式返回类型 warning，修复后纳入重跑证据。
- 浏览器 Agent 状态：专用 scroll/drag Chromium fixture 已报告 PASS；官网 warm Long Task/rAF
  首次采样因自动审批超时中止、没有生成报告且无残留采样进程，正在独立重试。该缺口未补齐前
  不得把节点 9 标为完成。
- 本轮自检：前述 FAIL 证据已推翻旧节点 PASS，故立即取消对应勾选；节点 4 BackgroundRibbon
  与节点 6 中 reduced-motion 子项暂未发现新阻断，但组合节点仍保持未完成，等待修复后整体验证。

## 独立浏览器复审结果（2026-08-17，重跑后）

- Agent：`/root/independent_browser_final_round2`，独立验收 lane；本节不使用实现 Agent
  的单测或自跑结论。
- 有效通过：专用 scroll/drag Chromium fixture 的正向、反向、取消/重新抓取、大幅 flick
  防跳过、键盘、scrollbar、多 zone 倒序重放；Scene5 专项（含 offscreen/unfinished、
  focus、replay 时序）；动态 `prefers-reduced-motion`；BackgroundRibbon 同路径容器替换；
  `/drag` warm 性能采样（无 Long Task，最大 rAF gap 33.3ms）。
- 失败证据：真实首页多元素 scroll warm wheel（旧污染样本已作废并重跑）仍出现
  `Long Task 53ms`，最大 `rAF gap 49.3ms`。原始 JSON 已落盘：
  `output/playwright/2026-08-17-remediation-round-2/report-scrollPerformance.json`；
  同目录保存 `scene5`、`reducedMotion`、`backgroundRibbon`、`dragPerformance` 报告。
  该结果说明当前 scroll 热路径仍有可复现性能反例，节点 9 不能勾选完成。
- 采样纪律：首次重跑与媒体 Agent 的 Jest 探针有时间重叠，已全部标为污染并舍弃；本节
  只引用机器静默后的最终 scroll/drag 重跑。浏览器 Agent 未在生产代码上自证。
- 节点自检：功能路径通过不等于性能通过；当前总体结论仍为 `FAIL`，待代码阻断和 53ms
  warm scroll 长任务定位/修复后，必须再次启动全新浏览器 Agent。

## 节点 5 重开后的整改与回读

- 红因回读：closing wrapper 的 opacity 在 `0.85 -> 1` scrub 窗内是 progress 的纯函数，
  原 collapse 阈值 `0.90` 时 opacity 仍约 `0.33`；旧 CSS 注释“已淡净”与实际计算矛盾。
- 实现：导出 `SCENE5_SPLIT_SCRUB_START = 0.85`，并让
  `SCENE5_SPLIT_COLLAPSE_AT` 直接引用该常量；`Scene5Cinema` 的四条 Animate scrub lane
  也消费同一常量。仅当 progress `< 0.85` 才收列，恰在 `0.85` 仍保持布局，避免可见内容
  随 flex transition 移动；`0.95` reopen hysteresis 和 replay generation 不变。
- 回归：新增边界测试证明 `collapse === scrub start`、恰在 start 不收列、低于 start 才收列。
  命令 `pnpm test --runInBand src/__tests__/site/scene5Lifecycle.test.ts
  src/__tests__/site/lastWinsTimerSequence.test.ts` → 2 suites / 8 tests PASS。
- 清洁证据：定向 ESLint 覆盖 `Scene5Cinema.tsx`、`scene5Lifecycle.ts` 与测试，0 warning/
  0 error；独立复审指出的两个缺少显式 return type warning 已清除；定向
  `git diff --check` PASS。
- 状态/性能自检：没有增加 state、timer、listener 或每帧 writer；progress 仍由 Animate/
  MotionValue 唯一拥有，reducer 只在阈值跨越时写离散 split。常量合并删除了将来再次漂移的
  重复数值语义。节点 5 代码整改 PASS；本次阈值变化后的真实浏览器视觉仍归节点 9 重验。

## 节点 2 重开后的整改与回读

- 决定性红证：新增 retained-video stale ended 与 Suspense aborted-transition 两条组件 seam。
  修复前定向运行均 FAIL：旧 source native event 会把最新公共 `onEnded` 调用 1 次；source B
  speculative render 挂起后，source A listener 被 render 期 generation 修改错误失效，A ended
  未写 terminal，后续 programmatic frame 错误 seek 到 5s。
- 实现：删除 render 期 media identity/generation 写入；仅在 `useLayoutEffect` 发布已提交
  `src + objectUrl` identity 并重绑 generation listener。中止 render 不执行 layout effect，
  因而无法污染 live listener。`dispatchOwnershipRef` 同样只在 commit 后发布。
- 统一 gate：native ended capture listener 先校验 committed `generation + activationId`，合法
  event 才进入 WeakSet 并派发 reducer terminal event；React `handleEnded` 只有消费到同一个
  accepted native Event 时才调用最新 committed `onEnded`。add/remove 的 capture 参数对称。
- 绿证：media 2 suites / 58 tests PASS；覆盖 aborted transition、stale reducer + public callback、
  latest `onEnded` prop。定向 ESLint 与 `git diff --check` PASS。实现期间全仓 type-check 的唯一
  报错来自并发编辑中的 scroll 测试夹具，media 文件 0 error，待节点 3 落盘后统一重跑。
- 状态/性能自检：保留 retained `<video>`，没有 `key={src}`；ownership 仍由单一 reducer ref
  写入，`currentTime` 仍仅由 seek command 写入。generation/activation 只在 source/objectURL/
  release/warmUp/enter 边界变化，不进入每帧 progress 热路径。节点 2：PASS，等待节点 8 的
  全新独立代码复审推翻尝试。

## 节点 3 与 6 重开后的整改与回读

### Stagger 首次 commit

- 红证：测试用 layout-effect probe 逐次记录实际 commit；已 settled 的 group 同一 batch
  `exit -> animate` 后，旧实现的新 entry 第一条记录仍为 `duration=0/delay=0`，随后 passive
  effect 才恢复 `0.4/0.08`。这直接命中独立复审反例，而非只看 effect flush 后最终 DOM。
- 实现：`useStaggerSettled` 不再保存无代际 boolean，改存 `settledRevision` token；render 仅在
  `phase === animate && settledRevision === phaseRevision` 时 instant。新 revision 首次 render
  同步判 false，旧 timer 即使在 cleanup 前到达也只能写旧 token。timer 仍是唯一 settled 写者。
- 热路径：`useStaggerPhase` 只在派生 phase 边界改变时 setState；同 phase MotionValue 连续值不
  进入 React。timer cleanup 保持对称，没有新增每帧依赖或第二个动画 clock。

### Scroll debug imperative frame

- 红证：稳定 sequence/layout/离散字段，只更新 zone progress、timeline 连续值与 viewport offset；
  Scene render count不增加，但旧 debug DOM 属性停在 `10/100`，未变为 `20/200`。
- 实现：`ScrollSceneFrame` 增加由 `useScrollSceneSnapshots` 唯一发布的 `zoneProgressPx`，纳入
  frame equality；`ScrollSceneSlot` 仅在 debug + takeover 时用 layout effect 先 apply 当前 frame，
  再 subscribe，并直接 `setAttribute` progress/viewport。关闭 debug 和卸载均取消订阅，绝不
  恢复每帧 React render。
- 反例强化：初始 React snapshot 故意为 `10/100`、frame 为 `11/110`，证明首个 commit 的
  layout apply 来自 frame lane；随后同 phase 推到 `20/200`，两个属性实时更新且 CountingScene
  render count不变。debug=false 时 0 frame 订阅、0 debug 属性；writer 测试证明仅 zone progress
  改变时 frame listener收到通知，render store listener不触发。
- 绿证：相关 4 suites / 33 tests PASS；`pnpm type-check` PASS；相关 ESLint 0 error/warning，
  Prettier 与 `git diff --check` PASS。
- 状态/性能自检：native controller 仍是唯一 progress 计算/写入 owner；frame store仅搬运同一
  结果。debug 模式每个 live scene多一次 primitive比较和 DOM attribute写；非 debug 模式无新增
  subscriber/DOM写。节点 3、节点 6：PASS，仍需节点 8/9 全新独立复审。

## 节点 9 性能阻断诊断（进行中，尚未验收）

- 原始有效反例仍为
  `output/playwright/2026-08-17-remediation-round-2/report-scrollPerformance.json`：首页 warm
  多元素 wheel 出现 `53ms` Long Task、最大 rAF gap `49.3ms`；另外 5 个全新 Chromium context
  中有 2 次复现 `57ms/53ms`，均在前 8 个 wheel 内。该反例未被后续绿样本推翻。
- timeline-only 复现曾捕获首个 wheel、`scrollTop=720` 的约 `56.8ms RunTask`：wheel
  EventDispatch 约 `12.8ms`，React microtasks 约 `11.3ms`，UpdateLayoutTree 约 `1.2ms + 2.8ms`。
  隐藏 iframe 的 added/loaded/removed 时点约为 `453/536/536ms`，Long Task 约在 `2478ms`，因此
  iframe 首次生命周期已排除为同一时点原因。
- 诊断脚本：
  `output/playwright/2026-08-17-remediation-round-2/scroll-trace-diagnosis.mjs`；候选原始 trace：
  `scroll-trace-standard-run-3.trace.json` 与 `scroll-trace-standard-run-3.report.json`。
- 2026-08-17 最新独立性能 Agent 状态：移除 CPU profiler categories 后，以纯 timeline 跑 8 个
  全新 context 均通过，最大 rAF gap `32.6-34.1ms`。这只能说明问题稀有且 instrumentation 会改变
  时序，不能证明旧 `56.8ms` 是假阳性；当前尚无完成的根因归属，也未提交生产修复。
- 当前待证伪路径：手势首帧 `syncNativeScrollState(true) -> measureSceneLayouts()`；
  `scrollOffsetStore -> ScrollbarOverlay.useSyncExternalStore` 的逐帧 React render；以及 wheel
  EventDispatch 后的 React commit/layout 工作。Agent 正用原验收负载与最小边界探针逐项区分，
  在归因前禁止盲改。
- 探针已重建 dist 后生效：3 个新 context 中第 3 个再次捕获 `52ms` Long Task / `49.9ms`
  frame gap；同一报告记录首个 gesture burst 仅 1 次 `measureSceneLayouts`（5 scenes，约
  `0.1ms`），故首帧 layout measurement 不是该长任务 owner。`ScrollbarOverlay` 在 48 wheel
  中发生 96 次 render（每 wheel 两次），单次计算记录为 `0-0.1ms`，但尚未完成无订阅 A/B，
  因而不能把它判定为无影响或唯一根因。
- 带 component-render 边界探针的 8 次新 context 全部无 Long Task（最大 frame
  `18.7-33.4ms`），通常记录 `DirectScrollCineView=4`、`Scene=72`、scrollbar=96；该探针
  改变了时序，仍不能覆盖无探针的 `52-57ms` 反例。临时 probe hooks 当前只用于诊断，完成归因
  后必须删除并重新构建 dist。
- 当前结论：节点 9 保持未完成；总体严格状态仍为 `FAIL（修复中）`，不得因 8 个纯 timeline
  绿样本改判 PASS。

### 三开关 A/B 证据（同一重建 dist，2026-08-17）

- 运行前提：`pnpm build` 成功；站点由 `pnpm --dir site dev --host 127.0.0.1`
  提供（本轮端口 `4001`，因旧 `4000` listener 残留但不可连接）；每组 5 个全新 Chromium
  context，脚本为
  `CINEVIEW_BASE_URL=http://127.0.0.1:4001 node output/playwright/2026-08-17-remediation-round-2/scroll-boundary-probe.mjs 5 <variant>`。
  结果 JSON 保存在同目录的 `scroll-boundary-<variant>-run-*.json` 与 summary 文件。
- `baseline`：1/5 PASS、4/5 FAIL；Long Task `51/66/59/60ms`，最大 rAF
  `50.0-66.7ms`；典型渲染计数 `ScrollbarOverlay=96-98`、component `136-150`。
- `skip-is-scrolling`：0/5 PASS、5/5 FAIL；Long Task `51/60/60/62/59ms`，最大 rAF
  `49.9-51.9ms`。跳过 `setIsScrolling` 并未消除长任务，故 `isScrolling` React state
  不是唯一 owner。
- `skip-content-span`：2/5 PASS、3/5 FAIL；Long Task `60/60/62ms`，最大 rAF
  `50.0-51.9ms`。偶发绿样本仍落在基线波动内，不能归因于 `scrollContentSpan` state。
- `disable-scrollbar-subscription`：2/5 PASS、3/5 FAIL；Long Task `58/62/63ms`，最大
  rAF `49.9-50.0ms`；ScrollbarOverlay render 降至 `2-4`，但长任务仍在。逐帧
  `useSyncExternalStore` 订阅不是唯一根因。
- A/B 结论：三个候选开关均未给出稳定的反事实差异；当前证据不能安全支持生产 patch。
  父 Agent 提供的 trace 候选（wheel handler 重复 `syncNativeScrollState`、
  `shouldDeferToNestedScrollable` ancestor `getComputedStyle`/尺寸读取）仍需独立计时，
  不能由本组结果推断。临时 flags/probe hooks 保留待下一阶段归因后统一删除，禁止带入最终
  生产构建。
- 节点自检：本段只新增诊断注入和报告，没有改变默认行为；三组均为独立 context，
  但性能结果仍含间歇性波动，因此节点 9 继续保持未完成，结论仍为 `FAIL（修复中）`。

### Wheel EventDispatch 反事实：环境阻断（2026-08-17）

- 为继续证伪 trace 候选，新增两个仅由注入 probe 开启的临时 flag：
  `skipNestedScrollableGuard`（只短路首页 wheel 的 nested scroll ancestor guard）与
  `skipDuplicateNativeScrollSync`（eager `applyNativeScrollDelta` 后用 offset token 跳过同偏移的
  下一次 native `scroll` sync）。默认均为 false；`pnpm exec tsc -p tsconfig.framework.json
  --noEmit --pretty false` 通过，随后 `pnpm build` 成功重建 dist。
- 计划命令：`CINEVIEW_BASE_URL=http://127.0.0.1:4001 node
  output/playwright/2026-08-17-remediation-round-2/scroll-boundary-probe.mjs 5
  skip-nested-guard`，之后同样运行 `skip-duplicate-native-scroll`；每项要求至少 3 个新 context。
- 实际结果：`skip-nested-guard` 两次启动均在 Chromium 进程创建前因自动权限审批超时被拒绝，
  生成 `0` 个 context、`0` 个 JSON；按“不无限重试”约束停止。故
  `skip-duplicate-native-scroll` 也没有启动，不能声称任何性能结论。
- Server 证据：本 Agent 持有的 Vite session 仍有输出且 `lsof` 显示 `127.0.0.1:4001`
  listener；框架 build 原子替换 dist 的窗口内曾出现短暂 `cineview.es.mjs` 不存在的
  pre-transform error，重建完成后收到 HMR。当前阻断是浏览器命令权限审批，不是已有 A/B
  的应用失败证据。
- 当时的临时 probe 状态（历史现场）：`useScrollInputBindings.ts`、`useNativeScrollController.ts`、
  `DirectScrollCineView.tsx` 以及此前的 layout/scrollbar/component render hooks 仍在源码和
  当时 dist；后续已在“节点 7 前置”统一净化并重建，本条不得解读为当前状态。
- 结论：nested guard 与重复 native sync 是否为 EventDispatch 主因仍是 `BLOCKED`，没有达到
  可写生产 patch 或红测的证据门槛；节点 9 保持未完成。

## 节点 7 前置：临时性能诊断净化（2026-08-17）

- 已删除所有仅用于定位 Long Task 的 component render 计数、`__cineviewPerfProbe`、A/B flags、
  `pendingEagerScrollOffsetRef` 与临时 `syncNativeScrollEvent`；保留已经过回归验证的 frame store、
  debug imperative 更新与 approach-band 等生产修复。
- 清理后命令：
  `rg -n "__cineviewPerfProbe|pendingEagerScrollOffsetRef|syncNativeScrollEvent|CINEVIEW_(SKIP|DISABLE|PERF)|skipIsScrolling|skipContentSpan|disableScrollbarSubscription|nestedScrollGuard|duplicateNativeSync" src site examples`
  返回 0 命中；这些名称只保留在本证据文档的历史诊断记录中。Playwright 前置检查 `command -v npx`
  返回 `/Users/alienmu/.nvm/versions/node/v21.7.3/bin/npx`。
- 当前 `dist` 仍是清理前构建，不能用于最终浏览器验收；必须在节点 7 的测试、type/lint 与
  `build:verify` 后重新确认源码/dist 同步。
- 节点自检：本步只净化诊断代码，没有把未证实的 nested-scroll 或 duplicate-sync 反事实带入
  默认生产行为；节点 7 尚未完成，等待清理后的全量验证。

### 节点 7 定向回归（清理后）

- 命令：`pnpm test --runInBand` 加媒体、Stagger、scroll frame/debug/engine/approach、
  BackgroundRibbon、Scene5、timer sequence 与动态 reduced-motion 共 14 个定向套件。
- 结果：14 suites / 121 tests 全部 PASS，0 snapshot；耗时 1.521s。唯一额外输出为 Node
  `punycode` deprecation warning，不是测试失败。
- 回读：这些用例覆盖中止 render/stale media event、Stagger 新 revision 首 commit、连续 scroll
  frame 不触发 Scene render 但更新视觉/debug consumer、Scene5 阈值与 timer generation、容器换代
  cleanup、动态 media-query listener cleanup。定向绿灯不能替代全量或真实浏览器证据。
- 节点自检：清理未删除已有回归保护；尚未运行全量 test/type/lint/build，节点 7 保持未完成。

### 节点 7 全量与静态门禁（清理后）

- `pnpm test --runInBand`：120 suites / 1564 tests 全部 PASS，0 snapshot，52.887s；仅有
  Node `punycode` deprecation warning。
- `pnpm type-check`：PASS，0 TypeScript error。
- `pnpm type-check:site`：PASS，0 TypeScript error。
- `pnpm lint`：PASS，framework `src` 0 error / 0 warning。
- 命令与测试在同一清理后工作树运行；Jest 完整结果包含 drag/scroll、媒体、Scene、站点契约、
  property 与本轮新增回归。尚待 site 定向 lint 和 `pnpm build:verify`，故节点 7 仍未勾选。
- 节点自检：自动化证明没有已覆盖的语义/类型回归，但不能推翻真实浏览器已有的 53ms Long Task；
  性能和完整交互仍必须由节点 9 的全新独立 Agent 重测。

### 节点 7 首次构建验证失败记录

- site 定向 ESLint 首次结果：`site/src/design/lut.ts:44:25` 缺少显式返回类型（1 warning，0
  error）。已补为 `const c = (n: number): string => ...`，待重跑确认 warning 清零。
- 首次 `pnpm build:verify`：构建、产物大小、类型定义、代码分割、压缩、exports、consumer
  smoke、source maps 共 13/14 项通过；第 14 项 packed tarball consumer 因
  `/Users/alienmu/.npm/_cacache` root-owned 文件报 `npm ERR! EPERM`，属于环境缓存权限失败。
  同一命令未发现源码构建或产物断言失败；将用任务专用 writable npm cache 重跑完整命令，结果
  不会把环境失败伪装成 PASS。

### 节点 7 最终结果与节点级自检

- site 定向 ESLint 在补齐 `lut.ts` 局部 helper 的 `: string` 后重跑：0 error / 0 warning。
- `npm_config_cache=/private/tmp/cineview-npm-cache pnpm build:verify`：14/14 PASS；packed tarball
  隔离 consumer 的 require/import 均通过，清理后的 dist 已重建。产物预算：ES gzip 45.10 KB、
  full UMD 53.38/55 KB、drag UMD 42.98/50 KB、scroll UMD 47.76/50 KB。
- 最终补跑 `pnpm type-check:site` PASS、`pnpm --dir site build` PASS（466 modules；仅保留 Vite
  已知的 >500 KB site chunk warning）、`git diff --check` PASS。
- 完整节点 7 证据：定向 14/121 PASS；全量 120/1564 PASS；framework/site type-check PASS；
  framework lint 与 site 定向 lint PASS；library build:verify 14/14 PASS；site production build PASS。
- 回读与性能自检：dist 来自已净化源码，未包含任何 probe/A/B flag；新增/保留连续 scroll 更新走
  frame store 与 MotionValue/imperative consumer，没有把 progress 放回 React state。自动化不能
  推翻既有 53ms Long Task，因此节点 7 仅代表静态/自动化门禁 PASS，节点 9 仍必须独立重测。
- 节点 7：PASS。回读节点列表后，下一个可执行节点为 8（全新独立代码对抗复审），节点 9
  浏览器验收不得由本 Agent 自证。

## 节点 8/9 启动记录（2026-08-17）

- 已启动全新独立代码 Agent：`/root/fresh_code_adversarial_final`。职责仅为从实际工作树回读
  规格、控制流、状态所有权、失败分支、热路径与死代码，并回答六项对抗问题；不得修改生产代码，
  不得把测试或其他 Agent 结论当作自证。
- 已启动全新独立验证 Agent：`/root/fresh_independent_verification_final`。职责独立运行门禁、
  新 Chromium context 的 drag/scroll/站点交互和性能矩阵；不得阅读或采信代码 Agent 报告。
- 两个 Agent 均要求将独立报告、命令、截图、JSON/trace 与最终 PASS/FAIL/BLOCKED 写入新的
  task-flow/artifact 路径。节点 8、9 保持未勾选，直到各自报告落盘并完成节点级回读。
- 节点 8 首次 Agent 尝试在产出报告前由平台报
  `stream disconnected before completion: Concurrency limit exceeded for account`；没有报告、
  没有六项回答，故不计为复审证据。已向同一全新角色重新派发从当前工作树开始的完整只读复审，
  节点 8 继续保持未完成；若无法取得有效独立报告，最终只能 BLOCKED。

## 节点 8：全新独立代码复审 FAIL

- 有效 Agent：`/root/fresh_code_adversarial_final`；首次平台断线后重新从当前工作树执行，完整报告
  `task-flows/2026-08-17-adversarial-remediation-round-2-code-final.md`（173 行），未修改生产代码或测试。
- 明确结论：`VERDICT: FAIL`。六项回答均已给出文件/行号与反例；确定性阻断包括：
  Scene5 `finished(0.85)` 与 progress 边界相反、freeze 在取消 animation 后读取 live computed style、
  duplicate unfinished 重启退出时钟；旧 source native play/public callback 未共享 generation gate；
  scroll debug JSX + imperative 双写、full frame refresh 暴露空中间态、eager + native scroll 双 sync。
- 代码级通过子项：BackgroundRibbon lifecycle、动态 reduced-motion、Stagger settled revision；未发现
  第二套独立 progress 算法或临时 probe/flag 残留。
- 节点级回读：已逐条回读完整报告，并确认这些反例不由 1564 tests/type/lint/build 绿灯覆盖。
  节点 8 的“执行独立复审”动作完成但结果 FAIL；已新增 8a/8b。旧候选浏览器结果全部降级为历史
  证据，验证 Agent 已关闭服务/context并暂停，整改后必须重建 dist 与全新 context 重验。

## 节点 8a：scroll 反例红绿（主 Agent）

### 红证

- 新增三条回归断言后，旧实现定向命令
  `pnpm test --runInBand src/components/CineView/ScrollSceneStack.test.tsx src/components/CineView/useScrollSceneSnapshots.test.tsx src/components/CineView/DirectScrollCineView.test.tsx`
  稳定失败：
  - debug frame `20/200` 被离散 snapshot `15/150` 覆盖；
  - full refresh frame listener 收到 `[undefined, frame]` 两次通知；
  - eager wheel sync 后补发 native scroll 额外读取 `scrollHeight`（4 次→6 次）。

### 实现与绿证

- `ScrollSceneSlot` 删除连续 progress/viewport 的 JSX 属性，只由 frame-store layout effect 写入，
  debug 关闭/卸载时显式移除；静态 debug 属性仍由 React 管理。
- `useScrollSceneSnapshots` 在 full update 中先构造完整 frame 数组，再一次 `setSnapshot` 原子发布，
  非 full update 继续按 key 增量发布；不再先清空 frame store。
- `useNativeScrollController.syncNativeScrollState` 对已进入 gesture、无 programmatic target 且
  raw offset 与上次解析值不超过 `TAKEOVER_PROGRESS_SNAP_EPSILON_PX` 的重复 native event 早退；
  保留 `0.3px` 终点/慢滚事件（初版 `0.5px` 早退被既有 endpoint 测试反证并立即收窄）。
- 修复后同一定向命令：3 suites / 99 tests PASS；旧 endpoint、慢速 progress、frame render-count
  回归均保持通过。

### 节点级自检

- 单一写者：连续 debug 属性只有 frame store imperative writer；render store 不再写同名属性。
- 原子性：full refresh 订阅者只见一次完整 frame，不观察空中间态；Scene engine/fixed layer 不再
  分别处理同一 refresh 的 undefined 与新值。
- 热路径：重复 native event 在读取 viewport/zone/layout/scroll dimensions 前退出；有效小于等于
  `0.01px` 的重复事件不改变 endpoint/slow-scroll 语义。仍需真实浏览器测量 Long Task，不能由单测
  宣称性能 PASS。
- 本子节点：scroll 代码整改 PASS；8a 仍等待媒体/Scene5 Agent 交付后整体收口。

## 节点 8a：Scene5 反例红绿（独立整改 Agent）

- Agent：`/root/scene5_adversarial_fix_final`；该角色只处理独立代码复审的 Scene5
  F1/F2/F6/F8 反例，主 Agent 已回读 reducer、DOM freeze helper 与新增测试。
- 红证：在整改前实现上新增 3 条边界测试，定向运行 8 tests 中 3 tests FAIL：
  `finished(progress=0.85)` 与 progress 分支对同一阈值给出相反 split 状态；live
  `CSSStyleDeclaration` 在取消 animation 后才读取 visibility；重复 `unfinished` 会递增
  generation 并重启 1050ms exit sequence。
- 实现：`finished` 使用 `progress >= SCENE5_SPLIT_COLLAPSE_AT`；
  `freezeScene5Element` 在写 `animation = 'none'` 前复制 transform 与 visibility primitive；
  `exitPending` 下的 duplicate `unfinished` 幂等返回。Scene5 注释统一为 0.85 collapse、
  0.95 reopen 和当前 last-wins 退出语义。
- 绿证：Scene5 lifecycle + last-wins timer 定向结果 11/11 PASS；
  `pnpm type-check:site` PASS；目标 ESLint、Prettier、`git diff --check` 全部 PASS；
  `rg` 无旧 0.90 阈值、旧“只清 latch”注释或临时 probe 残留。
- 节点级自检：三条确定性反例都有旧实现红证和新实现绿证；改动只进入消息/阈值/timer
  离散事件路径，没有新增每帧 React state、第二个 progress 写者、布局读取或动画 clock。
  本子节点代码整改 PASS；阈值视觉与中途取消/重抓仍必须在节点 9 的全新浏览器 context 重验。

## 节点 8a：注释漂移净化

- 回读确认 `sceneScrollRuntime.tsx` 的旧注释错误宣称 approach keyed store 在普通滚动中
  “silent”；真实语义是完整 timeline store 连续发布并调用 listener，approach selector 的
  primitive snapshot 仅在阈值跨越时变化，因此 consumer 不重渲染。
- 已修正文档为上述实际成本模型；不改 store、selector 或 runtime 控制流。Scene5 的 0.85/0.95
  与 unfinished 注释已由独立整改 Agent 同步，`rg` 未发现复审报告指出的旧 0.90/旧 latch 文本。
- 节点级自检：本项消除误导性性能声明，没有生产语义、状态写者或每帧成本变化。

## 节点 8a：媒体 native/public event 统一 gate（独立整改 Agent）

- Agent：`/root/media_event_gate_final`；主 Agent 已回读 `VideoFrameRenderer` 的 commit、listener、
  reducer dispatch 与 public callback 顺序，以及 ownership reducer 的全部 media event 分支。
- 红证分两种模型：source A 的旧 capture closure 在 source B commit 后迟到；以及 A 已排队事件在
  retained `<video>` 完成 B rebind 后由当前 B listener 接收。临时把 readiness gate 缩回仅
  `isCurrent()` 后，后者用真实 `video.dispatchEvent(staleQueuedEvent)` 稳定使 B 的 `onPlay` /
  `onPause` 各错误触发 1 次，新增两测 FAIL；说明只换 listener closure 不能关闭原反例。
- 实现：source/objectURL identity 只在 layout commit 后递增 media generation，并先 disarm
  `readyMediaGenerationRef`；当前 generation 收到 `loadstart` 后才 arm。native
  `play/pause/ended` capture listener 共用 `generation + activation + ready generation` gate，
  并把同一 accepted Event token 写入 WeakMap；React public handlers 只消费该 token，不再写
  ownership reducer。`media-play/media-pause/media-ended` reducer event 均要求 activationId，
  stale token 直接保持原 state。
- 绿证：独立整改 Agent 的 media 2 suites / 61 tests PASS；主 Agent 复跑相同命令同为
  2 suites / 61 tests PASS。Agent 的 `pnpm type-check`、目标 ESLint、Prettier、
  `git diff --check` 均 PASS；主 Agent 回读时 `git diff --check` 亦 PASS。
- 功能/状态自检：合法 B 在 `loadstart` 后的 play/pause public callbacks 仍各触发一次；capture
  add/remove 的 `true` 参数对称；native event 只有 capture listener 写 ownership reducer，
  React handler 不构成第二写者。generation/activation/readiness 仅在 source、resource、re-entry
  等离散边界更新，不进入 progress 每帧热路径。
- 明确边界：readiness 依赖 HTML media-element task source 的 FIFO，即 A 已排队的旧事件先于 B 的
  `loadstart` dispatch；合规浏览器满足该顺序。若非合规 UA 把旧媒体事件重排到 B loadstart 之后，
  Event 本身没有 source 标签，retained DOM 无法再区分；该残余必须由节点 9 的真实 Chromium 路径
  继续验证，不能仅凭 jsdom 宣称消失。
- 本子节点代码整改 PASS；节点 8a 仍需组合/全量门禁后方可勾选。

## 节点 8a：组合定向门禁

- 主 Agent 串行运行覆盖本轮所有整改面的定向矩阵：
  `pnpm test --runInBand` 加 media ownership/renderer、ScrollSceneStack、
  `useScrollSceneSnapshots`、ScrollSceneSlot、DirectScrollCineView、scroll engine/runtime、
  Stagger、AnimateVideo plumbing、scroll phase/hotpath、BackgroundRibbon、Scene5 lifecycle、
  last-wins timer、动态 reduced-motion 共 16 suites。
- 结果：**16 suites / 254 tests PASS**，0 snapshot；仅有 Node `punycode` deprecation warning，
  无失败或未处理异常。
- 节点级回读：组合结果同时覆盖旧 source queued play/pause/ended gate、full frame 原子刷新、
  debug imperative writer、重复 native sync、Scene5 阈值/冻结/重复消息/重开 generation、
  stagger 首次 commit 和动态媒体查询 listener。未把单个定向 suite 的绿灯扩写为浏览器性能结论。

## 节点 8a：静态门禁与 dist 重建

- 并行执行结果：`pnpm type-check` PASS；`pnpm type-check:site` PASS；`pnpm lint` PASS（framework
  0 error/0 warning）；`pnpm exec eslint site/src --ext .ts,.tsx` PASS；
  `pnpm format:check:site` PASS；`git diff --check` PASS。
- `pnpm format:check:framework` 返回 FAIL，但命中项为既有/非本轮范围的 `DESIGN.md`、
  `examples/performance-test/stress/*` 和 `src/components/Animate/animateVariantsPending.test.tsx`；
  未以自动格式化覆盖用户工作树。后续对本轮触及 production/test files 做 targeted Prettier check，
  该项目级基线失败作为非功能门禁记录，不伪装成 PASS。
- 串行命令 `npm_config_cache=/private/tmp/cineview-npm-cache-round2-final pnpm build:verify`：
  **14/14 PASS**；packed tarball consumer、exports、types、source maps、代码分割、压缩预算均通过。
  本次构建已原子刷新 dist；最终验证摘要 ES gzip 45.30 KB、全量 UMD 53.60 KB、drag UMD
  43.11 KB、scroll UMD 47.95 KB。
- 节点级回读：dist 来自含 media readiness gate、scroll frame atomic/epsilon、Scene5 阈值修复和
  comment cleanup 的当前源码；没有保留诊断 probe/A-B flag。构建 smoke 的 React SSR
  `useLayoutEffect` warning 未改变 14/14 结果，须在最终报告中如实保留。

## 节点 8a：全量回归与 site 构建收口

- 构建后串行运行 `pnpm test --runInBand`：**120 suites / 1571 tests PASS**，0 snapshot；
  只有 Node `punycode` deprecation warning。
- `pnpm --dir site build`：PASS，Vite 转换 466 modules；仅有既有的 index chunk >500 KB warning，
  没有构建错误。
- final 静态复跑：`pnpm type-check`、`pnpm type-check:site`、`pnpm lint`、
  `pnpm exec eslint site/src --ext .ts,.tsx`、本轮触及文件 targeted Prettier、`git diff --check`
  全部 PASS。项目级 framework Prettier 的四个非本轮基线文件仍保持原样并单独记录。
- 节点级回读：全量测试在最新媒体 gate、scroll 原子 frame、Scene5 修复和格式化测试文件上执行；
  dist 在 full test 前已由 14/14 build:verify 重建，未与测试并行写入。8a 的自动化/静态门禁完成，
  但不替代 8b 独立代码复审或节点 9 真实浏览器性能验收。
- **节点 8a：PASS（已勾选）**；回读后下一个可执行节点为 8b。

## 节点 8b/9：独立复审状态更新（已被后续结果 supersede）

- 原独立验收 Agent `/root/post_remediation_verifier_round3` 已完成静态门禁摘要，但因后端
  429 重试上限退出，未提交真实 Chromium、media/lifecycle 或性能报告；该退出不计为验收通过。
- 已启动全新独立验收 Agent `/root/post_remediation_verifier_round4`，明确不读取代码复审报告，
  将把 Chromium 脚本、截图、Long Task/rAF 探针和失败案例写入独立 v2 browser task-flow。
- 该段记录的是报告尚未收口时的中间状态；随后 8b 已完成并以 FAIL 收口，详见下文。
- 浏览器 Agent 在启动 Chromium 前因 429 退出，未形成可继承的真实浏览器结论；节点 9 仍待
  修复后以全新 Agent/context 重跑。

## 节点 8b：全新独立代码对抗复审

- Agent：`/root/post_remediation_code_adversary_round3`；只读复审，未读取其他 Agent 报告，未改
  生产代码、正式测试或 dist。
- 报告：`task-flows/2026-08-17-adversarial-remediation-round-2-code-post-final.md`。
- 反例命令：`pnpm exec jest --runInBand --runTestsByPath
  /private/tmp/cineview-video-gate-adversarial.test.tsx ...` → 1 suite / 4 tests PASS；此处
  PASS 表示四条错误行为断言均稳定复现，不是修复通过。
- 确定性发现：同源 `release → warmUp` 旧 `ended` 被新 activation 接收；旧 source 的
  `loadstart → play` 可给新 generation 提前 arm；出场 `pause()` 排队后新 activation 会被旧
  pause 污染；`ScrollbarOverlay` 对每个 offset store 帧重新进入 React。另记录 frame/render
  跨 lane 发布、pending play generation、timeline optional 字段等残余风险。
- 六问结论：原问题未真正解决；媒体错误事件已改变语义；未发现第二套 progress 计算器但发现
  readiness/activation 与 frame/render 时序竞态；存在未覆盖失败路径和半修 readiness 分支；
  **Agent 结论：FAIL**。
- 节点级回读：报告与临时探针已完整读回；8b 不能勾选为通过，进入新的整改节点。

## 节点 8c：代码复审反例整改（进行中）

- 计划修复 F1/F2：资源或 residency 边界替换 `<video>` 节点，隔离不带 source token 的旧媒体
  事件；补同源 release/warmUp、旧 loadstart、出场 pause→重入的正式回归测试。
- 计划修复 F3：`ScrollbarOverlay` 改用稳定 DOM 引用 + external-store imperative 更新
  thumb/ARIA，保留键盘/指针读取的最新 offset，避免每个 scroll offset 触发 React render。
- 修复前不启动最终浏览器验收；生产改动、红绿测试、dist 重建和静态门禁完成后，重新启动
  全新独立代码复审与全新 Chromium context。
- **节点 8c：未完成；节点 9、10 保持未勾选。**

### 节点 8c：F1/F2/F3/F4/F5 实现与红绿证据

- 媒体：`VideoFrameRenderer` 的 key 现在绑定 `src + objectUrl + residency + activation node
  epoch`。source/objectURL、release/warmUp、ended/outgoing 后的正式 reactivation 都替换底层
  `<video>` 节点；旧节点 listener 在替换前注销，因此没有 source/activation token 的旧媒体任务
  不能被新 generation 接收。source/objectURL ownership reset 从 passive effect 前移到同一
  layout commit；pending play request 同时记录 generation + activation，旧 promise settle 不再跨代。
- Scrollbar：删除 `useSyncExternalStore` 的逐帧 React consumer；offset store listener 只更新稳定
  rail/thumb DOM 引用的 `aria-valuenow` 和主轴位置。键盘/指针从最新 offset ref 计算，autoHide 仍只在
  gesture start/end 与 focus 等离散边界触发 React。`scrollContentSpan` 先比较 ref，尺寸不变时不再每帧
  调 functional state setter。
- Full refresh：render snapshot 先发布；完整 frame replacement 缓存在 ref，待对应 React 结构提交的
  layout phase 再一次性发布。普通 scroll 增量 frame 仍同步走 imperative lane，不新增每帧 state。
- 正式回归：media ownership/renderer + scrollbar 首轮 **3 suites / 71 tests PASS**；扩大到 media、
  AnimateVideo、DirectScroll、scroll snapshots/stack **9 suites / 217 tests PASS**；full-refresh 调整后
  scroll/media 组合 **7 suites / 210 tests PASS**；最新 media 复跑 **4 suites / 71 tests PASS**。
- 原独立临时反例套件在修复后变为 **1 suite / 4 tests FAIL**，四条失败均是“期望坏行为发生、实际
  调用为 0/React render 未发生”，即同源 stale ended、旧 loadstart arm、新 activation stale pause、
  scrollbar per-frame React 四个原反例均被证伪；对应正式正向回归全绿。
- 静态证据：`pnpm type-check` PASS；目标 ESLint PASS；targeted Prettier PASS；
  `git diff --check` PASS。
- 节点级回读：节点代际只在资源/驻留/正式 activation 离散边界递增，不进入 progress 热路径；
  scroll offset 仍只有 native controller 一个计算/写入 owner；frame full refresh 新增的 React state
  只在 resize/reorder/config identity 变化时更新。仍需完整 test/lint/build/dist 与新独立 Agent。

### 节点 8c：完整门禁与 dist 收口

- `pnpm test --runInBand`：**120 suites / 1575 tests PASS**，0 snapshots；仅 Node
  `punycode` deprecation warning。
- `pnpm type-check`、`pnpm type-check:site`、`pnpm lint`、
  `pnpm exec eslint site/src --ext .ts,.tsx`：全部 PASS；本轮触及文件 targeted Prettier 与
  `git diff --check` PASS。
- `npm_config_cache=/private/tmp/cineview-npm-cache-round2-post-code pnpm build:verify`：
  **14/14 PASS**，dist 已由当前源码重建；ES gzip 45.53 KB、full UMD 53.95 KB、drag UMD
  43.21 KB、scroll UMD 48.18 KB。consumer smoke 仍有已记录的 React SSR
  `useLayoutEffect` warning，不影响 14/14 结果。
- `pnpm --dir site build`：PASS，466 modules；只有既有 >500 KB chunk warning。
- 完整 diff 回读保留用户原有约 60 个 tracked 改动及 untracked artifacts，未回滚或格式化无关文件。
- 节点自检：F1/F2/F3 的确定性坏行为均有正式正向回归；F4 full refresh 现在由 render snapshot
  先通知、frame 在 layout commit 后发布并有顺序断言；F5 pending play 与 source reset 已绑定同一
  layout generation。无新每帧 React state、第二 progress writer 或未清 listener。
- **节点 8c：PASS（已勾选）**；下一节点为 8d 全新独立代码复审，不能以本节点自证最终 PASS。
