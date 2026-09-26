---
title: DOM and layout contract
eyebrow: CONCEPTS / DOM
---

Use this page when a selector misses a Scene, content is clipped, or a positioned element moves with the wrong part of the page.

## Where styles attach

Cineview renders a responsive wrapper around its mode container. Drag mode adds frames for scene navigation; scroll mode adds wrappers for scrolling and locked zones. Each `Scene` still renders its own element inside those wrappers.

A selector that assumes `Scene` is the immediate DOM child of `.cineview-container` can miss it. Target a class on the Scene, or use `[data-scene-index]` when the outer scene wrapper is the intended target.

## Scale custom CSS

The responsive wrapper provides `--cineview-unit`, the current CSS length of one design pixel. Use it when custom CSS needs to follow `designWidth`:

```css
.my-panel {
  padding: calc(24 * var(--cineview-unit));
  border-radius: calc(12 * var(--cineview-unit));
}
```

The value follows viewport width in both modes. Scroll distance in a locked zone still uses 1px per 1ms of authored duration.

## Declare Scenes directly

Cineview discovers `Scene` elements one level below it. An array of Scenes works, but a Fragment or a component that returns a Scene hides the nested element. If no Scene is found, `onError` receives `EMPTY_SCENES`.

```tsx
import { Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="drag" designWidth={750}>
      <Scene sceneId="intro"><h1>Introduction</h1></Scene>
      <Scene sceneId="details"><h2>Details</h2></Scene>
    </Cineview>
  );
}
```

Keep a stable React `key` on each Scene when rendering an array whose order can change.

## Scene styles and clipping

A Scene's `style` can set ordinary visual properties. Cineview controls its dimensions, position, overflow, transform, and pointer behavior needed for drag or scroll. Use Scene layout props for sizing and overflow; see [Drag layout](/docs/01-layout) and [Scene](/docs/02-scene).

A Scene contains its own stacking context. Increasing a child's `z-index` cannot place it above a sibling Scene. To order elements inside one Scene, set `style.zIndex` on sibling `Position` components.

## Fixed elements in scroll mode

A transformed Scene changes the reference for native `position: fixed`. Use `Position fixed` for an element that stays aligned with the screen while its Scene is visible. Put UI that must persist across Scenes outside Cineview. See [Fixed elements](/docs/04-fixed-layer).

## Useful selectors

| Selector | What it identifies |
| --- | --- |
| `[data-cineview-container]` | Mode container |
| `[data-scene-index]` | Outer wrapper for one Scene |
| `[data-cineview-takeover-shell]` | Sticky wrapper of a locked zone |
| `[data-scene-fixed-layer]` | Scene-owned fixed layer |
| `[data-cineview-animate-id]` | Element applying Animate styles |

`[data-cineview-scroll-zone]` can also appear on an ordinary Scene, so it does not by itself prove that a locked zone is active. For styling an Animate across remounts, set its `animateId` explicitly.

## Related pages

- [Runtime states](/docs/07-runtime-states): when Scene pointer input is disabled
- [Fixed elements](/docs/04-fixed-layer): screen-aligned elements within a Scene
- [Responsive conversion](/docs/05-responsive): how `designWidth` changes design lengths
- [Drag layout](/docs/01-layout): sizing and overflow in drag mode
