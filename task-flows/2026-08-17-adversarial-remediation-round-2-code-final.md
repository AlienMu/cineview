# 2026-08-17 Adversarial Remediation Round 2 - Independent Code Review (Final)

## 审查角色与裁决口径

- Agent：`/root/fresh_code_adversarial_final`
- 角色：全新独立代码级对抗复审；未参与生产实现，未执行浏览器验收。
- 工作目录：`/Users/alienmu/Documents/alien/cineView/cineview`
- 规格依据：`DESIGN.md`、`CLAUDE.md`、`AGENT_SELF_REVIEW.md`。
- 主任务记录：`task-flows/2026-08-17-adversarial-remediation-round-2.md`。
- 裁决原则：不继承此前 Agent 的 PASS/FAIL；测试全绿不能覆盖未写入测试的分支、浏览器 live-style
  语义、旧媒体事件或真实 scroll 热路径。任何确定性反例都足以否决 PASS。

## 实际审查范围

- Git 基线：`4660d96 feat: Animate 手动控制 + FOUC 修复；五幕视觉缺陷真机定位与整改`
  加当前未提交工作树。
- `git diff --stat`：59 个已跟踪文件，5075 insertions / 2132 deletions；另有本轮新增的
  frame-store、Scene5 lifecycle、BackgroundRibbon、reduced-motion 与测试文件。
- 重点代码：
  - 媒体：`src/media/VideoFrameRenderer.tsx`、`src/media/videoPlaybackOwnership.ts` 及测试。
  - scroll：`scrollSceneFrameStore.ts`、`ScrollSceneSlot.tsx`、`useScrollSceneSnapshots.ts`、
    `useNativeScrollController.ts`、`useScrollInputBindings.ts`、`DirectScrollCineView.tsx`、
    `SceneFixedLayer.tsx`、`sceneScrollRuntime.tsx`、`useScrollSceneEngine.ts` 及测试。
  - 动画：`StaggerContainer.tsx`、`useAnimateScroll.ts` 及测试。
  - 站点：`Scene5Cinema.tsx`、`scene5Lifecycle.ts`、`lastWinsTimerSequence.ts`、
    `BackgroundRibbon.tsx`、`usePrefersReducedMotion.ts` 及测试。
- 现场命令：`git status --short`、`git diff --stat`、`git diff --name-only`、
  `git log -5 --oneline`、相关文件 `git diff`/`nl -ba`/`rg`、`git diff --check`。
- 清洁检查：`git diff --check` PASS；临时性能 probe/flag 名称在 `src site examples` 中 0 命中；
  本轮重点文件中 `TODO|FIXME|HACK|XXX` 0 命中。
- 本 Agent 未把主 flow 记载的 120 suites / 1564 tests、type/lint/build 绿灯重新包装成独立验收；
  自动化与真实浏览器由另一独立验证 Agent负责。

## 原阻断逐项结论

| 原阻断 | 独立结论 | 代码证据 |
| --- | --- | --- |
| stale `media-ended` 污染新 source | 窄路径基本修复，但媒体 source 隔离只完成一半 | `VideoFrameRenderer.tsx:161-193,382-395,470-473` 给 ended 加 committed generation/activation gate；`handlePlay` 仍无同类 gate，见 finding 3 |
| active scroll Scene 连续值进入 React | 主视觉 lane 已移出 React，但 debug 与全量刷新仍有时序缺口；真实性能仍失败 | `ScrollSceneSlot.tsx:74-123,166-189,280-291`、`useScrollSceneSnapshots.ts:198-302`，见 findings 4-7 |
| BackgroundRibbon 容器换代/清理 | 代码级 PASS | `BackgroundRibbon.tsx:69-125` 的 detach/attach/reconcile/unmount 对称；未见第二个 LUT writer |
| Scene5 offscreen/transform/focus/replay | offscreen/focus/replay 有改进，但 transform 与阈值/重复消息未闭合 | `scene5Lifecycle.ts:116-159,224-234`，见 findings 1、2、6 |
| stagger batched settled revision | 代码级 PASS | `StaggerContainer.tsx:104-155` 用 revision token；同 phase 连续 MotionValue 不 setState；timer cleanup 对称 |
| 动态 reduced motion | 代码级 PASS | `usePrefersReducedMotion.ts:5-25` 订阅 modern/legacy API；全站旧 `PREFERS_REDUCED` 0 命中 |

## 对抗发现

### F1 - FAIL：Scene5 的精确 `0.85` 边界在 `finished` 与 `progress` 分支语义相反

- `site/src/components/scene5Lifecycle.ts:5-6` 声明 collapse 阈值等于 scrub start `0.85`。
- `progress` 分支在 `:157-160` 仅当 `value < 0.85` 才收列，符合主 flow“恰在 0.85 仍保持布局”。
- `finished` 分支在 `:121` 却使用 `event.progress > 0.85`。确定性反例：
  1. 初始 visible state 收到 `{type:'finished', progress:0.85}`；
  2. `shouldSplit=false`，reducer 返回 `closing=true, split=false`；
  3. 收尾层虽然挂载，却立即处于 collapsed/inert 布局，与同一数值的 `progress` 分支相反。
