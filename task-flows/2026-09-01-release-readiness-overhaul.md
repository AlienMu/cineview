# 2026-09-01 · CineView 发布就绪全套整改方案

本方案的每一条都附「证据」与「验收命令」。证据来自 2026-09-01 当日实测，不引用文档自述。
阶段之间是**门禁关系**：前一阶段未过，后一阶段的验证不算数。

## 0. 证据基线（当日实测，非文档自述）

```
pnpm test:coverage:framework   112 套 / 1533 例全绿 / 53.8s
                               行 96.57% · 函数 95.64% · 分支 90.58%（门 90）
pnpm type-check                0 错误
pnpm lint                      0 错误
pnpm build:verify              14/14 通过
node -e "import('./dist/cineview.es.mjs')"   OK，8 个导出
renderToString(<CineView mode="scroll">)     OK，1301 字节
npm view cineview version                    404，未发布
git tag                                      空
main..HEAD                                   30 commits ahead
```

结论：**内核质量真实，交付层未完成**。总评 B−（6.8/10）。风险不在代码，在包没发布、
文档站没部署、诊断被编译掉、无障碍缺位。

## 1. 阶段一 · 让它能出厂（P0，四项全为阻断项）

### 1.1 prepublishOnly 无法无头运行 —— 任何 CI 都发不出这个包

证据链：`prepublishOnly → verify → verify:all → verify:framework → test:browser`，而
`examples/performance-test/acceptance-{drag,scroll}.mjs:79-82` 回落到
`chromium.launch({ channel: 'chrome' })`，依赖是 `playwright-core`（不下载浏览器）。
无 Chrome 的机器抛 `Chrome could not be launched. Set CINEVIEW_CHROME_PATH…`。

改法：`prepublishOnly` 改指 `verify:framework:static`（无头安全）；浏览器验收移到
tag 触发的 release job，附 `browser-actions/setup-chrome@v1`。

验收：`docker run --rm -v $PWD:/w -w /w node:20 npx --no-install pnpm publish --dry-run` 应通过。

### 1.2 CI 从未门禁过要发布的代码

证据：`.github/workflows/ci.yml` 触发器只有 `push:[main]` 与 `pull_request`；`main` 与 `dev`
同在 `19ec1a4`；30 个提交（含整个框架）只活在 `codex/drag-release-dual-gate`，无 PR。

那套 CI 本身写得相当好——Node 18/20/22 矩阵 `fail-fast:false`、真 Chrome 验收专线、
React 19 专线、concurrency + cancel-in-progress、pinned pnpm、`--frozen-lockfile`。
问题不是质量，是它没跑过。

改法：开 PR 合并到 main，让三条 lane 首次门禁真实代码。预期会暴露 React 19 专线的假绿
（见 3.4）。

验收：PR 上三个 job 全绿，且 `git log main..HEAD` 为空。

### 1.3 生产产物里没有任何诊断 —— 零 Scene 等于静默白屏

根因两处：`vite.config.ts:34` 把 `'process.env.NODE_ENV'` 硬折叠成 `'production'`；
`:154` `esbuild.drop:['console','debugger']`。因为几乎所有 guard 写作
`if (process.env.NODE_ENV === 'development')`（`CineView.tsx:1049`、`Container.tsx:26`），
整个分支被静态消除。

dist 实测（es / umd 双产物）：

```
"No Scene components found"      0 / 0
"must be used within"           0 / 0
console.warn | console.error    0 / 0
process.env                     0 / 0
```

代价被低估了：这些错误信息**质量极高**。`useSceneAnimationRegistry.ts:220-238` 是
Problem/Fallback/Fix 三段并点名具体 id；环形 `after` 打印完整环路；重复 `animateId` 与
重复 `scroll.zoneId` 都点名场景。全部在发布版失效。消费者永久处于 production 模式，
任何 NODE_ENV 都无法恢复。

改法（择一）：① 停止折叠 `NODE_ENV`，让 bundler 自行 define，只在 minify 阶段 drop console；
② 把关键 guard 从 `console` 改走 `reportError`（该通道在 dist 存活）。至少保证
「零 Scene」「Scene 无子元素」「无效 after id」三条不静默。

验收：`grep -c "No Scene components found" dist/cineview.es.mjs` ≥ 1。

### 1.4 CHANGELOG 与 1.0.0 矛盾，breaking 改名零记录

