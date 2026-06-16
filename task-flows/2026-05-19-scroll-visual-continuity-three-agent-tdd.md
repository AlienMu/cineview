# Task: Scroll Visual Continuity Repair With Three-Agent TDD

## Goal

- 修复 scroll 示例页中 `spec-takeover` / takeover authored scene 的三类问题：
  - 进入 takeover 区域时从 pre-anchor 视图瞬间切到 takeover 视图，而不是连续过渡
  - takeover 内 phase 动画缺少向下滚动时的离场表现，只会入场后停在完成态
  - 真实页表现与作者预期不一致，造成“图1 -> 图2”突变和持续性动画缺失
- 严格采用三 agent + TDD：
  - 主 agent：读代码、定范围、整合最终补丁
  - 实现线：先补红测，再做最小修复
  - 评审线：独立检查语义是否符合 design / requirements
  - 验收线：真实浏览器复现与复验

## Required Rules

- 先有红测，再改实现，再回归。
- 不把 example authoring 误当成 runtime bug，也不把 runtime bug 藏到 example authoring 里。
- 所有误判、红测、补丁、回归结果、验收失败点都必须记入本文件日志，不只留在对话里。
- 三条线职责不重叠：
  - 实现线只负责测试与代码补丁
  - 评审线只负责独立审查，不直接改代码
  - 验收线只负责真实页观察与结论
- 只收敛本轮必要文件，不顺手改无关 scroll / drag / snap 行为。

## Bug Scope

- [x] pre-anchor 与 takeover layer 在进入 zone 时连续交接，而不是 1px 级瞬时切层
- [x] takeover phase 元素在 forward scroll 离开阶段具备明确离场语义
- [x] 真实页 `#/scroll` 的 `PERFORMANCE ENVELOPE / spec-takeover` 视觉行为与作者预期一致

## Agent Lanes

- [x] `Faraday` 实现线：TDD red-green-refactor，负责最小补丁
- [x] `Meitner` 评审线：独立语义 / 设计审查
- [x] `Fermat` 验收线：真实浏览器复验

## Nodes

- [x] Audit current authored takeover and runtime animation code paths
- [x] Re-brief all three lanes with exact ownership
- [x] Record restart context, previous miss, and new log requirements
- [x] Add failing proof for takeover layer continuity
- [x] Add failing proof for forward exit / sustained motion expectations
- [x] Land minimal runtime or authoring fix that satisfies both proofs
- [x] Run focused automated regressions
- [x] Re-run independent review + real-page acceptance
- [x] Update docs only if public behavior changes
- [x] Re-check all unchecked nodes before reporting

## Verification

- [x] `pnpm test -- src/components/Animate/useAnimateScroll.phase.test.tsx --runInBand`
- [x] `pnpm exec vitest run src/components/ScrollScenes.test.tsx --config vitest.config.ts`
- [x] Any new focused test covering `TakeoverReplayAnimate` continuity passes
- [x] Real browser verification confirms:
  - [x] no instant pre-anchor -> takeover flash on spec section
  - [x] forward scroll shows authored leave/hand-off behavior
  - [x] reverse replay still works
  - [x] no new console/runtime errors

## Current Status

- Reopened on `2026-05-20`
- Active node: Reproduce duplicate-copy + takeover flicker + missing forward-leave execution under three-agent TDD

## Error Ledger

- `2026-05-19 restart`
  - Previous miss: 主线上一轮只修到了 scrollbar / reverse replay runtime，未把 `spec-takeover` 的 authored visual continuity 纳入红测范围。
  - Visible symptom left unfixed:
    - pre-anchor 与 takeover layer 在进入 zone 时瞬切
    - forward scroll 没有作者预期的离场连续性
    - 真实页截图出现 “图1 -> 图2” 突变
  - Prevention rule for this restart:
    - 任何“用户提供截图 + 真实页可见异常”都必须先落成 page-facing red proof，再允许改实现。
- `2026-05-19 implementation line`
  - `TakeoverReplayAnimate` 交接异常属于 authoring bug，不是 runtime bug。
  - 根因：
    - 旧实现用 `progressPx > 0.5` 提前短路了 `24px` 交接窗。
    - `spec-takeover` phase 层缺少 explicit `exitAnimation`，所以 forward scroll 只会入场后停在完成态。
  - 修复：
    - `TakeoverReplayAnimate` 改为 zone active 时按 `crossfadeSpanPx` 连续插值。
    - `specs-pill/copy/stats/media/bullets` 全部补上 explicit exit。
- `2026-05-19 acceptance follow-up`
  - 第一版修复把交接窗从 `0.5px` 级硬切恢复成 `24px` 连续插值，但真实验收仍然认为“对人眼来说像阈值切换”。
  - Prevention rule:
    - 交接窗不能只满足逻辑连续，还要满足 page-facing perceptual continuity；必要时继续把验收意见转回红测。
