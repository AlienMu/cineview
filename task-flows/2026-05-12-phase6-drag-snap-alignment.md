# Task: Phase 6 Drag/Snap Alignment

## Goal

- Keep `useAnimateDrag` and `useAnimateSnap` aligned with grouped `duration` / `timeline` semantics.
- Keep implementation and acceptance separated.

## Linked Flows

- Phase 6 first slice:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-animate-semantic-migration.md`
- Omitted driver follow-up:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-12-phase6-omitted-driver-default.md`
- Program:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-10-interface-migration-program.md`
- Execution round:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-10-code-migration-execution.md`

## Scope

- Stay narrow on grouped `duration.enter`, `timeline.delay`, and `timeline.waitFor` consumption for drag/snap hooks.
- Do not reopen scroll-driver, grouped visibility, or grouped timeline phase work here.

## Nodes

- [x] Re-read the active Phase 6 node and audit drag/snap hook inputs
- [x] Add focused proof for snap grouped semantics at the hook boundary
- [x] Add focused proof for drag grouped semantics at the hook boundary
- [x] Re-run focused Animate tests for grouped precedence and hook registration
- [x] Collect independent verification result
- [x] Sync the result back into the parent Phase 6 flows

## Verification

- [x] Focused snap proof that grouped `duration.enter` / `timeline.delay` / `timeline.waitFor` beat legacy flat fields
- [x] Focused drag proof that grouped `duration.enter` / `timeline.delay` / `timeline.waitFor` beat legacy flat fields
- [x] Targeted test pass for the touched Animate proofs
- [x] Independent acceptance of the drag/snap alignment slice

## Initial Audit Notes

- `Animate.tsx` already normalizes:
  - `duration.enter`
  - `timeline.delay`
  - `timeline.waitFor`
- Those normalized values are already passed to:
  - `useAnimateSnap(...)`
  - `useAnimateDrag(...)`
- Current likely gap is evidence granularity rather than a confirmed runtime bug:
  - the existing grouped semantic bridge proof is snap-shaped through the default scene mode
  - drag-specific proof for grouped precedence is not yet clearly isolated

## Implementation Notes

- `Animate.tsx` already normalizes grouped semantics before selecting the scene-mode hook:
  - `duration.enter`
  - `timeline.delay`
  - `timeline.waitFor`
- Those normalized values are passed into both:
  - `useAnimateSnap(...)`
  - `useAnimateDrag(...)`
- This follow-up therefore stayed narrow:
  - no runtime hook behavior changes were needed
  - the main work was to strengthen proof coverage so drag mode is explicitly covered, not just snap mode
- Focused proof expansion landed in `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.semantic-bridge.test.tsx`:
  - explicit snap-mode grouped precedence proof
  - explicit drag-mode grouped precedence proof
- A small TypeScript hygiene fix was also needed in `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/useAnimateScroll.phase.test.tsx`:
  - annotate the `forceRender` state updater parameter to satisfy `tsc --noEmit`

## Files Changed

- `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.semantic-bridge.test.tsx`
- `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/useAnimateScroll.phase.test.tsx`
- `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-12-phase6-drag-snap-alignment.md`

## Local Verification Log

- `pnpm test --runTestsByPath src/components/Animate/Animate.semantic-bridge.test.tsx src/components/Animate/useAnimateScroll.warning.test.tsx`
  - passed, `7 passed`
- `pnpm test --runTestsByPath src/components/Animate/useAnimateScroll.phase.test.tsx`
  - passed, `1 passed`
- `pnpm exec tsc --noEmit`
  - passed

## Independent Acceptance Log

- Fresh independent audit confirms `Animate.tsx` still resolves grouped semantics once at the boundary and forwards them into both drag/snap hooks:
  - `duration.enter` precedence at `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.tsx:124`
  - `timeline.delay` / `timeline.waitFor` precedence at `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.tsx:130`
  - grouped values passed into `useAnimateSnap(...)` and `useAnimateDrag(...)` at `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.tsx:220` and `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.tsx:230`
- Fresh independent scope check confirms no new working-tree edits in `useAnimateSnap.ts` or `useAnimateDrag.ts`; this node did not widen into drag/snap runtime-hook behavior changes.
- Fresh independent proof coverage confirms:
  - snap grouped precedence in `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.semantic-bridge.test.tsx:72`
  - drag grouped precedence in `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/Animate.semantic-bridge.test.tsx:100`
  - TS hygiene fix remains narrow in `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/useAnimateScroll.phase.test.tsx:35`
- Fresh independent verification run:
  - `pnpm test --runTestsByPath src/components/Animate/Animate.semantic-bridge.test.tsx src/components/Animate/useAnimateScroll.warning.test.tsx`
    - passed, `7 passed`
  - `pnpm test --runTestsByPath src/components/Animate/useAnimateScroll.phase.test.tsx`
    - passed, `1 passed`
  - `pnpm exec tsc --noEmit`
    - passed
- Verdict: `ACCEPT`

## Current Status

- Phase 6 drag/snap alignment is independently accepted.
- The node stayed implementation-light and evidence-heavy:
  - grouped `duration.enter` / `timeline.delay` / `timeline.waitFor` precedence holds in both snap and drag modes
  - no fresh drag/snap runtime-hook behavior changes were needed for this node
- This closes the final open node under Phase 6.
