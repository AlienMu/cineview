# 2026-09-01 · 七维全部 9.0 的路线图

前置：`2026-09-01-release-readiness-execution.md`（B− → B+ 的 10 个节点）。
**本文件不替代它**——那 10 个节点是本路线图的 G0，未过 G0 谈 9.0 无意义。

## 0. 先把「9 分」定义成能跑的门

9.0 = 参考级开源库（framer-motion / TanStack 那一档）。不可验收的形容词一律换成命令。

| 维度       | 当前 | 9.0 的判定门（可执行）                              |
| ---------- | ---- | --------------------------------------------------- |
| 运行时性能 | 9.0  | **已达标**，需防退化：当前构建的真机 p95 数据       |
| 代码维护性 | 7.0  | 无文件 > 600 行；无函数 > 150 行；无依赖数组 > 12   |
| 工程流程   | 6.5  | tag 触发发布 + 依赖零落后大版本 + pre-push ≡ CI     |
| 测试可信度 | 6.5  | 变异测试存活率 < 10%（当前未测量）                  |
| 文档       | 6.0  | 单一读者语言 + 文风探针进 CI + 零 API 事实错误      |
| 开箱即用   | 5.0  | `npm i` 后 12 行渲染 + 文档站可访问 + 诊断可见      |
| 无障碍     | 4.5  | jest-axe 零 violation + 键盘全可达 + reduced-motion |

**关键约束（决定方案形状）**：全量 UMD 余量仅 **253 字节**（54.75/55KB）。
无障碍、诊断、reduced-motion 全部是**增量代码**，都要挤进这里。
所以 G1 必须是「腾预算」，否则后面每个节点都会撞第 12 关。

## 1. 门禁顺序（不是工作量顺序）

```
G0  发布就绪 10 节点（另一份文件）        → B+
G1  腾字节预算 + 建变异测试基线            ← 无此则 G2/G4 无处落地
G2  无障碍 4.5 → 9.0                     ← 提分最多，也最耗字节
G3  测试可信度 6.5 → 9.0                  ← 决定其余绿灯值多少钱
G4  代码维护性 7.0 → 9.0
G5  工程流程 6.5 → 9.0
G6  文档 6.0 → 9.0
G7  性能 9.0 保持（防退化）
```

G2 在 G3 之前是刻意的：无障碍是**新增行为**，需要测试网兜住；但 G3 的变异测试基线
在 G1 就要建好，否则 G2 加的代码没有质量门。

## 2. G1 · 腾预算 + 建变异基线

### 2.1 字节从哪来（实测口径，非估算）

A14 已证明「删死码腾 3KB」达不到（实测上限 358 字节）。真正的空间在别处：

- **诊断字符串**：`useSceneAnimationRegistry` 的 Problem/Fallback/Fix 模板串在三个 UMD
  里都存在（`Fix:` 各 4 处），但 `devWarn` 体被 drop ⇒ **付了字节却永远打印不出来**。
  移到 dev 产物，是三个 UMD 同时受益的唯一一项。
- **`INTERNAL_SCENE_PROPS` 57 项字符串**（977 字节 raw）：改成前缀判定
  （`key.startsWith('__cv')`）可消掉大部分字面量，但需先给内部 prop 统一改名。
- **prop 形态死码**（A14 实测 179–358 字节）：仍要删，但记账为卫生而非预算来源。

门：`cineview.umd.js` 余量 ≥ 2KB（当前 253 字节）。

### 2.2 变异测试基线（G3 的度量工具，必须先有）

当前**没有任何变异测试**，所以「测试可信度」无法量化。A16 已证明手工注入一个变异
就能让 110/110 全绿存活——需要把这件事自动化。

装 StrykerJS（`@stryker-mutator/core` + jest runner），先只跑三个高价值目录建基线：
`src/components/Animate/`、`src/components/Scene/`、`src/hooks/`。

门：变异存活率有数字（不论多高）。这是基线，不是达标。

## 3. G2 · 无障碍 4.5 → 9.0（提分最多）

现状实测：aria-\* 共 25 处，集中在 6 个文件；`ScrollbarOverlay.tsx` 8 处做得完全标准
（`role="scrollbar"` + `aria-valuemin/max/now` + `tabIndex` + `onKeyDown` 走共享
`normalizeKeyboardDeltaPx`）。**能力在，覆盖面不在。**

### 3.1 四条必修

