---
title: useAnimateTimeline()
eyebrow: ESCAPE HATCH
---

`useAnimateTimeline()` is the zero-render escape hatch for the Animate timeline: `progress` / `signedProgress` / `phase` / `frame` on the returned object are all MotionValues, updates bypass the React rendering pipeline, and no writer is exposed. CineView remains the only timeline writer — this hook grants you read access only, and reading never triggers a render.

## What you get

```ts
import type { MotionValue } from 'framer-motion';

interface AnimateTimeline {
  readonly mode: ScrollMode; // 'drag' | 'scroll'
  readonly driver: AnimateTimelineDriver; // 'drag' | 'scroll' | 'visibility'
  readonly progress: MotionValue<number>; // 0..1, 0 = initial frame, 1 = fully entered
  readonly signedProgress: MotionValue<number>; // retains the exit direction
  readonly phase: MotionValue<AnimatePhase>;
  readonly frame: MotionValue<AnimateTimelineFrame>; // atomic snapshot for imperative consumers
}
```

- `mode` is the root declaration (drag / scroll); `driver` is the lane this Animate actually sits on — under scroll mode, an element outside any takeover zone degrades gracefully to `visibility` driving, and reading `driver` tells real time apart from geometric visibility.
- `progress` spans 0..1: 0 is the initial frame, 1 fully entered.
- `signedProgress` keeps the exit direction — during an exit it advances in the negative direction; renderers that must distinguish "entering" from "exiting" use it.
- `phase` and `frame` are covered in the next section.

The call site has one hard constraint: it must be called inside a child of `<Animate>` (plain children and render-prop children both work); anywhere else it throws `useAnimateTimeline must be used inside an <Animate> child.`. The returned object is referentially stable — putting `timeline` in an effect's dependency array will not re-run it every frame.

## Basic usage

Subscribe with MotionValue's `.on('change', ...)`, which returns an unsubscribe function that fits effect cleanup naturally:

```tsx
function PhaseLogger() {
  const timeline = useAnimateTimeline();

  useEffect(() => {
    const stop = timeline.frame.on('change', (frame) => {
      // One atomic read: progress and phase from the same commit.
      console.log(frame.phase, frame.source, frame.progress);
    });
    return stop;
  }, [timeline]);

  return null;
}

<Animate animateId="logger" enterAnimation="fade-in" duration={{ enter: 800 }}>
  <PhaseLogger />
</Animate>
```

The other consumption pattern is to pass the MotionValues as-is to a custom renderer (canvas / video / WebGL) and let the renderer do the subscribing — that is the subject of the next section. Both patterns share one discipline: **pass the MotionValue itself, never a `.get()` snapshot** — a snapshot is a static value from the moment of subscription and never updates again.

## The phase vocabulary and the frame snapshot

`phase` is the shared phase vocabulary, six states:

```ts
type AnimatePhase = 'idle' | 'waiting' | 'entering' | 'entered' | 'exiting' | 'exited';
```

`idle` has never started; `waiting` is gated at the initial frame by `delay` / `waitFor`; `entering` / `entered` / `exiting` / `exited` cover entrance, entrance complete, exit, and exit complete in order.

`frame` is the atomic snapshot for imperative consumers:

```ts
interface AnimateTimelineFrame {
  progress: number;
  signedProgress: number;
  phase: AnimatePhase;
  source: AnimateTimelineSource; // 'idle' | 'gesture' | 'continuation' | 'programmatic' | 'scroll' | 'visibility'
}
```

Why it exists: a consumer subscribing to `progress` and `phase` separately can read a cross-commit combination — the new progress paired with the old phase, painting an intermediate state that never existed. `frame` publishes all four values atomically in the same commit. `source` further tells you where the change came from: a gesture (`gesture`), release continuation (`continuation`), programmatic navigation (`programmatic`), scrolling (`scroll`), or the visibility gate (`visibility`) — for debug panels or telemetry it answers "why did it move" better than phase does.

## The canvas exemption

