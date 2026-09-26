---
title: 预加载
eyebrow: ADVANCED / PRELOADING
---

把首个 Scene 需要的图片和视频写入 `assets.preloadImages`，入场会等待它们。所有 Scene 声明的资源都会自动下载：先处理首个 Scene，再处理其余 Scene。`Image` 和 `AnimateVideo` 默认也会预加载自己的 `src`，但这部分不计入队列进度。

## 预加载入口

| 入口                              | 队列进度 | 初始资源等待                            |
| --------------------------------- | -------- | --------------------------------------- |
| `Scene.assets.preloadImages`      | 计入     | 首场景声明的资源具有优先级              |
| `ref.preload(targets)`            | 计入     | 等待队列结束，可重试失败资源            |
| Image / AnimateVideo 的 `preload` | 不计入   | `preload` 默认为 `true`，不参与首屏等待 |

`onLoadProgress` 只统计队列里的请求。它到 100 时，只靠 `Image` 或 `AnimateVideo` 自身预加载的资源可能还在下载。

## 声明 Scene 资源

下面的首个 Scene 会等图片和视频加载完成后再入场：

```tsx
import { AnimateVideo, Cineview, Image, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="drag">
      <Scene sceneId="hero" assets={{ preloadImages: ['/hero.jpg', '/clip.mp4'] }}>
        <Image src="/hero.jpg" alt="产品概览" />
        <AnimateVideo src="/clip.mp4" aria-label="产品演示" />
      </Scene>
    </Cineview>
  );
}
```

drag 模式切换场景时，队列会重试未加载成功的资源，但不会改变原有顺序。

scroll 模式也先处理场景 0，与当前滚动位置无关。

## 通过 ref 请求资源

`preload()` 返回 Promise，在当前队列工作完成后结束。下面的按钮会等待本轮队列结束，再更新提示。结尾场景的资源在页面挂载时已开始下载；Promise 结束不代表每项资源都成功，失败仍需通过相应错误回调处理。

```tsx
import { useRef, useState } from 'react';
import { Cineview, Scene, type CineviewRef } from 'cineview';

export default function Page() {
  const ref = useRef<CineviewRef>(null);
  const [status, setStatus] = useState('');

  async function waitForFinale() {
    if (!ref.current) return;
    setStatus('正在等待资源队列');
    try {
      await ref.current.preload(['finale']);
      setStatus('本轮队列已结束');
    } catch {
      setStatus('资源请求未完成');
    }
  }

  return (
    <>
      <button onClick={() => void waitForFinale()}>等待结尾资源</button>
      <span role="status">{status}</span>
      <Cineview ref={ref}>
        <Scene sceneId="intro">开场内容</Scene>
        <Scene sceneId="finale" assets={{ preloadImages: ['/finale.jpg'] }}>
          结尾内容
        </Scene>
      </Cineview>
    </>
  );
}
```

传数字表示 Scene 序号（从 0 开始），传字符串按 `sceneId` 匹配；scroll 模式还可匹配 `scroll.zoneId`。不传目标时，方法会处理全部未加载成功的资源。

`preload()` 不会提升已入队资源的优先级。上一轮队列结束后调用，可重新请求失败的资源。首屏等待结束后调用，不会让它重新开始。

## 关闭单个元素的预加载

`Image` 和 `AnimateVideo` 默认提前下载自己的 `src`。如果非首屏视频较大，可以关闭它自身的预加载：

```tsx
<AnimateVideo src="/clip.mp4" aria-label="产品演示" preload={false} />
```

关闭后，视频会在需要画面时加载，首次显示可能有延迟。视频需要计入首屏等待或 `onLoadProgress` 时，仍应写入 `Scene.assets.preloadImages`。

## 视频 URL 与缓存

队列把以 `.mp4`、`.webm`、`.mov`、`.m4v`、`.ogv` 或 `.ogg` 结尾的视频 URL 识别为视频，后面可以带查询串或 `#`。

没有可识别扩展名的 URL，例如 `/api/clip?format=mp4`，会被当成图片加载并解码失败。交给队列的视频 URL 应保留支持的扩展名；无扩展名的视频可通过 AnimateVideo 自身预加载。

视频预加载会把完整文件下载为 blob。缓存上限为 128MB，超出后先移除最久没用的视频；已挂载组件引用的视频会保留。这个上限不能配置。

## 进度、超时与错误

`onLoadProgress` 按完成的请求数报告整数 0 到 100，其中包含失败请求。它不表示字节数或成功比例，无队列资源时报告 100，增加请求时比例可能降低。

| 等待项       | 上限                                         |
| ------------ | -------------------------------------------- |
| 初始优先资源 | 3000ms，drag 可通过 `firstSceneTimeout` 配置 |
| 单个队列图片 | 15000ms                                      |
| 单个视频下载 | 30000ms                                      |

初始等待超时不表示请求已失败，资源可能仍在加载。框架报告 `FIRST_SCENE_TIMEOUT`，默认将首场景显示为完成态。只有应用自己提供等待或重试界面时，才调用 `detail.preventDefault?.()`。调用后，首个 Scene 停在初始画面；资源重试成功后，需要重新挂载 Cineview 才会重新入场。

drag 根组件通过 `IMAGE_LOAD_FAILED` 报告队列资源失败。scroll 队列不会在根回调中转发单项失败，可通过已渲染 Image 或 AnimateVideo 的 `onError` 处理元素错误。详见[回调](/docs/03-callbacks)。

## 相关页面

- [性能](/docs/01-performance)：帧指标与初始资源等待
- [Image](/docs/06-image)：加载与尺寸换算
- [媒体播放](/docs/06-media-ownership)：视频控制与解码帧
- [Scene](/docs/02-scene)：资源声明
