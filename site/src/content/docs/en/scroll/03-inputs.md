---
title: The four input paths
eyebrow: SCROLL / INPUT
---

Wheel, touch, keyboard, and scrollbar drag inputs route through a unified dispatch pipeline. Input deltas are evaluated against anti-skip boundary constraints, written to `scrollTop`, and synchronized with locked-zone state. Differences across the four paths center on delta computation and event consumption conditions.

## The shared entry point

```text
input event → normalize to a main-axis px delta → applyNativeScrollDelta(delta)
            → anti-skip boundary clamp → write scrollTop → sync zone state
```

Applying a delta returns a boolean indicating whether the displacement was consumed. If the computed target offset rests within 0.5px of the current position, the function returns `false` without performing DOM writes.

Scrollbar dragging takes a separate entry point: it converts target offsets into deltas, then applies identical boundary constraints.

## Conditional preventDefault

The engine invokes `preventDefault` only when the displacement delta is actively consumed:

```text
if (applyNativeScrollDelta(delta) && event.cancelable) event.preventDefault();
```

When scrolling reaches the end of a locked segment (`segmentEnd`), boundary clamping produces zero movement, leaving the event unconsumed and allowing native document flow scrolling to continue uninterrupted.

Events where `defaultPrevented` is already `true` or whose targets reside outside the CineView container are ignored.

## What differs per path

| Path      | Delta source                                                             | Normalization                                                                           | Notable                                                    |
| --------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| wheel     | `deltaY` with `direction:'y'`, `deltaX` with `'x'`                       | `deltaMode:1` (lines) ×18; `deltaMode:2` (pages) × viewport span; `0` (pixels) verbatim | bound in the capture phase with `passive: false`           |
| touch     | `touchstart` sets a baseline, `touchmove` takes the main-axis difference | used directly as px                                                                     | baseline resets every frame to track per-frame delta       |
| keyboard  | keys map to fixed steps                                                  | see the keyboard step table                                                             | two handlers with different semantics                      |
| scrollbar | drag or track click computes a target offset                             | converted to a delta, same clamp                                                        | arrow keys with the rail focused share the same step table |

The keyboard steps are fixed invariants and cannot be reconfigured:

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

Before applying boundary constraints, the engine traverses upward from the event target to find any ancestor container with unconsumed scroll capacity on the active axis (computed `overflow` of `auto` or `scroll` with remaining distance > 1px). When found, the engine defers event handling to the nested container.

Wheel, touch, and container-level keyboard listeners all enforce this check.

## Programmatic scroll versus user input

While smooth programmatic scrolling (`goToScene` / `goToZone`) is active, boundary clamping is temporarily suspended. If user input (wheel, touch, key, or scrollbar drag) arrives during transition, the engine immediately stops the programmatic transition, establishes a new gesture baseline at the current offset, and resumes normal input processing.

## Related pages

- [Center-lock scrolling](/docs/01-centerlock): boundary clamping rules and segment geometry
- [Scrollbar theming](/docs/05-scrollbar): fields and defaults for the drawn scrollbar
- [Horizontal direction: 'x'](/docs/04-direction-x): every difference in horizontal mode
- [Scroll troubleshooting](/docs/06-scroll-pitfalls): the input-related common failures
