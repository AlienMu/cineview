# Task: Takeover Second Replay Repair

## Goal

- Fix the user-reported regression where takeover animations did not appear on second forward/backward passes after a scene had already run.
- Preserve the no-`preAnchor` decision for scenes 03 and 05.
- Keep wheel, native scroll reconciliation, keyboard, and custom scrollbar paths aligned for `replayOnReenter`.

## Rules

- Start from a failing public-behavior test before implementation.
- Do not claim real runtime verification unless the browser page is actually sampled with real input.
- Treat independent review findings as hard failures until covered by tests or explicitly blocked.
- Do not restore duplicate authored title owners.

## Execution Log

- `2026-06-06 red`: Added a failing DirectScroll proof for an exit-capable phased takeover after reverse re-entry. Failure reproduced at `progressPx 61.4` where the next forward pass should have restarted near enter progress.
- `2026-06-06 wheel/native fix`: Added runtime bookkeeping for reverse scene re-entry so the next forward replay starts from `0`, and clears the marker after forward restart, full reverse rewind, `goToZone`, or unregister.
- `2026-06-06 review`: Independent review flagged that the custom scrollbar synthetic path did not maintain the new replay marker. This was promoted to a new failing test.
- `2026-06-06 scrollbar red`: Added a scrollbar overlay regression proving a completed takeover reversed through the synthetic path resumed around `62` on the next forward wheel instead of restarting below `30`.
- `2026-06-06 scrollbar fix`: Mirrored replay marker maintenance in `applySyntheticGlobalOffset`, including forward restart from the current synthetic delta and marker cleanup.
- `2026-06-06 browser`: Refreshed `http://127.0.0.1:3000/#/scroll` and sampled real wheel input through 03 and 05. Observed second-forward replay restarting from low progress:
  - 05 scenario second forward: `77.3 -> 154.6 -> 231.9`, copy opacity `0.2317 -> 0.4634 -> 0.6951`.
  - 03 specs second forward: `77.3 -> 154.6 -> 232.0`, copy opacity `0.2202 -> 0.4405 -> 0.6607`.

## Verification

- [x] `pnpm test -- src/components/CineView/DirectScrollCineView.test.tsx --runInBand -t "exit-capable phased takeover"` red before fix, green after fix.
- [x] `pnpm test -- src/components/CineView/DirectScrollCineView.test.tsx --runInBand -t "scrollbar reverse re-entry"` red before scrollbar fix, green after fix.
- [x] `pnpm test -- src/components/CineView/DirectScrollCineView.test.tsx --runInBand`
- [x] `pnpm test -- src/components/Animate/useAnimateScroll.phase.test.tsx --runInBand`
- [x] `pnpm --dir examples/performance-test test -- src/components/ScrollScenes.test.tsx`
- [x] `pnpm exec tsc --noEmit`
- [x] `pnpm exec prettier --check src/components/CineView/DirectScrollCineView.tsx src/components/CineView/DirectScrollCineView.test.tsx`
- [x] Real browser wheel sampling on `#/scroll` for first forward, reverse re-entry, and second forward replay across 03 and 05.

## Remaining Notes

- The in-app browser read-only evaluation environment could not synthesize `MouseEvent`; the custom scrollbar path is covered by component-level overlay tests, while the real browser pass used actual wheel input.
