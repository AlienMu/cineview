# 2026-08-16 ponytail 技能评审（复用性/命名/性能/覆盖率/开箱即用/扩展性 + 双模式多视频多元素帧率）

技能来源：https://github.com/dietrichgebert/ponytail （已安装 `~/.claude/skills/ponytail`、`~/.claude/skills/ponytail-review`）。
评审口径：ponytail-review 五类标签（delete/stdlib/native/yagni/shrink）+ 用户显式要求的维度（复用性、命名、性能、测试覆盖率、开箱即用、扩展性/自定义）+ 真机帧率实测。

## 节点

- [x] N1 安装 ponytail / ponytail-review 技能并读取方法论
- [x] N2 证据收集：coverage（全绿 1474 tests，总覆盖 94.79/90.05/94.73/96.23）/ jscpd（11 clones, 0.83%）/ lint 0 错 / dist 构建通过
- [x] N3 分子系统评审（4 个子 agent 并行 + 主线程抽查复核 6 项关键 findings 全部属实）
- [x] N4 多视频多元素 stress fixture（examples/performance-test/stress/，drag+scroll 两页，3 视频 + 24 元素/zone）
- [x] N5 帧率探针（stress-fps.mjs；两模式 p50=17ms max≤18ms 零 >32ms 长帧；scrub 真实性经 marks/手拖双重实证；发现 scroll 反向无法回收 ended 视频的缺陷）
- [x] N6 独立 agent 对抗校验评审 findings（44 项 → 43 PASS / 1 FAIL：A12「Scene standalone lane 可删」被驳回——ScrollSceneSlot 只注入 sceneRuntime 不注入 dragRuntime，该 lane 在 scroll 模式是活路径）
- [x] N7 汇总报告（含 `net: -N lines possible.` 与帧率数据表）

后续执行：整改方案见 `task-flows/2026-08-16-ponytail-remediation.md`（T1 缺陷修复 → T2 清理 → T3/T6 并行 → T5 热路径 → T4 命名还债）。

## 约束

- 只评审不改码（ponyreview 不 apply fixes）；stress fixture 与探针脚本为新增测量设施，可落盘。
- 帧率结论必须真机（浏览器 lane）实测，不得用单测/静态推断代替（CLAUDE.md 规则 4）。
- 对比度/字号类设计原值不动（A-5 记忆）。
