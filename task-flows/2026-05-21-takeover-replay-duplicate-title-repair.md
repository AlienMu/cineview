# Task: Takeover Replay And Duplicate Title Repair

## Goal

- Fix the repeated scroll takeover regressions reported on 2026-05-21:
  - A takeover that has already run must be able to run again.
  - Backward scrolling must reverse/retract takeover progress instead of skipping the takeover section.
  - The custom scrollbar path must not jump over takeover budget.
  - 03/05 scenes must not show two identical titles at the same time.
- Use the requested three-agent split:
  - Main agent: direction, grilling assumptions, task decomposition, final judgment.
  - Implementation agent: TDD red-green-refactor and concrete frontend/runtime implementation.
  - Review agent: independent frontend-design-review critique only.

## Required Rules

- Read `AGENTS.md`, `AGENT_SELF_REVIEW.md`, relevant `design.md`, and `requirements.md` before framework changes.
- Treat review blockers as hard failures until represented by tests or runtime evidence.
- Do not call the task fixed until implementation and review results are integrated.
- Do not revert unrelated dirty worktree changes.
- Prefer public behavior tests over implementation-detail tests.

## Nodes

- [x] Read project workflow and self-review rules.
- [x] Read relevant design and requirement sections for scroll takeover and scrollbar semantics.
- [x] Record the repeated workflow miss in `AGENT_SELF_REVIEW.md`.
- [x] Create this task-flow as the current execution source of truth.
- [x] Reproduce or encode the current reverse/replay/scrollbar skip failure as a red proof.
- [x] Reproduce or encode the 03/05 duplicate-title failure as a red proof.
- [x] Land the minimal framework/example fix that turns the red proofs green.
- [x] Run focused automated regressions for touched runtime and example paths.
- [x] Run real browser verification on `#/scroll` for forward, backward, replay, scrollbar, and 03/05 title visibility.
- [x] Collect independent review-agent findings and resolve or explicitly defer them.
- [x] Update docs if public runtime semantics changed.
- [x] Re-check unchecked nodes before final response.

## Verification Checklist

- [x] `pnpm test -- src/components/CineView/DirectScrollCineView.test.tsx --runInBand`
- [x] `pnpm --dir examples/performance-test test -- src/components/ScrollScenes.test.tsx`
- [x] Relevant animate/scroll phase tests if `Animate` behavior changes.
- [x] Type/build check if framework public behavior changes.
- [x] Browser console has no new errors.
- [x] Runtime: wheel forward through 03 and 05 takeover consumes budget visibly.
- [x] Runtime: wheel backward through completed takeover retracts instead of jumping.
- [x] Runtime: second forward pass replays takeover.
- [x] Runtime: custom scrollbar drag/click traverses takeover budget without skipping.
- [x] Runtime: no duplicated visible title in scenes 03 and 05.

## Risks / Blockers

- Worktree is already heavily dirty; only current-task files should be changed.
- Previous tests were too structural and did not catch user-visible duplicate titles.
- Browser sampling can produce false confidence if it mutates `scrollTop` instead of using real input paths.

## Current Status

- Complete.
- Active node: none.

## Execution Log

- `2026-05-21 restart`: User requested continuing the restarted task while reusing prior subagents. The implementation agent errored with a 403 after partial edits; main lane continued from the current workspace state.
- `2026-05-21 red proofs`: Added/kept hard proofs for scrollbar no-skip behavior and 03/05 inactive title ownership. `DirectScrollCineView.test.tsx` now includes a no-skip scrollbar case; `ScrollScenes.test.tsx` failed on inactive title owner still being paint-readable.
- `2026-05-21 patch`: `TakeoverReplayAnimate` changed from rendering both title owners with display/opacity gates to mounting only the current owner.
- `2026-05-21 verification`: Focused regressions passed: `ScrollScenes.test.tsx` 23/23, `DirectScrollCineView.test.tsx` 38/38, `pnpm exec tsc --noEmit`, and `pnpm --dir examples/performance-test build`.
- `2026-05-21 browser`: Real Chrome Playwright check passed with no console/page errors, max visible title count of 1 for scenes 03 and 05, forward/backward/replay samples through both takeover scenes, and targeted scrollbar drag stopping inside scene 03 takeover (`scrollTop 2440`, owner `takeover`, counter `3 / 6`).
- `2026-05-21 docs`: No docs change made because the runtime patch enforces existing documented scrollbar/takeover semantics rather than adding a new public API.
- `2026-05-21 review blocker`: Final review found rail-click can set `activeScrollbarDragZoneRef` and return before installing the mouseup cleanup. The drag/click checklist is reopened until a rail-click proof and fix land.
- `2026-05-21 rail-click fix`: Added rail-click regression for clearing the scrollbar takeover latch after entering takeover; red reproduced, then `handleScrollbarMouseDown` now clears `activeScrollbarDragZoneRef` immediately for non-thumb rail clicks. `DirectScrollCineView.test.tsx` passes 39/39.
- `2026-05-21 rail-click browser`: Real Chrome rail-click script passed with no console/page errors. First rail click moved from pre-anchor to 03 takeover at `scrollTop 2440`; second rail click after the 03 budget moved on to `scrollTop 3388`, proving the old latch no longer traps later clicks.
- `2026-05-21 final review`: Independent review lane reported no Blocking, no Major, and no Minor requiring code changes.
