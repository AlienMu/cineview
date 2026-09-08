---
title: 选择模式
eyebrow: GETTING STARTED / CHOOSING A MODE
---

全屏分页、逐场景切换的页面使用 drag。以连续内容为主、局部动画需要随滚动距离变化的页面使用 scroll。

## drag 何时用

- 通过指针手势、键盘或 ref 方法导航。
- 松手后，页面完成切换或返回当前场景。
- 跟随场景的元素时间线随手势推进。默认 `unit: 'time'`、`scale: 10` 时，每拖动 1% 推进 10ms。

## scroll 何时用

- 内容在原生滚动容器中移动，支持滚轮、触控、键盘和滚动条输入。
- 个别场景声明 `scroll={{ zoneId, trigger: 'center-lock' }}`，形成锁定区（locked zone）。进入后，场景内的 Animate 随滚动位置推进。每 1 毫秒的时长预算对应 1 像素滚动距离；反向滚动时，动画进度随之回退。
- 没有声明锁定区的场景就是普通滚动内容，可以夹在锁定区之间。

## 对比表

|               | drag                                                   | scroll                                         |
| ------------- | ------------------------------------------------------ | ---------------------------------------------- |
| 交互模型      | 手势翻页，一屏一幕                                     | 真实文档流 + 局部锁定区                        |
| 时间轴驱动    | 手势进度 + 切换转场                                    | 锁定区内滚动位置（1ms=1px）                    |
| 场景间内容    | 场景即整屏                                             | 普通内容可与锁定区场景混排                     |
| 切换时长      | `transitionDuration` 配置 ref 导航，手势时序随位移计算 | 锁定区时长对应滚动距离                         |
| 回调          | `onDragStart`、`onDragEnd`、`onDragCancel`             | `onZoneEnter`、`onZoneProgress`、`onZoneLeave` |
| CommonJS 入口 | `cineview/drag`                                        | `cineview/scroll`                              |
| 默认性        | 默认模式                                               | `mode="scroll"` 显式开启                       |

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

ES 模块打包器使用 `cineview`，其中包含两套引擎，由 `mode` 选择。按模式子路径支持 CommonJS；应用提供 peer 运行时后，也可通过浏览器脚本加载独立的 UMD 文件。详见[安装](/docs/02-installation)与[性能](/docs/01-performance)。
