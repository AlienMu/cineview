# 2026-08-16 ponytail 评审整改任务流（remediation）

来源：`task-flows/2026-08-16-ponytail-review.md`（评审报告，44 项断言 43 项经独立对抗校验属实）。
目标：把评审结论转成可逐节点执行、可验收的整改流。**只按本文件推进，禁止无 task-flow 跨文件重构**（CLAUDE.md 启动前必读）。

## 全局强制规则（每节点适用）

1. **节点门**：每节点收口必须由全新 sub-agent 做对抗/mutation 评审并返回显式 PASS（记忆：node-gate-adversarial-subagent）。
2. **浏览器 lane**：凡触及 scroll/drag 交互路径或视频行为的节点，单测全绿 ≠ 收口，须独立 agent 在 `localhost:4000`（端口以 `site/vite.config.ts` 实测为准）真机跑完整手势。
3. **净减负核算**：每任务流收口时统计行数变化，全仓 grep 确认删净（旧字段/旧命名/旧文件零残留引用）。
4. **自检四条**：整改真完成 / 无冗余引入 / 项目仍可控（单文件 ≤800 行，超限的登记专项） / 运行时每帧热路径不劣化。
5. **dist 同步**：涉及公共面改动后 `pnpm build:verify` 8/8；站点验证前必须 `pnpm build` + dev server 重启（记忆：site-consumes-dist-not-src）。

## 任务流总览

| 流 | 主题 | 依赖 | 预估行数 | 浏览器 lane |
|---|---|---|---|---|
| T1 | scroll 反向视频回收缺陷修复 | 无 | +~30（含测试） | **必须** |
| T2 | 死码/死面清理（零风险包 + 中风险收敛包） | 建议先于 T4/T5 | **-850 ~ -1500** | 抽查 2 节点 |
| T3 | DX 出口 + 文档 | 无（与 T2 并行可） | +~120 | 否 |
| T4 | 命名还债（含 2 个公共 API 决策点） | T2 之后 | ~0 | 抽查 |
| T5 | 热路径 5 项优化 | T2 之后（减冲突） | ~-40 | **必须**（stress-fps 复测） |
| T6 | 定向覆盖率补强 | 对应清理节点后 | +~400（测试） | 否 |
| T7 | 规格同步 design.md↔代码（2026-08-16 审计追加：5 CODE-DRIFT / 16 DESIGN-STALE / 6 MISSING） | 文档节点无依赖；7.1 随 T1 | 文档为主 | 7.13 抽查 |

推荐执行序：T1 → T2 →（T3 ∥ T6）→ T5 → T4（改名放最后，diff 最干净）。

---

## T1 行为缺陷：scroll 反向无法倒放已续播完的视频

**缺陷**：`src/media/videoPlaybackOwnership.ts:140-146` `canReclaimTerminalState` 仅允许 `source==='gesture'` 回收 `ended` 态。scroll 模式下 `shouldAutoPlay`（`:148-155`）使带 `scrubRange` 的视频在 progress=100% 自动续播到片尾进入 `ended`，之后反向滚回 zone，`reduceTimelineFrame` 在 `:180` 早退，视频钉死末帧（探针实证：currentTime 恒 10.041667s 贯穿 reverse 全程）。违反 design.md scroll 规则 8「以保留的 100% 为起点向 0% 回退」（规格审计确认 CLASS=CODE-DRIFT；**注意** `videoPlaybackOwnership.test.ts:319-344` 已把 gesture-only 回收固化为预期，须随修同改——见 T7.1；另 scroll 接管轨从不推进 phaseMotion，`entering`-activate 逃生口在该轨结构上不可达，修复注释须记此事实）。drag 模式（gesture）无此问题。

**附带不一致（同文件，一并查）**：drag 冷启动完成后 rest 停在片尾 10.04s，回弹归位后 rest seek 到 scrubRange 终点 8s——同一 rest 态两个帧位。

