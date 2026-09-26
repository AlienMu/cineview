---
title: 选择模式
eyebrow: GETTING STARTED / CHOOSING A MODE
---

全屏分页、逐场景切换的页面使用 drag。连续阅读、穿插动画片段的页面使用 scroll。

## 按交互需求选择

| 页面需求                     | 建议模式 | 原因                                                 |
| ---------------------------- | -------- | ---------------------------------------------------- |
| 全屏产品演示或分幕故事       | drag     | 松手后完成翻页或返回当前场景                         |
| 长文章中插入动画片段         | scroll   | 普通内容和锁定区可以连续排列                         |
| 拖动时控制视频或 Canvas      | drag     | 自定义画面可跟随元素动画进度                         |
| 在视频片段内随时停下查看画面 | scroll   | 锁定区进度由滚动位置决定；片段终点后的素材可继续播放 |
| 页面内嵌滑块或独立拖拽画布   | 两者均可 | 可让局部控件自行处理指针输入                         |

`AnimateVideo` 和 `useAnimateTimeline()` 都支持两种模式。选择取决于页面如何导航，视频或绘制组件不要求单独一种模式。

## drag 的手势与松手行为

drag 每幕的导航高度固定为一屏，不能通过 `Scene.layout.height` 编辑或改变。该字段只调整内部内容盒。需要不同高度的页面或连续阅读时，使用 scroll。详见[drag 场景布局](/docs/01-layout)。

拖动时，页面和场景内的动画一起变化。默认配置下，拖动视窗长度的 1% 会推进 10ms 的元素动画。松手速度和位移决定是否切换场景。

场景到达后，尚未完成的元素入场可以继续播放。适合让短手势启动一段较长的演示，详见[页面位移与元素时间线](/docs/03-two-track)。

键盘及 `ref.goToScene()` 也能切换场景。嵌套控件的指针操作见[手势](/docs/02-gestures)。

## scroll 的连续内容与锁定区

普通 Scene 随内容滚动。需要视频逐帧定位或动画随滚动变化时，在对应 Scene 上声明锁定区（locked zone）。其他 Scene 继续用于普通内容。

```tsx
import { AnimateVideo, Cineview, Scene } from 'cineview';

<Cineview mode="scroll" designWidth={750}>
  <Scene sceneId="intro" layout={{ height: '100vh' }}>
    <h1>产品介绍</h1>
  </Scene>
  <Scene sceneId="details" layout={{ height: '100vh' }} scroll={{ zoneId: 'details' }}>
    <AnimateVideo
      src="/clip.mp4"
      aria-label="产品细节展示"
      scrubRange={[0, 6]}
      duration={{ enter: 2400 }}
      width="100%"
    />
  </Scene>
</Cineview>;
```

示例需要一个至少 6 秒的 `/clip.mp4`。锁定区的动画时长决定滚动距离，详见 [center-lock](/docs/01-centerlock)。滚轮、触控、键盘和滚动条都可以改变进度。

## 配置差异

| 配置或行为   | drag                                       | scroll                                           |
| ------------ | ------------------------------------------ | ------------------------------------------------ |
| 默认值       | 省略 `mode` 时启用                         | 显式设置 `mode="scroll"`                         |
| 场景尺寸     | 导航高度固定一屏，不能按 Scene 修改        | 可按内容或视窗设置                               |
| 导航时长     | `transitionDuration` 设置 ref 导航时长     | 锁定区时长决定滚动距离                           |
| 输入回调     | `onDragStart`、`onDragEnd`、`onDragCancel` | `onZoneEnter`、`onZoneProgress`、`onZoneLeave`   |
| 元素独立播放 | `timeline.driver: 'clock'`，场景到达后播放 | `timeline.driver: 'clock'`，满足可见性条件后播放 |

两种模式都可使用动画组合、资源预加载和响应式定位。配置细节见[模式与动画进度](/docs/01-modes)，包入口选择见[安装](/docs/02-installation)。