证据：`package.json` 为 `1.0.0`；`CHANGELOG.md` 仅 `## Unreleased` 一节，无 `## 1.0.0`；
`git tag` 为空；`git log -- CHANGELOG.md` 最近一次是 `f164470`，距今 23 个提交。
其间的 `d5882b7` 是一次**破坏性公共 API 改名**，改了 AGENTS/README/DESIGN/examples 与 81 个
文档页，**唯独没改 CHANGELOG**。

唯一的迁移记录埋在 `site/src/content/docs/{en,zh}/components/01-cineview.md:158-172`——
一张 13 行表：`config.size`→`designWidth`、`timeline.waitFor`→`timeline.after`、
`infiniteAnimation`→`loopAnimation`、`timeline.sceneControlled`→`timeline.driver`、
`visibility.replayOnReenter`→`visibility.replay`、`onSceneWillChange`→`onSceneEnter`、
`onSceneDidChange`→`onSceneLeave`、`onDragCommit`→`onDragEnd`、`getCurrentScene()`→
`getCurrentIndex()`、`performance.monitor`→`monitor`、`Position layer.fixed`→`Position fixed`、
`Scene stack.mode/zIndex`→`layout.overlap/zIndex`、`modes` wrapper 拍平。

改法：把这 13 行提升为 `## 1.0.0` 的 BREAKING 段，`git tag v1.0.0`，并给 `verify:all` 加一条
「公共类型有 diff 时 CHANGELOG 必须同批被改」的检查。

验收：`grep -c '^## 1.0.0' CHANGELOG.md` = 1 且 `git tag | grep v1.0.0`。

## 2. 阶段二 · 让第一次使用不踩坑（开箱即用 5.0 → 8.0）

这一维度提分空间最大，且几乎全是配置而非架构改动。

### 2.1 文档站未部署 + package.json 缺 homepage

证据：`node -e "require('./package.json').homepage"` → undefined。README:73 写
「Full docs live in this repo's site (`site/`, route `/docs`)」——无链接、无
`pnpm --dir site dev` 命令。全文唯一 URL 是 README:100 的 License 指向仓库根。

后果：装完包无处可去。80 个文档页（40 slug × 2 语言，双语严格 40=40 对齐）是这个项目
投入最大的资产之一，对外不可见。

改法：部署 site（Vercel/Netlify/Pages 皆可，`site/` 是标准 Vite 应用），`homepage` 指向它，
README 顶部加文档链接。

验收：`node -e "console.log(require('./package.json').homepage)"` 输出可访问 URL。

### 2.2 README 三处必修

- **无 drag 示例**：README:44 只说「swap in `CineViewDragProps`-style config」。而
  `CineViewDragProps` **不是导出类型**——`src/public-api.ts` 导出的是 `CineViewDragModeProps`。
  照 README 写的读者无法产出 drag 案例。
- **子路径缺 CJS-only 注意**：README:22-24 在一段 ESM `import` 示例正下方推荐
  `cineview/drag` 与 `cineview/scroll`。这两个子路径只声明 `types` + `require`
  （`package.json:18-25`），**这是有意设计**——`scripts/verify-build.js:187-190` 明确断言
  `import === undefined` 并写明理由：子路径存在的唯一意义是 UMD 无法代码拆分，ESM 消费者
  从 root 拿全量即可（root ESM 自带 `drag-scene-engine-*.mjs` code-split chunks）。
  缺陷因此**不是"导出坏了"**，而是：`types` 条件对 `import` 照样解析 ⇒ TypeScript 放行，
  运行时才抛 `ERR_PACKAGE_PATH_NOT_EXPORTED`。文档站 `en/getting-started/02-installation.md:48`
  已正确写明这个限制，README 没有。
- **`<Image>` 缺 alt**：README 示例未展示 `alt`，而它是必填（缺失报 `TS2741`）。

已验证 README 主示例**逐字编译通过**（`tsc --noEmit`，`moduleResolution:bundler`，`strict`，
对着 `dist/index.d.ts`）：`CineView`/`Scene`/`Animate`/`designWidth`/`mode`/`sceneId`/
`scroll={{zoneId,trigger}}`/`animateId`/`enterAnimation`/`duration` 全部解析。改名也落干净了，
README 无任何残留的 `waitFor`/`infiniteAnimation`。

验收：README 的 drag 示例复制进 `examples/` 后 `type-check:examples` 通过。

### 2.3 examples/minimal 拷不走，且 131 行不叫 minimal