- [ ] 1.1 红证先行：`videoPlaybackOwnership` 单测——构造 `ended` + `timeline-frame{source:'scroll', progress:0.6}`，断言当前**无** seek 命令（固化缺陷）；再写目标断言（应产生 seek 回收）。
- [ ] 1.2 修复：`canReclaimTerminalState` 增加 scroll 分支——`ended`/`play-rejected` 允许 `source==='scroll' && progress < 1 - TAKEOVER_HYSTERESIS` 回收；保持 drag gesture 分支语义不变。同步检查 `shouldTakeOverNativeOwner`/`endpointLatched` 与新路径的交互（回收后 endpointLatched 复位、无重复 autoplay 抖动）。
- [ ] 1.3 rest 帧位一致性：统一「enter 完成的 rest 帧 = scrubRange 终点」，冷启动 autoplay 尾播结束后如再次进入 rest 应 seek 回 range 终点，或以设计文档裁决两者取一（**先问用户/读 design.md，不要擅自定**；design.md 无此细节则在本 task-flow 记录裁决再动码）。
- [ ] 1.4 浏览器验收：扩展 `examples/performance-test/stress/stress-fps.mjs` marks 断言——scroll-rev 阶段 zone-a 视频 currentTime 必须从 10.04 回落到 <2s；drag 页回归（gesture 回收不回归）。验收 agent 出 PASS。

## T2 清理（先零风险，后中风险）

### T2a 零风险包：死文件 + 死导出（全部经 grep 验真：src/site/examples 无非测试消费者）

- [ ] 2.1 删 `src/utils/gestureDetector.ts` + `gestureDetector.test.ts` + `types/index.ts:705` `GestureType`（-526）。
- [ ] 2.2 删 `src/utils/throttle.ts` + `throttle.test.ts`（-186）。
- [ ] 2.3 删死导出：`debounce.ts:8` 平文 debounce；`performanceMonitor.ts:210-270` 四工厂；`dragTimelineMapping.ts:91-105`；`CineViewContext.tsx:130-155` useConvertSize/identityConvert；`imagePreloadCache.ts:20` subscribeToPreloadedImages；`mediaPreloadCache.ts:199` setMediaByteBudget + `MediaKind` 单成员联合 + `VideoEntry.kind` 字段；`Scene.tsx:924` SceneInternal 别名（改两个测试文件的 import）；`Scene/types.ts:183,219` onSharedElapsedMsChange（含 helpers.ts 传递线）；`dragPreparedState.ts:180-202` getTransaction/getTransactionForTarget/clear；`animationParser.ts:154,204` 两个死导出。
- [ ] 2.4 删写而不读：`useElementTrack.ts` `inFlightKindRef`（125 起 20 处赋值，-22）；`sceneScrollRuntime.tsx:79,90` `version?`；`useScrollZoneRegistry.ts` port 三成员 `zoneAnimationsRef`/`syncZoneState`/`recomputeZoneSequence`（连带类型与唯一测试消费者改写）。
- [ ] 2.5 删不可达分支（drag-only 引擎内的 scroll 分支）：`CineView.tsx:441-457`（reset effect）、`:120-139`（preload scroll 分支）、`:161-166`（本地 resolveRootSceneStackMode + CineView.test.tsx 对应用例改引用 directScrollHelpers 版）；`DragSceneStack.tsx:199-226,308-319`（mode!=='drag' 分支 + mode prop）。
- [ ] 2.6 删 `Animate.tsx:80-81,134` `isVisible`/`visibilityProgress`/`scrollActiveSceneIndex`（同步删 3 个测试里的伪造写入）。
- [ ] 2.7 删 `Scene/helpers.ts:230-261` compatFields 死计算（`void compatFields` 链，-36）。
- [ ] 2.8 修 `CLAUDE.md` 文件布局：删 `dependencyChecker.ts`、`gestureHandlers.ts` 两行幽灵条目。
- [ ] 2.9 收口门：`pnpm test`（1474 基线只增不减）、`type-check`、`lint`、`pnpm build:verify`；全仓 grep 净尽清单（gestureDetector|throttle|SceneInternal|onSharedElapsedMsChange|inFlightKindRef|compatFields|version\? …）；CineView.tsx 分支覆盖率应显著上升（对照 78.97% 基线）。**注**：`SceneLegacyCompatProps` 本包不动（公共 .d.ts 面待 T4 决策）。

