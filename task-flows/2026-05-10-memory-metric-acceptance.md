# Memory Metric Runtime Acceptance

## Goal

Use the live performance example page(s) to verify whether the displayed `Memory` metric is reading raw browser heap usage and whether visible jumps are sampling jitter rather than framework-induced miscalculation.

## Node Checklist

- [x] Re-read `AGENTS.md`
- [x] Re-read `AGENT_SELF_REVIEW.md`
- [x] Re-read `task-flows/2026-05-10-code-migration-execution.md`
- [x] Inspect the live performance page runtime for the displayed `Memory` metric
- [x] Compare displayed `Memory` values against raw browser heap values over time
- [x] Record exact reproduction notes and classify the behavior

## Verification Checklist

- [x] Exact page URL(s) used are recorded
- [x] No code changes were made
- [x] Conclusion distinguishes raw browser memory jitter from framework miscalculation

## Risks / Blockers

- The browser heap API may be unavailable in some contexts; if so, the result must say that clearly instead of guessing.

## Current Status

- Completed: runtime verification of the live `Memory` metric behavior on the performance example.
