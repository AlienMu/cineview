---
title: Drag layout contract
eyebrow: DRAG / LAYOUT
---

Drag scenes occupy full-screen navigation positions. Scene dimensions can be smaller than the viewport, but they do not change the distance between page positions.

## Scene size defaults

| Field             | drag default | scroll default | Notes                              |
| ----------------- | ------------ | -------------- | ---------------------------------- |
| `layout.width`    | `'100vw'`    | `'100vw'`      | Same in both modes                 |
| `layout.height`   | `'100vh'`    | `'auto'`       | The one default that forks by mode |
| `layout.anchor`   | `'top-left'` | `'top-left'`   | Nine-grid anchor                   |
| `layout.overflow` | `'hidden'`   | `'hidden'`     | Overflowing content is clipped     |

The `height` row is where the same JSX encounters layout differences across modes: a drag scene defaults to full viewport height, while a scroll scene takes its height from content. Porting a drag page to scroll collapses scenes that relied on `100vh`.

Nine-grid anchors resolve to absolute positioning in drag (`top`/`left`/`right`/`bottom`, with a `translate` added on centered axes). In scroll the nine values collapse to three horizontal margin pairs and the vertical half is dropped entirely, see [Scene](/docs/02-scene).

## Engine-level fixed styles

These styles are supplied by the engine:

| Where            | Style                                                     | Consequence                                                               |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| Root container   | `height: 100vh; min-height: 100vh`                        | The page is always one screen tall                                        |
| Root container   | `overflow-x: hidden; overflow-y: hidden`                  | The root never scrolls                                                    |
| Root container   | `background: '#0d1624'`                                   | Default inline background; scroll defaults to white                       |
| Each scene frame | `position: absolute; inset: 0; width: 100%; height: 100%` | Scenes are positioned inside a full-screen cell                           |
| Each scene frame | `z-index: 10` (current) / `1` (others)                    | Cross-scene layering is managed by the engine                             |
| Scene itself     | `contain: 'layout style'`                                 | Establishes a stacking context, see [DOM contract](/docs/06-dom-contract) |

CineView has no `className` or `style` prop. External CSS can target `.cineview-container` or `[data-cineview-container="true"]`; use `!important` when overriding an inline background. `--cineview-unit` provides responsive lengths for authored CSS.

`Scene.layout.width` and `height` size the Scene's content area within its full-screen navigation position.

## Only the current scene and its two neighbors render

The current Scene and its immediate neighbors stay mounted. Scenes farther away unmount, so returning recreates their local state, effects, and animations. Store state that must survive navigation outside CineView.

Scene identity follows array position. Reordering or conditionally inserting scenes can change which instance occupies a position.

## Props that are ignored

**`transition.enterAnimation` and `transition.exitAnimation` do nothing in drag**, with a one-time development warning. Scene-level transitions are a scroll concept: drag page movement follows the finger directly, and element animation belongs to child `Animate` components.

`transition.exitDuration` still affects the scaling of child exit progress in drag. At the same page position, a larger value advances an element farther through its exit animation.

`layout.overlap` does not change drag behavior. `layout.zIndex` orders content within a scene frame; the engine controls ordering between frames.

The custom scrollbar overlay is available only in scroll mode. In drag, a `scrollbar` object only injects native-scrollbar hiding styles; its width and color options have no visible overlay to style.

TypeScript excludes scroll-only root fields in drag, including `zoneTrigger`, `sceneSizing`, `enterMargin`, `exitMargin`, and `debug`. `firstSceneTimeout` is drag-only; scroll uses a 3000ms initial resource wait. See [Preloading](/docs/02-preload).

## Related pages

- [Gestures and thresholds](/docs/02-gestures): input checks, the threshold formula, mapping units
- [Page movement and element time](/docs/03-two-track): how the two quantities divide the work
- [DOM and layout contract](/docs/06-dom-contract): the real DOM hierarchy and the z-index host
- [Scene](/docs/02-scene): the full `layout` / `transition` tables
