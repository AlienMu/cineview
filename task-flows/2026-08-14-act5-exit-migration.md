# Act5 分栏标题/副标题退场迁移：CSS transition → Animate 手动控制

任务（用户拍板方案，不自由发挥）：把 `Scene5Cinema.tsx` 右栏标题/副标题从 CSS-transition
迁到框架 Animate `enterRef`/`exitRef` 手动控制，修好「反向路径不执行退场动画」。

## 框架语义关键确认（读码核实，非猜测）

- `triggerManualEnter`（useAnimateScroll.ts:749-759）= `runEnterTween()` 直跑——
  **不消费 `timeline.delay`**（delay 只在 gate 自动入场路径 `advanceEnterAttempt` 里消费）。
  ⇒ 方案要求的 enter 串行（标题 1100ms / 副标题 1350ms）**不能靠 timeline.delay 表达**，
  必须调用方 setTimeout。退场同理（exitRef 无 delay 概念）。
- `triggerManualExit` 立即 `runExitTween`（:761-764），tween 时长 = `duration.exit`。
- 手动退场粘性所有权（`manualExitUsedRef`）挡住 replayOnReenter 拉回（:698-708），
  `triggerManualEnter` 清该标志 ⇒ 可逆往返 CONFIRMED。
- 只声明 exit 不声明 enter 非法 ⇒ enter/exit variant 成对。
- `sceneControlled: false` ⇒ 身处 cinema-entrance zone 内也落 visibility 轨，
  enterRef/exitRef 才会被认领（Animate.tsx:672-673 manualControlLane）。

## 节点

- [ ] 1. JSX：两个独立 Animate（标题/副标题），enter/exit variant 成对，
      sceneControlled:false，enterRef/exitRef 接线
- [ ] 2. 消息 handler：finished → setSplit(true) + setTimeout 串行调 enterRef
      （1100/1350ms，对齐现行 CSS 入场观感）；unfinished → 立即调 exitRef
      （副 0ms / 标题 250ms）+ 950ms 后 setSplit(false) 收列
- [ ] 3. freeze effect 三级串行：调 exitRef → 700ms 后 setSplit(false) →
      再 700ms（累计 1400ms）卸载 iframe + 重置 latch
- [ ] 4. CSS：删标题/副标题 is-split transition 编排（~290-361），保 opacity:0 基态
      （FOUC 防线）；手机位移段 gap/basis/width transition 不动
- [ ] 5. 新探针 `_rv-20260814-split-exit-verify.mjs`：场景 A 断言 titleOpacity
      1→中间值→0；场景 B 断言「退净→收列→卸手机」串行
- [ ] 6. pnpm type-check（site）+ prettier
- [ ] 7. 报告落盘 site/review/20260814-adv/impl-act5-exit-migration.md
