# 第四轮独立复审 — docs 双语 40×2 页 Elastic 规则

审查对象：`site/src/content/docs/{zh,en}/**/*.md`（80 文件）
规则表：`.agents/skills/docs-check-style/SKILL.md` v1.2.1
方法：逐条走 SKILL.md Step 4 的六个区域，**优先攻探针（`site/scripts/docs-style-probe.mjs`）查不到的维度**。
落盘方式：随做随记，确认即追加。

---

## 真违规（累积中）

### V-1 `invalid` 在正文散文里使用（Word Choice / Avoid）

Elastic 词表：`invalid | Avoid | Use _not valid_ or _incorrect_.`
探针的 `AVOID_WORDS_EN` 里**没有 `invalid`**（只有 whitelist/blacklist/abort/cancelled/
currently/today/utilize/terminate/launch/boot），所以这一类三轮都没被机器或人打开过。

- `site/src/content/docs/en/advanced/06-media-ownership.md:14` — Word Choice — “Before metadata arrives `duration` is invalid” → “…`duration` is not yet valid” 或 “…`duration` is not a number”。
- `site/src/content/docs/en/advanced/07-common-pitfalls.md:46` — Word Choice — “the invalid edge is ignored” → “the incorrect edge is ignored”（或 “the edge that is not valid”）。
- `site/src/content/docs/en/drag/02-gestures.md:91` — Word Choice — 一行三处：“Invalid-value fallbacks”、“an invalid `unit`”、“an invalid `scale`” → “Not-valid-value fallbacks / a `unit` that is not valid / a `scale` that is not valid”，或统一改 “incorrect”。

不算违规的同形：`INVALID_ANIMATION`、`INVALID_DRAG_CONFIG` 是错误码标识符，且已在 monospace 里 —— 保留正确。

### V-2 `will` / `would` / `should` 作推测与将来时（Voice/Tone — 现在时）

SKILL.md：*Write in present tense. Avoid "will," "would," "should," "could," "currently," "now."*
探针的 `MODAL_EN` **只有 `could` 一个词**。`will`/`would`/`should` 三个词整类未被任何一轮
（机器或人）打开过 —— en 侧 26 处命中。真违规如下（已剔除引号内引述、CSS 规则陈述等合理形态）：

`will`（10 处，全部可直接改现在时）：

- `en/advanced/07-common-pitfalls.md:6` — “Six failure modes you will actually run into.” → “Six failure modes you run into in practice.”
- `en/concepts/02-timeline.md:58` — “switching away in drag mode will not exit the element” → “…does not exit the element”。
- `en/concepts/03-visibility-conditions.md:21` — “it will not be mistaken for exiting” → “it is not mistaken for exiting”。
- `en/concepts/04-orchestration.md:44` — “the follower replaying will not return it to incomplete” → “…does not return it to incomplete”。
- `en/drag/05-callbacks.md:27` — “A progress bar driven by `onDragProgress` will freeze at the release value” → “…freezes at the release value”。
- `en/drag/05-callbacks.md:33` — “Analytics that count gestures through `onDragStart` will miss every re-grab.” → “…miss every re-grab.”

`would`（6 处推测语气）：

- `en/advanced/05-custom-animation.md:6` — “passed inline where a preset name would go” → “…where a preset name goes”。
- `en/scroll/01-centerlock.md:103` — “otherwise slow scrolling would reset the baseline every frame” → “…resets the baseline every frame”。
- `en/scroll/04-fixed-layer.md:35` — “An empty host that captured the pointer would cover every interactive child” → “…covers every interactive child”。
- `en/scroll/03-inputs.md:80` — “(whose corrective `scrollTo` would interrupt the smooth animation)” → “…interrupts the smooth animation”。
- `en/drag/04-ownership.md:54` — “which would consume the remaining movement in one frame and teleport…” → “which consumes … and teleports…”。
- `en/concepts/04-orchestration.md:46` — “Re-adding the leader's delay plus duration would make the follower…” → “…makes the follower…”。
- `en/getting-started/02-installation.md:79` — “so rendering silently as drag would look like "scroll mode is broken."” → “…looks like…”。

`should`（4 处，SKILL.md 明列 Avoid）：

- `en/advanced/05-custom-animation.md:87`（代码注释内）与 `:127`（正文） — “custom variants on scrub lanes should stick to the ten lane-owned properties” → “…must stay within the ten lane-owned properties”（这是硬约束，`should` 反而弱化了事实）。
- `en/advanced/06-media-ownership.md:77` — “Scrub videos should be encoded all-keyframe.” → “Encode scrub videos all-keyframe.”（命令式，且与同页 `en/reference/04-animate-video.md:55` 标题 “Keyframe encoding is a hard constraint” 的强度一致）。
- `en/drag/06-drag-pitfalls.md:40` — “decorative motion that should not be edited into the narrative” → “…that does not belong in the narrative”。
- `en/drag/06-drag-pitfalls.md:48` — “Effects inside a scene should only handle what is visually part of that screen.” → “…handle only what is visually part of that screen.”（或 “Keep effects inside a scene to what is visually part of that screen.”）
- `en/concepts/07-runtime-states.md:6` — “It decides whether a scene should be animating” → “…whether a scene animates”。
- `en/getting-started/02-installation.md:77` — “the message names the build you should load instead” → “…names the build to load instead”。

zh 侧对应句无时态问题（中文无将来时形态），本项仅 en。

### V-3 `hit` 作动词（Word Choice / Avoid）

SKILL.md：`hit | Avoid | Noun: _visits_. Verb: _click_ or _press_.`
探针的 `DRIFT_TERMS_EN` 与 `AVOID_WORDS_EN` **都不含 `hit`**，且任务书把 `hit` 列在
「前三轮已闭合」里 —— 但闭合的只是某一处；以下 4 处仍在，且都是「碰到/命中」的比喻式动词用法：

- `site/src/content/docs/en/advanced/02-preload.md:57` — “instead of hitting the network twice” → “instead of making two network requests”。
- `site/src/content/docs/en/advanced/02-preload.md:69` — “Signed URLs and CDN transcoding endpoints hit this most often.” → “…run into this most often.”
- `site/src/content/docs/en/scroll/03-inputs.md:72` — “On a hit it defers entirely” → “When one is found, it defers entirely”。
- `site/src/content/docs/en/drag/04-ownership.md:44` — “Conditionally rendered elements hit this most often.” → “…run into this most often.”

