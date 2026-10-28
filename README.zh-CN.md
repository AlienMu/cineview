<p align="center">
  <a href="https://cineview.pages.dev">
    <img src="./site/public/favicon.svg" width="64" height="64" alt="Cineview" />
  </a>
</p>

<h1 align="center">Cineview</h1>

<p align="center">用普通 HTML 写落地页：每个场景有自己的时间线，随读者的滚动或手指前进。</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cineview"><img src="https://img.shields.io/npm/v/cineview?style=flat-square&amp;color=8A5B43&amp;logo=npm" alt="npm 版本" /></a>
  <a href="https://www.npmjs.com/package/cineview"><img src="https://img.shields.io/npm/dm/cineview?style=flat-square&amp;color=8A5B43" alt="npm 月下载量" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-555?style=flat-square" alt="MIT 许可证" /></a>
  <br />
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript" /></a>
  <a href="./package.json"><img src="https://img.shields.io/badge/dependencies-0-2c7a4b?style=flat-square" alt="无运行时依赖" /></a>
  <a href="https://cineview.pages.dev/coverage.json"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fcineview.pages.dev%2Fcoverage.json&amp;style=flat-square" alt="行覆盖率" /></a>
</p>

<p align="center">
  <a href="https://cineview.pages.dev">首页</a> ·
  <a href="https://cineview.pages.dev/docs">查看文档</a> ·
  <a href="#给-ai-看的">给 AI 看的</a>
</p>

Cineview 用几个自定义元素来写落地页和交互演示。页面分成若干场景，每个场景有一条时间线；元素用 `fx`、`duration`、`after` 这样的属性声明自己在时间线上的位置。读者的滚动或手指推动时间线：普通区块里，元素进入视口后按时间入场；在停住的场景里，滚动距离就是时间。

这类页面共同需要的行为由框架负责：入场按顺序发生，手势可以中途打断、反向，首屏不闪，视频随滚动逐帧播放，减弱动态效果和暂停都已支持。页面代码只需要处理内容、版式和节奏。

它没有运行时依赖。这些元素可以直接用在普通 HTML 文件里，也可以放进 React 等框架的页面。启动样式和 head 里的一小段脚本，保证模块运行前首屏就是对的。

## 功能

| 能力 | 怎么用 |
| --- | --- |
| 场景与时间线 | 用 `cv-scene` 划分页面。用 `duration`、`delay`、`after="title -200"` 或 `at="20% 60%"` 排定元素的先后。 |
| 两种前进方式 | `cv-stage` 默认是滚动；`input="drag"` 一屏一个场景，用手指切换。 |
| 停住的场景 | `cv-scene zone` 让画面停住，滚动推进这一场的时间，1 毫秒对应 1 像素；往回滚动就倒回去。 |
| 效果预设 | `fx="rise(line)"`、`wipe`、`focus`、`reveal`、`draw`、`count`、`duotone` 等，用逗号组合，也可以用 `from` 和 `to` 直接写数值。 |
| 进度来源 | `on` 决定由什么推进效果：进入视口后按时间、视线高度、元素穿过视口的位置、整页滚动、场景时钟、滚动速度。 |
| 叠盖、横移与固定层 | `stack` 和 `covered` 处理被盖住的场景，`cv-stack` 做叠卡，`track="x"` 做横向移动，`cv-fixed` 是场景的固定层。 |
| 视频 | `cv-video` 让视频随时间线逐帧前进和倒退。 |
| 自己绘制 | `el.timeline.subscribe()` 按元素的进度驱动 Canvas、SVG 或 WebGL。 |
| 首屏与刷新 | 启动样式、素材等待和兜底显示保证开场正确；在页面中间刷新时，读者已经看到的内容不会重播。 |
| 无障碍 | 文字保持为可选中的真实文本；减弱动态效果时入场变短、循环停止；`cv-pause` 暂停按时间播放的动效。 |

## 试一试

