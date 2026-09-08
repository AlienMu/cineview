---
title: Quickstart
eyebrow: GETTING STARTED / QUICKSTART
---

This example uses two scenes with drag navigation. Position places the titles, and `timeline.after` starts the subtitle after the main title.

## Complete example

```tsx
import { CineView, Scene, Animate, Position } from 'cineview';

export default function App() {
  return (
    <CineView designWidth={750} mode="drag" direction="y" transitionDuration={800}>
      <Scene
        sceneId="hero"
        layout={{ width: '100%', height: '100vh', anchor: 'top-center', overflow: 'hidden' }}
      >
        <Position at={{ x: 60, y: 200 }}>
          <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 800 }}>
            <h1>Act one</h1>
          </Animate>
        </Position>
        <Position at={{ x: 60, y: 320 }}>
          <Animate
            animateId="subtitle"
            enterAnimation="slide-up"
            duration={{ enter: 600 }}
            timeline={{ after: 'title' }}
          >
            <p>A subtitle that follows the title in</p>
          </Animate>
        </Position>
      </Scene>
      <Scene
        sceneId="closing"
        layout={{ width: '100%', height: '100vh', anchor: 'top-center', overflow: 'hidden' }}
      >
        <Position at={{ x: 60, y: 200 }}>
          <Animate animateId="end-title" enterAnimation="fade-in" duration={{ enter: 800 }}>
            <h1>Curtain</h1>
          </Animate>
        </Position>
      </Scene>
    </CineView>
  );
}
```

## Key property reference

- `designWidth={750}`: numeric design lengths scale by `viewportWidth / 750`. The default design width is 750.
- `mode="drag"`: enables drag navigation, the default mode.
- `direction="y"`: vertical gestures. Use `"x"` for horizontal gestures.
- `transitionDuration={800}`: configures programmatic navigation with `ref.goToScene()`. Gesture timing uses the framework's separate timing rules.
- `sceneId`: identifies a scene for `ref.preload()` and provides a fallback locked-zone identifier.
- `layout.anchor: 'top-center'`: aligns the scene content. `overflow: 'hidden'` clips content outside its bounds.
- `at={{ x: 60, y: 200 }}`: design-px coordinates, converted through `designWidth`.
- `animateId` / `timeline.after: 'title'`: the subtitle begins after `title` enters. A missing target reports `INVALID_ANIMATION`; a cycle reports `CIRCULAR_DEPENDENCY`.
- `duration={{ enter: 800 }}`: 800ms entrance.

## Switching to scroll mode

Set `mode="scroll"`, remove the drag-only `transitionDuration` prop, and add `scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}` to the target scene. Its animations then follow scroll distance at `1ms = 1px`. Add `scrollbar={{}}` to display the optional scrollbar in scroll mode. See [Selecting a mode](/docs/04-choosing-mode) and [Center-lock](/docs/01-centerlock).

## Next steps

- [CineView reference](/docs/01-cineview): all root props and ref methods.
- [Scene reference](/docs/02-scene): layout, transitions, and assets.
- [Animate reference](/docs/03-animate): timeline inference, enterRef/exitRef, stagger.
