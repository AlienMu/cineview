# Adversarial Code Review R3 — 2026-08-18

Fresh independent review. Derived entirely from current source on branch
`codex/drag-release-dual-gate` (commit 4660d96, uncommitted worktree). No prior
review, browser report, or task-flow summary was read.

## Gap 1 — SceneFixedLayer read-timing after read-after-write reorder

**Verdict: PASS**

### Hot-path order (current, `useNativeScrollController.ts:400-449`)

1. `setNativeOffset(resolvedOffset)` — `root.scrollTo({top, behavior:'auto'})`
   (write, line 402). Only fires when `|resolvedOffset - rawOffset| > 0.5`
   (anti-skip correction).
2. `getViewportSpan()` — `root.clientWidth/clientHeight` (read, line 439).
3. `root.scrollWidth/scrollHeight` (read, line 441).
4. `syncZoneStatesFromNativeOffset(resolvedOffset, nextDirection, viewportSpan)`
   (line 444) → internally calls `updateSceneRenderSnapshotsRef.current(nativeOffset)`
   (`useNativeScrollController.ts:315`) → `setKeySnapshot`
   (`useScrollSceneSnapshots.ts:277`) → synchronously notifies SceneFixedLayer
   subscribers → `apply()` writes `clip.style.width/height/opacity/visibility`
   + `frameElement.style.top/left/width/height` (`SceneFixedLayer.tsx:45-60`).
5. `updateActiveScene(resolvedOffset, viewportSpan)` (line 445) — pure math on
   `sceneLayoutsRef` cache + React state/callbacks, no DOM read/write.
6. `setScrollContentSpan(contentSpan)` (React state, line 448).

Old order (a4005a9): `syncZoneStatesFromNativeOffset` (subscriber writes) ran
BEFORE the `scrollWidth/scrollHeight` read — a read-after-write. The reorder
moves both layout reads (439, 441) before the subscriber writes (444). Correct.

### Sub-questions

**Does any SceneFixedLayer subscriber read layout AFTER writing?**
No. Traced all three `subscribeKey` consumers:
- `SceneFixedLayer.apply` (`SceneFixedLayer.tsx:31-61`): writes
  `clip.style.*` / `frameElement.style.*`. `getFixedLayerMetrics`
  (`helpers.ts:326-372`) is pure arithmetic on the frame snapshot + viewport
  props — no `getBoundingClientRect`, `offsetWidth/Height`, `scrollWidth/Height`,
  or `getComputedStyle` anywhere in the write path.
- `useScrollSceneEngine` `applyFrame` (`useScrollSceneEngine.ts:140-252`):
  calls `current.controls.set(value)` (framer-motion) + `setSceneState`
  (React state, guarded by ref equality). No DOM layout read.
- `Scene.tsx` `emitFrameVisibility` (`Scene.tsx:516-531`): calls visibility
  callback only. No DOM layout read.

**Is the `scrollWidth/scrollHeight` read at 439-444 independent of the prior
`setNativeOffset` write at 402?**
Yes. `scrollTo` with `behavior:'auto'` updates `scrollTop/scrollLeft`
synchronously (scroll POSITION). `scrollWidth/scrollHeight` describe content
EXTENT, which is independent of scroll position. `clientWidth/clientHeight`
(viewport, via `getViewportSpan`) are also independent of scroll position. The
reads return the same values regardless of whether `scrollTo` ran first. The
only consumer of `contentSpan` is `setScrollContentSpan` (line 448), which is
not fed back into zone/scene computation in the same frame.

**Does moving the extent read earlier change downstream values?**
No. `syncZoneStatesFromNativeOffset` consumes `viewportSpan` (passed from line
439), NOT `contentSpan`. `contentSpan` only feeds `scrollContentSpan` state.
The SceneFixedLayer writes target an `overflow:hidden` + `contain:'layout
style paint'` Scene subtree (`Scene.tsx:862-869`), so the clip/frame style
writes cannot expand the scroll root's `scrollWidth/scrollHeight` — absolutely
positioned descendants inside an overflow-hidden, contained subtree do not
contribute to the ancestor scroll container's scrollable extent. Therefore the
old read-after-write and new read-before-write produce identical
`scrollWidth/scrollHeight` values.

