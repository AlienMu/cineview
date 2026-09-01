# 2026-09-01 · 发布就绪整改 · 对抗评审后的执行任务流

前身：`2026-09-01-release-readiness-overhaul.md`（诊断方案）。本文件是**对抗评审改写后的可执行版**。
评审推翻了原方案的一处阶段顺序，并否决了两条改法。原方案的证据仍然有效，此处只记结论与差异。

## A. 对抗评审结论（16 条指控，13 条成立）

其中 **A8–A10 是本任务流自攻发现**（攻自己的验收命令），**A11–A15 来自 fresh 复审代理**。
**5 条推翻的是第一轮审核结论本身**：A12（470 行混三类）、A13（三条断言读 HEAD 而非工作树）、
A14（2765 字节高估 3.8 倍，废除 N0→N3 依赖）、A15（renderProgress 是正确性缺陷而非命名问题）、
A15b（代理误判我的 aria-live 断言，该断言成立）。

### A1 ~~成立且致命~~ **前提已被 A14 推翻** —— 方向对，量级错 3.8 倍

原方案让「恢复生产诊断」进阶段一，验收门是 `build:verify`。两者互斥：

```
dev 卫语句块 raw 7018 字节 → gzip 2765 字节
cineview.umd.js 现状 54.75KB / 预算 55KB ⇒ 余量 253 字节（门内部按 256 判，舍入差，见 A8）
2765 ≫ 253 ⇒ build:verify 第 12 关必红（← 此推论已失效，见下）
```

原方案把「腾 UMD 余量」放在阶段四，而阶段一依赖它。当时判定「顺序反了」。

> ⚠️ **A14 已推翻本条前提。** 上面 2765 是**未压缩源码块**（含注释/缩进/中文）的 gzip 值，
> 而进产物的是 esbuild minified 后的代码——注释与缩进根本不进产物。同法实测 minified
> 诊断文案，真实增量 **222–731 字节**，与 253 字节余量同量级。
> **所以 N0 不是 N3 的硬前置，「顺序反了」不成立。** 保留本条是为留存推理链与
> 「改法一（停止折叠 NODE_ENV）应否决」这个仍然有效的裁决。

裁决：拆成 N0（腾余量，前置）+ N3（恢复诊断）。且否决原方案「停止折叠 NODE_ENV」的
改法一——它把 2765 字节无条件塞回生产产物。改走 `exports` 的 `development` 条件
（React/Vue 的做法），当前 `package.json` 的 exports 只有 `types`/`import`/`require`
三条件，加 `development` 是纯增量、不破坏现有解析。

**A1 的方法论已被反向检验（自攻）**：A10 证明「抽出文本单独 gzip」会高估标识符类改动
（raw 921 → 实际增量仅 153，偏差 6 倍），所以 2765 这个数也要用同法检验。实测把 dev 卫语句块
附加进 UMD 后重新 gzip，**真实增量 2757 字节**，与单独估算的 2758 几乎一致。
原因：诊断文案是**独特长字符串**，没有重复可供 gzip 吸收，与标识符类改动性质不同。
⇒ A1 的数字与结论都成立。

权威余量口径也已统一：门读 `dist/cineview.umd.js.gz` 的**文件字节**（56067），
`(size/1024).toFixed(2)` = 54.75KB，与预算 55 相比余量 **253 字节**
（`scripts/verify-build.js:92-103` 的 `getFileSize`/`checkFile`）。
用 zlib 默认级别重算会得到 56198，比构建产物大 131 字节——量余量必须读 `.gz` 文件，不要重算。

### A2 成立 —— 6.3「把探针入库」的改法无效

`site/.gitignore:24` 排除的是**目录** `scripts`，不是文件模式。git 对被忽略目录**不下降**，
所以 `!scripts/docs-style-probe.mjs` 这类否定式**不生效**（实测
`git check-ignore -v` 命中 `site/.gitignore:24:scripts`）。

裁决：必须把承重探针**移出该目录**（如 `site/tools/`），或改成
`scripts/*` + `!scripts/docs-style-probe.mjs` 两行（先放开目录再排除内容）。
原方案写「移出忽略」过于含糊，会让执行者卡住。

### A3 成立 —— 阶段三删恒真断言可能压穿覆盖率门

`jest.config.js:16-19` 四项门全是 90。6 处 `expect(true).toBe(true)` 中至少
`Scene.dragMode.test.tsx:239,243,247` 三处所在文件仍会被计入覆盖率分母。
删断言不改变覆盖率（覆盖率看执行不看断言），但**删整个 `it` 块会**。

裁决：N4 明确「只删断言体、保留 `it` 并补真实断言」，不删块。若必须删块，同批把
`useDragSceneEngine.threshold.test.ts` 的等价覆盖计入，先跑 `--coverage` 确认再提交。

### A4 成立 —— 阶段一 1.2「开 PR 合并」前有 94 个未提交文件

实测 94 项（88 M + 6 ??，含本轮新增的两份任务流），其中 **83 个在 `site/src`**，diff 为
`88 files changed, 1266 insertions(+), 1802 deletions(-)`。这是一次进行中的文档重写。
在它落地前合并 main，PR 里会混进未经复审的散文改动。

裁决：N1 的第一步是**先处置这个工作树**（决定保留或回退），再开 PR。原方案完全没提。

### A5 成立 —— 没有 release workflow 可供 tag 触发

`.github/workflows/` 只有 `ci.yml`，`on:` 只有 `push` 与 `pull_request`。原方案 1.1 说
「浏览器验收移到 tag 触发的 release job」，但那个 job **不存在**，需要新建。

裁决：N2 包含新建 `release.yml`，而非「移动」。

### A6 不成立 —— output/ 基线无脚本引用

实测：全仓（排除 node_modules 与 output 自身）对 `animation-baseline` 的引用为 **0**。
`git rm -r --cached output/` 安全。保留原方案 7 节的改法。

### A7 不成立但需补充 —— husky shim

`.husky/pre-push` 确实是 husky-8 shim（`. "$(dirname "$0")/_/husky.sh"`），且只跑
`type-check` + `test:coverage`。原方案说得对。补充：升 husky 9 与改 pre-push 内容是**两件事**，
可独立进行，不要绑成一个提交。

### A8 成立 —— 本任务流自己的两条验收命令是坏的（自攻发现）

