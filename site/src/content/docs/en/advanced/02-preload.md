---
title: Preloading
eyebrow: ADVANCED / PRELOADING
---

Preloading has three entry points, but only two of them go through the queue. `Scene.assets.preloadImages` and `ref.preload()` enqueue, and therefore count toward `onLoadProgress`; the per-element `preload` prop on `Image` / `AnimateVideo` **does not go through the queue at all** and only registers the URL in the shared cache. Miss that line and you get a page whose progress bar reads 100 while the image is still missing.

## What each entry point does

| Entry point                                    | Enqueues | Counts in `onLoadProgress` | Feeds the cold-start gate                                        |
| ---------------------------------------------- | -------- | -------------------------- | ---------------------------------------------------------------- |
| `Scene.assets.preloadImages`                   | yes      | yes                        | the first scene's images are priority                            |
| `ref.preload(targets)`                         | yes      | yes                        | no, the gate is already frozen (see "Imperative: ref.preload()") |
| the `preload` prop on `Image` / `AnimateVideo` | no       | no                         | no                                                               |

The first two share one queue instance (a priority batch plus a background batch). The per-element prop is a different path: `Image` creates its own `new window.Image()` to pull the URL into the shared image cache (`src/components/Image/Image.tsx:54-70`), and `AnimateVideo` calls `preloadMedia` directly to fill the video blob cache (`src/media/VideoFrameRenderer.tsx:386-388`). Neither touches the queue's `totalCount`, so neither enters the denominator of `onLoadProgress` nor affects the cold-start signal `priorityComplete`.

## Declarative: assets.preloadImages

Declare the images a scene needs on `Scene`:

```tsx
<Scene sceneId="hero" assets={{ preloadImages: ['/hero.jpg', '/badge.png'] }}>
  {/* ... */}
</Scene>
```

Which of them land in the priority batch forks by mode:

- drag: priority is the current scene's images, everything else goes to background. It is recomputed on every scene change, promoting the new current scene's images into priority (`src/components/CineView/CineView.tsx:143-162`).
- scroll: priority is **always scene 0**; every other scene's images are background regardless of where the viewer has scrolled (`src/components/CineView/DirectScrollCineView.tsx:142-153`).

## Imperative: ref.preload()

The `preload` method on the `CineView` ref schedules scene preloads on demand and returns a `Promise<void>`:

```tsx
const ref = useRef<CineViewRef>(null);

// Targets accept two kinds of identifiers:
await ref.current!.preload([1, 'finale']);
// - number: zero-based scene index
// - string: a Scene's sceneId; in scroll mode it can also match Scene.scroll.zoneId
```

These URLs are always enqueued as priority (`src/components/CineView/useCineViewImperativeApi.ts:67-79`), whether or not the target is the current scene. That does not mean they can hold back the first screen: priority membership is frozen into a snapshot when a run starts (`initialPriorityUrls`, `src/hooks/useImagePreloader.ts:267-271`), and URLs added through `addUrls` after that do not participate in the `priorityComplete` decision. The gate only knows the list as it stood at run start, so `ref.preload()` cannot reopen a cold-start gate that has already released.

## Per-element: the preload prop

Both `Image` and `AnimateVideo` accept a `preload` prop:

```tsx
<Image src="/hero.jpg" alt="hero" width={600} preload />
<AnimateVideo src="/clip.mp4" duration={{ enter: 1200 }} preload />
```

It does exactly one thing: register the asset in the shared cache. The shared cache deduplicates per asset, so an in-flight request returns the same Promise instead of requesting the network twice. Video preloads land as blob object URLs, consumed directly by `AnimateVideo`.

The prop suits a single asset that is not in the queue but you want early anyway. It is not a replacement for the queue: anything that needs progress reporting or cold-start gating has to go through `Scene.assets.preloadImages`.

## Videos are detected by file extension

When the queue takes a URL, it decides image versus video by file extension (`src/hooks/mediaPreloadCache.ts:30-35`):

```text
/\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i
```

A match takes the video path; anything else goes to `new Image()`. The consequence: a video URL with no extension, or one whose extension is masked by a query string (say `/api/clip?fmt=mp4`), is loaded as an image, `new Image()` cannot decode it, and it reports as a failure. Signed URLs and content-delivery network (CDN) transcoding endpoints run into this most often. Either keep a real extension in the path segment, or keep such URLs out of the queue.

"Ready" also means something different for the two kinds. An image is ready at `onload`; video scrubbing requires the whole buffer to be seekable, which progressive network buffering does not guarantee, so a video preload fetches the entire file as a blob before it counts as ready. That is why a first-screen video is far more expensive than a first-screen image.

The media cache has a byte budget, 128MB by default, evicting least-recently-used (LRU) entries and revoking their object URLs when exceeded (`src/hooks/mediaPreloadCache.ts:18`). For consumers that budget is effectively fixed: the function that changes it is not exported from the package's public surface.

## Progress, timeouts, and errors

`onLoadProgress` reports an integer from 0 to 100, not 0 to 1: the internal formula is `Math.round((loaded / total) * 100)`, and with no assets it reports `100` outright (`src/hooks/useImagePreloader.ts:216-222`). It counts resources rather than bytes, and the denominator grows as `addUrls` runs mid-run (`:280-291`), so **progress can move backwards**. Don't animate it as a monotonic value.

```tsx
<CineView
  designWidth={750}
  mode="scroll"
  callbacks={{
    onLoadProgress: (percent) => setBarWidth(`${percent}%`), // percent is 0..100
    onError: ({ code, preventDefault }) => {
      if (code === 'FIRST_SCENE_TIMEOUT') {
        preventDefault(); // take over and render a retry UI yourself
      }
    },
  }}
>
```

Three timeouts, on very different scales:

| Timeout            | Value                               | Role                                                                     |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------ |
| cold-start gate    | `firstSceneTimeout`, default 3000ms | cap on waiting for priority assets                                       |
| single image       | 15000ms                             | a request that fires neither `onload` nor `onerror` settles as a failure |
| single video fetch | 30000ms                             | blob download timeout; `AbortController` covers both headers and body    |

Both resource-level timeouts are far longer than the 3s gate (`useImagePreloader.ts:45`, `mediaPreloadCache.ts:133`). A slow asset therefore cannot hang the page: at 3s the gate releases on its own, and the timeout error arrives much later. Read the other way: receiving `FIRST_SCENE_TIMEOUT` does not mean an asset failed, it usually just means it is still in flight.

A gate timeout emits the recoverable `FIRST_SCENE_TIMEOUT`. Left alone, the framework falls back to statically placing the first scene in its rest state; calling `preventDefault()` inside `onError` hands control to you, and the first scene holds at its initial frame waiting for you to take over (`src/hooks/useFirstSceneEnter.ts:120-152`).

A failed asset reports `IMAGE_LOAD_FAILED`, but **only in drag mode**: only the drag root wires the preloader's `onError` into the error route (`src/components/CineView/CineView.tsx:840`), while the scroll root wires only `onProgress` (`DirectScrollCineView.tsx:154-157`). In scroll mode a failed image produces no callback, and you find it through the `<img>`'s own `onError` or by looking. See [Callbacks](/docs/03-callbacks) for the full error-code table.

## Related pages

- The cold-start gate and runtime metrics are in [Performance](/docs/01-performance).
- `Image` scaling and props are in [Image](/docs/06-image).
- Video ownership, `releaseOnLeave`, and encoding requirements are in [Media ownership](/docs/06-media-ownership).
- The full `Scene.assets` field table is in [Scene](/docs/02-scene).