证据：`examples/minimal/package.json:13` 是 `"cineview": "link:../../"`——仓库外复制得到
`ERR_INVALID_PACKAGE_TARGET`。`vite.config.ts` 另有 `optimizeDeps.exclude:['cineview']`，
是 link 专用的 workaround，真实消费者既不需要也不该抄。`src/App.tsx` 131 行含
drag/scroll 模式切换、三个场景、一条 `after` 级联、两个 `CSSProperties` 与约 35 行注释。
首屏渲染只需约 12 行。

改法：`"cineview": "^1.0.0"`，拆成真正 12 行的 hello-world + 一个带注释的 tour。

验收：把 minimal 目录复制到 `/tmp` 后 `npm i && npm run build` 成功。

### 2.4 tarball 八成是死重量

证据：`npm pack` → 1.5MB 打包 / **5.0MB 解包 / 56 文件**。`files:["dist"]` 连带发出
**19 个 `.map`**（`cineview.umd.js.map` 单个 1.07MB）与 **11 个 `.gz`**。bundler 不读 `.gz`，
CDN 也不从 `node_modules` 提供它。

改法：`files` 收窄为 `dist/**/*.{js,mjs,d.ts}`，或停止把 `.gz` 产到 dist。

验收：`npm pack --dry-run` 解包体积 < 1.5MB。

### 2.5 三个当日新发现的缺口（五份审计均未覆盖）

- **SSR 是通的，但无测试锁住**。实测 `renderToString(<CineView mode="scroll"><Scene>…)`
  输出 1301 字节，ESM/UMD 在无 DOM 下 import 均成功，`sideEffects: false` 已正确声明。
  这是库最易翻车处而你已经过了——但零测试覆盖，下次在模块顶层碰 `window` 就静默破掉。
  **补一条 `renderToString` 冒烟测试**（成本 10 行，防的是整类回归）。
- **浏览器基线无声明**。`vite.config.ts:143` 是 `target:'es2020'`，`package.json` 无
  `browserslist`。而源码用了 `ResizeObserver`（6 个非测试文件）、`requestVideoFrameCallback`
  （1 个）、`??=`（1 个）——真实基线高于 es2020，用户只能自己踩。
  注：`IntersectionObserver` 在非测试源码是 **0 处**（14 个命中全在测试），与性能审计一致。
- **`.github/` 三件套缺失**：无 ISSUE_TEMPLATE、无 PULL_REQUEST_TEMPLATE.md、无
  dependabot.yml。LICENSE / SECURITY.md / CODE_OF_CONDUCT.md 都在——治理做了一半，
  而 dependabot 缺失直接关联阶段四那 7 个落后 1–3 个大版本的依赖。

## 3. 阶段三 · 让绿灯真的代表安全（测试可信度 6.5 → 8.5）

覆盖率数字是真的（1533 例全绿、分支 90.58%）。**它保证的东西比数字看起来少。**
这一阶段决定其余所有绿灯值多少钱，因此优先级高于结构重构。

### 3.1 Animate.test.tsx 的 useTransform 打桩使 2533 行断言失效（本阶段八成价值）

证据：`Animate.test.tsx:100` 把 `useTransform` 打桩为 `() => createMotionValueStub(0)`——
**既忽略 source，也忽略映射函数**，于是每一个派生值恒为 0。`:62-64` 更以
`void animate; void variants; void custom;` 直接丢弃组件输出。此后 2533 行主要断言
`toBeInTheDocument()`（63 次），`:1586` 甚至断言测试自己配置的 mock。

放大器：123 个测试文件里 **34 个 mock 掉 framer-motion**——那正是持有每帧数值的库。
所以「每帧纪律」这一最强项，恰恰是被 mock 最狠的部分（性能维度靠源码走查而非测试建立）。

改法：让打桩真实消费 `(source, fn)`——订阅 source、对其值套 `fn`、产出新 stub。
预期会**红一批**，那些红是真实缺口。

验收：`useTransform` 打桩改造后全套仍绿，或红的用例逐条有结论。

### 3.2 恒真与自我豁免断言

- 6 处 `expect(true).toBe(true)`：`Scene.dragMode.test.tsx:239,243,247`（三个具名阈值用例，
  真实行为其实覆盖在 `useDragSceneEngine.threshold.test.ts:7-21`，所以这三处是**谎报而非空洞**）、
  `drag-progress-control.test.tsx:44,184`（**回归文件，检测不了自己要防的回归**）、
  `useImagePreloader.test.ts:723`。
- `__tests__/integration/performance.test.tsx`：`:69-73` 把时间 mock 成同步 `animate`，然后
  把「保持 60fps」包进 `if (metrics) {`（`:927-934`、`:596-608`、`:431-433`）——零断言照样绿。
  `:806-842` spy 了 `console.warn` 却从不断言，`:615-650` 对 rAF 同样。
