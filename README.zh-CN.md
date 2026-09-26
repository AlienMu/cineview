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
  <a href="https://www.npmjs.com/package/cineview"><img src="https://img.shields.io/npm/v/cineview/beta?style=flat-square&amp;color=8A5B43&amp;logo=npm" alt="npm beta version" /></a>
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

我总觉得，不少 AI 做的落地页有点散。内容有了，动画也加了，整页还是缺少顺序和节奏，不太优雅。我想让落地页像电影院里的电影一样，一幕一幕地展开。

- **时间线编排**：按先后关系安排动画，修改时长时，后续动画随之调整。
- **双模式**：支持连续滚动，也支持拖拽切换整屏场景。
- **视频控制**：让视频画面跟随滚动或拖拽进度。
- **响应式布局**：根据视口宽度换算设计稿尺寸。

## 试试看

在 React 19 项目中，安装 beta 版本及其依赖：

```bash
npm install cineview@0.0.1-beta react@19 react-dom@19 framer-motion@13
```

示例使用 beta 版本的 `Cineview` API。npm 的 `latest` 版本 `1.0.0` 使用早期的 `CineView` API，运行下面的示例请安装上方指定版本。

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

这套指南对应当前 beta API。写代码前先确认索引中的版本，遇到不确定的参数，再沿链接查阅类型定义和详细文档。只读取当前任务需要的内容，比一次加载整套文档更省输入 token，也能为页面代码和需求留出更多上下文。

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