合规不算：`en/reference/04-animate-video.md:78` “On a cache hit” 与 `en/reference/06-image.md:31`
“cache hits” 是计算机领域固定术语（cache hit），非 Elastic 所指的 “hits = visits” 或击打动词。
`en/advanced/01-performance.md:37` “hitting the refresh rate” 在双引号引述内，但**引述的是本文自造的口语**
而非错误消息或 UI 文案，仍属可改（见 V-6）。

### V-4 frontmatter `eyebrow` 组内不一致（结构一致性 / Formatting）

`eyebrow` 是每页顶部的 kicker 标签。同一组内应稳定，否则侧栏/页头出现同组不同标签。
现状（zh/en 完全同步，所以是**双语同错**）：

| 组 | 组内 eyebrow 取值 | 不一致项 |
|---|---|---|
| `advanced` | `ADVANCED` ×3、`AXIS`、`AUTHORED`、`ADVANCED / MEDIA`、`TROUBLESHOOTING` | 5 种取值 / 7 页 |
| `concepts` | `CONCEPTS / *` ×4、`CINEVIEW / ORCHESTRATION`、`CINEVIEW / CONCEPTS` | 两页跑到 `CINEVIEW /` 前缀 |
| `drag` | `DRAG / *` ×5、`CONCEPTS / DUAL-TRACK` | `drag/03-two-track.md` 挂着 `CONCEPTS /` |
| `scroll` | `SCROLL / *` ×3、`ADVANCED`、`CINEVIEW / FIXED LAYER`、`OVERLAY` | 3 页越出 `SCROLL /` |
| `reference` | `REFERENCE` ×5、`CINEVIEW REFERENCE` ×2、`PRESETS`、`HOOK`、`TYPES` | 5 种取值 / 10 页 |

具体行（均为文件第 3 行，zh 与 en 同）：
- `en|zh/scroll/01-centerlock.md:3` — `ADVANCED` → 建议 `SCROLL / TAKEOVER`。
- `en|zh/scroll/04-fixed-layer.md:3` — `CINEVIEW / FIXED LAYER` → `SCROLL / FIXED LAYER`。
- `en|zh/scroll/05-scrollbar.md:3` — `OVERLAY` → `SCROLL / SCROLLBAR`。
- `en|zh/drag/03-two-track.md:3` — `CONCEPTS / DUAL-TRACK` → `DRAG / DUAL-TRACK`（该页已在 drag 组，且内容是 drag 专属双轨）。
- `en|zh/concepts/04-orchestration.md:3` — `CINEVIEW / ORCHESTRATION` → `CONCEPTS / ORCHESTRATION`。
- `en|zh/concepts/05-responsive.md:3` — `CINEVIEW / CONCEPTS` → `CONCEPTS / RESPONSIVE`。
- `en|zh/reference/03-animate.md:3`、`04-animate-video.md:3` — `CINEVIEW REFERENCE` → `REFERENCE`（与同组其余 5 页一致）。
- `en|zh/reference/08-presets.md:3`（`PRESETS`）、`09-use-animate-timeline.md:3`（`HOOK`）、`10-types.md:3`（`TYPES`）→ 统一为 `REFERENCE` 或统一为 `REFERENCE / X`。
- `en|zh/advanced/04-direction-x.md:3`（`AXIS`）、`05-custom-animation.md:3`（`AUTHORED`）、`06-media-ownership.md:3`（`ADVANCED / MEDIA`）、`07-common-pitfalls.md:3`（`TROUBLESHOOTING`）→ 组内统一。

注：`drag/06-drag-pitfalls.md` 用 `DRAG / TROUBLESHOOTING`、`scroll/06` 用 `SCROLL / TROUBLESHOOTING`，
而 `advanced/07-common-pitfalls.md` 用裸 `TROUBLESHOOTING` —— 三个同类页三种写法。

### V-5 代码围栏缺语言标注（Formatting / Code samples）

SKILL.md：*Code samples: use consistent indentation, **syntax highlighting**, …*
探针不看 md 源，只读渲染后的可见正文并**主动剔除 `pre, code`** —— 代码块规范是它的结构性盲区。

20 处裸 ``` 围栏（无语言），zh/en 各 20，同位置：

- `en|zh/advanced/02-preload.md:65` — 内容是一条正则 `/\.(mp4|webm|...)/i` → 标 ```regex 或 ```text。
- `en|zh/concepts/03-visibility-conditions.md:27`、`:46` — 几何/条件示意 → ```text。
- `en|zh/concepts/04-orchestration.md:28`、`:40` — 时间轴示意 → ```text。
- `en|zh/concepts/06-dom-contract.md:10`、`:64`、`:102` — DOM 树/样式覆写示意 → ```text（`:10` 是 DOM 树，可用 ```html）。
- `en|zh/drag/02-gestures.md:34`、`:47`、`:64` — 判定流程示意 → ```text。
- `en|zh/drag/03-two-track.md:24` — 时长累加示意 → ```text。
- `en|zh/drag/05-callbacks.md:10`、`:53` — 回调时序示意 → ```text。
- `en|zh/scroll/01-centerlock.md:25`、`:47` — 段落/进度示意 → ```text。
- `en|zh/scroll/02-zones-budget.md:56` — waitFor 锚点示意 → ```text。
- `en|zh/scroll/03-inputs.md:10`、`:23` — 输入链示意 → ```text。

同类型的示意块在别处**已经**标了语言（例如 `en/concepts/02-timeline.md:42` 的 phase 示意），
所以这不是「示意块一律不标」的一致约定，而是漏标。

### V-6 代码块缩进不一致（Formatting / Code samples）

- `en|zh/advanced/05-custom-animation.md:76` — 该 ```tsx 块内注释续行缩进 3 空格（`   content across…` / `   ten lane-owned properties.`），块内其余代码 2/4 空格阶梯。3 空格是块注释的对齐惯例，但与 SKILL.md “consistent indentation” 冲突且 Prettier 不会碰注释内部 → 建议改为 ` * ` 形式的多行注释或统一 2 空格续行。
- `zh/scroll/03-inputs.md:10` — 该裸围栏块内出现 9 空格缩进（en 同位置块无此深度）→ 双语示意图对不齐，建议与 en 对齐到相同缩进阶梯。

