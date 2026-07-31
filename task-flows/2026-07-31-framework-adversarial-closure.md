# 2026-07-31 Framework Adversarial Closure

## Goal

在当前工作树上完成框架发布门与独立对抗审核，修复所有可证实的 P0/P1；最终结论必须建立在可复现快照、完整静态门、框架测试/覆盖率、drag+scroll 真实浏览器路径及独立复核之上。无法自行裁决的事项只归档，不擅自改变产品语义。

## Authoritative Inputs

- `DESIGN.md`（唯一有效规格）
- `AGENT_SELF_REVIEW.md`
- `task-flows/2026-07-19-framework-review.md`
- `task-flows/2026-07-20-global-framework-reaudit.md`
- `task-flows/2026-07-20-prop-composition-audit.md`
- `task-flows/2026-07-26-project-review-bughunt.md`
- `task-flows/2026-07-27-framework-assessment-continuation.md`
- `task-flows/2026-07-27-waitfor-liveness-remediation.md`
- `task-flows/2026-07-28-drag-timeline-mapping-design.md`

## Nodes

- [x] N0 读取规范、自检记录和关联任务流；建立当前工作树与发布脚本基线。
- [x] N1 修复并验证 `format:check:framework` / `verify:framework:static` 静态发布门。
- [x] N2 为 `useStructurallyStableValue` 补专属契约、边界与引用稳定性测试，并验证目标文件覆盖率。
- [x] N3 接入 scroll acceptance 到正式 browser gate，补齐 drag/scroll browser failure-injection 守卫。
- [x] N4 独立 agent 对 drag 所有权、timeline mapping、re-grab、媒体单写者做对抗审查与真实浏览器验收。
- [x] N5 独立 agent 对 scroll center-lock、反向重入、大输入、键盘/scrollbar、多 zone、fan-out 做对抗审查与真实浏览器验收。
- [x] N6 独立 agent 对 waitFor/liveness、registration generation、fail-open、热路径引用稳定性做静态和测试对抗审查。
- [x] N7 主实现 lane 修复独立审查发现的 P0/P1；每个修复节点完成后回读、自检、定向回归。
- [x] N8 独立复核 agent 对修复后代码做二次 adversarial review，确认无遗留 P0/P1 且无新增热路径成本。
- [x] N9 在固定工作树快照上运行完整 `verify:framework`、browser gate、failure-injection、覆盖率与发布构建；记录可复现证据。
- [x] N10 对关联任务流逐项校准状态，关闭已有证据支持的节点；矛盾、过期或需产品裁决事项归档到待确认文件。

## Per-Node Self Review

每个节点完成前必须确认：问题本体已解决；无 TODO/死代码/重复实现；未扩大巨石职责；未给 drag/scroll 每帧热路径增加 React state、重复 layout read、失效 memo 或第二写者；相关旧命名/旧入口全仓检索无残留。

## Acceptance Separation

- 实现 agent 不签署浏览器验收结论。
- drag 与 scroll 浏览器验收由独立 agent/lane 执行，验收 agent 只报告证据，不顺手修复。
- 修复后必须由不同于实现者的复核 agent 重跑受影响路径。

## Questions Archive

任何需要用户确认的范围、语义、任务卡冲突或不可复现外部条件，写入 `task-flows/2026-07-31-framework-adversarial-questions.md`，保持实现继续推进，不把疑问伪装成 PASS。

## Evidence

### N0 — Baseline

- Branch `codex/drag-release-dual-gate`, HEAD `f164470d2ca4595ba7e6f0cbad455a11da763d82`。
- 工作树含大量前序/用户变更与未跟踪文件；本轮仅按明确文件分区编辑，不回滚无关内容。
- `test:browser` 当前仅调用 examples 的 drag acceptance；仓库无 `acceptance-scroll.mjs`。
- 第一批 5 个只读审查 agent 全部因相同 429 限流退出，未产出结论，不计入独立审查证据；改为低并发重派。

### N1 — Format Gate Partial Evidence

