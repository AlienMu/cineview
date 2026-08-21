# 2026-08-17 Adversarial Remediation Round 2 - Independent Browser Final

## 验收角色与边界

- Agent：`/root/fresh_independent_verification_final`
- 角色：全新独立验证与真实浏览器验收；不读取或采信本轮代码复审 Agent 报告。
- 边界：不修改生产源码、测试或实现；只运行验证命令、启动服务，并在专属 artifact 目录写入本轮新证据。
- Artifact：`output/playwright/2026-08-17-remediation-round-2-final/`

## 节点

- [x] 1. 完整读取 DESIGN.md、CLAUDE.md、AGENT_SELF_REVIEW.md、主 task-flow 与 Playwright skill
- [x] 2. 定向测试与静态门禁
- [x] 3. 完整测试与 build:verify / dist 验证
- [ ] 4. 独立 framework drag/scroll 浏览器矩阵（旧候选已失效，待新候选重跑）
- [ ] 5. 独立站点专项浏览器矩阵
- [ ] 6. 五个全新 context 的静默性能复核
- [ ] 7. 证据回读与最终 VERDICT

## 节点 1 证据与自检

- 已逐行读取 `DESIGN.md`（2640 行）、`CLAUDE.md`（284 行）、`AGENT_SELF_REVIEW.md`（34 行）、主 task-flow（450 行）与 `/Users/alienmu/.codex/skills/playwright/SKILL.md`（147 行）。
- `command -v npx`：`/Users/alienmu/.nvm/versions/node/v21.7.3/bin/npx`；Node `v21.7.3`；pnpm `10.22.0`。
- 端口依据：`site/vite.config.ts` 明确配置 `4000`；若占用，以 Vite 实际输出为准。
- 本节点未修改生产源码、测试或实现。节点 1：PASS。

## 命令与证据日志

后续每完成一个节点立即追加命令、结果、失败案例、截图/JSON/trace 路径与节点级自检。

## 节点 2 证据与自检

- 定向命令：`pnpm test --runInBand src/media/VideoFrameRenderer.test.tsx src/media/videoPlaybackOwnership.test.ts src/components/Animate/StaggerContainer.test.tsx src/components/CineView/ScrollSceneStack.test.tsx src/components/CineView/useScrollSceneSnapshots.test.tsx src/components/CineView/ScrollSceneSlot.test.ts src/components/Scene/useScrollSceneEngine.test.ts src/components/Scene/Scene.test.tsx src/components/Scene/Scene.scrollRuntimeBridge.test.tsx src/components/Scene/sceneScrollApproach.test.ts src/__tests__/site/backgroundRibbon.test.tsx src/__tests__/site/scene5Lifecycle.test.ts src/__tests__/site/lastWinsTimerSequence.test.ts src/__tests__/site/usePrefersReducedMotion.test.tsx`
- 结果：14 suites / 209 tests PASS，0 snapshots；仅 Node `punycode` deprecation warning。
- `pnpm type-check`：PASS，0 errors。
- `pnpm type-check:site`：PASS，0 errors。
- `pnpm lint`：PASS，framework `src` 0 errors / 0 warnings。
- site 定向 lint（BackgroundRibbon、Scene5、reduced-motion 相关组件/hook、LUT）：PASS，0 errors / 0 warnings。
- 节点自检：自动化覆盖媒体 stale/aborted、stagger 首次 commit、scroll frame/debug、Scene5 时序、BackgroundRibbon 生命周期与 reduced-motion；没有修改生产源码。单测和静态门禁不能替代真实浏览器及性能证据，节点 2 仅代表静态验证 PASS。
- 回读本文件并确认下一节点为完整测试与构建。节点 2：PASS。

## 节点 3 证据与自检

