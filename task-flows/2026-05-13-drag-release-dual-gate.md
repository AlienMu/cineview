# Task: Drag Release Dual Gate

## Goal

- Fix the remaining `drag` release bug where the element timeline can visually complete/jump before the scene switch.
- Change release semantics so scene commit happens only after both release lines finish: render travel and timeline settle.
- Keep implementation and acceptance on separate lanes, with real runtime verification.

## Nodes

- [x] Read `design.md`
- [x] Read `requirements.md`
- [x] Read `AGENT_SELF_REVIEW.md`
- [x] Reconstruct current drag release pipeline and active bug statement
- [x] Launch implementation lane for dual-gate release semantics
- [x] Launch independent acceptance lane for test/runtime verification
- [x] Integrate implementation result into main workspace
- [x] Run orchestration checks required before acceptance handoff
- [x] Collect independent acceptance verdict
- [x] Re-open task flow and continue next executable node until all executable nodes are complete
- [ ] Record result into `AGENT_SELF_REVIEW.md` if this round exposes a new mistake pattern

## Verification

- [x] Targeted red test for "scene does not commit when only one release line has finished"
- [x] Targeted green tests for "scene commits after both release lines finish"
- [x] `pnpm exec jest --runInBand src/__tests__/integration/dragModeSettleHandshake.test.tsx src/__tests__/integration/dragModeRealRelease.test.tsx src/components/CineView/CineView.test.tsx src/components/Scene/Scene.scrollRuntimeBridge.test.tsx`
- [x] `pnpm exec tsc --noEmit --pretty false`
- [x] Real browser/runtime drag verification on local example, including console status

## Risks / Blockers

- Must not collapse implementation and acceptance into one lane.
- Existing unrelated failures in `src/components/Animate/Animate.test.tsx` are known noise unless this round touches them.

## Current Status

- Completed
- Implementation lane: `Epicurus`
- Acceptance lane: `Avicenna`
- Review lane: `Gibbs`
