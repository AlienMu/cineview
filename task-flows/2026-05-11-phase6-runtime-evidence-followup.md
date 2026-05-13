# Task: Phase 6 Runtime Evidence Follow-up

## Goal

- Strengthen the committed `?test=timeline-phase` probe so independent acceptance can capture a complete, repeatable runtime verdict for grouped `timeline.phase`.
- Keep implementation and acceptance separated.

## Linked Flows

- `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-timeline-phase-followup.md`
- `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-animate-semantic-migration.md`

## Reopened Issue

- [ ] Add deterministic page-level runtime evidence for grouped `timeline.phase` progression stages
- [ ] Keep the evidence committed in the probe itself rather than depending on manual timing
- [ ] Re-run independent acceptance on the strengthened probe

## Nodes

- [x] Record the independent `REJECT` result from the previous acceptance pass
- [x] Launch implementation lane for deterministic probe evidence
- [x] Launch separate verification lane for the strengthened probe
- [x] Collect implementation result without self-signing it off
- [x] Collect independent verification result
- [x] Sync the result back into the Phase 6 flows

## Verification

- [x] Independent real-page proof that the baseline probe rises before the shifted grouped-phase probe
- [x] Independent real-page proof that the shifted grouped-phase probe rises later inside its delayed local window
- [x] Independent real-page proof that the visibility-driven probe stays out of the zone budget until viewport entry

## Risks / Blockers

- Manual browser scrolling alone is too timing-sensitive for this acceptance case.
- The follow-up should stay narrowly on the committed runtime evidence surface and avoid re-expanding Phase 6 scope.
- Earlier blocker was reproduced and traced to the committed probe surface itself:
  - under a smaller real-browser viewport and fine-grained `24 x mouse.wheel(0, 180)` sampling, the old probe layout and budget were too large
  - the `ScrollZone` did not reach the intended evidence windows quickly enough, so the board stayed fully `pending` even though the underlying Phase 6 math path was not the direct regression
- Fresh independent acceptance still rejects the tightened probe:
  - focused tests pass independently
  - evidence board attributes are present independently
  - but acceptance cannot independently establish the required real-page proof because the committed probe still relies on external/manual/automation driving rather than exposing a self-contained in-page runtime proof path
- Fresh independent acceptance also rejects the new page-owned proof runner:
  - independent tests and build pass
  - proof runner and proof attributes exist on the committed page
  - but in independent real-page execution the final DOM still reads:
    - `data-phase-proof-status="fail"`
    - `data-phase-evidence-baseline-first="pass"`
    - `data-phase-evidence-shifted-late="pending"`
    - `data-phase-evidence-visibility-independent="pass"`
  - so the remaining blocker is now isolated to the auto proof runner not driving the shifted grouped-phase evidence to completion
- Current operational blocker:
  - the implementation lane has returned a latest fix for the `shifted-late` auto-runner failure
  - but the designated independent acceptance lane (`Kierkegaard`) has not yet returned a fresh verdict on that latest fix despite multiple explicit collection attempts
  - under project rules, this node cannot be self-signed in the main thread while the independent acceptance verdict is still missing
- Fresh independent acceptance has now returned again and still rejects the latest auto-proof-runner build:
  - build passes independently
  - diff scope still appears limited to the committed probe / proof surface
  - but final real-page DOM read now shows the auto proof did not complete at all:
    - `data-phase-proof-mode="auto"`
    - `data-phase-proof-status="fail"`
    - `data-phase-evidence-baseline-first="pending"`
    - `data-phase-evidence-shifted-late="pending"`
    - `data-phase-evidence-visibility-independent="pending"`
  - so the blocker has widened back from a `shifted-late`-only failure to an auto-runner bootstrap / progression failure in independent real-page execution
