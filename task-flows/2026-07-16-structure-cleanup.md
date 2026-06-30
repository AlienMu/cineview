# Task Flow — 结构清理（死字段 + 类型漂移 + 巨石拆分 + 一致性）

日期: 2026-07-16
分支: codex/drag-release-dual-gate
关联: 承接 px2vw 单轴化任务后的深度审查（3 个并行 agent + 主 agent 逐条核验）

## 背景

三个审查 agent 的原始报告含大量幻觉/误判，已逐条独立核验剔除。本 flow 只收录**经 file:line 坐实的真实问题**。剔除清单（非问题，不动）：
- `version` 字段（zoneStates 引用不变时强制 effect 重跑的真实信号）
- `createScrollbarCss` 两份（body 不同：隐藏原生条 vs 自绘样式）
- `firstSceneTimeout`/`sceneSizing`（均已完整接线）
- 5 个"孤儿接口" SlideConfig/AnimationConfig/SceneConfig/ResponsiveConfig/PreloadConfig + `renderTime`（全 src 零命中，幻觉，根本不存在）
- SceneScrollTimelineContext/RuntimeContext 分离（有意为之）

## 节点

### P1 — 低风险纯减负（优先）

#### A. CineViewContextValue 死字段收敛 ✅
- [x] A1 删 `designWidth`/`designHeight`/`viewportWidth`/`viewportHeight`（context 上零消费；真实读点只有 convert + scale）
- [x] A2 context value 收敛到 `{ scale, convert }`；scale 计算用局部变量
- [x] A3 更新 CineViewContext.test.tsx（有读 designWidth/viewportWidth 的断言）
- [x] A4 type-check 确认无隐藏引用

#### B. PerformanceMetrics 双定义合并 ✅
- [x] B1 核实两份差异：types/index.ts:343（4 字段，barrel 导出/公共）vs performanceMonitor.ts:6（5 字段，多 timestamp，运行时真实返回）
- [x] B2 单一来源：让 performanceMonitor 复用 types 的定义，或把 timestamp 补进公共类型（取决于 timestamp 是否该对消费者可见）
- [x] B3 type-check + 消费点（CineView/DirectScroll getPerformanceMetrics）确认

#### C. 文档核心不变量校正 ✅
- [x] C1 CLAUDE.md：`sharedElapsedMs`/`dragTransitionSnapshot` 不再是独立时间轴状态。dragTransitionSnapshot 已删；sharedElapsedMs 仅为 useAnimateDrag 映射 per-scene elementElapsedMs 时沿用的字段名。改为 elementElapsedMotion（scene-owned）+ dragTimelineProgress 表述
- [x] C2 DESIGN.md 同类表述核查同步

### P2 — 埋雷型 / 结构

#### D. DirectScrollCineView 巨石拆分（1587 行）
- [x] D1 抽 `<ScrollbarOverlay>`（几何计算 + 拖拽 mousedown + 内联 JSX）→ 244 行独立组件；DirectScroll 1587→1390 行（-197）；type-check/lint/1165 测试全绿
- [~] D2/D3/D4 **收口不做**（决策）：zone-registry 集群闭包 ~6 个 ref（zoneStatesRef/zoneRegistryRef/zoneAnimationsRef/previousZoneStatesRef/sceneLayoutsRef/lastReportedSceneRef）+ 多 setter + resolvedCallbacks + measureSceneLayouts，抽 hook 要穿透 ~10 个引用过边界，对 scroll 运行时是高回归风险，ROI 明显低于已落袋的 scrollbar。scrollbar 是 well-isolated 的纯展示+回调，是本文件唯一低风险抽取点。硬拆 tangle 违反"风险高就停下"原则。
- 备注：撞见 `src/utils/sizeConverter.ts.bak`（untracked，Nov 日期，非本人创建，零引用）——遗留备份，未动（不删非自己创建的文件）

