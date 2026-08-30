---
title: Animate
eyebrow: COMPONENTS / ANIMATE
---

Animate attaches animation semantics to an element. It consumes the current mode's timeline: in drag mode it follows the scene as you drag, inside a locked zone it follows real scroll pixels, and everywhere else it plays on real time through a visibility condition. All enter/exit/persistent-loop animations go through it. Don't hand-write CSS animations.

```tsx
<Animate
  animateId="title"
  enterAnimation="fade-in"
  exitAnimation="fade-out"
  duration={{ enter: 800, exit: 400 }}
  timeline={{ delay: 200, after: 'subtitle' }}
  visibility={{ replay: true }}
>
  <h1>Hello</h1>
</Animate>
```

## Props

| prop                                    | type                                     | default   | notes                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ---------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animateId`                             | string                                   | none      | Unique element identifier. Duplicates raise `INVALID_COMPONENT_HIERARCHY`; required when referenced by `after`                                                                                                                                                                  |
| `enterAnimation`                        | AnimationType                            | none      | Enter animation. Provide at least one of `enterAnimation` / `loopAnimation`                                                                                                                                                                                                     |
| `exitAnimation`                         | AnimationType                            | none      | Exit animation; must coexist with enter or infinite. In drag it covers the forward exit only: dragging back reverses the entrance and never reads this variant, and with none declared a forward exit plays nothing (the element holds). See [Timeline](/docs/04-orchestration) |
| `loopAnimation`                         | AnimationType                            | none      | Persistent looping animation. When used alone, `enterAnimation` must be `never` (type-enforced)                                                                                                                                                                                 |
| `duration.enter` / `duration.exit`      | number (ms)                              | `600`     | Enter/exit duration. Inside a locked zone, `1ms = 1px` of real scroll distance                                                                                                                                                                                                  |
| `timeline.driver`                       | `'scene'\|'clock'`                       | `'scene'` | Who drives the progress, see the "driver resolution" section                                                                                                                                                                                                                    |
| `timeline.delay`                        | number (ms)                              | `0`       | Enter delay                                                                                                                                                                                                                                                                     |
| `timeline.after`                        | string                                   | none      | Start after another `animateId` finishes entering. Missing target = `INVALID_ANIMATION`, cycle = `CIRCULAR_DEPENDENCY`                                                                                                                                                          |
| `timeline.zoneId`                       | string                                   | none      | Explicitly bind to a locked zone                                                                                                                                                                                                                                                |
| `timeline.phase.start` / `end`          | number                                   | none      | Phase interval the element occupies within the zone's scroll budget                                                                                                                                                                                                             |
| `visibility.replay`                     | boolean                                  | `true`    | Replay the enter animation when the element becomes visible again                                                                                                                                                                                                               |
| `visibility.enterMargin` / `exitMargin` | number (design px)                       | 50 global | Visibility-condition margins; default to `enterMargin/exitMargin`. Elements taller than the viewport fall back to a center/70% rule                                                                                                                                             |
| `stagger`                               | `{each?, from?}`                         | none      | Staggered reveal of children, see the "stagger reveal" section                                                                                                                                                                                                                  |
| `enterRef` / `exitRef`                  | `MutableRefObject<(() => void) \| null>` | none      | Manual enter/exit triggers, see the "enterRef / exitRef manual triggers" section                                                                                                                                                                                                |
| `children`                              | ReactNode or render-prop                 | none      | With `stagger` set, must be a **single** ReactElement                                                                                                                                                                                                                           |

## AnimationType variants

`enterAnimation`/`exitAnimation`/`loopAnimation` all accept an `AnimationType`, in three forms:

- Preset name: one of the 43 built-in presets, for example `"fade-in"`. Full list in [Presets](/docs/08-presets).
- CustomAnimation: a Framer Motion variant subset `{ initial?, animate?, exit? }`; keys are any framer-animatable properties.
- ComposedAnimation: `{ animations: (PresetAnimation | CustomAnimation)[], mode: 'sequential' | 'parallel', delays?: number[] }`: run several animations in sequence or in parallel, `delays` delays each one.

```tsx
<Animate
  animateId="card"
  enterAnimation={{
    animations: ['slide-up', { initial: { opacity: 0 }, animate: { opacity: 1 } }],
    mode: 'parallel',
    delays: [0, 100],
  }}
>
  <Card />