- Latest implementation follow-up narrows that bootstrap/progression failure again:
  - implementation root cause: the page-owned runner still depended on a fragile one-shot timer chain and stage-local cleanup behavior
  - implementation now claims the runner is a continuous heartbeat state machine with explicit `stageIndex`, `stageStep`, and `attempt` tracking
  - local no-external-wheel polling now reportedly ends at:
    - `data-phase-proof-mode="auto"`
    - `data-phase-proof-status="pass"`
    - `data-phase-evidence-baseline-first="pass"`
    - `data-phase-evidence-shifted-late="pass"`
    - `data-phase-evidence-visibility-independent="pass"`
  - independent acceptance on this newest runner shape is still pending
- Fresh independent acceptance has now returned on the heartbeat-based runner and still rejects it:
  - independent build passes
  - independent `timelinePhaseEvidence` test passes
  - diff scope still appears limited to committed probe / proof surface
  - but final real-page DOM read is still not correct:
    - `data-phase-proof-mode="auto"`
    - `data-phase-proof-status="fail"`
    - `data-phase-evidence-baseline-first="pending"`
    - `data-phase-evidence-shifted-late="pending"`
    - `data-phase-evidence-visibility-independent="pass"`
  - so the remaining blocker is now specifically a real-page auto-run divergence where visibility completes but the scroll-driven baseline/shifted proof path does not
- Latest implementation follow-up narrows that divergence further:
  - implementation root cause: the committed page still had two unsynchronized evidence clocks
    - the board latched from passive rAF observation
    - the auto proof runner progressed by its own staged timer/heartbeat flow while only watching the passive board outputs
  - in independent real-page timing, visibility could still pass from viewport geometry alone while the scroll-driven baseline/shifted proof never got committed by the passive board in time
  - implementation now claims the proof runner reads the live DOM probes directly (opacity + rect) and commits evidence through the same reducer the board shows, so the page-owned proof and the displayed verdicts share one evidence clock
  - local preview proof on `http://127.0.0.1:4181/?test=timeline-phase` now reportedly ends at:
    - `data-phase-proof-mode="auto"`
    - `data-phase-proof-status="pass"`
    - all three `data-phase-evidence-*="pass"`
  - independent acceptance on this direct-DOM-sampling proof surface is now pending
- Fresh independent acceptance has now returned on the direct-DOM-sampling proof surface and still rejects it:
  - independent `timelinePhaseEvidence` tests pass
  - independent example build passes
  - diff scope still appears limited to committed probe / proof surface
  - but final real-page DOM read on `http://127.0.0.1:4181/?test=timeline-phase` still shows the page-owned proof is stalled:
    - `data-phase-proof-mode="auto"`
    - `data-phase-proof-status="running"`
    - `data-phase-evidence-baseline-first="pending"`
    - `data-phase-evidence-shifted-late="pending"`
    - `data-phase-evidence-visibility-independent="pending"`
  - so the remaining blocker is now an auto-proof bootstrap/commit stall on the direct-DOM-sampling path itself
- Latest implementation follow-up narrows that stall to one remaining bootstrap coupling:
  - implementation root cause: although proof evidence sampling had moved to direct DOM reads, the auto proof runner still refused to start until `passiveEvidence.sampleCount >= 2`
  - that left a hidden dependency on the passive rAF sampling chain, so independent headless timing could still strand the proof in `running` with all evidence left at initial `pending`
  - implementation now claims:
    - bootstrap no longer depends on passive sample count
    - proof starts once the CineView container and probe DOM nodes are ready
    - `data-phase-proof-stage` exposes the runner stage directly
    - local verification passes both in normal headless mode and in an intentionally frozen-`requestAnimationFrame` harness
  - fresh independent acceptance on this decoupled bootstrap path is pending
