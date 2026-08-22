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
