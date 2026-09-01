---
title: AnimateVideo
eyebrow: COMPONENTS / ANIMATEVIDEO
---

AnimateVideo 用时间轴位置驱动原生 `<video>`：drag 或 scroll 的位置直接映射 `currentTime`，反向输入即倒放。它是 `Animate` 的薄封装，复用 render-prop 把内部 `enterProgress` 喂给帧渲染器。零依赖库、无控件、始终静音 + `playsInline`。

```tsx
<AnimateVideo
  src="/clip.mp4"
  duration={{ enter: 2000 }} // scrub 跨度（scroll 锁定区内即真实滚动 px）
  timeline={{ delay: 100, after: 'intro' }}
  visibility={{ replay: true }}
/>
```

## 进度即播放位置

外层 `Animate` 管理 progress；video 以 MotionValue 消费 progress，每帧不走 React state。位置是输入，帧是输出：

- 不设 `scrubRange` 时 `currentTime = progress × duration`：progress 0 即首帧，progress 1 即末帧。
- 反向输入即倒放。往回拖、往回滚逐帧 seek 回去，不需要单独的「倒放模式」。
- 包装层是普通的 `Animate`，`timeline.delay` / `after` / 可见性判定与其他元素一样生效。

`duration.enter` 是这段定位占用的时间轴跨度，不是视频时长。scroll 锁定区（locked zone）内 `1ms = 1px`：`duration={{ enter: 2000 }}` 意味着滚动 2000px 对应视频走完整个区间；drag 模式下则是元素时间轴的 2000ms。

`AnimateVideo.timeline` 是刻意收窄的类型：只有 `delay` 与 `after`。包装层的 `driver` 停在默认 `'scene'`，与其他 `Animate` 一样绑定所在 zone/scene 的时间轴。

## Props 全表

| prop                                                  | 类型                                | 默认               | 说明                                                                                                         |
| ----------------------------------------------------- | ----------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `src`                                                 | string                              | 无                 | 视频地址。片源必须密集关键帧编码，见「片源必须密集关键帧编码」小节                                           |
| `animateId`                                           | string                              | 无                 | 同 [Animate](/docs/03-animate)，被 `after` 引用时必须声明                                                    |
| `duration.enter` / `exit`                             | number (ms)                         | 无                 | 定位跨度；scroll 锁定区内 `1ms = 1px`                                                                        |
| `scrubRange`                                          | `readonly [from, to]` （秒）        | 无                 | 将时间轴映射到视频时间的指定区间，支持反向区间（`from > to`）。端点数值自动限制在 `[0, duration]` 有效范围内 |
| `enterAnimation` / `exitAnimation`                    | AnimationType                       | 默认透明度固定配置 | 默认 `opacity: 1 → 1`，让逐帧定位保持为唯一可见动画                                                          |
| `timeline.delay` / `after`                            | 无                                  | -                  | 仅这两个字段，语义同 Animate                                                                                 |
| `visibility`                                          | `{replay, enterMargin, exitMargin}` | 无                 | 同 Animate                                                                                                   |
| `preload`                                             | boolean                             | `true`             | 积极填充共享视频预加载缓存                                                                                   |
| `releaseOnLeave`                                      | boolean                             | `false`            | 解码帧释放管理，scroll 锁定区专属                                                                            |
| `width` / `height`                                    | number \| string                    | 无                 | 数字 = 设计 px                                                                                               |
| `poster`                                              | string                              | 无                 |                                                                                                              |
| `playbackRate`                                        | number                              | 无                 |                                                                                                              |
| `style`                                               | CSSProperties                       | 无                 |                                                                                                              |
| `aria-label`                                          | string                              | 无                 | 无控件无声视频必须自报语义                                                                                   |
| `onEnded` `onPlay` `onPause` `onTimeUpdate` `onError` | 原生 video 事件                     | 无                 | 透传给底层 `<video>`（播放归属仍由框架判定）                                                                 |

## scrubRange 与终点交接

区间终点早于素材结尾时，定位到达终点会：先 seek 到 `to`，再将播放控制交给原生播放（`play()`），素材尾部按正常速率播放，不再跟随滚动位移。往回滚动脱离终点区域（包含 2% 防抖缓冲区）后框架收回控制权：暂停、seek 并恢复跟随滚动。

示例：8 秒素材、`scrubRange={[1.2, 4.8]}`、`duration={{ enter: 3600 }}`。progress 0.5 seek 到 `1.2 + 0.5 × 3.6 = 3.0s`；progress 1 seek 到 4.8s 并交接，剩余 3.2 秒原生播完。

## 片源必须密集关键帧编码

H.264 的 P/B 帧是相对前帧的差分，seek 到任意帧都要从最近的关键帧起整段解码。稀疏关键帧（常见默认约每 250 帧一个）下，每次 seek 都要解码一长段，解码线程被打满就掉帧，反向最糟。

把每一帧编成 I 帧：

```bash
ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 scrub.mp4
```

代价是文件变大（每帧自包含），收益是任意帧直接解码、seek 延迟变平。运行时会测量每次 seek 的延迟，单源中位数超过 50ms 时告警一次，让错编码的视频在开发期暴露。

## releaseOnLeave：解码帧释放

随滚动逐帧定位的 `<video>` 在离开可视区域后仍可能占用解码帧与 GPU 纹理，可能导致后续场景出现掉帧。`releaseOnLeave`（默认 `false`）负责管理该释放行为：仅在 scroll 锁定区内生效，drag 模式与 zone 外不动作：

- **离开 zone 超过 1.5 倍屏幕高度**（band `far`）：释放。`pause` + 摘除 `src` + `load()`，解码帧丢弃，内存中的 blob 租约保留。
- **回到距 zone 1 倍屏幕高度内**（band `near`）：回挂：重新 attach source（零网络，blob 仍在内存），元数据就绪后把 seek 追到当前时间轴位置。
- 释放阈值刻意放在回挂阈值之外（双阈值防抖），两阈值之间悬停不会抖动。
- 仅当视频在时间轴上实际执行过 seek 或播放后才会触发释放；未加载播放的视频无需执行释放。

## 预加载与冷启动

`preload`（默认 `true`）积极填充共享视频预加载缓存。缓存命中时渲染器挂载整段 blob objectURL 而非原始 `src`：完整内存 blob 保证可 seek，渐进式网络缓冲不保证，逐帧定位需要前者。

经此预加载的首屏媒体计入冷启动就绪判定，`onReady` 会等待其完全就绪，确保首帧展示时视频资源已准备完毕。已由页面级预加载管线装载的视频可在实例上设 `preload={false}` 退出，避免重复工作。预加载管线见[预加载](/docs/02-preload)。

## drag 模式下

语义照搬：场景元素时间轴驱动 progress，手指位置即 `currentTime`，拖回去即倒放。两个属性是 scroll 专属：`releaseOnLeave` 被忽略（zone 外没有 approach band）；`duration.enter` 按元素时间轴的毫秒计，不再按 px。
