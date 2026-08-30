---
title: Scene-scoped fixed layer
eyebrow: SCROLL / FIXED LAYER
---

In scroll mode, pinning an element (toolbar, scroll hint, watermark) means one rule: never write raw `position: fixed` inside a Scene, because it cannot work. Pass `fixed` to `Position` instead, and the node is portaled into that scene's own fixed layer.

## Why raw fixed cannot work

CSS rule: as soon as an ancestor has a non-`none` `transform`, `position: fixed` positions against that ancestor rather than the viewport. In scroll mode every Scene container **always carries `transform: translateZ(0)`** (a compositing hint, not a conditional one), so every fixed element in a Scene subtree is confined to it. Locked-zone scenes are stricter still: their content layer adds another unconditional transform.

"Cannot" is not rhetoric: this is not an edge case in certain configurations. Under scroll there is no authoring choice that makes a raw fixed element position against the viewport. There is no error and no warning; the only way to find it is by observing the rendered result. If the symptom matches, stop debugging your own CSS.

## The three layers

The `fixed` prop on `Position` is not implemented with `position: fixed`. It is three divs and arithmetic:

| Layer | data attribute                  | Size                                                         | Role                                                         |
| ----- | ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| clip  | `data-scene-fixed-role="clip"`  | spans the whole scene scroll range + `overflow: hidden`      | boundary: the layer hides when the scene leaves the viewport |
| frame | `data-scene-fixed-role="frame"` | one viewport (main axis), slides inside clip by `hostOffset` | the visual pin                                               |
| host  | `data-scene-fixed-role="host"`  | fills frame                                                  | the portal target                                            |

`hostOffset` is `clamp(viewport offset - sceneStart, 0, scene span - frame span)`. The frame uses `absolute` plus that computed offset to shift inside clip in lockstep with scrolling, and the visual result is an element stuck to the screen. Everything runs on `absolute`, `position: fixed` is never used, and so the transform rule never touches it.

That structure decides two things, neither of them configurable:

- **Scoping is inherent.** The clip's size _is_ this scene's scroll range, `overflow: hidden` cuts anything beyond it, and the whole layer goes `visibility: hidden` when the scene leaves the viewport. Visibility, clipping, and teardown all follow the scene boundary.
- **Persisting across scenes is structurally impossible.** "Pin one element across several scenes" is not a capability, because the host itself sits inside one scene's clip. Each scene that needs a pin declares its own, and a genuinely global pin (site nav and the like) belongs outside `<CineView>`.

The first render is one frame of exception: the host element reaches state through a ref callback, so on that frame the portal target is still null and `Position` falls back to `position: sticky`. Every frame after that portals normally.

## Interaction

All three divs have `pointerEvents: 'none'`. An empty host that captured the pointer covers every interactive child in the scene, so the whole chain stays transparent to input. Interaction is restored only on the portaled `Position` node: a `Position` with `fixed` defaults to `pointerEvents: 'auto'` (an explicit value in its `style` wins).

The pin itself is clickable; the rest of the fixed layer is fully transparent to the pointer.

## Usage

```tsx
<Scene sceneId="hero" scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}>
  {/* regular content scrolls with the document flow */}
  <Position at={{ x: 40, y: 200 }}>
    <h1>Title</h1>
  </Position>

  {/* pinned, scoped to this scene */}
  <Position at={{ anchor: 'center-x', y: 600 }} fixed>
    <div>Scroll to continue</div>
  </Position>
</Scene>
```

The `at` coordinate semantics do not change: still design px through the same conversion base, only the frame of reference is now the fixed-layer host.

## In drag it is a silent no-op

Drag mode has no fixed-layer host and no sticky fallback. Under drag, the **only** residual effect of `fixed` is forcing `pointerEvents` to `'auto'`; layout still runs on `position: absolute`, identical to not passing the prop. Drag scenes do not scroll, so the visual difference is usually invisible, but be clear that this is not "pinning also works in drag," it is "this prop does almost nothing in drag."

Moving the same JSX between modes produces neither an error nor a warning here.

## Related pages

- [Position API](/docs/05-position): the full prop table for `at` and `fixed`
- [center-lock scroll takeover](/docs/01-centerlock): how the scene scroll range is computed
- [DOM and layout contract](/docs/06-dom-contract): which authored styles the framework overrides
- [Scroll troubleshooting](/docs/06-scroll-pitfalls): other causes behind the same symptoms
