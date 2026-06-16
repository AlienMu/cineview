# Task: Scrollbar Global Timeline Regression

## Goal

- 修复 `examples/performance-test` 中 scroll 模式滚动条无法滚动、ScrollZone 与滚动条进度不同步、末尾空白与内容消失等回归问题。
- 严格按项目规则执行：实现线与验收线分离，必须进行真实环境验证。

## Nodes

- [x] Read `design.md`
- [x] Read `requirements.md`
- [x] Read `AGENT_SELF_REVIEW.md`
- [ ] Inspect relevant code and active regression surface
- [ ] Assign implementation lane to Newton
- [ ] Assign acceptance lane to Planck
- [ ] Start or reuse real `examples/performance-test` dev server
- [ ] Reproduce scrollbar / ScrollZone regression in real runtime
- [ ] Implement runtime fix
- [ ] Independent acceptance rerun in real runtime
- [ ] Update self-review log if a new confirmed workflow mistake is found
- [ ] Re-check task flow for remaining executable unchecked nodes

## Verification

- [ ] Targeted tests pass
- [ ] Example build passes
- [ ] Real browser verification for `#/scroll` passes
- [ ] Scrollbar can drive scroll progress
- [ ] ScrollZone progress follows scrollbar/native scroll
- [ ] No abnormal blank tail after last scene

## Risks / Blockers

- Browser automation may expose runtime-specific issues that unit tests cannot cover.
- Existing worktree is dirty; avoid touching unrelated files.

## Current Status

- In progress
