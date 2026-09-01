# 2026-08-31 去 AI 味续做 + 站点 bug 真机修复

## 背景

用户要求：查阅 `2026-08-27-humanizer-reference.md`、`2026-08-27-docs-deametaphor.md`、
`2026-08-28-docs-de-ai-and-restructure.md` 三份历史裁决，总结禁词，装上 humanizer 技能，
复审当前 docs 是否已彻底去掉 AI 味，接着做未完部分；并真机修 hero CTA 间距过紧、
docs 顶栏滚动遮挡导航两个 bug。

## 关键判断：工作区那 81 个文件的 diff 是「在执行规则 5」，不是回退

上一轮审核（`2026-08-31-comprehensive-audit-remediation`）把这批未提交改动判为
「反向撤销 `bafe68f` 的去 AI 味编辑」。**该判定错误，本轮已纠正。** 实测：

| 指标 | HEAD | 工作区 |
| --- | --- | --- |
| zh 第二人称「你」 | 51 | 0 |
| 「写死」 | 18 | 0 |
| 「裸写」 | 3 | 0 |
| 「吞掉」/「一棵树」/「覆盖你的」 | 各 1 | 0 |

方向与 `WRITING.md` 规则 5（2026-08-28 新增，要求客观架构表述、禁第二人称与俚语）一致。
只是改写过程中引入了探针禁的情态动词与 avoid 词，构成新缺口（见下）。

## humanizer 技能落盘

`.claude/skills/humanizer/SKILL.md`（重抓 `blader/humanizer` v2.11.2, MIT 的完整词表，
非上一轮的 57 行摘要）。含 35 模式、§7/§1/§3/§4/§5/§8/§20/§21/§23/§24/§26/§27/§28/§32/§33/§34/§35
逐条 verbatim 词表、§14 破折号规则、误报防护清单、三种输出模式。
项目裁决写在文件头部：本站属 technical/reference（铁律 4，保持中性）；
`WRITING.md` 是权威文风样本（铁律 3，其规则优先于技能通用条目）；§30 最相关（不写修复史）。

注：仓库既有的 `docs-check-style` 是 Elastic 英文风格指南，**不是** humanizer，本轮未用。

## 站点 bug：三个缺陷同一根因

`.docs-shell`（顶栏）是 `position: sticky; top: 0; z-index: 40`、背景不透明 `#fffcf7`、
实高 69px（`__inner` min-height 68 + 1px 下边框）。但三处消费方都没扣掉这一段：

| 位置 | 原值 | 现值 |
| --- | --- | --- |
| `.docs-nav` / `.docs-toc` 的 sticky `top` | `0` | `var(--docs-header-h)` |
| 同二者 `max-height` | `100vh` | `calc(100vh - var(--docs-header-h))` |
| `h2`/`h3` 的 `scroll-margin-top` | `32px`（注释称「无 fixed 头」，前提已失效） | `calc(var(--docs-header-h) + var(--space-4))` |

新增 `--docs-header-h: 69px`（`tokens.css`），一处定义供三处消费。

hero CTA：`.hero__cta` 的 `gap: var(--space-4)`（16px）是按「按钮之间」调的，
2026-08-29 把次级动作降级为**零横向 padding 的文字链接**后没有重估。
真机实测按钮与首条链接净间隙 16px、两条链接之间 15px。改为
`column-gap: var(--space-6)`（24px）+ `row-gap: var(--space-3)`（换行时不拉散）。

### 真机验收与变异验证

探针 `site/scripts/_bug-verify-20260831.mjs`（`channel: 'chrome'`，12 项断言）。
遮挡判定用**顶边 + `elementFromPoint`**，不用中心点——首轮诊断探针用中心点时
第一个导航项中心 y=74 恰好落在顶栏下沿 69 之外，返回「未遮挡」的假阴性，
而它顶部 13px（y=56→69）实际被压住。教训同 [[probe-pass-proves-only-what-it-checks]]。

变异验证：把 `.docs-nav` 的 `top` 改回 `0`，探针当场 FAIL 3 项并报出
`blocker: docs-shell__inner`；还原后与备份 `diff` 逐字节一致，复跑回到 12/12 PASS。

## 文档缺陷修复（本轮实际改动）

### 事实类

- **`scale = viewportWidth / size` 4 处** → `designWidth`。`size` 是 `d5882b7` 改名前的旧名
  （与 `waitFor→after` 同一次提交），源码与 `dist/index.d.ts` 里只有 `designWidth`，
  README 已改对、文档漏了。读者照抄会用到一个不存在的 prop。
  改后 `designWidth` 统一为 14 处，`size` 残留 0。