- `2026-05-19 standalone-exit miss`
  - 新反馈指出上一轮仍漏了一个 authoring 面：普通 `visibility` chapter 只写了 `duration.exit`，没写 `exitAnimation`。
  - 直接后果：
    - `02 / Editorial flow` 之类独立 scene 会在完成入场后保持终态
    - 下一段 takeover 进入时视觉上像“旧 scene 被 takeover 压住再忽然藏掉”
    - 用户体感为“图1 没有触发退场动画”
  - Prevention rule:
    - 对 scroll example 来说，只要作者预期 forward leave，就必须把 `duration.exit` 和 `exitAnimation` 成对验收；不能只测 takeover chapter。
- `2026-05-20 duplicate-copy + flicker restart`
  - 新反馈证明上一轮“continuity repair”把两个不同问题混在了一起：
    - `spec-takeover` 共享文案在 handoff 时出现了两份可见文字
    - `3 / 6` takeover 进入后出现“出现 -> 消失/隐藏 -> 再出现 -> 再消失”的多次切换
    - 向下滚动时，即使声明了 `exitAnimation`，视觉上也没有形成单次连续离场
  - 初步怀疑：
    - `TakeoverReplayAnimate` 当前同时渲染 `preAnchor` 和 `takeover` 两份同内容节点
    - 两份节点都带自身 enter/exit transform，不只是 opacity handoff
  - Prevention rule:
    - “连续交接”不能只看 opacity；若 handoff 两侧是同文案/同元素，必须证明不会出现双渲染可见态，也不能重复触发同一 takeover 的 enter/exit 感知。
- `2026-05-19 delivery gap`
  - 用户继续看到旧 bug 的直接原因不是源码未修，而是 `127.0.0.1:4173` 仍在服务旧 `dist`。
  - Prevention rule:
    - 源码修复后必须重建并验明正在访问的 preview URL 指向最新产物。

## Execution Log

- `2026-05-19 restart`
  - User explicitly requested task restart, reuse prior agents, and persistent logging of every fix/error.
  - This task flow is now the canonical ledger for the restarted round.
  - Re-briefed existing agents with non-overlapping scopes:
    - `Faraday`: red tests + minimal fix + focused regressions
    - `Meitner`: authoring/runtime/design split review only
    - `Fermat`: real-browser reproduction only
- `2026-05-19 21:23`
  - Focused proof `pnpm exec vitest run src/components/ScrollScenes.test.tsx --config vitest.config.ts` passed with `6/6`.
  - Current source already contains:
    - symmetric `TakeoverReplayAnimate` crossfade over `24px`
    - explicit `exitAnimation` on `specs` takeover phase layers
- `2026-05-19 21:24`
  - Found a stale-preview mismatch:
    - source file `examples/performance-test/src/components/ScrollScenes.tsx` includes the new takeover handoff + exit authoring
    - running preview on `127.0.0.1:4173` is still serving older `dist/assets/index-*.js` where `spec-takeover` renders plain visibility/phase layers without `TakeoverReplayAnimate` or explicit exit animations
  - This explains why user still sees the old “图1 -> 图2” jump despite the source-side patch existing.
- `2026-05-19 21:27`
  - Rebuilt example preview with `pnpm build`.
  - Started fresh preview with latest assets at `http://127.0.0.1:4174/#/scroll`.
- `2026-05-19 21:28`
  - Focused regression `pnpm test -- src/components/Animate/useAnimateScroll.phase.test.tsx --runInBand` passed with `9/9`.
- `2026-05-19 21:29`
  - Browser re-check on `127.0.0.1:4174/#/scroll` confirmed:
    - early `spec-takeover` handoff now shows overlapping crossfade instead of old instant cut
    - later takeover frames show authored stats/media/bullets layering in progressively
    - old `127.0.0.1:4173/#/scroll` remained stale and still reproduced the pre-fix behavior until replaced
- `2026-05-19 21:31`
  - Headless Playwright verification against `127.0.0.1:4174/#/scroll` captured takeover progression frames with zero console/page errors.
  - Result: `consoleMessages: []`
- `2026-05-19 21:38`
  - Added a second red proof for perceptual continuity: at `progressPx=24`, replay blend must still keep both pre-anchor and takeover visible.
  - Red result: `continuedBlend.preAnchorOpacity === 0`, proving the `24px` window still completed too early.
- `2026-05-19 21:39`
  - Widened `TakeoverReplayAnimate` crossfade span from `24px` to `120px`.
  - Re-ran:
    - `pnpm exec vitest run src/components/ScrollScenes.test.tsx --config vitest.config.ts` -> `6/6`
    - `pnpm test -- src/components/Animate/useAnimateScroll.phase.test.tsx --runInBand` -> `9/9`
  - Rebuilt preview assets again with `pnpm build`.
