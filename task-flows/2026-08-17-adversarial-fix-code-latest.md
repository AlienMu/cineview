# 2026-08-17 Adversarial Fix Code Review (Latest)

## Verdict

**FAIL.** The exact `ended + reverse scroll` recovery, released-video source recovery,
ordinary stagger rerender, keyed-store `Animate` consumption, and timer helper defects are
substantially fixed. The current `4660d96` worktree still has confirmed P1 failures in media
event generation isolation, the broader scroll React hot path, `BackgroundRibbon`, and
Scene5 lifecycle/visual/accessibility behavior. The first four site blockers and the Scene5
reopen regression are introduced by this worktree; the static `PhoneMockup` reduced-motion
snapshot is an existing P2 debt.

This is a code review, not browser acceptance. The browser lane produced no screenshots,
frame-cadence, focus-traversal, or long-task evidence, so no visual/performance PASS is
claimed.

## Scope And Nodes

- [x] Read `DESIGN.md`, `CLAUDE.md`, `AGENTS.md`, and `AGENT_SELF_REVIEW.md`.
- [x] Review `HEAD 4660d96` plus the current dirty worktree without reverting user changes.
- [x] Re-read every target implementation and its current tests; do not inherit stale reports.
- [x] Check behavior, ownership, races, semantic changes, uncovered paths, and dead/partial code.
- [x] Run focused tests, type checks, and whitespace validation.
- [x] Independently confirm the site review counterexamples against current source.
- [x] Re-read this report and verify that this lane changed no production file.

## Stale-Report Corrections

- The old `BackgroundRibbon` custom-rAF finding is obsolete: current
  `site/src/components/BackgroundRibbon.tsx:38-98` has no rAF. Its current failures are
  container lifetime and leaked root variables, described below.
- The old direct `framer-motion` import finding is obsolete: current
  `site/src/components/temporal-drag/TemporalMotion.tsx:1-68` uses
  `useSyncExternalStore` and supports modern/legacy `matchMedia` listeners.
- The old empty-`zoneStates` infinite-gate finding is fixed: the production provider exposes
  the stable keyed store (`useScrollZoneRegistry.ts:237-247`), `Animate` preserves it
  (`Animate.tsx:524-534`), and `useAnimateScroll.ts:258-354,1072-1156` consumes its
  `MotionValue`. `useAnimateScroll.hotpath.test.tsx:106-148` now covers that provider shape.
- Current Scene5 `finished` **does** call `clearSplitTimers()`
  (`Scene5Cinema.tsx:448-453`). The current bug is that an offscreen `finished` cancels the
  only pending cleanup, not that an old cleanup remains armed.

## Remediation Matrix

| Review item | Current result | Verdict |
| --- | --- | --- |
| Scroll `Animate` keyed-store/effect churn | The hook now receives continuous progress through a `MotionValue`; React state changes only at the discrete infinite gate. Active Scene snapshots still cross React every progress frame. | **FAIL (partial)** |
| Scroll/visibility reverse reclaim after `ended` or `play-rejected` | Hysteresis/reclaim logic at `videoPlaybackOwnership.ts:140-149` and its tests now cover all three position-driven sources. Native terminal events still lack activation/source tokens. | **FAIL (partial)** |
| Released video source swap / `releaseOnLeave` disable | `VideoFrameRenderer.tsx:131-166,231-235,389-406` and `AnimateVideo.tsx:118-151` restore the source and reset ownership; source-swap/policy tests exist. | **PASS** |
| Stagger ordinary rerender | One timer is owned by each committed `animate` phase (`StaggerContainer.tsx:104-131`); ordinary scroll/drag rerenders retain authored timing and the stagger tail is budgeted. | **PASS with P2 batch-edge gap** |
| Scene5 duplicate unfinished timer ownership | `lastWinsTimerSequence` removes the original overlapping-timer race, but `finished` versus offscreen freeze remains wrong and reopen semantics regress. | **FAIL** |
| Site animation-boundary cleanup | No DOM rAF and no runtime Framer import remain, but replacement behavior has functional and accessibility failures. | **FAIL** |

## Findings

### F1 [P1] Untagged stale `media-ended` can poison a new media activation

