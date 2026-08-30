# 2026-08-27 文档站全面覆盖 + 头部 shell 重构

方案：`~/.claude/plans/docs-full-coverage-shell.md`（已批准）。框架源码零改动，全部落在 `site/` 与文档内容。

## 用户裁决

| 议题 | 裁决 |
|---|---|
| 头部范围 | 文档站全局 shell（app bar + 搜索 + 翻页器，页头瘦身为面包屑） |
| drag 落位 | 新增 `drag/` 专章组 5 页，`scroll/` 由 centerlock/direction-x 等升组 |
| 隐性契约 | 独立 `concepts/05-dom-contract` 页，各组件页交叉引用 |
| pitfalls | 只留用户能踩到的，逐条回源码验真；框架修复史一律不写 |
| `data-cineview-ignore-drag` | **写进文档，当公共 API**（drag/02-gestures + dom-contract） |
| 旧 slug | **加重定向表**（DocsPage 里 LEGACY_SLUG_MAP → Navigate） |

## 真机取证（2026-08-27，localhost:4002，端口 4000/4001 被占）

探针 `site/scripts/_docs-audit.mjs`（几何断言）+ `_docs-shots.mjs` / `_docs-crop.mjs`（截图）。112 次测量（28 页 × 4 视口），console 零错误。证据在 `site/output/docs-audit/`（gitignore 覆盖，不进仓）。

### 实测结论

| 项 | 数据 | 判定 |
|---|---|---|
| 表格横向溢出 | 21 次，全部在 mobile；最坏 `03-animate` 表 scrollWidth 787 vs 容器 326（溢出 **461px**） | FAIL |
| 单元格换行 ≥3 行 | **51 次测量命中**；desktop 就有 22 次 | FAIL |
| 最坏单元格 | `09-use-animate-timeline` 的 `frame` 行：141px 列宽塞 130 字说明 → desktop **7 行**、laptop **10 行** | FAIL |
| 密集换行 | `03-animate` Props 表 desktop **48/64 单元格**在换行；`02-scene` mobile 40/44 | FAIL |
| 正文可用宽 | 1440 视口下 article 栏 944px，但 markdown 只得 **730px**——左右各 72px padding 吃掉 144px | 需调 |
| 页面级横向溢出 | mobile `03-animate` docScrollWidth 449 > 390 | FAIL（根因是侧栏，见下） |
| mobile 横向溢出元凶 | 不是表格（表格自己 `overflow-x: auto` 收住了），是 `.docs-nav__group` 横向排布溢出到 x=620 | FAIL |
| 代码块溢出 | desktop 1 处 | 可接受（代码块本就横滚） |
| 结构 | `h1` 1 个（页头），文章首标题是 `h2`——层级错位（文章标题与正文 h2 同级） | 需调 |
| 页头高度 | 287px（mobile 351px），全部是 eyebrow + h1 + lead + 返回按钮 | 需调 |

### 根因（已核 CSS）

1. **表格换行**：`global.css:751-757` 表格是 `display: block; overflow-x: auto`，宽度不撑破栏——但因此列宽由内容按比例挤压，4 列表在 730px 里每列只剩 ~140-230px，说明列被压成 4-10 行。`th/td` 无 `min-width`、无 `white-space` 控制，`font-size: 0.9rem`。
2. **正文过窄**：`.docs-article` padding `clamp(28px, 5vw, 72px)`（`:539`）+ 三栏 grid `232px / 1fr / 200px`（`:478`）。944 − 144 = 730。
3. **mobile 溢出**：`:864-871` 窄屏把 `.docs-nav` 改成 `display: flex; overflow-x: auto`，但 `.docs-nav__group { min-width: 180px }`（`:876`）× 6 组在 326px 容器里溢出，且 flex 容器的 `overflow-x: auto` 没能阻止子项参与文档宽度计算。

## 目标 IA（35 页 × 2 语言）

```
getting-started/  01-introduction 02-installation 03-quickstart 04-choosing-mode
concepts/         01-modes 02-timeline 03-responsive 04-orchestration 05-dom-contract
drag/             01-layout 02-gestures 03-dual-track 04-callbacks 05-drag-pitfalls
scroll/           01-centerlock 02-zones-budget 03-fixed-layer 04-scrollbar 05-scroll-pitfalls
reference/        01-cineview 02-scene 03-animate 04-animate-video 05-position
                  06-image 07-container 08-presets 09-use-animate-timeline 10-types
advanced/         01-performance 02-preload 03-callbacks 04-direction-x 05-custom-animation
                  06-common-pitfalls
```

