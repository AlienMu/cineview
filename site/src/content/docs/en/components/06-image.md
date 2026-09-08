---
title: Image
eyebrow: COMPONENTS / IMAGE
---

Image renders an `<img>` and records loaded images in the framework cache. `src` and `alt` are required. Numeric dimensions use design pixels; loading does not delay the mounting of ordinary content.

## Props

| prop               | Type                                                  | Default                            | Notes                                                                                                        |
| ------------------ | ----------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src`              | string                                                | none                               | Required                                                                                                     |
| `alt`              | string                                                | none                               | Required                                                                                                     |
| `width` / `height` | `number \| string`                                    | none                               | Number = design px, converted against the conversion base; strings pass through untouched                    |
| `style`            | CSSProperties                                         | none                               | Numeric length values (padding/margin/borderRadius/fontSize…) are converted against the same conversion base |
| `preload`          | boolean                                               | true                               | Registers the URL into the shared preload cache on mount                                                     |
| `loading`          | `'eager' \| 'lazy'`                                   | Eager with preload, otherwise lazy | Explicit `'lazy'` disables preload                                                                           |
| rest               | ImgHTMLAttributes (except src/alt/width/height/style) | none                               | Passed through to the `<img>`                                                                                |

The forwarded `ref` points to the `<img>` element.

## Conversion behavior

`width={375}` is a design-size value, rendered as `375 × scale`; `scale = viewportWidth / designWidth` (default 750). String values (`'50%'`, `'12rem'`) are not converted and pass through as-is. Numeric lengths inside `style` use exactly the same conversion logic as [Container](/docs/07-container).

## Preload semantics

- With `preload`, the component loads the image and records completion in the shared cache. Later preload requests can reuse that completed result; concurrent mounts can create separate image loaders.
- Image's `preload` does not declare first-screen priority. Use `Scene.assets.preloadImages` for resources that the initial entrance must wait for.
- Loading defaults to `'eager'` with preload and `'lazy'` without it. An explicit `loading='lazy'` disables preload.
- The `<img>` mounts immediately. Use its native `onLoad` and `onError` events for resource-specific feedback.

The full cold-start gate and priority queue semantics live in [Preloading](/docs/02-preload).

## Common mistakes

- Add first-screen priority resources to `Scene.assets.preloadImages`.
- Use `loading='lazy'` when the image does not need eager preloading.
- Numeric dimensions are design pixels; CSS strings are passed through.
