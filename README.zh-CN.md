# Cineview

[English](./README.md)

[![npm](https://img.shields.io/npm/v/cineview/beta?style=flat-square&color=8A5B43)](https://www.npmjs.com/package/cineview)
[![Framework line coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fcineview.pages.dev%2Fcoverage.json&style=flat-square)](https://cineview.pages.dev/coverage.json)
[![React 19](https://img.shields.io/badge/React-19-287EA3?style=flat-square)](https://react.dev/)
[![MIT](https://img.shields.io/badge/license-MIT-555?style=flat-square)](./LICENSE)

Cineview 是用于制作拖拽和滚动交互页面的 React 框架。为元素声明动画时长和先后顺序，再让手势或滚动位置推进这段时间线。

每个 `Scene` 管理自己的内容和元素时间。`Animate` 描述淡入、位移等变化，`after` 等前序元素入场完成，再加上当前元素的延迟后开始。普通按时间播放的入场动画也可以与这些交互共存。

[快速上手与交互案例](https://cineview.pages.dev/docs/03-quickstart) · [文档](https://cineview.pages.dev/docs) · [官网](https://cineview.pages.dev)

## 安装 beta

下方示例对应 `cineview@0.0.1-beta` 的 `Cineview` API。安装指定的 beta 版本：

```bash
npm install cineview@0.0.1-beta react@19 react-dom@19 framer-motion@13
```

npm 的 `beta` 标签对应这套 API。`latest` 标签保留在 `1.0.0`，该版本使用早期的 `CineView` API。

## 运行本地示例

修改源码并在附带的示例中验证：

```bash
pnpm install --frozen-lockfile
pnpm --dir examples/minimal install --frozen-lockfile
pnpm build
pnpm --dir examples/minimal dev
```

当前包需要 React `^19.0.0`、React DOM `^19.0.0` 和 Framer Motion `^13.0.0`。迁移说明见 [Changelog](./CHANGELOG.md)。

## 第一个拖拽页面

将以下内容用作 `App.tsx`，不需要媒体素材：

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

第二个场景的标题用 600ms 入场，等待 100ms 后，说明用 400ms 入场，总时长为 1100ms。把标题时长改成 900ms，说明会自动后移，不必修改它的延迟。

这个例子将拖拽比例映射到时间线比例。拖到一半，元素时间是 550ms。确认切换后，未完成的动画继续播放；取消时还原。聚焦 Cineview 容器后也可使用方向键导航。

## 两种交互如何推进动画

| 模式     | 使用方式                                                                  | 停止输入后的行为                               |
| -------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| drag     | 拖拽切换 Scene，同时预览目标场景的元素动画                                | 松手时根据位移与速度决定继续切换或还原         |
| scroll   | 普通内容连续滚动；给 Scene 声明 `scroll`，让其动画按 `1ms = 1px` 跟随滚动 | 区间内停止滚动，动画停在当前帧；反向滚动会倒退 |
| 独立入场 | `timeline={{ driver: 'clock' }}`                                          | 满足启动条件后按时间播放，不因停止滚动而暂停   |

[快速上手](https://cineview.pages.dev/docs/03-quickstart)提供两种可操作案例和基础代码。[模式说明](https://cineview.pages.dev/docs/01-modes)解释场景移动与元素时间的关系。

## 进一步使用

- [动画顺序](https://cineview.pages.dev/docs/04-orchestration)：`after`、延迟、组合与子元素入场。
- [视频控制](https://cineview.pages.dev/docs/11-video-timeline)：将拖拽和滚动进度用于视频帧。
- [自定义绘制](https://cineview.pages.dev/docs/09-use-animate-timeline)：用 MotionValue 驱动 Canvas、SVG 或 WebGL。
- [布局换算](https://cineview.pages.dev/docs/05-responsive)：使用 `designWidth`、Position 和 Container。
- [资源预加载](https://cineview.pages.dev/docs/02-preload)：准备场景资源与处理首屏等待。

为需要独立处理手势的控件添加 `data-cineview-ignore-drag`。跨场景的导航或持久状态放在 Cineview 外部。

## 验证与开发

覆盖率徽章读取网站发布时成功运行框架测试生成的行覆盖率，不代表所有浏览器交互都已覆盖；拖拽与滚动另有浏览器验收。

完整开发环境、测试与发布命令见 [Contributing](./CONTRIBUTING.md) 和[发布说明](./RELEASING.md)。[最小示例](./examples/minimal/README.md)可在两种模式间切换。

## 许可证

[MIT](./LICENSE) © Alien.mu.
