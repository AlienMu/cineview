# Task: Scroll / Content Performance Remediation

## Goal

- Reduce unacceptable CPU usage in `CineView` scroll/content mode without breaking the root-first scroll runtime model.
- Remove the most expensive always-on runtime work first, then verify behavior, tests, and example runtime.

## Requirements

- Preserve the root-first `CineView mode="scroll"` architecture from `design.md` and `requirements.md`.
- Preserve scroll mode semantics: real document flow first, local scroll takeover second.
- Preserve `Scene` support for content-driven height; do not reintroduce a hard default `min-height: 100vh`.
- Reduce steady-state CPU cost when the page is idle.
- Reduce per-scroll-tick layout work by avoiding repeated DOM-wide measurement and observer churn.
- Keep changes scoped to scroll/content performance remediation and directly related example monitor behavior.

## Rules

- Use this file as the execution source of truth for this task.
- Re-read this file after each completed node and continue unless blocked.
- Do not revert unrelated user/worktree changes.
- Prefer the smallest safe implementation slice that materially lowers CPU before attempting deeper refactors.
- Do not conclude the task without explicit verification evidence.
- For visually sensitive frontend work, run targeted tests, relevant builds, and a runtime check before declaring completion.

## Non-Goals

- No broad API redesign in this task.
- No opportunistic cleanup outside scroll/content performance work.
- No attempt to solve every possible future virtualization feature in the first pass.

## Task Flow

### Phase 0 - Setup

- [x] Read `design.md`
- [x] Read `requirements.md`
- [x] Read `AGENT_SELF_REVIEW.md`
- [x] Create this task-flow file with requirements, rules, and acceptance criteria

### Phase 1 - Audit-to-Plan Translation

- [x] Map the audited hotspots to concrete implementation slices in `CineView`
- [x] Choose the first remediation slice that gives immediate CPU relief with low semantic risk
- [x] Record the exact files and behaviors that will change in this task

### Phase 2 - Implementation

- [x] Remove or gate always-on performance monitoring in the performance example
- [x] Replace subtree-wide scene measurement observation with a narrower strategy
- [x] Remove always-on subtree mutation observation for scroll/content measurement
- [x] Keep scroll scene measurement behavior functionally correct for content-sized scenes after the narrower observation strategy

### Phase 3 - Verification

- [x] Run targeted tests for modified framework/example surfaces
- [x] Run framework build
- [x] Run performance-test example build
- [x] Perform runtime verification for the scroll/content example behavior after the remediation
- [x] Re-check this file and confirm no executable node remains unchecked

## Acceptance Criteria

- Idle page CPU load is materially reduced versus the prior always-on observer design.
- Scroll/content mode no longer attaches `ResizeObserver` to every descendant element in a scene subtree.
- Scroll/content mode no longer keeps a subtree `MutationObserver` running for general layout tracking.
- The performance example no longer forces always-on monitoring unless the remediation explicitly keeps a narrower version for a verified reason.
- Content-sized scroll scenes still measure and render correctly after the narrower observation strategy.
- Tests/builds relevant to the changed code pass.

## Risks / Blockers

- Existing worktree is dirty; unrelated files must remain untouched.
- Scroll/content layout semantics are fragile; verification must separate code confidence from runtime confidence.

## Current Status

- Complete: first-pass remediation implemented and verified; ready for user review.
