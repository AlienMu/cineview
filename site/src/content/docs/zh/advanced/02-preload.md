---
title: 预加载
eyebrow: ADVANCED / PRELOADING
---

Scene 资源声明和 `ref.preload()` 使用预加载队列。Image 或 AnimateVideo 的 `preload` 属性填充缓存，不计入队列进度。

## 预加载入口

| 入口                              | 队列进度 | 初始资源等待                   |
| --------------------------------- | -------- | ------------------------------ |
| `Scene.assets.preloadImages`      | 计入     | 首场景声明的资源具有优先级     |
| `ref.preload(targets)`            | 计入     | 不会重新开启已经结束的初始等待 |
| Image / AnimateVideo 的 `preload` | 不计入   | 不声明首屏优先级               |

`onLoadProgress` 只描述队列请求，值达到 100 时，仅通过缓存加载的图片或视频仍可能尚未完成。

## 声明 Scene 资源

```tsx
<Scene sceneId="hero" assets={{ preloadImages: ['/hero.jpg', '/clip.mp4'] }}>
  <Image src="/hero.jpg" alt="产品概览" />
  <AnimateVideo src="/clip.mp4" aria-label="产品演示" />
</Scene>
```

drag 模式优先加载当前 Scene 的资源，其他资源在后台处理，场景切换会更新优先级。

scroll 模式始终优先加载场景 0，与滚动位置无关。

## 通过 ref 请求资源

`preload()` 返回 Promise，在队列工作完成后结束：

```tsx
await ref.current?.preload([1, 'finale']);
```

数字选择从零开始的 Scene 索引，字符串匹配 `sceneId`；scroll 模式还可匹配 `scroll.zoneId`。不传目标时，方法会处理全部 Scene。

这些资源进入优先队列。首屏等待使用加载开始时的优先名单，之后加入的请求不会重新开启已经结束的等待。

## 预加载单个元素

```tsx
<Image src="/hero.jpg" alt="产品概览" preload />
<AnimateVideo src="/clip.mp4" aria-label="产品演示" preload />
```

Image 在共享图片缓存中记录成功加载的结果，后续请求可复用；同时挂载的实例仍可能分别创建加载器。

视频预加载会复用进行中的请求，并缓存完整 blob。两类元素预加载都独立于 `onLoadProgress`。资源需要队列上报或首屏优先级时，使用 `Scene.assets.preloadImages`。

## 视频 URL 与缓存

队列通过以下扩展名规则识别视频：

```text
/\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i
```

没有可识别扩展名的 URL，例如 `/api/clip?format=mp4`，会按图片加载并可能解码失败。交给队列的视频 URL 应保留支持的扩展名；无扩展名的视频可通过 AnimateVideo 自身预加载。

图片请求在加载成功或失败后完成。视频预加载会将完整文件下载为 blob。媒体缓存使用 128MB 的最近最少使用预算，活动中的组件可保留所引用的 blob。该预算没有公共配置项。

## 进度、超时与错误

`onLoadProgress` 按完成的请求数报告整数 0 到 100，其中包含失败请求。它不表示字节数或成功比例，无队列资源时报告 100，增加请求时比例可能降低。

| 等待项       | 上限                                         |
| ------------ | -------------------------------------------- |
| 初始优先资源 | 3000ms，drag 可通过 `firstSceneTimeout` 配置 |
| 单个队列图片 | 15000ms                                      |
| 单个视频下载 | 30000ms                                      |

初始等待超时不表示请求已失败，资源可能仍在加载。框架报告 `FIRST_SCENE_TIMEOUT`，默认将首场景显示为完成态。应用提供自己的等待或重试界面时，再调用 `detail.preventDefault?.()` 取消默认处理。

drag 根组件通过 `IMAGE_LOAD_FAILED` 报告队列资源失败。scroll 队列不会在根回调中转发单项失败，可通过已渲染 Image 或 AnimateVideo 的 `onError` 处理元素错误。详见[回调](/docs/03-callbacks)。

## 相关页面

- [性能](/docs/01-performance)：帧指标与初始资源等待
- [Image](/docs/06-image)：加载与尺寸换算
- [媒体播放](/docs/06-media-ownership)：视频控制与解码帧
- [Scene](/docs/02-scene)：资源声明