N0 与 N3 的验收命令读 `u.gzipKB`，而 `dist/artifacts.json` 的 artifact 只有
`file`/`module`/`budgetKB`/`label`/`entry` 五个键。实测 `u.gzipKB` 为 `undefined`
⇒ `budgetKB - u.gzipKB` = **NaN**，而 `NaN >= 3` 与 `NaN <= budget` 都为 false。
执行者会卡在一个恒假的门上。

正确写法在 `scripts/verify-build.js:404`：`checkFile(\`${file}.gz\`)` 读**实际 .gz 文件**，
不从清单取字段。两处命令已按此修正。

顺带校准：真实余量 **253 字节**（`dist/cineview.umd.js.gz` = 56067 B，预算 55KB = 56320 B）。
先前记的 168 字节偏低。

两个数都会出现，因为门先舍入再比：`verify-build.js` 的 `getFileSize` 返回
`(size/1024).toFixed(2)` = `54.75`，`(55-54.75)*1024` = **256**；直接按字节
`56320-56067` = **253**。差 3 字节纯属舍入。**全文以 253 为准**（更保守），
但知道门内部按 256 判即可。

⚠️ **A1 的「2765 ≫ 余量」结论后被 A14 推翻**：2765 是未压缩源码块的字节数，
而产物是 minified 的。真实需求 222–731 字节，与 253 字节余量同量级。见 A14。

### A9 成立 —— N2 的验收命令在 N1 完成前必然失败（自攻发现）

`pnpm publish --dry-run` 默认 `git-checks=true`（`.npmrc` 与 `package.json` 均未关闭），
所以 94 个未提交文件会让它在跑到 `prepublishOnly` **之前**就拒绝——失败原因与它要验证的
「无头能否发包」毫无关系，执行者会误判为 N2 未完成。

裁决：N2 隐式依赖 N1 第一步（工作树干净）。依赖图原先把两者画成并行分支，已修正为串行。
若要在工作树脏时预演，须显式 `--no-git-checks`，但那样就不再是发布路径的真实验收。

### A10 成立且重要 —— N0 的 ≥3KB 门很可能达不到（自攻发现，量化在此）

先证伪了「这批死码是纯类型、零字节」的担忧：它们**确实在产物里**——
`onRenderProgressChange` 在 `dist/cineview.es.mjs` 有 11 处命中，
`onScrollProgressChange`/`onScrollCommit`/`scrollCommitThreshold` 各 4 处。不是类型擦除。

但收益远小于预期。实测 UMD 产物里这 10 个标识符：

```
raw 合计         921 字节 / 45 次命中
抹除后重新 gzip  56198 → 56045，仅省 153 字节（0.15KB）
N0 需要          2765 - 256 = 2509 字节
```

原因：gzip 对重复标识符压缩极好，raw 921 字节压缩后只值 153。
**仅删这批 prop 链达不到 ≥3KB**，必须连带删掉周边的转发链、归一化分支与
57 项 `INTERNAL_SCENE_PROPS` denylist；即便如此仍可能不够。

裁决（两条，按顺序试）：

1. N0 的门改为**实测驱动**而非预设：删完先量，把真实余量写进节点记录。
   若 < 3KB，不要硬凑——直接走第 2 条。
2. **N3 的保底方案升为主方案**：把「零 Scene」「Scene 无子元素」「无效 after id」
   三条从 `console` 改走 `reportError`（该通道在 dist 存活），成本远低于 2765 字节。
   dev 产物（`exports` 的 `development` 条件）作为后续增强，不阻塞 N3 收口。

这条改变了 N0 与 N3 的关系：N0 不再是 N3 的**硬前置**，而是「尽力腾余量」；
N3 用 reportError 路径即可独立完成。原依赖图的强绑定被弱化。

### A11 成立 —— N2 的 docker 验收命令本身跑不起来（复审代理实测，独立于 A9）

复审代理在 `/tmp` 建真包做对照实验，得到三条硬事实：

1. **`--dry-run` 确实执行 `prepublishOnly`**（干净树上打印出 `PREPUBLISH_ONLY_RAN`），
   npm 认证缺失只是 warning ⇒ 用 dry-run 验证发布链是**有效**方法。
2. 脏树被 `ERR_PNPM_GIT_UNCLEAN` 拦在 `prepublishOnly` **之前** ⇒ 独立验证了 A9。
3. **`npx --no-install pnpm` 在裸 node:20 里必失败**：
   `npx canceled due to missing packages and no YES option: ["pnpm@11.25.0"]`
   ——`--no-install` 禁止下载，而容器里没有 pnpm。原验收命令与要测的东西无关地失败。

修法（`package.json` 已声明 `packageManager: pnpm@10.22.0`，corepack 可接管）：

```
docker run --rm -v $PWD:/w -w /w node:20 sh -c \
  'corepack enable && corepack prepare pnpm@10.22.0 --activate && pnpm publish --dry-run --no-git-checks'
```

`--no-git-checks` 是必需的：容器里挂载的工作树带 `.git` 但身份/状态未必干净，
而这条门要测的是**无头能否跑完 prepublishOnly**，不是树干不干净（后者由 N1 的门管）。

顺带修正两处计数：`main..HEAD` 实测 **28** 不是 30；未提交项 **94**（88 M + 6 ??，
含本轮新增的两份任务流）。

### A12 成立 —— 「470 行零风险抽离」把三种不同性质混成一类（复审代理发现）

复审代理指出 `resolveVisibilityGates` 不是纯几何，我逐项复核后确认它对、我错。
四处候选逐一实测（顶层声明数 / DOM 读 / hook 调用 / 裸 return）：

| 候选                                                      | 行  | 顶层声明 | DOM 读 | hooks | 裸 return | 真实性质               |
| --------------------------------------------------------- | --- | -------- | ------ | ----- | --------- | ---------------------- |
| `dragVisualState`（`useAnimateDrag.ts:174-395`）          | 222 | **4**    | 0      | 0     | 0         | **真零风险**，原样可搬 |
| `resolveVisibilityGates`（`useAnimateScroll.ts:566-617`） | 52  | **0**    | **3**  | 0     | **1**     | 内联块，**非纯函数**   |
| `useSceneStyles`（`Scene.tsx:823-899`）                   | 77  | 0        | 0      | **6** | 0         | hook 抽离              |
| `useAnimatePublicTimeline`（`Animate.tsx:690-779`）       | 90  | 0        | 0      | **3** | 1         | hook 抽离              |

