# CineView Two-Mode Performance Example

This example replaces the old generator-driven performance playground with one authored product narrative shown through two independent CineView modes:

- `#/drag`
- `#/scroll`

The hub route at `#/` introduces the shared story and links into each mode page.

## What this example is for

The example is designed to compare how the same high-end product showcase behaves across two navigation engines without falling back to synthetic placeholder scenes.

- `drag` emphasizes weighted release-and-settle progression with bespoke chapter staging
- `scroll` uses real document reading blocks with local `Scene.scroll` takeover chapters

Both modes reuse the same authored `Orbit S1` section data, local media assets, and performance instrumentation.

## Structure

- `src/content/performanceExperience.ts`
  Shared authored content model for the product story.
- `src/pages/ExperienceHub.tsx`
  Landing hub for the two mode studies.
- `src/pages/DragModePage.tsx`
  Drag-first product walkthrough with weighted premium staging.
- `src/pages/ScrollModePage.tsx`
  Scroll-driven long-form layout with ordinary reading sections plus authored `Scene.scroll` takeovers.
- `src/components/PerformanceMonitor.tsx`
  Hideable runtime metrics panel.

## Commands

```bash
cd examples/performance-test
pnpm install
pnpm dev
pnpm test
pnpm build
```

## Route map

- `#/` hub
- `#/drag` drag mode page
- `#/scroll` scroll mode page

## Validation focus

When reviewing the example, pay attention to:

- whether the two pages clearly feel different while sharing the same content
- whether the monitor stays secondary until explicitly opened
- whether transitions stay stable while chapter media is preloaded
- whether scroll reads like a real document before handing control to local `Scene.scroll` takeovers
- whether drag feels deliberate and premium instead of playful or bouncy
- whether the experience still reads like a real product surface rather than a testing harness
