# 41 条设计参考与 2.0 实现入口

[English](./lexicon.md) · [简体中文](./lexicon.zh-CN.md)

按内容需要选择参考。先用[需求与 PRD 指南](./design-assistant.zh-CN.md)确定读者任务，再查询本页相关条目。向使用者解释画面与取舍，不要求其从 41 个名称中自行选择。

编号、英文名称和原作链接对应 [Mocubix Lexicon](https://mocubix.renocrypt.com/lexicon/) 的 41 项。用途与 Cineview 映射是本项目的设计建议，不能视为原作与本地实现等价。原作素材、完整编排和浏览器条件需要分别核对。

## 如何使用这个索引

按“阅读任务、需要保留的内容关系、2.0 实现入口”查询。每景先选择一个主要动态目的，再加入有内容依据的辅助动作。[落地页指南](./landing-pages.zh-CN.md)说明如何保留阅读状态与素材关系。

实现入口分为三种，均不表示浏览器验收完成：

- 框架基础：已有相关组件、来源或预设；完整构图与时序仍由页面编排。
- 页面实现：使用页面 CSS、原生控件、素材处理或局部逻辑；不是额外的 Cineview 预设。
- 需扩展：当前对应的框架能力未接通或不存在；先说明限制，再选择替代方案或明确的扩展。

浏览器 CSS 能力需在目标环境确认。下表不承诺兼容版本。`on="clock"` 从 Scene 成为当前场景时开始，并跟随 Stage 暂停；`keyframes(name)` 不能用于 `exit` 或 `loop`。原生滚动与 drag 分页的区别见[实现边界](#实现边界与源码)。

## 滚动驱动：01 至 13

| 编号与原作                                                                                       | 适合的阅读任务       | 需要保留的设计关系                   | 2.0 实现入口与限制                                                                          |
| ------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| 01 [Scroll Progress Timeline](https://mocubix.renocrypt.com/lexicon/scroll-progress-timeline/)   | 表示整页阅读进度     | 一个整体进度对应页面中的位置         | 框架基础：`on="page"`；drag 中表示有限场景的位置，不是文档原生滚动进度                      |
| 02 [View Progress Timeline](https://mocubix.renocrypt.com/lexicon/view-progress-timeline/)       | 对象经过视口时变化   | 进度属于指定对象，并选定变化区间     | 框架基础：`on="view(self)"`、`view(#id)` 和具名 view range；核对主体与区间                  |
| 03 [Pinning & Scrub](https://mocubix.renocrypt.com/lexicon/pinning-and-scrub/)                   | 固定构图内分步解释   | 保持位置与随滚动推进是两个决定       | 框架基础：Scene `zone` 与场景内固定内容；drag 提交后继续元素时间，不等同于停手保持的 scroll |
| 04 [Parallax](https://mocubix.renocrypt.com/lexicon/parallax/)                                   | 区分前后层次         | 较小的相对移动保留主体和文字关系     | 框架基础：`drift` 或独立容器的位移；避免用大幅运动替代内容层级                              |
| 05 [Horizontal Scroll Section](https://mocubix.renocrypt.com/lexicon/horizontal-scroll-section/) | 阅读宽图、横向比较   | 行程来自真实溢出，说明对应实际主体   | 框架基础：Scene `track="x"`；标签与素材对齐、窄屏重排由页面负责                             |
| 06 [Sticky Stacking Cards](https://mocubix.renocrypt.com/lexicon/sticky-stacking-cards/)         | 累积步骤或相关条目   | 后一张到达时保留前面的集合关系       | 框架基础：`cv-stack`；普通 scroll、zone、drag 的到达方式不同，卡片标签另行编排              |
| 07 [Scroll Velocity Skew](https://mocubix.renocrypt.com/lexicon/scroll-velocity-skew/)           | 对快速浏览作轻微反馈 | 速度是独立信号，停下后恢复稳定       | 框架基础：`skew`、velocity 来源；不是加速度，正文不应持续变形                               |
| 08 [Timeline Scope](https://mocubix.renocrypt.com/lexicon/timeline-scope/)                       | 图与远处说明同步     | 多个对象使用同一被解释主体的进度     | 框架基础：`view(#id)` 引用同一 Scene 的对象；不提供任意跨 Scene 的通用来源共享              |
| 09 [Path Drawing](https://mocubix.renocrypt.com/lexicon/path-drawing/)                           | 解释连接、路线或先后 | 线条绘制顺序与内容含义对应           | 框架基础：SVG `draw`；配置适合描边的形状，任意路径形变另需插值实现                          |
| 10 [Word Scrub](https://mocubix.renocrypt.com/lexicon/word-scrub/)                               | 关键词带出对应图像   | 词区间重叠，关键词与图片共享变化区间 | 框架基础：`split="words"` 与 stagger；关键词到图片的配对和停留由页面编排                    |
| 11 [Curtain Overlap](https://mocubix.renocrypt.com/lexicon/curtain-overlap/)                     | 连续章节覆盖切换     | 下一景覆盖上一景，前景内容仍有归属   | 框架基础：Scene `stack`、`covered`；不是只给整景加淡入淡出                                  |
| 12 [Depth of Field](https://mocubix.renocrypt.com/lexicon/depth-of-field/)                       | 在阅读位置强调对象   | 清晰区间位于经过视口的中段           | 框架基础：`focus(band)`；普通 `focus` 只是模糊到清晰入场，不能代替中央区间                  |
| 13 [Scroll-Triggered Count](https://mocubix.renocrypt.com/lexicon/scroll-triggered-count/)       | 解释有依据的数值     | 最终值、单位与标签稳定可读           | 框架基础：`count`；页面提供真实最终数字，按来源决定播放与重播行为                           |

## 滚动行为：14 至 24

| 编号与原作                                                                                 | 适合的阅读任务         | 需要保留的设计关系                 | 2.0 实现入口与限制                                                                                  |
| ------------------------------------------------------------------------------------------ | ---------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| 14 [Scroll Snap](https://mocubix.renocrypt.com/lexicon/scroll-snap/)                       | 逐项浏览完整图片或条目 | 原生浏览惯性与完整条目的对齐       | 页面实现：局部原生滚动容器与 CSS snap；drag 的场景归位不是原生 snap 的等价实现                      |
| 15 [Snap Stop](https://mocubix.renocrypt.com/lexicon/snap-stop/)                           | 逐项经过必须阅读的步骤 | 是否允许跳过条目是内容决定         | 页面实现：局部 CSS `scroll-snap-stop`；没有同名框架属性，也不等于分页阈值                           |
| 16 [Scroll Markers](https://mocubix.renocrypt.com/lexicon/scroll-markers/)                 | 知道位置并跳转条目     | 当前项、焦点和导航顺序一致         | 页面实现：普通锚点或目标环境支持的 CSS markers；场景链接可用 `aria-current` 状态                    |
| 17 [Scroll Buttons](https://mocubix.renocrypt.com/lexicon/scroll-buttons/)                 | 明确地上一项、下一项   | 首尾、禁用状态与键盘操作完整       | 页面实现：按钮配 `stage.goTo()`，或局部原生 CSS 控件；页面负责标签和首尾状态                        |
| 18 [Sticky State Query](https://mocubix.renocrypt.com/lexicon/sticky-state-query/)         | 内容保持位置后调整样式 | 样式依据实际保持状态变化           | 框架基础：受管 Scene 的 `data-cv-stuck`；任意页面 sticky 对象需自身 CSS/逻辑                        |
| 19 [Snapped State Query](https://mocubix.renocrypt.com/lexicon/snapped-state-query/)       | 标识当前条目           | 选择状态与实际浏览位置对应         | 框架基础：Scene `data-cv-current` 提供场景状态；局部原生 snapped 查询另属页面实现，两者含义不同     |
| 20 [Direction State](https://mocubix.renocrypt.com/lexicon/direction-state/)               | 根据阅读方向调整导航   | 方向变化要稳定，返回时仍能找到操作 | 框架基础：`data-cv-direction` 与 direction 来源；页面负责导航行为和键盘焦点                         |
| 21 [Infinite Loop Scroll](https://mocubix.renocrypt.com/lexicon/infinite-loop-scroll/)     | 无首尾地浏览集合       | 循环接续与当前项、焦点一起保持     | 需扩展：当前 Stage 是有限 Scene 集合；局部循环列表也需页面处理复制、焦点与定位                      |
| 22 [Kinetic Drag](https://mocubix.renocrypt.com/lexicon/kinetic-drag/)                     | 拖动图片带后惯性浏览   | 松手后的滑行属于内容容器           | 页面实现：局部横向容器；Stage drag 是分页，不提供原作的自由惯性滑行                                 |
| 23 [Scrollspy](https://mocubix.renocrypt.com/lexicon/scrollspy/)                           | 目录指示正在阅读的章节 | 阅读位置与目录高亮共同更新         | 框架基础：场景锚点与 `aria-current`；Scene 内更细的标题跟踪由页面负责                               |
| 24 [Overscroll Containment](https://mocubix.renocrypt.com/lexicon/overscroll-containment/) | 操作局部滚动面板       | 内部操作与页面移动边界清楚         | 页面实现：CSS `overscroll-behavior` 与独立控件；另检查 drag 的手势识别，单一 CSS 属性不代替输入处理 |

## 图片：25 至 31

| 编号与原作                                                                                   | 适合的阅读任务           | 需要保留的设计关系                 | 2.0 实现入口与限制                                                                    |
| -------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------- |
| 25 [Blur-up (LQIP)](https://mocubix.renocrypt.com/lexicon/blur-up-lqip/)                     | 图片未准备好时保留构图   | 占位与最终图片尺寸、主体一致       | 框架基础：`develop` 和图片占位素材；页面仍需预留尺寸与失败状态                        |
| 26 [Ken Burns](https://mocubix.renocrypt.com/lexicon/ken-burns/)                             | 缓慢观察图片细节         | 焦点、裁切、观察时长和叠化共同安排 | 页面实现：完整方案需焦点移动和共同暂停；`push` 只提供原点缩放，不能当成完整 Ken Burns |
| 27 [Duotone](https://mocubix.renocrypt.com/lexicon/duotone/)                                 | 让不同图片形成统一视觉组 | 亮度分别对应深、浅两种颜色         | 框架基础：`duotone`；核对真实素材和图像加载，不用简单单色覆盖冒充完整映射             |
| 28 [Progressive Blur](https://mocubix.renocrypt.com/lexicon/progressive-blur/)               | 在图片旁放文字而保留主体 | 模糊强度朝文字区域逐渐增加         | 页面实现：分层模糊与遮罩；没有对应完整预设，普通 focus 不提供空间渐变模糊             |
| 29 [Ordered Dithering](https://mocubix.renocrypt.com/lexicon/ordered-dithering/)             | 为素材选择有限色阶风格   | 固定规则的像素图案表达中间明暗     | 页面实现：预处理素材或独立 canvas；运行时像素读取需可读取的跨源素材，不由 fx 自动提供 |
| 30 [Clip-path Reveal](https://mocubix.renocrypt.com/lexicon/clip-path-reveal/)               | 按方向揭示主体或结构     | 显示边缘的方向有内容含义           | 框架基础：`wipe`、`reveal` 或受支持的 clip 声明；任意形状插值需核对实际能力           |
| 31 [Image Comparison Slider](https://mocubix.renocrypt.com/lexicon/image-comparison-slider/) | 同一主体的前后对比       | 两张图对齐，分界由读者控制         | 页面实现：原生 range 与图片裁切；保留键盘操作，并让操作与 drag 分页分开               |

## 文字：32 至 36

| 编号与原作                                                                                   | 适合的阅读任务         | 需要保留的设计关系                   | 2.0 实现入口与限制                                                                       |
| -------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| 32 [Split Text Reveal](https://mocubix.renocrypt.com/lexicon/split-text-reveal/)             | 短标题或短句按行出现   | 行内裁切与逐行节奏配合               | 框架基础：`split="lines"`、`rise(line)`、stagger；字体和双语换行后重查，正文保留语义文本 |
| 33 [Variable Font Animation](https://mocubix.renocrypt.com/lexicon/variable-font-animation/) | 用字形变化强调文字     | 使用字体实际支持的连续字轴           | 框架基础：`axis`；页面选择字体与合法轴范围，并检查行宽变化                               |
| 34 [Text Mask](https://mocubix.renocrypt.com/lexicon/text-mask/)                             | 让大字与图片共同构图   | 图片焦点与字形中的可见部分对应       | 页面实现：CSS 文字裁切和背景关系；`reveal` 不能自动建立图文遮罩布局                      |
| 35 [Vertical Writing Mode](https://mocubix.renocrypt.com/lexicon/vertical-writing-mode/)     | 展示适合竖排的文字内容 | 标点、数字与拉丁文字按排版规则处理   | 页面实现：CSS writing-mode；`unroll` 提供展开运动，竖排与阅读顺序仍由页面决定            |
| 36 [Marquee](https://mocubix.renocrypt.com/lexicon/marquee/)                                 | 展示可浏览的连续文字带 | 复制内容无重复焦点，速度适合实际宽度 | 页面实现：测量宽度、CSS/WAAPI 循环、暂停和减少动态布局；loop 预设不自动完成这些工作      |

## 颜色：37 至 41

| 编号与原作                                                                             | 适合的阅读任务           | 需要保留的设计关系             | 2.0 实现入口与限制                                                                                      |
| -------------------------------------------------------------------------------------- | ------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 37 [Token Interpolation](https://mocubix.renocrypt.com/lexicon/token-interpolation/)   | 让相关颜色连续变化       | 背景、正文与强调色保持各自角色 | 框架基础：`hue` 提供角度变量，页面 CSS 定义配色；每段过渡都需检查对比度                                 |
| 38 [Scoped Rotation](https://mocubix.renocrypt.com/lexicon/scoped-rotation/)           | 控制颜色变化的影响范围   | 动画变量只传给需要它的内容     | 页面实现：把变量与动画限制到适合的容器；不是额外的颜色效果，性能需实际测量                              |
| 39 [Gamut Arc](https://mocubix.renocrypt.com/lexicon/gamut-arc/)                       | 在颜色过渡中保留预期色彩 | 明确插值路线并检查中间颜色     | 页面实现：选择 CSS 插值或预先生成中间色；没有通用色域路径求解器，hue 不等于任意颜色路线                 |
| 40 [Difference Inversion](https://mocubix.renocrypt.com/lexicon/difference-inversion/) | 让覆盖文字适应变化背景   | 混合范围清楚，中灰区域仍需可读 | 框架基础：`invert`；页面检查素材与中灰对比，必要时采用明确底色                                          |
| 41 [Threshold Flip](https://mocubix.renocrypt.com/lexicon/threshold-flip/)             | 章节切换完整主题         | 每景有协调的背景、正文和强调色 | 框架基础：Scene `theme` 与 Stage `data-cv-theme`；页面提供完整配色和过渡；与 drag 的 threshold 参数无关 |

## 实现边界与源码

来源与预设查[效果定义](../../v2/src/core/fx.ts)，结构与属性查[JSX 接口](../../v2/src/jsx.ts)，导航查[公开接口](../../v2/src/types.ts)与[Stage](../../v2/src/elements/stage.ts)。时序和组合分别查[时间求解](../../v2/src/core/time.ts)与[渲染层](../../v2/src/render/layers.ts)。这些当前实现决定可生成的代码，原作名称不能代替能力核查。

drag 翻页、scroll 文档进度和局部原生滚动容器有不同的进度与手势。嵌套控件要单独检查指针、键盘和移动端输入。`on="clock"` 提供从 Scene 入场开始的时间，并跟随 Stage 暂停；页面自行创建的运动仍需处理暂停与清理。

实现一个条目时记录读者任务、保留的原作关系、页面自定义部分和实际验收。给用户的建议可以组合多个条目的思路，但需解释各自用途，并检查中间画面、停止、反向、取消、重入和减少动态效果。原作的性能描述不作为 Cineview 的性能结论。
