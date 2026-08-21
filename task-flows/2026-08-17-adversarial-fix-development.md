# 2026-08-17 Adversarial Fix Development

## 目标

修复上一轮对抗复审确认的功能缺陷，保持 DESIGN.md 的状态唯一所有者、时间轴语义和 scroll/drag 性能约束；不把自动化绿灯当作真实交互验收。

## 输入证据

- 主审查：`task-flows/2026-08-16-adversarial-review.md`，最终 `VERDICT: FAIL`。
- 代码复审：`task-flows/2026-08-16-adversarial-review-code.md`。
- 独立验证：`task-flows/2026-08-16-adversarial-review-browser.md` 与 `task-flows/2026-08-16-adversarial-review-browser-fallback.md`。
- 当前基线：commit `4660d96` 之上的未提交工作树；本开发阶段不回滚用户已有改动。

## 节点

- [x] 1. 读取规格、失败证据并确认当前工作树
- [x] 2. 修复 video terminal-ended scroll 反向接管并补回归测试
- [x] 3. 修复 stagger phase 内普通 rerender 提前瞬时化并恢复 integration 覆盖
- [x] 4. 修复 releaseOnLeave 换源/配置切换恢复与 Scene5 timer last-wins 竞态
- [x] 5. 消除 scroll progress 的逐帧 React/effect 热路径回归（代码复审发现 infinite 消费者仍读旧快照，节点结论 FAIL）
- [x] 6. 处理站点动画所有权边界（BackgroundRibbon、TemporalMotion、Scene5）（代码复审发现未闭合，节点结论 FAIL）
- [x] 7. 定向测试、type-check、lint、build:verify、完整测试
- [x] 8. 独立代码复审与真实浏览器验收（旧报告仅作历史证据，需基于最新源码重跑）
- [x] 9. 节点级回读、自检与最终结论

## 节点 1：规格与现场

- 已重新核对 `DESIGN.md`、`CLAUDE.md`、`AGENT_SELF_REVIEW.md`、`AGENTS.md` 与主审查 flow。
- 已确认本阶段处理审查报告全部已确认 P1：terminal-ended scroll reverse、stagger premature settle、video residency recovery、Scene5 timer race、scroll hot-path React/effect churn；站点动画边界单列节点，不能在最终结论中静默略过。
- 本阶段禁止用新的全局状态写者绕过现有 owner；每个节点完成后立即回读本文件并记录自检。

### 2026-08-17 续跑现场复核

- 命令：`git status --short`、`git diff --stat`、`git diff --name-only`、`git log -5 --oneline`。
- 结果：基线为 `4660d96` 加 45 个 tracked path 改动及多批 untracked 证据；所有现有改动均按用户工作保留，不回滚。
- 三个旧实现 Agent（video、stagger、residency/Scene5）均因 HTTP 429 失败，无可继承的 PASS；仅 video Agent 可能留下部分补丁，按未审查代码处理。
- 已重新读取 `DESIGN.md`、`CLAUDE.md`、`AGENT_SELF_REVIEW.md`、`AGENTS.md`、本 flow 与 2026-08-16 主/代码审查报告。

## 节点 2：Video Terminal Reclaim

- 反馈环：当前 `git diff` 直接显示旧基线 `canReclaimTerminalState()` 仅接受 `frame.source === 'gesture'`；新增状态机反例覆盖显式 `scrubRange=[0,6]` 到端、native `ended` / `play-rejected`、0.99 endpoint jitter 与 0.6 反向离开 hysteresis。
- 规格回读：`DESIGN.md` 组件 3.5 明确允许新 `gesture`、`scroll`、`visibility` 重新接管 native owner。旧 Agent 残留补丁只加 `scroll`，回读后补齐 `visibility`，避免只修半个授权分支；`continuation` 与 `programmatic` 仍不能从 terminal 状态抢权。
- 实现：terminal 状态只有在位置驱动源离开 2% endpoint hysteresis 后恢复 `framework-scrub`，清除 endpoint latch 并 seek；重新到端后 request id 递增并可再次尝试原生播放。
- 命令：`pnpm test --runInBand src/media/videoPlaybackOwnership.test.ts`。
- 结果：1 suite，23 tests，全部通过；scroll/visibility × ended/play-rejected 四个反例均实际执行。
- 格式/残留：`pnpm exec prettier --write ...` 完成；`git diff --check -- src/media/videoPlaybackOwnership.ts src/media/videoPlaybackOwnership.test.ts` exit 0；全仓搜索未发现第二份 terminal reclaim 判定。
- 状态所有权自检：没有新增状态字段或写者；仍由纯 reducer 独占 ownership 状态，媒体命令仍只由 reducer 输出。没有 React state、layout read、逐帧对象层级或 effect 变更。
- 行为自检：endpoint jitter 不 seek；反向 seek 精确到 3.6s；stale/native request token、离场 pause 与 continuation 语义未放宽。节点级结论：PASS（仍须节点 8 独立浏览器反向验收）。

