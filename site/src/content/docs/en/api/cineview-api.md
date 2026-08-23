---
title: CineView
eyebrow: API REFERENCE
---

`<CineView>` is the single mode entry: it selects the drag / scroll engine, provides the design-width context, schedules preloading, and exposes imperative navigation. This page is the complete field reference; usage and tutorials live in the [CineView guide](/docs/cineview).

## Props

Every field and default below is checked against `src/types/index.ts` (`CineViewProps`, a union discriminated by `mode`) and the engine implementations.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `config` | `CineViewDesignConfig` | `{ size: 750 }` | Design draft width basis (design px). `scale = viewportWidth / size` is the site-wide single ruler: width-only, never distorted. `size` is its only sub-field. |
| `mode` | `'drag' \| 'scroll'` | `'drag'` | Mode engine selection. `mode` and `callbacks` form a discriminated union: passing a scroll callback in drag mode (or vice versa) is a type error. |
| `modes.drag.direction` | `'x' \| 'y'` | `'y'` | Drag axis. |
| `modes.drag.transitionDuration` | `number` | `800` | Scene-switch settle duration (ms). |
| `modes.drag.threshold` | `DragThresholdConfig` | — | Velocity-to-commit-threshold mapping. Sub-field defaults: `minVelocity` `0`, `maxVelocity` `1000`, `minRatio` `0.15`, `maxRatio` `0.3`; the release threshold interpolates linearly between the two ratios by velocity. |
| `modes.drag.unit` | `'time' \| 'percent'` | `'time'` | Unit mapping drag progress onto the element timeline (root default; overridable per Scene via `Scene.drag`). |
| `modes.drag.scale` | `number` | `10 / 1` | Milliseconds per 1% of drag progress under `time` (default `10`); percent of the Scene's compiled element timeline under `percent` (default `1`). |
| `modes.drag.firstSceneTimeout` | `number` | `3000` | Max wait for first-screen priority images (ms). On timeout a `FIRST_SCENE_TIMEOUT` error is emitted (`preventDefault()` to take over; otherwise the framework statically places the first scene). |
| `modes.scroll.direction` | `'x' \| 'y'` | `'y'` | Scroll axis. |
| `modes.scroll.zoneTrigger` | `'center-lock'` | `'center-lock'` | Zone trigger model (currently the only value). |
| `modes.scroll.sceneSizing` | `'content' \| 'screen'` | `'content'` | Scene height semantics: natural content height or one screen. |
| `modes.scroll.enterMargin` | `number` | `50` | Global default enter margin for the visibility gate (design px); overridable per Animate via `visibility.enterMargin`. |
| `modes.scroll.exitMargin` | `number` | `50` | Global default exit margin for the visibility gate (design px); overridable per Animate via `visibility.exitMargin`. |
| `scrollbar` | `false \| ScrollbarConfig` | `false` | Scrollbar overlay for scroll mode. Passing an object enables it; omitted or `false` disables it. |
| `scrollbar.enabled` | `boolean` | `true` | Overlay on/off (only takes effect when `scrollbar` is an object). |
| `scrollbar.ariaLabel` | `string` | `'CineView scroll position'` | Accessible label of the overlay. |
| `scrollbar.width` | `number` | `6` | Bar thickness (px, floored at `4`). |
| `scrollbar.radius` | `number` | `999` | Bar corner radius (px, floored at `0`). |
| `scrollbar.inset` | `number` | `0` | Inset from the scroll container edge (px, floored at `0`). |
| `scrollbar.trackColor` | `string` | `'transparent'` | Track color. |
| `scrollbar.thumbColor` | `string` | `'rgba(255, 255, 255, 0.28)'` | Thumb color. |
| `scrollbar.thumbHoverColor` | `string` | `'rgba(255, 255, 255, 0.42)'` | Thumb hover color. |
| `scrollbar.autoHide` | `boolean` | `true` | Auto-hide when idle: fades in the instant scrolling starts (0.08s), declares idle ~120ms after the last scroll input, then fades out over 0.5s after a 0.15s delay — an asymmetric fade that is both instant to appear and slow to leave. |
| `callbacks` | `DragModeCallbacks \| ScrollModeCallbacks` | — | Flat, mode-discriminated callback surface — see the three tables below. |
| `performance` | `CineViewPerformanceConfig` | `{ monitor: false }` | A single `monitor` field: enables runtime metric sampling (without it `getPerformanceMetrics()` returns no live data). |
| `children` | `ReactNode` | `required` | At least one `Scene` child; zero Scenes reports `NO_SCENES`. |