slug 全局唯一（路由是 `/docs/:slug`，组不进 URL），故三张 pitfalls 页各自带模式前缀。

## 文案风格：保持现状（用户明确要求）

现有 28 页的文风是资产，不重写腔调。写新页与改旧页一律沿用：

- **开篇一句话点题**，不写「本文将介绍」类预告腔。
- **表格给事实**（prop / 类型 / 默认 / 说明四列制），散文只讲表格讲不了的因果。
- **默认值明确写出**，没有默认就写「无」（EN 写 `none`），不留空。
- **坑用「症状 → 根因 → 正解」三段式**，症状一句话、可对号入座。
- **破折号纪律延续**：散文区 `—` / `–` / `——` 零命中（N5 grep 断言），代码块内豁免。
- 不用「赋能 / 无缝 / 一站式 / 强大」类营销词；不写「已修复 / 曾经 / 旧版本」类历史。
- 中文用「」引号，术语（zone / takeover / scrub / center-lock / phase）保留英文原词不硬译。
- 交叉引用写成 `见 [页名](/docs/slug)`，每页末尾「下一步 / 相关页面」保留。

N4 每批子 agent 的 prompt 必须内联这段，并附 2 个现有页作为风格样本（`concepts/02-timeline.md` + `advanced/08-pitfalls.md`）。

## 节点

- [ ] **N0 排版修复**（新增，置于内容之前——先修容器再灌内容，否则 35×2 页要在坏排版里返工两遍）
  - N0.1 表格：`th/td` 给 `min-width`（首列 code 列不换行 `white-space: nowrap`，说明列吃剩余空间）；4 列表在 ≥1280 起不得有单元格 >2 行；`03-animate`/`02-scene`/`09-use-animate-timeline` 三张最坏表逐一验
  - N0.2 正文宽度：article padding 从 `clamp(28,5vw,72)` 收到 `clamp(24,3vw,44)`，markdown 可用宽 730 → ≥840；TOC 栏 200 → 180
  - N0.3 mobile 侧栏溢出：`.docs-nav__group` 的 `min-width: 180px` 在 flex 横滚下溢出文档宽 → 改 `flex: 0 0 auto` + 容器 `overscroll-behavior-x: contain`，或窄屏折叠为 `<details>`。判据：mobile `docScrollWidth === innerWidth`
  - N0.4 标题层级：文章标题从 `h2` 升 `h1`，页头 h1 降级（与 N3 页头瘦身一并做）
  - 门：`_docs-audit.mjs` 复跑，表格溢出 0（mobile 允许表格自身横滚但不得撑破页面）、≥3 行单元格 0、页面横向溢出 0

### N0 执行结果（2026-08-27 完成）

| 项 | 实际改动 | 效果 |
|---|---|---|
| N0.1 | ≥761px 下首列 8.5rem / 类型列 7rem 下限 + 首列 code `nowrap` | desktop 最坏单元格 **7L→4L**，≥3 行表 **22→10** |
| N0.2 | padding 收窄 + TOC 200→180 + **76ch 测度从容器下移到散文元素** | desktop markdown **730→878px** |
| N0.3 | `.docs-nav` 加 `contain:inline-size`；`min-width`→`flex:0 0 180px`；**真根因是散文里 47 字符不可断标识符** → inline code 加 `overflow-wrap:anywhere` | 页面横向溢出 **1→0 闭合** |
| N0.4 | 文章标题 `h2`→`h1`；页头站点名改 `.docs-page__title` div（值逐条对齐 `tokens.css:102-111`，零视觉变化） | 每页恰好一个 h1 |

门：页面横向溢出 **0** ✅ / console 错误 **0** ✅ / `tsc` **0** ✅ / prettier ✅ / site-contracts **59/59** ✅ / `vite build` ✅

**两个过程发现**

1. **正文宽的真实约束不是 padding，而是 `.docs-article__markdown` 的 `max-width:76ch`**。单收 padding 无效（desktop 仍 730），因为容器封顶时子元素无法反向突破。解法是把 76ch **下移到散文元素自身**，表格与代码块自然获得整栏宽。
2. **探针初版测错了对象**：用单元格 box 高度算行数，而单元格会拉伸到行内最高者 → 一行四格全报同一数字（1 行内容的 `size` 被报成 20 行），误导了一整轮修复方向。已改用 `Range.getBoundingClientRect()` 量文本自身高度。这是 [[probe-must-assert-intent]] 的又一次复现。