- Fresh independent acceptance has now responded on the decoupled-bootstrap path, but the requested preview target was unreachable during validation:
  - independent `timelinePhaseEvidence` tests pass
  - independent example build passes
  - diff scope still appears limited to committed probe / proof surface
  - but `http://127.0.0.1:4182/?test=timeline-phase` was not reachable during acceptance:
    - `curl -I http://127.0.0.1:4182/?test=timeline-phase` failed with connection refusal
    - real Chrome headless therefore could not read final DOM attributes from the requested preview target
  - this blocks independent confirmation of:
    - `data-phase-proof-mode`
    - `data-phase-proof-status`
    - `data-phase-proof-stage`
    - all three `data-phase-evidence-*` verdicts
  - current blocker is therefore preview availability for acceptance, not a newly established runtime regression
- Fresh independent acceptance has now rerun against a reachable preview target and passes:
  - `curl -I 'http://127.0.0.1:4182/?test=timeline-phase'` returned `HTTP/1.1 200 OK`
  - real Chrome headless final DOM read returned:
    - `data-phase-proof-mode="auto"`
    - `data-phase-proof-status="pass"`
    - `data-phase-proof-stage="complete"`
    - `data-phase-evidence-baseline-first="pass"`
    - `data-phase-evidence-shifted-late="pass"`
    - `data-phase-evidence-visibility-independent="pass"`
  - acceptance also rechecked scope and still found no expansion into core Phase 6 semantic files
- Latest narrowed implementation diagnosis:
  - the committed page had two different evidence clocks:
    - the visible board latched from the passive React `requestAnimationFrame` sampler
    - the auto proof runner advanced its staged wheel loop while only consulting that passive evidence state
  - in local runs those clocks usually stayed close enough, but in the independent real-page run they could diverge:
    - visibility could still pass from passive viewport geometry
    - baseline / shifted could remain `pending` because the runner exhausted its staged scroll-driving loop before the passive board had observed and committed the scroll-driven samples
  - the follow-up stays narrow by fixing only the committed probe surface:
    - the page-owned proof runner now reads probe DOM metrics directly and latches its own evidence with the same pure reducer
    - the board now exposes the merged result of passive sampling plus proof-runner direct sampling, so acceptance reads the page’s own committed final evidence rather than a scheduler race between two internal observers
- Fresh independent acceptance has now returned on that direct-DOM version and still rejects it:
  - independent runtime tests pass
  - independent example build passes
  - independent real Chrome headless final DOM still stalls at:
    - `data-phase-proof-mode="auto"`
    - `data-phase-proof-status="running"`
    - `data-phase-evidence-baseline-first="pending"`
    - `data-phase-evidence-shifted-late="pending"`
    - `data-phase-evidence-visibility-independent="pending"`
  - narrowed root cause from implementation:
    - even after moving evidence latching to direct DOM reads, the proof runner bootstrap still waited for `passiveEvidence.sampleCount >= 2`
    - that meant the supposedly page-owned runner still secretly depended on the passive `requestAnimationFrame` meter loop starting first
    - if independent headless timing throttled or stranded that passive loop, the proof runner never crossed bootstrap, stayed `running`, and never committed any evidence at all

## Implementation Result

- Strengthened the committed probe surface in `/Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test/src/ScrollTimelinePhaseProbe.tsx`:
  - kept the existing runtime scenario narrow (`baseline`, grouped `timeline.phase`, `visibility`)
  - added a fixed evidence board with three latched `PASS/PENDING` checkpoints instead of relying on reading transient opacity values by eye
  - exposed machine-readable DOM attributes:
    - `data-phase-evidence-board="timeline-phase"`
    - `data-phase-evidence-baseline-first`
    - `data-phase-evidence-shifted-late`
    - `data-phase-evidence-visibility-independent`
  - preserved the live opacity meters as supporting telemetry, but made them secondary to the latched verdicts
  - then tightened the probe's own geometry and scale specifically for real automated wheel sampling:
    - reduced pre-zone and post-zone spacer heights
    - reduced card padding / text volume so the `ScrollZone` center-lock is reached earlier on smaller viewports
    - shortened the explicit `ScrollZone` budget from `360` to `180`
    - increased probe-local `modes.scroll.wheelStep` from `0.18` to `0.24`
  - these changes stay inside the committed runtime evidence surface and do not alter the broader Phase 6 runtime semantics
  - then added a committed page-owned proof runner:
    - default page mode is now `data-phase-proof-mode="auto"`
    - the page dispatches its own committed `WheelEvent` samples into the local `cineview` container
    - final proof state is exposed through:
      - `data-phase-proof-status="idle|running|pass|fail"`
      - `data-phase-proof-steps="<n>"`
    - this gives acceptance a self-contained proof path directly on the committed page, without needing to assume any out-of-band wheel automation
  - then hardened the proof runner after the `shifted-late` rejection:
    - converted it into a single-session, stage-aware runner instead of an evidence-change-driven restart loop
    - stages are now:
      1. reach `baseline-first`
      2. reach `shifted-late`
      3. reach `visibility-independent`
    - reset the internal started guard on cleanup so `React.StrictMode` no longer cancels the timer chain and leaves the page stranded mid-proof
