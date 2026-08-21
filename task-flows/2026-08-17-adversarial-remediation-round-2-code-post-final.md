# Adversarial remediation round 2 — independent code post-final review

日期：2026-08-17

本报告是整改后的全新只读代码对抗复审。复审没有修改生产代码、测试或 dist；唯一新增的是本报告。审查依据为 `DESIGN.md` 的媒体单写者、scroll 单一 owner/热路径、Scene 生命周期及清理约束，并逐条回读当前工作树，而不是继承上一轮 PASS。

## 结论先行

整体不能收口为 PASS。媒体 readiness gate 仍有两个可达的代际竞态：同源 activation/residency 切换不清 readiness，旧终态事件可被新 activation 接受；source swap 后旧 `loadstart` 没有 source token，可先替新 generation arm，再放行旧 `play/pause/ended`。此外，scroll offset 仍通过 `useSyncExternalStore` 驱动 `ScrollbarOverlay` 每个变化帧进入 React；这与本轮“连续值脱离 React 热路径”的目标不符，且现有独立浏览器性能证据仍有 51–66ms Long Task。

## 确定性阻断

### F1 — 媒体同源 activation/residency 切换没有清 readiness（P1，FAIL）

相关代码：

- `src/media/VideoFrameRenderer.tsx:243-270`：`resetOwnership()` 只递增 `activationIdRef`、清 `pendingPlayRequestRef`，`release()`/`warmUp()` 都调用它；没有递增 `mediaGenerationRef`，也没有把 `readyMediaGenerationRef` 置空。
- `src/media/VideoFrameRenderer.tsx:451-459`：timeline 从 `ended`/`outgoingLatched` 重入 `entering` 时同样只递增 activation、重绑 listener 并 dispatch `activate`，没有撤销同 generation readiness。
- `src/media/VideoFrameRenderer.tsx:422-435`：readiness 只在 committed `src/objectUrl` identity 改变时置空；同 identity 且 `readyState >= 1` 时反而重新 arm。
- `src/media/VideoFrameRenderer.tsx:191-216`：`isReady()` 只检查当前 activation/generation 与 readiness generation，不检查资源或 residency epoch。

可达事件序列（用临时 retained-video seam 重放）：

1. A 已有 `readyState=1`，因此 generation 0 已 armed。
2. 调 `release()`：`video.pause(); removeAttribute('src'); load()`，媒体已变为未就绪；随后 `resetOwnership()` 把 activation 改为 1，但 readiness 仍为 generation 0。
3. 调 `warmUp()`：activation 改为 2、listener 重绑，仍没有清 readiness。
4. 在新的 `loadstart` 到达前派发 A 遗留的 `ended`（DOM retained 节点上的 queued event）。新 listener 的 `isReady()` 为真，reducer 收到 activation 2 的 `media-ended`，最新公共 `onEnded` 也被调用。

同一缺口还有一条不经过 release/warmUp 的 timeline activation 路径：native playback 活跃时，`exiting` frame 令 reducer 发出 `video.pause()` 并置 `outgoingLatched`，该 pause event 可尚在媒体任务队列；随后 `entering` frame 在 `:451-459` 新建 activation 并把 ownership reset 为 `framework-scrub`，但 readiness 仍对同一 generation armed。旧 pause 到达当前 listener 后以新 activation 身份被接受，公共 `onPause` 被调用，且 reducer 把新 activation 改为 `native-paused`。临时探针第三例随后把 frame 推到 scrub endpoint：正常 `framework-scrub` 应发 `play()`，被旧 pause 污染后实际没有发出，因而不只是错误回调，而是 ownership 状态已改变。

临时探针 `/private/tmp/cineview-video-gate-adversarial.test.tsx` 的第一、第三例分别重放上述 residency 与 timeline activation 序列；命令结果为 1 suite/4 tests PASS（用例断言错误行为确实发生，而非断言修复成功）。这不是 jsdom 的“旧闭包”误报：两例都由重绑后的当前 listener 接收事件。现有 `VideoFrameRenderer.test.tsx:799-849` 只断言 src/load/seek，没有 release 后旧 native terminal event 的断言；`:506-526` 只证明 ended 后重入可以 seek，没有覆盖上一 activation 已排队的 pause。

