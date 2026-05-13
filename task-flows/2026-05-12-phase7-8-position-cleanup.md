# Task: Phase 7 and Phase 8 Execution

## Goal

- Complete Phase 7 dual-axis positioning migration.
- Complete Phase 8 legacy removal and final cleanup.
- Keep implementation and acceptance separated.

## Linked Flows

- Program:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-10-interface-migration-program.md`
- Execution round:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-10-code-migration-execution.md`

## Scope

- Phase 7:
  - dual-axis root sizing
  - context conversion updates
  - `Position` grouped semantics and legacy bridge
- Phase 8:
  - remove deprecated primary-path usage
  - clean docs/examples to the final recommended API
  - final compile/build/runtime verification

## Nodes

- [x] Open dedicated Phase 7/8 task flow
- [x] Audit current `designSize` / `Position` / legacy API surface
- [x] Implement Phase 7 dual-axis migration
- [x] Verify Phase 7 locally
- [x] Audit remaining legacy primary-path usage for Phase 8
- [x] Implement Phase 8 cleanup
- [x] Verify Phase 8 locally
- [x] Collect independent verification result
- [x] Sync results back into parent flows

## Current Status

- Phase 7 is landed:
  - `CineView` config, context, `Position`, and `Container` now consume dual-axis sizing with `width` / `height`
  - focused local verification passed for `Position`, `Container`, and `CineView`
- Phase 8 cleanup is landed for the primary authoring path:
  - examples were rewritten back onto root `mode`, grouped `Animate.timeline` / `duration`, and `Position.at` / `layer`
  - docs now recommend `mode + modes.*`, `ScrollZone`, grouped `timeline`, and grouped `Position`
  - deprecated runtime compatibility still exists, but it now warns as compatibility instead of presenting itself as the preferred path
- Independent worker verification captured:
  - focused test modernization worker passed `Container` and bugfix suites
  - docs audit worker identified the stale doc/task-flow spots that were then applied in the main lane
  - examples worker was interrupted mid-rewrite; the main lane repaired and completed the example surface locally before final verification
