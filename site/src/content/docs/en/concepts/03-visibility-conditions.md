---
title: Visibility conditions
eyebrow: CONCEPTS / VISIBILITY
---

In scroll mode, elements that are not inside a locked zone are driven by the visibility conditions. This is not a continuous scrub that maps position onto progress; it is a boolean test plus a duration-based tween: the element rests at its initial frame until the enter condition holds, then plays through on its own `duration`.

That distinction has two direct consequences: this driver never leaves an element frozen half-entered, and it never skips frames when scrolling is fast.

## The six phases

| Phase      | Meaning                                                  |
| ---------- | -------------------------------------------------------- |
| `idle`     | Not yet scheduled, and never exits                       |
| `waiting`  | The enter condition holds, waiting on `after` or `delay` |
| `entering` | The enter tween is running                               |
| `entered`  | The entrance is complete                                 |
| `exiting`  | The exit tween is running                                |
| `exited`   | The exit is complete                                     |

`idle` never exiting is deliberate: an element rising in from below the viewport sits at `idle`, and even if it simultaneously satisfies the bottom exit condition it is not mistaken for exiting.

## Condition geometry

The criteria are based on the element's position relative to the scroll container. With `vh` as the container height:

```text
enter when: relTop >= 0 && relBottom <= vh - enterMargin
exit when:  relTop <= exitMargin  ||  relBottom >= vh - exitMargin
```

Entering requires the element to be fully inside the viewport, with its bottom edge still clearing the viewport bottom by `enterMargin`. The exit is symmetric, with two clauses: the top edge approaching the viewport top (leaving upward under forward scrolling), or the bottom edge approaching the viewport bottom (leaving downward under reverse scrolling).

`enterMargin` and `exitMargin` use design px, scaled to physical pixels via `scale = viewportWidth / designWidth` before evaluation. Both default to 50, with a three-level fallback: a per-`Animate` `visibility.enterMargin` → the root's `enterMargin` → 50. Because values scale with viewport width, the same number produces different physical margins across device sizes.

## Debounce overlap range

The enter condition and the top exit condition may both evaluate to true across `relTop ∈ [0, exitMargin]`. Without state locking, reverse re-entry through that overlap triggers enter and exit sequences within the same batch, causing visual glitches.

The evaluation rule: **when both conditions are true, hold the current lifecycle state and make no transition**. Entering triggers only strictly above the overlap boundary, and exiting triggers only strictly below it.

## Tall element evaluation rules

When an element's height exceeds `vh - enterMargin`, standard entrance criteria cannot be met simultaneously. Such elements switch to height-adaptive criteria:

```text
enter: relTop <= vh / 2        (the top edge crosses the viewport midline)
exit:  relBottom <= vh * 0.7   (the bottom edge rises past 70% of the viewport)
```

These criteria overlap across a wider range. In this scenario, exit evaluation takes precedence to ensure smooth departure without re-triggering entrance animations.

## Behavior without exitAnimation

**Only an element with a declared `exitAnimation` executes the exit sequence.** Without an exit animation, an element remains at its `entered` resting state: scrolling past viewport boundaries neither hides nor resets it, and `replay` settings have no effect.

This design prevents elements without exit transitions from abruptly disappearing when crossing viewport bounds.

Exit declarations are recognized when non-empty exit variants exist with `duration.exit > 0`, or when `exitAnimation` is explicitly passed. Omitting `exitAnimation` keeps the element persistent. Declaring `exitAnimation` with `duration.exit: 0` performs an instantaneous state transition upon meeting exit criteria.

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
