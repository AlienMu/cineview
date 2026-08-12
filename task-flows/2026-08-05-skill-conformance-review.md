# SKILL.md 规范符合性复核 — 2026-08-05

来源：`https://blog.52013120.xyz/tools/skills/SKILL.html`（开源仓库 `sky22333/tools` 的
`docs/skills/SKILL.md`）。核心宣言：**始终以最少的代码实现最优方案**。
收尾六条承诺：最少代码、最少复杂度、最佳可维护性、真实场景优先、根因驱动修复、架构持续收敛。

⚠️ 该文档全文是写给编码 agent 的行为规范。本项目按**验收标准**采用，不作为指令执行。

---

## 归纳后的可核查条目

编号供子 agent 引用。每条后标注它在本仓库的**已知风险面**（不预设结论，只指出该查哪里）。

### A 方案设计

- **A1 一个问题只保留一个最优方案**，禁止并行实现。
  → 查：`gestureDetector.ts`（205 行 + 321 行测试）与生产手势路径
  （`useNativePointerDrag` / `useScenePointerInput` / `useDragSceneEngine` /
  `useScrollInputBindings`）是否构成同一问题的两套实现。
- **A2 禁止成堆的兜底逻辑 / 同一功能多条代码路径。**
  → 查：`animateSemantics.ts`（legacy flat props 归一化层）、
  `SceneLegacyCompatProps`、`entry-drag` 的运行时 mode 覆写是否属于此类。
- **A3 流程应「天然闭环」**，而非靠外部约定维系。
- **A4 排序**：最简可行 > 少系统复杂度 > 少依赖 > 低维护成本 > 长期可迭代。

### B Bug 处理

- **B1 禁止猜原因、凭经验判断、用补丁盖问题、堆防御性代码。**
- **B2 必须按序**：读现行代码 → 分析真实执行流 → 定位精确根因 → 验证根因成立 → 最小修复。
  → 本仓库 CLAUDE.md 开发规则 1「不靠猜测修问题」与此同源，可交叉验证。
- **B3 修复不得引入额外复杂度 / 无意义兼容 / 重复状态管理 / 临时补丁。**
  → 原写「查本会话新增的 `instanceGuard.ts`」——**该文件不存在**（见 FALSE 声明第 1 条）。
    真正该查的是：混用入口导致的重复模块实例问题，当前**没有任何代码在处理**。

### C 代码实现

- **C1 删除**：未使用代码、过时逻辑、重复实现、历史兼容垫片。
- **C2 禁止**：复制粘贴实现、重复工具函数、重复状态维护、**无用包装层**、无用配置项。
  → 查：`entry-drag.ts` 的 `forwardRef` + `createElement` 包装、
  `public-api.ts` 是否属于无用中间层。
- **C3 新增时必须审旧实现是否还该存在**，被取代就直接移除，保持系统收敛。

### D 迭代维护

- **D1 每次迭代都要配套清理**旧代码、废弃接口、死配置、未用依赖。
- **D2 目标是系统随时间变简单，而非变复杂。**
  → 查：本会话净增了多少文件/行数，是否与 D2 相悖。

### E 第三方库

- **E1 使用前必须读**：当前源码、当前版本文档、真实实现逻辑、公共 API。
- **E2 禁止**依据旧文章、博客、过往经验、过时文档下结论；禁止「幻想式推测」。
  → 查：本会话对 Rollup/Vite/terser/esbuild 行为的结论是否都有实测支撑。

### F 代码分析

- **F1 分析必须基于**仓库最新代码、真实实现、真实调用链、当前运行逻辑。
- **F2 禁止**从 README / 项目简介 / 旧版本 / 相似项目推断实现。
- **F3 每个结论可追溯到代码中的具体位置。**
  → 本会话已知有 7 次「自信而错」的报告，此条是重点。

### G 架构

