# CineView

[English](./README.md)

![版本 1.0.0](https://img.shields.io/badge/version-1.0.0-8A5B43?style=flat-square)
[![React 19](https://img.shields.io/badge/React-19-287EA3?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
![附带 TypeScript 类型](https://img.shields.io/badge/TypeScript-types_included-3178C6?style=flat-square&logo=typescript&logoColor=white)
[![框架测试：1582 项通过](https://img.shields.io/badge/framework_tests-1582_passing-4F7562?style=flat-square)](#验证)
[![行覆盖率：96.27%](https://img.shields.io/badge/line_coverage-96.27%25-4F7562?style=flat-square)](#验证)
[![MIT 许可证](https://img.shields.io/badge/license-MIT-625D54?style=flat-square)](./LICENSE)

CineView 是一个用 React 编写分场景动画页面的框架。它支持拖动切换场景、让动画跟随滚动，以及在场景内安排动画顺序；也提供设计稿坐标定位、图片预加载和由动画进度控制的视频。

测试和覆盖率徽章对应[验证](#验证)中记录的本地运行结果。

[安装](#安装) · [运行示例](#运行示例) · [工作方式](#工作方式) · [站点与文档](#站点与文档) · [参与开发](#参与开发)

## 安装

在 React 应用中安装 CineView 1.0.0 和 peer 依赖：

```bash
npm install cineview@1.0.0 react@19 react-dom@19 framer-motion@13
```

使用 pnpm：

```bash
pnpm add cineview@1.0.0 react@19 react-dom@19 framer-motion@13
```

应用需提供 React `^19.0.0`、React DOM `^19.0.0` 和 Framer Motion `^13.0.0`。TypeScript 类型声明随包提供。

## 运行示例

仓库开发使用 Node.js 22.22.1 或更新的 22.x 版本，也支持 Node.js 24+；包管理器为 pnpm 10.22.0。

在当前仓库中运行：

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --dir examples/minimal install --frozen-lockfile
pnpm --dir examples/minimal dev
```

打开 Vite 输出的地址。[最小示例](./examples/minimal)包含三个场景，可以通过按钮切换导航模式并重新开始。

要在其他应用中测试本地修改，先构建并打包：

```bash
pnpm build
pnpm pack
```

如果应用目录与 `cineview` 仓库同级，在应用中安装生成的包和 peer 依赖：

```bash
pnpm add ../cineview/cineview-1.0.0.tgz react@19 react-dom@19 framer-motion@13
```

按实际目录调整安装包路径。

## 两个场景的页面

```tsx
import { Animate, CineView, Scene } from 'cineview';

export default function App() {
  return (
    <CineView mode="drag" designWidth={750} a11y={{ label: 'Product tour' }}>
      <Scene sceneId="opening">
        <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
          <Animate enterAnimation="fade-in" duration={{ enter: 600 }}>
            <h1>Start here</h1>
          </Animate>
        </div>
      </Scene>

      <Scene sceneId="details">
        <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
          <Animate enterAnimation="slide-up" duration={{ enter: 800 }}>
            <h2>Take a closer look</h2>
          </Animate>
        </div>
      </Scene>
    </CineView>
  );
}
```

上下拖动即可切换场景。聚焦 CineView 容器后，也能使用方向键、PageUp、PageDown、Home 和 End。场景里的按钮和输入框保留各自的键盘操作。

## 工作方式

`CineView` 选择页面的导航模式，`Scene` 组织内容并定义布局，`Animate` 为内容添加动画。

| 配置                                                                | 动画如何推进                                 |
| ------------------------------------------------------------------- | -------------------------------------------- |
| `mode="drag"`，`timeline.driver: 'scene'`                           | 场景内的元素时间线跟随手势，释放后继续播放。 |
| `mode="drag"`，`timeline.driver: 'clock'`                           | 场景到达后，动画按时间播放。                 |
| `mode="scroll"`，位于 `Scene.scroll` 区域中，使用 `driver: 'scene'` | 区域内的实际滚动位置控制进度。               |
| `mode="scroll"`，不在滚动区域中，或使用 `driver: 'clock'`           | 元素满足可见性条件后，动画按时间播放。       |

默认模式是 `drag`，默认驱动是 `scene`。模式决定页面如何移动，驱动决定元素动画如何推进。

切换模式会使用另一套引擎。[示例](./examples/minimal/src/App.tsx)通过不同分支和 `key` 明确重新开始，不在两个模式之间传递原有进度。

### 让动画跟随滚动

scroll 模式中的场景按文档流排列。添加 `Scene.scroll` 后，场景会在指定区域内保持可见，由滚动推进动画：

```tsx
import { Animate, CineView, Scene } from 'cineview';

export default function ScrollPage() {
  return (
    <CineView mode="scroll" designWidth={750}>
      <Scene sceneId="intro" layout={{ height: '100vh' }}>
        <h1>A page that scrolls</h1>
      </Scene>

      <Scene
        sceneId="detail"
        layout={{ height: '100vh' }}
        scroll={{ zoneId: 'detail', trigger: 'center-lock' }}
      >
        <Animate
          enterAnimation={{
            initial: { opacity: 0, y: 60 },
            animate: { opacity: 1, y: 0 },
          }}
          duration={{ enter: 1600, exit: 0 }}
          timeline={{ driver: 'scene' }}
        >
          <h2>Scroll to reveal the detail</h2>
        </Animate>
      </Scene>
    </CineView>
  );
}
```

区域中声明的 1 毫秒动画时长对应 1 CSS 像素的滚动距离。本例的动画占 1,600 像素，向回滚动即可反向播放。场景本身的可见高度与这段动画距离分别计算。

大幅输入可能先停在区域边界，下一次输入继续前进。滚轮、触摸、键盘和滚动条操作都影响同一个滚动位置。[滚动说明](./site/src/content/docs/zh/scroll/01-centerlock.md)介绍了边界与零时长的行为。

### 顺序与循环

用 `timeline.after` 连接同一 Scene 内的动画，用 `timeline.delay` 增加间隔。例如，`timeline={{ after: 'heading', delay: 120 }}` 表示在名为 `heading` 的动画之后，再延迟 120 毫秒开始。

`stagger={{ each: 110 }}` 按时间间隔启动容器的直接子元素。如果每项都需要独立跟随滚动，使用各自的 Animate。

`loopAnimation` 在动画活动期间重复效果，`exitAnimation` 定义可选的退场。[时间线说明](./site/src/content/docs/zh/concepts/02-timeline.md)列出了不同驱动的差异：drag 模式中的 `driver: 'clock'` 不参与 `after` 编排，也不使用 `exitAnimation`。

### 响应式坐标

`designWidth` 是设计稿的像素宽度，默认值为 `750`。Position 坐标和 Container 的数值长度按以下比例换算：

```text
scale = viewport width / designWidth
```

横纵两个方向使用相同比例，不另按视口高度换算。CSS 字符串保留原有单位，透明度这类无单位数值也不会缩放。需要在手机上重新排列的文字和布局，仍需通过 CSS 断点处理。

## 组件与扩展

| API                  | 用途                                                                         |
| -------------------- | ---------------------------------------------------------------------------- |
| `CineView`           | 导航模式、公共配置、回调和导航 ref                                           |
| `Scene`              | 场景内容、布局、资源声明和可选的滚动区域                                     |
| `Animate`            | 预设、自定义属性变化、并行或顺序组合，以及时间配置                           |
| `Position`           | 相对包含块进行坐标定位和居中；`fixed` 内容限定在所属 Scene 内                |
| `Container`          | 将布局长度从设计像素换算为实际尺寸                                           |
| `Image`              | 通过共享预加载缓存加载图片                                                   |
| `AnimateVideo`       | 根据动画进度定位视频帧，或使用普通播放                                       |
| `useAnimateTimeline` | 以 MotionValue 读取最近一层 Animate 的进度，供自定义 DOM、SVG 或 Canvas 使用 |

自定义组件可以直接读取进度，不必将每一帧存入 React state：

```tsx
import { motion } from 'framer-motion';
import { useAnimateTimeline } from 'cineview';

export function ProgressLine() {
  const { progress } = useAnimateTimeline();

  return (
    <motion.div
      style={{
        height: 4,
        width: '100%',
        background: '#d59273',
        transformOrigin: 'left',
        scaleX: progress,
      }}
    />
  );
}
```

将 `ProgressLine` 放在 `Animate` 内部，它会读取该 Animate 的时间线。也可以使用 render-prop 子函数，但这种用法的进度更新会触发 React 渲染；连续绘制优先使用 MotionValue hook。

`ref.current.goToScene(index)` 切换场景。ref 还提供 `refreshLayout()`、`preload()`、`getCurrentIndex()` 和 `getPerformanceMetrics()`；scroll 模式另有 `goToZone()`。`onReady` 在这些 API 可用时提供引用；等待声明资源的加载过程则使用 `preload()`。

场景内的固定内容受 Scene 裁剪。需要跨场景保留的站点导航放在 CineView 外部。完整配置和回调见[组件参考](./site/src/content/docs/zh/components/01-cineview.md)。

## 包入口

| 入口                     | 支持的用法                                                |
| ------------------------ | --------------------------------------------------------- |
| `cineview`               | 主 ESM 和 CommonJS 入口，包含两种导航引擎                 |
| `cineview/drag`          | drag 模式的 CommonJS `require` 入口和类型                 |
| `cineview/scroll`        | scroll 模式的 CommonJS `require` 入口和类型               |
| `cineview/dev`           | 可选的 ESM 开发工具，包含 `PerfPanel` 和 `usePerfMonitor` |
| `cineview/dev/style.css` | 开发面板样式                                              |

ESM 应用使用 `import { CineView } from 'cineview'`。两个模式子路径没有 ESM import 条件。浏览器脚本版本为 `cineview.umd.js`、`cineview-drag.umd.js` 和 `cineview-scroll.umd.js`。

React、React DOM 和 Framer Motion 都是外部 peer 依赖。开发工具和面板 CSS 按需引入。

## 无障碍与动态效果偏好

drag 容器支持键盘导航、可配置的无障碍名称和场景位置播报。非活动的 drag 场景使用 `inert` 和 `aria-hidden`，场景内的原生控件保留正常交互。

开启 `prefers-reduced-motion` 后，`loopAnimation` 效果停止。由元素可见性触发的入场和退场动画直接显示结束状态。拖动或滚动控制的动画仍跟随输入。页面内容仍需具备可读文字、控件名称和可用的焦点顺序；无障碍验收需要覆盖实际内容和完整交互。

## 验证

**2026 年 9 月 8 日**，使用 Node.js 22.22.1 运行框架检查：

| 指标         | 结果         |
| ------------ | ------------ |
| 框架测试套件 | 118 套通过   |
| 框架测试     | 1,582 项通过 |
| 语句覆盖率   | 94.85%       |
| 分支覆盖率   | 90.22%       |
| 函数覆盖率   | 95.15%       |
| 行覆盖率     | 96.27%       |

数据来自 `pnpm test:coverage:framework`，不包含站点测试。四项覆盖率的配置下限均为 90%。修改框架后和发布前，重新运行命令更新这些数据。

[验证记录](./VERIFICATION.md)包含命令、检查范围和浏览器结果。运行检查：

```bash
pnpm install --frozen-lockfile
pnpm --dir site install --frozen-lockfile
pnpm --dir examples/minimal install --frozen-lockfile
pnpm --dir examples/performance-test install --frozen-lockfile

pnpm verify:framework:static
pnpm type-check
pnpm type-check:site
pnpm test:site-contracts
pnpm docs:style:static
pnpm --dir site build
```

安装 Chrome 后，`pnpm test:browser` 运行框架浏览器检查。静态检查和覆盖率本身不能证明拖动或滚动行为正确。[CI 配置](./.github/workflows/ci.yml)包含 Node.js 22.22.1 与 24.x 检查；[发布流程](./.github/workflows/release.yml)要求浏览器验收通过后再发布。

## 站点与文档

仓库尚未配置公开站点地址。可以在本地运行双语站点：

```bash
pnpm install --frozen-lockfile
pnpm --dir site install --frozen-lockfile
pnpm build
pnpm --dir site dev
```

默认地址是 [http://localhost:4000](http://localhost:4000)；端口被占用时，以 Vite 输出的地址为准。[文档](http://localhost:4000/docs)和[拖动演示](http://localhost:4000/drag)是同一站点中的页面。

文档源码：[English](./site/src/content/docs/en) · [简体中文](./site/src/content/docs/zh)。两种语言均包含安装、概念、拖动与滚动行为、组件和进阶用法。

## 参与开发

开发流程见 [CONTRIBUTING.md](./CONTRIBUTING.md)，仓库规则见 [AGENTS.md](./AGENTS.md)。运行时改动除了单元测试，还需要浏览器证据。文档修改同步维护中英文版本。

通过 [GitHub issues](https://github.com/AlienMu/cineview/issues)提交问题。

## 许可证

[MIT](./LICENSE)，著作权人 Alien.mu。