- 初始 `pnpm format:check:framework` 唯一失败：`src/__tests__/site/sceneSync.motion-contract.test.tsx`。
- 对该文件执行 Prettier 后，`pnpm format:check:framework` 通过。
- `pnpm verify:framework:static` 完整通过：framework Jest 102/102 suites、1435/1435 tests；Statements 95.54%、Branches 90.45%、Functions 95.45%、Lines 96.84%；examples Vitest 7 files/24 tests；duplication 1.03% lines/1.14% tokens；`build:verify` 12/12；framework failure injection 5/5。
- 节点自检：格式修复未改变测试语义；静态门消费当前工作树的实际脚本和 glob，未绕过 `src/__tests__/site`；新增结构比较测试进入 framework coverage；未新增运行时写者、React state 或 layout read。

### N2 — Structurally Stable Value

- 专属测试先在“共享子对象 → 等值独立子对象”方向变红，证明旧比较关系不对称；反方向原本误绿。
- 根因：全局 `WeakMap<left,right>` 把普通 alias 复用误当 cycle topology。修为当前递归栈内的双向映射，并在子树退出时删除 pair。
- `pnpm test --runInBand src/utils/useStructurallyStableValue.test.tsx`：8/8 通过。
- 单文件覆盖率：Statements 97.67%、Branches 96.66%、Functions 100%、Lines 100%。
- 自检：未引入 React state/effect/layout read；仅在 React render 时比较 authoring 值，不进入 MotionValue 每帧写路径；函数和非 plain 对象继续 identity-sensitive。

### N3 — Browser Gate Integration

- 新增独立 `/#/acceptance/scroll` fixture：5 个直接 Scene、2 个 center-lock zone、每 zone 8 个并发 MotionValue 动画、scene-scoped fixed probe；进度 callback 直接写 dataset，不做 per-frame React state。
- `acceptance-scroll.mjs` 覆盖：大 wheel 防跨段、root keyboard、touch、native scroll reconciliation、自绘 scrollbar 正反向、zone 精确 0/1 端点、tail 释放、两 zone 倒序反向重锁、fixed layer、console/pageerror、Long Tasks。
- 首轮 fixture 因自定义组件包裹 Scene 导致 zone 未注册而失败；改为直接返回 Scene 元素后，同一原始反馈环通过。
- `pnpm test:browser`：drag PASS + scroll PASS；scroll 记录 zone enter/leave 4/4、最终双 zone 回到 0、console/pageerror 0、Long Task 0。
- `pnpm verify:browser-failure-injection`：drag/scroll 各自 assertion、route wiring、preview startup，共 6/6 故障均被拒绝。
- `pnpm type-check:examples` 与 examples Vitest 7 files / 24 tests 通过。
- 本节仅为实现者调试和门禁接线证据；N4/N5 的独立 agent 浏览器签署仍未完成。

### Build Size Diagnostic Correction

- 单独读取 Vite/compression 插件日志会看到二次 Terser 之前的 gzip（ES 51.71 KB、UMD 51.59 KB），该数字不是发布门消费的最终入口产物。
- 权威 `pnpm build:verify` 在 `minify-library-entries.mjs` 完成后实测：ES 40.70 KB、UMD 48.91 KB，`build:verify` 12/12 通过；不存在 bundle-size blocker。

### N5 — Independent Scroll Adversarial Review

- 独立只读 agent 运行正式 `acceptance:scroll`：正向防跳过、keyboard、touch、native scroll、scrollbar 正反向、双 zone 倒序均通过；最终 zone A/B 均为 0，enter/leave 各 4 次；console/pageerror 0，Long Task 0。
- 未发现 scroll P0；native offset 单 owner、统一 reducer、reverse re-entry 与大 delta 段内帧逻辑通过静态复核。
- 确认 P1：`SceneScrollTimelineContext` 的全局 snapshot 让每个 scroll `Animate` 订阅所有 zone；任一 zone 每帧变化会重渲染并重跑所有 zone 的 Animate hot effects。N7 必须改为 zone-scoped subscription/MotionValue 或等价窄订阅，并补 inactive-zone fan-out 红证与 freshness 契约。
- 残余风险：当前 fixture 仅 2 zones/16 animations；native scroll 样本中 callback progress 与视觉读取存在一帧差，修复 fan-out 时一并建立同帧/下一动画帧 freshness 口径。
- 校正：本节是 fan-out 修复前的首轮结论；后续 exact-endpoint 专项复核在 `segmentEnd` 精确端点复现 P0，以下 N7/N8 的修复与二次签署取代本节的临时 no-P0 判断。

