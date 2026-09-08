---
title: The four input paths
eyebrow: SCROLL / INPUT
---

Wheel, touch, keyboard, and scrollbar input all update the native scroll position. Locked zones apply the same anti-skip limits to each input.

## Input and scroll position

```text
input → main-axis pixel movement → segment limits → scroll position → animation progress
```

Movements of at most 0.5px can leave the position unchanged. A scrollbar drag calculates its target position first, then applies the same segment limits.

## When input is consumed

When CineView applies a movement, it prevents the cancelable event's browser default. If the event produces no effective movement, the default remains available.

An input that crosses a locked segment can stop at its endpoint. The next input continues into the following content. A segment endpoint does not always produce zero movement; the container's scroll limit does.

Pointer input outside CineView and events already marked `defaultPrevented` are ignored. The keyboard focus rules are described in [Keyboard event listeners](#Keyboard-event-listeners).

## What differs per path

| Path      | Delta source                                       | Normalization                                                                           | Notable                                                    |
| --------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| wheel     | `deltaY` with `direction:'y'`, `deltaX` with `'x'` | `deltaMode:1` (lines) ×18; `deltaMode:2` (pages) × viewport span; `0` (pixels) verbatim | bound in the capture phase with `passive: false`           |
| touch     | Difference from the preceding touch position       | Main-axis pixels                                                                        | Updates the baseline after each move                       |
| keyboard  | keys map to fixed steps                            | see the keyboard step table                                                             | two handlers with different semantics                      |
| scrollbar | drag or track click computes a target offset       | converted to a delta, same clamp                                                        | arrow keys with the rail focused share the same step table |

Keyboard step sizes are fixed:

| Key                     | Step                              |
| ----------------------- | --------------------------------- |
| `PageDown` / `PageUp`   | ± viewport span × 0.86            |
| `Space` / `Shift+Space` | same as PageDown / PageUp         |
| `ArrowDown` / `ArrowUp` | ± 80px                            |
| `Home` / `End`          | ∓ Infinity (bounded to endpoints) |

## Keyboard event listeners

Key input binds at two levels:

Window level (capture phase): active only when `document.activeElement` is `body` or `documentElement` (no specific page element holds focus).

Container level (`onKeyDownCapture`): active when focus resides within the container, deferring to nested scrollables where present.

Both levels share input exemptions: all keys yield to `input`, `textarea`, `select`, and `contentEditable` elements, while the Space key yields additionally to buttons, summaries, and anchor links.

## Keys do not rotate under horizontal mode

Under horizontal mode:

- Key semantics retain their main-axis forward mapping (`ArrowDown` and `PageDown` advance along positive x).
- The wheel reads `deltaX` exclusively; vertical scrolling produces a zero delta unless shifted (`Shift + wheel`) or performed via trackpad horizontal gestures.

See [Horizontal direction: 'x'](/docs/04-direction-x).

## Nested scrollables take precedence

If a nested scrollable can move in the input direction, CineView lets it handle the event. The check uses the active axis, a scrollable overflow style, and remaining travel greater than one pixel.

This applies to wheel, touch, and keyboard events handled inside the container.

## Programmatic scroll versus user input

While smooth programmatic scrolling (`goToScene` / `goToZone`) is active, boundary clamping is temporarily suspended. If user input (wheel, touch, key, or scrollbar drag) arrives during transition, the engine immediately stops the programmatic transition, establishes a new gesture baseline at the current offset, and resumes normal input processing.

## Related pages

- [Center-lock scrolling](/docs/01-centerlock): boundary clamping rules and segment geometry
- [Scrollbar theming](/docs/05-scrollbar): fields and defaults for the drawn scrollbar
- [Horizontal direction: 'x'](/docs/04-direction-x): every difference in horizontal mode
- [Scroll troubleshooting](/docs/06-scroll-pitfalls): the input-related common failures
