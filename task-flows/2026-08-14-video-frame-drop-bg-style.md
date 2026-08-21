# 2026-08-14 act4→act3 掉帧修复 + scroll 首页背景/样式微调

## 需求（用户原话 + grill 拍板）

**任务1**：查看历史会话最新一段，解决视频播放后掉帧的问题。
- 已实测因果（`site/scripts/_rv-video-residency.mjs`）：act4 视频播完保留解码帧 → 倒回 act3 = 10 个 >30ms 长帧；卸载后 0 长帧。
- 方案 A「远离释放、靠近预热」（用户已拍板）：
  - `SceneScrollTimelineState` 新增 `approachPx`（segmentStart − scrollTop，DirectScrollCineView 同步时算，不进每帧 React）——守 DESIGN.md 裁决 2（AnimateVideo 不读 SceneContext）。
  - 离开 zone 超 1 视口且擦洗过 → `removeAttribute('src') + load()` 真释放；接近 1.5 视口提前重载预热（blob 内存、零网络），`loadedmetadata` 前挂起 seek、就绪补 seek。
  - 新公共 prop `releaseOnLeave?: boolean`，**默认关闭**，站点 act4 显式开启。阈值写死常量不开 prop。
  - 空窗兜底：接受空窗（透出 BackgroundRibbon 暖色渐变），验收跑「猛甩回 act4」路径后再定是否升级 canvas poster。
  - **先 zone 标注复测**（区分反向擦洗 raster 成本 vs 驻留压力），报告用户过目后再动框架。

**任务2**：scroll 首页背景/样式微调（drag 不动）。
- 首屏 LUT[0] 回奶白桃 `#fcede4/#faf8f4`（f164470 原值），其余五锚不动。
- 不改排版、不改场景规划；动画细化权力边界 = 清单每项标 [绿] 直接做 / [红] 单独拍板。
- 中英双语约束：审计每项带双语影响分析，验收双语真机各跑一遍。
- 审计每项引用历史裁决，冲突项显式标出。
- 验收门：独立 agent 双语真机 + 首屏色调探针（`--bg-grad-top` ≈ #fcede4 邻域）。

## 硬约束（memory/CLAUDE.md）

- 每帧热路径：motionValue 优先、禁每帧 setState、禁 layout thrashing（CLAUDE.md 自检 §4）。
- 站点组件禁直接 import framer-motion；常驻循环动画必须 `Animate.infiniteAnimation`（规则 6）。
- 单测全绿 ≠ 视觉正确；scroll/drag 交互验收必须独立 agent 真机实测（规则 4）。
- 每节点收口必过对抗复审子 agent（memory: node-gate-adversarial-subagent）。
- site 消费 dist 非 src：框架改动须 `pnpm build` + 重启 dev server 后验收才有效。

## 节点

### N1 并行只读（本轮）

- [x] 1a zone 标注复测 agent：完成，报告 `site/review/20260814-adv/zone-retest.md` + 探针 `_rv-20260814-zone-retest.mjs` + 原始数据 `zone-retest.raw.json`。**结论修正原假设**：(a)/(b) 二分不成立——act4 段长帧 100% 视频驱动（卸载 77→0，无独立擦洗 raster 成本）；act3 段 24 长帧与视频无关（卸载后 34 不降反升，反推镜自身 raster，需专项）；边界带 0 长帧（无双场景合成夹击）。附带发现：`__CINEVIEW_SCROLL_DEBUG__` 在 dist 是死代码（minify 内联 false），边界改用 DOM 实测。headless 钳 30fps，长帧绝对数只作组间相对。
- [x] 1b 五幕审计 agent：完成，清单 `site/review/20260814-adv/style-audit.md`——23 点位（21 绿 / 2 红），14 项「明确不动」。
- [x] 1c 汇总拍板（2026-08-14）：
  - 红区 1 codecard 三圆点 accent 派生 → **用户豁免**（静态派生 ≠ 逐帧跟随，不违 08-13 裁决语境）。
  - 红区 2 act5 分栏时序 86% 交叠 → **REFUTED 撤回**（用户指正：标题在手机 commit 末幕后才出现，与手机位移无交叠；审计误判）。
  - act3 段 24% raster 成本 → **拆专项另立 task-flow**（用户拍板，本流程不打包）。
  - **新增用户报障**：act5 分栏标题反向路径不执行退场动画。探针 `_rv-20260814-split-exit-3.mjs` 复现：交互路径（iframe 内反向 commit）unfinished 消息发了、split 翻了、但标题 opacity 恒 1（退场发生在视口外/不可见）；降级路径（滚轮向上）split 在 scrollTop 31700→30300 区间随 unlock/freeze 瞬时翻 false，无镜像退场。
  - **用户指令**：退场能否接入框架能力（先普查）。→ N1d。
