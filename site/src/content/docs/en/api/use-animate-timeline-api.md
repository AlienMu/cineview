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

The object is referentially stable: putting `timeline` in an effect's dependency array will not re-run it every frame. Every field is `readonly` and no writer is exposed — CineView remains the only timeline writer.

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

Why it exists: a consumer subscribing to `progress` and `phase` separately can read a cross-commit combination — the new progress paired with the old phase, painting an intermediate state that never existed. `frame` publishes all four values atomically in the same commit.

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

Subscribe with MotionValue's `.on('change', ...)`, which returns an unsubscribe function that fits effect cleanup naturally. One discipline: **pass the MotionValue itself, never a `.get()` snapshot** — a snapshot is a static value from the moment of subscription and never updates again.

## Related pages

- Runtime semantics of the vocabulary, the canvas exemption, and rAF discipline → [useAnimateTimeline guide](/docs/use-animate-timeline)
- `ScrollMode` / `AnimatePhase` / related types → [type dictionary](/docs/types)
