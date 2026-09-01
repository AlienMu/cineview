---
title: CineView
eyebrow: COMPONENTS / CINEVIEW
---

CineView is the root component: it picks the mode engine (drag paging / scroll document flow), sets the single conversion base for the whole page, schedules preloading, and exposes an imperative ref. If a page has `Scene`s, CineView runs them.

## Props

`CineViewProps` is a union discriminated on `mode`: omitting `mode` means `'drag'`, and the callbacks surface narrows with the mode.

| prop          | type                       | default  | notes                                          |
| ------------- | -------------------------- | -------- | ---------------------------------------------- |
| `designWidth` | `number`                   | `750`    | Design width base, see the designWidth section |
| `mode`        | `'drag' \| 'scroll'`       | `'drag'` | Drag paging / scroll document flow             |
| `scrollbar`   | `false \| ScrollbarConfig` | none     | Scrollbar overlay; pass `false` to disable     |
| `monitor`     | `boolean`                  | none     | Performance monitor flag                       |
| `callbacks`   | Discriminated by mode      | none     | See "Callbacks"                                |
| `children`    | `ReactNode`                | required | Only `Scene` children are recognized           |

### designWidth

| field         | type     | default | notes                                                                                                                                                                                                                                                                           |
| ------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `designWidth` | `number` | `750`   | Design width base (design px). `scale = viewportWidth / designWidth`, the single conversion base for the whole page: coordinates and box-model lengths all multiply by it, width-only, preserving the aspect ratio. Locked zones still settle their time budgets at `1ms = 1px` |

`designWidth` is not a zoom knob; it is the design base. Changing it changes every design px with it. See [Responsive scaling](/docs/05-responsive).

### Drag-only fields (flat on the root with `mode='drag'`)

| field                | type                                               | default                   | notes                                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `direction`          | `SlideDirection` (`'x' \| 'y'`)                    | none                      | Swipe direction                                                                                                                                                                                            |
| `transitionDuration` | `number`                                           | `800`                     | **Programmatic navigation only.** Gesture paging and rebound always use an internal 800ms duration that no public prop can change; here it only decides when `onSceneLeave` fires after `ref.goToScene()`  |
| `threshold`          | `{ minVelocity, maxVelocity, minRatio, maxRatio }` | none                      | Gesture thresholds; all four optional numbers                                                                                                                                                              |
| `unit`               | `'time' \| 'percent'`                              | `'time'`                  | Drag-mapping unit for Scene element timelines                                                                                                                                                              |
| `scale`              | `number`                                           | `time: 10` / `percent: 1` | Amount mapped per 1% of drag, interpreted by `unit`                                                                                                                                                        |
| `firstSceneTimeout`  | `number`                                           | `3000`                    | Wait cap (ms) for first-screen priority images. On timeout a `FIRST_SCENE_TIMEOUT` is emitted; without `preventDefault()` the framework falls back to statically placing the first scene in its rest state |

### Scroll-only fields (flat on the root with `mode='scroll'`)

| field         | type                    | default | notes                                                                                                                    |
| ------------- | ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `direction`   | `SlideDirection`        | none    | Scroll direction                                                                                                         |
| `zoneTrigger` | `'center-lock'`         | none    | The only trigger                                                                                                         |
| `sceneSizing` | `'content' \| 'screen'` | none    | Scene sizing strategy                                                                                                    |
| `enterMargin` | `number`                | `50`    | Global default margin (design px) for the visibility condition; overridable per Animate through `visibility.enterMargin` |
| `exitMargin`  | `number`                | `50`    | Same condition, exit half                                                                                                |

### scrollbar

The scrollbar overlay, an optional scroll-mode add-on. Pass an object to enable, `false` to disable.

| field             | type      | default                      | notes                                   |
| ----------------- | --------- | ---------------------------- | --------------------------------------- |
| `enabled`         | `boolean` | none                         | On/off                                  |
| `ariaLabel`       | `string`  | `'CineView scroll position'` | Accessible label                        |
| `width`           | `number`  | `6`                          | Thickness (px), floored at 4            |
| `radius`          | `number`  | `999`                        | Corner radius; fully rounded by default |
| `inset`           | `number`  | `0`                          | Inset from the rail edges (px)          |
| `trackColor`      | `string`  | `'transparent'`              | Track color                             |
| `thumbColor`      | `string`  | `'rgba(255,255,255,0.28)'`   | Thumb color                             |
| `thumbHoverColor` | `string`  | `'rgba(255,255,255,0.42)'`   | Thumb hover color                       |
| `autoHide`        | `boolean` | `true`                       | Hide when idle                          |

