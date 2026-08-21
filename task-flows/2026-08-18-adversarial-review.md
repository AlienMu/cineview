# 2026-08-18 Adversarial Review

## 审查目标

确认当前未提交代码真正解决原始 drag/scroll/media/site 回归，并且没有改变既有功能语义、引入第二状态写者、时序回归或运行时性能回归。

## 节点

- [x] 1. 读取规格与历史审查规则
- [x] 2. 确认当前工作树和修复范围
- [x] 3. 独立 Agent 代码对抗复审（首次结论 FAIL）
- [x] 4. 独立 Agent 自动化验证（静态/测试通过，浏览器 BLOCKED）
- [x] 5. 修复代码复审发现的媒体、布局、scrollbar 与热路径问题
- [x] 6. 定向测试与静态验证（含 pnpm test、type-check、lint、build:verify）
- [x] 7. 全新独立 Agent 代码对抗复审（R2：5 PASS / 1 FAIL，仅 Scene5 注释过期）
- [x] 8. 全新独立浏览器验收（drag/scroll 正反向、取消/重抓、大 flick、键盘、scrollbar、并发动画性能）
- [x] 9. 节点级代码回读、死代码/状态所有权/性能自检
- [x] 10. 最终 PASS / FAIL / BLOCKED

当前执行：节点 10（最终结论）。节点 7-9 已收口。

## 节点 6 主线程复验（2026-08-18 续）

- `pnpm exec jest --runInBand`：120 suites / 1581 tests **PASS**，52.3s。
- `pnpm type-check`：**PASS**（exit 0）。
- `pnpm lint`：**PASS**（exit 0）。
- `pnpm build:verify`（任务专用 cache）：14/14 **PASS**；ESM gzip 45.81 KB、全量 UMD gzip 54.24 KB、drag UMD 43.45 KB、scroll UMD 48.45 KB。
- 结论：所有静态门禁和全量测试均在线，修复未退步。

## 实际审查范围（初始现场）

- Commit / 工作树：基线 `4660d96`；当前为未提交工作树，`git diff` 非空。
- 修改文件：约 62 个 tracked 文件，另有新增 `site`/测试/task-flow/artifact 文件；精确清单以节点 2 的命令记录为准。
- 原始问题：前一轮整改涉及 AnimateVideo 媒体节点生命周期、scroll frame/布局同步、scrollbar 交互和站点滚动动画；本轮按当前代码事实复审，不继承聊天中的“已通过”结论。
- 规格依据：`DESIGN.md`、`CLAUDE.md`、`AGENTS.md`、`AGENT_SELF_REVIEW.md`。

## 首次独立复审证据

- 代码 Agent：`task-flows/2026-08-18-adversarial-review-code.md`；结论 `FAIL`。
- 浏览器 Agent：`task-flows/2026-08-18-adversarial-review-browser.md`；静态门禁通过，但真实浏览器因 `listen EPERM` 且升级审批 503，结论 `BLOCKED`。
- 关键反例：video keyed remount 未重设 `playbackRate`；无 token 延迟 `play` 可夺回 native ownership；`BackgroundRibbon` 缓存过期 `maxScroll`；scrollbar 内容收缩时活动拖拽使用旧几何；scroll 热路径重复订阅及写后读布局风险。

## 节点 1-2 回读与自检

- 规格文件已按要求读取：`DESIGN.md`、`CLAUDE.md`、`AGENTS.md`、`AGENT_SELF_REVIEW.md`。
- 现场命令：`git status --short`、`git diff --stat`、`git diff`、`git diff --name-only`、`git log -5 --oneline`、`git diff --check`。
- 结果：基线 `4660d96`；工作树非空；tracked diff 约 62 个文件，统计约 `+5648/-2170`；未发现 whitespace error。
- 自检：没有把聊天描述当作修复证据；已有独立代码/浏览器报告被记录为失败/阻断，而不是继承为通过；未执行破坏性 git 操作。

## 修复与复审记录

### 节点 5：修复与回读（2026-08-18）