#### E. render 期 ref-mutate 修正
- [~] **收口不做（决策）**：这 6 处 render 期 ref 写是 two-track drag 模型核心的 latest-ref 模式——三个 token-keyed effect（166/202/333）同步读这些 ref 且**故意把它们排除在依赖数组外**，用意正是「不因 config/回调身份 churn 而 spawn 第二个 spurious animate」。评估迁移到 useEffect 的实害：effect 按声明序执行，ref 更新 effect 若不严格早于消费 effect，同一 commit 会读到旧值；即便置前，「token 不变但 getTimelineDuration 变」的 commit 下语义也会与现状（render 期写 + 下次 effect 读最新值）漂移，可能破坏 latest-ref 守护的不变式。agent 指出的风险仅在 concurrent/StrictMode double-invoke，而本 codebase 未开 concurrent features，且 ref 写幂等（同值重写）。按 CLAUDE.md「按可逆性/风险调整谨慎度 + 行为基线优先」原则：触及 drag 运行时的高回归风险 > 消除一个当前不触发的理论隐患的收益 → **不改**。Scene.tsx:173 同模式、读者仅 onError 路由，单点改一致性收益薄，一并不做。
- 若日后启用 concurrent features，再单列 flow 封 `useLatestRef` 统一迁移 + 真机验收。

#### F. 判别联合类型安全边界（升级为真修复）✅
- [x] F0 先亲自证伪 agent 声明：探针证实"抽变量+混合合法/错误回调"确能绕过 excess-property check（weak-type check 因共同属性放行）——漏洞为真
- [x] F1 给 DragModeCallbacks/ScrollModeCallbacks 加对方独有键的 `?: never` 交叉排除，**真闭合漏洞**（非仅注释）；抽变量的混合回调现被拒
- [x] F2 守卫文件补永久负例（EXTRACTED VARIABLE case）+ 重定位错位的 @ts-expect-error（?: never 把错误从 callbacks: 行移到对象赋值行）；1165 测试验证合法用法零破坏

### P3 — 一致性 / 去重

#### G. animations 层裸 console 收敛 ✅
- [x] G1 抽 devWarn/devError 集中工具（内部 NODE_ENV 门控）
- [x] G2 替换 composer.ts:159,174 / animationParser.ts:167,177,184,205 / presets/index.ts:175,183,195（8 处）
- [ ] 注：build 已 esbuild.drop console，非高危，属一致性

#### H. resolveDesignDimensions 去重 ✅
- [x] H1 CineView.tsx:64 改为从 directScrollHelpers 导入，删本地副本

#### I. isSceneElement 类型守卫 ✅
- [x] I1 抽 `isSceneElement(node): node is ReactElement`，消除 CineView.tsx:191 + directScrollHelpers.ts:216 的 `(child.type as any).displayName === 'Scene'` 重复 + 收敛 any

#### J. 可选字段归一化（评估后：本轮不做，拆单独 flow）⏸️
- [~] J0 **决策：不在本轮做**。评估结论：
  - `normalizeSceneProps`（105 行）的三层兜底 `sceneRuntime?.x ?? props.flatX ?? default` 是 **grouped API + legacy flat API 双轨**的意图性 adapter；`compatFields`（30 项）为 `void` 保活 legacy 面。
  - 真改动面：删 `SceneInternalProps` ~30 legacy flat 字段 + compatFields + 缩三层兜底 + 改写所有传 legacy prop 的测试（~数十文件），并需追证两入口确无 legacy path 依赖。
  - CLAUDE.md P2 已记录「on*Change 回调层仍扁平（待后续）」——这是**已知计划性技术债**，非新发现。
  - 结论：最大改动面 + 触及 drag/scroll 运行时 props 供给（需真机验收），不应混入本轮已全绿的低风险清理。**拆单独 flow 专项处理**（与 D2/D3 的 zone-registry/gestures 抽取一起，作为"Scene/DirectScroll 深度重构"的下一 flow）。

### 验证
- [x] type-check 0 错 / lint 0 错 0 警 / 1165 测试全绿 / 覆盖率四项 ≥ 90%（branch 90.2%）/ build 通过（ES gzip 49.24 KB）
- [!] **D1（ScrollbarOverlay 抽取）触及 scroll 渲染路径 → 待独立 agent 真机验收**（CLAUDE.md 规则 4）。抽取是纯展示+回调、逐字搬运、单测全绿，但滚动条拖拽/自动隐藏是视觉交互，单测 ≠ 视觉正确。E 未改（见上）、J 未做，故本轮仅 D1 需真机复验。

## 执行原则
- 每节点后立即 type-check，逐个确认无隐藏引用（审查是静态 grep，未跑 tsc）
- P1 先行、独立可交付；P2 巨石拆分风险最高，行为基线优先
- 触及运行时的改动（D/E）必须真机验收，单测全绿 ≠ 视觉正确
