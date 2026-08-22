---
title: Image
eyebrow: MEDIA
---

Image uses the CineView preload pipeline without blocking ordinary content visibility.

## Priority media

Declare first-screen media on Scene.assets or Image priority. Later resources stay in the background queue.

```tsx
<Scene assets={{ preloadImages: ['/hero.webp'] }}>
  <Image src="/hero.webp" alt="Opening frame" priority />
</Scene>
```
