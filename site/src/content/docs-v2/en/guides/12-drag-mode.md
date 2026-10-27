---
title: Drag mode
eyebrow: GUIDES / DRAG MODE
---

A page with `input="drag"` shows one scene per screen, switched by dragging up and down. Two things happen during a drag: the page follows the finger, and the next scene's entrance moves with it.

<!-- example:drag -->

## Finger and time

`unit` and `scale` turn drag distance into the next scene's time:

| `unit` | Mapping | Default `scale` |
| --- | --- | --- |
| `time` | Each 1% of a screen dragged moves `scale` ms | `10`: a full screen moves 1000 ms |
| `percent` | The share of a screen dragged, times `scale`, times the scene's length | `1`: a full screen plays the whole scene |

On `cv-stage` they apply to every scene; on `cv-scene`, to that scene only. After a release that switches, the rest of the entrance plays at normal speed while the page slides into place over `transition-duration` (800 ms by default).

## When a release switches

Without `threshold`:

- A quick swipe under 300 ms switches once the finger has moved 8% of the screen height.
- A slower drag switches once the page has moved more than half a screen.
- Movement within 5 px is not a drag, and a fast flick back the other way cancels.

With `threshold`, three numbers set the rule (slow share, fast share, speed), as in `threshold="0.3 0.15 1000"`: a release at rest needs 30%, a release at 1000 px per second needs only 15%, and speeds in between scale linearly. It works on the stage or on one scene.

## Dragging back and leaving

- Dragging back plays the previous scene's entrance in reverse.
- Elements of the current scene with an `exit` play it while the page moves away, timed by `transition-duration`.
- A scene with `drag="off"` cannot be dragged into: dragging toward it dispatches `cv-dragblocked`, and a link or `stage.goTo()` still reaches it.

## Other input

- The Up and Down arrow keys, Page Up and Page Down go to the previous or next scene; Home and End go to the first and last. Nothing happens while focus is in a text field.
- Links to a scene's id and an `#id` in the address go to that scene; opening an address with `#id` starts there.
- A press that starts on a button, a link, a text field, `cv-pause` or an element with `data-cv-ignore-drag` does not drag the page.
- An area of the scene that scrolls keeps the gesture while it can still scroll that way.

## Rendered range and events

Only the current scene and one on each side are rendered; the others get `inert` and are skipped. A scene entering or leaving that range dispatches `cv-activate` or `cv-deactivate`, a good place to start or stop drawing of your own.

A drag dispatches `cv-dragstart`, `cv-dragend` and `cv-dragcancel`; [states and events](/docs/v2/07-states-and-events) lists their fields. `cv-progress` with `kind: 'page'` gives the page position, for page numbers or a progress indicator.
