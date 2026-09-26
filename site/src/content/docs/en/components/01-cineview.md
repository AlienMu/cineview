---
title: Cineview
eyebrow: COMPONENTS / CINEVIEW
---

Cineview runs the page's scenes, selects drag or scroll behavior, and sets the design width used for responsive lengths. Its ref provides navigation, layout refresh, preloading, and performance readings.

Place Scene elements inside Cineview. They are its JSX children and need no separate configuration. Add `callbacks` when the application needs scene or input notifications.

```tsx
<Cineview mode="drag">
  <Scene sceneId="intro">
    <h1>Intro</h1>
  </Scene>
  <Scene sceneId="details">
    <h2>Details</h2>
  </Scene>
</Cineview>
```

## Props

Omitting `mode` selects `'drag'`. TypeScript checks configuration and callbacks against the selected mode and rejects fields for the other mode.

| prop          | type                       | default                           | notes                                                 |
| ------------- | -------------------------- | --------------------------------- | ----------------------------------------------------- |
| `designWidth` | `number`                   | `750`                             | Design width base, see the designWidth section        |
| `mode`        | `'drag' \| 'scroll'`       | `'drag'`                          | Drag paging / scroll document flow                    |
| `scrollbar`   | `false \| ScrollbarConfig` | `false` (equivalent when omitted) | Optional overlay in scroll mode                       |
| `monitor`     | `boolean`                  | `false`                           | Enables performance sampling                          |
| `debug`       | `boolean`                  | `false`                           | Adds scroll locked-zone layout diagnostics to the DOM |
| `a11y`        | `{ label?: string }`       | label: `'Scenes'`                 | Accessible name for the drag container                |

### designWidth

Set `designWidth` to the width of the design file; the default is 750. Numeric design lengths on both axes scale by `viewportWidth / designWidth`. Locked-zone duration stays at `1ms = 1px`. See [Responsive conversion](/docs/05-responsive).

### Drag configuration

| field                | type                                               | default                   | notes                                                                                                                                                     |
| -------------------- | -------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `direction`          | `'x' \| 'y'`                                       | `'y'`                     | Drag direction                                                                                                                                            |
| `transitionDuration` | `number`                                           | `800`                     | Transition duration in ms for `ref.goToScene()`; gesture timing is calculated separately                                                                  |
| `threshold`          | `{ minVelocity, maxVelocity, minRatio, maxRatio }` | `0 / 1000 / 0.15 / 0.3`   | Commit thresholds, detailed in [Gestures](/docs/02-gestures)                                                                                              |
| `unit`               | `'time' \| 'percent'`                              | `'time'`                  | Drag-mapping unit for Scene element timelines                                                                                                             |
| `scale`              | `number`                                           | `time: 10` / `percent: 1` | Amount mapped per 1% of drag, interpreted by `unit`                                                                                                       |
| `firstSceneTimeout`  | `number`                                           | `3000`                    | Wait limit in ms for first-screen priority resources. A timeout reports `FIRST_SCENE_TIMEOUT` and shows the first Scene at its completed state by default |

### Scroll configuration

| field         | type                    | default     | notes                                                    |
| ------------- | ----------------------- | ----------- | -------------------------------------------------------- |
| `direction`   | `SlideDirection`        | `'y'`       | Scroll direction                                         |
| `sceneSizing` | `'content' \| 'screen'` | `'content'` | Size ordinary scenes by content or at least one viewport |
| `enterMargin` | `number`                | `50`        | Default visibility entrance margin in design pixels      |
| `exitMargin`  | `number`                | `50`        | Default visibility exit margin in design pixels          |

### scrollbar

Scroll mode can display a custom scrollbar. Omitting `scrollbar` has the same effect as passing `false`. When a configuration object is supplied, `enabled` defaults to `true`.

| field             | type      | default                           | notes                                   |
| ----------------- | --------- | --------------------------------- | --------------------------------------- |
| `enabled`         | `boolean` | `true` when an object is supplied | Overlay on or off                       |
| `ariaLabel`       | `string`  | `'CineView scroll position'`      | Accessible label                        |
| `width`           | `number`  | `6`                               | Thickness (px), floored at 4            |
| `radius`          | `number`  | `999`                             | Corner radius; fully rounded by default |
| `inset`           | `number`  | `0`                               | Inset from container edges (px)         |
| `trackColor`      | `string`  | `'transparent'`                   | Track color                             |
| `thumbColor`      | `string`  | `'rgba(255,255,255,0.28)'`        | Thumb color                             |
| `thumbHoverColor` | `string`  | same as `thumbColor`              | Thumb fill while the pointer hovers     |
| `autoHide`        | `boolean` | `true`                            | Hide when idle                          |

Theming example: [Scrollbar theming](/docs/05-scrollbar).

## Callbacks

`callbacks` is an optional event-handler object: `DragModeCallbacks` for drag and `ScrollModeCallbacks` for scroll. Provide only the notifications the application needs. An empty object is unnecessary.

