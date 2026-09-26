---
title: Animation composition and sequencing
eyebrow: CONCEPTS / SEQUENCING
---

An element can combine several presets or custom animations. Use `timeline.after` to order separate elements, or `stagger` to reveal a container's direct children at intervals.

`after` expresses a dependency between elements. If the title changes from 600ms to 900ms, a following detail moves 300ms later automatically. Absolute delays would require updating each following element separately.

## Order elements with after

Set `timeline.after` to another element's `animateId` in the same Scene. This example has no exit animations: the subtitle follows the title, and the button follows the subtitle.

```tsx
<Scene sceneId="titles">
  <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
    <h1>Title</h1>
  </Animate>
  <Animate
    animateId="subtitle"
    enterAnimation="fade-in"
    duration={{ enter: 600 }}
    timeline={{ after: 'title', delay: 100 }}
  >
    <p>Subtitle</p>
  </Animate>
  <Animate enterAnimation="fade-in" duration={{ enter: 400 }} timeline={{ after: 'subtitle' }}>
    <button>Continue</button>
  </Animate>
</Scene>
```

The target `animateId` must exist in the same Scene. JSX order does not determine animation order, so the preceding animation can be declared after its follower.

## How each driver waits

### Following drag or scroll progress

The subtitle starts at 700ms and the button at 1300ms in this example. Dragging or scrolling to those positions starts each element's change, with **no additional wait at that position**.

`after` waits for the preceding entrance to finish in both drag and scroll mode. An entrance of 600ms followed by an exit of 400ms lets a follower without delay start at 600ms. In a locked zone, an authored `phase` sets the effective entrance interval, so the follower starts at that interval's end.

The follower's own `timeline.delay` is added after this position. See [Zones and scroll budgets](/docs/02-zones-budget) for more locked-zone examples.

### Playing on visibility

Visibility animation waits for the preceding element to complete an entrance at least once. Its own visibility condition and delay then determine when it starts.

A later exit of the preceding element does not undo that completed entrance. A replaying follower also waits only for its own delay, without waiting again for time the preceding element has already played.

### Combining drivers

| Follower                           | Preceding element                       | Supported                                   |
| ---------------------------------- | --------------------------------------- | ------------------------------------------- |
| Visibility animation               | Visibility animation                    | Yes                                         |
| Animation following scene progress | Animation with the same progress source | Yes                                         |
| Scroll visibility animation        | Scroll locked-zone animation            | Yes, after the preceding entrance completes |
| Scroll locked-zone animation       | Visibility animation                    | No                                          |
| Drag scene animation               | A different driver                      | No                                          |

An unsupported dependency reports `INVALID_ANIMATION` and is ignored. The follower keeps its own delay and driver. A fixed scroll position cannot wait for a visibility event whose timing depends on user input.

A drag element with `driver: 'clock'` cannot precede or follow another element through `after`.

## Combine animations on one element

Put presets and custom animations in `animations` and choose a composition mode. This title fades in while moving upward:

```tsx
<Animate
  enterAnimation={{
    animations: ['fade-in', { initial: { y: 32 }, animate: { y: 0 } }],
    mode: 'parallel',
  }}
  duration={{ enter: 800 }}
>
  <h1>Product details</h1>
</Animate>
```

Later entries take precedence when they define the same property. Use keyframes for a property that needs several successive values. See [Custom animation](/docs/05-custom-animation) for the complete syntax.

Ordinary `Animate` entrances and exits, including visibility and clock playback, combine the properties of a composed animation into one progress interval; `sequential` and `delays` do not stage their playback. Use keyframes for ordered changes to one element, or `timeline.after` to start one element after another.

## Reveal children at intervals

Pass a single container element when using `stagger`. Its direct children play the same entrance animation in sequence:

```tsx
<Animate enterAnimation="fade-in" stagger={{ each: 40, from: 'first' }}>
  <ul>
    <li>First</li>
    <li>Second</li>
    <li>Third</li>
  </ul>
</Animate>
```

`each` is the interval between children, defaulting to 40ms. `from` accepts `'first'`, `'last'`, or `'center'`, and defaults to the first child.

Stagger plays by time, including inside locked zones. For children that each follow scrolling, use separate Animate elements or subscribe to progress as in the [Canvas example](/docs/02-timeline).

## Configure exits

`after` schedules a follower's entrance; it does not generate a reversed sequence of exits. For ordered exits on visibility animations, call each `exitRef` in sequence. See [Manual triggers](/docs/03-animate).

In a locked zone, reverse scrolling moves backward through the same animation. Returning to earlier frames needs no separate exit declaration. Adding `exitAnimation` creates an additional exit during forward scrolling.

| Drag navigation direction  | Element behavior                                  |
| -------------------------- | ------------------------------------------------- |
| To the next scene          | Plays `exitAnimation`                             |
| Back to the previous scene | Plays the entrance in reverse                     |
| Forward without an exit    | Holds the completed entrance while the page moves |

For similar visuals in both directions, define the exit as the entrance in reverse.

## Check dependency errors

| Error code            | Check                                                                       |
| --------------------- | --------------------------------------------------------------------------- |
| `INVALID_ANIMATION`   | Whether the target id exists, matches exactly, and uses a compatible driver |
| `CIRCULAR_DEPENDENCY` | Whether A waits for B while B also waits for A                              |

Declare preceding and following elements in the same render. See [Common pitfalls](/docs/07-common-pitfalls) for further diagnosis.
