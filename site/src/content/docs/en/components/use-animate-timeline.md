---
title: useAnimateTimeline()
eyebrow: ESCAPE HATCH
---

`useAnimateTimeline()` is the zero-render escape hatch for the Animate timeline: `progress` / `signedProgress` / `phase` / `frame` on the returned object are all MotionValues, updates bypass the React rendering pipeline, and no writer is exposed. CineView remains the only timeline writer — this hook grants you read access only, and reading never triggers a render.

## When to use

- A custom renderer (canvas / WebGL / per-frame drawing) needs animation progress or phase as input, and `Animate`'s declarative properties cannot express it.
- A debug panel or telemetry needs to atomically read "progress + phase + source" without introducing any re-render.
- You must distinguish "entering" from "exiting" (`signedProgress`) or "why did it move" (`frame.source`).

The full field list of the returned object (`mode` / `driver` / `progress` / `signedProgress` / `phase` / `frame`), the six-state phase vocabulary, and the field-by-field frame-snapshot tables live in the [useAnimateTimeline API](/docs/use-animate-timeline-api). Two quick facts: `mode` is the root declaration (drag / scroll) while `driver` is the lane this Animate actually sits on — under scroll mode, an element outside any takeover zone degrades gracefully to `visibility` driving, and reading `driver` tells real time apart from geometric visibility; `frame` publishes progress / signedProgress / phase / source atomically in the same commit, avoiding the cross-commit "new progress with old phase" read.

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

## The canvas exemption

On the framework's permit list, canvas self-drawing is the only self-drawing exemption: a child element reads MotionValues and drives its own rAF, with zero per-frame setState. It fits renderings `Animate`'s declarative properties cannot express — particle fields, waveforms, per-frame-drawn instruments. The full pattern (simplified from the site's ClapperboardCanvas):

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

The structure is two layers: `ParticleLayer` takes the timeline inside Animate and passes the two MotionValues down; `ParticleCanvas` drives its own rAF with them. `draw` is a pure function of `(progress, phase)` — it reads via `.get()` and paints fresh each frame, caching no derived state.

## rAF discipline

The exemption carries two non-negotiable disciplines:

1. **Subscribe to `timeline.phase` and pause the rAF on `exited` / `idle`.** The `applyPhase` above is the canonical posture: when pausing, `cancelAnimationFrame` the queued callback and zero the handle; when resuming, `draw()` one frame immediately before re-arming the loop. Not pausing means off-screen idle spinning — the element has exited while the canvas keeps repainting at full speed, precisely the "everything else has exited but this is still moving" broken window.
2. **Annotate the exemption reason in a file-header comment.** State "why declarative Animate properties do not fit here" — particle field, waveform, instrument, and the like. That comment is the permit for the next reader (and the reviewing agent): they know the self-built rAF was adjudicated, not an oversight.

Two more engineering details: unsubscribe the phase subscription and cancel the rAF on unmount (the effect cleanup does both); watch the canvas's own size with a `ResizeObserver`, not the window (layout changes do not always accompany window changes).

## Do not build your own driver

This rule targets site and application components: **directly importing framer-motion to build your own animation driver is forbidden** — `motion.*` elements, `useSpring`, and self-made `useTransform` mappings are all on the ban list. To read progress / phase, use this hook.

The reason is not stylistic purity:

- A home-built `useSpring` has its own time constant. The framework's exit is scrub semantics — convergence is decided by the gesture — while a spring converges by its own parameters; the two stacked means an exit that is forever "almost there" or overshooting, visually out of control.
- Bypassing Animate's phase gating lets looping motion escape the phase constraint and idle-spin off-screen (the same broken window as above).
- The dual-track model (see the concepts group's dual-track page) guarantees a single progress writer; a home-built driver is a de facto second writer whose writes are overwritten next frame — implementation cost paid for nothing.

Mind the boundary: the ban targets "animation drivers". Data-source hooks (like a `useTimecode` updating with a timecode) are not animation and are unrestricted; importing pure types from framer-motion (`type MotionValue`) is not driving either — the first line of the example above is legal usage.

---

For the full interface, the six-state vocabulary, and the frame snapshot's six sources see the [useAnimateTimeline API](/docs/use-animate-timeline-api).
