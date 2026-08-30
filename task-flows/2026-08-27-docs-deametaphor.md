# 2026-08-27 文档去比喻化 + Elastic 风格规则轮

用户反馈：「像什么尺子、闸门等，我觉得都太过 ai 味……我希望你能全面覆盖类似的文案，找到技能或者参考 git 上如 react 类型的框架作为参考」。

## 参照系（不是凭感觉改）

**技能**（`npx skills find` 后按质量门槛筛选，只取够格的两个）：
- `anthropics/knowledge-work-plugins@documentation`（8.8K installs，官方源）
- `elastic/elastic-docs-skills@docs-check-style`（87 installs，但**来源是 Elastic 官方文档团队**，含可机械检查的 voice/word-choice/formatting 规则表 + Vale 规则源）

低装机量的一批（`technical-writing` 系列，12–482 installs、作者不明）按技能自身的质量门槛**弃用**。

**框架参照**：抓取 react.dev 的 `useEffect` 参考页，实测其机制描述用词。关键结论（原文核实）：

> Plain technical nouns dominate. Nothing like "ruler," "gate," or "lane" — no physical-object or spatial metaphors at all for mechanisms.

react.dev 允许的比喻只有关系型/身体型且**几乎总是加引号**（"escape hatch"、"step outside React"、values you "prove"）。加引号本身是标记：比喻可以承载想法，但被标为非字面，读者不会误当 API 术语。

对照本站：`尺子` 25 处、`闸门` 29 处，**全部裸用、无引号、且当术语在用**——这正是用户说的 AI 味来源。

## 用户裁决

| 议题 | 裁决 |
|---|---|
| `轨`（93 处） | **保留**。它是 DESIGN.md 的正式架构术语（双轨模型），且对应源码 lane 概念；改掉会与规格和代码注释脱节 |
| 范围 | **词汇 + Elastic 排版规则一起跑**，一次收口 |

## 替换词表（术语一致性优先，全仓统一）

| 现用 | 改为 | 依据 |
|---|---|---|
| 尺子 / 单尺子 / 一把尺子 | **换算基准** / 设计基准 | 平实复合名词，对应 `config.size` 的实际职责 |
| 闸门 / 可见性闸门 | **可见性条件** / 进场条件 / 退场条件 | react.dev 把 threshold 表述为「comparison 与 condition」而非 barrier |
| 迟滞死区 | **重叠区间**（保留「迟滞」作技术词，它是电子学标准术语） | 死区是比喻，重叠区间是事实描述 |
| 逃生舱 | **退出机制** / 显式关闭方式 | react.dev 的 "escape hatch" 加引号使用；中文无对应习语，改平实 |
| 涌现 | **由…累加得出** / 由…决定 | 涌现是系统论借词，此处只是求和 |
| 破窗 | **不一致行为** | |
| 打包回滚 | **同帧一起退场** | 描述现象本身 |
| 翻车现场 | **常见故障** | |
| 心跳 | 删（改为直述 px 关系） | |
| 出血 | **溢出** | CSS 标准术语 |
| 对号入座 / 白装 | 改直述 | |

**不改**：`轨`（正式术语）、`zone`/`takeover`/`scrub`/`center-lock`/`phase`/`commit`（英文原词，用户先前已定）、`scrub 轨`。

## Elastic 规则中适用于本站的子集

中文文档不适用的（American English 拼写、Oxford comma、contractions、second person "you"）跳过；适用的：

1. **段落 ≤ 7 行**
2. **列表并列结构**、最少两项、首字母大写
3. **粗体只给 UI 元素名**；本站无 UI 元素 → 粗体只用于「必须知道的结论」，不滥用
4. **等宽只给代码标识符**（API 名、prop、错误码、路径），不给普通名词
5. **不用 Latin 缩写**：`e.g.` → 例如、`i.e.` → 即、`etc.` → 等、`via` → 经由/通过
6. **避免 easy/simple/just** 类轻慢词（中文对应：「很简单」「只需」「轻松」）
7. **标题句首大写**（en 侧；已在前轮修过 6 处 Title Case）
8. **避免 above/below 作位置指代**（无障碍）→ 改为具名引用

