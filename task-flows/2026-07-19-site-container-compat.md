# 2026-07-19 · 首页 Container 单尺子兼容

## 来源

承接 `2026-07-16-single-axis-px2vw.md` H5 的 site owner 遗留：当前首页可见内容主要
使用 `Position` 坐标 + 静态 CSS px，未真实消费升级后的 `Container` 盒模型换算，因此
视口宽度变化时外层场景坐标按单尺子变化，但内容盒模型仍停留在物理 px。

## 范围

- 只更新 `site/` 首页与其场景组件的 `Container` 兼容。
- 不建设 Demo Hub / Docs，不改文案结构，不重做视觉。
- 不改 framework 源码，不改 Scene.scroll 预算、waitFor 链或 progress owner。
- 设计基准继续使用 `config={{ size: 1440 }}`，场景画布基准 1440×900。

## 节点

- [x] P0 阅读 DESIGN.md、单轴 task-flow 遗留、首页组件与 Container 实现
- [x] P1 建立首页统一的 1440×900 `Container` 场景画布边界（`HomeSceneCanvas`）
- [x] P2 Hero / Capability / DemoVideo / placeholder 接入画布，保持现有 Position 坐标与时间轴不变
- [x] P3 复核布局边界：Container 不设置 `position:relative` / `overflow:hidden`，避免把 Hero Position 的 viewport-center 语义错误改成 500px 窄屏画布语义；`film-gate` / `stage-frame` media transform 仅是内部窄屏降级，保留
- [x] P4 site type-check + build + diff/check
- [x] P5 独立 agent 真浏览器验收：宽屏/窄屏无形变、首页 scroll 正反向完整跑通

## 验证记录

- `pnpm --dir site type-check`：通过
- `pnpm --dir site build`：通过（422 modules，JS gzip 142.73 KB）
- `git diff --check`：通过
- 本地浏览器几何：1280×720 → canvas 1280×800；800×1200 → canvas 800×500，均符合 `viewportWidth × 900/1440`
- Scene DOM 高度仍分别为 720 / 1200（真实 viewport），未被 Container 画布高度替换
- 首轮独立验收发现窄屏 Hero 全部停在 opacity=0；最小化复现确认原因是误把 Container 设为 positioned containing block。移除该定位后，Hero 全链正常进入；窄屏 film title 在 scrollTop=1500 已推进到 opacity 0.46875，scrollTop=3700 达 1，frame-8 为 0.86

## 独立浏览器验收

独立 agent `019f76dd-06e1-7760-83cf-1ac8d0021f3c` 最终 PASS：

- 800×1200：canvas 800×500，Scene 800×1200；Hero title、两行 slogan、三个按钮、hint 全部 opacity=1
- Film：scrollTop=6000 时画布锁定 top=0，标题、胶片带、代码面板可见
- Stage：scrollTop=20940 时画布锁定 top=0，舞台面板与标题可见
- Video：scrollTop=32840 时内容可见；约 34880 正向释放，进入 scene5 后反向到 33480 重新锁定 top=0
- 1920×1080：canvas 1920×1200，Scene 1920×1080，Hero 与既有完整正反向路径无回归
- 两种 viewport 均无水平滚动；console 仅 React Router v7 future warnings，无 framework/site error

## 收口自检

- Container 只声明 1440×900 盒模型；未成为 Position owner，未改变 Scene viewport metrics
- 未新增 state/effect/layout 读取，scroll/drag 热路径零增量
- 未改 waitFor、duration、zone 或 takeover 预算
- 临时 readiness 诊断探针已从代码删除

## 2026-07-19 响应式回归重开

用户复查发现：虽然外层 Container 几何和 scroll owner 验收通过，但多宽高比下首页内部
仍存在错位、挤压。上一轮只验证了画布尺寸与关键元素“可见”，没有验证内部盒模型是否与
Position 使用同一把尺子，因此不能算完整收口。

- [x] P6 建立 1920×1080 / 1440×900 / 1280×720 / 1024×768 / 800×1200 / 390×844 浏览器矩阵，记录每幕溢出与重叠
- [x] P7 按证据统一 Position 坐标与关键盒模型尺寸，消除外层 Container + 内部静态 CSS px 的比例分裂
- [x] P8 清理或改写与单尺子冲突的 media-query transform、nowrap 与固定宽度补丁
- [x] P9 site type-check + build + diff/check；逐节点回读热路径与死样式
- [x] P10 独立 agent 全矩阵浏览器复验：首页各幕正反向滚动、无错位挤压、无新增掉帧

