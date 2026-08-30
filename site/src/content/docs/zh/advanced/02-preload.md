---
title: 预加载
eyebrow: ADVANCED / PRELOADING
---

预加载有三个入口，但只有两个走同一条队列。`Scene.assets.preloadImages` 与 `ref.preload()` 进队列，因此计入 `onLoadProgress`；`Image` / `AnimateVideo` 上的元素级 `preload` prop **完全绕过队列**，只把 URL 登记进共享缓存。分不清这条界线，会得到一个「进度条已到 100 但图还没出现」的页面。

## 三个入口的分工

| 入口                                       | 走队列 | 计入 `onLoadProgress` | 计入冷启动就绪判定                                  |
| ------------------------------------------ | ------ | --------------------- | --------------------------------------------------- |
| `Scene.assets.preloadImages`               | 是     | 是                    | 首屏场景的图算 priority                             |
| `ref.preload(targets)`                     | 是     | 是                    | 否，门已冻结（原因见「命令式：ref.preload()」小节） |
| `Image` / `AnimateVideo` 的 `preload` prop | 否     | 否                    | 否                                                  |

前两者共享同一个队列实例（priority 批次 + background 批次）。元素级 prop 是另一条路径：`Image` 自建一个 `new window.Image()` 把 URL 拉进共享图片缓存（`src/components/Image/Image.tsx:54-70`），`AnimateVideo` 直接调 `preloadMedia` 填视频 blob 缓存（`src/media/VideoFrameRenderer.tsx:386-388`）。两者都不改队列的 `totalCount`，所以既不进 `onLoadProgress` 的分母，也不影响冷启动就绪信号 `priorityComplete`。

## 声明式：assets.preloadImages

在 `Scene` 上声明该场景需要的图片：

```tsx
<Scene sceneId="hero" assets={{ preloadImages: ['/hero.jpg', '/badge.png'] }}>
  {/* ... */}
</Scene>
```

哪些进 priority 批次按模式分叉：

- drag：priority 是当前场景的图片，其余场景进 background。切场景时重算，新的当前场景的图片被提到 priority（`src/components/CineView/CineView.tsx:143-162`）。
- scroll：priority **固定是 scene 0**，其余所有场景的图片一律 background，与观众滚到哪里无关（`src/components/CineView/DirectScrollCineView.tsx:142-153`）。

## 命令式：ref.preload()

`CineView` ref 的 `preload` 方法按需调度指定场景的预加载，返回 `Promise<void>`：

```tsx
const ref = useRef<CineViewRef>(null);

// target 接受两种标识：
await ref.current!.preload([1, 'finale']);
// - number：场景索引（0 起）
// - string：Scene 的 sceneId；scroll 模式下也可以匹配 Scene.scroll.zoneId
```

这些 URL 总是以 priority 入队（`src/components/CineView/useCineViewImperativeApi.ts:67-79`），无论目标是不是当前场景。但这不意味着它们能挡住首屏：priority 成员在一次 run 启动时就冻结成快照（`src/hooks/useImagePreloader.ts:267-271` 的 `initialPriorityUrls`），run 开始后经 `addUrls` 进来的 URL 不参与 `priorityComplete` 的判定。冷启动门只认 run 启动那一刻的名单，`ref.preload()` 无法重开一个已经放行的冷启动门。

## 元素级：preload prop

`Image` 和 `AnimateVideo` 都接受 `preload` prop：

```tsx
<Image src="/hero.jpg" alt="hero" width={600} preload />
<AnimateVideo src="/clip.mp4" duration={{ enter: 1200 }} preload />
```

它只做一件事：把这个资源登记进共享缓存。共享缓存对同一资源去重，已在加载中的请求复用同一个 Promise，不会发第二次网络请求。视频预加载以 blob 形式落地为 object URL，供 `AnimateVideo` 直接消费。

这个 prop 适合「队列里没有、但希望提前拿到」的单个资源。它不是队列的替代品：需要进度上报或冷启动就绪判定，就必须走 `Scene.assets.preloadImages`。

