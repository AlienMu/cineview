# Task Flow — CineView 官网 + 中英文双语文档站

**日期**: 2026-06-30
**目标**: 三合一单站点（官网 scroll 展示 / 双模式 Demo Hub / 中英文 API 文档），部署 Cloudflare Pages。

---

## 锁定方案（grill-me 16 题对齐结果）

| 维度 | 决定 |
|---|---|
| 结构 | 三合一单站点 `/`(官网) `/demo`(双模式 Hub) `/docs`(文档) |
| 手机场景 | scroll 叙事第 4 幕嵌入，zoomIn+blur 入场、**预挂载+揭幕**(pointer-events 门控)、滚动进度阈值解锁 drag |
| drag demo | 4 屏能力浓缩，用 delay+waitFor，中英文 |
| i18n | 手动切换 + localStorage + navigator 猜默认 + URL 不带语言段；短文案字典 + 文档双 Markdown 目录；`react-markdown` 渲染 |
| 官网 | 6 幕，Hero 三 CTA(开始使用/API/GitHub)，场景组件按需用(高度≤100% 才接管 scroll) |
| 背景 | 全站总进度驱动 + 上下双端 linear-gradient 插值 + 停靠点数组可配 |
| 导航 | 全站 fixed 毛玻璃顶栏，语言切换常驻 |
| 技术栈 | 新建 `site/`，react-router BrowserRouter，引用 dist 产物，CF `_redirects` SPA fallback |
| 视觉 | 暖白 + 柔彩渐变，Fraunces + Inter(自托管)/中文系统黑体栈 |
| 文档 | 5 大类树(入门/核心概念/组件 API/动画/进阶) |
| 节奏 | **分阶段确认**：阶段1 骨架 → 阶段2 官网+手机场景 → 阶段3 Demo Hub+文档 |

---

## 关键架构决策（实现中确认，不可跑偏）

> 这些是读源码 + 与用户确认后锁定的硬约束。后续任何实现偏离这里都算跑偏，必须先回头核对。

### A1 — scroll 模式的滚动源是 CineView 内部容器，不是 window/document
- 核实：`DirectScrollCineView.tsx` 渲染一个 `height:100vh; overflowY:scroll` 的 **root 容器**（`containerRef`），监听 `root.scrollTop`、capture 模式拦截 `wheel`/`touchmove`/`keydown`。
- **后果**：全站滚动总进度（背景 LUT 色带 + 胶片时间码）的进度源 **必须取自这个内部容器的 scrollTop**，不能用 `document.documentElement.scrollTop`。
- root 容器 ref **未对外暴露**；公共 API 仅有 per-zone `onZoneProgress` + `getCurrentScene()`，**无全站总进度回调**。

### A2 — 官网首页骨架：整页一个 `<CineView mode="scroll">`（用户拍板）
- 首页 = 单个 scroll 实例，最大化 dogfood 框架。
- **进度获取方案（已定）**：采用候选②。核实 root 容器渲染时带稳定标识 `className="cineview-container"` + `data-cineview-container="true"`（`DirectScrollCineView.tsx` L1453-1456），可被 `querySelector('[data-cineview-container]')` 定位。`useScrollProgress` 挂载后查询该容器，监听其 `scroll` 事件，进度 = `scrollTop / (scrollHeight - clientHeight)`，rAF 节流。
- 容器节点可能在 CineView 异步布局后才出现：hook 用短轮询/`requestAnimationFrame` 重试拿到容器再绑定监听，拿不到时回退 0。

### A3 — 场景接管按需（用户强约束，呼应 Q7）
- 仅"内容高度 ≤ 100vh 且愿接受滚动被接管"的高光幕用 `Scene.scroll`（center-lock）。
- 普通叙事段落走普通 scroll 内容（非接管 scene，不强制 100vh），符合框架「唯一 scroll owner」原则——接管段与原生流不并行。
- 手机高光幕 = 典型接管幕。

### A4 — 进度源改造影响
- `site/src/hooks/useScrollProgress.ts` 初版读 `document.scrollTop` → **已改造**：改读 CineView 内部 scroll 容器（`[data-cineview-container]`）的 scrollTop（见 A2 已定方案）。

### A5 — CineView 容器硬编码白底会遮挡 fixed 背景色带
- 核实：`DirectScrollCineView.tsx` 的 `containerStyle` 里硬编码 `background: '#ffffff'`（inline style）。
- **后果**：背景 LUT 色带是 `position:fixed` 全屏层、置于 CineView 之下；容器白底会盖住它，色带看不见。
- **解法**：site CSS 用 `.cineview-container { background: transparent !important; }` 覆盖该 inline 背景（inline 非 !important 样式可被 !important 覆盖）。改框架源码不在本次范围（引用 dist 产物）。已落到 global.css。

