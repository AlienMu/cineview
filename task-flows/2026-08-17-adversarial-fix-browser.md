# 2026-08-17 Independent Browser Validation

## 角色与范围

- 角色：独立验证/验收 Agent；不读取或采用代码复审 Agent 的结论。
- 工作树：`4660d96` 加当前未提交改动；本次验证期间未修改产品源码。
- 规格依据：`DESIGN.md`、`CLAUDE.md`、`AGENTS.md`、`AGENT_SELF_REVIEW.md`。
- 目标 URL：`http://localhost:4000/#/scroll`（首页 scroll fallback route）与 `http://localhost:4000/#/drag`；视频专用 route 为 `/__acceptance/video-drag`。
- 浏览器要求：真实浏览器 lane；必须覆盖 scroll/drag 正反向、取消/重抓、大 flick 防跳过、键盘、scrollbar、多元素性能，以及 video release/warm-up/source swap/ended reverse。

## 工作树与环境证据

命令及结果：

```text
git status --short
M site/review/20260812/settle.json
M site/review/20260812/sweep.json
...（共 45 个 tracked path，另有多批 untracked 证据）

git diff --stat
46 files changed, 3659 insertions(+), 1939 deletions(-)

git log -5 --oneline
4660d96 feat: Animate 手动控制 + FOUC 修复；五幕视觉缺陷真机定位与整改
41aae22 chore: 保存动画整改前视觉基线
27d40e8 docs: 记录框架审核可复现基线
a4005a9 fix: 收口框架发布阻断并固化验收门
f164470 chore: 落地拖拽时序体验 + 原生指针拖拽层 + 站点重构快照
```

`site/vite.config.ts` 明确端口为 4000。环境中 `lsof` 曾看到 PID 32564 占用该端口，但 sandbox 内连接不可用：

```text
curl -I --max-time 5 http://localhost:4000/
curl: (7) Failed to connect to localhost port 4000 after 0 ms: Couldn't connect to server

pnpm --dir site dev --host 127.0.0.1 --port 4000
Error: listen EPERM: operation not permitted 127.0.0.1:4000
```

## 自动化验证（独立执行）

### 定向测试

命令：

```text
pnpm test --runInBand \
  src/components/CineView/DirectScrollCineView.test.tsx \
  src/components/CineView/DirectScrollCineView.branches.test.tsx \
  src/components/CineView/directScrollHelpers.test.ts \
  src/components/CineView/useScrollSceneSnapshots.test.tsx \
  src/components/CineView/useScrollZoneRegistry.test.tsx \
  src/components/CineView/scrollExternalStore.test.ts \
  src/components/CineView/useScrollInputBindings.test.tsx \
  src/components/Scene/sceneScrollApproach.test.ts \
  src/components/Scene/sceneScrollBudget.test.ts \
  src/components/Scene/sceneScrollBudget.branches.test.ts \
  src/components/Scene/sceneScrollRuntime.test.tsx \
  src/components/Animate/Animate.test.tsx \
  src/components/Animate/Animate.renderprop.test.tsx \
  src/components/Animate/Animate.semantic-bridge.test.tsx \
  src/components/Animate/StaggerContainer.test.tsx \
  src/components/Animate/animateVariantsPending.test.tsx \
  src/components/Animate/useAnimateScroll.gate.test.ts \
  src/components/Animate/useAnimateScroll.phase.test.tsx \
  src/components/Animate/useAnimateScroll.warning.test.tsx \
  src/components/Animate/useAnimateDrag.test.ts \
  src/components/Animate/useAnimateDrag.branches.test.ts \
  src/components/Animate/useAnimateDrag.scrub.test.ts \
  src/components/Animate/useAnimateManualControl.test.tsx \
  src/components/Animate/AnimateVideo.plumbing.test.tsx \
  src/components/Animate/AnimateVideo.test.tsx \
  src/media/VideoFrameRenderer.test.tsx \
  src/media/videoPlaybackOwnership.test.ts \
  src/__tests__/site/lastWinsTimerSequence.test.ts
```