- 已有 `scene5Lifecycle.test.ts:74-81` 只测试“先以 progress=1 finished，再发送 progress=0.85”；
  没有测试 `finished(progress=0.85)`，所以绿灯不能覆盖该分支。
- 结论：阈值修复只改了一半，原问题未真正闭合。

### F2 - FAIL：`freezeScene5Element` 在取消 animation 后才读取 live computed values

- `site/src/components/scene5Lifecycle.ts:230-233` 先保存 `getComputedStyle()` 返回对象，随后写
  `element.style.animation='none'`，最后才读取 `computed.transform/visibility`。
- 浏览器返回的 computed-style 对象是 live resolved-style view；写 `animation='none'` 后读取
  `computed.transform` 可触发重算并得到取消动画后的静态 transform，而不是取消前的当前帧。
- 因而 unfinished 正发生在 delay/rise 中时仍可 snap；正确的所有权交接必须在任何 style 写入前
  先把 `transform` 与 `visibility` 字符串复制出来。
- `scene5Lifecycle.test.ts:50-61` 注入的是普通字面量对象，不具备 live 行为，无法推翻反例。
- 结论：主 flow 声称“先读取 computed transform 再摘 animation”与实际代码执行顺序不一致。

### F3 - FAIL：旧 source 的 native `play` 事件仍可夺取新 activation 的媒体 ownership

- `src/media/VideoFrameRenderer.tsx:161-193` 只为 native `pause/ended` 建立 generation + activation
  listener；`ended` 还通过 WeakSet 在 `:470-473` 统一约束 reducer 与 public callback。
- React `handlePlay` 在 `:461-466` 没有 source generation 或 activation token：它读取当前
  `pendingPlayRequestRef`，通常在 source reset 后为 `undefined`，然后派发无标签 `media-play`。
- reducer `src/media/videoPlaybackOwnership.ts:262-271` 对 `requestId===undefined` 无条件切换为
  `native-playback`。反例：source A 的 queued play event 在 source B commit/reset 后到达 retained
  `<video>`；事件被当前 React handler 接收，B 的 framework-scrub ownership 被改成 native-playback，
  当前 `onPlay` 也被错误调用。
- 测试覆盖 stale play Promise、带 requestId 的 stale play，以及 stale ended；未覆盖 retained DOM
  上“旧 source native play event 在新 source 后到达”。`handlePause` 的 public `onPause`（`:467-469`）
  同样没有 accepted-event gate，虽 reducer pause 已由 native listener保护。
- 结论：没有新增第二个 reducer，但存在未授权旧事件写入同一 owner，效果等价于时序污染。

### F4 - FAIL：scroll debug 的 imperative 值可被 React 用故意陈旧的 snapshot 覆盖

- `ScrollSceneSlot.tsx:74-123` 的 equality 有意忽略连续 progress 与 viewport offset。
- `:166-189` 的 layout effect 从 frame store 直接写 debug 属性，但依赖不含 React snapshot；
  effect 只在 debug/frameStore/sceneIndex 等改变时重跑。
- JSX 在 `:280-291` 仍声明同名的 `data-cineview-takeover-progress-px` 与
  `data-cineview-takeover-viewport-offset`，来源是可长期陈旧的 render snapshot。
- 反例：frame lane 已从 `10/100` 推到 `20/200`，随后父级只改变 `scrollCallbacks` 或 child identity
  触发 Slot render，而 render store仍保存复用的 `10/100` snapshot。React commit把 DOM 写回
  `10/100`；layout effect依赖不变，不会恢复，直到下一次 frame notification。
- `ScrollSceneStack.test.tsx:141-262` 只覆盖连续 frame 更新和关闭 debug，未覆盖“imperative 更新后
  发生非 frame 的父级 rerender”。
- 结论：上一轮指出的 stale debug 路径仍存在，只是连续更新的正向用例通过。

### F5 - FAIL：一次用户输入仍可让同一 native controller 同步两次，且已有性能反例未关闭

- wheel/touch/keyboard 经 `useScrollInputBindings.ts:33-43,51-74,100-115` 调用
  `applyNativeScrollDelta`。
- `useNativeScrollController.ts:448-460` 先 `scrollTo`，再立即 `syncNativeScrollState(true)`；
  容器又在 `DirectScrollCineView.tsx:496-504` 对随后到达的 native `scroll` 事件再次调用同一 sync。
- 每次 sync 会解析/分配 center-lock segments（`useNativeScrollController.ts:113-131`）、发布 zone/frame
  store（`:244-341`）、读取 scrollWidth/scrollHeight并尝试 React state（`:418-427`）。这不是第二个
  progress算法，但会重复执行同一热路径和通知链。
- wheel target 仲裁还会在每次输入沿祖先链执行 `getComputedStyle` 与 client/scroll 尺寸读取
  （`directScrollHelpers.ts:80-116`）；当前没有反事实证据证明它或 duplicate sync 对 53ms 样本无关。
- 独立读取原始 `report-scrollPerformance.json`：warm首页 wheel 有 `Long Task 53ms`、最大 frame 50ms，
  `performancePass=false`。源码没有修复或稳定反事实证明来关闭它。
