# Task: Scroll Reverse Replay Repair With Three-Agent TDD

## Goal

- 在不破坏 `drag` / `snap` 的前提下，修复当前 `scroll` 模式的四类回归：
  - 往回滚动时 takeover 不回收、不回放
  - 二次进入 scene 时动画不重新触发 / 回退不触发
  - 离场动画未按要求触发
  - 滚动条全局进度跳过、与 takeover 时长脱节
- 严格采用三条线：
  - 主 agent：读文档、拆问题、裁决、整合
  - 实现线：TDD red-green-refactor，负责最小修复
  - 评审线：独立代码 / 交互 / 设计审查
  - 验收线：真实环境复现与复验

## Required Rules

- 先读 `AGENTS.md`、`AGENT_SELF_REVIEW.md`、`design.md`、`requirements.md`。
- 以本文件作为当前轮次唯一执行源，完成一项勾一项。
- 继续沿用现有子 agent，不新开同职能 agent。
- 先有红灯，再做最小修复，再回归。
- 主线不拿“自己跑过几次”替代独立验收。
- 不为修 `scroll` 引入 `drag` / `snap` 回归。
- 不回退 dirty worktree 中与当前任务无关的改动。

## Bug Scope

- [ ] Reverse takeover 回滚时，动画没有收起
- [ ] 二次进入 takeover 时，scene 动画没有重新触发
- [ ] 离开中心点位时，离场动画没有正确触发
- [ ] Overlay scrollbar 全局长度 / 进度仍然跳过

## Agent Lanes

- [x] `Faraday` 实现线：`tdd`，负责 `DirectScrollCineView` 相关红绿重构
- [x] `Meitner` 评审线：`frontend-design-review`，负责独立代码 / 交互审查
- [x] `Fermat` 验收线：真实浏览器复现与回归，负责 scroll 运行时验收

## Nodes

- [x] Read `AGENTS.md`
- [x] Read `AGENT_SELF_REVIEW.md`
- [x] Read `design.md`
- [x] Read `requirements.md`
- [x] Read task-flow rules and prior relevant task flows
- [x] Re-brief three existing agents with exact lane ownership and no-overlap scope
- [x] Reconfirm current red signals in tests and real runtime
- [x] Implementation lane lands minimal fix for reverse replay / retrigger / scrollbar handoff
- [x] Review lane returns independent findings
- [x] Acceptance lane returns independent real-browser findings
- [x] Integrate only the changes that survive review + acceptance
- [x] Run targeted framework tests for touched runtime paths
- [x] Run `drag` / `snap` regression slices
- [x] Re-run real browser verification on scroll route after patch
- [ ] Update docs if runtime behavior changed
- [ ] Re-check remaining unchecked executable nodes before reporting

## Verification

- [x] `pnpm test -- src/components/CineView/DirectScrollCineView.test.tsx --runInBand`
- [x] `pnpm test -- src/components/Animate/useAnimateScroll.phase.test.tsx --runInBand`
- [x] `pnpm exec vitest run src/components/ScrollScenes.test.tsx --config examples/performance-test/vitest.config.ts`
- [x] Relevant `drag` regression slice passes
- [x] Relevant `snap` regression slice passes
- [ ] Real browser verification confirms:
  - [x] reverse takeover retracts on backward input
  - [x] forward re-entry replays correctly
  - [ ] exit animation triggers when leaving center
  - [x] scene animation can trigger again on second pass
  - [x] scrollbar reflects takeover animation length without skipping
  - [x] no new runtime / console errors

## Risks / Blockers

- 当前 worktree 很脏，只能收敛到 `DirectScrollCineView` 与相关测试/验收面。
- 既有 jsdom 测试与真实浏览器表现并不完全等价，必须同时看红测和真实页面。
- reverse replay 与 scrollbar global offset 共用一段 runtime 语义，修复一处可能牵动另一处。
- 当前已确认的红测：
  - `reverse scrollbar replay reacquires takeover and rewinds the scroll animation from the shared global offset`
  - `fires onZoneEnter again when the scrollbar returns above anchor and then re-enters the takeover zone`
  - `publishes reverse and forward scrollbar handoffs through the same global offset timeline without skipping zone progress`

## Current Status

- In progress
- Active node: Diagnose remaining `05 -> 06` active scene counter mismatch in real runtime

## Execution Notes

- `2026-05-19 14:46` 主线补了 `applySyntheticGlobalOffset` 的 zone lifecycle 发布：补发 `onZoneEnter` / `onZoneLeave` / `onZoneProgress`，并在 scrollbar 路径上补齐方向与 scrolling 态同步。
- `2026-05-19 14:47` `pnpm test -- src/components/CineView/DirectScrollCineView.test.tsx --runInBand` 通过，`36/36` 绿；3 条 reported regressions 红灯已转绿。
- `2026-05-19 14:47` `pnpm test -- src/components/Animate/useAnimateScroll.phase.test.tsx --runInBand` 通过，`9/9` 绿。
- `2026-05-19 14:47` `pnpm exec vitest run src/components/ScrollScenes.test.tsx --config vitest.config.ts`（`examples/performance-test`）通过，`4/4` 绿。
- `2026-05-19 14:48` `pnpm test -- src/__tests__/integration/dragModeSettleHandshake.test.tsx --runInBand` 通过，`3/3` 绿。
- `2026-05-19 14:48` `pnpm test -- src/components/CineView/CineView.test.tsx --runInBand` 通过，`33/33` 绿。
- `2026-05-19 14:55` 独立真实页验收结果：reverse takeover `Pass`，二次进入重触发 `Pass`，scrollbar 跳过 `Pass`，console/runtime `Pass`；剩余失败是 `05 -> 06` 交接时 `06` 已显示但底部 scene counter 仍停在 `5 / 6`。
