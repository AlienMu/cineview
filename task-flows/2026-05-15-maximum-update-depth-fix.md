# Task: Maximum Update Depth Fix

## Goal

- Find and fix the `Maximum update depth exceeded` warning introduced in the current `CineView` runtime/example path.
- Keep the fix narrowly scoped to the self-triggering render/effect loop without regressing scroll mode semantics.

## Nodes

- [x] Read `design.md`
- [x] Read `requirements.md`
- [x] Read `AGENT_SELF_REVIEW.md`
- [x] Inspect the current `CineView` / example effect chains for unstable dependencies or self-triggering state updates
- [x] Reproduce or reason down the exact update loop causing the warning
- [x] Implement the smallest safe fix
- [x] Update task flow with the resolved root cause

## Verification

- [x] Run targeted tests for modified surfaces
- [x] Run the relevant build if the changed code affects shipped runtime/example code
- [x] Perform runtime verification that the warning is gone
- [x] Re-check for remaining unchecked executable nodes
- [ ] Investigate the reported post-scroll `ERR_CONNECTION_REFUSED` runtime evidence
- [ ] Verify whether the dev server is crashing, being stopped, or the browser is reconnecting to a dead session
- [ ] Apply the smallest safe fix if a runtime-side follow-up issue is confirmed
- [ ] Re-run runtime verification against the user-reported failure shape

## Risks / Blockers

- Dirty worktree; do not disturb unrelated in-flight changes.
- The warning may come from an interaction between framework runtime and example wiring, so verification must cover both.

## Resolved Root Cause

- The warning was not caused by the adjacent-image preload sync path.
- The loop came from `ScrollZone` and scroll-driven `Animate` registration effects depending on the full `zoneRuntime` context object.
- `zoneRuntime` changes identity whenever `zoneStates` / `version` updates, so those effects kept unregistering and re-registering zones/animations on state-only runtime updates.
- Re-registration called back into `syncZoneStates()` / `updateZoneStatesRef()`, which repeatedly hit `setZoneStates(...)` and tripped React's maximum update depth guard.
- The fix narrowed those effect dependencies to the stable registration callbacks plus the real authoring inputs, so runtime state refreshes no longer look like registration changes.

## Current Status

- Reopened: user reported fresh runtime evidence after scroll; investigating whether this is a separate dev-server/runtime failure or a remaining app-side loop.
