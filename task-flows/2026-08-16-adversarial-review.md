# 2026-08-16 Adversarial Review

## 审查目标

确认当前工作树中的修复真正解决原始问题，并且没有改变既有功能语义、破坏 drag/scroll 时序或引入新的运行时风险。本文件只记录本轮实际执行的证据，不继承历史 task-flow 的通过结论。

## 节点

- [x] 1. 读取规格与历史审查规则
- [x] 2. 确认当前工作树和修复范围
- [x] 3. 独立 Agent 代码对抗复审
- [x] 4. 定向测试与静态验证
- [x] 5. 独立浏览器验收尝试（BLOCKED，未通过）
- [x] 6. 节点级代码回读与性能自检（发现 FAIL；运行时数值观察 BLOCKED）
- [x] 7. 最终 FAIL（浏览器子门 BLOCKED）

## 节点 1：规格与规则证据

- 已读取 `DESIGN.md` 全文（2640 行）、`CLAUDE.md`、`AGENT_SELF_REVIEW.md`、`AGENTS.md`。
- 关键约束：状态唯一所有者、scroll/drag 必须独立真实浏览器验收、每节点完成后回读与性能自检。
- 规格重点：drag 双轨与 transaction、scroll center-lock 真实 px 段、Animate 手动 ref 只允许时间轨、视频媒体单写者。

## 节点 2：现场基线

- 工作目录：`/Users/alienmu/Documents/alien/cineView/cineview`
- 当前工作树：存在未提交修改和未跟踪文件；不是空 diff。
- 最近提交：`4660d96 feat: Animate 手动控制 + FOUC 修复；五幕视觉缺陷真机定位与整改`、`41aae22`、`27d40e8`、`a4005a9`、`f164470`。
- 初始 `git diff --stat`：43 个已追踪路径，约 `3234 insertions(+), 2185 deletions(-)`；另有未跟踪 stress/review/site/task-flow 文件。
- 初始修改面：站点视觉与探针；`Animate`/`AnimateVideo`/`StaggerContainer`/scroll hooks/runtime；`VideoFrameRenderer`；相关单测；历史 task-flow。

### 实际审查范围

- Commit / 工作树：以 `4660d96` 为最近提交基线，审查其上当前未提交工作树；没有假设任何聊天中未落盘的修复存在，也不继承历史 task-flow 的 PASS。
- 现场命令：`git status --short`、`git diff --stat`、`git diff --name-only`、`git diff --numstat`、`git diff`、`git log -5 --oneline`、`git diff --check`（exit 0）。
- 已追踪修改：43 个路径，`3234 insertions(+), 2185 deletions(-)`。其中框架生产 8 个、框架测试 8 个、站点/证据 26 个、历史 task-flow 1 个；另有未追踪 stress fixture、浏览器证据、站点组件、测试和 task-flow。
- 框架修改文件：`Animate.tsx`、`AnimateVideo.tsx`、`StaggerContainer.tsx`、`useAnimateScroll.ts`、`useNativeScrollController.ts`、`useScrollZoneRegistry.ts`、`sceneScrollRuntime.tsx`、`VideoFrameRenderer.tsx` 及对应测试/快照。
- 站点修改面：全局背景色带、首页五幕视觉/时序、Scene5 收尾层和 timer、drag 第五幕黑幕/纹理、CSS/token/i18n；删除旧 `HomeBackdrop` 与 `RecBadge`；新增 `BackgroundRibbon`、LUT、stress/review artifacts。
- 原始问题（由当前 diff 注释和对应 task-flow 还原）：动画预设解析期间 FOUC/fail-open；手动 `enterRef`/`exitRef` driver 所有权；stagger 已入场后切语言重播；scroll takeover 视频离场 decoded-frame 驻留；Scene5 黑屏/分栏/反向退出；drag 第五幕黑幕和纹理与 settle 同步；全站背景色带恢复。
- 规格依据：`DESIGN.md` 的 drag 双轨与 transaction、scroll center-lock、动画 driver/ref 归属、视频媒体单写者；`CLAUDE.md`/`AGENTS.md` 的独立浏览器门、状态唯一所有者和框架动画边界。
- 重要反证范围：`task-flows/2026-08-16-ponytail-remediation.md` 的 T1（scroll 视频 ended 后反向回收）仍是未勾选待修任务；当前 diff 未修改 `videoPlaybackOwnership.ts`，因此不能声称该原问题已落地修复。

### 待补证据

以下节点必须写入真实命令输出、独立 Agent 原文结论、失败案例、浏览器截图/探针路径后才能勾选：节点 4、5、6、7。

