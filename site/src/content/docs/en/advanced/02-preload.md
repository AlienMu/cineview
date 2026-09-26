---
title: Preloading
eyebrow: ADVANCED / PRELOADING
---

List the first Scene's images and videos in `assets.preloadImages` so its entrance waits for them. Assets declared by every Scene download automatically: the first Scene's list goes first, followed by the others. `Image` and `AnimateVideo` also preload their own `src` by default, outside queue progress.

## Preload entry points

| Entry                          | Queue progress | Initial resource wait                                       |
| ------------------------------ | -------------- | ----------------------------------------------------------- |
| `Scene.assets.preloadImages`   | Included       | The first Scene's declared resources are priority           |
| `ref.preload(targets)`         | Included       | Waits for the queue and can retry failed resources          |
| Image / AnimateVideo `preload` | Not included   | `preload` defaults to `true`; outside the first-screen wait |

`onLoadProgress` counts queued requests only. When it reaches 100, a resource preloaded only by `Image` or `AnimateVideo` can still be downloading.

## Declare Scene resources

This first Scene waits for both the image and video before entering:

```tsx
import { AnimateVideo, Cineview, Image, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="drag">
      <Scene sceneId="hero" assets={{ preloadImages: ['/hero.jpg', '/clip.mp4'] }}>
        <Image src="/hero.jpg" alt="Product overview" />
        <AnimateVideo src="/clip.mp4" aria-label="Product demonstration" />
      </Scene>
    </Cineview>
  );
}
```

In drag mode, changing Scenes retries resources that have not loaded, but does not reorder the queue.

Scroll mode also loads Scene 0 first, regardless of scroll position.

## Request resources through ref

`preload()` returns a Promise that settles after current queued work finishes. This button waits for the queue pass, then updates its message. Finale assets started downloading when the page mounted. A settled Promise does not mean every asset succeeded; handle failures through the relevant error callbacks.

```tsx
import { useRef, useState } from 'react';
import { Cineview, Scene, type CineviewRef } from 'cineview';

export default function Page() {
  const ref = useRef<CineviewRef>(null);
  const [status, setStatus] = useState('');

  async function waitForFinale() {
    if (!ref.current) return;
    setStatus('Waiting for the resource queue');
    try {
      await ref.current.preload(['finale']);
      setStatus('Queue pass finished');
    } catch {
      setStatus('Resource request did not finish');
    }
  }

  return (
    <>
      <button onClick={() => void waitForFinale()}>Wait for finale assets</button>
      <span role="status">{status}</span>
      <Cineview ref={ref}>
        <Scene sceneId="intro">Introduction</Scene>
        <Scene sceneId="finale" assets={{ preloadImages: ['/finale.jpg'] }}>
          Finale
        </Scene>
      </Cineview>
    </>
  );
}
```

A number selects a Scene by its zero-based index. A string matches `sceneId`; in scroll mode it can also match `scroll.zoneId`. With no target, the method handles every resource that has not loaded.

`preload()` does not promote resources already in the queue. After one queue pass finishes, calling it can retry failed resources. It cannot restart a first-screen wait that has ended.

## Turn off element preloading

`Image` and `AnimateVideo` preload their own `src` by default. Turn this off for a large video that is not on the first screen:

```tsx
<AnimateVideo src="/clip.mp4" aria-label="Product demonstration" preload={false} />
```

The video then loads when its frames are needed, so its first frame can appear later. Add it to `Scene.assets.preloadImages` when it must count toward first-screen waiting or `onLoadProgress`.

## Video URLs and cache

The queue recognizes video URLs ending in `.mp4`, `.webm`, `.mov`, `.m4v`, `.ogv`, or `.ogg`, optionally followed by a query string or `#`.

A URL without a recognized extension, such as `/api/clip?format=mp4`, loads as an image and fails to decode. Keep a recognized extension in queued video URLs, or preload an extensionless video through AnimateVideo itself.

Video preloading downloads the complete file as a blob. The cache holds up to 128MB and evicts the least recently used video first; a mounted component retains a video it uses. The limit cannot be configured.

## Progress, timeouts, and errors

`onLoadProgress` reports an integer from 0 to 100 based on completed request count, including failures. It is not a byte count or a success percentage. With no queued assets it reports 100. Adding requests can reduce the percentage.

| Wait                       | Limit                                                    |
| -------------------------- | -------------------------------------------------------- |
| Initial priority resources | 3000ms; configurable through `firstSceneTimeout` in drag |
| One queued image           | 15000ms                                                  |
| One video fetch            | 30000ms                                                  |

An initial timeout does not mean the request failed; it may still be loading. The framework reports `FIRST_SCENE_TIMEOUT` and displays the first Scene at its completed state by default. Call `detail.preventDefault?.()` only when the application supplies its own wait or retry interface. The first Scene then stays at its initial frame; remount Cineview after a successful retry to start its entrance again.

Queued resource failures report `IMAGE_LOAD_FAILED` through the drag root. The scroll queue does not forward individual failures there; use the rendered Image or AnimateVideo's `onError` for element errors. See [Callbacks](/docs/03-callbacks).

## Related pages

- [Performance](/docs/01-performance): frame metrics and initial resource wait
- [Image](/docs/06-image): loading and size conversion
- [Media playback](/docs/06-media-ownership): video control and decoded frames
- [Scene](/docs/02-scene): asset declarations