### N0b 堆叠卡片（用户裁决「按卡片改」，已完成 2026-08-27）

列宽下限在窄容器里无解——两次实测都是把压缩从一列转移到另一列（末列 15rem → 中间列 64px、最坏 9→20 行；末列 18rem → laptop ≥3 行表 22→29）。改为**列数归一**：≤1280px 时一行渲染成一张卡。

**实现**
- `DocsPage.tsx`：新增 `TableHeadersContext` + `table`/`tr` 组件覆盖，渲染期把表头文本注入每个 `td` 的 `data-label`。**CSS 取不到 thead 文本，列名必须由 JS 下发**，否则卡片里的裸值无从判断属于哪一列。
- `global.css`：`@media (max-width: 1280px)` 下 `table/tbody/tr/td` 转块级，`tr` = 一张带描边圆角的卡，`td` = `5.5rem + 1fr` 两栏 grid，列名走 `td::before { content: attr(data-label) }`。
- `thead` 用 `clip-path: inset(50%)` 隐藏而非 `display:none`——保留无障碍树里的表头语义。
- 空表头（如 `04-choosing-mode` 的对比表首列）走 `[data-label='']` 回退到单栏，不留空位。
- 断点严格互补：列宽下限与 `nowrap` 收到 `≥1281px`，与卡片档不重叠，否则卡片 td 会同时吃到 min-width 被撑破。

**定档依据（实测正文栏宽）**：1280→727px、1024→699px、920→601px，四列表最坏分别换 6/7/9 行，全都压不开；只有 ≥1281px（正文栏 878px）够放真表格。

**门**：卡片档 100 页全部生效、`rowsOverflowing` **0**、`headerHidden` true、870/877 单元格有列名（7 个是故意留空的表头）；desktop 真表格最坏 **4L**；页面横向溢出 **0**；console 0；`tsc` 0；prettier ✅；site-contracts 59/59；`vite build` ✅。

**代价（已量化，需知悉）**：卡片比表格高 3.5×——`03-animate` 首表 965→3391px，整页 6557→9739px。这是列数归一的必然结果（4 列 → 4 行）。若认为 1280 档不值得这个高度代价，把 `max-width: 1280px` 与两处 `min-width: 1281px` 一起下调到 900 即可回到「1024/1280 用真表格」，那两档会退回 6–7 行单元格。

**探针增强**：新增 `tablet(920)` / `card-edge(900)` 两个视口跨断点取样；新增 `cardMode` 与 `cardStats`（行溢出、缺列名数、表头是否隐藏）——卡片档下「列宽/换行」不再是有效判据，必须换判据，否则探针会对着卡片报表格指标。
- [x] **N1 骨架**（已完成 2026-08-27）
  - 组清单：`DocsGroupId` + `DOC_GROUP_ORDER` 加 drag/scroll；**`GROUPS` 改为从 `DOC_GROUP_ORDER` 派生**（原是手写第二份 `DictKey[]`，裸数组无穷尽性约束、漏改会静默不渲染 —— 派生后单一真源）
  - i18n：zh 先 en 后（`en.ts` 标注 `Dict`，反序过不了类型）
  - 迁移：9 组 `git mv`（保留历史）+ 2 个未跟踪文件用 `mv`；新建 12 页 ×2 语言占位（frontmatter 齐备，正文由 N4 写入）→ **zh/en 各 40 页**
  - 新增两条契约测试：**slug 全局唯一**（路由不含组名，同名 slug 会静默覆盖且可能挂错分组）、**`/docs/<slug>` 链接目标解析**（迁移必然产生死链，而 404 态不会让构建失败）。后者一上线就抓出 **32 个文件的死链**，已按映射表全量改写
  - `LEGACY_SLUG_MAP` + `<Navigate replace>`：9 个旧 slug 全部重定向，站外书签零 404
  - 侧栏序号从**全局扁平序改为组内序号**（原先插组会让后续每页可见编号位移，出现「侧栏 15 / slug 01-cineview」错位）
  - `'01-introduction'` 三处硬编码收敛为 `DEFAULT_SLUG` 常量
  - 门：`tsc` 0 ✅、site-contracts **61/61**（+2 新契约）✅
  - 真机验证：**9/9 重定向生效**、**40/40 slug 渲染且恰好一个 h1**、6 个侧栏分组、console 0