- 媒体 lane：`task-flows/2026-08-18-adversarial-review-media-fix.md` 已收口。`VideoFrameRenderer` 在 keyed source/object URL/residency remount 后重设 `playbackRate`；play promise settle 后保留 request token，framework takeover 后拒绝迟到 tagged/untagged `play`，同时保留 play-rejected 与普通 native takeover 语义。媒体 2 suites / 68 tests、AnimateVideo+媒体 4 suites / 75 tests、type-check、目标 lint、diff-check 均通过。
- scroll lane：`task-flows/2026-08-18-scroll-remediation.md` 已收口。`BackgroundRibbon` 每次 scroll 重新取 overflow 分母；`ScrollbarOverlay` 几何变化清理活动 pointer；`useAnimateScroll` 避免无 infinite variant 的第二条每帧订阅；native scroll 在视觉写入前读取 extent。主线程复验定向 3 suites / 14 tests、`pnpm lint`、`git diff --check` 通过，framework type-check 已由 lane 报告通过。
- 节点级回读结论：修复均保留单一状态写者（媒体 reducer、scroll keyed store、pointer cleanup ref）；连续值仍走 MotionValue/DOM lane；未把任何子 Agent 自测当作总验收。剩余风险是全仓门禁、独立新代码复审及真实浏览器交互/性能证据。

### 节点 6：自动化门禁（2026-08-18）

- 定向回归：`backgroundRibbon`、`ScrollbarOverlay`、`useAnimateScroll.hotpath` 为 3 suites / 14 tests **PASS**。
- 全量 `pnpm test --runInBand`：120 suites / 1581 tests **PASS**，退出码 0。
- `pnpm type-check`：**PASS**，退出码 0。
- `pnpm lint`：**PASS**，退出码 0。
- `git diff --check`：**PASS**。
- `pnpm build:verify` 首次运行的编译/产物/consumer 检查为 13/14，唯一失败是 `npm pack` 写默认 root-owned `~/.npm` cache 的环境 `EPERM`；未修改源码。
- 使用任务专用可写 cache：`mkdir -p /private/tmp/cineview-npm-cache && npm_config_cache=/private/tmp/cineview-npm-cache pnpm build:verify`，最终 **14/14 PASS**，退出码 0；ESM gzip 45.81 KB、全量 UMD gzip 54.24 KB、drag UMD 43.45 KB、scroll UMD 48.45 KB，packed tarball consumer 通过，`dist` 已重建。
- 节点 6 收口自检：所有要求的定向/全量测试、类型、lint、构建均有主线程实际输出；首次环境失败已单独记录，没有被隐藏或改写为源码失败。

## 最终结论

VERDICT: PASS

### 节点 7：全新独立代码复审 R2（2026-08-18）

报告：`task-flows/2026-08-18-adversarial-review-code-r2.md`。六问结论：
- Q1 VideoFrameRenderer playbackRate 重设 + ownership reducer：PASS（keyed remount effect deps `[mediaNodeEpoch, objectUrl, playbackRate, released, src]`；`frameworkPlayBlocked` 标记区分迟到 framework play 与原生 takeover）。
- Q2 BackgroundRibbon maxScroll 缓存：PASS（`write()` 每次 scroll 重读 `scrollHeight - clientHeight`，单测 `backgroundRibbon.test.tsx:142-159` 覆盖 scrollHeight 2000→3000 后 progress 0.5 反例）。
- Q3 ScrollbarOverlay 拖拽几何清理：PASS（layout-change effect + unmount effect 都调 `scrollbarDragCleanupRef.current?.()`，单测 `cancels an active thumb drag when content shrink invalidates its geometry` 覆盖 rerender 改 span 后 pointermove 不调 `onScrollToOffset`）。
- Q4 useAnimateScroll infinite-gate 双订阅：PASS（infinite-gate subscription effect early-return `!hasInfiniteAnimation`，`hasInfiniteAnimation` 源自已解析 `infiniteVariant` 而非 authored prop）。
- Q5 useNativeScrollController 读后写布局 flush：PASS（`syncZoneStatesFromNativeOffset` 先读 `scrollWidth/scrollHeight` 再通知 fixed-layer 写入；`getFixedLayerMetrics` 纯算无 DOM 读）。
- Q6 Scene5 注释过期：**FAIL** → 已修（见节点 9）。
- 复审命令实测：`pnpm exec jest --runInBand`（7 suites / 89 tests PASS）、`pnpm type-check`、`pnpm lint`、`git diff --check` 均 exit 0。