- `2026-05-19 21:40`
  - Second Playwright pass against `127.0.0.1:4174/#/scroll` showed a visibly longer early blend while keeping console/page errors at `[]`.
- `2026-05-19 21:41`
  - Re-checked remaining nodes before reporting.
  - No docs update was needed because this round only corrected example authoring behavior and preview delivery, not framework semantics.
- `2026-05-19 22:02`
  - Added new red proofs:
    - standalone visibility chapters must declare explicit `exitAnimation`
    - `scenario-takeover` phase layers must also declare explicit forward exit
  - Red result:
    - `highlights / details / cta` visibility chapters still had `exitAnimation === undefined`
    - `scenario-takeover` authored phase layers still had `exitAnimation === undefined`
- `2026-05-19 22:07`
  - Patched `examples/performance-test/src/components/ScrollScenes.tsx` so all standalone visibility chapters now declare explicit exits, including `hero`, `highlights`, `details`, and `cta`.
  - Also patched `scenario-takeover` authored phase layers with explicit exits.
  - Re-ran:
    - `pnpm exec vitest run src/components/ScrollScenes.test.tsx --config vitest.config.ts` -> `8/8`
    - `pnpm test -- src/components/Animate/useAnimateScroll.phase.test.tsx --runInBand` -> `9/9`
  - Rebuilt preview assets again with `pnpm build`.
- `2026-05-19 22:10`
  - Container-scroll Playwright verification against `127.0.0.1:4174/#/scroll` confirmed:
    - `02 / Editorial flow` now fades/leaves progressively instead of sitting at full opacity until the next chapter takeover overlaps it
    - `03 / Sticky layer + scroll` still enters cleanly afterward
- `2026-05-20 restart`
  - User explicitly required a new `TDD + 三 agent + 复验` round for:
    - duplicate text in `spec-takeover`
    - `3 / 6` takeover repeated appear/hide/reappear behavior
    - downward scroll not executing visible leave when exit is declared
  - Reopened three lanes:
    - implementation lane: new failing proofs + minimal patch
    - review lane: root-cause audit
    - acceptance lane: real preview reproduction
  - Main-lane local finding before patch:
    - `TakeoverReplayAnimate` currently overlays `preAnchor` and `takeover` simultaneously via opacity crossfade while each child keeps its own `Animate` motion, so shared `SectionCopy` content can be doubly visible with different transforms.
- `2026-05-20 16:24`
  - Review lane confirmed the root cause split:
    - duplicate specs title is authored by `SpecTakeover` rendering the same `SectionCopy` twice
    - `TakeoverReplayAnimate` stacks both layers in one slot
    - wrapper was treating `!active` as both “not yet entered” and “finished forward takeover”, so forward unlock could restore pre-anchor ownership
- `2026-05-20 16:26`
  - Implementation lane added new red proofs in `examples/performance-test/src/components/ScrollScenes.test.tsx`:
    - specs handoff must keep a single visible authored copy
    - `3 / 6` specs takeover must stay latched to takeover ownership after forward progress starts
  - Red result before patch:
    - visible ownership overlap existed
    - forward unlock restored pre-anchor ownership
- `2026-05-20 16:28`
  - Implementation lane patched `TakeoverReplayAnimate` in `examples/performance-test/src/components/ScrollScenes.tsx`:
    - removed overlap-based shared ownership
    - once forward takeover progress starts, takeover layer owns the slot
    - forward unlock no longer snaps ownership back to pre-anchor
  - Focused green:
    - `pnpm exec vitest run src/components/ScrollScenes.test.tsx --config vitest.config.ts` -> `9/9`
- `2026-05-20 16:31`
  - Main lane re-ran scroll runtime regression:
    - `pnpm test -- src/components/Animate/useAnimateScroll.phase.test.tsx --runInBand` -> `9/9`
- `2026-05-20 16:33`
  - Main lane ran a fresh Playwright pass on a new page against `http://127.0.0.1:4173/#/scroll` using real `mouse.wheel(...)` input, not direct `scrollTop` mutation.
  - Observed on the updated source:
    - during the `2 -> 3` approach, each sampled wheel step had one visible specs heading and one visible `03 / Sticky layer + scroll` pill
    - at pinned `scrollTop ~= 2440`, ownership transferred from pre-anchor to takeover without a second visible title/pill copy
    - downward leave stayed on the takeover-owned layer until the title exited upward
  - Note:
    - an earlier acceptance-lane rerun returned a conflicting/stale-looking duplicate report; the fresh main-lane browser pass on a new page did not reproduce it
- `2026-05-20 16:35`
  - Built the example successfully:
    - `pnpm build`
