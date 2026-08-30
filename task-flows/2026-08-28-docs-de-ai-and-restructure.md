# 2026-08-28 文档去 AI 味重写 + 结构调整（已收口）

## 背景

用户复读文档后判定 AI 味仍严重：术语生造（原子快照/旁路/时间常数/根因/恒为/落点恒为）、
八股小标（症状-根因-正解）、内部实现词外泄（scrub 轨/可见性轨/setPhase 不可达/早退）、
中英夹杂（takeover zone 裸奔）。结构调整：参考 → 组件板块；预设动画、09-use-animate-timeline、
公共类型移入进阶。

## 用户裁决

- 范围：全部 80 页（40 slug × zh/en）全过一遍
- 未决：API 改名（2026-08-28-api-redesign plan）是否开工，未回复，docs 示例届时再同步

## 节点（全部完成）

- [x] N1 重写原则定稿 → `site/src/content/docs/WRITING.md`（句式/术语/禁词/双语对齐）
- [x] N2 探针加 AI_TONE_ZH/EN 词表（旁路/根因/恒为/落点/原子快照/时间常数/正解/收敛/takeover/各轨；en root cause/bypass/lane/hijack/permanently idle 等）
- [x] N3 结构调整：reference→components（manifest/DocsPage/i18n/契约测试四处同步），08-presets/09/10 移入 advanced；eyebrow 全改
- [x] N4-N9 六组双语重写（6 个并行子代理）：禁词清零、锁定区/locked zone 定名、排错页去八股、03-two-track 改题「页面位移与元素时间线 / Page movement and element time」
- [x] N10 全量门：probe 80 页 0 FAIL/0 structural/0 console、契约 6/6、site 61 单测、site tsc、prettier、根仓 1594 tests 全绿
- [x] N11 独立复审（explore agent）→ 3 must-fix 全闭合（见下）

## N11 复审 must-fix 闭合记录

- M1（事实漂移）：components/03-animate 表把 `duration.enter/exit`（实际 600）、`timeline.delay`（0）、`replayOnReenter`（true）写成了默认「无/none」。双语已改回真值；对照 `animateSemantics.ts:66-80`、`types/index.ts:712`。
- M2（重定向表零命中）：`LEGACY_SLUG_MAP` 旧键（`03-dual-track` 等编号 slug）从未在 git HEAD 存在过，纯摆设；真实旧 slug 是扁平的 34 个。已按 `git ls-tree HEAD` 重建映射（api 页合并到同名组件页），注释说明「编号式 slug 从未公开不进表」。
- M3（漏改链接文案）：concepts/01-modes 双语两处 `[双轨模型]/[The two-track model]` → 新页名。

Should-fix 处理：en pitfalls 链接 "keyboard hijacking"→"keyboard interception"，hijack 加进探针词表；zh scroll「钳」统一为「防跳过钳制（clamp）」首次定义后复用；dom-contract 双语散文 takeover 残留清除；03-animate 「场景接管裁决」→「是否由场景驱动它」。

## 遗留（记录，不阻塞）

- en scroll/01 机制名 "center-lock scroll takeover" 保留（WRITING.md 认可的机制名）
- 「接管」作普通动词（原地接管/显式接管退场）保留，仅不再指代 zone
- 探针盲区：「首次出现写 锁定区（locked zone）」格式未做断言（WRITING.md N4 记录）