- [x] 1d 框架退场能力普查 agent：完成，`site/review/20260814-adv/framework-exit-capability.md`。**结论 (a)：现有 enterRef/exitRef 直接够用，零框架增强**。要点：exitRef 立即触发 tween、播完元素留 DOM、可逆；`sceneControlled:false` 在 scroll takeover 内强制 visibility 时间轨，act5 标题纯事件驱动恰好落在手动控制唯一支持的轨上；`manualExitUsedRef` 粘性所有权挡 replayOnReenter 拉回（有回归测试）；Scene 级 exitAnimation REFUTED（相位驱动且够不到子元素）；freeze 与标题退场正交（只卸 iframe）。
- [x] 1e 退场迁移方案（用户已拍板 2026-08-14）：
  - 标题+副标题从 CSS-transition 迁到框架 `Animate sceneControlled={false}` + enterRef/exitRef；enter/exit 成对 variant（只声明 exit 非法）；镜像退场用 stagger 表达（waitFor 只管 enter 方向）。
  - 接线：finished → titleEnter()；unfinished → titleExit()；freeze → titleExit()。
  - **freeze 时序（用户拍板）**：freeze 等 700ms——progress<0.4 触发时先 titleExit()（600ms fade），700ms 后才卸载 iframe + setSplit(false)。三级串行：退净 → 收列 → 卸手机。
  - 迁移后删除 Scene5Cinema.css 的 is-split 文字 transition 编排（手机位移段 gap/列宽 1.1s 保留 CSS——布局属性不走 Animate 白名单）。
- [ ] 1f 文案+表现形式重设计 agent（进行中，用户 2026-08-14 新增指令「重新设计更优雅的文字，五幕一起过，act5 优先」）：每幕 2 方向（A 克制演进 / B 表现力跃迁）+ 推荐，中英成对非翻译，语气红线「示范给你看」。产出 `site/review/20260814-adv/copy-redesign.md`。

### N2 任务1 实现（复测报告用户确认后）

- [x] 2a 框架（2026-08-14 主会话实现）：
  - `SceneScrollTimelineState` += `approach: 'inside'|'near'|'far'` + `resolveZoneApproachBand` Schmitt 触发器（`sceneScrollRuntime.tsx`）。**阈值修正**：原定「释放 1vh/预热 1.5vh」在 Schmitt 语义下不稳定（1-1.5vh 区间会抖动翻转），换序为**释放 >1.5vh / 预热 ≤1vh**（预热仍在到达 zone 前约 1 视口滚动距离，足够藏 100-400ms 解码）。
  - `useNativeScrollController.syncZoneStatesFromNativeOffset` 每帧算 band（去重比较含 approach——离散值只在跨阈值时发布，零每帧 store 通知）；`useScrollZoneRegistry` 初始态默认 'near' + syncZoneState 去重含 approach。
  - `VideoFrameRenderer` += `controlRef`（`release()/warmUp()` 祈使句柄 + `released`/`mediaEpoch` 状态；release = pause+removeAttr(src)+load() 保留 blob lease；warmUp 重挂 src + epoch 重臂 loadedmetadata 补 seek）。既有 video element ref 契约不动。
  - `AnimateVideo` += `releaseOnLeave?: boolean`（默认关）；`useVideoResidencyControl`：takeover zoneId + band 订阅 + 「已被 scrub 过」门控（未播过的视频无帧可释放）。
