---
title: CineView
eyebrow: COMPONENTS / CINEVIEW
---

CineView runs the page's scenes, selects drag or scroll behavior, and sets the design width used for responsive lengths. Its ref provides navigation, layout refresh, preloading, and performance readings.

## Props

`CineViewProps` is a union discriminated on `mode`: omitting `mode` means `'drag'`, and the callbacks surface narrows with the mode.

| prop          | type                       | default           | notes                                          |
| ------------- | -------------------------- | ----------------- | ---------------------------------------------- |
| `designWidth` | `number`                   | `750`             | Design width base, see the designWidth section |
| `mode`        | `'drag' \| 'scroll'`       | `'drag'`          | Drag paging / scroll document flow             |
| `scrollbar`   | `false \| ScrollbarConfig` | off               | Optional overlay in scroll mode                |
| `monitor`     | `boolean`                  | `false`           | Enables performance sampling                   |
| `a11y`        | `{ label?: string }`       | label: `'Scenes'` | Accessible name for the drag container         |
| `callbacks`   | Depends on mode            | none              | Scene, input, and resource notifications       |
| `children`    | `ReactNode`                | required          | Declare Scene nodes directly under CineView    |

### designWidth

| field         | type     | default | notes                                                                                                               |
| ------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `designWidth` | `number` | `750`   | Numeric design lengths scale by `viewportWidth / designWidth` on both axes. Locked-zone timing remains `1ms = 1px`. |

Set it to the design's width. See [Responsive conversion](/docs/05-responsive).

### Drag-only fields (flat on the root with `mode='drag'`)

| field                | type                                               | default                   | notes                                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `direction`          | `'x' \| 'y'`                                       | `'y'`                     | Drag direction                                                                                                                                                                                             |
| `transitionDuration` | `number`                                           | `800`                     | Timing for `ref.goToScene()`; gesture timing is calculated separately                                                                                                                                      |
| `threshold`          | `{ minVelocity, maxVelocity, minRatio, maxRatio }` | `0 / 1000 / 0.15 / 0.3`   | Commit thresholds, detailed in [Gestures](/docs/02-gestures)                                                                                                                                               |
| `unit`               | `'time' \| 'percent'`                              | `'time'`                  | Drag-mapping unit for Scene element timelines                                                                                                                                                              |
| `scale`              | `number`                                           | `time: 10` / `percent: 1` | Amount mapped per 1% of drag, interpreted by `unit`                                                                                                                                                        |
| `firstSceneTimeout`  | `number`                                           | `3000`                    | Wait cap (ms) for first-screen priority images. On timeout a `FIRST_SCENE_TIMEOUT` is emitted; without `preventDefault()` the framework falls back to statically placing the first scene in its rest state |

### Scroll-only fields (flat on the root with `mode='scroll'`)

| field         | type                    | default         | notes                                                    |
| ------------- | ----------------------- | --------------- | -------------------------------------------------------- |
| `direction`   | `SlideDirection`        | `'y'`           | Scroll direction                                         |
| `zoneTrigger` | `'center-lock'`         | `'center-lock'` | Supported trigger                                        |
| `sceneSizing` | `'content' \| 'screen'` | `'content'`     | Size ordinary scenes by content or at least one viewport |
| `enterMargin` | `number`                | `50`            | Default visibility entrance margin in design pixels      |
| `exitMargin`  | `number`                | `50`            | Default visibility exit margin in design pixels          |
| `debug`       | `boolean`               | `false`         | Enables scroll parameter and layout diagnostics          |

### scrollbar

The scrollbar overlay, an optional scroll-mode add-on. Pass an object to enable, `false` to disable.

| field             | type      | default                           | notes                                   |
| ----------------- | --------- | --------------------------------- | --------------------------------------- |
| `enabled`         | `boolean` | `true` when an object is supplied | Overlay on or off                       |
| `ariaLabel`       | `string`  | `'CineView scroll position'`      | Accessible label                        |
| `width`           | `number`  | `6`                               | Thickness (px), floored at 4            |
| `radius`          | `number`  | `999`                             | Corner radius; fully rounded by default |
| `inset`           | `number`  | `0`                               | Inset from container edges (px)         |
| `trackColor`      | `string`  | `'transparent'`                   | Track color                             |
| `thumbColor`      | `string`  | `'rgba(255,255,255,0.28)'`        | Thumb color                             |
| `thumbHoverColor` | `string`  | `'rgba(255,255,255,0.42)'`        | Thumb border color in every state       |
| `autoHide`        | `boolean` | `true`                            | Hide when idle                          |

Theming example: [Scrollbar theming](/docs/05-scrollbar).

## Callbacks

TypeScript checks `callbacks` against `mode`. For example, `onZoneProgress` is unavailable in drag and `onDragEnd` is unavailable in scroll. The check also applies to callback objects stored in variables.

### Common callbacks (both modes)

| callback         | detail                | notes                                                                      |
| ---------------- | --------------------- | -------------------------------------------------------------------------- |
| `onReady`        | `api: CineViewRef`    | Ref API available after mount; does not wait for assets                    |
| `onLoadProgress` | `progress: number`    | Queued request completion, integer 0–100, including failed requests        |
| `onSceneEnter`   | `SceneChangeDetail`   | Scene-change notification; gesture changes notify at commit                |
| `onSceneLeave`   | `SceneChangeDetail`   | Companion scene-change notification; child animations may still be running |
| `onError`        | `CineViewErrorDetail` | Error code, message, context, and optional fallback control                |

### Drag-only