- 结论：不能把“active Scene 不每像素 React render”扩写成“scroll 性能问题已解决”。

### F6 - FAIL：重复 `unfinished` 不是幂等，会无限延后 exit completion

- `scene5Lifecycle.ts:142-154` 只拒绝 `!closing/offscreen/freezePending`；没有拒绝已经
  `exitPending=true` 的同代重复消息。
- 第一个 unfinished 启动 1050ms exit sequence；第二个 unfinished 会增加 generation、cancel旧 sequence、
  再启动一个完整 1050ms sequence。持续重复消息可让收尾层永不完成。
- `Scene5Cinema.tsx:535-548` 注释明确承诺“重复消息幂等/last-wins”，但 reducer只实现 last-wins，
  没实现幂等。现有 lifecycle测试没有重复 unfinished 序列。
- 结论：失败/消息重复路径未覆盖，且实现语义与就近文档相反。

### F7 - 风险：frame store full update 先发布空帧，再逐 scene 发布新帧

- `useScrollSceneSnapshots.ts:198-203` 在 `forceFullUpdate` 时先
  `frameStore.setSnapshot([])`；之后 `:203-268` 才逐 key `setKeySnapshot(nextFrame)`。
- 所有订阅者会先收到 undefined，再收到新 frame。`useScrollSceneEngine.ts:257-263` 在空帧时走
  React fallback并可能写 controls/SceneState；随后又写最终 frame。即使同一 task 内不一定绘制空帧，
  也产生额外控制写入和可观察的中间状态，违背稳定 frame lane 的目标。
- `SceneFixedLayer.tsx:31-34` 对空帧直接 return，保留旧命令式 style；不同消费者对同一中间态
  采取不同策略。未见测试断言 full update 期间订阅者只观察一个原子新 frame。
- 结论：属于未覆盖的时序与重复工作风险；不是本报告判 FAIL 的唯一依据。

### F8 - 清洁/热路径：注释与实际发布成本不一致，Scene5 仍有陈旧语义文本

- `sceneScrollRuntime.tsx:8-19` 声称 approach keyed store在普通滚动中保持静默；实际完整 zone state
  每次 progress变化都会由 `useScrollZoneRegistry.ts:103-121` 发布，approach订阅者仍每帧收到
  external-store listener，只是 primitive snapshot相等时不 rerender。
- `Scene5Cinema.tsx:62-78,516-518` 仍写 collapse阈值 `0.90`、unfinished“只清 latch”等已过期描述，
  与 `0.85` 常量及当前 1050ms exit sequence冲突。
- 没发现本轮临时 probe/flag、旧 `PREFERS_REDUCED` 或显式 TODO 残留；BackgroundRibbon、
  reduced-motion、stagger模块本轮未发现确定性死代码。

## 六项明确回答

1. **修复是否真正解决原问题：否。** BackgroundRibbon、reduced-motion、stagger以及 narrow
   stale-ended路径代码级成立，但 Scene5 `finished(0.85)`、live computed-style freeze、scroll debug
   rerender与旧 native play事件证明整体修复未闭合。
2. **是否改变既有功能语义：是，且存在非预期变化。** 精确边界可把应保持 split的收尾层立即
   collapse；重复 unfinished会重置退出时钟；旧 play事件可把新 source从 scrub改为 native owner。
3. **是否引入第二个状态写者、竞态或时序回归：未发现第二套独立 progress计算器，但发现竞态/
   时序回归。** stale play是未标记输入写同一 ownership reducer；scroll同一输入触发 eager + native
   event双 sync；full frame refresh暴露空中间态；debug有 imperative/React两个 DOM属性写入路径。
4. **是否存在未覆盖失败路径：是。** 至少包括 `finished(progress=0.85)`、live CSSStyleDeclaration、
   重复 unfinished、source swap后的旧 native play/pause public event、imperative debug后父级 rerender、
   frame full refresh原子性，以及 duplicate sync/nested scroll guard的性能反事实。
5. **是否有死代码、重复逻辑或只修一半的分支：是。** Scene5阈值与 media terminal-event隔离均只
   修一半；scroll有重复 sync与同一 debug属性的双写路径；多处就近注释已与实现漂移。未发现临时
   probe/flag或旧 reduced-motion常量残留。
6. **最终结论：FAIL。** 这是由当前源码的确定性反例得出，不因测试/type/lint/build绿灯而改变；
   证据充足，因此不是 BLOCKED。

## 收口条件

- 统一 Scene5 `finished`/`progress` 边界并补 `finished(0.85)` 与重复 unfinished测试。
- 在任何 style写入前快照 computed transform/visibility，并以真实浏览器或 live-style seam验收。
- 给 native play与 public play/pause建立与 ended同源的 committed generation/activation gate。
- 消除 debug属性的 React/imperative双写，或确保每次 Slot commit后从最新 frame恢复。
- 让 full frame refresh原子发布；为 eager sync + native scroll sync建立可证伪测试/探针并关闭
  已记录的 warm scroll Long Task后，再由全新独立 Agent复审与浏览器验收。

VERDICT: FAIL
