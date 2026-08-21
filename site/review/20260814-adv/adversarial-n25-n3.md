# 对抗复审报告：N2.5（act5 标题退场迁移）+ N3（样式 19 项）

- 复审 agent：独立对抗复审（只读 + 真机探针，不改码）
- 日期：2026-08-15
- 对象：working tree 未提交 site 改动（`git diff HEAD -- site/src/`）
- 探针（本复审自制，非实现者探针；全部只读）：
  - `site/scripts/_rv-20260815-adv-layout.mjs` → `site/review/20260814-adv/adv-layout.raw.json`（10 组 视口×语言 全幕走查；截图 `site/scripts/shots-n25n3/`）
  - `site/scripts/_rv-20260815-adv-race.mjs` → `adv-race.raw.json`（B2 finished↔unfinished 快速交替 6 轮）
  - `site/scripts/_rv-20260815-adv-race2.mjs` → `adv-race2.raw.json`（B1' 空拍量化 / B3' freeze 滚回轨迹）
  - `site/scripts/_rv-20260815-adv-followup.mjs` → `adv-followup.raw.json`（D1 齿孔渐变 / D2 裁切命中 / D3 分栏复测 / D4 glow / D5）
  - `site/scripts/_rv-20260815-adv-focus.mjs` → `adv-focus.raw.json`（E1 act4 scrim 中段 / E2 iframe 通道诊断）
  - `site/scripts/_rv-20260815-adv-1280.mjs`（F：1280 慢拖分栏 + 越界量化，stdout 已录于本报告）
- 环境：`localhost:4000` dev server；dist 2026-08-13 05:41 含 manual-control 特性（晚于 `Animate.tsx` 05:26 修改），link:../ 消费有效；site `tsc --noEmit` 0 错误。

## 总判定：PASS-with-notes

两摊改动的**主体行为正确**：N2.5 迁移在全部七维度上按方案落地（镜像退场真实执行、last-message-wins 竞态防御有效、空拍 ~80ms 不可感知、console 零框架告警、零每帧热路径新增）；N3 的 19 项中 18 项实测生效。以下 3 条需要跟进（均给出实证与 file:line），其中 #1 是 N2.5 引入的边界回归、#2 是 N3 一项未生效、#3 是审计范围内的存量缺陷（非本 diff 引入，但 C10 注释假设已被实测推翻，必须登记）。

| # | 严重度 | 归属 | 摘要 |
| - | ------ | ---- | ---- |
| 1 | P2 | **N2.5 引入** | freeze 700/1400ms 定时器不因重进视口取消——滚出后 <1.4s 滚回，iframe 在画面可见时被卸 |
| 2 | P3 | **N3 未生效** | hero hint zh 字距 0.10em 覆写选择器落空（死码，zh 实测仍 0.16em） |
| 3 | P1（存量） | 审计范围 | act5 zh 标题在 900–1440+ 整个横排档被列右缘裁切（1440 裁 18.8px / 1280 裁 65.5px，命中测试实锤） |

---

## 逐维度判定与证据

### 维度 1 排版超出 — REFUTED（缺陷 1 处 = 清单 #3；其余全部过关）

**R1-1（P1，存量）act5 zh 标题被 text-col 右缘裁切**
- 实测（adv-layout zh-1440 + probe D2 + probe F 1280）：
  | 视口 | 列宽 (min(420u,34vw)) | 标题自然宽（nowrap, 46px, ls 0.06em） | 越界 | 命中测试（col.right+8px 处） |
  |---|---|---|---|---|
  | 1440×900 | 420.0 | 438.8（`两种模式，一套体系` 9 全角字） | **18.8px** | `phone-slot`（≠title-text ⇒ 裁切带不可命中） |
  | 1280×720 | 373.3 | 438.8（字号 clamp 顶格 46px 不随列缩） | **65.5px** | `phone-slot` |
  | 2560×1080 | 746.7 | 438.8 | 0（无裁） | —（titleClippedByCol:false） |
