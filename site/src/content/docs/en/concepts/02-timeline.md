---
title: The Animate timeline
eyebrow: CONCEPTS / TIMELINE
---

`timeline` determines whether Animate follows gestures, scroll position, or elapsed time. Custom components can read its progress to draw visuals that stay aligned with the animation.

## Choose the progress source

`timeline.driver` defaults to `'scene'`. Set it to `'clock'` to play an element independently by elapsed time.

| driver | Location | Playback |
| --- | --- | --- |
| `'scene'` | drag | Follows the owning Scene's element progress |
| `'scene'` | Inside a scroll locked zone | Follows the zone's scroll position |
| `'scene'` | Outside a scroll locked zone | Plays by time when visibility conditions hold |
| `'clock'` | drag | Plays independently after the Scene arrives |
| `'clock'` | scroll, including inside a zone | Plays independently when visibility conditions hold |

In drag mode, `driver: 'clock'` does not participate in `after` sequences. Its duration does not extend the Scene's total element duration, and it does not play `exitAnimation`.

## Draw a canvas from progress

Call `useAnimateTimeline()` inside a descendant of Animate. Its `progress` is a MotionValue from 0 to 1 that can drive drawing through a change subscription.

```tsx
import { useEffect, useRef } from 'react';
import { Animate, useAnimateTimeline } from 'cineview';

function ProgressCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { progress } = useAnimateTimeline();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const draw = (value: number) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#0e7490';
      context.fillRect(0, 0, canvas.width * value, canvas.height);
    };

    draw(progress.get());
    return progress.on('change', draw);
  }, [progress]);

  return <canvas ref={canvasRef} width={320} height={32} aria-label="Animation progress" />;
}

export function ProgressExample() {
  return (
    <Animate
      enterAnimation={{ initial: { opacity: 1 }, animate: { opacity: 1 } }}
      duration={{ enter: 1200 }}
    >
      <ProgressCanvas />
    </Animate>
  );
}
```

Place `ProgressExample` inside a drag scene or a scroll locked zone. It draws when progress changes and unsubscribes on unmount. Because the drawing only depends on progress, it needs no separate animation loop.

For numeric values in JSX, use function children: `{({ enterProgress }) => ...}`. This form causes React renders when progress changes. See [useAnimateTimeline](/docs/09-use-animate-timeline) for more rendering examples.

## Read phase

`phase` describes the element's playback stage:

| phase | Meaning |
| --- | --- |
| `idle` | Has not started or begun waiting |
| `waiting` | Waiting for a delay or preceding animation |
| `entering` | Entrance in progress |
| `entered` | Entrance complete |
| `exiting` | Exit in progress |
| `exited` | Exit complete |

Function children receive an ordinary `phase` value. `useAnimateTimeline()` provides a subscribable `phase` MotionValue.

**Read progress to locate a scroll-driven entrance or exit inside a locked zone.** Its `phase` stays at `idle` instead of changing stages with scrolling. Elements playing independently by time use visibility phases, while loop-only elements use `entered`.

## Set delays and playback intervals

`timeline.delay` sets the entrance delay in milliseconds. For drag or scroll progress, it represents distance before the animation starts. For independent playback, it represents waiting time.

`timeline.after` refers to another element's `animateId` in the same Scene. The follower starts when that element finishes entering, plus its own `delay`; exit duration is not part of the wait. For supported drivers, see [Animation composition and sequencing](/docs/04-orchestration). A missing target reports `INVALID_ANIMATION`, and a circular dependency reports `CIRCULAR_DEPENDENCY`.

An Animate inside a locked zone uses its owning Scene's zone. Place it inside the Scene whose progress it should follow. `timeline.phase: { start, end }` sets the entrance interval within that zone using values from 0 to 1. It only applies to scene-driven animation in scroll mode.

## Trigger entrance and exit manually

Passing `enterRef` or `exitRef` gives the ref a trigger function. Call `enterRef.current?.()` to begin the entrance immediately.

| Animation | enterRef | exitRef |
| --- | --- | --- |
| Scroll visibility animation, including clock animation in a zone | Supported | Supported |
| Drag clock animation | Supported | Not supported |
| Scene-driven drag animation | Not supported | Not supported |
| Animation following locked-zone scrolling | Not supported | Not supported |

Unsupported refs are ignored and report `INVALID_ANIMATION`. A supported `enterRef` interrupts any pending wait and starts the entrance. A valid `after` or positive `delay` still allows automatic entrance; without either, a manual call is required.

Passing a supported `exitRef` disables automatic exit. Calling it begins the exit immediately and interrupts an unfinished entrance. No timed fallback triggers the exit. Manual refs do not keep content visible after its Scene leaves.

See [Animate reference](/docs/03-animate) for complete examples.
