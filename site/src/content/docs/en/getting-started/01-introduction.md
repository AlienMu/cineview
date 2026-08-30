---
title: Introduction
eyebrow: GETTING STARTED / INTRODUCTION
---

CineView is a React framework for cinematic full-screen narrative pages. You declare scenes, animations, and a design width; the framework handles transitions, timelines, and responsive scaling.

## Two modes

CineView has two engines, picked by the `mode` prop on the root component:

- **drag**: swipe pagination. One gesture flips one screen; each screen is one narrative beat.
- **scroll**: real document-flow scrolling. The page scrolls normally. Inside a scene with a locked zone, scrolling drives a timeline that scrubs with scroll (center-lock).

Both modes share the same Scene / Animate / Position components. Their timeline semantics differ, and state is not shared across modes. See [Modes](/docs/01-modes) and [Choosing a mode](/docs/04-choosing-mode).

## Three core concepts

**One px2vw conversion base.** The site has a single conversion base: `designWidth`, the design width, default 750. Every coordinate and box-model length converts through `scale = viewportWidth / size`. Width only, never height, so content never distorts. See [Responsive](/docs/05-responsive).

**Scenes and timelines.** `Scene` is the chapter boundary. `Animate` consumes the current mode's timeline semantics. In drag, switching scenes defaults to `transitionDuration: 800` ms.

**1ms = 1px.** A locked zone budgets its time as real scroll distance: one millisecond of `duration` is one pixel the user scrolls. Scrolling back through the segment moves progress from 100% to 0% with no jumps. See [Center-lock](/docs/01-centerlock).

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

`designWidth: 750` declares the design width. `Scene` marks one chapter, and `Animate` plays a preset entrance for its content. In drag mode you swipe between the two screens.

## Next steps

- [Installation](/docs/02-installation): packages, peer dependencies, per-mode entries.
- [Quickstart](/docs/03-quickstart): a complete minimal scene with per-prop explanation.
- [Choosing a mode](/docs/04-choosing-mode): drag or scroll, decided by one table.