### 节点 2 Agent 记录

- 新启动的三个并行实现 Agent 均在执行前因 HTTP 429 超过重试上限而失败，没有可继承的修改或结论；主线程基于当前工作树继续，最终独立复审/验收 Agent 将重新创建。

## 节点 3：Stagger Completion Ownership

- 红证命令：先运行 `pnpm test --runInBand src/components/Animate/StaggerContainer.test.tsx`，新增真实挂载 probe 在旧 `useSettledInstant()` 下失败：同一 `animate` phase 的普通父级 rerender 立即把 child 3 从 `{duration:0.4, delay:0.08}` 变成 `{duration:0, delay:0}`。
- 实现：删除 render 中读写 `prevRef` 的连续 phase 判定；新增 `useStaggerSettled(phase, effectiveDurationMs)`，仅在 phase 进入 `animate` 时启动一次按有效 group 时长（含 stagger tail）的 timer，phase 离开时清理/复位。variant/children 普通 rerender 不重置 timer；`Animate` 传入已有 memoized `staggerTiming.effectiveDurationMs`，fallback helper 只供独立组件调用。
- 覆盖恢复：通过 `git show HEAD:src/components/Animate/StaggerContainer.test.tsx` 内容经 `apply_patch` 恢复原有 `renderStaggerTree`、`ScrollStagger`、`DragStagger` 分支测试，再加入 mock MotionTag 的真实挂载测试。
- 新反例：Scroll 普通 rerender 在 group 完成前保持 authored duration/delay；Scroll 离开并重新进入 animate 会重新计时；Drag MotionValue 改变但 phase 仍 animate 不会瞬时化。有效时长按 400ms item + 80ms tail = 480ms 验证。
- 命令与结果：
  - `pnpm test --runInBand src/components/Animate/StaggerContainer.test.tsx`：1 suite，20 tests PASS。
  - `pnpm test --runInBand src/components/Animate/Animate.test.tsx src/components/Animate/Animate.renderprop.test.tsx src/components/Animate/Animate.semantic-bridge.test.tsx src/components/Animate/animateVariantsPending.test.tsx`：4 suites，122 tests PASS。
  - `pnpm exec prettier --write ...` 完成；相关 `git diff --check` exit 0。
- 节点级回读/自检：全仓目标范围无 `useSettledInstant`、`prevRef.current =` 或重复 completion writer；timer 是每次 phase 至多一个且 cleanup 完整，不触碰 progress/elementElapsedMotion/dragRelease owner，也不在 scroll 每帧 setState（只响应 phase 迁移与一次 completion）。`StaggerContainer.tsx` 349 行、Animate 既有 964 行，未再向 Animate 拆入职责。节点结论：PASS（真实滚动多元素性能仍由节点 8 验收）。

## 节点 4：Video Residency 与 Scene5 Timer Ownership

### Video residency

- 原始红证：`release()` 设置 `released=true` 后，旧 `[src]` effect 不复位；旧 approach effect 在 `releaseOnLeave=true -> false` 且仍为 `far` 时提前 return。当前 diff/代码回读确认两条失败路径均可达。
- 实现：renderer 以 `released && objectUrlState.src === src` 判断当前源的 release 状态，源代际首帧立即恢复 raw/object URL；`src` effect 同步清 `released`、递增 `mediaEpoch`、reset playback ownership。`release()` 无论 video ref 是否存在都先 reset ownership；lease 仍只在 source/unmount 释放。
- AnimateVideo residency owner 接收 `src`，每个 source generation 清零 `scrubbedOnceRef`；只依赖稳定 `timeline.progress` MotionValue，不依赖每次 render 变化的整个 timeline 对象。关闭策略时即使 `approach` 已为空/far 也调用 `warmUp()`；初始 disabled 不做无意义 warm-up。
- 反馈环/命令：
  - 新测试先在旧逻辑下红：挂载 control 后 release `/a.mp4`、换 `/b.mp4`，以及 far 状态由 true 切 false；随后修复。
  - `pnpm test --runInBand src/media/VideoFrameRenderer.test.tsx`：1 suite，30 tests PASS（含 released source swap、object URL lease、metadata re-seek）。
  - `pnpm test --runInBand src/components/Animate/AnimateVideo.plumbing.test.tsx src/components/Animate/AnimateVideo.test.tsx src/media/VideoFrameRenderer.test.tsx`：3 suites，37 tests PASS；含 far toggle warm-up 与 source generation 不继承 scrubbed eligibility。

