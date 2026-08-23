---
title: AnimateVideo
eyebrow: FRAME SCRUB
---

AnimateVideo 用时间轴位置驱动原生 `<video>`：drag 或 scroll 的位置直接映射 `currentTime`，反向输入即倒放。它是 `Animate` 的薄封装——复用 render-prop 把内部 `enterProgress` 喂给帧渲染器——零依赖库、无控件、恒为静音 + `playsInline`。

## When to use

- 叙事需要「滚动 / 拖拽逐帧擦洗」的视频——位置是输入、帧是输出，而非点播式播放。
- 需要反向倒放（往回滚/往回拖逐帧回去）且不接受「倒放另写一套」的成本时。
- 素材结尾需要按自己的节奏真实播完（终点交接），而不是跟着观众滚动速度走时。

## 帧擦洗语义

外层 `Animate` 拥有 progress（单一写者纪律）；video 以纯 MotionValue 消费它，没有每帧 React state。位置是输入，帧是输出：

- 不设 `scrubRange` 时 `currentTime = progress × duration`——progress 0 即首帧，progress 1 即末帧。
- 反向输入即倒放。往回拖、往回滚都会逐帧 seek 回去；不存在需要单独编写的「倒放模式」。
- 包装层是普通的 `Animate`，因此 `timeline.delay` / `waitFor` / visibility 门控与其他元素一样作用于擦洗窗口。

```tsx
<AnimateVideo
  src="/clip.mp4"
  duration={{ enter: 2000 }}
  timeline={{ delay: 100, waitFor: 'intro' }}
  visibility={{ replayOnReenter: true }}
/>
```

## scrubRange 与终点交接

`scrubRange` 把时间轴映射到视频时间的一个显式区间，而非整个素材：

```tsx
<AnimateVideo
  src="/clip.mp4"
  scrubRange={[1.2, 4.8]}
  duration={{ enter: 3600 }}
/>
```

- 两个端点都钳制到 `[0, duration]`；**反向区间**（`from > to`）合法——progress 沿素材倒着走。
- 当区间终点早于素材结尾时，擦洗到达区间终点会做一件刻意设计的事：框架先 seek 到 `to`，再把单一写者所有权交给原生播放（`play()`）——素材尾部作为真实视频播完。往回滚出终点带（2% 迟滞）后框架收回 scrub 所有权：暂停、seek、恢复擦洗。
- 不设 `scrubRange` 就没有可交接的尾部——progress 1 只是停在末帧。
- 退场帧会锁存 outgoing：原生播放被暂停，元素冻结。

之所以要有交接：擦洗中的视频是**位置驱动**的媒介，而结尾是**时间驱动**的——素材最后几秒应该按自己的节奏走，而不是跟观众的滚动速度。

把数字走一遍：8 秒素材、`scrubRange={[1.2, 4.8]}`、`duration={{ enter: 3600 }}`。progress 0.5 seek 到 `1.2 + 0.5 × 3.6 = 3.0s`。progress 1 seek 到 4.8s 并交接——剩余 3.2 秒原生播完。往回滚到 0.9（低于 2% 迟滞带）时框架暂停尾部、收回 scrub、seek 回 `1.2 + 0.9 × 3.6 = 4.44s`。

## duration.enter 即 scrub 跨度

`duration.enter` 不是「视频时长」，而是擦洗占据多少时间轴。scroll 接管下 `1ms = 1px` 逐字成立：`duration={{ enter: 2000 }}` 意味着视频在 2000px 真实滚动（典型移动端页面的两个视口）内擦完。drag 模式下则是 2000ms 的元素轨时间。

包装层动画共用同一条轴：`enterAnimation`（默认是中性的 `opacity: 1 → 1` 变体，让帧擦洗保持为唯一可见动画）与帧擦洗共享同一个 `duration.enter`——两者互不挤占。

