---
title: Presets and animation combinations
eyebrow: ADVANCED / PRESETS
---

Cineview provides presets for fades, movement, scaling, and loops. Combine a preset with custom properties when one effect needs more than a preset alone.

## Combine a preset with custom movement

This title fades in and moves upward over the same 800ms entrance. Both changes reverse together if scene progress moves backward:

```tsx
import { Animate, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="drag" designWidth={750}>
      <Scene sceneId="opening">
        <Animate
          enterAnimation={{
            animations: ['fade-in', { initial: { y: 32 }, animate: { y: 0 } }],
            mode: 'parallel',
          }}
          duration={{ enter: 800 }}
        >
          <h1>Product details</h1>
        </Animate>
      </Scene>
      <Scene sceneId="next"><h2>Next scene</h2></Scene>
    </Cineview>
  );
}
```

The `animations` array can mix preset names and custom animation objects. If two entries set the same property, the later entry wins. Ordinary Animate entrances and exits combine them into one progress interval, including visibility and clock playback; `sequential` and `delays` do not split these animations into separate stages. Use keyframes for changes within one element, or `timeline.after` to order separate elements. See [Animation composition](/docs/04-orchestration).

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

## Combine entrance, loop, and exit effects

Set all three animation props on the same Animate to loop after entrance and play an exit when it leaves. This example moves up and fades in, pulses after entrance, then fades out:

```tsx
<Animate
  animateId="title"
  enterAnimation="slide-up"
  exitAnimation="fade-out"
  loopAnimation="pulse"
  duration={{ enter: 800, exit: 400 }}
>
  <h1>Opening title</h1>
</Animate>
```

Place this example in a drag Scene or a scroll Scene that animates through visibility. The default `driver: 'scene'` supports drag exits; `driver: 'clock'` ignores exits in drag. In a scroll locked zone, entrance and exit follow scroll distance, so leave room between them for a visible loop. See [Animate](/docs/03-animate) for driver and loop conditions.

Presets also work in `Scene.transition` for whole-scene entrance and exit effects in scroll mode.

## Configuration reference

Animation props also accept these configurations:

- `CustomAnimation`: define properties and keyframes with `{ initial?, animate?, exit? }`.
- `ComposedAnimation`: mix preset names and custom animations in `animations`. The `mode` and `delays` fields produce per-property timing for `loopAnimation` and `stagger`; ordinary entrances and exits use the overall duration.

See [Custom animations](/docs/05-custom-animation) for keyframes and [Type reference](/docs/10-types) for the complete types.