### Scene5 timer race

- 原始反例：unfinished A → unfinished B → A completion 清空共享 ID 数组 → finished 重开 → B completion 仍能关闭新 closing 层。旧 `splitExitTimersRef` 已从代码中删除。
- 实现：新增 `site/src/components/lastWinsTimerSequence.ts`，每次 `start/cancel` 增加 generation，任务和 completion callback 都校验 active generation；Scene5 的 finished、unfinished、freeze、unmount 均先取消旧序列，unfinished 每次重建一个唯一 last-wins sequence，回调按 class 查询当前节点。
- 测试：`pnpm test --runInBand src/__tests__/site/lastWinsTimerSequence.test.ts`：1 suite，2 tests PASS。第一例故意让 `clearTimeout` 不取消队列，执行 unfinished A/B、finished/cancel 后推进 2s，A/B stale completion 均未写状态；第二例确认最新 B 可独立完成。
- 静态：`pnpm type-check:site` 与 `pnpm type-check` 均 exit 0；相关 `git diff --check` exit 0；`rg` 未发现 `splitExitTimersRef` 残留。
- 节点级自检：视频状态写者仍为 renderer ownership reducer + residency control handle，未新增逐帧 writer；source/epoch 更新仅发生在源或策略边界。Scene5 现在只有一个 finite timer sequence owner，freeze timers 与 exit sequence 分离且互相取消，不会由旧 generation 关闭新状态。节点结论：PASS（P2 的 CSS/Animate 多动画边界留给节点 6，真实交互留给节点 8）。

## 证据日志

（每个节点完成后追加命令、Agent 报告、失败案例和回读结果。）

## 节点 8：独立验证 Agent 证据（2026-08-17）

- 独立报告：`task-flows/2026-08-17-adversarial-fix-browser.md`。
- 定向测试：28 suites / 515 tests PASS。
- 完整测试：`pnpm test --runInBand`，115 suites / 1537 tests PASS。
- 静态验证：`pnpm type-check`、`pnpm type-check:site`、`pnpm lint` 均 exit 0。
- 构建：`NPM_CONFIG_CACHE=/private/tmp/cineview-adversarial-npm-cache pnpm build:verify`，14/14 checks PASS；浏览器使用的 dist 已重新生成。
- 站点启动尝试：`pnpm --dir site dev --host 127.0.0.1 --port 4000`，失败 `listen EPERM: operation not permitted`；已有 PID 32564 端口占用状态在 sandbox 内无法连通。
- Standalone Playwright launch probe：Chromium 因 `MachPortRendezvousServer ... Permission denied (1100)` 退出；提权请求被平台审批模型拒绝。
- In-app Browser：安全策略拒绝访问 `http://localhost:4000`，并明确禁止改用 127.0.0.1、CDP 或其他间接通道。
- 因此 scroll/drag 正反向、取消/重抓、大 flick、键盘、scrollbar、多元素长任务与视频 release/source-swap/ended-reverse 均无真实浏览器证据；截图/性能探针为空。该节点执行完毕但结论为 **BLOCKED**，不能把自动化绿灯升级为视觉 PASS。
- 额外静态探针命中未收口边界：`BackgroundRibbon.tsx` 仍有写 DOM CSS 变量的 `requestAnimationFrame`（规则仅豁免 canvas 自绘）；`TemporalMotion.tsx` 仍直接 import `useReducedMotion` from `framer-motion`。`Scene5Cinema.css` 未命中 `animation: ... infinite`，但 timer/inline animation owner 未有真实浏览器证据。详见独立报告。
- 节点级自检：测试与构建证据可回读；真实交互证据缺口已逐项列出，未猜测行为结果。

## 节点 5/6：独立代码对抗复审（2026-08-17）

