---
title: Callbacks
eyebrow: ADVANCED / CALLBACKS
---

Pass a flat `callbacks` object to Cineview. TypeScript checks its keys against `mode`: both modes accept common callbacks, with drag and scroll events available only in their corresponding mode.

## Callback table

Common callbacks (available in both modes):

| Callback         | detail / argument                    | Fires                                                                          |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| `onReady`        | `api: CineviewRef`                   | Ref API available after mount; does not wait for resources                     |
| `onLoadProgress` | `progress: number`                   | Queued request completion, integer 0–100, including failures                   |
| `onSceneEnter`   | `{ fromIndex, toIndex, direction? }` | Scene-change notification; gesture changes notify at commit                    |
| `onSceneLeave`   | `{ fromIndex, toIndex, direction? }` | Companion scene-change notification, independent of child animation completion |
| `onError`        | `CineviewErrorDetail`                | Single error outlet, see "onError and error codes"                             |

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

## Select callbacks for the mode

TypeScript checks callbacks against `mode`. This example produces a type error because `onZoneProgress` is only available in scroll mode:

```tsx
<Cineview mode="drag" callbacks={{ onZoneProgress: () => {} }}>
  <Scene sceneId="example">Content</Scene>
</Cineview>
```

The same check applies when the callback object is stored in a variable.

A configuration for scroll mode:

```tsx
<Cineview
  mode="scroll"
  callbacks={{
    onReady: (api) => api.preload(['intro']),
    onError: ({ code, message }) => console.error(code, message),
  }}
>
  <Scene sceneId="intro" assets={{ preloadImages: ['/intro.jpg'] }}>
    Content
  </Scene>
</Cineview>
```

## onError and error codes

`CineviewErrorDetail` contains `code`, `message`, optional `context`, and optional `preventDefault`. Use a `never` check when a switch needs exhaustive handling.

| code                          | Meaning                                                           | Recoverability                     |
| ----------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| `EMPTY_SCENES`                | Cineview has no Scene children, or a Scene has no content         | Add content                        |
| `IMAGE_LOAD_FAILED`           | A queued resource failed in drag mode                             | Handle the resource error          |
| `FIRST_SCENE_TIMEOUT`         | Initial priority resource wait timed out                          | Optional fallback control          |
| `INVALID_ANIMATION`           | Missing or incompatible dependency, or unsupported manual control | Correct the reported configuration |
| `CIRCULAR_DEPENDENCY`         | The `after` chain has a cycle                                     | No                                 |
| `INVALID_COMPONENT_HIERARCHY` | Duplicate `animateId`, or duplicate zone identity                 | No                                 |
| `INVALID_DRAG_CONFIG`         | Illegal drag unit / scale / enabled config                        | Recoverable                        |
| `ANIMATION_ASSET_LOAD_FAILED` | An animation preset asset failed to load                          | Retryable                          |

A `FIRST_SCENE_TIMEOUT` supplies `preventDefault`. Call it only when the application provides another wait or retry interface; otherwise the default displays the first Scene at its completed state.

```tsx
import type { CineviewErrorDetail } from 'cineview';

export function handleError(detail: CineviewErrorDetail) {
  if (detail.code === 'FIRST_SCENE_TIMEOUT') {
    // Keep the default display behavior and report the timeout.
    console.warn(detail.message);
    return;
  }
  console.error(detail.code, detail.message);
}
```

For an application-owned fallback, use `detail.preventDefault?.()` before displaying it. The optional call is required because the public error type does not narrow this method by code.

## Gesture notifications and performance

- `onDragStart` fires once per gesture when its direction is confirmed and dragging starts. A touch that does not become a drag produces no notification.
- `onDragProgress` and `onZoneProgress` run frequently. Use MotionValues for continuous visual updates to avoid updating React state on every notification. See [Performance](/docs/01-performance).