- 空集恒真：`registry.branches.test.ts:139,210` 对可能为空的 map 调 `.every()`；
  `properties/relativePositionAccumulation.property.test.tsx:98,172,227,261,298` 把
  `if (element)` 放进 fast-check 主体——包装层一旦不渲染，100 次运行全部空过。
  这是最该信任其探索能力的文件。
- 37 个测试标题直接写死所覆盖的源码行号（如 `performanceMonitor.branches.test.ts:121`
  的 "(line 270)"）——对着 `jest.config.js:17` 的 90% 分支门写出来的。

干净的一面要记账：123 个文件零 `.skip`/`.todo`/`.only`；
`__tests__/bugfix/drag-rush-regrab.test.tsx` 是范本——先陈述修复前症状再数值断言
（`:369` transform、`:396` lane 同一性、`:535` `fromValue).toBe(2800)` 证明续跑而非重播）。

改法：删 6 处恒真、去掉 `if (metrics)` 包裹并让它真断言、property 测试改为断言元素必存在、
把 `checkMinifierStrategy` 计进 `verify-build.js` 打印的门数（它现在能让构建失败却不在「14」里）。

### 3.3 补 SSR 冒烟测试

见 2.5。当前实测通过但零覆盖。

### 3.4 React 19 专线是假绿

`ci.yml` 的 `react-19` job 换掉 `react`/`react-dom`/`@types/react`，但**没换**
`@testing-library/react ^14`——它不支持 React 19（需 ≥16）。该 job 跑的是静态门里的 jest。

改法：同批升到 `@testing-library/react@^16`。

## 4. 阶段四 · 结构与余量（代码维护性 7.0 → 8.5，性能 9.0 → 9.5）

前提：阶段三完成后再动，否则重构的安全网是假的。

### 4.1 零风险纯函数抽离 ≈ −470 行，零行为变更

| 抽出                       | 来源                                                               | 行数 |
| -------------------------- | ------------------------------------------------------------------ | ---- |
| `dragVisualState.ts`       | `useAnimateDrag.ts:90-138,160-172,174-395`（已 React-free）        | ~290 |
| `resolveVisibilityGates`   | `useAnimateScroll.ts:566-617`（纯几何，现仅能透过 234 行循环测试） | 50   |
| `useSceneStyles`           | `Scene.tsx:823-899`                                                | ~75  |
| `useAnimatePublicTimeline` | `Animate.tsx:690-779`                                              | ~90  |

巨石现状（供判断收益）：`CineView.tsx` 的 `DragCineViewComponent` L173-1154 = **982 行 / 81 个
hook 调用点**；`useAnimateScroll.ts` L184-1147 = 964 行，`runVisibilityUpdate` L503-736 = 234 行、
最大依赖 19 项；`useDragSceneEngine.ts` 的 **`handlePanEnd` L419-834 = 416 行、嵌套 10 层、
依赖 22 项**；`Scene.tsx` 的 `SceneImpl` = 862 行 / 62 hook。

**不要动**的三处（有充分理由）：`CineView.tsx` drag 事务机（每个 handler 闭包 11 个 ref）、
`Scene.tsx:573-650` context memo（按构造就是聚合点）、`useDragSceneEngine.ts:277-365`
（注释 L288-291、L302-307 编码了承重的**顺序契约**）。

### 4.2 bounce/settle 是同一状态机写了两遍 —— −110 行

`useDragSceneEngine.ts:442-518`（bounce）与 `:667-781`（settle）是同一个 `DragRenderLane`：
相同的 `laneProgress`/`laneArm`/`suspended`/`preempted` 局部量，相同的
`stop/suspend/resume/preempt/getCurrent` 形状。jscpd 看不见它（结构重复而非 token 相同）。

改法：`createRenderLane(kind, …)`，顺带把 416 行的 `handlePanEnd` 砍半。

jscpd 能看见的真实簇：`isVerboseDragDebug`+`debugDrag` 在 `useAnimateDrag.ts:67-88` 与
`useDragSceneEngine.ts:8-29` **逐字重复** 25 行；`useElementTrack.ts` 自克隆 5 处
（release/bounce/cold-start 三臂）。总重复率 1.0%（208/20749 行）——很干净。

### 4.3 prop 形态死代码链（ts-prune 看不见）

