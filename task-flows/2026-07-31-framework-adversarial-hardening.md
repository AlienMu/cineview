# 2026-07-31 Framework Adversarial Hardening

## Goal

在 `2026-07-31-framework-adversarial-closure.md` 已证明当前工作树无已确认 P0/P1 的基础上，继续关闭不需要产品语义裁决的 P2 证据缺口。默认先补可执行证明；只有红测、真实浏览器失败或可量化热路径成本成立时才修改生产代码。Q1-Q4（提交授权、rush re-grab 零增量语义、历史任务流回写、`AnimatePhase.waiting` semver）保持待用户确认。

## Nodes

- [x] H0 重读 `DESIGN.md`、closure/questions 与当前工作树；把 continuation 限定为非语义 hardening，不回滚既有修改。
- [x] H1 正式 scroll Chrome fixture 增加“精确停在 `segmentStart` 后正向超大 intent 必须先发布段内帧”，并验证 failure injection 仍能拒绝删断言/错路由/启动失败。
- [x] H2 为 keyed scroll store 增加空 key listener-set cleanup 与多 zone freshness/fan-out 压力证据；仅在测得显著逐帧分配成本时改生产实现。
- [x] H3 为 zone animation owner-safe cleanup 增加生产链组合回归：旧 owner cleanup 不删除新预算，新 owner completion 放行 visibility follower，新 owner cleanup 最终删除。
- [x] H4 扩展 waitFor/liveness 矩阵：三节点 cycle、环外 downstream、混合 driver、StrictMode setup-cleanup-setup、waiting-unmount timer/subscriber/rAF 清零。
- [x] H5 审查 drag pointer-move transaction/releaseSeed 分配与正式 fixture 首 owned frame 视频时间断言；有量化红证才改热路径。
- [x] H6 独立 agent 对 H1-H5 做修复后 adversarial review；scroll/drag 真实交互由非实现 agent 在 Chrome lane 验收。
- [x] H7 从头运行 `pnpm verify:framework`，更新 closure/questions/P2 状态与快照证据。

## Per-Node Self Review

每个节点完成前回读改动并确认：测试锁定真实生产调用链；没有把 P2 扩写成无证据重构；无每帧 React state、第二写者、layout thrashing、失效 memo 或新增全局 fan-out；listener/timer/rAF/MotionValue subscription 均可终止；无临时 debug 文件、TODO、死字段或重复 helper。

### H1 — Scroll exact-endpoint browser proof

- 正式 fixture 通过公共 `CineViewScrollRef.goToZone(..., { animated: false })` 精确停到 zone A `segmentStart`，未暴露生产 debug metrics，也未在 fixture 复制内部布局公式。
- Chrome 实测：`scrollTop 844 / progress 0` 收到 `wheel +100000` 后首个段内帧为 `scrollTop 845 / progress 0.000833`；反向端点先发布 `1 -> 0.999167`。
- `pnpm type-check:examples` 与 `pnpm --dir examples/performance-test acceptance:scroll` 通过；`pnpm verify:browser-failure-injection` 的 drag/scroll 基础断言、scroll 精确正向 progress、scroll 精确反向 endpoint、错路由、preview 启动失败共 8/8 均被门禁拒绝。
- 独立 reviewer 首轮指出三个验收门 P1：轮询只能看到最终 dataset、精确断言无各自注入红证、正式 scroll 脚本被 `.gitignore`。整改后 fixture 保存有序回调 history，断言读取手势 baseline 后第一条 zone A 事件；两个精确断言各有独立 injection；ignore 规则已删除。复验确认三个 P1 全部关闭。
- 自检：改动仅增加测试入口和断言；未新增每帧 state、layout read/write、第二 progress owner 或生产 debug 分支。

### H2 — Keyed store fan-out

- 红证用 `Proxy.ownKeys` 捕获旧实现每次 publish 两次全 zone 枚举；修复后 publish 直接遍历 `keyedListeners`，成本从 O(全部 zone) 收敛为 O(已订阅 zone)，不再创建 keys 数组和临时 `Set`。
- 新增空 listener-set 删除回归与 1000-zone 无全量枚举证明；`scrollExternalStore`、`sceneScrollRuntime`、`useScrollZoneRegistry` 共 3 suites / 11 tests 通过。
- 自检：store snapshot 与唯一写者不变；没有 React state、布局读取或新全局广播；unsubscribe 后 key 集合可回收。

