# Act5 分栏标题/副标题：框架事件触发型退场能力普查（只读）

任务：CineView 现有能力能否承载 `Scene5Cinema.tsx` 右栏标题/副标题的**事件触发型**退场动画。
判定标准：每项给 CONFIRMED / REFUTED + file:line 证据。本文件不含任何代码改动。

---

## 1. enterRef / exitRef 手动控制

### 1a. exitRef 触发退场的精确语义 —— CONFIRMED（立即 tween，非 Promise/回调）

`src/components/Animate/useAnimateScroll.ts:761-764`：

```ts
const triggerManualExit = useCallback((): void => {
  manualExitUsedRef.current = true;
  runExitTween();
}, [runExitTween]);
```

`runExitTween`（`useAnimateScroll.ts:483-506`）立刻 `setPhase('exiting')` + `animate(visualMotion, -1, { duration: exitDuration/1000 })`，
onComplete 时 `setPhase('exited')`。契约文档（`src/types/index.ts:542-543`）：
「调用 `exitRef.current()` 时：立即播放退场动画，打断任何正在等待的入场」。

- **不是 Promise、不是回调**：ref 就是一个 `() => void` 触发器（`types/index.ts:560` `exitRef?: React.MutableRefObject<(() => void) | null>`）。
- **可逆**：`triggerManualEnter`（`useAnimateScroll.ts:749-752`）会清掉 `manualExitUsedRef`（注释：
  「消费者重新要求它出现 ⇒ 解除上一次手动退场的所有权，否则再也回不来」），enter↔exit 可以无限往返。
  手动调用打断语义 = 「丢弃剩余等待并立刻播放」（`DESIGN.md:170`），fresh `animate()` 在同一 MotionValue 上
  supersede 旧 tween（token bump 使旧 onComplete 变 no-op，`useAnimateScroll.ts:744-748` 注释）。

### 1b. 触发期间元素是否留在 DOM —— CONFIRMED（永不卸载）

Animate 组件本身**没有任何按 phase 卸载 children 的路径**。`Animate.tsx:907-957` 的所有渲染分支
（早退 / scroll / drag）都无条件渲染 motion 包装层；退场只是把 `visualMotion` tween 到 `-1`
（exit 分支的视觉态），phase 终态 `'exited'` 也只是 MotionValue 上的一个值。
DOM 移除的唯一路径是消费者在 `'exited'` 之后自己 unmount（本场景不需要——标题常驻）。

### 1c. 与 scroll takeover scene 的共存：手动控制可用条件 —— CONFIRMED（有精确开关）

轨道支持矩阵（`task-flows/2026-08-12-fouc-enterref-exitref.md:55-65` 与 `DESIGN.md:172`）：

| 轨道 | 手动控制 |
| --- | --- |
| visibility（scroll 模式下非 takeover 分支） | ✅ 支持 |
| arrival（drag + sceneControlled:false） | ✅ 仅 enterRef |
| scroll takeover（scrub） | ❌ 上报 INVALID_ANIMATION 并忽略 |
| drag scene-controlled（scrub） | ❌ 同上 |

**act5 标题恰好在支持的那条轨上**，机制如下：

`Animate.tsx:281-285` 的 driver 解析：

```ts
const { sceneControlled, ...rest } = normalizedSemantics.timeline;
const isSceneScroll = mode === 'scroll' && sceneControlled && Boolean(inheritedZoneId);
return { ...rest, driver: isSceneScroll ? 'scroll' : 'visibility' };
```

`timeline.sceneControlled` 类型注释（`types/index.ts:477`）明确写了：
「**`false` + scroll 模式** → 强制独立走可见性闸门，**即使身处 zone 内也不被接管**」。

ref 认领也只给这条轨（`Animate.tsx:438-440` + `:672-673`）：

```ts
const isScrubLane = mode === 'drag' ? !isDragArrival : resolvedTimeline.driver === 'scroll';
const manualControlLane = mode === 'scroll' && !isScrubLane;
...
enterRef: manualControlLane ? enterRef : undefined,
exitRef: manualControlLane ? exitRef : undefined,
```