`resolveVisibilityGates` 的第一行就是 `hostElement.getBoundingClientRect()`，
第 573 行的 `return;` 是**从外层 `runVisibilityUpdate` 提前返回**，并引用 3 个闭包变量
（`hostElement`/`enterMargin`/`exitMargin`）。它连函数声明都没有——抽它必须先把控制流
改成返回值，属**有行为风险的重构**，不能与纯函数搬迁同批做。

裁决：N6 的这一条拆成三批，各自独立收口：

1. **批 A（真零风险，先做）**：只搬 `dragVisualState` 222 行。`useAnimateDrag.ts` 785 → ~563。
2. **批 B（hook 抽离，中风险）**：`useSceneStyles` + `useAnimatePublicTimeline`，
   风险在依赖数组遗漏而非纯度 —— 每个单独提交，跑全套后再动下一个。
3. **批 C（控制流重构，高风险，可选）**：`resolveVisibilityGates` 需先将裸 `return`
   改为哨兵返回值。收益是让 50 行几何可单测（现仅能透过 234 行循环测），但
   **不属于「零行为变更」**，须按功能改动对待。若时间有限，直接跳过。

原文「约 470 行零风险纯函数抽离，零行为变更」是**错的**——只有 222 行符合该描述。

### A13 成立且系统性 —— 第一轮审核有三条断言读的是 HEAD，而工作树已修好（复审代理发现）

复审代理指出「行号追踪 HEAD 而非工作树」。这不是个别失误，是**一类**错误：那 94 个
未提交文件里的文档重写**已经修掉了**我报告为缺陷的东西，而我读的是 `git show HEAD:`。
三条断言因此全部作废：

**1. `exitRef` 语义（原报为 P1「文档 4 处与源码正好相反」）—— 完全不成立。**
三层证据一致，文档是对的：

- `useAnimateScroll.ts:325-339` 注释：`exitRef always disables the automatic exit gate`，
  且 `Only the VISIBILITY lane can honour a manual trigger`；
- `useAnimateManualControl.test.tsx:4-10` 契约：`exitRef → the automatic exit gate is
disabled outright`，`scrub lanes → refs are reported as unsupported`；
- 工作树 `en/advanced/07-common-pitfalls.md:16` 已写明：适用可见性轨，
  scrub 轨报 `INVALID_ANIMATION`。

决定性事实：`grep -c 'enterRef|exitRef' src/components/Animate/useAnimateDrag.ts` = **0**
——drag hook 根本收不到这两个 ref；`Animate.tsx:648` 只在 `isDragArrival` 时传 `enterRef`。
所以「drag 下 exitRef 无效」与「exitRef 关闭自动退场」**同时为真**，我把两条轨的规则
混成了矛盾。**此条从方案中删除，不是缺陷。**

**2. `zh/concepts/03-visibility-conditions.md` 缺 `## 相关页面` —— 不成立。**
工作树与 HEAD 的第 73 行**都是** `## 相关页面`，标题数 en/zh = **8/8**。双语零漂移。

**3. 「CLAUDE.md 说 terser 已移除但仍在用」—— 归因错了。**
当前 `CLAUDE.md` 与 `AGENTS.md` 提 terser 均为 **0 处**，只有 `HEAD:AGENTS.md` 有 1 处。
`scripts/minify-library-entries.mjs` 确实仍直接用 terser（2 处），但**没有任何现存文档
声称它已移除**。缺陷不存在。

**附带：A-1 的「AGENTS.md 是陈旧分叉」也已过期。**
`HEAD:AGENTS.md` 280 行、含错误枚举 `driver: 'scroll'`；**工作树已重写为 63 行的指针文件，
错误枚举 0 处**。那次未提交的重写已经修好了这条 P0。

裁决（影响 N1 与 N5）：

- **N1 第一步的性质变了**：那 94 个未提交文件不是「未经复审的散文改动」，而是**已修好
  多条 P0/P1 的成果**。倾向保留而非回退——但仍是用户决策点。
- **N5 必须先 `git stash` 再复核**，否则会继续把已修项报为缺陷。
- 本任务流所有 `site/src/content/docs/**` 行号**默认指工作树**，引用 HEAD 时必须显式写
  `HEAD:`。

### A14 成立且推翻 A1 前提 —— 2765 字节高估约 3.8 倍，N0→N3 依赖链可拆（复审代理发现）

复审代理用不同方法量同一件事，得 **731 字节**；A1 与我的复算都得 ~2757。我复核后确认
**代理对、A1 与我都错**，且错因单一：

| 测法                                        | raw  | 真实 gzip 增量 |
| ------------------------------------------- | ---- | -------------- |
| 未压缩源码块（含注释/缩进/中文）← A1 与我   | 6821 | **2749**       |
| minified 诊断文案（真正进产物的形态）← 代理 | 549  | **222**        |

产物是 esbuild minify 后的结果，注释与缩进**根本不进产物**。拿源码块字节去对体积预算，
高估约 3.8 倍。代理另指出其提取器本身也不可靠：20 个 guard 命中里 2 个是注释行、
3 个是子表达式（`||=` / `else if` / 一个 `&&` 分支），brace-matching 会过量捕获——
把它喂给仓库自带 terser 直接 `parse failed: Unexpected token`。

**连带影响（重要）：**

1. **A1 的「顺序反了」结论作废。** N3 真实需求约 **222–731 字节**，现有余量 **253 字节**
   （权威值，见 A10）。已经够或几乎够 —— **N0 不再是 N3 的硬前置**。
2. **A10 的裁决因此更稳。** A10 已实测 N0 全删只省 153 字节、达不到 ≥3KB 门；
   代理独立复算为 **358 字节上界**（含 denylist 字符串 977 字节全删的理想情形），
   量级一致。两条独立取证都指向：**≥3KB 门不可达，且不必要。**
3. **N0 降级为纯卫生任务**，与 N3 解耦，可并行或延后。

**代理另发现一处 N0 完全遗漏的真实体积项**（比它列的任何一条都大）：
`useSceneAnimationRegistry` 那套 Problem/Fallback/Fix 文案**已经进了三个 UMD 产物**
（`Fix:` 各 4 处），因为字符串在 `:246-252` 无条件构建、而 `devWarn` 在 `:254` 才被 drop。
**产物为永远打印不出来的诊断文案付费。** 这既是体积浪费，也说明 N3 的 `reportError`
保底方案成本比预估更低 —— 文案本来就在产物里。

裁决：N0 与 N3 解耦；N3 先做（成本已知且低）；N0 作为独立卫生项，门改为
「实测收益 ≥ 100 字节即可」而非 ≥3KB；顺带清理那批打印不出的文案。

