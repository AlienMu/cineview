# 2026-07-27 `waitFor` 活性修复与状态机审计

## 目标

修复普通 scroll 内容（visibility driver）下 `Animate.waitFor` 的确定性活锁、离屏迟发、非法依赖 fail-closed、leader 注销污染和跨 driver completion 语义不一致；同时建立异步状态机的活性审查门，防止再次出现“成功路径正确，但等待无法终止”的漏检。

本任务表是独立归档。生产修复已于 2026-07-27 落地：registry owner/generation lease、visibility `waiting` FSM、定向 recheck、非法依赖 fail-open、跨 driver 诊断与旧 completion bus 清理均已完成。真实 Chrome 验收与独立复审仍待具备相应工具/授权的后续会话执行。

## 约束

- `DESIGN.md` 是唯一有效规格；涉及 completion 语义、非法依赖策略和公共 phase 的变更，必须先更新规格或取得明确裁决。
- drag 与 Scene scroll-zone 的共享时间轴/真实滚动预算属于已验证语义，不得为修 visibility 而改写。
- scroll/drag 热路径继续保持 MotionValue 单写者、零 per-frame React state、零全 Scene completion 广播。
- 不使用任意时间超时猜测 leader 是否“永远不会完成”；missing/unregistered 必须由 registry 生命周期确定。
- 所有确认缺陷先建立 red proof，再修改生产代码。
- 修改 visibility 交互后必须由非实现 agent 在真实 Chrome 验收。

## 结论摘要

`waitFor` 没有被忽略。三个 driver 的实现不同：

| follower driver   | 当前实现                                                                | 活性结论                                                      |
| ----------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| drag              | registry 把依赖链折算为共享 element clock 的 `calculatedDelay`          | 有有限进度；缺失/循环会得到有限 fallback，不会运行时死等      |
| Scene scroll-zone | 依赖链折算进统一 scroll budget                                          | 有有限滚动进度；缺失/循环有限 fallback                        |
| visibility        | follower gate 命中后订阅 leader 的实际 enter completion，再等自身 delay | **没有终止性保证；缺失、循环、未进入 gate、注销均可永久等待** |

当前 visibility 启动条件实际上应为：

```text
dependencySatisfied
&& followerEnterGateStillValid
&& firstSceneEnterReady
&& ownDelayElapsed
```

但实现只在首次进入时检查 gate；leader callback 和 delay timer 都可直接启动 tween。

## 已确认缺陷

### W-F1 P0：合法但不可达的 leader 导致无限等待

位置：

- `src/components/Animate/useAnimateScroll.ts:344-391`
- `src/components/Animate/useAnimateScroll.ts:520-531`
- `src/components/Scene/useSceneAnimationRegistry.ts:192-207`

失败序列：

1. visibility follower 满足自己的 enter gate。
2. `runEnterTween()` 先把 phase 标成 `entering`。
3. follower 订阅已注册但永远不进入自身 gate 的 leader。
4. leader 永远不发布 completion，follower 永远停在 initial frame。

这里没有超时、不可达判断、注销通知或 fail-open 路径。

### W-F2 P0：missing / cycle 只报错，不解除 visibility 死锁

位置：

- `src/animations/registry.ts` 的 missing/cycle snapshot 与有限 delay fallback
- `src/components/Scene/useSceneAnimationRegistry.ts:59-117`
- `src/components/Animate/useAnimateScroll.ts:378-389`

失败序列：

- missing：`follower.waitFor='ghost'`，registry 报 `INVALID_ANIMATION`，但 follower 仍订阅一个永远不会发布的 key。
- cycle：A 等 B、B 等 A；两者都进入 `entering` 并互相等待。

该缺陷只存在于 visibility 的运行时订阅路径；drag/zone 当前会使用有限 fallback。

### W-F3 P0：等待期间离屏，无 exit 时仍会在视窗外迟发入场

位置：

- `src/components/Animate/useAnimateScroll.ts:83-97`
- `src/components/Animate/useAnimateScroll.ts:329-414`

失败序列：