- 独立报告：`task-flows/2026-08-17-adversarial-fix-code.md`，结论 **FAIL**。
- 定向回读确认：`DirectScrollCineView` 的 TimelineContext 生产值只有 keyed `store`，但 `useAnimateScroll.ts:1085-1148` 的 infinite effect 仍读取 `zoneRuntime.zoneStates[zoneId]`；`Animate + enterAnimation + infiniteAnimation` 的真实 scroll lane 因此不会启动或随 exit 边界停止。现有测试 fixture 手工填充 `zoneStates`，未覆盖该 provider 形状。
- Scene5 freeze 700/1400ms callback（`site/src/components/Scene5Cinema.tsx:497-536`）仍只有 `clearTimeout`，没有 generation guard；已入队的旧 callback 可在 re-enter/finished 后重置新 closing 状态。`lastWinsTimerSequence` 只保护 unfinished sequence，不能证明 freeze owner 已收口。
- 规则边界：`BackgroundRibbon.tsx:38-89` 仍为 DOM CSS-variable rAF，`TemporalMotion.tsx:1` 仍直导运行时 `framer-motion`；均违反 `CLAUDE.md/AGENTS.md` 规则 6，未见 waiver。Scene5 unfinished 路径在 `Scene5Cinema.tsx:453-466` 先摘 CSS animation fill、再延迟写 opacity，存在 delay 内闪回风险。
- 本 Agent 未修改生产代码；执行 `git diff --check`（通过）及 4 suites/119 tests 定向 Jest（通过）。这些绿灯不覆盖上述 provider/timer 反例。
- 节点级回读：修复并未完整解决原问题，改变了 scroll infinite 和 Scene5 freeze 的时序语义；发现旧 `zoneRuntime.zoneStates` 消费与新 store/MotionValue 消费重复并只修一半。真实浏览器/长任务证据仍由独立验证报告标为 BLOCKED。

## 最终结论

最终证据与结论见文件末尾“节点 8：最新独立复审与验收”和“节点 9：最终回读与结论”。

## 节点 5/6 续记：主线程补丁后的独立回读（2026-08-17）

- 回读时间点：主线程已修改 `useAnimateScroll.ts` 的 infinite gate、`Scene5Cinema.tsx` 的 freeze generation 和 unfinished visibility 处理后；本 Agent 未修改生产代码。
- F1 原始 provider 快照缺陷：**已修补**。`updateInfiniteState` 现在消费 `zoneStateMotion` 并以 `infiniteStateRef` 去重，连续 progress 不再每帧触发 React state；需补真实 provider 形状测试/浏览器验收。
- F2 原始 stale freeze callback：**generation guard 已补**，但 `cineview-embed-finished` 分支（`Scene5Cinema.tsx:441-453`）没有调用 `clearSplitTimers()`。延迟 finished 在 freeze pending 时仍可被 1400ms callback 清回 idle，节点仍 FAIL。
- 新回归：unfinished 分支（`Scene5Cinema.tsx:458-484`）同步将四个元素设为 `visibility:hidden`，后续 delay callback 只重复同一写入；原定 footer→CTA→subtitle→title 的错峰退场被改成瞬时隐藏。该变化已写入独立报告 F5，节点仍 FAIL。
- 规则边界未收口：`BackgroundRibbon` DOM rAF、`TemporalMotion` runtime framer import；真实浏览器/性能证据仍为 BLOCKED。
- 立即自检：重新回读独立报告与本 flow，确认 F1/F2 原结论已按最新代码修正，最终不能写 PASS。

## 节点 5/6：当前源码再回读与测试探针修正（2026-08-17 续跑）

- 重新回读 `useAnimateScroll.ts`、`Scene5Cinema.tsx`、`BackgroundRibbon.tsx`、`TemporalMotion.tsx` 后，确认上一段独立报告存在时间点滞后：
  - `updateInfiniteState` 当前从 `zoneStateMotion`（keyed store）消费，生产 provider 只有 `store` 时不再依赖空 `zoneStates` 快照；连续 progress 只更新 MotionValue，布尔门控跨阈值才触发一次 React state。
  - `cineview-embed-finished` 当前已调用 `clearSplitTimers()`，会使 pending freeze sequence 失效；unfinished 路径保留计算出的 visibility，摘除 animation 后按 footer→CTA→subtitle→title 的 manual-opacity 延迟写入，不再同步把四项设为 hidden。
  - `BackgroundRibbon` 当前没有 `requestAnimationFrame`，改为 scroll/ResizeObserver/MutationObserver 量化 CSS 变量投影；`TemporalMotion` 当前没有运行时 `framer-motion` import，改为 `useSyncExternalStore` 订阅 prefers-reduced-motion。旧报告中的这三项命中不能继续作为当前结论。
