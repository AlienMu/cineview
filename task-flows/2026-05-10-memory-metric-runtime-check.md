# Task: Memory Metric Runtime Check

## Goal

- Verify whether the live performance example Memory metric jump is:
  - raw browser heap jitter shown directly, amplified by overlay polling cadence
  - or a true framework-side memory calculation bug
- Do not modify code.

## Node Checklist

- [x] Read `AGENTS.md`
- [x] Locate Memory metric implementation and polling sites
- [x] Sample live performance page memory output
- [x] Correlate runtime output with implementation behavior
- [x] Report reproduction notes only

## Verification Checklist

- [x] Live page sampled
- [x] Code path inspected
- [x] Conclusion tied to both runtime and implementation

## Risks / Blockers

- Browser automation surfaces are limited in this environment, so runtime sampling may use headless Chrome fallback.

## Current Status

- Implementation and polling sites located.
- Runtime sampling completed on the live `scroll-fixed` performance example via headless Chrome fallback.