## 节点 3：独立代码对抗复审

- Agent：`/root/code_adversary`（独立代码审查者；未修改生产文件）。
- 独立报告：`task-flows/2026-08-16-adversarial-review-code.md`。
- Agent 执行：
  - `pnpm test --runInBand src/components/Animate/StaggerContainer.test.tsx src/media/VideoFrameRenderer.test.tsx src/media/videoPlaybackOwnership.test.ts`：3 suites、50 tests 全通过。
  - `pnpm type-check`：exit 0。
- Agent 明确结论：`FAIL`。

### 代码级反例与回答

- 修复是否真正解决原问题：否。`videoPlaybackOwnership.ts` 仍只允许 `gesture` 从 `ended`/`play-rejected` 终态恢复；普通 scroll 反向帧仍无法接管并 seek，已知反向视频问题仍在。
- 是否改变既有功能语义：是。`StaggerContainer` 的 `useSettledInstant()` 在 phase 保持 `animate` 的第二次普通渲染即把子项 transition 改成 `duration: 0, delay: 0`，进行中的 stagger 会被压平。
- 是否引入第二个状态写者、竞态或时序回归：发现 Scene5 多批 `unfinished` timer 共用并清空同一 timer ID 列表；旧批次完成回调可能丢失新批次 ID，并在重新打开后由陈旧回调再次关闭界面。视频滚动进度虽未发现第二写者，但终态所有权恢复规则不完整。
- 是否存在未覆盖失败路径：存在。视频 released 后换 `src`、仍在 `far` 时关闭 `releaseOnLeave`、`ended + source: 'scroll'`、stagger phase 内普通 rerender、Scene5 重复 unfinished/finished 均无对应回归测试。
- 是否有死代码、重复逻辑或只修一半的分支：视频 release/warm-up 仅覆盖同源手动恢复，换源/关闭 release 配置分支只修一半；站点另有框架外 DOM rAF、直接运行时导入 framer-motion、CSS keyframe 与 Animate/inline timer 多所有者编排。
- 性能：active scroll 的 `progressPx` 每帧跨 external store 和 React/effect 边界，导致 `Animate` runtime 对象及两个 effect 每帧重建；`getViewportSpan()` 还在逐 zone 热循环中读取布局。独立浏览器性能数据尚待节点 5。

### 节点 3 回读与自检

- 已回读独立报告的代码引用、输入序列和证据边界；报告没有把 50/50 定向单测或 type-check 绿灯误报为行为通过。
- 已确认该 Agent 没有修改生产代码，结论不依赖实现者自证。
- 已确认至少五项 P1 反例足以否定当前候选修复；真实浏览器证据仍须由另一个独立 Agent 补齐，不能用代码审查替代。

### 主线程最小 reducer 反证

- `pnpm exec esbuild src/media/videoPlaybackOwnership.ts --bundle --platform=node --format=cjs --outfile=/private/tmp/cineview-video-ownership.cjs`：失败，项目未暴露 `esbuild` 可执行入口；未写仓库文件。
- `pnpm exec tsc src/media/videoPlaybackOwnership.ts --target ES2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --outDir /private/tmp/cineview-ownership-build`：exit 0；仅输出到 `/private/tmp`。
- 对编译后的同一 reducer 依次派发 `media-ended` 与 `timeline-frame { source: 'scroll', progress: 0.6, phase: 'entered', duration: 10, scrubRange: [0, 6]`。
- 实际 JSON：`{"state":{"activationId":1,"status":"ended","activePlayRequestId":null,"nextPlayRequestId":1,"lastSeekTime":null,"endpointLatched":true,"outgoingLatched":false,"frameworkPausePending":false},"commands":[]}`。
- 结论：scroll 反向输入没有产生 seek，终态仍钉在 `ended`；该失败是可执行反例，不是仅凭注释推测。

## 节点 4：定向测试与静态验证

### 稳定执行结果

- `pnpm test --runInBand src/components/Animate/Animate.test.tsx src/components/Animate/StaggerContainer.test.tsx src/components/Animate/animateVariantsPending.test.tsx src/components/Animate/useAnimateManualControl.test.tsx src/components/Animate/useAnimateScroll.phase.test.tsx src/components/CineView/useScrollSceneSnapshots.test.tsx src/components/Scene/sceneScrollRuntime.test.tsx src/components/Scene/sceneScrollApproach.test.ts src/media/VideoFrameRenderer.test.tsx src/media/videoPlaybackOwnership.test.ts`
  - exit 0；10 suites、227 tests 全通过。
- `pnpm type-check`
  - exit 0。