### H3/H4 — waitFor owner and lifecycle matrices

- 新增三节点 cycle、环外 follower、mixed-driver fail-open；`registry`、`sceneScrollBudget`、`useSceneAnimationRegistry` 共 4 suites / 45 tests 通过。
- 新增生产链 owner A -> B 替换：A cleanup 保留 B budget，B completion 放行 visibility follower，B cleanup 最终删除 budget；另覆盖 StrictMode setup-cleanup-setup 与 waiting-unmount 后 subscriber/timer/rAF 清零。
- `useAnimateScroll.phase` 相关组合共 3 suites / 51 tests 通过；与 H2/H3/H4 合并回归共 8 suites / 101 tests 通过。
- 自检：测试通过正式 hook/provider 调用链，不引入新 owner；cleanup 断言覆盖 stale owner、MotionValue subscription、timer 与 rAF 终止。

### H5 — Drag allocation and media continuity

- 审计确认 transaction 路径自身下界约 2 个短命对象/采样，计入 Framer Motion `PanInfo` 约 7 个/采样，即约 420/840 objects/s（60/120 Hz）；没有 GC、long-task 或掉帧红证，故未做无证据生产重构。
- 正式 drag Chrome fixture 新增首 owned frame 视频连续性断言：held-end 与 first-owned `videoCurrentTime` 均为 `5.05157s`，差值 `0`，阈值 `<= 0.15s`；`pnpm --dir examples/performance-test acceptance:drag` 通过。
- 自检：仅增强 fixture 断言；drag 的 `renderProgress`、scene-local `elementElapsedMotion` 与 `dragRelease` 所有权未变化。

### H6 — Independent adversarial sign-off

- Scroll/store lane：真实 Chrome 正向首事件 `844 -> 845 / 0 -> 0.0008333333`，反向首事件 `2044 -> 2043 / 1 -> 0.9991666667`；0 console/page error、0 Long Task；keyed-store 3 suites / 11 tests 通过。验收门整改后复验 PASS，无 P0/P1。
- Drag/media lane：正向与反向 `current 0 -> 1 -> 0`、`starts=2`、`commits=2`；held-end 与 first-owned 页面差 `0%`、视频差 `0s`；0 Long Task、0 个 `>50ms` 帧间隔，P95 `17.7ms`。PASS，无 P0/P1。
- WaitFor/lifecycle lane：8 suites / 97 tests 使用 `--runInBand --detectOpenHandles` 通过；owner 替换、cycle/mixed-driver、StrictMode、waiting-unmount 资源清理均通过。PASS，无 P0/P1。
- 独立复核保留的非阻断 P2：完整 scroll reducer 仍按全部 zone/scene 做每帧 O(N) 计算；drag pointer sample 约 7 个短命对象；cycle issue 的诊断起点随注册顺序旋转，但 24 种排列的 delay/budget/放行结果一致。这些均无行为、长任务、掉帧或资源泄漏红证，未做无证据生产重构。

### H7 — Full framework gate

- `pnpm verify:framework` 从头 exit 0：framework Jest 103/103 suites、1459/1459 tests；Statements 95.53%、Branches 90.35%、Functions 95.40%、Lines 96.86%。
- framework/examples type-check、Prettier、ESLint 全通过；examples Vitest 7/7 files、24/24 tests；duplication 1.00% lines / 1.11% tokens。
- `build:verify` 12/12；ES gzip 41.25 KB、UMD gzip 49.62 KB；framework failure injection 5/5，browser failure injection 8/8。
- 正式 browser gate：drag PASS；scroll PASS，包含精确正向首事件 `844 -> 845 / 0 -> 0.0008333333` 与精确反向首事件 `2044 -> 2043 / 1 -> 0.9991666667`。
- 最终 `git diff --check` 与 framework format gate 均通过；当前验证对象仍是 HEAD `f164470d2ca4595ba7e6f0cbad455a11da763d82` 之上的未提交工作树，提交授权保持 Questions Q1。

## Status

`COMPLETE_WITH_ARCHIVED_P2_AND_QUESTIONS` — H0-H7 全部完成；当前工作树快照无已确认 P0/P1，完整门与三条独立 adversarial lane 均通过。非阻断 P2 与产品/发布待确认项已归档，提交级复现仍待 Questions Q1 授权。
