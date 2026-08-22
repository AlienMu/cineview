---
title: Performance
eyebrow: FRAME BUDGET
---

Keep per-frame work on MotionValues and keep layout reads outside continuous scroll frames.

## Authoring checklist

Use Animate for authored transforms, use useAnimateTimeline for custom renderers, avoid measuring layout in a progress callback, and profile concurrent multi-element scenes before release.

## Verification commands

The repository gates coverage, type safety, duplication, package consumption, build size, and browser profile budgets.

```bash
pnpm verify
pnpm --dir site type-check
pnpm --dir site build
pnpm --dir examples/performance-test test
```

## All-keyframe video encoding

Videos scrubbed by AnimateVideo must be encoded all-keyframe (the same hard constraint as the README's Video Scrubbing section). With sparse keyframes, every seek decodes a long run of frames from the nearest keyframe, saturates the decode thread, and drops frames during scrubbing.

```bash
ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4
```

The dev build measures seek latency per source and warns once when the median exceeds 50ms, so a mis-encoded video identifies itself during development.

## Concurrent observation

Unit tests cannot catch hot-path regressions. The acceptance probe drives six seconds of continuous input on both paths — wheel through the scroll homepage, real pointer drag cycles on the drag page — while sampling rAF frame gaps and longtasks in-page. The passing bars:

- rAF frame-gap P95 under 25ms across the drive
- gaps above 25ms under 10% of frames
- longtasks (over 50ms) at most 2, baseline 0
- console errors and warnings: 0

rAF gaps reflect the main thread, not the GPU pipeline — headless probes catch JS-side regressions (per-frame setState, long tasks), not raster cost.

## MotionValue discipline

Quantities that change every frame — progress, elapsed time, offsets — belong on MotionValue; React state is for structural changes only. Two hard-won specifics:

- An independent lane cannot drive properties already owned by Animate's style MotionValues (`opacity`, `x`, `y`, `scale`, `rotate`, `filter`, ...): the MotionValue binding outranks `controls.start()`, and the competing writes are silently ignored. Animate a CSS custom property instead and map it in plain CSS.
- Reading progress in a callback is fine; writing it into state is not. Project through refs, or consume `useAnimateTimeline()` MotionValues directly in a custom renderer.