- Added a tiny pure helper in `/Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test/src/timelinePhaseEvidence.ts`:
  - centralizes the evidence thresholds and latch rules
  - keeps the page verdict logic deterministic and testable without touching core Phase 6 runtime semantics
- Added minimal proof in `/Users/alienmu/Documents/alien/cineView/cineview/src/__tests__/runtime/timelinePhaseEvidence.test.ts`:
  - covers the intended order:
    1. baseline rises while shifted remains flat
    2. shifted only latches after baseline has already completed
    3. visibility only latches after its own full-visibility condition, staying flat before that
- Latest committed-proof tightening stays inside the same narrow files:
  - `/Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test/src/ScrollTimelinePhaseProbe.tsx`
    - extracted a shared DOM metric reader for the three probe nodes
    - kept the passive live meter sampler, but made the auto proof runner collect its own direct DOM samples instead of waiting on the passive React evidence state to catch up
    - merged passive evidence and proof-runner evidence before writing the board’s `data-phase-evidence-*` attributes
    - widened stage budgets from `16` to `24` samples per phase to tolerate slower headless observation without changing framework semantics
  - `/Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test/src/timelinePhaseEvidence.ts`
    - added `EMPTY_PROBE_METRIC` and `mergeTimelinePhaseEvidence(...)` to support the narrow page-owned proof merge
  - `/Users/alienmu/Documents/alien/cineView/cineview/src/__tests__/runtime/timelinePhaseEvidence.test.ts`
    - added a focused proof that merged passive/proof evidence preserves all three latched checkpoints
- Latest committed-proof tightening after the `running + all pending` rejection:
  - `/Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test/src/ScrollTimelinePhaseProbe.tsx`
    - removed the proof-runner bootstrap dependency on `passiveEvidence.sampleCount`
    - the auto proof now boots as soon as the probe DOM nodes and cineview container exist, using only direct DOM readiness
    - added `data-phase-proof-stage` plus history telemetry for `passive / proof / merged` sample counts so future stalls show whether bootstrap is waiting on passive sampling or proof sampling
    - this stays inside the committed probe / proof surface and still does not alter core Phase 6 semantics

## Files Changed

- `/Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test/src/ScrollTimelinePhaseProbe.tsx`
- `/Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test/src/timelinePhaseEvidence.ts`
- `/Users/alienmu/Documents/alien/cineView/cineview/src/__tests__/runtime/timelinePhaseEvidence.test.ts`
- `/Users/alienmu/Documents/alien/cineView/cineview/task-flows/2026-05-11-phase6-runtime-evidence-followup.md`

## Local Verification Log

- `pnpm test --runTestsByPath src/__tests__/runtime/timelinePhaseEvidence.test.ts`
  - first attempt in `examples/performance-test/src/timelinePhaseEvidence.test.ts`: not picked up by the repo Jest config because `examples/` is outside the configured test roots
  - after moving the tiny proof into `src/__tests__/runtime/`: passed, `1 passed`
  - one intermediate failure tightened the intended order by splitting "baseline done" and "shifted rise" into separate samples, matching the page-latch logic more faithfully
