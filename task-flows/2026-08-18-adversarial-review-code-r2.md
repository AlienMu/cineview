# Adversarial Code Review R2 — 2026-08-18

Fresh independent review of `codex/drag-release-dual-gate` worktree on top of
commit `4660d96`. Evidence derived from current source only; no prior review,
browser report, or task-flow summary used as evidence.

## Commands run (actual output)

```
$ pnpm exec jest --runInBand \
    src/media/videoPlaybackOwnership.test.ts \
    src/media/VideoFrameRenderer.test.tsx \
    src/components/Animate/AnimateVideo.plumbing.test.tsx \
    src/components/Animate/AnimateVideo.test.tsx \
    src/__tests__/site/backgroundRibbon.test.tsx \
    src/components/CineView/ScrollbarOverlay.test.tsx \
    src/components/Animate/useAnimateScroll.hotpath.test.tsx

Test Suites: 7 passed, 7 total
Tests:       89 passed, 89 total
exit code: 0

$ pnpm type-check   → exit 0
$ pnpm lint         → exit 0
$ git diff --check  → exit 0
```

## Q1 — VideoFrameRenderer remount playbackRate + ownership reducer

### Q1a — playbackRate re-applied on remount: **PASS**

`src/media/VideoFrameRenderer.tsx:378-382`:

```ts
useLayoutEffect(() => {
  const video = videoRef.current;
  if (!video) return;
  video.playbackRate = playbackRate ?? 1;
}, [mediaNodeEpoch, objectUrl, playbackRate, released, src]);
```

`mediaElementKey` (line 599-604) includes `src`, `objectUrl`, `mediaNodeEpoch`,
and the released/active flag; any change remounts the `<video>`. The
`useLayoutEffect` deps include `mediaNodeEpoch, objectUrl, src, released`, so
on every remount the effect fires and sets `playbackRate` on the new node
before paint. `playbackRate` in the dep array also re-applies on prop change
without remount. Verified: no path remounts the node without also firing this
effect.

### Q1b — stale framework play vs native takeover: **PASS**

`src/media/videoPlaybackOwnership.ts:278-315` correctly distinguishes:

Scenario traced: framework `play` (requestId=1) → `play-pending` →
`play-resolved` → `native-playback` with `settledPlayRequestId=1`. Timeline
reclaims scrub (`reduceTimelineFrame` line 201-227) sets
`frameworkPlayBlocked=true`, `status='framework-scrub'`. Late native `play`
arrives:

- If `pendingPlayRequestRef` still holds the resolved token
  (VideoFrameRenderer.tsx:449 keeps it until the native event is observed),
  the play listener tags `requestId=1`. Reducer: `activeRequestMatches=false`
  (activePlayRequestId null), `settledRequestMatches=false`
  (frameworkPlayBlocked true) → issues `pause` + sets
  `frameworkPlayBlocked=true` (line 286-291). Stale token correctly blocked.

- If the token was cleared (rejected, line 449) and the play is untagged:
  `frameworkPlayBlocked=true` → blocked + paused (line 305-307). Genuine
  native takeover (block flag false) → accepted (line 308-315). Correct
  distinction by the `frameworkPlayBlocked` flag.

Counterexample search: no path lets a stale framework play re-establish
native ownership after the timeline reclaims.

## Q2 — BackgroundRibbon maxScroll caching: **PASS**

`site/src/components/BackgroundRibbon.tsx:39-57` re-reads
`scroller.scrollHeight - scroller.clientHeight` inside `write()` on every
call. No closure-cached `maxScroll` across scroll events. Comment at 42-45
documents the reason (async descendants grow scrollHeight without firing
container ResizeObserver).

Counterexample reproduced from the question matches the test at
`src/__tests__/site/backgroundRibbon.test.tsx:142-159`: scrollHeight 2000→
clientHeight 1000, scroll to 1000 → progress 1; then scrollHeight →3000,
fire scroll → expected 0.5 (re-read), cached would yield 1. Test asserts
`expectRootLut(0.5)`. PASS.

## Q3 — ScrollbarOverlay mid-drag content shrink listener cleanup: **PASS**

