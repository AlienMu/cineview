---
title: 页面位移与元素时间线
eyebrow: DRAG / TIMELINES
---

拖拽既能切换场景，也能推进场景内的预设动画、视频画面和自定义绘制。页面到达目标位置时完成场景切换，尚未完成的元素入场动画会继续播放。

想先看到两幕同时出现、标题随手势推进的过程，可以试[快速上手](/docs/03-quickstart)中的拖拽案例。

## 用拖拽控制视频画面

`AnimateVideo` 的画面跟随元素进度。使用 `unit="percent"`、`scale={1}`，可让拖拽比例对应目标场景时间线的比例：

```tsx
<Cineview mode="drag" designWidth={750} unit="percent" scale={1}>
  <Scene sceneId="intro">
    <h1>向上拖动，查看产品</h1>
  </Scene>
  <Scene sceneId="product">
    <AnimateVideo src="/product.mp4" duration={{ enter: 2000 }} aria-label="产品演示" />
  </Scene>
</Cineview>
```

目标场景只有这段视频动画时，拖到一半会定位到视频的一半。反向移动会回退画面。松手后是否继续切换，由[手势阈值](/docs/02-gestures)决定。

`duration.enter` 设置元素时间线时长。视频自身的时长来自媒体文件。需要限定视频片段时，使用 `scrubRange`，其单位为秒；片段结束后的播放规则见 [AnimateVideo](/docs/04-animate-video)。

## 场景总时长取最晚结束的子元素

跟随场景的子元素决定时间线总时长：

```text
场景元素总时长 = max(累计延迟 + 入场时长)
```

`timeline.after` 让一个元素等待另一个元素入场完成。搭配 `duration` 与 `timeline.delay`，可以把不同预设排成连续动画：

```tsx
<Scene sceneId="details">
  <Animate
    animateId="title"
    enterAnimation="fade-in"
    duration={{ enter: 600 }}
    timeline={{ delay: 100 }}
  >
    <h2>产品细节</h2>
  </Animate>
  <Animate
    enterAnimation="slide-up"
    duration={{ enter: 400 }}
    timeline={{ after: 'title', delay: 100 }}
  >
    <p>标题出现后，再显示说明。</p>
  </Animate>
</Scene>
```

这个场景的元素时间线为 1200 ms。没有跟随场景的子元素动画时，总时长为零，页面仍能正常切换。单个元素组合多个预设的写法见[动画预设](/docs/08-presets)。

## 在几个位置停住，观察时间线

给这个例子设置 `unit="percent" scale={1}`，目标 Scene 的时间线与拖拽比例对应：

| 拖拽距离 | 元素时间 | 目标 Scene 的画面                             |
| -------- | -------- | --------------------------------------------- |
| 25%      | 300ms    | 标题从 100ms 开始，已播放 200ms；说明尚未开始 |
| 50%      | 600ms    | 标题已播放 500ms；说明尚未开始                |
| 75%      | 900ms    | 标题已完成；说明从 800ms 开始，已播放 100ms   |
| 100%     | 1200ms   | 标题与说明均已完成                            |

在 50% 处停住，画面停在 600ms。向回拖到 25%，画面回到 300ms。若在 50% 处松手并确认切换，元素从 600ms 继续播放，剩余 600ms；页面按自己的转场时长完成移动。快划影响是否确认切换，拖拽期间的元素时间仍由位移决定。

## 调整拖拽距离与播放进度的关系

`unit` 与 `scale` 控制拖拽距离如何推进元素时间线。默认配置按毫秒推进，`percent` 配置按场景时间线的百分比推进。换算公式与场景覆盖规则见[手势与阈值](/docs/02-gestures)。

各 Scene 的元素时间线相互独立。短动画可以先结束，长动画继续播放。

## 场景切换期间

进场 Scene 中带延迟的元素在开始时间之前保持初始帧。松手提交切换后，动画从当前位置继续；取消时，动画返回初始状态。

离场 Scene 的画面跟随页面位移，反向拖拽会让位移回退。页面切换完成不会中断仍在入场的元素。

## 让自定义绘制跟随动画

在 `Animate` 的子组件中调用 `useAnimateTimeline()`，可以读取该元素的进度 MotionValue。canvas 可绘制一次，再通过 `progress.on('change', draw)` 随进度重绘，并在卸载时取消订阅。完整示例见 [useAnimateTimeline](/docs/09-use-animate-timeline)。

需要自行处理拖拽的 canvas 或滑块，可添加 `data-cineview-ignore-drag`。这样，控件内的按压不会触发场景导航。输入规则见[手势与阈值](/docs/02-gestures)。

## 读取提交时的剩余动画时间

`onDragEnd` 中的 `elapsedMs` 与 `timelineDurationMs` 描述目标 Scene 在提交时的元素时间线。总时长减去已播放时长，就是当时剩余的入场时间。后续进度使用 `useAnimateTimeline()` 订阅。

回调触发时机见 [drag 回调时序](/docs/05-callbacks)，滚动驱动的动画见 [center-lock 滚动](/docs/01-centerlock)。
