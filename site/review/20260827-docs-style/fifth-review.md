# 文档第五轮独立复审报告（fifth review）

- 审查范围：`site/src/content/docs/{zh,en}/**/*.md`（40 slug × 2 语言 = 80 文件）+ `site/src/i18n/{zh,en}.ts` 顺带
- 规则来源：`.agents/skills/docs-check-style/SKILL.md`（逐条走清单）+ 中英文技术写作常识
- Vale：本机未安装（`vale: command not found`），全项人工核查，完整性由 grep 全量扫描 + 抽样精读保证
- 信息隔离：未读 `site/review/` 既有报告、未读 `task-flows/`、未读 `site/scripts/docs-style-probe.mjs`

---

## 一、must-fix

### M1（术语替换残留 · 双页导航不可区分）
- 位置：`site/src/content/docs/zh/concepts/02-timeline.md:3` 与 `site/src/content/docs/zh/concepts/04-orchestration.md:3`；同问题存在于 `en/` 同名两文件。
- 原文：两页 frontmatter 均为 `eyebrow: CONCEPTS / TIMELINE`。eyebrow 渲染在文档页头（`DocsPage.tsx:266`），读者可见层面两个概念页顶着完全相同的分类标签，而标题「Animate 时间轴」/「时间线」（en："The Animate timeline" / "Timeline"）只差一个词。
- 建议：给 04 页换一个能区分职责的 eyebrow（如 `CONCEPTS / SEQUENCING` 或 `CONCEPTS / TIMELINE RULES`），zh/en 各一处。URL slug `/docs/04-orchestration` 不动（保留属刻意）。
- 规则条目：本轮改动主题的术语自洽性；可访问性（导航可辨识）。

### M2（术语残留疑似 · zh/en 句义分歧）
- 位置：`site/src/content/docs/zh/concepts/04-orchestration.md:62`
- 原文：`…它不注册进场景的时间线图。`
- 问题：「时间线图」（timeline graph）疑似术语替换前的「编排图」残留——en 对应句（`en/concepts/04-orchestration.md:62`）写的是 `it does not register into the scene's timeline`，没有 graph 这层。zh 侧「时间线图」单独看勉强可读，但与 en 不等价，且和「时间线图 = 编排产物」的旧词形挂钩，正是本轮应清理的边缘形态。
- 建议：zh 改为「它不注册进场景的时间线」与 en 对齐。
- 规则条目：干净术语替换（零残留要求含词形变体）；双语事实等价。

---

## 二、nice-to-have

### N1（链接文案与目标页标题不一致）
- `zh/advanced/06-media-ownership.md:119`「zones 与预算」→ `/docs/02-zones-budget`，目标页 zh 标题是「zone 与滚动预算」。
- `en/advanced/06-media-ownership.md:119`「Zones and budget」→ 目标页 en 标题 "Zones and scroll budget"。
- 其余约 160 处内部链接经抽查，文案与目标标题一致（含 `02-zones-budget` 在其他页均用全标题）。双语同点同错，建议同步补齐全标题。

### N2（缩写与全形混用 — SKILL Voice/Tone）
SKILL 要求「同一语境内不混用缩写式与全拼否定式」。以下文件混用（示例）：
- `en/concepts/04-orchestration.md`：:10 `The waiter doesn't start` vs :38 `It does not reuse`、:60 `cannot be…` 措辞区
- `en/advanced/07-common-pitfalls.md`：`does not` / `must not` 与 `doesn't` / `isn't` 同页并存
- `en/reference/03-animate.md`、`en/advanced/02-preload.md`、`en/getting-started/02-installation.md` 同类
- 每条单独看都有强调否定的正当性，因此列 nice-to-have：建议按「强调否定用全形、叙述用缩写」做一次口径统一，而非机械全替换。

### N3（zh 半角括号与页面口径不齐）
- `zh/concepts/04-orchestration.md:32` 行内公式 `sub.delay(100)` 用半角括号，同页 :32 之外及全站 zh 正文惯例是全角（`（…）`）。行 29 的同一个公式位于 `\`\`\`text` 代码块内，半角合理；行 32 是行内引用，建议保留半角但整个页面和 en 侧并无歧义——技术要求极低，仅记录。
- `zh/quickstart.md:71` 等链接文案 `[center-lock](/docs/01-centerlock)` 与目标页标题「center-lock 滚动接管」半对齐（en 同点写作 `[Center-lock]`，目标 "center-lock scroll takeover"）。属描述性链接，不算错，如需统一可补全称。

