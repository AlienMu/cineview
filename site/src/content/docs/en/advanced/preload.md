---
title: Cold start & preload
eyebrow: COLD START
---

The first scene is gated by priority media completion; background scenes continue loading without blocking the page.

## Preload contract

Priority completion fires once. Background loading is deduplicated by the shared media cache. Ref.preload can add targeted scene or zone assets later.

## Cold-start gate

The first scene's enter pass is held until first-screen priority assets settle. If they do not settle within `modes.drag.firstSceneTimeout` (default 3000ms), a recoverable `FIRST_SCENE_TIMEOUT` is emitted with the loaded/total counts in its context: call `preventDefault()` in `onError` to keep the scene at its initial visual and run your own recovery; otherwise the framework reveals the first scene statically at its rest state. In scroll mode the gate only arms the ready trigger — the visibility path never waits on the hold window.

## Targeted preload

`ref.preload(targets)` resolves targets to their scenes' `assets.preloadImages`, enqueues them as priority (ahead of remaining background work), and resolves once they settle. A `number` target is a scene index; a `string` target is a `sceneId`, and in scroll mode a `scroll.zoneId` matches too. The loaded-URL cache is module-scoped, so dedup holds across scenes and across multiple CineView roots on the same page — and a URL riding the priority queue never also joins the background queue.

```tsx
await cineViewRef.current?.preload(['act-3', 'finale']);
```