## 节点自检

- `Container` 只拥有盒模型换算，`Position` 继续唯一拥有坐标。
- 不给 scroll/drag 热路径新增 state/effect/layout 读写。
- takeover scene 的 DOM 测量仍来自真实渲染尺寸，画布兼容不得创建视觉尺寸与 scroll metrics 偏差。
- 不留下旧 media-query transform scale 与 Container 双重缩放。

## P6 复现矩阵

- 1920×1080 / 1440×900：基准构图基本正常。
- 1280×720：胶片与舞台开始出现局部盒模型偏大；旧 media transform 与 Position 换算叠加。
- 1024×768：Video 标题与副标题开始重叠，Capability 固定宽度明显偏离坐标尺子。
- 800×1200：画布 800×500，但胶片标题约 400×173、caption 560px、gate 656px、code 600px；舞台 frame / code 仍约 620px，出现挤压和遮挡。
- 390×844：画布 390×243.75，但 film caption / code 仍为 560 / 600px，stage frame / code 仍约 619 / 620px，video subtitle 仍约 482px，形成严重内部溢出。
- 根因确认：Position 坐标使用 `viewportWidth / 1440`，后代 CSS px/rem 与内联 transform 仍为物理长度；另有 1280px media transform 二次缩放。文档无横向 scrollbar 不能证明内部构图正确。

## P7-P8 实现与本地浏览器复测

- `.home-scene-canvas` 仅提供继承式 `--cv-u = 100vw / 1440` 与首页局部 text / space / radius / shadow token；未增加 position、overflow、contain 或 container-type。
- Capability / DemoVideo 的固定宽高、间距、字体外长度、blur / shadow / translate 全部改为 `designValue * --cv-u`；Position 坐标仍由框架换算。
- Stage dock 的 `x/y` 改为相对面板自身尺寸的百分比，390px 下三列最终边界分别为 16.9–106.6 / 150.15–239.85 / 283.4–373.1，无互撞。
- Hero / Capability / Video 的入场位移改为自身盒模型百分比；Hero 中文静态偏移、Video 字幕逐字位移与 blur 使用 `--cv-u`。
- 删除 1280px 下 `.film-gate scale(.82)` / `.stage-frame scale(.86)` 二次缩放。保留的 nowrap 均与字体和容器同步缩放，已不再形成比例分裂。
- Hero hint 从绝对 `y=840` 改为 viewport center + 360 design px：390×844 下位于 stack 后 13px，1920×1080 下 bottom≈1036，均在视口内。
- Stage code y 从 632 调整到 620：1920×1080 下 bottom≈1080.3，不再裁掉底部圆角/末行。
- 六档浏览器几何断言全部通过：canvas、film gate/caption/code、stage frame/code/card 坐标、video title/subtitle 和字体均等于设计值 × `viewportWidth/1440`；六档 `scrollWidth === viewportWidth`，旧 transform computed style 均为 `none`。
- 390×844、800×1200、1920×1080 已本地推进到 Stage / Video 并反向回 Film；Stage panels→title→summary→code 与 Video title→subtitle 顺序断言通过。

## P9 工程验证与自检

- `pnpm --dir site type-check`：通过。
- `pnpm --dir site build`：通过（422 modules，JS gzip 142.72 KB）。
- `pnpm exec prettier --check ...`：本次相关文件全部通过。
- `git diff --check`：通过。
- 全仓相关 grep：旧 `.82/.86` media scale、旧 card 物理 left/top、Hero persist px、临时 DEBUG 标记均无残留；Capability / DemoVideo CSS 无物理 px。
- 热路径回读：未增加 React state/effect/layout 读取；Video 每帧仍只写原有叶子 style，新增 calc 仅替换长度表达式；progress / scroll owner / waitFor / duration / zone 均未改。

## P10 独立浏览器验收

独立 agent `019f7715-4fa5-7240-8af8-be01128e5b68` 最终 PASS，未修改文件：