### Invariant
The reorder is safe because (a) no subscriber reads layout after writing, (b)
`scrollWidth/scrollHeight` is independent of the `scrollTo` position write,
and (c) SceneFixedLayer writes occur inside an overflow-hidden contained
subtree that cannot affect the scroll root's extent. The fix also collapses
the per-frame `getViewportSpan()` call from "once inside the zone loop per
invocation" to one shared read passed to both `syncZoneStatesFromNativeOffset`
and `updateActiveScene` (old code recomputed or didn't pass it; new code passes
`viewportSpan` from line 439).

## Gap 2 — hot-path per-frame cost of all six fixes

### Fix 1 — `VideoFrameRenderer.tsx:378-382` playbackRate useLayoutEffect
**PASS.** Deps `[mediaNodeEpoch, objectUrl, playbackRate, released, src]` —
none change per-frame during scrub. `playbackRate` is a user prop (constant
during scrub); `mediaNodeEpoch` changes only on activation rebinding;
`objectUrl`/`released` change on src lifecycle. Effect runs on remount/lifecycle
only, never per scrub frame.

### Fix 2 — `videoPlaybackOwnership.ts` frameworkPlayBlocked reducer
**PASS.** The reducer IS called per-frame during scrub (via
`dispatchOwnership({type:'timeline-frame'})` on every `timelineFrame.on('change')`,
`VideoFrameRenderer.tsx:525-533`). But: (a) it writes to `ownershipRef.current`
(ref mutation, `VideoFrameRenderer.tsx:420`), NOT React state — no render. (b)
Per-frame allocation is one shallow `{...state}` spread + one `result` wrapper
object + at most one short `commands` array — O(1), not O(N). (c) The
`frameworkPlayBlocked` boolean adds a field to the existing spread, no extra
allocation. The reducer is pure and operates on a ref; this is the intended
pattern (the alternative — in-place mutation — would be more error-prone).
No per-frame React state, no per-frame new closure in a memo dep array.

