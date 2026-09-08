---
title: Introduction
eyebrow: GETTING STARTED / INTRODUCTION
---

CineView is a React library for full-screen scene transitions and animations driven by drag or scroll input. Declare scenes, animation timing, and the design width; CineView handles navigation and scales numeric design lengths to the viewport.

## Two modes

Select the interaction with the root component's `mode` prop:

- **drag**: full-screen paging through pointer gestures, keyboard navigation, or ref methods.
- **scroll**: content moves in a native scroll container. A scene with a locked zone stays in place while scrolling advances its animations.

Both modes share the same Scene / Animate / Position components. Their timeline semantics differ, and state is not shared across modes. See [Modes](/docs/01-modes) and [Choosing a mode](/docs/04-choosing-mode).

## Core concepts

**Responsive lengths.** Set `designWidth` to the design's width (default 750). Numeric design lengths use `scale = viewportWidth / designWidth` on both axes. See [Responsive conversion](/docs/05-responsive).

**Scenes and timelines.** `Scene` groups content with shared layout and transition behavior. `Animate` sets an element's animation and timing. In drag mode, page movement can finish before its elements finish entering.

**1ms = 1px.** Inside a locked zone, one millisecond of authored animation duration corresponds to one pixel of scroll distance. Reverse scrolling moves the animation back through the same range. See [Center-lock](/docs/01-centerlock).

## Two-scene example

```tsx
import { CineView, Scene, Animate } from 'cineview';

export default function App() {
  return (
    <CineView designWidth={750} mode="drag">
      <Scene sceneId="hero">
        <Animate enterAnimation="fade-in" duration={{ enter: 800 }}>
          <h1>Act one</h1>
        </Animate>
      </Scene>
      <Scene sceneId="closing">
        <Animate enterAnimation="slide-up" duration={{ enter: 800 }}>
          <h1>Curtain</h1>
        </Animate>
      </Scene>
    </CineView>
  );
}
```

`designWidth={750}` sets the design width. Each `Scene` contains a title with a preset entrance animation. A drag gesture or keyboard navigation moves between the two scenes.

## Next steps

- [Installation](/docs/02-installation): packages, peer dependencies, and per-mode entry points.
- [Quickstart](/docs/03-quickstart): a two-scene example with positioning and ordered animations.
- [Selecting a mode](/docs/04-choosing-mode): compare drag and scroll behavior.
