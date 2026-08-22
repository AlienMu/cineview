# 2026-08-21 P1 warmUp 监听器修复 + 四维结构评审

## 背景

2026-08-21 评审轮确认 P1：`VideoFrameRenderer.warmUp()` 未先 `release()` 时，
`resetOwnership(false)` 摘除当前节点四个 capture 监听且无重绑路径
（key 不变→节点不换→setVideoRef 不触发）。公共 onPlay/onPause/onEnded 永久失明。

## Phase 1: 修复 ✅

- [x] T1.1 读全 VideoFrameRenderer：generation 仅在 identity 变化（src/objectUrl）时递增，
      warmUp 不动 generation → 重绑不会「绑定即过期」；identity effect L490 本有重绑调用，
      唯一缺口是 `mediaEpoch` 不在 deps（warmUp 恰好递增它）
- [x] T1.2 修复：identity layout effect deps 补 `mediaEpoch` + 注释说明重绑职责。
      零新增 ref/逻辑，复用既有重绑机制。release→warmUp（换节点）与 src 变化路径
      行为不变（推演核实：generation/activationId 守卫均自洽）
- [x] T1.3 回归测试「keeps media callbacks firing after warmUp without a prior release
      (surviving node)」：节点不换 + play/pause/ended 三回调 warmUp 前后各触发。
      **变异验证**：deps 摘掉 mediaEpoch → 测试红（onPlay 停在 1 次，L892）→ 恢复 → 绿
- [x] T1.4 门禁：**1584/1584** 全绿、type-check 0 错误、lint 0 错误 0 警告

## Phase 2: 对抗复审（fresh agent）

- [x] T2.1 修复本身：**PASS**（fresh agent）
      - 五路径推演全过：release→warmUp 换节点 / src 变化 generation 递增 / timeline
        activate 换节点 / 同 tick release+warmUp（监听不丢）/ 重绑窗口
      - 测试意图锁定确认（capture listener → WeakMap accept → 回调门控，非代理信号；
        `toBe(video)` 排除换节点假绿）
      - 变异验证两轮均红→恢复→绿；主会话抽查 git diff 4179d74 仅三处预期改动，无残留
      - 新增已知边界（P3，不阻断）：① 同 tick release();warmUp() 背靠背 → 存活节点
        src 永久脱落（release 的命令式 removeAttribute 与 React 属性 diff 错配；
        公共 API 经 AnimateVideo 不可达，需直接 controlRef 消费者才会触发）
        ② warmUp 摘除与 layout effect 重绑间瞬态窗口单事件丢失（严格优于修复前的
        永久丢失）。两项记入后续待办，不本轮修
      - ⚠ 过程记录：网关 503 两度打死 agent；修复复审 agent 死在变异中途，盘上曾残留
        被摘掉 mediaEpoch 的状态，主会话 grep 核实后恢复（42/42 绿）再续跑
      两 agent 已要求随做随落盘 /tmp/*-review-notes.md 防接力断档。
- [x] T2.2 四维结构评审：**复用率 7 / 可维护性 6 / 扩展性 7 / 开箱即用 8，零阻断项**
      - 亮点：共享内核已提炼（animateInterpolation 去重史自述）；site 零违例
        （canvas 豁免全 phase-gated）；direction:'x' 已兑现零成本；mode 判别联合
        设计上乘；README 走查/defaults 体检全过无一处类型与运行时打架
      - 建议项（按 agent 排序 top3）：2.1 共享运行时设施（runtimeContext/frameStore/
        externalStore）迁出 CineView 目录斩断 Scene↔CineView 双向依赖（M）；
        1.2+1.3 useMixedValue 三拷贝 + 属性 lane 双枚举收敛单工厂（M，兼服务扩展性 d）；
        3.1 预设名双 union 单点化（S）
      - 新发现死码：src/utils/throttle.ts 全仓零 import（主会话 grep 复核坐实），
        连测试净删
      - 已知边界追加（复审 agent 发现）：同 tick release();warmUp() src 脱落（公共 API
        不可达）、重绑瞬态窗口单事件丢失——均 P3 记档不修
      - 全部改进项清单见 /tmp/structure-review-notes.md + agent 终稿（本轮结论已完整体
        现于本文件与评审汇报，tmp 文件为原始证据）

## Phase 3: 收口

- [x] T3.1 整改裁决：四维零阻断，P3 死码与 S/M 级建议项**待用户裁决**是否本轮顺手清
      （死码三项已两轮独立确认：useSceneScrollZoneTimeline / getSnapshot / throttle.ts）
- [x] T3.2 提交 P1 修复 + task-flow（评审证据随提交入库）
- 发布就绪合并结论：P1 已修复过 node gate；剩余唯一硬条件 = 4179d74+本修复后的
  独立真机浏览器验收 lane（规则 4）