### T2b 中风险收敛包（行为等价重构，靠既有 property 测试护住）

- [ ] 2.10 三份 `useMixedValue`/`useNumericValue` 工厂（useAnimateDrag.ts:384 / useAnimateScroll.ts:184 / useAnimateArrival.ts:49）收敛为 animateInterpolation 单一工厂（-~100）。**注意**：useAnimateDrag 的链式 useTransform 方案曾失败（CLAUDE.md 记录），保持「MotionValue 直写」结构，只收敛属性工厂。
- [ ] 2.11 `useElementTrack.ts:403-657` 七个 token 守卫 animate 块 → `launchTrackTween(target,ms,ease,onDone)`（-110）。红证：现有 drag 两轨 bugfix 套件全绿即可信。
- [ ] 2.12 `useDragSceneEngine.ts:442-781` bounce/settle 双轨脚手架 → `createRenderLane(kind,opts)`（-60）。
- [ ] 2.13 `registry.ts:60-103` ImmutableMapView → `new Map(entries)` 标 `ReadonlyMap`（-43）；`composer.ts:36-44` mergeVariants → `Object.assign({}, ...)`；`animationParser.ts:10-92` transformOrigin 归一化整段删（CSS 原生解析；白名单本就不含该属性）。
- [ ] 2.14 `utils/animationHelpers.ts:92-239` `interpolateVariant` 148 行委托给 `lerpTransformValue`（-120）；`useStructurallyStableValue.ts` 环检测降级为普通递归比较（-20）。
- [ ] 2.15 `CineView.tsx`/`DirectScrollCineView.tsx` 六处成对重复收敛 `useCineViewPreloadGate` 共享 hook（emitRecoverableError、preloadCounts 镜像、首屏 Set-diff、onReady fire-once、imperative 半边、debug 旗标，-~60）；`CineView.tsx:77-89` 删本地 createScrollbarCss；`Image.tsx:27-70` 改用 `convertNumericStyleValue` + imagePreloadCache 预热原语。
- [ ] 2.16 收口门：同 2.9 + `pnpm quality:duplicates`（克隆数 ≤5）+ **浏览器 lane 抽查**：drag 双向 scrub/settle/bounce、scroll 正反锁定各一轮（独立 agent）。

## T3 DX 出口 + 文档（并行流）

- [ ] 3.1 公共导出预热 API：`public-api.ts` 增加 `preloadAllAnimations`（现成于 presets/index.ts:346）；`CineViewRef.preload` 文档补「仅图片/媒体，预设用 preloadAllAnimations」。
- [ ] 3.2 README「编排词汇」一节：`waitFor`/`delay`/`stagger`/`infiniteAnimation`/`enterRef`/`exitRef`/`sceneControlled` 语义表 + **毫秒/秒单位警告**（框架 duration=ms，CustomAnimation.animate.transition.duration=framer 秒）+ scrub 轨 10 属性白名单警示 + 1ms=1px。
- [ ] 3.3 诊断补齐（对齐 enterRef 的诚实上报风格）：stagger 静默 no-op（Animate.tsx:488，fragment/多子/文本 children）→ dev INVALID_ANIMATION 上报；仅-exit 拒绝信息（:571）文案补「merge 进 enter 或改用 visibility 场景」指引。
- [ ] 3.4 收口门：`test:site-contracts` + type-check；新导出走 dist 面检查（`pnpm build:verify` + .d.ts 含新符号）。

## T4 命名还债（T2 后执行；⚠ 含 2 个公共 API 决策点，动前问用户）