- [ ] **N2 事实源核对单** → `task-flows/2026-08-27-docs-factsheet.md`：并入对抗复审的 18 条判定 + 20 余条新事实，逐条带 file:line；⚠️ 项单独查证，不进正文
- [x] **N3 shell 实现**（已完成 2026-08-27）
  - 新增 `site/src/components/DocsShell.tsx`：sticky 应用栏（品牌 + 版本 + 六组导航 + ⌘K 搜索 + 语言切换）与 `DocsPager`（底部翻页器，顺序取侧栏扁平序）
  - 搜索：纯前端，索引「页标题 + 页内 h2/h3」，⌘K/Ctrl+K 唤起、方向键选中、回车跳转（有锚点则跳锚点）；页标题命中优先于小节命中。40×2 页的标题集不值得引入全文索引依赖
  - 页头 `.docs-page__header`（287px / mobile 351px）→ 单行面包屑 `.docs-crumbs`（54px）
  - `App.tsx` 排除谓词加 `/docs`（否则 LangToggle 双份）；`LangToggle` 新增 `variant="shell"` 交出 fixed 定位
  - 接线四个此前未使用的 i18n key：`docs.onThisPage`、`docs.editTip`、`docs.prev`/`docs.next`；删掉 `copy.lead`/`copy.toc` 两个变成死码的字段
  - 版本号写常量并注明同步来源（`site/` 与框架根是两个 package，`import ../../package.json` 需 `resolveJsonModule` 且会把整个 json 打进 bundle）
  - 门：`tsc` 0 ✅ prettier ✅
  - 真机（1440 + 390）：应用栏 57px、面包屑 54px、旧页头已移除、6 导航项、**LangToggle 恰好 1 个**、翻页器 2 项、h1 恰好 1 个、无横向溢出、⌘K 命中 9 条且回车跳转成功、console 0
- [ ] **N4 内容重写 40×2**：分批子 agent，每批必须先读 N2 factsheet + `2026-08-27-humanizer-reference.md` + 两个风格样本页；禁止凭记忆写 API；禁止引入 N2 未记载（未标 ✅）的事实
- [x] **N4b humanizer 正式轮**（已完成 2026-08-27，依据 `2026-08-27-humanizer-reference.md` 完整版，未用 `/tmp` 那份 57 行摘要）
  - **机械扫描 35 模式**：§14 破折号、§7 AI 高频词、§4 宣传腔、§9 not-only-but、§20 助手腔、§23 填充短语、§25 空洞收尾、§27 假深度、§28 预告腔、§33 假坦白、§18 emoji、§16 加粗列表密度、§24 叠加限定词、§29 标题复述 均 0 命中
  - **§17 Title Case 6 处**（`## Two Behavioral Notes` 等）→ 句首大写，我本人修完
  - **批 A（getting-started + concepts，20 文件）**：agent 完成。命中集中在 §31 长句堆叠、§23 填充、§13 被动省主语、§11 同义重复；实质修正包括 `01-introduction` 里 `1ms = 1px` 的**真重复**（两段各讲一遍，保留领起那段）、`01-modes` 的链式冒号嵌套（原文冒号里套冒号是真解析问题）、以及一处**链接文案与目标页标题不一致**（「模式选择」→「选择模式」）。两个文风样本页判定**无命中、未改动**
  - **批 B（drag + scroll + runtime-states，24 文件）**：agent 被 502/429 打死且**无通知**（转录静默 33 分钟）。核实工作树无残留污染、契约测试仍绿后**我本人接手通读**，抓到两类真命中：§28 预告腔 3 处（`这一页讲…` / `This page covers…` 自我播报）、§9 not-X-but-Y 1 处（`这不是 bug，是两套时间轴的分工` → `两套时间轴在这里分工明确`）。其余按误报防护未做装饰性改动
  - **批 C（reference + advanced，16 文件）**：我本人通读，按误报防护判定**无命中、未改动**（三处「很短的句子」是 `forwardRef 指向根 div。` 这类正当简洁事实，非 §31）
  - 收口断言：全 80 文件散文区 `—`/`–`/`“”` **零命中**；§17 零命中；site-contracts **61/61**；**N6 探针改后复跑仍 PASS**（failures 0、console 0）
  - **过程教训**：本轮我自己写的散文里累计被 grep 抓出 **4 处破折号违规**，agent 写的抓出 3 处。这条证实了「写入时自觉」不能替代独立润色轮 —— 与上一轮用户的判断一致