- 六档 Hero / Film / Stage / Video 重叠面积均为 0，滚动容器均 `scrollWidth === clientWidth`。
- 390×844 Stage 三列边界 `16.90–106.60 / 150.15–239.85 / 283.40–373.10`；Video title→subtitle 间距 26.41px。
- 800×1200 Stage 三列宽均 184px、互撞面积 0；Video 间距 54.09px。
- 1024×768 Stage title→summary→code 间距 41.77px / 13.66px；1280×720 Video 间距 86.55px。
- 1920×1080、800×1200、390×844 均真实推进 Film→Stage→Video→Scene5，再反向重锁 Video→Stage→Film；大跨度输入均被 center-lock 截留，未跨段跳过。
- 并发滚动与多元素动画未观察到明显卡顿、停帧或输入阻塞；Browser lane 无 longtask entry，故性能结论为真机视觉观察而非量化 trace。
- 实现 lane console 无 error；仅 React Router v7 future warnings 与 Vite debug/info。

## 2026-07-19 英文响应式回归重开

用户复查指出上一轮六档验收实际只覆盖中文。英文长文案没有真实切换语言后验收，
因此“六档无重叠”的结论不完整，本 task-flow 再次重开。

- [x] P11 切换英文后重跑六档 Hero / Film / Stage / Video，记录英文专属换行、溢出与重叠
- [x] P12 修正英文长文案布局，同时保持中文和单尺子比例不回归
- [x] P13 site type-check + build + format + diff/check，回读热路径与语言分支死样式
- [x] P14 独立 agent 做中英文双语六档浏览器验收及三档正反向 center-lock 复验

### P11 已复现症状

- 390×844 Hero：英文两条 authored slogan 被自动折成四个视觉行；stack bottom≈544.63，hint y≈521.70–526.90，与按钮区 y≈519.03–544.63 重叠。
- 390×844 Stage：英文 title bottom≈143.69、summary y≈146.25–170.95、code y≈167.91，summary 与 code 重叠约 3px。
- 390×844 Video：第四行 subtitle `scrollWidth≈262`、可用 `clientWidth≈183`；subtitle 整体 `scrollWidth≈271 > clientWidth≈200`，被 `.demo-video` 裁剪。
- 390×844 Film：title / caption / gate / codecard 间距为正，当前未发现英文专属溢出。
- 六档 Hero 的 CTA/hint 重叠分别约 17.48 / 11.71 / 66.88 / 52.71 / 39.52 / 22.06px；根因是 authored slogan 行仍允许按空格二次折行。
- 六档 Stage summary/code 重叠分别约 14.93 / 11.20 / 9.94 / 7.95 / 6.23 / 3.04px；英文 title 在 720 design px 宽度下折两行，summary 在 620 design px 下占三行。
- 六档 Video 最后一行溢出分别约 390 / 292 / 261 / 208 / 162 / 79px；根因是 subtitle line 强制 nowrap，且绝对定位子元素只使用 shrink-to-fit 宽度。
- 六档 Film 三段垂直间距始终为正，英文 Film 无需专项改位。

### P12-P13 修复与本地双语矩阵

- Hero authored slogan 行增加 nowrap，仅禁止英文行被按空格二次拆分；六档 CTA→hint 最小间距为 12.94px（390×844）。
- Capability 根节点标注当前 `data-lang`；英文 Stage title 使用 1100 design px 行宽、summary 使用 900 design px 行宽，不改变中文宽度。
- DemoVideo 根节点标注当前 `data-lang`；subtitle 使用稳定 860 design px 基础宽度，英文扩为 1340 design px，保留四条 authored 行和逐字动画，不改文案换行。
- 英文六档全部通过：Hero / Film / Stage / Video 间距为正，Video 动画中四行 `scrollWidth <= clientWidth`，页面无横向溢出。
- 中文六档重新显式切回 `zh` 后全部通过；英文选择器未泄漏到中文，390×844 中文 Stage title/summary 宽度仍约 176.56 / 167.91px，Video 宽度仍为 860 design px。
- `pnpm --dir site type-check`、`pnpm --dir site build`、相关 Prettier check、`git diff --check` 均通过；构建 JS gzip 142.73 KB。
- 仅新增静态 `data-lang` 属性和 CSS 分支；未新增 state/effect/layout 读取，未改 progress / waitFor / duration / zone / scroll owner。

### P14 独立双语验收

