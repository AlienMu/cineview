# Runtime API and Owner Remediation

## Goal

Reduce orchestration-owner complexity without changing CineView's drag/scroll ownership model,
introduce a supported zero-render timeline API, make format checking a release gate, finish the site,
then add CI and open-source governance files as the final release-hardening phase.

## Non-goals

- Do not add a framework-level reduced-motion policy. Experience selection remains application-owned.
- Do not replace the real scroll takeover model with a virtual scroll abstraction.
- Do not split files merely to reduce line count; each extracted module must have one owner and one reason to change.
- Do not move per-frame values into React state.

## Ownership Invariants

- `renderProgress` has one writer in the render lane.
- Each Scene owns and writes only its own `elementElapsedMotion`.
- `dragRelease` is a read-only directive outside the scene manager.
- Native scroll offset and center-lock reduction remain owned by the scroll controller.
- Extracted modules communicate through narrow typed ports, not broad component props or mutable refs.
- Public zero-render consumers can read MotionValues but cannot write runtime progress or scene state.

## Target Split

### DirectScrollCineView

Keep the component as a thin composition root. It owns only root refs, stable public wiring, and the
final provider/render tree.

Extract the following disjoint owners:

1. `useScrollViewport` / `scrollViewport.ts`
   - viewport size, ResizeObserver, root scroll element, refresh invalidation;
   - owns viewport measurement and exposes a stable snapshot/imperative refresh.
2. `useScrollSceneRegistry` / `scrollSceneRegistry.ts`
   - scene wrapper refs, zone registry, animation registration, scene layout cache;
   - owns registration maps, not progress.
3. `useNativeScrollController` / `nativeScrollController.ts`
   - wheel/touch/keyboard/native scrollbar input;
   - gesture-burst measurement gate, listener lifecycle, and native offset writes.
4. `useScrollTimelineReducer` / `scrollTimelineReducer.ts`
   - pure center-lock intent reduction, zone progress snapshots, anti-skip boundaries;
   - no DOM reads, React state, or callback side effects.
   - first audit and move the existing pure paths from `directScrollHelpers.ts`; do not create a second
     reducer or duplicate the current center-lock semantics.
5. `useScrollCallbacks` / `scrollCallbacks.ts`
   - boundary callback publication and duplicate suppression;
   - receives reducer output and never becomes a second progress owner.
6. `ScrollSceneSlot.tsx`
   - scene cloning, wrapper footprint, takeover shell, sticky/fixed visual shell;
   - subscribes to a per-scene external store only.
7. `useScrollCineViewRef.ts`
   - `goToZone`, layout refresh, current-scene reads, preload and metrics ports;
   - reads current values through refs and keeps callback ordering unchanged.

The root component must retain the single assembly point for `SceneScrollRuntimeContext`,
`SceneScrollTimelineContext`, and `CineViewRuntimeContext`; providers must not be recreated inside
independent controllers.

### Scene

Keep `Scene` as the authoring boundary and DOM host. Extract runtime responsibilities:

1. `useSceneAnimationRegistry`
   - animate registration, duplicate IDs, delay calculation, waitFor entered bus, validation cleanup.
2. `useSceneDragRuntime`
   - local drag fallback, runtime bridge selection, element track wiring, release/reset ports.
3. `useSceneScrollRuntimeBridge`
   - zone registration, zone element binding, scroll timeline read port, scroll scene state.
   - reuse the existing `useSceneScrollTakeover` and `sceneScrollRuntime` contracts; this is an ownership
     extraction, not a second scroll-zone implementation.
4. `useSceneVisibilityRuntime`
   - visibility progress and meaningful visibility callback publication.
5. `useScenePointerInput`
   - native pointer handlers and Framer pan fallback composition.
6. `SceneFixedLayer.tsx`
   - scene-scoped fixed layer clip/frame/portal host and its metrics.
7. `SceneContexts.tsx`
   - split stable scene authoring/runtime context from high-frequency timeline sources.

`Scene` retains prop normalization, DOM forwarding, final style composition, and provider assembly.
It must not contain a second drag or scroll state machine after extraction.

### CineView

Keep `CineView` as the public mode router. Extract:

1. `useCineViewCallbacks`
   - callback regrouping, stable refs, ready-once and error publication.
2. `useCineViewPreload`
   - preload plan, priority gate, target resolution and preload ref commands.
3. `useDragCineViewRuntime`
   - drag scene manager wiring, scene transition callbacks, render lane ownership.