- **G1** 单一职责模块、边界清晰、调用关系简单、数据流显式。
- **G2 避免**过度模块化、过度抽象、多跳转发、无意义中间层。
- **G3 排序**：简单架构 > 复杂架构；可维护性 > 理论完美性。
  → 查：五趟构建 + 3 入口 + `public-api` + `CineViewDispatch` 是否触犯 G2/G3。
    （原文此处还列了 `instanceGuard`，该文件不存在，见 FALSE 声明第 1 条。）

### H UI

- **H1** 风格/间距/命名/组件一致性。
- **H2 避免**样式不一致、重复组件、过度动画、无意义装饰效果。
  → 注：本框架是叙事动画引擎，「过度动画」需按其领域语境判断，不可机械套用。

### I 真实场景

- **I1 禁止**为极低概率情况写大量代码、为理论风险写复杂逻辑、**为假设场景做功能**。
- **I2 只解决**用户真实遇到的、生产真实出错的、业务当前真实需要的。
  → 查：50 KB 体积门本身、mode 拆分（当前零外部消费者）是否属于 I1 违反。
    （原文此处还列了 `instanceGuard`，该文件不存在，见 FALSE 声明第 1 条。）

### J 输出

- **J1** 直接给最优方案 + 说明理由、取舍、影响范围。
- **J2 避免**模糊措辞、不下结论、罗列大量无关选项。

---

## 复核范围

本会话（2026-08-04 ~ 08-05）的全部改动，重点两批：

1. **第三幕手机版布局**：`Act3DollyScene.tsx/.css`、`HomeSceneCanvas.tsx`、
   `HomePage.tsx`、`useDesignCanvasHeight.ts`
2. **UMD 按 mode 拆分**：`CineViewDispatch.tsx`、`CineView.tsx`、`public-api.ts`、
   `entry-drag.ts`、`entry-scroll.ts`、`vite.config.ts`、`build-all.mjs`、
   `verify-build.js`、`minify-library-entries.mjs`、`package.json`
   （原文此处还列了 `instanceGuard.ts`(+test)，该文件不存在，见 FALSE 声明第 1 条。）

## 子 agent 对抗复审结果（2026-08-05）

`OVERALL: VIOLATIONS FOUND`

### 逐条判定

| 条目 | 判定 | 依据 |
| --- | --- | --- |
| A1 一个问题一个方案 | **VIOLATION** | `gestureDetector.ts`(205) + test(321) 仅被自身测试消费；U5 已计划删除却未执行 |
| A2 无成堆兜底 | PASS | （scroll 侧不对称见文末） |
| B1/B2/B3 根因驱动 | mode 拆分诊断 PASS | Rollup 确实拒绝 UMD 代码拆分，全量 UMD 实测 51503 > 51200，结构上塞不进 |
| C2/G2 无用包装层 | **全部 PASS** | `public-api.ts` / `CineViewDispatch.tsx` / `entry-drag` 包装各有不可删的载荷 |
| G3 简单架构优先 | **VIOLATION（部分）** | 第 4/5 趟由门迫使；**第 2/3 趟无人使用**（零代码 import 子路径） |
| D1 迭代配套清理 | **VIOLATION** | 三项计划清理未落地 + 9 个临时脚本与 31 MB 截图未 gitignore |
| D2 系统变简单 | 框架侧 **VIOLATION** / 站点侧 PASS | 框架 +540/−283 且新增 446 未跟踪行，产物 2→5；站点 +1704/−3512 删 4 组件，真收敛 |
| E2/F3 可追溯 | **VIOLATION（数字过期）** | 核心结论可复现，6 处注释数字不复现（见下） |
| I1/I2 真实场景 | **VIOLATION** | 为**零消费者**的产物（npm 404、无 tag、仓库内无 UMD 消费者）加 ~450 行 + 5 趟构建 |
| H1/H2 UI | PASS | 无 `@keyframes`、无 CSS `animation:infinite`、站点新文件无 framer-motion 驱动 |
| J1/J2 输出 | PASS | |