- [ ] 4.1 【决策点 A】`ScrollMode` → `CineViewMode`（types/index.ts:16，含 `AnimateTimeline.mode` 等 9 文件 + 测试 + design.md 词汇表）。是否保留 `ScrollMode` 老名 type alias 一个过渡期，由用户拍板（站点为唯一消费者，直接改名亦可）。
- [ ] 4.2 【决策点 B】`sharedElapsedMotion` → `elementElapsedMotion`、`sharedTimelineDurationMs` → 场景自持词汇（design.md:18 口径，Animate.tsx:107、useAnimateDrag 等 9 文件 + ScrollSceneSlot.tsx:195 的 `sharedElapsedMs: 0` 遗留写）。纯内部 rename，无公共面，可直接做。
- [ ] 4.3 【决策点 C】`firstSceneTimeout` 归属：scroll 引擎读 `modes?.drag?.firstSceneTimeout`（DirectScrollCineView.tsx:226）——迁到两模式共享位（`modes.common` 或根级），design.md 同步。公共类型变更，需用户确认形状。
- [ ] 4.4 内部二义名清理：presets/index.ts:13 内部 `PresetAnimation` 接口改名 `PresetAnimationRecord`；`PresetAnimationName` 联合改 `type PresetAnimationName = PresetAnimation`（-44）；`CineViewCallbacks` 加 deprecation JSDoc（指向新名）。
- [ ] 4.5 `SceneLegacyCompatProps` 处置：零外部消费者已验真——整删（-110，迁移 directScrollHelpers.ts:362-370 两处读取）或保留并在 CLAUDE.md 登记死期；**默认建议整删**，用户确认后执行。
- [ ] 4.6 收口门：全量测试 + type-check + build:verify + 全仓 grep 旧名零残留 + 浏览器 lane 抽查 drag/scroll 各一轮（rename 触点多，须防手滑）。

## T5 热路径优化（T2 后；每节点前后跑 stress-fps 对照）

基准：`examples/performance-test/stress/stress-fps.mjs`（当前 p50=17ms / 0 长帧，headless 上限场景），优化收益须以「同机同配置复测不掉帧不劣化」+ 代码审消账，不指望 headless 数字下降。

- [ ] 5.1 `useNativeScrollController.ts:113` — segments 随手势起点测量缓存（filter+map+sort 移出手势帧）；`getMaxNativeOffset` 的 scrollWidth/scrollHeight 读并入同一快照。
- [ ] 5.2 `useScrollSceneSnapshots.ts:84-267` — Set/闭包/13 槽 tuple/`slice()` 提升到 ref 复用，消除每滚动帧分配。
- [ ] 5.3 `directScrollHelpers.ts:197,208` — 反向 `[...].reverse()` 双拷贝改倒序 for。
- [ ] 5.4 `animateInterpolation.ts:65-99` — variantsRef 冻结时预解析端点 `{num,unit}`，帧内仅数值 lerp（字符串属性 regex 退出每帧路径）。红证：`animationHelpers.property.test` + 三驱动 scrub 快照测试。
- [ ] 5.5 `Scene.tsx:878` per-render `Object.entries` 过滤 → 挂载期一次性摊平内部 props；`DragSceneStack.tsx:230-294` 每渲染重建闭包/props → 按 scene memo。
- [ ] 5.6 收口门：1474+ 测试全绿；stress-fps 复测 ≥ 基线（0 长帧、p50 不升）；独立浏览器 lane 观测「并发滚动 + 多元素动画」掉帧/长任务（CLAUDE.md 自检第 4 条）。

## T6 定向覆盖率补强（对照基线薄弱点）

- [ ] 6.1 `AnimateVideo.useVideoResidencyControl`（101-135）band 门控单测：far→release（scrubbedOnce 门）/ near→warmUp / 未 scrub 不 release。
- [ ] 6.2 `StaggerContainer`（分支 42.85%）：`resolveStaggerTiming` 数学 + 三 Stagger 的 derive() 门控单测。
- [ ] 6.3 `useAnimateArrival.ts` 225-322 未覆盖段（80.24%→≥90%）。
- [ ] 6.4 `useNativeScrollController` 直测：center-lock intent 钳制、S-F2 programmatic 到达/取消（现仅间接覆盖）。
- [ ] 6.5 `styleConvert.ts` 直接单测（全库唯一长度标尺，零直接测试）。
- [ ] 6.6 收口门：`pnpm test:coverage:framework` 分支覆盖 ≥92%（现 90.05），上列文件各自达标；总量门 ≥90 不回退。

