# act5 收尾层入场/退场一致性真机审 — 2026-08-19

## 任务来源
用户报障（首页 scroll 第五幕 Scene5Cinema）：
1. 标题文案入场无淡入，突然出现
2. 入场和退场动画不一致

## 环境
- dev server: `http://localhost:4001/`（**不是 4000** — 当前 Vite 实际占用 4001，且只 bind IPv6 localhost，`127.0.0.1` 连接被拒，必须用 `localhost`）
- 探针：Playwright headed，viewport 430×900，deviceScaleFactor 2
- 工作目录：`/Users/alienmu/Documents/alien/cineView/cineview/site`
- 探针脚本：
  - `site/scripts/act5-review-20260819.mjs`（外层 host 采样，初判）
  - `site/scripts/act5-deep-20260819.mjs`（深挖 inline style / scene slot 状态）
  - `site/scripts/act5-inner-20260819.mjs`（内层 `motion.div` 采样，**最终判据**）

## 复现路径（真实指针拖拽 iframe）

iframe `/drag?deferred=true` 需拖到末幕 commit 才发 `cineview-embed-finished`。按
`adv-a5-drag.mjs` 的三陷阱处理：
1. 末幕分步逼近（120px/步，防跳过钳），轮询 `data-cinema-stage === 'revealed'`
2. 顶到段末 `scrollTop = maxScroll` 开交互门（INTERACT_AT=0.98，否则 `pointer-events:none` 静默吞拖拽）
3. iframe 内多步 `mouse.move`（24 步）制造真实速度

实测拖拽序列（`act5-review-20260819/summary.json`）：
- 拖#0 → active=null/3 子帧已发 `unfinished`
- 拖#1 → active=null/3 再发 `unfinished`
- 拖#2 → active=null/3 再发 `unfinished`
- 拖#3 → active=null/2 发 `cineview-embed-finished` → 父页 `split=true`

父页收到的消息时间线：`ready`×2 → `unfinished`×3 → `finished`（t=25790ms）。
**真实拖拽路径确实触发 finished，收尾层正常挂载。**

## 关键判据：读哪一层

**外层 `[data-cineview-animate-host]` 是一个普通 `<div>` 包装层，opacity 恒为 1，不参与 scrub。**
scrub opacity 写在它的子节点 `[data-cineview-animate-id]`（即内层 `motion.div`，见
`Animate.tsx:937-944`，`style={scrollOuterStyle}`）。

初判探针（`act5-review-20260819.mjs`）误读外层 host → 得出「挂载首帧 opacity=1、全程不变」的假象，
判据错误地指向「突然出现」。内层探针（`act5-inner-20260819.mjs`）读 `data-cineview-animate-id`
的内层 `motion.div`，才是真实 scrub 写入点。**以下所有结论以内层为准。**

## 挂载瞬间 opacity

挂载帧（`split=true`、title 元素首次出现、progress=1）内层 `motion.div` 状态：
- `inlineOpacity: "1"`，`computedOpacity: 1`，`visibility: visible`

**判据：挂载首帧内层 opacity = 1（不是 0）。** 但这不是 bug — 见下。

## 为什么挂载即满值不是 bug

收尾层的 scrub 窗口是 `timeline.phase: {start: 0.85, end: 1}`。**progress=1 时 scrub 已解析到终点
opacity=1**。挂载门控在 `finished` latch 上，而 finished 必然发生在 progress=1 段末（拖到末幕
commit 才发消息）—— 所以挂载瞬间 progress 必为 1、scrub 必在 1、内层 opacity 必为 1。

**「淡入」不是由 scrub 在挂载后播放的**，而是由子元素的**一次性 CSS 入场动画**
（`Scene5Cinema.css` `@keyframes scene5-closing-rise` + `scene5-closing-fade`，delay
1.1s/1.35s/1.7s/2.0s，`animation-fill-mode: both`）承担。`both` 保证 delay 期 `visibility: hidden`
（无半成品闪现），delay 到了再从 `translateY(14px)` 升起。

scrub 只负责滚动路径上的透明度跟手淡入/淡出（0.85→1 窗），两条职责分离，见 Scene5Cinema.tsx
line 704-712 注释。

## 入场曲线（progress 0.85→1，内层 motion.div）

复滚正向（`act5-inner/forward.json`，从 gP=0.92 滚到 1.0），title 内层 opacity：

