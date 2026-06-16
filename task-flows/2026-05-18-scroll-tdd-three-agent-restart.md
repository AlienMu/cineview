# Task: Scroll Runtime Repair Restart With TDD And Three-Agent Lanes

## Goal

- 在不回退 `drag` / `snap` 的前提下，修复当前 `scroll` 模式的关键运行时问题。
- 严格按三条线执行：
  - 主 agent：方向、拆解、裁决、整合
  - 实现线：TDD / red-green-refactor
  - 评审线：独立代码与设计审查
  - 验收线：真实环境运行与复验
- 不做“自己写自己验”的闭环；实现、评审、验收必须分离。

## Required Rules

- 先读 `design.md`、`requirements.md`、`AGENT_SELF_REVIEW.md`，再推进代码。
- 以本文件作为本轮唯一执行源；每完成一个节点就回来看并勾选。
- 使用 TDD：先补红测，再做最小修复，再回归。
- 真实环境验收必须单独执行，不能用主线的本地判断替代。
- 不得为了解决 `scroll` 而破坏 `drag` / `snap`。
- 不做兼容性保留式脏补丁；以当前设计文档为准。
- 不回退、不覆盖 dirty worktree 中与当前任务无关的用户改动。

## Active Bug Scope

- [ ] Sticky 图层抖动、跟随不流畅
- [ ] Takeover 动画只触发一次，反向滚动不回收 / 不重放
- [ ] Scroll 模式持续动画缺失
- [ ] Overlay scrollbar 不计入 takeover 动画时长，进度与视觉时间轴脱节

## Agent Lanes

- [x] `Faraday`：实现线，负责 TDD 红绿重构与代码修改
- [x] `Averroes`：评审线，负责独立代码 / 交互 / 设计 review
- [x] `Fermat`：验收线，负责真实环境复现、回归、验收报告

## Nodes

- [x] Read `design.md`
- [x] Read `requirements.md`
- [x] Read `AGENT_SELF_REVIEW.md`
- [x] Read task-flow rules and prior relevant task flows
- [x] Re-brief all three existing agents with this round's scope and lane ownership
- [x] Inspect current `scroll` runtime and existing tests for the four active bugs
- [ ] Add failing tests for:
  - [ ] scrollbar progress during takeover
  - [ ] reverse scroll retract / replay behavior
  - [ ] scroll-mode continuous animation activation
  - [ ] sticky shell / sticky layer stability
- [ ] Implement minimal runtime fixes
- [ ] Run targeted tests for changed runtime modules
- [ ] Run regression tests for `drag` / `snap`
- [ ] Start real local environment for examples
- [ ] Acceptance lane performs browser/runtime verification on `scroll`
- [ ] Review lane performs independent code/design review
- [ ] Integrate review + acceptance feedback
- [ ] If any lane reports failure, start next repair loop immediately
- [ ] Re-check all executable unchecked nodes before reporting completion

## Verification

- [ ] `pnpm test -- src/components/CineView/DirectScrollCineView.test.tsx --runInBand`
- [ ] `pnpm test -- src/components/Animate/Animate.test.tsx src/components/Animate/useAnimateScroll.phase.test.tsx --runInBand`
- [ ] Relevant `drag` regression tests pass
- [ ] Relevant `snap` regression tests pass
- [ ] Real browser verification covers:
  - [ ] sticky layer smoothness
  - [ ] forward takeover animation
  - [ ] reverse takeover retract / replay
  - [ ] continuous animation presence
  - [ ] scrollbar progress while takeover budget is consumed
  - [ ] no runtime crash / no maximum update depth loop

## Risks / Blockers

- 当前 worktree 很脏，历史 scroll 改动较多，必须小心只收敛到本轮问题面。
- 现有测试里已经存在与用户预期冲突的 scrollbar 断言，需要先改红。
- sticky 抖动问题可能是 runtime 进度回写、sticky host 尺寸、或层渲染策略共同导致，不能拍脑袋修。

## Current Status

- In progress
- Active node: Add failing tests for scrollbar progress, reverse replay, continuous animation, and sticky stability