### N4（双页读者的潜在混淆 — 事实性意见）
- zh 读者要在概念区区分「Animate 时间轴」（元素 phase/driver 语义）与「时间线」（waitFor/stagger 规则页）；en 读者区分 "The Animate timeline" 与 "Timeline"。两页内容互补且互相引链（02:44 → 04 / 04:128 → 02），正文本身不自相矛盾；但标题词根同形 + eyebrow 相同（M1）的组合会让侧边导航或搜索结果里两页几乎孪生。M1 修掉后风险大降；若想让界限更清晰，可在 04 页首段补一句「本页讲元素之间；元素内部的时间轴见 02」的定位句（en 同）。列为意见而非 must-fix。

---

## 三、判定合规清单（SKILL 逐条核查记录）

| SKILL 类别 | 怎么查的 | 结果 |
| --- | --- | --- |
| 主动语态 | 全量精读 80 文件样本 + 抽查 `can be`/`are …ed by` 被动结构（命中均在描述引擎行为的合理被动，如 `are flattened by React`） | 合规 |
| 现在时 / 无 will·would·currently | grep `\b(will\|would\|currently\|now)\b`（en 全量） | 命中均非时态违例（`:117 preload…` 的 none、`now` 一处为逻辑连接词 `scroll/04-fixed-layer.md:55`） |
| 第二人称 / 无第一人称 | 通读 + `we` 用法检查（`we recommend` 级零命中） | 合规 |
| 无 please | grep `\bplease\b` en 全量；zh 无对应「请」祈使问题 | 零命中 |
| 缩写一致 | 见 N2 | 唯一差类，已单列 |
| 长句连词上限 | 抽样精读（02-timeline / 04-orchestration / 01-cineview / 09-use-animate-timeline） | 合规 |
| 禁用词表全量（abort/blacklist/whitelist/boot/execute/hack/hit/kill/launch/terminate/easy/easily/simple/simply/utilize/type(v. 用户输入)/invalid/e.g./i.e./etc./via） | 词形扩展 grep（en）+ zh 人工核查对应译法（「终止/白名单/即」等） | 零命中 |
| could/can/may/might | en 抽查 `could` 无「能力」义误用 | 合规 |
| 美式拼写 | grep `\w+our\b`、`\w+ise`、`-ised/-ising`、`cancelled` 等 | 无真命中（仅 otherwise 等误报） |
| 牛津逗号 | 抽样三连枚举（drag 布局表、inputs 页） | 合规 |
| 首用展开缩写 | `Universal Module Definition (UMD)`、`ESM（ES 模块）` 均先展开后引用 | 合规 |
| 标题大小写 | 全量 eybrow/H1/H2 审查：en 标题均 sentence-style（"An enter chain needs an exit plan" 类），产品名大写正确 | 合规 |
| 引号规则 | en 抽查 `"initial → animate"` 等仅为代码值/术语首次出现加引号 | 合规 |
| 加粗/斜体/等宽字体分工 | 代码/值/字段全部反引号化（抽查 40 张 props 表） | 合规 |
| 数字写法 | en：1–9 行文拼写（two tracks / six samples / four checks），≥10 与单位量用数字；zh 用阿拉伯数字 | 合规 |
| 日期时间 | 全文无日期/相对时间词（`recently/lately` 零命中） | 合规 |
| 列表规范（≥2 项、平行、冒号引导） | 抽查 `...-` 列表与章节 | 合规 |
| 段落长度 <7 行 | 样本段落逐页目测 | 合规 |
| 代码块语言标注 | awk 校验 80 文件所有开 fence 均带语言标签，fence 数全部成偶 | 合规 |
| 敏感信息 | grep IP/token/host 类模式无命中；ffmpeg/src 行号引用为设计内 | 合规 |
| 图片 alt 文本 | 全库零图片（`![` 零命中），N/A | 合规 |
| 链接文案可描述 | 全量提取 40 个 `](/docs/…)` 目标 + 326 处引用，无 "click here"/裸 URL | 合规（N1 除外） |
| 方向词（above/below/左右） | grep 双语（`above\|below`；zh「上面/下面/左侧/右侧/前文/后文」） | 零命中 |
| 设备中性动词 | 无 UI 操作指令（文档不指导点按钮），无 "click here" | 合规 |
| 性别中立 | grep `he/she/him/her/guys`、zh 他/她 | 零命中（命中均为「其他」误报） |
| 行内代码/表格排版 | 双空格命中全部是表格对齐填充，非段内双空格 | 合规 |
| 标题层级跳级 | awk 校验 80 文件无 H2→H4 跳级 | 合规 |
| 前置说明/冗余 admonition | 全库无 admonition 语法；统一用 `**根因**/**正解**`（zh）/ `**Root cause**/**Fix**`（en）行内小标，通篇一致 | 合规 |

