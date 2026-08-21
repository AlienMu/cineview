# 2026-08-16 Adversarial Code Review

## Verdict

**FAIL.** The current commit (`4660d96`) plus working tree contains five concrete
P1 behavior/performance defects in stagger timing, video residency/recovery, scroll
video reverse takeover, scroll hot-path work, and Scene5 timer ownership. Two additional site
animation-boundary violations remain. The independent browser gate is **BLOCKED**:
`/root/independent_validator` received HTTP 429 (`Too Many Requests`, request
`a2c1e3040aa002ae-HKG`) before it could run the required drag/scroll flows. No
visual, frame-cadence, or long-task PASS is claimed.

Production code was not edited during this review. The worktree was already dirty;
all existing production changes and untracked evidence were preserved.

## Review Nodes

- [x] Read governing documents: `DESIGN.md`, `CLAUDE.md`, `AGENT_SELF_REVIEW.md`, and `AGENTS.md`.
- [x] Inspect the current uncommitted diff and recent commit `4660d96`.
- [x] Review `Animate`/`AnimateVideo`, scroll runtime/controller, video ownership, and drag/scroll state ownership.
- [x] Review site animation-boundary constraints and identify concrete counterexamples.
- [x] Re-read changed code, record line-level evidence, and determine the verdict.
- [x] Deliver the findings and validation limits to the parent agent.

## Findings

### [P1] Stagger timing is collapsed by ordinary `animate` rerenders

**Evidence:** `src/components/Animate/StaggerContainer.tsx:34-39, 218-232,
288-300`.

`useSettledInstant` returns `true` whenever two consecutive renders observe
`phase === 'animate'`. It does not know whether the previous stagger has finished,
and it mutates `prevRef.current` during render. `renderStaggerTree` then converts
every child transition to `{ duration: 0, delay: 0 }` at lines 130-137.

This is reachable on the normal scroll path, not only when children or variants
change. `useNativeScrollController` publishes a new zone state for each changed
`progressPx` (`src/components/CineView/useNativeScrollController.ts:245-310`).
`useSceneScrollZoneTimeline` subscribes each scroll `Animate` to that keyed store
(`src/components/Scene/sceneScrollRuntime.tsx:108-125`), and `Animate` rebuilds its
`scrollZoneRuntime` object when the live state changes
(`src/components/Animate/Animate.tsx:291-293, 524-532`).

**Counterexample:** mount a scroll-zone `Animate` with `stagger`. The first positive
scroll frame changes `ScrollStagger` to `animate`; the next progress/store update
rerenders the same component while it is still `animate`. The second render sets
`instant=true`, so the later children lose their authored delays. Any subsequent
ordinary parent/store rerender continues to pass zero-duration transitions. A
concurrent render that is later abandoned can also mutate the ref and incorrectly
affect the next committed render.

**Coverage gap:** the current `StaggerContainer.test.tsx` only tests the pure
`renderStaggerTree` helper (46 lines). The previous 254-line test coverage for
`ScrollStagger`/`DragStagger` phase subscriptions and rerenders was removed in the
working tree. The focused suite passing does not exercise this failure.

### [P1] A released video never recovers after `src` or residency-prop changes

**Evidence:** `src/media/VideoFrameRenderer.tsx:139-173, 193-233, 387-394` and
`src/components/Animate/AnimateVideo.tsx:124-132`.

`release()` sets the component-local `released` state to `true` and removes the
media `src`. The `[src]` effect only leases the new object URL and resets playback
ownership; it never resets `released` to `false`. The rendered `<video>` therefore
continues to receive `src={undefined}` at lines 390-394 even after a new source is
available. Similarly, toggling `releaseOnLeave` off while the approach band remains
`far` runs the residency effect but returns before calling `warmUp()`.

**Counterexamples:**

- Release `/a.mp4`, then rerender the same `VideoFrameRenderer` with `src="/b.mp4"`.
  The new lease may be acquired, but the video remains detached and blank forever.
