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

Configuration notes:

- Use a string for a preset name and an object for a custom animation.
- `transformOrigin` strings are normalized to percentage pairs (`'top left'` → `'0% 0%'`, `'center'` → `'50% 50%'`).
- Configure Animate entrance and exit timing with `duration` and `timeline.delay`. Object-level `transition.duration` and `transition.delay` apply to Framer Motion playback such as stagger and loops. They do not change drag or scroll distances. `transition.times` defines keyframe positions.

## Keyframes and times

Supported animation properties accept keyframe arrays. Use `transition.times` to place each keyframe within progress 0–1. The time array needs the same number of entries as the keyframe array.

A property-specific `times` takes priority over top-level `transition.times`. Without a matching time array, keyframes are evenly spaced.

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

For an opacity animation with `opacity: [0, 1, 1, 0]` and `times: [0, 0.3, 0.9, 1]`:

| progress | segment                                 | result                                                         |
| -------- | --------------------------------------- | -------------------------------------------------------------- |
| 0.15     | 0 → 0.3                                 | interpolates from 0 to 1, at halfway: `0.5`                    |
| 0.45     | inside 0.3 → 0.9 (both keyframes are 1) | holds `1`                                                      |
| 0.95     | 0.9 → 1                                 | interpolates from 1 to 0, at `(0.95 − 0.9) / 0.1 = 0.5`: `0.5` |

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

Declare target values in the `exit` field of an `exitAnimation` object. The object does not need `initial` or `animate`:

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

For canvas, SVG, or WebGL drawing, subscribe to the timeline and update the image. See [useAnimateTimeline](/docs/09-use-animate-timeline) for a complete example.

## Composed animations

`ComposedAnimation` combines presets and custom properties on one element. This example fades and scales at the same time:

```tsx
<Animate
  enterAnimation={{
    animations: ['fade-in', { initial: { scale: 0.9 }, animate: { scale: 1 } }],
    mode: 'parallel',
  }}
  duration={{ enter: 1600 }}
>
  <div className="card" />
</Animate>
```

Ordinary Animate entrances, including visibility and clock playback, use `duration.enter` for the complete entrance. Composition delays do not divide that entrance into successive steps. For repeated changes to one property, use [Keyframes and times](#Keyframes-and-times).

Composition fields. `loopAnimation` and `stagger` consume the resulting per-property transition timing. Ordinary Animate entrances and exits, and Scene transitions, use the merged properties without these step delays:

| Field        | Meaning                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `animations` | Array of preset names and/or custom variants; must be non-empty.                                                                          |
| `mode`       | `'sequential'`: each step starts after the previous step's duration plus its own delay; `'parallel'`: all steps start at their own delay. |
| `delays`     | Per-step extra delay in ms, indexed by authoring position.                                                                                |

- In `sequential` mode, the next step starts after the preceding duration and delay. A step without `transition.duration` uses 1s for this calculation. `initial` comes from the first step and `exit` from the last.
- In `parallel` mode, each step keeps its delay. Initial and exit properties are merged, with later values replacing earlier values of the same property.
- Animate properties and their per-property transition settings are merged in the same way. If several steps write one property, the last step supplies its value. Use a keyframe array to describe repeated changes to one property. Ordinary Animate entrances and exits use the mapped values and keyframe times, without transition delays.

Use `timeline.after` to order entrances across elements; see [Timeline](/docs/04-orchestration). For entrance, loop, and exit effects together, see [Preset animations](/docs/08-presets).