1. follower gate 命中并等待 leader。
2. follower 离开 gate。
3. 没有 `exitAnimation` 时，`entering -> exit` 被 `hasExplicitExit` 阻止，订阅保留。
4. leader 后来完成，follower 在视窗外启动 tween。

有 exit 时 `runExitTween -> stopTween()` 会取消订阅；同一等待因是否 authored exit 而产生完全不同的活性语义。

### W-F4 P0：leader completion 与自身 delay 到期均不重新检查 gate

位置：`src/components/Animate/useAnimateScroll.ts:352-386`

两条确定路径：

- follower 等待 leader 时离屏，leader 完成回调直接 `launchAfterOwnDelay()`。
- leader 已完成后进入自身 delay，delay 期间离屏，timer 到期直接 `launch()`。

异步唤醒使用旧的 gate 结论，缺少重新测量。

### W-F5 P1：leader 注销不清 completion，也不处理等待者

位置：`src/components/Scene/useSceneAnimationRegistry.ts:162-169,179-207,212-229`

失败序列：

- leader 未完成就卸载：等待者留在 subscription map，永远等待，除非未来碰巧复用相同 ID。
- leader 完成后卸载：ID 仍留在 `enteredIdsRef`，后挂载 follower 被错误地立即放行。
- 同 ID 重挂：新实例继承旧实例的 completion 历史。

### W-F6 P1：visibility 与 zone 混用了“当前 entered”与“历史完成”

位置：

- visibility：`src/components/Animate/useAnimateScroll.ts:298-314`
- zone one-shot latch：`src/components/Animate/useAnimateScroll.ts:316-323,701-713`

visibility 每次离开 `entered` 都发布 false；zone 第一次完成后 reverse scrub 也不撤回。同一个 `waitFor` 因 leader driver 不同，在反向滚动时结果不同。

### W-F7 P1：等待不是独立状态，公开 phase 与真实运行状态不一致

位置：`src/components/Animate/useAnimateScroll.ts:298-391`

依赖尚未满足或 own delay 尚未结束时，phase 已是 `entering`，但 tween 根本没有运行。这使 exit/replay/infinite、调试信息和 render-prop phase 无法区分“等待获准”与“正在补间”。

### W-F8 P1（待红证）：首屏门复位未显式取消正在等待的异步工作

位置：`src/components/Animate/useAnimateScroll.ts:427-435`

`firstSceneEnterReady === false` 时会重置 visual/phase，但没有调用 `stopTween()`。若 ready 状态在已有 wait/timer 后失效，旧 subscription/timer 可继续唤醒。需要 red proof 确认实际可达性后随主 FSM 修复；在红证前不计入已确认缺陷数量。

### W-F9 P1：zone follower 静默忽略 visibility leader

位置：

- `src/components/Animate/useAnimateScroll.ts:605-649`
- `src/components/Scene/sceneScrollBudget.ts:73-145`

失败序列：

1. 同一 Scene 中 visibility leader 与 zone follower 都注册到通用 animation registry，因此静态校验不报 missing。
2. zone budget 只包含 zone animation；计算 follower 前驱时找不到 visibility leader。
3. budget 将缺失的 predecessor 按零长度处理，zone follower 从自身 delay 开始。
4. `waitFor` 被静默忽略，且没有 driver-mismatch warning/error。

相反方向 `visibility follower → zone leader` 已通过 registration lease 的单调 enter-completion 支持。`zone → visibility` 不新增动态跨轴能力；已明确判为 `incompatible-driver`、报告错误并 fail-open，不再静默忽略。

## 相邻生命周期风险（必须先红证，不能直接当作已修结论）

### C-A1：重复 ID 的注册 owner 不安全

`registerAnimate` 用单一 `Map.set(id, info)` 覆盖，`unregisterAnimate(id)` 无 owner token 地删除。可能序列：旧实例 A 注册 x → 新实例 B 注册 x → A cleanup 删除 x，B 的有效注册丢失。

建议红证：StrictMode、条件重挂、两个重复 ID 的 cleanup 次序。

### C-A2：duplicate 集合随任意一次 unregister 被清除