- 机制：`.scene5-cinema__text-col` 显式 `min-width:0` + `overflow:hidden`（Scene5Cinema.css:168-181）钉死列宽，`<p>` nowrap 自然宽越界即裁。Scene5Cinema.css:309（C10 注释）「zh 全角字少、够窄能放下」对现行 9 字文案不成立（439>420），该注释同时自我矛盾——同注释上文 N10 实测 zh 567px@46px 时就断言「裁不到」，依据的撑开机制已被 `min-width:0` 关闭（C10 自己写明）。字号是 px clamp、列是 unit 缩放 ⇒ 1227–1440+ 档字号 46 顶格而列持续收窄，越界单调增大；<900 纵排回退后列 88vw、字号 clamp 下调，不再裁（390 实测 titleClippedByCol:false）。
- **归属判定**：`git show HEAD` 核对——HEAD 同文案、同 basis、同 overflow:hidden、`<p>` 为列直接 flex item（shrink-to-fit 几何与迁移后包装层等价）⇒ 裁切在 HEAD 已存在，N2.5/N3 未引入也未加重。但本复审对象包含 act5 排版维度，必须登记。（en 不受影响：`white-space:normal` 折行进列宽，1440 实测 2 行 balance、宽恰 420。）
- 修法方向（供参考，未改码）：zh 列 basis 提至 ≥ 标题自然宽（如 `min(calc(460 * var(--cineview-unit)), 40vw)`）或字号上限与列宽联动（`min(46px, calc(列宽/9.6))`）。

**过关项**：
- **act4 scrim**（E1，adv-focus）：正片中段 rect=(0,0,1440,900)、`coversViewport:true`；派生渐变停靠 0/20/42/58/80/100% 合法，`--bg-grad-bot` 派生色全部解析为 `color(srgb …)` 无 color-mix 字面量残留。
- **act2 齿孔渐变**（D1）：`.film-track__perf` 三层 computed：流光 `transparent −26% → color(srgb .905 .758 .679) @--film-flow → transparent +26%`（accent #d38f6a 混白 45% ✓）、基底 `rgb(211,143,106) → color(srgb .712 .482 .357)`（accent→black14% ✓）；停靠单调合法、`hasColorMixLiteral:false`。（注：adv-layout 首测采 `.film-track` 本体得 "none" 是探针采样错元素——渐变在 `__perf` 上，非缺陷。）
- 视口溢出：五幕 zh/en 全档 `overflowViewport` 全负；act4 en 副标题行 right=1358<1440 ✓；act2 标题块 right=960/1057 居中列内 ✓。

### 维度 2 换行 — REFUTED（缺陷 1 处 = 清单 #2）

**R2-1（P3，N3 项未生效）hero hint zh 字距 0.10em 覆写是死码**
- 实测：adv-layout zh 与 en 的 `hintLS` 均为 **1.92px**（12px 字号 → 0.16em），zh/en 无差别 ⇒ 覆写未生效。
- 根因：global.css:406-409 选择器 `[data-lang='zh'] .hero__scroll-hint` / `.hero__scroll-hint[data-lang='zh']`——`<span class="hero__scroll-hint mono">`（HeroScene.tsx:319）自身无 `data-lang`，祖先链（Position wrapper→hero__stack→scene）也无人携带。站内 `data-lang` 挂点分布在 `.hero__slogan`/`.hero__intro`/`.demo-video`/`.scene5-cinema` 各自根，hint 不在其中。
- 影响：N3 清单 act1-4 项未落地；视觉无破坏（zh 行宽 148px 远小于视口）。修法一行：hint 加 `data-lang={lang}` 或选择器改挂 `:root[lang]`。
- 对照组证明其余 lang 覆写机制正常：act2 em zh normal/600 vs en italic/500 ✓、act4 tail 同 ✓、act5 title-text zh nowrap vs en normal ✓（均为实测）。

**过关项**：
- act5 en 标题两行 balance（1440：2×54.3 高、宽 420 贴列）✓；2560 单行 566.7<746 ✓。
- act2 cap-title em 去斜体 + 600 字重生效，行宽 214.5px、标题块居中列内无换行压力。
- act4 退场 blur（SUBTITLE_BLUR_EXIT 0.42vw）只动 filter 不动盒模型——行宽实测无回归。
- hero intro zh/en rect 正常（635.9×81.6）。

### 维度 3 层级 — CONFIRMED

