<p align="center">
  <a href="https://cineview.pages.dev">
    <img src="./site/public/favicon.svg" width="64" height="64" alt="Cineview" />
  </a>
</p>

<h1 align="center">Cineview</h1>

<p align="center">以时间线为核心，支持拖拽与滚动双模式的 React 动画框架。</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cineview"><img src="https://img.shields.io/npm/v/cineview?style=flat-square&amp;color=8A5B43&amp;logo=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/cineview"><img src="https://img.shields.io/npm/dm/cineview?style=flat-square&amp;color=8A5B43" alt="npm monthly downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-555?style=flat-square" alt="MIT license" /></a>
  <br />
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-287EA3?style=flat-square&amp;logo=react&amp;logoColor=white" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript" /></a>
  <a href="https://cineview.pages.dev/coverage.json"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fcineview.pages.dev%2Fcoverage.json&amp;style=flat-square" alt="Framework line coverage" /></a>
</p>

<p align="center">
  <a href="https://cineview.pages.dev">试试滚动</a> ·
  <a href="https://cineview.pages.dev/drag">试试拖拽</a> ·
  <a href="https://cineview.pages.dev/docs">查看文档</a> ·
  <a href="#ai-看这里">AI 看这里</a>
</p>

我想让落地页更容易维护，也让 AI 少做重复的工作。场景切换、动画编排和响应式布局，没必要每个项目都重新开发一遍。Cineview 把这些通用能力放进同一套场景和时间线结构，常用的展示片段可以封装成 React 组件，在不同页面中复用。

做新页面时，组合已有的场景、素材和动画；后续修改时，找到对应组件，调整内容和时间线配置。配合按任务拆分的 AI 文档，让 AI 先读索引，再读取本次改动涉及的指南和代码，减少重复生成代码和反复梳理整页实现所用的 token，把更多上下文留给具体需求。

## 可以做什么

| 能力                                                                      | 用法                                                                                               |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 场景与组件复用                                                            | 用 Scene 拆分内容，把常用片段封装成 React 组件，复用到产品介绍、活动页或交互展示中。               |
| 时间线编排                                                                | 声明动画时长、延迟和先后关系；前一个动画的入场时长变化后，依赖它的动画会随之调整。                 |
| 拖拽与滚动双模式                                                          | 拖拽切换整屏场景，或让页面连续滚动；需要逐步展开内容时，让动画跟随滚动进度。                       |
| [动画预设](https://cineview.pages.dev/docs/08-presets)                    | 使用淡入淡出、位移、缩放、旋转、翻转、弹跳、模糊等预设，快速搭出基础效果。                         |
| [组合与自定义动画](https://cineview.pages.dev/docs/05-custom-animation)   | 在一个元素上组合预设和自定义属性，用关键帧定义更细的变化，再用时间线安排不同元素的出场顺序。       |
| 入场、循环与交错效果                                                      | 按需配置入场、循环和退场；让一组子元素依次出现，处理标题、卡片和列表的展示节奏。                   |
| [视频控制](https://cineview.pages.dev/docs/11-video-timeline)             | 用 AnimateVideo 让视频画面跟随拖拽或滚动，选择需要控制的片段，并与文字动画配合。                   |
| [扩展自定义绘制](https://cineview.pages.dev/docs/09-use-animate-timeline) | 通过 useAnimateTimeline 读取动画进度，连接 Canvas、SVG、WebGL 或自己的组件，无需另写一套进度控制。 |
| [响应式布局](https://cineview.pages.dev/docs/05-responsive)               | 根据设计稿宽度换算尺寸，用 Position 和 Container 配置位置与大小，并结合 CSS 调整布局。             |
| [资源预加载](https://cineview.pages.dev/docs/02-preload)                  | 提前准备场景图片，处理首屏加载、加载进度和资源失败，减少切换场景时等待素材的情况。                 |

## 试试看

在 React 19 项目中，安装 Cineview 及其依赖：

```bash
npm install cineview@1.0.1 react@19 react-dom@19 framer-motion@13
```

示例使用 1.0.1 的 `Cineview` API。1.0.0 使用早期的 `CineView` API，升级时需要更新导入名称和配置。

把以下内容放进 `App.tsx`，在全局样式中设置 `body { margin: 0; }`。无需准备媒体素材。

```tsx
import { Animate, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="drag" unit="percent" scale={1}>
      <Scene sceneId="intro" style={{ background: '#f5e8d8', padding: 40 }}>
        <h1>向上拖动，查看下一个场景</h1>
      </Scene>
      <Scene sceneId="details" style={{ background: '#e8edf0', padding: 40 }}>
        <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
          <h2>标题先出现</h2>
        </Animate>
        <Animate
          enterAnimation="slide-up"
          duration={{ enter: 400 }}
          timeline={{ after: 'title', delay: 100 }}
        >
          <p>说明在标题之后出现。</p>
        </Animate>
      </Scene>
    </Cineview>
  );
}
```

向上拖动进入第二幕，标题先出现，说明随后跟上。试着改改文案和动画时长，做成自己的页面。想用滚动模式，可以接着试试[快速上手中的交互案例](https://cineview.pages.dev/docs/03-quickstart)。

## AI 看这里

如果你是正在使用 Cineview 的 AI 编程助手，**请先阅读 [llms.txt](./llms.txt)**，再按当前任务打开其中的指南：

- [快速开始](./docs/ai/quickstart.md)：安装框架，完成第一个页面。
- [时间线](./docs/ai/timeline.md)：安排动画顺序、时长和延迟。
- [模式选择](./docs/ai/modes.md)：选择拖拽或滚动，确认各自的限制。
- [完整案例](./docs/ai/recipes.md)：实现滚动叙事或加入视频。

这套指南对应 Cineview 1.0.1 API。写代码前先确认索引中的版本，遇到不确定的参数，再沿链接查阅类型定义和详细文档。只读取当前任务需要的内容，比一次加载整套文档更省输入 token，也能为页面代码和需求留出更多上下文。

## 文档与案例

组件 API 和更多示例都在[文档](https://cineview.pages.dev/docs)中，可以按需要继续阅读：

- [动画顺序](https://cineview.pages.dev/docs/04-orchestration)
- [视频控制](https://cineview.pages.dev/docs/11-video-timeline)
- [Canvas、SVG 与 WebGL](https://cineview.pages.dev/docs/09-use-animate-timeline)
- [响应式布局](https://cineview.pages.dev/docs/05-responsive)
- [资源预加载](https://cineview.pages.dev/docs/02-preload)

想在本地运行源码，可以从[最小示例](./examples/minimal/README.md)开始，其中包含启动步骤和两种模式。

## 参与开发

欢迎反馈问题、分享案例或一起改进框架。本地环境和检查步骤见 [Contributing](./CONTRIBUTING.md)，版本变化见 [Changelog](./CHANGELOG.md)，发布流程见[发布说明](./RELEASING.md)。

## 许可证

[MIT](./LICENSE) © Alien.mu.