## 节点

- [x] N1 词表机械替换（zh + en 双语，逐词核对上下文，不做无脑全局替换）
- [x] N2 Elastic 规则扫描与修正（段落长度、Latin 缩写、轻慢词、位置指代、粗体/等宽用法）
- [x] N3 术语一致性复核：同一概念全仓单一叫法
- [x] N4 契约测试 + 真机验收复跑
- [x] N5 独立 agent 复审（按 Elastic 规则表逐条查，不看本文件）→ **首轮 FAIL，7 项已全闭**
- [x] N6 二次独立复审 → **7 项确认闭合；但又发现 3 个整类未审，已修**
- [x] N7 三次独立复审 → **又 FAIL：引号标点、Avoid 词表、数字/时态等类此前无人审，已修**
- [x] N8 四次独立复审（三轮 FAIL 原因两两不重叠；须 fresh agent 出 PASS 才收口）

## N1 收口（本轮实测）

12 个比喻词全仓 **0 命中**（`尺子` 21→0、`闸门` 11→0、`破窗` 5→0，其余词此前已清）。
`轨` 保留 95 处（正式术语，按用户裁决）。

## N2 收口（Elastic 规则逐条实测）

| 规则 | 结果 |
|---|---|
| 段落 ≤ 7 行 | 0 违规（脚本扫全 md，跳过代码块/列表/表格） |
| 列表最少两项 | 0 违规（单项列表扫描 0 命中） |
| Latin 缩写 `e.g./i.e./etc./via` | 0 命中 |
| 轻慢词 | zh 0；en 2 处 `just` 保留——语义是「仅仅」而非「很简单」，非规则所指 |
| **位置指代** | **本轮唯一实际缺口：en 16 处 + zh 22 处 `see below`/`见下` 全改具名引用** |
| 标题句首大写（en） | 修 5 处 Title Case：`Callback Table`→`Callback table`、`Discriminated Union: Wrong Mode Won't Compile`→`Discriminated union: the wrong mode won't compile`、`onError and Error Codes`→`onError and error codes`、`Related Pages`→`Related pages` |
| American English | 修 6 处英式拼写（`behaviour(al/s)`/`normalises`/`initialised`/`centred`） |
| 粗体/等宽用法 | 抽查通过：粗体只承载结论与 `症状/根因/正解` 标签，等宽只给代码标识符 |

位置指代的改法：不引入新的锚点链接机制（全站 md 此前零 `](#` 用法），改为**具名小节引用**
（en `see "onError and error codes"` / zh `见「错误码」小节`）。跨页的一律改成已有的
`/docs/<slug>` 链接（如 `见下一页` → `见 [编排](/docs/04-orchestration)`）。
脚本校验：每条具名引用的目标都能在同页 h2/h3 中找到，0 悬空。

## N3 收口（术语一致性，本轮修的都是 en 侧漂移）

zh 侧此前已统一，en 侧存在同概念多译名：

| 概念 | 漂移 | 统一为 |
|---|---|---|
| 换算基准 | `conversion base` / `conversion basis` / `design basis` / `draft basis` / `the basis` / `px2vw basis` 混用 | `conversion base`（21 处，与 zh `换算基准` 21 处一一对应） |
| 可见性条件 | `visibility gate` 残留 4 处（与 `visibility condition` 并存） | `visibility condition`；lane 语境用 `visibility-condition lane` |
| 故障档标签 | `Cause` 与 `Root cause` 两页各用一种 | `Root cause`（对齐 zh 的「根因」，三页共 20 条） |
| 冷启动门（zh） | `首屏门(控)` 与 `冷启动门(控)` 混用 | `冷启动门(控)`，对齐 en `cold-start gate` |

## 门（N4 静态部分）

