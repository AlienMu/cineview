---
title: "Horizontal direction: 'x'"
eyebrow: ADVANCED / HORIZONTAL AXIS
---

`direction: 'x'` runs either engine on the horizontal axis. It is a per-root switch (`direction` for drag, `direction` for scroll) and defaults to `'y'`.

## Usage

```tsx
<CineView mode="drag" designWidth={750} direction="x">
  <Scene sceneId="reel-01">...</Scene>
  <Scene sceneId="reel-02">...</Scene>
</CineView>
```

```tsx
<CineView mode="scroll" designWidth={1440} direction="x">
  <Scene sceneId="panorama" scroll={{ zoneId: 'panorama', trigger: 'center-lock' }}>
    ...
  </Scene>
</CineView>
```

## What switches with the axis

Every axis decision in the runtime reads the same resolved `direction`; there is no second horizontal mode to opt into.

Drag input reads `info.offset.x` / `info.velocity.x` and measures progress against `window.innerWidth`; scene changes move with `translate3d(x%, 0, 0)` instead of `translate3d(0, y%, 0)`.

Scroll input consumes `deltaX` on wheel and horizontal touch displacement, and lays the root out with `overflow-x: scroll; overflow-y: hidden`; locked-zone scenes grow in width, with the compiled zone span written into `layout.width`, plus `min-width: 100vw` and a sticky left edge for screen-sized scenes. Viewport-span bookkeeping (snapshots, budgets, anti-skip segments) uses `viewport.width`, and nested-scrollable deferral checks `overflow-x` / `scrollLeft` on the same axis. The scrollbar overlay renders a horizontal rail along the bottom edge with `aria-orientation="horizontal"`, and thumb drags map `clientX` to `scrollLeft`.

The conversion base is untouched: `scale = viewportWidth / size` stays width-only on both axes. `'x'` changes the travel axis, never the base.

## Caveats

- Wheel input reads `deltaX` only. A plain vertical mouse wheel produces `deltaY` and does nothing in `'x'` mode; Shift+wheel and trackpad horizontal swipes produce `deltaX` and drive the page.
- Keyboard paging follows the configured axis, not the key name: ArrowDown and PageDown move forward along `'x'`, ArrowUp and PageUp move backward.
- In drag mode, Scene layouts do not rotate with the axis; scenes still fill 100% of the container in both dimensions, and only the travel direction of the stack changes.
