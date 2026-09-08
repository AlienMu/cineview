---
title: Performance
eyebrow: ADVANCED / PERFORMANCE
---

Use MotionValues for continuously changing visuals, and inspect the browser when a page drops frames. CineView's monitor provides a page-level sample of frame timing.

## Runtime monitor

Enable `monitor` and read the result through the CineView ref:

```tsx
import { useRef } from 'react';
import { CineView, Scene, type CineViewRef } from 'cineview';

export default function Demo() {
  const ref = useRef<CineViewRef>(null);
  return (
    <>
      <button onClick={() => console.table(ref.current?.getPerformanceMetrics())}>
        Log metrics
      </button>
      <CineView monitor ref={ref}>
        <Scene sceneId="example">
          <h1>Example</h1>
        </Scene>
      </CineView>
    </>
  );
}
```

Reading metrics does not require `monitor`, but frame samples are collected only while at least one instance enables it. Before any samples exist, frame values are zero. Stopping the monitor retains its last samples.

## Metric fields

| Field          | Meaning                                                                           |
| -------------- | --------------------------------------------------------------------------------- |
| `fps`          | Estimated from average frame time, capped at 60 and rounded to one decimal        |
| `avgFrameTime` | Mean of up to 60 recent frame intervals, in ms                                    |
| `memoryUsage`  | JavaScript heap in MB, the median of up to eight samples; absent when unsupported |
| `bundleSize`   | Code and CSS resource sizes reported for the whole page, in KB                    |

The FPS cap does not reveal whether a high-refresh display is fully used. An average can hide individual stalls; use browser performance traces or a `PerformanceObserver` to inspect those.

`bundleSize` includes application code and dependencies. It is sampled when monitoring starts and can be retried while zero. Use build output to measure CineView itself.

## Shared page readings

All CineView instances share the page monitor. The first monitored instance starts sampling; the last one to release monitoring stops it.

Two instances therefore return the same readings. The data does not attribute rendering cost to a particular Scene or CineView.

## Initial resource wait

The first Scene waits for its declared priority resource requests to settle. To include a video, add its URL to `Scene.assets.preloadImages`; a video's own `preload` only fills the shared cache.

The default wait limit is 3000ms. Drag can configure `firstSceneTimeout`; scroll uses 3000ms. A timeout reports `FIRST_SCENE_TIMEOUT` and shows the first Scene at its completed state unless the application calls `preventDefault?.()`. See [Preloading](/docs/02-preload).

## Keep progress in MotionValues

Bind MotionValues to motion styles. Use `useTransform` for direct mappings from progress, such as position or opacity.

Render-prop children receive ordinary numbers by rerendering their content. Use that form when JSX needs the changing value. It does not avoid React rendering.

An added `useSpring` changes timing and can lag behind drag or scroll input. Derive visuals directly when they need to match progress.

## Read changing values

A one-time `.get()` during render does not subscribe React to later changes.

Use [useAnimateTimeline](/docs/09-use-animate-timeline) for MotionValue bindings and subscriptions. Its `frame` groups progress, phase, and source from one update. Use `onZoneProgress` when observing the whole locked zone.

## Callback cost

| Callback                             | Frequency                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `Scene.callbacks.onVisibilityChange` | Can run on each scroll frame                                              |
| `onZoneProgress`                     | Changes over 0.5px from the last report, plus initial and endpoint values |

Keep work in these callbacks small. Filter repeated visibility values or sample progress when only occasional updates are needed. React state updates and layout reads still have their normal cost inside a callback.

The zone threshold accumulates against the last reported value, so slow movements eventually produce a notification.

## Video seeking and memory

Dense video keyframes can reduce random and reverse seek work. Development builds warn when sampled median seek latency exceeds 50ms; inspect both the asset and device workload when this occurs.

For scroll locked zones, `releaseOnLeave` can release decoded frames after a video is far away and restore them on return. See [Media playback](/docs/06-media-ownership).

## Bundle size

ES module (ESM) applications use `cineview`, which includes both engines and selects one through `mode`.

CommonJS applications can use a mode subpath. Separate Universal Module Definition (UMD) files are also available for script loading with supplied peer runtimes. See [Installation](/docs/02-installation).