- `pnpm lint`
  - exit 0；0 error、0 warning。
- `pnpm test`（在构建完成、`dist` 稳定后串行重跑）
  - exit 0；114 suites、1510 tests 全通过。
- `NPM_CONFIG_CACHE=/private/tmp/cineview-adversarial-npm-cache pnpm build:verify`
  - exit 0；14/14 构建检查通过。
  - 已重新构建 `dist`；ESM gzip 43.20 KB，全量 UMD 51.43 KB，drag UMD 41.54 KB，scroll UMD 45.74 KB，均在各自预算内。

### 独立验证 Agent 的同节点结果

- Agent：`/root/validator_retry`，独立执行而非引用主线程输出。
- 定向 Jest：12 suites/232 tests + 4 suites/180 tests，均 exit 0。
- `pnpm type-check`：exit 0；`pnpm lint`：exit 0。
- `NPM_CONFIG_CACHE=/private/tmp/cineview-validator-npm-cache pnpm build:verify`：exit 0，14/14；由该 Agent 自己重建 `dist`。
- `pnpm test`：exit 0；114 suites、1510 tests、0 snapshots。
- 该 Agent 还独立运行纯 reducer 反例：terminal `ended` 后接 `source='scroll'`、`progress=.5` 返回 `status:'ended'`、`commands:[]`、`lastSeekTime:6`；与主线程反证一致，但不依赖主线程报告。

### 失败案例与处置

- 首次将 `pnpm test` 与 `pnpm build:verify` 并行执行：全测 exit 1，112/114 suites 通过、1495 tests 通过，两个站点 contract suite 在构建替换 `dist` 的窗口报 `Cannot find module 'cineview'`。这次失败由验证命令间读写竞态造成；待构建结束后串行重跑为 114/114、1510/1510。
- 首次 `pnpm build:verify`：13/14，通过所有产物、大小和 consumer smoke 检查，仅 packed tarball consumer 因 `/Users/alienmu/.npm` 中 root-owned cache 文件报 `EPERM`。未修改用户缓存权限；改用本轮独立临时 cache 后重跑为 14/14。

### 节点 4 回读与自检

- 已确认稳定结果来自串行执行，不再与 `dist` 重建互相干扰；失败输出和恢复命令均保留，未把首次失败抹去。
- 全部自动化绿灯只能证明现有断言和构建契约通过，无法反驳节点 3 的未覆盖反例；尤其 stagger 普通 rerender、视频 released 换源、`ended + scroll`、Scene5 timer 竞态仍没有对应测试。
- 构建产物已刷新，可供独立浏览器 Agent 验收当前源码对应的真实 `dist`。
- 两个独立执行者的静态结果一致，仍不能替代下一节点的真实 Chromium 交互；尤其浏览器尚未证明 release/warm-up、键盘/scrollbar、大 flick 和并发动画性能。

## 节点 5：独立浏览器验收（BLOCKED）

### 独立 Agent 与报告

- 主验证 Agent：`/root/validator_retry`；报告：`task-flows/2026-08-16-adversarial-review-browser.md`；结论：确定性 reducer `FAIL` + 浏览器 gate `BLOCKED`。
- 备用浏览器 Agent：`/root/browser_fallback`；报告：`task-flows/2026-08-16-adversarial-review-browser-fallback.md`；结论：浏览器 gate `BLOCKED`。
- 两个 Agent 均未修改生产代码，且没有读取或继承旧截图/历史浏览器 PASS。

### URL、服务与环境证据

- 项目实际路由：scroll 站点为首页 `/`，drag 为 `/drag`（HashRouter 浏览地址分别计划为 `http://localhost:4000/` 与 `http://localhost:4000/#/drag`）；当前站点没有独立 `/scroll` route。
- `lsof -nP -iTCP:4000 -sTCP:LISTEN`：发现 PID 32564、node、`[::1]:4000`；`lsof -a -p 32564 -d cwd -Fn` 证明 cwd 是本仓库 `site`，但 `ps` 被 sandbox 拒绝，无法证明启动时间/命令/本轮 dist provenance，因此未把它视为合格验收服务。
- `curl -sSI http://localhost:4000/`：exit 7；IPv6 curl 与 `nc -vz -6 ::1 4000` 同样被 loopback policy 拒绝。
- `pnpm --dir site dev --host 127.0.0.1 --port 4001 --open=false`：exit 1，`listen EPERM`；升级执行被平台 auto-review 配置错误拒绝。
- 备用 lane 的 `pnpm --dir site dev --host 127.0.0.1 --port 4013`：exit 1，日志 `/private/tmp/cineview-browser-fallback.log`，错误 `listen EPERM: operation not permitted 127.0.0.1:4013`；升级审批同样因 `codex-auto-review model_price_error` 失败。
- 备用 lane 对 3000/4000/4013 的 curl 均返回 HTTP `000`；Playwright wrapper/npx CLI 又因 `connect EPERM 127.0.0.1:7898` 无法获取 CLI。
- In-app Browser 导航 `http://localhost:4000/` 在创建 tab 前被 Auto-review security policy 拒绝，并明确禁止改用 127.0.0.1、其他浏览器面、raw CDP 或其他规避方式；两个 Agent 均遵守该限制停止重试。

