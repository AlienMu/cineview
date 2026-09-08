---
title: Custom animations
eyebrow: ADVANCED / CUSTOM ANIMATION
---

Pass a custom animation object when a preset does not provide the required motion. The object can contain `initial`, `animate`, and `exit` values.

## Custom variants

At least one of `initial`, `animate`, or `exit` must be a non-empty object. Extra top-level keys are not supported.

```tsx
<Animate
  animateId="title"
  enterAnimation={{
    initial: { y: '62%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
  }}
  duration={{ enter: 640 }}
>
  <h1>Opening title</h1>
</Animate>
```

Variant parsing rules:

- A string is parsed as a preset name; an object is parsed as a custom variant; the parser dispatches on the type.
- `transformOrigin` strings are normalized to percentage pairs (`'top left'` → `'0% 0%'`, `'center'` → `'50% 50%'`).
- Configure ordinary Animate timing with `duration` and `timeline.delay`. Variant transition timing applies to native Framer playback paths such as stagger and loops; it does not change the distance of position-driven animations. `transition.times` still defines keyframe positions.

## Keyframes and times

Any property value may be an array holding a full keyframe sequence. Keyframe positions come from `transition.times`: per-property (`transition: { opacity: { times: [0, 0.3, 0.9, 1] } }`) when present, otherwise a top-level `transition.times` of the same length; with no `times` at all, keyframes are spaced evenly (`index / (count - 1)`).

```tsx
// A background that fades in, holds, and fades out across one enter span.
<Animate
  animateId="backdrop"
  enterAnimation={{
    initial: { opacity: 0, filter: 'blur(12px)', scale: 1.04 },
    animate: {
      opacity: [0, 1, 1, 0],
      filter: ['blur(12px)', 'blur(0px)', 'blur(0px)', 'blur(10px)'],
      scale: [1.04, 1, 1, 1.02],
      transition: {
        opacity: { times: [0, 0.3, 0.9, 1] },
        filter: { times: [0, 0.3, 0.9, 1] },
        scale: { times: [0, 0.3, 0.9, 1] },
      },
    },
  }}
  duration={{ enter: 4000 }}
>
  <div className="backdrop" />
</Animate>
```

A numeric target interpolates between its initial and final values. An array interpolates between keyframes. Unit strings such as `100%`, `12px`, and `45deg` retain their units; animation values are not automatically converted through `designWidth`.

## How keyframes resolve while scrolling

Walk one property through the resolver. With `opacity: [0, 1, 1, 0]` and `times: [0, 0.3, 0.9, 1]`:

| progress | segment                                 | result                                            |
| -------- | --------------------------------------- | ------------------------------------------------- |
| 0.15     | 0 → 0.3                                 | lerps 0 → 1, at halfway: `0.5`                    |
| 0.45     | inside 0.3 → 0.9 (both keyframes are 1) | holds `1`                                         |
| 0.95     | 0.9 → 1                                 | lerps 1 → 0, at `(0.95 − 0.9) / 0.1 = 0.5`: `0.5` |

Keyframes can make an element enter, remain visible, and leave within one `duration.enter`. Add the number of keyframes the effect needs.

## Reusable animation objects

A neutral animation gives a custom renderer a timeline without changing its opacity. A translation and fade can share the same entrance:

```tsx
// Keep opacity unchanged while progress advances.
export function solidVariant() {
  return {
    initial: { opacity: 1 },
    animate: { opacity: 1, transition: { duration: 0 } },
  };
}

// Translate and fade using supported entrance properties.
export function riseVariant(amplitude: string) {
  return {
    initial: { y: amplitude, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { duration: 0 } },
  };
}
```

Use `solidVariant()` when content reads progress through `useAnimateTimeline()` or supplies timing for an `after` dependency. AnimateVideo uses a neutral entrance by default.

## Exit variants

`exitAnimation` accepts the same shapes, but the record that matters is `exit`: `initial`/`animate` exist for symmetry and are typically left still:

```tsx
<Animate
  animateId="board"
  enterAnimation={{
    initial: { opacity: 0, scale: 0.94, y: '4%' },
    animate: { opacity: 1, scale: 1, y: '0%' },
  }}
  exitAnimation={{ exit: { opacity: 0, scale: 1.04 } }}
  duration={{ enter: 2400, exit: 900 }}
>
  <div className="board" />
</Animate>
```

This example moves and fades in, then scales and fades out.

Exit keyframe arrays work exactly like enter ones (`times` included), and the element's terminal state is the last keyframe. Scrolling back walks the same interpolation in reverse, so an exit authored as keyframes unwinds keyframe by keyframe.

## Which properties animate

Enter and exit animations can animate exactly ten properties:

`opacity`, `x`, `y`, `scale`, `rotate`, `rotateX`, `rotateY`, `skewX`, `skewY`, `filter`.

The property list applies to ordinary Animate entrances and exits. Stagger uses Framer's native child animation support and can use additional properties such as `clipPath` and `width`.

For canvas or other custom drawing, read timeline MotionValues and render the required output directly.

## Composed animations

`ComposedAnimation` stitches multiple steps (preset names, custom variants, or a mix) into one animation:

```tsx
<Animate
  enterAnimation={{
    animations: ['fade-in', { animate: { scale: [0.9, 1], transition: { duration: 0.4 } } }],
    mode: 'sequential',
    delays: [0, 200],
  }}
  duration={{ enter: 1600 }}
>
  <div className="card" />
</Animate>
```

Composition fields:

| Field        | Meaning                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `animations` | Array of preset names and/or custom variants; must be non-empty.                                                                          |
| `mode`       | `'sequential'`: each step starts after the previous step's duration plus its own delay; `'parallel'`: all steps start at their own delay. |
| `delays`     | Per-step extra delay in ms, indexed by authoring position.                                                                                |

- In `sequential` mode, the next step starts after the preceding duration and delay. A step without `transition.duration` uses 1s for this calculation. `initial` comes from the first step and `exit` from the last.
- In `parallel` mode, each step keeps its delay. Initial and exit properties are merged, with later values replacing earlier values of the same property.
- Animate properties and their per-property transition settings are merged in the same way. If several steps write one property, the last step supplies its value. Use a keyframe array to describe repeated changes to one property. Position-driven playback uses the mapped values and keyframe times, not transition delays.

For sequencing elements rather than steps inside a single element, use `after` chains, covered in [Timeline](/docs/04-orchestration).