### V-7 单位与数值书写不一致（Formatting / Numbers）

同一行内两种写法并存：

- `site/src/content/docs/en/drag/02-gestures.md:73` — “**Boundary bounce of 150 ms**: … (displacement ratio × 800, capped at 300ms)” — 同句 `150 ms` 带空格、`300ms` 不带。
- `site/src/content/docs/zh/drag/02-gestures.md:73` — 同一处同错：「**边界回弹 150 ms**……上限 300ms」。
- 另两处带空格的 en 孤例：`en/drag/03-two-track.md:36` “1000 ms”、`en/drag/02-gestures.md:87` “1000 ms”、`en/drag/02-gestures.md:68` “1000 px/s”、`:72` “600 px/s”。

全站主流写法是**紧贴**（`3000ms`、`2000px`、`128MB`、`60fps` 共 40 余处），建议统一为紧贴；
`px/s` 这类复合单位若要保留空格，需在两语言与全部出现处一致。

### V-8 缩写首次出现未展开（Grammar/Spelling + Accessibility / Plain language）

SKILL.md 两处都要求：*Abbreviations: **Spell out on first use.*** / *Expand acronyms on first use.*
en 侧逐个缩写查首次出现处，以下四个从未在任何页展开过（每页独立成篇、读者可从任一页进入，
所以「首次」按页算，全站零展开的更是硬缺）：

- `site/src/content/docs/en/advanced/02-preload.md:73` — `LRU` 首现即用，全站零展开 → “a least-recently-used (LRU) byte budget”。
- `site/src/content/docs/en/advanced/02-preload.md:69` — `CDN` 首现即用，全站零展开 → “content delivery network (CDN) transcoding endpoints”。
- `site/src/content/docs/en/advanced/01-performance.md:45` — `rAF` 首现即用（`en/scroll/06-scroll-pitfalls.md:26` 同）→ 首次展开为 “`requestAnimationFrame` (rAF)”。
- `site/src/content/docs/en/getting-started/02-installation.md:40,44` — `ESM` / `CJS` / `UMD` 三个打包格式名全站零展开（`en/advanced/01-performance.md:100` 也直接用 `UMD/CJS`）→ 安装页首次出现处展开为 “ECMAScript modules (ESM)”、“CommonJS (CJS)”、“Universal Module Definition (UMD)”。

zh 侧同样零展开；中文文档对这类格式名一般保留英文缩写即可，但 `LRU` / `CDN` 建议同样首次带中文释义
（`zh/advanced/02-preload.md:73` 的「LRU 字节预算」、`:69` 的「CDN 转码端点」）。

合规不算：`DOM`/`CSS`/`API`/`GPU`/`JSON`/`HTML` 属 Elastic 允许直接使用的通用技术缩写；
`px2vw`、`vw`/`vh` 是 CSS 单位与本项目自有术语，已在 `concepts/05-responsive.md` 定义过换算规则。

### V-9 缩写形式与拼写形式在同页混用（Voice/Tone — Contractions）

SKILL.md：*Don't mix contractions with spelled-out equivalents in the same context.*
探针不查缩写一致性。三页混用：

- `site/src/content/docs/en/advanced/07-common-pitfalls.md` — `doesn't`（:40, :44）与 `does not`（:28, :46）同页；`isn't`（:30, :46）与 `is not`（:14, :54）同页。同一页四组混用，是全站最重的一处。
- `site/src/content/docs/en/concepts/04-orchestration.md` — `doesn't`（:10, :70）与 `does not`（:38, :62, :92, :111）同页，且 `:70` 在表格里、`:92` 在正文加粗句里，读起来正式度不一。
- `site/src/content/docs/en/advanced/02-preload.md` — `don't`（:77）与 `do not`（:46）同页。

建议：全站定一个口径（这批文档整体偏 reference/informational，倾向拼写形式），逐页统一。

### V-10 单条列表（Formatting / Lists — minimum two items）

SKILL.md：*Lists: **Minimum two items.***

- `site/src/content/docs/en/reference/05-position.md:56` / `zh/.../05-position.md:56` — 唯一一处 `>` blockquote 全站孤例（其余 40 页都用加粗句或表格表达同类警示）。它既是全站唯一 blockquote，也没有配套的 admonition 约定 → 与 SKILL.md “Admonitions: use … for their documented purpose. Do not … overuse them” 的一致性要求相悖；建议改为与 `en/scroll/04-fixed-layer.md` 同款的加粗段落，或把全站同类警示统一改成 blockquote，二者选一。

### V-11 正文里出现 h1（`# `）与页面标题冲突（Formatting / 结构）

