---
title: Custom animations
eyebrow: ADVANCED / CUSTOM ANIMATION
---

When no preset fits, author a variant object directly. A custom animation is a Framer Motion variant subset (`initial`, `animate`, `exit` records) passed inline where a preset name goes.

## Custom variants

The `CustomAnimation` shape allows exactly three keys, and at least one of them must be a non-empty object; anything else is rejected by the parser (`src/animations/animationParser.ts`).

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
- Transition timing inside a variant (`transition.duration` in seconds, `transition.delay` in seconds) applies to time-driven animations. Animations that follow scroll position (inside a locked zone, or scene-driven elements in drag) interpolate by position and ignore transition timing; their duration comes from `duration.enter`, the scrolled span.

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

For elements that follow scroll, the runtime resolves each property at the scrolled progress: a scalar target is a from-to lerp; an array target walks the keyframe segments. The string interpolator handles numbers, unit-suffixed strings (`100%`, `12px`, `45deg`), and single-argument transform functions (`translateY(100%)`), so authored endpoints stay in design units.

## How keyframes resolve while scrolling

Walk one property through the resolver. With `opacity: [0, 1, 1, 0]` and `times: [0, 0.3, 0.9, 1]`:

| progress | segment                                 | result                                            |
| -------- | --------------------------------------- | ------------------------------------------------- |
| 0.15     | 0 → 0.3                                 | lerps 0 → 1, at halfway: `0.5`                    |
| 0.45     | inside 0.3 → 0.9 (both keyframes are 1) | holds `1`                                         |
| 0.95     | 0.9 → 1                                 | lerps 1 → 0, at `(0.95 − 0.9) / 0.1 = 0.5`: `0.5` |

Keyframes give a scroll-driven element a _shape across its span_ (enter, hold, and leave inside one `duration.enter`) which a plain from-to variant cannot express. This is the standard idiom for elements that must both arrive and depart within a single locked zone: one element, one span, four keyframes.

## Two variant constructors from site implementation

The codebase includes two typical variant constructors (sourced from `site/src/components/CapabilityScene.tsx`):

```tsx
/* Neutral variant: establishes the shared timeline without fading the carried
   content across the whole span. transition duration 0. Under scroll the
   position drives the value, so the variant only fixes the endpoints. */
export function solidVariant() {
  return {
    initial: { opacity: 1 },
    animate: { opacity: 1, transition: { duration: 0 } },
  };
}

/* Allowlist-only rise: custom variants for scroll-driven animations should stick to the
   ten engine-owned properties. */
export function riseVariant(amplitude: string) {
  return {
    initial: { y: amplitude, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { duration: 0 } },
  };
}
```

`solidVariant()` is the standard pattern for an element that sits on the shared timeline (for render-props, `useAnimateTimeline` consumers, or as an after anchor) but requires no visual animation of its own. The default `AnimateVideo` wrapper uses the same approach internally.

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

(This pattern is used in the slate scene: enter translates and settles, while exit scales and fades out smoothly.)

Exit keyframe arrays work exactly like enter ones (`times` included), and the element's terminal state is the last keyframe. Scrolling back walks the same interpolation in reverse, so an exit authored as keyframes unwinds keyframe by keyframe.

## Which properties animate

Enter and exit animations can animate exactly ten properties:

`opacity`, `x`, `y`, `scale`, `rotate`, `rotateX`, `rotateY`, `skewX`, `skewY`, `filter`.

Custom variants driven by scroll must stay within these ten properties. Two exceptions apply:

- The `stagger` prop reveals each direct child through Framer's native variant propagation, which accepts any Framer-animatable property (`clipPath`, `width`, …); it runs on time, never on scroll position.
- Canvas and custom renderers read `useAnimateTimeline()` MotionValues directly (the canvas exemption).

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

Composition rules (from `src/animations/composer.ts`):

| Field        | Meaning                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `animations` | Array of preset names and/or custom variants; must be non-empty.                                                                          |
| `mode`       | `'sequential'`: each step starts after the previous step's duration plus its own delay; `'parallel'`: all steps start at their own delay. |
| `delays`     | Per-step extra delay in ms, indexed by authoring position.                                                                                |

- `sequential`: step delay accumulates `previous duration + previous customDelay`; a step that declares no `transition.duration` is assumed to take 1s (Framer's implicit duration cannot be read at compose time; declare durations explicitly). `initial` comes from the first step, `exit` from the last.
- `parallel`: every step keeps its own delay; `initial` and `exit` merge all steps (same-name properties last-wins).
- Merged `animate` uses Framer's per-value transition form (`transition: { opacity: {...}, y: {...} }`), so each property carries its own step's delay/duration. Note this shape serves time-driven playback; elements that follow scroll interpolate by value and ignore transition.

For sequencing elements rather than steps inside a single element, use `after` chains, covered in [Timeline](/docs/04-orchestration).