`VideoPlaybackOwnershipEvent` tags play promises but defines `media-ended` without an
activation/source token (`src/media/videoPlaybackOwnership.ts:35-43`). The reducer accepts it
unconditionally and latches the endpoint (`:281-288`). `VideoFrameRenderer` resets ownership
on source changes (`src/media/VideoFrameRenderer.tsx:231-235`), but its DOM handler dispatches
an untagged event (`:374-386`).

Reachable sequence: source A reaches native playback; source B replaces it and creates a new
activation; a queued A `ended` event lands on the retained `<video>` node; B is changed to
`ended/endpointLatched`. A B frame at progress `1` cannot reclaim until it leaves the 2%
hysteresis band, so endpoint autoplay/reveal can remain stuck. This violates DESIGN
`1249-1256`, which requires stale promise/ended/reactivation isolation by request/activation
token. Existing tests cover tagged stale play promises, not stale native terminal events.

### F2 [P1 performance] Scene progress still rerenders the active Scene subtree per frame

The keyed store fixes per-`Animate` effect churn, but it does not close the broader hot-path
finding. `useScrollSceneSnapshots.ts:169-182,194-252` marks intersecting/active scenes dirty
and publishes changed timeline snapshots as native offset changes. `ScrollSceneSlot.tsx:132-219`
then rerenders, clones `Scene`, and allocates new `sceneRuntime`/`scrollRuntime` objects.
`Scene.tsx:466-505,534-578` consumes changing timeline/visibility inputs and can rerender its
subtree. This is a React projection of the single scroll owner, not a second progress writer,
but it remains React work on every active scroll frame. The hook-only hot-path test cannot
observe this production parent path; no profiler/long-task evidence exists.

### F3 [P1, introduced] `BackgroundRibbon` loses same-route replacement scroll containers

The component attaches to the first `[data-cineview-container]`, then disconnects its
`MutationObserver` (`site/src/components/BackgroundRibbon.tsx:71-84`). Its effect reruns only
when `pathname` changes (`:86-98`). `/demo` replaces `DragDemo` with `ScrollDemo` under the
same pathname (`site/src/pages/DemoPage.tsx:133-158`), so the listener stays on the detached
drag container and the new scroll container never drives the LUT. The background/accent
silently stops following progress. `BackgroundRibbon.tsx` is new in this worktree, so this
blocks the current site/background objective.

### F4 [P1, introduced] `BackgroundRibbon` leaks homepage colors across routes

Scroll writes four inline properties to `document.documentElement.style`
(`BackgroundRibbon.tsx:47-58`), while cleanup only disconnects observers/listeners
(`:92-97`). After scrolling the homepage and navigating to `/docs`, there may be no CineView
container and therefore no corrective write; the stale inline values continue to override
the non-home defaults in `site/src/design/tokens.css:17-25`.

### F5 [P1, introduced] Offscreen `finished` cancels Scene5's only freeze/unmount

Leaving a live Scene5 sets `freezePending` and arms the 700/1400 ms freeze sequence
(`site/src/components/Scene5Cinema.tsx:516-558`). Before unmount, a delayed, still-valid iframe
`cineview-embed-finished` message passes the source/origin checks and unconditionally calls
`clearSplitTimers()` (`:431-453`). If the scene remains offscreen, no new intersection edge is
guaranteed, so the iframe, live stage, and closing latch can remain resident indefinitely.
The last-wins helper correctly suppresses stale callbacks; the policy cancels the correct
current callback. This directly fails the timer/resource-ownership remediation.

### F6 [P1 visual, introduced] `unfinished` drops the CSS transform mid-animation

The handler preserves computed `visibility` but sets `animation='none'` without freezing
computed `transform` (`Scene5Cinema.tsx:465-485`). The title/subtitle/CTA keyframes own
`translateY(14px) -> none` and include delayed backwards fill
(`site/src/components/Scene5Cinema.css:372-407`). An `unfinished` during a delay or rise
therefore snaps the element to static `transform:none` before its staggered manual-opacity
exit. Timer-generation tests cannot detect this visual discontinuity.

### F7 [P1 accessibility, introduced] Collapsed Scene5 links remain keyboard-focusable

At progress below `.90`, `handleProgress` clears only `split`, leaving `closing` mounted
(`Scene5Cinema.tsx:410-424`). The CTA/footer links remain in the DOM (`:693-764`); their parent
gets only `aria-hidden`, while CSS reduces its width to zero and clips overflow
(`Scene5Cinema.css:165-178`). Neither mechanism removes descendants from sequential focus.
Keyboard users can focus invisible links and navigate unexpectedly. The new CTA/footer flow
needs `inert`, conditional mounting after exit, or explicit tab-stop control.

