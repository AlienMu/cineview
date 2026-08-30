# 独立复审：双语文档风格审查

审查对象：`site/src/content/docs/{zh,en}/**/*.md`（双语各 40 页，共 80 文件）
审查方式：Vale 未安装（`vale: command not found`），SKILL.md Step 2 跳过，全部结论来自逐文件通读 + 机械 grep。
未读取 `task-flows/`。

**VERDICT: FAIL**（7 条 must-fix，14 条 nice-to-have，另有 1 条附带发现的事实性矛盾）

---

## 总览

标准一（去比喻化）：已知的 12 个词全部清零（`尺子`/`闸门`/`死区`/`逃生舱`/`涌现`/`破窗`/`打包回滚`/`翻车`/`心跳`/`出血`/`对号入座`/`白装` 均零命中）。但发现 **3 条前一轮没想到的同类残留**：ruler 比喻的复合词变体、`bundled rollback`（打包回滚的英译留存）、以及 `收摊` 这一江湖气口语。

标准二（Elastic 规则）机械项大面积干净：
- 零 Latin 缩写（`e.g.` / `i.e.` / `etc.` / `via` 全零）
- 零超长段落（最长约 636 显示列 ≈ 5 行，7 行上限内）
- 零单项列表
- 零死链（40 个 slug，`/docs/*` 引用全部解析）
- 零图片（无 alt-text 暴露面）
- **24 条具名小节引用全部命中同页真实标题**（见下方核验表）

---

## 标准一：残留比喻

### Must-fix

**1. `zh/advanced/04-direction-x.md:33` — `换算尺` ×2**

> 响应式**换算尺**不受影响：`scale = viewportWidth / size` 在两个轴向下都只认宽。`'x'` 改变的是行进轴，绝不是**换算尺**。

这是被标记的 `尺子` 比喻的复合词变体——上一轮删掉了裸名词，没删掉这个compound。en 同行已经是 `conversion base` / `the base`。同时构成双语术语漂移：zh 其余各页一律用 `换算基准`（en 侧 `conversion base` 21 处）。
建议：`响应式换算基准不受影响……改变的是行进轴，不是换算基准`。

**2. `en/reference/03-animate.md:168` — `("bundled rollback")`**

> An enter-only chain makes every element exit at once ("bundled rollback"), lopsided against the ordered enter cascade.

被标记的「打包回滚」译成英文后以引号造词的形式留存。zh 对应行（`zh/reference/03-animate.md:168`）已经改成平实表述，只有 en 侧漏了。
建议：删掉括号部分，`every element exits at once` 本身已说清机制。

**3. `zh/advanced/07-common-pitfalls.md:52` 与 `:54` — 「啪」的一整帧收摊 / 打包收摊**

> :52 视觉上是**「啪」的一整帧收摊**
> :54 场景切换信号到达后每个元素**同时**开始自己的 `exitAnimation`，于是**打包收摊**

`收摊`（菜市场收摊）+ 拟声词「啪」是江湖气口语，且被当作故障的描述性术语在用；`打包收摊` 也是「打包回滚」换名重现。en 对应行是 `the whole set packs up at once` / `each starts its own exit at once`——`packs up` 稍轻但同一个figure。
建议 zh：「所有元素在同一帧一起触发 exit，整屏同时退场」；en：`every element fires its exitAnimation in the same frame`。

### Nice-to-have（较弱的比喻）

