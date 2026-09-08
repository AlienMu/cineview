---
title: Preset animations
eyebrow: ADVANCED / PRESETS
---

CineView provides 43 presets in 11 groups. Pass a name such as `enterAnimation="fade-in"`; the `PresetAnimation` type checks the spelling.

## The catalog

| Family  | Presets                                                                        |
| ------- | ------------------------------------------------------------------------------ |
| Basic   | `fade`, `fade-in`, `fade-out`                                                  |
| Slide   | `slide-up`, `slide-down`, `slide-left`, `slide-right`                          |
| Zoom    | `zoom-in`, `zoom-out`, `scale-up`, `scale-down`                                |
| Rotate  | `rotate`, `rotate-in`, `rotate-out`, `spin`                                    |
| Flip    | `flip`, `flip-x`, `flip-y`                                                     |
| Bounce  | `bounce`, `bounce-in`, `bounce-out`                                            |
| Blink   | `blink`, `flash`, `pulse`                                                      |
| Shake   | `shake`, `shake-x`, `shake-y`, `vibrate`, `jello`                              |
| Blur    | `blur-in`, `blur-out`, `focus-in`                                              |
| Elastic | `elastic`, `rubber-band`, `wobble`, `swing`                                    |
| Special | `heartbeat`, `tada`, `wave`, `roll-in`, `roll-out`, `hinge`, `jack-in-the-box` |

## Naming convention

Names ending in `-in` and `-out` conventionally pair an entrance with an exit. Names such as `spin`, `pulse`, and `shake` can also be used for loops. Loop playback follows the element's visibility and animation stage; see [Animate](/docs/03-animate).

## Usage

Pass a preset to Animate's animation props, or use it in Scene transitions in scroll mode.

```tsx
<Animate
  animateId="title"
  enterAnimation="slide-up"
  exitAnimation="fade-out"
  duration={{ enter: 800, exit: 400 }}
>
  <h1>Opening title</h1>
</Animate>
```

For the timeline semantics behind enter/exit (delay, after, exit pairing), see the [Animate reference](/docs/03-animate).

## Two non-preset sources

The type of `enterAnimation` and friends is `AnimationType = PresetAnimation | CustomAnimation | ComposedAnimation`:

- `CustomAnimation`: a custom Framer Motion variant subset `{ initial, animate, exit }`.
- `ComposedAnimation`: `{ animations, mode: 'sequential' | 'parallel', delays }` composes presets and custom variants into sequential or parallel sequences within a single array.

Composition rules are covered in [custom animations](/docs/05-custom-animation); the three-layer type is in the [type reference](/docs/10-types).