- **`Schmitt 排序` / `Schmitt ordering` 2 处**：该词本身不存在（概念是施密特迟滞），
  且同机制在 `advanced/06-media-ownership` 已定名。按规则 7 统一为
  zh「双阈值防抖」/ en `hysteresis`。
- **`shouldRunInfinite` 4 处**（规则 6 实现词外泄）：核实其不在 `dist/index.d.ts`、
  `public-api.ts`、`types/index.ts` 任何公开面，仅是 `useAnimateScroll.ts:65` 的 hook 字段。
  按规则 9 删掉标识符、保留规则本身（条件句原本已完整表达）。

### 语法与改名遗留

- `A after` → `An \`after\`` 共 4 处（`03-quickstart:67`、`concepts/04-orchestration:96`、
  `components/01-cineview:139`、`components/03-animate:168`），均为 `waitFor→after` 遗留。
  顺带补上 en 侧漏掉的 backtick（zh 侧一直是对的）。
- `serves as` 1 处 → `is`（humanizer §8；zh 侧本就写「是」）。全语料仅此 1 处。

### 规则 9.2 口号句

- `zh/getting-started/01-introduction:19`「杜绝元素几何变形」→「元素在各尺寸下保持原始宽高比」
- `zh/components/07-container:6`「正方形在任何屏幕上都不会变成矩形」→「横纵两轴共用同一个缩放系数，
  宽高比保持不变」。规则 9.2 自举的禁例正是「正方形永远是正方形，绝不形变」，原句近乎其改写；
  en 侧本就是平实陈述（"preserving aspect ratios"）。

### 那批 81 文件改写引入的探针违规（本轮补齐）

探针初跑 **FAIL 7 页 + 4 条结构问题**，全部落在我未编辑但在工作区 diff 内的文件上。
逐页核对 HEAD 与工作区计数，确认是那批改写新引入的：

| 页 | 词 | HEAD → 工作区 | 改法 |
| --- | --- | --- | --- |
| `en/concepts/03-visibility-conditions:38` | could | 0 → 1 | `could trigger` → `triggers` |
| `en/drag/06-drag-pitfalls:18` | should | 0 → 1 | `should act` → `acts` |
| `en/scroll/02-zones-budget:82` | should | 0 → 1 | 被动改指令句 `Divide long-form content…` |
| `en/scroll/04-fixed-layer:6,27` | should | 0 → 2 | `should use` → `use`；`should be mounted` → `mount` |
| `en/scroll/03-inputs:76` | terminate | 0 → 1 | `terminates` → `stops` |
| `en/drag/02-gestures:91` | invalid | 1 → 1 | 裸用小写 `invalid` → `rejected`（大写错误码在豁免表内） |
| `en/advanced/07-common-pitfalls:34` | invalid | 3 → 2 | `the invalid edge` → `that one dependency` |

结构问题（缩写首次出现未展开）4 条：`rAF` → `requestAnimationFrame` (rAF)；
`02-installation:67` 与 `04-choosing-mode:68` 的 `UMD`/`ESM` 按站内既有写法
`Universal Module Definition (UMD)` / `ES module (ESM)` 展开，并把展开挪到首次出现处。

改法方向与项目已采纳的 Elastic 子集一致（主动语态、现在时、指令句）。

## 门禁结果

| 门 | 结果 |
| --- | --- |
| `docs-style-probe.mjs`（80 页真机） | 初跑 FAIL 7 页 / 4 结构 → **PASS 0/0/0** |
| `_bug-verify-20260831.mjs`（12 项） | **12/12 PASS**，含变异验证 |
| `test:site-contracts` | 63/63（11 suites） |
| `type-check:site` | 0 错误 |
| `format:check:site` + `prettier --check docs/**/*.md` | 全绿 |

## 用户三条裁决与执行（2026-09-01）

向用户报了三个待决项，裁决为：**1 禁止、2 清、3 重启覆盖**。

### 裁决 1「禁止」——推翻 08-27 的保留裁决

`scrub` 与「轨」不再作为保留英文词/术语，`WRITING.md` 规则 7、8 自此生效。

- **zh 散文裸用 `scrub` 10 处清零**，按规则 7 分语境改「跟随滚动」或「逐帧定位」：
  `advanced/01-performance:89`（标题）、`advanced/02-preload:71`、
  `advanced/06-media-ownership:46/62/94(×2)/108`、`components/03-animate:70/96(×2)/112`、
  `concepts/03-visibility-conditions:6`。
