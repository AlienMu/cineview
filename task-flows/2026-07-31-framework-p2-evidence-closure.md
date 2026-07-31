# 2026-07-31 Framework P2 Evidence Closure

## Goal

继续审计 `2026-07-31-framework-adversarial-closure.md` 留下的三个无红证 P2：scroll reducer 每帧 O(全部 zone/scene)、drag pointer sample 短命对象、cycle 诊断起点随注册顺序旋转。先建立可重复测量；只有出现行为失败、长任务/掉帧/GC 压力或公开诊断不确定性时才修改生产代码。Q1-Q4 继续等待用户裁决，不暂存、不提交、不批量回写历史任务流。

## Nodes

- [x] P0 重读 `DESIGN.md`、hardening/closure/questions 与相关生产路径，确认唯一所有者和每帧性能约束。
- [x] P1 建立 scroll 多 zone 规模测量，区分 active-scene 查找、zone state 计算、callback 发布与 keyed subscriber fan-out；记录基线与可接受阈值。
- [x] P2 建立 drag 持续 60/120 Hz 等价输入测量，记录帧间隔、Long Task、JS heap/GC 可用信号；无红证则保留现状。
- [x] P3 对 cycle 的全部注册排列建立确定性测试；若公开 issue/reportError 内容随排列变化，则先红后用最小规范化修复。
- [x] P4 对任何确认问题做最小根因修复，并逐节点回读：无新 React frame-state、第二写者、layout thrashing、失效 memo、listener/timer/rAF 泄漏或重复 helper。
- [x] P5 由独立 agent 复核 scroll/drag/cycle 证据与修复；触及真实交互时由非实现 agent 在 Chrome lane 验收。
- [x] P6a 修复全量 coverage 下 `drag-two-track-bounce-return` 在目标 Scene prepared snapshot 发布前发手势的测试竞态，并做重复压力复验。
- [x] P6b 从头运行受影响定向测试、`pnpm verify:framework` 与 `git diff --check`，更新 closure/questions/Q5。

## Measurement Rules

- 性能结论必须来自同一 fixture 的前后对比或固定规模阶梯，不用单次主观体感代替数据。
- 测试/fixture instrumentation 不进入生产 bundle，不新增生产 debug API。
- scroll 若只证明 O(N) 但在目标规模无长任务、帧延迟或 fan-out，不为理论复杂度重写 reducer。
- drag 若只有对象计数估算而无 GC、heap 增长、Long Task 或帧间隔红证，不改 transaction 所有权模型。
- cycle 只有在公开 issue 或错误报告内容不确定时才修；内部 Map 顺序但对外行为一致不单独构成修改理由。

## Evidence

### P3 — Canonical cycle diagnostics

- 24 个 `a/b/c/downstream` 注册排列的纯 registry 回归先红：公开 `AnimationRegistryIssue` 与由其生成的 `CIRCULAR_DEPENDENCY` 文本会在 `a/b/c` 三个起点间旋转。
- 最小修复只把闭环数组旋转到字典序最小成员，并以该成员作为 issue `animateId`；不排序 registrations、不改 DFS、delay、timeline budget 或 waitFor release。
- `registry`、`sceneScrollBudget`、`useSceneAnimationRegistry` 共 4 suites / 41 tests 通过；24 个排列统一输出 `a -> b -> c -> a`。
- 节点自检：规范化仅在发现 cycle 的冷路径执行；无每帧成本、React state、MotionValue writer、subscription 或 timer 变化。

### P1 — Scroll scale measurement and remediation

- 同一生产 fixture 按 10/100/250/500/1000 scenes+zones 阶梯测量。原 1000-scene 基线：frame p95 `83.7ms`、max `282.9ms`、Long Task `121` 个、heap churn `272.47 MiB`，构成明确 P1 红证。
- 根因不是 keyed zone 发布本身，而是 root 每帧分配全量 scene snapshot，再让整个 `ScrollSceneStack` 订阅并 reconciliation；规模增长后主线程与临时堆分配同时失控。
- 修复后 Stack 不再订阅全集；每个 `ScrollSceneSlot` 用 keyed external store 仅订阅自身 scene index。snapshot 容器改为 dense array，每帧只构建 old/new viewport 交集、active±1、backdrop、zone change、scene 0 gate change 的 dirty scenes；真实布局变化仍强制全量刷新。
- 等值 layout measurement 保留数组身份，避免手势首帧无变化测量触发全量刷新。inactive scene 在重新进入 dirty/live 集合时补齐最新 scoped snapshot。
- 同一 1000-scene fixture 修复后：handler p95 `2.5ms`、frame p95 `17.7ms`、max `33.3ms`、`>50ms` 为 `0`、Long Task `0`、heap churn `27.51 MiB`、GC 后 retained `0.089 MiB`。
- 正式 `acceptance:scroll` 通过精确正反端点、keyboard/touch/native/scrollbar、多 zone 倒序与 fixed layer；Long Task `0`。最终独立 agent 二次签署见 P5。

