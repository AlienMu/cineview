---
title: Image
eyebrow: COMPONENTS / IMAGE
---

Image is an `<img>` wired into the framework preload cache: `src` / `alt` are required, and numeric width/height are design px converted against the single conversion base. It never blocks the visibility of ordinary content.

## Props

| prop               | Type                                                  | Default | Notes                                                                                                        |
| ------------------ | ----------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `src`              | string                                                | none    | Required                                                                                                     |
| `alt`              | string                                                | none    | Required                                                                                                     |
| `width` / `height` | `number \| string`                                    | none    | Number = design px, converted against the conversion base; strings pass through untouched                    |
| `style`            | CSSProperties                                         | none    | Numeric length values (padding/margin/borderRadius/fontSize…) are converted against the same conversion base |
| `preload`          | boolean                                               | true    | Registers the URL into the shared preload cache on mount                                                     |
| `loading`          | `'eager' \| 'lazy'`                                   | none    | Explicit `'lazy'` force-disables `preload`                                                                   |
| rest               | ImgHTMLAttributes (except src/alt/width/height/style) | none    | Passed through to the `<img>`                                                                                |

forwardRef points at the `<img>` element.

## Conversion behavior

`width={375}` is a design-size value, rendered as `375 × scale`; `scale = viewportWidth / designWidth` (default 750). String values (`'50%'`, `'12rem'`) are not converted and pass through as-is. Numeric lengths inside `style` use exactly the same conversion logic as [Container](/docs/07-container).

## Preload semantics

- When `preload` is on, mounting registers `src` into the framework's shared preload cache; the same cache written by `Scene.assets.preloadImages` and the root ref's `preload()`; the same URL never loads twice.
- The cache is background warming only and **does not declare first-screen priority**: membership in the first-screen priority queue is decided by `Scene.assets.preloadImages`, which feeds the `priorityComplete` cold-start gate. `Image`'s `preload` does not participate.
- Loading strategy follows along: with `preload` on, `loading` defaults to `'eager'`, otherwise `'lazy'`; if you explicitly set `loading='lazy'`, `preload` is off.
- The `<img>` renders on mount. Preloading covers network and cache hits, not visibility gating; for "show when loaded" timeline, use the visibility/timeline semantics of [Animate](/docs/03-animate).

The full cold-start gate and priority queue semantics live in [Preloading](/docs/02-preload).

## Common mistakes

- **Declaring first-screen priority through `preload`**: membership belongs to `Scene.assets`. A first-screen hero image needs both sides: priority declared on the Scene, cache consumed on the Image.
- **Setting `loading='lazy'` and still expecting `preload` to work**: the former force-disables the latter.
- **Reading numeric dimensions as rendered pixels**: `width={375}` is design px and gets converted; use a string if you don't want conversion.