- Release while `releaseOnLeave` is enabled and the zone is `far`, then toggle the
  prop to `false` without crossing an approach band. No warm-up occurs, so the
  component remains blank until an unrelated band transition happens.

The existing tests cover manual release and warm-up for the same source only
(`src/media/VideoFrameRenderer.test.tsx:528-610`); they do not cover source swaps or
prop toggles.

### [P1] Scroll reverse cannot reclaim a video that reached native `ended`

**Evidence:** `src/media/videoPlaybackOwnership.ts:140-146, 179-183` and
`src/media/VideoFrameRenderer.tsx:316-343`.

`canReclaimTerminalState` permits an `ended` or `play-rejected` state to be reclaimed
only when `frame.source === 'gesture'`. A scroll frame is rejected at line 180.
The only renderer-side activation escape hatch is gated on
`frame.phase === 'entering'` (`VideoFrameRenderer.tsx:325-331`). Authored scroll
lanes do not advance `phaseMotion` in their normal scrub branch
(`src/components/Animate/useAnimateScroll.ts:891-991`), while `Animate` publishes
that value as the timeline frame phase (`src/components/Animate/Animate.tsx:703-713`),
so the escape hatch is normally unreachable for this path.

**Counterexample:** an `AnimateVideo` in a scroll takeover zone with
`scrubRange={[0, 6]}` reaches progress 1 and hands native playback the tail. When
the browser emits `ended`, ownership becomes terminal. Reverse scrolling emits
`source: 'scroll'` frames with progress below 1; the reducer returns without a seek,
and the phase guard does not activate. `currentTime` remains at the terminal frame
through the whole reverse gesture.

The tests cover reverse recovery for a gesture and native-to-framework scroll
takeover, but not `ended + source:'scroll'`
(`src/media/videoPlaybackOwnership.test.ts:319-344, 389-412`). This is also the
known T1 defect recorded in `task-flows/2026-08-16-ponytail-remediation.md`.

### [P1] Active scroll progress crosses React/effect boundaries on every frame

**Evidence:** `src/components/CineView/useNativeScrollController.ts:261-310`,
`src/components/Scene/sceneScrollRuntime.tsx:108-125`,
`src/components/Animate/Animate.tsx:291-293, 524-532`, and
`src/components/Animate/useAnimateScroll.ts:994-1013, 1034-1097`.

During an active zone, `progressPx` changes every native scroll frame, so the keyed
external store notifies every subscribed `Animate`. Each subscriber then causes
`Animate` to create a new `{ ...zoneRuntime, zoneStates: ... }` object. The main
scroll effect and the infinite-gating effect both list that object as a dependency,
so they are torn down and installed again for every frame. With concurrent
`AnimateVideo`, stagger, and infinite lanes this adds repeated effect work and
closure/object allocation directly to the scroll hot path, on top of the intended
MotionValue writes.

This is a static performance finding, not a claim of measured frame loss. The
required browser profiler/long-task observation could not run because the validator
lane was rate-limited. The implementation should keep the per-frame timeline on a
stable MotionValue or otherwise avoid using a newly allocated runtime object as an
effect dependency.

### [P1] Scene5 unfinished timers can close a newly reopened closing layer

**Evidence:** `site/src/components/Scene5Cinema.tsx:439-463`.

Each `cineview-embed-unfinished` appends new opacity and completion timers to
`splitExitTimersRef.current` without first cancelling the existing sequence. Every
completion callback then assigns `splitExitTimersRef.current = []`, which discards
the IDs of any newer sequence.

**Counterexample:**

1. `unfinished` at t=0 schedules sequence A, including completion at t=1050.
2. A second `unfinished` at t=500 schedules sequence B, but leaves A in place.
3. A completes at t=1050 and clears the shared array.
4. `finished` at t=1100 calls `cancelSplitExit`, but B's IDs are no longer reachable,
   then reopens the closing layer.
5. B completes at t=1550 and sets `closing=false`/`split=false`, hiding the freshly
   reopened content.

The child protocol describes repeated finished/unfinished messages as idempotent
(`site/src/components/temporal-drag/TemporalDragExperience.tsx:73-81`), but this
parent handler is not idempotent under rapid reverse/forward commits. No fake-timer
test covers duplicate unfinished messages followed by finished.

