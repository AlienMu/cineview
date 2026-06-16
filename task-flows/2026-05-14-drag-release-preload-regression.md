# Task: Drag release 掉帧与预加载回归修复

## Goal

- 修复 `drag` 模式下释放补完时仍然出现的动画掉帧 / 瞬间完成问题，重点覆盖场景 1 必现与场景 5 偶发。
- 修复图片预加载感知无效的问题，确保当前场景与相邻场景图片在真实运行时按预期准备完成。
- 严格执行实现 / 评审 / 验收分离，并在真实页面完成独立验收。

## Nodes

- [x] Read `design.md`
- [x] Read `requirements.md`
- [x] Read `AGENT_SELF_REVIEW.md`
- [x] Inspect current drag release + preload code and collect likely conflict points
- [ ] Create / refresh red test coverage for the reported regressions
- [x] Launch implementation lane for framework fixes
- [x] Launch independent review lane for code/risk review
- [x] Launch independent acceptance lane for real runtime verification
- [ ] Integrate implementation results without collapsing lanes
- [ ] Re-run targeted tests and packaging checks
- [x] Collect independent review verdict
- [ ] Collect independent runtime acceptance verdict
- [ ] If either lane fails, route findings back to implementation lane and continue
- [ ] Update docs if framework semantics changed
- [ ] Re-check this task flow and complete all executable nodes before stopping
- [ ] Record into `AGENT_SELF_REVIEW.md` if this round reveals a new failure pattern

## Verification

- [ ] Red test reproduces drag release pop / frame-drop regression
- [ ] Red test or runtime proof covers preload ineffectiveness / late image readiness
- [ ] Targeted tests pass
- [ ] `pnpm exec tsc --noEmit --pretty false`
- [ ] Example app runs locally
- [ ] Real browser verification covers drag release on Scene 1 and Scene 5
- [ ] Real browser verification covers adjacent-scene image preload behavior
- [ ] Console check is clean enough for this scope

## Risks / Blockers

- Existing dirty worktree; must avoid overwriting unrelated user edits.
- Acceptance must remain independent from implementation.
- Prior acceptance lane (`Avicenna`) could not reliably trigger page pan/drag through desktop automation; replacement acceptance lane uses a different agent/tooling path.

## Current Status

- In progress
- Implementation lane: Epicurus
- Review lane: Gibbs
- Acceptance lane: Dalton
- Restarted orchestration on user request; extra parallel implementation attempts were closed to keep exactly three active agents.
