# CineView

[English](./README.md)

[![npm 版本](https://img.shields.io/npm/v/cineview?style=flat-square&color=8A5B43)](https://www.npmjs.com/package/cineview)
[![CI](https://github.com/AlienMu/cineview/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/AlienMu/cineview/actions/workflows/ci.yml)
[![React 19](https://img.shields.io/badge/React-19-287EA3?style=flat-square)](https://react.dev/)
[![MIT 许可证](https://img.shields.io/npm/l/cineview?style=flat-square)](./LICENSE)

CineView 是用于构建交互式产品展示、全屏演示和滚动叙事页面的 React 框架。它通过组件 API 组织场景导航、动画编排、响应式定位和媒体播放。

页面由多个 `Scene` 组件组成。每个场景承载普通 React 内容，并声明布局和动画。CineView 将这些场景与拖动或滚动操作关联，让页面导航与场景内的动画协同工作。

[官网](https://cineview.pages.dev) · [文档](https://cineview.pages.dev/docs) · [拖动演示](https://cineview.pages.dev/drag) · [npm](https://www.npmjs.com/package/cineview)

## 适用场景

- 通过多个动画章节介绍内容的产品页和品牌官网。
- 使用纵向或横向拖动导航的全屏演示与作品集。
- 在正常阅读内容中加入滚动控制的插画、图形和视频的叙事页面。

CineView 使用 Framer Motion 实现动画，可配合已有的 React 组件、CSS 布局和自定义图形使用。页面内容结构和视觉设计由应用决定。

## 核心能力

- **场景与导航。** 将页面组织为多个章节，配置各自的尺寸和转场，选择拖动或滚动导航。拖动页面支持鼠标、触摸和键盘操作；滚动页面使用真实的滚动容器。
- **动画编排。** 使用预设或自定义属性动画，通过 `timeline.after` 连接入场顺序、设置延迟、组合并行动画。逐项入场、循环和退场效果分别用于场景展示的不同阶段。
- **响应式定位。** 在 CSS 布局中配合 `Position` 和 `Container`，按设计坐标放置内容。`designWidth` 让数值型设计长度随视口宽度缩放，需要重新排版的内容仍可使用 CSS 单位和断点。
- **图片与视频。** 声明需要预加载的图片，复用共享图片缓存。`AnimateVideo` 可以让视频帧跟随动画进度，也支持场景内的普通视频播放。
- **自定义绘制。** `useAnimateTimeline` 以 MotionValue 提供动画进度，用于自定义 DOM、SVG 和 Canvas 组件。连续更新无需把每一帧写入 React state。
- **应用控制。** 通过 ref 导航、响应场景与动画回调，并在内容变化后刷新布局。`cineview/dev` 提供可选的性能面板和指标 Hook。

## 安装

在 React 19 项目中安装 CineView 和 Framer Motion 13：

```bash
npm install cineview framer-motion@13
```

使用 pnpm：

```bash
pnpm add cineview framer-motion@13
```

CineView 1.0.0 要求 React `^19.0.0`、React DOM `^19.0.0` 和 Framer Motion `^13.0.0`。主包提供 TypeScript 类型声明，支持 ESM 和 CommonJS。包入口和开发工具的用法见[安装指南](https://cineview.pages.dev/docs/02-installation)。

## 快速开始

以下两个示例都是完整的应用组件，可任选一个作为 React 项目的 `App.tsx`。示例使用内联样式，无需额外的样式表或媒体文件。

### 拖动切换场景

这个页面包含两个全屏场景。第一个场景依次展示标题和说明，拖动后进入第二个场景。

```tsx
import type { CSSProperties } from 'react';
import { Animate, CineView, Scene } from 'cineview';

const panel: CSSProperties = {
  boxSizing: 'border-box',
  height: '100%',
  display: 'grid',
  placeContent: 'center',
  padding: '2rem',
  textAlign: 'center',
};

export default function App() {
  return (
    <CineView mode="drag" designWidth={750} a11y={{ label: 'Product introduction' }}>
      <Scene sceneId="introduction">
        <div style={{ ...panel, background: '#f7f2ec' }}>
          <Animate animateId="heading" enterAnimation="fade-in" duration={{ enter: 600 }}>
            <h1>Meet the new collection</h1>
          </Animate>
          <Animate
            enterAnimation="slide-up"
            duration={{ enter: 400 }}
            timeline={{ after: 'heading' }}
          >
            <p>Designed for everyday use.</p>
          </Animate>
        </div>
      </Scene>

      <Scene sceneId="details">
        <div style={{ ...panel, background: '#e8edf0' }}>
          <Animate enterAnimation="fade-in" duration={{ enter: 600 }}>
            <h2>Explore the details</h2>
          </Animate>
        </div>
      </Scene>
    </CineView>
  );
}
```

`CineView` 控制导航，`Scene` 定义页面章节，`Animate` 定义元素动画。`timeline.after` 让说明文字在标题入场后出现。默认沿纵向拖动，设置 `direction="x"` 可改为横向展示。CineView 容器获得焦点后，也可使用键盘导航。

### 跟随滚动进度

滚动模式让内容保留在文档流中。配置了 `scroll` 的场景会停留在视口中央，由滚动推进动画；前后的场景继续作为普通页面章节显示。

```tsx
import type { CSSProperties } from 'react';
import { Animate, CineView, Scene } from 'cineview';

const panel: CSSProperties = {
  boxSizing: 'border-box',
  height: '100%',
  display: 'grid',
  placeContent: 'center',
  padding: '2rem',
  textAlign: 'center',
};

export default function App() {
  return (
    <CineView mode="scroll" designWidth={750}>
      <Scene sceneId="introduction" layout={{ height: '100vh' }}>
        <div style={panel}>
          <h1>Every detail has a story</h1>
        </div>
      </Scene>

      <Scene
        sceneId="details"
        layout={{ height: '100vh' }}
        scroll={{ zoneId: 'details', trigger: 'center-lock' }}
      >
        <div style={{ ...panel, background: '#f7f2ec' }}>
          <Animate
            enterAnimation={{
              initial: { opacity: 0, y: 60 },
              animate: { opacity: 1, y: 0 },
            }}
            duration={{ enter: 1600, exit: 0 }}
            timeline={{ driver: 'scene' }}
          >
            <h2>Reveal it as the page scrolls</h2>
          </Animate>
        </div>
      </Scene>

      <Scene sceneId="closing" layout={{ height: '100vh' }}>
        <div style={panel}>
          <h2>Continue exploring</h2>
        </div>
      </Scene>
    </CineView>
  );
}
```

详情动画对应 1,600 个 CSS 像素的滚动距离：声明时长的每 1 毫秒对应 1 像素滚动距离。反向滚动会反向播放动画。场景的可见高度与这段距离分别配置。

未配置 `scroll` 的场景仍可包含根据可见性触发的动画。[模式选择](https://cineview.pages.dev/docs/04-choosing-mode)和[滚动指南](https://cineview.pages.dev/docs/01-centerlock)介绍了不同交互的适用方式。

## 深入了解

| 主题                   | 指南                                                                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 页面结构与导航         | [CineView](https://cineview.pages.dev/docs/01-cineview) 和 [Scene](https://cineview.pages.dev/docs/02-scene)                                                                      |
| 预设、自定义动画与编排 | [Animate](https://cineview.pages.dev/docs/03-animate) 和[时间线](https://cineview.pages.dev/docs/02-timeline)                                                                     |
| 布局与设计坐标         | [响应式布局](https://cineview.pages.dev/docs/05-responsive)、[Position](https://cineview.pages.dev/docs/05-position) 和 [Container](https://cineview.pages.dev/docs/07-container) |
| 图片加载与视频控制     | [预加载](https://cineview.pages.dev/docs/02-preload)和 [AnimateVideo](https://cineview.pages.dev/docs/04-animate-video)                                                           |
| 扩展动画进度           | [useAnimateTimeline](https://cineview.pages.dev/docs/09-use-animate-timeline)                                                                                                     |

官网包含中英文文档、采用滚动交互的首页和独立的拖动演示。[最小示例](./examples/minimal/src/App.tsx)展示了同一组场景内容在两种模式下的使用方式。

## 无障碍支持

拖动导航包含键盘操作、场景位置播报和非活动场景的焦点处理。CineView 也会根据减少动态效果的系统偏好调整循环动画和由可见性触发的动画；直接跟随拖动或滚动的动画仍由输入控制。相关行为，以及应用需要提供的标签和焦点顺序，见[无障碍配置](https://cineview.pages.dev/docs/01-cineview)。

## 参与贡献

开发环境、本地示例和验证命令见 [CONTRIBUTING.md](./CONTRIBUTING.md)。[验证记录](./VERIFICATION.md)保存了测试覆盖率和浏览器验收结果；框架覆盖率检查对语句、分支、函数和行均设置了 90% 的最低要求。

通过 [GitHub issues](https://github.com/AlienMu/cineview/issues)报告问题或提出改进建议，版本变化见[更新日志](./CHANGELOG.md)。

## 许可证

[MIT](./LICENSE) © Alien.mu.
