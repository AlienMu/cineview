---
title: Scene-scoped fixed layer
eyebrow: SCROLL / FIXED LAYER
---

Use `Position fixed` for an action bar, indicator, or other element that stays aligned to the screen while its Scene is visible.

## Layer stacking and containing block constraints

In scroll mode, a Scene's transform makes it the containing block for native `position: fixed` descendants. Use the framework's fixed layer when alignment needs to follow the viewport.

## Fixed layer architecture

The `fixed` prop on `Position` operates through a three-layer DOM structure:

| Layer | data attribute                  | Size                                                       | Role                                                       |
| ----- | ------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| clip  | `data-scene-fixed-role="clip"`  | spans the whole scene scroll range with `overflow: hidden` | boundary: hides the layer when the scene leaves the screen |
| frame | `data-scene-fixed-role="frame"` | occupies one viewport span, slides inside clip by offset   | maintains fixed visual alignment                           |
| host  | `data-scene-fixed-role="host"`  | fills frame                                                | the portal target                                          |

The frame offset computes as `clamp(viewport offset - sceneStart, 0, scene span - frame span)`. The frame uses `position: absolute` with this offset to track scroll position, achieving screen-relative visual pinning without triggering transform containing block restrictions.

The fixed layer is visible only within its Scene's scroll range. Put navigation or other UI that must remain across scene changes outside CineView.

## Pointer event handling

Outer wrapper elements enforce `pointerEvents: 'none'` to prevent intercepting pointer input over underlying content. Portaled `Position` nodes default to `pointerEvents: 'auto'` (unless overridden in `style`), allowing fixed elements to receive interactions while empty regions remain transparent to clicks.

## Usage

```tsx
<Scene sceneId="hero" scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}>
  {/* Content belonging to this Scene */}
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
