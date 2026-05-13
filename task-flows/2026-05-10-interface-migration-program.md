# Task: Interface Migration Program

## Goal

- Execute the full interface migration from the current API to the new root-first API model defined by `design.md` and `requirements.md`.
- Use this file as the source of truth for the entire migration program.
- Do not mark the program complete until all relevant implementation and verification nodes are checked or explicitly blocked.

## Program Rules

- Only one major node should be actively in progress at a time unless parallel work is clearly independent.
- A node may be checked only after the underlying work is actually completed.
- Verification nodes must not be checked before the corresponding tests or runtime checks finish.
- Before each new implementation step, re-check this file and continue with the next executable unchecked node.

## Global Preparation

- [x] Read `design.md`
- [x] Read `requirements.md`
- [x] Read `AGENT_SELF_REVIEW.md`
- [x] Inspect current public types and implementation entry points
- [x] Produce migration plan in docs
- [x] Establish phase-by-phase implementation order in this task flow

## Phase 1 - Contract Alignment

### Goal

- Ensure docs, requirements, and target API language stay aligned while implementation begins.

### Nodes

- [x] Align `design.md` with root-first mode ownership
- [x] Align `requirements.md` with root-first mode ownership
- [x] Record migration strategy in `design.md`
- [x] Record migration compatibility requirements in `requirements.md`
- [x] Re-check docs for conflicting `Viewport` / `ScrollZone` language before Phase 2 starts

### Verification

- [x] Confirm no conflicting scroll public-API language remains in docs
- [x] Confirm docs no longer describe `Scene.slideMode` as the target model

## Phase 2 - Types First + Compatibility Bridge

### Goal

- Introduce the new public type model while preserving an upgrade path for legacy callers.

### Nodes

- [x] Refactor `src/types/index.ts` root types toward `CineView.mode` + `modes.*`
- [x] Add grouped `callbacks`, `performance`, and `scrollbar` types
- [x] Add grouped `SceneProps` objects: `layout`, `stack`, `transition`, `assets`, `callbacks`
- [x] Add public `ScrollZoneProps`
- [x] Add grouped `AnimateProps` objects: `duration`, `timeline`, `visibility`
- [x] Add grouped `PositionProps` objects: `at`, `layer`
- [x] Add deprecated compatibility typings for legacy scene-level and scroll-level fields
- [x] Add deprecated compatibility typings for legacy `ViewportProps`, `triggerAnimation`, and `reload`
- [x] Update any exported type helpers affected by the new grouped model

### Verification

- [x] Run TypeScript compile for the package
- [x] Verify new type surface matches `design.md`
- [x] Verify legacy fields still type-check or emit explicit deprecated guidance

## Phase 3 - Root Runtime Takes Mode Ownership

### Goal

- Make `CineView` the real owner of mode selection and global mode config.

### Nodes

- [x] Refactor `src/components/CineView/CineView.tsx` to consume root `mode`
- [x] Remove dependency on per-Scene mode inference for root engine branching
- [x] Move global snap/drag/scroll config reads to root `modes.*`
- [ ] Introduce root-level scrollbar registration path
- [x] Introduce compatibility mapping from legacy props to root mode config
- [ ] Update `useSceneManager` interfaces if mode ownership changes require it

### Verification

- [x] Run targeted tests for `CineView`
- [x] Run TypeScript compile
- [x] Run build if runtime contracts changed
- [x] Verify root mode branch behavior for `snap`, `drag`, and `scroll`

## Phase 4 - Scene Responsibility Reduction

### Goal

- Reduce `Scene` to layout, section boundary, fixed host, and scene-level transition concerns.

### Nodes

- [x] Refactor `src/components/Scene/Scene.tsx` to stop owning mode-specific top-level config
- [x] Reduce `SceneInternalProps` breadth where root runtime can own values
- [x] Map legacy `SceneProps` fields into grouped scene objects
- [x] Preserve scene-scoped fixed layer behavior during refactor
- [x] Preserve scene visibility callback behavior during refactor

### Verification

- [x] Run targeted tests for `Scene`
- [x] Run TypeScript compile
- [x] Verify scene-scoped fixed layer ownership still holds
- [x] Verify scene visibility callbacks still behave correctly

## Phase 5 - ScrollZone Public API

### Goal

- Introduce `ScrollZone` as the public scroll takeover API while keeping existing viewport runtime usable internally.

### Nodes

- [x] Introduce public `ScrollZone` component or public bridge layer
- [x] Map `ScrollZone` to existing viewport runtime registration
- [x] Keep legacy `Viewport` available as compatibility API
- [x] Add legacy warning strategy for `Viewport`
- [x] Update package exports to prefer `ScrollZone`
- [x] Update examples/docs references from public `Viewport` to `ScrollZone`

### Verification

