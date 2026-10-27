---
title: States and events
eyebrow: CONCEPTS / STATES AND EVENTS
---

The page's state is written as attributes on its elements, for CSS to style against; each change dispatches an event, for scripts to listen to.

## State attributes

| Attribute | On | Meaning |
| --- | --- | --- |
| `data-cv-theme` | `cv-stage` | The current scene's `theme`, for a page-wide palette |
| `data-cv-direction` | `cv-stage` | Which way the reader moves: `forward` or `backward` |
| `data-cv-current` | `cv-scene` | The current scene |
| `data-cv-stuck` | `cv-scene` | Held: a locked zone during its hold, or a stacked scene while the next one covers it |
| `data-cv-covered` | `cv-scene` | A stacked scene fully covered, which is no longer painted |
| `data-cv-active` | `cv-scene` | In drag mode, a scene inside the rendered range |
| `data-cv-phase` | `cv-animate` | The element's phase: `idle`, `waiting`, `entering`, `entered`, `exiting`, `exited` |
| `data-cv-dealt` | `cv-stack` | Cards arriving one by one along the timeline (in locked zones and drag mode) |
| `aria-current`, `data-cv-before`, `data-cv-after` | Links to scenes | The link to the current scene, and links to scenes before and after it |

```css
/* a page-wide palette for a dark scene */
cv-stage[data-cv-theme="night"] { --ground: #0b0e1a; --ink: #eef1ff; }
/* show the top bar when the reader scrolls back */
cv-stage[data-cv-direction="backward"] ~ .bar { translate: 0 0; }
```

## Events

Every event bubbles, so one listener on `document` covers them.

| Event | On | `detail` |
| --- | --- | --- |
| `cv-ready` | The stage | None; after the first build has rendered |
| `cv-enter`, `cv-leave` | The scene entered or left | `{ from, to, direction }` |
| `cv-progress` | The stage or a scene | `{ kind: 'load', progress, loaded, total }`, `{ kind: 'zone', index, progress }`, `{ kind: 'page', index, progress, direction }` |
| `cv-activate`, `cv-deactivate` | A scene | None; the scene enters or leaves the rendered range (in scroll, about one screen above and below the viewport) |
| `cv-dragstart` | The stage | `{ index, direction }` |
| `cv-dragend` | The stage | `{ index, from, to, direction, progress, elapsed, total }` |
| `cv-dragcancel` | The stage | `{ index, direction, progress }` |
| `cv-dragblocked` | The stage | `{ index, target, direction }`; dragging toward a scene with `drag="off"` |
| `cv-timeout` | The stage | `{ loaded, total }`; the first-screen wait timed out, cancelable |
| `cv-pause`, `cv-play` | The stage | None |
| `cv-error` | The element at fault | `{ code, message, element }`, cancelable |

`stage.ready` is a Promise that settles with `cv-ready`, and also settles at once when awaited after the event.

## Error codes

| `code` | Cause |
| --- | --- |
| `invalid-attribute` | An attribute value that cannot be read (fx items, `from`, `to`, `ease`, `on`, `loop`, `range`, units) |
| `unknown-effect` | An effect or loop name that does not exist |
| `unknown-keyframes` | `keyframes(name)` finds no such `@keyframes` rule |
| `duplicate-name` | Two elements of one scene share a name |
| `missing-after` | `after` names nothing in this scene |
| `cycle` | `after` forms a loop |
| `unbounded-at` | `at` leaves no room for what follows |
| `bad-at` | An `at` value that cannot be read (every value needs `%`), or a scene whose time cannot be solved |
| `invalid-drag-config` | A stage or scene `unit` or `scale` that cannot be read |
| `asset-failed` | A preloaded image or video, a `cv-video` file, or an on-demand module failed to load |
| `empty-stage` | No scenes in the stage once the document has parsed |

The page keeps running after an error: the part that cannot be read is ignored and the rest works. The development build prints the same message in the console; `preventDefault()` on the `cv-error` event skips that.

## The stage's script interface

| Member | Does |
| --- | --- |
| `stage.ready` | A Promise that settles when the first build is done |
| `stage.current` | The current scene's index, -1 before the first build |
| `stage.goTo(target, { animated })` | Go to a scene by index or id |
| `stage.pause()`, `stage.play()` | Pause and resume motion played on time (entrances and loops) |
| `stage.refresh()` | Measure again after a layout change the stage cannot see |