- 两个新验收 lane 因 Browser 工具流程未完成，均按 FAIL/未完成记录，没有用于收口判断。
- 复用上一轮已成功完成中文六档的独立 agent `019f7715-4fa5-7240-8af8-be01128e5b68`，只补英文六档与英文三档正反向，最终 PASS，未修改文件。
- 英文六档 Hero CTA→hint 最小 gap 分别为 72.88 / 55.91 / 50.67 / 41.57 / 33.93 / 13.79px；两条 authored slogan 均各自保持单视觉行。
- 英文六档 Film / Stage / Video 最小 gap 均 > 0；390×844 分别为 4.88 / 5.20 / 26.41px。Stage 三 panel 两两重叠面积 0，Video 四行均 `scrollWidth <= clientWidth + 1`。
- 英文 1920×1080、800×1200、390×844 均真实推进 Film→Stage→Video→Scene5，再反向重锁 Video→Stage→Film；大输入未跳段，未观察到明显卡顿或输入阻塞。
- Console error 0；仅 React Router v7 future-flag warnings，无 CineView framework/site runtime error。
- 合并 P10 已完成的中文六档与本轮英文六档后，P14 双语验收完整收口。

## 2026-07-19 第三幕构图细修重开

用户复查指出 Stage 第三幕整体视觉重心偏下，且标题与 summary 的间隔过大。该问题属于
构图细节，上一轮只验证了“不重叠”，没有验证视觉节奏是否紧凑，因此再次重开。

- [x] P15 中英文 × 宽窄视口量取 Stage panels / title / summary / code 的视觉边界与留白
- [x] P16 整体上移第三幕主体并收紧 title→summary 间距，保持四层不重叠
- [x] P17 site type-check + build + format + diff/check，回读时间轴与热路径
- [x] P18 独立 agent 双语宽窄浏览器复验第三幕构图及正反向重入

### P15 构图量测

- 最终停靠态中英文几何一致，仅横向宽度不同。1440×900：panels `180–419.20`、title `432–481.27`、summary `540–600.80`、code `620–810.98`；主体视觉中心约 `495.49`，比画布中心低约 `45.49px`。
- 1920×1080：panels `240–558.93`、title `576–641.70`、summary `720–801.06`、code `826.66–1080.31`；代码框底边贴住并略超 viewport，整体重心明显偏下。
- 390×844：panels `48.75–113.53`、title `117–130.34`、summary `146.25–162.72`、code `167.91–220.33`；虽未重叠，但 title→summary 仍是三段留白中最宽的一段。
- 当前三段 gap 在 1440 为 `12.80 / 58.73 / 19.20px`，在 1920 为 `17.07 / 78.30 / 25.60px`，在 390 为 `3.47 / 15.91 / 5.20px`。根因是四层纵坐标整体偏低，且 title→summary 使用 `108` 设计 px，显著大于其它节奏。

### P16 构图修复与本地复测

- Stage 坐标由 `frame/title/summary/code = 180/432/540/620` 调整为 `140/400/480/560`；只改 `Position` 纵坐标，动画链、duration、waitFor、scroll budget 均未改。
- 1440×900 英文终态：panels `140–379.20`、title `400–449.27`、summary `480–540.80`、code `560–750.98`；三段 gap 为 `20.80 / 30.73 / 19.20px`，主体上下留白约 `140 / 149px`，构图基本居中。
- 1920×1080 中文终态：panels `186.66–505.60`、title `533.33–599.03`、summary `640–721.06`、code `746.66–1000.31`；三段 gap 为 `27.73 / 40.97 / 25.60px`，代码框底部保留约 `79.69px`。
- 390×844 中英文终态一致：panels `37.91–102.69`、title `108.33–121.67`、summary `130–146.47`、code `151.66–204.08`；三段 gap 为 `5.63 / 8.33 / 5.20px`，无重叠、无水平溢出。

### P17 工程验证与自检

- `pnpm --dir site type-check`：通过。
- `pnpm --dir site build`：通过（422 modules，JS gzip 142.72 KB）。
- `pnpm exec prettier --check site/src/components/CapabilityScene.tsx task-flows/2026-07-19-site-container-compat.md`：通过。
- `git diff --check`：通过。
- 回读确认本轮仅改四个 `Position.y` 和对应注释；没有新增 state/effect/layout 读取，没有改 `stageProgress` 写者、panel enter/exit、waitFor、duration、zone 或 scroll budget，运行时每帧代价不变。

### P18 独立浏览器验收