### N4 — Independent Drag Adversarial Review

- 正式 `acceptance:drag` 通过，console/pageerror 0；定向 Jest 5 suites/47 tests 通过；未发现 drag P0 或 AnimateVideo/VideoFrameRenderer 双写。
- 确认 P1：每个 pointer move 同步进入三个 root React state setter，令 CineView/DragSceneStack/SceneContext 链每帧重渲染，违反每帧量优先 MotionValue 的规范。
- 确认 P1：standalone Scene 在 `useElementTrack` 之外直接写同一个 `elementElapsedMotion`，使 element 轨存在第二写者。
- 残余 P2：正式 browser fixture 尚未覆盖 rush re-grab、first-scene cold-start、AnimateVideo；N7 扩展 fixture，N8 由不同 agent 复核。

### N6 — Independent waitFor/Liveness Adversarial Review

- 未发现 waitFor P0；missing、稳定注销、owner-safe cleanup、waiting cancel 与 timer/rAF 清理未见新的确定性阻断。
- 确认 P1：规格允许的 visibility follower → scroll-zone leader 被静态 registry 与 runtime subscription 统一判为 `incompatible-driver` 并 fail-open；现有通过用例使用手写 lease，未覆盖生产 registry。
- 确认 P1：cycle fail-open 在回溯后仍累计循环前驱，污染 drag `T_self` / scroll budget；两节点示例当前得到 delay 34/13ms、总 44ms，规格应忽略非法边并保留自身 delay 1/2ms、总 22ms；现有 branch test 固化了错误值。
- `useStructurallyStableValue` alias/cycle 对称性未发现新 P0/P1；StrictMode、stale completion、waiting-unmount 计数等残余测试缺口纳入 N7/N10。

### N7 — Confirmed P0/P1 Remediation

- scroll fan-out：`SceneScrollTimelineContext` 改由 keyed external store 按 `zoneId` 订阅；未变化 zone 保持对象身份，inactive-zone Animate 不再被其他 zone 的逐帧更新唤醒。补充 keyed freshness、订阅清理与 inactive-zone fan-out 回归测试。
- drag 热路径：页面 render progress 与 element timeline progress 改由共享 MotionValue 驱动，pointer move 不再调用 root React progress setter；React state 只保留 ownership、release、commit 等结构性边界。`DragSceneFrame` 直接订阅 `renderProgressMotion` 写 transform。
- element 单写者：删除 standalone Scene 在 `useElementTrack` 之外对 `elementElapsedMotion` 的直接写入；生产代码的 element elapsed 写入全部收敛在 `useElementTrack`。
- waitFor/liveness：visibility follower → scroll leader 作为 runtime-completion-only 兼容路径，不计入共享几何 delay；scroll follower → visibility leader 继续 fail-open。cycle 回溯时标记循环 follower，非法边不再累加前驱 delay/duration，也不污染 `T_self` / scroll budget。
- drag fixture：正式 acceptance 增加 first-scene cold start、rush re-grab hold/ownership baseline 与真实 `AnimateVideo`；随后发现 incoming 外层 frame 可点击但内部 Scene 仍 `pointer-events:none`，统一 `dragPointerEnabled` 后补 Scene 级回归测试。
- 修复后定向回归：27 suites / 366 tests；framework type-check、lint、framework format 均通过；全仓生产检索未发现 `useElementTrack` 外的 element elapsed writer，也未残留临时 `[DEBUG-*]` 探针。
- 节点自检：MotionValue 订阅均返回 cleanup；未新增每帧 React state、layout read/write 交错或第二写者；修复复用现有 external-store、MotionValue 与 Scene pointer gate，没有引入新依赖或平行 runtime。

#### N7 follow-up findings and fixes