- 重现命令：`pnpm test --runInBand src/components/Animate/useAnimateScroll.hotpath.test.tsx`。原测试在进度 100 处把离散 `shouldRunInfinite` 门控的一次结构性 rerender 误判成逐帧回归（Expected 1, Received 2）；回读 hook 后确认 50/75 进度不重渲染、跨 enter 阈值允许一次重渲染。
- 测试修正：`useAnimateScroll.hotpath.test.tsx` 增加 75 进度连续帧断言，将 100 进度断言改为 `settledRenderCount + 1`，并补齐 `ParsedAnimationVariant.exit` 与 JSX 返回值类型。
- 最新结果：hot-path suite 2/2 PASS；`useAnimateScroll.phase.test.tsx` 44/44 PASS；`pnpm type-check` exit 0。
- 节点级自检：测试只放宽了规格允许的离散门控更新，没有隐藏连续帧 rerender；生产代码未因测试修正增加状态写者或热路径运算。需待最新独立 Agent 报告、完整测试/构建和真实浏览器证据后再改变节点 7–9 状态。

## 节点 7：最新自动化与构建门禁（2026-08-17 续跑）

- 定向测试：
  `pnpm test --runInBand src/components/Animate/useAnimateScroll.hotpath.test.tsx src/components/Animate/useAnimateScroll.phase.test.tsx src/components/Animate/Animate.test.tsx src/components/Animate/AnimateVideo.plumbing.test.tsx src/components/Animate/AnimateVideo.test.tsx src/components/Animate/StaggerContainer.test.tsx src/components/Animate/animateVariantsPending.test.tsx src/components/Animate/useAnimateManualControl.test.tsx src/components/Scene/sceneScrollRuntime.test.tsx src/components/Scene/sceneScrollApproach.test.ts src/components/CineView/useScrollSceneSnapshots.test.tsx src/media/VideoFrameRenderer.test.tsx src/media/videoPlaybackOwnership.test.ts src/__tests__/site/lastWinsTimerSequence.test.ts`
  → 14 suites / 263 tests PASS。
- 完整测试：`pnpm test --runInBand` → **116 suites / 1541 tests PASS**。
- 类型与静态：`pnpm type-check` PASS；`pnpm type-check:site` PASS；`pnpm lint` PASS；`git diff --check` PASS。
- 构建：首次裸跑因本机 `~/.npm` root-owned cache 只完成 13/14；随后使用
  `NPM_CONFIG_CACHE=/private/tmp/cineview-adversarial-npm-cache pnpm build:verify`，dist 重新生成，**14/14 checks PASS**（ESM gzip 43.53 KB、UMD 51.81 KB、drag 41.93 KB、scroll 46.15 KB）。
- 节点级回读：完整测试涵盖新增 keyed-store hotpath、Scene5 last-wins helper、video ownership/residency 和 stagger 回归；没有通过失败注入或忽略测试来制造绿灯。构建验证读取的是本次源码刚生成的 dist，不继承旧产物。节点 7：PASS；仍不能替代真实浏览器证据。

## 节点 8：最新独立复审与验收（2026-08-17 收口）

### 独立代码对抗复审

- Agent：`/root/code_adversary_final`；站点专项子审查：`/root/code_adversary_final/site_focus`。两者均未修改生产代码。
- 报告：`task-flows/2026-08-17-adversarial-fix-code-latest.md`；基于当前源码重新推导，明确剔除了旧报告中的 BackgroundRibbon rAF、TemporalMotion framer import、空 `zoneStates` infinite gate 和 finished 未清 timer 等过期结论。
- Agent 结论：**FAIL**。
- 已确认原问题修复：released video 换源/策略恢复、普通 stagger rerender、keyed-store `Animate` 消费和 duplicate unfinished timer 的直接反例已修复。
- 当前 P1 阻断：原生 `media-ended` 未携带 activation/source token，可由旧媒体事件污染新 source；active Scene snapshot 仍随连续 progress 跨 React 渲染链；BackgroundRibbon 同 pathname 容器换代丢 listener 且 root inline LUT 变量不清；Scene5 offscreen finished 会取消唯一 freeze；unfinished 摘 animation 未冻结 transform；收拢后 CTA/footer links 仍可 Tab；`.95` 重开不重播四拍串行入场。
- 既有 P2：PhoneMockup 在模块加载时静态读取 reduced-motion；settled stagger 的同步 `exit -> animate` 批处理边界缺覆盖。两项未被伪装成本轮新回归。
- 本 Agent 命令：定向 Jest 5 suites / 78 tests PASS；`pnpm type-check`、`pnpm type-check:site`、`git diff --check` PASS。绿灯不覆盖上述反例。

