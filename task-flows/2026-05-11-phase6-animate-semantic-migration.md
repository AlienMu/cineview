# Task: Phase 6 Animate Semantic Migration

## Goal

- Start Phase 6 of the migration program by moving `Animate` consumption from flat legacy fields toward grouped `duration`, `timeline`, and `visibility` semantics.
- Keep implementation and acceptance separated.
- Continue automatically through executable unchecked nodes unless blocked.

## Linked Flows

- Program:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-10-interface-migration-program.md`
- Execution round:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-10-code-migration-execution.md`

## Nodes

- [x] Re-read project rules, self-review log, and active migration program state
- [x] Re-read Phase 6 design / requirements slices for Animate semantics
- [x] Audit current `Animate.tsx` and `useAnimateScroll.ts` consumption against grouped `AnimateProps`
- [x] Launch implementation lane for the first Phase 6 slice
- [x] Launch separate verification lane for the same Phase 6 slice
- [x] Integrate implementation result without self-signing it off
- [x] Collect independent verification result
- [x] Sync Phase 6 progress back into the parent program and execution flow

## Verification

- [x] Independent code/test acceptance captured for the chosen Phase 6 slice
- [x] Independent runtime/behavior acceptance captured if scroll or visibility behavior changes
- [x] Parent program updated to reflect the exact Phase 6 progress reached

## Implementation Notes

- Files changed in the implementation lane:
  - `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.tsx`
  - `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/useAnimateScroll.ts`
  - `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/useAnimateScroll.warning.test.tsx`
  - `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.semantic-bridge.test.tsx`
- Scope intentionally kept out of drag/snap rewrites beyond consuming the normalized `delay` / `waitFor` / `duration.enter` bridge that `Animate.tsx` now resolves once at the boundary.

## Local Verification Log

- `pnpm test --runTestsByPath src/components/Animate/useAnimateScroll.warning.test.tsx`
  - first run: failed because the grouped viewport-registration test expected `exitDuration: 180` while the fixture lacked an explicit `exitAnimation`, so runtime correctly registered `exitDuration: 0`
  - after tightening the fixture with `exitAnimation=\"fade-out\"`: passed, `4 passed`
- `pnpm test --runTestsByPath src/components/Animate/Animate.test.tsx --testNamePattern=\"grouped duration and timeline\"`
  - failed due to existing invalid hook call noise in `Animate.test.tsx` helper setup (`useMotionValue` called outside a component); this file remains unsuitable as the proof target for this slice
- `pnpm test --runTestsByPath src/components/Animate/Animate.semantic-bridge.test.tsx`
  - passed, `1 passed`

## Risks / Blockers

- `Animate` touches snap, drag, and scroll semantics simultaneously, so scope drift is easy if the slice is not kept narrow.
- Historical `Animate.test.tsx` noise exists in this tree; verification should stay tightly focused on the chosen semantic bridge cases.
- Do not repeat the earlier failure mode of collapsing implementation and verification in the main thread if an agent stalls.
- Independent verification has already reopened first-slice failures on the current tree:
  - grouped `duration` / `timeline` / `visibility` props are still a no-op in `Animate.tsx`
  - `useAnimateScroll.ts` still branches on legacy `scrollDriven` instead of `timeline.driver`
  - `timeline.phase` and grouped `visibility` config are not wired
  - `Animate.test.tsx` is currently not trustworthy due to invalid hook call failures
- Code-review verification on the landed slice now says those earlier code gaps appear closed, but acceptance is still blocked by missing runtime evidence for grouped `timeline.phase` and grouped visibility lifecycle behavior.
- Runtime/behavior verification has now returned and does **not** accept the slice yet:
  - grouped `timeline.driver='scroll'` works in live runtime
  - grouped `timeline.driver='visibility'` stays out of the scroll budget in live runtime
  - grouped `timeline.phase` does not shift progression correctly in live runtime and is the blocking issue
  - console/runtime cleanliness is acceptable on the existing local example surface, but grouped runtime evidence came from an ephemeral harness rather than a committed in-repo probe

## Current Status

- Phase 5 is accepted and the migration program can advance to Phase 6.
- Current audit shows the narrowest useful first slice is:
  - normalize grouped `duration` / `timeline` / `visibility` props inside `Animate.tsx`
  - map legacy `scrollDriven`, `scrollPhaseStart`, `scrollPhaseEnd`, `delay`, `waitFor`, `enterDuration`, and `exitDuration` into that normalized shape
  - teach `useAnimateScroll.ts` to consume normalized `timeline.driver`, `timeline.phase`, and `visibility` semantics instead of only legacy flat fields
- Implementation lane now lands that bridge in the narrow owned files above.
- Independent code/test acceptance now reports:
  - grouped prop normalization is wired in `Animate.tsx`
  - `useAnimateScroll.ts` now consumes grouped `timeline.driver`, grouped phase, and grouped visibility settings
  - focused tests are good for precedence and driver-branch bridging
  - but runtime evidence is still required before accepting the slice
- Independent runtime/behavior acceptance now reports:
  - `timeline.driver='scroll'` inside `ScrollZone` correctly consumes the budget before document scroll
  - `timeline.driver='visibility'` stays outside the scroll budget until the zone releases
  - grouped `timeline.phase` initially reopened acceptance, then was fixed and independently accepted through:
    - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-timeline-phase-followup.md`
    - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-runtime-evidence-followup.md`
- Omitted-driver default follow-up is independently accepted through:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-12-phase6-omitted-driver-default.md`
- Drag/snap hook alignment follow-up is independently accepted through:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-12-phase6-drag-snap-alignment.md`
- Final status for Phase 6: **accepted and complete**