- `pnpm test --runTestsByPath src/__tests__/runtime/timelinePhaseEvidence.test.ts`
  - rerun after the probe-scaling fix: passed again, `1 passed`
- `pnpm test --runTestsByPath src/components/Animate/useAnimateScroll.phase.test.tsx`
  - passed, `1 passed`
- `pnpm --dir examples/performance-test build`
  - passed twice during this follow-up
  - after strengthening the board: emitted `dist/assets/index-D3RZxh0g.js`
  - after the real-wheel probe-scale fix: emitted `dist/assets/index-CuiVXgrV.js`
  - after adding the page-owned proof runner: emitted `dist/assets/index-RyFO2kbh.js`
- `curl -I -s 'http://127.0.0.1:4178/?test=timeline-phase' | head -n 1`
  - returned `HTTP/1.1 200 OK`
- runtime board sampling against the committed probe route:
  - command:
    `ROOT=$(npm exec --yes --package=playwright -- sh -c 'dirname "$(which playwright)"' | sed 's#/node_modules/.bin##'); export ROOT; node <<'EOF' ... require(\`${root}/node_modules/playwright\`) ... goto('http://127.0.0.1:4178/?test=timeline-phase') ... mouse.wheel(...) ... read data-phase-evidence-* plus live metrics ... EOF`
  - result summary:
    - first `baseline-first=pass`: `wheel-7`, with baseline opacity `0.288` and shifted opacity `0.09`
    - first `shifted-late=pass`: `wheel-17`, with baseline opacity `1` already locked and shifted opacity `0.456`
    - first `visibility-independent=pass`: `wheel-20`, after the visibility probe became fully visible and reached opacity `1`, while earlier samples kept it at `0` with `fullyVisible=false`
    - final board state: all three evidence attributes read `pass`
- reproduced main-thread blocker with smaller real-page automation:
  - viewport: `1280x720`
  - interaction: `24 x mouse.wheel(0, 180)`
  - old failing result:
    - final board still read:
      - `data-phase-evidence-baseline-first="pending"`
      - `data-phase-evidence-shifted-late="pending"`
      - `data-phase-evidence-visibility-independent="pending"`
    - history stayed around: `samples: 26 | max shifted before baseline done: 0.06 | max visibility before viewport entry: 0.00`
  - root-cause evidence from the old probe:
    - baseline started around `top: 1055`
    - by `wheel-24`, baseline had only just completed while shifted remained at warmup opacity `0.09`
    - so the issue was probe scale / distance, not just the latch helper
- reran the same real-page automation shape after tightening the probe:
  - viewport: `1280x720`
  - interaction: `24 x mouse.wheel(0, 180)`
  - result summary:
    - first `baseline-first=pass`: `wheel-7`
    - first `shifted-late=pass`: `wheel-10`
    - first `visibility-independent=pass`: `wheel-11`
    - final board state by `wheel-24`:
      - `data-phase-evidence-baseline-first="pass"`
      - `data-phase-evidence-shifted-late="pass"`
      - `data-phase-evidence-visibility-independent="pass"`
    - final history: `samples: 17 | max shifted before baseline done: 0.09 | max visibility before viewport entry: 0.00`
- verified the new page-owned proof path without sending any external wheel input:
  - command:
    `ROOT=$(npm exec --yes --package=playwright -- sh -c 'dirname "$(which playwright)"' | sed 's#/node_modules/.bin##'); export ROOT; node <<'EOF' ... goto('http://127.0.0.1:4178/?test=timeline-phase') ... poll data-phase-proof-status ... EOF`
  - no external `mouse.wheel(...)`, `scrollBy`, or `scrollTo` is used in this verification pass
  - result:
    - older run showed `pass`, but a fresh independent run still found a narrower failure on `shifted-late`