- scroll exact endpoint P0：`currentOffset === segmentEnd` 的超大反向 intent，以及对称的 `segmentStart` 正向 intent，原先可直接跨完整段。统一 reducer 现在先钳到 `segmentEnd - 1` / `segmentStart + 1`；正式 Chrome fixture 增加 zone A 精确完成端点后的 `-100000` wheel 断言。
- scroll ghost-zone P1：zone 已注销后，较晚执行的 `setZoneElement(zoneId, null)` 原会以 `sceneIndex: 0` 复活记录。registry 无 meta 时现在直接返回。
- waitFor cycle P1：cycle 成员不再累计非法前驱 delay/duration；环内只保留自身 timing，避免 drag `T_self` 与 scroll budget 污染。
- waitFor generation P1：completion 绑定具体 registration lease；新 generation 不继承旧 completion，stale tween callback 由 token 拒绝，active preparation 不再被误判为稳定 missing。
- zone animation owner P1：`registerZoneAnimation` 返回本 generation owner identity；cleanup 只有在 Map 当前值与该 owner 严格相同时才删除，旧 owner 不再移除新 generation 的 scroll budget。
- drag 门禁稳定性：`drag-two-track-bounce-return` 在隔离进程 10 次内复现一次同步 recorder 竞态；两个并行 lane 改在同一 `waitFor` 内观测，随后 30/30 独立进程通过。生产 drag runtime 未改。
- follow-up 定向回归：scroll 5 suites / 180 tests；owner/waitFor/drag 6 suites / 180 tests；framework type-check、lint、Prettier、`git diff --check` 全通过。

### N8 — Independent Repair Sign-off

- drag：不同于实现者的独立 agent 在正式 Chrome fixture 验证 cold-start 单调 `0→1`、rush hold 550ms 页面/视频均不动、首 owned frame 无跳变、commit 恰好 1、console/pageerror 0；签署无 drag P0/P1。
- scroll：全新独立 agent 运行 8 suites / 188 tests 与正式 Chrome acceptance；精确 endpoint 反向首帧 `1→0.999167`，wheel/keyboard/touch/native/scrollbar 共用 timeline，zone B 后 zone A 倒序归零，console/pageerror 0；签署无 scroll P0/P1。
- waitFor/liveness：发现者复核 owner-safe 修复，9 suites / 218 tests 与 type-check 通过；确认旧 owner cleanup 保留新预算、completion 仍由新 lease 发布，首轮其余 cycle/generation/stale-token/preparation 修复未回归；签署无 waitFor/liveness P0/P1。
- 三个签署均为只读验收；实现 agent 未签收自己的修改。

### N9 — Full Framework Gate

- `pnpm verify:framework` 从头通过，未跳过任何子门。
- framework Jest：105/105 suites、1464/1464 tests；Statements 95.63%、Branches 90.74%、Functions 95.70%、Lines 96.95%。
- examples：type-check 通过；Vitest 7/7 files、24/24 tests。
- format/type-check/lint：全部通过，ESLint 0 errors / 0 warnings。
- duplication：0.93% lines、1.04% tokens，低于门限。
- `build:verify`：12/12；ES gzip 41.54 KB、UMD gzip 49.99 KB，均低于 50 KB。
- framework failure injection：5/5 成功拦截；browser failure injection：drag 基础断言/路由/启动、scroll 基础断言/精确正向 progress/精确反向 endpoint/路由/启动，共 8/8 成功拦截。
- 正式 browser gate：drag PASS；scroll PASS，包含正向首事件 `844 -> 845 / 0 -> 0.0008333333`、反向首事件 `2044 -> 2043 / 1 -> 0.9991666667`、keyboard/touch/native/scrollbar、双 zone 倒序、fixed layer；最终 zone A/B 均为 0，enter/leave 各 5 次。
- 验证基线：branch `codex/drag-release-dual-gate`，HEAD `f164470d2ca4595ba7e6f0cbad455a11da763d82`，工作树默认 porcelain 217 个状态项（`--untracked-files=all` 为 272）。源码/测试/配置 payload 指纹见下方 `Snapshot Fingerprint`；commit 级复现仍受 Questions Q1 授权约束。

### N10 — Historical Task-flow Calibration