### A15 成立且升级严重度 —— renderProgress 是真实 stale latch 缺陷，非命名问题（复审代理发现）

我第一轮把它定性为「不变量文档与实现不符 + 命名重复」，归入 N6 清理项。**定性错了，这是正确性缺陷。**

四环全部实测成立：

```
CineView.tsx:1033  pendingRenderRebaseRef.current = true   ← 武装
CineView.tsx:1034  sceneActions.commitDragSceneChange(…)   ← 随后才调 reducer
useSceneManager.ts:491-497  越界早退：reset/setDirection/setIsAnimating 后 return
                            ← 全程不调 setCurrentScene
CineView.tsx:429-434  useLayoutEffect deps=[currentScene,…]
                      ← currentScene 未变 ⇒ 不运行 ⇒ 旗标滞留
```

`pendingRenderRebaseRef` 全仓仅 4 处（声明 `:256`、读+清 `:430-431`、武装 `:1033`），
**没有任何其他清除路径**。所以越界早退后旗标一直举着，在**下一次无关的 `currentScene`
变化**时放电，把 `renderProgressMotion` 与 `dragTimelineProgressMotion` 归零——
那一刻没有任何代码打算归零它们。

可达性：`useDragSceneEngine.ts:804` 的 bounce 分支正是终点场景路径，即触达越界早退的入口。
测试现状：`commitDragSceneChange` 仅 2 个测试文件覆盖，越界早退分支的旗标残留**无断言**。

修法（代理建议，我认同）：把武装移进 reducer 的已提交路径，或在越界分支显式清旗标。
**不是**改名。改名可以留在 N6，这条要单独出一个 bug 修复节点 + 回归测试。

### A15b 不成立 —— aria-live「全仓 0」的断言是对的

代理 FAIL 掉我这条，说 site 有 2 处 `aria-live="off"`。**它读错了我的断言范围。**

```
框架 src(非测试)  0 处   ← 我的断言就是这个范围
dist/cineview.es.mjs 0 处
site/src         2 处，均为 aria-live="off"（DragTimecode.tsx:100 / TimelinePlayhead.tsx:64）
```

`site/` 不随包发布，且两处值都是 `"off"`——**语义上等于不播报**。框架无障碍缺口的
结论与措辞均不需要改。为避免歧义，N7 表述已加限定：「框架 src 与 dist 为 0；
site 演示有 2 处 `aria-live="off"`，值为 off 故不构成播报能力」。

### A16 成立且推翻 N4 主动作 —— 修打桩不会红，因为断言根本不读派生值（复审代理实测）

N4 原写「修 `useTransform` 打桩会**红一批**，那些红是真实缺口」。**因果方向错了。**

复审代理（死于 429 前已完成实验）在沙箱里真的装上忠实打桩，再注入变异 M1
（让混合车道忽略自己的输入），跑 `Animate.test.tsx`：

```
仪表 UT_INSTRUMENT = {"calls":17710,"nonzero":2250}   ← 打桩确实忠实、确实产出非零派生值
[base] 忠实打桩 + 未变异 src → 110/110 全绿
[m1]   忠实打桩 + 变异 src   → 110/110 全绿   ← 变异存活
```

我独立复核该文件的断言构成，结论比代理更锋利：

```
总行数 2533 / expect 总数 118
toBeInTheDocument                      63
读 style/opacity/transform 的断言        0     ← 零
```

**打桩不是根因，只是共犯。** 根因是 118 个断言中**零个**读派生数值——断言的对象是
「元素在不在 DOM 里」。所以把打桩修忠实，测试照样全绿，变异照样存活。

裁决：N4 主动作从「修打桩」改为「**补断言**」。修打桩是必要前置（不修则断言无值可读），
但它自己不产生任何红灯，因此**不能用「跑一遍看红多少」验收**。验收必须是变异测试：
注入 M1 类变异，要求 `Animate.test.tsx` 由绿变红。工作量与性质都与原方案不同。

顺带：代理另测出 React 19 专线**不是假绿**——它确实跑完整 RTL 套件（`1 failed / 1530 passed`
的那次失败是沙箱 peer 解析产物，非 React 19 本身）。原方案 N1 的「预期暴露 React 19 假绿」
是错的预期。

## B. 阶段节点（每节点必须以「fresh 子代理对抗复审返回显式 PASS」收口）

按仓库既有纪律：节点末尾派**全新**子代理做对抗/变异复审，拿到显式 PASS 才算完成。
探针绿不等于没问题——规则表逐条落检查，清零 grep 必须 `-i`，FAIL 后再叫 fresh agent。

### N0 · 腾出 UMD 预算余量（新增前置节点，原方案缺失）

**依赖关系已变（A14）**：原以为 N3 需约 2.8KB、故 N0 必须前置。实测该数字**高估约 3.8 倍**
——注释与缩进不进 minified 产物。N3 真实需求 **222–731 字节**，现有余量 **253 字节**，
已经够或几乎够。**N0 不再是 N3 的硬前置**，降级为独立卫生任务，可并行或延后。

**本节仍值得做**：死代码该删（A10 实测 10 个标识符确实在产物里，`onRenderProgressChange`
在 ESM 有 11 处），但**别指望它腾体积**——A10 实测全删省 153 字节，代理独立上界 358 字节。

动作：删 4.3 节那批 prop 形态死代码链——它们既是死码又是体积。原方案把它排在阶段四，
但它是 N3 的前置条件。

- `onRenderProgressChange`：`CineView.tsx:1141` 硬编码 undefined，却穿 5 文件 16 处
  （`DragSceneStack.tsx:65,164,286` → `Scene/helpers.ts:136,216,246` →
  `Scene.tsx:66,157,183,738` → `Scene/types.ts:182,221` → `useDragSceneEngine.ts` 9 处）
- `setRenderProgress`（`useSceneManager.ts:113,679`）零生产调用者；`renderProgress` 只被置 0
  ⇒ `DragSceneStack.tsx:261` 恒传 0，`useAnimateDrag.ts:102` 的 `??` 回落不可达
- 六个「声明→归一化→转发→从不调用」回调：`onScrollProgressChange`、`onScrollDirectionChange`、
  `onScrollCommit`、`onScrollReset`、`onSharedElapsedMsChange`
- `scrollCommitThreshold`/`scrollReleaseDuration`/`scrollLockToSingleScene`（`helpers.ts:209-211`
  归一化后零消费）；`scrollSpeed`/`scrollControlled` 仅出现在依赖数组
