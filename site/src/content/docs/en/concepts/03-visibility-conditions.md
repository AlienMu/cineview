---
title: Visibility conditions
eyebrow: CONCEPTS / VISIBILITY
---

In scroll mode, elements outside locked zones start their animations after entering the visible area. Set `timeline.driver: 'clock'` to use the same behavior inside a locked zone.

An element holds its initial frame until its entrance condition is met. It then plays for the configured duration, independent of scroll speed.

## Enter before evaluating exit

An `idle` element cannot exit directly. It must first satisfy its entrance condition before its position can trigger an exit. This prevents content approaching from below the viewport from exiting before it appears.

See [The Animate timeline](/docs/02-timeline) for the waiting, entrance, and exit phases.

## When an ordinary element enters

These conditions describe vertical scrolling. `relTop` and `relBottom` are the element's top and bottom positions relative to the scroll container. `vh` is the container height:

```text
enter: relTop >= 0 && relBottom <= vh - enterMargin
exit:  relTop <= exitMargin || relBottom >= vh - exitMargin
```

For entrance, the element must fit entirely inside the visible area. Its bottom edge must also remain at least `enterMargin` from the viewport bottom.

Exit can start in either direction. Scrolling down brings the element's top toward the viewport top. Scrolling up brings its bottom toward the viewport bottom.

Both margins use design px and scale by `viewportWidth / designWidth` before comparison. An Animate's `visibility.enterMargin` or `visibility.exitMargin` takes priority. Otherwise, the corresponding root setting applies, with 50 as the final default.

## Keep the current phase when conditions overlap

An ordinary element can satisfy entrance and exit conditions at the same time. For example, the conditions may overlap when its top lies between `0` and `exitMargin`.

The element keeps its current phase during overlap. It enters when only the entrance condition holds and exits when only the exit condition holds. Small scroll movements near an edge therefore do not repeatedly switch the animation.

## Elements taller than the visible area

An element taller than `vh - enterMargin` cannot fit inside the entrance area. It uses a different pair of position checks:

```text
enter: relTop <= vh / 2        (top passes the viewport midpoint)
exit:  relBottom <= vh * 0.7   (bottom rises past 70% of viewport height)
```

Exit takes priority when both conditions hold. Long content that is already leaving does not re-enter merely because its top remains above the midpoint.

## Declare an exit to allow replay

Without `exitAnimation`, an element remains `entered` after its entrance. Moving outside the viewport does not reset it, and `visibility.replay` cannot make it replay.

Declare `exitAnimation` when the element needs to leave and play again. An explicit `duration.exit: 0` completes the exit as soon as its condition holds. A positive duration plays the configured exit.

`visibility.replay` defaults to `true`. Set it to `false` to prevent an element that has exited from replaying when its entrance condition holds again.

## The first scene and reloading partway down

Elements in the first scene wait at their initial frame for priority resources. This resource wait applies to both modes; see [Preloading](/docs/02-preload). The first scroll scene's initial entrance check relaxes the bottom margin so hints near the viewport bottom can start playing.

If an element is already entirely above the viewport at its first measurement (`relBottom <= 0`), it displays its completed entrance frame immediately. Reloading partway down a page therefore does not replay all preceding content. An `enterRef` configured for manual entrance only still requires a manual trigger.

## Related pages

- [The Animate timeline](/docs/02-timeline): progress, phases, and manual triggers.
- [Animation composition and sequencing](/docs/04-orchestration): wait for preceding elements.
- [Scene visibility and input](/docs/07-runtime-states): when loops pause.
- [Animate](/docs/03-animate): the complete property reference.