---

## 四、zh/en 平行性核查

- 结构等价：40 对文件**全部同形**——行数、`#` 标题数、fence 数逐对相同（如 02-timeline 双方均 61 行/4 标题/0 fence；04-orchestration 双方均 129 行/10 标题/10 fence），无一漂移。
- 事实等价：对全部 80 文件提取数字集合做逐对 diff，仅 3 处「zh 用阿拉伯数字 / en 拼写单词」的表达差（`6/six`、`3/3×3`、`5/Five`），逐条回读后确认语义等价。常用 API 名、prop 路径、错误码、默认值逐表对照源码（抽查 12 处真名）：
  - `PresetAnimation` union 实有 43 名，文档「43 个」双方正确（`src/types/index.ts:259` 起）
  - 错误码表（`10-types` 页 8 个 `CineViewErrorCode`）与 `src/types/index.ts` 联合类型逐项一致
  - `threshold: { minVelocity, maxVelocity, minRatio, maxRatio }` 真实存在,且默认 `minRatio 0.15 / maxVelocity 1000` 与文档一致（`src/components/Scene/useDragSceneEngine.ts:33-34`）
  - `enterAnimation?: never`（`src/types/index.ts:574`）、`thumbHoverColor`（`:110`）、`onZoneEnter/onZoneLeave`（`:215-216`）、`firstSceneTimeout`（`:88`）、`sceneControlled`（`:480`）、`signedProgress`（`:632`）、`CineViewScrollRef`/`goToZone`（`:420-421`）、`releaseOnLeave`、`NO_SCENES` 上报点（`DirectScrollCineView.tsx:191`）全部属实
- 【特别核查】**术语替换零残留**：`编排/orchestrat/choreograph` 全词形 grep（大小写不敏感）在 80 个 md 中**零残存**（仅剩刻意保留的 URL slug `/docs/04-orchestration` 与 `DocsPage.tsx:48` 重定向键 `'06-orchestration'`）。术语侧自检自洽：04 页 title/eyebrow 已改为 TIMELINE，正文与 02 页互链的文案（zh「时间线」/en "Timeline"）口径一致。仅有的两处毛刺即 M1 / M2。
- i18n 词典：`zh.ts`/`en.ts` 各 189 键，键集合双向零差异；`编排/orchestrat/choreograph` 零命中。

---

## 五、本轮新增的审维度（历史轮可能未覆盖）

1. **zh/en 数字集合逐对 diff**（全部 80 文件）：直接暴露语义等价问题而不依赖行级 diff。
2. **frontmatter eyebrow 重复检测**：之前只查 title 时两页不重名，eyebrow 是读者可见、被 `DocsPage.tsx:266` 渲染的导航标签，重复属客观缺陷。
3. **内部链接文案 vs 目标页 title 的全量比对**（326 处）：确认 `zones 与预算` 等简称语义漂移。
4. **行内 fence 配对 + 语言标签 awk 校验**：区别于机器探针的 fence 计数，本次确认了「每个开 fence 都有语言」。
5. **文档语句与 i18n 词典交叉**：词典 `zh.ts/en.ts` 键集合 diff（`'key':` 引号形式）+ 旧术语 grep，历史轮未必覆盖过词典。

---

VERDICT: FAIL

---

## 复核（修复后终轮）

- **M1 闭合**：`zh/concepts/04-orchestration.md:3` 与 `en/concepts/04-orchestration.md:3` 的 `eyebrow` 均已改为 `CONCEPTS / SEQUENCING`；两页 02-timeline（zh+en）仍为 `CONCEPTS / TIMELINE`，重复消除。全库 grep 确认 `SEQUENCING` 只落在这两预期位置，02/04 之外零扩散。
- **M2 闭合**：`zh/concepts/04-orchestration.md:62` 现为「…它不注册进场景的时间线。」与 `en/…:62` "the scene's timeline" 语义对齐；全库 `时间线图` 零命中。
- 回归检查：本次修复只动 frontmatter 一行与正文一处，不改 heading 数/行内链接/相邻段落结构，无新引入问题；N1–N4 为 nice-to-have，不阻塞放行。

VERDICT: PASS