- 迁移新增的两个 Animate 包装层静止态 `transform:"none"`、`z-index:auto`（10 组采样）——不新建层叠上下文；tween 中的 transform 矩阵（y:16 回位）也只影响自身位移。标题/副标题互为兄弟、绘制序=DOM 序，无交错需求。
- 命中测试：分栏态 `elementFromPoint(标题中心)` 全数返回 `scene5-cinema__title-text`（zh/en × 1440/2560/390）——手机 glow（phone-col 分支）、星光（z:2）、overlay（z:1）均不盖标题；stage 层（z:3）内部的两个分支按 DOM 序绘制正确。
- 未新增 z-index 声明（Scene5Cinema.tsx 全文无 zIndex）——memory `zindex-dead-under-transform-ancestor` 场景零新增。

### 维度 4 被遮挡 — CONFIRMED

- **390×844（zh/en）**：纵排回退生效——col 343.2px（88vw）、标题 248px 单行居中、副标题 233×49.6 两行、`titleClippedByCol:false`、`elementFromPoint=title-text`。**ISSUE-D 修复未被迁移破坏**。
- **880×700**：纵排档几何同 390（列放开 88vw/46ch），无裁切证据。
- **1280×720**：分栏可达性初测失败为**探针手势伪影**（18 步快拖被子页 drag-cancel 吞）——E2 慢拖单次即推进子页场景并收到 `cineview-embed-unfinished`，F 探针全慢拖 12 轮内到达 `finished`、分栏成立（isSplit:true）。产品无此缺陷；除 R1-1 裁切外无互遮。
- 分栏态 text-col 高度余量充足（zh@1440 列高 136.9 vs 可用高 810+），副标题被标题折行推下时靠 gap 排距（C10 机制），迁移未触碰。

### 维度 5 视觉 — CONFIRMED（附 1 note）

- **首屏奶白桃**：`.bg-ribbon` computed `linear-gradient(rgb(252,237,228), rgb(250,248,244))` = **#fcede4/#faf8f4** ✓（zh/en 一致）；`--accent` #d59273 = LUT[0] accent ✓。
- **accent 派生同族性**（各幕实测）：
  - act2（accent≈#d38f6a）：三圆点 accent / +white18% / +black12% 同 hue 阶梯 ✓；分隔线 accent-ink 50% ✓；齿孔流光+基底派生 ✓（见维度 1）。
  - act3（accent #c5884b）：stagger bar `rgb(197,136,75)→accent 35%` ✓；chain dot glow accent 45% ✓；panel 底板 = bg-grad-top #f5d5ab 混白 74% = `color(srgb .990 .957 .914)` ✓ 随 ribbon 流动。
  - act4（accent #aa7442）：scrim 与 title text-shadow 同源自 `--bg-grad-bot`，解析同串 `color(srgb .969 .906 .851 /…)` ✓。
- **数值项**：act3 投影第二层 `rgba(26,24,20,0.1) 0 16.5px 48px`（=0.10/3.2em@15px）✓；代码脚竖线 accent 70% ✓；act4 zh 伪斜体→600 ✓；act2 em 同语汇 ✓；act5 text-shadow 14px/0.20（css 直读 ✓）；**glow 峰值实测 `rgba(225,164,91,0.318) 15.87px/3.97px`** ≈ 0.32 封顶（12+4·breathe / 3+1·breathe @breathe≈1），谷值 0.2/12px/3px ✓——收窄到位，星光（逐星 alpha 峰值高但面积极小）重新成为高亮点，附截图留档（`shots-n25n3/`）供肉眼终审。
- **Note-1（P3）**：tokens.css:30 静态回退 `--bg-grad-top:#faf0df` 与新 LUT[0] #fcede4 不同步（ribbon 写入前首帧 + /docs 等无容器页仍暖象牙）。1-2 lum 档差异，建议同步。

### 维度 6 框架能力 — CONFIRMED（缺陷 1 处 = 清单 #1）

