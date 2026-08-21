# 2026-08-17 Adversarial Remediation Round 2 Browser Validation

## 角色与边界

- 角色：独立验证 Agent；未修改生产代码，未读取代码复审 Agent 报告来代签。
- 规格：已独立读取 `DESIGN.md`、`CLAUDE.md`、`AGENT_SELF_REVIEW.md` 与本轮主 task-flow。
- 浏览器：Playwright Chromium 1228 / Google Chrome for Testing，视口 `390x844`，真实 touch/CDP 输入。
- Site URL：`http://127.0.0.1:4000/` 与 `http://127.0.0.1:4000/drag`；站点端口依据 `site/vite.config.ts`。
- 证据目录：`output/playwright/2026-08-17-remediation-round-2/`。

## 自动化门禁

以下命令由独立验证 lane 执行，均通过：

```text
pnpm type-check
pnpm type-check:site
pnpm lint
pnpm test --runInBand src/__tests__/site src/components/Animate/StaggerContainer.test.tsx \
  src/components/Animate/animateVariantsPending.test.tsx \
  src/components/Animate/useAnimateScroll.hotpath.test.tsx \
  src/components/CineView/ScrollSceneStack.test.tsx \
  src/components/CineView/useScrollSceneSnapshots.test.tsx \
  src/components/Scene/useScrollSceneEngine.test.ts \
  src/media/VideoFrameRenderer.test.tsx src/media/videoPlaybackOwnership.test.ts
NPM_CONFIG_CACHE=/private/tmp/cineview-adversarial-npm-cache pnpm build:verify
```

- 定向 Jest：18 suites / 140 tests PASS。
- `pnpm type-check`：PASS。
- `pnpm type-check:site`：PASS。
- `pnpm lint`：PASS，无 error/warning。
- `build:verify`：PASS，14/14；ESM gzip 44.93 KB，full UMD gzip 53.23 KB，drag UMD gzip 42.93 KB，scroll UMD gzip 47.58 KB；`dist` 已重新生成。

## 框架真实浏览器 fixture

命令：

```text
SCROLL_ACC_PORT=4320 pnpm --dir examples/performance-test acceptance:scroll
ACC_PORT=4321 pnpm --dir examples/performance-test acceptance:drag
```

结果：

- Scroll：PASS。正向 center-lock `0 -> 100%` 并释放；大 flick 被钳到 `0.000833` 的段内帧，没有跳过；键盘、touch、native reconciliation、scrollbar 正反向均通过；zone A/B 正向完成、反向重入并回到 `0`；Long Task `0`。
- Drag：PASS。candidate tap 不抢 ownership；pointer cancel 恰好一次；tap resume 与 rush re-grab 保持 page/video 基线；forward commit 恰好一次；blocked direction 不增加 commit；Long Task `0`。

## 官网 Drag 验收

最终静默重跑命令（前一轮与 Agent Jest 执行重叠的样本已丢弃）：

```text
node output/playwright/2026-08-17-remediation-round-2/acceptance.mjs dragPerformance
```

证据：`output/playwright/2026-08-17-remediation-round-2/report-dragPerformance.json`、`drag-forward-scene-5.png`、`drag-reverse-scene-4.png`。

- 功能：PASS。真实 touch 路径覆盖取消、正向 `0 -> 1 -> 2 -> 3 -> 4`、反向回 `3`。
- Warm 性能：PASS。本次新上下文且清空冷启动样本后，Long Task `0`，最大 rAF gap `33.3ms`，无 `>50ms` gap。
- 控制台错误 / page errors：0 / 0。

## 官网多元素 Scroll 性能

最终静默重跑命令：

```text
node output/playwright/2026-08-17-remediation-round-2/acceptance.mjs scrollPerformance
```

证据：`output/playwright/2026-08-17-remediation-round-2/report-scrollPerformance.json`、`scroll-multi-element.png`。

- 真实首页 `/`，冷启动等待后清空 Long Task/rAF 样本，连续 wheel 穿过多幕、多元素动画并发。
- 结果：**FAIL**。Long Task `[53]` ms，最大 rAF `49.3ms`，因此不是冷启动或旧样本继承。
- 控制台错误 / page errors：0 / 0。
- 该 53ms 反例使浏览器性能验收不能宣称 PASS；它不是单测可覆盖的状态语义问题。

## Scene5 专项

命令：

```text
node output/playwright/2026-08-17-remediation-round-2/acceptance.mjs scene5
```

证据：`report-scene5.json`、`scene5-final.html`、`scene5-offscreen-frozen.png`。

真实路径与结果：

- `revealed`：PASS，iframe 在真实 center-lock 推进后挂载。
- `cineview-embed-finished`：PASS，手机分栏、收尾层挂载。
- `cineview-embed-unfinished`：PASS，标题 transform 冻结连续性 delta `1.14839px`。
- unfinished 收尾完成后：PASS，`aria-hidden=true`、`inert=true`、隐藏链接 `tabindex=-1/卸载`，Tab 不进入隐藏列。
- 进度降到 `<0.90` 再升到 `>0.95`：PASS，收列且四拍重新挂载（replay sentinel 改变）。
- 视口外 freeze + late `cineview-embed-finished`：PASS，stage 回到 `idle`、iframe/closing 均清理，late message 未复活。
- Scene5 case：PASS；控制台/page errors：0 / 0。

## BackgroundRibbon 与 reduced-motion

```text
node output/playwright/2026-08-17-remediation-round-2/acceptance.mjs backgroundRibbon
node output/playwright/2026-08-17-remediation-round-2/acceptance.mjs reducedMotion
```

- BackgroundRibbon：PASS。同 pathname 替换 CineView 容器后新容器 scroll listener 生效；SPA `/docs` 离开后四个 root LUT 变量均清空。证据 `report-backgroundRibbon.json`、`background-ribbon-docs.png`。
- Dynamic reduced-motion：PASS。真实 `no-preference -> reduce -> no-preference` 切换，`matchMedia` 状态变化、PhoneMockup 循环 lane wrapper 移除、恢复后重新挂载均符合预期。证据 `report-reducedMotion.json`、`reduced-motion-restored.png`。

## 污染与证据取舍

- 综合脚本第一次运行在审批超时前未落盘；不使用其结果。
- 旧官网性能样本与媒体 Agent 的一次定向 Jest 执行时间重叠，按主 Agent 指示全部丢弃。
- 本文件中的最终 Drag/Scroll 性能数字来自之后静默、独立 Chromium 重跑；Scroll 的 53ms Long Task 可复现，因此必须保留 FAIL。

## 独立浏览器结论

- 功能矩阵：PASS（框架 scroll/drag、官网 drag、Scene5、BackgroundRibbon、reduced-motion）。
- 官网多元素 scroll 性能：FAIL（53ms Long Task）。
- 本浏览器 lane 最终：**FAIL**。
