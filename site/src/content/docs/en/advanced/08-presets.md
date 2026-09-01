---
title: Preset animations
eyebrow: ADVANCED / PRESETS
---

CineView includes 43 preset animations categorized into 11 families. Reference animations by string name, such as `enterAnimation="fade-in"`. All names belong to the `PresetAnimation` union, allowing TypeScript to catch typos at compile time.

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

The `-in` / `-out` suffix marks enter/exit direction: the conventional pairing is `-in` for enter and `-out` for exit. Suffix-free names (`fade`, `spin`, `pulse`, `shake`, …) work both ways and are the natural fit for `loopAnimation`: resident loops run only while the element is inside its own phase and in the viewport; see [Animate](/docs/03-animate).

## Usage

Pass the name to `enterAnimation` / `exitAnimation` on `Animate`, or to `Scene.transition`:

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
