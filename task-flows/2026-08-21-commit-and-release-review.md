# 2026-08-21 提交未落盘改动 + 发布就绪评审

## 任务目标

1. **提交**：把 08-13 → 08-20 累积的工作树改动（框架 scroll 引擎/Animate/媒体层 + 站点五幕整改）整理提交。
2. **发布就绪评审**：复核框架当前状态是否达到上线要求（correctness / 结构 / 性能 / 文档一致性）。
3. **代码 review**：对本批 diff 做对抗式审查（fresh sub-agent，显式 PASS/FAIL）。

## Phase 1: 门禁与提交 ✅

- [x] T1.1 全量门禁：`pnpm test` **120 suites / 1583 tests 全绿**；`type-check` 0 错误；
      `lint` 0 错误 0 警告。（pre-commit 首次因 jest worker 瞬时故障失败，重跑即绿——
      全部可见 suite 均 PASS，非用例失败）
- [x] T1.2 核对未跟踪文件归属：探针 JSON/截图/task-flow 按仓库惯例（41aae22 基线提交
      先例）随代码一并入库；无杂物（无 node_modules/dist 泄漏）
- [x] T1.3 提交：**4179d74**（187 files，+103314/−2465），工作树干净

## Phase 2: 发布就绪评审 ✅

- [x] T2.1 代码对抗复审（fresh sub-agent，框架侧 13 文件逐行 + 相关 25 套件实跑 369+55 绿）
      **VERDICT: FAIL（1×P1，主会话独立复核坐实）**
      - **P1** `VideoFrameRenderer.tsx:303` warmUp 未先 release 时 `resetOwnership(false)`
        把四个 capture 监听从仍挂载的 video 摘除且无重绑路径（key 不变→节点不换；
        AnimateVideo approach 首次进入 near/inside 即触发）。后果：onPlay/onPause/onEnded
        公共回调永久失明、ownership reducer 收不到 pause/ended。NO-TEST-COVERAGE
        （现有 warmUp 用例全是 release→warmUp 序列，恰好绕开）。
        主会话验证：bindNativeMediaListeners(null) 只拆不绑（L175-190）+
        mediaElementKey 不含 mediaEpoch（L596-601）——两环均亲手核实。
      - **P3** 死码：`useSceneScrollZoneTimeline`（sceneScrollRuntime.tsx:140，迁移后零消费）、
        `ScrollSceneFrameStore.getSnapshot`（scrollSceneFrameStore.ts:38，新增即死面）。
- [x] T2.2 上线要求核对（fresh sub-agent）**VERDICT: 有条件上线**
      - 全绿：test 1583、type-check/lint、build:verify 14/14（构建可复现）、覆盖率
        95.08/90.47/95.55/96.45、dist↔src 无类型漂移、DESIGN 四裁决一致、pack 卫生干净
      - 硬条件：4179d74 后**无真机浏览器验收记录**（08-18 lane 环境性 EPERM 阻断，
        blocker.json 主会话直读核实，browserScenariosExecuted:false）
      - 低风险：`./drag`/`./scroll` 子路径无 ESM import 条件（registry 未发布，可修）；
        UMD 54.24/55KB 余量 0.76KB；CLAUDE.md 数据过期（1127→1583、44.9→45.81、
        test-threshold.js 归属错——真门在 jest.config.js coverageThreshold；
        firstSceneEnter 已按"有意不合并"关闭）
- [x] T2.3 见 Phase 3

## Phase 3: 结论

**阻断上线，两项整改后可放行：**
1. **P1 warmUp 监听器脱落**——修复 + 补「未 release 的 warmUp 后媒体回调仍触发」回归测试（变异验证）+ 复审
2. **真机浏览器验收 lane**——4179d74 后独立 agent 完整手势矩阵（正向锁定/反向重锁/
   键盘/scrollbar/大 flick/多 zone 倒序/并发掉帧观测）

放行前建议顺手清：P3×2 死码、子路径 ESM exports、CLAUDE.md 数据刷新。
