# 2026-08-17 Adversarial Fix Code Review

## 角色与范围

- 角色：全新独立代码对抗复审 Agent；不把验证 Agent 的结论当作代码审查结论。
- 工作目录：`/Users/alienmu/Documents/alien/cineView/cineview`。
- 基线：commit `4660d96` 加当前未提交工作树；未回滚或修改生产代码。
- 规格依据：`DESIGN.md`、`CLAUDE.md`、`AGENTS.md`、`AGENT_SELF_REVIEW.md`。
- 审查命令：初始 `git status --short`、`git diff --stat`、`git diff --name-only`、`git log -5 --oneline`；本 Agent 另执行 `git diff --check`、目标文件回读、`rg` 静态探针，以及：
  `pnpm test --runInBand src/components/Animate/useAnimateScroll.hotpath.test.tsx src/components/Animate/Animate.test.tsx src/components/Scene/sceneScrollRuntime.test.tsx src/components/Scene/sceneScrollApproach.test.ts`。

## 原始问题与修复范围

本轮声称修复的范围包括：scroll 进度跨 React/effect 热路径、scroll 视频 terminal-ended 反向接管、video residency 换源/策略恢复、stagger 普通 rerender 提前瞬时化、Scene5 unfinished timer last-wins。当前 diff 还包含站点背景色带、Scene5 收尾层和 temporal-drag 组件变更。

## 代码对抗复审

### F1 [P1]（已修补，需回归确认）scroll infinite 门控已改为 keyed MotionValue

证据：

- `src/components/CineView/useScrollZoneRegistry.ts:247` 的 `zoneTimelineValue` 只提供 `{ store }`。
- `src/components/CineView/DirectScrollCineView.tsx:485-486` 将这个值作为 `SceneScrollTimelineContext` provider；生产路径没有提供 `zoneStates` 快照。
- `src/components/Animate/Animate.tsx:524-534` 因此给 `scrollZoneRuntime` 合成的是 `zoneStates: {}`，虽带有 keyed `store`。
- 主线程最新改动 `src/components/Animate/useAnimateScroll.ts:1085-1175` 新增 `infiniteStateRef`、`updateInfiniteState`，并订阅 `zoneStateMotion`；连续帧只在布尔门控跨阈值时调用 `setShouldRunInfiniteState`。

原反例的控制流已被这个订阅修复：生产 provider 只有 `store` 时也能从 `zoneStateMotion` 取得 budget/progress，并在 enter/exit 跨越时更新门控。仍需补真实 provider 形状的回归测试和浏览器验证；当前定向 fixture 仍手工填充 `zoneStates`，不能单独证明生产路径。

节点结论：代码层 **PASS-with-follow-up**。没有发现第二个 progress owner；MotionValue callback 每帧执行计算，但 React state 只在离散门控变化时写入。

### F2 [P1]（已修补，仍有取消遗漏）Scene5 freeze/unmount timer generation

主线程最新改动 `site/src/components/Scene5Cinema.tsx:328-349,504-550` 新增 `freezeGenerationRef`；`clearSplitTimers()` 递增 generation，两个 callback 首行校验，1400ms callback 还会使 sibling callback 失效。该部分已补上 stale queued callback 守卫。

剩余反例：离开视口后排队 freeze A；在仍未重新 intersect 时收到延迟的 `cineview-embed-finished`。`site/src/components/Scene5Cinema.tsx:441-453` 的 finished handler 只调用 `cancelSplitExit()`，没有调用 `clearSplitTimers()`，所以 A 的 generation 仍有效；A 的 1400ms callback 仍可将新 opening/stage 重置为 idle。finished/unfinished 都应明确取消或拒绝旧 freeze generation。

### F3 [P2] BackgroundRibbon 是未受 phase 约束的 DOM rAF

证据：`site/src/components/BackgroundRibbon.tsx:38-89` 在 scroll listener 中调 `requestAnimationFrame`，每帧读取 `scrollHeight/clientHeight` 并向 `:root` 写四个 CSS 变量（`65-60`）；没有 `useAnimateTimeline()`、phase/idle gate，也不是 canvas 自绘。

