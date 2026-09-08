---
title: Visibility conditions
eyebrow: CONCEPTS / VISIBILITY
---

In scroll mode, elements outside locked zones use visibility conditions by default. `timeline.driver: 'clock'` selects the same behavior inside a locked zone. The element waits at its initial frame until the enter condition is met, then plays for its configured duration.

Scrolling determines when the animation starts. Its playback duration is independent of scroll speed; frame delivery still depends on browser workload.

## The six phases

| Phase      | Meaning                                                  |
| ---------- | -------------------------------------------------------- |
| `idle`     | Not yet scheduled, and never exits                       |
| `waiting`  | The enter condition holds, waiting on `after` or `delay` |
| `entering` | The enter tween is running                               |
| `entered`  | The entrance is complete                                 |
| `exiting`  | The exit tween is running                                |
| `exited`   | The exit is complete                                     |

An `idle` element does not exit. This lets content approaching from beyond the viewport enter before an exit condition applies.

## Condition geometry

The criteria are based on the element's position relative to the scroll container. With `vh` as the container height:

```text
enter when: relTop >= 0 && relBottom <= vh - enterMargin
exit when:  relTop <= exitMargin  ||  relBottom >= vh - exitMargin
```

Entering requires the element to be fully inside the viewport, with its bottom edge still clearing the viewport bottom by `enterMargin`. The exit is symmetric, with two clauses: the top edge approaching the viewport top (leaving upward under forward scrolling), or the bottom edge approaching the viewport bottom (leaving downward under reverse scrolling).

`enterMargin` and `exitMargin` use design px, scaled to physical pixels via `scale = viewportWidth / designWidth` before evaluation. Both default to 50, with a three-level fallback: a per-`Animate` `visibility.enterMargin` → the root's `enterMargin` → 50. Because values scale with viewport width, the same number produces different physical margins across device sizes.

## Debounce overlap range

The enter and top exit conditions overlap when `relTop ∈ [0, exitMargin]`.

When both conditions are true, the element keeps its current phase. Entering starts beyond the overlap and exiting starts after crossing its opposite boundary.

## Tall element evaluation rules

When an element's height exceeds `vh - enterMargin`, standard entrance criteria cannot be met simultaneously. Such elements switch to height-adaptive criteria:

```text
enter: relTop <= vh / 2        (the top edge crosses the viewport midline)
exit:  relBottom <= vh * 0.7   (the bottom edge rises past 70% of the viewport)
```

These criteria overlap across a wider range. In this scenario, exit evaluation takes precedence to ensure smooth departure without re-triggering entrance animations.

## Behavior without exitAnimation

Without `exitAnimation`, an element remains `entered` after its entrance. Moving outside the viewport does not reset it, and `visibility.replay` has no effect.

To make an element leave and replay, declare an exit animation.

An explicit `exitAnimation` with `duration.exit: 0` changes state immediately when the exit condition is met. A parsed non-empty exit variant with a positive exit duration also enables the exit condition.

## Two special cases for the first screen and the first frame

**First-screen cold-start restriction**: elements in scene 0 hold their initial frame until the first screen's critical assets are ready. This restriction applies in every mode, and scenes beyond the first are not subject to it. That first evaluation also relaxes the bottom margin, otherwise a hint element sitting against the viewport bottom never enters.

**Already scrolled past the top on the first frame**: if an element's bottom edge is already above the viewport at first measurement (`relBottom <= 0`), it is revealed directly at its entered state with no entrance tween. Reloading partway down a page therefore does not make everything above replay.

## replay

Defaults to `true`. It affects only the `exiting` / `exited` → enter transition: whether an element replays when it satisfies the enter condition again after exiting.

It is meaningless for elements with no `exitAnimation`, since those never reach `exited` in the first place.

## Related pages

- [The Animate timeline](/docs/02-timeline): how to read phases and what drives an element
- [Timeline](/docs/04-orchestration): with visibility driving, `after` waits for the leader's completion
- [Runtime states](/docs/07-runtime-states): how scene-level runtime state controls continuous animation
- [Animate](/docs/03-animate): the full `visibility.*` prop table