- [x] 2b 单测：`sceneScrollApproach.test.ts`（Schmitt 六例：阈值/迟滞带稳定性/视口量化）+ `VideoFrameRenderer.test.tsx` control handle 三例（释放摘 src、预热重挂+补 seek、lease 不随释放丢）。全套 114 suites / 1525 tests 全绿（首轮 1 例 flake 复跑无复现）。
- [ ] 2c 对抗复审子 agent PASS。
- [x] 2d 真机验收（部分）：`pnpm build` dist 重建 + dev server 重启 + site act4 `releaseOnLeave` 启用。探针 `_rv-20260814-release-onleave.mjs` **4/4 PASS**：①正向播完 10.04/10.04s ②深进 act5 后 src 摘除 readyState 0 ③倒回 act3 仍保持释放 ④回程接近 act4 重挂 src readyState 4。act4→act3 帧间隔对照复测（对照 zone-retest 基线 77→0）待对抗复审 agent 一并跑。

### N2.5 act5 标题退场迁移（方案已拍板；实现 agent 两次死于配额，主会话接手收尾）

- [x] 2.5a site：标题+副标题迁 `Animate sceneControlled={false}` + enterRef/exitRef；finished/unfinished/freeze 三处接线；unfinished 退场播完 950ms 才 setSplit(false)；freeze 先退文字 700ms 后卸 iframe；is-split 文字 transition CSS 已删（布局位移段保留）。tsc/prettier 绿。
- [x] 2.5c 真机探针验证：`_rv-20260814-split-exit-verify.mjs` 两场景全 PASS——A（iframe 内反向 commit）副标题 300ms 起步→标题 500ms 跟上→1100ms 文字退净→1200ms 收列（镜像退场真实执行）；B（滚轮向上）五断言全过（退净≤收列≤卸手机三级串行可辨）。
- [x] 2.5b 对抗复审子 agent **PASS-with-notes**（`adversarial-n25-n3.md`，七维度 + 4 跟进项）。跟进项已全部当场修复并真机复验（2026-08-14）：
  - **P2 R6-1 freeze 定时器竞态**：IO 加 `isIntersecting` 分支——滚回视口且 freeze 飞行中 ⇒ 取消定时器 + `runSplitEnter()` 重入文字；`freezePending` 局部标记防 observer 首回调误触发。
  - **P1 R1-1 zh 标题裁切**（存量缺陷被实测推翻「够窄」假设）：text-col 基准 `min(420u,34vw)` → `min(500u,36vw)`（zh 自然宽 439px，1440 档 500/1280 档 461 均 ≥439，手机+gap+文本合计 802px < 1280）。真机复验：titleRight 1132 < colRight 1193、右缘 elementFromPoint 命中标题自身 ✓。
  - **P3 R2-1 hint zh 字距死码**：span 加 `data-lang={lang}`。真机复验：zh ls=1.2px（0.10em ✓，原 1.92px 死码）。
  - **P3 tokens 回退色**：`--bg-grad-top/bot` 同步 LUT[0] 奶白桃 `#fcede4/#faf8f4`。
  - 回归：`_rv-20260814-split-exit-verify.mjs` A/B 全 13 断言 PASS（R6-1 修复未破坏正常 freeze 路径）；tsc/prettier 绿。

### N6 收尾层（用户 2026-08-15 指令：「act5 最后加上普遍落地页收尾流程，在 /drag 到末尾的时候」）

- [x] 6a 方案拍板：分栏后第三拍覆盖层（同 finished 触发源 + 手动控制轨，零滚动预算变化）；CTA + footer 全套（九个死 key 上岗）。
- [x] 6b 实现（2026-08-15）：Scene5Cinema CTA 块（cta.title lead + 三按钮 .btn 族 + cta.body）+ footer 行（tagline/docs/demo/MIT）；SPLIT_ENTER_CTA_MS=1700 / FOOTER=2000，退场 CTA/footer 最先出（SPLIT_EXIT_CTA_MS=0）；不写 CSS opacity:0 基线（随迁移后规约，FOUC 由框架守卫承担）。
- [x] 6c 真机验证：`_rv-20260815-closing-verify.mjs` **6/6 PASS**——入场串行（title 0→1s / subtitle 0.2-1.2s / cta 1.0-1.6s / footer 1.4-1.8s 实测曲线）+ 反向 commit 后 cta/footer 退场 tween 可见且退净。
- 排查记录（三重探针事故，产品无 bug）：①首轮采样错元素（`<p>` computed opacity 不继承包装层恒 1，memory test-proxy-signals-break）②反向手势 0.3→0.7 被 drag-cancel 吞（须 0.1→0.85）③**分栏后手机左移导致 iframe box 过期**——反向拖落在右栏文字上事件根本不进 iframe（split-exit-verify 的 box2 重测是正解）。诊断探针已清删。