- [x] **N5 一致性清扫**（已完成 2026-08-27）
  - 修复史词汇：**零命中**（`已修复`/`已整改`/`旧版本`/`此前的实现`/`previously`/`used to be`/`has been fixed`）。唯一 grep 命中「曾经完成过一次入场」是 ever-entered 语义，误报
  - 破折号：散文区 `—`/`–` **零命中**（表格分隔符与 `var(--x)` 除外）。过程中抓到 **7 处违规，其中 4 处是我自己写的**
  - 页间数字一致：预设 **43** 在 `03-animate` / `08-presets` / `10-types` 六个文件全部一致（原先 `03-animate` 双语写 41、`en/08-presets` 与 `en/10-types` 缺数）
  - 双语同构：40/40 页文件集一致；**每页 h2 数量逐页比对全部相等**
  - 中文引号：统一「」（修掉 `04-orchestration` 一处 `“”`）
  - 分组页数：getting-started 4 / concepts 7 / drag 6 / scroll 6 / reference 10 / advanced 7 = **40 × 2**
  - 链接目标解析：由契约测试机械保证（N1 新增）
- [x] **N6 真机验收**（规则 4，已完成 2026-08-27，探针 `site/scripts/_n6-acceptance.mjs`）
  - **A 路由与内容**：**80 个 slug**（40 页 × zh/en，经 LangToggle 真实切换语言）全部渲染、**恰好一个 h1**、无 404 态、正文长度均达标、**零占位残留**；9 个旧 slug 全部重定向
  - **B shell 交互**：应用栏 6 个导航项、**LangToggle 恰好 1 个**、面包屑存在、旧页头已移除、翻页器存在、TOC 有链接；⌘K 开启 → 输入 `center` 命中 → 回车成功跳转
  - **C 排版几何**：四视口（1440 / 1280 / 920 / 390）× 四张最坏表页；**页面级横向溢出 0**；1440 为真表格、其余三档为卡片且**卡片溢出 0**、`data-label` 已注入
  - **console 错误 0**（含 pageerror 监听）
  - 结果：**failures: 0 → N6 PASS**（首跑即通过）
- [x] **N7 对抗复审**（已完成 2026-08-27）：fresh agent 以 DESIGN.md + 源码双源审计，**首轮判 FAIL，5 项必修 + 1 项 P2**。全部修完并复跑。

  **审计结果**：20 条高风险断言 **15 条 CONFIRMED**；39 条内链零断裂；**双语零事实分歧**（12 处报差异全为格式性）。

  | # | 问题 | 判定 | 修法 |
  |---|---|---|---|
  | B-1 | `phase` 恒 idle 被**外推到 drag scrub 轨** | 新引入，P0 | drag 场景驱动轨**有完整相位**（`Animate.tsx:740` → `normalizeDragPhase`：`hidden→idle`/`enter→entering,entered`/`rest→entered`/`outgoing→exiting`）。四处表述收窄为「仅 scroll takeover」，并把 drag 从 canvas 章节的「改判据」名单移出 |
  | B-2 | `exitDuration` 说成退场 scrub 的**除数** | 新引入，P0 | 实为**分子**（`useAnimateDrag.ts:240` `renderProgress × sceneTransitionDuration`），除数是元素自己的 `duration.exit`。因果方向反了：调大它退场变**快** |
  | B-3 | ref 调用写成 `current.play()` | 新引入，P0 | 类型是 `MutableRefObject<(() => void) \| null>`，正确形式 `ref.current?.()`。`current.play` 是 `undefined`，照抄即 TypeError。且与另两页写法冲突（唯一页间矛盾，已消） |
  | B-4 | 零预算 zone「三个回调一次都不发」 | 过度绝对化，P1 | `onZoneEnter`/`onZoneLeave` 确实不发，但 `onZoneProgress` **首帧会发一次 `progress: 0`**（`useNativeScrollController.ts:329` 的 `lastReportedProgressPx === undefined`）。原文会让人用它当探针得到假阳性 |
  | B-5 | 坑页自称「八条」实际 6 条 | 新引入，P1 | 改为「六条」/「Six」 |
  | B-6 | `duration.exit: 0` 等价无退场 | 语境依赖，P2 | `hasExplicitExit` 是**或**关系：写了 `exitAnimation` 但 `duration.exit: 0` 仍算声明退场（瞬时跳变）。只有完全不写才永不退场 |

  **我自己顺带扫出第 7 处同类错误**（复审指出的「跨轨外推」特征性失效模式）：坑页写 `exitRef` 适用于「visibility 车道和 drag 普通元素」——实为 `manualControlLane = mode === 'scroll' && !isScrubLane`（`Animate.tsx:441`），drag 普通元素是 scrub 轨不生效；`enterRef` 另外在 drag 的 **arrival 轨**生效（`Animate.tsx:651`）。已双语改正。

  **复盘**：B-1 到 B-3 都不在原 9 条既有错误清单里，是本轮**修错的同时新写错的**。B-1 的 scroll 半边核实完全正确，错误发生在向 drag 外推那一步，而那一步没有任何源码依据。**教训：正确结论的邻域外推必须单独回源码验证**，不能靠「同类轨应该同理」。

  **复跑结果**：site-contracts **61/61** ✅、`tsc` 0 ✅、`vite build` ✅、prettier ✅、散文区破折号与弯引号 **0** ✅、**N6 探针 PASS**（80 slug、四视口、console 0）✅