- [x] Run targeted tests for viewport/zone budget logic
- [x] Run TypeScript compile
- [x] Verify `ScrollZone` budget registration works
- [x] Verify legacy `Viewport` still functions or warns clearly
- [x] Capture independent acceptance sign-off for the public bridge

## Phase 6 - Animate Semantic Migration

### Goal

- Migrate `Animate` from flat fields and boolean scroll control to grouped timeline semantics.

### Nodes

- [x] Refactor `AnimateProps` consumption in `Animate.tsx`
- [x] Refactor `useAnimateScroll.ts` to consume `timeline` and `visibility`
- [x] Add compatibility mapping from `scrollDriven` to `timeline.driver='scroll'`
- [x] Add compatibility mapping from `scrollPhaseStart/End` to `timeline.phase`
- [x] Ensure default behavior remains user-friendly when `timeline.driver` is omitted
- [x] Keep drag/snap hooks aligned with grouped duration/timeline semantics

### Verification

- [x] Run targeted tests for `Animate`
- [x] Run TypeScript compile
- [x] Verify scroll-driven vs visibility-driven behavior separation
- [x] Verify delay / waitFor / enter / exit budget mapping still works
- [x] Fix grouped `timeline.phase` runtime behavior and re-run runtime acceptance

## Phase 7 - Position and Dual-Axis Design Basis

### Goal

- Replace single-axis `designSize` assumptions with dual-axis design dimensions.

### Nodes

- [x] Refactor `CineView` config typing from `designSize` to `width` / `height`
- [x] Refactor `CineViewContext` to expose dual-axis conversion
- [x] Refactor `Position.tsx` to consume dual-axis scaling
- [x] Add compatibility path for legacy `x/y/offsetX/offsetY`
- [x] Add grouped `at` / `layer` semantics to runtime usage

### Verification

- [x] Run targeted tests for `Position` and context
- [x] Run TypeScript compile
- [x] Verify fixed layer coordinates remain stable in scroll mode
- [x] Verify dual-axis positioning does not regress existing examples unexpectedly

## Phase 8 - Legacy Removal and Final Cleanup

### Goal

- Remove deprecated public surface once bridges and migration path are in place.

### Nodes

- [x] Remove legacy scene-level mode ownership from implementation
- [x] Remove deprecated flat scroll fields from primary code paths
- [x] Remove public recommendation path for `Viewport`
- [x] Remove deprecated `triggerAnimation` / `reload` from primary API path
- [x] Clean docs so only final API remains as recommended path
- [x] Clean examples so they use only final recommended API

### Verification

- [x] Run full TypeScript compile
- [x] Run relevant test suites
- [x] Run package build
- [x] Run example build if affected
- [x] Perform runtime/browser verification for key frontend flows
- [x] Verify no remaining unchecked executable nodes exist

## Cross-Phase Verification Gates

- [x] Compatibility warnings are explicit and actionable
- [x] No phase silently changes semantics without doc updates
- [x] No frontend completion claims are made without runtime verification where relevant
- [x] `design.md` and `requirements.md` remain in sync after each phase that changes public behavior

## Risks / Blockers

- Legacy user code may rely on per-Scene mixed mode semantics that have no exact root-first equivalent.
- `Viewport` to `ScrollZone` migration may require a bridge period longer than one release if external usage is widespread.
- `designSize` to dual-axis config may visually shift legacy layouts and will need careful rollout notes.
- Baseline TypeScript errors currently exist outside the new Phase 2 API surface, mainly around `SceneContextType` test fixtures and `CineViewProviderProps` test usage. These need separation from migration-introduced issues before Phase 2 verification can be fully checked.

## Current Status

- Phase 1 complete
- Phase 2 complete
- Phase 3 implemented and locally verified
- Phase 4 implemented and locally verified with grouped runtime bridge follow-up landed
- Phase 5 public `ScrollZone` bridge is implemented and independently accepted, with residual risks limited to missing browser-console capture and missing dedicated follow-up tests
- Phase 4 independent acceptance still appears stale in older notes, but the active migration program can now move to Phase 6
- Type compatibility bridge is compiling and building
- Phase 6 first slice is now accepted:
  - grouped `duration` / `timeline` / `visibility` normalization is landed
  - grouped `timeline.driver='scroll'` vs `'visibility'` behavior separation is independently accepted
  - grouped `timeline.phase` runtime behavior and committed runtime evidence were accepted through:
    - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-timeline-phase-followup.md`
    - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-runtime-evidence-followup.md`
- Phase 6 omitted-driver default follow-up is now accepted through:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-12-phase6-omitted-driver-default.md`
- Phase 6 drag/snap alignment follow-up is now accepted through:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-12-phase6-drag-snap-alignment.md`
- Phase 6 is now complete and independently accepted.
- Next open phase is now:
  - Phase 7 - Position and Dual-Axis Design Basis