### 未产生的浏览器证据

- URL：没有可访问、可证明对应本轮 dist 的真实浏览器 URL。
- 截图/JSON：本轮两个独立 browser lane 均未生成截图、trace、console/network JSON、帧 cadence 或 long-task artifact；旧 `site/review/**` 证据未被继承。
- 正向、反向、取消/重抓、大 flick、防跳过、键盘、scrollbar、多 zone 倒序、视频 release/warm-up/src swap/ended reverse、Scene5 timer race、多元素动画并发均保持**未做真实浏览器验收**。

### 节点 5 回读与自检

- 已回读两份独立报告与 `/private/tmp/cineview-browser-fallback.log` 路径；两者都没有把启动失败包装成页面结论。
- 浏览器节点已完成“尝试与取证”，但验收本身为 `BLOCKED`，绝不等价于 PASS；主结论必须保留此证据缺口。
- 独立验证 Agent 同时用当前源码 reducer 复现了 terminal-ended scroll 反向无 seek，因此即使浏览器 gate 被阻塞，当前候选仍已有确定性功能 FAIL 证据。

## 节点 6：节点级代码回读与性能自检

### 是否真正解决原问题

- **否，至少一项原问题有可执行失败证据。** `videoPlaybackOwnership.ts:140-146` 的 terminal reclaim 仍只接受 `gesture`；主线程与 `/root/validator_retry` 均将当前源码编译后实测 `ended + source:'scroll' + progress<1` 返回 `commands:[]`、状态仍为 `ended`。这直接违反 scroll scrubRange 从 100% 反向回 0% 的规格承诺。
- `StaggerContainer.tsx:34-39, 227-232, 288-300` 的 `useSettledInstant()` 以“phase 连续两次为 animate”作为完成条件，并在 render 中写 ref；正常 scroll progress 更新即可触发第二次 render，随后 `renderStaggerTree:130-137` 把所有 child duration/delay 置零。该条件并未区分真实 stagger 完成、普通 store rerender、被放弃的 concurrent render 或子树变化。
- `VideoFrameRenderer.tsx:193-224, 387-394` 的 `[src]` effect 不把 `released` 复位；已释放后换 src 仍渲染 `src={undefined}`。`AnimateVideo.tsx:116-135` 的 approach effect 在 `releaseOnLeave` 关闭且仍处于 `far` 时直接 return，也不会 warmUp。现有测试只覆盖同源手动 release/warmUp。

### 是否改变既有功能语义

- 是。为“已入场语言切换不重播”加入的 `settled` 判定扩大成所有 phase 内普通 rerender 的瞬时对齐，可能在正在播放的 stagger 中途消除作者声明的 delay。
- `releaseOnLeave` 新增了媒体 residency 状态和 `src` 摘除语义，但换源、配置切换和 approach 边界的恢复语义没有闭合；这不是单纯内部优化，而是可见视频行为变化。
- Scene5 收尾层同时由 `Animate` scrub、延迟 CSS keyframe 和 inline timer 控制；反向/重开路径不再是单一时间轴所有者。

### 状态所有权、竞态与时序

- scroll progress 的主要写者仍集中在 `useNativeScrollController.syncZoneStatesFromNativeOffset`，但每帧产生新 keyed zone snapshot；`Animate.tsx:524-532` 再按 `liveZoneState` 生成新 `scrollZoneRuntime`，`useAnimateScroll.ts:994-1013,1034-1097` 的 effect 因此逐帧 teardown/reinstall。
- Scene5 `splitExitTimersRef` 在每个 `unfinished` 消息追加新 timer；旧 completion 在 `:454-463` 把共享数组清空并关闭 `closing/split`，会丢失较新序列的 timer ID。一个旧 completion 可以在 `finished` 重新打开后再次关闭界面，属于第二个时序写者/竞态。
- 视频 renderer 的 `released` 只有 control handle 的 release/warmUp 两个写入点，没有发现第三个直接 writer；问题在于 src/prop 变化没有触发必要的恢复写入，而非把缺失当作所有权正确。