- `onRenderProgressChange` 在 `CineView.tsx:1141` **硬编码为 undefined**，却穿过 5 文件 16 处：
  `DragSceneStack.tsx:65,164,286` → `Scene/helpers.ts:136,216,246` →
  `Scene.tsx:66,157,183,738` → `Scene/types.ts:182,221` → `useDragSceneEngine.ts` 9 处。
- `setRenderProgress`（`useSceneManager.ts:113,679`）**零生产调用者**，只有 4 个测试用它。
  `renderProgress` 状态只被置 0（`:443,:517`），故 `DragSceneStack.tsx:261` 恒传 0，
  `useAnimateDrag.ts:102` 的 `?? sceneContext.renderProgress` 回落不可达。
- 六个「声明→归一化→转发→从不调用」的回调：`onScrollProgressChange`、`onScrollDirectionChange`、
  `onScrollCommit`、`onScrollReset`、`onSharedElapsedMsChange`——各只存在于 3 处。
- `scrollCommitThreshold`/`scrollReleaseDuration`/`scrollLockToSingleScene` 在
  `helpers.ts:209-211` 带默认值归一化后**零下游消费**；`scrollSpeed`/`scrollControlled`
  只出现在依赖数组里（`helpers.ts:233-234`）。
- `getGlobalPerformanceMonitor`（`performanceMonitor.ts:268`）`@deprecated`、不在
  `public-api.ts`，唯一消费者是一个标题写着自己为覆盖率而存在的测试。

删掉后 `Scene.tsx:43-101` 那张 57 项 `INTERNAL_SCENE_PROPS` denylist 同步缩小。

### 4.4 renderProgress 的单一所有者不变量实际是破的

文档写的是单一所有者。实际：`renderProgressMotion` 在 `CineView.tsx:423` 创建、
`:432,:763` 写入，然后在 `Scene.tsx:226` 被**别名**（`dragProgressMotion`）并在
`Scene.tsx:623-624` 以**两个名字**同时暴露；真正的每帧写入者是
`useDragSceneEngine.ts:319,386,455,470-476,722`。所以有两个模块在写，且 grep 文档里那个
名字只能找到 reset。`CineView.tsx:429-434` 在 `useLayoutEffect` 里按 `currentScene` 重置为 0，
而 `useDragSceneEngine.ts:470` 的 bounce `animate()` 可能仍在跑——两者都收敛到 0，
**今天是良性的，但没有任何东西保证它**。

同类命名债：`elementElapsedMotion` 的单写者契约**是被遵守的**（仅 `useElementTrack.ts` 写，
28 处 `.set(`，契约记在 `:18-33`），但 context 字段名叫 `sharedElapsedMotion`——
复用了已删除的全局标量那个词。

### 4.5 UMD 只剩 250 字节余量

门是 gzip-only（`scripts/verify-build.js` 读 `dist/artifacts.json`，raw 只打印不比较）：

| 产物                   | 预算      | 实测 gzip    | 余量      |
| ---------------------- | --------- | ------------ | --------- |
| cineview.es.mjs        | 50 KB     | 46.11 KB     | 3.9 KB    |
| **cineview.umd.js**    | **55 KB** | **54.84 KB** | **168 B** |
| cineview-drag.umd.js   | 50 KB     | 43.78 KB     | 6.2 KB    |
| cineview-scroll.umd.js | 50 KB     | 48.95 KB     | 1.05 KB   |

全过，但全量 UMD 门下个功能大概率顶穿。发布前先腾余量。
（`verify-build.js:39-43` 的 env override 修复是真的：非有限值直接 exit 1 而非静默关门。）

### 4.6 性能：两个待办 + 一个未诊断停顿

每帧纪律经查**属实**，非自我声明。要点：drag 每帧走
`renderProgressMotion.on('change', applyTransform)` 直写 `style.transform`
（`DragSceneStack.tsx:111`）；scroll 的
`areScrollSceneRenderSnapshotsEqual`（`ScrollSceneSlot.tsx:74-122`）**刻意不比较**
`enterProgress`/`exitProgress`/`sceneProgress`/`progressPx`，把每帧进度赶去 keyed `frameStore`，
其订阅者只做 `style.*` 直写（`SceneFixedLayer.tsx:32-64`，无 setState、无 layout 读）。
「每手势测一次」的修复仍在（`useNativeScrollController.ts:378-383`）。
`visibilityScheduler.ts:57-71` 用 WeakMap 把每个 scroll root 合并成**一次 rAF、一次测量**再扇出。
`useAnimateDrag.ts:464` 的 11×→1× 修复是真的（`visualState` 单 MotionValue，
`resolveVisualState` 单调用点 `:299`），且 `:460-463` 记录了失败的 chained-useTransform 方案。

