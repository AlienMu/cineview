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

`enterMargin` and `exitMargin` are design px, converted to physical px through the conversion base's `scale` before comparison. Both default to 50, with a three-level fallback: a per-`Animate` `visibility.enterMargin` → the root's `enterMargin` → 50. Because the value passes through scale, the same number produces a different physical margin at different viewport widths.

## The hysteresis overlap range

The enter condition and the top exit condition are both true across `relTop ∈ [0, exitMargin]`. Without a mutex, reverse re-entry drives the element through that overlap and triggers enter and exit back to back within one batch, which looks like "the element suddenly appears, then replays its entrance from the start."

The rule: **when both conditions are true, hold the current phase and make no transition**. Entering fires only strictly above the overlap range, exiting only strictly below it.

## Oversized elements use a different rule

When an element is taller than `vh - enterMargin`, the normal enter condition can never be satisfied (it does not fit inside that clearance). Such elements switch to a preparatory rule:

```text
enter: relTop <= vh / 2        (the top edge crosses the viewport midline)
exit:  relBottom <= vh * 0.7   (the bottom edge rises past 70% of the viewport)
```

These two overlap across a wide range, and the semantics there are "the element is leaving," so for oversized elements the overlap gives priority to exiting (a true exit condition suppresses the enter condition). That is the opposite of the "hold the phase" rule for normal elements.

## No exitAnimation means it never exits

**Only an element with a declared `exitAnimation` ever exits.** Without one, an element that has entered stays permanently at its `entered` resting state: scrolling past the viewport top or bottom neither hides nor resets it, and `replay` has no effect on it.

This avoids the case where an element with no exit animation is hidden the instant it crosses a boundary. That reads as an asymmetry: no transition on the way out, but a full animation when scrolling back in.

Two things can make an exit count as declared: a non-empty parsed exit variant together with `duration.exit > 0`, or the presence of an authored `exitAnimation` prop on its own. So omitting `exitAnimation` entirely is what makes an element never exit. Declaring `exitAnimation` with `duration.exit: 0` still counts as declared, and the tween length of 0 shows up as an instant jump rather than holding at the resting state.

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
