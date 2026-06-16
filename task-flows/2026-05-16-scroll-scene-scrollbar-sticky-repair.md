# Task: Scroll Scene / Scrollbar / Sticky Repair

## Goal

- Repair the current scroll runtime without removing the user-facing behavior.
- Restore scene-local scroll takeover animation visibility.
- Restore visible/usable scrollbars sourced from the real scroll container.
- Change `Position layer.fixed` behavior in scroll mode to sticky semantics that work in arbitrary regions instead of only inside scene-scoped fixed hosts.
- Keep implementation and independent verification separated, then verify in a real running example before claiming completion.

## Required Rules

- Read `design.md`, `requirements.md`, `AGENTS.md`, and `AGENT_SELF_REVIEW.md` before changing runtime behavior.
- Use one implementation lane and one independent verification lane.
- Do not let the implementation lane sign off on its own work.
- Do not remove behavior just to make errors disappear.
- Keep docs in sync if framework behavior changes.
- Use this file as the source of truth and keep only one active node when possible.

## Nodes

- [x] Read `design.md`
- [x] Read `requirements.md`
- [x] Read `AGENTS.md`
- [x] Read `AGENT_SELF_REVIEW.md`
- [x] Inspect current code path and real example route for scroll mode
- [x] Reuse implementation agent with TDD instructions and bounded ownership
- [x] Reuse independent review agent for code/design/runtime acceptance
- [x] Reproduce the three reported regressions in the real example
- [ ] Implement runtime/code fixes for scene scroll animation region
- [ ] Implement runtime/code fixes for visible/usable scrollbar behavior
- [ ] Implement runtime/code fixes for sticky positioning outside scene-only limits
- [ ] Update docs if behavior or semantics changed
- [ ] Run targeted tests
- [ ] Run type-check and build
- [ ] Perform real browser verification on the running example
- [ ] Integrate independent review findings and finish any follow-up fixes

## Verification

- [ ] Targeted unit/integration tests for changed modules pass
- [ ] `pnpm type-check` passes
- [ ] Framework build passes
- [ ] Example app runs locally
- [ ] Real browser check confirms:
- [ ] Scene takeover animation region is visible and animates while scrolling
- [ ] Scrollbar is present and usable
- [ ] Sticky positioned content works outside scene-only host constraints
- [ ] No white screen / missing content / console crash

## Risks / Blockers

- Real behavior depends on the `examples/performance-test` scroll page, so code-level green checks are not enough.
- Existing runtime may still contain scene-scoped fixed host assumptions that conflict with sticky behavior.

## Current Status

- In progress
- 2026-05-16: Real runtime reproduction established on `examples/performance-test/#/scroll`.
- 2026-05-16: Safari manual check showed a visibly blank section after scrolling.
- 2026-05-16: A same-origin probe page confirmed the scroll container still has real overflow and scroll metrics, but takeover-related chapters can remain visually empty with many `.cineview-animate` nodes still at `opacity: 0` when their scene is already in the viewport.
- Active node: Implement runtime/code fixes for scene scroll animation region