待办：

- **133ms 滚动停顿未诊断**（`site/review/20260822-n6-acceptance/n6-probes/s5-perf.mjs`：
  p50 16.7 / p95 17.5 / p99 17.7 / **max 133.4**，longtask 空）。没触发 long task ⇒ 不是主线程
  JS，大概率 raster/compositing。当时被记为观察并放行，从未诊断。结合已知的
  「每帧改 CSS 变量驱动 opacity 会全屏重绘 gradient」，值得追而非放行。
- **该 N6 探针 monkey-patch 了 `window.requestAnimationFrame`**，按注册而非按呈现帧采样。
  drag 的 `p50=0.0`（n=1601 / ~9.6s / ~167 次每秒）证明同帧重复占主导、把分布稀释了 ⇒
  **P95 被低估**，`max` 才是承重数字。
  更强的证据反而没被引用：`examples/performance-test/stress/stress-fps.json`（2026-08-15，
  真 Chrome，24 元素 + 3 AnimateVideo）用**自我重排的单条 rAF 链**（`stress-fps.mjs:103`），
  11 个场景 p95 17-18ms、max 18ms、over32=0、over50=0、avgFps 58.9-59.3，无 133ms 异常。
- 两份数据都比当前 dist 早 8-15 天，**当前构建零性能测量**。用 `stress-fps.mjs` 方法论重跑。

P2 清理：`Scene.tsx:338-357` 一个 effect 写 6 个 state，而 `hasExternalDragRuntime` 为真时
消费方全读全局值（`Scene.tsx:213-221`）⇒ 写了没人读；
`VideoFrameRenderer.tsx:569-588` 旧进度路径 seek 无 epsilon 去重（新路径
`videoPlaybackOwnership.ts:208-213` 有，且 reducer 存在 ref 里故零 React 渲染）；
`VideoFrameRenderer.tsx:405` 每次 seek 注册一个 `{once:true}` 监听且 `seekSamplesRef`
无上界（仅开发期）。
监听器卫生**零泄漏**：26 处 `addEventListener`、3 条 rAF、14 处 `setTimeout`、2 个
ResizeObserver 全部配对且 capture 标志一致；passive 用得对
（`useScrollInputBindings.ts:81,83` 是 `passive:false` 且真的 `preventDefault`）。

## 5. 阶段五 · 无障碍（4.5 → 7.5）

对一个**动画框架**来说，这一维度的缺位是资质问题而非打磨问题：不补，总评上不去 A−。

四件事，都不难，且已有能力证明——`ScrollbarOverlay` 做得完全标准（`role=`、`aria-label`、
`tabIndex`、方向键共用步长表）。这是覆盖面问题，不是能力问题。

| 缺口                            | 实测证据                                                                                      | 改法                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `prefers-reduced-motion` 零支持 | 非测试源码 **0 处**命中；dist **0** 处。真 hook 住在 `site/`，不随包发布                      | 框架级开关：命中时入场/退场取终态、循环停摆、scrub 仍跟随输入                     |
| 非活动场景对辅助技术仍可见      | JSX `inert=` **0 处**（5 处 `inert` 命中全是注释里的英文形容词）；只设 `pointerEvents:'none'` | 非活动场景加 `inert`；无 `inert` 时回落 `aria-hidden` + `tabIndex={-1}`           |
| 场景切换无播报                  | 全仓 `aria-live` **0** 处                                                                     | 换场时向一个 polite live region 写入场景标识                                      |
| drag 模式零键盘可达             | drag 路径 `keydown`/`onKeyDown` **0** 处（全部命中都在 scroll 文件）⇒ 内容仅指针可达          | 接已存在的 `goToScene()`（`src/types/index.ts:420`），方向键/PageUp/PageDown 换页 |

## 6. 文档（6.0 → 8.0）

### 6.1 已经很好的部分（先记账，避免误伤）

- 双语**严格对齐**：两棵树 `diff` exit 0，40 = 40。结构扫描 40 对页面仅 1 处真实漂移
  （`en/concepts/03-visibility-conditions.md:73` 有 `## Related pages`，zh 缺 `## 相关页面`）。
- **文档站的 API 覆盖是准的**：抽出全部 EN 文档代码块里的 32 个 JSX 属性，与
  `src/types/index.ts` 的 126 个键名对比——**零未知 prop**。7 个值导出全部有页；
  `CineViewRef` 6 个方法全部记录（`en/components/01-cineview.md:34,115-122`）。
