# 2026-07-31 Framework Adversarial Questions

以下事项原本不能由实现 lane 自行裁决。用户已确认 Q1/Q3/Q5/Q6；Q2/Q4 已补足语义和风险，继续等待用户选择。

## Q1 — 可复现提交授权

**状态：已确认。** 完整复验通过后，允许只对 framework boundary 创建可复现提交；不包含 `site/`、临时 probe 或验收输出。

- 当前验证对象是 branch `codex/drag-release-dual-gate`、HEAD `f164470d2ca4595ba7e6f0cbad455a11da763d82` 之上的大型未提交工作树快照。
- `pnpm verify:framework` 可以证明该工作树当时通过门禁，但 HEAD 本身不能复现这些源码、fixture、配置和验证脚本。
- 用户已授权：完整复验通过后，整理并创建一个只包含本轮框架收口改动的提交，作为最终审核基线；不包含 `site/` 或临时 probe/验收输出。

## Q2 — Rush Re-grab 获权后零增量语义

**状态：待确认。当前实现为 A，推荐保持 A。**

- 已明确且已验证：在飞 continuation 上仅 pointer-down/tap、不取得 ownership 时，应暂停后恢复原 continuation；不能 commit、跳帧或永久冻结。
- 已明确且已验证：首个有效移动取得 ownership 时，页面与媒体以 takeover baseline 连续接管，首个 owned frame 不跳变。
- 分界点不是 pointer-down，而是首个有效轴向移动成功取得 ownership。pointer-down 只可逆暂停；ownership 一旦成立，render continuation 与 element continuation 都被永久 preempt，当前视觉进度被冻结为新 drag session 的 baseline，候选阶段位移不会被追认。
- **A：按 frozen progress 正常结算（当前实现）**。即使获权后没有第二个 pan sample，release 仍按标准 velocity/progress threshold 决定 commit 或 bounce。零速度通常使用 `maxRatio=0.3`：例如 frozen progress `0.8` 继续完成，`0.2` 回弹。旧 continuation 不恢复，整个 session 仍保持一个 terminal result。
- A 的用户心智是“移动到足以抓住后，控制权已经交给手；松手按抓住的位置决定”。其风险是 ownership slop 目前很小，轻微误移动也可能取得 ownership；若需降低误触，应调整获权 slop/迟滞，而不是在获权后回滚 owner。
- **B：零新增位移时恢复旧 continuation**。这不是一个 release 特判：实现必须保留已被停止的 render/element lane、剩余时长、原目标、release token 和 transaction view，并在 release 时回滚 `driving` phase 与已发布的 frozen progress。
- B 会造成契约分叉：框架已发出“用户取得 ownership”的 progress/callback，最终却忽略该 ownership；零增量又受事件合并、坐标取整和设备采样影响，多一个极小 move 就会突然切换回 threshold 语义。还必须重新定义 held 期间原 commit 到期、retarget、Scene 失效和 stale token。
- B 因而是 drag 所有权架构迁移，并可能破坏 `onDragStart -> progress* -> exactly one terminal callback`，不能按局部 bugfix 实现。
- **建议裁决文本（A）**：`re-grab 一旦取得 ownership，旧 continuation 永久失效；release 始终从 frozen current progress 按正常 threshold 结算，即使 ownership 后没有新的 pan sample。`

## Q3 — 历史 Task-flow 的归档边界

**状态：已确认。** 以最新证据链为基准，删除被完整取代且没有独有证据的历史文件；不批量改写仍保存独有红证、设计裁决或浏览器数据的旧文件。

- 多个历史 task-flow 同时包含已过期架构描述、已被后续证据关闭的 unchecked 项，以及仍需产品/人工体验裁决的节点；直接批量勾选会抹掉历史语境。
- 本轮删除：`2026-07-21-drag-time-redesign-plan.md`、`2026-07-21-drag-temporal-redesign.md`、`2026-07-29-drag-redesign-agent-dispatch.md`。
- 7 月 31 日 closure / hardening / P2 evidence 是递进证据链：分别保存总账、第一轮 P2 红证与资源清理矩阵、1000-scene P1 及修复数据，当前不能互删。

## Q4 — `AnimatePhase.waiting` 的版本与兼容声明

**状态：待确认。严格 SemVer 推荐 `2.0.0`；只有项目明确采用“输出联合开放扩展”政策时才选 `1.1.0`。**