结论：**act5 标题是纯事件驱动、不在相位窗内——只要标 `timeline={{ sceneControlled: false }}`，
它就落在 visibility 时间轨上，enterRef/exitRef 全额可用**。memory「manual control only on time lanes」
对本场景不是限制而是前提条件，且该前提可以被一个 prop 满足。

### 1d. 手动退场的动画定义 —— CONFIRMED（exitAnimation + duration.exit，与常规一致）

`exitAnimation` 照常声明（preset 名或内联 variant），解析进 `exitVariant`（`Animate.tsx:601`），
visibility 轨的渲染把 `visualMotion -1` 映射到 exit variant 的终态帧。
时长由 `duration.exit` 控制（`useAnimateScroll.ts:496` `duration: Math.max(exitDuration, 0) / 1000`）。
注意：只声明 exit 不声明 enter 是非法载荷（`Animate.tsx:571-579` 上报
「requires enterAnimation or infiniteAnimation」），所以标题必须 enter+exit 成对声明——这正好
就是本场景要的镜像编排。

---

## 2. scroll takeover scene 内的时间驱动轨：sceneControlled:false 降级路径

### 2a. 事件驱动元素仅靠 enterRef/exitRef 活着 —— CONFIRMED

`useAnimateScroll.ts:345-349`：

```ts
const hasManualEnter = Boolean(enterRef) && !isScrollDriven;
const hasManualExit = Boolean(exitRef) && !isScrollDriven;
const enterFallbackAuthored = Boolean(waitFor) || delay > 0;
const autoEnterSuppressed = hasManualEnter && !enterFallbackAuthored;
const autoExitSuppressed = hasManualExit;
```

- `enterRef` + 无 `waitFor`/`delay` → **永不自动入场**（回归测试
  `useAnimateManualControl.test.tsx:236-262`「never auto-enters when enterRef is passed without
  a waitFor/delay fallback」：gate 满足 120ms 后 opacity 仍为 0，调 ref 后变 1）。
- `exitRef` → 自动退场闸门关闭（同文件 `:310-339`：exit gate 满足后仍保持 entered，调 ref 才退场）。
- 即：元素可以完全不等 phase、不等 visibility，生死全由消费者的 ref 调用决定。

### 2b. visibility 配置会不会干扰（元素在视口内但要保持退场态）—— CONFIRMED（已被专门修复，有粘性所有权）

这正是 `manualExitUsedRef` 解决的问题（`useAnimateScroll.ts:353-358` 注释：
「元素还在视口里就被拉回来 ⇒ 手动退场必须同时认领入场闸门」）。
gate 决策点（`:698-708`）：

```ts
if (
  action === 'enter' &&
  !autoEnterSuppressed &&
  !manualEnterUsedRef.current &&
  !manualExitUsedRef.current
) {
  beginEnterAttempt();
  advanceEnterAttempt();
} else if (action === 'exit' && !autoExitSuppressed) {
  runExitTween();
}
```

回归测试（`useAnimateManualControl.test.tsx:341-375`「keeps a manual exit sticky while the element
is still inside the viewport」）：元素完全在视口内调 exitRef → opacity 0，之后再 flush 测量两轮仍 0。
还有两处防泄漏：首次测量的 above-top 揭示（`:641-644`）与冷启动静态兜底揭示（`:555-561`）
都检查 `autoEnterSuppressed`。

⚠️ 一个已知未闭环边角（与本场景**不相关**，记录备查）：`task-flows/2026-08-12` Phase 9 P2-6——
冷启动期间调 enterRef 可能被 firstSceneEnterActive 清零。act5 是末幕、非首屏场景，
`firstSceneEnterReady` 对它为 undefined，不走该分支。

### 2c. 镜像退场编排（waitFor 链）在手动控制下是否可用 —— CONFIRMED（半可用：exit 方向无 waitFor，用 stagger 表达）

