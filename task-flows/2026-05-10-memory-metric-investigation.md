# Task: Memory Metric Jump Investigation

## Goal

- Investigate why the displayed `Memory` metric jumps sharply, for example from `16` to `100` and back to `16`.
- Determine whether the cause is framework sampling, browser API behavior, example-page polling, or a real runtime regression.
- Use this file as the source of truth for this investigation round.

## Nodes

- [x] Re-read `AGENTS.md`
- [x] Re-read `AGENT_SELF_REVIEW.md`
- [x] Create a dedicated task flow for this investigation
- [x] Locate the source of the `Memory` metric in framework code and example code
- [x] Start separate implementation and verification lanes
- [x] Reproduce or trace the memory jump on a real example page
- [x] Identify the concrete cause of the jump
- [x] Implement the minimal fix if the cause is in framework/example code
- [x] Run targeted verification for the changed code
- [ ] Run independent runtime/code-review acceptance

## Verification

- [x] Relevant targeted tests pass
- [x] TypeScript compile passes if code changes are made
- [ ] Real runtime verification confirms the memory metric behavior

## Risks / Blockers

- Browser-provided memory APIs may be noisy or non-standard, so the issue may be partly due to sampling semantics rather than a direct framework bug.
- Example pages may poll too frequently and magnify noise.
- A real leak/regression is still possible and must not be ruled out before tracing the source.

## Current Status

- Root cause identified in code:
  - browser `performance.memory.usedJSHeapSize` is inherently noisy and reflects transient allocation / GC behavior
  - framework sampling made that noise worse because `getMetrics()` mutated the memory smoothing window on every read
  - example polling cadence therefore directly changed the displayed memory curve instead of only reading a cached metric
- Latest code changes:
  - `src/utils/performanceMonitor.ts` now samples memory on a fixed cadence, caches the result, and exposes a median-smoothed heap value
  - `src/utils/performanceMonitor.ts` no longer changes memory smoothing state on every `getMetrics()` read
  - `src/utils/performanceMonitor.test.ts` now covers read-decoupled sampling plus short-term spike smoothing
- Latest local verification:
  - `pnpm test -- --runInBand src/utils/performanceMonitor.test.ts`
  - `pnpm exec tsc --noEmit`
- Independent runtime/code-review acceptance is still pending; agent timeouts do not count as sign-off.
