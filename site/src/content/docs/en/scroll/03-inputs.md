---
title: The four input paths
eyebrow: SCROLL / INPUT
---

Wheel, touch, keyboard, and scrollbar drag all funnel into one function: hand the delta to the intent clamp, write `scrollTop`, resync zone state. Locking semantics are therefore identical across all four, and the paths differ only in how the delta is derived and who is allowed to intercept.

## The shared entry point

```text
input event → normalize to a main-axis px delta → applyNativeScrollDelta(delta)
            → intent clamp (anti-skip / in-segment) → write scrollTop → sync zone state
```

`applyNativeScrollDelta` returns a boolean: whether the delta was actually consumed. If the clamped landing offset is within 0.5px of the current offset it returns `false` and writes nothing at all.

Scrollbar drag goes through `applyNativeScrollbarOffset`, which converts a target offset into a delta and runs the same clamp, so dragging the bar cannot skip a locked segment either.

## preventDefault is conditional

This is the most misread part of scroll takeover: the engine **only calls `preventDefault` when the delta was actually consumed**.

```text
if (applyNativeScrollDelta(delta) && event.cancelable) event.preventDefault();
```

At the segment end the clamp returns zero movement, so nothing is consumed, so nothing is intercepted, so the browser's native scrolling takes over and the page moves on. That is the zone's release mechanism: no timer, no `unlocked` flag, no code deciding when to let go. During the lock the events are intercepted, and once the budget runs out the exact same code stops intercepting.

The converse also holds: an event whose `defaultPrevented` is already true, or whose target sits outside this CineView container, is never examined.

## What differs per path

| Path      | Delta source                                                             | Normalization                                                                           | Notable                                                                        |
| --------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| wheel     | `deltaY` with `direction:'y'`, `deltaX` with `'x'`                       | `deltaMode:1` (lines) ×18; `deltaMode:2` (pages) × viewport span; `0` (pixels) verbatim | bound in the capture phase with `passive: false`                               |
| touch     | `touchstart` sets a baseline, `touchmove` takes the main-axis difference | used directly as px                                                                     | baseline resets every frame, so the delta is always "how far this frame moved" |
| keyboard  | keys map to fixed steps                                                  | see the keyboard step table                                                             | two handlers with different semantics                                          |
| scrollbar | drag or track click computes a target offset                             | converted to a delta, same clamp                                                        | arrow keys with the rail focused use the same step table                       |

The keyboard steps are hard-wired, not configurable:

| Key                     | Step                             |
| ----------------------- | -------------------------------- |
| `PageDown` / `PageUp`   | ± viewport span × 0.86           |
| `Space` / `Shift+Space` | same as PageDown / PageUp        |
| `ArrowDown` / `ArrowUp` | ± 80px                           |
| `Home` / `End`          | ∓ Infinity (clamped to the ends) |

## The two keyboard handlers

Key input is bound in two places with different semantics, and what matters to authors is what each one skips.

Window level (capture phase): requires `document.activeElement` to be `body` or `documentElement`, so it applies only when nothing on the page holds focus. It does not check nested scrollables, and it does not check whether the event target is inside the container.

The consequence: an unfocused scroll-mode CineView takes over arrow keys and Space for the entire document, **even after the root has scrolled out of view**. Embedding CineView inside a longer ordinary page makes this a limit you have to design around: one scroll root per page, or keep focus on an interactive element outside the container.

Container level (`onKeyDownCapture`): does not require activeElement to be body (focus legitimately lives inside the container), but does check nested scrollables and defer to them.

Both share one exemption: every key is released to `input` / `textarea` / `select` / `contentEditable` (typing), and Space is additionally released to `button` / `summary` / `a` with an `href` / `role="button"` / `role="link"` (activation). Without it, Space typed into a text field is swallowed by `preventDefault`.

## Keys do not rotate under direction: 'x'

Horizontal mode has two things to state plainly:

- **Key semantics do not rotate.** `ArrowDown` still means "along positive x," and so does `PageDown`. There is no remapping where ArrowRight becomes the main-axis forward key.
- The wheel reads `deltaX` only. A plain vertical mouse wheel produces a zero delta in horizontal mode and moves nothing. Trackpad horizontal gestures and `Shift + wheel` (which browsers report as `deltaX`) do work.

When building horizontal narratives, write keyboard hints from the keys that actually work rather than from directional intuition. See [Horizontal direction: 'x'](/docs/04-direction-x).

## Nested scrollables win

Before the delta reaches the clamp, the engine walks from the event target up to the container root looking for a scrollable ancestor with room left on the same axis: computed `overflow-x` / `overflow-y` of `auto`, `scroll`, or `overlay`, a scrollable span over 1px, and remaining room in this delta's direction. On a match it defers entirely: no clamp, no `preventDefault`, no root offset write; the input belongs to that inner container.

The direct consequence for authors: **an inner scrollbar inside a locked zone consumes the wheel until it reaches its own end**. Zone progress does not advance at all during that, and the audience sees a picture that has stopped moving. For long text inside a locked zone, reveal it with the zone's own budget rather than nesting an `overflow: auto` box.

Both wheel and touch run this check, as does the container-level keyboard handler; the window-level one does not.

## Programmatic scroll versus user input

While a smooth scroll from `goToScene` / `goToZone` is in flight, the engine marks an in-flight programmatic target and skips the intent clamp (whose corrective `scrollTo` interrupts the smooth animation). Any real user input path immediately clears the flag, stops the smooth animation where it is with a `behavior: 'auto'` `scrollTo`, and re-anchors the delta baseline at the real offset. From there the gesture runs the normal clamped path.

The reader can therefore always interrupt programmatic navigation, and the interruption lands exactly where the input arrived, with no scroll to the target and back.

## Related pages

- [center-lock scroll takeover](/docs/01-centerlock): the full intent-clamp rule table
- [Scrollbar theming](/docs/05-scrollbar): fields and defaults for the drawn scrollbar
- [Horizontal direction: 'x'](/docs/04-direction-x): every difference in horizontal mode
- [Scroll troubleshooting](/docs/06-scroll-pitfalls): the input-related common failures
