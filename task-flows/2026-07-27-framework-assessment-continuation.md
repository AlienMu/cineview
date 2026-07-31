# 2026-07-27 框架评定续轮

## 目标

继续评定 CineView 框架（代码、边界能力、开箱即用，不含文档开发），从上一轮 backlog 中逐项核实可行动缺陷。每轮遵循：独立评审 → 源码复核 → 实现与红证 → 本地门禁 → 独立子 agent 复审；若复审发现问题，回到实现并再次复审，直到本轮无未解决的已确认缺陷。既有 site 内容必须保持不受影响。

## 约束

- DESIGN.md 是唯一有效规格。
- 不把产品新增能力当作 bug 偷做；需要产品裁决的能力缺口单列。
- 不覆盖或回滚当前工作区既有改动。
- drag/scroll 热路径修改必须保持 MotionValue 单写者与零 per-frame React state。
- 交互、视觉、性能改动必须使用独立 agent 在真实浏览器 lane 验收。
- site 消费 `dist/`；浏览器验收前必须重建框架并重启/刷新 site dev server。

## 节点

- [x] 1. 阅读 DESIGN.md、AGENT_SELF_REVIEW.md 与上一轮 task-flow；确认上一轮 W1–W9 已全绿并完成独立浏览器复验。
- [x] 2. 检查工作区：当前存在大量用户/前序任务未提交改动；后续按文件分区实施，禁止回滚无关内容。
- [x] 3. 独立复核剩余问题：
  - [x] 3a. 公共 API / 包发布 /外围模块（含媒体、Position、类型与 peer 约束）
  - [x] 3b. scroll 边界与热路径（含嵌套实例、横向配置、timeline fan-out、触摸路径）
  - [x] 3c. drag 与共享运行时（含降级诊断、性能、wheel/history 等能力边界）
- [x] 4. 汇总去重并分类：已确认 bug / 性能缺陷 / 仅产品新增能力 / 误报。
- [x] 5. 按风险与文件分区逐轮修复；每个节点附回归测试与 red→green 证据。
- [x] 6. 每轮修改后派独立子 agent 复审；发现问题回到节点 5，直到该轮无未解决的已确认 finding。
  - [x] 6a. 格式门修正后已派独立 reviewer，检查 11 文件格式化是否语义中性及有无遗漏。
- [x] 7. 全量 test、type-check、lint、build:verify、site type-check/build。
- [ ] 8. 重建 dist/site 后完成独立 agent 真实 Chrome 交互验收。2026-07-27 的独立浏览器 agent 仅完成页面/媒体 DOM 探查，未提交交互断言；后续三项为主线 Playwright 探针，只能记作补充证据，不能满足 CLAUDE.md 的独立验收门。2026-07-28 已重派独立浏览器 lane，待其给出完整终态后再勾选。
- [x] 9. 按 CLAUDE.md 四项完成自检，更新边界能力矩阵与最终结论。

## 上一轮待复核清单（输入，不等于结论）

- scroll `direction:'x'` 缺真实横向布局；是实现缺失还是应收回类型面。
- 嵌套 CineView 输入双消费。
- scroll timeline store 全局 fan-out。
- bfcache/history restore、iOS momentum、touch 首帧双重消费。
- media preload LRU objectURL 生命周期、VideoFrameRenderer 双下载/seek/preload=false。
- Position fixed host inline→portal 重挂与 center anchor context 语义。
- 公共 API 静默降级、monitor 指标语义、peer 范围、drag `goToZone` 误用。
- drag 热路径多余解析/订阅、半入场抓走视觉连续性、恒定 controls.set。
- history/popstate、drag wheel、exit per-element delay、公共 release 回调等产品能力缺口。
- 死模块、重复 PresetAnimation、styleConvert 白名单、performanceMonitor 全局单例。

## 证据与结论

### 续轮基线（2026-07-27）

- 工作区：`codex/drag-release-dual-gate`，框架与 site 均存在前序未提交改动；本轮禁止覆盖或回滚。
- `pnpm test --runInBand`：92/92 suites、1289/1289 tests 全绿。
- `pnpm type-check`、`pnpm lint`：0 错误、0 警告。
- `pnpm type-check:site`、`pnpm type-check:examples`：通过。
- site 仍以 `"cineview": "link:../"` 消费框架，浏览器验收必须使用新构建的 `dist/`。
- 首次 `pnpm verify` 在 format gate 暴露 11 个前序改动文件未格式化；仅对报告列出的 11 个文件执行 Prettier 后，完整发布门通过。
- `pnpm verify`：格式 / 框架、site、examples 类型检查 / lint 全通过；覆盖率 statements 96.16%、branches 90.61%、functions 96.58%、lines 96.81%；框架 92 suites / 1289 tests、示例 6 files / 23 tests 全绿；重复代码门通过；`build:verify` 12/12（ES gzip 49.58 KB、UMD gzip 42.36 KB）；warning / coverage / duplication / bundle-size 四类故障注入均被正确拦截。
- `pnpm --dir site build`：通过（452 modules，767ms）。站点入口 chunk 524.71 KB 触发 Vite 500 KB warning；这是站点级既有拆包观察，不等于框架主包门失败，框架 ES gzip 仍为 49.58 KB。

