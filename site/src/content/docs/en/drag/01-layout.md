---
title: Drag layout contract
eyebrow: DRAG / LAYOUT
---

In drag mode every scene is a viewport-filling card container that the engine positions absolutely and slides by whole screens. That establishes predetermined layout constraints, and leaves some of the scroll-mode props inert.

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

None of these have a corresponding prop:

| Where            | Style                                                     | Consequence                                                               |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| Root container   | `height: 100vh; min-height: 100vh`                        | The page is always one screen tall                                        |
| Root container   | `overflow-x: hidden; overflow-y: hidden`                  | The root never scrolls                                                    |
| Root container   | `background: '#0d1624'`                                   | The dark backdrop cannot be changed; scroll uses `#ffffff`                |
| Each scene frame | `position: absolute; inset: 0; width: 100%; height: 100%` | Scenes are positioned inside a full-screen cell                           |
| Each scene frame | `z-index: 10` (current) / `1` (others)                    | Cross-scene layering is managed by the engine                             |
| Scene itself     | `contain: 'layout style'`                                 | Establishes a stacking context, see [DOM contract](/docs/06-dom-contract) |

`CineView` accepts neither `className` nor `style`. The available styling seams are the `.cineview-container` class, the `[data-cineview-container="true"]` attribute selector, and the `--cineview-unit` CSS variable published on the outermost wrapper div.

A scene's `layout.width` / `layout.height` land on the Scene element, but the Scene sits inside that `inset: 0` full-screen cell. So a sub-viewport scene is "placed somewhere within a full-screen cell": the declaration sizes the visible card, not the paging step.

## Only the current scene and its two neighbors render

The virtualization window is `current ± 1`, and scenes outside it are not mounted. Three consequences:

- Effects in distant scenes do not run. Subscriptions, timers, and videos inside `useEffect` do not exist at all.
- Returning to a scene more than one step away is a remount: component state resets, the animation registry rebuilds, and the element timeline restarts at 0.
- Scenes are keyed by array index. Conditionally rendering or reordering scenes maps instance identity onto position rather than onto the element.

## Props that are ignored

**`transition.enterAnimation` and `transition.exitAnimation` do nothing in drag**, with a one-time development warning. Scene-level transitions are a scroll concept: drag page movement follows the finger directly, and element animation belongs to child `Animate` components.

`transition.exitDuration` from the same group still applies, though: it feeds the resolved scene transition duration, and that duration is the numerator of the exit scrub (`renderProgress × sceneTransitionDuration`); the divisor is the element's own `duration.exit`. Raising `exitDuration` makes the exit scrub run faster, not slower.

**`stack.mode` has no effect in drag.** Only the scroll engine consumes it; in drag it takes part in no computation. `stack.zIndex` lands on the Scene element, but cross-scene layering is decided by the scene frame listed under "Engine-level fixed styles."

**In drag, `scrollbar` only injects CSS that hides the native scrollbar; no rail is rendered.** The custom scrollbar overlay mounts in scroll mode only, so `width`, `radius`, `trackColor`, `thumbColor`, `autoHide`, and `ariaLabel` are all inert here. Omitting the `scrollbar` prop entirely injects nothing at all.

The scroll-only root fields (`zoneTrigger`, `sceneSizing`, `enterMargin`, `exitMargin`) are not merely inert on a drag root: the type excludes them, so writing one fails type-checking. `firstSceneTimeout` is drag-only in the same way, and the scroll cold-start gate is fixed at 3000 ms regardless. See [Preloading](/docs/02-preload).

## Related pages

- [Gestures and thresholds](/docs/02-gestures): input checks, the threshold formula, mapping units
- [Page movement and element time](/docs/03-two-track): how the two quantities divide the work
- [DOM and layout contract](/docs/06-dom-contract): the real DOM tree and the z-index host
- [Scene](/docs/02-scene): the full `layout` / `transition` tables
