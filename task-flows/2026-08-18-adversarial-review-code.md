# 2026-08-18 Fresh Adversarial Code Review

Scope: read-only review of the current uncommitted worktree. Production code is not modified. Existing adversarial reviews and browser reports are intentionally excluded from evidence.

## Nodes

- [x] Read `DESIGN.md`, `CLAUDE.md`, `AGENTS.md`, and `AGENT_SELF_REVIEW.md`; inspect `git status` and diff scope.
- [x] Review `VideoFrameRenderer` and `videoPlaybackOwnership`: source/object URL/release/warm-up/activation/native events/pending play tokens.
- [x] Review `ScrollbarOverlay`, `useNativeScrollController`, scroll frame store, and full-refresh render-to-frame timing.
- [x] Review shared `Animate` drag/scroll/visibility semantics and affected site paths.
- [x] Run independent focused tests/static probes; inspect failure-path coverage and hot-path cost.
- [x] Re-read changed logic, search for dead/duplicate/partial branches, and record final PASS/FAIL findings with executable counterexamples.

## Review Result

Overall verdict: **FAIL — do not close the remediation as complete.** The focused test and type-check lanes are green, but there are two deterministic semantic regressions and additional untested timing/layout paths.

### Six Questions

1. **Does the fix solve the original issue? — PARTIAL / FAIL.**
   The media generation/listener isolation and scroll frame-store ownership changes address the previously targeted stale-node and per-frame React-render problems. They do not preserve all public media behavior: a keyed media-node replacement loses the authored playback rate.
2. **Does it alter existing semantics? — YES.**
   `VideoFrameRenderer` now replaces the `<video>` when `src`, release state, or `mediaNodeEpoch` changes (`src/media/VideoFrameRenderer.tsx:562-579`), but the only playback-rate effect depends on `[objectUrl, playbackRate]` (`src/media/VideoFrameRenderer.tsx:357-361`). Rendering `/a.mp4` with `playbackRate={1.5}`, then rendering `/b.mp4` with the same rate, leaves `objectUrl` and the prop value unchanged while React mounts a new keyed node; the new node stays at native default `1`. The same happens on release/warm-up and activation remounts. This is a public API semantic regression.
3. **Second writer/race/timing regression? — YES, contract gap.**
   The capture listener clears `pendingPlayRequestRef` when it sees a native `play` event (`src/media/VideoFrameRenderer.tsx:204-214`), while the promise settlement also clears it (`src/media/VideoFrameRenderer.tsx:416-426`). If a current-activation `play` event is delivered after the framework play promise has settled, the event is dispatched without `requestId`; the reducer accepts any untagged current-activation play as `native-playback` (`src/media/videoPlaybackOwnership.ts:266-276`). Reproducible reducer sequence: endpoint frame emits `play(requestId=1)` -> dispatch `play-resolved(1)` -> reverse frame emits `pause + seek` and enters `framework-scrub` -> delayed `{type:'media-play', activationId: current}` with no request id changes the state back to `native-playback`. The implementation cannot distinguish that stale framework event from an intentional native takeover. Existing tests cover only tagged stale play (`videoPlaybackOwnership.test.ts:464-485`).
4. **Uncovered failure paths? — YES.**
   `BackgroundRibbon` caches `maxScroll` only at attach/ResizeObserver callbacks (`site/src/components/BackgroundRibbon.tsx:63-67,80-90`); the observer watches the scroll container's own box, not scrollable overflow. A scene/iframe/spacer can increase `scrollHeight` while `clientHeight` is unchanged. `MutationObserver` reconciliation returns early when the same container remains attached (`site/src/components/BackgroundRibbon.tsx:94-104`), so the next scroll still divides by the old max and reaches the wrong LUT endpoint. Executable case: attach with `scrollHeight=2000, clientHeight=1000`, then change only `scrollHeight` to `3000` and scroll to `scrollTop=1000`; expected progress is `.5`, but cached `maxScroll=1000` yields `1`.

   A second uncovered path is an active scrollbar drag while content shrinks below one viewport: `ScrollbarOverlay` returns `null` when `nativeScrollableSpan <= 1` (`src/components/CineView/ScrollbarOverlay.tsx:220-221`), but the window listeners installed by `handleScrollbarPointerDown` (`:185-208`) are cleaned only on pointer end or component unmount (`:213-217`). A subsequent pointer move can still call the old `onScrollToOffset` closure with stale geometry.
5. **Dead/duplicate/half-fixed branches? — NO blocking dead branch found, but there is stale documentation and duplicated work.**
   The scroll approach comment reverses the actual threshold wording (`src/components/CineView/useNativeScrollController.ts:277-279`; code uses 1.5 viewport when leaving and 1 viewport when returning). Scene5's JSX comment still lists old phase keyframes while `lightsOffVariant` is now a single ramp (`site/src/components/Scene5Cinema.tsx:597-599,159-183`). These are not functional by themselves, but they make future fixes easier to misapply.
6. **Extra hot-path cost? — YES (P2 performance risk).**
   Every scroll-driven `Animate` with an explicit enter/exit subscribes to `zoneStateMotion` twice: visual updates at `src/components/Animate/useAnimateScroll.ts:1031-1040` and infinite-state gating at `:1147-1156`. The latter performs budget lookup, phase-boundary math, and comparisons even when the `Animate` has no `infiniteAnimation`; the hook is called without an infinite-variant flag (`src/components/Animate/Animate.tsx:653-676`). In addition, each frame synchronously notifies Scene/fixed-layer subscribers, writes fixed-layer width/height/top/left (`src/components/Scene/SceneFixedLayer.tsx:31-60`), then reads the root `scrollHeight/scrollWidth` (`src/components/CineView/useNativeScrollController.ts:432-438`), creating a read-after-write layout-flush risk under concurrent scenes.

### Verification

- Focused tests: 14 suites, 169 tests passed (media ownership/renderer, AnimateVideo, scroll frame/snapshot/scrollbar/engine, Stagger, and site lifecycle helpers).
- `pnpm type-check:framework`: passed.
- `pnpm type-check:site`: passed.
- `git diff --check`: passed.
- Browser acceptance was **not performed** in this code-review lane; no visual or real-browser claim is made.

### Node Closure

- [x] Review `VideoFrameRenderer` and `videoPlaybackOwnership`: source/object URL/release/warm-up/activation/native events/pending play tokens.
- [x] Review `ScrollbarOverlay`, `useNativeScrollController`, scroll frame store, and full-refresh render-to-frame timing.
- [x] Review shared `Animate` drag/scroll/visibility semantics and affected site paths.
- [x] Run independent focused tests/static probes; inspect failure-path coverage and hot-path cost.
- [x] Re-read changed logic, search for dead/duplicate/partial branches, and record final PASS/FAIL findings with executable counterexamples.

## Evidence Rules

- Do not use prior adversarial or browser reports as evidence.
- Do not claim browser acceptance from code/static evidence.
- Every finding must identify a concrete file/line and a reproducible counterexample or invariant.