### A6 — chrome 改版（用户 2026-06-30 反馈，覆盖阶段1 的 1.5）
- **删胶片边轨**（FilmRail）：用户不要边轨。`FilmRail.tsx` 删除；time-code 签名一并移除。
- **删 fixed 顶栏**（TopBar）：用户认为太高/不透明/丑。`TopBar.tsx` 删除；只保留右上角浮动**地球图标** `LangToggle`（唯一常驻 chrome）。
- **导航 + GitHub 入口下放页内**（用户拍板「右上角只地球，GitHub+导航全靠页内」）：阶段2 各页/各幕内部自带跳转（Hero 三 CTA、Footer、Demo Hub 切换、Docs 侧边栏）。
- **滚动条跟随当前镜头色**（用户拍板）：CineView `scrollbar.thumbColor`/`trackColor` 是 inline style 直接取值 → 传 `'var(--accent)'` 字符串即 `background: var(--accent)`，`--accent` 由 BackgroundRibbon 实时写入 `:root`，滚动条天然随滚动变色，**无需改框架源码**。已在 HomePage CineView 配置。
- 死变量 `--rail-width`/`--topbar-height` 已从 tokens.css 删除。
- **地球图标微调（用户 2026-06-30 二次反馈）**：①只放首页右上角，**不要** header（文档/Demo 页才有自己的 header + 语言切换，阶段3 做）；②更靠近顶部；③hover 精致化（轻微上浮 + 地球缓转 + 柔和阴影）。已改 `.lang-toggle` CSS。
- **滚动条「未滚动时默认隐藏」（用户 2026-06-30 反馈）**：⚠️ 框架 `autoHide` 原实现**只是把滚动条常驻 `opacity:0.56`，不联动滚动状态**——名实不符（叫 autoHide 却从不 hide）。

  **最终采用 B（改框架源码，用户拍板）**，取代早期 site 侧补丁方案：
  - 框架内 `isScrolling`（state，第 127 行）早已存在，滚动起止时由 **120ms idle timer**（664/695 行）翻转，且早已是渲染输入（流向 `isSceneAnimating`/runtime context），**翻转本来就触发重渲染**。改动仅在已有渲染输入上多读一次去设 overlay opacity。
  - 改动点（`DirectScrollCineView.tsx` 渲染 return，仅 2 个 DOM 节点 style）：①外层 `[data-cineview-scrollbar-overlay]` div 的 `opacity = scrollbarAutoHide ? (isScrolling ? 1 : 0) : 1`；②内层 rail 两处 `opacity: scrollbarAutoHide ? 0.56 : 1` 改回恒 `1`（显隐统一交外层）。
  - **transition 非对称**（真机验收抓出的关键修正）：fade-in `80ms`（滚动瞬间清晰），fade-out `0.5s ease 0.15s`（停止后优雅淡出）。早期对称 `0.32s` 因 idle timer 仅 120ms，短滚动 opacity 只爬到 ~0.31 就被翻回 false → 滚动条发虚不全。**单测（jsdom 不渲染 transition）抓不到，只有真机验收能抓**。
  - **未碰任何时序链**：未新增 timer/state/ref/effect，未改 `isScrolling` 生命周期或 120ms 时长，未碰 scrollOffset/progressPx/center-lock/zone/防跳过。
  - **回归测试**：`DirectScrollCineView.test.tsx` 新增 2 例（autoHide 静止隐藏+滚动淡入 `waitFor` 轮询、非 autoHide 恒显），**全量 1131/1131 全绿**（基线先单独跑过 0 失败，证明源码改动未破坏既有测试）。`type-check` 0 错、`build:verify` 8/8、dist gzip 45.31 KB（达标）。
  - **site 侧补丁已删**：框架原生接管后，`useScrollbarAutoHide` hook + global.css 的 `body.is-scrolling` overlay CSS 已移除（会与框架新 inline opacity 打架）。
  - 真机浏览器验收 13/13（含 idle opacity=0 / 滚动峰值 0.96）。
  - **性能/卡顿担忧（用户提出，用户自行确认 isScrolling 翻转频率）**：scrollbar 本就是框架渲染的 overlay（thumbOffset 每帧重算重渲），滚动时本来就在重渲；本改动只多读已有 `isScrolling` 设 opacity，未增量级负担。

