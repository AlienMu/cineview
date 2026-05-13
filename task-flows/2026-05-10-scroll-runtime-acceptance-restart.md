# Task: Scroll Runtime Acceptance Restart

## Goal

- Independently verify the real scroll-mode runtime surface for `cineview`.
- Find the actual scroll-mode example page in the repo or determine that it is missing.
- Perform live browser/runtime checks focused on:
  - scenes smaller than `100vh`
  - scene-scoped fixed layers
  - scroll-mode layout behavior
  - console/runtime errors

## Node Checklist

- [x] Read `AGENTS.md`
- [x] Read `design.md`
- [x] Read `requirements.md`
- [x] Read `task-flows/2026-05-10-code-migration-execution.md`
- [x] Locate real scroll-mode example coverage in the repo
- [x] Start the correct dev runtime if needed
- [x] Open the live scroll-mode page in a browser
- [x] Verify scroll scenes below `100vh`
- [x] Verify scene-scoped fixed layer behavior
- [x] Verify scroll-mode layout and progression behavior
- [x] Check browser console/runtime errors
- [x] Determine whether acceptance is blocked by missing or inadequate example coverage
- [x] Compile concrete findings only

## Verification Checklist

- [x] Live page opened
- [x] Browser/runtime inspected
- [x] Console checked
- [x] Coverage adequacy judged

## Risks / Blockers

- Browser Use IAB backend may be unavailable and require desktop-browser fallback.
- Existing dev servers may already occupy ports and point at the wrong example.

## Current Status

- Documentation read and acceptance restart initialized.
- Scroll example coverage confirmed in `examples/performance-test/src/main.tsx` via `?test=scroll` and `?test=scroll-fixed`.
- Runtime verification completed against a live dev server using headless Chrome fallback.