`duplicateIdsRef.current.delete(id)` 无法表达仍有多少 owner；当前单 Map 也无法恢复仍存活的实例。与 C-A1 一并迁移到 token/generation registration lease。

### C-A3：unsubscribe 后空 Set 留在 subscription map

当前 unsubscribe 只删除 callback，不删除空 key。单次 Scene 通常有界，但动态 ID/条件挂载可积累空集合。实现新 registry 时应清理并加计数断言。

### C-A4：动态修复后的 issue 去重生命周期

`reportedIssuesRef` 持续到 Scene 卸载；同一 issue 被修正后再次出现可能不再报告。属于诊断 episode 语义，随 generation/lease 设计裁决。

补充“类似状态机横扫”agent 未在约束内产出可用完整报告，已停止；上述候选只来自已核实源码与核心审查报告，必须以 red proof 决定是否进入修复。

## 为何上一轮没有查到

1. **只验证安全性，没有验证活性。** 测试证明 follower 不会早于 leader 播放，却没有证明每一次等待最终能完成、取消或降级。
2. **成功路径偏置。** 已覆盖 leader 完成、leader 已完成、同屏级联、zone leader 唤醒 follower；未覆盖 leader 永不进 gate、注销、missing、cycle 和离屏迟发。
3. **手写 phase bus 绕开生产 registry。** `useAnimateScroll.phase.test.tsx` 的 visibility waitFor 用例使用 `createPhaseBus()`；它不能暴露 registry issue 与运行时订阅之间没有联动的问题。
4. **错误用例被写成 characterization。** `useAnimateScroll.phase.test.tsx:1398-1457` 明确断言 leader 不发布时 follower 200ms 后仍 opacity 0；该测试证明“等待生效”，却把无终止策略固化成正确行为。
5. **弱断言 false-green。** 一批 `Animate.test.tsx` waitFor 用例只断言组件仍在 DOM、注册调用发生；DOM 存在不代表 animation phase 可达终态。
6. **Framer mock 折叠时间。** 既有注释已承认 mock 会同步跳到 target；这种环境无法观察真实 waiting/timer/tween 交错。
7. **文件分区掩盖组合缺陷。** registry 静态验证、visibility gate、zone latch 各自局部正确，但跨层组合后才出现活锁与语义漂移。
8. **高覆盖率不能证明时序状态空间。** 96% statements / 90% branches 仍未覆盖“事件不发生”、注销次序和 stale callback；行覆盖不是终止性证明。
9. **规格含糊。** DESIGN 写了“leader 若早已完成则立即放行”，但没裁决 exit 后是 current-entered、ever-entered，还是 replay epoch；两套实现因此都看似合理。
10. **审查模板缺少状态机义务。** 上轮要求具体失败场景，但没有强制每个异步状态机回答终止、取消、注销、错误降级与 stale callback 五项。

## 产品裁决（Wave 0，未裁决不得实现）

### D1：completion 语义

选项：

- current-entered：leader exit/re-enter 后 completion 撤回。
- ever-entered（推荐）：当前 registration generation 内完成过一次即成立，直到稳定注销/新 generation。
- epoch：每轮 replay/reverse 建立新周期。

**推荐 ever-entered per registration generation。** 它与 drag/zone 的顺序完成事实、zone one-shot latch 和 DESIGN“早已完成”最一致；epoch 是独立产品能力。

### D2：非法依赖策略

**推荐：报告错误 + production fail-open。** missing、cycle、duplicate、leader-unregistered、incompatible-driver 都不能永久隐藏界面；follower 跳过 dependency，只执行自身 delay 和 gate。

注意：若 DESIGN 其他章节仍规定非法依赖“阻止动画执行”，必须同步修正规格。

### D3：`waiting` 是否进入公共 phase

- 推荐内部与公共都增加 `waiting`，真实表达状态。
- 风险：对 exhaustive TypeScript switch 是源码 breaking，需要版本说明。
- 若本轮不能扩公共 union，可内部使用 waiting，公共暂映射为 idle；但这只能作为兼容过渡，不是最终语义。

### D4：依赖 scope 与跨 driver 支持

推荐：

