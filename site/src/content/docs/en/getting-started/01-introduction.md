---
title: Introduction
eyebrow: GETTING STARTED / INTRODUCTION
---

CineView is a React animation framework for cinematic full-screen narrative experiences. Declare scenes, animation specifications, and a design width baseline; the engine manages transitions, timeline scheduling, and single-axis responsive scaling.

## Two modes

CineView has two engines, picked by the `mode` prop on the root component:

- **drag**: swipe pagination. One gesture flips one screen; each screen is one narrative beat.
- **scroll**: real document-flow scrolling. The page scrolls normally. Inside a scene with a locked zone, scrolling drives a timeline that scrubs with scroll (center-lock).

Both modes share the same Scene / Animate / Position components. Their timeline semantics differ, and state is not shared across modes. See [Modes](/docs/01-modes) and [Choosing a mode](/docs/04-choosing-mode).

## Three core concepts

**px2vw single-axis responsive baseline.** The system relies on a single viewport scaling baseline: `designWidth` (default 750). Coordinates and box-model dimensions scale via `scale = viewportWidth / designWidth`. Scaling derives strictly from viewport width to maintain consistent proportions across display sizes. See [Responsive](/docs/05-responsive).

**Scenes and timelines.** `Scene` is the chapter boundary. `Animate` consumes the current mode's timeline semantics. In drag, switching scenes defaults to `transitionDuration: 800` ms.

**1ms = 1px.** A locked zone budgets duration directly as physical scroll distance: one millisecond of `duration` corresponds to one pixel of scroll travel. Scrolling back through the segment reduces progress from 100% to 0% continuously without jumps. See [Center-lock](/docs/01-centerlock).

## A 30-second example

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

`designWidth: 750` declares the design width baseline. `Scene` defines a chapter boundary, and `Animate` coordinates preset entrance transitions for its content. In drag mode, swipe gestures transition between the two screens.

## Next steps

- [Installation](/docs/02-installation): packages, peer dependencies, and per-mode entry points.
- [Quickstart](/docs/03-quickstart): a minimal standalone scene with key property breakdowns.
- [Choosing a mode](/docs/04-choosing-mode): architectural trade-offs and decision matrix.
