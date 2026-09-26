---
title: center-lock 滚动
eyebrow: SCROLL / CENTER-LOCK
---

普通内容随页面移动。进入锁定区后，场景暂时保持居中，继续滚动会推进场景内的动画。动画结束后，页面接着向下移动；反向滚动可以回看刚才的动画。

给 `Scene` 声明 `scroll`，即可创建锁定区（locked zone）。锁定区需要至少一个有时长、跟随场景进度的入场或退场动画。可以在[快速上手](/docs/03-quickstart)中操作案例，观察三幕的区别。

## 从普通内容进入锁定区

下面的三幕依次展示普通内容、锁定区和继续阅读。只有中间的 `Scene` 声明 `scroll`；首尾两幕没有额外的动画区间。

```tsx
import { Animate, Cineview, Scene } from 'cineview';

export function ScrollReadingExample() {
  return (
    <Cineview mode="scroll" designWidth={750}>
      <Scene sceneId="intro" layout={{ height: '100vh' }}>
        <section style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <Animate
            enterAnimation={{ initial: { opacity: 0, y: 36 }, animate: { opacity: 1, y: 0 } }}
            duration={{ enter: 1400 }}
            timeline={{ driver: 'clock' }}
          >
            <h1>先像平常一样阅读</h1>
          </Animate>
        </section>
      </Scene>

      <Scene sceneId="details" layout={{ height: '100vh' }} scroll={{ zoneId: 'details' }}>
        <section style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
            <h1>画面留在这里</h1>
          </Animate>
          <Animate
            animateId="detail"
            enterAnimation="fade-in"
            duration={{ enter: 400 }}
            timeline={{ after: 'title', delay: 100 }}
          >
            <p>继续滚动，下一句才会出现。</p>
          </Animate>
        </section>
      </Scene>

      <Scene sceneId="outro" layout={{ height: '100vh' }}>
        <section style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <Animate
            enterAnimation={{ initial: { opacity: 0, y: 36 }, animate: { opacity: 1, y: 0 } }}
            duration={{ enter: 1400 }}
            timeline={{ driver: 'clock' }}
          >
            <h1>接着往下读</h1>
          </Animate>
        </section>
      </Scene>
    </Cineview>
  );
}
```

中间一幕到达视窗中央后，前 600 px 的滚动距离让标题淡入；再滚动 100 px 后，说明文字开始淡入，持续 400 px。停下时画面停在当前进度，向上滚动则沿原路回退。走完这 1100 px 后，下一幕继续随页面移动。

## 不随滚动推进的常规入场

首尾两幕的标题使用 `timeline={{ driver: 'clock' }}`。满足可见性条件后，它们用 1400ms 完成淡入和位移。停止滚动不会暂停这段入场，回滚也不会逐帧倒放它。

普通 Scene 中，省略 `driver` 也会使用可见性入场。示例明确写出 `clock`，便于与中间的滚动动画比较。在锁定区中，默认动画跟随滚动；单个 Animate 声明 `clock` 后仍可独立入场，它的时长不增加锁定距离。

默认重新进入时可以重播。用 `visibility.replay` 和入退场边距调整行为，见[可见性条件](/docs/03-visibility-conditions)。

## 让标题和视频依次跟随滚动

```tsx
<Cineview designWidth={750} mode="scroll" direction="y">
  <Scene sceneId="product" scroll={{ zoneId: 'product' }}>
    <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
      <h1>滚动查看产品细节</h1>
    </Animate>
    <AnimateVideo
      src="/product.mp4"
      duration={{ enter: 2000 }}
      timeline={{ after: 'title' }}
      aria-label="产品演示"
    />
  </Scene>
</Cineview>
```

锁定期间，前 600 px 用于标题淡入，接下来的 2000 px 用于视频从头到尾逐帧定位。滚动总距离为 2600 px，与视频文件自身的播放时长无关。

`AnimateVideo.scrubRange` 可以指定视频片段，单位为秒。片段终点之后的播放行为与编码建议见 [AnimateVideo](/docs/04-animate-video)。需要自定义 canvas 或其他绘制时，在 `Animate` 子组件中订阅 [useAnimateTimeline](/docs/09-use-animate-timeline) 的进度。

## 场景何时开始居中

场景中心到达视窗中心时开始锁定。竖向滚动按高度和 `scrollTop` 计算，横向滚动按宽度和 `scrollLeft` 计算。