### N5 暖/暗双主题设计审计（用户 2026-08-14 新指令：「暖色调，/scroll 暖色为主 /drag 暗色为主，设计优化」）

- [x] 5a 审计 agent：完成 `theme-audit-warm-dark.md`（通知丢失但产物完好）。结论：/drag 暗色本体健康（明度阶梯成立、与 scroll 熄灯黑同族），偏离集中 3 结构点位；/scroll 五幕内无冷残留。
- [x] 5b 用户拍板（2026-08-15）+ 实现 + 真机验证（探针 `_rv-20260815-theme-fixes.mjs`）：
  - **A-1 [红] 裁决 (a) 收编 teal**：act4 全部蓝紫字面量 → teal 族（--tp-sig #5cb8c9、accent #a8dce4、玻璃 #0a3a44/#062a31/#020c0e、紫 radial/紫 glow 全删或转 teal 低 alpha、pink flare 转 warm 白、ApertureCanvas sheen 四档 stop 平移 hue 207°→187°）。五幕行程恢复 amber×3→teal→amber。真机实测 sig=#5cb8c9 ✓。
  - **A-3 [红] 裁决 (a) 复活终局**：act1 主 CTA amber 实底 → `--tp-sig-rec` #e64536 实底 + 暖黑深字 + rec glow；`RecBadge.tsx` + `.tp-rec*` 规则 + barrel export + `--tp-rec` 别名删净（`--tp-rec-glow` 保留，唯一消费者 = CTA）。真机实测 bg=rgb(230,69,54) ✓。
  - **A-2 契约注释**：teal 注释改写（act4 现以 teal 提亮档消费冷极，「No blue」重新成立）。
  - **A-4 [绿]**：`.drag-page` 底色 #0c0a0c + `overscroll-behavior-y: none`。实测 ✓。
  - **A-5 [绿]**：act3 三处微字 alpha 抬档（0.72→0.85/0.66→0.8/0.6→0.75）+ 字号下限 7px→8px。
  - **B-1 尾 [绿]**：tokens `--accent/--accent-ink` 同步 LUT[0]（#d59273/#a86247）+ global.css 首帧 fallback 同步。
  - **B-3 [绿]**：`--lut-*` 四族冷色死 token 删除。
  - **C-1 尾 [绿]**：`#9a948a` → `var(--tp-ink-mute)` 消双源。
  - tsc/prettier 绿；console 仅 1 个既有静态 404（与改动无关）。

### N2.6 切语言逐字重播 bug（用户 2026-08-14 报障，探针实锤）

- 现象：切到 en 逐字重播（用户原报）；探针 `_rv-20260814-lang-switch.mjs` 实测**双向都重播**——zh→en 全量瞬亮帧后必有一帧重播（en 字符少切得快），en→zh 50 字符卡 opacity 0 逐字重播 2.6s。
- 根因：`buildIntroItems` 的 span 无显式 key（数组 index key），切语言时 80↔29 字符，React  keyed 复用错位——保位子项持 MotionValue 终态 opacity 1、新建子项从 initial 0 起步，stagger 容器对已入场状态不做对齐 ⇒ 混合态重播。
- 用户拍板（2026-08-14）：**框架层修**——keyed 重挂（全量子项持初态）时在视口内对齐终态，不重播 stagger。触及热路径，需对抗复审。
- [ ] 2.6a 框架：stagger 容器 keyed 重挂载 → 视口内 settle 终态而非重播（useAnimateScroll / stagger 结算处）。
- [ ] 2.6b 单测 + 对抗复审 PASS。
- [ ] 2.6c 真机验收：双向切语言零逐字重播（复用探针改断言）。

### N3 任务2 实现（样式 19 绿区项，用户 2026-08-14 拍板「已排版先做」= 样式微调优先开工）