- `docsContent` 双语契约 **6/6**（含「内部 /docs 链接全可解析」——覆盖本轮新增的两条跨页链接）
- `src/__tests__/site` 全量 **61/61**（11 suites）
- `tsc -p site/tsconfig.json` 0 错误；`prettier --check site/src/**/*.{ts,tsx,css}` 全绿
- 文档 md 此前不在 prettier glob 内、表格对齐靠手工维护，本轮改动打乱了列宽 →
  已 `prettier --write site/src/content/docs/**/*.md` 全量规范化（顺带修掉 HEAD 就存在的对齐漂移）

## N4 真机验收（规则 4）

新增探针 `site/scripts/docs-style-probe.mjs`，`channel: 'chrome'`，跑 `localhost:4003`
（4000–4002 被占，端口按 CLAUDE.md 要求读 vite 实际打印值而非假定）。

断言的是**读者实际看到的可见文本**，不是文件内容——先 `cloneNode` 再剔掉 `pre`/`code`
（代码里出现术语是正常的），然后在 innerText 上查：

1. 12 个比喻词零命中
2. 裸位置指代零命中（zh `见下/见上/按下表/下一页`；en `see below/(below)/listed below`）
3. 每条具名小节引用的目标标题确实存在于同页 h2/h3，且每个标题都有锚点 id
4. 正文非空（`proseLen ≥ 200`，挡住空 article）、非 404 态
5. 全程 console 零 error / 零 warning

语言不点 toggle 而是直接写 `localStorage['cineview-site-lang']`（i18n 真源，
`site/src/i18n/index.tsx:15,37`），再断言 `document.documentElement.lang` 真的变了——
避免 [[test-proxy-signals-break]] 那类「点了按钮就假定切换成功」。

**结果：80 页（40 slug × 2 语言）全通过，console 0 问题，`VERDICT: PASS`。**
证据 `site/review/20260827-docs-style/probe.json`。

### 变异验证（探针不是空转）

按 [[probe-must-assert-intent]] 的要求反向验证：注入 `换算基准`→`尺子`（zh/05-responsive）
+ `see the layout section`→`see the nonexistent-heading section`（en/02-scene），
探针立刻报 **4 页 FAIL**——其中 3 页命中 `尺子` 是因为被改的页面标题会传播到其他页的
「相关页面」链接文案里，探针连这层传播都抓到了。已还原并 `diff` 确认与变异前逐字节一致
（[[dead-agent-leaves-mutation-on-disk]] 的教训：变异后必须核工作树）。

## 附带发现：文档之外的用户可见文案也有同一比喻（本轮一并修）

用户的诉求是「全面覆盖类似的文案」，不限于 `docs/`。全仓扫 i18n 词典后发现 4 处：

| key | 旧 | 新 | 是否活 |
|---|---|---|---|
| `cap.shot3.card.position.label` | `单尺子定位` / `One-ruler placement` | `基准定位` / `Base placement` | **活**（Act3 面板，`Act3DollyScene.tsx:591`） |
| `caps.2.title` / `caps.2.desc` | `单尺子响应式换算`、文案含「等比尺子」 | `单基准响应式换算`、「同一个认宽的换算基准」 | 死键 |
| `demoDrag.s3.title` | `单尺子坐标定位` / `Single-ruler coordinates` | `设计稿坐标定位` / `Design-draft coordinates` | 死键 |

`dragTemporal.s04.rulerLabel`（`拖拽进度标尺` / `Drag progress ruler`）**不改**：它指的是屏幕上
真实画出来的刻度尺控件，是字面义而非比喻。该键同样零消费。

**死键说明**：`caps.*`、`demoDrag.*`、`dragTemporal.s04.rulerLabel` 在 `site/src` 内只出现在
`i18n/{zh,en}.ts` 两份词典里，无任何 tsx 消费。本轮只做文案，不顺手删——`DictKey` 由
`typeof zh` 推导（`i18n/types.ts:8`），删键会牵动类型面，属独立清理项。记录在此待专项处理。

### 活 label 的真机适配验收（这一步逮到我自己的回归）

Act3 面板 label 在固定宽 bar 内（`.a3-panel__label { flex: 1 }`），必须核实换词后不溢出。
用 `Range.getClientRects()` 数**真实行盒**（`getBoundingClientRect().height` 会随 flex 拉伸，
六个 label 全被误判为 wrapped——那是量错了对象，不是真换行）：