### [P2] `BackgroundRibbon` is a DOM/CSS animation loop outside the framework boundary

**Evidence:** `site/src/components/BackgroundRibbon.tsx:38-89`, mounted globally at
`site/src/App.tsx:20-29`.

The component attaches a scroll listener, schedules a custom `requestAnimationFrame`,
and writes four root CSS variables on the homepage scroll path. It has no
`useAnimateTimeline()` source and no phase/idle gate. `AGENTS.md` rule 6 permits
custom rAF only for phase-gated canvas self-drawing; DOM/CSS animation and global
CSS-variable projection are explicitly outside that exemption. This also means the
background continues independently of each scene's phase and cannot be stopped by
scene exit.

This is a conformance and hot-path finding rather than a measured frame-drop claim.
It needs either a documented global-animation exemption or migration to a framework
owned source before the site can be marked compliant.

### [P2] `TemporalMotion` imports runtime Framer Motion directly in a site component

**Evidence:** `site/src/components/temporal-drag/TemporalMotion.tsx:1,25-36`.

`TemporalMotionProvider` imports `useReducedMotion` directly from `framer-motion`.
The strict site boundary in `AGENTS.md` rule 6 forbids direct runtime Framer Motion
imports in site components; only framework timeline outputs (and type-only imports
for canvas consumers) are allowed. No equivalent framework-facing reduced-motion
adapter is used here. This is a P2 conformance violation even though the hook itself
does not create a per-frame driver.

### [P2] Scene5 closing entrance/exit has split animation ownership

**Evidence:** `site/src/components/Scene5Cinema.css:357-413` and
`site/src/components/Scene5Cinema.tsx:388-402, 653-724`.

Title, subtitle, CTA, and footer use delayed CSS keyframes while their wrapper
elements are independently driven by `Animate` scrub lanes. On a quick reverse
after `finished`, the wrappers fade out with scroll, but the CSS keyframes continue
running in the mounted nodes. Returning after the 1.1/1.35/1.7/2.0 second delays
therefore reveals already-completed elements instead of an entrance sequence. The
`unfinished` path adds a third owner by setting `animation: none` and scheduling
inline opacity timers (`Scene5Cinema.tsx:439-463`).

This bypasses the framework phase contract and has no browser regression coverage.
At minimum it requires an explicit one-shot CSS waiver plus a real reverse/reopen
acceptance; otherwise the entrance and reverse sequence should be represented by
framework timelines with one owner.

## Validation Evidence and Limits

- `pnpm test --runInBand src/components/Animate/StaggerContainer.test.tsx src/media/VideoFrameRenderer.test.tsx src/media/videoPlaybackOwnership.test.ts`: **3 suites, 50 tests passed**.
- `pnpm type-check`: **exit 0**.
- Full `pnpm test`, `pnpm lint`, and `pnpm build:verify` were not rerun in this review pass.
- Independent browser lane: **blocked before execution by HTTP 429**. The required
  `#/drag` and homepage scroll flows, screenshots, frame cadence, and long-task
  measurements remain unvalidated.

## Required Follow-up Before PASS

- Fix and regression-test the five P1 findings, especially `ended + source:'scroll'`
  recovery and the stagger rerender counterexample.
- Add source-swap and `releaseOnLeave` toggle tests for video residency.
- Add a duplicate `unfinished`/`finished` fake-timer test for Scene5.
- Rework or explicitly waive the site animation-boundary findings.
- Rerun an independent real-browser lane for forward/reverse drag and scroll,
  scrollbar/keyboard paths, concurrent animation/video stress, screenshots, and
  long-task/frame-cadence observation. Do not convert unit-test green into a visual
  PASS.

## Final Self-Review

- No production file was modified by this review.
- Findings are grounded in current line-level code and include reproducible input
  sequences or explicit evidence limits.
- The verdict remains **FAIL** because confirmed P1 defects exist; browser validation
  is separately **BLOCKED**, not silently treated as passed.
