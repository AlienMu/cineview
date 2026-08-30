---
title: useAnimateTimeline
eyebrow: ADVANCED / USEANIMATETIMELINE
---

`useAnimateTimeline()` returns a read-only view of the nearest `Animate` timeline: `progress` / `signedProgress` / `phase` / `frame` are all MotionValues whose updates never touch React rendering. Use it for continuous style bindings and canvas self-drawing; if you need a plain number inside React render, use the render-prop `enterProgress` instead, see [Animate](/docs/03-animate).

## Call constraint

It must be called inside the children of `<Animate>` (plain children or inside a render-prop both work); anywhere else it throws:

```text
useAnimateTimeline must be used inside an <Animate> child.
```

The framework is the only timeline writer; every field of the returned object is `readonly` and no writer is exposed.

## Return fields

| Field            | Type                                | Description                                                                                                                                                                                                                      |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`           | `ScrollMode`                        | Root mode (`'drag' \| 'scroll'`); read-only static value.                                                                                                                                                                        |
| `driver`         | `AnimateTimelineLane`               | How this element is actually driven: `'drag' \| 'scroll' \| 'visibility'`. Under scroll mode, elements outside any locked zone fall back to `visibility`.                                                                        |
| `progress`       | `MotionValue<number>`               | Enter progress, 0..1.                                                                                                                                                                                                            |
| `signedProgress` | `MotionValue<number>`               | Signed progress; drives negative during exit, so an entrance is distinguishable from an exit.                                                                                                                                    |
| `phase`          | `MotionValue<AnimatePhase>`         | The six-state phase: `'idle' \| 'waiting' \| 'entering' \| 'entered' \| 'exiting' \| 'exited'`.                                                                                                                                  |
| `frame`          | `MotionValue<AnimateTimelineFrame>` | A full snapshot of one update, `{ progress, signedProgress, phase, source }`: all four values always update together. Reading progress and phase separately can mix old and new (new progress, old phase); `frame` removes that. |

The type of `frame.source` is `AnimateTimelineSource`, with six values: `'idle' | 'gesture' | 'continuation' | 'programmatic' | 'scroll' | 'visibility'`.

## Binding continuous values to style

For visual values interpolated from progress, attach MotionValues directly to a `motion.*` element's style, deriving them from `progress` with `useTransform`; the `motion.*` element applies updates without React re-renders:

```tsx
import { motion, useTransform } from 'framer-motion';

function ParallaxLayer() {
  const { progress } = useAnimateTimeline();
  const y = useTransform(progress, [0, 1], [80, -80]);
  return <motion.div style={{ y }} />;
}

<Animate animateId="layer" enterAnimation="fade-in" duration={{ enter: 1200 }}>
  <ParallaxLayer />
</Animate>;
```

## phase stays at idle inside a locked zone

This comes first, otherwise the pattern in "Canvas self-drawing" gets applied where it does not belong.

**Inside a scroll locked zone, `phase` never changes; it stays at `'idle'`.** Phases describe animations entering and leaving by visibility. A locked-zone animation is driven entirely by scroll position and never goes through phases, so nothing advances it to `entering` / `entered` / `exiting`. **This applies only inside a scroll locked zone**: in drag mode phases advance as usual (`hidden→idle`, `enter→entering/entered`, `rest→entered`, `outgoing→exiting`), so judging on phase is correct under drag. `progress` and `signedProgress` still follow the scroll there; only `phase` stays at `idle`.

The `state.phase` handed to render-prop children comes from the same source and likewise stays at `idle`.

The direct consequence: **the rule "subscribe to `phase`, stop the requestAnimationFrame (rAF) loop on `exited` / `idle`" stops the loop as soon as it starts inside a locked zone, and it never restarts.** To decide whether to keep drawing inside a zone, use one of these instead:

- `signedProgress`: `0` is the initial frame, `1` is fully entered, and negative values mean the exit direction.
- `frame.source`: the snapshot carries the driving source, which distinguishes `scroll` from `visibility`.

## Canvas self-drawing

Canvas self-drawing is the only place where a self-driven rAF is permitted: read MotionValues through `.get()` each frame, and subscribe to `phase` so the loop stops on `exited` / `idle`. **This applies everywhere except inside a locked zone** (elements outside zones in scroll, and both scene-driven and independently playing elements in drag); inside a locked zone, switch the predicate as described in "phase stays at idle inside a locked zone":

```tsx
function Meter() {
  const { progress, phase } = useAnimateTimeline();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const ctx = ref.current!.getContext('2d')!;
    const draw = () => {
      drawArc(ctx, progress.get());
      raf = requestAnimationFrame(draw);
    };
    const stop = phase.on('change', (p) => {
      cancelAnimationFrame(raf);
      if (p !== 'exited' && p !== 'idle') raf = requestAnimationFrame(draw);
    });
    if (phase.get() !== 'exited' && phase.get() !== 'idle') raf = requestAnimationFrame(draw);
    return () => {
      stop();
      cancelAnimationFrame(raf);
    };
  }, [progress, phase]);

  return <canvas ref={ref} />;
}
```

Without the `phase` subscription the loop never stops: the element has exited while the canvas keeps repainting at full speed.

## Don't add your own useSpring

Derive every continuous value from the MotionValues this hook returns; do not build your own `useSpring` or a separate animation loop. A spring settles on its own schedule and ignores the scroll position: how far an exit goes is decided by the gesture, while the spring stops on its own parameters. Stacked together you get overshoot, or an exit that never quite lands.