On the framework's permit list, canvas self-drawing is the only self-rendering exemption: a child reads MotionValues and drives its own rAF, with zero per-frame setState. It fits rendering that `Animate`'s declarative properties cannot express — particle fields, waveforms, frame-by-frame instruments. The full pattern (simplified from the site's production ClapperboardCanvas):

```tsx
import { type MotionValue } from 'framer-motion';
import { Animate, useAnimateTimeline } from 'cineview';
import type { AnimatePhase } from 'cineview';

interface ParticleCanvasProps {
  progress: MotionValue<number>;
  phase: MotionValue<AnimatePhase>;
}

function ParticleLayer() {
  const timeline = useAnimateTimeline();
  // MotionValues are stable: pass them down, never their .get() snapshots.
  return <ParticleCanvas progress={timeline.progress} phase={timeline.phase} />;
}

function ParticleCanvas({ progress, phase }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let paused = phase.get() === 'exited' || phase.get() === 'idle';

    const draw = () => {
      const raw = Math.min(1, Math.max(0, progress.get()));
      // Paint the frame as a pure function of (raw, phase). No setState, no layout reads.
    };

    const tick = () => {
      if (paused) {
        raf = 0;
        return;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    const applyPhase = (next: AnimatePhase) => {
      paused = next === 'exited' || next === 'idle';
      if (paused) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else {
        draw();
        if (raf === 0) raf = requestAnimationFrame(tick);
      }
    };

    applyPhase(phase.get());
    const stopPhase = phase.on('change', applyPhase);
    return () => {
      stopPhase();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [progress, phase]);

  return <canvas ref={canvasRef} aria-hidden="true" />;
}

<Animate animateId="particles" enterAnimation="fade-in" duration={{ enter: 4000 }}>
  <ParticleLayer />
</Animate>
```

The structure splits into two layers: `ParticleLayer` grabs the timeline inside Animate and passes the two MotionValues down; `ParticleCanvas` takes them and drives its own rAF. `draw` is a pure function of `(progress, phase)` — every frame reads `.get()` fresh and paints, with no cached derived state.

## rAF discipline

The exemption comes with two non-negotiable disciplines:

1. **You must subscribe to `timeline.phase` and pause the rAF on `exited` / `idle`.** The `applyPhase` above is the canonical posture: when pausing, `cancelAnimationFrame` the queued callback and zero the handle; when resuming, `draw()` one frame immediately before re-arming the loop. The cost of not pausing is offscreen spinning — the element has exited while the canvas still repaints at full speed, which is precisely the "everything else has exited and this one is still moving" breakage.
2. **Annotate the exemption reason in the file header.** State why declarative `Animate` properties were not used here — particle field, waveform, instrument readout. That comment is a permit for the next reader (and the reviewing agent): they know this hand-rolled rAF went through a ruling, not a loophole.

Two engineering details besides: unsubscribe the phase listener and cancel the rAF on unmount (the effect cleanup does both); watch the canvas's own size with a `ResizeObserver` rather than window resize (layout changes do not always accompany window changes).

## Do not build your own driver

This rule targets site and application components: **importing framer-motion directly to build your own animation driver is forbidden** — `motion.*` elements, `useSpring`, and self-made `useTransform` mappings are all on the banned list. When you need progress / phase, use this hook.

The reasoning is not stylistic fastidiousness:

- A hand-rolled `useSpring` has its own time constants. The framework's exit is scrub semantics — progress convergence is decided by the gesture; a spring converges by its own spring parameters instead. Stack the two and the exit always ends "a little short" or overshoots — visually uncontrolled.
- Bypassing Animate's phase gating lets loop-type effects escape phase constraints and spin offscreen (the same breakage as in the previous section).
- The dual-track model (see the dual-track page in the concepts group) guarantees a single writer for progress; a home-made driver is a second writer in fact, its writes get overwritten next frame, and you pay the implementation cost for nothing.

Mind the boundary: the ban targets "animation drivers". Data-source hooks (for example a `useTimecode` that ticks with a timecode) are not animations and are unrestricted; importing pure types from framer-motion (`type MotionValue`) is not driving either — line one of the previous section's example is legal usage.