- 同 Scene visibility → visibility：支持。
- visibility follower → zone leader：支持，消费 zone enter completion。
- zone follower → visibility leader：不支持；会破坏确定性的 px budget，应报告 incompatible-driver 并 fail-open。
- 跨 Scene或 Scene 外 waitFor：当前视为 missing scope，报告并 fail-open；若要支持，另建 root registry 产品能力。

### D5：leader 稳定注销

推荐：同一 React effect flush 内 cleanup/setup 合并；稳定注销后等待者收到 `leader-unregistered` 并 fail-open，不隐式等待未来同 ID 实例。

## 推荐架构

### 1. Registry registration lease

不要继续扩补 `markAnimateEntered(id, boolean)`。每次注册返回 owner-safe lease：

```ts
interface SceneAnimationRegistrationLease {
  readonly animateId: string;
  readonly generation: number;
  getCalculatedDelay(): number;
  observeWaitFor(listener: (outcome: WaitForOutcome) => void): () => void;
  publishEnterCompleted(): void;
  dispose(): void;
}

type WaitForOutcome =
  | { kind: 'pending'; leaderId: string; generation: number }
  | { kind: 'satisfied'; source: 'none' | 'completed'; leaderId?: string }
  | {
      kind: 'invalid';
      leaderId: string;
      reason: 'missing' | 'cycle' | 'duplicate' | 'leader-unregistered' | 'incompatible-driver';
    };
```

Registry 单一拥有 registration owner/generation、静态 dependency validity、completion、定向 subscriber 和 issue episode。completion 只允许当前 token 单调发布一次；旧 token 的 tween callback 必须被忽略。

### 2. Visibility `waiting` FSM

```text
idle/exited
  └─ gate eligible ─► waiting(dependency)
                         └─ dependency satisfied/invalid(fail-open)
                              └─ remeasure still eligible ─► waiting(own-delay)
                                   └─ delay elapsed
                                        └─ remeasure still eligible ─► entering
entering ─► entered
```

规则：

- waiting 时 visual 保持来源帧：首次为 0，exited replay 为 -1，被 exit 抢占时冻结当前负进度。
- waiting gate 失效：取消 subscriber、timer、scheduled recheck，返回来源 phase。
- dependency callback/timer 只能安排定向 visibility recheck，禁止直接启动 tween。
- unmount/first-scene hold/新 attempt 使用 token 使旧 callback 失效。
- 已经真正进入 `entering` 后，是否无 exit 时继续完成沿用现行语义；本修复只改变尚未开始的 waiting。

### 3. 定向 recheck，不做全局 fan-out

在 visibility scheduler 增加按 follower 合并到下一 rAF 的 recheck queue。completion 是稀疏事件，不应放入 React Context state 或 root-wide `useSyncExternalStore`；zone 每帧只在首次 crossing 发布一次。

## 实施任务表

### Wave 0：规格与行为冻结

- [ ] 裁决 D1–D5。
- [ ] 更新 `DESIGN.md`：completion、invalid fail-open、scope、waiting、replay。
- [ ] 写出兼容说明：公共 `AnimatePhase` 新增值的影响。
- [ ] 明确不在本轮实现 epoch/cross-Scene waitFor。

退出条件：所有产品语义无歧义，现有 drag/zone 数值语义冻结。

### Wave 1：先建立 red proof

新增生产 registry + visibility 联动测试，禁止只使用手写 bus：

