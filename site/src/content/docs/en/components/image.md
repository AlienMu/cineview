---
title: Image
eyebrow: MEDIA
---

Image uses the CineView preload pipeline without blocking ordinary content visibility.

## When to use

- Images should go through the framework preload cache (the same one as `Scene.assets` and the root `preload()`), instead of running a second track alongside the browser's native loading.
- You want an `<img>` whose numeric design-px sizes convert through the single ruler.
- Ordinary content images — first-screen priority is still declared on `Scene.assets.preloadImages`; Image only consumes the cache.

## Priority media

Declare first-screen media on Scene.assets or Image preload. Later resources stay in the background queue.

```tsx
<Scene assets={{ preloadImages: ['/hero.webp'] }}>
  <Image src="/hero.webp" alt="Opening frame" preload />
</Scene>
```

Queue membership is adjudicated like this: images declared on `Scene.assets.preloadImages` enter the **first-screen priority queue** (the drag-active scene / the scroll first scene), and once settled they fire the `priorityComplete` cold-start gate — which `onReady` waits for; `Image preload` (default `true`) merely registers the URL in the same shared cache (the **background queue**) and does not gate the cold start. For a first-screen hero image, write both: declare the priority on Scene, consume the cache on Image.

The component renders the `<img>` on mount — the pipeline manages the network and cache hits, not visibility; orchestrate "show when loaded" with `Animate`'s visibility/timeline semantics.

## Common misuse

- **Declaring first-screen priority via `Image preload`** — membership is decided by `Scene.assets`; `preload` only registers the cache.
- **Explicit `loading='lazy'` while expecting `preload` to work** — the former forces the latter off.
- **Writing numeric sizes as rendered pixels** — `width={375}` is the draft measurement converted through the single ruler; strings do not convert.

---

For the complete field reference and preload semantics see the [Image API](/docs/image-api).
