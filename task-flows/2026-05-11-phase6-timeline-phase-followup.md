# Task: Phase 6 Timeline Phase Follow-up

## Goal

- Fix the grouped `timeline.phase` runtime failure uncovered by independent Phase 6 acceptance.
- Keep implementation and acceptance separated.

## Linked Flows

- Phase 6 first slice:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-animate-semantic-migration.md`

## Reopened Issue

- [ ] Fix grouped `timeline.phase` so a phased scroll-driven probe actually shifts progression in live runtime instead of remaining effectively stuck
- [ ] Add or adapt focused proof for grouped `timeline.phase` behavior
- [ ] Provide committed runtime evidence for grouped phase behavior, ideally on an in-repo probe/example rather than only an ephemeral harness

## Nodes

- [x] Re-read the Phase 6 failure report and isolate the grouped `timeline.phase` scope
- [x] Audit the current grouped phase calculation path in `useAnimateScroll.ts`
- [x] Launch implementation lane for the grouped phase fix
- [x] Launch separate verification lane for the grouped phase fix
- [x] Collect implementation result without self-signing it off
- [x] Collect independent verification result
- [x] Sync the follow-up and parent Phase 6 flows with the result

## Verification

- [x] Independent proof that grouped `timeline.phase` changes the local progression window rather than leaving the phased probe effectively stuck
- [x] Independent focused test coverage for grouped `timeline.phase`
- [x] Independent committed runtime evidence for grouped phase behavior

## Implementation Result

- Narrow code change in `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/useAnimateScroll.ts`:
  - grouped `timeline.phase.start/end` now resolve inside the animation's own `enterStartPx -> enterEndPx` window instead of multiplying against the viewport-global `totalBudgetPx`
  - explicit phase boundaries are clamped to `0..1`
  - end boundary is still normalized to stay at least `1px` past the resolved start boundary
- Focused proof added in `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/useAnimateScroll.phase.test.tsx`:
  - drives the real scroll hook path through `Animate`
  - uses a viewport state where the phased animation's local budget is only a subsection of the total zone budget
  - proves `phase: { start: 0.5, end: 1 }` maps to local progress `150 -> 200` for a local `100 -> 200` enter window, producing opacity `0`, `0.5`, `1` at the expected scroll positions
- Committed runtime evidence surface added in `/Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test/src/ScrollTimelinePhaseProbe.tsx` and routed from `/Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test/src/main.tsx`:
  - local route: `http://127.0.0.1:4178/?test=timeline-phase`
  - includes one baseline scroll-driven element, one grouped `timeline.phase` element with `waitFor` plus `phase: { start: 0.5, end: 1 }`, and one visibility-driven note outside the `ScrollZone` budget
  - includes a fixed runtime overlay that reads live computed opacity from each probe element so acceptance can verify the progression order directly in the page

## Files Changed

- `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/useAnimateScroll.ts`
- `/Users/alienmu/Documents/alien/cineView/cineview/src/components/Animate/useAnimateScroll.phase.test.tsx`
- `/Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test/src/ScrollTimelinePhaseProbe.tsx`
- `/Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test/src/main.tsx`
- `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-timeline-phase-followup.md`

## Local Verification Log

- `pnpm test --runTestsByPath src/components/Animate/useAnimateScroll.phase.test.tsx`
  - first run: failed because the proof harness still allowed the hook's warmup pre-roll, so the "before local phase start" assertion observed `data-opacity=\"0.063\"` instead of `0`
  - second run: failed because the first mock sampled `MotionValue` only at render time, so the final `progressPx=200` step stayed at `0` in the DOM probe
  - final run after narrowing the harness: passed, `1 passed`
- `pnpm test --runTestsByPath src/components/Animate/useAnimateScroll.warning.test.tsx`
  - passed twice during the follow-up, `4 passed`
- `pnpm --dir examples/performance-test build`
  - passed, Vite production build completed and emitted `dist/assets/index-Bg5zIjB3.js` plus the new route bundle contents
- `pnpm --dir examples/performance-test dev --host 127.0.0.1 --port 4178`
  - started successfully and served the committed probe at `http://127.0.0.1:4178/?test=timeline-phase`
- browser plugin runtime attempt via Node REPL + browser-use (`iab`)
  - blocked by environment: `No Codex IAB backends were discovered`, so local runtime verification fell back to Chrome automation outside the plugin
- runtime sampling command against the committed probe route:
  - command:
    `ROOT=$(npm exec --yes --package=playwright -- sh -c 'dirname "$(which playwright)"' | sed 's#/node_modules/.bin##'); export ROOT; node <<'EOF' ... require(\`${root}/node_modules/playwright\`) ... goto('http://127.0.0.1:4178/?test=timeline-phase') ... mouse.wheel(...) ... read computed opacity for timeline-phase-baseline / timeline-phase-shifted / timeline-phase-visibility-note ... EOF`
  - result summary:
    - baseline probe stayed near warmup opacity `0.09` until the zone locked, then ramped through `0.144 -> 0.288 -> 0.432 -> 0.576 -> 0.72 -> 0.864 -> 1`
    - grouped phase probe stayed pinned near warmup opacity `0.09` through `wheel-15` while baseline had already reached `1`, then only began rising at `wheel-16` (`0.168`), `wheel-17` (`0.456`), `wheel-18` (`0.744`)
    - visibility probe remained `0` before its own viewport entry, then reached `1` by `wheel-5` while the zone-driven probes were still near warmup, confirming it was not consuming the zone budget

## Current Status

- Created from independent runtime acceptance findings for the first Phase 6 slice.
- Current audit suspicion: grouped `timeline.phase` is being projected against `viewportState.totalBudgetPx` as a global zone window instead of being resolved relative to the animation's own budget window, which matches the “stuck phased probe” symptom from runtime acceptance.
- Implementation lane landed the local-window math fix plus focused proof in owned scope (`useAnimateScroll.ts`, focused test, flow notes).
- The committed runtime evidence surface now exists at `examples/performance-test/src/ScrollTimelinePhaseProbe.tsx` and was exercised locally through the served `?test=timeline-phase` route.
- Local runtime evidence now matches the intended behavior: the grouped phase probe remains effectively flat until well after the baseline probe completes, then progresses later inside its own local window, while the visibility-driven note enters on viewport visibility outside the zone budget.
- Independent acceptance initially reopened this follow-up for stronger committed runtime evidence, and that work was completed in:
  - `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-runtime-evidence-followup.md`
- Final independent status is now `ACCEPT`:
  - focused grouped-phase tests pass independently
  - committed runtime evidence now exists on the in-repo probe page
  - fresh real-page acceptance confirmed the delayed grouped `timeline.phase` progression and the visibility-independent path on the committed probe
- This grouped `timeline.phase` follow-up is closed.