- `site/src/content/docs/en/getting-started/02-installation.md:12` — 代码块内的 `# or` 是 shell 注释，**但它在 ```bash 围栏内**，渲染无碍 —— 判定**合规**，此项不计违规（记录在此以说明查过）。同 `zh/.../02-installation.md:12`。

### V-12 `Note that` 冗余引导（Voice/Tone — 直接、可扫读）

- `site/src/content/docs/en/concepts/04-orchestration.md:110` — “Note that passing `exitRef` disables…” → 直接写 “Passing `exitRef` disables…”。“Note that” 不承载信息，Elastic 的 informational tone 要求直陈。

### 判定合规（考虑过，不计违规）

以下维度逐条查过，无违规，或有同形但属正确用法：

- **Latin abbreviations**（`e.g.` / `i.e.` / `etc.` / `via`）：双语零命中。**闭合**。
- **`please` / `simple` / `simply` / `easy` / `easily` / `choose` / `execute` / `kill` / `hack` / `type` / `launch` / `boot` / `terminate` / `utilize` / `blacklist`**：en 零命中。**闭合**。
- **裸 URL / `click here` / `[here]` / `[this link]` / `[read more]`**：双语零命中；全部内链都是描述性文案。**闭合**。
- **图片 alt text**：文档内零 `![...]` 图片，本维度不适用（但 `en/reference/06-image.md` 的 `alt` prop 正确标为必填，与 `src/components/Image/Image.tsx` 一致）。
- **内部 `/docs/<slug>` 链接可解析性**：抽出全部 39 个链接目标与 40 个真实 slug 比对，**零悬空**（唯一未被任何页链接的 slug 是 `01-introduction`，属首页性质，正常）。**闭合**。
- **zh/en 结构等价性**：逐页比对标题数与层级、代码围栏数与语言标注、代码行数、表格行数、顶层 bullet 数、内链集合、`src/` 引用集合 —— **全部 40 对完全一致，零差异**。这是本轮最花时间的一项，结果是干净的。
- **zh/en 事实等价性**：逐页比对全部数字 token 与反引号标识符集合。差异 20 处全部核实为**翻译等价**（`1 - progress` ↔ `1 - 进度`、`3×3 anchor grid` ↔「九宫格」、en “These five have real implementations” ↔ zh「这 5 个方法」等），无一处一侧多讲/少讲实质信息。
- **代码示例与源码 API 一致性**：抽出文档全部 26 个 `src/...` 路径引用，逐个 stat —— **文件全部存在**；抽查行号引用（`performanceMonitor.ts:101-106` 的 60 clamp、`useImagePreloader.ts:216-222` 的 `Math.round(...*100)` 与无资源时返回 100、`mediaPreloadCache.ts:18` 的 128 MB、`:30-35` 的 `VIDEO_EXT` 正则六个扩展名、`entry-drag.ts:35-49` 的 throw）**全部与源码相符**。JSX 示例里抽出的 prop / 键名（`sceneSizing`、`zoneTrigger`、`thumbHoverColor`、`replayOnReenter`、`firstSceneTimeout` 等）在 `src/types/index.ts` 中均存在。
- **预设动画数量与家族数**：`en|zh/reference/08-presets.md:6` 声称 “43 presets in 11 families”，表格列 43 个名字 —— 与 `src/animations/presets/index.ts` 的 `animationCategoryMap` 43 条、11 个 category 值**完全一致**，表格分组也逐个对得上。
- **锚点 id 唯一性**：按 `manifest.ts:79` 的 `headingId()` 算法复算全 80 页 h2/h3 → **零重复 id**（重复会让 TOC 跳错锚点）。无 h4+（TOC 只读 h2/h3，有 h4 会漏进目录）。零「h3 出现在任何 h2 之前」。
- **`-ly` 副词误加连字符**：en 零命中。**闭合**。
- **predicate adjective 误加连字符**：逐个审 60 余种连字符复合词，全部处于**前置定语**位置（`cold-start gate`、`per-frame cost`、`first-screen priority`、`read-only`…），无一处出现在系动词后。`full screen` / `first screen` 作名词时不带连字符、作定语时带（`full-screen cell` / `first-screen priority`）—— **用法正确，不是漏加**。
- **`re-` 双元音连字符**：`re-entry` / `re-grab` / `re-armed` / `re-anchors` / `re-attach` / `re-render` 均正确带连字符；`reuse` / `reopen` / `reordering` / `reattached` 不带 —— Elastic 只要求「两元音相邻时加」（re+e/re+a），`reuse`(re+u)/`reopen`(re+o)/`reorder`(re+o) 不在规则内。**但 `reattached`（`en/advanced/01-performance.md:93`、`en/advanced/06-media-ownership.md:69,73`）是 re+a 双元音，同文档另有 `re-attach`（`en/reference/04-animate-video.md:72,73`）—— 同一词两种写法**，见 nice-to-have 清单。`replayOnReenter` 是 API 标识符，不受拼写规则约束。
- **noun/verb 复合**（backup/back up、setup/set up、login/log in、startup/start up）：en 零命中，无误用。**闭合**。
- **每句连接词 ≤2**：脚本按句切分统计 en 全站；14 句达 4 个及以上（`en/drag/05-callbacks.md:31` 与 `en/getting-started/02-installation.md:79` 各 6 个、`en/concepts/06-dom-contract.md:113` 与 `en/scroll/05-scrollbar.md:42` 各 5 个）。SKILL.md 的 “Limit conjunctions to two per sentence” 是硬数字，但这些长句都在解释状态机因果链，拆句会切断逻辑 —— 列为 nice-to-have，不作 must-fix。
- **标题 gerund 用法**：9 个 gerund 标题（`Encoding requirements`、`Observing zones`、`Switching to scroll mode`、`Choosing an entry`、`Centering anchors`、`Naming convention`、`Binding continuous values to style`、`Positioning precedence`、`During a switch: …`）—— Elastic 允许 gerund 用在 top-level task title，这些都是任务型小节标题。零「介词短语里的 gerund」（无 `on configuring` 之类）。**合规**。
- **device-neutral 动词 / UI writing**：文档零 UI 操作指令（无「Click **Save**」类）；`click`/`press`/`tap`/`swipe` 全部出现在**描述框架接收的输入事件**语境（`right-click and middle-click never drag`、`track click computes a target offset`、`taps, link clicks`），非指导读者操作 UI。UI writing 一节整体**不适用**。Kibana UI 术语表**不适用**（非 Kibana 文档）。
- **gender-neutral / ableist / 暴力意象 / 超级英雄词 / buzzword**：逐词扫（`guys`/`he`/`she`/`his`/`her`/`himself`/`sanity`/`insane`/`crazy`/`dummy`/`master`/`slave`/`blind`/`cripple`/`kill`/`attack`/`explode`/`hostage`/`victim`，以及 `seamless`/`powerful`/`blazing`/`robust`/`elegant`/`magic`/`under the hood`/`out of the box`/`leverage`/`battle-tested`/`first-class`/`amazing`/`best`/`fastest`）—— **全部零命中**。`dead center`（`en/concepts/05-responsive.md:44`）在代码注释内且是 CSS 惯用语，非 ableist。
- **日期时间格式**：文档零日期、零时刻表达 —— 本维度**不适用**（无 `Month DD, YYYY` / AM-PM / 时区可查）。
- **相对时间词**（`recently` / `soon` / `nowadays` / `at present` / `lately`）：唯一命中 `en/advanced/02-preload.md:73` 的 “least recently used” —— LRU 的标准术语，**非相对时间指代**，合规。`now` 两处（`en/scroll/04-fixed-layer.md:55` “the frame of reference is now the fixed-layer host” 是逻辑对比而非时间；`en/reference/03-animate.md:140` “show now” 在代码注释内）—— 判定合规，但 `:55` 的 `now` 可无损删除，列 nice-to-have。
- **千分位逗号**：全站最大数字为 `30000`（ms）、`15000`（ms）、`128MB`，且都紧跟单位作为配置值 —— Elastic 的 “separate large numbers with commas (1,234,567)” 针对散文里的计数量，配置数值不加逗号是正确的（`30,000ms` 反而会被读成两个值）。**合规**。
- **表格内数字用数字形式**：抽查 14 处表格里的英文数词，全部是**定语/限定词**（`one viewport`、`two drivers`、`the six-state phase`、`all four optional`、`one mode only`、`up to six levels`），不是可量化的表格数据列。Elastic 要求的是「表格里的数据用数字」，这些是描述性文字。**合规**。
- **stacked admonitions / 过度使用**：全站仅 1 处 blockquote（见 V-10），零 `:::note` 容器，零 `**Note:**` 前缀堆叠。
- **敏感信息**：全部示例 URL 为 `/hero.jpg` / `/clip.mp4` / `/api/clip?fmt=mp4` 占位路径；零真实主机名、零 IP、零 token、零客户数据、零内网链接。**闭合**。
- **段落 ≤7 行**：脚本按 md 源行统计 —— 零段落达 7 源行（本站每段一行长文本，渲染后行数由视口宽决定，源行数不是有效度量；改用字符数近似看，最长段 `en/advanced/02-preload.md:69` 约 470 字符，渲染在 1440px 下约 4 行）。**合规**。
- **行间空行规范**：零重复空行，零行尾空白（Prettier 已管）。**闭合**。
- **列表首字母大写 / 平行结构 / 引导句冒号**：脚本扫全站。两处「小写开头」是 `- **drag**: …` / `- **scroll**: …`（`en/getting-started/01-introduction.md:12`、`en/advanced/02-preload.md:30`）—— 首词是 API 值名 `drag`/`scroll`，必须小写，且已用加粗标出，**合规**。「引导句缺冒号」的 6 处全部是脚本把表格末行/代码围栏误当引导句，逐个人工核实 —— 真实引导句全部以冒号结尾，**合规**。
- **探针自身覆盖项的快速复验**：见下节。

## 前三轮项快速复验

用 grep（全部带 `-i`）在 80 个 md 源文件上复验任务书列出的已闭合项：

| 项 | 结果 |
|---|---|
| 比喻词表 12 词 + `换算尺`/`bundled rollback`/`crash site`/`flap`/`sharp edges`/`收摊`/`抢戏`/`武装`/`说了算` | **闭合**，零命中 |
| `trap` 系列 | **未完全闭合** —— `en/scroll/04-fixed-layer.md:10` “is **trapped** inside it”（`trapped` 是词形变体，探针的 `DRIFT_TERMS_EN` 只列 `trap`/`traps`，正则 `(^|[^\w-])trap([^\w-]|$)` 匹配不到 `trapped`）；zh 同位置「被**框在**这个祖先里」已去比喻，即 en 侧漏改。这正是 N5 那类「查了某类但漏了变体」的复发。 |
| 位置指代（zh 8 词 / en 17 搭配） | **闭合**，零命中 |
| 第一人称 `I`/`me`/`my` | **闭合**，零命中 |
| 标题 sentence-case（含 80 个 frontmatter `title:`） | **闭合**。逐个核 80 个 title 与全部 h2/h3：仅有的大写词均为组件名 / 专有名 / 缩写（`CineView`、`Scene`、`Animate`、`AnimateVideo`、`Position`、`Image`、`Container`、`React`、`TypeScript`、`DOM`、`API`、`CSS`、`ESM`、`UMD`、`CJS`、`Framer Motion`、`AnimationType`、`Vite`），无 Title Case |
| 英式拼写 13 词 | **闭合**，零命中 |
| Oxford comma | **闭合**，抽查全部 `, and` / `, or` 三项以上列举，均带 |
| 引号标点位置 | **闭合**。全站 80 处直引号 / 「」 逐个核，逗号句号均在引号内侧 |
| `whitelist` / `白名单` | **闭合**（`allowlist` / `Allowlist-only` 已替换到位） |
| `abort` / `hit` / `could` / `currently` / `today` / `目前` | **`abort`/`could`/`currently`/`today`/`目前` 闭合；`hit` 未闭合** —— 见 V-3 的 4 处动词用法 |
| 数字 1–9 拼写 | **闭合**，散文里 1–9 全为英文数词、10+ 全为数字 |
| `-ly` 副词连字符 | **闭合**，零命中 |
| 链接文案与页面标题一致 | **未完全闭合** —— 见 nice-to-have N-1，同一目标仍有 2–5 种链接文案 |
| zh `预载` → `预加载` | **闭合**，零 `预载` |
| `onLoadProgress` 值域整数 0–100 | **闭合**，`en|zh/advanced/02-preload.md:77` 写 “integer from 0 to 100”，与 `src/hooks/useImagePreloader.ts:219` 的 `Math.round((safeLoaded / safeTotal) * 100)`、无资源时 `100` 一致 |

### V-13 `trapped` —— 比喻词的词形变体漏改（Voice/Tone + term drift）

- `site/src/content/docs/en/scroll/04-fixed-layer.md:10` — “every fixed element in a Scene subtree is **trapped** inside it” → “…is **positioned against it** / **contained by it**”（zh 同位置已改成中性的「被框在这个祖先里」，en 侧遗漏）。

### V-14 Oxford comma 缺失（Grammar/Spelling）—— 修正上表的「闭合」结论

SKILL.md：*Oxford comma: **Always** use in lists of three or more.*
我先按抽查判为闭合，随后写脚本穷尽扫「A, B and/or C」模式并人工核实每一处 ——
**发现 7 处真缺**（前三轮把这项判为闭合，实际未闭合）：

- `site/src/content/docs/en/advanced/04-direction-x.md:38` — “ArrowDown and PageDown move forward along `'x'`, ArrowUp and PageUp move backward.” —— 这是两组并列句而非三项列举，**判定合规**（记录以示查过）。
- `site/src/content/docs/en/concepts/06-dom-contract.md:69` — “`id`, `data-*`, `aria-*`, `role` and `onClick` all work.” → “…`role`, and `onClick` all work.” **真缺**。
- `site/src/content/docs/en/drag/05-callbacks.md:43` — “with `progress: 1`, `elapsedMs: 0` and `timelineDurationMs: 0`.” → “…`elapsedMs: 0`, and `timelineDurationMs: 0`.” **真缺**。
- `site/src/content/docs/en/drag/06-drag-pitfalls.md:46` — “so effects re-run, state resets and the element timeline restarts at 0.” → “…state resets, and the element timeline restarts at 0.” **真缺**。
- `site/src/content/docs/en/getting-started/02-installation.md:48` — “declare only `types` and `require`” 是两项，**合规**。
- `site/src/content/docs/en/scroll/05-scrollbar.md:26` — “resolved inside the overlay component, defaults applied and clamps enforced.” → “…defaults applied, and clamps enforced.” **真缺**（三个并列分句）。
- `site/src/content/docs/en/advanced/03-callbacks.md:29`（表格 Notes 列） — “with target and timeline data” 是两项，**合规**。
- `site/src/content/docs/en/concepts/06-dom-contract.md:6` — “`position: fixed` and `z-index` fail” 是两项，**合规**。
- `site/src/content/docs/en/advanced/06-media-ownership.md:73` — “returns early, releasing nothing and reattaching nothing.” → 两个动名词并列，**合规**。

净结果：**4 处真缺**（`concepts/06-dom-contract.md:69`、`drag/05-callbacks.md:43`、
`drag/06-drag-pitfalls.md:46`、`scroll/05-scrollbar.md:26`）。zh 侧无此规则。

### V-15 引号用于强调 / 包裹枚举值（Grammar — Quotation marks）

SKILL.md 明禁三类引号用法：**for emphasis（用 bold/italic）**、**for code/commands（用 monospace）**、
for product/feature/UI names。以下用引号包裹的是**代码枚举值或概念强调**，两类都在禁列：

- `site/src/content/docs/en/reference/09-use-animate-timeline.md:25` — 表格里 `distinguishing "entering" from "exiting."` —— `entering` / `exiting` 是 `AnimatePhase` 的字面枚举值，同表上一行就用 `'idle' \| 'waiting' \| 'entering' \| …` 的 monospace 形式 → 改成 `` `entering` `` / `` `exiting` ``。同页同表自相矛盾。
- `site/src/content/docs/en/concepts/04-orchestration.md:113`（标题） — `## In drag, "exiting" is two different things` → `## In drag, \`exiting\` means two different things`（或去引号用斜体）。
- `site/src/content/docs/en/concepts/07-runtime-states.md:19` — `` `covered` means "another scene is on top," `parked` means "this one has retreated past its boundary." `` —— 引号内是本文自撰的释义（不是错误消息、不是首次引入的术语），属强调用法 → 改斜体或直接去引号。
- `site/src/content/docs/en/scroll/03-inputs.md:27` — `no "unlocked" flag` —— `unlocked` 是假想的标志名 → `` no `unlocked` flag ``。
- `site/src/content/docs/en/advanced/02-preload.md:71` — `"Ready" also means something different…` —— 这里引号在**首次引入并重新定义术语**，SKILL.md 允许「introduce an unfamiliar term on first use」→ **判定合规**。
- `site/src/content/docs/en/scroll/04-fixed-layer.md:12` — `"Cannot" is not rhetoric` —— 引用的是上一行标题里自己用的词，属元语言引用（quoting a word as a word），SKILL.md 未明禁 → **判定合规**（斜体会更符合 Elastic 的 “new terms and concepts” 惯例，列 nice-to-have）。

