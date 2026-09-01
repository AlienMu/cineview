---
title: Callbacks
eyebrow: ADVANCED / CALLBACKS
---

`CineView`'s `callbacks` prop is a flat object whose accepted keys are discriminated by `mode`: drag mode takes common + drag callbacks, scroll mode takes common + scroll callbacks. Passing a wrong-mode callback is not silently ignored at runtime: it's a TypeScript type error.

## Callback table

Common callbacks (available in both modes):

| Callback         | detail / argument                    | Fires                                                                                                        |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `onReady`        | `api: CineViewRef`                   | Runtime ready, carrying the ref API                                                                          |
| `onLoadProgress` | `progress: number`                   | Preload progress as an **integer from 0 to 100** (not 0 to 1); reports 100 outright when there are no assets |
| `onSceneEnter`   | `{ fromIndex, toIndex, direction? }` | Before a scene change                                                                                        |
| `onSceneLeave`   | `{ fromIndex, toIndex, direction? }` | After a scene change                                                                                         |
| `onError`        | `CineViewErrorDetail`                | Single error outlet, see "onError and error codes"                                                           |

`direction` is `'forward' | 'backward'` and may be `null`.

Drag-only:

| Callback         | detail                                                                                  | Fires                                                                    |
| ---------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `onDragStart`    | `{ sceneIndex, progress, direction }`                                                   | Only on the first direction-qualified gesture; `direction` is always set |
| `onDragProgress` | `{ sceneIndex, progress, direction? }`                                                  | During the drag                                                          |
| `onDragBlocked`  | `{ fromIndex, targetSceneIndex, direction }`                                            | Drag blocked, for example an unreachable target                          |
| `onDragEnd`      | `{ sceneIndex, progress, direction?, targetSceneIndex, elapsedMs, timelineDurationMs }` | Drag committed to a scene change, with target and timeline data          |
| `onDragCancel`   | `{ sceneIndex, progress, direction? }`                                                  | Drag below threshold, settling back                                      |

Scroll-only:

| Callback                  | detail                               | Fires                                                                |
| ------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| `onZoneEnter`             | `{ zoneId, sceneIndex }`             | Entering a locked zone                                               |
| `onZoneLeave`             | `{ zoneId, sceneIndex }`             | Leaving a locked zone                                                |
| `onZoneProgress`          | `{ zoneId, sceneIndex, progress }`   | Zone progress (zone semantics in [center-lock](/docs/01-centerlock)) |
| `onSceneVisibilityChange` | `{ sceneIndex?, visible, progress }` | Scene visibility changes                                             |

## Discriminated union: the wrong mode won't compile

Passing a scroll callback with `mode="drag"` (or vice versa) is a type error:

```tsx
// ❌ Type error: a scroll-only callback can't enter drag mode
<CineView
  mode="drag"
  callbacks={{
    onDragEnd: (d) => console.log(d.targetSceneIndex),
    onZoneProgress: (d) => console.log(d.progress), // ts error
  }}
>
```

The rejection holds on both assignment paths: inline object literals are caught by excess-property checking, and a pre-extracted variable mixing callbacks from both modes (`{ onDragEnd, onZoneProgress }`) is caught by the `never` fallback marking every cross-mode key. This is the type system enforcing it, not a convention.

Correctly split per mode:

```tsx
<CineView
  mode="scroll"
  callbacks={{
    onReady: (api) => api.preload(['intro']),
    onZoneProgress: ({ zoneId, progress }) => {},
    onError: ({ code }) => {},
  }}
>
```

## onError and error codes

`CineViewErrorDetail` is `{ code, message, context?, preventDefault? }`. `code` is the `CineViewErrorCode` union, so a `switch` gets autocompletion and exhaustiveness checking:

| code                          | Meaning                                           | Recoverability                     |
| ----------------------------- | ------------------------------------------------- | ---------------------------------- |
| `EMPTY_SCENES`                | CineView has no Scene children                    | No                                 |
| `IMAGE_LOAD_FAILED`           | A preloaded image failed                          | No                                 |
| `FIRST_SCENE_TIMEOUT`         | First-screen priority asset wait timed out        | Recoverable (has `preventDefault`) |
| `INVALID_ANIMATION`           | `after` points at a non-existent component        | No                                 |
| `CIRCULAR_DEPENDENCY`         | The `after` chain has a cycle                     | No                                 |
| `INVALID_COMPONENT_HIERARCHY` | Duplicate `animateId`, or duplicate zone identity | No                                 |
| `INVALID_DRAG_CONFIG`         | Illegal drag unit / scale / enabled config        | Recoverable                        |
| `ANIMATION_ASSET_LOAD_FAILED` | An animation preset asset failed to load          | Retryable                          |

`preventDefault` only appears on recoverable errors that have a default framework fallback (`FIRST_SCENE_TIMEOUT` being the typical one). Calling it suppresses the default behavior and hands event control over to custom handling (for example to render a retry UI); not calling it lets the framework proceed with its fallback.

```tsx
onError: ({ code, message, preventDefault }) => {
  if (code === 'FIRST_SCENE_TIMEOUT') {
    preventDefault(); // suppress default fallback; take over error handling
    showRetry();
    return;
  }
  reportToSentry(code, message); // report everything else as usual
};
```

## Two behavioral notes

- `onDragStart` fires only on the **first direction-qualified** drag gesture; a light touch doesn't count.
- Reading values inside callbacks is fine; writing per-frame callback values (`onDragProgress`, `onZoneProgress`) into React state is the performance problem. See [Performance](/docs/01-performance).