- 改名在文档里落干净：`waitFor`/`infiniteAnimation` 仅出现在有意的迁移表
  （`{en,zh}/components/01-cineview.md:163,166`）。47 个 task-flow 文件仍带旧名——那是历史，正确。
- drag 板块 12 条判断类缺陷当日已全闭，门禁全绿（详见
  `task-flows/2026-08-31-docs-de-ai-continue-and-site-bugs.md`）。

### 6.2 待修

- **4 处与源码相反的 `exitRef` 断言**：`{en,zh}/concepts/02-timeline.md:58` 称「设了它就禁用
  全部自动退场：scroll 离开锁定区、drag 切走都不退场」；`en/components/03-animate.md:127`
  重复此说。而 `src/components/Animate/Animate.tsx:456-475`：在 scrub 轨上（drag 场景轨，
  或 scroll 接管）**两个 ref 都被忽略**并报 `INVALID_ANIMATION`——恰是被点名的那两种情形。
  `en/advanced/07-common-pitfalls.md:20` 写对了 ⇒ **三页里两页与源码及第三页矛盾**。
- **`never` 的语义误导（4 处）**：`en/components/03-animate.md:28`（及 `zh:28,80`）说
  `enterAnimation` 必须是 `never`（类型强制）。`src/types/index.ts:591` 是
  `enterAnimation?: never`——**键必须缺席**。`07-common-pitfalls.md:14` 明确把「真的写
  `never`」列为陷阱（类型检查失败且运行时解析失败）。
- 改名残留一词：`en/components/03-animate.md:27` "must coexist with enter or **infinite**"。
- `advanced/10-types.md` 缺 `AnimateVideoProps`/`ImageProps`/`ContainerProps`（DESIGN.md 也缺）
  及 15 个 `*Props`/回调类型。
- zh 补 `## 相关页面`（见 6.1）。

### 6.3 文风探针不在版本控制里 —— 规则形同虚设

`WRITING.md:3-5` 指名「探针 `site/scripts/docs-style-probe.mjs` 把禁词清单做成回归断言…
必须先过探针再收口」。而 `site/.gitignore:24` 是 `scripts` ⇒ `git ls-files site/scripts` = **0**，
且它**没有接进任何 package.json 脚本**（`verify:all` 里的 `test:site-contracts` 跑的是
`jest src/__tests__/site`）。除作者本机外无人能执行。

同样不可恢复的还有 MEMORY.md 引用的 `site/scripts/drag-scrub-probe.mjs`。
（`site/scripts/` 本机 553 项 / 624MB / 525 个临时 `.mjs` 探针——**忽略是对的**，
但两三个承重探针必须入库。）

改法：把 `docs-style-probe.mjs`（及 drag-scrub-probe）移出忽略、接进 `verify:all`。

### 6.4 DESIGN.md 2639 行零目录

123 个标题、**无 TOC**、仅 2 处日期、27 个弃用标记、21% 中文。而
`CONTRIBUTING.md:5` 让英文贡献者「先读 DESIGN.md」。加 TOC。

### 6.5 两条陈述性错误（更正记录）

- **AGENTS.md 那条 P0 不成立**。子代理称它是 CLAUDE.md 的过时分叉、`driver` 枚举写错。
  实测：`CLAUDE.md` 只有 **3 行**（指向 AGENTS.md 的指针）；`AGENTS.md:24` 写
  ``timeline.driver` is `scene` or `clock``，与 `src/types/index.ts:496` 的
  `driver?: 'scene' | 'clock'` **逐字一致**；全文搜 `scroll`/`visibility`/`auto` 枚举组合
  **零命中**；两文件合计 66 行，不存在「90 行分叉」。该报告引用的是已不存在的旧版文件。
- **terser 未被移除**：`AGENTS.md` / `CLAUDE.md` 记的「已移除」是错的——
  `scripts/minify-library-entries.mjs:5` 仍 `import { minify } from 'terser'`。
  当时移除的是 `vite.config.ts` 里的 `@rollup/plugin-terser`，之后自定义 minify 步骤又把
  terser 作为直接 API 依赖引回。**固定版本 terser 5.46.1 是承重的，不要删**——改文档。
- `COVERAGE_REPORT.md` 说分支 89.15%「不得称为可发布」已过期：实测 90.58%、门 90、绿。

### 6.6 需要你裁决的一件事：语言策略

注释密度 12%（健康），但 **22% 的注释含中文**，42 个重注释文件里 14 个以中文为主。
`README.md`/`CONTRIBUTING.md`/`requirements.md`/`AGENT_SELF_REVIEW.md` 是 **0% 中文**；
`DESIGN.md`/`AGENTS.md` 是 21% 中文（DESIGN.md 113KB）。

