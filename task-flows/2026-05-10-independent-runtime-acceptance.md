# Task: Independent Runtime Acceptance

## Goal

- Independently verify the latest cineview migration state on `http://127.0.0.1:3002` without editing code.
- Focus only on remaining concrete issues around:
  - scroll scene sizing below `100vh`
  - root container clamping
  - mixed legacy mode handling
  - grouped transition semantics
  - scroll direction consumption

## Node Checklist

- [x] Read `AGENTS.md`
- [x] Read `AGENT_SELF_REVIEW.md`
- [x] Confirm local runtime target on `127.0.0.1:3002`
- [x] Open the real page and inspect current runtime behavior
- [x] Check browser console/runtime errors and warnings
- [x] Evaluate scroll scene sizing behavior below `100vh`
- [x] Evaluate whether root container still clamps scroll mode
- [x] Evaluate mixed legacy mode handling behavior/risk
- [x] Evaluate grouped transition fallback semantics risk
- [x] Evaluate whether scroll direction config is actually consumed
- [x] Compile concrete findings only

## Verification Checklist

- [x] Real page inspected
- [x] Console/runtime inspected
- [x] Findings tied back to current runtime and code

## Risks / Blockers

- Browser Use backend may be unavailable in this environment; if so, use desktop browser verification and state that fallback explicitly.
- Some issues may require code inspection to explain because not every migration concern is directly visible from the example page.

## Current Status

- Runtime target confirmed on `127.0.0.1:3002`.
- Real-page inspection completed via desktop Chrome fallback because Browser Use IAB backend was unavailable in this environment.
- `127.0.0.1:3002` is a live snap example (`simple-test`), so scroll-specific acceptance required code-backed review in addition to runtime inspection.