| gP | scrollTop | opacity |
|----|-----------|---------|
| 0.9236 | 29905 | 0 |
| 0.9884 | 32005 | 0 |
| 0.9892 | 32030 | 0 |
| 0.9900 | 32055 | 0.0152 |
| 0.9907 | 32080 | 0.0909 |
| 0.9915 | 32105 | 0.1667 |
| 0.9923 | 32130 | 0.2424 |
| 0.9931 | 32155 | 0.3182 |
| 0.9938 | 32180 | 0.3939 |
| 0.9946 | 32205 | 0.4697 |
| 0.9954 | 32230 | 0.5455 |
| 0.9961 | 32255 | 0.6212 |
| 0.9969 | 32280 | 0.6970 |
| 0.9977 | 32305 | 0.7727 |
| 0.9985 | 32330 | 0.8485 |
| 0.9992 | 32355 | 0.9242 |

**线性淡入**，斜率恒定（每步 Δopacity ≈ 0.0758 ≈ 1/13.2），起点 gP≈0.990、终点 gP≈1.000。
跨越 scrollTop 32055→32380，约 325px 滚动行程。

## 退场曲线（反向滚 progress 1→0.85，内层 motion.div）

反向滚（`act5-inner/reverse.json`），title 内层 opacity：

| gP | scrollTop | opacity |
|----|-----------|---------|
| 0.9992 | 32355 | 0.9242 |
| 0.9985 | 32330 | 0.8485 |
| 0.9977 | 32305 | 0.7727 |
| 0.9969 | 32280 | 0.6970 |
| 0.9961 | 32255 | 0.6212 |
| 0.9954 | 32230 | 0.5455 |
| 0.9946 | 32205 | 0.4697 |
| 0.9938 | 32180 | 0.3939 |
| 0.9931 | 32155 | 0.3182 |
| 0.9923 | 32130 | 0.2424 |
| 0.9915 | 32105 | 0.1667 |
| 0.9907 | 32080 | 0.0909 |
| 0.9900 | 32055 | 0.0152 |
| 0.9892 | 32030 | 0 |
| 0.9884 | 32005 | 0 |

**线性淡出**，斜率与入场完全一致（每步 Δopacity ≈ 0.0758），起点 gP=1.000、终点 gP≈0.990。

## 入退场一致性判定

**完全一致 / 完美镜像。**

入场斜率 ≈ 退场斜率（每 25px 滚动 Δopacity ≈ 0.0758）。
入场行程 gP 0.990→1.000（约 325px）= 退场行程 gP 1.000→0.990（同一 325px）。
opacity 序列逐点对称（入场 0.0152↔退场 0.0152，0.9242↔0.9242）。
title / subtitle / cta / footer 四元素 opacity 在同一 progress 点**完全相同**
（scrub variant `closingFadeVariant` 对四者等价，差异只在 CSS 入场 delay）。

**用户报障 #2「入场和退场动画不一致」不成立** —— scrub 层严格对称，是 progress 的纯函数。

## 关于用户报障 #1「标题入场无淡入，突然出现」

内层 motion.div 在 gP 0.99→1.0 的 325px 行程内线性淡入 0→1，**scrub 层有淡入**。
但**观感上可能被判为「突然出现」**，真实根因方向有三条（不在本次探针范围，需独立验证）：

### 方向 A：scrub 窗口太窄（最可能）
`timeline.phase: {start: 0.85, end: 1}` 把 0.85→1 的 zone progress 映射到 enterProgress 0→1。
但 zone 的 1.0 点 = `scrollTop = maxScroll = 32380`，而 `finished` 在段末触发、挂载发生在
progress≈1。实测 opacity 真正爬升只在 gP 0.99→1.0（325px），即 zone 的最后 1%。
前 14%（0.85→0.99）虽然 enterProgress 从 0 爬到 ~0.9，但因为 progress 1.0 时已 latch 挂载，
用户从 0.85 滚到 0.99 时收尾层**还没挂载**（latch 在 finished 才挂），所以这段 scrub 窗口
**在挂载前是空的**，挂载后又只有最后 1% 的行程可走。

**根因：scrub 窗 0.85→1 与 latch 门控在 finished（progress=1）耦合，导致 scrub 在挂载前空转、
挂载后只剩 ~325px 可用淡入行程。** 用户从 0.85 滚到 1 的滚动行程（约 5500px）里，只有最后
325px 能看见淡入，前面 ~5000px 收尾层根本没挂载 —— 这就是「突然出现」的观感来源。