### A7 — AnimateVideo scrub 掉帧根因 = 视频关键帧过稀（2026-07-16，用户报「场景4掉帧」逐层排查）

- **现象**：官网场景4（`DemoVideoScene`，全屏 `AnimateVideo` 随滚动逐帧擦洗 + 逐字副标题）在生产构建下明显掉帧；其他场景顺滑。用户判断「英文字多 + 一直在重绘」。
- **排查过程（多轮证伪，教训价值高）**：
  1. 先怀疑逐字副标题：用 CDP trace 实测，`--p` 挂字幕容器（132 字继承）→ 改一次 `--p` 触发整棵继承子树全量 recalcStyle（~960ms/120帧）。改为「写每个字叶子的非继承属性 inline」后降到 ~38ms（-96%）。**但这没解决掉帧**。
  2. CPU profile（生产）：idle 63.5%，无单一热点，`getBoundingClientRect` 5.2% 是最大单项——都不足以解释掉帧。**dev 构建 CPU 是生产的 ~2 倍**（validateProperty/jsx-dev-runtime/StrictMode 双调用），务必测生产。
  3. 分段 profile：CPU 全程 24-32% 平坦，无某一幕突出——排除「某场景 CPU 爆」。
  4. **重绘检测（CDP trace 数 Paint 事件）才是对的层面**：场景4 滚动 Paint **2172/秒**，hero/cap 仅 ~400/秒 → 场景4 特有。
  5. 冻结字幕颜色 + blur（注入 `!important` 令计算值恒定）→ Paint **纹丝不动** → **重绘源不是字幕**。我前几轮优化的字幕对滚动重绘贡献≈0。
  6. 决定性隔离：`freeze video.currentTime`（停止擦洗，视频仍在）→ Paint 从 2172 **暴跌到 374**（= 其他场景水平）；`remove video` 同样 362。**真凶 = 视频擦洗**。
- **根因**：`site/public/video.mp4` 有 241 帧却**只有 1 个关键帧（I 帧，第 0 帧）**。H.264 的 P/B 帧是相对前帧的差分，seek 到任意帧须从最近 I 帧起逐帧解码到目标。关键帧稀疏 → 每次 scrub 长距离解码，滚动连续 → 每帧都在长解码 → 解码线程吃满 → 掉帧。解码在专用线程，**JS CPU profiler 看不到**（解释了「profile 干净但掉帧」的矛盾）；`display:none` 隐藏视频不停解码（解释了早期误排除视频）。
- **落地方案 A（重编码视频，用户拍板）**：`ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4` → 全关键帧（每帧皆 I 帧，任意帧可直接解码）。已替换 `site/public/video.mp4`（1.5MB→3.9MB，241 帧全 I 帧，原文件备份 `video.mp4.bak-1key`）。**代价**：文件变大；**收益**：scrub 顺滑，交互/观感不变。
- **框架侧沉淀（用户选「文档约束 + 开发期警告」，不做转码脚本/CLI）**：
  - `AnimateVideoProps.src` 加 JSDoc 约束：scrub 视频应全关键帧编码，附 ffmpeg 命令。
  - `VideoFrameRenderer.tsx` 加**开发期 scrub 性能守卫**：dev-only 测每次 seek 延迟（`currentTime` 设值 → `'seeked'` 事件），累计 ≥6 样本后中位数 > 50ms（约 3 帧@60fps）则 `console.warn` 一次（每 src 去重），给出 ffmpeg 修复命令。生产零开销（`process.env.NODE_ENV` 门控，不挂监听）。检测「可观测症状 seek 延迟」而非「关键帧结构」（浏览器读不到后者）。
- **README/文档生成时须纳入**：进阶/性能章节应写明「用于 `AnimateVideo` scrub 的视频必须全关键帧编码，否则掉帧」+ ffmpeg 命令；这是框架使用的硬约束，不是可选优化。
- **副产物**：逐字副标题的「叶子 inline 驱动」重构（A7.1 recalc -96%）与「blur 行级化 + 定形跳过」虽非掉帧主因，但已保留在 `DemoVideoScene.tsx`（正确的低开销写法，供 scroll 逐字动效参考）。诊断探针脚本（`_perf-*`/`_repaint-*`/`_cpu-*`）均为一次性，已清理。

---

## 阶段 1 — 骨架（可跑空壳）

