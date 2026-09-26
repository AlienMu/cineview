---
title: Scene-scoped fixed layer
eyebrow: SCROLL / FIXED LAYER
---

Use `Position fixed` for an action bar, indicator, or other element that stays aligned to the screen while its Scene is visible.

## Keep an element aligned with the screen

Add `fixed` to a `Position` inside the Scene. It stays aligned with the screen while that Scene is in view, then leaves with the Scene. Put navigation that must remain across multiple Scenes outside Cineview.

## Example

```tsx
import { Animate, Cineview, Position, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="scroll" designWidth={750}>
      <Scene sceneId="hero" layout={{ height: '100vh' }} scroll={{ zoneId: 'hero-seq' }}>
        <Animate enterAnimation="fade-in" duration={{ enter: 800 }} timeline={{ driver: 'scene' }}>
          <h1>Title</h1>
        </Animate>
        <Position at={{ anchor: 'center' }} fixed>
          <div>Scroll to continue</div>
        </Position>
      </Scene>
      <Scene sceneId="next" layout={{ height: '100vh' }}><h2>Next scene</h2></Scene>
    </Cineview>
  );
}
```

The animation gives the locked zone 800px of scroll distance. The indicator stays centered on screen through that distance and disappears after the Scene leaves. Fixed elements are clipped to their Scene's visible area. A numeric `at.y` scales with `designWidth`; a large design coordinate can place an element outside the screen.

## Why native fixed positioning differs

Scroll Scenes use a transform. This makes a native `position: fixed` child align to the transformed Scene instead of the browser viewport. `Position fixed` uses a Scene-owned layer to keep the element screen-aligned. Its empty area does not intercept pointer input; the positioned element can receive input.

## Behavior in drag mode

In drag mode, `fixed` positions the element inside its Scene with `position: absolute`. Drag Scenes do not use the scroll fixed layer.

## Related pages

- [Position API](/docs/05-position): the full prop table for `at` and `fixed`
- [Center-lock scrolling](/docs/01-centerlock): scroll ranges and locking mechanisms
- [DOM and layout contract](/docs/06-dom-contract): which authored styles the framework overrides
- [Scroll troubleshooting](/docs/06-scroll-pitfalls): other causes behind the same symptoms
