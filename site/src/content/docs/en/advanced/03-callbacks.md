---
title: Callbacks
eyebrow: ADVANCED / CALLBACKS
---

Pass a flat `callbacks` object to CineView. TypeScript checks its keys against `mode`: both modes accept common callbacks, with drag and scroll events available only in their corresponding mode.

## Callback table

Common callbacks (available in both modes):

| Callback         | detail / argument                    | Fires                                                                          |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| `onReady`        | `api: CineViewRef`                   | Ref API available after mount; does not wait for resources                     |
| `onLoadProgress` | `progress: number`                   | Queued request completion, integer 0–100, including failures                   |
| `onSceneEnter`   | `{ fromIndex, toIndex, direction? }` | Scene-change notification; gesture changes notify at commit                    |
| `onSceneLeave`   | `{ fromIndex, toIndex, direction? }` | Companion scene-change notification, independent of child animation completion |
| `onError`        | `CineViewErrorDetail`                | Single error outlet, see "onError and error codes"                             |

`direction` is `'forward'`, `'backward'`, or `null`. Gesture and programmatic timing are described in [Drag callbacks](/docs/05-callbacks).

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

The unsupported callback in this example produces a type error:

```tsx
<CineView mode="drag" callbacks={{ onZoneProgress: () => {} }}>
  <Scene sceneId="example">Content</Scene>
</CineView>
```

The same check applies when the callback object is stored in a variable.

Correctly split per mode:

```tsx
<CineView
  mode="scroll"
  callbacks={{
    onReady: (api) => api.preload(['intro']),
    onError: ({ code, message }) => console.error(code, message),
  }}
>
  <Scene sceneId="intro" assets={{ preloadImages: ['/intro.jpg'] }}>
    Content
  </Scene>
</CineView>
```

## onError and error codes

`CineViewErrorDetail` contains `code`, `message`, optional `context`, and optional `preventDefault`. Use a `never` check when a switch needs exhaustive handling.

| code                          | Meaning                                                           | Recoverability                     |
| ----------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| `EMPTY_SCENES`                | CineView has no Scene children, or a Scene has no content         | Add content                        |
| `IMAGE_LOAD_FAILED`           | A queued resource failed in drag mode                             | Handle the resource error          |
| `FIRST_SCENE_TIMEOUT`         | Initial priority resource wait timed out                          | Optional fallback control          |
| `INVALID_ANIMATION`           | Missing or incompatible dependency, or unsupported manual control | Correct the reported configuration |
| `CIRCULAR_DEPENDENCY`         | The `after` chain has a cycle                                     | No                                 |
| `INVALID_COMPONENT_HIERARCHY` | Duplicate `animateId`, or duplicate zone identity                 | No                                 |
| `INVALID_DRAG_CONFIG`         | Illegal drag unit / scale / enabled config                        | Recoverable                        |
| `ANIMATION_ASSET_LOAD_FAILED` | An animation preset asset failed to load                          | Retryable                          |

A `FIRST_SCENE_TIMEOUT` supplies `preventDefault`. Call it only when the application provides another wait or retry interface; otherwise the default displays the first Scene at its completed state.

```tsx
import type { CineViewErrorDetail } from 'cineview';

export function handleError(detail: CineViewErrorDetail) {
  if (detail.code === 'FIRST_SCENE_TIMEOUT') {
    // Keep the default display behavior and report the timeout.
    console.warn(detail.message);
    return;
  }
  console.error(detail.code, detail.message);
}
```

For an application-owned fallback, use `detail.preventDefault?.()` before displaying it. The optional call is required because the public error type does not narrow this method by code.

## Two behavioral notes

- `onDragStart` fires only on the **first direction-qualified** drag gesture; a light touch doesn't count.
- Reading values inside callbacks is fine; writing per-frame callback values (`onDragProgress`, `onZoneProgress`) into React state is the performance problem. See [Performance](/docs/01-performance).