## Callbacks

The callback surface is **flat and mode-discriminated**: `DragModeCallbacks = CineViewCommonCallbacks & CineViewDragCallbacks & { [K in keyof CineViewScrollCallbacks]?: never }`, and `ScrollModeCallbacks` is the mirror. So **passing a scroll callback in drag mode, or the other way around, is a type error** — and the cross-exclusion closes both assignment paths: an inline object literal is caught by TS's excess-property check, while a callback first extracted into a variable (which is not subject to that check) is caught by the `?: never` arm.

The three tables hold 14 fields in total. Field-by-field payload docs for every `detail` live in the [type dictionary](/docs/types).

### Common callbacks (accepted in both modes)

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onReady` | `(api: CineViewRef) => void` | — | Fires **once** when the runtime is ready (not re-fired across scene switches). In drag mode it waits for the first-scene enter driver; in scroll mode it waits for the first-screen `priorityComplete` cold-start gate (which includes priority media). |
| `onLoadProgress` | `(progress: number) => void` | — | Preload progress `0..1`. Fires once per image **settled** (loaded or errored), with no trailing debounce; `progress = settled / total`. `onReady` waits for the priority batch's `priorityComplete`, not for this callback reaching 1. |
| `onSceneWillChange` | `(detail: SceneChangeDetail) => void` | — | **Before** a scene switch; the payload carries `fromIndex` / `toIndex` / `direction`. |
| `onSceneDidChange` | `(detail: SceneChangeDetail) => void` | — | **After** a scene switch; same payload. |
| `onError` | `(detail: CineViewErrorDetail) => void` | — | Error reporting. Recoverable errors carry `preventDefault()` — calling it takes over handling and suppresses the framework fallback; not calling it lets the fallback run. Per-code semantics for all 8 codes live in the [type dictionary](/docs/types). |

### Drag-only callbacks (`mode="drag"` only; `never` in scroll mode)

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onDragStart` | `(detail: DragStartDetail) => void` | — | Fires only **after the first direction-qualified move acquires drag ownership** — not on pointer-down, but once the direction settles. `DragStartDetail.direction` is always present (unlike `DragDetail.direction`, which may be `null`). |
| `onDragProgress` | `(detail: DragDetail) => void` | — | Fires through the drag with progress; the payload carries `sceneIndex` / `progress` / `direction`. |
| `onDragBlocked` | `(detail: DragBlockedDetail) => void` | — | A drag toward a blocked boundary is **rejected** (dragging past the first scene forward, or past the last backward). Mutually exclusive with `onDragCancel`: blocked is not cancelled — after blocked the gesture continues, while cancel means the gesture ended without a commit. |
| `onDragCommit` | `(detail: DragCommitDetail) => void` | — | Release passes the velocity/distance threshold and commits a scene switch. The payload carries `targetSceneIndex` / `elapsedMs` / `timelineDurationMs`. Exactly one of this and `onDragCancel` fires — never both. |
| `onDragCancel` | `(detail: DragDetail) => void` | — | The drag is cancelled (released below threshold, or interrupted by programmatic navigation). Mutually exclusive with `onDragCommit`. |