- `getGlobalPerformanceMonitor`（`performanceMonitor.ts:268`，`@deprecated`、不在 public-api）
- 顺带缩小 `Scene.tsx:43-101` 的 57 项 `INTERNAL_SCENE_PROPS` denylist
- `isVerboseDragDebug`+`debugDrag` 在 `useAnimateDrag.ts:67-88` 与
  `useDragSceneEngine.ts:8-29` 逐字重复 25 行 —— 合并

验收：

```
pnpm build:verify                      # 14/14
node -e "const fs=require('fs');
  const a=require('./dist/artifacts.json');
  const u=a.artifacts.find(x=>x.file==='cineview.umd.js');
  const kb=fs.statSync('dist/'+u.file+'.gz').size/1024;
  console.log('余量字节:', Math.round((u.budgetKB-kb)*1024))"   # 记录即可，不设 3KB 门
pnpm test:coverage:framework           # 1533 例仍全绿
```

门：**实测净收益 ≥ 100 字节 且 1533 例全绿**（A10：删死码会动 5 个测试文件的断言）。
收益不达标不算失败——按 A14，N0 的价值在代码卫生，不在体积。
N0 **不阻塞 N3**：N3 真实成本 222–731 字节、现有余量 253 字节，两条路径都走得通。

### N1 · 处置工作树 + 合并 28 个提交（原 1.2，加前置步骤）

**第一步（原方案缺失）**：处置 94 个未提交文件。88 M + 6 ??，83 个在 `site/src`，
`1266 insertions / 1802 deletions`。这是进行中的文档重写。裁决保留或回退——
**这是用户决策点，不是执行者可自行决定的**。落地后工作树必须干净。

第二步：开 PR 合并 `codex/drag-release-dual-gate` → `main`（28 commits，实测 `git rev-list --count main..HEAD`）。
CI 三条 lane（Node 18/20/22 矩阵、真 Chrome 验收、React 19）首次门禁真实代码。
~~预期暴露 React 19 专线假绿~~ **A16 已推翻**：该专线确实跑完整 RTL 套件，不是假绿。
预期它正常通过（`@testing-library/react ^14` 的 peer 只声明 React ^18，会有警告但不失败）。

第三步：清理仓库卫生（A6 已确认安全）。
`git rm -r --cached output/`（23 个基线 PNG / 13MB，`.gitignore:47` 因先提交后加规则而失效：
`git check-ignore -v output` 无匹配、`--no-index` 才命中）；
删 3 个死分支 + 2 个陈旧 worktree（`worktree-agent-a1fe635859bd090d9` 无 worktree 附着零独有提交、
`worktree-agent-a4eb88d03b93e9016` = main、`adversarial-probe` 的 `f164470` 已含于当前分支）。

验收：

```
git status --porcelain | wc -l          # 0
git log main..HEAD --oneline | wc -l    # 0
git ls-files output/ | wc -l            # 0
```

门：PR 三 job 全绿 + 工作树干净 + `main..HEAD` 为空。

### N2 · 让包能发出去（原 1.1 + 1.4 + 新建 release.yml）

`prepublishOnly` 改指 `verify:framework:static`。根因：
`prepublishOnly → verify → verify:all → verify:framework → test:browser`，而
`examples/performance-test/acceptance-{drag,scroll}.mjs:79-82` 回落
`chromium.launch({ channel: 'chrome' })`，依赖是 `playwright-core`（不下载浏览器）。

**新建** `.github/workflows/release.yml`（A5：它不存在，不是「移动」）：`on: push: tags: ['v*']`，
含 `browser-actions/setup-chrome@v1` + `test:browser` + `verify:browser-failure-injection`。

CHANGELOG 补 `## 1.0.0`：把 `site/src/content/docs/{en,zh}/components/01-cineview.md:158-172`
那 13 行迁移表提升为 BREAKING 段（`config.size`→`designWidth`、`timeline.waitFor`→`timeline.after`、
`infiniteAnimation`→`loopAnimation`、`timeline.sceneControlled`→`timeline.driver`、
`visibility.replayOnReenter`→`visibility.replay`、`onSceneWillChange`→`onSceneEnter`、
`onSceneDidChange`→`onSceneLeave`、`onDragCommit`→`onDragEnd`、`getCurrentScene()`→
`getCurrentIndex()`、`performance.monitor`→`monitor`、`Position layer.fixed`→`Position fixed`、
`Scene stack.mode/zIndex`→`layout.overlap/zIndex`、`modes` wrapper 拍平）。
然后 `git tag v1.0.0`。

顺带：`files` 收窄（tarball 5.0MB 解包里 19 个 `.map` + 11 个 `.gz` 是死重量，
`cineview.umd.js.map` 单个 1.07MB）；补 `homepage`；补 `browserslist`（真实基线高于
`vite.config.ts:143` 的 `es2020`——用了 `ResizeObserver` 6 文件、`requestVideoFrameCallback` 1、
`??=` 1）；补 `.github/` 三件套 + dependabot.yml。

验收：

```
docker run --rm -v $PWD:/w -w /w node:20 sh -c \
  'corepack enable && corepack prepare pnpm@10.22.0 --activate && pnpm publish --dry-run --no-git-checks'
grep -c '^## 1.0.0' CHANGELOG.md        # 1
git tag | grep v1.0.0                   # 命中
npm pack --dry-run                      # 解包 < 1.5MB
node -e "console.log(require('./package.json').homepage)"                          # 可访问 URL
```

门：无头 dry-run publish 通过。

### N2b · 修 renderProgress stale latch（A15 新增，正确性缺陷）

**为什么单独成节点**：第一轮误归为 N6 的「命名/文档清理」。A15 实测证明它是真实 bug——
越界早退路径会让 `pendingRenderRebaseRef` 滞留，在下一次无关场景切换时把两个 MotionValue
意外归零。清理任务可以延后，正确性缺陷不能。

动作（二选一，倾向前者）：

1. 把 `CineView.tsx:1033` 的武装移进 `useSceneManager.ts` 的**已提交路径**——
   即越过 `:491-497` 越界早退之后再置旗标；
2. 或在 `:491-497` 越界分支显式清 `pendingRenderRebaseRef`（需把 ref 传进 reducer，
   耦合更重，故为次选）。

必须同批补回归测试：现状 `commitDragSceneChange` 仅 2 个测试文件覆盖，
**越界早退后旗标残留无任何断言**。测试要断言「越界提交后旗标为 false」，
以及「随后一次正常场景切换不会意外归零 renderProgressMotion」。

