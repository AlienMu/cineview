# 2026-05-12 Examples / Integration Root-First Migration

## Goal

Migrate example entrypoints and integration tests from legacy scene-level authoring to the root-first API:
- `CineView mode + modes.*`
- `callbacks.common`
- grouped `Scene` / `Animate` / `Position` props

Write scope for this task is limited to:
- `examples/*`
- `src/__tests__/integration/*`

## Node Checklist

- [x] Audit current examples and integration tests for legacy API usage within write scope
- [ ] Migrate example entrypoints to root-first API without expanding into framework runtime files
- [ ] Migrate integration tests to root-first API and modern callback/detail assertions
- [ ] Run targeted example builds and integration tests
- [ ] Verify real example runtime for drag/performance entrypoints
- [ ] Record changed files and residual blockers

## Verification Checklist

- [ ] `pnpm exec jest src/__tests__/integration/*.test.tsx --runInBand`
- [ ] `pnpm --dir examples/simple-test build`
- [ ] `pnpm --dir examples/drag-mode-test build`
- [ ] `pnpm --dir examples/performance-test build`
- [ ] Real runtime check for drag example
- [ ] Real runtime check for performance example

## Risks / Blockers

- Other agents may be changing framework/runtime files concurrently; adapt to current public types and do not revert unrelated work.
- Real browser behavior may expose regressions not visible in jsdom tests, especially for `drag` mode.

## Current Status

- In progress: auditing complete, example/test migration pending.
