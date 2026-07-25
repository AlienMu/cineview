# 2026-07-17 · config.size 单尺子彻底统一（breaking）

## 背景
框架自称「px2vw 单尺子·认宽不认高」，却仍暴露 `config.width` + `config.height`
两个语义割裂的字段：width 是缩放基准，height 表面是「设计稿高度」实则只在 scroll
takeover 的 y 方向 span 换算里当除数（directScrollHelpers.ts:279）。这造成误解，
且与「单尺子」原则言行不一。

用户裁决：取消宽高概念，统一为单一「设计稿尺寸」`config.size`（px，默认 750，
Figma/设计稿通用标准）。方案 A：彻底去掉 height 换算，takeover 数字 span 回退
DOM 实测 / vh，不再有 designHeight 除数。

## 已核实的关键不变量（动手前）
- scroll 主预算 = 时间 1ms=1px（SCROLL_PX_PER_MS，sceneScrollBudget.ts:161），
  与 designWidth/Height 无关 → 改动不碰主预算。
- takeover 滚动行程 = getZoneDistance = totalBudgetPx（时间预算），
  NOT span → 去掉 height 换算不影响滚动行程。
- resolveTakeoverSceneSpan 只喂 visualSpan（sticky 盒渲染尺寸），
  null 时回退 measuredSpan（DOM 实测）→ 去掉 height 分支安全。
- CineViewProvider.designHeight 从不消费 = 死参数。
- vh 分支 (viewportHeight×n)/100 不含 designHeight → 保留。

## 节点
- [x] P0 建 task-flow（本文件）
- [x] P1a types/index.ts：CineViewDesignConfig { width,height } → { size }
- [x] P1b context/CineViewContext.tsx：删 designHeight 参数，designWidth→designSize
- [x] P1c directScrollHelpers.ts：resolveDesignDimensions 返回 { designSize }；resolveTakeoverSceneSpan 去 designWidth/Height 参数 + design 换算分支（number/px 回退实测=null，vh/vw 保留）；resolveSpanValue 去死 direction 参数
- [x] P1d CineView.tsx + DirectScrollCineView.tsx：两调用点、校验、Provider 注入、deps 数组更新
- [x] P1e 测试更新（directScrollHelpers.test 重写 takeover describe；~60 处 config width/height→size；CineViewProvider designWidth/Height→designSize）
- [x] P1f type-check 0 + lint 0（初轮 1131 passed）
- [x] P1g DirectScrollCineView 几何测试按真实 DOM 公式重写：takeover `visualSpan` 回退实测值，`flowSpan = max(visualSpan, viewportSpan) + timelineDistancePx`，`segmentStart = sceneStart + visualSpan/2 - viewportSpan/2`；scrollbar helper 改读原生 offset。新增超高 takeover（1200px 内容 / 900px viewport）回归，覆盖 wrapper padding、shell 锁定与 content 补偿。全量 Jest：83 suites / 1167 tests 全绿。
- [x] P2a Position JSDoc「双轴」→ 单轴（已改）；visibility scaleY 注释（已改）
- [x] P2b DESIGN.md（designWidth→designSize 4 处 + CineViewDesignConfig 仅 size，已核实干净）/ CLAUDE.md（用户/linter 已加 2026-07-17 单尺子条目 L208）
- [x] P2c `pnpm build:verify` 8/8；dist 同步为 `CineViewDesignConfig.size?: number`。ES gzip 47.79 KB，UMD gzip 40.60 KB。
- [x] P3 site / examples 迁移为 `config={{ size: ... }}`；`pnpm --dir site type-check` 与 `pnpm --dir site build` 通过。
- [x] P4 独立 agent 真机验收 scroll（agent `019f768b-599a-7ca1-99cf-3f9f2bb8547e`，`localhost:3000/#/scroll`）PASS：
  - 超高 takeover 第一段：`2440 + (1200-900)/2 = 2590`；2590 shell 锁定且 progress=0，2591 首个 1px progress。
  - 第二段：`5900 + (1200-900)/2 = 6050`；6050 shell 锁定且 progress=0，6051 首个 1px progress。
  - wrapper 使用 border-box padding + content 负向 translate 的视觉补偿未污染真实滚动指标：根 `scrollHeight=10009`，后续 wrapper top 未额外顺延 150px。
  - 反向重锁 `100%→0%`、多 zone 倒序重放、大 flick 防跳过、键盘、自绘 scrollbar 均通过；页面无 warning/error。