修法方向：要么把 scrub 窗收窄到挂载后的可用区间（如 0.99→1），要么给收尾层一段独立的
CSS 入场淡入（独立于 scrub），让挂载瞬间有可感知的淡入时长。当前子元素 CSS 动画
`scene5-closing-rise` 是 transform/visibility（不是 opacity），opacity 在 CSS 动画里是
`var(--scene5-manual-opacity, 1)` 默认 1 —— 所以 CSS 入场也不负责 opacity 淡入。

### 方向 B：CSS 入场动画只做 transform/visibility，不做 opacity
`Scene5Cinema.css:392-414` 四个元素的 CSS 动画 keyframe 是 `scene5-closing-rise`
（translateY + visibility）和 `scene5-closing-fade`（visibility）。**opacity 由
`opacity: var(--scene5-manual-opacity, 1)` 静态控制**，默认 1。scrub 写的是内层
motion.div opacity，子元素 CSS 不写 opacity。所以挂载瞬间：
- 子元素 CSS：visibility 0→1 + translateY 14px→0（1.1s delay 后播 0.7s）
- 内层 motion.div：scrub opacity，progress=1 时为 1

两条都不在「挂载瞬间」给 opacity 一个 0→1 的可见淡入 —— 一个是 transform/visibility，
一个是已到终点的 scrub。**opacity 淡入完全依赖滚动继续推进最后 325px**，但用户挂载时
通常已停在 progress=1，不会再滚 —— 于是看不到淡入。

### 方向 C：子元素 CSS 入场 delay 1.1s 起步
`scene5-closing-rise` 的 `animation-delay: 1.1s`，`both` 让 delay 期 `visibility: hidden`。
挂载后 1.1s 内标题是 hidden（不可见），1.1s 后才升起。如果用户在挂载瞬间截图，看到的是
「什么都没有」，1.1s 后「突然升起 + 已 opacity 1」—— 这也读作「突然出现」而非「淡入」。

## 结论

1. **scrub 层入退场完全对称、线性、镜像一致**（gP 0.99→1.0，325px，0→1 线性）。用户报障 #2 不成立。
2. **scrub 层有淡入**（不是 opacity=1 一步到位）。用户报障 #1「突然出现」的根因不在 scrub 本身，
   而在**scrub 窗与 latch 门控的耦合**：scrub 窗 0.85→1 中只有最后 1% 在挂载后可用，
   前 14% 在挂载前空转；叠加子元素 CSS 入场只做 transform/visibility、不做 opacity，
   且 delay 1.1s 起步 —— 三者叠加导致**挂载瞬间到用户可见淡入之间没有可感知的 opacity 过渡**。
3. 初判探针误读外层 host（恒为 1）得出「全程 opacity=1」的错误结论，**必须读内层
   `data-cineview-animate-id` motion.div 才是 scrub 真实写入点**。

## 截图
- `/tmp/act5-review-20260819/mount-instant.png`（挂载稳态，外层 host 视角）
- `/tmp/act5-review-20260819/exit-reenter-final.png`（退场+复入终态）
- `/tmp/act5-inner/inner-final.png`（内层视角终态）

## 数据
- `/tmp/act5-review-20260819/mount-samples.json`（外层 host 挂载前后 12 帧）
- `/tmp/act5-review-20260819/summary.json`（含 drags 序列、parentMsgs）
- `/tmp/act5-inner/reverse.json`（退场曲线，内层 motion.div，100 帧）
- `/tmp/act5-inner/forward.json`（复入曲线，内层 motion.div，100 帧）

## 不改代码（按指令）

## 建议的下一步（供实现 agent 参考，非本审范围）
- 确认 `timeline.phase {start: 0.85, end: 1}` 与 latch（finished, progress=1）的耦合是否符合
  design 意图。若要让挂载后有完整淡入，需让 scrub 窗起点 ≥ 挂载点（如 start: 0.99）或
  给收尾层独立 CSS opacity 淡入。
- 确认子元素 CSS 入场动画是否应包含 opacity 0→1 keyframe（当前只有 transform/visibility）。
- 确认 `animation-delay: 1.1s` 是否过长（挂载后 1.1s 无可见反馈）。
