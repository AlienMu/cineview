---
title: Scene-scoped fixed layer
eyebrow: SCROLL / FIXED LAYER
---

In scroll mode, elements requiring fixed screen alignment (such as action bars, scroll indicators, or watermarks) use the `fixed` prop on `Position`. The node is mounted via a React Portal into the scene's dedicated fixed layer.

## Layer stacking and containing block constraints

Under CSS specification rules, any ancestor with a non-`none` `transform` property redefines the containing block for `position: fixed` from the viewport to that ancestor. In scroll mode, each Scene container carries `transform: translateZ(0)` for hardware layer promotion, constraining direct native fixed elements within Scene boundaries.

## Fixed layer architecture

The `fixed` prop on `Position` operates through a three-layer DOM structure:

| Layer | data attribute                  | Size                                                       | Role                                                       |
| ----- | ------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| clip  | `data-scene-fixed-role="clip"`  | spans the whole scene scroll range with `overflow: hidden` | boundary: hides the layer when the scene leaves the screen |
| frame | `data-scene-fixed-role="frame"` | occupies one viewport span, slides inside clip by offset   | maintains fixed visual alignment                           |
| host  | `data-scene-fixed-role="host"`  | fills frame                                                | the portal target                                          |

The frame offset computes as `clamp(viewport offset - sceneStart, 0, scene span - frame span)`. The frame uses `position: absolute` with this offset to track scroll position, achieving screen-relative visual pinning without triggering transform containing block restrictions.

Key characteristics:

- **Scene-scoped lifecycle**: The clip matches the active scene's scroll range, transitioning to `visibility: hidden` when the scene exits the display.
- **Cross-scene elements reside externally**: Fixed layers are hosted within individual scenes; mount global persistent elements (such as site navigation bars) outside `<CineView>`.

## Pointer event handling

Outer wrapper elements enforce `pointerEvents: 'none'` to prevent intercepting pointer input over underlying content. Portaled `Position` nodes default to `pointerEvents: 'auto'` (unless overridden in `style`), allowing fixed elements to receive interactions while empty regions remain transparent to clicks.

## Usage

```tsx
<Scene sceneId="hero" scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}>
  {/* Regular content scrolls with document flow */}
  <Position at={{ x: 40, y: 200 }}>
    <h1>Title</h1>
  </Position>

  {/* Pinned element, scoped to this scene */}
  <Position at={{ anchor: 'center-x', y: 600 }} fixed>
    <div>Scroll to continue</div>
  </Position>
</Scene>
```

`at` coordinates continue to represent design-space pixels scaled through the responsive model, referencing the fixed-layer host as their coordinate origin.

## Behavior in drag mode

In drag mode, scenes do not establish fixed layer hosts. The `fixed` prop applies `pointerEvents: 'auto'`, with elements positioned using standard `position: absolute` within the scene.

## Related pages

- [Position API](/docs/05-position): the full prop table for `at` and `fixed`
- [Center-lock scrolling](/docs/01-centerlock): scroll ranges and locking mechanisms
- [DOM and layout contract](/docs/06-dom-contract): which authored styles the framework overrides
- [Scroll troubleshooting](/docs/06-scroll-pitfalls): other causes behind the same symptoms
