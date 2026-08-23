---
title: AnimateVideo
eyebrow: API REFERENCE
---

`<AnimateVideo>` 用时间轴位置驱动原生 `<video>`：drag 或 scroll 的位置直接映射 `currentTime`，反向输入即倒放。它是 `Animate` 的薄封装，零依赖库。本页是全量字段参考；帧擦除语义、终点交接与编码约束见 [AnimateVideo 组件指南](/docs/animate-video)。

## Props

下表逐字段核对自 `src/components/Animate/AnimateVideo.tsx` 的 `AnimateVideoProps`。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `src` | `string` | `必填` | 视频资源 URL。用于擦洗的视频应高密度关键帧——全关键帧才有可预期的反向 seek（约束详见指南）。 |
| `aria-label` | `string` | — | video 元素的无障碍名称。 |
| `width` | `number \| string` | — | 数值经 px2vw 换算；字符串原样透传。 |
| `height` | `number \| string` | — | 换算规则同 `width`。 |
| `style` | `CSSProperties` | — | 其中的长度值由 px2vw 上下文换算。 |
| `preload` | `boolean` | `true` | 是否积极填充共享视频预加载缓存（整段 blob objectURL，保证可 seek）。首屏媒体纳入 `priorityComplete` 冷启动门控。 |
| `poster` | `string` | — | 媒体就绪前的占位帧。 |
| `playbackRate` | `number` | `1` | 作用于原生元素的播放速率（影响终点交接后的尾部播放，不影响擦洗）。 |
| `scrubRange` | `readonly [fromSeconds: number, toSeconds: number]` | — | 由 progress 驱动的视频时间区间；两端钳制到 `[0, duration]`；反向区间合法；终点早于素材结尾才启用终点交接。 |
| `animateId` | `string` | `auto` | 元素标识，供 `waitFor` 引用。 |
| `duration.enter` | `number` | `600` | scrub 跨度。scroll 接管下即真实滚动 px（`1ms = 1px`）。 |
| `duration.exit` | `number` | `600` | 包装层的退场时长。 |
| `enterAnimation` | `AnimationType` | 中性变体 | 包装层动画。默认为中性 `opacity: 1 → 1` 变体，让帧擦洗保持为唯一可见动画；与擦洗共享 `duration.enter` 轴。 |
| `exitAnimation` | `AnimationType` | — | 包装层退场动画。 |
| `timeline.delay` | `number` | `0` | 擦洗窗口的入场延迟（接管下即真实滚动 px）。 |
| `timeline.waitFor` | `string` | — | 等待另一 `animateId` 入场完成后才开始擦洗窗口。 |
| `visibility.replayOnReenter` | `boolean` | `true` | 重新进入视口时从初始帧重放。 |
| `visibility.enterMargin` | `number` | `inherit` | 入场闸门的视口边距（设计 px），继承 `modes.scroll.enterMargin`。 |
| `visibility.exitMargin` | `number` | `inherit` | 退场闸门同理，继承 `modes.scroll.exitMargin`。 |
| `releaseOnLeave` | `boolean` | `false` | 按频带管理解码帧驻留（far 释放 / near 预热，频带语义见指南）。仅 scroll 接管 zone 生效。 |
| `onPlay` / `onPause` / `onEnded` | 事件处理器 | — | 原生媒体回调，经播放所有权门控（见下节）。 |
| `onTimeUpdate` | 事件处理器 | — | 原生回调，直接透传。 |
| `onError` | 事件处理器 | — | 原生错误回调，透传。 |
| `ref` | `HTMLVideoElement` | — | 转发到底层 `<video>` 元素。 |

## 原生媒体回调

原生媒体事件可直接消费：

```tsx
<AnimateVideo
  src="/clip.mp4"
  duration={{ enter: 3000 }}
  onEnded={() => setFinished(true)}
  onPlay={() => setPlaying(true)}
  onPause={() => setPlaying(false)}
/>
```

`onPlay` / `onPause` / `onEnded` 经播放所有权门控：只有提交到当前 source generation 与 activation 的事件才会送达。已释放/已替换 video 节点还在途的事件会被丢弃，不会以幽灵回调的形式冒出来——直接用它们做 UI 状态是安全的，无需自行去重。`onTimeUpdate` 与 `onError` 不经门控、直接透传。

这是事件透传面，不是框架回调面——框架级错误上报走 CineView 的 `onError`（见 [CineView API](/docs/cineview-api)）。

## 类型

### timeline（刻意收窄）

`AnimateVideo.timeline` 不是完整的 `AnimateProps['timeline']`，只有两个字段：`delay` 与 `waitFor`。包装层的 `sceneControlled` 停在默认值（`true`），因此它与其他 `Animate` 一样绑定所在 zone / scene 的轨——不存在用 `sceneControlled: false` 把视频挪到 arrival 轨的用法。

### scrubRange

`readonly [fromSeconds: number, toSeconds: number]` 元组：

- 两端都钳制到 `[0, duration]`；
- 反向区间（`from > to`）合法——progress 沿素材倒着走；
- 不设 `scrubRange` 时 `currentTime = progress × duration`，且没有终点交接（progress 1 只是停在末帧）；
- 终点交接语义（seek 到 `to` 后把所有权交给原生 `play()`、2% 迟滞带收回）见 [组件指南](/docs/animate-video)。

### 共享类型

- `AnimationType`（`enterAnimation` / `exitAnimation` 的类型）→ [类型字典](/docs/types)
- 预加载管线与 `priorityComplete` 冷启动门控（`preload` 的下游）→ [Preload 深度页](/docs/preload)

## 约束注记

- **全关键帧编码是硬约束**。H.264 的 P/B 帧是相对前帧的差分，seek 到任意帧都要从最近关键帧起整段解码；按常见稀疏关键帧编码时每步擦洗都会打满解码线程（反向最长、最糟）。`ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4` 把每帧编成 I 帧——文件变大，但 seek 延迟变平。dev 构建会边擦边测每步 seek 延迟，单源中位数超过 50ms 时告警一次。
- **drag 模式下的两个静默差异**：`releaseOnLeave` 被忽略（接管 zone 之外没有 approach band）；`duration.enter` 按元素轨毫秒读，不再按滚动 px。其余语义照搬。
- **`preload={false}` 的正确用途**：视频已由页面经 CineView 预加载管线装载时，实例上退出以避免重复工作——不是省流量的开关（首次使用的视频应当预加载，整段 blob 才保证可 seek）。