```tsx
<Cineview callbacks={{ onSceneEnter: ({ toIndex }) => console.log(toIndex) }}>
  <Scene sceneId="intro">
    <h1>Intro</h1>
  </Scene>
  <Scene sceneId="details">
    <h2>Details</h2>
  </Scene>
</Cineview>
```

TypeScript checks `callbacks` against `mode`. For example, `onZoneProgress` is unavailable in drag and `onDragEnd` is unavailable in scroll. The check also applies to callback objects stored in variables.

### Common callbacks (both modes)

| callback         | detail                | notes                                                                      |
| ---------------- | --------------------- | -------------------------------------------------------------------------- |
| `onReady`        | `api: CineviewRef`    | Ref API available after mount; does not wait for assets                    |
| `onLoadProgress` | `progress: number`    | Queued request completion, integer 0–100, including failed requests        |
| `onSceneEnter`   | `SceneChangeDetail`   | Scene-change notification; gesture changes notify at commit                |
| `onSceneLeave`   | `SceneChangeDetail`   | Companion scene-change notification; child animations may still be running |
| `onError`        | `CineviewErrorDetail` | Error code, message, context, and optional fallback control                |

### Drag-only

| callback         | detail                                                           | notes                                                                         |
| ---------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `onDragStart`    | `DragStartDetail` `{ sceneIndex, progress, direction }`          | Fires when the gesture direction is confirmed and dragging starts             |
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
import { useRef } from 'react';
import { Cineview, Scene, type CineviewRef } from 'cineview';

export default function Demo() {
  const ref = useRef<CineviewRef>(null);
  return (
    <>
      <button onClick={() => ref.current?.goToScene(1)}>Show second scene</button>
      <Cineview ref={ref} mode="scroll" designWidth={750}>
        <Scene sceneId="first">
          <h1>First scene</h1>
        </Scene>
        <Scene sceneId="second">
          <h1>Second scene</h1>
        </Scene>
      </Cineview>
    </>
  );
}
```

| method                  | signature                                              | notes                                                                                            |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `goToScene`             | `(index: number, animated?: boolean) => void`          | Jump to a scene                                                                                  |
| `refreshLayout`         | `() => void`                                           | Re-measure layout                                                                                |
| `preload`               | `(targets?: CineviewPreloadTarget[]) => Promise<void>` | Preload. Targets are scene indexes (number) or `sceneId`; in scroll mode a `zoneId` also matches |
| `getCurrentIndex`       | `() => number`                                         | Current scene index                                                                              |
| `getPerformanceMetrics` | `() => PerformanceMetrics`                             | `{ fps, avgFrameTime, memoryUsage?, bundleSize }`                                                |

These methods exist in both modes. Guard `ref.current` until mount; the individual methods do not need optional calls.

`goToZone(zoneId, { animated?: boolean })` is scroll-only and optional on `CineviewRef` (drag has no zones). Scroll consumers can use `CineviewScrollRef`, where `goToZone` is required:

Declare the ref with `useRef<CineviewScrollRef>(null)`, then call `ref.current?.goToZone('intro-seq')` for a Scene whose `scroll.zoneId` is `intro-seq`.

## Error codes

`onError` receives a detail object with `code`, `message`, and optional `context`. Check `detail.code` against the `CineviewErrorCode` union. `FIRST_SCENE_TIMEOUT` also provides `preventDefault`; calling `detail.preventDefault?.()` suppresses its automatic first-scene reveal so the application can handle the timeout.

| code                          | fired when                                                             | recovery                                                                         |
| ----------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `EMPTY_SCENES`                | Cineview has no Scene children, or a Scene has no content              | Add the missing content                                                          |
| `IMAGE_LOAD_FAILED`           | A queued resource failed in drag mode                                  | Handle the asset failure                                                         |
| `FIRST_SCENE_TIMEOUT`         | First-screen resource wait exceeded its limit                          | Optional `preventDefault`; otherwise show the first Scene at its completed state |
| `INVALID_ANIMATION`           | Missing dependency, incompatible driver, or unsupported manual control | Correct the reported animation configuration                                     |
| `CIRCULAR_DEPENDENCY`         | An `after` chain forms a cycle                                         | none                                                                             |
| `INVALID_COMPONENT_HIERARCHY` | Duplicate `animateId`, or duplicate scroll zone identity               | none                                                                             |
| `INVALID_DRAG_CONFIG`         | Illegal drag `unit` / `scale` / `enabled` config                       | Recoverable                                                                      |
| `ANIMATION_ASSET_LOAD_FAILED` | An animation preset asset failed to load                               | Retryable                                                                        |

## Package entries

Use `cineview` with ES module (ESM) bundlers; it includes both engines. The mode subpaths `cineview/drag` and `cineview/scroll` support CommonJS and export their respective prop types. Separate Universal Module Definition (UMD) files support script loading with supplied peer runtimes. See [Installation](/docs/02-installation).

## Related pages

- [Scene](/docs/02-scene): scene content, layout, and transitions
- [The two modes](/docs/01-modes): drag and scroll behavior
- [Responsive scaling](/docs/05-responsive): how `designWidth` drives conversion
