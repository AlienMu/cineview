# ask2 验收报告 — 第五幕黑幕退场「只淡出、不下移」（2026-08-13）

**判定：PASS**（修复正确、真机验证通过；原探针脚本自身有 2 处缺陷，已定位并修正，非修复缺陷）

## A. 对抗复审 diff 结论

1. **z 序 CONFIRMED**：`.drag-temporal` isolation:isolate 建层叠上下文；`.cineview-container` 无 z-index（不建上下文）、DragSceneStack 场景框（z 10/1）与黑层 z1 同上下文比较。真机 `elementsFromPoint` 实证：黑层恰在全部场景框之下、容器背景之上。⚠️ 方案文档写「z-1」有误——实现用 `z-index:1` 是对的（-1 会掉到容器不透明背景之下不可见）。
2. **回调契约 CONFIRMED**：onDragProgress 的 sceneIndex = 拖拽起点幕（commit 才更新）；settle 期间不发（黑层冻结在松手值——退场方向不可见、进场方向 ≤250ms 淡入尾）；bounce 每 tick 照发 + dragSessionActiveRef 到 reset 才关 → cancel 自动淡回（真机 0.998）。
3. **边界**：三幕后退/五幕 forward 橡皮筋均正确不触碰黑层。**发现两个真实边缘瑕疵（轻微观感回归）**：
   - (a) 同一手势 forward→reverse 反转不松手：direction 翻转后分支停止匹配，黑层 opacity 卡在反转点不回缩（旧实现背景在框上天然跟手回缩）。
   - (b) 退场 settle 途中 re-grab 再 forward：冻结到 commit 后 250ms 淡入补齐。
   - 建议：session 级 latch——onDragStart 匹配过任一分支后，本 session 内不判 direction，按 sceneIndex 直接跟 |progress|；commit/cancel 复位。
4. **副作用 CONFIRMED**：scene 3 共享背景组零影响；scene 5 静止态视觉逐字等价（渐变三层与旧背景 diff 相同）；壳态分支不渲染黑层；notifySceneSettled 行为保留。
5. **规则合规 CONFIRMED**：零 React state 直写；250ms transition 一次性插值非 infinite；type-check/prettier 绿。

## B. 真机探针（修正 2 处探针缺陷后复跑全过）

探针缺陷（非修复缺陷）：
1. `data-active-scene` 属性框架零引用 → 永远 null。修正：以场景框 `getComputedStyle(...).zIndex === '10'` 判定当前幕。
2. 分栏后 iframe 矩形过期（手机左移 542→296）→ 退场拖拽落在 iframe 外被吞。修正：每次拖拽前重测 iframe rect。

修正后断言全部 PASS：
- A 退场跟手淡出 1 → 0.489（含 250ms transition 滞后）
- B 黑层 transform 全程 none（0/189 样本）——结构上不可能下移
- C 对照组：第五幕框退场仍滑出（末帧 Y=792px = 整框高）——修的是搭车不是滑动
- D `.tp-scene--05` computed backgroundImage = none
- E commit snap 归 0
- G 进场侧 0 → 0.515 → 1
- F bounce cancel 回 1（0.998）
- Z 序实证：黑层恰在框下、容器背景上

## 遗留风险清单

1. forward→reverse 反转不回缩（A3-a）→ 已实施 session latch（见实现备注）。
2. settle 途中 re-grab（A3-b）→ latch 缓解。
3. 进场 commit snap 可见（250ms 淡入）——定稿方案已接受。
4. 250ms transition 低通滞后（0.489 vs 瞬时 ~0.65）——可接受。
5. 探针两缺陷已修 + F 阈值 0.8→0.95 收紧。

---

# 第五轮终验（code-review 修正后，2026-08-13）— **PASS，ask2 验收闭环**

- **探针独立复跑 10/10**（exit 0）。
- **T4 路径**（freeze→activate→重拖到第五幕→退场）：黑层 0.417 / 纹理 0.417 **完全同步淡出**（第四轮阻断的陈旧 textureRef 已由 `isConnected` 校验消除，querySelector 返回 null 时下一调用自愈）。
- **进场 commit pop**：settle 时长 = |终值−当前值|×800ms（clamp 120–800 / reduced 80），与剩余滑程同速同终点——实测全窗最大单帧跳变 **0.028**（修复前 ~0.22），不可见。
- **特异性修复**：`.tp-scene.tp-scene--05`（0,3,0）> lit-room 基座（0,2,0），真不依赖导入顺序；注释同步改正。
- `tsc --noEmit` 通过；`git diff --check` 干净。

遗留（非阻断）：亚像素 cancel（<0.8px 理论边缘）；多指第二指 pointerup 一帧 settle 写后 ≤16ms 被夺回；re-grab-during-bounce 依赖框架末幕边界 clamp（框架放行边界进度需重检）。