验收：

```
pnpm test:coverage:framework    # 全绿，且新增回归用例存在
pnpm type-check                 # 0 错误
# 变异验证：手动把修法回退，新测试必须转红
```

门：新回归测试在修法回退时**必须红**（否则测的不是这个 bug）。放在 N3 之前或并行皆可。

### N3 · 恢复生产诊断（原 1.3，改法被否决重写）

**否决原方案改法一**（停止折叠 NODE_ENV）：它把 2765 字节 gzip 无条件塞回生产产物。

改走 `exports` 的 `development` 条件。当前 exports 只有 `types`/`import`/`require`，
加 `development` 是纯增量：

```
".": {
  "types": "./dist/index.d.ts",
  "development": "./dist/cineview.dev.mjs",
  "import": "./dist/cineview.es.mjs",
  "require": "./dist/cineview.umd.js"
}
```

`cineview.dev.mjs` 保留 dev 卫语句与 console；生产三产物维持现状零诊断。
`development` 条件必须排在 `import` 前（条件顺序即优先级）。dev 产物**不进现有体积门**，
但要新增一条「dev 产物必须含诊断」的门。

保底（若 dev 产物工作量超预算）：把「零 Scene」「Scene 无子元素」「无效 after id」三条
从 `console` 改走 `reportError`——该通道在 dist 存活，成本远低于 2765 字节。
这三条是底线，因为**零 Scene 目前等于静默白屏**。

诊断质量值得保住：`useSceneAnimationRegistry.ts:220-238` 是 Problem/Fallback/Fix 三段并点名
具体 id；环形 `after` 打印完整环路；重复 `animateId`/`scroll.zoneId` 都点名场景。

验收：

```
grep -c "No Scene components found" dist/cineview.dev.mjs     # ≥ 1
pnpm build:verify                                              # 14/14（生产产物未变）
node -e "const fs=require('fs');
  const a=require('./dist/artifacts.json');
  const u=a.artifacts.find(x=>x.file==='cineview.umd.js');
  console.log(fs.statSync('dist/'+u.file+'.gz').size/1024 <= u.budgetKB)"   # true
```

门：dev 产物有诊断 **且** 生产体积门未退化。

**N3 可独立于 N0 开始（A14）**。若走 `reportError` 保底方案成本更低——A14 发现那批
Problem/Fallback/Fix 文案**本已在三个 UMD 产物里**（`Fix:` 各 4 处），只是 `devWarn`
被 drop 导致永远打印不出。产物在为打印不出的文案付费。

### N4 · 让绿灯真的代表安全（原阶段三，A3 修正删法）

**主动作，占本节点八成价值**：给 `Animate.test.tsx` **补断言**。
（原写「修打桩」，**A16 已推翻**——见下。）

现状两层：`:100` 的 `useTransform` 打桩 `() => createMotionValueStub(0)` 既忽略 source
又忽略映射函数；`:62-64` 以 `void animate; void variants; void custom;` 丢弃组件输出。
但**根因不在打桩**，实测断言构成：

```
总行数 2533 / expect 总数 118
toBeInTheDocument                      63
读 style/opacity/transform 的断言        0     ← 零
```

A16 的沙箱实验证明：装上忠实打桩（仪表 `calls:17710, nonzero:2250`，确实产出非零派生值）
后注入变异 M1，`Animate.test.tsx` 仍 **110/110 全绿，变异存活**。因为 118 个断言里
**零个**读派生数值。

改法分两步，顺序不可颠倒：

1. **前置**：打桩真实消费 `(source, fn)`——订阅 source、套 `fn`、产出新 stub。
   这一步**不会产生任何红灯**，不要以「红多少」衡量它。
2. **主体**：补断言，让测试真的读那些派生值（style/opacity/transform）。
   这是本节点的实际工作量所在。

放大器要记账：123 个测试文件里 34 个 mock 掉 framer-motion——正是持有每帧数值的库。
「每帧纪律」这一最强项恰是被 mock 最狠的部分（性能维度靠源码走查建立，非测试）。

**A3 修正**：处理 6 处 `expect(true).toBe(true)` 时**只删断言体、保留 `it` 块并补真实断言**。
删块会改变覆盖率分母，而 `jest.config.js:16-19` 四项门全是 90。
若必须删块（`Scene.dragMode.test.tsx:239,243,247` 的等价覆盖在
`useDragSceneEngine.threshold.test.ts:7-21`），先跑 `--coverage` 确认再提交。
`drag-progress-control.test.tsx:44,184` 是**回归文件**，必须补真实断言而非删除。

其余：

- `integration/performance.test.tsx` 去掉 `if (metrics)` 包裹（`:927-934`、`:596-608`、`:431-433`
  让零断言照样绿）；`:806-842` spy 了 `console.warn` 却不断言，`:615-650` 对 rAF 同样
- 空集恒真：`registry.branches.test.ts:139,210` 对可能为空的 map 调 `.every()`；
  `properties/relativePositionAccumulation.property.test.tsx:98,172,227,261,298` 把
  `if (element)` 放进 fast-check 主体 ⇒ 包装层不渲染时 100 次运行全部空过
- 补 SSR 冒烟测试（实测 `renderToString` 输出 1301 字节、`sideEffects: false` 已设，
  但**零覆盖**；下次模块顶层碰 `window` 就静默破掉）
- `@testing-library/react` 升 `^16`（`^14` peer 只声明 React ^18）。
  **注意 A16 更正**：该专线**不是假绿**——它确实跑完整 RTL 套件，复审代理沙箱里那次
  `1 failed / 1530 passed` 是 peer 解析产物而非 React 19 本身。升级仍值得做（消除 peer 警告），
  但不要写成「修掉一条假绿」。
- `checkMinifierStrategy` 计进 `verify-build.js` 打印的门数（现在能让构建失败却不在「14」里）

干净的一面（避免误伤）：123 文件零 `.skip`/`.todo`/`.only`；
`__tests__/bugfix/drag-rush-regrab.test.tsx` 是范本——先陈述修复前症状再数值断言
（`:369` transform、`:396` lane 同一性、`:535` `fromValue).toBe(2800)` 证明续跑而非重播）。

验收：

```
pnpm test:coverage:framework    # 全绿，且四项覆盖率仍 ≥ 90
grep -rn "expect(true).toBe(true)" src/ | wc -l      # 0
grep -rn "if (metrics)" src/__tests__/integration/performance.test.tsx | wc -l   # 0
grep -cE 'expect\([^)]*(style|opacity|transform)' \
  src/components/Animate/Animate.test.tsx           # 必须 > 0（现在是 0）
```

