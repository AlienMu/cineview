# Task: Performance Test Runtime Acceptance

- Goal: independently verify `examples/performance-test` in real runtime, focusing on drag release smoothness, Scene 5 coverage, image preloading, and console/runtime anomalies.

## Nodes
- [x] Re-read project rules and self-review log for this acceptance pass.
- [x] Start or reuse a real `examples/performance-test` dev server.
- [x] Run real-browser automation for drag mode, release completion, and scene traversal.
- [x] Capture baseline findings for Scene 1, Scene 5, image preload behavior, and console anomalies.
- [x] Report acceptance baseline with framework/resource judgment.

## Verification
- [x] Real dev server reachable in browser
- [x] Drag mode enabled
- [x] Scene 1 drag-release observed
- [x] Scene 5 reached and checked
- [x] Image preload behavior observed
- [x] Console anomalies recorded

## Risks / blockers
- Temporary Playwright install may fail or be slow on this machine; fallback must still complete runtime acceptance.

## Current status
- Baseline acceptance executed against `http://127.0.0.1:4175/` using Playwright with the local Google Chrome executable.
- Mouse drag and synthetic touch drag both failed to advance the active drag scene from Scene 1.
- Button-based navigation in drag mode showed inconsistent scene indicator/content alignment, which let adjacent scene content appear while the active scene counter lagged.
- Image preload for the visible image asset was already complete and did not show placeholder/failure in this run.
