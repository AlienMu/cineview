---
title: Animate
eyebrow: TIMELINE CONSUMER
---

Animate consumes the current mode semantics and composes delay, waitFor, phase, visibility, and stagger.

## Current timeline API

sceneControlled defaults to true. Inside a scroll takeover zone it binds to the zone; elsewhere it gracefully falls back to visibility. Set false to force visibility.

```tsx
<Animate
  animateId="subtitle"
  enterAnimation="slide-up"
  exitAnimation="fade-out"
  duration={{ enter: 800, exit: 400 }}
  timeline={{ delay: 160, waitFor: 'title' }}
  visibility={{ replayOnReenter: true }}
>
  <p>Chapter copy</p>
</Animate>
```