`src/components/CineView/ScrollbarOverlay.tsx`:

- `scrollbarDragCleanupRef` (line 108) tracks the active session's cleanup.
- Layout-change effect (line 110-115) calls `scrollbarDragCleanupRef.current?.()`
  on `[direction, nativeScrollableSpan, onScrollToOffset, railLength, thumbLength]`
  change. When content shrinks so `nativeScrollableSpan <= 1`, this fires and
  the cleanup (line 198-205) removes the window `pointermove`/`pointerup`/
  `pointercancel` listeners.
- Unmount effect (line 220-225) also calls cleanup as a belt-and-suspenders.
- The `handleScrollbarPointerDown` early-return at line 151-153 rejects a
  second pointer while an active drag owns the rail, so no duplicate session.

Counterexample: active drag, `nativeScrollableSpan` transitions from >1 to
<=1. React commits the new render, then the layout-change effect (line 110)
fires before the overlay returns null (line 227, after all hooks), removing
the stale listeners. The stale `commitPointer` closure (capturing the old
`nativeScrollableSpan`) never fires because its listeners are gone. PASS.

## Q4 — useAnimateScroll infinite-gate double subscription: **PASS**

`src/components/Animate/useAnimateScroll.ts`:

- Visual subscription effect (line 1035-1044) subscribes
  `zoneStateMotion.on('change', update)` only when
  `hasExplicitEnter || hasExplicitExit` (line 1042 early-returns for
  infinite-only lanes).
- Infinite-gate subscription effect (line 1152-1168) early-returns when
  `!isScrollDriven || !hasInfiniteAnimation` (line 1153). For a scroll-driven
  Animate with explicit enter/exit and NO `infiniteAnimation`, this effect
  runs `updateInfiniteState(null)` and returns — no subscription.

`hasInfiniteAnimation` is sourced from `Boolean(infiniteVariant)`
(`src/components/Animate/Animate.tsx:661`), the PARSED variant state, not
the authored `infiniteAnimation` prop. An authored-but-unparsed
`infiniteAnimation` leaves `infiniteVariant=null`, so
`hasInfiniteAnimation=false` and the infinite-gate subscription stays
unsubscribed. The gate is correctly gated on a resolved infinite variant.

For an Animate with both explicit enter/exit AND a resolved infinite
variant, both subscriptions fire — but that is necessary: the infinite loop
needs live zone progress to know whether it is in the entered+pre-exit
window. No redundant subscription for the no-infinite case. PASS.

## Q5 — useNativeScrollController read-after-write layout flush: **PASS**

`src/components/CineView/useNativeScrollController.ts:359-468`
(`syncNativeScrollState`) hot path ordering:

1. Line 364: read `rawOffset = root.scrollLeft/scrollTop` — READ.
2. Line 402 (conditional): `setNativeOffset(resolvedOffset)` — WRITE (scroll
   position; `behavior:'auto'` per `setNativeOffset` line 149).
3. Lines 439-443: read `getViewportSpan()` and `root.scrollWidth`/
   `root.scrollHeight` — READ (content extent; independent of scroll
   position, so no reflow triggered by the prior `scrollTo`).
4. Line 444: `syncZoneStatesFromNativeOffset(...)` — publishes snapshot via
   `timelineStoreRef.current.setSnapshot` (line 313), which notifies
   subscribers including `SceneFixedLayer.apply`
   (`src/components/Scene/SceneFixedLayer.tsx:28-65`) that WRITES
   `clip.style.width/height/opacity/visibility` and
   `frameElement.style.top/left/width/height`.

Comment at line 436-438 documents the deliberate ordering: "Read native
extent before frame-store subscribers write fixed-layer geometry. This
keeps the hot path ordered as layout reads first, visual writes second,
avoiding a synchronous read-after-write layout flush."

`getFixedLayerMetrics` (`src/components/Scene/helpers.ts:326-372`) is pure
arithmetic — no DOM reads — so `SceneFixedLayer.apply` does not read layout
after writing. The `scrollWidth`/`scrollHeight` read at step 3 is not
contingent on scroll position, so the step-2 `scrollTo` does not force a
reflow before it. No read-after-write layout flush on the hot path. PASS.

