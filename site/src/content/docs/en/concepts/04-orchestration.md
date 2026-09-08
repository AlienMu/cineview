---
title: Timeline
eyebrow: CONCEPTS / SEQUENCING
---

`timeline.after` orders animations on separate elements. `stagger` reveals the direct children of one container at intervals.

## after chains

Set `timeline.after` to another element's `animateId` in the same Scene. The follower starts after that element's entrance, plus its own delay.

```tsx
<Scene sceneId="titles">
  <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
    <h1>Title</h1>
  </Animate>
  <Animate animateId="sub" enterAnimation="fade-in" timeline={{ after: 'title', delay: 100 }}>
    <p>Subtitle</p>
  </Animate>
  <Animate animateId="cta" enterAnimation="fade-in" timeline={{ after: 'sub' }}>
    <button>Continue</button>
  </Animate>
</Scene>
```

## How after starts an animation

The timing depends on the element's driver.

### Elements that follow progress

Scene-driven drag elements and scene-driven elements inside a scroll locked zone use accumulated timing offsets:

```text
follower start = follower delay + leader start + leader enter duration
```

For the example, the subtitle starts at 700ms and the button at 1300ms. Scrolling or dragging through those positions advances each element; no additional wait occurs when the position is reached.

### Elements triggered by visibility

Visibility-driven scroll elements wait until their leader has completed an entrance at least once. They then require their own visibility condition and delay.

```text
start = leader has entered + own visibility condition + own delay
```

The leader's exit or a follower replay does not undo that completed entrance. The follower waits only for its own delay; it does not add the leader's elapsed playback time again.

### Combining drivers

| Follower                     | Leader                       | Supported                                  |
| ---------------------------- | ---------------------------- | ------------------------------------------ |
| Visibility-driven            | Visibility-driven            | Yes                                        |
| Follows scene progress       | Same progress driver         | Yes                                        |
| Visibility-driven scroll     | Scroll locked-zone animation | Yes, after the leader's entrance completes |
| Scroll locked-zone animation | Visibility-driven            | No                                         |
| Scene-driven drag            | A different driver           | No                                         |

An unsupported dependency reports `INVALID_ANIMATION` and is ignored. The follower keeps its own delay and driver. A fixed scroll position cannot wait for a visibility event whose time depends on user input.

In drag mode, a `driver: 'clock'` element cannot lead or follow an `after` chain.

## Errors

| Code                  | Condition                                                           |
| --------------------- | ------------------------------------------------------------------- |
| `INVALID_ANIMATION`   | The target `animateId` does not exist or its driver is incompatible |
| `CIRCULAR_DEPENDENCY` | The chain contains a cycle                                          |

The target must exist when the Scene's declarations are ready. JSX order does not determine animation order, so a follower can appear before its leader in the same render. Match identifiers exactly and remove cycles.

## stagger

With `stagger`, pass a single container element. Its direct children use the entrance animation in sequence.

```tsx
<Animate enterAnimation="fade-in" stagger={{ each: 40, from: 'first' }}>
  <ul>
    <li>First</li>
    <li>Second</li>
    <li>Third</li>
  </ul>
</Animate>
```

`each` is the interval in milliseconds, defaulting to 40. `from` is `'first'`, `'last'`, or `'center'`, with `'first'` as the default.

Stagger plays by elapsed time even inside a locked zone. For children that follow individual scroll ranges, map their visuals from `useAnimateTimeline()` progress or use separate Animate elements.

## Plan exit behavior

`after` orders entrances only. Add exits when the design needs them; an entrance sequence does not require a mirrored exit.

`exitAnimation` specifies the visual change and `duration.exit` sets its duration. Neither adds an exit dependency. For ordered exits on visibility-driven scroll elements, call their `exitRef` triggers in the desired order. See [Manual triggers](/docs/03-animate).

Inside a locked zone, reverse scrolling already reverses the mapped animation. Use duration, delay, and keyframes to define what happens at each scroll position.

## Forward and reverse exits in drag

| Direction                      | Animation                                                     |
| ------------------------------ | ------------------------------------------------------------- |
| Toward the next scene          | The declared `exitAnimation`                                  |
| Back toward the previous scene | The entrance in reverse; `exitAnimation` is not used          |
| Forward with no exit declared  | The element holds its completed entrance while the page moves |

Set the exit close to the entrance's reverse when both directions need similar visuals. Omitting an exit keeps the forward scene's content still during page movement.

## Related pages

- [Animate](/docs/03-animate): duration, timeline, and manual refs
- [Animate timeline](/docs/02-timeline): drivers and phases
- [Troubleshooting](/docs/07-common-pitfalls): sequencing problems
