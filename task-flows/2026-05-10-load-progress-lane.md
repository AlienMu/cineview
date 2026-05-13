# 2026-05-10-load-progress-lane

## Goal
- Find why load progress can exceed 100% (e.g. 150%) and patch only useImagePreloader + targeted tests.

## Nodes
- [x] Inspect useImagePreloader progress accounting and current tests
- [x] Implement minimal robust fix in hook
- [x] Add targeted regression tests for over-100 values / duplicate settle paths
- [x] Run targeted local checks for hook tests

## Verification
- [x] Targeted hook tests

## Risks / blockers
- Must not touch unrelated framework files unless absolutely necessary
- If a remaining repro depends on CineView repeatedly restarting preload from above the hook, that follow-up should be handled in the main thread, not in this lane.

## Current status
- Concrete cause in hook layer:
  - preload progress used to be vulnerable to stale async settle paths from an older preload run continuing after `reset()` / restart
  - progress accounting also needed hard clamping against queue mutations during an active run
- Current hook-side mitigation in worktree:
  - per-run `activeRunIdRef` gates stale async completions
  - callback refs prevent callback identity churn from re-binding async paths mid-run
  - progress uses safe clamped loaded/total values before notifying state/callbacks
  - targeted tests cover active-run URL injection and reset-then-restart overlap