- **waitFor 只作用于 enter 方向**：`beginEnterAttempt`（`useAnimateScroll.ts:426-461`）是唯一消费
  waitFor 的地方；`runExitTween` 无依赖等待。退场链无法用 waitFor 串。
- **stagger 对 enter/exit 双向生效**：`Animate.tsx:508-521` 的 `staggerExitTiming` 用同一
  `resolveStaggerTiming(..., 'exit')` 计算退场错峰；`ScrollStagger`（`Animate.tsx:857-866`）同时接收
  `variant`/`exitVariant`/`exitItemDurationMs`。
- 结论：标题+副标题的镜像退场可表达为**单个 Animate 包容器 + stagger**（`from: 'last'` 让退场从
  副标题开始、反向错峰，正好镜像入场的 `from: 'first'`），enterRef/exitRef 挂在容器上，
  一次调用两条文案各自错峰播。这是框架原生形状，无需串行 setTimeout。

---

## 3. Scene 级 transition.exitAnimation 在 scroll 末幕 —— CONFIRMED（管不到，也不该用）

- Scene 的 enter/exitAnimation 只在 scroll 模式解析（`Scene.tsx:416-418` 注释：
  「Scene-level transitions belong to scroll」；drag 下 dev 警告忽略）。
- 但消费方式（`useSceneRuntimeState.ts:39-47`）是 zone 相位函数：

```ts
if (scrollTimelineState.phase === 'exit') return hasExitAnimation ? 'exiting' : 'covered';
if (scrollTimelineState.phase === 'after') return hasExitAnimation ? 'parked' : 'covered';
```

  即 zone progress 推进到 exit/after 相位才触发——**仍是 scroll 位置的函数，不是事件**。
  末幕向下无后继（`Scene5Cinema.tsx:329-332` 注释：「末幕向下无后继，唯一退场路径是向上滚出」），
  反向滚动时 zone 反向 scrub 经过 exit 相位，Scene 级 exit 会播——但那是整幕容器的退场，
  与「子页发 unfinished 消息 ⇒ 右栏标题先退」的事件时序完全是两条链。
- 且 Scene exitAnimation 作用在场景包装层，**结构上够不到场景内部的右栏元素**（没有 props 把它
  定向到子元素）。对本问题：REFUTED 作为解决方案（存在但管不到、语义也不匹配）。

---

## 4. iframe 冻结时序与标题退场的独立性 —— CONFIRMED（正交，无冲突）

冻结 effect（`Scene5Cinema.tsx:333-354`）：IntersectionObserver 不可交时 → postMessage freeze +
`setStage('idle')`（卸载 iframe）+ `setSplit(false)`。

- 它卸载的是 `{stage !== 'idle' ? <iframe .../> : null}`（`:461-468`）——标题/副标题
  （`:486-489` 的 `.scene5-cinema__text-col`）**不在卸载路径上**，父场景 div 也始终挂载。
- 迁移后接线：freeze effect 里 `setSplit(false)` 的位置改为（或同时）调 `titleExitRef.current?.()`。
  唯一差异：CSS transition 是**瞬时切断**（元素已滚出视口，没人看见）；框架 exit tween 播
  `duration.exit` 毫秒时元素同样已离屏——离屏播 tween 是浪费但无害（`resolveInfiniteActive`
  只管 infinite，不管 exit tween；可对 exit 时长保持短值，如 300-400ms）。
- 关键正确性不变量：**标题退场不依赖 iframe 存活**。unfinished 消息路径（`:321-323`）在 iframe
  存活时触发；freeze 路径在 iframe 死后触发——两条路径都能调 exitRef，ref 调用与 iframe
  生命周期零耦合。反向路径退场「在不可见时发生/被瞬时切断」的报障由此解掉：退场锚定在
  消息事件上，在视口内播放。

---

## 5. 总结论

**(a) 现有 enterRef/exitRef 直接够用。无需框架增强。**

理由闭环：
1. act5 标题是纯事件驱动（postMessage），标 `sceneControlled: false` 即落在 visibility 时间轨——
   手动控制唯一支持的 scroll 轨道（§1c）。