- reproduced and fixed the narrower `shifted-late` auto-runner failure:
  - root cause:
    - the first page-owned runner combined an internal `hasStartedRef` guard with timeout cleanup
    - under the real page lifecycle, cleanup could clear the timer chain while leaving the guard set
    - that stranded the page in an incomplete auto-proof session, which hurt `shifted-late` first because it depends on preserving the baseline-before-shifted ordering window
    - baseline and visibility could still pass independently in some runs because they are easier end-state observations; `shifted-late` is the most order-sensitive latch
  - fixed real-page result with no external wheel input:
    - tick 6: `data-phase-evidence-baseline-first="pass"`
    - tick 10: `data-phase-evidence-shifted-late="pass"`
    - tick 12: `data-phase-evidence-visibility-independent="pass"`
    - tick 13: `data-phase-proof-status="pass"`
  - final DOM:
    - `data-phase-proof-mode="auto"`
    - `data-phase-proof-status="pass"`
    - `data-phase-proof-steps="13"`
    - `data-phase-evidence-baseline-first="pass"`
    - `data-phase-evidence-shifted-late="pass"`
    - `data-phase-evidence-visibility-independent="pass"`
- `pnpm --dir /Users/alienmu/Documents/alien/cineView/cineview test --runTestsByPath src/__tests__/runtime/timelinePhaseEvidence.test.ts`
  - passed after the passive/proof evidence merge update, `2 passed`
- `pnpm --dir /Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test build`
  - passed after the latest probe-only tightening
  - emitted `dist/assets/index-CHji77i7.js`
- `pnpm --dir /Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test preview --host 127.0.0.1 --port 4181`
  - served the rebuilt committed probe at `http://127.0.0.1:4181/?test=timeline-phase`
- real-page auto-proof polling with no external wheel input:
  - command shape: Chrome headless via Playwright, `goto('http://127.0.0.1:4181/?test=timeline-phase', { waitUntil: 'networkidle' })`, then poll only the board DOM attributes every `300ms`
  - result:
    - tick 0: `proofStatus="running"`, `baseline="pass"`, `shifted="pending"`, `visibility="pending"`
    - tick 2: `shifted="pass"`
    - tick 3: `proofStatus="pass"`, `visibility="pass"`
    - stable final DOM thereafter:
      - `data-phase-proof-mode="auto"`
      - `data-phase-proof-status="pass"`
      - `data-phase-evidence-baseline-first="pass"`
      - `data-phase-evidence-shifted-late="pass"`
      - `data-phase-evidence-visibility-independent="pass"`
- real-page final DOM read with no external wheel input:
  - command shape: Chrome headless via Playwright, same URL, wait for `networkidle`, then `waitForTimeout(2500)` and read only the final board attributes
  - result:
    - `{"proofMode":"auto","proofStatus":"pass","baseline":"pass","shifted":"pass","visibility":"pass","proofSteps":"13"}`
- `pnpm --dir /Users/alienmu/Documents/alien/cineView/cineview test --runTestsByPath src/__tests__/runtime/timelinePhaseEvidence.test.ts`
  - passed again after the bootstrap decoupling change, `2 passed`
- `pnpm --dir /Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test build`
  - passed again after the bootstrap decoupling change
  - emitted `dist/assets/index-Dxk5CiA8.js`
- `pnpm --dir /Users/alienmu/Documents/alien/cineView/cineview/examples/performance-test preview --host 127.0.0.1 --port 4182`
  - served the rebuilt committed probe at `http://127.0.0.1:4182/?test=timeline-phase`
- real Chrome headless final DOM read against the rebuilt probe:
  - command shape: local Chrome `--headless=new --virtual-time-budget=6000 --dump-dom 'http://127.0.0.1:4182/?test=timeline-phase'`
  - final DOM now reads:
    - `data-phase-proof-mode="auto"`
    - `data-phase-proof-status="pass"`
    - `data-phase-proof-stage="complete"`
    - `data-phase-evidence-baseline-first="pass"`
    - `data-phase-evidence-shifted-late="pass"`
    - `data-phase-evidence-visibility-independent="pass"`
    - history shows `samples: passive 3 / proof 21 / merged 21`
