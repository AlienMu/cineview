# DESIGN.md ↔ 文档 ↔ 代码 三方对照（2026-08-27，我本人通读 DESIGN.md 2639 行的产物）

前次失误：我按关键词 grep 拼事实、改方案，没读 DESIGN.md（CLAUDE.md 明确要求「启动前必读」且是唯一有效规格）。本文件是补课结果。**结论：文档的问题不是「细节不够」，而是整个规格层没有被文档覆盖。**

## 一、DESIGN.md 里有正式规格、而文档零覆盖的系统

grep 全部 28 页 zh 文档确认命中为空：

| 规格系统 | DESIGN.md 位置 | 文档状态 |
|---|---|---|
| `--cineview-unit` CSS 变量（公共消费接口，`calc(设计值 * var(--cineview-unit))`） | §数据模型 L1319 | **零命中**，代码在 `CineViewContext.tsx:103` 真实输出 |
| prepared snapshot / transaction 所有权模型 | §Drag Mode L95-114 | 零命中 |
| candidate / ownership / re-grab 可逆暂停 | §Drag Mode L116-126 | 零命中 |
| 运行态六值 `inactive/entering/active/exiting/covered/parked` 及「covered/inactive/parked/exiting 时停止持续动画」 | §新模式参数原则 L453-461 | 零命中（代码 `useSceneRuntimeState.ts:36-65` 实现） |
| visibility 闸门迟滞死区（重叠带保持相位） | §Scroll Mode L297 | 零命中 |
| 超高元素预备规则（>容器高−enterMargin → 中线/70% 判据，退场优先） | §Scroll Mode L298 | 零命中 |
| **无 `exitAnimation` ⇒ 永不退场**（`replayOnReenter` 对其失效） | §Scroll Mode L300 | 零命中（代码 22 处 `hasExplicitExit`） |
| visibility 的 `waitFor` 走 ever-entered completion 订阅，**不复用 `calculatedDelay`** | §Scroll Mode L301 | 零命中——现有文档统一讲 calculatedDelay 累加，对 visibility 轨是错的 |
| `waiting` phase 的放行四条件与取消时机 | §Scroll Mode L302 | 零命中 |
| scroll-zone follower 不得等 visibility leader（ms/px 双时钟不可通约） | §Scroll Mode L303 | 零命中 |
| 首帧已滚过视窗顶（`bottom<=0`）直接揭示终态 | §Scroll Mode L304 | 零命中 |
| `infiniteAnimation` 活跃条件 = `entered && onScreen`（纯函数 `resolveInfiniteActive`） | §Scroll Mode L306 | 部分（只说了「phase + 视口」，没给准确判据） |
| authored-but-unparsed 必须停在 initial 帧（刷新闪现的成因与三轨各自处理） | §Drag Mode L145-155 | 零命中 |
| 媒体单写者协议 / `scrubRange` 到端交还原生播放 / hysteresis | §组件 3.5 L1244-1255 | 仅 `scrubRange` 一处提及，协议零覆盖 |
| stagger 有效组时长 `max(duration.enter, staggerTail + itemDuration)` 及下游 waitFor 不得早启 | §组件 3 L1200-1212 | 零命中 |
| 预设中控：同分类在途 Promise 合并 + 跨 CineView 缓存；未知预设永久失败 vs chunk 失败可重试 | §Drag Mode L141-143 | 零命中（错误码写了，机制没写） |
| 虚拟化裁决：**scroll 默认全部 scene 常挂载** | §性能 L1644-1646 | 零命中 |
| 预加载模式差异：drag 只预载当前+相邻，scroll 全局预载所有 scene | §性能 L1654-1655 | 零命中，且这是作者可感知的行为差异 |

## 二、DESIGN.md 内部自相矛盾（须以裁决节为准，且不能写进文档）

- **边界橡皮筋**：属性 18（L2594-2606）要求边界 progress 钳在 `[-0.2, 0.2]`；而 §Drag Mode L124 说「物理边界保留 render-only 橡皮筋。边界 progress 固定为 `0`」。代码按后者：`Scene.tsx:379-381` 直接 `return 0`。**属性 18 是过期表述**，文档写 ±0.2 会是错的。
- **`ComposedAnimation` 字段名**：DESIGN.md L922 写 `delay?: number[]`（单数），实际公共类型与实现都是 `delays`（`composer.ts:112,198`）。文档现在写的 `delays` 是对的，DESIGN.md 过期。
- **`ScrollbarConfig.enabled` 默认值**：DESIGN.md L723 注 `default: false`，L804 又说「默认关闭」；实际是「传了 `scrollbar` 对象即开启，只有显式 `enabled:false` 才关」（`CineView.tsx:796`）。三方口径不一，文档现写法接近代码但没说清「省略整个 prop = 什么都不注入」。
- **`Position` 接口**：DESIGN.md L1276-1288 的 `at` 无 `anchor` 字段，实际公共类型有 `anchor: 'center'|'center-x'|'center-y'`。DESIGN.md 过期，文档已写对。
- **性能配置**：DESIGN.md 通篇仍提 Lighthouse/terser/`preset` 等；实际 `CineViewPerformanceConfig` 只剩 `monitor`。

## 三、对方案的影响（必须改，不是补丁）

1. **文档缺的不是「drag 细节」，是「规格层」。** 原方案把 drag 补成 5 页仍然只覆盖表层 props；prepared snapshot/transaction、candidate/re-grab、运行态六值这些是 DESIGN.md 的正式裁决，作者能观测到（回调时序、动画为何不跑），必须成章。
2. **visibility 轨的 `waitFor` 语义现有文档是错的**（把 calculatedDelay 累加当通用规则）。这不是遗漏，是错误内容，优先级高于新增。
3. **`--cineview-unit` 是被规格承诺的公共接口**，文档零覆盖 = 作者不知道有这个逃生舱。
4. **DESIGN.md 自身有 5 处过期**，写文档时必须以「裁决节 + 代码」为准，不能照抄 DESIGN.md。这条要写进 N2 事实源核对单的方法论。
