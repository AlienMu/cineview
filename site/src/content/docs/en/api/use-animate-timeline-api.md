---
title: useAnimateTimeline()
eyebrow: API REFERENCE
---

`useAnimateTimeline()` is the zero-render escape hatch for the Animate timeline: `progress` / `signedProgress` / `phase` / `frame` on the returned object are all MotionValues, updates bypass the React rendering pipeline, and no writer is exposed. This page is the complete interface reference; the canvas exemption, rAF discipline, and "do not build your own driver" live in the [hook's guide](/docs/use-animate-timeline).

## Return object

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

| Field | Type | Description |
| --- | --- | --- |
| `mode` | `ScrollMode` | The root declaration (`'drag' \| 'scroll'`); a read-only static value. |
| `driver` | `AnimateTimelineDriver` | The lane this Animate actually sits on (`'drag' \| 'scroll' \| 'visibility'`); a read-only static value. Under scroll mode, an element outside any takeover zone degrades gracefully to `visibility` driving — reading `driver` tells real time apart from geometric visibility. |
| `progress` | `MotionValue<number>` | `0..1`: 0 is the initial frame, 1 fully entered. |
| `signedProgress` | `MotionValue<number>` | Keeps the exit direction — during an exit it advances in the negative direction; renderers that must distinguish "entering" from "exiting" use it. |
| `phase` | `MotionValue<AnimatePhase>` | The six-state phase vocabulary (next section). |
| `frame` | `MotionValue<AnimateTimelineFrame>` | The atomic snapshot (next section) — all four values published in the same commit. |

The object is referentially stable: putting `timeline` in an effect's dependency array will not re-run it every frame. Every field is `readonly` and no writer is exposed; CineView remains the only timeline writer.

## The AnimatePhase vocabulary

| Value | Meaning |
| --- | --- |
| `'idle'` | Never started. |
| `'waiting'` | Gated at the initial frame by `delay` / `waitFor`. |
| `'entering'` | Enter in progress. |
| `'entered'` | Enter complete. |
| `'exiting'` | Exit in progress. |
| `'exited'` | Exit complete. |

## AnimateTimelineFrame: the atomic snapshot

```ts
interface AnimateTimelineFrame {
  progress: number;
  signedProgress: number;
  phase: AnimatePhase;
  source: AnimateTimelineSource;
}
```

| Field | Type | Description |
| --- | --- | --- |
| `progress` | `number` | The same scalar as the top-level `progress`. |
| `signedProgress` | `number` | Same as the top-level `signedProgress`. |
| `phase` | `AnimatePhase` | Same as the top-level `phase`. |
| `source` | `AnimateTimelineSource` | Where this change came from (six values, table below). |

Why it exists: a consumer subscribing to `progress` and `phase` separately can read a cross-commit combination, the new progress paired with the old phase, painting an intermediate state that never existed. `frame` publishes all four values atomically in the same commit.

The six values of `source`:

| Value | Meaning |
| --- | --- |
| `'idle'` | No driver yet (initial). |
| `'gesture'` | A gesture — the finger displacement during a drag. |
| `'continuation'` | The release continuation after letting go (the settle animation). |
| `'programmatic'` | Programmatic navigation (`goToScene` / `goToZone` and other ref methods). |
| `'scroll'` | Scroll scrubbing. |
| `'visibility'` | The visibility gate (time-driven). |

For debug panels or telemetry, `source` answers "why did it move" better than `phase` does.

## Call-site constraint

It must be called inside a child of `<Animate>` (plain children and render-prop children both work); anywhere else it throws:

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

Subscribe with MotionValue's `.on('change', ...)`, which returns an unsubscribe function that fits effect cleanup naturally. One discipline: **pass the MotionValue itself, never a `.get()` snapshot**. A snapshot is a static value from the moment of subscription and never updates again.

## Related pages

- Runtime semantics of the vocabulary, the canvas exemption, and rAF discipline → [When to use](#when-to-use)
- `ScrollMode` / `AnimatePhase` / related types → [type dictionary](/docs/types)

## When to use

- A custom renderer (canvas / WebGL / per-frame drawing) needs animation progress or phase as input, and `Animate`'s declarative properties cannot express it.
- A debug panel or telemetry needs to atomically read "progress + phase + source" without introducing any re-render.
- You must distinguish "entering" from "exiting" (`signedProgress`) or "why did it move" (`frame.source`).

The full field list of the returned object (`mode` / `driver` / `progress` / `signedProgress` / `phase` / `frame`), the six-state phase vocabulary, and the field-by-field frame-snapshot tables live in the [useAnimateTimeline API](/docs/use-animate-timeline-api). Two quick facts: `mode` is the root declaration (drag / scroll) while `driver` is the lane this Animate actually sits on. Under scroll mode, an element outside any takeover zone degrades gracefully to `visibility` driving, and reading `driver` tells real time apart from geometric visibility. `frame` publishes progress / signedProgress / phase / source atomically in the same commit, avoiding the cross-commit "new progress with old phase" read.

The call site has one hard constraint: it must be called inside a child of `<Animate>` (plain children and render-prop children both work); anywhere else it throws `useAnimateTimeline must be used inside an <Animate> child.`. The returned object is referentially stable, so putting `timeline` in an effect's dependency array will not re-run it every frame.

## Basic usage

Subscribe with MotionValue's `.on('change', ...)`, which returns an unsubscribe function that fits effect cleanup naturally. The typical shape: a child component mounted inside `Animate` takes the `timeline`, subscribes to `timeline.frame.on('change', ...)` in an effect, reads `frame.phase` / `frame.source` / `frame.progress` from the same commit in the callback, and calls the unsubscribe function on cleanup. A complete example lives in the API reference.

The other consumption pattern is to pass the MotionValues as-is to a custom renderer (canvas / video / WebGL) and let the renderer do the subscribing; that is the subject of the next section. Both patterns share one discipline: **pass the MotionValue itself, never a `.get()` snapshot**. A snapshot is a static value from the moment of subscription and never updates again.

## The canvas exemption

On the framework's permit list, canvas self-drawing is the only self-drawing exemption: a child element reads MotionValues and drives its own rAF, with zero per-frame setState. It fits renderings `Animate`'s declarative properties cannot express, such as particle fields, waveforms, or per-frame-drawn instruments. The site's ClapperboardCanvas is the reference implementation.

The structure is two layers: an inner component calls this hook inside Animate and passes the `progress` and `phase` MotionValues down; the canvas component drives its own rAF with them. `draw` is a pure function of `(progress, phase)`, reading via `.get()` and painting fresh each frame, caching no derived state.

## rAF discipline

The exemption carries two non-negotiable disciplines:

1. **Subscribe to `timeline.phase` and pause the rAF on `exited` / `idle`.** When pausing, `cancelAnimationFrame` the queued callback and zero the handle; when resuming, paint one frame immediately before re-arming the loop. Not pausing means off-screen idle spinning: the element has exited while the canvas keeps repainting at full speed, precisely the "everything else has exited but this is still moving" broken window.
2. **Annotate the exemption reason in a file-header comment.** State why declarative Animate properties do not fit here, a particle field, waveform, or instrument reason. That comment is the permit for the next reader (and the reviewing agent): they know the self-built rAF was adjudicated, not an oversight.

Two more engineering details: unsubscribe the phase subscription and cancel the rAF on unmount, with the effect cleanup doing both; watch the canvas's own size with a `ResizeObserver`, not the window, since layout changes do not always accompany window changes.

## Do not build your own driver

This rule targets site and application components: **directly importing framer-motion to build your own animation driver is forbidden**. `motion.*` elements, `useSpring`, and self-made `useTransform` mappings are all on the ban list. To read progress / phase, use this hook.

The reason is not stylistic purity:

- A home-built `useSpring` has its own time constant. The framework's exit is scrub semantics, where convergence is decided by the gesture; a spring converges by its own parameters. The two stacked means an exit that is forever "almost there" or overshooting, visually out of control.
- Bypassing Animate's phase gating lets looping motion escape the phase constraint and idle-spin off-screen (the same broken window as above).
- The dual-track model (see the concepts group's dual-track page) guarantees a single progress writer; a home-built driver is a de facto second writer whose writes are overwritten next frame, implementation cost paid for nothing.

Mind the boundary: the ban targets "animation drivers". Data-source hooks (like a `useTimecode` updating with a timecode) are not animation and are unrestricted; importing pure types from framer-motion (`type MotionValue`) is not driving either.

---

For the full interface, the six-state vocabulary, and the frame snapshot's six sources see the [useAnimateTimeline API](/docs/use-animate-timeline-api).