1. **`prefers-reduced-motion` 框架级支持**（非测试源码 0 处）。
   `site/src/hooks/usePrefersReducedMotion.ts` 已有实现但不随包发布——移进框架，
   在 `resolveVisualState` 与变体解析处接一个开关：reduced 时入场/退场跳到终态、
   `loopAnimation` 不启动、scrub 仍跟随（scrub 是用户主动输入，不是自动动画）。
   **这条是动画框架的一票否决项**——没有它，WCAG 2.3.3 直接失败。
2. **非活动场景 `inert`**（现仅 `pointerEvents:'none'`，`Scene.tsx:876-880`）。
   屏幕阅读器连读全部场景、Tab 可聚焦不可见元素。加 `inert` + `aria-hidden`，
   注意 `inert` 需 polyfill 判定或降级到 `aria-hidden` + `tabindex="-1"` 遍历。
3. **drag 模式键盘可达**（`CineView/`、`Scene/`、`Animate/` 内 keydown 共 0 处）。
   接已有的 `goToScene()`（`useCineViewImperativeApi.ts:43-60` 已实现并导出）：
   PageUp/Down + Home/End 换页，容器 `tabIndex={0}` + `role="region"` + `aria-label`。
   步长表复用 scroll 侧的 `directScrollHelpers.ts:126`，不要写第二套。
4. **场景切换播报**：`aria-live="polite"` 区域，播报「第 N 幕 / 共 M 幕」。
   框架 src 与 dist 内 `aria-live` 均为 0（site 那 2 处值是 `"off"`，等于不播报）。

### 3.2 验收（必须是工具，不是走查）

```
pnpm add -D jest-axe @types/jest-axe
# 每个公共组件一条 axe 断言，drag/scroll 双模式各一遍
pnpm test -- --testPathPattern=a11y     # 0 violations
```

门：jest-axe 零 violation + 键盘可达全部场景 + reduced-motion 下零自动动画。
**注意**：全自动工具只能覆盖约一半 WCAG 条目，完整合规仍需真实辅助技术手测与专家复审——
这一点必须写进 README 而不是声称「WCAG 合规」。

## 4. G3 · 测试可信度 6.5 → 9.0

### 4.1 A16 的教训要贯彻到全套，不只 Animate.test.tsx

A16 证明：忠实打桩下变异仍存活，因为断言不读派生值。`Animate.test.tsx` 实测
118 个 `expect` 中读 style/opacity/transform 的是 **0** 个，63 个是 `toBeInTheDocument`。
**这个形态极可能不止一个文件**——123 个测试文件里 34 个 mock 掉 framer-motion。

所以 G3 的第一步不是改测试，是**测量**：用 G1 建好的 Stryker 跑一遍，按存活率排序，
存活率最高的文件就是断言最空的文件。让数据决定改哪个，而不是凭 A16 的单点结论推广。

### 4.2 三类必修（按 A3 修正的删法）

- **补断言**：让测试读派生数值。前置是打桩忠实消费 `(source, fn)`，但**该步本身不产生红灯**。
- **恒真断言**：6 处 `expect(true).toBe(true)` 只删断言体、保留 `it` 并补真实断言
  （删块会改覆盖率分母，四项门全是 90）。`drag-progress-control.test.tsx:44,184` 是
  回归文件，必须补而非删。
- **空集恒真**：`registry.branches.test.ts:139,210` 对可能为空的 map 调 `.every()`；
  `relativePositionAccumulation.property.test.tsx` 把 `if (element)` 放进 fast-check 主体
  ⇒ 包装层不渲染时 100 次运行全部空过。property test 必须先断言非空。
- **补 SSR 冒烟**：实测 `renderToString` 输出 1301 字节、`sideEffects:false` 已设，但零覆盖。

门：三个目标目录变异存活率 < 10%；四项覆盖率仍 ≥ 90。

## 5. G4 · 代码维护性 7.0 → 9.0

实测巨石（超 600 行门的全部）：

```
CineView.tsx          1175    useAnimateScroll.ts   1147
Scene.tsx              972    Animate.tsx            970
useDragSceneEngine.ts  843
```

### 5.1 三批，风险递增，不可混做（A12 的分类）

- **批 A · 纯函数抽离，零风险**（实测 222 行，非原方案宣称的 470）：
  `dragVisualState.ts`（`useAnimateDrag.ts:174-395`，`SceneContextType` 是**参数**非闭包捕获）。
- **批 B · hook 抽离，低风险**：`useSceneStyles`（`Scene.tsx:823-899`）、
  `useAnimatePublicTimeline`（`Animate.tsx:690-779`）。
- **批 C · 需重构签名，高风险**：`resolveVisibilityGates`（`useAnimateScroll.ts:566-617`）
  含 4 处环境读（`getBoundingClientRect`/`closest`/`clientHeight`/`window.innerHeight`）
  且 `:573` 的裸 `return` 退出的是外层 `runVisibilityUpdate`——抽离必须改控制流。