- [ ] W-R1 合法 leader 已注册但永不进 gate：follower 为 waiting，可取消，不得永久 entering。
- [ ] W-R2 follower 等 leader期间离屏：有/无 exit 均取消本次等待。
- [ ] W-R3 own delay 期间离屏：timer 到期不得启动。
- [ ] W-R4 leader 完成时 follower gate 已关闭：不得启动；再入 gate 后可启动。
- [ ] W-R5 missing：报错一次并 fail-open。
- [ ] W-R6 两节点/三节点 cycle：报错且所有 follower 有有限结果。
- [ ] W-R7 leader entered 前稳定卸载：等待者收到 unregistered 并 fail-open。
- [ ] W-R8 leader entered 后卸载 + 同 ID 重挂：新 generation 不继承旧 completion。
- [ ] W-R9 duplicate owner cleanup：旧 owner cleanup 不删除新 owner。
- [ ] W-R10 firstSceneEnterReady 在 waiting 中失效：所有异步工作取消。
- [ ] W-R11 follower waiting 时卸载：subscriber/timer/rAF queue 为零。
- [ ] W-R12 stale leader completion callback：旧 token publish 被忽略。
- [ ] W-R13 StrictMode setup-cleanup-setup：无 phantom missing/duplicate/unregistered。
- [ ] W-R14 visibility leader exit/reverse 后，按 D1 的 completion 语义断言。
- [ ] W-R15 visibility follower → zone leader：只发布一次并正确释放。
- [ ] W-R16 zone follower → visibility leader：按 D4 报错并 fail-open。
- [ ] W-R17 same-screen cascade 与 leader-already-complete 成功路径不回归。
- [ ] D-R1/D-R2 drag calculatedDelay、bounce/reverse/settle 数值不变。
- [ ] Z-R1/Z-R2 zone budget start/end/total 与 reverse scrub 不变。

每个 red test 必须断言 phase、visual value、tween start 次数、subscription/timer/recheck 数量和 error 次数；禁止只断言 DOM 存在或最终 opacity。

### Wave 2：Registry lease 与 dependency outcome

- [ ] `registry.ts` 输出纯 dependency validity，不改变 calculatedDelay/timelineDuration 数值。
- [ ] `useSceneAnimationRegistry` 改为 token/generation records 与定向 subscriber。
- [ ] 注册变更在同一 macrotask 末稳定 reconcile，避免 StrictMode phantom issue。
- [ ] missing/cycle/duplicate/unregistered/incompatible 产生 terminal invalid outcome。
- [ ] invalid 报告与 fail-open 解耦；warning 去重不能吞掉运行时释放。
- [ ] completion 单调、owner-safe、generation-safe。
- [ ] 暂保旧 API adapter，先让原测试全绿，建立回滚点。

退出条件：registry 定向测试全绿；drag/zone 数值快照不变。

### Wave 3：Visibility waiting FSM

- [ ] 增加内部 waiting phase 与 attempt token。
- [ ] gate eligible 才创建 attempt；dependency satisfied 仅触发 remeasure。
- [ ] own delay 到期仅触发 remeasure。
- [ ] gate/firstSceneReady 失效统一取消 waiting。
- [ ] unmount 统一清 tween、subscriber、timer、scheduled recheck 和 lease。
- [ ] waiting 的 visual origin 规则覆盖 idle/exited/exiting。
- [ ] 按 D3 暴露或兼容映射公共 phase。

退出条件：W-R1～W-R14 全绿，无 per-frame React state。

### Wave 4：Cross-driver completion 与旧 API 清理

- [x] zone 首次越过 enter end 通过 lease 发布历史 completion。
- [x] reverse scrub 不重复 publish；语义服从 D1。
- [x] 实现 D4 compatibility matrix。
- [x] 删除 `enteredIdsRef`、`markAnimateEntered(id, false)` 和含糊旧 bus。
- [x] 全仓 grep 确认无旧 API。

退出条件：W-R15～W-R17、drag/zone 回归全绿。

### Wave 5：相邻生命周期候选红证

- [ ] C-A1/C-A2 owner/duplicate cleanup 次序。
- [ ] C-A3 空 subscription key 清理。
- [ ] C-A4 issue episode 再发生诊断。
- [ ] 横扫其他 subscriber/timer/completion latch：每项必须证明终止、取消、owner-safe cleanup、stale callback 抑制；无红证不改代码。

### Wave 6：独立复审与完整门禁

- [ ] 非实现 agent 复审 registry lease、FSM transition table、cleanup 与 driver compatibility。
- [ ] finding 修复后重新复审，直到无已确认未解决项。
- [ ] targeted tests、`pnpm type-check`、`pnpm lint`。
- [ ] `pnpm verify` 全门。
- [ ] site type-check/build。
- [ ] bundle-size、coverage、duplication、warning failure-injection 保持有效。

