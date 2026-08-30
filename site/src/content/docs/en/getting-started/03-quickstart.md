---
title: Quickstart
eyebrow: GETTING STARTED / QUICKSTART
---

A minimal app you can copy verbatim: two scenes, four components (CineView / Scene / Animate / Position), paging in drag mode.

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

## The props, line by line

- `designWidth={750}`: design width of 750px. This is the single conversion base for the whole page: every Position coordinate and box-model length converts through `scale = viewportWidth / 750`. Omit it and you get 750 anyway.
- `mode="drag"`: use the swipe-pagination engine. `'drag'` is the default; spelled out here for clarity.
- `direction: 'y'`: vertical swipe gestures. Use `'x'` for horizontal.
- `transitionDuration: 800`: **affects programmatic navigation only** (`ref.goToScene()`), i.e. its settle timing. Gesture paging runs at a fixed 800ms that this prop cannot change.
- `scrollbar={{ enabled: true, width: 6, autoHide: true }}`: injects a 6px scrollbar that hides when idle. Pass `scrollbar={false}` to turn it off entirely.
- `sceneId`: the scene's unique id, used by callbacks and `ref.preload` for addressing.
- `layout.anchor: 'top-center'`: where the scene's content block sits on the 3×3 anchor grid. `overflow: 'hidden'` clips overflowing content.
- `at={{ x: 60, y: 200 }}`: design-px coordinates, converted through `designWidth`.
- `animateId` / `timeline.after: 'title'`: the subtitle plays after `title` finishes entering. A after pointing at a missing animateId raises `INVALID_ANIMATION`; a cycle raises `CIRCULAR_DEPENDENCY`.
- `duration={{ enter: 800 }}`: 800ms entrance.

## Switching to scroll mode

Keep the same tree and make two edits: set `mode` to `"scroll"`, and add `scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}` to the scene you want as a locked zone. The page becomes a real document flow. Ordinary content scrolls normally; inside the locked zone, scrolling drives the timeline (1ms=1px). See [Choosing a mode](/docs/04-choosing-mode) and [Center-lock](/docs/01-centerlock).

## Next steps

- [CineView reference](/docs/01-cineview): all root props and ref methods.
- [Scene reference](/docs/02-scene): full tables for layout / stack / transition / assets.
- [Animate reference](/docs/03-animate): timeline inference, enterRef/exitRef, stagger.