### 5.2 `createRenderLane` 单独成节点（复审代理降级建议）

bounce 与 settle 看似同一状态机写两遍，实则三处行为分叉：tween 主体不同
（MotionValue vs 纯数字）、settle 有 `releaseTokenRef` 守卫且**故意不写终值**、
suspend/resume 重取快照不对称。而 `getCurrent()` 喂 `handleDragStart:295` 的再抓取种子——
拍平会踩到 mid-settle 再抓取的单帧传送。**不与 `handlePanEnd` 的行数收益捆绑。**

门：无文件 > 600 行；`handlePanEnd` < 150 行且依赖 ≤ 12；变异存活率不上升。

## 6. G5 · 工程流程 6.5 → 9.0

依赖落后实测：`vite ^5`（最新 8）、`eslint ^8`（最新 10）、`typescript ^5`（最新 7）、
`@typescript-eslint ^6`（最新 8）、`@testing-library/react ^14`（最新 16）、
`jest ^29`（最新 30）、`husky ^8`（最新 9）。

- 逐个升，**每个大版本一个提交**，不批量。husky 9 要改 hook shim
  （`.husky/*` 仍用 husky-8 的 `. "$(dirname "$0")/_/husky.sh"`），与改 pre-push 内容
  是两件事，不绑一个提交（A7）。
- **pre-push ≡ CI**：现在 pre-push 只跑 `type-check` + `test:coverage`，缺 lint、
  format:check、build:verify、失败注入两关。让它调 `verify:framework:static`。
- 补 dependabot.yml（缺它就是上面 7 个落后的原因）+ `.github/` 三件套。
- 建 `release.yml`（tag 触发，A5 已确认它不存在）。

门：`npx npm-check-updates` 零大版本落后；pre-push 与 CI 跑同一条命令；tag 能出包。

## 7. G6 · 文档 6.0 → 9.0

实测：DESIGN.md 2640 行、散文 1007 行**95% 是中文**；源码注释 1762 条**21% 含中文**，
14 个重注释文件里以中文为主的是 **2 个**（`types/index.ts` 64/121、
`useImagePreloader.ts` 21/34）。README/CONTRIBUTING 是纯英文。

**这是需要你裁决的策略问题，不是执行项**：门面英文、内核中文是最糟的组合——
`CONTRIBUTING.md:5` 让英文贡献者「先读 DESIGN.md」，而那是 113KB 中文。三条路：

1. 全中文（明确国内受众，README 也改中文，放弃海外贡献者）
2. 全英文（DESIGN.md 与 2 个重注释文件翻译，成本最高，但 9 分通常意味着这条）
3. 双语分工（DESIGN.md 保持中文作为内部设计档，另写英文 ARCHITECTURE.md 面向贡献者）

其余可直接执行：文风探针移出 `site/.gitignore:24` 覆盖的 `scripts` 目录（**否定式不生效**，
git 对被忽略目录不下降，必须移到 `site/tools/` 或改两行规则）并接进 `verify:all`；
`advanced/10-types.md` 补 `AnimateVideoProps`/`ImageProps`/`ContainerProps`；
DESIGN.md 加 TOC（123 个标题、零目录）。

门：单一读者语言策略落地；文风探针在 CI 内；docs 站 API 事实错误为 0。

## 8. G7 · 性能 9.0 保持

已达标，风险是**没有当前构建的数据**——`dist` 是 8/31，`stress-fps.json` 是 8/15。

- 用 `stress-fps.mjs` 的**单条自续 rAF**方法论重跑（不要用 N6 那个包 rAF 的探针：
  它按注册计数，同帧重复注册全记 0ms，p50=0.0 是指纹，P95 被系统性低估）。
- 追那个 **133ms 停顿**（scroll 路径 1/652，`longtasks:[]` ⇒ 不是主线程 JS，
  按 memory 的 CSS-var 全屏重绘教训，大概率是合成/光栅）。需要 compositing-aware trace。
- 把 rAF p95 + long task 计数做成 CI 门（真 Chrome 专线已存在，加断言即可）。

门：当前构建有 p95 数据；133ms 有定论（修掉或书面归因）。

## 9. 一句话优先级

**G1 → G2 → G3** 拿掉最大的两个短板（无障碍 4.5、开箱即用 5.0 在 G0 已解），
之后 G4/G5/G6 是可并行的长尾。若只能做三件：G1（预算，否则后面无处落地）、
G2（提分最多且是动画框架的一票否决项）、G3（决定其余所有绿灯值多少钱）。
