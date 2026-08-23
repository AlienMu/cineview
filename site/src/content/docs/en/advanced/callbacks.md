---
title: Callbacks & errors
eyebrow: OBSERVABILITY
---

Callbacks are grouped by semantic timing: realtime samples, boundaries, lifecycle, and errors. This page covers what each callback means and when it fires; the full field and Detail-payload tables live in the API reference ([/docs/cineview-api](/docs/cineview-api), Callbacks section) and the payload dictionary ([/docs/types](/docs/types)).

## Boundary callbacks

onReady fires once per mounted root. onSceneWillChange fires before a valid transition. onSceneDidChange fires at render commit. onDragCommit and onDragCancel are mutually exclusive for one gesture.

## Realtime callbacks

onDragProgress and onZoneProgress are sampled at the owner boundary without trailing debounce, preserving terminal values.

## The sampling contract of onLoadProgress

onLoadProgress reports synchronously the moment each asset (images, plus first-screen media registered through the preload pipeline) settles, with no trailing debounce and no dedup, so consecutive identical rounded values do arrive more than once. The value is an **integer percentage from 0–100** (`Math.round(loaded / total * 100)`), not 0..1; an empty preload plan immediately reports a single 100.

It does not participate in onReady: onReady fires once after mount without waiting for any asset, and onLoadProgress keeps ticking after it. What actually consumes load progress is the cold-start gate: once every first-screen priority asset settles (a failure counts as settled), `priorityComplete` releases the first scene's enter pass; on timeout a recoverable `FIRST_SCENE_TIMEOUT` is emitted. The full semantics of that gate are covered in [Cold start & preloading](/docs/preload).

```tsx
const [loadPercent, setLoadPercent] = useState(0);

<CineView
  mode="drag"
  callbacks={{
    onLoadProgress: (progress) => setLoadPercent(progress), // low frequency: once per asset, setState is fine
  }}
>
```

Contrast with onZoneProgress: onLoadProgress fires per asset settlement, so its frequency is naturally low and state is fine; onZoneProgress fires per frame and must project through a ref (below).

## onDragStart: the ownership boundary

Pressing a pointer alone fires no callback. The first **direction-qualified move** (the main-axis displacement reaches 1px and strictly exceeds the cross-axis displacement) is what requests gesture ownership, and onDragStart fires only after that request **succeeds**, with `progress` pinned to 0. At most once per press session; a mid-press takeover (rush re-grab) does not fire it again.

`DragStartDetail.direction` is always defined (`'forward' | 'backward'`), unlike `DragDetail`, where the `direction` of onDragProgress / onDragCancel can be `null` (when progress is exactly 0). Treat onDragStart as the only reliable "the gesture has legitimately begun and its direction is known" signal; rejected directions never reach it, they go to onDragBlocked. A plain tap (no direction-qualified move) produces zero callbacks from start to finish. Field tables: [/docs/cineview-api](/docs/cineview-api).

## onDragBlocked: rejected is not cancelled

onDragBlocked fires when an ownership request targets a scene with `Scene.drag.enabled === false`, with the payload `{ fromIndex, targetSceneIndex, direction }` (direction always defined). At most once per direction per press; a rejected direction is added to the current press's dedup set, cleared when the pointer lifts.

Two adjacent paths that are easy to misread: a **physical boundary** (beyond the first/last scene) does NOT trigger onDragBlocked; ownership is granted as usual, the rubber-band renders, and the release bounces back to rest where onDragCancel closes the session. A target that is "not internally ready" only logs a dev warning, with no callback.

The distinction in one sentence: onDragBlocked means ownership for that direction was **never granted** (the gesture never started); onDragCancel means a gesture that **had acquired ownership** returned to rest without committing. So one press can receive onDragBlocked (some direction rejected) and then commit a drag in the opposite direction; the two are not mutually exclusive, and the exclusive pair is onDragCommit vs onDragCancel. The typical use is an edge hint:

```tsx
const [edgeHint, setEdgeHint] = useState<string | null>(null);

<CineView
  mode="drag"
  callbacks={{
    onDragBlocked: ({ fromIndex, targetSceneIndex }) =>
      setEdgeHint(`No chapter to enter beyond scene ${fromIndex + 1}`),
    onDragStart: () => setEdgeHint(null), // a legal opposite-direction start clears the hint
  }}
>
```

## onZoneEnter and onZoneLeave: enter/leave pairing

Both callbacks share the `ZoneDetail` payload (`{ zoneId, sceneIndex }`) and fire on the frame the zone's active boolean **flips**: inactive→active is onZoneEnter, active→inactive is onZoneLeave. Contrast with onZoneProgress's per-frame reporting: this pair is O(threshold crossings), arriving only on the flipping frame, never per frame.

The active predicate is "strictly inside the segment": the scroll offset falls within `(segmentStart + 0.5, segmentEnd - 0.5)` and the progress sits strictly between the two ends. This yields the reverse-re-entry order: scrubbing back to the zone's own start boundary (progress snaps to 0 within tolerance) flips active false and fires onZoneLeave; moving strictly inward again fires onZoneEnter. So within one scrolling session a single zone can produce multiple Enter/Leave pairs; treat them as boundary-crossing events, and do not assume one enter per leave.

```tsx
<CineView
  mode="scroll"
  callbacks={{
    onZoneEnter: ({ zoneId }) => telemetry.track('zone:enter', { zoneId }),
    onZoneLeave: ({ zoneId }) => telemetry.track('zone:leave', { zoneId }),
  }}
>
```

## Reading onZoneProgress

onZoneProgress fires per changed zone, every frame the zone moves, so never mirror it into state. The pattern that holds up under concurrent scrolling: keep the callback identity stable (empty deps), filter to the zone you care about, and project the number into DOM through a ref.

```tsx
const readoutRef = useRef<ZoneReadoutHandle>(null);

const handleZoneProgress = useCallback((detail: ZoneProgressDetail): void => {
  if (detail.zoneId !== 'demo-scroll-zone') return;
  readoutRef.current?.project(detail.progress);
}, []);
```

`project` writes `style.transform` and `textContent` directly, with zero re-renders per frame; React only renders the readout shell once. The demo page's ZoneReadout is the live instance of this pattern.

## onSceneVisibilityChange: root-level visibility fan-out

onSceneVisibilityChange shares its payload with `Scene.callbacks.onVisibilityChange` (`SceneVisibilityDetail`: `sceneIndex?` / `visible` / `progress`, with `visible = progress > 0.001`). There is a single source of truth: each Scene's own visibility computation, and the scroll root forwards the same detail to both the scene-level callback and the root-level callback at assembly time. Write it once; do not duplicate logic at both layers. Filter target scenes at the root via `detail.sceneIndex`.

The difference is the trigger surface: the scene-level `onVisibilityChange` exists in both modes (drag follows the render-synced path; scroll subscribes to the imperative frame lane with zero per-pixel subtree re-renders); the root-level onSceneVisibilityChange exists only on the scroll mode's callback surface, and the discriminated callback union rejects the field outright in drag mode. Use the root level for cross-scene telemetry/lazy loading, and the scene level for logic inside a single scene.

```tsx
<CineView
  mode="scroll"
  callbacks={{
    onSceneVisibilityChange: ({ sceneIndex, visible }) => {
      if (!visible) return;
      telemetry.track('scene:seen', { sceneIndex });
    },
  }}
>
```

## Errors and dev warnings

onError receives a typed `code` (the `CineViewErrorCode` union), a message, and a `context` object; recoverable errors additionally carry `preventDefault()`. The same conditions also print `[CineView]`-prefixed diagnostics to the console outside production builds. The console line is the dev-time mirror of the callback, not a second channel to parse. Production bundles drop console output entirely, so programmatic handling belongs in `onError`. Per-code tables and recoverability flags: [/docs/types](/docs/types).