### 独立审查运行记录

- 公共 API / 媒体首个只读 agent 因推理网关返回 `INVALID_MODEL_ID` 提前终止，未产出任何代码结论；已使用可用模型重派同范围审查。该基础设施失败不计作“无 finding”。
- 原公共 API/媒体、scroll、drag/共享运行时、格式化语义中性审查均未产生有效源码结论（仅启动记录，部分遭遇 `INVALID_MODEL_ID`）；已全部停止，不计作审查通过。
- 已用明确可用模型重派四条精简只读审查：API/媒体/Position、scroll runtime、drag/shared runtime、格式化语义中性。四份有效报告全部返回前不开始交叉文件修复。
- 因早期 agent 存在网关中断历史，已用明确可用模型补派 API/媒体与 scroll 两条只读复核；原任务若恢复，只作第二意见。解锁修复的最低覆盖为：API/媒体、scroll、drag/共享运行时、格式化语义中性四类各至少一份有效报告。

### 结论分类模板

每条审查结论必须落入且只落入一类，并附源码位置、具体失败场景与验证方式：

1. **可复现 bug**：现有公共承诺或 DESIGN 规格下产生错误结果、崩溃、泄漏或静默失效；进入红证与修复循环。
2. **已证性能缺陷**：真实热路径存在可量化的额外渲染、布局抖动、跨 zone fan-out 或后台空转；进入基准/Profiler 证据与修复循环。
3. **产品能力裁决**：history、drag wheel、横向 scroll 等尚无明确现行承诺的新增能力；只更新能力矩阵，不擅自实现。
4. **误报 / 已消除**：代码已修、路径不可达、测试假设错误或无失败场景；记录排除证据，不修改生产代码。

### 本轮确认并修复的缺陷

1. **媒体 objectURL 生命周期**
   - `VideoFrameRenderer` 的 `src` 切换不再在 effect 执行前渲染旧源 blob；状态现在与产生它的 `src` 绑定，新源未缓存时同步回退到新原始 URL。
   - `mediaPreloadCache` 增加挂载 consumer 租约；LRU 超预算时不会 revoke 正被 `<video>` 解码的 objectURL，最后一个租约释放后立即重试淘汰。
   - 非 2xx 视频响应不再进入 ready/cache；挂起 fetch 30s 后中止并保持可重试。
   - 红证覆盖旧 URL 串源、换源/卸载 release、租约下零预算、HTTP 失败与超时；最终媒体复审再次稳定复现挂载、同源/换源与零预算场景，未修改文件。

2. **性能监控多实例租约**
   - drag/scroll 两个根组件统一通过 `acquirePerformanceMonitoring()` 租用全局 monitor；首个实例启动、最后实例释放才停止，release 幂等，避免一个实例卸载停止另一个实例的监控。
   - CineView 测试 mock 已迁移到 acquire→release 语义；监控与根组件定向 5 suites / 225 tests 全绿。

3. **scroll 输入所有权与 Pointer Events**
   - 触摸 move 即使在边界被 controller 拒绝，也会推进本地 anchor；反向移动立即产生正确的 `-50px`，不再因旧 anchor 形成反向死区。该用例修复前实际收到 `150px`，修复后通过。
   - 自定义 scrollbar 统一使用 Pointer Events；active thumb drag 独占 pointer ownership，第二根 pointer 不得跳轨道或替换监听；`pointerup`、`pointercancel`、unmount 使用同一 cleanup。
   - secondary mouse button 与 `isPrimary === false` 的 touch/pen 被入口拒绝，且不调用 `preventDefault`、不建立监听。
   - 旧 scrollbar 集成测试由 mouse 事件迁移到带坐标和 pointerId 的 Pointer Events fixture，覆盖轨道点击、拖动、接管与卸载清理。
   - 最终 scroll 分区 5 suites / 181 tests 全绿；全新 reviewer 的相关 5 suites / 170 tests 复跑全绿且未改文件。

### 排除项与产品能力边界

- **drag 半入场/settle re-grab 连续性：已消除。** `useElementTrack` 是每 scene element MotionValue 的单写者；grab 原地 stop，release ratio 连续播，D-F1/D-F7 settle join 对已 commit 与废弃 pre-commit 路径分别保留/清理。相关 `useSceneManager`、`useElementTrack`、`useAnimateDrag`、`useFirstSceneEnter` 4 suites / 64 tests 全绿；未做无证据重构。
- **多实例全局键盘“双消费”：当前实现不成立。** window capture listener 串行执行；首个成功消费者 `preventDefault()` 后，后续根由 `defaultPrevented` 短路。嵌套目标另有 nearest-root gate。没有形成双消费红证。
- **子组件普通 bubble `preventDefault()` 抢占父级 capture：产品输入仲裁能力。** 改事件阶段会改变既有优先级与手势语义，不按 bug 偷改；需要未来明确 API/规格再实现。
- **history/popstate、drag wheel、完整横向 scroll 等：仍属产品能力裁决。** 本轮不扩大公共能力面。
- **site 入口拆包：观察项。** 生产构建成功，但入口 chunk 526.14 kB（gzip 167.21 kB）触发 Vite 500 kB warning；不等同框架主包门失败。