| 位置 | 问题 | 说明 |
| --- | --- | --- |
| `zh/advanced/06-media-ownership.md:112` | 「不会被一层叠加的淡入**抢戏**」 | 拟人-戏剧化。en 已是平实版 `instead of layering a fade over it`，对齐即可 |
| `zh` + `en` `advanced/05-custom-animation.md:117` | 「像**放映机拉远**」/ `a projector pulling back` | 明喻而非术语，且对影院框架主题贴合——边界情况，留给你裁决 |
| `zh/advanced/05-custom-animation.md:97` | 「用的就是**同一招**」 | en `the same trick`，两侧都略口语 |
| `zh/advanced/05-custom-animation.md:72` | 标题 `## 站点实战中的两个形态` | `实战` 轻微武术figure；en 标题 `Two shapes from real site code` 已是平实版 |
| `zh` + `en` `drag/04-ownership.md:57` | 「一并**重新武装**」/ `re-armed` | 武器意象（Elastic 无障碍章节列 violent imagery 为 Avoid），但 `re-armed` 对 timer 属通用词汇，判边界 |
| `en/scroll/06-scroll-pitfalls.md:6` | `Eight scroll-only crash sites.` | 灾难意象，且是 en 侧最强的一处。另两个 pitfall 页 en 都说 `failures`，三个 zh counterpart 都说「故障」。兼术语漂移 |
| `en/advanced/06-media-ownership.md:6` | `its three sharp edges` | 物理实体隐喻；zh:6 已是「它的三处边界」 |
| `en/scroll/01-centerlock.md:29` | `the real scroll distance the audience burns` | 燃烧figure 代替 consume；zh:29 已是「消耗掉的真实滚动距离」 |
| `zh/drag/01-layout.md:17` | 「最容易**出事**的地方」 | 口语；en `where the same JSX breaks` |
| `zh/advanced/07-common-pitfalls.md:28`、`zh/advanced/02-preload.md:69` | 「最容易**踩**的一格」/「最容易**踩**这个」 | 踩雷figure；en:28 同样 `to step on`。中文开发语境内足够惯用，不建议强改 |
| `zh` + `en` `drag/06-drag-pitfalls.md:40` | 「到场后就开始**呼吸**的光点」/ `starts breathing` | 拟人，但描述的是视觉效果本身而非机制命名，按 react.dev 标准可接受 |

### 考虑过但判定为合规——请勿误改

以下在关键词扫描下会命中，但逐条核对它命名的机制后判定为正当技术词汇：

- **`轨` / `lane` / `track`** — 你的既有裁决明确保留。
- **`门` / `门控` / `gate` / `gated`（30+ 处）** — **不是**被标记的「闸门」（水闸意象）。`cold-start gate` / `冷启动门控` 命名的是真实的同步原语，`gated by shouldRunInfinite` 是 React/CSS 通用说法。被标记的是水闸那个像，平实的 `gate` 正确存活。
- **`钳` / `clamp`、`钉住` / `pin`、`壳` / `shell`、`迟滞` / `hysteresis`、`Schmitt 排序`、`锁存` / `latch`、`层叠上下文`、`热路径` / `hot path`、`管线` / `pipeline`、`骨架内容` / `skeleton content`、`钩子` / `hooks`（指 `data-*` 选择器）、`兜底` / `fallback`、`接管` / `takeover`、`裁决`** — 或是标准 CS 术语，或是 CSS/DOM 的字面行为，或是本框架自有架构词汇。没有一个是「物理实体替代机制」。
- **`hijack` / `劫持`**（`scroll/01-centerlock.md:10`、`06:82`）— 用于说明框架**不**劫持滚动，且 "scroll hijacking" 是业界对该反模式的自有名称。保留正确。
- **`视觉盒` / `visual box`、`盒模型`** — CSS 规范词汇。
- **`teleport`**（`drag/04-ownership.md:54`）— 描述单帧位置跳变，字面即是。

---

## 标准二：Elastic 规则

### Must-fix

**4. `en/concepts/01-modes.md:2` — 标题大写（Grammar/Spelling）**

`title: Dual-Mode Engines` 是 Title Case，规则要求 sentence-case。这是全部 40 个 en 页面中**唯一**一个 Title Case 标题（其余全部 sentence case）。
建议：`Dual-mode engines`。

**5. American English —— en 侧 4 处英式拼写**

| 位置 | 现状 | 应为 |
| --- | --- | --- |
| `en/drag/03-two-track.md:40` | `serialisation` | `serialization` |
| `en/drag/06-drag-pitfalls.md:56` | `recognised` | `recognized` |
| `en/concepts/06-dom-contract.md:69` | `recognise` | `recognize` |
| `en/drag/01-layout.md:38`（标题） | `neighbours` | `neighbors` |

交叉核对：`cancelled`（`drag/05-callbacks.md:27,39`、`reference/01-cineview.md:91`）**合规**——该动词双 L 在美式英语中即为标准。`scroll/06-scroll-pitfalls.md:12` 的 `recognizing` 已经正确，这使上述三处 `recognise` 在同一语料内自相矛盾。

**6. 位置指代 —— en 侧 4 处（zh 侧同位置已修）**

