---
title: AnimateVideo
eyebrow: COMPONENTS / ANIMATEVIDEO
---

AnimateVideo 将 Animate 时间轴映射为原生视频的播放位置，进度回退时向前面的画面定位。无需额外的视频库，视频始终静音并在页面内播放。

## 用滚动控制视频

给 Scene 声明锁定区，再设置视频的 `duration.enter`。示例将完整视频对应到 2000px 滚动距离；向回滚动时，视频位置也随之回退。

```tsx
import { AnimateVideo, Cineview, Scene } from 'cineview';

export default function VideoPage() {
  return (
    <Cineview mode="scroll" designWidth={750}>
      <Scene
        sceneId="product"
        layout={{ height: '100vh' }}
        scroll={{ zoneId: 'product-video' }}
        assets={{ preloadImages: ['/clip.mp4'] }}
      >
        <AnimateVideo
          src="/clip.mp4"
          width="100%"
          duration={{ enter: 2000 }}
          aria-label="产品演示"
        />
      </Scene>
    </Cineview>
  );
}
```

## 进度即播放位置

视频直接读取时间轴 MotionValue，不通过逐帧 React state 更新播放位置。

- 不设 `scrubRange` 时，视频位置等于进度乘以素材总时长。进度 0 对应首帧，1 对应末帧。
- 反向拖拽或滚动会逐帧定位到较早的画面。实际定位速度取决于素材编码与浏览器。
- `timeline.delay`、`timeline.after` 和可见性配置与 [Animate](/docs/03-animate) 相同。

`duration.enter` 是这段定位占用的时间轴跨度，不是视频时长。scroll 锁定区（locked zone）内 `1ms = 1px`：`duration={{ enter: 2000 }}` 意味着滚动 2000px 对应视频走完整个区间；drag 模式下则是元素时间轴的 2000ms。

公开的 `timeline` 选项为 `delay` 和 `after`。默认 driver 为 `'scene'`，视频跟随所在 Scene 或锁定区；scroll 模式的锁定区外，使用可见性触发的计时。

## Props 全表

| prop                                                  | 类型                                 | 默认             | 说明                                                            |
| ----------------------------------------------------- | ------------------------------------ | ---------------- | --------------------------------------------------------------- |
| `src`                                                 | string                               | 无               | 视频地址。编码建议见[准备用于定位的视频](#准备用于定位的视频)。 |
| `animateId`                                           | string                               | 无               | 同 [Animate](/docs/03-animate)，被 `after` 引用时必须声明       |
| `duration.enter` / `exit`                             | number，ms                           | 600              | 时间轴跨度；锁定区内跟随场景的值对应滚动像素                    |
| `scrubRange`                                          | `readonly [from, to]`，秒            | 完整视频         | 视频时间区间，支持反向区间，端点限制在素材时长内                |
| `enterAnimation`                                      | AnimationType                        | `opacity: 1 → 1` | 可叠加的入场效果                                                |
| `exitAnimation`                                       | AnimationType                        | 无               | 可叠加的退场效果                                                |
| `timeline`                                            | `{ delay?: number; after?: string }` | 无               | 支持的时序选项                                                  |
| `visibility`                                          | `{replay, enterMargin, exitMargin}`  | 无               | 同 Animate                                                      |
| `preload`                                             | boolean                              | `true`           | 提前下载视频并加入共享缓存                                      |
| `releaseOnLeave`                                      | boolean                              | `false`          | 远离 scroll 锁定区时释放解码帧                                  |
| `width` / `height`                                    | number \| string                     | 无               | 数字 = 设计 px                                                  |
| `poster`                                              | string                               | 无               | 视频加载前显示的图片 URL                                        |
| `playbackRate`                                        | number                               | `1`              | 区间结束后原生播放的速率；不影响时间轴定位                      |
| `style`                                               | CSSProperties                        | 无               | 视频样式；受支持的数值长度按设计像素换算                        |
| `aria-label`                                          | string                               | 无               | 为没有控件的静音视频提供描述                                    |
| `onEnded` `onPlay` `onPause` `onTimeUpdate` `onError` | 原生 video 事件                      | 无               | 传给 `<video>` 的事件处理器                                     |

转发的 `ref` 指向原生 `<video>` 元素，可用于读取媒体状态或调用原生方法。

## 指定视频区间与后续播放

显式区间的终点早于片尾时，进度到达终点后会开始原生播放。反向滚出终点附近 2% 的范围时，暂停播放并恢复时间轴定位。反向区间在终点也会向片尾正向播放；若需要停在固定帧，可改用预先倒序编码的素材。

8 秒视频设置 `scrubRange={[1.2, 4.8]}` 时，进度 0.5 定位到 3.0 秒；到达区间终点后，剩余 3.2 秒由原生播放器播放。

## 准备用于定位的视频

密集关键帧可减少随机定位和反向定位的解码工作。帧间编码依赖参考帧，关键帧稀疏时可能增加定位延迟。

将每帧独立编码：

```bash
ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 scrub.mp4
```

全关键帧编码会增大文件，也可减少定位时的解码工作。开发环境中，定位延迟样本的中位数超过 50ms 时，每个素材会收到一次警告。该警告表示定位较慢，不代表已经确定某种编码错误。

## releaseOnLeave：解码帧释放

`releaseOnLeave` 默认为 false，仅在 scroll 锁定区内生效：

- 距锁定区超过 1.5 个视窗跨度时，暂停视频并解除素材绑定，以释放解码帧。
- 回到一个视窗跨度以内时，恢复素材并定位到当前时间轴位置。保留的 blob 可直接复用，无需再次下载。
- 两个不同的阈值用于避免在边界附近反复释放和恢复。
- 时间轴进度发生过变化后才会释放，更换视频素材会重置此条件。

## 预加载与首屏等待

`preload` 填充共享视频缓存。命中缓存时，使用已下载完整的 blob，以便在整个文件内定位。

需要首屏等待视频资源时，将 URL 写入 `Scene.assets.preloadImages`。视频自身的 `preload` 不会将其加入该队列。`onReady` 仅在挂载后提供 ref API，不等待视频加载。详见[预加载](/docs/02-preload)。

## 用拖拽控制视频

将视频放在 drag 模式的 Scene 内。`unit="percent"` 和 `scale={1}` 使拖拽距离按视窗比例映射到元素时间线。示例中的视频位于第二个 Scene，拖向该场景时逐帧显示。

```tsx
<Cineview mode="drag" designWidth={750} unit="percent" scale={1}>
  <Scene sceneId="intro">
    <h1>向上拖拽查看视频</h1>
  </Scene>
  <Scene sceneId="video" assets={{ preloadImages: ['/clip.mp4'] }}>
    <AnimateVideo src="/clip.mp4" width="100%" duration={{ enter: 2000 }} aria-label="产品演示" />
  </Scene>
</Cineview>
```

`duration.enter` 使用元素时间线的毫秒数。Scene 还包含其他动画时，其时长和依赖也会影响总时长。`releaseOnLeave` 在 drag 模式下不生效，详见[拖拽时间线](/docs/02-timeline)。