---

## T7 规格同步：design.md ↔ 代码双向对账（2026-08-16 追加）

来源：4 个并行审计 agent 对 design.md 2640 行 ↔ src 全量双向核对（drag 节 / scroll 节 / API 节 / 遗留章节+CLAUDE.md），主线程亲核 4 条高影响断言属实。分类口径：**CODE-DRIFT**（代码违规格，修码或改规格需裁决）/ **DESIGN-STALE**（文档过期，纯改文档）/ **MISSING**（代码行为无规格）。

### 全量漂移清单（存档用，节点引用）

CODE-DRIFT：
- C1 `types/index.ts:65`（注释 default:false）+ `design.md:724,804`（默认关闭）↔ `DirectScrollCineView.tsx:453` `enabled !== false`——传对象即开启滚动条。
- C2 `design.md:923` delays 仅 sequential ↔ `composer.ts:166` parallel 也消费 delays。
- C3 `design.md:93` `uncappedFullDragElapsedMs` 满程耗尽诊断 ↔ 全仓零实现。
- C4 `design.md:776` preload 字符串目标 ↔ `types:394-409` scroll 下还匹配 zoneId（语义加宽未记录）。
- C5 A43（已列 T1）：`design.md:262-266` 反向回退承诺 ↔ `videoPlaybackOwnership.ts:140` gesture-only 回收；且 `videoPlaybackOwnership.test.ts:319-344` 把错误行为固化成预期。

DESIGN-STALE（文档侧改写）：
- S1 `design.md:114` 事务状态机 `driving→settling|bouncing|retargeted|aborted→released` ↔ 实际 `dragPreparedState.ts:21` `'driving'|'settling'|'bouncing'|'programmatic'`；retarget/abort 是 symbol-ID 比较的**释放**而非相位；`programmatic` 相位规格无记载。
- S2 `design.md:72,482` `elementElapsedMotion` ↔ 代码发布名 `sharedElapsedMotion`/`sharedTimelineDurationMs`（=T4.2）。
- S3 `design.md:59` firstSceneTimeout 属 drag ↔ scroll 根消费（=T4.3）。
- S4 `design.md:97` `onStableSnapshot(snapshot, revision)` ↔ 实际第三参 `enterVariantsByAnimateId`。
- S5 `design.md:486` `resolveDragMapping().map()` ↔ 实际 `mapDragPercentToElapsed`（公式本身一致）。
- S6 `design.md:114` cleanup 传 instanceId+revision+transactionId ↔ 实际仅 transactionId（不变量靠 symbol 比较仍成立）。
- S7 `design.md:268` 规则10（剩余量同输入交还文档流）↔ 代码按规则13（钳段内帧、后续输入再走）——**规格自相矛盾**，代码遵循 13。
- S8 `design.md:237` `onVisibilityChange(visible, progress)` 位置参数 ↔ `ScrollSceneSlot.tsx:177` 单 detail 对象（与 :841 自相矛盾）。
- S9 `design.md:327-329` exit-only 仅限 scroll+dev 警告 ↔ 代码全模式拒绝并 fail-open。
- S10 `design.md:922-923` ComposedAnimation `mode?` 可选 + `delay?` ↔ `types:338-339` mode 必填 + `delays?`——**规格自带示例 :1084 按其类型编译不过**。
- S11 `design.md:1034-1040` AnimateTimeline 接口漏 `frame` 字段。
- S12 `design.md:1331-1416` 数据模型章：SceneState/AnimateInfo/AnimationRegistry(status/startTime/executionTime)/PreloadState 全部是已删可变结构体模型，代码为 lease/snapshot/单写者 MotionValue。
- S13 `design.md:1435` `onLoadError` ↔ 实际 `onError(url, error)`；`:1935` `INVALID_SCENE_INDEX` 幽灵错误码、`NO_SCENES`/`FIRST_SCENE_TIMEOUT` 反向缺失。
- S14 `design.md:1157-1172` waitFor 示例用扁平 `delay={2000}`/`enterDuration` props ↔ 公共 `AnimateProps` 不接受（与 :1193 自己的规则冲突）。
- S15 遗留章节：`:2043-2115` 项目结构树（幽灵 hooks/utils、错位文件）；`:1537-1548` 测试策略列举幽灵模块测试；`:1671` 「动画帧率控制在60fps」（实际只是上报钳 60）；`:1676` throttle 16ms（throttle 已死码）；`:1700,2167-2210` terser（已换 esbuild）；`:1985` react ^18（实际 ^18||^19）；`:1795-1815` 幽灵 hooks 示例；`:1838-1845` Context 形状。
- S16 CLAUDE.md：测试计数 1127→实际 1474/108；速查表缺 enterRef/exitRef（C:145-158）、scrubRange/releaseOnLeave（C:130-139）；布局表把死码 throttle/gestureDetector 当活码、缺 src/media/、useFirstSceneEnter、dragTimelineMapping。