| 位置 | 现状 | zh 对应行 | 目标标题是否存在 |
| --- | --- | --- | --- |
| `en/reference/10-types.md:72` | `See the error codes section above` | 已具名「见「错误码」小节」 | 是，`## Error codes` @ `:34` |
| `en/reference/09-use-animate-timeline.md:51` | `the canvas pattern below` | 已具名「「canvas 自绘」一节」 | 是，`## Canvas self-drawing` @ `:62` |
| `en/reference/09-use-animate-timeline.md:64` | `The snippet below applies…` + `as described above`（一句两处） | 第二处已具名 | 是 |
| `en/reference/05-position.md:33` | `centered on the viewport (next section)` | 已具名「（见「居中锚点」小节）」 | 是，`## Centering anchors` @ `:38` |

建议分别改为 `See "Error codes"` / `the "Canvas self-drawing" pattern` / `The pattern in this section applies…` + `as described in "phase is permanently idle on the scroll takeover lane"` / `(see "Centering anchors")`。

**7. `en/reference/01-cineview.md:132` — 漏词（改变句意）**

> skip it and **the frame** applies its default fallback

应为 `the framework`。zh:132 是「不调就走**框架**默认回退」。

### Nice-to-have

- **`en/concepts/06-dom-contract.md:105`** — `(see the two caveats that close this section)` 属小节相对引用而非具名。zh:105 同形（「见本节末注意事项」），至少双语对称，且引用目标就在同 block 下方 8 行。比上面 4 条弱，但同类。
- **`en/drag/02-gestures.md:28`** — `(see the selector list that follows)`；zh:28 已用具名形式「见「交互元素自动豁免」」，指向真实的 `### Interactive elements are exempt automatically`。en 侧同文件 `:19` 本来就是这么写的，应对齐。
- **`en/drag/01-layout.md:52`** — `listed under "Styles the framework hardcodes"` 是**正确的具名引用**（标题存在于 `:21`），只是措辞带 "listed under"。无需改，列出仅为避免你误判为位置指代。
- **Oxford comma —— en 侧 22 处缺失。** 代表性位置：`advanced/01-performance.md:41`（`your application code, third-party libraries and CSS`）、`:93`（`rules, thresholds and ffmpeg command`）、`getting-started/01-introduction.md:6`（一行两处：`scenes, animations and a design width`；`transitions, timelines and responsive scaling`）、`drag/01-layout.md:42`（`Subscriptions, timers and videos`）、`:54`、`drag/04-ownership.md:17`（`taps, link clicks and text selection`）、`:40`、`getting-started/04-choosing-mode.md:16`、`concepts/02-timeline.md:37`（标题 `delay, waitFor and phase ranges`）、`reference/07-container.md:35`、`concepts/06-dom-contract.md:69`、`scroll/05-scrollbar.md:26`、`:75`。规则说三项以上"always"，故严格都算命中；归 nice-to-have 是因为整齐且纯外观。zh 侧豁免。
- **Contraction 混用（en）** — 21 处缩写（`doesn't` ×8、`don't` ×4、`it's`、`isn't` ×2、`haven't` ×2、`you're`、`you'll`、`won't`、`didn't`、`can't`）对 209 处拼写全形（`do not` / `does not` / `cannot` / `is not`…）。Elastic 允许缩写但禁止同语境混用拼写全形，而多个文件恰好如此。`advanced/07-common-pitfalls.md` 最严重（56 行里 7 处缩写，同时 `:46` 又写 `does not scrub`）。建议按页统一语域。
- **列表首字母小写** — `en/advanced/01-performance.md:73-74`（两项均小写起头且以 `;` / `.` 结尾）；`en/advanced/06-media-ownership.md:60-62`（`the prop is true;` / `the current approach band is far;`）。语料内其余列表一律大写起头。
- **`whitelist`（en 4 处）** — 均指框架自有的属性白名单机制（`the 10-property whitelist`、`converted by a key whitelist`），是既有代码概念而非作者新造词；改成 `allowlist` 会与源码脱钩。标为你的裁决项，未计入违规。

### 已核验且干净

