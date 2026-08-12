# 2026-08-12 FOUC 修复 + enterRef/exitRef 手动控制

## 任务目标

1. **修复 FOUC bug**：页面刷新时元素先闪现 → 隐藏 → 再入场
2. **实现 enterRef/exitRef**：手动控制入场/退场 + timeline 兜底机制
3. **更新 DESIGN.md**：记录两项设计裁决
4. **遗留视觉问题**（用户本轮提出，见 Phase 7）

> 本轮按用户指令**只做代码测试**（单测 / type-check / lint / build:verify），真机验收由用户本人完成。

---

## Phase 1: FOUC 修复 ✅

- [x] **T1.1** 根因定位：`Animate.tsx` 的早退分支在变体未解析时返回**裸 children**（无 motion 包装），
      子元素按自身 CSS（`opacity:1`）绘制，解析落地后才 snap 回 initial 帧。
- [x] **T1.2** 修复（**第二版，第一版已废弃**）：
      - ❌ **首版做法（已回滚）**：早退分支改为渲染一个 `style={{opacity:0}}` 的占位 `motion.div`。
        该做法**形状与解析后的树不同**，导致：(a) 测试 mock 中条件调用的 `useEffect` hook 数量变化，
        触发 React "Expected static flag was missing"；(b) 元素提前出现改变了 `data-opacity`
        渲染快照的时机，`useAnimateScroll.phase` 的 above-top 用例变红。**结论：占位树是错的方向。**
      - ✅ **终版做法**：只要作者声明了 enter 或 infinite（`authoredPlayableAnimation`），
        未解析期间**照常渲染正常 motion 路径**（DOM 结构与解析后完全一致，不 remount），
        由各 driver 解析 initial 帧：
        - visibility 轨：`visualMotion` 本就 seed 0 ✓
        - arrival 轨：`hasAuthoredEnterAnimation` 时 seed 0 ✓
        - drag element 轨：新增 `variantsPending` 参数，强制 `mode:'hidden'`（空变体否则解析成
          `animate` 默认帧 = 可见）
      - 只有**真正无可播动画**（仅 exit 的非法载荷）仍早退渲染裸 children（fail-open 静态揭示）。
- [x] **T1.3** 配套：visibility 轨在 `variantsPending` 期间**不启动 gate 状态机**且**不认领 host** ——
      否则会拿空变体默认帧起 tween，且测量生命周期起点会提前，改变既有时序。
- [x] **T1.4** 回归测试 `animateVariantsPending.test.tsx`（2 例），**变异验证通过**
      （把 `variantsPending` 短路成 false → 用例变红）。

### Phase 1 连带修复

- [x] 两个测试 mock（`drag-visual-init-flash` / `drag-first-scene-enter`）**条件调用 `useEffect`**，
      违反 hooks 规则，被本次改动暴露 → 改为无条件调用、条件下沉到 effect 体内。
- [x] `useAnimateScroll.phase` / `.warning` 中 3 处把「元素已存在」当作「变体已解析」的代理信号，
      修复后该代理失效 → 新增 `waitForAnimateHost()` 显式等待解析；2 处裸 `setTimeout` 等待
      改为 `act()` 包裹（解析 setState 原本落在 act 外）。

---

## Phase 2: enterRef/exitRef 类型与 API ✅

- [x] **T2.1** `AnimateBaseProps` 新增 `enterRef` / `exitRef`（含完整 JSDoc：行为规则 + 场景 + 示例）
- [x] **T2.2** 经 `AnimateInternalProps` 自动流向实现层，无需改 barrel

---

## Phase 3–4: 驱动实现 ✅

**关键架构裁决（实现中确认）**：只有**时间驱动**的轨道能支持手动触发。

| 轨道 | 驱动 | 手动控制 |
| --- | --- | --- |
| visibility（`useAnimateScroll` 非 scroll-driven 分支） | 时间 tween | ✅ 支持 |
| arrival（drag + `sceneControlled:false`） | 真实时间 | ✅ 支持 enter |
| scroll takeover | `progressPx` 纯函数 | ❌ 上报忽略 |
| drag scene-controlled | 手指位移纯函数 | ❌ 上报忽略 |

scrub 轨手动写入会在下一帧被重算覆盖（违反开发原则 2「唯一所有者」），故**上报
`INVALID_ANIMATION` 并忽略**，而不是假装生效。