影响：视频从释放态恢复或 timeline 原地重启时，旧 `pause/ended/play` 可能改变新 ownership 状态、触发公共回调，或阻断/发出错误的 playback command；这违反媒体事件必须绑定 committed source/activation 的要求。

### F2 — 旧 `loadstart` 可替新 source generation 提前 arm（P1，FAIL）

相关代码：

- `src/media/VideoFrameRenderer.tsx:187-196`：`loadStart` 仅执行 `isCurrent()` 后写 `readyMediaGenerationRef.current = generation`，事件没有 source token、resource epoch 或 element identity 之外的可验证元数据。
- `src/media/VideoFrameRenderer.tsx:200-216`：play/pause/ended 只依赖上述 readiness。
- source swap 的 generation 递增与 disarm 在 `src/media/VideoFrameRenderer.tsx:424-430`，listener 仍绑定同一个 retained `<video>`。

可达序列：A 的 `loadstart` 与 `play` 已在 media-element task source 排队；React 提交 B，layout effect 将 listener 换成 B generation 并清 readiness；随后先由当前 B listener 看到排队的 A `loadstart`，再看到 A `play`。A 的 loadstart 通过 `isCurrent()` 给 B generation arm，A 的 play 随即通过 `isReady()`，B 的 `onPlay` 被错误调用并写入 B ownership。

临时探针第二例按同样顺序派发：先派旧 play（被拒绝），再派旧 loadstart、旧 play（B `onPlay` 调用 1 次）；与现有测试 `src/media/VideoFrameRenderer.test.tsx:593-670` 的覆盖正好互补——现有测试只覆盖“旧 play 在 loadstart 前到达”，没有覆盖“旧 loadstart 先 arm”。

注释 `VideoFrameRenderer.tsx:187-190` 声称 queued old events 会在新 generation 的 loadstart arm 前完成，但该保证只约束同一 task source 的顺序，不能让旧 loadstart 被当前 listener 识别为旧资源；当前实现仍把它当作新资源 arm。即使浏览器遵循 task FIFO，也存在“旧 loadstart → 旧 play”整段在 B 真正 loadstart 之前运行的窗口。

### F3 — scroll offset 仍逐帧进入 React（P1 性能目标未解决，FAIL）

相关代码：

- `src/components/CineView/useNativeScrollController.ts:354-441`：每个有效 native sync 都在 `:407-408` 写 `scrollOffsetRef` 与 `scrollOffsetStore.setSnapshot(resolvedOffset)`；`:438-440` 还每帧执行 `setScrollContentSpan` functional setter。
- `src/components/CineView/ScrollbarOverlay.tsx:47-51`：`useSyncExternalStore` 订阅该 store；`:223-230` 将 snapshot 直接写入 `aria-valuenow`，因此 offset 改变就是 React render 输入。

可达性探针仍是确定性的：临时 Jest 第四例向 `createScrollExternalStore` 写 0→10→20，`ScrollbarOverlay` 的 `aria-valuenow` 逐次改变，且 config getter 每次 render 递增一次。该结果证明该订阅不是“只保存在 ref”的假消费者，而是每个 changed offset 都会重新执行 Overlay 函数组件。生产 producer 在 `useNativeScrollController.ts:407-408` 每个有效 sync 调用同一个 setter。

这不构成第二个 progress 算法或第二个 native owner：native controller 仍是唯一计算者，frame store/scrollbar 只是消费者。但它仍违反本轮连续 scroll 值脱离 React 热路径的目标，并会叠加 Overlay render、React commit 与 `setScrollContentSpan` 更新成本。独立浏览器证据 `output/playwright/2026-08-17-remediation-round-2/scroll-boundary-baseline-summary.json`（2026-08-17 00:27）在 5 个新 context 中 4 次 FAIL，Long Task 为 51/66/59/60ms，最大 frame gap 50–66.7ms；关闭 scrollbar subscription 的诊断组仍有 58/62/63ms，说明 scrollbar 不是唯一根因，但不能据此宣称该热路径已经无成本。原始 `report-scrollPerformance.json` 也记录 53ms Long Task/50ms frame。

## 仍有残余竞态/边界（未足以推翻上述 FAIL，但不能静默忽略）

