# Task: Phase 5 ScrollZone Public Bridge

## Goal

- Land the Phase 5 public bridge so `ScrollZone` becomes the recommended runtime-facing API while existing `Viewport` behavior remains available as a compatibility layer.
- Keep implementation and acceptance split into separate lanes.
- Continue automatically through executable unchecked nodes unless blocked.

## Linked Program

- Parent program:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-10-interface-migration-program.md`
- Execution round:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-10-code-migration-execution.md`

## Nodes

- [x] Re-read project rules, self-review log, design, requirements, and active execution flows
- [x] Sync stale parent migration task flow to actual Phase 3 / 4 progress
- [x] Audit current `Viewport` runtime surface, exports, warnings, and example usage for Phase 5 scope
- [x] Delegate implementation lane for `ScrollZone` public bridge
- [x] Delegate independent acceptance lane for `ScrollZone` bridge scope
- [x] Integrate `ScrollZone` bridge changes into exports and warnings without breaking `Viewport` compatibility
- [x] Update docs/examples if the public API recommendation surface changes in this node
- [x] Run targeted verification for the landed bridge changes
- [ ] Perform independent acceptance review on the integrated result
- [x] Sync parent / execution task-flow status after verification

## Verification

- [x] Targeted tests for viewport / zone bridge logic
- [x] TypeScript compile
- [x] Package build
- [x] Runtime/browser spot-check if public example usage changes
- [ ] Separate acceptance lane report captured

## Risks / Blockers

- Separate acceptance may still be blocked by agent availability or 429 responses.
- The implementation lane itself failed with `429 Too Many Requests`, so the main thread completed the remaining example/compatibility bridge work locally.
- The acceptance lane delivered a useful pre-change audit but has not yet returned a post-change sign-off, so independent acceptance is currently blocked on agent responsiveness rather than missing local evidence.
- Process violation to correct: the main thread should not have replaced both implementation and verification after the worker failure; this node must not be treated as accepted until separate lanes are re-established.
- Repo has many unrelated in-flight changes; this node must stay tightly scoped to the public bridge and documentation surface.
- `Viewport` is still deeply referenced in examples and runtime code, so the bridge should prefer additive migration over destructive replacement.

## Current Status

- Parent migration file is now re-aligned to actual Phase 3 / 4 progress.
- This file is the source of truth for the active Phase 5 node.
- Current audit confirms the main Phase 5 gaps:
  - `ScrollZoneProps` exists in `src/types/index.ts`, but there is no public `ScrollZone` component yet.
  - root export in `src/index.ts` still exposes `Viewport` only.
  - scroll-driven orphan warning in `src/components/Animate/useAnimateScroll.ts` still instructs users to wrap with `<Viewport>`.
  - public examples in `examples/performance-test/src/*` still use `<Viewport>`.
- Root export now exposes `ScrollZone`, orphan warnings point to `ScrollZone` first, `Viewport` emits a development-only legacy warning, and the main scroll showcases now author with `ScrollZone`.
- Independent acceptance is still pending because the separate acceptance lane has only reported the pre-change gap list so far, and the implementation lane failed with `429` before it could hand back a result.
- Next executable step: rerun focused verification on the post-example-update tree, perform a runtime/browser spot-check, then re-request independent acceptance sign-off if the agent lane is responsive.

### Implementation Status Notes - 2026-05-11

- Added public `ScrollZone` bridge at `src/components/ScrollZone/ScrollZone.tsx`.
- `ScrollZone` now maps:
  - `zoneId -> viewportId`
  - `trigger -> triggerMode`
  - `budget -> scrollBudget`
- Root package export now exposes `ScrollZone` via `src/index.ts`, while legacy `Viewport` remains exported for compatibility.
- Updated the orphan `scrollDriven` warning in `src/components/Animate/useAnimateScroll.ts` to point to `<ScrollZone>` as the recommended API while still acknowledging legacy `<Viewport>`.
- Added focused tests for:
  - `ScrollZone` runtime registration mapping
  - package root export coverage
  - revised orphan warning guidance
- Follow-up completed in the main thread:
  - `examples/performance-test/src/ScrollCapabilitiesShowcase.tsx` now demonstrates `ScrollZone` instead of `Viewport`.
  - `examples/performance-test/src/ScrollFixedShowcase.tsx` now demonstrates `ScrollZone` instead of `Viewport`.
  - `src/components/Viewport/Viewport.tsx` now emits an explicit dev-only legacy warning.
  - `src/components/Viewport/Viewport.test.tsx` now covers legacy compatibility registration plus the warning guidance.

### Verification Status Notes - 2026-05-11

- Focused verification completed for this implementation scope:
  - `pnpm test --runInBand src/components/ScrollZone/ScrollZone.test.tsx src/components/Animate/useAnimateScroll.warning.test.tsx`
  - Result: passed (`2` suites, `4` tests)
  - `pnpm test --runInBand src/components/ScrollZone/ScrollZone.test.tsx src/components/Viewport/Viewport.test.tsx src/components/Animate/useAnimateScroll.warning.test.tsx`
  - Result: passed (`3` suites, `6` tests)
  - `pnpm type-check`
  - Result: passed
  - `pnpm build`
  - Result: passed
- Runtime/browser spot-check completed on `http://127.0.0.1:3003/?test=scroll` and `http://127.0.0.1:3003/?test=scroll-fixed`
  - Result: both canonical scroll pages render without white screen, and they are now running through the `ScrollZone`-authored examples on the live dev server.
- One discarded verification attempt used:
  - `pnpm test -- --runInBand src/components/ScrollZone/ScrollZone.test.tsx src/components/Animate/Animate.test.tsx`
  - Result: not useful for this scope because the existing `Animate.test.tsx` file is already failing in the current tree from unrelated invalid-hook usage.

### Acceptance Status Notes - 2026-05-11

- Independent re-verification has now been performed in a separate flow:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase5-reverification.md`
- Result: Phase 5 is still not fully accepted.
- Independent code/test acceptance reopened:
  - [P2] canonical `ScrollZone` examples still contain visible `Viewport` wording in `ScrollCapabilitiesShowcase.tsx`
  - [P3] `Viewport` demotion is partial because the component export/import surface still lacks an explicit deprecated authoring signal
- Independent runtime/browser acceptance confirmed:
  - `http://127.0.0.1:3003/?test=scroll` and `?test=scroll-fixed` both responded `200`
  - no white screen was independently confirmed
  - first-view screenshots looked coherent
  - one runtime/network issue remains: a `404` resource on `?test=scroll`
- Follow-up implementation work has been split into:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase5-acceptance-followup.md`
  - That follow-up has now completed and independently verified the three reopened issues.
  - Current Phase 5 status: accepted with residual risks limited to browser-console capture and the lack of dedicated automated tests for the follow-up-only fixes.