- [x] 1.1 `site/` 脚手架（Vite + React + TS，引用 dist 产物，dedupe react/framer-motion）— build 415 模块通过
- [x] 1.2 react-router BrowserRouter 路由（`/` `/demo` `/docs/*`）— dev 下 `/`、`/docs` 均 200
- [x] 1.3 i18n 机制（zh 字面量真相源 + DictKey 同构强制 + localStorage + navigator 猜默认）
- [x] 1.4 frontend-design 设计系统（tokens.css 色板/字体/间距/LUT 停靠点 + global.css）
- [x] 1.5 fixed 毛玻璃顶栏（TopBar：Logo + 导航 + 语言开关 + GitHub）
- [x] 1.6 背景色带系统（useScrollProgress 读 CineView 容器 + lutAt 插值 + BackgroundRibbon 写 CSS 变量 + FilmRail 时间码签名）
- [x] 1.7 CF 部署配置（`public/_redirects` SPA fallback + `build:cf` 先 build 框架 dist 再 build site）
- [x] **阶段 1 验收**：自动化全绿（type-check 0 错 / build 通过 / dev 路由 200）+ **真实浏览器 Playwright 实测 10/10 通过**（2026-06-30）：
  - ✓ CineView scroll 容器挂载、顶栏渲染、胶片边轨渲染
  - ✓ 背景 LUT 色带随滚动流动：`#fcede4`(暖桃 0%) → `#e9eaf5`(浅蓝 50%) → `#e4f0ea`(薄荷 100%)，截图肉眼确认
  - ✓ 胶片时间码随滚动推进 `00:00 → 00:24 → 00:48`
  - ✓ **A5 验证通过**：CineView 容器 bg = `rgba(0,0,0,0)` 透明，色带可透出（`!important` 覆盖生效）
  - ✓ 语言切换触发重渲染（Home↔首页）+ 写入 localStorage(`zh`)
  - ✓ `/demo`、`/docs` 路由 200 + 顶栏常驻
  - 验收脚本：`site/acceptance.mjs`（playwright 软链自 npx 缓存）；截图：`site/shot-*.png`
  - ⚠️ **遗留给阶段 2**：当前 HomePage 仅最小占位内容，截图见正文顶到边轨下方/与 Hero 重叠——阶段 2 正式 6 幕内容须 respect rail(`--rail-width`)+ topbar(`--topbar-height`)留白，整页替换占位。

## 阶段 2 — 官网 + 手机 drag 高光场景

- [ ] 2.1 6 幕 scroll 叙事骨架（Hero / 理念 / 双引擎对比 / 手机体验 / 能力矩阵 / CTA+Footer）
- [ ] 2.2 Hero 三 CTA（开始使用→/docs 快速开始、API→/docs API 参考、GitHub）
- [ ] 2.3 高光：手机壳场景（Scene.scroll center-lock，手机 zoomIn+blur 入场无退场）
- [ ] 2.4 预挂载 drag 实例 + pointer-events 门控 + onZoneProgress 阈值揭幕解锁
- [ ] 2.5 手机内 4 屏 drag demo（delay + waitFor 链式编排，中英文）
- [ ] **阶段 2 验收**：独立 agent 真实浏览器实测手机场景交接 + drag 拖拽可用

## 阶段 3 — Demo Hub + 全部文档

- [ ] 3.1 `/demo` 双模式 Hub（顶部切换 drag 全屏 / scroll 完整案例）
- [ ] 3.2 scroll 完整案例（center-lock + zone progress 可视化 + 元素 waitFor 沿滚动推进）
- [ ] 3.3 文档框架（react-markdown + remark-gfm + rehype-highlight + 双语目录加载 + 侧边栏导航 + 锚点）
- [ ] 3.4 文档内容：入门（介绍/安装/快速开始）中英文
- [ ] 3.5 文档内容：核心概念（双轴换算 / drag vs scroll / 时间轴与所有权）中英文
- [ ] 3.6 文档内容：组件 API（CineView/Scene/Animate/Position/Image/Container）中英文
- [ ] 3.7 文档内容：动画（预设总览/自定义/组合 waitFor）中英文
- [ ] 3.8 文档内容：进阶（center-lock 与 zone / 冷启动预加载 / 回调错误 / 性能）中英文
- [ ] **阶段 3 验收**：文档双语切换、代码高亮、锚点跳转，Demo Hub 双模式可体验

## 附加交付

- [ ] X.1 中英文双语框架梳理 md（详细架构介绍，放项目根或 site）

---

## 2026-07-19 续作 — 第五幕移动端 Drag（分幕确认）