MISSING（代码行为无规格背书）：
- M1 `releaseOnLeave` approach-band 媒体驻留（`AnimateVideo.tsx:73`、`sceneScrollRuntime.tsx:21-38`）——两份文档全缺。
- M2 公共参数 `ScrollModeConfig.sceneSizing: 'content'|'screen'`（`types:94`、默认 content）——opt-in `'screen'` 重新引入 `design.md:375` 明令禁止的一屏下限，且整个参数零记载。
- M3 programmatic 平滑滚动（goToScene/goToZone）显式绕过防跳过钳（`useNativeScrollController.ts:88-94,371-382`）——规则12 未裁决该路径。
- M4 `useAnimateTimeline()`/`AnimateRenderState`/`AnimatePhase`/`AnimateStaggerConfig`(each=40,from='first')/`AnimateTimelineFrame`/`AnimateTimelineSource` 公共类型未入接口章节；`PositionProps.at.anchor`、SceneProps 的 HTMLAttributes 透传、`enterRef/exitRef` 未入 Animate 接口块。
- M5 `AnimateVideo.timeline` 实际收窄为 `{delay, waitFor}`（`AnimateVideo.tsx:45-48`），比 Animate.timeline 窄。
- M6 代码侧文档谎言：`types/index.ts:542` exitRef JSDoc 声称在 scrub 轨生效，实现是上报 INVALID_ANIMATION 并忽略（随 dist .d.ts 发给消费者）。

### 节点