2. exitRef = 立即播 exit tween、元素永不卸载、可逆、打断语义明确（§1a/1b）。
3. 元素在视口内保持退场态的粘性所有权有专门实现 + 回归测试（§2b）。
4. 镜像退场编排用容器级 stagger（`from` 反向）表达，框架原生（§2c）。
5. Scene 级 exitAnimation 与本问题无关（§3）；freeze 卸载不碰标题（§4）。

### 迁移草案（site 侧，供后续实现 agent 参考；本 agent 不改码）

```tsx
// props 形状：一个 Animate 包整个右栏容器（替代 text-col 的 CSS split 类切换）
const textColEnterRef = useRef<(() => void) | null>(null);
const textColExitRef = useRef<(() => void) | null>(null);

<Animate
  animateId="cinema-split-text"
  enterAnimation={splitTextEnterVariant()}   // 内联 variant：fade + translateY 微上浮（沿用现 CSS 观感）
  exitAnimation={splitTextExitVariant()}     // 镜像：fade + translateY 下沉（或同一 variant 反向关键帧）
  duration={{ enter: 600, exit: 400 }}
  timeline={{ sceneControlled: false }}      // ← 关键：身处 cinema-entrance zone 内但不进 scrub 轨
  stagger={{ each: 250, from: 'first' }}     // enter：标题先、副标题 250ms 后；
                                             // exit 自动镜像（resolveStaggerTiming 'exit' 分支反向错峰）
  enterRef={textColEnterRef}
  exitRef={textColExitRef}
>
  <div className="scene5-cinema__text-col" aria-hidden={!split}>
    <p className="scene5-cinema__title-text">{t('scene5.title')}</p>
    <p className="scene5-cinema__subtitle-text">{t('scene5.subtitle')}</p>
  </div>
</Animate>
```

**split state 与 ref 的接线**（消息 handler 与 freeze effect 两处）：

```ts
if (event.data === 'cineview-embed-finished') {
  setSplit(true);                       // aria-hidden + 手机位移仍由 state 驱动
  textColEnterRef.current?.();          // 标题入场（立即，打断兜底等待——本方案无 waitFor/delay，无兜底）
} else if (event.data === 'cineview-embed-unfinished') {
  setSplit(false);
  textColExitRef.current?.();           // 标题镜像退场，在视口内播放 ← 修的就是这条反向路径
}
// freeze effect（:350）的 setSplit(false) 旁补一行 textColExitRef.current?.()
// （元素已离屏，tween 离屏播完，无害；保持状态机一致）
```

**注意事项**：
- `sceneControlled: false` 后该 Animate 不再消费 zone 预算（`cinema-clock` 的 2200ms 预算不含它），
  zone 总预算不变。
- 不传 waitFor/delay ⇒ 永不自动入场，初次进幕标题保持 initial 帧直到 finished 消息——
  正好等于现在 split=false 的观感。
- 手机位移（`phone-slot.is-split` 的 gap transition，`Scene5Cinema.css:140-146`）是纯布局、
  一次性切换，不属 CLAUDE.md 规则 6 约束，可留 CSS 或一并迁 Position/Animate——本普查不展开。
- 退场反向错峰的顺序（副标题先出）由 stagger exit 分支天然给出；若验收要更精确的非对称时序，
  退而求其次：标题/副标题拆两个 Animate，各自 exitRef，`unfinished` handler 里
  `subtitleExit(); setTimeout(titleExit, 150)`（DESIGN.md:170 明示「需要延迟自行 setTimeout」）。

---

## 附：搜索过但未命中的路径（防猜测声明）

- 「按事件自动触发退场」的内建 prop（如 `exitOn` / `trigger`）——不存在；grep `src/types/index.ts`
  的 AnimateProps 全量字段，事件驱动唯一入口就是 enterRef/exitRef。
- Scene 级事件回调驱动子元素退场的通道——不存在；`callbacks.onVisibilityChange` 等只读信号，
  不回写动画。