| 文案 | 390 宽行数 |
|---|---|
| `One-ruler placement`（原） | 2 |
| `Single-base placement`（我的第一版） | **3 ← 比原文多一行，回归** |
| `Base placement`（最终） | 2 |

最终值：zh 两个断点均 1 行；en 1440 全 1 行、390 全 2 行，**与其余五个 label 完全一致**。
教训同 [[layout-box-is-not-paint]]：换文案不能只看「字改对了」，得量绘制结果；
而且要跟**同组未改动的元素**对齐，才知道是本次引入的还是本来就有的。

### 门（i18n 改动后复跑）

`tsc -p site/tsconfig.json` 0 错误；`prettier --check site/src/**/*.{ts,tsx,css}` 全绿；
`src/__tests__/site` 61/61。

## 扩展扫描：原 12 词表之外的同类比喻（本轮补修 2 处）

用户诉求是「找到类似的文案」，不是「清掉这 12 个词」。所以在词表之外又跑了三轮
候选词扫描（物理实体隐喻 / 拟人 / 口语江湖气），命中并修掉 2 处：

| 位置 | 旧 | 新 |
|---|---|---|
| `zh/advanced/07-common-pitfalls.md:52,54` | `一整帧收摊`、`打包收摊` | `整组在一帧内同时消失`、`全部在同一帧一起退场`（en 侧 `the whole set packs up at once` → `disappears at once`） |
| `zh/advanced/06-media-ownership.md:112` | `被一层叠加的淡入抢戏` | `不会再叠一层淡入盖住它` |

`收摊` 是前一轮 `打包回滚` 的同源漏网——词表按词面匹配，同一比喻换个说法就漏过去了。
已把 `收摊`/`抢戏` 补进探针词表；补进后探针**当场报出那处 `抢戏`**，修完才回到 PASS
（即这两条不是靠肉眼扫出来的，是靠探针闭环逮到的）。

### README 同样命中（已修）

`README.md` 是最外层的用户可见文件，此前漏在扫描范围外，命中 2 处 `ruler`：

- 开篇 `one design-width ruler` → `one design-width conversion base`
- 三条要点的标题 `**One ruler.**` → `**One conversion base.**`

（README 在 `format:framework` 的 prettier glob 内但 HEAD 就已漂移——表格对齐不合规，
与本轮无关；顺手 `--write` 规范化。）

### 待你裁决：内部规格文件是否一并改

`DESIGN.md`（`尺子` 15、`闸门` 17、`死区` 4）与 `CLAUDE.md`（`尺子` 2、`破窗` 1）仍在用这些词。
**本轮没动**，因为：DESIGN.md 是「唯一有效规格」，源码注释与多个 task-flow 都引用它的术语，
改术语属于规格层变更而非文案润色，牵连面和风险都与文档站不同量级。
用户诉求指向的是对外文案，内部规格是另一类。要一起改就单独开一轮。

**判定为合规、不改**（记录以免后续误改）：

- `轨`（lane）— 用户已裁决保留，正式架构术语
- `意图钳` / `防跳过钳` — 与 en `intent clamp` 一一对应，`clamp` 是标准编程词汇；
  zh 侧动词义（钳到/钳制）也是常规技术表达，非物理实体当术语
- `撑开` / `顶边` / `抢占` / `吃掉` / `空转` — 常规动词或标准技术用法，不是拿实体当术语
- `dragTemporal.s04.rulerLabel` 的「标尺」— 指屏幕上真实画出的刻度控件，字面义

## N5 独立复审：首轮 FAIL，7 项 must-fix 全部核实为真并修完

复审 agent 全程未读 `task-flows/`，报告落盘 `site/review/20260827-docs-style/independent-review.md`。
**我先逐条核实再改，没有直接采信**——结果 7 条全部成立。