### F4 — frame lane 与 React snapshot lane 的发布顺序不是跨 lane 原子的（P2，需补证）

`src/components/CineView/useScrollSceneSnapshots.ts:198-309` 在 full refresh 中先 `frameStoreRef.current.setSnapshot(nextFrames)`（`:302-305`），再 `storeRef.current.setSnapshot(nextSnapshots)`（`:309`）。`ScrollSceneFrameStore.setSnapshot`（`src/components/CineView/scrollSceneFrameStore.ts:41-55`）会同步通知 `useScrollSceneEngine`/`SceneFixedLayer` 的 imperative subscribers；此时 React Scene 仍可能持有旧 layout/child，render-store 提交尚未发生。当前实现已正确消除空 frame 中间态，也没有发现第二个 progress writer，但 full refresh 仍可能出现一帧“新 frame 写入旧 DOM、随后 React layout 才换代”的跨 lane 窗口，需专门 seam/浏览器 trace 验证。

### F5 — pending play request 没有 generation 字段（P2，未覆盖）

`pendingPlayRequestRef` 在 `src/media/VideoFrameRenderer.tsx:144` 和 `:394-400` 只按 requestId 存取；source identity 的 generation 在 layout effect（`:422-435`）更新，而 `resetOwnership()`/清 pending 由 `[src]` passive effect（`:336-340`）触发。若 B 的 native `play` 在 layout effect 后、passive reset 前到达，它可能消费 A 的 pending requestId。现有测试在 `act/rerender` 中会先 flush passive effect，未覆盖真实 task 交错；应补 generation-scoped request seam，而不是假定 passive effect 总先于媒体任务。

### F6 — timeline context 仍保留半清理的可选字段（P2 清洁项）

`src/components/Scene/sceneScrollRuntime.tsx:76-102` 的 `SceneScrollZoneTimelineSnapshot`/`SceneScrollZoneTimeline` 仍暴露可选 `version`、`zoneStates`，而生产 `useScrollZoneRegistry.ts:237-247` 的 `zoneTimelineValue` 只提供稳定 keyed `store`。`useAnimateScroll` 主要从 `store` 读取；这些 optional 字段主要是兼容测试/回退，增加 API 与注释熵。不是本次功能阻断，但属于“半修分支/死字段”应在后续清理。

## 已回读且目前通过的部分

- Scene5 reducer：`site/src/components/scene5Lifecycle.ts:116-220` 对 offscreen late `finished`、generation、重复 `unfinished` 做了守卫；`freezeScene5Element` 在取消 animation 前复制 primitive computed values（`:227-241`）。`Scene5Cinema.tsx:374-452` 的 finite sequence 只有一个 last-wins owner，`:523-581` 的消息/IntersectionObserver 清理对称。未发现新的确定性 reducer 反例，但真实 iframe/IntersectionObserver 时序仍须独立浏览器确认。
- Stagger：`src/components/Animate/StaggerContainer.tsx:104-156` 以 phase revision 与 settled revision 绑定首个 commit；旧 timer 有 cleanup/token guard。没有把连续 MotionValue 重新塞进 React；定向 `StaggerContainer.test.tsx` 通过。
- BackgroundRibbon：`site/src/components/BackgroundRibbon.tsx:33-126` 的 attach/detach、MutationObserver、ResizeObserver 与 root LUT 清理对称，且同 pathname 容器替换有 listener 迁移；未发现新的 observer callback race。
- Reduced motion：`site/src/hooks/usePrefersReducedMotion.ts:1-24` 的现代/legacy listener 与卸载清理正确；站点未发现静态 `PREFERS_REDUCED` 残留或直接 import framer-motion 的站点组件。Scene5 CSS 的有限 keyframe 受 `@media` 影响，但其 layout transition/Animate scrub 是否应在 OS 偏好切换时即时归零仍应留给浏览器专项，不将静态检查夸大为体验 PASS。

## 六项强制回答