zh 侧对应位置用「」，中文引号用于概念强调是通行惯例，且 `zh/reference/09-use-animate-timeline.md:25`
的「进入中」/「退出中」是**中文释义**而非枚举字面值 —— zh 侧**判定合规**，本项仅 en。

## nice-to-have

- **N-1 链接文案对同一目标不统一**（Accessibility / Formatting）：同一 `/docs/<slug>` 在不同页用 2–5 种链接文案。最散的四个目标：
  - `/docs/01-centerlock`（title `center-lock scroll takeover`）：5 种 —— `center-lock`、`center-lock & zones`、`Center-lock takeover`、`Center-lock`、`center-lock scroll takeover`。`&` 那处（`en/advanced/07-common-pitfalls.md:38`）另有 Elastic 忌用 `&` 代 `and` 的问题。
  - `/docs/05-responsive`（title `Responsive conversion base`）：4 种 —— `Responsive conversion base`、`Responsive`、`Responsive scaling`、`responsive model`。
  - `/docs/02-timeline`（title `The Animate timeline`）：4 种 —— `Timeline concepts`、`Timeline concept`（单复数都有）、`The Animate timeline`、`Animate timeline`。
  - `/docs/03-animate`（title `Animate`）：3 种 —— `Animate`、`Animate reference`、`Animate API`（zh 侧更多，4 种，含 `Animate 组件参考`）。

  Elastic 的 “Link text: descriptive” 不强制等同标题，所以不列 must-fix；但同一目标在相邻页面用不同名字会让读者以为是不同页。建议每个目标定一个规范文案。