- 独立 agent `019f775c-a1eb-7d53-961e-7f3bf102996c`：1920×1080 中英文、390×844 英文终态通过。1920 三段 gap `27.73 / 40.97 / 25.60px`，code bottom `1000.31 < 1080`；390 英文 gap `5.64 / 8.33 / 5.19px`，code bottom `204.08 < 243.75` 画布底边。两档均无水平溢出，console error 0。
- 同一 agent 在 1920 真实滚出 Stage（`stageTop=-900`）后反向首步重新 center-lock（`stageTop=0`），随后持续锁定；未见跳段、明显卡顿或构图变化。
- 独立 agent `019f7766-6dd2-70a1-ab84-bb74bbf03e17` 补验 390×844 中文终态，最终 `scrollTop=26334`：panels max bottom `102.69`、title `108.33–121.67`、summary `130–146.47`、code `151.66–204.08`、画布 bottom `243.75`；gap `5.63 / 8.33 / 5.20px`，`scrollWidth/clientWidth=390/390`，全部 opacity 1，console error 0，PASS。

## 2026-07-19 第二/三幕代码框轴线细修重开

用户复查认为第二幕与第三幕代码框存在视觉歪斜。源码无显式 rotate/skew，需要区分真实几何偏心、包装层 transform 亚像素误差与内部内容/阴影造成的视觉错觉。

- [x] P19 中英文 × 宽窄视口量取 Film / Stage code card 外框、包装层、画布和标题中心线及 transform
- [x] P20 按证据统一两幕代码框的轴线、宽度或内部视觉配重，不改时间轴
- [x] P21 site type-check + build + format + diff/check，回读热路径
- [x] P22 独立 agent 宽窄双语浏览器复验两幕代码框水平、居中及正反向重入

### P19 代码框轴线量测

- 1440×900 中文终态：Film code card `left/right/center = 420/1020/720`、Stage `410/1030/720`；两者及全部 Position/Animate 包装层均 `rotate:none`、`transform:none`，Position 锚点层仅有预期的 `translateX(-width/2)`。
- 1920×1080：Film 宽 `800`、边界 `560–1360`；Stage 宽 `826.66`、边界 `546.67–1373.33`，中心都为 `960`，但左右边线各错开 `13.33px`。
- 390×844：Film 宽 `162.5`、边界 `113.75–276.25`；Stage 宽 `167.91`、边界 `111.04–278.96`，中心都为 `195`，左右边线各错开约 `2.71px`。
- 根因不是旋转或定位偏心，而是两张相同窗口视觉的设计宽度分别为 `600/620`，跨幕时边线与阴影轮廓跳动，形成视觉歪斜感。

### P20 轴线修复与本地复测

- 在 `.capability-full` 定义共享 `--cap-codecard-width: 620 * --cv-u`，Film / Stage 两张代码框统一消费该宽度；没有添加 rotate/skew 或位置补偿。
- 1920×1080 修复后两者均为 `left/right/width/center = 546.67/1373.33/826.66/960`。
- 390×844 修复后两者均为 `111.04/278.96/167.91/195`，`scrollWidth/clientWidth=390/390`。
- 1440×900 英文 Film 实图复核：代码框边界 `410–1030`，与 Stage 完全同轴；英文活动 code 行 `scrollWidth <= clientWidth`。

### P21 工程验证与自检

- `pnpm --dir site type-check`、`pnpm --dir site build`、相关 Prettier check、`git diff --check` 全部通过；构建 JS gzip 142.72 KB。
- 本轮仅新增一个静态 CSS 宽度变量并替换两处 width，没有新增 state/effect/layout 读取，没有改 Position 坐标、Animate timeline、progress owner 或 scroll budget，每帧热路径零增量。

### P22 独立浏览器验收

- 独立 agent `019f7777-a810-7600-8e1e-53a3ffa07c32`：1920×1080 中英文均 PASS。Film / Stage 均为 `left/right/width/center = 546.668/1373.332/826.664/960`，rotate/transform 均为 none，轴线误差 0px。
- 同一 agent 真实滚动完成 Film→Stage→滚出 Stage→反向 Stage→Film；两幕重新 center-lock 后轴线数值不变，无跳段或明显卡顿，`scrollWidth/clientWidth=1920/1920`，console error 0。
- 独立 agent `019f7777-a868-7ab0-92aa-28409e51fdd1`：390×844 中英文均 PASS。Film / Stage 均为 `111.043/278.957/167.914/195`，轴线误差 0px，rotate/transform none，`scrollWidth/clientWidth=390/390`，console error 0。