探针留作 N0/N6 的复跑工具，收口时决定是否删（`site/scripts/_docs-*.mjs`，与既有 `_a3*.mjs` 同属一次性探针惯例）。

## 方案对抗复审结论（2026-08-27，已完成）

18 条断言逐条回源码：**14 CONFIRMED / 2 OVERSTATED / 1 REFUTED / 1 CONFIRMED 但更强**。两条证伪项我已独立复核（不只信 agent）：

| 原断言 | 结论 | 更正 |
|---|---|---|
| `infiniteAnimation` 驱动不了 10 个白名单属性 | **REFUTED** | 循环跑在嵌套的独立 `motion.div`（`Animate.tsx:931`/`:948`），与 style MotionValue 不同节点，无冲突。旧记忆写于嵌套结构引入前，**已作废改写为更正记录**。差点把不存在的限制写进公共文档 |
| z-index 被包装层 transform 吃掉 | **归因错误** | 结论（唯一宿主是 `Position.style.zIndex`）成立，但成因是 `Scene.tsx:870` 的 `contain: layout`，且 `Animate` 包装层实测 `transform: none`。要讲的是 contain + 四处写死 z-index（10/1、20、30）。记忆已更正 |
| `transition` 在 drag 下整组被忽略 | **半对** | `enterAnimation`/`exitAnimation` 死，但 `exitDuration` **活着**，驱动 drag 退场 scrub 除数（`helpers.ts:157` → `useAnimateDrag.ts:240`） |
| Fragment 里的 Scene 静默丢弃 | **要改口径** | 全 Fragment 时 `NO_SCENES` 会发；真正静默的是**混合**情形（1 直接 + Fragment 含 2 → 只发现 1，零报错，已复现）。且 scroll 与 drag 失败形态不同 |
| `layer.fixed` 无宿主降级 sticky | **对 drag 是错的** | drag 下纯静默 no-op（无宿主也无 sticky 兜底）；sticky 只在 scroll 的宿主未落地帧或 Scene 之外 |

结构性遗漏（进 N1）：组清单是**四张**不是两张，其中 `DocsPage.tsx:24-29` `GROUP_KEY_BY_ID` 漏改**直接挂 type-check**，`GROUPS` 漏改则静默不渲染；i18n 必须 zh→en 顺序；失效链接**49 处**（46 md + 3 tsx，grep 要覆盖 `.tsx`）；侧栏序号是全局扁平序、插组后与 slug 数字错位；`'01-introduction'` 硬编码三处；无任何测试守卫链接目标，故 N5 的「链接目标存在」必须补一条契约测试才成立。

另新增 20+ 条用户可见事实（takeover 覆盖你写的 `layout.height`、scroll 根容器同样写死 `#ffffff`、`drag.enabled` 门的是目标场景、`preventDefault` 是第二条拖拽逃生舱、包一层导出 Scene 会让场景全消失、`AnimateVideo` prop 面窄得多、resize 150ms debounce 且只认宽……），全部带 file:line，已并入方案文件。

## 进行中

- N1 待开工。方案文件已按上述更正全部改毕。
