# Task: Load Progress Jump Investigation

## Goal

- Investigate why the displayed `Load Progress` can jump to values like `100%` and `150%`.
- Determine whether the issue is caused by the preloader, framework callback semantics, or example-page display logic.
- Use this file as the source of truth for this investigation round.

## Nodes

- [x] Re-read `AGENTS.md`
- [x] Re-read `AGENT_SELF_REVIEW.md`
- [x] Create a dedicated task flow for this investigation
- [x] Locate the full `Load Progress` data path in framework code and example code
- [x] Start separate implementation and verification lanes
- [x] Identify the concrete cause of the jump
- [x] Implement the minimal fix if the cause is in framework/example code
- [x] Run targeted verification for the changed code
- [x] Run independent runtime/code-review acceptance

## Verification

- [x] Relevant targeted tests pass
- [x] TypeScript compile passes if code changes are made
- [x] Real runtime verification confirms load-progress behavior

## Risks / Blockers

- The issue may be a display bug rather than a framework-core loading bug.
- Multiple example pages may apply different assumptions to the same callback payload.

## Current Status

- Cause identified and patch landed. Concrete cause: preload progress belonged to no stable batch boundary, and CineView's mount/init preload effect was coupled to unstable external callback identities such as inline `onLoadProgress` handlers. That combination allowed preload lifecycle restarts and stale progress events to corrupt the current UI. Targeted tests pass, `tsc --noEmit` passes, the localhost StrictMode page reloads without showing `>100%`, and the independent verification lane agrees the fix is aimed at the right root cause. Residual watch-items remain around duplicate-URL abort bookkeeping and deeper reload stress cases.
