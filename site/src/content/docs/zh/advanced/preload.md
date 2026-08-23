---
title: 冷启动与预加载
eyebrow: COLD START
---

首场景由优先媒体的完成情况门控；后台场景继续加载，不阻塞页面。

## 预加载契约

优先级完成只触发一次。后台加载由共享媒体缓存去重。Ref.preload 可在之后补充指定 scene 或 zone 的资源。

## 冷启动门

首场景的入场被扣住，直到首屏优先资源 settle。若在 `modes.drag.firstSceneTimeout`（默认 3000ms）内没有 settle，会发出可恢复的 `FIRST_SCENE_TIMEOUT`，context 里带 loaded/total 计数：在 `onError` 里调 `preventDefault()` 可让场景停在初始视觉、执行你自己的恢复逻辑；否则框架按静止态静态摆出首场景。scroll 模式下这道门只负责给出 ready 触发——可见性路径不会等待保持窗口。

## 定向补载

`ref.preload(targets)` 把目标解析为各 scene 的 `assets.preloadImages`，以优先级入队（排在剩余后台工作之前），settle 后 resolve。`number` 目标是 scene 索引；`string` 目标是 `sceneId`，scroll 模式下还能匹配 `scroll.zoneId`。已加载 URL 的缓存是模块级的，因此去重跨 scene、也跨同页多个 CineView 根，并且走了优先队列的 URL 绝不会同时再进后台队列。

```tsx
await cineViewRef.current?.preload(['act-3', 'finale']);
```

