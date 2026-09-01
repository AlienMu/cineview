---
title: 选择模式
eyebrow: GETTING STARTED / CHOOSING A MODE
---

核心选型依据：当每屏对应独立的叙事节拍且依靠手势滑动切换时，推荐使用 drag；当页面主体为长文档流且仅局部场景需要锁定滚动以驱动时间轴时，推荐使用 scroll。

## drag 何时用

- 全屏分页体验：一屏一幕，靠手势或 ref 翻页。
- 屏与屏之间没有中间态。一次切换就是一段 800ms（默认）的完整转场。
- 场景元素的时间轴跟随手势进度（`unit: 'time'` 是默认值：每拖 1% 映射 10 个时间单位）。

## scroll 何时用

- 页面主体是普通长文档流，原生滚动、键盘、scrollbar 都按用户预期工作。
- 个别场景声明 `scroll={{ zoneId, trigger: 'center-lock' }}`，成为锁定区（locked zone）。进入锁定区后，滚动去驱动场景内的 Animate 时间轴。时长预算是 1ms=1px 的真实滚动距离，反向滚回时进度从 100% 走回 0%。
- 没有声明锁定区的场景就是普通滚动内容，可以夹在锁定区之间。

## 对比表

|            | drag                                                              | scroll                              |
| ---------- | ----------------------------------------------------------------- | ----------------------------------- |
| 交互模型   | 手势翻页，一屏一幕                                                | 真实文档流 + 局部锁定区             |
| 时间轴驱动 | 手势进度 + 切换转场                                               | 锁定区内滚动位置（1ms=1px）         |
| 场景间内容 | 场景即整屏                                                        | 普通内容可与锁定区场景混排          |
| 切换时长   | 手势位移内置固定为 800ms；`transitionDuration` 仅作用于程序化导航 | 无转场概念；时长预算 = 已滚动像素数 |
| 回调增量   | onDragStart/Commit/Cancel 等                                      | onZoneEnter/Progress/Leave 等       |
| 入口       | `cineview/drag`                                                   | `cineview/scroll`                   |
| 默认性     | 默认模式                                                          | `mode="scroll"` 显式开启            |

## drag 骨架

```tsx
import { CineView, Scene, Animate } from 'cineview';

<CineView designWidth={750} mode="drag" direction="y" transitionDuration={800}>
  <Scene sceneId="beat-1">
    <Animate enterAnimation="fade-in">
      <h1>Beat 1</h1>
    </Animate>
  </Scene>
  <Scene sceneId="beat-2">
    <Animate enterAnimation="fade-in">
      <h1>Beat 2</h1>
    </Animate>
  </Scene>
</CineView>;
```

## scroll 骨架

```tsx
import { CineView, Scene, Animate } from 'cineview';

<CineView designWidth={750} mode="scroll" direction="y" zoneTrigger="center-lock">
  <Scene sceneId="intro">{/* 普通滚动内容 */}</Scene>
  <Scene sceneId="hero" scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}>
    <Animate duration={{ enter: 1200 }} enterAnimation="fade-in">
      <h1>跟随滚动播放的标题</h1>
    </Animate>
  </Scene>
</CineView>;
```

## 入口与包体积

以上示例使用主入口 `cineview`，运行时按 `mode` 选择引擎。按模式子路径只提供 CommonJS 与 UMD 入口，没有 ESM `import` 条件。UMD 单文件不支持代码拆分，因此全量入口会同时包含两套引擎。详见 [安装](/docs/02-installation) 与 [性能](/docs/01-performance)。