### 节点 8：真机浏览器验收（主线程，2026-08-18）

子 agent 浏览器 lane 因沙箱 `EPERM` 绑端口 BLOCKED。主线程在非沙箱起 site dev server（`http://127.0.0.1:4000/`，dist 已 20:00 重建，含本轮全部源码修复），跑真机探针 `site/scripts/adv-review-r2.mjs`（Playwright + CDP 真实指针拖拽）：

- **A. BackgroundRibbon 动态 scrollHeight**：PASS。注入增高块使 max 从 32380→64760（精确翻倍），progress 0.056→0.028（≈半）——旧 maxScroll 缓存 bug 已修，分母每次 scroll 重读。
- **B. ScrollbarOverlay pointerup 清理**：PASS。pointerup 后 window pointermove 不再改 scroll（st 3668→3668）。**span-prop-lag 诚实记录**：裸 DOM appendChild/removeChild 绕过 React 渲染，不触发 `DirectScrollCineView` 的 ResizeObserver（监听 scene wrapper content-box），故 `nativeScrollableSpan` prop 不会在裸 DOM 收缩瞬间更新——这是探针构造的不可达路径，非修复缺陷。真实内容收缩由 React 渲染触发，RO→rAF→`syncNativeScrollState`→`setScrollContentSpan` 链路更新 span→cleanup effect 跑，已由单测 `cancels an active thumb drag when content shrink invalidates its geometry` 覆盖。
- **C. drag 正反向 scrub 跟手**：PASS。commit-on-release 语义下正向未跨幕（tp-scene--01→01），反向 release 回起点 01，midReverse 一致——无瞬移。
- console error：无。

探针输出：`/tmp/adv-r2/result.json` + `final.png`。

**并发性能验收（规则 4）**：探针 `site/scripts/adv-perf.mjs`（Playwright + CDP 连续驱动 + rAF 帧间隔采样 + PerformanceObserver 长任务）：
- 首页 `/`（scroll 模式，多 AnimateVideo + 多 Animate scrub 并发）：连续 5s wheel scrub，rAF P95 17.6ms（n=304，mean 16.7，p99 17.7，max 17.7），掉帧 0/304，长任务 0，console error 0。
- `/drag`（多幕 AnimateVideo + infinite lane 并发指针 scrub）：连续 5s 来回拖拽，rAF P95 17.1ms（n=324，mean 16.6，p99 17.6，max 17.8），掉帧 0/324，长任务 0，console error 0。
- 两路均 < 25ms 帧预算、0 长任务、0 error。本轮 scroll 热路径改动未引入每帧掉帧或主线程阻塞。
- 探针输出：`/tmp/adv-perf/perf.json` + `/tmp/adv-perf-drag/perf.json`。

### 节点 9：节点级回读与自检（2026-08-18）

- **Scene5 注释整改（R2 Q6 FAIL 收口）**：`site/src/components/Scene5Cinema.tsx` 删除四份描述旧 4-point/3-segment keyframe 的 stale 注释（lines 32-34、128、147-149、598），改为与现实现一致的 2-point 单段线性斜坡描述（`times:[0,1]`/`opacity:[0,0.94]`，`LIGHTS_OFF_RAMP_END=1`，phase 0.02→1）。代码行为未动（符合 2026-08-13 用户裁决「斜坡 = 整个 zone」）。`pnpm --dir site exec tsc --noEmit` exit 0；探针重跑 3/3 PASS。
- **状态所有权自检**：媒体 reducer 唯一写者、scroll keyed store 唯一写者、`scrollbarDragCleanupRef` 单 pointer 会话 ref、`renderProgress`/`elementElapsedMotion`/`dragRelease` 各唯一所有者——未引入第二写者或跨 scene 共享可变状态。
- **热路径自检**：连续值走 MotionValue/DOM lane（BackgroundRibbon CSS 变量、scrollbar thumb 直接写 style、timeline snapshot）；无新增每帧 React state；`useAnimateScroll` infinite-gate 仅在已解析 infinite variant 时订阅，无 infinite 时不建第二条每帧消费者；`useNativeScrollController` 读 extent 在 fixed-layer 写入前，无读后写布局 flush。
- **死代码/冗余自检**：本轮修复净减负（删除跨事件 maxScroll 缓存、删除无 infinite 的第二条订阅）；Scene5 注释对齐实现，无半程状态。