`AnimateVideo.timeline` 是刻意收窄的类型：只有 `delay` 与 `waitFor`。包装层的 `sceneControlled` 停在默认值（`true`），因此它与其他 `Animate` 一样绑定所在 zone/scene 的轨。

一个完整的接管 zone 示例，即站点自己的视频场景所用形态：

```tsx
<Scene sceneId="act-video" scroll={{ zoneId: 'act-video-seq', trigger: 'center-lock' }}>
  {/* The wrapper's enterAnimation only styles the wrapper layer; frame scrubbing
      is driven by the internal enterProgress — both share the duration.enter axis. */}
  <AnimateVideo
    src="/video.mp4"
    animateId="act-video"
    duration={{ enter: 4000 }}
    timeline={{ waitFor: 'act-title', delay: 0 }}
    releaseOnLeave
    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
  />
</Scene>
```

## drag 模式下

以上语义全部照搬：包装层是 scene-controlled 的 `Animate`，场景的元素轨驱动 progress——手指在场景 settle 跨度上的位置即 `currentTime`，拖回去即倒放。有两个属性是 scroll 专属，在 drag 下静默无效：

- `releaseOnLeave` 被忽略（scroll 接管 zone 之外没有 approach band）。
- `duration.enter` 按元素轨毫秒读，不再按滚动 px。

## 擦洗视频必须全关键帧编码

这是硬约束，不是建议。H.264 的 P/B 帧是相对前帧的差分，seek 到任意帧都要从最近的关键帧起整段解码。按常见的稀疏关键帧（约每 250 帧一个）编码时，每一步擦洗都会打满解码线程、掉帧——反向最长、最糟。

把每一帧都编成 I 帧：

```bash
ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4
```

代价是文件变大——每帧自包含——但任意帧都可直接解码，seek 延迟变平。dev 构建会边擦边测每步 seek 延迟，单源中位数超过 50ms 时告警一次，让错编码的视频在开发期而不是线上暴露。

## releaseOnLeave：解码帧驻留

被擦洗过的 `<video>` 在滚过之后仍保留解码帧与 GPU 纹理——实测证据表明它们会让观众**接下来到达**的场景可测量地掉帧。`releaseOnLeave`（默认 `false`）管理这份驻留，仅 scroll 接管 zone 生效（drag 模式与 zone 外被忽略）：

- **far**——离开 zone 超过 1.5 个视口：释放。`pause` + 摘除 `src` + `load()` 丢弃解码帧；内存中的 blob 租约保留。
- **near**——回到距 zone 1 个视口内：预热。重新挂上 source（零网络——blob 仍在内存），元数据就绪后把 pending 的 seek 追到当前时间轴位置。
- 释放阈值刻意放在预热阈值之外（Schmitt 排序），在两阈值之间悬停不会抖动。
- 只有时间轴真正被擦洗或播放过至少一次后才可能释放——没看过的视频没有值得释放的驻留。

## 预加载与冷启动

`preload`（默认 `true`）积极填充共享视频预加载缓存。缓存命中时，渲染器挂载的是整段 blob objectURL 而非原始 `src`——完整的内存 blob 保证可 seek，这正是帧擦洗需要的（渐进式网络缓冲不保证）。

两个推论：

- 这样预加载的首屏媒体纳入 `priorityComplete` 冷启动门控——`onReady` 会等它，而不是亮出一个缓冲了一半的视频。
- 已由页面经 CineView 预加载管线装载的视频，可在实例上以 `preload={false}` 退出，避免重复工作——站点的视频场景正是这么写的，依赖页面级预加载。

## 原生媒体回调

`onPlay` / `onPause` / `onEnded` / `onTimeUpdate` / `onError` 透传给底层 `<video>`。前三个经播放所有权门控——已释放/已替换节点还在途的事件会被丢弃，直接拿它们做 UI 状态是安全的。字段表与门控语义见 [AnimateVideo API](/docs/animate-video-api)。

---

完整字段参考见 [AnimateVideo API](/docs/animate-video-api)。
