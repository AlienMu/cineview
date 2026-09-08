---
title: Preloading
eyebrow: ADVANCED / PRELOADING
---

Scene resource declarations and `ref.preload()` use the preload queue. The `preload` prop on Image or AnimateVideo fills a cache without adding to queue progress.

## Preload entry points

| Entry                          | Queue progress | Initial resource wait                                  |
| ------------------------------ | -------------- | ------------------------------------------------------ |
| `Scene.assets.preloadImages`   | Included       | The first Scene's declared resources are priority      |
| `ref.preload(targets)`         | Included       | Does not reopen an initial wait that has already ended |
| Image / AnimateVideo `preload` | Not included   | Does not declare first-screen priority                 |

`onLoadProgress` only describes queued requests. A cache-only image or video can still be loading after that value reaches 100.

## Declare Scene resources

```tsx
<Scene sceneId="hero" assets={{ preloadImages: ['/hero.jpg', '/clip.mp4'] }}>
  <Image src="/hero.jpg" alt="Product overview" />
  <AnimateVideo src="/clip.mp4" aria-label="Product demonstration" />
</Scene>
```

In drag mode, the current Scene's resources are priority and the rest are background work. Changing Scenes updates those priorities.

In scroll mode, Scene 0 remains the priority Scene regardless of scroll position.

## Request resources through ref

`preload()` returns a Promise that settles after the queued work finishes:

```tsx
await ref.current?.preload([1, 'finale']);
```

A number selects a zero-based Scene index. A string matches `sceneId`; in scroll mode it can also match `scroll.zoneId`. With no targets, the method considers all Scenes.

These resources enter the priority queue. The first-screen wait uses the priority list captured when loading starts; later requests do not reopen a wait that has ended.

## Preload an individual element

```tsx
<Image src="/hero.jpg" alt="Product overview" preload />
<AnimateVideo src="/clip.mp4" aria-label="Product demonstration" preload />
```

An Image records successful completion in the shared image cache. Later requests reuse that result, but concurrent mounts can create separate loaders.

Video preloads share in-flight requests and cache complete blobs. Both kinds of element preload operate separately from `onLoadProgress`. Use `Scene.assets.preloadImages` when a resource needs queue reporting or first-screen priority.

## Video URLs and cache

Queued URLs use this extension check to identify videos:

```text
/\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i
```

A URL without a recognized extension, such as `/api/clip?format=mp4`, takes the image path and can fail to decode. Keep a recognized extension in queued video URLs, or preload an extensionless video through AnimateVideo itself.

An image request settles on load or failure. Video preloading downloads the complete file as a blob. The media cache uses a 128MB least-recently-used (LRU) budget; active consumers can retain referenced blobs. That budget has no public configuration option.

## Progress, timeouts, and errors

`onLoadProgress` reports an integer from 0 to 100 based on completed request count, including failures. It is not a byte count or a success percentage. With no queued assets it reports 100. Adding requests can reduce the percentage.

| Wait                       | Limit                                                    |
| -------------------------- | -------------------------------------------------------- |
| Initial priority resources | 3000ms; configurable through `firstSceneTimeout` in drag |
| One queued image           | 15000ms                                                  |
| One video fetch            | 30000ms                                                  |

An initial timeout does not establish that a request failed; it can still be loading. The framework reports `FIRST_SCENE_TIMEOUT` and displays the first Scene at its completed state by default. Call `detail.preventDefault?.()` only when the application supplies its own wait or retry interface.

Queued resource failures report `IMAGE_LOAD_FAILED` through the drag root. The scroll queue does not forward individual failures there; use the rendered Image or AnimateVideo's `onError` for element errors. See [Callbacks](/docs/03-callbacks).

## Related pages

- [Performance](/docs/01-performance): frame metrics and initial resource wait
- [Image](/docs/06-image): loading and size conversion
- [Media playback](/docs/06-media-ownership): video control and decoded frames
- [Scene](/docs/02-scene): asset declarations
