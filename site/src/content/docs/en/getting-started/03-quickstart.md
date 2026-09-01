---
title: Quickstart
eyebrow: GETTING STARTED / QUICKSTART
---

A minimal standalone application setup: two scenes and four core components (CineView / Scene / Animate / Position), paging in drag mode.

## Complete example

```tsx
import { CineView, Scene, Animate, Position } from 'cineview';

export default function App() {
  return (
    <CineView
      designWidth={750}
      mode="drag"
      direction="y"
      transitionDuration={800}
      scrollbar={{ enabled: true, width: 6, autoHide: true }}
    >
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

- `designWidth={750}`: design width baseline (750px). All Position coordinates and box-model dimensions scale via `scale = viewportWidth / 750`. Defaults to 750 when omitted.
- `mode="drag"`: enables the swipe-pagination engine (default, specified here for clarity).
- `direction: 'y'`: vertical swipe gestures. Use `'x'` for horizontal.
- `transitionDuration: 800`: **affects programmatic navigation only** (`ref.goToScene()`). Gesture page movement and rebound timing remain fixed at 800ms inside the engine.
- `scrollbar={{ enabled: true, width: 6, autoHide: true }}`: injects a 6px scrollbar that hides when idle. Pass `scrollbar={false}` to turn it off entirely.
- `sceneId`: the scene's unique identifier, used by callbacks and `ref.preload` for targeting.
- `layout.anchor: 'top-center'`: placement within the 3x3 layout alignment grid. `overflow: 'hidden'` clips overflowing content.
- `at={{ x: 60, y: 200 }}`: design-px coordinates, converted through `designWidth`.
- `animateId` / `timeline.after: 'title'`: the subtitle plays after `title` finishes entering. A `timeline.after` pointing at a missing `animateId` raises `INVALID_ANIMATION`; a dependency cycle raises `CIRCULAR_DEPENDENCY`.
- `duration={{ enter: 800 }}`: 800ms entrance.

## Switching to scroll mode

Preserve the same component structure and make two adjustments: set `mode` to `"scroll"`, and add `scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}` to the designated scene. The page connects to the native document flow; ordinary sections scroll naturally, while locked zones drive their timelines directly through scrolling (1ms=1px). See [Choosing a mode](/docs/04-choosing-mode) and [Center-lock](/docs/01-centerlock).

## Next steps

- [CineView reference](/docs/01-cineview): all root props and ref methods.
- [Scene reference](/docs/02-scene): full tables for layout / stack / transition / assets.
- [Animate reference](/docs/03-animate): timeline inference, enterRef/exitRef, stagger.