| # | 位置 | 问题 | 修法 |
|---|---|---|---|
| 1 | `zh/advanced/04-direction-x.md:33` ×2 | `换算尺`——`尺子` 的**复合词形** | → `换算基准` |
| 2 | `en/reference/03-animate.md:168` | `("bundled rollback")`——「打包回滚」的英译以引号造词留存 | → `exit in the same frame` |
| 3 | `zh/advanced/07-common-pitfalls.md:52,54` | `收摊` ×2 | 我在复审返回**之前**已自行扫出并修掉 |
| 4 | `en/concepts/01-modes.md:2` | `Dual-Mode Engines`——40 页里唯一 Title Case（在 frontmatter 里，我的标题扫描只看 `^##`，漏了） | → `Dual-mode engines` |
| 5 | en ×4 | `serialisation` / `recognised` / `recognise` / `neighbours` | 改美式 |
| 6 | en ×4 | 位置指代 `section above` / `pattern below` / `snippet below` + `as described above` / `next section`（**zh 同位置早已具名**，纯 en 侧漏修） | 全改具名引用 |
| 7 | `en/reference/01-cineview.md:132` | `the frame applies` 漏词，改变句意 | → `the framework applies` |

### 我的扫描为何漏掉这些（值得记住的盲区）

- **比喻按词面匹配 → 复合词与译名必漏**：查了 `尺子` 查不出 `换算尺`；查了中文 `打包回滚` 查不出英文 `bundled rollback`。同一比喻换个构词就穿过去了。
- **标题扫描只覆盖正文 `^##`**：frontmatter 的 `title:` 不在正则里，而那正是唯一的 Title Case 所在。
- **位置指代只列了 `see below` 家族**：`section above` / `next section` / `pattern below` 都不在词表内。
  而且 en 不能裸查 `above`/`below`——`below 40px`、`above threshold` 是合法数值比较。
- **单侧修完就以为收口**：第 6 条 zh 侧全部已改，en 侧一处未动。**双语必须各自独立跑一遍**
  （同 [[enumerate-what-varies]]：漏洞藏在你held constant 的那个维度里——这里是 locale）。

### 附带修掉的事实性错误（复审在风格范围外发现）

`{en,zh}/reference/01-cineview.md:78` 写 `onLoadProgress` 是 `0-1`，**两语都错**。
源码 `useImagePreloader.ts:218` 是 `Math.round((safeLoaded / safeTotal) * 100)`，
且同仓另有五处明确写「整数 0 到 100」并引了源码行号。看起来是下一行 `onZoneProgress` 正确的
`0-1` 往上串了一行。已改为 `integer 0-100` / `整数 0-100`。集成方查的正是 reference 页。

### 一并处理的术语漂移（复审列为 nice-to-have）

- `page-movement lane` / `movement lane` / `element lane` → 统一 `render track` / `element track`
  （zh 一律「位移轨」「元素轨」，en 却有三个名字）
- `crash sites` → `failures`（另两个 pitfall 页 en 已是 `failures`/`failure modes`，zh 三处都是「故障」）
- `en/advanced/01-performance.md:73-74` 两条小写列表项 → 首字母大写、去行尾分号
- `en/drag/02-gestures.md:28` 的 `the selector list that follows` → 具名（zh 早已具名）
- `en/concepts/06-dom-contract.md:105` 自指式引用 → 与 zh 一致的直述

**判定为合规、驳回复审的两条**：

1. `render track`（状态）与 `render lane`（写者）在**同一张表里并存是有意的**，
   `zh/drag/03-two-track.md:12` 是完全相同的配对（`render 轨` + `render lane（drag ownership + release）`）。
   不是漂移，是「状态 vs 写者」两个位置。
2. `design base`（`reference/01-cineview.md:28`）对应 zh 的「设计稿基准」，
   与派生出的「换算基准」是有意区分的两个概念，双语一致。复审自己也标了「请确认意图」。

### 探针的对应加固（这轮的真正收获）

**我的探针在 7 条真违规存在时给了 PASS——说明它太窄。** 已按复审暴露的四类盲区加宽：
补 `换算尺`/`bundled rollback`/`crash site` 到词表、位置指代扩到 17 条搭配、
新增英式拼写 13 条、新增标题 sentence-case 检查（含 frontmatter `title:`）。