- [x] **T3.1–3.4** visibility 轨：`autoEnterSuppressed`（有 ref 且无 waitFor/delay）/
      `autoExitSuppressed`（有 exitRef）/ `manualEnterUsedRef`（粘性所有权，禁止自动重播）；
      抑制点覆盖 gate action、首次测量的 above-top 揭示、冷启动 bypass、静态兜底揭示。
- [x] **T3.5** 手动触发：`triggerManualEnter` 直接 `runEnterTween()`（其内部 `clearPendingEnter`
      即「丢弃剩余等待」），`triggerManualExit` 直接 `runExitTween()`。
- [x] **T4.1–4.4** arrival 轨：`pendingManualStartRef` 持有本次 token 的 `startEnter` 闭包
      （同一份冻结变体 + 同一 ownership 守卫）；`manualRequestedRef` 处理「消费者早于 token 调用」的竞态。
- [x] **T4.5** `Animate.tsx` 集中诊断：scrub 轨 / arrival 轨的 exitRef → 一次性 `reportError` + dev warn。

---

## Phase 5: 测试 ✅

- [x] **T5.1** 新增 `useAnimateManualControl.test.tsx`（5 例）
  - 无兜底时永不自动入场，调用后入场
  - 有 delay 时消费者不调用也会兜底自动入场
  - 等待中调用 → 丢弃剩余 5s delay 立即入场（不重新计时）
  - `exitRef` 关闭自动退场闸门，调用后退场
  - scrub 轨传 ref → 上报 `INVALID_ANIMATION`
- [x] **T5.2 变异验证**（防假绿）：
  - `autoEnterSuppressed=false` → 用例 1、4 变红 ✓
  - `autoEnterSuppressed=hasManualEnter`（忽略兜底）+ 手动触发 no-op → 用例 1、2、3 变红 ✓
  - `variantsPending` 短路 → FOUC 用例变红 ✓
- [x] **T5.3** 全量：**113 suites / 1513 tests 全绿**；type-check 0 错误；lint 0 错误 0 警告

---

## Phase 6: DESIGN.md ✅

- [x] **T6.1** 新增「授权中的变体：authored-but-unparsed 必须停在 initial 帧」
- [x] **T6.2** 新增「手动控制 + 兜底触发（`enterRef` / `exitRef`）」：语义表 + 打断定义 +
      粘性所有权 + 轨道支持矩阵

---

## Phase 7: 真机自测 + 修复（2026-08-12 第二轮，用户要求我自己实测）

上一轮我只做了静态代码核查就下结论「四项已实现」——**那是错的**。真机探针把三项报障全部
复现并定位。探针脚本：`site/scripts/rv-20260812{,-sweep,-settle,-hover}.mjs`，
数据在 `site/review/20260812/`。

> 方法学教训：`scrollTo()` 会被 center-lock reducer 抵消（实测设 1896 实际停在 28499），
> 必须用**小步 wheel 穿段**；且 `cinema-lightsoff` 上有 `transition: opacity 1.05s`，
> 快速扫描读到的是**追赶中的值**，稳态必须「滚到位 → 静置 >1.05s → 再读」。

### C1 Act2 codeboard hover 后不出现 —— 已修，根因是 lane 几何

实测（`sweep.json`）：`--film-flow` 到 100%（`state.done` 为真、hover 此刻才被受理）
发生在 y=11570，而同一 y 上 `film-card-inout` 的 opacity 已经是 **0.746 且继续下落**，
y=12040 归零，此后整个可 hover 的 hold 段卡片恒为 0。选中逻辑一直是好的
（探针实测 hover 能正确改写 activeCode/activeDesc），**卡片在能被 hover 的那一刻恰好淡完**。

几何原因：整卡 lane 复用 `SELECTION_MS = PAN+HOLD = 10500`，退场起点 `0.94` = 9870ms，
**早于**胶带 pan 结束的 10000ms ⇒ 退场斜坡把整个 hold 段（10000→10500）吃掉。

修法：`HOLD_MS 500 → 2600`（500px 驻留窗口比一次滚轮轻推还短），整卡改用**独立更长的
lane** `CARD_LANE_MS = PAN + HOLD + CARD_OUT_MS(700)`，退场严格晚于 hold。
**复测**：y=11570→14040 共 **2470px** 卡片恒为 opacity **1**，之后才下移淡出。

### C2 hover 行切换是硬切 —— 已修

