---
title: 快速上手
eyebrow: GETTING STARTED / QUICKSTART
---

完成[安装](/docs/02-installation)后，将任一示例用作应用的 `App.tsx`。两个例子只使用文字和基础动画，不需要图片或视频素材。

`Cineview` 选择交互模式，`Scene` 划分页面内容，`Animate` 描述元素怎样出现。先体验两种模式，再对照代码修改时长和顺序。

## 拖拽切换场景

在案例中向上拖动。底部显示拖拽比例、第二个场景的元素时间，以及停住后松手的结果。拖到 20% 后停住再松手会还原；超过 30% 后停住再松手会切换。到达第二个场景后，向下拖动可返回。

<!-- preview:drag -->

```tsx
import { Animate, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="drag" unit="percent" scale={1}>
      <Scene sceneId="intro" style={{ background: '#f5e8d8', padding: 40 }}>
        <h1>向上拖动，进入下一个场景</h1>
      </Scene>
      <Scene sceneId="details" style={{ background: '#e8edf0', padding: 40 }}>
        <Animate animateId="title" enterAnimation="fade-in"
          duration={{ enter: 600 }} timeline={{ delay: 100 }}>
          <h2>标题先出现</h2>
        </Animate>
        <Animate enterAnimation="slide-up" duration={{ enter: 400 }}
          timeline={{ after: 'title', delay: 100 }}>
          <p>说明接在标题之后。</p>
        </Animate>
      </Scene>
    </Cineview>
  );
}
```

目标场景的标题从 100ms 开始，持续 600ms。说明通过 `after: 'title'` 接在标题后，再延迟 100ms，从 800ms 开始，持续 400ms。总时长为 1200ms。

`unit="percent" scale={1}` 让拖拽比例对应这段时间线的比例。拖到一半时，元素时间是 600ms：标题还在入场，说明尚未开始。确认切换后，未完成的动画从这里继续；取消切换时还原。

快速释放能降低切换所需的位移，快速反向释放会取消。完整判定见[手势与阈值](/docs/02-gestures)。

## 随滚动推进动画

首尾是普通页面内容，中间一幕声明 `scroll`。首幕标题按时间淡入，即使不滚动也会继续；中间的动画跟随滚动，停止滚动就停在当前帧，向上滚动则倒退。

<!-- preview:scroll -->

```tsx
import { Animate, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="scroll">
      <Scene sceneId="intro" layout={{ height: '100vh' }}
        style={{ background: '#f5e8d8', padding: 40 }}>
        <Animate enterAnimation="fade-in" duration={{ enter: 1400 }}
          timeline={{ driver: 'clock' }}>
          <h1>标题自行淡入，不需要滚动</h1>
        </Animate>
      </Scene>
      <Scene sceneId="details" scroll={{}}
        layout={{ height: '100vh' }} style={{ background: '#e8edf0', padding: 40 }}>
        <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
          <h2>继续滚动，标题才会出现</h2>
        </Animate>
        <Animate enterAnimation="slide-up" duration={{ enter: 400 }}
          timeline={{ after: 'title', delay: 100 }}>
          <p>再滚动一段，说明出现。</p>
        </Animate>
      </Scene>
      <Scene sceneId="outro" layout={{ height: '100vh' }}
        style={{ background: '#f5e8d8', padding: 40 }}>
        <h2>继续阅读</h2>
      </Scene>
    </Cineview>
  );
}
```

`scroll={{}}` 使用所在 Scene 的标识，创建锁定区。标题占 600px 的滚动距离，随后等待 100px，说明再占 400px，总共 1100px。这里 1ms 对应 1px 真实滚动距离。

`driver: 'clock'` 让首幕标题独立按时间播放。在普通 Scene 中也可以省略它；明确填写有助于区分两种播放方式。clock 动画不增加锁定区的滚动距离。

## 继续学习

- [模式与动画进度](/docs/01-modes)：理解拖拽、滚动和时间怎样推进同一段动画。
- [动画组合与顺序](/docs/04-orchestration)：调整 `after` 依赖和多个元素的播放顺序。
- [用拖拽和滚动控制视频](/docs/11-video-timeline)：在进阶示例中加入视频。
- [Cineview 参考](/docs/01-cineview)：需要调整配置或接收通知时查阅。