**门：变异测试，不是「跑一遍看红多少」**（A16：忠实打桩下变异存活、110/110 全绿）。
注入 M1 类变异（让某条车道忽略自己的输入），要求 `Animate.test.tsx` **由绿变红**；
变异回滚后复绿。覆盖率四项未跌破 90。

### N5 · 文档修正（原阶段六；**A13 删去三条，剩余项已按工作树核实**）

⚠️ **动手前先 `git stash`**：那 94 个未提交文件已修好多项，不 stash 会把已修项当缺陷改。
本节所有行号指**工作树**；引用 HEAD 显式写 `HEAD:`。

- **`never` 语义误导**：`{en,zh}/components/03-animate.md:28`（及 `zh:80`）说 `enterAnimation`
  必须是 `never`。`src/types/index.ts:592`（`LoopOnly` 类型内）是 `enterAnimation?: never`——**键必须缺席**。
  `07-common-pitfalls.md` 已把「真的写 `never`」列为陷阱。
  **en/zh 已分叉**：`en/03-animate.md` 提 `never` 5 处、`zh` 仅 2 处 —— stash 后逐条复验，
  勿假设两侧同构。
- 改名残留：`en/components/03-animate.md:27` "coexist with enter or **infinite**"
- `advanced/10-types.md` 缺 `AnimateVideoProps`/`ImageProps`/`ContainerProps`（DESIGN.md 也缺）
- `advanced/01-performance.md:37` 双语引用 `performanceMonitor.ts:101-106` 应为 `:103-105`
- `zh/advanced/09-use-animate-timeline.md:51` 删「状态机」（WRITING.md 规则 6 禁词）。
  **注意：这条是工作树新引入的**——HEAD 版该文件 0 处命中，工作树 1 处。
  `WRITING.md:14,23,25` 的 3 处是规则表自身在定义禁词，正当，勿动。
  全文档树仅此 1 处真实违规。
- **A2 修正**：把 `docs-style-probe.mjs` 移到 `site/tools/`（否定式对被忽略目录无效，实测
  `git check-ignore -v` 命中 `site/.gitignore:24:scripts`），接进 `verify:all`。
  同批处理 MEMORY.md 引用的 `drag-scrub-probe.mjs`。
- DESIGN.md 加 TOC（2639 行 / 123 标题 / 零目录，而 `CONTRIBUTING.md:5` 让英文贡献者先读它）
- `COVERAGE_REPORT.md` 的「分支 89.15% 不得称为可发布」已过期（实测 90.57%、门 90、绿）

**不做**（对抗评审否决，四条）：

1. **`exitRef` 那条不存在**（A13）。源码注释 `useAnimateScroll.ts:325-339`、测试契约
   `useAnimateManualControl.test.tsx:4-10`、工作树文档三者一致：`exitRef` 关闭自动退场
   仅限可见性轨，scrub 轨两个 ref 都报 `INVALID_ANIMATION`。
   `grep -c 'enterRef|exitRef' useAnimateDrag.ts` = **0**，drag hook 收不到 ref。
   我把两条轨的规则混成了矛盾。
2. **zh 缺 `## 相关页面` 不存在**（A13）。工作树与 HEAD 第 73 行都是 `## 相关页面`，
   标题数 en/zh = 8/8。
3. **terser 陈述无需修**（A13）。当前 `CLAUDE.md`/`AGENTS.md` 提 terser 均 0 处，
   只有 `HEAD:AGENTS.md` 有 1 处。`minify-library-entries.mjs` 确实仍用 terser，
   但没有现存文档声称它已移除。**固定版 5.46.1 承重，别删。**
4. **AGENTS.md 陈旧分叉已自愈**。`HEAD` 版 280 行含错误枚举 `driver: 'scroll'`；
   工作树已重写为 63 行指针文件，错误枚举 **0 处**。

验收：`pnpm verify:all`（含新接入的文风探针）+ 双语结构扫描 40=40 且零漂移。

### N6 · 结构与性能余量（原阶段四剩余部分）

N0 已取走死代码部分。此处剩：

- 抽离分三批（**见 A12，原「470 行零风险」已证伪**）：
  批 A 真零风险 —— `dragVisualState.ts`（`useAnimateDrag.ts:174-395`，222 行，4 个顶层
  function、零 DOM 读、零 hook）；批 B hook 抽离 —— `useSceneStyles`（`Scene.tsx:823-899`）
  - `useAnimatePublicTimeline`（`Animate.tsx:690-779`），各含 6/3 个 hook，逐个单独提交；
    批 C 可选高风险 —— `resolveVisibilityGates`（`useAnimateScroll.ts:566-617`）含 3 处 DOM 读
    与 1 个裸 return，须先改控制流，非零行为变更
- `createRenderLane` 合并 bounce/settle **降级为高风险独立子任务**，不与 `handlePanEnd`
  行数收益捆绑（复审代理实测三处行为分歧）：
  1. **补间对象不同**——bounce 直接动 MotionValue（`useDragSceneEngine.ts:470`），
     settle 动的是普通数字 `laneProgress`（`:708`）再有条件写出；
  2. **写入守卫不同**——settle 每次写都过 `releaseTokenRef` 校验（`:716`）并**故意不写终值**
     （`:721-723` 的 1e-6 抑制），bounce 无 token 守卫、无条件写（`:476`）；
  3. **suspend 语义不同**——bounce 在 suspend 与 resume 两处都从 MotionValue 重取快照
     （`:501,508`），settle **两处都不重取**（`:756-766`），自持 `laneProgress`。
     第 3 条直接决定 `getCurrent()` 的返回值，而 `handleDragStart:295` 用它做 re-grab 播种——
     拍平会正面撞上「mid-settle re-grab 必须就地接管、不得 flush-commit」这条既有纪律
     （flush = 整栈单帧传送）。另 `:779` 注释与 `:674-675` 明确了 lane 对象的**同一性契约**
     （整个 suspend/resume 生命周期须留在共享槽位），合并必须保留。
     ⇒ 三点全部参数化才是行为保持的重构；−110 行仍可信，但「同一状态机写了两遍」说轻了。