目前是最糟的组合：**门面英文、内核中文**，且 CONTRIBUTING 让英文贡献者去读中文大文件。
两个自洽的选择：① 明确「内部中文、对外英文」并改掉 CONTRIBUTING 的指引；② 统一为一种。
这是策略问题，不是缺陷——需要你定。

## 7. 仓库卫生（一次性清理）

- **23 个被追踪的基线 PNG（13MB）**：`output/playwright/animation-baseline/*.png` + report.json，
  在 `41aae22` 提交。`output` **在** `.gitignore:47`，但先提交后加规则 ⇒ gitignore 不会 untrack。
  证明：`git check-ignore -v output` 无匹配（已追踪⇒规则失效）；
  `git check-ignore -v --no-index output` → `.gitignore:47:output`。
  改法：`git rm -r --cached output/`（未来克隆 −13MB；历史仍胖）。
- **`site/review/` 被追踪 90 文件 / 36MB**（`.gitignore:62-63` 只排除其下 png/jpg）。
  连同 `site/public/act3-edit.mp4`（10MB）+ `video.mp4`（3.8MB）主导了 735 个追踪文件与
  56.37MiB 的 pack。改法：移到 Git LFS 或工件存储。
- 本机未追踪约 3.5GB 可删：`output/` 2.1G、`.playwright-cli/` 1.3G、`.v1-drag-accept/` 47M、
  `coverage/` 17M。
- **3 个死分支 + 2 个陈旧 worktree**：`worktree-agent-a1fe635859bd090d9`（无 worktree 附着，
  零独有提交）、`worktree-agent-a4eb88d03b93e9016`（= main，零独有提交）、
  `adversarial-probe`（`f164470` 已含于当前分支）。全部可删。
- `.gitignore` **覆盖面本身没问题**（deps/dist/coverage/IDE/OS/logs/stats.html/`.probe-*.mjs`/
  `/.v1-*`/`shot*.cjs`/`/review/` 全覆盖）——失效点是执行而非覆盖。
- **pre-push 弱于 CI**：`.husky/pre-push` 只跑 `type-check && test:coverage`，跳过 `lint`、
  `format:check`、`build:verify`、`quality:duplicates` 与两个 failure-injection 门。
  两个 hook 还用 husky-8 的 `. "$(dirname "$0")/_/husky.sh"` shim（husky 9 已移除）⇒
  升级 husky 前必须改。改法：pre-push 改跑 `verify:framework:static`。
- **依赖落后**：vite `^5`→8.2.2（3 个大版本）、eslint `^8`→10.9.1、typescript `^5`→7.0.2、
  `@typescript-eslint/*` `^6`→8.68.0、`@testing-library/react` `^14`→16.3.3（**阻塞 React 19 专线**）、
  jest `^29`→30.5.0、husky `^8`→9.1.7。`@types/node ^25`→26.4.0 正常。
  `@types/react ^18` 而 peer 允许 `^19`。配 dependabot 后分批升。

## 8. 执行顺序与验收门

```
阶段一（出厂）      → 门：dry-run publish 通过 + main 三 lane 全绿 + dist 有诊断 + v1.0.0 tag
  ↓
阶段二（首次体验）  → 门：homepage 可访问 + minimal 可拷 + tarball <1.5MB
  ↓
阶段三（绿灯可信）  → 门：useTransform 打桩改造后全绿 + 零恒真断言 + SSR 测试存在
  ↓
阶段四（结构余量）  → 门：−470 行抽离后全绿 + UMD gzip 余量 >3KB + 当前构建有性能数据
  ↓
阶段五（无障碍）    → 门：reduced-motion 生效 + 非活动场景 inert + drag 键盘可换页
```

**如果只做三件**（按分数杠杆）：① 恢复生产诊断——唯一会让用户静默白屏的缺陷；
② 修 `useTransform` 打桩——它决定其余所有绿灯值多少钱；③ 合并 30 个提交让 CI 真跑一次——
不做这个，前两件的验证都不算数。

三件之后 B− → B+。要 A− 必须补阶段五。

## 9. 余项

scroll 与 advanced 两个文档板块的**内容审计未跑完**（代理触发 429 限流早退）。
那是 `2026-08-31` 文档任务的余项，不影响本方案的评定与执行顺序。
方法论记录：verify 阶段运行期间不要修改它正在核对的文件——会产生「引用不存在」的假阴性。