- **粗体用量** — 密度最高的 `scroll/06-scroll-pitfalls.md` 为 33 处 / 83 行，但全部是结构性标签（`**Symptom**` / `**Root cause**` / `**Fix**`）加必须知道的结论（`**Fragments are not flattened**`、`**do not take it as evidence the zone works**`）。本站无 UI 元素，未发现装饰性粗体。zh 与 en 每个文件的粗体计数 1:1 相同。
- **段落长度** — 最长 636 显示列（`en/advanced/04-direction-x.md:31`），典型文档宽度下约 5 行。零超 7 行。
- **引号用法** — 用于引述指引、首次出现的不熟悉术语（`"Ready"`、`"Cannot"`）、具名交叉引用。无引号作强调、无引号包代码（代码一律 backtick）、无引号包产品名。`advanced/01-performance.md:37` 与 `advanced/06-media-ownership.md:22` 的逗号/句号在引号内，正确。
- **UI writing 整章不适用** — 全站无按钮/标签页/菜单/输入框/开关/图标/导航指引；`click`/`select` 在 UI 义上均未出现，故无误用可能。
- **数字规则** — 「1–9 在正文写成单词」已满足；12 处 grep 命中全是技术数值（`progress 1`、`6 samples`、`scene 3`、`1 viewport`、`3×3 anchor grid`），按规则应用数字。
- **Avoid 词表** — 无 `abort`(动词)、`blacklist`、`choose`、`execute`(动词)、`hack`、`launch`、`please`、`terminate`、`type`(动词)、`utilize`、`boot`；`invalid` 仅作错误码标识符 `INVALID_ANIMATION` 出现；`could` 1 处虚拟语气，可接受。
- **轻慢词** — 双语皆干净。`just` / `simply` 的命中全是非轻慢义（`the element just pops out of existence` = 描述性「就这么消失」；`it usually just means it is still in flight` = 「仅仅」）。zh 的「只要」/「只需」全部是逻辑条件（"only if"），不是「这很容易」。

---

## 具名交叉引用核验（位置指代替代方案）

24 条全部命中同页真实标题，**零悬空**：

```
OK  en/advanced/03-callbacks.md:18            -> "onError and error codes"
OK  en/advanced/02-preload.md:13              -> "Imperative: ref.preload()"
OK  en/scroll/05-scrollbar.md:30              -> "Only an object enables it"
OK  en/scroll/05-scrollbar.md:37              -> "autoHide timing"
OK  en/scroll/01-centerlock.md:68             -> "Programmatic navigation"
OK  en/getting-started/02-installation.md:44  -> "The per-mode entries have only a require condition"
OK  en/drag/02-gestures.md:19                 -> "Interactive elements are exempt automatically"
OK  en/reference/01-cineview.md:19            -> "Callbacks"
OK  en/reference/01-cineview.md:81            -> "Error codes"
OK  en/reference/04-animate-video.md:33       -> "Keyframe encoding is a hard constraint"
OK  en/reference/07-container.md:30           -> "Common mistakes"
OK  en/reference/03-animate.md:30             -> "sceneControlled resolution"
OK  en/reference/03-animate.md:37             -> "stagger reveal"
OK  en/reference/03-animate.md:38             -> "enterRef / exitRef manual triggers"
OK  zh/advanced/03-callbacks.md:18            -> "onError 与错误码"
OK  zh/advanced/02-preload.md:13              -> "命令式：ref.preload()"
OK  zh/getting-started/02-installation.md:44  -> "按模式入口只有 require 条件"
OK  zh/reference/04-animate-video.md:33       -> "关键帧编码是硬约束"
OK  zh/reference/01-cineview.md:81            -> "错误码"
OK  zh/reference/07-container.md:30           -> "常见误用"
OK  zh/reference/03-animate.md:30             -> "sceneControlled 裁决表"
OK  zh/reference/03-animate.md:37             -> "stagger 错峰揭示"
OK  zh/reference/03-animate.md:38             -> "enterRef / exitRef 手动触发"
OK  zh/reference/05-position.md:33            -> "居中锚点"
```

同时核验：`/docs/*` 跨页链接 0 死链（40 slug 全解析）；zh/en 40 文件全部配对，各文件标题数完全一致，eyebrow 值完全一致。

---

## 术语一致性

双语配对整体优秀（40/40 配对、逐文件标题数一致、eyebrow 一致、粗体计数一致）。发现的漂移：

