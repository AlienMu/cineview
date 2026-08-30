# 2026-08-28 API 命名与结构重设计（Breaking）

方案全文（12 条决策 + 9 条对抗复审结论 + 改动面）在 plan 文件：
`/Users/alienmu/.kimi-code/sessions/wd_cineview_fc6b64879275/session_8545f8c6-9dc7-48e7-810f-09236d424c2e/agents/main/plans/wildcat-plastic-man-mister-terrific.md`

用户 2026-08-28 确认开工（语境回复「改了名字后 infiniteAnimation 这些在文档内也并未更新？」理解为批准执行）。

## 决策摘要（详见 plan）

1. 拆 `config`/`modes`/`performance` 壳，字段平铺 `CineViewProps` 根级 + mode 判别联合；`config.size`→`designWidth`；`performance.monitor`→`monitor`
2. `timeline.waitFor`→`after`；`timeline.sceneControlled`→`driver:'scene'|'clock'`；内部占用的 driver（drag/scroll/visibility 通道义）→整合改名 `lane`
3. `visibility.replayOnReenter`→`visibility.replay: boolean`（语义反转后为正句：默认 true）
4. `infiniteAnimation`→`loopAnimation`
5. `Position.layer`→直出 `fixed`；`Scene.stack`→并入 `layout.overlap`/`layout.zIndex`
6. `onSceneWillChange`→`onSceneEnter`、`onSceneDidChange`→`onSceneLeave`、`onDragCommit`→`onDragEnd`、`DragCommitDetail`→`DragEndDetail`
7. `getCurrentScene()`→`getCurrentIndex()`；`NO_SCENES`→`EMPTY_SCENES`

## 陷阱（复审结论，plan 有全文）

- 测试里的 RTL `waitFor` 不可误伤；三处诊断文案被 stringContaining 断言；
  `resolveRootSceneStackMode` 有两份（CineView.tsx + directScrollHelpers.ts）；
  site 契约测试做 AST 属性名比对；内部 positional onDragCommit(Scene/types.ts:212) 一并改；
  dist 由 build 重生成不手改；task-flows//site/review 档案不动

## 节点

- [x] R1 类型层重写（types/index.ts 判别联合 + 全部改名 + barrel）→ tsc 全红=消费点清单
- [x] R2 归一化/注册/Animate 链 + Position/Scene + 两引擎 + context 全绿（1594 tests 通过）
- [x] R3 文案门：examples（minimal/performance-test）— agent-15 完成，tsc + vitest 24 绿
- [x] R4 site 消费组件 + 契约测试（tsc 0 错、site 61 绿；CSS 注释残留清完）
- [x] R5 DESIGN.md/AGENTS.md/CLAUDE.md/README + docs 双语（sceneControlled→driver、stack→layout.overlap/zIndex、layer→fixed）、迁移对照表入 01-cineview 双语
- [x] R6 探针加 BANNED_PROPS 源码段（迁移表用 banned-names 标记豁免）+ prettier + lint + 全量 1594 绿 + build:verify 通过（UMD 43.7/48.9KB）
- [x] R7 真机浏览器验收（site/scripts/r7-api-redesign-acceptance.mjs @ localhost:4003，7/7 PASS、0 console issue）：
  drag 翻页（onSceneLeave/onDragEnd 新名回调全触发）前进/反向/blocked/cancel 全通；scroll 锁定区容器正反向滚动（0→4800→40）；首页 32780px 全程滚动。
  注：两轮脚本修正非框架 bug —— ①scene1 朝 disabled scene 拖拽语义就是 blocked；②scroll 模式滚动容器是 `.cineview-container` 而非 window。
