---
title: Image
eyebrow: MEDIA
---

Image uses the CineView preload pipeline without blocking ordinary content visibility.

## Priority media

Declare first-screen media on Scene.assets or Image preload. Later resources stay in the background queue.

```tsx
<Scene assets={{ preloadImages: ['/hero.webp'] }}>
  <Image src="/hero.webp" alt="Opening frame" preload />
</Scene>
```

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