1. **是否真正解决原问题？** 否。媒体 readiness/source 隔离仍可被上述两条事件序列绕过；scroll 连续 offset 仍有 React consumer，且真实性能长任务尚未消失。
2. **是否改变既有语义？** 有。Scene5 收拢阈值被统一改为 0.85、收尾层改为 finished latch + CSS finite entrance、scroll 连续值改为 frame/imperative lane；这些是本轮有意裁决，但跨 lane 发布顺序与媒体 release/warmUp 的新时序尚未证明等价，且媒体错误事件会造成实际语义改变（错误 `onEnded/onPlay`、错误 ownership）。
3. **是否引入第二状态写者/竞态/时序回归？** 未发现第二套 progress 计算器；native controller 仍是唯一 progress writer。发现 readiness gate 的 activation/generation/readiness 三者不同步、旧 loadstart 可 arm 新 generation，以及 frame-store 先于 render-store 的跨 lane 时序竞态；ScrollbarOverlay 是额外 React 消费者而非第二 owner。
4. **未覆盖失败路径是什么？** release→warmUp 同源旧 terminal event；outgoing pause→同源 entering reactivation 的旧 pause；source swap 的旧 loadstart→旧 terminal event；layout effect 与 passive reset 间的 pending play request；full refresh 时 frame consumer 与 React child/layout 的交错；scrollbar disabled/无订阅下仍存在的真实 warm-scroll Long Task 根因；Scene5 真实 iframe message task 与 OS reduced-motion 运行时切换。
5. **是否有死代码、重复逻辑、半修分支？** 有半修的 media readiness（generation gate 已有，但 loadstart 无 token、release/warmUp 与 timeline activation 均不 disarm）；scroll offset store 与 `setScrollContentSpan` 仍在每帧路径；timeline context 的 optional `version/zoneStates` 与旧注释/回退字段仍增加熵。未发现新的临时 probe/flag 进入生产默认路径。
6. **明确 PASS 还是 FAIL？** 代码整改不能收口；判定为 FAIL，见文末单独 verdict。

## 本轮命令证据

- `pnpm test --runInBand src/media/VideoFrameRenderer.test.tsx src/media/videoPlaybackOwnership.test.ts src/components/CineView/ScrollSceneStack.test.tsx src/components/CineView/useScrollSceneSnapshots.test.tsx src/components/CineView/DirectScrollCineView.test.tsx src/components/Animate/StaggerContainer.test.tsx src/__tests__/site/scene5Lifecycle.test.ts src/__tests__/site/backgroundRibbon.test.tsx src/__tests__/site/usePrefersReducedMotion.test.tsx` → **9 suites / 195 tests PASS**（仅 Node punycode deprecation warning）。这些绿灯没有覆盖 F1/F2 的临时事件序列。
- `pnpm type-check` → PASS（0 errors）。
- `pnpm exec eslint src/media/VideoFrameRenderer.tsx src/components/CineView/useNativeScrollController.ts src/components/CineView/ScrollSceneSlot.tsx src/components/CineView/useScrollSceneSnapshots.ts src/components/CineView/scrollSceneFrameStore.ts site/src/components/Scene5Cinema.tsx site/src/components/scene5Lifecycle.ts site/src/components/BackgroundRibbon.tsx site/src/hooks/usePrefersReducedMotion.ts src/components/Animate/StaggerContainer.tsx` → PASS（0 errors/warnings）。
- 临时反例命令：`pnpm exec jest --runInBand --runTestsByPath /private/tmp/cineview-video-gate-adversarial.test.tsx --config '{"preset":"ts-jest","testEnvironment":"jsdom","roots":["/private/tmp"],"setupFilesAfterEnv":["/Users/alienmu/Documents/alien/cineView/cineview/src/setupTests.ts"],"moduleDirectories":["node_modules","/Users/alienmu/Documents/alien/cineView/cineview/node_modules"]}'` → **1 suite / 4 tests PASS**。四例分别重放同源 release/warmUp stale ended、旧 loadstart arm 新 generation、outgoing pause 污染新 timeline activation、ScrollbarOverlay offset store 逐帧 React render；这里的 PASS 意味着反例序列按预期复现。
- 浏览器性能证据：`output/playwright/2026-08-17-remediation-round-2/scroll-boundary-baseline-summary.json` 与 `report-scrollPerformance.json`，详见 F3；诊断 A/B 仅用于排除“scrollbar 是唯一根因”，不构成性能 PASS。

VERDICT: FAIL
