---
title: 用拖拽和滚动控制视频
eyebrow: ADVANCED / VIDEO
---

向上拖动进入第二幕，视频与文字沿同一段时间线前进。在两幕之间停住，再前后移动，可以看到视频逐帧前进和倒退。松手确认切换后，未完成的动画接着播放。完全进入后再向下拖回上一幕，视频也会随手势回退；反向移动或取消返回，画面会恢复。

<!-- preview:video -->

## 准备视频

完成[安装](/docs/02-installation)，下载[案例视频](/act3-edit.mp4)并保存到应用的 `public/act3-edit.mp4`。该素材约 10 秒；也可以替换为自己的视频。关键帧较密时，反向拖动通常更顺畅，编码建议见 [AnimateVideo](/docs/04-animate-video)。

## 创建两个场景

下面的代码使用与案例相同的动画时长和顺序。页面中的“重新体验”按钮和排版样式仅用于演示。

```tsx
import { Animate, AnimateVideo, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="drag" unit="percent">
      <Scene sceneId="intro">
        <div style={{ height: '100dvh', display: 'grid', placeItems: 'center' }}>
          <h1>向上拖动，查看下一幕</h1>
        </div>
      </Scene>
      <Scene sceneId="film" assets={{ preloadImages: ['/act3-edit.mp4'] }}>
        <AnimateVideo
          src="/act3-edit.mp4"
          aria-label="光影剪辑演示"
          duration={{ enter: 1000 }}
          width="100%"
          height="54dvh"
          style={{ objectFit: 'cover' }}
        />
        <div style={{ padding: 24 }}>
          <Animate
            animateId="detail-title"
            enterAnimation="fade-in"
            duration={{ enter: 600 }}
            timeline={{ delay: 100 }}
          >
            <h2>光影之间</h2>
          </Animate>
          <Animate
            enterAnimation="fade-in"
            duration={{ enter: 400 }}
            timeline={{ after: 'detail-title', delay: 100 }}
          >
            <p>标题先出现，说明随后淡入。</p>
          </Animate>
        </div>
      </Scene>
    </Cineview>
  );
}
```

目标场景的元素时间线共 1200ms。标题从 100ms 开始，播放 600ms 后在 700ms 结束。说明接在标题之后，再延迟 100ms，因此从 800ms 开始。视频从 0ms 开始，持续 1000ms。这三个元素读取同一段已播放时间，各自只在自己的区间变化。

`unit="percent"` 使用默认的 `scale={1}`，让拖拽比例对应这段 1200ms 时间线的比例。拖到一半，元素时间来到 600ms：视频到达完整片长的 60%，标题接近完成，说明尚未开始。若此时松手并确认切换，动画从 600ms 继续，走到 800ms 时说明才淡入。取消切换时，目标场景返回初始画面。

完全进入第二幕后，可以再向下拖动，让视频从当前画面退回开头。拖到一半再向上移动，视频会向离场前的位置恢复。短距离拖动后停住再松手，可取消返回；原本正在自动播放的视频会恢复播放，原本暂停的视频保持暂停。返回过程使用 `duration.exit`，默认 600ms，无需额外声明 `exitAnimation`。前往后一个场景时，视频仍暂停并保留当前帧。

省略 `scrubRange` 时，视频的完整片长映射到 1000ms 入场区间，视频秒数和动画毫秒数分别控制素材范围与手势推进速度。只需控制其中一段时，可以设置 `scrubRange={[2, 6]}`；到达第 6 秒后，剩余内容会自动接着播放。

`assets.preloadImages` 把视频加入场景资源队列。该视频属于第二幕，会在后台准备；它不延长首幕的等待。详见[预加载](/docs/02-preload)。

## 改为随滚动控制视频

下面是独立的滚动版 `App`。在视频场景上声明 `scroll`，滚动位置就会控制视频画面：

```tsx
import { AnimateVideo, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="scroll">
      <Scene sceneId="intro" layout={{ height: '100vh' }}>
        <h1>向下滚动，观看视频</h1>
      </Scene>
      <Scene
        sceneId="film"
        layout={{ height: '100vh' }}
        scroll={{ zoneId: 'film' }}
        assets={{ preloadImages: ['/act3-edit.mp4'] }}
      >
        <AnimateVideo
          src="/act3-edit.mp4"
          aria-label="光影剪辑演示"
          duration={{ enter: 2400 }}
          width="100%"
        />
      </Scene>
    </Cineview>
  );
}
```

视频在锁定区的 2400px 滚动距离内从第一帧前进到最后一帧。区间内部停止滚动时，视频停在当前帧；向上滚动时，视频倒退。`duration.enter` 决定滚动距离，视频片长决定播放的内容范围。

## 扩展这个示例

- 用 [useAnimateTimeline](/docs/09-use-animate-timeline) 将相同进度用于 Canvas 或 SVG。
- 想叠加更多预设，或让说明文字接在视频后出现，见[动画组合与顺序](/docs/04-orchestration)。
- 要显示加载进度，见[预加载](/docs/02-preload)。
- 要在场景内加入独立拖动的滑块或画布，见[手势与阈值](/docs/02-gestures)。