- local reproduction of the old stall precondition, then confirmation it is now fixed:
  - created a temporary harness page at `/private/tmp/timeline-phase-raf-stalled.html` that freezes `window.requestAnimationFrame` before loading the built probe bundle
  - command shape: local Chrome `--headless=new --disable-web-security --allow-file-access-from-files --virtual-time-budget=7000 --dump-dom 'file:///private/tmp/timeline-phase-raf-stalled.html?test=timeline-phase'`
  - result on the fixed build:
    - final DOM still reaches:
      - `data-phase-proof-status="pass"`
      - `data-phase-proof-stage="complete"`
      - all three `data-phase-evidence-*="pass"`
    - history shows `samples: passive 0 / proof 22 / merged 22`
  - this demonstrates the original stall source directly: the proof runner no longer needs the passive rAF sampler to bootstrap or commit evidence

## Current Status

- Opened after independent acceptance rejected the previous follow-up due to incomplete continuous runtime evidence, not due to a new code-path regression.
- `Carver` has been assigned the deterministic probe-evidence implementation follow-up.
- `Kierkegaard` remains the independent acceptance lane for the strengthened probe after implementation lands.
- Implementation lane stayed narrow on the committed probe surface only (`ScrollTimelinePhaseProbe.tsx`, pure helper telemetry, minimal proof).
- The strengthened probe now exposes deterministic page-level verdicts for all three acceptance checkpoints, and local runtime sampling reads them successfully from the real page.
- Fresh independent acceptance has now returned `REJECT` on the tightened probe.
- Acceptance's blocking reason is narrower than the previous one:
  - not a new grouped `timeline.phase` semantic regression
  - not missing evidence board attributes
  - but missing a committed, self-contained page-level proof path that lets acceptance independently confirm the three evidence states without relying on out-of-band automation assumptions
- The committed page now owns that proof path directly through its `auto` proof runner and page-level `data-phase-proof-*` verdicts.
- Fresh independent acceptance has re-run and still returned `REJECT`.
- The blocker is now narrower again:
  - the self-contained proof surface exists
  - but the `auto` proof runner still ends in `data-phase-proof-status="fail"` because `data-phase-evidence-shifted-late` remains `pending`
- The single remaining `shifted-late` auto-runner failure has now been reproduced and fixed inside the committed proof surface.
- The corrected self-contained proof surface has been handed back to the independent acceptance lane.
- Fresh independent acceptance has now returned and still reports `REJECT`.
- Latest independent evidence says the page-owned auto proof runner is not completing in real-page execution and leaves all three evidence attributes at `pending`.
- Latest implementation result has been collected and independently reviewed.
- Fresh independent verdict is still `REJECT`.
- Latest implementation result has been collected and handed back to the independent acceptance lane.
- Fresh independent response has now arrived, but acceptance is blocked by unreachable preview target `127.0.0.1:4182`.
- Reachable preview has been restored and independent acceptance has now returned `ACCEPT`.
- Next executable node: sync this accepted runtime-evidence follow-up back into the broader Phase 6 flow set if any parent flow still lists it as open.
- Latest implementation follow-up stays within the committed probe / proof surface and specifically targets the real-page divergence where visibility passed but scroll-driven evidence stayed pending.
- Local real-page verification now shows the page-owned auto proof settles to full `pass` without any external scroll driving.
- Independent acceptance re-run is still outstanding and must remain separate from this implementation lane.
- Latest implementation follow-up narrows the remaining stall to a hidden bootstrap dependency on passive rAF sampling and removes that dependency.
- Local verification now covers both:
  - normal real Chrome headless final DOM on `http://127.0.0.1:4182/?test=timeline-phase`
  - an artificial rAF-frozen harness that would have stranded the previous bootstrap path
- Independent acceptance re-run on this bootstrap-decoupled proof surface is now the remaining external node.
