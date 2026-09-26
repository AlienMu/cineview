---
title: Drag scene layout
eyebrow: DRAG / LAYOUT
---

In drag mode, each Scene's navigation height is fixed at one viewport (`100vh`). There is no per-Scene navigation-height option. `Scene.layout.height` cannot change that height or the distance between Scenes. Content inside the Scene can be sized separately.

Drag up to move the current Scene out as the next one enters. Hold halfway to see both Scenes on screen. Release to complete the change or return to the first Scene. Try the transition in [Quick start](/docs/03-quickstart).

The example shows drag distance and the result of pausing before release. Try 20%, pause, and release to restore the page. Then drag past 30%, pause, and release to change Scenes. A fast release can commit between 15% and 30%; a fast reversal cancels. Drag down from the second page to return. The title moves and fades in while a square rotates and scales. The time readout shows their shared progress.

## Hold between two Scenes

The same gesture moves the Scenes and advances elements inside the target Scene. This example declares only two `Scene` components: Cineview moves them, while `Animate` sets when the second Scene's title and detail appear.

```tsx
import { Animate, Cineview, Scene } from 'cineview';

export function DragTransitionExample() {
  return (
    <Cineview mode="drag" direction="y" designWidth={750} unit="percent" scale={1}>
      <Scene sceneId="intro">
        <section style={{ minHeight: '100vh', background: '#f5e8d8' }}>
          <h1>Drag up to the next Scene</h1>
        </section>
      </Scene>
      <Scene sceneId="details">
        <section style={{ minHeight: '100vh', background: '#172626', color: '#fff' }}>
          <Animate
            animateId="title"
            enterAnimation={{ initial: { opacity: 0, y: 45 }, animate: { opacity: 1, y: 0 } }}
            duration={{ enter: 600 }}
            timeline={{ delay: 100 }}
          >
            <h1>The title appears first</h1>
          </Animate>
          <Animate
            enterAnimation={{ initial: { opacity: 0, x: 35 }, animate: { opacity: 1, x: 0 } }}
            duration={{ enter: 400 }}
            timeline={{ after: 'title', delay: 100 }}
          >
            <p>The detail follows the title.</p>
          </Animate>
        </section>
      </Scene>
    </Cineview>
  );
}
```

Halfway through the gesture, the current and target Scenes each occupy part of the screen. Their adjacent positions create this transition; there is no separate split-screen setting.

The target Scene's element timeline lasts 1200ms. The title starts at 100ms and runs for 600ms. The detail waits for the title and another 100ms, then starts at 800ms. `unit="percent"` and `scale={1}` map drag distance to that timeline's percentage. At half distance, element time is about 600ms: the title is still fading in, and the detail has not started. If release commits the Scene change, unfinished animation continues. If the change is canceled, the target Scene returns to its initial frame.

`Scene.layout` controls the size and alignment of content inside a Scene. The transition between Scenes still uses full-screen navigation frames.

## Scene size defaults

| Field             | drag default | scroll default | Notes                                           |
| ----------------- | ------------ | -------------- | ----------------------------------------------- |
| `layout.width`    | `'100vw'`    | `'100vw'`      | Same in both modes                              |
| `layout.height`   | `'100vh'`    | `'auto'`       | Full viewport in drag, content height in scroll |
| `layout.anchor`   | `'top-left'` | `'top-left'`   | Content alignment                               |
| `layout.overflow` | `'hidden'`   | `'hidden'`     | Clips content outside the Scene                 |

Each navigation frame has a fixed height of `100vh`; `layout.height` cannot turn it into a half-screen or long page. That field affects only the Scene's inner content box and does not create native vertical scrolling. Keep the Scene at its default size and set dimensions on content inside it:

```tsx
import { Cineview, Scene } from 'cineview';

export function DragContentLayout() {
  return (
    <Cineview mode="drag">
      <Scene sceneId="compact">
        <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
          <section style={{ height: '60vh' }}>
            <h1>Short content inside the Scene</h1>
          </section>
        </div>
      </Scene>
      <Scene sceneId="next">
        <h1>Next scene</h1>
      </Scene>
    </Cineview>
  );
}
```

For long content that needs native vertical scrolling, use scroll mode. For a full-screen sequence, divide the content into more Scenes. A numeric `layout.height` is CSS px and does not scale with `designWidth`.

`layout.overflow` defaults to `hidden`. Images, videos, and animations that extend beyond the Scene dimensions are clipped.

Drag supports nine alignment positions, including center and bottom alignment. Scroll uses only their left, center, and right horizontal alignment. See [Scene](/docs/02-scene) for all options.

## Container and Scene styles

The framework supplies these styles:

| Where            | Style                                                     | Effect                                        |
| ---------------- | --------------------------------------------------------- | --------------------------------------------- |
| Root container   | `height: 100vh; min-height: 100vh`                        | The page is one screen tall                   |
| Root container   | `overflow-x: hidden; overflow-y: hidden`                  | The root does not scroll                      |
| Root container   | `background: '#0d1624'`                                   | Default background color                      |
| Each scene frame | `position: absolute; inset: 0; width: 100%; height: 100%` | Provides the full-screen navigation position  |
| Each scene frame | `z-index: 10` (current) / `1` (others)                    | The current Scene appears above its neighbors |
| Scene itself     | `contain: 'layout style'`                                 | Establishes a stacking context                |

To style the root container, target `.cineview-container` or `[data-cineview-container="true"]` in CSS. Cineview accepts neither `className` nor `style`.

Overriding the inline background requires `!important`. Use `--cineview-unit` for responsive lengths in custom CSS. See [DOM and layout contract](/docs/06-dom-contract) for element stacking.

## The current Scene and its neighbors stay mounted

The current Scene and its immediate neighbors stay mounted. Scenes farther away unmount, so returning recreates their local state, effects, and animations. Store state that must survive navigation outside Cineview.

Navigation order follows Scene declaration order. Use stable React `key` values for a dynamic list; reordering still changes navigation indexes.

## Configure page movement and element animation separately

Page movement follows the drag gesture. Use child `Animate` components for title and image effects, and `AnimateVideo` for video scrubbing. See [Page movement and element time](/docs/03-two-track).

`Scene.transition.enterAnimation` and `exitAnimation` apply only in scroll mode. Configuring them in drag produces a development warning.

`transition.exitDuration` still affects child exit progress. At the same page position, a larger value advances an element farther through its exit animation.

`layout.overlap` does not change drag behavior. `layout.zIndex` orders content within a scene frame; the framework controls ordering between frames.

The custom scrollbar appears only in scroll mode. In drag, a `scrollbar` object only hides the native scrollbar; width and color options have no visible effect.

`sceneSizing`, `enterMargin`, and `exitMargin` are scroll-only root fields. TypeScript rejects them in drag. `debug` only exposes layout diagnostics in scroll mode; use `monitor` and `PerfPanel` for performance readings.

`firstSceneTimeout` limits the wait for first-screen priority resources. See [Preloading](/docs/02-preload) for resource declarations, failure handling, and video loading.

## Related pages

- [Gestures and thresholds](/docs/02-gestures): input checks and drag-distance conversion
- [Page movement and element time](/docs/03-two-track): how dragging advances animation and video
- [DOM and layout contract](/docs/06-dom-contract): element stacking and style restrictions
- [Scene](/docs/02-scene): layout and transition options