## 最终验证

- [x] `pnpm type-check`
- [x] `pnpm lint`
- [x] `pnpm exec jest --runInBand --silent`（83 suites / 1167 tests）
- [x] `pnpm build:verify`（8/8）
- [x] `pnpm --dir site type-check`
- [x] `pnpm --dir site build`
- [x] `git diff --check`

## 节点收口自检

- [x] 整改完成：公共 API、Provider、drag/scroll 根调用点、takeover span 语义、site/examples 与 dist 已统一到 `config.size`。
- [x] 冗余清理：active source/site/examples 无 `designWidth` / `designHeight` / 设计 config `width,height` / 双轴换算残留；`ScrollbarOverlay config.width` 仅表示滚动条厚度，保留。
- [x] 结构可控：未新增公共可选字段或第二套换算工具；takeover 补偿局限在 DirectScrollCineView 渲染几何。
- [x] 热路径性能：未新增每帧 React state、layout 读写或 progress 写者；overflow/sticky inset 只在 render-time 由已测量布局派生，scroll/drag 单一所有者不变量未变。

## 自检要点（每节点收口）
- 全仓 grep 确认 config.height / designHeight / .width 残留清净
- 无死代码 / 半程状态
- scroll 热路径每帧代价不增

## 2026-07-19 正式 CSS 单位变量

用户裁决：CineView 根节点正式提供长度型 `--cineview-unit`。`config.size` 仍是设计基准输入；变量是已经解析的输出，表示“当前 1 个设计 px 对应的 CSS 长度”，外部 CSS 不再自行计算 `viewportWidth / size`。

- [x] P5 增加 Provider CSS unit 回归测试：初始值与 resize 后值均等于 `${scale}px`（实现前红证：Received `""`）
- [x] P6 在 CineView 根 Provider DOM 输出可继承的 `--cineview-unit`
- [x] P7 DESIGN.md 最小记录 size/input 与 unit/output 契约
- [x] P8 context 定向测试 + type-check + lint + build:verify + diff/check
- [x] P9 site 改用正式变量并移除私有 `--cv-u` 公式，site type-check/build 与独立浏览器验收

### P5-P8 验证记录

- 新增测试先红后绿：Provider 初始 `scale=0.5` 输出 `--cineview-unit:0.5px`，resize 到 `scale=0.25` 后更新为 `0.25px`。
- 全量 Jest：83 suites / 1168 tests 全绿；`pnpm type-check`、`pnpm lint`、`pnpm build:verify` 8/8、`git diff --check` 均通过。
- ES gzip 47.82 KB、UMD gzip 40.63 KB；本次只在 resize 驱动的 Provider render 写静态 CSS 变量，不进入 scroll/drag 每帧热路径。
- site 已将 `--cv-u` 从私有公式改为 `var(--cineview-unit)` 兼容别名；site type-check/build 通过。浏览器本地实测：1440 unit=`1px`、390 unit=`0.2708333333333333px`，画布与 Stage 几何保持原值且无水平溢出。

### P9 独立浏览器验收

- 独立 agent `019f7791-603e-7452-afd2-64c763b813b8`：1440×900 与 390×844 的正式 unit、site alias、canvas/code 几何全部 PASS；正向 Film→Stage→Video 未跳段、无明显卡顿。
- 独立 agent `019f7796-31c5-7ce2-9e58-4e371763c25f` 补验 1440×900 完整正反向：Film→Stage→Video→Stage→Film 均重新 center-lock，最大 `-12000px` 输入被边界截留；`--cineview-unit` 全程 `1px`，`scrollWidth/clientWidth=1440/1440`，console error 0，PASS。