> 用户最新裁决覆盖旧的“第4幕手机”顺序：保留现有 Hero / 胶片 / 舞台 / 视频四幕，
> 将移动端 drag 体验放入当前第五幕 `placeholder-5`。先只完成手机内第一幕并展示，
> 用户确认后再继续第二至第四幕及 PC drag 展开。

- [x] D1 回读 `DESIGN.md`、本任务流与当前 site 视觉/幕次，锁定 drag 双轨语义和第五幕插槽。
- [ ] D2 实现手机内真实 drag 实例的第一幕：品牌入镜、拖拽提示、render/element 双轨视觉隐喻。
- [ ] D3 将手机体验嵌入官网第五幕，沿用暖白胶片、Fraunces/mono、REC 时间码与当前 LUT 色带。
- [ ] D4 完成中英文第一幕文案接线，不提前实现 drag 第二至第四幕。
- [ ] D5 `site` type-check/build + 独立 agent 在真实浏览器验证移动/桌面尺寸、拖拽与无遮挡。
- [ ] D6 输出第五幕第一屏截图供用户确认；确认前停止后续幕次开发。

### 2026-07-20 用户确认后的实现裁决

- `/drag` 是移动端 Drag 的独立入口；PC 首页第五幕只嵌入同一套 Drag 体验，不为 PC 另写一套分页逻辑。
- 第一阶段只实现移动端 Drag 第一幕。为保证第一幕可真实拖拽，允许挂载一个无第二幕内容的最小目标 Scene，用于验证切换、回弹和反向回拖。
- PC 第五幕外层由 scroll 引擎强接管，直到手机完成入镜；手机内容在解锁时才挂载/启用，避免外层 scroll 与内层 drag 同时拥有输入。
- 内层 Drag 的 pointer/touch 事件直接截断冒泡，拖拽期间不让外层 scroll 再消费同一输入。
- `/drag` 在移动端视口内直接铺满体验；PC 首页用手机壳包裹相同内层实现。

### 第一幕执行节点（当前批次）

- [x] D2.1 抽出可复用 `DragPhoneExperience`，内部只拥有一套真实 `CineView mode="drag"`。
- [x] D2.2 完成第一幕视觉：暖白胶片舞台、REC/DRAG 时间码、品牌入镜、拖拽提示、双轨隐喻。
- [x] D2.3 加入最小目标 Scene，仅用于真实分页与回弹验证，不实现第二幕内容。
- [x] D2.4 新增 `/drag` 路由并接入中英文第一幕文案。
- [x] D2.5 将同一实现嵌入首页第五幕；外层 scroll 解锁后才挂载并启用内层 Drag，内层截断 pointer/touch 冒泡。
- [x] D2.6 站点 type-check/build；实现者回读改动并检查每帧路径、状态所有权与事件清理。
- [x] D2.7 独立浏览器 agent 在移动/桌面尺寸验证 `/drag` 和第五幕：入镜、拖拽、释放结算、反向回拖、无遮挡、并发动画掉帧/长任务。
- [x] D2.8 输出第一幕截图与浏览器证据；用户确认前停止，不实现第二至第四幕。

### 第一幕验收证据（2026-07-20）

- `/drag` 390×844：首屏中文/英文无遮挡；时间码避开语言按钮；站点 console errors/warnings = 0。
- pointer drag：13.03% 部分拖拽时 `scene0=-110px`、`scene1=734px`，RENDER/ELEMENT 轨约 `0.130/0.174`；释放回弹通过；长拖提交到目标 Scene；反向长拖返回第一幕。
- iPhone 15 touch（393×659、`maxTouchPoints=1`）：真实 CDP touch 上拖提交、反向 touch 返回均通过。
- 性能：两次完整 touch 往返共 282 个 rAF 样本，long tasks = 0，平均帧时长 16.66ms，p95 18.60ms，最大 18.70ms，>33ms = 0，>50ms = 0。
- 首页第五幕：未到 zone 时 `data-drag-unlocked=false` 且 inner Scene 数为 0；解锁后 inner Scene 数为 1、手机壳完整入镜。内层 pointer 拖拽前后外层 `scrollTop` 14 次采样保持 `36680` 不变，证明冒泡截断生效。
- 截图：`site/acceptance-shots/drag-first-mobile-390x844-final.png`、`site/acceptance-shots/drag-first-mobile-zh-390x844-final.png`、`site/acceptance-shots/drag-first-home-fifth-1440x900.png`。

> 旧阶段 2 的 D2–D6 仍保持未勾选；本批次只收口第一幕，等待用户确认后再继续第二至第四幕和 PC Drag 展开。