Theming example: [Scrollbar theming](/docs/05-scrollbar).

## Callbacks

`callbacks` is discriminated with `mode`: writing `onZoneProgress` in drag mode is a type error, and so is `onDragEnd` in scroll mode. Both the inline-literal path and the assign-variable-first path fail (scroll-only keys are typed as optional `never` on the drag side). It is not silently ignored at runtime.

### Common callbacks (both modes)

| callback         | detail                                                               | notes                                   |
| ---------------- | -------------------------------------------------------------------- | --------------------------------------- |
| `onReady`        | `api: CineViewRef`                                                   | Runtime ready; fires once on mount      |
| `onLoadProgress` | `progress: number`                                                   | Preload progress, integer 0-100         |
| `onSceneEnter`   | `SceneChangeDetail` `{ fromIndex, toIndex, direction? }`             | Before a switch                         |
| `onSceneLeave`   | `SceneChangeDetail`                                                  | After a switch                          |
| `onError`        | `CineViewErrorDetail` `{ code, message, context?, preventDefault? }` | Central error outlet; see "Error codes" |

### Drag-only

| callback         | detail                                                           | notes                                                                         |
| ---------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `onDragStart`    | `DragStartDetail` `{ sceneIndex, progress, direction }`          | Fires only after the first direction-qualified gesture takes drag ownership   |
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

These five have real implementations in both modes and are required. No `?.()` guarding is needed at call sites.

`goToZone(zoneId, { align?: 'center', animated?: boolean })` is scroll-only and optional on `CineViewRef` (drag has no zones). Scroll consumers can use `CineViewScrollRef`, where `goToZone` is required:

```tsx
const ref = useRef<CineViewScrollRef>(null);
ref.current?.goToZone('intro-seq', { align: 'center' });
```

## Error codes

The `code` passed to `onError` is the `CineViewErrorCode` union, so a switch gets exhaustiveness checking. Recoverable errors carry `preventDefault`: if uncalled, the engine executes its default fallback strategy; calling it yields control to custom application logic (such as rendering a retry interface).

| code                          | fired when                                                                   | recovery                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `EMPTY_SCENES`                | CineView has no `Scene` children                                             | none                                                                                                     |
| `IMAGE_LOAD_FAILED`           | A preloaded image failed                                                     | none                                                                                                     |
| `FIRST_SCENE_TIMEOUT`         | First-screen priority assets timed out (`firstSceneTimeout`, default 3000ms) | Recoverable, with `preventDefault`; default fallback statically places the first scene in its rest state |
| `INVALID_ANIMATION`           | An Animate `after` points at a component that does not exist                 | none                                                                                                     |
| `CIRCULAR_DEPENDENCY`         | An `after` chain forms a cycle                                               | none                                                                                                     |
| `INVALID_COMPONENT_HIERARCHY` | Duplicate `animateId`, or duplicate scroll zone identity                     | none                                                                                                     |
| `INVALID_DRAG_CONFIG`         | Illegal drag `unit` / `scale` / `enabled` config                             | Recoverable                                                                                              |
| `ANIMATION_ASSET_LOAD_FAILED` | An animation preset asset failed to load                                     | Retryable                                                                                                |

## Entries and bundle size

At runtime CineView dispatches on `mode`, and the full `cineview` entry ships both engines. When using only a single mode, import the per-mode entry `cineview/drag` or `cineview/scroll` (exporting `CineViewDragProps` / `CineViewScrollProps` respectively). A single-file Universal Module Definition (UMD) build cannot code-split, so single-mode UMD consumers especially must pick the right entry. See [Installation](/docs/02-installation) and [Performance](/docs/01-performance).

## Related pages

- [Scene](/docs/02-scene): the chapter container
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
