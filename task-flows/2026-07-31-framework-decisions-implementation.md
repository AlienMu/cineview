# 2026-07-31 Framework Decisions Implementation

## Goal

落实用户对 adversarial questions 的裁决：Q1 允许在完整复验后创建可复现提交；Q3 以最新任务流为基准并删除被完整取代的重复历史；Q5 将 drag allocation 与 scroll force-full 测试补强纳入发布阻断；Q6 采用 A，重复 `zoneId` 必须拒绝。Q2/Q4 只补充完整语义、风险与可选结论，等待用户再次裁决。

## Commit Boundary

- 只提交可复现 framework snapshot：`src`、framework/examples 验证入口、根构建/类型/CI 配置、`DESIGN.md` 与本轮保留的 framework task-flow。
- 不提交 `site/` 视觉重构、临时 probe/accept 输出或与框架发布无关的工作树变更。
- staging 前逐文件审计；不使用 `git add -A`，不覆盖用户改动。

## Nodes

- [x] D0 重读完整 `DESIGN.md`、`AGENT_SELF_REVIEW.md`、最新 closure/questions 与当前工作树，建立本任务流。
- [x] D1 并行审计 drag sample 分配、scroll force-full 测试矩阵与历史 task-flow 重复关系，明确最小写入边界。
- [x] D2 先红后补齐 scroll force-full tuple：scenes 缩短/重排、direction/viewport/debug 变化和 dense array 尾部清除。
- [x] D3 消除 native drag pointer sample 每帧可避免的短命 `PanInfo`/nested object 分配，保持单 owner、同步值与 callback 语义。
- [x] D4 按 Q6-A 拒绝重复 `zoneId` 注册，保证旧/新 cleanup 都不能破坏合法 winner；补生产 registry 与 Scene 集成测试。
- [x] D5 详细解释 Q2 rush re-grab 零增量 release 与 Q4 `AnimatePhase.waiting` semver 影响；更新 questions，但不替用户选择。
- [x] D6 以最新 closure 为基准合并证据并删除被完整取代的重复 framework task-flow；保留 questions 与本任务流。
- [x] D7 逐节点回读：无第二写者、每帧 React state、layout thrashing、失效 memo、stale cleanup、资源泄漏或死代码。
- [x] D8 由非实现 agent 在最新工作树独立完成 drag/scroll Chrome 验收，并由静态 agent 复核 Q5/Q6 修复无 P0/P1。
- [x] D9 从头运行定向测试、`pnpm verify:framework`、`git diff --check`，更新最终证据与 snapshot fingerprint。
- [ ] D10 仅暂存 commit boundary 内文件，审计 staged diff 后创建可复现提交；记录 commit SHA，不推送。

## Status

`READY_TO_COMMIT` — D0-D9 完成。当前工作树框架边界无已确认 P0/P1；Q2/Q4 与两个非阻断 registry P2 已归档，等待 D10 framework-only 可复现提交。

## Implementation Evidence

- D2：`useScrollSceneSnapshots.test.tsx` 新增 scenes 重排/缩短、dense tail 清除和 force-full tuple 刷新；定向 6/6 通过。
- D3：owned pointer session 惰性创建并复用 `PanInfo`/vectors，candidate 零分配；`useNativePointerDrag` 定向 13/13 通过，framework type-check 通过。
- D4：registry/root/Scene/Animate/类型定向 187/187 通过；`DirectScrollCineView` 主套件与 slot 90/90 通过；framework type-check 通过。
- D6：独立审计确认只删除 3 个无独有证据的任务流；closure/hardening/P2 evidence 保留为递进证据链。
- D7：回读确认 drag 复用对象只进入内部同步 Scene 引擎；Q6 root preflight 在 render 前剥离重复 takeover，registry cleanup/element write 都以 `sceneIndex` 校验 owner；没有新增 React 每帧 state、layout read/write 或第二 progress writer。Prettier 与 `git diff --check` 通过。
- D8 drag：独立 Chrome lane 验证 tap-resume 保持 `99.337% -> 99.337%` 后恢复到 `100%`，rush hold 与首 owned frame 页面/视频均无跳变；最终 `starts=3 / cancels=2 / commits=1`，0 console/page error、无 P0/P1/P2 红证。
- D8 scroll：独立 Chrome lane 验证 zone A/B `0 -> 1 -> 0`，wheel/keyboard/touch/native scrollbar、大 delta 段内首帧、fixed layer release 与多 zone 倒序重放全部通过；0 Long Task、0 console/page error、无 P0/P1/P2 红证。
- D8 static：独立复核确认 Q5/Q6 两项候选 P1 均关闭。保留两个非阻断 P2：`registerZoneAnimation` 不携带 `sceneIndex`，绕过 root preflight 的异常内部调用理论上可注入 budget；zone owner 以 `sceneIndex` 而非 generation lease 标识，非标准 root 生命周期下同 index stale cleanup 理论上仍可能命中。标准公共入口已有 root preflight、owner object 与 sceneIndex 防线，当前无可执行红证。
- Build follow-up：移除 `freeze:false`、`externalLiveBindings:false` 与对象形式 `generatedCode`；独立审查证明前两项收益为 0/约 11 B，后一项的约 51 B 收益来自意外关闭 namespace `Symbol.toStringTag`。当前默认 Rollup namespace/live-binding 语义已恢复；UMD gzip `49.94 KB`，build verify 12/12。
- D9 full gate：`pnpm verify:framework` 从头 exit 0；framework Jest 105/105 suites、1465/1465 tests，Statements 95.62%、Branches 90.73%、Functions 95.68%、Lines 96.96%；examples 7/7 files、24/24 tests；duplication 0.93% lines / 1.04% tokens；build 12/12，ESM/UMD gzip `41.64/49.94 KB`；static failure injection 5/5、browser failure injection 8/8；正式 drag 与 scroll acceptance 均 PASS。
- D9 snapshot：branch `codex/drag-release-dual-gate`，baseline HEAD `f164470d2ca4595ba7e6f0cbad455a11da763d82`；D10 将以 framework-only commit SHA 替代未提交工作树作为最终可复现 fingerprint。