## 视频按扩展名识别

队列拿到一个 URL 时，按扩展名判断它是图片还是视频（`src/hooks/mediaPreloadCache.ts:30-35`）：

```text
/\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i
```

命中即走视频路径，否则走 `new Image()`。后果是：无扩展名的视频 URL，或扩展名被查询串遮蔽的（比如 `/api/clip?fmt=mp4`），会被当成图片加载，`new Image()` 解不出来，报失败。签名 URL 与 CDN（内容分发网络）转码接口最容易踩这个。要么让路径段保留真实扩展名，要么别把这类 URL 交给队列。

图片与视频的「就绪」定义也不同。图片 `onload` 即算就绪；视频 scrub 要求整段 buffer 可 seek，渐进式网络缓冲不保证这一点，所以视频预加载会 fetch 整个文件为 blob 才算就绪。这也是首屏视频比首屏图片贵得多的原因。

媒体缓存有 LRU（最近最少使用）字节预算，默认 128MB，超出后淘汰最久未用的条目并 revoke object URL（`src/hooks/mediaPreloadCache.ts:18`）。这个预算对消费者等于写死：调节它的函数没有从包的公共出口导出。

## 进度、超时与错误

`onLoadProgress` 上报的是整数 0 到 100，不是 0 到 1：内部算式是 `Math.round((loaded / total) * 100)`，无资产时直接报 `100`（`src/hooks/useImagePreloader.ts:216-222`）。按条数计，不按字节，而且分母会随 `addUrls` 在 run 中增长（`:280-291`），所以**进度可能回退**，别把它当单调量画动画。

```tsx
<CineView
  designWidth={750}
  mode="scroll"
  callbacks={{
    onLoadProgress: (percent) => setBarWidth(`${percent}%`), // percent 是 0..100
    onError: ({ code, preventDefault }) => {
      if (code === 'FIRST_SCENE_TIMEOUT') {
        preventDefault(); // 拿回控制权，自行渲染重试 UI
      }
    },
  }}
>
```

三个超时值，量级差得很远：

| 超时           | 值                               | 作用                                                 |
| -------------- | -------------------------------- | ---------------------------------------------------- |
| 冷启动门       | `firstSceneTimeout`，默认 3000ms | 等 priority 资源就绪的上限                           |
| 单张图片       | 15000ms                          | 既不 `onload` 也不 `onerror` 的挂起请求按失败结算    |
| 单个视频 fetch | 30000ms                          | blob 下载超时，`AbortController` 覆盖 header 与 body |

两个资源级超时都远长于 3s 冷启动门（`useImagePreloader.ts:45`、`mediaPreloadCache.ts:133`）。慢资源因此不会挂住页面：3s 到了冷启动门自己放行，超时错误更晚才到。反过来说，收到 `FIRST_SCENE_TIMEOUT` 不等于资源失败，多半只是还在路上。

冷启动门超时发 `FIRST_SCENE_TIMEOUT`（可恢复）：不干预时框架回退为静态放置首场景 rest 态；在 `onError` 里调 `preventDefault()` 则拿回处理权，首场景会停在 initial 帧等你接管（`src/hooks/useFirstSceneEnter.ts:120-152`）。

单个资源失败上报 `IMAGE_LOAD_FAILED`，但**只在 drag 模式**：只有 drag 根把 preloader 的 `onError` 接进错误路由（`src/components/CineView/CineView.tsx:840`），scroll 根只接了 `onProgress`（`DirectScrollCineView.tsx:154-157`）。scroll 模式下单张图挂了不会有回调，只能靠 `<img>` 自己的 `onError` 或视觉发现。错误码全表见[回调](/docs/03-callbacks)。

## 相关页面

- 冷启动就绪判定与运行时指标见[性能](/docs/01-performance)。
- `Image` 的换算与 prop 细节见 [Image](/docs/06-image)。
- 视频所有权、`releaseOnLeave` 与编码要求见[媒体所有权](/docs/06-media-ownership)。
- `Scene.assets` 字段全表见 [Scene](/docs/02-scene)。
