# 2026-08-24 Docs 全面重构（full revamp）

来源：恢复 2026-08-24 被中断的 Claude Code 会话（grill-me 访谈定稿后的方案执行）。
方案=已批准的计划文件（karnak-deadman-multiple-man.md），决策：Q1=A 内容全推倒重写；Q2=四段旅程式 IA；Q3=B API 完备面+坑前台化；Q5=A 只动排版；Q6=A README 精简版。

## 六条坑核实（已 grep 验证，全部仍存在）
1. takeover scene 内 fixed 需走 scene-scoped fixed layer — Position.tsx:43,52,152-153
2. infiniteAnimation 白名单限制 + shouldRunInfinite 门控 — useAnimateScroll.ts / Animate.tsx:214-351
3. enterRef/exitRef 手动控制语义 — types/index.ts:506-545
4. sceneControlled drag 特殊分支 — types/index.ts:480; Animate.tsx:255,278
5. scroll 预算 1ms=1px — sceneScrollBudget.ts
6. SceneLegacyCompatProps 内部可读（内部整洁，非公共污染） — Scene/types.ts:63,77,96

## 目标 IA（四段，slug 数字前缀定序）

- getting-started/: 01-introduction 02-installation 03-quickstart 04-choosing-mode(新)
- concepts/: 01-modes 02-timeline 03-dual-track 04-responsive 05-fixed-layer 06-orchestration(兼并 waitfor-stagger)
- reference/: 01-cineview 02-scene 03-animate 04-animate-video 05-position 06-image 07-container 08-presets(原 animation/presets) 09-use-animate-timeline 10-types
- advanced/: 01-performance 02-preload 03-callbacks 04-centerlock 05-direction-x 06-scrollbar-theming 07-custom-animation(原 animation/custom) 08-pitfalls(新)

旧 components/+api/ 16 页折叠进 reference 10 页（指南+参考合一）。共 28 页 × 2 语言。

## 节点

- [x] N1 IA 骨架：manifest 组定义 + DocsPage + i18n keys + 文件迁移（git mv）+ 契约测试白名单 + 站内旧 slug 链接（HeroScene/Scene5Cinema）修复；契约测试 4/4 绿、site type-check 绿
- [x] N2 API 事实源核对单 → task-flows/2026-08-24-docs-factsheet.md
- [x] N3 双语逐页重写 28×2（9 个子 agent 并行；全仓 1587 测试绿；子 agent 回读源码纠错：预设实为 43 个、scrollbar/Scene.layout 默认值、zoneId 继承链、Animate 公共类型无 timeline.driver）
- [x] N4 docs-* 排版系统重做：合并重复定义块、删死规则（.docs-section/__intro/__body 零引用）、字阶行高/代码块/表格/导航/TOC/blockquote 全套中性墨；prettier + site build 绿
- [x] N5 humanizer 文案：写入时按该风格执行 + 词库 grep 清尾（赋能/无缝/seamless/delve 等 0 命中）
- [x] N6 README.md 重写（安装 → 最小示例 → 核心概念三条 → docs 链接 → 验证/支持矩阵）
- [x] N7 验收：独立 agent Playwright 实测 localhost:4000/docs：10 项清单 9 PASS + 1 注意项（08-pitfalls 无 blockquote，系该页写法选择，blockquote 样式已在 05-position 页验证）；28 slug 全遍历无 404、无 console 错误；桌面+移动双 viewport 无横向溢出。截图在 output/playwright/docs-acceptance/

## N5b 正式 humanizer 技能润色轮（2026-08-24 追加）

用户指出 N5 是「写入时自觉」而非真正的技能流程，要求拉取正式 humanizer 技能审核后重跑。

- **技能来源与审核**：skills.sh 的 blader/humanizer v2.11.2，缓存在 `/tmp/humanizer-SKILL.md`（会话临时文件）。审核结论：纯写作规范（35 个 AI 文风模式清单 + 标记→改写→两问自查流程 + 事实防护铁律），无可执行命令/网络/文件副作用，安全可用。
- **执行方式**：AgentSwarm 10 批并行（56 个 md + README），首批 3 组完成（getting-started×4、reference 05-07、README），后 7 组遇 403 额度失败、resume 后全部完成。
- **实际命中面**：绝大多数命中集中在 **§14 破折号**（`—`/`——`/en-dash 区间）；35 模式中其余（§7 高频词、§10 三件套、§16 空标签列表、§25 空洞结尾、§27 假揭示、§28 预告腔）命中极少——因为 N3 写入时已按去 AI 腔执行，技能扫描判定大片段落干净，按误报防护未做装饰性改动。附带消灭：§4 销售式标题 1 处（优雅推断）、§15 无谓加粗 3 处、en 文档两处全角括号、两处 frame/framework 用词漂移、zh #9 坑条目《script》→`<script>`。
- **表格占位符统一**：各批次对「无默认值」占位符写法不一（`/`、`-`、无、none、不可恢复），最终统一为 zh`无`/en`none`；advanced/03-callbacks 可恢复性列改为「不可恢复 / No」（语义与其余行对齐）。`advanced/07-custom-animation` 代码块注释内 1 处 `—` 按代码块豁免保留。
- **验证**：全仓 docs 散文区 grep `—|–` 零命中；契约测试 docsContent 4/4 绿（含 heading 锚点唯一性）；各批次均自检表格行列数、代码块、frontmatter、链接目标、数字/API 名/错误码零改动。

## N8 pitfalls 对照源码核实轮（2026-08-25）

用户质疑「坑与排错」页描述的问题部分已被修复。探索 agent 逐条回源码核实 9 条：

- **第 1 条已整条删除**（用户决策：框架侧问题已不存在就不留在坑里）：scroll 是真实原生滚动（`useNativeScrollController` 写 `scrollTop`，场景栈无 transform），裸 `position: fixed` 默认钉视口，原坑整条失效。九条改八条，双语排序相同。- **第 7 条过时已改**：waitFor 无效 id / 回环并非「拒绝挂载」，实为 mount 时静态校验后 `onError` 上报 + dev 警告、无效边被忽略 fail-open（`useSceneAnimationRegistry.ts:219-234`）。
- **第 3 条补斜注**：scrub（zone 接管）车道上 `exitRef`/`enterRef` 会被忽略并警告（`Animate.tsx:470-486`），症状仅存于 visibility 车道与 drag 普通元素。
- **第 9 条补半句**：`cineview/drag`/`cineview/scroll` subpath 仅有 require/UMD 条件（无 `import` 条件，见 `package.json` exports）；安装页同步修正——删掉了「`import` 也可走 subpath」的错误示例。**遗留（待决策）**：`package.json` 是否给 subpath 补 ESM 产物（`"import"` 条件），目前纯 ESM 下按模式裁剪只能靠主入口摇树。
- 第 2/4/5/6/8 条与源码一致，未动。

契约测试 4/4 绿；改后散文区破折号复扫仍零命中。

## 遗留（非阻塞）

- pitfalls 页若希望每条坑配 `>` 引用块，属内容润色可后补（样式已就绪）
- factsheet §4 预设数量写的 41，实为 43（types/index.ts 逐个数过）——文档已按 43 写，factsheet 作为历史档案未回改
- dev server 仍在后台跑（localhost:4000），审核完可停