| 量                 | 公式                                                     | 含义                       |
| ------------------ | -------------------------------------------------------- | -------------------------- |
| `visualSpan`       | 声明的 `vh`/`vw` 长度，否则使用 DOM 实测值               | 场景在滚动方向上的可见尺寸 |
| `centerLockOffset` | `max(sceneStart + visualSpan / 2 - viewportSpan / 2, 0)` | 开始锁定的滚动位置         |
| `segmentStart`     | `centerLockOffset`                                       | 锁定区起点                 |
| `segmentEnd`       | `centerLockOffset + totalBudgetPx`                       | 锁定区终点                 |

场景实际内容放在 sticky 容器中。框架根据场景与视窗尺寸的差异调整位置，使大于或小于视窗的场景都按这个公式居中。

## 动画时长决定滚动距离

锁定区按 `1ms = 1px` 把动画时长换算成滚动距离，称为时长预算。场景在文档中占用的总距离还包含内容本身：

```text
flowSpan = max(visualSpan, viewportSpan) + totalBudgetPx
```

时长预算的计算，以及没有入退场动画时的行为，见[锁定区与时长预算](/docs/02-zones-budget)。

## 滚动位置决定动画进度

竖向滚动中的 `nativeOffset` 是 `scrollTop`，横向是 `scrollLeft`：

```text
progressPx = clamp(nativeOffset - segmentStart, 0, totalBudgetPx)
```

反向滚动时，进度沿同一区间递减。尺寸或布局变化会重新计算区间，进度随新的滚动位置更新。

距离起点或终点不足 0.01 px 时，进度直接取零或满值，避免浮点误差影响首尾帧。

## 快速输入会在锁定区内停下

一次滚轮、触控、键盘或滚动条输入可能请求跨过整个锁定区。Cineview 会限制这次移动的目标位置：

| 情形                         | 最终位置                            |
| ---------------------------- | ----------------------------------- |
| 正向从区间外跨过整段         | `min(segmentStart + 1, segmentEnd)` |
| 正向已在区间内，目标越过终点 | `segmentEnd`                        |
| 反向从区间外跨过整段         | `max(segmentEnd - 1, segmentStart)` |
| 反向已在区间内，目标越过起点 | `segmentStart`                      |

到达终点后，下一次输入可以继续移动。普通场景不受这项限制。只有长度超过 0.5 px 的锁定区参与限制。

## 跳转到锁定区起点

scroll 模式的 ref 提供 `goToZone`：

```tsx
import { useRef } from 'react';
import { AnimateVideo, Cineview, Scene } from 'cineview';
import type { CineviewScrollRef } from 'cineview';

export function ProductPage() {
  const ref = useRef<CineviewScrollRef>(null);

  return (
    <>
      <button onClick={() => ref.current?.goToZone('product', { animated: true })}>查看产品</button>
      <Cineview mode="scroll" ref={ref}>
        <Scene sceneId="intro">介绍</Scene>
        <Scene scroll={{ zoneId: 'product' }}>
          <AnimateVideo src="/product.mp4" duration={{ enter: 2000 }} />
        </Scene>
      </Cineview>
    </>
  );
}
```

| 选项       | 类型       | 默认   | 说明                             |
| ---------- | ---------- | ------ | -------------------------------- |
| `animated` | `boolean`  | `true` | 平滑滚动；false 时立即定位       |

跳转位置为 `centerLockOffset`，即进度为零的位置。程序化导航可经过中间的锁定区到达指定目标。中途输入如何停止平滑滚动，见[滚轮、触控、键盘与滚动条](/docs/03-inputs)。

## 读取锁定区状态

在 `Cineview.callbacks` 中配置以下 scroll 专属回调：

| 回调             | 参数                               | 触发条件                                    |
| ---------------- | ---------------------------------- | ------------------------------------------- |
| `onZoneEnter`    | `{ zoneId, sceneIndex }`           | 锁定区变为活动状态                          |
| `onZoneProgress` | `{ zoneId, sceneIndex, progress }` | 相对上次上报位置移动超过 0.5 px，或到达端点 |
| `onZoneLeave`    | `{ zoneId, sceneIndex }`           | 锁定区不再处于活动状态                      |

`progress` 为 `progressPx / totalBudgetPx`，范围是 0 到 1。首帧也会上报进度。

滚动位置位于区间内部、且距离两端都超过 0.5 px 时，锁定区处于活动状态。完整参数定义见[回调](/docs/03-callbacks)。

## 相关页面

- [锁定区与时长预算](/docs/02-zones-budget)：时长、依赖与进度区间
- [滚轮、触控、键盘与滚动条](/docs/03-inputs)：输入规则与嵌套滚动
- [场景内的固定元素](/docs/04-fixed-layer)：固定操作栏与进度指示器
- [scroll 排错](/docs/06-scroll-pitfalls)：常见问题与修改方法