加宽后做四类变异验证，**每类都当场报 FAIL**：

```
FAIL zh/04-direction-x: metaphor: 换算尺
FAIL en/01-modes:       Title Case heading: "Dual-Mode Engines" (Engines)
FAIL en/03-two-track:   British spelling: serialis
FAIL en/10-types:       positional ref: section above
```

四份变异已还原并 `diff -q` 确认逐字节一致。教训与 [[static-review-is-not-verification]] 同源，
但方向相反：这次不是「代码写了≠生效」，而是**「探针绿了≠没问题」——绿只证明它查的那些没问题**。

### 门（复审整改后复跑）

`prettier --check site/src/content/docs/**/*.md` 全绿；`src/__tests__/site` 61/61；
探针 80 页 PASS、console 0；7 项 must-fix + 事实错误逐条 grep 复验为 0 残留。

## N6 二次独立复审：7 项确认闭合，但又 FAIL——**三个整类此前没人审过**

报告 `site/review/20260827-docs-style/second-review.md`（复审 agent 禁读 task-flows
与首轮报告）。它确认了首轮 7 项 + `onLoadProgress` 事实修正全部闭合、
28 条具名引用零悬空、段落长度/列表/标题/Latin 缩写/位置指代/引号全部合规。

新发现的是**前两轮（含我自己）根本没查的三个规则类**：

| 类 | 数量 | 处理 |
|---|---|---|
| **Oxford comma** | 12 处真违规（我先扫出 89 个候选，逐条读上下文后筛掉 77 个两项列表/表格假阳性） | 全补 `, and` / `, or`。依据不只是 Elastic「always」，更是**仓内已有 231 处遵守**——这些是自相矛盾 |
| **第一人称** | 4 处（`I need…` / `why does my CSS…` / `my own entry` / `one of my zones`） | 全改 second person；后两处 **zh 早已是非人称，纯 en 侧漂移** |
| **trap 当术语** | 7 处 | → `needs care` / `failures` / `symptom`；zh 全篇从不用「陷阱」，页面标题还是「排错」 |

另修比喻残留（复审列出、我逐条核 zh 对照后判定）：
`flap`×3 → `oscillate`（zh 一律「抖动」）、`sharp edges` → `boundary cases`（zh 已是「三处边界」）、
`burns` → `consumes`、`The funnel` 标题 → `The shared entry point`（zh 已是「汇聚点」）、
`武装` → `重新启动`、`说了算` → `由引擎决定`、`吃掉` → 直述。
还修掉一处**错误链接文案**：`zh/concepts/05-responsive.md:54` 用「定位模式」指向 `/docs/01-modes`，
而那页标题是「双模式引擎」，讲的不是定位。

**驳回的两条**（核 zh 对照后判定合规）：`hard-wired` 对应 zh 的 `写死`，双语同构且
「hardcoded」是标准编程词汇；`swallowed`/`吞掉` 说 `preventDefault` 吃事件也是常规表达。

### 一个只有探针能逮到的漏网

改完 `trap` 后我 grep `\btraps\?\b` 得到「clean」，探针却仍报
`FAIL en/06-scroll-pitfalls: term drift: traps`。先怀疑是 dev server 缓存
（`import.meta.glob(eager)` 对 .md 改动确实不热更新，重启了服务器），**但重启后照旧报错**。

真因：那处是**句首大写的 `Traps`**，我的 grep 是大小写敏感的，探针的正则带 `i`。
教训：`grep` 默认大小写敏感这件事，在「确认某词已清零」的场景里是个静默陷阱——
**清零类断言必须 `-i`**。这也是本轮第二次出现「我说清了、探针说没清」，
两次都是探针对。

### 探针再次加固 + 变异验证

新增三类检查：`FIRST_PERSON_EN`（词边界，排除 `I-frame`/`API`/`ID`）、
`DRIFT_TERMS_EN`（trap/traps/crash site/flap/sharp edges/bundled rollback，大小写不敏感）。
Oxford comma 未进探针——判定需读上下文分辨「三项列表」与「从句后的两项」，
89:12 的假阳性比使得机械规则会变成噪音源，留作人工项记录在此。

