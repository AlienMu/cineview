# 2026-08-23 P2 修复：sceneScrollBudget 双时钟分裂（用户裁决：修编译器）

## 缺陷（T1.8 终验实证 + 复审 agent 代码级定位）

leader 声明 `timeline.phase` 窗口 + follower `waitFor` 该 leader 时：
- px 级 `totalEndPx` 做了 phase 校正（resolveTiming line ~231：totalEndPx=phaseEndPx）
- ms 级 `totalEndMs`（waitFor 链的 calculatedDelay 累加消费）**没**校正
→ follower 在 leader 名义时序（delay+duration）就起动，而 leader 视觉窗口在
  phase 重标定的别处——T1.8 实测 subline 在 title 14% 时起动。

## 节点

- [x] N1 读全链路 ✅：ms 字段（startMs/enterEndMs 等）**零外部消费**（全仓 grep），
      运行时只读 px 字段（useAnimateScroll:915/1071、useScrollZoneRegistry）——
      修复面收敛在 sceneScrollBudget.ts 单文件
- [x] N2 设计 ✅：不动点迭代——phase 元素的链终点估计镜像 px 装配规则
      （有 exit→钉 total；有 phase.end→分数×total；仅 start→名义 enterEnd），
      waitFor 链消费估计；T = f·T + rest 型收缩（f<1 几何收敛），ε=1e-9、
      上限 10000（f=0.99 残差 f^10000≈e^-100）；无 phase 声明走原单趟零变化
- [x] N3 实现 + 测试 ✅：3 新用例——混合场景不动点定值（T=6600/0.7，
      subline.start ≈ title.totalEndPx，相位边收敛断言 + 无相位边精确 ≥）/
      phase-only 整数精确（零变化守卫）/ 退化 phase.end=1 终止性 + 有限值
- [x] N4 变异 + 门禁 ✅：摘估计消费 → 混合用例红 → 恢复绿；全量 1585/1585、
      type-check/lint 0
- [ ] N5 fresh agent 对抗复审 — 运行中（数学验算/零影响/边界/热路径复杂度/
      变异×2/文档核对 + N7 真机 fixture 浏览器验证）
- [x] N6 文档同步 ✅：waitfor-stagger.md 双语「当前约束」→「组合语义（已修复）」；
      centerlock.md 双语混用段改写；DemoPage 注释更新（纯链保留为教学基础形态）
- [ ] N7 真机浏览器验证（规则 4：phase leader + waitFor 链 fixture 页探针）+ 提交