结果：**28 suites / 515 tests PASS**。

### 类型、lint、构建

```text
pnpm type-check       PASS (exit 0)
pnpm type-check:site  PASS (exit 0)
pnpm lint             PASS (exit 0)
NPM_CONFIG_CACHE=/private/tmp/cineview-adversarial-npm-cache pnpm build:verify
PASS; build verification summary: 14/14 checks passed
```

构建产物在浏览器尝试前已重新生成，包含 ESM、UMD、drag/scroll 子入口、声明文件、gzip 与 consumer smoke。

### 完整测试

```text
pnpm test --runInBand
Test Suites: 115 passed, 115 total
Tests:       1537 passed, 1537 total
Snapshots:   0 total
```

## 真实浏览器尝试与阻塞证据

### Standalone Playwright

按 Playwright skill 检查 `npx`（存在）并调用本地 wrapper；随后用 site 依赖的 Playwright Chromium 做最小 launch probe。浏览器进程因 macOS sandbox/Mach-port 权限退出：

```text
browserType.launch: Target page, context or browser has been closed
FATAL: ... MachPortRendezvousServer... Permission denied (1100)
```

提权启动/连接请求也无法执行，平台返回 automatic approval review 的 model-price error；没有以其他通道规避。

### In-app Browser lane

按 Browser skill 初始化 Codex In-app Browser，并选择目标 URL。连接动作被浏览器安全策略拒绝：

```text
Browser Use rejected this action due to browser security policy.
Reason: Auto-review denied this action; ... cannot access http://localhost:4000
```

策略明确禁止改用 127.0.0.1、raw CDP、其他浏览器 surface 或间接执行，因此没有继续尝试绕过。

## 交互覆盖状态

以下项目均为 **NOT EXECUTED / 无真实浏览器证据**，不是通过：

| 路径 | 状态 | 截图/探针 |
| --- | --- | --- |
| scroll 正向 center-lock `0→100%` 与释放 | BLOCKED | 无 |
| scroll 反向重入 `100%→0%` | BLOCKED | 无 |
| scroll 中途取消/重新抓取 | BLOCKED | 无 |
| scroll 大 flick 防跳过 | BLOCKED | 无 |
| scroll 键盘路径 | BLOCKED | 无 |
| scroll scrollbar 路径 | BLOCKED | 无 |
| scroll 多元素动画掉帧/long task | BLOCKED | 无 |
| drag 正向提交 | BLOCKED | 无 |
| drag 反向提交 | BLOCKED | 无 |
| drag 中途取消/重新抓取 | BLOCKED | 无 |
| drag 大 flick / 边界回弹 | BLOCKED | 无 |
| AnimateVideo release/warm-up | BLOCKED | 无 |
| AnimateVideo source swap | BLOCKED | 无 |
| AnimateVideo ended 后反向接管 | BLOCKED | 无 |

没有截图、PerformanceObserver 探针、帧/长任务采样或 DOM 状态快照可以声称真实交互通过；单测结果不能替代这些证据。

## 独立结论

- 额外静态边界探针（不替代浏览器验收）：`rg -n 'requestAnimationFrame|cancelAnimationFrame' site/src` 命中 `site/src/components/BackgroundRibbon.tsx` 的 DOM rAF；该循环写 CSS 变量而非 canvas 自绘，按 `CLAUDE.md` / `AGENTS.md` 的硬规则需要专项处理或规格豁免。`site/src/components/temporal-drag/TemporalMotion.tsx` 直接 import `useReducedMotion` from `framer-motion`，同样命中站点禁止直接 import runtime framer-motion 的规则。`Scene5Cinema.css` 当前命中的 keyframes 均为一次性动画（未发现 `animation: ... infinite`），但其 timer/inline animation owner 仍缺真实浏览器证据。
- 自动化证据：PASS。
- 真实浏览器证据：缺失，原因是本机端口监听与浏览器安全策略双重阻塞；不是功能 PASS/FAIL 判断。
- 关键证据缺失时，按用户规则不能写“应该没问题”，也不能写 PASS。

VERDICT: BLOCKED