4. `DragSceneStack.tsx`
   - drag scene ordering, visibility window, wrapper/layout rendering.
5. `useCineViewImperativeApi`
   - stable public ref methods backed by current refs.
6. `CineViewModeRouter.tsx`
   - choose drag or direct scroll implementation without duplicating provider setup.

`CineView` retains public prop normalization, mode selection, root context boundary, and ref forwarding.

## Zero-render API

Add a supported, read-only hook rather than exposing `__renderProgress`:

```ts
function CanvasLayer() {
  const timeline = useAnimateTimeline();
  // Called inside an <Animate> child, so this reads the exact registered
  // waitFor/stagger/driver/duration semantics of that Animate instance.
}

timeline.progress // MotionValue<number>, 0..1, no React render per frame
timeline.phase    // MotionValue<AnimatePhase>
```

The hook must reuse the same registration, waitFor, drag, scroll, and visibility semantics as `Animate`.
`Animate` and `AnimateVideo` should consume this canonical hook internally to prevent semantic drift.
Returned MotionValues are read-only by type and documentation; no public setter is exposed.

Add tests for identity stability, per-frame no-render behavior, drag/scroll/visibility parity,
waitFor/stagger completion, unmount cleanup, and misuse outside a Scene.

## Execution Order

- [x] 0.1 Freeze baseline: root/site/example verification and browser acceptance evidence captured
      before the remediation continued; known gaps were converted into the executable gates below.
- [x] 1.1 Define and test the zero-render API contract. (4 focused contract tests pass.)
- [x] 1.2 Make `AnimateVideo` consume the canonical timeline source and remove the private
      progress bridge. (`Animate` owns the provider; all public consumers read the same values.)
- [x] 2.1 Split scroll composition ports: `ScrollSceneSlot`, `useScrollInputBindings`, and
      `useScrollViewport`; the center-lock reducer and native offset owner remain singular in
      `DirectScrollCineView` instead of being duplicated behind a broad parameter object.
- [x] 2.2 Split Scene registry, fixed-layer, pointer input, drag engine, scroll engine, and takeover
      bridge responsibilities. Scene remains the final DOM/provider assembly boundary.
- [x] 2.3 Split CineView drag stack and imperative ref API. Callback/preload orchestration stays in
      the root because it coordinates both modes and has no independent writer to extract.
- [x] 2.4 Re-read changed ownership paths, grep private progress bridges/stale names, and run focused
      tests after each slice. DirectScroll 114/114, CineView 64/64, Scene 112/112 pass.
- [x] 3.1 Narrow stable Scene context and high-frequency timeline subscriptions. (Production scroll
      frames publish through per-scene external stores; stable registration context no longer carries
      live progress.)
- [x] 3.2 Run profiler with concurrent scroll/drag and multi-element animation fixtures. Clean run:
      scroll 60.0 FPS / p95 17.5ms / 0 long tasks / 1.01 layout reads per Animate per input / 0
      listener growth / 4.4MB heap growth; drag 60.0 FPS / p95 17ms / 0 long tasks / 0.83 layout reads
      per input / listener growth 5 / 4.8MB heap growth. Regression budgets pass. Professional targets
      remain explicitly false for React commits/input (3.38 scroll, 4.42 drag) and drag listener growth.
- [x] 4.1 Finish site Docs, Demo, API examples, and stale API removal.
- [x] 4.2 Site type-check/build passed. Independent browser lane passed drag forward/reverse and
      scroll center-lock forward/release/reverse, keyboard, and large-wheel anti-skip on
      `localhost:3000`; it also found and verified the fixed second drag scene layout overlap.
- [x] 5.1 Normalize root/site/examples formatting and add `format:check` to `verify`.
- [x] 6.1 Final release hardening: CI, CHANGELOG, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, and
      React/Node support matrix added.
- [x] 6.2 Full package/site/example/tarball verification passed after the final example layout and
      profiler-harness changes: `pnpm verify`, site/example builds, and browser acceptance are green.
      This was the first closure and was later reopened because its profiler divided commits by
      Playwright input calls instead of browser frames and mixed media load/error listeners with
      interaction listeners.

## Reopened Owner And Profiler Remediation

- [x] 7.1 Correct the profiler contract: measure React commits per browser frame, report commits by
      `ProfileBoundary`, separate interaction-listener growth, and warm the complete drag scene set.
