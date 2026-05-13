# Example Runtime Acceptance

## Goal

Diagnose the example runtime path issue causing Vite overlay import failures, verify whether the problem is isolated or systemic across example apps, and define the smallest real-page acceptance path after repair.

## Node Checklist

- [x] Read project rules and relevant docs (`AGENTS.md`, `AGENT_SELF_REVIEW.md`, `design.md`, `requirements.md`)
- [x] Inspect example entry files, package manifests, and Vite configs for `simple-test`, `drag-mode-test`, and `performance-test`
- [x] Inspect installed dependency links and workspace/runtime resolution behavior across the three examples
- [x] Reproduce the current runtime failure in a real browser session
- [x] Determine whether there is a unified example runtime path problem or an example-specific misconfiguration
- [x] Define the minimal repair recommendation for runtime-path consistency
- [x] Define the real-page acceptance checklist to run after the repair

## Verification Checklist

- [ ] Confirm the failing page and exact overlay/error text
- [x] Confirm whether `simple-test`, `drag-mode-test`, and `performance-test` resolve `cineview` consistently
- [x] Confirm whether at least one healthy example loads in the browser
- [x] Confirm whether diagnosis is based on both code inspection and live runtime evidence

## Risks / Blockers

- Browser-use backend was unavailable during this pass, so browser evidence came from Chrome desktop inspection plus HTTP/dev-server inspection.
- `simple-test` package manifest and on-disk installation are out of sync; current package file uses `link:../../`, but local `node_modules` lacks the expected installed toolchain.
- The exact earlier Vite overlay text was reported by the main thread and was not re-captured verbatim in this pass because the local state had already drifted by the time of inspection.

## Current Status

- Acceptance diagnosis complete; ready to hand repair recommendation to the implementation thread.