- **N-2 `reattached` vs `re-attach` 同词两种拼写**：`en/advanced/01-performance.md:93`、`en/advanced/06-media-ownership.md:69,73` 用 `reattached`/`reattaching`；`en/reference/04-animate-video.md:72,73` 用 `re-attach`。`re`+`a` 是 Elastic 规则里的双元音，应统一带连字符。
- **N-3 单句连接词超 2 个（14 句）**：最重的四处 —— `en/drag/05-callbacks.md:31`（6 个）、`en/getting-started/02-installation.md:79`（6 个）、`en/concepts/06-dom-contract.md:113`（5 个）、`en/scroll/05-scrollbar.md:42`（5 个）。另 `en/scroll/03-inputs.md:27` 用了三个连续 “so nothing is consumed, so nothing is intercepted, so the browser's…”，虽是刻意的修辞递进，但硬数字上违规。全部拆句会切断状态机因果链，建议只拆最长的两句。
- **N-4 `now` 可无损删除**：`en/scroll/04-fixed-layer.md:55` “the frame of reference is now the fixed-layer host” → 去掉 `now`（SKILL.md 把 `now` 与 `currently` 并列在 Avoid 里；此处 `now` 表逻辑对比不表时间，故不列 must-fix）。
- **N-5 `"Cannot"` 改斜体**：`en/scroll/04-fixed-layer.md:12`，见 V-15 末。
- **N-6 blockquote 全站孤例**：`en|zh/reference/05-position.md:56`，见 V-10。
- **N-7 `&` 代 `and`**：`en|zh/advanced/07-common-pitfalls.md:38` 的链接文案 `center-lock & zones`。

