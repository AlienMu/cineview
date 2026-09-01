---
title: "Horizontal direction: 'x'"
eyebrow: ADVANCED / HORIZONTAL AXIS
---

`direction: 'x'` runs both engines on the horizontal axis. Configured as a root prop on `CineView`, it applies to both drag and scroll modes and defaults to `'y'`.

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

Every axis decision in the runtime reads the same resolved `direction`; there is no separate horizontal mode to configure.

Drag input reads `info.offset.x` and `info.velocity.x`, measuring progress against `window.innerWidth`; scene changes apply `translate3d(x%, 0, 0)` instead of `translate3d(0, y%, 0)`.

Scroll input consumes `deltaX` on wheel and horizontal touch displacement, laying the root container out with `overflow-x: scroll; overflow-y: hidden`. Locked-zone scenes expand horizontally, writing the compiled zone span into `layout.width`, alongside `min-width: 100vw` and a sticky left edge for screen-sized scenes. Viewport-span bookkeeping (snapshots, budgets, anti-skip segments) measures against `viewport.width`, and nested-scrollable deferral checks `overflow-x` and `scrollLeft` on the active axis. The scrollbar overlay renders a horizontal rail along the bottom edge with `aria-orientation="horizontal"`, mapping thumb drag coordinates from `clientX` to `scrollLeft`.

The responsive scale base remains unchanged: `scale = viewportWidth / designWidth` is calculated strictly against viewport width on both axes. `'x'` changes the travel axis without altering the scaling reference.

## Caveats

- Wheel input reads `deltaX` only. Standard vertical mouse wheels dispatch `deltaY` and do not produce movement in `'x'` mode; Shift+wheel and trackpad horizontal gestures dispatch `deltaX` to drive the page.
- Keyboard navigation aligns with the configured axis rather than key names: ArrowDown and PageDown advance forward along `'x'`, while ArrowUp and PageUp navigate backward.
- In drag mode, Scene layout does not rotate with the axis; scenes continue to fill 100% of the container in both dimensions, altering only the progression axis of the scene stack.
