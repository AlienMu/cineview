---
title: Progress sources
eyebrow: CONCEPTS / PROGRESS SOURCES
---

What moves an effect is its progress source. Each kind of scene has a default source, and the `on` attribute picks another.

## Defaults

| Scene | Default | What the reader sees |
| --- | --- | --- |
| A scene in ordinary scroll | `enter` | Entrances play on time once the element is fully in view |
| A locked zone (`zone`) | `scene` | The scroll distance is the scene's time: stop and it holds, scroll back and it reverses |
| A scene in drag mode | `scene` | The finger moves the time; after release it plays out on time |

## Sources you can write

| `on` | Moved by | Suits |
| --- | --- | --- |
| `enter` | Time, once the element is fully in view | Entrances in ordinary sections |
| `eye` | Time, once the element crosses the line at 45% of the viewport | Tall elements |
| `view(self)`, `view(#id)` | The element (or `#id` in the same scene) crossing the viewport | Scroll-following motion outside locked zones |
| `page` | The whole page's scroll position | A reading progress bar |
| `clock` | Time, from the moment the scene becomes current | Large decorations, or ones partly off screen |
| `velocity`, `direction` | Scroll speed and direction | Speed effects such as `skew` |

Limits:

- A scene in ordinary scroll does not accept `on="scene"`, and a locked zone does not accept `enter` or `eye`. Either dispatches `cv-error` naming the source to use instead; for an element that plays by itself when the scene starts, use `clock`.
- A `clock` element plays again each time its scene becomes current.
- An effect that follows the viewport can name a range after it: `fx="fade entry"`, `fx="keyframes(tint) cover 20% cover 60%"`. The range names are `cover`, `contain`, `entry`, `exit`, `entry-crossing` and `exit-crossing`, each with an optional percentage.

## When an entrance starts

In ordinary scroll, `enter` waits until the element is fully in view, with its bottom edge clear of the screen's bottom by a margin; nearing the top or the bottom of the screen plays its exit, if it has one. The margin is 50 design pixels by default. Set it with `margin` on `cv-stage` or on one element: `margin="50"`, or `margin="50 30"` for separate entrance and exit margins.

An element taller than the viewport minus the entrance margin enters when its top crosses the middle of the screen and exits when its bottom rises above 70% of the viewport height. A smaller element that always stays partly off screen (a decoration that overflows the screen, for example) never qualifies; use `clock` or `eye` for it.

## Reduced motion

With the system's reduced-motion setting on:

- Entrances played on time (`enter`, `eye`, `clock`) keep only their opacity change, and last at most 200 ms.
- Loops stop; `count`, `drift` and `skew` do not run, and a count shows its final number.
- Motion that follows the reader's scroll or finger stays, because it is the reader's own action.
