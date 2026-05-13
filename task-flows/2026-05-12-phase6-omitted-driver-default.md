# Task: Phase 6 Omitted Driver Default

## Goal

- Ensure `Animate` keeps user-friendly default behavior when `timeline.driver` is omitted.
- Keep implementation and acceptance separated.

## Linked Flows

- Phase 6 first slice:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-animate-semantic-migration.md`
- Program:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-10-interface-migration-program.md`
- Execution round:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-10-code-migration-execution.md`

## Scope

- Keep this follow-up narrowly on the default grouped timeline semantics.
- Do not reopen grouped `timeline.phase` or broader drag/snap alignment here.

## Nodes

- [x] Re-read the Phase 6 design and requirements for omitted `timeline.driver`
- [x] Audit the current default normalization path in `Animate.tsx`
- [x] Correct the default grouped timeline driver behavior
- [x] Add focused proof that omitted `timeline.driver` stays out of scroll budget ownership
- [x] Collect independent verification result
- [x] Sync the result back into the parent Phase 6 flows

## Verification

- [x] Focused test proving omitted `timeline.driver` does not register into viewport/zone budget ownership by default
- [x] Focused regression test proving explicit grouped `timeline.driver='scroll'` still registers normally
- [x] Independent verification that omitted `timeline.driver` remains user-friendly in live/runtime behavior where relevant

## Implementation Notes

- Root cause found in `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.tsx`:
  - grouped `timeline.driver` defaulted to `'scroll'` whenever legacy `scrollDriven` was omitted
  - that contradicted the Phase 6 design rule that omitted driver should default to the least surprising path and should not silently pull elements into `ScrollZone` budget ownership
- Narrow fix landed in `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.tsx`:
  - omitted grouped driver now normalizes to `'auto'`
  - explicit legacy `scrollDriven={true}` still maps to `'scroll'`
  - explicit legacy `scrollDriven={false}` still maps to `'visibility'`
- Focused proof added in `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/useAnimateScroll.warning.test.tsx`:
  - omitted grouped driver inside scroll mode with viewport runtime present does not call `registerViewportAnimation`
  - omitted grouped driver also does not trigger orphan scroll-driven warning
  - explicit grouped `timeline.driver='scroll'` registration behavior remains covered

## Files Changed

- `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.tsx`
- `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/useAnimateScroll.warning.test.tsx`
- `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-12-phase6-omitted-driver-default.md`

## Local Verification Log

- `pnpm test --runTestsByPath src/components/Animate/useAnimateScroll.warning.test.tsx`
  - passed, `5 passed`
- `pnpm test --runTestsByPath src/components/Animate/Animate.semantic-bridge.test.tsx`
  - passed, `1 passed`
- `pnpm --dir /Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test build`
  - passed, Vite production build completed successfully after the omitted-driver default change
  - this is relevant because the existing scroll showcase includes multiple `Animate` usages in scroll mode with omitted grouped `timeline.driver`, so the current examples still compile on the new default path

## Independent Verification Log

- Code inspection in `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.tsx`
  - `normalizeAnimateSemantics()` now resolves omitted grouped `timeline.driver` to `'auto'`
  - explicit legacy `scrollDriven={true}` still maps to `'scroll'`
  - explicit legacy `scrollDriven={false}` still maps to `'visibility'`
- Code inspection in `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/useAnimateScroll.ts`
  - viewport budget registration remains gated by `timeline.driver === 'scroll'`
  - omitted driver therefore stays off the scroll-owned registration path
- Scope inspection
  - focused follow-up source change is limited to `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.tsx`
  - proof surface for this follow-up lives in:
    - `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/useAnimateScroll.warning.test.tsx`
    - `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.semantic-bridge.test.tsx`
  - no fresh code evidence was found that this follow-up expanded into `useAnimateScroll.ts` runtime semantics
- Independent test runs
  - `pnpm test --runTestsByPath src/components/Animate/useAnimateScroll.warning.test.tsx`
    - passed, `5 passed`
  - `pnpm test --runTestsByPath src/components/Animate/Animate.semantic-bridge.test.tsx`
    - passed, `1 passed`
- Independent verdict
  - `ACCEPT`

## Current Status

- Phase 6 first slice is now accepted, so the next open Phase 6 node is the omitted-driver default behavior.
- Current audit result: the shipped code was still defaulting omitted grouped `timeline.driver` to `'scroll'`, which was contrary to the design rule:
  - snap / drag should work with minimal declaration
  - scroll should default to non-budget, visibility-style behavior unless scroll ownership is explicit
- Narrow local implementation and focused tests are now in place.
- Additional local verification now also includes a successful `examples/performance-test` build over existing scroll examples that rely on omitted grouped driver defaults.
- Independent acceptance is now captured.
- Final status for this follow-up: **accepted**