1. **`换算尺` vs `换算基准`**（zh，1 处）— 见 must-fix 1。对 20+ 处 `换算基准` 的单点离群。
2. **`render track` vs `render lane`**（en，`drag/03-two-track.md:12,16`）— 表格行写 `render track \`renderProgress\``、其 writer 列写 `render lane`，`:16` 又写 `The **render track** drives…`。同页对同一物两个名词。全 en 范围 `render lane` 4 处 vs `render track` 2 处，`element track` 8 处 vs `element lane` 2 处（`drag/01-layout.md:61`、`drag/05-callbacks.md:18`）。zh 侧稳定为 `render 轨` / `element 轨`。建议 en 每条轨定一个名词。
3. **`page-movement lane` / `movement lane`**（en，`drag/05-callbacks.md:16,18`、`drag/04-ownership.md:65`、`drag/01-layout.md:61`）— render track 的第三个名字。zh 一律「位移轨」，对不上 en 的 "render" 也对不上 "movement"。三个 en 名 → 一个 zh 名。
4. **`元素轨` vs `element 轨`**（zh）— 10 vs 8 处，且在 `drag/03-two-track.md:13` 同一表格行内两种并用（`element 轨 \`elementElapsedMotion\`` / 「该 Scene 自己的元素轨 hook」）。纯外观但可见。
5. **`crash sites` vs `failures`**（en）— `scroll/06-scroll-pitfalls.md:6` 用 `crash sites`，而 `drag/06-drag-pitfalls.md:6` 用 `failures`、`advanced/07-common-pitfalls.md:6` 用 `failure modes`；三个 zh counterpart 都是「故障」。已并入比喻章节。
6. **`design base` vs `conversion base`**（en，`reference/01-cineview.md:28`）— `it is the design base` 对 21 处 `conversion base`。zh:28 是「设计稿基准」，属有意区分的另一概念（`config.size` 是设计稿宽度，换算基准由它派生），**可能是故意的，请确认意图**。
7. **受众名词**（en）— `the audience` ×6、`the viewer` ×5、`the user` ×7、`the reader` ×1（`scroll/03-inputs.md:82`，zh:82 是「用户」）。同一个人四种叫法。zh 也分裂（观众 ×11 / 用户 ×15）但逐行与 en 对应。孤例 `the reader` 最明显。

---

## 附带发现（非风格问题：事实性矛盾）

`en/reference/01-cineview.md:78` 与 `zh/reference/01-cineview.md:78` 都写 `onLoadProgress` 是 **`0-1`**，而两语各有五处明确相反：

- `en/advanced/03-callbacks.md:15` — `an **integer from 0 to 100** (not 0 to 1)`
- `en/advanced/02-preload.md:6`、`:77`、`:84`
- `en/drag/05-callbacks.md:63`
- `en/drag/04-ownership.md:36`

且 preload 页给了源码依据（`Math.round((loaded / total) * 100)`，`useImagePreloader.ts:216-222`）。**reference 表在两语都错。** 同行下方 `:99` 的 `Zone progress 0-1` 对 `onZoneProgress` 是正确的（`progressPx / totalBudgetPx`），看起来是 `0-1` 被往上串了一行。集成方查的就是 reference 页，值得修。

---

## 必修项清单

1. `zh/advanced/04-direction-x.md:33` — `换算尺` ×2 → `换算基准`（比喻残留 + 术语漂移）
2. `en/reference/03-animate.md:168` — 删除 `("bundled rollback")`（比喻残留）
3. `zh/advanced/07-common-pitfalls.md:52,54` — 「啪」的一整帧收摊 / 打包收摊 → 平实描述（比喻残留）
4. `en/concepts/01-modes.md:2` — `Dual-Mode Engines` → `Dual-mode engines`（sentence-case；40 页中唯一 Title Case）
5. 英式拼写 ×4 — `serialisation`、`recognised`、`recognise`、`neighbours`
6. en 侧位置指代 ×4（zh 同位置已修）— `en/reference/10-types.md:72`、`en/reference/09-use-animate-timeline.md:51`、`:64`、`en/reference/05-position.md:33`
7. `en/reference/01-cineview.md:132` — `the frame applies` → `the framework applies`（漏词）

Nice-to-have：上列 11 条较弱比喻；en 侧 22 处 Oxford comma；contraction 语域混用（21 vs 209）；两处小写列表；`crash sites` / `the reader` / `render track` 三项术语漂移；`en/concepts/06-dom-contract.md:105` 与 `en/drag/02-gestures.md:28` 的小节相对引用。

另建议修 `{en,zh}/reference/01-cineview.md:78` 的 `onLoadProgress` `0-1` 错误——超出风格审查范围，但它与五处引了源码行号的页面矛盾。