- [x] 3a `lut.ts` LUT[0] → `#fcede4/#faf8f4`（探针实测 `--bg-grad-top` 首屏 = #fcede4 ✓）。
- [x] 3b 审计 19 绿区项逐项实现完成（2026-08-14，行内模式）：
  - act1：hover 光晕三处（lang-toggle/btn-primary/btn-ghost）+ intro 逐字 zh y:10%（en 15% 保持）+ hint opacity 谷底 0.65 + zh 字距 0.10em。
  - act2：bg-grid 中性墨直写（探针 ✓）/ 齿孔流光+基底 accent 派生 / caption blur 0.55vw / 三圆点 accent 派生（探针 ✓ color(srgb 0.836 0.624 0.437)）/ 分隔线 accent-ink 派生。
  - act3：panel 投影 0.10/3.2em / 代码脚竖线 0.14em+70% / developVariant blur 0.42vw + scale 0.95 / stagger bar 尾端 accent 35% / chain dot glow accent 45%。
  - act4：warmAt hue 36→14 / 退场 blur 尾帧 0.42vw（SUBTITLE_BLUR_EXIT）/ scrim + text-shadow --bg-grad-bot 派生 / zh 伪斜体→字重 600（act2 cap-title em 同语汇一并）。
  - act5：呼吸 glow 峰值 0.32+收窄 / 标题 text-shadow 14px/0.20 / 副标题竖线 alpha 0.40（含窄屏 breakpoint 覆写同步）。
  - 事故记录：CapabilityScene.css 曾被 prettier 重排 + 我误留一个多余 `}`（157 行语法错误），已修；全文件 prettier/tsc 绿。
  - ⚠️ Scene5Cinema.tsx 的 tsc 报错（SplitTextDriver/splitTitleVariant 未定义）是 N2.5 迁移 agent 进行中的半途状态，非本节点产物。
- [ ] 3c 对抗复审子 agent PASS。
- [ ] 3d 真机验收 agent：zh/en 双语五幕全滚动 + 首屏色调探针（`--bg-grad-top` ≈ #fcede4 邻域）+ 每幕 before/after 截图。

### N3.5 文案重设计（act1 不动，用户要求「再好好想想，更优雅」）

- [ ] 3.5a 二轮文案提案：act1 slogan/intro 保持现行不动；act2-5 在 A 方向基础上向「更优雅」重写（克制提纯之上再抬一层文学性，仍守「示范给你看」红线 + 行长硬约束）。产出 `site/review/20260814-adv/copy-redesign-v2.md`。
- [ ] 3.5b 用户拍板后替换 i18n key（死 key `demoVideo.desc` 删除、`idea.*` 无挂载不动）。

### N4 收口

- [x] 4a 终验 agent（第 3 实例跑完，前两死于 503/配额）：`final-acceptance.md` **10/11 PASS**。PASS：首屏奶白桃双证、N3 21 条 computed 断言、act5 迁移复跑 6/6、text-col 零裁切、hint 双语字距、收尾层 6/6 两轮、releaseOnLeave 4/4、五幕色温行程（hue 37/37/37/189/33 = amber×3→teal→amber）、CTA rec、零 console 报错。
- [x] 4b 帧间隔对照（唯一 FAIL 项，判为**预期不对症而非回归**）：raw 组 act4 段 30/run vs 基线 26——长帧集中在**段内反向 scrub**（每帧 seek 固有成本；视频已核实全关键帧 241/241，非编码问题），releaseOnLeave 需离开段 1.5 视口才触发、对此段无效（ctrlB 基线已证段内 scrub ~20.7/run 与驻留无关）。且 headless 30fps 钳制放大计数，不映射真机 60Hz。**遗留**：段内反向 scrub 降本（seek 节流/快甩档插值）与 act3 反推镜 raster 同属「性能专项」待办，另立 task-flow。
- [ ] 4c 用户现场验收 + 文案 v2 拍板（i18n 替换 + 死 key 清理待执行）。

## 关键文件

- 框架：`src/components/CineView/DirectScrollCineView.tsx`、`src/components/Scene/sceneScrollRuntime.tsx`（SceneScrollTimelineState）、`src/media/VideoFrameRenderer.tsx`、`src/media/videoPlaybackOwnership.ts`、`src/components/Animate/`（AnimateVideo）。
- site：`site/src/design/lut.ts`、`site/src/components/BackgroundRibbon.tsx`、五幕组件（HomeSceneCanvas / CapabilityScene / Act3DollyScene / DemoVideoScene / Scene5Cinema）。
- 既有探针：`site/scripts/_rv-video-residency.mjs`（掉帧实锤基线）。