- **API 名豁免**：`scrubRange`、`scrubbedOnceRef`、`framework-scrub`、`scrub.mp4` 保留。
  代码块内的 `applyNativeScrollDelta(delta)` 等同样豁免。
- **「轨」4 处里只有 1 处是被禁的隐喻**：`drag/03-two-track:6`「双轨时间模型」→
  「两个量各走各的时钟」。另 3 处是 `trackColor` 的「轨道色」、滚动条的「点击轨道」
  「横向滑轨」，指真实 UI 部件，保留。
- 连带修：双语 eyebrow `DRAG / DUAL-TRACK` → `DRAG / TIMELINES`（探针与契约测试都断言
  两语一致，必须同改）；`en/concepts/01-modes:12` 的 "two independent scheduling **tracks**"
  → "scheduling **states**"，与 zh 侧既有的「调度状态」对齐。slug `/docs/03-two-track`
  按规则 13 不动。

### 裁决 2「清」——内部标识符出散文

先按公开面核实：对文档中全部 150 个 camelCase 标识符逐个查 `dist/index.d.ts`，
筛掉 CSS 属性、DOM/React API、transform 函数后，得 35 个候选。再分三类处理：

| 类别 | 处置 | 依据 |
| --- | --- | --- |
| 只为指向源码而出现的内部函数名与 ref 标志（13 个，双语 26 处） | **清零** | 规则 6；规则 9 检验：删掉后句子信息不减 |
| 页面自己用表格定义并给出公式的量名（`visualSpan`/`centerLockOffset`/`segmentStart`/`segmentEnd`/`totalBudgetPx`/`timelineDistancePx`） | **保留** | 读者要靠它们跟公式，属该页正当词汇，非「外泄」 |
| `banned-names` 迁移表内的旧名（`onSceneWillChange`/`onSceneDidChange`/`onDragCommit`/`infiniteAnimation`） | **保留** | 有意保留的旧名→新名对照，探针本就有豁免区 |

清掉的 13 个：`areScrollSceneRenderSnapshotsEqual`、`endpointLatched`、`outgoingLatched`、
`scrubbedOnceRef`、`applyNativeScrollDelta`、`applyNativeScrollbarOffset`、
`validateCustomAnimation`、`parseAnimation`、`preloadMedia`、`initialPriorityUrls`、
`priorityComplete`、`addUrls`、`hostOffset`。`file:line` 源码引用一律保留。

顺带闭合一处规则 10 差异：`hostOffset` 只在 zh 侧出现，en 侧本就写成
"slides inside clip by offset" / "The frame offset computes as…"，zh 已对齐。

**附带发现（非缺陷，记录以免误改）**：文档提到的 `onDragCommit`、`onSceneWillChange`、
`onSceneDidChange`、`onProgress` 在公开面确实不存在——但前三个在迁移表里是**有意的旧名**。
公开面真实回调只有 15 个（`onDragStart/Progress/End/Cancel/Blocked`、`onError`、
`onReady`、`onLoadProgress`、`onSceneEnter/Leave`、`onSceneVisibilityChange`、
`onVisibilityChange`、`onZoneEnter/Leave/Progress`）。

### 探针加固（让裁决可防回归）

裁决落地不止于清理，否则下一轮改写会漂回来。探针新增三组断言：

- `BARE_ZH`（裸用 `scrub`）：**先抠 `SCRUB_EXEMPT_ZH` 再查**。因为 `scrubRange` 写在小标题里时
  源码不带反引号，渲染成 h2 纯文本，不会被 `pre, code` 剔除步骤清掉，整字查会误报。
- `METAPHOR_ZH`（`双轨`/`轨道隐喻`/`可见性轨`/`场景驱动轨`/`独立轨`）：不整字禁「轨」，
  避免误伤滚动条真实部件。
- `INTERNAL_IDS`（13 个内部标识符）：**在源文件层检查，不查渲染 prose**。

最后一条是本轮的一个教训：我最初把它写成查 `probe.prose`，变异验证当场证明**那是空转**——
这些标识符在文档里总写作 `` `xxx` ``，而 prose 提取会剔除 `pre, code`，断言永不可能命中。
改到源文件层（复用既有 `BANNED_PROPS` 那段的 `banned-names` 豁免区结构、跳过代码块）后，
注入 `` `applyNativeScrollDelta` `` 立刻报
`STRUCT en/03-inputs.md:15: internal identifier applyNativeScrollDelta`。
再次印证 [[probe-pass-proves-only-what-it-checks]]：**新加的断言本身也必须变异验证**。