- `2026-07-20-global-framework-reaudit.md` 3.2 与 `2026-07-27-framework-assessment-continuation.md` 8：由本轮独立 drag/scroll Chrome 签署关闭；旧文件保持历史原貌。
- `2026-07-28-drag-timeline-mapping-design.md` 的“等待最终独立对抗验收”：由本轮 drag 签署关闭；设计同步与实现证据已在当前 `DESIGN.md`、N4/N7/N8 中复核。
- `2026-07-19-framework-review.md` 3.2 scroll fan-out：keyed external store、inactive-zone render 回归与独立 scroll 复核关闭该 finding；该旧 review 的其他宽泛重构条目不因本轮自动勾选。
- `2026-07-27-waitfor-liveness-remediation.md`：本轮先关闭已实现且有测试/独立复核支持的 P0/P1，随后 hardening 继续关闭三节点/mixed-driver cycle、StrictMode/waiting-unmount 资源计数与完整 follower E2E；大规模 zone 下的 Profiler 证据归入当前 scroll reducer O(N) 性能 P2。
- `2026-07-20-prop-composition-audit.md` 4.3 未被本轮专门的 composition fixture Chrome 路径覆盖，保持未关闭，不伪装成当前发布阻断 P0/P1。
- 历史文件是否批量回写 checkbox、rush re-grab 零增量语义、提交授权与 `AnimatePhase.waiting` semver 口径统一归档到 `2026-07-31-framework-adversarial-questions.md`。
- `2026-07-31-framework-adversarial-hardening.md` 已关闭先前保留的 keyed-store 分配、精确 segmentStart、owner follower E2E、waitFor 矩阵与首 owned 视频断言；独立 scroll/drag/waitFor lanes 均重新签署无 P0/P1。
- `2026-07-31-framework-p2-evidence-closure.md` 以固定规模实测关闭 scroll 全量 snapshot P1，并将 cycle 诊断规范化；drag allocation 无运行时红证保持现状。最新独立 Chrome/静态 lane 再次签署无 P0/P1。

### Residual P2 Archive

- drag pointer sample 约产生 7 个短命对象（含 Framer Motion `PanInfo`），但 60/120Hz Chrome 测量均无丢样、Long Task、`>20ms` 帧或 retained heap 增长；没有 GC/掉帧红证，保持现状。
- duplicate `zoneId` 当前为 ownerless last-wins：旧 Scene cleanup 可删除较新的 winner。未发现现有正式 fixture 使用重复 id，但该语义需在“拒绝重复 / owner-safe last-wins / 文档约束唯一”之间做产品裁决，归档 Questions Q6。
- scroll force-full tuple 仍缺 scenes 缩短/重排、direction/viewport/debug 变化与 dense array 尾部清除的直接测试；静态复核未发现 stale runtime，但测试证据不完整，归档 Questions Q5。
- scroll 1000-scene P1 已修复并实测；cycle 24 种排列已规范为同一公开诊断，不再列为遗留。以上剩余项均不构成当前 P0/P1。

### Snapshot Fingerprint

- 关键 payload SHA-256：`scrollExternalStore.ts` `d8c788214815151f593eb49bbf7bbfbe1a4b74a36cdc303cd155902339e32c7f`；`acceptance-scroll.mjs` `bf51f16d75650997f3c5939d61a45bcca445829c7efcff37a8223ae7e900bf1e`。
- 关键 payload SHA-256：`acceptance-drag.mjs` `e17acedaedf18d0c4aab7912bcdfc40e542f07e40ca49bffe93ec39424aa7dcb`；`useAnimateScroll.ts` `e6ca7f14fd44e2bfe1e8368f08bd68d490a6370b838b8c525123b3f532f2084b`。
- 关键 payload SHA-256：`useScrollSceneSnapshots.ts` `e647ca404e13a9dbc4eb4fec2a08f367942e220660ba4e0e9ba1bcda2b9959d0`；`useScrollZoneRegistry.ts` `27d2f04c3418de4a595daa2748c25f70de8dbd0df5bd8bdfb6ca05c01618cd05`。

## Status

`COMPLETE_WITH_ARCHIVED_P2_AND_QUESTIONS` — 当前工作树快照的完整门与独立 drag/scroll/waitFor 对抗复核均通过，未发现遗留 P0/P1；P2 与待产品裁决事项已归档。提交级可复现性待 Questions Q1 授权。