这违反 `CLAUDE.md:231-236` / `AGENTS.md:229-234` 的硬规则：自建 rAF 仅豁免 phase-gated canvas。它还把全局样式写入放在 scroll 热路径，可能放大整页 style/repaint 成本。若这是有意的全局背景机制，当前工作树没有规格级 waiver 或独立性能证据，不能标记为合规。

### F4 [P2] TemporalMotion 直接导入运行时 framer-motion

证据：`site/src/components/temporal-drag/TemporalMotion.tsx:1,25-36` 直接调用 `useReducedMotion`。`CLAUDE.md:233` 明确禁止站点组件直接 import runtime framer-motion；当前没有通过框架出口提供该能力的适配说明。即使该 hook 不是每帧驱动，也仍是明确的边界违规。

### F5 [P1] Scene5 unfinished 路径当前改成瞬时隐藏，错失原有错峰退场语义

主线程为避免 CSS fill 闪回，最新代码在 `site/src/components/Scene5Cinema.tsx:458-466` 对四个元素同步写 `visibility='hidden'`，再摘掉 animation；后续 `SPLIT_EXIT_DELAYS_MS` callback（`467-484`）仍只重复写 `visibility='hidden'`。

反例：finished 后任意时刻收到 unfinished。四个节点在同一 JS task 被设为 `visibility:hidden`，因此 footer→CTA→subtitle→title 的 0/150/350/550ms 错峰退场不再发生；所谓 sequence 只重复同一个隐藏写入。这个补丁消除了闪回，但改变了已声明的有序退场功能语义。若要同时保留首帧安全，应先把当前 computed opacity 固定到 inline，再摘 animation，并在各自 delay 到期时把 opacity/visibility 置为终态。

### F6 [P1] finished 消息未取消仍在等待的 freeze generation

证据：`site/src/components/Scene5Cinema.tsx:441-453` 的 finished 分支调用 `cancelSplitExit()`，但没有 `clearSplitTimers()`；generation 只在 freeze timer 清理、re-enter 或 unmount 时递增。

反例：IntersectionObserver 先报告离开并排队 700/1400ms freeze；iframe 的 finished 消息随后到达（消息队列延迟或边界时序），handler 重开 `closing/split`，但 1400ms callback 仍通过当前 generation 检查并把 stage/closing 清回 idle。该路径没有回归测试，必须在 finished/unfinished 到达时取消 freeze owner 或明确丢弃消息。

## 逐项回答

- 修复是否真正解决原问题：video terminal reclaim、video source/residency、stagger completion、scroll infinite 数据源和 freeze stale callback 的原始反例已有代码级修补；但 finished→freeze 取消遗漏和 unfinished 错峰语义回归仍未解决。因此整体答案：否。
- 是否改变既有功能语义：是。最新 Scene5 补丁把原本错峰的 unfinished 退场变成四元素同步隐藏；finished 在 freeze pending 时仍可能被旧 callback 清理。
- 是否引入第二个状态写者、竞态或时序回归：scroll progress 仍由 controller→store→MotionValue 单链写入，未发现第二个 owner；Scene5 仍有 CSS animation、Animate wrapper 和 JS visibility/timer 三层写者，且 freeze generation 与消息 owner 尚未完全统一。
- 是否存在未覆盖失败路径：存在。真实 provider 形状的 infinite、finished/unfinished 与 freeze 交叉时序、unfinished delay 内退场、BackgroundRibbon 与多元素并发滚动性能均缺真实浏览器/专测证据。
- 是否有死代码、重复逻辑或只修一半的分支：`SPLIT_EXIT_DELAYS_MS` 的 delay callback 在当前 visibility 实现下只重复同一隐藏写入，变成近似死/重复逻辑；freeze generation 只在部分消息路径取消。

## 自动化证据

- `git diff --check`：通过。
- 定向 Jest：4 suites / 119 tests 通过（`Animate`、hotpath、scene runtime、approach）；主线程新增代码后的完整重跑尚未由本 Agent 执行。这证明既有测试契约，但没有覆盖 F5/F6。
- 独立验证 Agent 另报告完整测试、type-check、lint、build:verify 通过；该报告同时记录真实浏览器无法启动/访问，因此不作为本代码结论的替代。

## 结论

FAIL
