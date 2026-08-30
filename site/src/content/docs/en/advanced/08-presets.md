---
title: Preset animations
eyebrow: ADVANCED / PRESETS
---

CineView ships 43 string-named preset animations in 11 families. Reference one by name, as in `enterAnimation="fade-in"`. Names are members of the `PresetAnimation` union, so a typo fails at compile time and never reaches runtime.

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

The `-in` / `-out` suffix marks enter/exit direction: the conventional pairing is `-in` for enter and `-out` for exit. Suffix-free names (`fade`, `spin`, `pulse`, `shake`, …) work both ways and are the natural fit for `loopAnimation`: resident loops are gated by `shouldRunInfinite`, running only while the element is inside its own phase and in the viewport; see [Animate](/docs/03-animate).

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

- `CustomAnimation`: your own Framer Motion variant subset `{ initial, animate, exit }`.
- `ComposedAnimation`: `{ animations, mode: 'sequential' | 'parallel', delays }` chains presets and customs; they may mix in one array.

Composition rules are covered in [custom animations](/docs/05-custom-animation); the three-layer type is in the [type reference](/docs/10-types).
