# Task: Replace performance test generator with three real-mode performance pages

- Goal: remove the generator-driven `performance-test` playground and replace it with one hub plus three independent `snap / drag / scroll` product showcase pages that use authored content, local assets, and a hideable performance panel.

## Nodes

- [x] Re-read project rules, self-review log, and current performance-test entry structure
- [x] Grill requirement details and settle the product direction for the new three-mode experience
- [x] Lock scope: example-only migration, hash routes, shared product narrative, monitor stays but can hide
- [x] TDD Slice 1: add route/content test harness for hub + mode page resolution
- [x] TDD Slice 2: replace old entrypoint and generator-based pages with new hash-routed shell
- [x] TDD Slice 3: implement shared authored content model and three mode experiences
- [x] TDD Slice 4: refit performance monitor visibility toggle, scene navigation, and docs
- [x] Run targeted tests/build/dev verification
- [x] Hand over implementation diff and runtime notes to main/review lanes

## Verification

- [x] Old generator-driven and legacy experimental performance routes removed cleanly
- [x] Hub route plus `#/snap` / `#/drag` / `#/scroll` all resolve correctly
- [x] Pages use authored product sections and local assets rather than generated scene loops
- [x] Performance monitor can be shown and hidden
- [x] Build succeeds
- [x] Dev server runs and pages are reachable

## Risks / Blockers

- Working tree already contains unrelated framework changes; avoid touching non-example files unless the new pages genuinely require shared support.
- `performance-test` currently has no local test harness; this round needs a lightweight example-local test setup to keep the TDD loop honest.

## Current Status

- New hash-routed experience is live with hub + three mode pages.
- Legacy experimental pages and generator-based runtime paths have been removed from the example.
- Local tests and production build pass; dev server route verification completed.