三组断言的变异验证均通过（注入 `连续 scrub` / `双轨时间模型` / `` `applyNativeScrollDelta` ``
当场 FAIL，还原后逐字节一致、复跑 PASS）。

### 裁决 3「重启覆盖」——drag 板块结果与修复

drag 板块审出 **12 条 findings、3 页判干净**（`en/drag/03-two-track`、双语 `06-drag-pitfalls`）。
逐条自行核实源码后全部处理：

| 严重度 | 位置 | 缺陷 | 处置 |
| --- | --- | --- | --- |
| must-fix | 双语 `01-layout.md:56` | 「`firstSceneTimeout` 反过来也管 scroll 的冷启动门」**与源码相反**；且句首的 `*` 全页无指代对象 | 按 `DragOnlyConfigKeys` / `ScrollOnlyConfigKeys` 的真实划分重写 |
| must-fix | `zh/drag/03-two-track.md:58` | 表格括注「业务和内部原因都会走这里的路径」与源码相反，且 en 侧无此括注 | 删括注，改「手势被业务侧准入条件拒绝」 |
| should-fix | 双语 `05-callbacks.md:29` | 小标题用 `rush re-grab`，全语料其余 13 处都叫 `re-grab`，本页正文自己也用 `re-grab` | 统一为 `re-grab` |
| should-fix | `en/drag/04-ownership.md:28` | `is detailed below` —— 位置指代，我原探针词表漏了不带 `as` 的谓语形式 | 对齐 zh 的「单独说」；同时把该变体族补进探针 |
| should-fix | 双语 `04-ownership.md:57` | 「候选阶段的暂停」以定指形式首次登场，与上文候选一节「什么都不做」表面矛盾 | 改为直述按下那刻挂起续跑，并交代静止态不触发 |
| should-fix | 双语 `04-ownership.md:32` | 规则 2：本页自称「最容易撞上的一条」，可行动结论却排在第三段 | 结论提到首段，原因移后 |
| nice-to-have | 双语 `02-gestures.md:73` | 规则 4：「与普通回弹……不一致」用否定对比代替正面陈述 | 两边都正面陈述其值 |

关键的一条事实核实：`firstSceneTimeout` 那条，源码里有一行注释直接写着
`firstSceneTimeout is a drag-mode-only root prop; scroll always uses the 3000ms default`
（`DirectScrollCineView.tsx:242-244`），且 `types/index.ts:358-363` 把它列入 `DragOnlyConfigKeys`。
文档的说法与之完全相反。另核实 `onDragBlocked` 只有两条路径：业务侧 `drag.enabled === false`
发回调；内部就绪度不足（`!prepared`）**只调 `devWarn`，不发公共回调**（`CineView.tsx:588-604`）。

顺带发现（记录，未改）：源码注释 `useDragSceneEngine.ts:279` 自己用的就是 "a rush re-grab"，
文档那个名字来源于此。按规则 6（实现词不外泄）文档改掉是对的，源码注释是另一个表面，不动。

### 方法论教训：verify 在跑时不要动它正在核对的文件

本轮 workflow 的 verify 阶段产出 4 条结论，其中 **3 条被判「引用不存在 / 凭空编造」**。
逐条查证后确认：那不是伪报，而是**我在 verify 仍在运行时就把对应文本改掉了**，
验证者读到的是已修正的磁盘状态，于是认定原引用是假的。只有第 1 条（我依据它才动手的那条）
被确认为真。

正确做法：verify 阶段跑完再动文件，或干脆不挂 verify 阶段、由主循环自己核实。
后续 scroll/advanced 两个板块即改为「派 auditor、不挂 verify、发现由主循环逐条核实」。

（该 workflow 另有 2 个 auditor 静默 795–2038s 后判定已死，scroll/advanced 从未产出结果，
故停掉 workflow 改派独立 agent。）

### 裁决 3 续：scroll / advanced 板块

上一轮 42 代理中 31 个因 429/503 失败，`drag`/`scroll`/`advanced` 三板块的 auditor 从未跑到。
本轮重跑，并针对限流改了编排：并发从「6 审 + 36 验齐发」压到 **3 路审 + 各板块内串行验证**。
prompt 里显式列出「已机械清零、再报即误报」的清单，把代理注意力逼到 grep 看不见的判断类问题上
（规则 1/2/3/4/6/7/9、§29、§30、事实准确性、示例可运行性、双语实质差异）。