- visibility `waitFor` 现在公开明确的 `waiting` phase，用于区分“依赖/自身 delay 尚未放行”和真正开始 tween 后的 `entering`。
- 这是公共 `AnimatePhase` 联合类型的新增成员；运行时语义更精确，但使用穷尽 `switch` 的消费者可能需要补分支。
- `waiting` 不只是框架接受了一个新输入，而是框架可能向消费者输出的新判别值：它出现在 render-prop 的 `AnimateRenderState.phase`、`AnimateTimeline.phase` MotionValue 和公开 timeline frame。
- 普通不穷尽读取 phase 的消费者通常不受影响；但 `switch + assertNever` 会停止编译，`Record<AnimatePhase, Value>` 会缺 key，显式只接受旧 phase 联合的 callback 在严格函数类型下也可能不可赋值。
- JavaScript 消费者不会加载失败，但旧 switch 可能进入错误 fallback 或返回 `undefined`。因此这同时是 TypeScript source compatibility 和运行时控制流风险。
- **`1.1.0` 方案**：项目明确声明公共“输出联合”是开放集合，minor 可增加成员；release notes 和迁移指南必须要求穷尽 switch/map 补 `waiting`。这不满足严格的 TypeScript source-compatible SemVer，只是项目政策下的兼容取舍。
- **`2.0.0` 方案（推荐）**：把公开 discriminant 新增成员视为 breaking change，让现有外部消费者显式迁移。若已发布的 `1.0.0` 有外部使用者，这是最准确的版本表达。
- 在用户裁决前不修改 `package.json` 版本；当前仍为 `1.0.0`。

## Q5 — P2 加固是否进入下一发布阻断范围

**状态：已确认并完成实现。**

- 前一版列出的 keyed-store 全量枚举、精确 `segmentStart` 正向首帧、owner completion → visibility follower、三节点/混合 driver cycle、StrictMode/waiting-unmount 资源计数、首 owned 视频时间断言均已在 `2026-07-31-framework-adversarial-hardening.md` 完成并由独立 agent 复验。
- 本轮规模测量已把 scroll 全量 scene snapshot 确认为 P1 并修复：1000 scenes 最新独立复验 handler p95 `2.2ms`、frame p95 `17.6ms`、Long Task `0`。cycle 的 24 种注册排列也已规范为同一公开诊断文本。
- drag pointer sample 约 7 个短命对象，但 60/120Hz 测量没有丢样、Long Task、`>20ms` 帧或 retained heap 增长；保持无红证状态。
- 新增静态测试缺口：scroll force-full tuple 的 scenes 缩短/重排、direction/viewport/debug 变化及 dense array 尾部清除没有直接测试；独立静态复核未发现 stale runtime。
- drag owned pointer session 现在复用一个 `PanInfo` 及其四个 nested vector；candidate 阶段不分配。定向测试验证引用稳定与每次 callback 数值同步。
- scroll force-full 直接测试已覆盖 scenes 远端重排、缩短及 dense tail 清除，以及 direction/viewport/debug/sceneSizing tuple 全量刷新。

## Q6 — Duplicate `zoneId` 的所有权语义

**状态：已确认 A，并完成实现。**

- 当前 scroll registry 对重复 `zoneId` 发开发期 warning，并采用 last-wins；但 cleanup 只携带 `zoneId`，旧 Scene 卸载时会无条件删除较新的 winner，使该 takeover 在生产环境失效。
- scroll root 预判 authored identity（`scroll.zoneId ?? sceneId`）：第一项保留 takeover，后续冲突项通过既有 `INVALID_COMPONENT_HIERARCHY` + `context.reason='duplicate-scroll-zone'` 上报，避免扩大公共错误码联合；它们作为普通文档流 Scene 渲染，不再向其 Animate 子树提供 zone takeover。
- render、layout、snapshot、preload 和 imperative navigation 共同消费一份 sanitized Scene 模型，不能只在 `ScrollSceneSlot` 渲染时剥离 `scroll`。
- registry 同时使用 `sceneIndex` 做防御性 owner 校验；拒绝注册返回 `false`，被拒绝方的 element write 或 stale cleanup 都不能修改/删除 winner。
- 自动生成的实例 id 不会冲突，不纳入 authored-id 预判。

## Reproducibility Note

- 任何最终 `PASS` 都必须标注证据基线：工作树快照或用户授权后的提交 SHA。
- 提交前可得出的最强结论是“当前工作树快照门禁与独立验收通过”；完整门通过并创建 framework-only commit 后，再以该 SHA 作为可复现结论基线。