- `renderProgress` **仅剩改名工作**：正确性部分（stale latch）已提升为独立节点 **N2b**（见 A15）。
  此处只做命名统一——`CineView.tsx:423` 创建的同一对象在 `Scene.tsx:226` 别名为
  `dragProgressMotion`、`:623-624` 同时以两个名字暴露；`elementElapsedMotion` 在
  `Scene.tsx:628` 又被塞进名为 `sharedElapsedMotion` 的 context 字段（复用了已删除的
  全局标量的词）。改名不改行为，可安全延后。
- 命名债：`elementElapsedMotion` 单写者契约**是被遵守的**（仅 `useElementTrack.ts` 写，28 处
  `.set(`，契约在 `:18-33`），但 context 字段叫 `sharedElapsedMotion`——复用了已删全局标量的词
- P2：`Scene.tsx:338-357` 一个 effect 写 6 个 state 而消费方全读全局值（`:213-221`）⇒ 写了没人读；
  `VideoFrameRenderer.tsx:569-588` 旧路径 seek 无 epsilon（新路径
  `videoPlaybackOwnership.ts:208-213` 有，reducer 在 ref 里故零 React 渲染）；
  `:405` 每次 seek 注册 `{once:true}` 监听且 `seekSamplesRef` 无上界（仅开发期）
- 用 `stress-fps.mjs` 的**自我重排单条 rAF 链**（`:103`）方法论重跑当前构建。
  不要用 N6 探针的 rAF monkey-patch——它按注册而非呈现帧采样，drag `p50=0.0`
  （n=1601/~9.6s/~167 次每秒）证明同帧重复稀释了分布 ⇒ **P95 被低估**，`max` 才承重
- 追那个 **133ms 滚动停顿**（p50 16.7 / p95 17.5 / p99 17.7 / max 133.4，longtask 空）：
  没触发 long task ⇒ 不是主线程 JS，大概率 raster/compositing。结合已知的
  「每帧改 CSS 变量驱动 opacity 会全屏重绘 gradient」，用合成层感知的 trace，别再放行

不要动的三处（有充分理由）：`CineView.tsx` drag 事务机（每 handler 闭包 11 个 ref）、
`Scene.tsx:573-650` context memo（按构造即聚合点）、`useDragSceneEngine.ts:277-365`
（注释 `:288-291`、`:302-307` 编码承重的**顺序契约**）。

验收：`pnpm verify:all` 全绿 + UMD gzip 余量**不低于动工前实测值**（A14 已废除 ≥3KB 门）

- 当前构建有性能数据 + 133ms 有结论。

### N7 · 无障碍（原阶段五，不变）

对动画框架而言这是资质问题，不是打磨问题。已有能力证明：`ScrollbarOverlay` 完全标准
（`role=`、`aria-label`、`tabIndex`、方向键共用步长表）——覆盖面问题，非能力问题。

| 缺口                            | 实测                                                                                     | 改法                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `prefers-reduced-motion` 零支持 | 非测试源码 **0**、dist **0**；真 hook 在 `site/` 不随包发布                              | 框架级开关：入场/退场取终态、循环停摆、scrub 仍跟随输入       |
| 非活动场景仍暴露给辅助技术      | JSX `inert=` **0**（5 处 `inert` 命中全是注释里英文形容词）；只设 `pointerEvents:'none'` | 加 `inert`；无 `inert` 时回落 `aria-hidden` + `tabIndex={-1}` |
| 换场无播报                      | 全仓 `aria-live` **0**                                                                   | polite live region 写场景标识                                 |
| drag 零键盘可达                 | drag 路径 `keydown` **0**（命中全在 scroll 文件）                                        | 接已存在的 `goToScene()`（`src/types/index.ts:420`）          |

验收：真机探针（非静态审查）证明四条生效 + `pnpm verify:all` 全绿。

### N8 · 收尾

husky 9 升级与 pre-push 内容修正**分两个提交**（A7）。pre-push 现只跑
`type-check` + `test:coverage`，跳过 `lint`/`format:check`/`build:verify`/`quality:duplicates`
与两个 failure-injection 门 ⇒ 改跑 `verify:framework:static`。
两个 hook 用 husky-8 shim（`. "$(dirname "$0")/_/husky.sh"`，husky 9 已移除）⇒ 升级前必须改。

依赖分批升（配好 dependabot 后）：vite `^5`→8.2.2、eslint `^8`→10.9.1、typescript `^5`→7.0.2、
`@typescript-eslint/*` `^6`→8.68.0、jest `^29`→30.5.0、husky `^8`→9.1.7。
`site/review/` 90 文件 36MB + `site/public/*.mp4` 13.8MB 移 LFS 或工件存储。

**语言策略裁决（用户决策点）**：注释密度 12% 健康，但 22% 含中文、42 个重注释文件里 14 个
以中文为主；README/CONTRIBUTING 是 0% 中文，DESIGN.md 是 113KB 中文却被 CONTRIBUTING 要求
英文贡献者先读。目前是**门面英文、内核中文**这个最糟组合。
① 明确「内部中文、对外英文」并改掉 CONTRIBUTING 指引，或 ② 统一为一种。不是缺陷，是策略。

## C. 依赖图与最短路径

```
N1（① 处置工作树 ② 合并 28 提交 ③ 仓库卫生）
   ├─→ N2（发包，需干净树：A9/A11）
   └─→ N4（测试可信度）─→ N6（结构重构，需真安全网）

N2b（stale latch 正确性缺陷）独立，可与 N2/N3 并行
N3（恢复诊断）独立 —— A14 已废除 N0 前置
N0（死码卫生）独立，不再阻塞任何节点
N5（文档）· N7（无障碍）独立
N8（收尾）最后
```

强制约束（仅剩三条）：**处置工作树在开 PR 之前**（A4）；**N1 在 N2 之前**——脏树让
`pnpm publish --dry-run` 因 `ERR_PNPM_GIT_UNCLEAN` 提前失败（A9/A11）；**N4 在 N6 之前**——
`useTransform` 打桩坏着做重构，安全网是假的。

~~N0 在 N3 之前~~ 已废除：A14 实测 N3 只需 222–731 字节，现有余量 253 字节。

只做四件（按分数杠杆）：

1. **N1** —— 不做这个，其余所有验证都不算数（且工作树里已修好多条 P0/P1，倾向保留）
2. **N4** —— 决定其余所有绿灯值多少钱
3. **N3** —— 唯一会让用户遇到静默白屏的缺陷
4. **N2b** —— 唯一的已确证正确性 bug（A15）

四件之后 B− → B+。要 A− 必须补 N7（无障碍是当前最低分维度 4.5）。