```bash
npm install cineview
```

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- 1. head 脚本（node_modules/cineview/dist/head.js），2. 启动样式，3. 模块 -->
  <script>(function(s){if(s&&s('selector(:has(*))')&&s('width:1lh')&&s('color:color-mix(in srgb,red,red)'))document.documentElement.classList.add('cv-js')})(window.CSS&&CSS.supports);</script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/cineview@2/dist/cineview.css">
  <script type="module" src="https://cdn.jsdelivr.net/npm/cineview@2/dist/cineview.js"></script>
</head>
<body>
  <cv-stage>
    <cv-scene>
      <cv-animate fx="rise(line)" duration="900"><h1>每个场景，各有自己的时间线</h1></cv-animate>
      <cv-animate fx="rise(soft)" delay="400"><p>标题先升起，说明随后出现。</p></cv-animate>
    </cv-scene>
    <cv-scene zone>
      <cv-animate from="scale-x:0" to="scale-x:1" duration="2400" ease="linear"><div class="bar"></div></cv-animate>
      <cv-animate fx="fade" at="30% 60%"><p>滚过停住的这一场时出现。</p></cv-animate>
    </cv-scene>
  </cv-stage>
</body>
</html>
```

往下滚动：第一个场景的入场按时间播放，第二个场景停住，滚动画出进度条。使用打包工具时，用 `import 'cineview'` 代替模块脚本，head 脚本和 `cineview/cineview.css` 照样放在 `<head>` 里。详细说明见[安装与加载](https://cineview.pages.dev/docs/02-setup)，拖动模式见[滚动与拖动](https://cineview.pages.dev/docs/03-input-modes)。

## 给 AI 看的

Cineview 的写法便于 AI 助手规划和制作页面。从 [llms.txt](./llms.txt) 开始，它是阅读索引，按任务列出各份指南和最重要的规则。

- [落地页设计](./docs/ai/landing-pages.zh-CN.md)：先定内容关系、阅读控制、时间安排和验收方式，再选效果。
- [AI 设计流程](./docs/ai/design-assistant.zh-CN.md)：把需求描述或 PRD 变成分镜和建议。
- [41 条设计参考](./docs/ai/lexicon.zh-CN.md)：每条参考的用途，以及它对应框架的哪些能力。
- [声明约定](./docs/ai/declarative-design.zh-CN.md)：属性怎样分组、继承，各自负责哪些输出。

### 给 AI 用的设计技能

[`skills/cineview-design`](./skills/cineview-design/README.zh-CN.md) 让 AI 先和你一起规划页面，再动手制作：做什么用、两三个方向、做几幕、每一幕讲什么、用哪些素材，最后整理成分镜表和素材清单。它给建议时参考的资料包括：视频和图片的处理方式、线稿和辅助元素、多种视觉风格、41 种设计参考在各种模式下的搭配，还有 32 种排版和多种整页结构的例子。它只提供选项，不是模板。使用 Claude Code 的话，把这个目录复制到项目的 `.claude/skills/` 下；用其他 AI 工具，就让它先读 `SKILL.md`。

## 文档与案例

[文档](https://cineview.pages.dev/docs)的页面里附有可以直接操作的案例：

| 页面 | 内容 |
| --- | --- |
| [时间线](https://cineview.pages.dev/docs/05-timeline) | `duration`、`delay`、`after`、`at`，以及停住的场景有多长 |
| [进度来源](https://cineview.pages.dev/docs/06-progress-sources) | 由什么推进效果、入场的条件、减弱动态效果 |
| [cv-animate](https://cineview.pages.dev/docs/11-animate) | 全部属性和预设、直接写数值、循环、自定义效果 |
| [cv-video](https://cineview.pages.dev/docs/13-video) | 随时间线播放的视频，以及如何准备视频文件 |
| [拖动模式](https://cineview.pages.dev/docs/16-drag-mode) | 手指与时间、松手规则、按键和事件 |

用 [`device-test/`](./device-test/README.zh-CN.md) 里的测试页在真机上测试（`pnpm device`）。

## 参与贡献

开发命令和检查见 [CONTRIBUTING.md](./CONTRIBUTING.md)，架构见 [DESIGN.md](./DESIGN.md)。

## 友情链接

- [LINUX DO](https://linux.do)：真诚、友善、团结、专业，共建你我引以为荣之社区。

## 许可证

[MIT](./LICENSE)