- [x] 7.2 Replace per-Scene scroll publication with one immutable snapshot-map store. Each memoized
      `ScrollSceneSlot` receives only its own stable snapshot; unchanged snapshots retain identity.
- [x] 7.3 Move zone registration, animation registration, sequence recomputation, timeline store, and
      stable runtime contexts into `useScrollZoneRegistry`; remove the duplicate implementation from
      `DirectScrollCineView`.
- [x] 7.4 Move scene wrapper/layout-cache ownership into `useScrollSceneLayout` and native offset,
      center-lock reduction, gesture-burst lifecycle, boundary callbacks, and input bindings into
      `useNativeScrollController`. Move immutable per-Scene snapshot-map publication into
      `useScrollSceneSnapshots`. `DirectScrollCineView` is now the composition root (995 -> 432
      lines) and no longer owns the zone registry, layout traversal, snapshot traversal, or native
      scroll state machine.
- [x] 7.5 Focused verification: DirectScroll/store 116/116, `pnpm type-check`, and `pnpm lint` pass.
      Corrected browser profiler reports `professionalReady: true`: scroll 56.1 FPS / p95 18.6ms /
      0.565 commits per frame / 0 long tasks / 0 interaction-listener growth; drag 60.0 FPS / p95
      18.7ms / 0.981 commits per frame / 0 long tasks / 0 interaction-listener growth.
- [x] 7.6 Final `pnpm verify` passes: 88 suites / 1222 tests; coverage 96.25% statements, 90.65%
      branches, 96.17% functions, 96.85% lines; duplication 1.47%; build verifier 12/12; failure
      injection 4/4; ES gzip 47.5 KB. Site and performance-example production builds also pass.
- [x] 7.7 Independent browser agent rechecked drag and scroll forward/reverse, keyboard, scrollbar,
      and large-wheel anti-skip behavior against the final working tree.
      `localhost:3000` was the official site rather than the interaction fixture, so the agent used an
      isolated `localhost:3001` performance-example server. Drag 1->2->1 by buttons and real pointer
      passed. Scroll forward 0->1500, native release, reverse 1500->0, ArrowUp/ArrowDown, and 8000px
      anti-skip clamp to progress=1 all passed with 0 console warnings/errors and 0 page errors.

## Final Evidence

- Root `pnpm verify`: 88 suites / 1222 tests, coverage 96.25% statements, 90.65% branches, 96.17%
  functions, 96.85% lines; lint has 0 errors and 0 warnings; build verifier 12/12; failure injection
  4/4.
- Official example: type-check, Vitest 23/23, and production build pass. The added `PagedScenes` layout
  regression test verifies the second drag scene columns do not overlap.
- Site: type-check and production build pass; `http://localhost:4003/docs/timeline` and `/demo` were
  checked at desktop and 390x844 mobile viewports with no console errors/warnings; favicon loads.
- Independent browser lane: isolated example on `http://localhost:3001` passed drag/button
  forward/reverse plus scroll center-lock forward/release/reverse, keyboard, and 8000px anti-skip with
  0 console/page errors. Port 3000 currently serves the official site, not this interaction fixture.
- Framework-level reduced-motion policy was intentionally not added; site application scenes retain
  their own presentation preferences without changing CineView scroll ownership.
- The old "conditional professional" profiler conclusion is superseded by 7.1-7.5. Raw
  commits-per-Playwright-input remains diagnostic only because one synthetic wheel/pointer call spans
  multiple native scroll/release frames; it is not a runtime frame budget.
- Final profiler after snapshot-owner extraction: scroll 59.7 FPS / p95 18.6ms / 0.523 commits per
  frame / 0.731 layout reads per Animate per input; drag 59.9 FPS / p95 18.6ms / 0.981 commits per
  frame. Both modes have 0 long tasks and 0 interaction-listener growth; `professionalReady: true`.
- Example-only visual note: progress=1 is intentionally still the animation initial frame, so a large
  anti-skip wheel can land on an almost blank takeover first frame. Mid-sequence heading clipping is
  the authored exit motion. These do not indicate runtime ownership or anti-skip failure.

## Release Gates

- Root, site, and official examples type-check.
- `pnpm verify` includes formatting and remains fully green.
- Zero-render API has behavior and render-count regression tests.
- No extracted module introduces a second writer for progress, release, or scroll offset.
- Independent browser lane completes drag and scroll forward/reverse acceptance.
- Site contains only current public API examples.
- CI validates the declared React and Node support matrix.