### Scroll-only callbacks (`mode="scroll"` only; `never` in drag mode)

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onZoneEnter` | `(detail: ZoneDetail) => void` | — | Entering a scroll takeover zone. Strictly paired with `onZoneLeave`: on a reverse re-entry the old zone is left before the new one is entered (or the same zone re-entered, depending on scroll direction and zone boundaries). |
| `onZoneLeave` | `(detail: ZoneDetail) => void` | — | Leaving a scroll takeover zone; the payload carries the `zoneId` / `sceneIndex` just left. |
| `onZoneProgress` | `(detail: ZoneProgressDetail) => void` | — | In-zone progress `0..1`, firing frame by frame with the scroll. High-frequency: do not `setState` on the progress inside it — use the MotionValue escape hatch (`useAnimateTimeline()`) or imperative updates; the zero-rerender pattern is documented in the [callbacks deep-dive](/docs/callbacks). |
| `onSceneVisibilityChange` | `(detail: SceneVisibilityDetail) => void` | — | A scene enters/leaves the viewport. Shares its payload (`SceneVisibilityDetail`) with `Scene.callbacks.onVisibilityChange`, but the trigger source differs: this is the root-level aggregate covering every Scene, while the Scene-level one fires for that Scene only. |

## Ref methods

The first five methods always exist in both modes (required in the type — no per-method null checks at call sites); `goToZone` is scroll-only and optional.

| Method | Signature | Description |
| --- | --- | --- |
| `goToScene` | `(index: number, animated?: boolean) => void` | Jump to the scene at the given index. |
| `refreshLayout` | `() => void` | Re-measure viewport and scene layouts (call after dynamic content changes). |
| `preload` | `(targets?: CineViewPreloadTarget[]) => Promise<void>` | Preload. `number` is a scene index; `string` is a `sceneId` (in scroll mode it can also match a `scroll.zoneId`). |
| `getCurrentScene` | `() => number` | Current scene index. |
| `getPerformanceMetrics` | `() => PerformanceMetrics` | Performance metric snapshot (requires `performance.monitor`; otherwise no live data). |
| `goToZone` | `(zoneId: string, options?: { align?: 'center'; animated?: boolean }) => void` | Scroll-only, optional. Scroll consumers can use the `CineViewScrollRef` convenience type to get a view where `goToZone` is required. |

```tsx
const ref = useRef<CineViewScrollRef>(null);

ref.current?.goToScene(2, true);
ref.current?.goToZone('sequence', { animated: true });
ref.current?.refreshLayout();
ref.current?.preload(['hero']);
```

## Related types

- Field-by-field tables for all 9 callback payloads (`SceneChangeDetail` / `DragDetail` / `DragStartDetail` / `DragBlockedDetail` / `DragCommitDetail` / `ZoneDetail` / `ZoneProgressDetail` / `SceneVisibilityDetail` / `CineViewErrorDetail`) → [type dictionary](/docs/types)
- All 8 `CineViewErrorCode` codes (recoverability and `preventDefault` semantics included) → [type dictionary](/docs/types)
- Trigger timing, mutual exclusion, and the zero-rerender pattern → [callbacks deep-dive](/docs/callbacks)
- The preload pipeline and the `priorityComplete` cold-start gate → [preload deep-dive](/docs/preload)

## FAQ

**Why does passing a callback report a type error?**
`mode` and `callbacks` are the two halves of the discriminated union. With `mode="drag"` (or omitted) only common + drag callbacks are accepted and the scroll keys are `never`; `mode="scroll"` mirrors it. Note the cross-exclusion also applies to the extract-into-a-variable-first style — it is not an inline-literal-only check.

```tsx
/* OK: callbacks match the declared mode */
<CineView mode="scroll" callbacks={{ onReady, onZoneProgress }}>

/* Type error: onDragCommit is never in scroll mode */
<CineView mode="scroll" callbacks={{ onDragCommit }}>
```

**How do I stop null-checking `goToZone` in scroll mode?**
Use the `CineViewScrollRef` convenience type (where `goToZone` is required): `const ref = useRef<CineViewScrollRef>(null)` together with `mode="scroll"`. Due to React's forwardRef single-ref typing, it cannot be inferred from the `mode` prop.

**`getPerformanceMetrics()` returns all zeros?**
`performance.monitor` is off. The field defaults to `false` — sampling has a runtime cost; turn it on only when observing.

**What happens to non-Scene children?**
CineView recognizes only `Scene` children. Zero Scenes reports `NO_SCENES`; non-Scene children interleaved among them do not join the scene stack.