三类变异验证全部当场 FAIL：

```
FAIL en/02-timeline:        term drift: trap
FAIL en/06-dom-contract:    first person (I/me/my)
FAIL en/06-media-ownership: term drift: sharp edges
```

变异已还原并 `diff -q` 确认逐字节一致。

### 门（N6 整改后）

`prettier --check` 文档 + 探针脚本全绿；`src/__tests__/site` 61/61；
`tsc -p site/tsconfig.json` 0 错误；探针 80 页 PASS、console 0。

### 两轮 FAIL 的元教训

两轮独立复审都判 FAIL，且**两轮的 FAIL 原因互不重叠**：
首轮抓的是「我查了这个类但漏了变体」（复合词、frontmatter、单侧修完）；
二轮抓的是「我压根没查这个类」（Oxford comma、第一人称、trap）。

这说明：**探针 PASS 只能证明它查的那些没问题，永远不能证明「没问题」。**
规则表里有多少条，就得逐条落成检查——我前面只落了自己想到的那几条，
剩下的靠 fresh agent 读 SKILL.md 才补齐。故 N7 仍需第三轮独立复审才收口。

## N7 三次独立复审：**又 FAIL**，又是全新的类

报告 `site/review/20260827-docs-style/third-review.md`。这轮我明确要求「把规则表当
checklist 逐条走，别只查容易 grep 的」，结果印证了前两轮的规律——最大的遗漏又在没人打开的类里。

### 新发现（前两轮都没碰）

| 类 | 实测 | 处理 |
|---|---|---|
| **引号内标点位置** | 26 处标点在引号**外**，仅 5 处合规 —— **仓内惯例本身就是反的**，属系统性 | 脚本批改 17 文件；随后**手工复核**，3 处句式与规则冲突的改写句式而非硬塞标点 |
| **Avoid 词表逐词走** | `whitelist`×7（含 zh `白名单`×3）、`abort` 动词×1、`hit` 动词×3、`type` 动词、`invalid` 散文用法 | `whitelist`→`allowlist`/`许可清单`（先 `grep -ri whitelist src/` 确认**不是导出标识符**，无命名保真豁免）；`abort`→`interrupt`（`AbortController` 是 API 名，豁免）；`hit`→`run into`/`land on` |
| **时态/情态** | `could`×1、`currently`×2、`now`、`today`×4（zh `目前`×4 同位置） | 全删或改现在时；zh 侧同步（en 删了 `today`，zh 的「目前」必须一起删，否则又是单侧漂移） |
| **数字 1–9 在散文里写成数字** | 3 处，含一句里 `two` 与 `1` 混用 | 改拼写；索引/步骤号/数值保持数字（合规） |
| **`-ly` 副词连字符** | `least-recently-used` | → `least recently used` |
| **英式拼写整类漏判** | `cancelled`×3，且 en 全仓 **零个** `canceled` —— 整类都是英式 | 全改美式 |
| **链接文案 ≠ 页面标题** | 三个 troubleshooting 页标题是 `Troubleshooting`/`排错`，却被以 `pitfalls`/`常见故障` 等 5 种文案引用共 18 处 | 全部对齐真实标题，双语 1:1 |
| **zh 术语漂移** | `预载`(10) vs `预加载`(24) | 统一 `预加载` |

### 驳回的两条

- **`折算` vs `换算`**：不是漂移。`折算`是动词（「按基准折算」），`换算`是名词/基准
  （「换算基准」），全仓用法一致，是有意的词性分工。
- **剩余 3 处 Oxford comma**：逐条读后确认都是**两项**构造（`by gesture or ref`、
  `defaults applied and clamps enforced`、`waits 0.15s and drifts out`），三项以上才适用连续逗号。

### 复审确认已闭合

比喻 14 词大小写不敏感零命中（唯一残留 `is trapped inside it` 是字面描述 CSS containment，
zh 对照一致，判合规）、位置指代、第一人称、标题 sentence-case（含全部 80 个 frontmatter
`title:`）、`onLoadProgress` 事实修正。另外显式核过并确认**不适用**而非漏审的：
零 admonition、零图片（故 alt-text 规则不适用）、零 UI 元素、零敏感信息、
无单项列表、无撇号复数、名动词复合无误、40 对页面行数完全对齐。

