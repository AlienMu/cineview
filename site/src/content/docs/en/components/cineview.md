---
title: CineView
eyebrow: ROOT
---

CineView selects the mode engine, provides the design-width context, schedules preload, and exposes imperative navigation.

## Ref API

The common methods are always available. goToZone is scroll-only and is required by CineViewScrollRef.

```tsx
const ref = useRef<CineViewScrollRef>(null);

ref.current?.goToScene(2, true);
ref.current?.goToZone('sequence', { animated: true });
ref.current?.refreshLayout();
ref.current?.preload(['hero']);
```

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
| `scrollbar.autoHide` | `boolean` | `true` | Auto-hide when idle. |
| `callbacks` | `DragModeCallbacks \| ScrollModeCallbacks` | — | Flat, mode-discriminated callback surface — see the table below. |
| `performance` | `CineViewPerformanceConfig` | `{ monitor: false }` | A single `monitor` field: enables runtime metric sampling (without it `getPerformanceMetrics()` returns no live data). |
| `children` | `ReactNode` | `required` | At least one `Scene` child; zero Scenes reports `NO_SCENES`. |

### callbacks

Common callbacks are accepted in both modes; drag/scroll-specific callbacks are `never` in the other mode (type error).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onReady` | `(api: CineViewRef) => void` | — | Common. Fires once when the runtime is ready (not re-fired across scene switches). |
| `onLoadProgress` | `(progress: number) => void` | — | Common. Preload progress `0..1`. |
| `onSceneWillChange` | `(detail: SceneChangeDetail) => void` | — | Common. Before a scene switch. |
| `onSceneDidChange` | `(detail: SceneChangeDetail) => void` | — | Common. After a scene switch. |
| `onError` | `(detail: CineViewErrorDetail) => void` | — | Common. Error reporting; recoverable errors carry `preventDefault()`. |
| `onDragStart` | `(detail: DragStartDetail) => void` | — | Drag-only. Fires once the first direction-qualified move acquires drag ownership. |
| `onDragProgress` | `(detail: DragDetail) => void` | — | Drag-only. Drag progress. |
| `onDragBlocked` | `(detail: DragBlockedDetail) => void` | — | Drag-only. A drag toward a blocked boundary is rejected. |
| `onDragCommit` | `(detail: DragCommitDetail) => void` | — | Drag-only. Release commits a scene switch. |
| `onDragCancel` | `(detail: DragDetail) => void` | — | Drag-only. Drag cancelled. |
| `onZoneEnter` | `(detail: ZoneDetail) => void` | — | Scroll-only. Entering a zone. |
| `onZoneLeave` | `(detail: ZoneDetail) => void` | — | Scroll-only. Leaving a zone. |
| `onZoneProgress` | `(detail: ZoneProgressDetail) => void` | — | Scroll-only. In-zone progress `0..1`. |
| `onSceneVisibilityChange` | `(detail: SceneVisibilityDetail) => void` | — | Scroll-only. Scene enters/leaves the viewport. |

### Ref methods

The first five methods always exist in both modes (required in the type); `goToZone` is scroll-only and optional.

| Method | Signature | Description |
| --- | --- | --- |
| `goToScene` | `(index: number, animated?: boolean) => void` | Jump to the scene at the given index. |
| `refreshLayout` | `() => void` | Re-measure viewport and scene layouts. |
| `preload` | `(targets?: CineViewPreloadTarget[]) => Promise<void>` | Preload. `number` is a scene index; `string` is a `sceneId` (in scroll mode it can also match a `scroll.zoneId`). |
| `getCurrentScene` | `() => number` | Current scene index. |
| `getPerformanceMetrics` | `() => PerformanceMetrics` | Performance metric snapshot (requires `performance.monitor`). |
| `goToZone` | `(zoneId: string, options?: { align?: 'center'; animated?: boolean }) => void` | Scroll-only, optional. Scroll consumers can use the `CineViewScrollRef` convenience type to get a view where `goToZone` is required. |
