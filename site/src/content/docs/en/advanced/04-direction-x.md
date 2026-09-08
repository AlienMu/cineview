---
title: "Horizontal direction: 'x'"
eyebrow: ADVANCED / HORIZONTAL AXIS
---

Set `direction="x"` on CineView for horizontal navigation in either mode. The default is `'y'`.

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

Drag reads horizontal displacement and velocity, then moves scenes horizontally. Gesture progress is measured against the executing window's width.

Scroll uses `scrollLeft`, horizontal touch movement, and wheel `deltaX`. Scene scroll ranges and fixed layers use the horizontal span. The custom scrollbar appears along the bottom with `aria-orientation="horizontal"`.

The responsive scale base remains unchanged: `scale = viewportWidth / designWidth` is calculated strictly against viewport width on both axes. `'x'` changes the travel axis without altering the scaling reference.

## Caveats

- Wheel input reads `deltaX` only. Standard vertical mouse wheels dispatch `deltaY` and do not produce movement in `'x'` mode; Shift+wheel and trackpad horizontal gestures dispatch `deltaX` to drive the page.
- Drag keyboard navigation uses ArrowLeft/ArrowRight. Scroll uses ArrowUp/ArrowDown on its main axis. PageUp/PageDown, Home, and End apply in both modes.
- In drag mode, Scene layout does not rotate with the axis; scenes continue to fill 100% of the container in both dimensions, altering only the progression axis of the scene stack.
