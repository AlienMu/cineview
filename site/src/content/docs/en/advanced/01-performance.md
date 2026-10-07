---
title: Performance
eyebrow: ADVANCED / PERFORMANCE
---

Use MotionValues for continuously changing visuals, and inspect the browser when a page drops frames. Cineview's monitor provides a page-level sample of frame timing.

## Runtime monitor

Set `monitor` to collect frame metrics. To show them on the page, render `PerfPanel` from `cineview/dev` and import its stylesheet. In scroll mode, `debug` adds layout diagnostics to the DOM; it does not start sampling or display a panel.

Enable `monitor` and read the result through the Cineview ref:

```tsx
import { useState } from 'react';
import { Cineview, Scene, type CineviewRef } from 'cineview';
import { PerfPanel } from 'cineview/dev';
import 'cineview/dev/style.css';

export default function Demo() {
  const [source, setSource] = useState<CineviewRef | null>(null);
  return (
    <>
      <Cineview monitor callbacks={{ onReady: setSource }}>
        <Scene sceneId="example">
          <h1>Example</h1>
        </Scene>
      </Cineview>
      <PerfPanel source={source} />
    </>
  );
}
```

For a custom display, call `source?.getPerformanceMetrics()` or use `usePerfMonitor` from `cineview/dev`. Reading metrics does not require active sampling. Frame samples are collected while at least one instance enables `monitor`. Before any samples exist, frame values are zero. Stopping the monitor retains its last samples.

## Metric fields

| Field          | Meaning                                                                           |
| -------------- | --------------------------------------------------------------------------------- |
| `fps`          | Estimated from average frame time, capped at 60 and rounded to one decimal        |
| `avgFrameTime` | Mean of up to 60 recent frame intervals, in ms                                    |
| `memoryUsage`  | JavaScript heap in MB, the median of up to eight samples; absent when unsupported |
| `bundleSize`   | Code and CSS resource sizes reported for the whole page, in KB                    |

The FPS cap does not reveal whether a high-refresh display is fully used. An average can hide individual stalls; use browser performance traces or a `PerformanceObserver` to inspect those.

`bundleSize` includes application code and dependencies. It is sampled when monitoring starts and can be retried while zero. Use build output to measure Cineview itself.

## Shared page readings

All Cineview instances share the page monitor. The first monitored instance starts sampling; the last one to release monitoring stops it.

Two instances therefore return the same readings. The data does not attribute rendering cost to a particular Scene or Cineview.

## Check mobile dragging

Record the production page while dragging forward, reversing, and releasing between Scenes. Include the first visit to each Scene and a return visit: mounting content and decoding media can produce different costs. Keep the viewport, device pixel ratio, assets, and input sequence the same when comparing changes.

Inspect the longest frame intervals and tasks over 50ms alongside the average frame rate. A short pause during a scene change can be noticeable even when most frames take about 16.7ms. Browser traces help distinguish script execution, layout, painting, and media work.

CPU throttling helps expose expensive work, but desktop emulation does not reproduce a phone's GPU, memory limits, or browser. Confirm the affected interaction on the target device after measuring locally.

When a custom Canvas keeps drawing after its Scene is inactive, stop its animation frame loop using the timeline phase. Measure its size when the container changes, then draw from stored dimensions. Avoid measuring layout in progress callbacks or in observers that run for every animated text change.

A transparent Canvas can still run its drawing loop. Check frames after its exit animation becomes invisible, including when a gesture stops before the Scene leaves. Resume drawing if the gesture reverses and makes the content visible again.

Keep `minWidth` unset for a page that should shrink on phones. A large minimum preserves the wider layout and can increase the size of drawing surfaces. See [Responsive layout](/docs/05-responsive).

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

Dense keyframes do not eliminate the cost of repeated positioning. Compare `currentTime` writes with `seeked` events and presented frames during slow and reverse gestures. Many requested times can fall within the same source frame. A browser recording is needed to determine whether repeated requests delay the displayed picture.

Video blob cache sizes describe compressed downloads. They do not include decoded frames or GPU textures; JavaScript heap readings also omit those allocations.

For scroll locked zones, `releaseOnLeave` can release decoded frames after a video is far away and restore them on return. See [Media playback](/docs/06-media-ownership).

## Bundle size

ES module (ESM) applications use `cineview`, which includes both engines and selects one through `mode`.

CommonJS applications can use a mode subpath. Separate Universal Module Definition (UMD) files are also available for script loading with supplied peer runtimes. See [Installation](/docs/02-installation).