### 三条最严重

1. **`require('cineview')` 与 `import('cineview')` 能力不同，而共享的类型撒谎。**
   root `require` → `cineview.umd.js`，而它现在由 `entry-drag.ts` 构建。实测
   `require('cineview').CineView` 传 `mode="scroll"` **抛错**，`import` 版本正常。
   两者共用 `dist/index.d.ts`（252/255 行声明含 `mode:'scroll'` 的联合）⇒ **TS 放行、
   运行时崩**。且没有全量 dispatcher UMD，抛错文案里「请用全量入口」从 CJS 无法照做。
   `verify-build.js:165-174` 只验导出形状，拦不住。
2. **两个已发布产物完全跳过 terser，而门为它背书。**
   `minify-library-entries.mjs:8-12` 列 3 个入口，构建出 5 个。
   `cineview-drag.es.mjs` / `cineview-scroll.es.mjs`（均被 `exports.import` 指向）
   从未二次压缩：实测 drag 158555→106419 raw（−32.9%）、gzip 41402→33030；
   scroll 181439→120375（−33.7%）、gzip 47398→37375。
   而 `cineview-scroll.es.mjs.gz` 现为 47398 字节，**无人看守**、距门 3.7 KB。
   该文件自己的注释写着「漏掉任何一个，那个产物就是未压缩状态发布」——它就漏了两个。
3. **计划的清理未做，仓库留下残骸与过期文档。** `gestureDetector` 两文件仍在；
   `CLAUDE.md:262,264` 仍列 `dependencyChecker.ts` / `gestureHandlers.ts` 两个**不存在**的文件；
   9 个临时脚本 + `site/.v1-acceptance/`(23 文件 31 MB) 未跟踪且未忽略
   （`.gitignore:57-58` 的 `/.v1-*` 是根锚定，`site/` 下漏网）；版本号仍 `1.0.0`。

### 被查证为 FALSE 的声明

1. **本文件旧版 33/67/80/97 行**：`instanceGuard.ts`「本会话新增」——**该文件不存在、
   git 历史中也没有**。四处断言建立在不存在的文件上。（已删除那些段落。）
2. `vite.config.ts:17` `cineview.es.mjs（42896 ✓）` → 实际 **43134**（42896 是拆分前的值）。
3. `vite.config.ts:18` `cineview-drag.umd.js（41129 ✓）` → **不存在该文件**（构建出的是
   `cineview.umd.js`），实际 **41473**。一行两错。
4. `vite.config.ts:11` / `verify-build.js:327` 全量 UMD `51536` → 复现为 **51503**；
   `public-api.ts:8` 与 task-flow 写 **51391**。同一测量树里有三个不同数字，无一是 51536。