`.film-codecard__code/__desc` 旧样式只有 `opacity: 0 → 1`，**无过渡无位移**。
「旧行下移淡出 / 新行上方落入」只存在于滚动轨的 y 关键帧，hover 路径完全没有。
修法：基态 = 离场终点（下移+透明，transition 立即生效）；`.is-active` = 一次性
keyframe 从上方落回（延迟 = 淡出时长，串行不重叠）。方向不对称无法用单条 transition
表达，故入场必须用 animation 让起点独立于基态。附 `prefers-reduced-motion` 降级。
**复测**（`hover.json`）：旧行 ty 0→+5.73 / op 1→0.045（0–180ms），
新行 ty −4.43→0 / op 0.261→1（240–420ms）。

### C3 Act5 背景「出现后又消失」、到不了黑 —— 已修

实测峰值只有 **0.442**（y=31230），之后 0.434 → 0.415 → 到底 **0.388**。两个问题：
1. 旧四点镜像关键帧 `[0,.94,.94,0]` 在相位后段线性回 0 ⇒ 正向滚到底黑幕自己淡掉了。
2. 斜率约 3.5e-4/px，0→0.94 需要约 2700px，而本幕到文档末尾没有这么多可滚距离 ⇒ 永远到不了黑。

修法：改成**单调**关键帧 `[0,.94,.94,.94]`，斜坡终点 `0.12 → 0.029`（按实测斜率折算约 500px）。
「退场与入场一样」用更本质的方式成立：opacity 是 zone progress 的**纯函数**，
反向滚动时沿同一条曲线原样亮回，镜像是免费的，不需要在正向末尾人为加回亮段。
**复测**（`settle.json`，每档静置 1.4s）：y=32300 起 `lights=0.94`，
屏幕实测亮度 **228 → 21.7**，到底恒为 0.94 / 亮度 19。

### C4 「滚动缓慢变背景色没有实现」 —— 已修（振幅问题，非映射问题）

实测旧锚色全页摆幅 **lum 11.1 / R−B 11.0**，换算到每滚一屏只有约 **1.3 lum**，
低于可察觉阈值。映射本身是对的（band transform 随 scrollTop 线性推进），
问题是九个锚点全挤在 lum 222–240 的 18 个单位里，视口又只看到 600vh 长带的 1/6。
修法：明度跨度约 18 → 约 47（谷段压到 lum≈195），R−B 同步放大；仍是单向暖色扫掠，
不引入冷段（memory `scrolling-ribbon-makes-tint-visible`）。
**复测**：全页摆幅 **lum 30.9 / R−B 33.1**（2.8×/3×），每屏约 **3.2 lum**。

### 门禁

框架 `pnpm test` 113/113 suites、1513/1513 tests；framework + site `type-check` 0 错误；
`lint` 0 错误 0 警告；site `build` 通过。文档总高因 HOLD_MS 增加从 31600 → 34400。

### 仍待你判断

- **背景振幅是否合口味**：现在谷段压到 lum≈195（比旧的 222 深不少）。数值上进入可察觉
  区间了，但「好不好看」是你的判断——嫌重我就往回收一档。
- **Act5 变黑是否够渐进**：静置测得 200px 采样步长内从 228 掉到 21.7；实际滚动有
  1.05s 的 CSS 平滑兜着。若嫌突兀，把 `LIGHTS_OFF_RAMP_END` 从 0.029 往上调。
- 你机器上 4000–4010 有 **11 个残留 vite 进程**（4000 那个已跑 15 天）。我实测用的是 4011。


---

## Phase 8: 交付前门禁 ✅（框架部分）

- [x] `pnpm test` 113/113 suites、1513/1513 tests
- [x] `pnpm type-check` 0 错误
- [x] `pnpm lint` 0 错误 0 警告
- [x] `pnpm build` 成功；`pnpm build:verify` **14/14 通过**
      （ES gzip 42.69KB / UMD-drag 41.15KB / UMD-scroll 45.28KB，均在预算内）

---

## 用户真机验收清单（框架部分）

1. **FOUC**：连续刷新 5 次 `/drag` 与首页，元素不应先闪出再隐藏；应直接从 initial 帧入场。
2. **既有动画无回归**：drag 五幕入场/退场、scroll 各 zone scrub、waitFor 级联、infinite 循环。
3. **enterRef/exitRef**（如需现场验证）：暂未接入站点任何组件——本轮只交付框架能力，
   Scene5 的迁移等你确认 API 手感后再做。

## 待用户裁决

- Scene5 标题/副标题是否现在就迁到 `enterRef`/`exitRef`？（当前仍是 postMessage + CSS transition，
  且「PC 滚回 Act4 时不退场」的缺陷**尚未修复**——它需要父层补一条 zone 退场触发，
  与本轮框架能力是两件事。）