### Wave 7：真实浏览器验收

由非实现 agent 在新构建 dist + site 上验证：

- [ ] same-screen cascade 正确排序。
- [ ] follower waiting 时快速滚出/滚回，无离屏迟发、闪现或永久隐藏。
- [ ] leader 完成时 follower 已离屏；返回后按 D1/D2 继续。
- [ ] leader 条件卸载/重挂与同 ID 新 generation。
- [ ] visibility follower → zone leader；zone reverse scrub。
- [ ] replayOnReenter × 有 exit/无 exit。
- [ ] first-scene readiness 变更时无 stale callback。
- [ ] `#/drag` settle/bounce/reverse smoke，证明 registry port 迁移未改变 drag。
- [ ] React Profiler：completion 不引发 Scene 子树 fan-out。
- [ ] Chrome console 0 error；截图/数值证据归档。

## 防再发审查门

以后每个包含 subscription、timer、promise、RAF、event latch 或 registry 的状态机，review 必须逐项回答：

1. **终止性**：成功事件永远不发生时，状态如何结束？
2. **取消性**：输入 gate/props/ownership 失效时，所有异步工作是否取消？
3. **注销恢复**：依赖卸载、替换、重复 ID、StrictMode cleanup/setup 时怎么办？
4. **错误降级**：missing/cycle/invalid 是 fail-open 还是 fail-closed，规格是否明确？
5. **stale callback**：旧 generation 回调能否写入新实例？
6. **完成事实**：current state、ever completed 或 epoch，是否跨 driver 一致？
7. **弱断言禁令**：DOM 存在、注册被调用、最终 opacity 不足以证明活性。
8. **生产组合测试**：静态 validator、手写 bus 和 hook 单测不能替代真实 registry + driver 联动。
9. **负时间测试**：必须包含“事件不发生”“等待中离屏”“delay 中取消”“卸载后迟到”。
10. **热路径预算**：修复不得用全局 React state/fan-out 或 per-frame订阅扫描换取正确性。

## 消费端临时规避（框架修复前）

- visibility `waitFor` 仅用于可见窗口必然重叠、空间顺序保证 leader 先入 gate 的元素。
- 不对条件挂载、可能永不入屏、跨 Scene 或动态 ID 的 leader 使用 visibility waitFor。
- 跨视窗长序列放入同一 takeover zone、共享 Cue/stagger，或由消费端显式状态编排。
- `exitAnimation` 只能减少离屏残留订阅，不能解决 leader 不可达、missing 或 cycle。

## 当前状态

- [x] 用户现象与三 driver 语义重新建模。
- [x] 独立 agent 验证核心 visibility waitFor 活性缺陷。
- [x] 独立 agent 产出 lease + waiting FSM 修复设计与红证矩阵。
- [x] 漏检原因复盘与 D1–D5 裁决落入 `DESIGN.md`。
- [x] 核心 red proof：`waiting` 公开相位、依赖等待/own-delay 离屏取消、missing/cycle fail-open、late observer、owner/generation、跨 driver 与成功路径。
- [x] 生产修复：owner-safe lease、单调 generation completion、定向 recheck、可取消 waiting FSM、旧 entered bus 删除。
- [x] 完整 `pnpm verify`：94 suites / 1316 tests、coverage、type-check、lint、Prettier、site/examples、重复度与 failure-injection 全部通过。
- [x] `build:verify` 12/12：ESM 按格式拆出内部 runtime chunk，主入口 gzip 47.99 KB（目标 < 50 KB）；UMD 保持单文件且 gzip 44.35 KB，声明、exports、require/import、source map 与 packed-consumer smoke 均通过。
- [x] 系统 Chrome 真实验收：`/drag` 首屏链路、前进提交、反向返回、释放中快速重抓、非空白帧全部通过；修复后复跑仍为 console/page/network 错误 0。
- [x] 非实现 agent 独立只读复审：首轮确认 2 项活性缺陷，二轮补充 1 项低风险一致性缺口；三项均已修复并加入生产 registry 回归测试。最终复验重跑原始复现，结论为 `CONFIRMED FIXED — 0 remaining findings`。