## Q6 — Dead/duplicate/half-fixed comment branches (Scene5): **FAIL**

`site/src/components/Scene5Cinema.tsx` carries stale comments describing a
4-point / 3-segment phase keyframe design that the code no longer
implements. The actual `lightsOffVariant` (line 173-184) is a 2-point
single linear ramp:

```ts
function lightsOffVariant() {
  return {
    initial: { opacity: LIGHTS_OFF_MIN },                 // 0
    animate: {
      opacity: [LIGHTS_OFF_MIN, LIGHTS_OFF_MAX],            // [0, 0.94] — 2-point
      transition: { duration: 0, times: [0, LIGHTS_OFF_RAMP_END] }, // [0, 1]
    },
  };
}
```

with `LIGHTS_OFF_RAMP_END = 1` (line 171). So the ramp is a single linear
0→0.94 across the full zone (timeline `phase: { start: 0.02, end: 1 }`,
line 599).

Stale comments:

1. **Line 147-149** — describes the variant as a 4-point keyframe:
   ```
   *   times    [0,   RAMP_END, 0.56, 1   ]
   *   opacity  [0,   0.94,     0.94, 0.94]
   ```
   This 4-point design (ramp then hold at 0.94 from 0.56 to 1) is NOT what
   the code does — the code is 2-point `[0, 1]` / `[0, 0.94]` with no hold
   segment. With `RAMP_END=1` the "其后恒定 0.94 到底" (constant 0.94 to
   end) never happens — the ramp runs the whole zone.

2. **Line 598 (JSX comment on the `<Animate>` using `lightsOffVariant`)** —
   ```
   /* 整幕相位（C-act5）：退场要与入场镜像，故不能只覆盖 0→CREATE_AT。
      关键帧把入场/hold/退场三段切在 0.4 / 0.6 上，见 lightsOffVariant 注释。 */
   ```
   References "入场/hold/退场三段切在 0.4 / 0.6" — a 3-segment split at
   0.4/0.6 that does not exist in `lightsOffVariant`. The old 4-point
   mirror keyframe `[0,.94,.94,0] @ [0,.4,.6,1]` (line 144, describing the
   prior bug) had 0.4/0.6 splits; the current variant has none. The JSX
   comment points readers to a `lightsOffVariant` comment that itself
   (point 1 above) no longer matches the code.

3. **Lines 32-34 (module header)** — "0–0.4 熄灯（黑 overlay 线性变黑，反向
   可逆）" and line 128 "熄灯只在锁定后 progress 0→0.4 内播放" — both state
   the lights-off ramp is confined to 0→0.4, but `timeline.phase = { start:
   0.02, end: 1 }` and `RAMP_END=1` make it span 0.02→1. The 0.4 figure is
   `CREATE_AT` (the iframe creation point, line 47), not the lights-off
   ramp end.

The actual behavior (single linear ramp over the whole zone) is
self-consistent with `LIGHTS_OFF_RAMP_END = 1` and the 2026-08-13 user
verdict quoted at line 159-170 ("斜坡 = 整个 zone"). The comments are the
problem, not the code — but they actively mislead any reader trying to
reason about the lights-off phase, which is the kind of half-fixed branch
state Q6 asks about.

## Overall verdict: **FAIL**

Five of six questions PASS. Q6 fails: `site/src/components/Scene5Cinema.tsx`
retains multiple stale comments (lines 32-34, 128, 147-149, 598) describing
a 4-point / 3-segment phase keyframe design that the current
`lightsOffVariant` (a 2-point single ramp, `RAMP_END=1`) does not
implement. The code behavior is correct; the comments are wrong and
mutually inconsistent. Per the review's adversarial standard, a stale
comment that references non-existent keyframe splits and points to another
comment that also no longer matches the code is a half-fixed branch worth
flagging.

No correctness, ownership, listener-leak, layout-thrash, or
double-subscription regressions were found in the six reviewed areas. The
failure is documentation hygiene only.