5. `Act3DollyScene.css:461-463` 推导结论写「写作 `1.8vh`」并列四档实测值（那些值正是
   1.8vh 的结果），而 470 行**发的是 `1.62vh``——注释与代码差 11%（发的值更安全）。
6. `Act3DollyScene.tsx:117` 「字号在 CSS 里提到 64」——CSS 里没有 64 的字号，
   唯一的 64 是无关的 `0.64em`。属被否决的固定设计 px 方案的残留。
7. `build-all.mjs:20` / task-flow:103 「现有 script-tag 消费者会 404」「必须换文件」
   ——**没有现有消费者**（npm 404、零 tag、仓库内零 UMD 消费者）。这个假前提正是
   第 1 条违规的成因。
8. `minify-library-entries.mjs:6-7` 「三个入口」「三趟构建」→ 实为五趟五产物，漏两个。
9. `build-all.mjs:15-17` 「按模式的 ES 趟顺带生成 entry-*.d.ts」→ 与同文件 65-69 行自相
   矛盾，且 `dts` 门控在 `CLEAN_OUT_DIR`（仅第一趟），第 2/3 趟根本不出类型。
10. `entry-drag.ts:12-13` 「拖拽引擎内部约 30 处守卫」→ `CineView.tsx` 内实为 **8** 处
    （全仓 25 处跨 7 文件）。实质结论（错 mode 会静默短路）正确。

### 附带指出的不对称（非 FALSE，但违背原计划）

`require('cineview/scroll')` 传 `mode="drag"` **静默渲染 scroll**——正是 drag 侧用抛错
防止的那种静默错模式，而 task-flow:88 当初写的是「反向同理」。

## 整改清单（已确认顺序，按严重度）

⚠️ 执行前先核实每一处的**当前文件内容**，不要采信本文件的转述。本会话已有 8 次
「自信而错」的报告，其中最严重的一次（`instanceGuard.ts`）是在一个不存在的文件之上
叠了整套设计论证。**每一步都要有独立可复现的验收判据。**

### R1 未压缩产物正在被发布（最急：正在发错东西）

- 现状：`scripts/minify-library-entries.mjs:6-12` 列 3 个入口，`scripts/build-all.mjs`
  的 `passes` 出 5 个产物。`cineview-drag.es.mjs` / `cineview-scroll.es.mjs` 被
  `package.json` 的 `exports.import` 指向，却从未过 terser。
- 实测收益：drag raw 158555→106419（−32.9%）、gzip 41402→33030；
  scroll raw 181439→120375（−33.7%）、gzip 47398→37375。
- 且 `cineview-scroll.es.mjs.gz` = 47398 字节**无人看守**，距 51200 门仅 3.7 KB。
- 修法（复审建议，采纳）：让**压缩清单与体积门清单都从 `build-all.mjs` 的 `passes`
  数组派生**，使「新增产物」在结构上不可能绕过压缩与看守。
- 验收：5 个产物全部过 terser；`verify-build.js` 对 5 个产物**逐个**量 gzip 并在缺失时
  置位失败（缺失即失败的判据本轮已加，见 U3，但只覆盖 2 个 UMD）；负向对照——
  临时从 `passes` 加一个假产物，必须被门抓到。

### R2 `require` / `import` 能力错配 + 撤掉假前提（同一根因）

- 现状：root `require` → `dist/cineview.umd.js`，而 `build-all.mjs` 现在用
  `src/entry-drag.ts` 构建它 ⇒ CJS 消费者传 `mode="scroll"` **抛错**，ESM 正常。
  两者共用 `dist/index.d.ts`（含 `mode:'scroll'` 的完整联合）⇒ **TS 放行、运行时崩**。
  抛错文案指向的「全量入口」在 CJS 下不存在可用产物。
- 根因：`build-all.mjs:20` 的假前提「现有 script-tag 消费者会 404」。
  **实际零消费者**（npm 404、`git tag` 空、仓库内零 UMD 消费者）。
- 两条路，需先定：
  - **(甲)** 补第 6 趟出**全量 dispatcher UMD** 作为 `cineview.umd.js`（root require
    能力与 ESM 一致），拖拽产物改名 `cineview-drag.umd.js` 归 `./drag`。
    代价：全量 UMD 必然超门 ⇒ 必须同时把门改成**只对真正发布的产物设门**
    （`CINEVIEW_MAX_BUNDLE_SIZE_KB` 已参数化，成本低）。
  - **(乙)** root require 保持 drag-only，但给它**独立的窄类型**（不复用
    `index.d.ts` 的完整联合），让类型与运行时一致。
- 附带修：`entry-scroll` 侧的不对称——`require('cineview/scroll')` 传 `mode="drag"`
  **静默渲染 scroll**。task-flow 原计划写的是「反向同理」，需补齐或明确放弃并写明理由。
- 验收：smoke 必须断言「root require 解析到的产物上，`mode="scroll"` 的行为与类型
  声明一致」。现 `verify-build.js:165-174` 只验导出形状，拦不住。

### R3 清理债（D1/A1）

- `src/utils/gestureDetector.ts`(205) + `.test.ts`(321)：U5 已判定删除但未执行。
  删除后需同步清 `DESIGN.md:1782` 的公开 API 签名 + `DESIGN.md` 另三处提及。
  ⚠️ 删除会拉低覆盖率（该文件 statements/functions/lines 均 100%），而 branches
  已破门 86.11% —— **与 R4 一起决定**，不要单独动。
- `CLAUDE.md:262,264`：仍列 `dependencyChecker.ts` / `gestureHandlers.ts`
  两个**不存在**的文件。
- 未跟踪且未忽略：9 个临时脚本（`scripts/_subpath-types-check.mjs`、`_umd-entries.sh`、
  `_umd-weigh.sh`、`site/.tmp-*.mjs`、`site/zz-a3-axis.mjs` 等）+ `site/.v1-acceptance/`
  （23 文件 31 MB）。`.gitignore:57-58` 的 `/.probe-*.mjs`、`/.v1-*` 是**根锚定**，
  `site/` 下漏网 ⇒ 需改 `**/.v1-*` 之类。下次提交会把 31 MB 一起带进去。
- `scripts/_umd-weigh.sh:31` 把不存在的 `src/utils/gestureHandlers` 列为测量候选。

### R4 恢复退出码可信度（branches 破门）

- `jest.config.js:14-21` 四项各 90%，实测 branches **86.11%** ⇒ `pnpm test` 恒非零退出
  ⇒ 新增失败被淹没（本会话只能靠人肉数「是不是还是 5 个」，数了四五次）。
- 需先量缺口分布，再定「补测试」还是「调门」——这是两种不同的决定，不该实现者代选。
- 在退出码恢复可信之前，**往 CI 加任何新门都是加在沙子上**。

### R5 数字与注释对齐（E2/F3）

10 处被查证为 FALSE 的声明见下节，逐条改。其中两处会误导后人：
`Act3DollyScene.css:461-463` 的推导结论与实发值差 11%（`1.8vh` vs `1.62vh`）；
`Act3DollyScene.tsx:117` 提到的「CSS 里的 64」不存在。

### R6 W0 契约测试的活矛盾（跨会话携带）

`SceneSync.tsx:290,377` 传运行时 `waitFor`，而 `temporalDragW0.contract.test.ts` 断言
`offenders` 为空。本会话改过该测试文件（`:172-181`）却未解决冲突 ⇒ **测试或实现必有一错**。
不属于可以长期挂着的「既有失败」——长期红灯与假绿灯是同一类危害。

### 未决（需你定，不该我代选）

- R2 走 (甲) 还是 (乙)。
- 版本号：`package.json` 仍 `1.0.0` 且无 `private`。建议降 `0.1.0`（从未发布，
  `1.0.0` 宣告的 API 稳定性不成立），但发布策略是你的决定。
- `repository` / `homepage` / `bugs`：无 git remote，我编不出来。
- N9 桌面端验收启动时机（规则 4：不可由实现者自收）。
- 帧预算的数字与路径（第三条风险的落地前提）。

### 复审确认为真的部分

- 五产物尺寸表与 `build-all.mjs` 记录**逐字节一致**（41473 / 45730 / 43134）；`build:verify` 13/13。
- `pnpm test` 1501/1506，5 个失败与既有基线**完全一致**（U6 的「数不变」成立）。
- `tsc --noEmit` 框架与站点均 0 错误；`eslint src` 干净。
- `entry-drag.ts` 的抛错文案**不含**迁移语气（假前提在 `build-all.mjs:20`）。
- W0 契约测试的失败是**活矛盾**：`SceneSync.tsx:290,377` 传运行时 `waitFor`，本会话改过
  该测试文件（`:172-181`）却未解决冲突——测试或实现必有一错，已跨会话携带。