### 探针第三次加固 + 变异验证

新增 `AVOID_WORDS_EN`(10 词) / `AVOID_ZH`(3 词) / `MODAL_EN` / 引号标点位置检查。
加宽后探针**当场又逮出 3 处我手工批改时漏掉的**：

```
FAIL en/05-callbacks:      punctuation outside quotes: 1 ("the system interrupted".)
FAIL en/01-centerlock:     punctuation outside quotes: 1 ("Programmatic navigation".)
FAIL en/06-media-ownership: avoid-list word: currently
```

其中 `01-centerlock` 那处是**我自己前一步引入的**——批量脚本把句号塞进引号后破坏了
具名引用 `see "Programmatic navigation"`，我手工把句号移到外面「修好」了它，
却因此违反引号标点规则。最终改写成 `the "Programmatic navigation" section covers that path.`
两条规则同时满足。这类「修 A 破 B」只有靠**两条规则都进探针**才会暴露。

三类变异验证全部 FAIL（`whitelist` / `白名单` / 引号标点），已还原并 `diff -q` 核字节。

### 门（N7 整改后）

`prettier --check` 文档 + 探针脚本全绿；`src/__tests__/site` 61/61；
`tsc -p site/tsconfig.json` 0；探针 80 页 PASS、console 0；
12 条 en 具名引用 + 16 条 zh 具名引用零悬空（批改后重新核过，确认标点没吃掉引用目标）。

### 三轮 FAIL 的模式已经很清楚

| 轮 | FAIL 原因的性质 |
|---|---|
| N5 | 查了这个类，但漏了**变体**（复合词、译名、frontmatter、单侧修完） |
| N6 | **整个类没查**（Oxford comma、第一人称、trap） |
| N7 | **又是整个类没查**（引号标点、Avoid 词表逐词、数字、时态、`-ly` 连字符） |

三轮原因两两不重叠，说明「我以为覆盖全了」这个判断本身不可靠。
每轮加固探针后都还能被下一轮 fresh agent 找出新类，因此 N8 继续复审，
直到某一轮真的 PASS 才算收口。这条规律值得记进长期记忆：
见 [[probe-pass-proves-only-what-it-checks]]。

## N8/N9 收口（2026-08-27 晚间，跨会话完成）

详细过程与同名改版见 `task-flows/2026-08-27-docs-n8-close-and-timeline-rename.md`。

- **N8（第四轮复审，`fourth-review.md`）**：8 项 must-fix 全部闭合——V-1 `invalid`、V-3 `hit` 动词、V-13 `trapped`（上会话已修）；本轮补修 V-2 `would/should` 16 处、V-14 Oxford comma 4 处、V-15 引号 4 处、V-8 zh 侧缩写展开（LRU/CDN/rAF/ESM/CJS）+ en 侧 rAF、V-12 `Note that`；V-4 eyebrow 经核实上会话已统一。nice-to-have 中的结构性项（V-5 裸围栏、V-16 占位符写法、V-9 缩写混用、N-1 链接文案多写、N-3 长句连接词）记录留待专项，本轮不动。
- **用户新裁决**：「编排」全量改名「时间线」（en `orchestration`/`choreography` → `timeline`），docs 双语 47 处 + i18n 7 键 + 页面标题/eyebrow 全部清零；slug `/docs/04-orchestration` 保留。
- **N9（第五轮 fresh 复审，`fifth-review.md`）**：判 FAIL 2 项（02 与 04 页 eyebrow 重名、`时间线图` 词形残留），修复后复核 **PASS**——历经五轮复审，首见 PASS，本任务收口。
- **探针加固**：`orchestrat`/`choreograph` 入 DRIFT 词干、`编排` 入 AVOID_ZH、`would/should` 入 MODAL；变异验证（注入两词）当场 FAIL，还原后逐字节一致。