### Fix 3 — `BackgroundRibbon.tsx:46` write() re-reads scrollHeight/clientHeight
**PASS.** `write()` is a scroll-event listener (not a rAF loop). It reads
`scroller.scrollHeight` + `scroller.clientHeight` once per scroll event (line
46), computes progress, dedups via `lastKey` (line 50) — writes CSS variables
only when the LUT key changes. The read precedes the write within the handler
(line 44-45 comment documents this). Scroll events fire at most once per frame
(browsers coalesce), so this is one `scrollHeight` read per frame at most, not
a rAF-loop thrash. The CSS-variable writes (`--bg-grad-top` etc.) target
`document.documentElement` and affect color/background, not layout, so they do
not invalidate `scrollHeight` for the next event's read. The `lastKey` dedup
means writes are O(LUT-key-changes), not per-event. Note: the `scrollHeight`
read happens before the dedup check, so it occurs on every scroll event even
when the key is unchanged — but `scrollHeight` is a cached layout value when no
layout-invalidating writes are pending, so the cost is a cache hit, not a
forced reflow, in steady state. Acceptable and justified by the comment
(async descendants can grow scrollHeight without ResizeObserver firing on the
container's box).

### Fix 4 — `ScrollbarOverlay.tsx:108-115` layout-change effect
**PASS.** Effect deps `[direction, nativeScrollableSpan, onScrollToOffset,
railLength, thumbLength]`. During drag/scroll, `nativeScrollableSpan` (total
scrollable distance), `railLength`, `thumbLength` change only on resize/scene
add/remove — NOT per drag frame. The effect runs only when layout actually
changes. The per-frame work (thumb position) is done by the `publishOffset`
store subscription (line 104-106) which writes `thumbRef.style.top/left` — a
style write, no read, ref mutation not React state. The
`scrollbarDragCleanupRef` cleanup effect (line 110-115) is the fix; it runs
only on layout-change identity, not per-frame.

### Fix 5 — `useAnimateScroll.ts:1152-1168` infinite-gate effect
**PASS.** Two paths:
- Early-return (line 1153-1156): `!isScrollDriven || !hasInfiniteAnimation` →
  calls `updateInfiniteState(null)`, returns `undefined` (no subscription).
  No leak — nothing was subscribed.
- Line 1158-1160: calls `updateInfiniteState(zoneStateMotion.get())`
  synchronously, then if `hasExplicitEnter || hasExplicitExit` subscribes
  `zoneStateMotion.on('change', updateInfiniteState)` and returns the
  unsubscribe; if `!hasExplicitEnter && !hasExplicitExit` (line 1159) returns
  `undefined` without subscribing.

The line 1159 early-return correctly omits the subscription because
`updateInfiniteState` (`useAnimateScroll.ts:1098-1104`) gates the infinite-only
element purely on `sceneContext.runtimeState` (covered/inactive/parked/exiting),
NOT on zone progress. Runtime-state changes change `updateInfiniteState`
identity (dep `sceneContext?.runtimeState`, line 1145), which re-runs the
effect (dep `updateInfiniteState`, line 1166), re-evaluating at line 1158 with
the new closure. So the early-return path still responds to runtime-state
transitions without a per-frame zone subscription. `setShouldRunInfiniteState`
is called only when the boolean actually flips (guarded by
`infiniteStateRef.current !== next`), so it's O(transitions), not per-frame.
Clean unsubscribe on the subscription path via React effect cleanup. No leak.

### Fix 6 — `useNativeScrollController.ts:439-444` reorder
**PASS.** Covered under Gap 1. The reorder moved the layout reads earlier (no
second read added) and shared one `getViewportSpan()` result with both
`syncZoneStatesFromNativeOffset` and `updateActiveScene` (old code did not pass
`viewportSpan` in; new code passes it, avoiding a recomputed `getViewportSpan`
inside the zone loop). Net per-frame layout reads: `getViewportSpan()` (1×
`clientWidth/clientHeight`) + `scrollWidth/scrollHeight` (1×), both before any
style writes. No second layout read per frame introduced.

## Overall verdict: **PASS**

Both gaps clear. Gap 1: the reorder is safe — no SceneFixedLayer subscriber
reads layout after writing; `scrollWidth/scrollHeight` is independent of the
`scrollTo` position write; SceneFixedLayer writes occur inside an
overflow-hidden + contained subtree that cannot affect the scroll root's
extent. Gap 2: all six fixes are free of per-frame React state, per-frame new
closure references in memo dep arrays, and new synchronous read-after-write on
the scroll/drag hot path.

## Command output

```
$ pnpm exec jest --runInBand src/components/Animate/useAnimateScroll.hotpath.test.tsx
PASS src/components/Animate/useAnimateScroll.hotpath.test.tsx
  useAnimateScroll progress hot path
    ✓ updates visual MotionValue without rerendering the React consumer per frame (13 ms)
    ✓ gates scroll infinite lanes from the production keyed store shape (4 ms)
Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
EXIT: 0

(Note: src/components/Scene/SceneFixedLayer.test.ts and
src/components/CineView/useNativeScrollController.test.ts do not exist.
Coverage of these modules is via DirectScrollCineView.branches.test.tsx and
Position.test.tsx, which mock scrollHeight/scrollWidth and exercise the
native scroll controller hot path.)

$ pnpm exec jest --runInBand src/components/CineView/DirectScrollCineView.branches.test.tsx src/components/Position/Position.test.tsx
PASS src/components/CineView/DirectScrollCineView.branches.test.tsx
PASS src/components/Position/Position.test.tsx
Test Suites: 2 passed, 2 total
Tests:       77 passed, 77 total
EXIT: 0

$ pnpm type-check
> cineview@1.0.0 type-check
> tsc --noEmit
EXIT: 0

$ git diff --check
EXIT: 0
```