- [ ] 7.1 T1 增补：修 A43 时同步改写 `videoPlaybackOwnership.test.ts:319-344`（现把 gesture-only 回收固化为预期）+ scroll 接管轨 phaseMotion 永不前进导致 activate 逃生口失效的事实写入修复注释。
- [ ] 7.2 【决策点 D·C1】scrollbar 默认值：A=改代码 `enabled === true`（行为破坏式，按规格）或 B=改规格+类型注释为「传对象默认开」。**建议 B**（现语义已被消费），用户拍板。
- [ ] 7.3 【决策点 E·C2+S10】ComposedAnimation：文档 `delay`→`delays`、`mode`→必填；parallel 消费 delays 是实现裁决——保留则删「仅 sequential」措辞，拒绝则 composer 加守卫。建议：改文档，保留实现。
- [ ] 7.4 【决策点 F·C3】`uncappedFullDragElapsedMs` 诊断：实现（dev 满程耗尽 console 诊断）或从 design.md:93 删除。建议删除（YAGNI，无消费者要求）。
- [ ] 7.5 drag 节改写（S1,S4,S5,S6）：事务相位机器按 `dragPreparedState.ts:21` 实况重写（含 programmatic 相位、symbol 比较释放语义）；onStableSnapshot 三参、resolver 实名、cleanup 传参。
- [ ] 7.6 scroll 节改写（S7,S8,S9 + C4）：规则10/13 合并成单一表述（以 13 为准）；onVisibilityChange 改 detail 对象；exit-only 全模式措辞；preload zoneId 加宽入规则。
- [ ] 7.7 MISSING 回填（M1,M2,M3,M5）：releaseOnLeave/approach band、sceneSizing（含 'screen' 与一屏下限禁令的关系裁决）、programmatic 绕过防跳过的裁决、AnimateVideo.timeline 收窄——各写成明确裁决条款。
- [ ] 7.8 API 章补全（S10,S11,S13,S14,M4）：ComposedAnimation/AnimateTimeline.frame/错误码全集（含 NO_SCENES、FIRST_SCENE_TIMEOUT，删 INVALID_SCENE_INDEX）；waitFor 示例改 timeline/duration 分组写法；enterRef/exitRef/useAnimateTimeline/AnimateRenderState/AnimatePhase/AnimateStaggerConfig/AnimateTimelineFrame/PositionProps.at.anchor/SceneProps 透传全部入接口块。
- [ ] 7.9 数据模型章重写（S12）：SceneState→相位联合 + lease/snapshot 实况；或整章替换为指向代码类型的指针（建议后者，防再漂移）。
- [ ] 7.10 遗留章节清理（S15）：项目结构树按实际文件重生成；测试策略删幽灵模块、按 src/__tests__/{integration,bugfix,properties} 实况改写；性能章 fps-60/throttle/terser/react19 逐条修正。
- [ ] 7.11 CLAUDE.md 同步（S16）：测试计数与日期、速查表补 enterRef/exitRef/scrubRange/releaseOnLeave/useAnimateTimeline、布局表修正（删幽灵、补 src/media 等）。
- [ ] 7.12 代码侧文档快修（M6 + C1 注释）：exitRef JSDoc 对齐 scrub 轨拒绝语义；scrollbar enabled 注释按 7.2 裁决改。（PresetAnimation 内部改名随 T4.4。）
- [ ] 7.13 收口门：文档改完后派新 agent 做「只读 design.md 找代码」抽查——按新文档定位 S1/S7/M1/M2 四项行为各 ≤5 分钟；CLAUDE.md 与 design.md 交叉处（速查表 vs 接口章）零冲突；`pnpm verify:framework:static` 全绿（防文档内嵌代码示例失真）。

## 明确不在本轮范围

- `PerformanceMetrics.bundleSize` 移除与 fps 钳制 60 修正（公共 API 破坏，需产品决策，已登记不静默动）。
- 白名单 10 属性之外的自定义插值/`registerAnimation`/scrub 缓动等扩展 API（正向能力，另立 task-flow）。
- `Animate.tsx`(961)/`CineView.tsx`(1157)/`useDragSceneEngine.ts`(843) 三文件 >800 行的专项拆分（本流零行为收敛已减负；拆分方案单独设计，登记于下）。

## 登记的后续专项（不在本流执行）

1. 巨石拆分：CineView.tsx 抽 `useDragTransactionCoordinator`（~300 行，L459-754）；Animate.tsx 抽 `useAnimateVariants`（~270 行，L231-621）；useDragSceneEngine 抽 `createRenderLane`（已并入 2.12）。
2. scrub 轨扩展 API（属性插值注册、自定义预设名、滚动条样式钩子）。
3. 120Hz 指标与 performanceMonitor 语义修正。

## 收口总门（全流完成后一次过）

- [ ] `pnpm verify:framework:static` 全绿 + `pnpm build:verify` 8/8 + `pnpm test:site-contracts`
- [ ] 行数核算：全流 net ≤ **-1200**（目标 -1900 的稳健折扣；T2a 单独应达 -850）
- [ ] 独立浏览器 lane：`#/drag` 与 `#/` 完整手势回归 + stress-fps 双模式 ≥ 基线
- [ ] 每任务流节点 PASS 记录齐全（对抗 agent 输出存档于本文件同目录 `_gate/`）