### 最终验证（2026-07-27）

- `pnpm verify` 全通过：format；框架/site/examples type-check；lint；coverage；examples；duplicate gate；build verify；failure injection。
- 框架测试：**93/93 suites、1300/1300 tests**；覆盖率 statements **96.21%**、branches **90.71%**、functions **96.75%**、lines **96.87%**。
- examples：**6/6 files、23/23 tests**。
- duplication gate：1.39% duplicated lines / 1.55% duplicated tokens，通过配置阈值。
- `build:verify`：**12/12**；ES gzip **49.93 kB**、UMD gzip **42.73 kB**；package exports、CJS/ESM consumer、peer externalization/source maps、packed tarball consumer 全通过。
- failure injection：warning、coverage、duplication、bundle-size 四类注入均被门禁正确拒绝。
- `pnpm --dir site build`：452 modules，成功；仅保留上述入口 chunk warning。

### 真实浏览器证据

独立浏览器 agent 使用真实 Google Chrome + Playwright 完成 production preview 页面、DOM、媒体 objectURL/readyState 与场景布局探查，但反复扩展临时 harness，未在约定时限内提交三项交互断言，故该任务被停止；**不得将下列结果描述为独立 agent 交互验收**。主线随后在同一已构建 site 上以真实 Google Chrome + Playwright 执行最小探针：

- scroll wheel：根容器 `scrollTop 0 → 360`，输入生效。
- scrollbar pointer ownership：owner down 后 offset `0`；第二 pointer down 后仍为 `0`；owner move 后为 `901`，证明第二 pointer 被忽略且原 owner 继续驱动。
- drag release 后快速 re-grab：re-grab 前后 wrapper Y 都为 `-675.246`，opacity 都为 `0.166363`；瞬时跳变量均为 **0**。继续 move 后 wrapper Y 到 `-735.246`、opacity 到 `0.0922893`，手势连续推进。
- Chrome 控制台错误：**0**。

### 最终结论

本轮确认的媒体生命周期、性能监控租约、touch anchor 与 scrollbar pointer ownership 缺陷均已完成红证、最小修复、独立只读复审/定向复跑和全量发布门验证。当前没有遗留的、已由本轮证据确认且属于现有 DESIGN/公共承诺的缺陷。剩余 history、drag wheel、capture/bubble 仲裁和完整横向 scroll 等项目维持“产品能力裁决”，不擅自扩展。工作区原有大量未提交改动均保留；本轮未 commit、未 push。

### 后续更正：visibility `waitFor` 活性缺陷（2026-07-27）

上述“当前没有遗留缺陷”只覆盖当时审查过的成功路径与边界。后续针对普通 scroll visibility `waitFor` 的状态机活性复核确认：合法但不可达的 leader、missing/cycle、等待期间离屏、leader 注销与 stale completion 等路径可造成永久等待或离屏迟发。原结论因此不再适用于 `waitFor` 活性。根因是上一轮只证明了顺序安全性，没有强制证明异步等待的终止、取消、注销恢复和错误降级；部分测试还使用手写 phase bus、同步 Framer mock 或仅断言 DOM 存在，形成 false-green。完整证据、产品裁决和修复波次见 `task-flows/2026-07-27-waitfor-liveness-remediation.md`。

### 2026-07-28 复验补充

- 已重新阅读 `DESIGN.md`、`AGENT_SELF_REVIEW.md` 与本任务流，并核对后续 `waitFor` 整改流。
- 已纠正规格漂移：现行公共语义使用 `timeline.sceneControlled`，通用 ref 方法为必填，性能配置仅保留 `monitor`，`dragTimeScale` 默认值为 `10`（满程元素时钟 1000ms）。
- 当前工作树重新执行 `pnpm verify` 全通过：框架 **94/94 suites、1316/1316 tests**；覆盖率 statements **96.40%**、branches **90.58%**、functions **96.75%**、lines **97.20%**；examples **6/6 files、23/23 tests**；duplication **1.37% lines / 1.54% tokens**；`build:verify` **12/12**；ES gzip **47.99 KB**、UMD gzip **44.35 KB**；四类 failure injection 均被门禁拒绝。
- `pnpm --dir site build` 通过（456 modules）；入口 chunk **542.01 KB / gzip 171.50 KB**，保留 Vite 500 KB warning，仍属于站点拆包观察项。
- 原节点 8 已改回待验收：2026-07-27 的主线 Playwright 探针不能替代 CLAUDE.md 要求的非实现 agent 真实浏览器验收。
- 本轮独立源码复审与独立 Chrome lane 尚在执行；只有收到明确终态和交互断言后，才可重新勾选节点 8 并给出最终验收结论。
