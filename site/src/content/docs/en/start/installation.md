---
title: Installation
eyebrow: INSTALL
---

Install CineView alongside React and Framer Motion.

## Package install

CineView declares React and Framer Motion as peer dependencies. Keep one copy of each runtime in the application bundle.

```bash
pnpm add cineview framer-motion
# React 18 or React 19
```

## Import the public surface

The root package exports the components, public ref types, and the zero-render timeline hook.

```tsx
import {
  Animate,
  CineView,
  Container,
  Image,
  Position,
  Scene,
  useAnimateTimeline,
} from 'cineview';
```
