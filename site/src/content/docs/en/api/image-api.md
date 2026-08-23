---
title: Image
eyebrow: API REFERENCE
---

`<Image>` uses the CineView preload pipeline without blocking ordinary content visibility. This page is the complete field reference; usage lives in the [Image guide](/docs/image).

## Props

Every field and default below is checked against `ImageProps` in `src/components/Image/Image.tsx` and the Image implementation. `Image` also accepts the remaining native `<img>` attributes (`Omit<ImgHTMLAttributes, 'src' | 'alt' | 'width' | 'height' | 'style'>`).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `src` | `string` | `required` | Image URL. |
| `alt` | `string` | `required` | Accessible alternative text. |
| `width` | `number \| string` | — | Width. Numbers are design px converted through the single-ruler `convert`; strings pass through unchanged. |
| `height` | `number \| string` | — | Height, same rule. |
| `style` | `React.CSSProperties` | — | Extra styles; lengths are converted via `convertStyle`. |
| `preload` | `boolean` | `true` | Whether to register the URL with the framework preload pipeline (sharing the same cache as `useImagePreloader`); forced off when `loading='lazy'`. With the native `loading` attribute omitted it is derived from `preload`: `eager` when preloading, otherwise `lazy`. |

## Preload semantics

`preload` (default `true`) registers the URL in the shared preload cache: the **same cache** (`useImagePreloader`) used by `Scene.assets.preloadImages` and the root `CineView` `preload()`, so nothing downloads twice:

- **Priority queue**: images declared via `Scene.assets.preloadImages` (the drag-active scene's or the scroll first scene's) go into the priority queue; once settled they fire the `priorityComplete` cold-start gate (which `onReady` waits for).
- **Background queue**: URLs registered by `Image preload` and the remaining assets do not gate the cold start.
- **`loading` derivation**: with the native `loading` omitted it is derived from `preload`: `preload: true` → `eager`, `preload: false` → `lazy`; an explicit `loading='lazy'` forces `preload` off.

```tsx
<Scene assets={{ preloadImages: ['/hero.webp'] }}>
  {/* Priority: declared on Scene.assets, gates the cold start */}
  <Image src="/hero.webp" alt="Opening frame" preload />
</Scene>

{/* Background: registered in the same cache, does not gate onReady */}
<Image src="/diagram.png" alt="Architecture" />
```

## Constraints and common misuse

- **Do not declare first-screen priority via `Image`'s `preload`.** Priority-queue membership is decided by `Scene.assets.preloadImages`; `Image preload` only puts the URL in the shared cache. For a first-screen hero image, write both (declare the priority on `Scene.assets`, consume the cache on `Image`).
- **Numeric sizes are design px.** `width={375}` is the draft measurement, not rendered pixels; the strings `'375px'` / `'50%'` pass through unconverted.
- **Visibility is not blocked by preloading.** The `<img>` renders on mount; the pipeline manages the network and cache hits, not the visibility of ordinary content, so orchestrate "show when loaded" with `Animate`'s visibility / timeline semantics.

## Related pages

- The full preload pipeline and the cold-start gate → [preload deep-dive](/docs/preload)
- The ordering of `onLoadProgress` / `onReady` → [CineView API](/docs/cineview-api)
- The media tutorial → [Image guide](/docs/image)
