---
title: Timeline
eyebrow: CONCEPTS / SEQUENCING
---

Sequencing several elements comes down to two tools: `after` makes elements queue behind each other, and `stagger` reveals a container's children one by one. Both compile to fixed delays before the first frame is drawn.

## after chains

`timeline.after` points at another element's `animateId`. The waiter doesn't start until the waited element finishes entering.

```tsx
<Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }} />
<Animate animateId="sub" enterAnimation="fade-in"
  timeline={{ after: 'title', delay: 100 }} />
<Animate animateId="cta" enterAnimation="fade-in"
  timeline={{ after: 'sub' }} />
```

## after has two mechanisms, decided by what drives the element

The same line of `after` runs through two unrelated implementations for scrubbed elements versus visibility-driven elements. Work out what drives your element before laying out the timeline.

### Scrubbed elements: computed once at registration

Scene-driven elements in drag, and elements inside a scroll locked zone, take this path. The dependency is folded into an accumulated delay at registration time:

```text
accumulatedDelay(follower) = follower.delay + accumulatedDelay(leader) + leader enter duration
```

In the "after chains" example, `cta` starts at title's enter duration + sub.delay (100) + sub's enter duration + cta.delay, computed once.

Here there is no runtime waiting and no subscription at all: progress comes straight from the drag displacement or the zone's scroll progress, and `after` merely shifts where each element starts on that one clock.

### Visibility-driven elements: waiting for the leader's completion

Elements in scroll that are not inside a zone take this path. It does not reuse the accumulated delay above. Instead it waits for the fact that the leader "has completed an entrance at least once," then waits out its own `delay`:

```text
release = leader has ever entered && own gate satisfied && own delay elapsed
```

That completion flag is set once and never retracted: the leader exiting, reverse scrolling, or the follower replaying does not return it to incomplete.

Why the accumulated delay cannot be reused here: for visibility-driven elements every element starts when it enters the viewport, with no shared origin. Re-adding the leader's delay plus duration makes the follower wait out an entire extra span for nothing.

### Only one cross-driver direction is legal

| follower           | leader             | Allowed                                                  |
| ------------------ | ------------------ | -------------------------------------------------------- |
| Visibility-driven  | Visibility-driven  | Yes                                                      |
| Scrubbed           | Also scrubbed      | Yes                                                      |
| Visibility-driven  | scroll locked zone | Yes (checked at runtime against the leader's completion) |
| scroll locked zone | Visibility-driven  | No                                                       |
| drag               | Any other kind     | No                                                       |

Rejected directions report `INVALID_ANIMATION` (internal reason `incompatible-driver`) and **skip that dependency**; the follower still runs on its own visibility condition and delay.

The reason is that the two clocks do not line up: a zone's budget is a deterministic `1ms = 1px`, while a visibility completion happens whenever the user scrolls the element into view, and no scroll coordinate corresponds to it. The reverse works because "a scroll leader crossed its enter end" is itself an observable runtime fact.

Separately, an element with `driver: 'clock'` in drag can be neither leader nor follower: it does not register into the scene's timeline.

## Errors and degradation

The registry reports two error codes through `onError`:

| code                  | trigger                                           |
| --------------------- | ------------------------------------------------- |
| `INVALID_ANIMATION`   | `after` points at an animateId that doesn't exist |
| `CIRCULAR_DEPENDENCY` | the chain loops (A waits on B, B waits on A)      |

`after` can only reference an existing animateId. Writing the chain first and adding the ID later still throws at registration.

## stagger

With `stagger` set, `children` must be a single ReactElement; each direct child inside it is revealed one by one through framer's native `staggerChildren`, using the `enterAnimation` variant.

```tsx
<Animate animateId="list" enterAnimation="fade-in" stagger={{ each: 40, from: 'first' }}>
  <ul>
    <li>First</li>
    <li>Second</li>
    <li>Third</li>
  </ul>
</Animate>
```

- `each`: ms between adjacent children, default 40.
- `from`: `'first'` (default) | `'last'` | `'center'`, where the reveal starts.

**stagger is time-driven; it does not scrub.** Inside a scroll locked zone it runs on the clock, not with the scroll position. For per-child reveal tied to the scrollbar, use the render-prop children's `enterProgress` (0..1) and map it yourself, see [Animate API](/docs/03-animate).

## An enter chain needs an exit plan

The rule is unconditional: **if the entrance uses a after cascade, the exit needs a matching reverse timeline**.

`after` and `delay` only govern entering, and there is no exit chain. Configure the enter side alone, and when the exit signal arrives every element's `exitAnimation` triggers in the same frame, so the whole screen exits at once, nothing like the one-beat-at-a-time entrance.

You have to arrange exits yourself:

```tsx
<Animate animateId="title" enterAnimation="fade-in" exitAnimation="fade-out"
  duration={{ enter: 600, exit: 400 }} />
<Animate animateId="sub" enterAnimation="fade-in" exitAnimation="fade-out"
  duration={{ exit: 300 }} timeline={{ after: 'title' }} />
```

- Give every element `exitAnimation` + `duration.exit`; don't configure only the entrance.
- When you need exact control over exit order, trigger exits manually with `exitRef`. Passing `exitRef` disables all automatic exit, and exit has no delay fallback. It works only for visibility-driven elements; scrubbed elements ignore it and report an error.
- Scrubbed elements inside a scroll locked zone naturally play back through their entrance when you reverse, so this does not apply to them.

## In drag, `exiting` means two different things

`exitAnimation` covers the forward exit only, which is not the same as "the animation played when leaving a scene":

| Exit direction                                 | What actually plays                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Forward (dragged toward the next screen)       | The `exitAnimation` variant, interpolated from the current state to the exit state                 |
| Backward (dragged back to the previous screen) | The entrance in reverse (`initial → animate` at `1 - progress`), ignoring `exitAnimation` entirely |
| No `exitAnimation` declared                    | Even a forward exit plays nothing: the element holds its resting state while only the page slides  |

So writing `exitAnimation` in drag affects only half the gesture directions. To make both directions feel alike, keep the exit close to a mirror of the entrance; for "dragging back is an undo," omitting `exitAnimation` is actually correct. See [Drag troubleshooting](/docs/06-drag-pitfalls).

## Next steps

- [Animate API](/docs/03-animate): full table of timeline/duration/render-prop
- [Timeline concept](/docs/02-timeline): how phase and driver are resolved
- [Troubleshooting](/docs/07-common-pitfalls): the full after/stagger failure list
