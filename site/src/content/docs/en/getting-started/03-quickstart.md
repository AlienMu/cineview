---
title: Quick start
eyebrow: GETTING STARTED / QUICKSTART
---

After [installation](/docs/02-installation), use either example as your application's `App.tsx`. Both use text and basic animations, with no image or video assets.

`Cineview` selects the interaction mode, `Scene` divides the content, and `Animate` defines how an element appears. Try both modes, then change their durations and order in the code.

## Drag between scenes

Drag upward in the example. The panel shows drag distance, the second scene's element time, and what happens if you pause before releasing. Pause at 20% and release to restore the page. Pause past 30% and release to change scenes. Drag down from the second scene to return.

<!-- preview:drag -->

```tsx
import { Animate, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="drag" unit="percent" scale={1}>
      <Scene sceneId="intro" style={{ background: '#f5e8d8', padding: 40 }}>
        <h1>Drag up to the next scene</h1>
      </Scene>
      <Scene sceneId="details" style={{ background: '#e8edf0', padding: 40 }}>
        <Animate animateId="title" enterAnimation="fade-in"
          duration={{ enter: 600 }} timeline={{ delay: 100 }}>
          <h2>The title appears first</h2>
        </Animate>
        <Animate enterAnimation="slide-up" duration={{ enter: 400 }}
          timeline={{ after: 'title', delay: 100 }}>
          <p>The detail follows the title.</p>
        </Animate>
      </Scene>
    </Cineview>
  );
}
```

The target title starts at 100ms and runs for 600ms. The detail uses `after: 'title'` with another 100ms delay, so it starts at 800ms and runs for 400ms. Total duration is 1200ms.

`unit="percent" scale={1}` maps drag distance to that timeline's percentage. At half distance, element time is 600ms: the title is still entering and the detail has not started. A committed release continues unfinished animation from this point; cancellation restores it.

A fast release reduces the distance needed to change scenes, while a fast reversal cancels. See [Gestures and thresholds](/docs/02-gestures) for the complete decision rules.

## Advance animations by scrolling

The first and last scenes contain ordinary page content; the middle scene declares `scroll`. The first title fades in over time even without scrolling. The middle animations follow scroll position: stop to hold the frame, or scroll up to reverse.

<!-- preview:scroll -->

```tsx
import { Animate, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="scroll">
      <Scene sceneId="intro" layout={{ height: '100vh' }}
        style={{ background: '#f5e8d8', padding: 40 }}>
        <Animate enterAnimation="fade-in" duration={{ enter: 1400 }}
          timeline={{ driver: 'clock' }}>
          <h1>The title fades in without scrolling</h1>
        </Animate>
      </Scene>
      <Scene sceneId="details" scroll={{}}
        layout={{ height: '100vh' }} style={{ background: '#e8edf0', padding: 40 }}>
        <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
          <h2>Keep scrolling to reveal the title</h2>
        </Animate>
        <Animate enterAnimation="slide-up" duration={{ enter: 400 }}
          timeline={{ after: 'title', delay: 100 }}>
          <p>Scroll farther to reveal the detail.</p>
        </Animate>
      </Scene>
      <Scene sceneId="outro" layout={{ height: '100vh' }}
        style={{ background: '#f5e8d8', padding: 40 }}>
        <h2>Keep reading</h2>
      </Scene>
    </Cineview>
  );
}
```

`scroll={{}}` creates a locked zone using the Scene's identifier. The title takes 600px of scrolling, followed by a 100px delay and the detail's 400px entrance: 1100px in total. One millisecond corresponds to one pixel of real scroll distance.

`driver: 'clock'` makes the first title play independently over time. It can be omitted in an ordinary Scene; writing it explicitly distinguishes the two playback behaviors. Clock animations do not add to the locked zone's scroll distance.

## Continue learning

- [Modes and animation progress](/docs/01-modes): how dragging, scrolling, and time advance the same animation.
- [Animation composition and sequencing](/docs/04-orchestration): arrange elements through `after` dependencies.
- [Control video with drag and scroll](/docs/11-video-timeline): add video in an advanced example.
- [Cineview reference](/docs/01-cineview): look up configuration and event notifications.
