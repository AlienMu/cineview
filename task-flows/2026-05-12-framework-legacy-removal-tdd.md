# Task: Framework Legacy Removal TDD

## Goal

- Remove framework-level deprecated compatibility surface from the primary public API and runtime where feasible without touching example apps in this task.
- Use TDD with separate implementation and verification/review lanes.

## Node Checklist

- [x] Read project rules, self-review log, design, and requirements
- [x] Audit framework-only legacy/deprecated surface
- [x] Define framework-only TDD slices and target files
- [x] Add or update failing tests that codify the desired no-legacy public surface
- [ ] Implement framework changes to satisfy the new tests
- [ ] Run independent verification/review on changed framework files
- [ ] Sync framework docs if behavior or public surface changed

## Verification

- [ ] Run targeted tests for changed framework modules
- [ ] Run package type-check
- [ ] Run package build if declaration/public surface changes
- [ ] Re-check for remaining unchecked executable nodes

## Risks / Blockers

- Example/test fixtures currently contain many intentional legacy usages; this task excludes example migration.
- Some legacy/internal runtime props may still be used by low-level tests and may require staged removal instead of one-shot deletion.

## TDD Slices

- Slice 1: public type/export closure
  - `src/types/index.ts`
  - `src/components/Scene/Scene.tsx`
  - `src/components/Animate/Animate.tsx`
  - `src/components/Position/Position.tsx`
  - targeted type-oriented tests
- Slice 2: root/framework API closure
  - `src/types/index.ts`
  - `src/index.ts`
  - `src/components/CineView/CineView.tsx`
  - `src/components/CineView/CineView.test.tsx`
- Slice 3: docs sync
  - `design.md`
  - `requirements.md`

## Current Status

- TDD lane updated for framework-only public API legacy removal; waiting on implementation lane to satisfy new failing expectations.