### V-16 ```tsx 代码示例里的占位符四种写法并存，其中两种不是合法 TSX（Formatting / Code samples）

SKILL.md：*Code samples: … **runnable examples when possible***。
探针剔除 `pre, code` 后再检查，所以代码块内容它一概看不到；前三轮的清单里也没有「示例可运行性」
这一维。全站 ```tsx 块里的「此处省略子元素」有**四种**写法，其中两种在 TypeScript 下直接报错：

| 写法 | 出现处（en/zh 同位置） | 是否合法 TSX |
|---|---|---|
| `{/* ... */}` | `advanced/01-performance.md:16`、`advanced/02-preload.md:24`、`scroll/01-centerlock.md:78` | ✅ 真占位（JSX 注释，编译后消失） |
| 裸 `...`（独立行或行内） | `reference/01-cineview.md:109`、`reference/02-scene.md:32`、`advanced/04-direction-x.md:20` / `:12,13`（行内） | ⚠️ 语法合法，但是 **JSX 文本节点** —— 照抄即在页面上渲染出可见的 `...` |
| 裸 `…`（U+2026） | `reference/05-position.md:48`、`reference/07-container.md:39` | ⚠️ 同上，渲染出可见的省略号字符 |

（已用 `tsc --noEmit --jsx preserve` 实测：裸 `...` 作 JSX children **不报语法错**，
我最初判它 `TS1005` 是错的；真实问题是它编译进产物成为可见文本，而不是被当作占位省略。）

建议：全部统一为 `{/* ... */}`。这条影响「读者复制粘贴示例后屏幕上会不会多出 `...`」，
在 SKILL.md 的 runnable-examples 要求下比纯排版一致性更实。共 6 处（en）+ 6 处（zh）。

另：`en|zh/advanced/04-direction-x.md:12,13` 的 `<Scene sceneId="reel-01">...</Scene>`
除了语法问题，还与同页 `:20` 的独立行 `...` 排版不一致（同一页两种写法）。

## 本轮新审维度清单（本报告的核心价值）

每行：维度 → 怎么查的 → 结果。**探针（`site/scripts/docs-style-probe.mjs`）覆盖的 11 项之外**的维度全在这里。

| # | 维度 | 查法 | 结果 |
|---|---|---|---|
| 1 | Latin abbreviations（`e.g.`/`i.e.`/`etc.`/`via`） | 双语正则，含词边界 | 干净 |
| 2 | Avoid 词表未进探针的 14 词（`please`/`simple`/`simply`/`easy`/`easily`/`choose`/`execute`/`invalid`/`kill`/`hack`/`type`/`blacklist` 等） | 逐词带边界 grep en | **V-1：`invalid` 3 行 4 处** |
| 3 | 时态/情态：`will`/`would`/`should`（探针只有 `could`） | 逐词带边界 grep + 人工逐句判 | **V-2：26 处，剔除后 20 处真违规** |
| 4 | `hit` 作动词（任务书列为已闭合） | 带边界 grep + 逐处判语境 | **V-3：4 处未闭合**（另 2 处 `cache hit` 合规） |
| 5 | frontmatter `eyebrow` 组内一致性 | 抽全 80 页第 3 行，按组列表比对 | **V-4：5 组全部组内不一致，13 页需改** |
| 6 | 代码围栏语言标注 | 脚本状态机扫围栏行 | **V-5：40 处裸围栏（en/zh 各 20）** |
| 7 | 代码块缩进一致性 | 脚本统计块内缩进宽度，报奇数/异常深度 | **V-6：2 处** |
| 8 | 单位/数值书写（空格、千分位、单位紧贴） | 正则抽全部「数字+单位」并做频次统计找孤例 | **V-7：150 ms/300ms 同句混用等 6 处** |
| 9 | 缩写首次展开（en 与 zh 各自） | 抽 20 个缩写候选做频次表，逐个回溯首现处 | **V-8：`LRU`/`CDN`/`rAF`/`ESM`/`CJS`/`UMD` 全站零展开** |
| 10 | 缩写形式与拼写形式同页混用 | 脚本对 10 组配对（`don't`↔`do not` 等）做同文件共现检测 | **V-9：3 页混用** |
| 11 | Admonition / blockquote 用法一致性 | grep `^>` / `:::` / `**Note:**` | **V-10：全站唯一 1 处 blockquote，孤例** |
| 12 | 正文 h1 冲突（与页面 h1 双标题） | 脚本扫围栏外 `^# ` | 合规（唯一命中在 ```bash 内，是 shell 注释） |
| 13 | `Note that` 类冗余引导 | grep | **V-12：1 处** |
| 14 | 裸 URL / `click here` / `[here]` / `[this]` / `[read more]` | 双语 grep | 干净 |
| 15 | 图片 alt text | grep `!\[` | 不适用（文档内零图片） |
| 16 | 内部 `/docs/<slug>` 链接可解析性 | 抽全部链接目标 vs 真实 slug 集合做 `comm -23` | 干净（零悬空） |
| 17 | zh/en **结构**等价性 | 脚本逐页比标题数+层级、围栏数+语言标注、代码行数、表格行数、bullet 数、内链集合、`src/` 引用集合 | 干净（40 对零差异） |
| 18 | zh/en **事实**等价性 | 脚本逐页比全部数字 token 频次 + 反引号标识符集合，20 处差异逐个人工核 | 干净（全部为翻译等价） |
| 19 | 代码示例 vs 源码 API 一致性 | 抽 26 个 `src/` 路径 stat + 抽查 5 处行号引用读源码核事实 + 抽 JSX prop/键名核 `types/index.ts` | 干净 |
| 20 | 预设动画数量/家族数断言 | 数 `animations/presets/index.ts` 的 `animationCategoryMap` | 干净（43 / 11 全对，表格分组逐个对得上） |
| 21 | 锚点 id 唯一性 + 层级 | 按 `manifest.ts:79` 的 `headingId()` 复算全 80 页，查重/查 h4+/查 h3-before-h2 | 干净 |
| 22 | `-ly` 副词误加连字符 | 正则 `\w+ly-\w+` | 干净 |
| 23 | predicate adjective 误加连字符 | 抽全部 60 余种连字符复合词做频次表，逐个看位置 | 干净（全部前置定语） |
| 24 | `re-` 双元音连字符 | 正则抽全部 `re[-]?[aeiou]` 词，人工分类 | **N-2：`reattached` vs `re-attach` 同词两写** |
| 25 | noun/verb 复合（backup/back up 等） | 4 组 grep | 干净（零命中） |
| 26 | 每句连接词 ≤2 | 脚本切句 + 计连接词，阈值 3 与 4 两轮 | **N-3：14 句 ≥4 个**（判 nice-to-have） |
| 27 | 标题 gerund + 介词短语 gerund | grep `^#+ \w+ing` + `(on|for|about) \w+ing` | 干净（9 个 gerund 标题全是任务型，合规） |
| 28 | Oxford comma | 脚本正则扫「A, B and/or C」并逐处人工判 | **V-14：4 处真缺（前三轮判闭合，实为未闭合）** |
| 29 | 引号用于强调/包裹枚举值 | 脚本抽全站 80 处引号内容（剔 inline code），逐个判用途 | **V-15：4 处 en（zh 合规）** |
| 30 | 引号内外标点位置（双向） | 脚本同时查「标点在外」与「冒号分号问号叹号在内」 | 干净 |
| 31 | UI writing 全节（button/checkbox/select vs click/toggle/menu/Kibana 术语） | grep `click`/`press`/`tap`/`swipe`/`select` 逐处判语境 | 不适用（零 UI 操作指令，全是描述框架接收的输入事件） |
| 32 | gender-neutral / ableist / 暴力意象 / 超级英雄词 | 19 词 grep | 干净 |
| 33 | buzzword / 非具体最高级 | 35 词 grep（`seamless`/`powerful`/`robust`/`magic`/`leverage`/`out of the box`…） | 干净 |
| 34 | 日期时间格式 | grep 月份名/ISO 日期/AM-PM | 不适用（零日期表达） |
| 35 | 相对时间词（`recently`/`soon`/`now`/`at present`） | grep | **N-4：`now` 1 处可删**（`least recently used` 合规） |
| 36 | 千分位逗号 | 正则抽全部 4 位以上数字 | 合规（最大为配置值 `30000ms`，加逗号反而歧义） |
| 37 | 表格内数字用数字形式 | grep 表格行里的英文数词，逐处判是数据还是定语 | 合规（14 处全是定语） |
| 38 | 敏感信息（主机名/IP/token/内网链接/客户数据） | grep URL/示例路径 | 干净（全为 `/hero.jpg` 类占位） |
| 39 | 段落 ≤7 行 | 脚本按 md 源行分块统计 + 最长段字符数估算 | 合规 |
| 40 | 行尾空白 / 重复空行 | 脚本逐行 | 干净 |
| 41 | 列表：最少两项 / 首字母大写 / 平行结构 / 引导句冒号 | 脚本四查 + 逐个人工核脚本报的 14 条 | 合规（小写开头的 2 处首词是 API 值名 `drag`/`scroll`，必须小写） |
| 42 | ```tsx 示例里的占位符写法 | 脚本抽 tsx 块里的 `...` / `…` / `{/* ... */}`，并用 `tsc --noEmit --jsx preserve` 实测 | **V-16：三种写法并存，12 处会渲染出可见 `...`** |
| 43 | zh 侧排版卫生（半角括号包中文、中文后半角逗号、中英文间空格） | 三个 CJK 正则扫全 40 页 | 干净（零命中） |
| 44 | zh 侧口语/情绪词（简单/轻松/显然/坑/翻车/黑科技…30 词） | 逐词 grep | 干净（`容易撞上`/`值得记住` 是中性表述，en 对应 “worth knowing / worth remembering”，合规） |
| 45 | Unicode 符号（箭头/省略号/破折号） | 正则频次统计 | 合规（79 处 `→` 用于状态转换，一致；零 em/en dash） |
| 46 | 比喻词的**词形变体**（吸取 N5 教训主动扩展） | 对已闭合词表逐个做词干匹配而非词面匹配 | **V-13：`trapped` 漏改（探针词表只有 `trap`/`traps`）** |

## 结论

### must-fix（8 项）

1. **V-1** `invalid` 4 处 → `not valid` / `incorrect`（Avoid 词表硬项）
2. **V-2** `will`/`would`/`should` 20 处 → 现在时 / 命令式（Avoid 词表 + 现在时硬项）
3. **V-3** `hit` 作动词 4 处 → `run into` / `make a request`（Avoid 词表硬项，任务书误判为已闭合）
4. **V-13** `trapped` 1 处 → 中性表述（比喻词变体漏改，zh 侧已改、en 遗漏）
5. **V-14** Oxford comma 4 处（SKILL.md 用 “Always”，前三轮误判为闭合）
6. **V-8** `LRU`/`CDN`/`rAF`/`ESM`/`CJS`/`UMD` 首次展开（Grammar 与 Accessibility 双处明列）
7. **V-15** 引号用于强调/枚举值 4 处 → monospace 或斜体（SKILL.md 明禁）
8. **V-4** `eyebrow` 组内不一致 13 页（双语同错；结构性，读者可见）

### nice-to-have（10 项）

V-5（40 处围栏缺语言标注）、V-6（2 处缩进）、V-7（6 处单位空格）、V-9（3 页缩写混用）、
V-10（blockquote 孤例）、V-12（`Note that`）、V-16（12 处占位符 `...` 会渲染出来）、
N-1（链接文案 2–5 种）、N-2（`reattached`/`re-attach`）、N-3（14 句连接词超限）、
N-4（`now`）、N-5（`"Cannot"` 改斜体）、N-7（`&` 代 `and`）。

### 与前三轮的关系

本轮 must-fix 里 **V-14 / V-8 / V-15 / V-4 / V-16 / V-5 / V-9 六类是前三轮完全未打开过的规则维度**；
**V-1 / V-2 是探针词表本身不含的 Avoid 词与情态词**；**V-3 / V-13 是任务书列为「已闭合」但实际
只闭合了部分形态的复发**（`hit` 只改了一处、`trap` 只改了裸词形没改 `trapped`）。
四轮的失效模式一致：**词面清单式检查在「变体」和「清单外的同类规则」上恒有盲区**。
建议把探针从「词表匹配」升级为：Avoid 词表全量导入 + 词干匹配 + 加 `will|would|should` 情态检查 +
加 frontmatter/围栏/缩写展开三个结构性检查，否则第五轮仍会在新维度上失守。

VERDICT: FAIL