（首次重启时被会话中断，journal 只有 1 行 started、零结果，故直接重跑而非续跑。）

## 窄屏回归：第一版修复只在宽屏成立（2026-09-01 追加）

`--docs-header-h: 69px` 是照 1440px 实测写死的。补测其他断点后发现**修复不完整**：

```
1440px shell=69  wrap=nowrap
1200px shell=69  wrap=nowrap
1080px shell=98  wrap=wrap     ← 顶栏变高，侧栏仍停在 69
 900px shell=98  wrap=wrap
 760px shell=96  wrap=wrap
```

根因是 `global.css` 的 `@media (max-width: 1080px)` **显式设了**
`.docs-shell__inner { flex-wrap: wrap }`，导航折到第二行，顶栏由 69px 抬到 98px。
所以 760–1080px 区间内侧栏顶部约 29px 仍被压住 —— 只测 1440px 时这个缺口不可见
（[[enumerate-what-varies]]：我把视口宽度held constant 了）。

换行阈值用 1px 步进测准：**1081px=69、1080px=98**，中英文一致（导航宽度差不影响阈值，
因为换行是那个断点主动触发的，不是内容溢出）。故在同一个 `@media (max-width: 1080px)`
块内加 `:root { --docs-header-h: 98px }`，因与果放在一起，且无死区。

### 顺带修掉一个既存边界缺陷（760px）

补测锚点时在**恰好 760px** 抓到标题被 `docs-nav__group` 盖住。查因：
`@media (min-width: 760px)` 开 sticky，`@media (max-width: 760px)` 把
`.docs-layout` 改 `display: block` —— 两条都用 760，**恰好 760px 时同时命中**，
侧栏既是 sticky 又变成全宽块，正好复现 sticky 那条注释自己要防的 R3 缺陷。

已核实为**既存问题**：HEAD 版本两条边界就都是 760，我只改过 min-width 块内的 `top`。
修法是让两条边界互斥：`min-width: 760px` → `min-width: 761px`。
变异验证：改回 760 立刻复现 `docs-nav__group` 遮挡，还原后逐字节一致。

### 新增两个探针

- `_bug-verify-mobile-20260901.mjs`：390 / 760 / 761 / 1080 四个断点，断言 sticky 开关
  正确、`max-height` 已扣顶栏、正文首段未被任何层遮挡。760/761 两侧都取样，边界回归才盖得住。
- `_anchor-narrow.mjs`：六个宽度下真执行 `scrollIntoView` 再测标题落点，
  顶栏非 sticky 时（窄屏它随页滚走）只要求命中测试通过。

## 门禁结果（裁决执行后复跑）

| 门 | 结果 |
| --- | --- |
| `docs-style-probe.mjs`（80 页，含三组新断言） | **PASS** 0 结构 / 0 console / 0 失败页 |
| 新断言变异验证 | 三组全部当场 FAIL，还原后逐字节一致 |
| `_bug-verify-20260831.mjs`（宽屏 12 项） | **12/12 PASS** |
| `_bug-verify-mobile-20260901.mjs`（四断点 11 项） | **11/11 PASS** |
| `_anchor-narrow.mjs`（六宽度锚点落点） | **PASS** |
| 761 断点变异验证 | 改回 760 当场复现遮挡，还原后逐字节一致 |
| `test:site-contracts` | 63/63 |
| `type-check:site` / `format:check:site` / `prettier --check docs/**/*.md` | 全绿 |

## 未做与待裁决

1. **`zone` 在 zh 散文裸用 62 处，未动。** 它与 `scrub`/「轨」同在 08-27 那份保留清单里，
   按裁决 1 的同一逻辑本应一起禁。但它牵涉页面标题、链接文案（`[zone 与滚动预算]`）、
   40+ 处正文，改动会牵动 slug 显示文本与契约测试的内部链接断言，性质与前两者不同，
   需单独裁决。
2. **advanced 页的 `file:line` 源码引用本身**（约 40 处形如 `（`:176-193`）`）未纳入讨论。
   规则 6 管的是实现词汇，没管源码坐标；但对纯消费者这些坐标同样是不可操作信息。
3. 探针文件 `site/scripts/` 整个目录仍被 `site/.gitignore:24` 忽略，本轮两个探针
   （`_bug-probe-20260831.mjs`、`_bug-verify-20260831.mjs`）与加固后的 `docs-style-probe.mjs`
   同样不入版本控制。与上一轮审核记录的缺口相同，需一并处理才能进 CI。