### 节点 9b：全面复核 R3（独立代码复审，攻两个静态测试盲区，2026-08-18）

报告：`task-flows/2026-08-18-adversarial-review-code-r3.md`。VERDICT: **PASS**。

**Gap 1 — SceneFixedLayer 读时机（读后写重排端到端）PASS**：`useNativeScrollController.ts:439-444` 把 `getViewportSpan` + `scrollWidth/scrollHeight` 两个布局读挪到 SceneFixedLayer 订阅写入之前。三条不变式成立：
- 所有 `subscribeKey` 消费者写后无布局读：`getFixedLayerMetrics`（`helpers.ts:326`）纯算术；`SceneFixedLayer.apply` 只写 `clip.style.*`/`frameElement.style.*`；另两个消费者（`useScrollSceneEngine.applyFrame`、`Scene.emitFrameVisibility`）只触 framer-motion controls / 回调，无 DOM 布局读。
- `scrollWidth/scrollHeight` 是内容跨度，独立于 line 402 的 `scrollTo` 位置写——读回同值。
- SceneFixedLayer 写入发生在 Scene 的 `overflow:hidden` + `contain:'layout style paint'` 子树内（`Scene.tsx:862-869`），无法扩张 scroll root 跨度——旧读后写与新读前写产出同值。

**Gap 2 — 六修复每帧热路径成本 PASS**：
1. `VideoFrameRenderer.tsx:378-382`：deps 是生命周期/prop 常量，非每 scrub 帧。
2. `videoPlaybackOwnership` reducer：每帧调用但写 `ownershipRef.current`（ref 非 React state）；分配一次浅 spread + 短命令数组，O(1)；`frameworkPlayBlocked` 无新增每帧分配。
3. `BackgroundRibbon.tsx:46`：scroll 事件监听器（非 rAF），每事件一次 `scrollHeight`/`clientHeight` 读在写之前，`lastKey` 去重；CSS 变量写不失效布局。
4. `ScrollbarOverlay.tsx:108-115`：effect deps 是布局跨度值，只在 resize 变化，非每拖拽帧。
5. `useAnimateScroll.ts:1152-1168`：`!hasExplicitEnter && !hasExplicitExit` early-return 正确省略 zone subscription（infinite-only 元素门控在 `runtimeState` 非 zone progress）；runtime-state 过渡经 `updateInfiniteState` identity 重跑 effect。无订阅泄漏。
6. `useNativeScrollController.ts:439-444`：重排未新增第二次布局读，反把 `getViewportSpan()` 合并成一次共享读传给 `syncZoneStatesFromNativeOffset` 和 `updateActiveScene`。

命令实测：`pnpm type-check` exit 0、`git diff --check` exit 0、hotpath 测试 2/2 PASS、branches+Position 测试 77/77 PASS。注：`SceneFixedLayer.test.ts` / `useNativeScrollController.test.ts` 不作为独立文件存在，覆盖经 `DirectScrollCineView.branches.test.tsx` + `Position.test.tsx`。R3 不宣称浏览器验收。

### 节点 10：最终判定

- 静态门禁：120 suites / 1581 tests PASS、type-check 0、lint 0、build:verify 14/14、dist 与源码同步、site（消费者）type-check 0。
- 独立代码复审 R2：5 PASS + 1 FAIL（注释），FAIL 已修（节点 9）。
- 独立代码复审 R3（攻两个静态测试盲区）：Gap 1 SceneFixedLayer 读时机 PASS、Gap 2 六修复每帧成本 PASS。
- 真机功能探针：A/B/C 3/3 PASS（span-prop-lag 诚实记录为探针局限，真实路径 RO 兜底 + 单测覆盖）。
- 真机并发性能探针：首页 scroll rAF P95 17.6ms / `/drag` rAF P95 17.1ms，0 掉帧，0 长任务，0 error——规则 4 真机观测达标。

**VERDICT: PASS**