| callback         | detail                                                           | notes                                                                         |
| ---------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `onDragStart`    | `DragStartDetail` `{ sceneIndex, progress, direction }`          | Fires only after the first direction-qualified gesture starts a drag session  |
| `onDragProgress` | `DragDetail` `{ sceneIndex, progress, direction? }`              | Drag in progress                                                              |
| `onDragBlocked`  | `DragBlockedDetail` `{ fromIndex, targetSceneIndex, direction }` | Drag blocked, for example when the target scene is disabled                   |
| `onDragEnd`      | `DragEndDetail`                                                  | Switch committed; carries `targetSceneIndex / elapsedMs / timelineDurationMs` |
| `onDragCancel`   | `DragDetail`                                                     | Gesture canceled, back to the original scene                                  |

### Scroll-only

| callback                  | detail                                                       | notes                   |
| ------------------------- | ------------------------------------------------------------ | ----------------------- |
| `onZoneEnter`             | `ZoneDetail` `{ zoneId, sceneIndex }`                        | Entering a locked zone  |
| `onZoneLeave`             | `ZoneDetail`                                                 | Leaving a locked zone   |
| `onZoneProgress`          | `ZoneProgressDetail` (`ZoneDetail` + `progress`)             | Zone progress 0-1       |
| `onSceneVisibilityChange` | `SceneVisibilityDetail` `{ sceneIndex?, visible, progress }` | Scene visibility change |

Callback patterns and `onError` handling: [Callbacks](/docs/03-callbacks).

## Ref methods

```tsx
const ref = useRef<CineViewRef>(null);
<CineView ref={ref} mode="scroll" designWidth={750}>
  ...
</CineView>;
```

| method                  | signature                                              | notes                                                                                            |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `goToScene`             | `(index: number, animated?: boolean) => void`          | Jump to a scene                                                                                  |
| `refreshLayout`         | `() => void`                                           | Re-measure layout                                                                                |
| `preload`               | `(targets?: CineViewPreloadTarget[]) => Promise<void>` | Preload. Targets are scene indexes (number) or `sceneId`; in scroll mode a `zoneId` also matches |
| `getCurrentIndex`       | `() => number`                                         | Current scene index                                                                              |
| `getPerformanceMetrics` | `() => PerformanceMetrics`                             | `{ fps, avgFrameTime, memoryUsage?, bundleSize }`                                                |

These methods exist in both modes. Guard `ref.current` until mount; the individual methods do not need optional calls.

`goToZone(zoneId, { align?: 'center', animated?: boolean })` is scroll-only and optional on `CineViewRef` (drag has no zones). Scroll consumers can use `CineViewScrollRef`, where `goToZone` is required:

```tsx
const ref = useRef<CineViewScrollRef>(null);
ref.current?.goToZone('intro-seq', { align: 'center' });
```

## Error codes

`onError` receives a `CineViewErrorCode` string union. Use a `never` check when exhaustive handling is needed. Some errors provide `preventDefault`; call `detail.preventDefault?.()` to suppress their default fallback and show application UI.

| code                          | fired when                                                             | recovery                                                                         |
| ----------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `EMPTY_SCENES`                | CineView has no Scene children, or a Scene has no content              | Add the missing content                                                          |
| `IMAGE_LOAD_FAILED`           | A queued resource failed in drag mode                                  | Handle the asset failure                                                         |
| `FIRST_SCENE_TIMEOUT`         | First-screen resource wait exceeded its limit                          | Optional `preventDefault`; otherwise show the first Scene at its completed state |
| `INVALID_ANIMATION`           | Missing dependency, incompatible driver, or unsupported manual control | Correct the reported animation configuration                                     |
| `CIRCULAR_DEPENDENCY`         | An `after` chain forms a cycle                                         | none                                                                             |
| `INVALID_COMPONENT_HIERARCHY` | Duplicate `animateId`, or duplicate scroll zone identity               | none                                                                             |
| `INVALID_DRAG_CONFIG`         | Illegal drag `unit` / `scale` / `enabled` config                       | Recoverable                                                                      |
| `ANIMATION_ASSET_LOAD_FAILED` | An animation preset asset failed to load                               | Retryable                                                                        |

## Entries and bundle size

Use `cineview` with ES module (ESM) bundlers; it includes both engines. The mode subpaths `cineview/drag` and `cineview/scroll` support CommonJS and export their respective prop types. Separate Universal Module Definition (UMD) files support script loading with supplied peer runtimes. See [Installation](/docs/02-installation).

## Related pages

- [Scene](/docs/02-scene): scene content, layout, and transitions
- [The two modes](/docs/01-modes): what drag and scroll actually mean
- [Responsive scaling](/docs/05-responsive): how `designWidth` drives conversion

## Migration map (legacy name → current)

<!-- banned-names:begin -->

| Legacy                              | Current                                        |
| ----------------------------------- | ---------------------------------------------- |
| `config={{ size: 750 }}`            | `designWidth={750}`                            |
| `modes={{ drag, scroll }}` wrapper  | mode fields flat on root, `mode` discriminates |
| `performance={{ monitor }}`         | `monitor`                                      |
| `timeline.waitFor`                  | `timeline.after`                               |
| `timeline.sceneControlled`          | `timeline.driver: 'scene' \| 'clock'`          |
| `visibility.replayOnReenter`        | `visibility.replay`                            |
| `infiniteAnimation`                 | `loopAnimation`                                |
| `Position layer={{ fixed }}`        | `Position fixed`                               |
| `Scene stack.mode / zIndex`         | `layout.overlap` / `layout.zIndex`             |
| `onSceneWillChange`                 | `onSceneEnter`                                 |
| `onSceneDidChange`                  | `onSceneLeave`                                 |
| `onDragCommit` / `DragCommitDetail` | `onDragEnd` / `DragEndDetail`                  |
| `getCurrentScene()`                 | `getCurrentIndex()`                            |
| `NO_SCENES`                         | `EMPTY_SCENES`                                 |

<!-- banned-names:end -->
