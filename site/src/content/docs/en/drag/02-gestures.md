---
title: Gestures and thresholds
eyebrow: DRAG / GESTURES
---

Drag supports pointer gestures and keyboard navigation. Velocity and displacement determine whether a pointer gesture commits a scene change.

## Thresholds: faster flicks need less distance

Faster release velocity reduces the distance required to change Scenes. The framework uses velocity in px/s; it does not calculate a separate acceleration in px/s². Accelerating and then pausing still produces a low-velocity release.

With defaults, a paused release requires more than 30% of the viewport length. At 500px/s it requires more than 22.5%; at 1000px/s or above, more than 15%. Releasing exactly at the threshold restores the page.

Velocity decides whether navigation commits. `unit` and `scale` determine element time during the gesture; release velocity does not add an acceleration curve to that timeline.

On release the displacement ratio is compared against a threshold that falls linearly with velocity:

| Field         | Default | Meaning                                            |
| ------------- | ------- | -------------------------------------------------- |
| `minVelocity` | `0`     | Lower velocity bound (px/s)                        |
| `maxVelocity` | `1000`  | Upper velocity bound (px/s)                        |
| `minRatio`    | `0.15`  | Displacement threshold at the upper velocity bound |
| `maxRatio`    | `0.3`   | Displacement threshold at the lower velocity bound |

```text
threshold(v) = maxRatio − (clamp(v) − minVelocity) / (maxVelocity − minVelocity) × (maxRatio − minRatio)
```

With the defaults, a slow drag needs more than 30% of the screen. At 1000 px/s, it needs more than 15%. Non-finite velocity uses `maxRatio`. **Equal `minVelocity` and `maxVelocity` values fix the threshold at `maxRatio`.**

These behaviors are independent of `threshold`:

- Reversing direction above 600 px/s cancels the change on release, even with enough displacement.
- Dragging backward at the first Scene or forward at the last bounces back over 150 ms. An ordinary bounce takes displacement ratio × 800 ms, capped at 300 ms.
- A standalone Scene outside Cineview uses a fixed threshold of 0.5.

Gesture progress uses `window.innerHeight` or `window.innerWidth`. In a smaller container, dragging its full length can still fall short of the switching threshold.

## Keep a control's own drag

Put `data-cineview-ignore-drag` on a custom control's interactive region. Its pointer handlers then receive the gesture without starting scene navigation. This card moves horizontally inside a vertically draggable Scene:

```tsx
import { useRef, type PointerEvent } from 'react';
import { Cineview, Scene } from 'cineview';

export default function App() {
  const card = useRef<HTMLDivElement>(null);
  const x = useRef(0);
  const start = useRef<{ pointerX: number; x: number } | null>(null);

  function begin(event: PointerEvent<HTMLDivElement>) {
    start.current = { pointerX: event.clientX, x: x.current };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!start.current || !card.current) return;
    x.current = Math.max(
      -120,
      Math.min(120, start.current.x + event.clientX - start.current.pointerX)
    );
    card.current.style.transform = `translateX(${x.current}px)`;
  }

  function end() {
    start.current = null;
  }

  return (
    <Cineview mode="drag" direction="y" designWidth={750}>
      <Scene sceneId="controls">
        <div
          data-cineview-ignore-drag
          onPointerDown={begin}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          style={{ touchAction: 'none', padding: 80 }}
        >
          <div ref={card} style={{ width: 160, padding: 24, background: '#e8edf0' }}>
            Drag this card sideways
          </div>
        </div>
      </Scene>
      <Scene sceneId="next">
        <h2>Next scene</h2>
      </Scene>
    </Cineview>
  );
}
```

The marker prevents Cineview from handling presses in that region. `touchAction: 'none'` lets the control receive touch pointer movement; an ancestor's `touch-action` can otherwise restrict the gesture. Drag outside the region to change scenes. Native inputs such as `<input type="range">` are exempt automatically.

## Pointer and keyboard input

With the container focused, use Up/Down for vertical dragging and Left/Right for horizontal dragging. PageUp, PageDown, Home, and End also work. Controls inside the Scene keep their own keys. Mouse-wheel paging is not provided. Use `ref.goToScene(index, animated?)` for programmatic navigation.

The Scene's `touch-action` follows `direction`, allowing native gestures on the other axis and pinch zoom:

| `direction`     | `touch-action`     |
| --------------- | ------------------ |
| `'y'` (default) | `pan-x pinch-zoom` |
| `'x'`           | `pan-y pinch-zoom` |

An inner control can opt out of Cineview's gesture handling, but that does not change an ancestor's CSS `touch-action` restrictions.

## The four pointerdown checks

The initial press must satisfy all four conditions:

1. This scene may start a gesture (the current scene, or any scene while a transition is in flight)
2. `event.isPrimary !== false`: later fingers in a multi-touch never enter
3. `event.button === 0`: right-click and middle-click never drag
4. The press did not land inside an interactive element (see "Interactive elements are exempt automatically")

### Interactive elements are exempt automatically

If the press lands on any of these selectors, the gesture never starts:

```text
a, button, input, textarea, select, option, summary,
[contenteditable="true"], [data-cineview-ignore-drag]
```

Add `data-cineview-ignore-drag` to an interactive region to prevent it from starting scene navigation. This is useful for sliders, draggable canvases, and custom controls.

A Scene's custom `onPointerDown` runs with the framework handler. Calling `event.preventDefault()` in it suppresses the framework gesture.

## The direction check: tap versus drag

Before a drag starts, movement must satisfy:

```text
|mainAxisDelta| >= 1 && |mainAxisDelta| > |crossAxisDelta|
```

Movement below one pixel or dominated by the other axis does not start a drag. A rejected direction remains rejected for that press until the pointer crosses its starting position and attempts the opposite direction.

## How drag distance becomes element time

`unit` and `scale` decide how gesture displacement advances the element timeline:

| `unit`             | Default `scale` | Conversion                                                       |
| ------------------ | --------------- | ---------------------------------------------------------------- |
| `'time'` (default) | `10`            | Each 1% dragged advances `scale` milliseconds                    |
| `'percent'`        | `1`             | Each 1% dragged advances `scale` percent of the element timeline |

With the default `time + 10`, a full-screen drag advances 1000 ms of element time. That covers about 15% of a 6.5-second entrance; the remaining animation continues after the change is committed. With `unit: 'percent'` and `scale: 1`, dragging 50% advances the timeline to 50%.

`Scene.drag` configures `unit` and `scale` as a pair. Providing one field resets the omitted field to its framework default. For example, a root setting of `percent + 0.5` and a Scene setting of only `scale: 2` produce `time + 2`.

An unsupported `unit` resets the mapping to `time` with its default scale. An unsupported `scale` keeps the unit and resets only the scale. Both report `INVALID_DRAG_CONFIG`.

## drag.enabled applies to the target scene

`Scene.drag.enabled` defaults to `true` and applies to the target Scene.

Setting `enabled: false` on Scene 3 prevents adjacent scenes from dragging into it. Navigation away from Scene 3 and programmatic navigation remain available. `onDragBlocked` fires at most once per attempted direction in a press.

## Related pages

- [Drag scene layout](/docs/01-layout): size defaults and container styles
- [Starting and resuming a drag](/docs/04-ownership): starting and resuming a gesture
- [Drag callback timing](/docs/05-callbacks): which callbacks fire, and when
- [Cineview](/docs/01-cineview): the full drag-mode props table
