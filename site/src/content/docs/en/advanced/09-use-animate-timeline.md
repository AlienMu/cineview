---
title: useAnimateTimeline
eyebrow: ADVANCED / USEANIMATETIMELINE
---

`useAnimateTimeline()` provides MotionValues from the nearest Animate. Bind them to motion styles or subscribe to changes for custom drawing. Updates do not cause React renders unless the consumer puts values into React state.

## Call the hook inside an Animate child

Call the hook in a descendant React component, including a component returned by render-prop children. A call outside an Animate throws:

```text
useAnimateTimeline must be used inside an <Animate> child.
```

Treat the returned values as read-only. Derive new MotionValues instead of setting framework progress.

## Return fields

| Field            | Type                              | Meaning                                                           |
| ---------------- | --------------------------------- | ----------------------------------------------------------------- |
| `mode`           | ScrollMode                        | `'drag'` or `'scroll'`                                            |
| `lane`           | AnimateTimelineLane               | Resolved driver: `'drag'`, `'scroll'`, or `'visibility'`          |
| `progress`       | MotionValue<number>               | Normalized element progress, 0–1                                  |
| `signedProgress` | MotionValue<number>               | Signed progress; interpret it with the mode and phase             |
| `phase`          | MotionValue<AnimatePhase>         | `idle`, `waiting`, `entering`, `entered`, `exiting`, or `exited`  |
| `frame`          | MotionValue<AnimateTimelineFrame> | Progress, signed progress, phase, and source grouped in one value |

`frame.source` is `idle`, `gesture`, `continuation`, `programmatic`, `scroll`, or `visibility`. Use `frame` when one operation needs several related values from an update.

## Bind progress to styles

```tsx
import { motion, useTransform } from 'framer-motion';
import { Animate, useAnimateTimeline } from 'cineview';

function MovingContent() {
  const { progress } = useAnimateTimeline();
  const y = useTransform(progress, [0, 1], [80, -80]);
  return <motion.div style={{ y }}>Content</motion.div>;
}

export function Example() {
  return (
    <Animate enterAnimation="fade-in" duration={{ enter: 1200 }}>
      <MovingContent />
    </Animate>
  );
}
```

Motion applies these style updates without React rendering. Render-prop children are another option when JSX needs ordinary numbers, with a React render for updates.

## Interpret phase by driver

For a scene-driven entrance or exit inside a scroll locked zone, phase remains `idle` while progress follows scrolling. Clock-driven elements use visibility phases, and loop-only elements rest at `entered`.

In scroll mode, negative signed progress identifies an exit. In drag mode, forward exits can have positive signed progress, so use phase to distinguish an exit from an entrance.

Neither phase nor source alone proves that content is visible. An entrance-only element can remain `entered` after leaving the viewport.

## Draw a canvas when progress changes

A canvas that only depends on progress can draw once and subscribe to changes. It does not need its own requestAnimationFrame (rAF) loop.

```tsx
import { useEffect, useRef } from 'react';
import { useAnimateTimeline } from 'cineview';

export function Meter() {
  const { progress } = useAnimateTimeline();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.arc(64, 64, 48, -Math.PI / 2, progress.get() * Math.PI * 2 - Math.PI / 2);
      ctx.stroke();
    };

    draw();
    return progress.on('change', draw);
  }, [progress]);

  return <canvas ref={ref} width={128} height={128} aria-label="Animation progress" />;
}
```

For drawing that also changes with elapsed time, use an explicit visibility condition to start and stop a rAF loop. Cancel it on cleanup; an `entered` phase alone does not mean the canvas is still on screen.

## Keep derived motion aligned

Use `useTransform` for direct mappings from progress. An added `useSpring` introduces its own timing, so the result can lag or overshoot the scroll or drag position. Add that behavior only when the design calls for it.
