# 2026-08-27 N8 未竟整改 + 「编排 → 时间线」全量改名

接续会话 9ff01852（因上下文耗尽中断）。两个来源的工作合并执行：

## 工作 A：N8（第四轮独立复审，`site/review/20260827-docs-style/fourth-review.md`）未完整改

磁盘现状核查（本会话）：

- 已闭合：V-1 `invalid`、V-3 `hit` 动词、V-13 `trapped`、V-4 eyebrow（13 页已统一为组前缀）、
  V-2 的 `will`（0 命中）、V-8 的 en 侧展开（LRU/CDN/ESM 已做，LRU 冗余句已由上会话修好）
- **未闭合**：
  - V-2 `would`/`should` 16 处（清单见复审报告 §V-2）
  - V-14 Oxford comma 4 处（`concepts/06-dom-contract.md:69`、`drag/05-callbacks.md:43`、`drag/06-drag-pitfalls.md:46`、`scroll/05-scrollbar.md:26`）
  - V-15 引号强调/枚举值 4 处（`reference/09-use-animate-timeline.md:25`、`concepts/04-orchestration.md:113`、`concepts/07-runtime-states.md:19`、`scroll/03-inputs.md:27`）
  - V-8 zh 侧首用展开：`LRU`/`CDN`（`zh/advanced/02-preload.md:69,73`）、`rAF`（`zh/advanced/01-performance.md:45`、`zh/scroll/06-scroll-pitfalls.md:26`）、`ESM`/`CJS`/`UMD`（`zh/getting-started/02-installation.md:40,44`）；en 侧 `rAF` 两页同补
  - V-12 `Note that` 1 处（en/concepts/04-orchestration.md:110），顺手修（nice-to-have 中成本最低的）
- 保持现状不改（记录决策）：N-1 链接文案多写、N-3 长句连接词、V-5 裸围栏、V-6 缩进、V-9 缩写混用、V-16 占位符写法——nice-to-have 中需动结构的一批，属独立整改轮，不因本轮顺手动。

## 工作 B：「编排 → 时间线」全量改名（用户裁决）

用户要求：把「编排」等词汇改成「时间线」。范围 = 用户可见面：docs 双语（zh 36 处 / en `orchestrat*`+`choreography` 19 行）+ site i18n（zh 5 键 + en 对应键）。

- zh：`编排` 名词 → `时间线`；动词用法改写为「排时间线 / 排布」等直述（逐行处理，不做全局替换）
- en：`orchestration`/`choreography` → `timeline` 系表述
- 页面：`{zh,en}/concepts/04-orchestration.md` 标题 `编排/Orchestration` → `时间线/Timeline`，eyebrow `CONCEPTS / ORCHESTRATION` → `CONCEPTS / TIMELINE`；**slug 不变**（`/docs/04-orchestration` 保留，外链/重定向不受影响）
- i18n：`hero.intro`/`idea.title`/`idea.body`/`cap.shot1.slate`(`SCENE ORCHESTRATION`→`SCENE TIMELINE`)/`cap.shot3.card.chain.label`/`demoDrag.s2.eyebrow`/`caps.3.title` 双语同步
- zh 已有的「时间轴」（02-timeline 页的单元素概念）保留不动；与「时间线」（多元素先后）并存，两个概念页内容各自说清
- **不改**：DESIGN.md / AGENTS.md / CLAUDE.md / 源码注释 / task-flows 里的 `编排`——内部规格与注释层，同前轮「DESIGN.md 单独立项」先例（`2026-08-27-docs-deametaphor.md` §待你裁决）

## 门

- [x] N8 剩余整改落盘
- [x] 改名落盘 + zh/en 同名同处 1:1
- [x] 探针加固：`编排`/`orchestration`/`choreography` 进漂移词表；`\b(will|would|should)\b` 进 en 检查词表；加宽后变异验证（注入必 FAIL）
- [x] `prettier --check site/src/content/docs/**` 全绿
- [x] `tsc -p site/tsconfig.json` 0 错误；`src/__tests__/site` 61/61
- [x] 真机探针 80 页 PASS / console 0（dev server 需先拉起）
- [x] N9：fresh agent 独立复审（禁读 task-flows 与前四轮报告），PASS 或修到 PASS
- [x] 在 `2026-08-27-docs-deametaphor.md` 补记 N8/N9 收口段落