### F8 [P1 visual, introduced] Closing reopen bypasses the authored four-beat sequence

`handleProgress` reopens an existing closing latch at `.95` with only `setSplit(true)`
(`Scene5Cinema.tsx:410-424`). Counterexample: `finished` mounts closing; reverse to `.89`
collapses the column; wait past the 1.1/1.35/1.7/2.0 s CSS delays while it is hidden; forward
to `.95`. The same nodes are revealed with completed animations, so all content appears at
terminal state instead of replaying after the phone move. This contradicts the strict
sequence documented at `Scene5Cinema.css:357-370`. The same stale comments at
`Scene5Cinema.tsx:513-515` still claim only `finished` can reopen.

### F9 [P2, existing] Reduced-motion has two owners

`TemporalMotion` itself is now dynamic, but `site/src/components/PhoneMockup.tsx:5-8` caches
the media-query result at module load and permanently chooses whether to mount two
`infiniteAnimation` lanes (`:31-60`). Changing the OS preference while Scene5 stays mounted
does not stop/start glow and breathe. Similar module snapshots remain elsewhere. This is
existing debt (PhoneMockup is unchanged relative to HEAD), not a blocker introduced by the
core fixes, but it prevents a site-wide reduced-motion PASS.

### F10 [P2 coverage/race] Batched settled stagger reentry is not reset

The original ordinary-rerender defect is fixed. A remaining edge is `animate -> exit ->
animate` emitted synchronously after `settled=true`: React can batch both `setPhase` calls and
commit the same final `animate` value, so the `[phase]` effect at
`StaggerContainer.tsx:114-129` never observes exit and `settled` stays true. The test at
`StaggerContainer.test.tsx:360-380` exercises exit/reentry before settlement, not this case.
This is a follow-up race/coverage gap, not the reason for the overall FAIL.

## Required Questions

- **Did the fixes solve the original problems?** Residency, exact terminal reverse reclaim,
  keyed `Animate` consumption, ordinary stagger rerenders, and duplicate unfinished timers:
  yes. The broader scroll-hot-path and Scene5 lifecycle goals: no. Media activation isolation
  remains only partially fixed.
- **Did behavior change?** Yes. Same-route demo swaps can stop the global background; root
  colors survive route changes; Scene5 can cancel offscreen cleanup, expose hidden focus
  targets, snap transforms, and reopen without replaying the promised sequence.
- **Second writers/races/timing regressions?** No second scroll progress or `currentTime`
  writer was found. Races remain because native `ended` is unversioned and Scene5 combines
  IntersectionObserver, iframe messages, progress thresholds, CSS clocks, and timer sequences
  without a single lifecycle generation policy. Reduced-motion also has dynamic and static
  owners.
- **Uncovered failures?** Stale native `ended`, parent Scene render count, same-path container
  replacement, root-variable cleanup, offscreen finished/freeze, focus order, mid-animation
  transform continuity, settled batched stagger reentry, and closing replay have no dedicated
  regression test.
- **Dead/redundant/half-finished code?** No old `useSettledInstant` or duplicate media seek
  writer remains. The main half-fixes are hook-only scroll optimization and play-promise-only
  media tokening. Scene5 comments at `410-417` versus `513-515` disagree about who reopens the
  column, which masks the current ownership change.

## Automated Evidence And Limits

- This review lane: focused Jest **5 suites / 78 tests PASS**; `pnpm type-check` PASS;
  `pnpm type-check:site` PASS; `git diff --check` PASS.
- Current shared-worktree validation: full Jest **116 suites / 1541 tests PASS**; lint PASS;
  `build:verify` **14/14 PASS**.
- Those checks do not exercise the counterexamples above. Real-browser acceptance was
  unavailable/out of scope; no scroll/drag visual correctness, focus traversal, frame cadence,
  or long-task claim is made.

## Final Self-Review

- Findings were re-derived from current source; obsolete report claims were explicitly removed.
- Production code and existing dirty worktree changes were not edited by this review.
- Overall verdict remains **FAIL** because confirmed introduced P1 defects block closure.