### P2 — Drag allocation measurement

- 独立生产 Chrome fixture 分别模拟 60Hz/120Hz，各 3 次 × 8 秒：采样/回调 `1440/1440` 与 `2880/2880` 完整，无丢样。
- frame p95/p99/max `17.6/17.7/17.8ms`；`>20ms`、`>33ms`、`>50ms` 均为 `0`；Long Task `0`；forced-GC 后 heap 稳定，无泄漏或可见 GC pause。
- 每 sample 约 7 个短命对象的估算成立，但没有运行时红证；按本任务规则保留 production drag transaction/ownership 模型，不做理论性重写。

### P4 — Minimal-fix self-review

- scroll 修复没有增加 React frame-state、MotionValue writer、同步 layout read/write 交错、timer/rAF 或新依赖；仍由原 native offset/reducer 路径单写 scene progress。
- keyed selector 扩展为 `(snapshot, key) => value`，复用同一 external-store 工具，不另建第二套订阅框架；scene index 使用 number key。
- cycle 修复只发生于诊断冷路径；drag 测量无红证，因此 production drag 零改动。
- 定向验证：scroll 8 suites / 187 tests，新增结构 3 suites / 7 tests，framework type-check 通过；最终独立复核与完整门见 P5/P6b。

### P6a — Full-suite recorder race diagnosis

- 首次完整 `pnpm verify:framework` 在 coverage 阶段仅失败 `drag-two-track-bounce-return.test.tsx`：测试只等待 `getCurrentScene() === 0`，该条件不代表目标 Scene 的异步 preset/registry 已发布 prepared snapshot。
- 目标尚未 prepared 时框架按设计拒绝 ownership；测试随后不会产生 render bounce recorder。独立运行、coverage 单文件和 12 进程并发均通过，符合调度相关测试竞态而非稳定 production 回归。
- 最小修复沿用同组 drag 回归测试现有模式：手势前让出一个浏览器 task，使 prepared publication 与 React effects 收口；不改 production readiness、所有权或每帧路径。
- 修复后 24 次多进程压力复验全绿；相关 3 suites / 4 tests 全绿，`format:check:framework` 通过。

### P5 — Independent final sign-off

- 最新独立 Chrome lane 在 1000 scenes 上复验 scroll：handler p95 `2.2ms`、frame p95 `17.6ms`、max `33.3ms`、Long Task `0`，keyboard/touch/native/scrollbar、正反精确端点、多 zone 倒序与 fixed layer 全部 PASS；未发现 P0/P1。
- 最新独立静态 lane 运行 10 suites / 194 tests 与 framework type-check，确认 keyed freshness、sequence identity、budget/layout 顺序和 dense array force-full 路径未见 P0/P1。
- 静态 lane 仅保留两个 P2：duplicate `zoneId` 缺少 owner token；force-full tuple 的 scenes 缩短/重排、direction/viewport/debug 与 dense array 尾部清除缺少直接测试。前者归档 Questions Q6，后者归档 Q5。

### P6b — Full gate

- `pnpm verify:framework` 从头 exit 0：framework Jest 105/105 suites、1464/1464 tests；Statements 95.63%、Branches 90.74%、Functions 95.70%、Lines 96.95%。
- framework/examples type-check、Prettier、ESLint 全通过；examples Vitest 7/7 files、24/24 tests；duplication 0.93% lines / 1.04% tokens。
- `build:verify` 12/12；ES gzip 41.54 KB、UMD gzip 49.99 KB；framework failure injection 5/5，browser failure injection 8/8。
- 正式 browser gate drag PASS、scroll PASS；最终 `git diff --check` 通过。验证对象仍是未提交工作树，Q1 未授权前不暂存、不提交。

## Status

`COMPLETE_WITH_ARCHIVED_P2_AND_QUESTIONS` — P0-P6b 全部完成；当前工作树无已确认 P0/P1，完整门和最新独立 Chrome/静态复核通过。两个剩余 P2 已归档 Q5/Q6，提交级复现仍待 Q1 授权。