- `pnpm test --runInBand`：120 suites / 1564 tests PASS，0 snapshots，51.501s；仅 Node `punycode` deprecation warning。
- 专用 npm cache：`/private/tmp/cineview-final-npm-cache.88r1FJ`。
- `npm_config_cache=/private/tmp/cineview-final-npm-cache.88r1FJ pnpm build:verify`：14/14 PASS；当前源码重新生成 `dist`。ES gzip 45.10 KB；full UMD 53.38/55 KB；drag UMD 42.98/50 KB；scroll UMD 47.76/50 KB；packed tarball require/import consumer PASS。
- `pnpm --dir site build`：PASS，466 modules；仅 Vite 的站点主 chunk >500 KB warning。
- `git diff --check`：PASS。
- 节点自检：完整 Jest 与构建均在定向/静态命令后顺序执行；浏览器尚未启动，因此没有测试/构建并发污染浏览器性能样本。`dist` 已由当前清理后源码重建。节点 3：PASS。
- 回读本文件并确认下一节点为独立 framework drag/scroll 浏览器矩阵。

## 节点 4 证据与自检

- 首次 drag 命令在 sandbox 内启动 preview 时得到 `listen EPERM 127.0.0.1:4330`，生成 0 条浏览器结论；明确记为环境失败并作废。随后按权限模型在真实本机端口重跑。
- Drag 命令：`ACC_PORT=4330 CINEVIEW_CHROME_PATH=... pnpm --dir examples/performance-test acceptance:drag`，URL `http://127.0.0.1:4330/#/acceptance/drag`，390x844，全新 Chromium context，PASS。
- Drag 覆盖：首屏冷启动单调 `0 -> 1`；tap 不取得 ownership；`touchCancel` 恰好一次 cancel；在途 bounce candidate hold 冻结并恢复；rush re-grab 同时冻结 render/video lane、取得 ownership 无 teleport、继续推进并只 commit 一次；禁用目标只发一次 blocked。最终 counters：starts=3、cancels=2、commits=1、blocked=1。
- Scroll 命令：`SCROLL_ACC_PORT=4331 CINEVIEW_CHROME_PATH=... pnpm --dir examples/performance-test acceptance:scroll`，URL `http://127.0.0.1:4331/#/acceptance/scroll`，390x844，全新 Chromium context，PASS。
- Scroll 覆盖：正向 100000px flick 首帧钳到 zone A 内 `1/1200`；ArrowDown、touch、native scroll 均继续同一 progress；fixed layer 保持 viewport 内；zone A `0 -> 1`；从精确终点反向首先产生 `1 - 1/1200`；zone B 大输入防跳过；scrollbar ArrowDown/ArrowUp 可逆；End 完成；tail 释放；反向大输入依次重锁 B 后 A，最终 A/B 均回 0；zone enter/leave 各 5 次；console/page errors 为 0。
- 新证据：`output/playwright/2026-08-17-remediation-round-2-final/framework-drag.json`、`framework-scroll.json`。
- 节点自检：两个脚本各自构建/启动独立 fixture、创建全新 context 并消费当前 dist；实现 Agent 未参与验收。功能与输入路径 PASS。框架 fixture 的长任务阈值只防极端阻塞，不能替代节点 6 的同负载五 context 性能复核。节点 4：PASS。
- 回读本文件并确认下一节点为实际站点专项矩阵。

## 暂停与候选失效记录

- 父任务通知：全新独立代码复审已产生有效 `FAIL`，生产代码将继续修改。收到通知后立即停止尚未开始的最终性能复核并关闭本 Agent 启动的 `127.0.0.1:4000` 服务；4330/4331 fixture 已由各脚本自行关闭。端口复核无 listener。
- 因后续生产候选会变化，上述 framework drag/scroll PASS 只保留为历史候选证据，节点 4 重新取消勾选；不得用于新候选最终结论。
- 通知到达前已完成的站点旧候选结果：`/drag` 功能序列 `[0,0,1,2,3,4,3]` PASS，但记录到 62ms Long Task / 49.4ms 最大 rAF gap；Scene5 六项专项 PASS；动态 reduced-motion PASS；BackgroundRibbon PASS。对应新目录 JSON/截图保留，但全部需要新候选重跑。
- 62ms drag 样本发生在父任务尚未要求全局静默前，标为“可能受并发污染、不可作为最终性能判决”；后续静默五 context 复核必须重新采集，既不能用它直接 FAIL，也不能用不同负载绿样本覆盖它。
- 当前严格状态：`BLOCKED（等待修复后的新生产候选）`；未给最终 VERDICT。
