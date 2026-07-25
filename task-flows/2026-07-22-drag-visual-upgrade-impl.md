# Task Flow — /drag 视觉升级实现（依据 v3 增补稿）

> 日期: 2026-07-22 | 依据: task-flows/2026-07-21-drag-visual-upgrade-spec-v3.md（五维验收通过）
> 范围: site/src/components/temporal-drag/* + temporal-drag.css + i18n（框架 src/ 零改动）
> 铁律: 进度分发一律走 `useAnimateTimeline().progress` MotionValue，禁 render-prop enterProgress number（每帧 setState）。

## 节点（按 §12 优先级）

- [x] N0. 5 屏挂载顺序重排（§0.1）——rolling→slate→sync→flux→cut；frame/slate 顺移；off-by-one（FLUX 03→04、CUT 04→05）真机验收发现并已修
- [x] N1. 色板 token（六色调色台，无绿）+ 微冷黑底（§2.1）+ 5 屏 sig 别名 + legacy 别名
- [ ] N2. 质感层 overlay：颗粒 0.11 + 扫描线 + 暗角（§3），CineView 外层，pointer-events:none
- [~] N3. Scene 01 Hero 重做：**N3a 已落地**（指针角度门控主驱动 s01-gate=1600ms + pointerGate context 下发 progress MotionValue + 6 元素 useGateLocal(触发角)→useTransform 组合叠加 + 文字色显影）；build 通过、静态自检三项过（零 setState/gate 最大注册项/无 render-prop number）；**真机视觉验证被网关不稳阻塞**。**未做**：DialTicks/DialHands/DragHint 门控化、四角取景器仪表（§4.4）、盘面层次（§4.5）、三态退场显式 author（§4.3.1）
- [~] N4. Scene 02 场记板 canvas 粒子（新增屏）：ClapperboardCanvas + particleField 订阅 useAnimateTimeline().progress MotionValue；真机确认 canvas 渲染+scrub 汇聚；粒子视觉待细调
- [ ] N5. Scene 03 编排轴（原 02 修改保留）：语境标题 + 节点可读性 + CTA 切边修复 + ParamPanel 修复 + 布局填空（§6）+ CSS class s02→s03 顺移
- [ ] N6. Scene 04 时间瀑布（原 03 增强）：波形层 + 径向刻度 + 绕环扫描点 + 时码 RGB 色差 + 副读数（§7）+ CSS class s03→s04 顺移
- [ ] N7. Scene 05 片尾（原 04 收紧）：上半屏补空胶片尾料 + CUT 收紧居中（§8）+ CSS class s04→s05 顺移
- [x] N8. i18n：新增 s02 场记板 key + 03/04/05 顺移迁移（§10）——en/zh 对齐；级联覆盖 + undefined 两 bug 已修
- [ ] N9. reduced-motion 适配 + 性能分档（§11）
- [ ] N10. 收口：type-check / build / 独立 agent 真机验收（§13 九项）

## 已建基础设施
- `pointerGate.tsx`：PointerGateContext + usePointerGate + useGateLocal(triggerDeg) + SWEEP_DEG=300/GATE_BAND=60/TRIGGER 触发角表 + localFromRatio。
- `clapperboard/`：ClapperboardCanvas（MotionValue 驱动、DPR≤2 分档、phase 离屏暂停）+ particleField（纯程序场记板采样点）。
- `SceneSlate.tsx`：场记板屏（scene 02）。

## 阻塞
- 推理网关本 session 持续不稳（502/524/多次 agent 无输出 stall），N3a 真机视觉验证反复被阻。静态自检已过，待网关恢复后补真机。

## 自检（每节点）
1. 该改动是否真的解决原问题、非只让 tsc 变绿。
2. 进度是否走 MotionValue（非每帧 setState）。
3. 无死代码 / 无残留旧字段。
4. 单一所有者不变量不破坏（site 只读派生，不给框架状态加第二写者）。

## N3a 指针门控试验 —— 失败并回退（2026-07-22，真机验证）
- 试验:SceneRolling 元素绑 useAnimateTimeline().progress，用 useGateLocal(触发角) 派生 p_local。
- 真机数据:REST 全 1（对）、AT30/AT60 元素依次浮现（门控本身成立）、但 AFTER_RELEASE 全 0 —— 浅拖松手首屏内容全消失（严重 bug，比原基线更糟）。
- 根因（设计稿 §4.2 真实盲点）:progress(enterProgress) 对**首屏 active 场景**语义是 rest=1 → 拖走 outgoing 退场，**不是**单调入场比率 r。§4.2.1 的 enterProgress≡r 只对 incoming 场景成立。指针 drag-scrub 门控套不到首屏。
- 处置:git checkout 回退 SceneRolling 到 HEAD（waitFor 基线 + 正确 exit，前几轮真机验证可用）；N3a 试验备份 /tmp/SceneRolling.n3a-attempt.tsx。真机复测:REST 全 1、AFTER_RELEASE 全 1、无溢出、零 error —— bug 消除。
- N3 重新定位（待更新 §4.2）:指针"扫针浮现"改做**冷启动入场动画**（首屏 load 由冷启动时钟扫一次），非 drag 门控。pointerGate.tsx / GateBridge 保留备用但当前未接入。
- 教训:设计稿五维验收通过 ≠ 实现无阻塞；§4.2 假设未经受首屏 active 真机检验。

## 2026-07-22 实现进度更新（真机逐节点验证）

已完成并真机验证：
- N0 五屏重排 / N1 六色调色板 / N8 i18n 迁移 / N4 场记板 canvas 核心
- N2 质感层（grain 0.11 + scanline + vignette，拖拽穿透正常）
- SceneRolling 回退基线（N3a 指针门控引入的"浅拖松手内容消失"bug 已消除）
- N5 编排轴：CTA 切边修复（slot 内缩 6/28/50/72/94%）+ ParamPanel 核实可见 + 语境标题（s03.contextTitle）
- N6 时间瀑布：数据副读数（24fps · REC 709 · 4K）+ 时码 RGB 色差（text-shadow CRT 质感）
- N7 片尾：片头引导条（8 帧倒数填上半屏空白）+ THE END inline-fallback hack 清理

待处理：
- [!] N3 指针门控：失败回退（§4.2 设计盲点，见 drag-pointer-gate-design-gap 记忆）。核心创意与框架首屏 active 语义冲突，需用户定方向（冷启动扫针入场 / 放弃）后重做。
- [ ] N9 reduced-motion 适配（质感层 grain 已在 blanket reduce 块中停）+ 性能分档
- [遗留] CSS class 前缀顺移：SceneSync 用 s02-*（应 s03）、SceneFlux s03-*（应 s04）、SceneCut s04-*（应 s05）。纯机械重命名，不影响显示（class 钩子与 CSS 定义一致即可），为降风险暂列遗留。
- [主观] 视觉调性需用户目测：质感层"明显"强度是否显脏、Scene 03 文字放大度。
