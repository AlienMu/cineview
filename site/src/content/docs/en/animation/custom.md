---
title: Custom animations
eyebrow: AUTHORED
---

When no preset fits, author a variant object directly. A custom animation is a Framer Motion variant subset (`initial`, `animate`, `exit` records) passed inline where a preset name would go.

## Custom variants

The `CustomAnimation` shape allows exactly three keys, and at least one of them must be a non-empty object; anything else is rejected by the parser (`validateCustomAnimation` in `src/animations/animationParser.ts`).

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

Parsing rules worth knowing:

- A string is parsed as a preset name; an object is parsed as a custom variant; `parseAnimation` dispatches on the type.
- `transformOrigin` strings are normalized to percentage pairs (`'top left'` → `'0% 0%'`, `'center'` → `'50% 50%'`).
- Transition timing inside a variant (`transition.duration` in seconds, `transition.delay` in seconds) applies on time-driven lanes. Scrub lanes (scroll takeover, drag element track) interpolate by position and ignore transition timing; duration there comes from `duration.enter`, the scrub span.

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

On scrub lanes the runtime resolves each property at the scrubbed progress: a scalar target is a from-to lerp; an array target walks the keyframe segments. The string interpolator handles numbers, unit-suffixed strings (`100%`, `12px`, `45deg`), and single-argument transform functions (`translateY(100%)`), so authored endpoints stay in design units.

## How keyframes resolve on a scrub lane

Walk one property through the resolver. With `opacity: [0, 1, 1, 0]` and `times: [0, 0.3, 0.9, 1]`:

| progress | segment | result |
| --- | --- | --- |
| 0.15 | 0 → 0.3 | lerps 0 → 1, at halfway: `0.5` |
| 0.45 | inside 0.3 → 0.9 (both keyframes are 1) | holds `1` |
| 0.95 | 0.9 → 1 | lerps 1 → 0, at `(0.95 − 0.9) / 0.1 = 0.5`: `0.5` |

Keyframes give a scrubbed element a *shape across its span* (enter, hold, and leave inside one `duration.enter`) which a plain from-to variant cannot express. This is the standard idiom for elements that must both arrive and depart within a single takeover zone: one lane, one span, four keyframes.

## Two shapes from real site code

The site uses two small factories worth copying (from `site/src/components/CapabilityScene.tsx`):

```tsx
/* Neutral lane: establishes the shared timeline without fading the carried
   content across the whole span. transition duration 0 — under scroll the
   position drives the value, so the variant only fixes the endpoints. */
export function solidVariant() {
  return {
    initial: { opacity: 1 },
    animate: { opacity: 1, transition: { duration: 0 } },
  };
}

/* Whitelist-only rise: custom variants on scrub lanes should stick to the
   ten lane-owned properties. */
export function riseVariant(amplitude: string) {
  return {
    initial: { y: amplitude, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { duration: 0 } },
  };
}
```

`solidVariant()` is the idiom for "I need a timeline lane (for render-props, `useAnimateTimeline` consumers, or a waitFor anchor) but no visual animation of my own", and the default `AnimateVideo` wrapper uses the same trick internally.

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

(The shape above is lifted from the site's slate scene: enter rises and settles, exit scales *up* while fading, a projector pulling back.)

Exit keyframe arrays work exactly like enter ones (`times` included), and the element's terminal state is the last keyframe. The reverse pass of a scrub lane walks the same interpolation backwards, so an exit authored as keyframes unwinds keyframe by keyframe.

## Which properties animate

The enter/exit property lanes own exactly ten properties:

`opacity`, `x`, `y`, `scale`, `rotate`, `rotateX`, `rotateY`, `skewX`, `skewY`, `filter`.

Custom variants on scrub lanes should stick to these. Two sanctioned ways past the whitelist:

- The `stagger` prop reveals each direct child via Framer's native variant propagation, which accepts any Framer-animatable property (`clipPath`, `width`, …); time-driven, never scrubs.
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

| Field | Meaning |
| --- | --- |
| `animations` | Array of preset names and/or custom variants; must be non-empty. |
| `mode` | `'sequential'` — each step starts after the previous step's duration plus its own delay; `'parallel'` — all steps start at their own delay. |
| `delays` | Per-step extra delay in ms, indexed by authoring position. |

- `sequential`: step delay accumulates `previous duration + previous customDelay`; a step that declares no `transition.duration` is assumed to take 1s (Framer's implicit duration cannot be read at compose time; declare durations explicitly). `initial` comes from the first step, `exit` from the last.
- `parallel`: every step keeps its own delay; `initial` and `exit` merge all steps (same-name properties last-wins).
- Merged `animate` uses Framer's per-value transition form (`transition: { opacity: {...}, y: {...} }`), so each property carries its own step's delay/duration. Note this shape serves time-driven lanes; scrub paths lerp by value and ignore transition.

For sequencing *elements* rather than steps inside one element, use `waitFor` chains, covered on the next page.