### 独立真实浏览器验收

- Agent：`/root/validation_final`，未读取代码 Agent 报告后代签结论，独立运行自动化和真实 Chromium；报告：`task-flows/2026-08-17-adversarial-fix-browser-latest.md`。
- 自动化：定向 29 suites / 519 tests PASS；完整 116 suites / 1541 tests PASS；`pnpm type-check`、`pnpm type-check:site`、`pnpm lint` PASS；临时 npm cache 下 `pnpm build:verify` 14/14 PASS，dist 为本轮源码重建产物。
- 核心 scroll acceptance：正向 `0 -> 100%`、反向 `100% -> 0`、touch、keyboard、native、scrollbar、多 zone 倒序、大 flick 段内帧均 PASS；console/page error 0，fixture Long Task 0。
- 核心 drag acceptance：tap 不获权、pointer cancel、bounce 中途重抓、rush re-grab 冻结并续播、正向 commit、反向边界阻止均 PASS；console/page error 0。
- 实际 `/drag` 五幕：真实 CDP touch 完成 `0 -> 1 -> 2 -> 3 -> 4 -> 3`，功能 PASS；截图/DOM/探针位于 `output/playwright/2026-08-17-adversarial-fix/`。
- 性能反例：冷启动样本清零后，warm 交互仍捕获 **53ms / 131ms Long Task**，最大 rAF gap **283.2ms**，11 个间隔超过 32ms、7 个超过 50ms。证据：`output/playwright/2026-08-17-adversarial-fix/site-five-act-report.json`（mtime 2026-08-17 05:33:52 +0800）。性能结论：**FAIL**。
- 站点专项未在 cutoff 前执行：BackgroundRibbon 换代、Scene5 offscreen freeze/finished、collapsed CTA focus、unfinished transform、动态 reduced-motion；独立 Agent 明确标为 **BLOCKED**，未把缺证据写成 PASS。
- 本轮服务清理：已停止验收使用的 4000/4318 服务；`lsof` 复核 4000、4317、4318 无 listener。所有 Agent 均 completed，无后台 Agent 遗留。

### 节点 8 回读与自检

- 两名独立 Agent 分工成立：代码 Agent 明确回答原问题、语义变化、状态写者/竞态、失败路径、死/重复/半修分支并给出 FAIL；验证 Agent 独立运行命令和浏览器并给出 FAIL。
- 正向功能证据充分，但不能推翻媒体代际、Scene 生命周期、可访问性和 warm 性能反例；缺失的站点专项继续保持 BLOCKED，不影响已有确定性 FAIL。
- 节点 8 结论：**FAIL**。

## 节点 9：最终回读、自检与结论

- 是否真正解决原问题：**部分解决，整体否**。video reverse reclaim、residency、stagger ordinary rerender 和 keyed-store hook 已闭合；媒体 native event 代际隔离、完整 scroll React 热路径与 Scene5 lifecycle 未闭合。
- 是否改变既有功能：**是**。BackgroundRibbon 在同路由换容器后停止跟随、颜色跨路由残留；Scene5 可能离屏常驻、变换瞬跳、隐藏链接可聚焦、重开跳过串行动画。
- 是否引入第二状态写者/竞态/时序回归：未发现第二个 scroll progress/currentTime 写者；但无 token `media-ended`、IntersectionObserver/iframe message/freeze timer 交叉以及 CSS/JS 时钟仍构成竞态和时序回归。
- 是否存在未覆盖失败路径：**是**。代码报告列出的媒体/Scene/BackgroundRibbon 反例无专测；五个站点专项浏览器路径保持 BLOCKED。
- 是否有死代码、重复逻辑或只修一半：scroll 优化只收敛 `Animate` hook，父 Scene 仍逐帧进入 React；媒体只为 play promise 做 token，native ended 半修；Scene5 重开所有权注释互相矛盾。
- 性能：真实 warm 五幕交互已有 131ms Long Task 与 283.2ms rAF gap，不能满足运行时每帧效率要求。
- 最终回读：重新读取两份 latest 报告、两份 JSON 证据、当前源代码和本节点；自动化 PASS、核心功能 PASS、站点性能 FAIL 与代码 FAIL 的边界一致，无证据冲突被隐去。

## 最终结论（2026-08-17）

VERDICT: FAIL