</Animate>
```

## driver resolution

`timeline.driver` decides who drives the progress: `'scene'` (default) or `'clock'`. All five cases:

| driver    | location                               | driven by                                                                                                           |
| --------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `'scene'` | inside a locked zone (inherits zoneId) | the zone's real scroll budget; `timeline.phase` applies                                                             |
| `'scene'` | scroll mode, outside any zone          | degrades to a visibility condition, triggered by viewport entry/exit                                                |
| `'scene'` | drag                                   | the Scene's shared element timeline, scrubbed with the drag                                                         |
| `'clock'` | scroll                                 | forced visibility condition, even inside a zone                                                                     |
| `'clock'` | drag                                   | plays independently on real time once the Scene arrives; **opts out of registry/after and ignores `exitAnimation`** |

The last row needs care: with `driver: 'clock'` in drag mode, the exit animation never plays. If you need exits, keep `driver: 'scene'`.

## When loopAnimation runs

Use `loopAnimation` for persistent loops, never CSS `animation: … infinite`. CSS loops are not bound to phase: they keep running after the element exits or leaves the viewport. `loopAnimation` is decided by `shouldRunInfinite`: it runs only while the element is in its own phase and inside the viewport, and stops the moment either fails.

`loopAnimation` can coexist with `enterAnimation` (taking over as a persistent loop after the enter finishes) or be used alone; used alone, the type forces `enterAnimation: never`.

## stagger reveal

```tsx
<Animate animateId="list" enterAnimation="fade-in" stagger={{ each: 40, from: 'first' }}>
  <ul>
    <li>First</li>
    <li>Second</li>
  </ul>
</Animate>
```

- `each`: gap between adjacent children in ms, default `40`.
- `from`: start direction: `'first'` (default) / `'last'` / `'center'`.
- Uses framer's native `staggerChildren` to reveal direct children one by one, each with the `enterAnimation` variant. The 10-property allowlist does not apply here, so any framer property like `clipPath`/`width` works.
- **Time-driven, not scrubbed** by scroll/drag. For a scrubbed element-by-element reveal, use the render-prop `enterProgress` instead.

## render-prop children

```tsx
<Animate animateId="bar" enterAnimation="fade-in">
  {({ enterProgress, phase }) => (
    <div style={{ width: `${enterProgress * 100}%` }} data-phase={phase} />
  )}
</Animate>
```

`AnimateRenderState`:

| field           | type                                                                      | notes                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enterProgress` | number `0..1`                                                             | 0 = initial frame, 1 = fully entered. Advances with time under visibility, scrubs with scroll/drag otherwise                                                                                       |
| `phase`         | `'idle' \| 'waiting' \| 'entering' \| 'entered' \| 'exiting' \| 'exited'` | Six phases. **Inside a locked zone `phase` never updates and stays at `idle`**, so don't read it there; judge on `signedProgress` instead, see [useAnimateTimeline](/docs/09-use-animate-timeline) |

For continuous values as MotionValues, without going through the React render pipeline, use [useAnimateTimeline](/docs/09-use-animate-timeline).

## enterRef / exitRef manual triggers

`enterRef` rules:

- Calling `enterRef.current()` plays the enter immediately, interrupting any pending `after`/`delay`.
- `enterRef` set + `after`/`delay` set: if you never call the ref, the framework falls back to triggering after `after`/`delay` completes.
- `enterRef` set without `after`/`delay`: never fires automatically; you must call it.

`exitRef` rules:

- Setting it disables all automatic exits (scroll leaving the zone, drag scene switch); you must call it manually.
- Calling it plays the exit immediately, interrupting a pending enter.
- No delay fallback: there is no "auto-exit after timeout" semantics.

Typical use: show content the moment async data arrives, fall back to a delay on failure:

```tsx
const contentEnterRef = useRef<(() => void) | null>(null);

useEffect(() => {
  fetch('/api/data')
    .then((data) => {
      setContent(data);
      contentEnterRef.current?.(); // success → show now
    })
    .catch(() => {
      // failure → don't call the ref, wait for the 3s fallback
    });
}, []);

<Animate
  enterRef={contentEnterRef}
  timeline={{ delay: 3000 }} // fallback: show after 3s no matter what
  enterAnimation="fade-in"
>
  {content || <EmptyState />}
</Animate>;
```

Manual exit:

```tsx
const modalExitRef = useRef<(() => void) | null>(null);

<Animate exitRef={modalExitRef} enterAnimation="fade-in" exitAnimation="fade-out">
  <Modal onClose={() => modalExitRef.current?.()} />
</Animate>;
```

## Timeline rule

If the enter uses a `after` cascade, the exit must have a matching reverse timeline. An enter-only chain makes every element exit in the same frame, lopsided against the ordered enter cascade. See [Timeline](/docs/04-orchestration) and [Troubleshooting](/docs/07-common-pitfalls).