- **ref 认领正确**：10 组 boot × 全幕走查 + 4 组竞态脚本，console **零** `ignores enterRef/exitRef`、零 error/warning（Animate.tsx:440 `manualControlLane = scroll && !scrubLane` 判定通过，`sceneControlled:false` 生效）。
- **镜像退场真实执行**（B1'）：反向 commit 后副标题 ~339ms 起步 / ~761ms 退净，标题 ~592ms 起步 / ~1178ms 退净——非对称错峰（副 0ms、标题 250ms）按设计播放，opacity 连续过渡（中间值 0.98→0→0.34…），非硬切。
- **空拍量化（950ms vs 1.1s 质询）**：双文字净空（tO≤0.05 且 sO≤0.05）且列仍展开的窗口实测 **~80ms**（1 个 80ms 采样格），其后 1.1s 收列期间手机同步回中——不构成可感知空拍，**可接受**。
- **last-message-wins**（B2）：finished↔unfinished 连续 6 轮交替，每轮终态正确（fwd→split true / rev→split false + 双 0），3.2s 静置终态 `isSplit:true, tO:1, sO:1`——`splitTimersRef` 先清后挂的防御有效，无旧 timeout 迟到污染、无卡死。
- **freeze 三级串行**（B3/B3'）：退净→收列→卸手机次序可辨（iframe 卸载与收列不同帧）。
- **R6-1（P2，N2.5 引入）freeze 定时器不因重进取消**：
  - 代码：`Scene5Cinema.tsx:436-457` IO 回调仅处理 `!isIntersecting`（`isIntersecting=true` 直接 return），重进视口**不清** 700/1400ms pending 定时器。
  - 轨迹（B3'，真实滚轮）：滚出 act5 后 ~892ms 滚回（sceneVisible=true），iframe 于 dt 975–1132 被卸、观察 2.4s 未复挂（无进一步滚动则无 progress change 事件触发重挂）。
  - 归属：HEAD 的 freeze 是**瞬时清理**（`git show HEAD`：IO 回调内直接 reset + setSplit(false)，无定时器），1.4s 挂起窗为本轮三级串行新引入。实害条件：滚出后 <1.4s 滚回且重进时 progress 已 ≥0.4（手机本应可见却被卸，需再滚动一次才恢复）；恢复路径存在（任何后续滚动使 progress 穿越 0.4/0.7 即重挂+重握手）。
  - D5 的程序化 scrollTop 直跳「未复现」**无效不作数**——大跳被框架防跳过钳位钳回段内，freeze IO 根本未触发（memory `scroll-zone-probe-technique`），非竞态反证。
  - 修法方向：IO 回调对 `isIntersecting=true` 分支 `clearSplitTimers()` 并按当前 stage 重排（或定时器触发前复核可见性）。

### 维度 7 性能热路径 — CONFIRMED

- 新增路径全部**事件驱动**：`runSplitEnter`/`runSplitTextExit`/消息 handler/IO 回调均为一次性 setState + setTimeout；无 rAF、无每帧 setState、无 MotionValue 轮询、无 layout 读写交替。`splitTimersRef` 小常数数组。
- 卸载清理存在：`useEffect(() => clearSplitTimers, [clearSplitTimers])`（Scene5Cinema.tsx:324）统一清 pending timeout（含 freeze 700/1400ms）——组件卸载无定时器泄漏（静态审查 + 全程 console 零报错佐证）。
- 站点侧未 import framer-motion、未自建驱动（Scene5Cinema.tsx import 仅 `cineview` 出口）——守规则 6。CinemaLatchProjection 的 progress 订阅为存量结构，本轮未动、未加重。

## 验收建议

1. 清单 #1（R6-1）：N2.5 节点 2.5b 对抗门建议**有条件通过**——补 IO 重进分支清定时器 + 一个「1.4s 内出→进」回归探针后收口。
2. 清单 #2（R2-1）：N3 节点 3c 补一行修法后重跑 `_rv-20260814-style-verify` 断言（其 hintLetterSpacing 断言现应抓 zh=0.16em——实现者探针未断言 zh 差异，属探针盲区）。
3. 清单 #3（R1-1）：非本 diff 引入，但位于 N3 审计清单 act5 维度且 C10 注释假设被推翻——建议单列 task-flow 修列宽/字号联动（1280 档裁 65px 已达用户可感知级）。
4. Note-1：tokens.css 回退色同步 LUT[0]。