### 死代码、重复逻辑、只修一半

- `StaggerContainer.test.tsx` 从约 253 行缩为 45 行，删掉了 ScrollStagger/DragStagger 实际挂载、MotionValue change 和 derive 分支，仅保留两个纯 helper 断言；这使本次新增 render-time 判定没有 integration regression guard。
- 站点 `BackgroundRibbon.tsx:38-89` 新增 DOM `requestAnimationFrame` + CSS 变量写入，不符合项目仅允许 phase-gated canvas rAF 的豁免；`TemporalMotion.tsx` 直接导入运行时 `framer-motion`，Scene5 CSS keyframes 与 Animate/timer 形成重复动画所有者。
- `Animate.tsx` 仍 961 行、`useAnimateScroll.ts` 1127 行、`Scene5Cinema.tsx` 739 行；本轮触碰巨石文件却未抽离职责，风险已登记，不把类型/单测通过误当结构收敛。

### 每帧热路径与性能自检

- `useNativeScrollController.ts:251-300` 对每个 zone 计算 approach，并在循环内调用 `getViewportSpan()`；该函数读取 `root.clientHeight`（`useScrollViewport.ts:23-28`），存在每帧 layout read。
- active scroll 的 `progressPx` 每帧发布到 keyed external store（`sceneScrollRuntime.tsx:108-125`），进而触发 `Animate` runtime 对象重建和两个 effect 依赖变化；这与“仅 threshold crossing 发布”的注释不一致。多 `AnimateVideo`、stagger 和 infinite lane 并发时会放大 React/effect churn。
- `git diff --check` exit 0；未发现空白错误，但这不抵消上述行为/性能问题。
- 浏览器 lane 因环境 policy BLOCKED，故没有合法的 p50/p95、掉帧、long-task、视觉像素或真实 input 观测。静态分析只能标风险，不能声称已测得帧率回归。

### 节点 6 回读与自检

- 整改是否完成：**FAIL**，terminal-ended scroll 反例已由两个独立 Agent 和主线程 reducer probe 重现；stagger、媒体换源/配置切换、Scene5 timer 仍有未覆盖失败路径。
- 是否引入冗余：**FAIL/RISK**，同一 Scene5 收尾状态有 CSS、Animate、inline timer 三套控制，且新测试删除了真实订阅覆盖。
- 是否改变每帧开销：**静态风险确认，数值 BLOCKED**；新 approach 计算与 keyed store/effect 链条在每帧热路径，未能在真实浏览器取得掉帧数值。
- 是否存在未处理风险：**是**，见上列五项 P1 与站点边界问题；必须修复并重新获得独立 browser lane 后才有资格重新评审。

## 节点 7：最终结论

### 结论依据

- Agent A（`/root/code_adversary`）明确给出 `FAIL`，报告列出五项 P1 行为/性能缺陷与三项站点动画边界问题。
- Agent B（`/root/validator_retry`）独立执行 16 suites/412 tests、完整 1510 tests、type-check、lint、build:verify 14/14，并独立复现 terminal-ended scroll 反向无 seek；其整体结论为 `FAIL`，浏览器子门为 `BLOCKED`。
- 备用浏览器 Agent（`/root/browser_fallback`）独立尝试启动 4013 与 Playwright CLI，因环境 EPERM/安全策略 `BLOCKED`，没有伪造截图或性能结果。
- 自动化全绿不能覆盖已确认的状态机失败；浏览器缺失也不能把已确定的功能失败升级为 PASS。

### 收口自检

- 是否真正解决问题：否；terminal-ended scroll 反向可执行反例仍失败。
- 是否改变功能语义：是；stagger 普通 rerender 被瞬时化，releaseOnLeave 换源/配置切换恢复不闭合，Scene5 存在多所有者时序。
- 是否引入第二状态写者、竞态或时序回归：是；Scene5 共享 timer 数组的旧 completion 可关闭新重开状态；scroll runtime/effect 链路每帧 churn。
- 是否存在未覆盖失败路径：是；视频换源/far toggle、stagger subscription rerender、Scene5 duplicate unfinished/finished、真实 drag/scroll 输入与性能均缺回归证据。
- 是否有死代码/重复逻辑/只修一半：是；测试覆盖收缩、CSS/Animate/timer 三重控制、框架边界违规和未完成 video terminal 分支。
- 证据完整性：静态/自动化证据充分支持负面结论；真实浏览器证据因环境阻塞，所有正向视觉/性能断言均保持未声明。

### 最终结论

VERDICT: FAIL
