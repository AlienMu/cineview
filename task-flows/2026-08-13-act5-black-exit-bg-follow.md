# 2026-08-13 act5 黑幕退场只淡出 + 背景/组件色随滚动过渡

## 需求（用户原话）

1. **背景随滚动变色**：首页全局滚动全局渐变（现有 `HomeBackdrop` 600vh 暖色带为底），背景颜色随滚动缓慢过渡，**从相邻暖色过渡**。
2. **组件颜色跟随**：场景组件（panel head、codeboard head 等）颜色根据背景色同步过渡——**纯色、非渐变**，按滚动位置调整 RGB 参数。
3. **act5 黑幕退场只淡出**：PC 端首页第五幕（手机内嵌 `/drag` 第五幕 SceneCut 黑幕），往回滑松手后黑幕退场**不要下移动画，只淡出**。

## 已确认的机制（待对抗复审验证）

### ask2 黑幕下移 = drag release 补间 + 场景框 transform

- 触发：/drag 第五幕（SceneCut，`.tp-scene--05` 黑色渐变背景 `temporal-scenes-03-05.css:916-927`）往回滑、松手 → release 结算。
- 补间：`useElementTrack.ts:447`（settle，`animate(motion, tSelf, {duration: remainingMs/1000, ease:'linear'})`）/ `:475`（bounce，easeOut）/ `useDragSceneEngine.ts:470`（render bounce）——framer `animate()` 时间轴动画，时长来自 `transitionDuration: 720`（`TemporalDragExperience.tsx:122`）。**松手后不受输入控制。**
- 位移：`DragSceneStack.tsx:99-107` `DragSceneFrame` 每帧 `translate3d(0, (index − currentScene − renderProgress)×100%, 0)`——release 补间推 renderProgress，黑幕框从手指处（~+30%）滑到 +100% 完全滑出下方。
- 同时 `SceneCut.tsx:89` `s05-copy-exit` 淡出字幕（700ms）——「淡出 + 持续下移」观感。
- 为什么之前没找到：位移不在 SceneCut 组件里，在框架 DragSceneStack 场景框层。

### ask1 现状

- `HomeBackdrop.tsx/.css`：600vh 暖色带 + 固定明度纱，scroll 事件 + rAF 直写 transform（零 React）。锚色 2026-08-12 已把明度摆幅拉到 ~47（谷 lum≈195），用户报过「根据滚动调整背景颜色没有实现」。
- 组件台阶色：`global.css:38-86` `.home-scene--*` 的 `--scene-plate` / `--scene-plate-bar` / `--scene-accent`（幕级台阶，非每帧）；Act3 `--a3-plate`、film codecard bar 等消费。
- 硬约束（memory）：`scrolling-ribbon-makes-tint-visible`（固定暖色全屏表面 vs 变色带 = 闪烁）、`css-var-opacity-repaints-fullscreen`（每帧 CSS 变量重绘）、Act3 plate 与谷段同色温硬约束。

## 节点

### N1 框架 + site 对抗复审（本轮）

- [x] 1a 子 agent「框架侧」：完成，报告已落盘 `site/review/20260813-adv/framework-review.md`。要点：机制 CONFIRMED（settle 补间 = useDragSceneEngine.ts:708-743 写 dragProgressMotion，框 transform DragSceneStack.tsx:99-111）；**时长修正：slideDuration 默认 800ms 而非 720**（720 只是 settle 兜底定时器）；scroll 首页无位置动画（硬证据）；框架原生选项全部 REFUTED；方案 (a) 可行但 **z-60 蒙版变体不可行（onDragCommit 在 settle 完成后才发，已复核 useDragSceneEngine.ts:673-741）**，改 z-1 静态黑层 + onDragProgress 跟手 opacity（bounce 每 tick 发 ⇒ cancel 自动淡回）。
- [x] 1c 汇总两 agent 结论 → 方案定稿（A/B/更优）交用户确认。

### N2 ask2 黑幕退场只淡出（定稿方案，用户已拍板 2026-08-13）

定稿：**z-1 根级黑层（保琥珀渐变）+ `.tp-scene--05` 背景透明 + `onDragProgress` 跟手 opacity + commit snap + ~250ms CSS transition，进退场对称**。
- 否决项：z-60 蒙版（onDragCommit 在 settle 完成后才发，无法在松手时刻点亮）；框架原生（drag 无 backdrop 概念，Scene 级 transition/stack cover 在 drag 均不生效）；场景内反平移（800/800 隐性耦合）。
- 长线待专项：框架 drag 模式 backdrop/fixed-layer 原生能力。

- [x] 2a 实现：`temporal-scenes-03-05.css` `.tp-scene--05` 背景改透明；`temporal-drag.css` 新增 `.tp-act5-black`（渐变迁入、z-index:1、opacity 0 默认、transition opacity 250ms）+ 共享背景组改为只留 scene 3；`TemporalDragExperience.tsx` 加黑层 + onDragProgress 直写（sceneIndex 3 前进=progress / sceneIndex 4 后退=1−progress）+ onSceneDidChange snap（toIndex 4→1、其他→0）。type-check/prettier 绿。
- [x] 2b 对抗复审 PASS（验收报告 `site/review/20260813-adv/acceptance-ask2.md`：z 序/回调契约/副作用/规则合规全 CONFIRMED；探针 2 处缺陷为探针自身问题已修；遗留 risk 1/2 已用 session latch 修复）。
- [x] 2c 真机探针 10/10 全绿（验收三轮终报 PASS：A 跟手淡出 1→0.533 / B transform 全程 none 191 样本 / C 框仍滑 792px 对照组 / D 旧皮透明 / E commit 归 0 / F bounce 回 1；latch v3 逐 tick 建立 + S1 反转回缩 / S2 起步歧义 / S3 bounce 中 re-grab / S4 橡皮筋四场景真机全过）。

### N3 ask1 背景 + 组件色随滚动（定稿后实现）

- [x] 3a 实现：`HomeBackdrop.css` 三锚抬谷（33% #f0ceba / 40% #e6c6af / 52% #eecbb8，全锚 R−B≤55、摆幅≈38）；`HomeBackdrop.tsx` 扩展 write()——computed backgroundImage 解析 LUT、`[data-bg-follow]` 按 (y0+shift)/bandHeight 采样 + 向白 lift（bar 12%/plate 6%）量化直写 inline backgroundColor、零每帧布局读；CapabilityScene/Act3DollyScene 五处加 data-bg-follow。type-check/prettier 绿。
- [x] 3b 对抗复审 PASS（验收报告 `site/review/20260813-adv/acceptance-ask1.md`：LUT/y0/每帧代价/单一写者/硬约束/边界全 CONFIRMED；实测写频率 ~385px 已修注释；残余风险 6 项不阻断）。
- [x] 3c 真机探针 6/6 通过 + 对抗抽查（独立解析器交叉验证：锁定档 dPhys≤6、全程 R−B≥18、谷段 R−B≈48-51 满足 C9、相邻 Δlum≤9.2）。

### N4 收口

- [x] 4a `pnpm test`（113 suites / 1516 tests 全绿，site 改动零回归）/ `type-check` / `lint`（prettier 全绿）。
- [x] 4b 代码 review（/code-review 15 条发现）：已修 10 条（纹理扫过第四幕→纹理会随黑层同步淡出；settle 冻结+transition 滞后→三态编排手势跟手/松手 700ms 淡入淡出/snap；采样错位→三段物理位置算术；明度纱未合成→带⊙纱合成；浮起不足→lift 15%/19%；scrollHeight 缓存；解析失败置空+单调校验；懒挂载 burst 重收集；旧锚色注释改写；z 序/特异性注释）。REFUTED 2 条（橡皮筋 dissolve 被验收 S3/S4 实测推翻；load-order 耦合被共享选择器移除推翻）。接受 3 条（常量采样=设计意图、编排时长跨文件耦合已注释、游离层风险已注释）。两个验收 agent 复验中。
- [x] 4c 视觉验收：两个验收 agent 复验 code-review 修正均显式 PASS。ask2 五轮闭环（终轮：探针 10/10 + T4 纹理同步 0.417/0.417 + 进场 pop ≤0.028 + 特异性 0,3,0）；ask1 两轮闭环（终轮：7/7 + 三段式几何 0.00px + 独立解析器 0-3/通道 + C9 屏均振荡 8.9 ≤ 历史 8.6）。收口。

## 关键文件

- 框架：`src/components/CineView/DragSceneStack.tsx`（场景框 transform）、`src/components/Scene/useElementTrack.ts`（settle/bounce 补间）、`src/components/Scene/useDragSceneEngine.ts`、`src/hooks/useSceneManager.ts`（release 指令）、`src/components/CineView/ScrollSceneSlot.tsx`。
- site：`site/src/components/temporal-drag/SceneCut.tsx` + `TemporalDragExperience.tsx`、`site/src/styles/temporal-scenes-03-05.css`（.tp-scene--05 黑背景）、`site/src/components/HomeBackdrop.tsx/.css`、`site/src/design/global.css`（--scene-plate 台阶）、`site/src/components/CapabilityScene.tsx/.css`（codecard bar）、`site/src/components/Act3DollyScene.tsx/.css`（--a3-plate）。

## 追加轮（用户现场验收后，2026-08-13）

用户报三点，已修：
1. **PC 首页 act5 黑罩下移（我此前修错靶子）**：修的是手机内 /drag 黑幕框，而用户要的是 PC 首页 Scene5Cinema 熄灯黑罩。真机探针证实解钉时黑罩 0.872 跟滑。按用户裁决 A：黑罩留在场景内保留 Animate，移除 1.05s 防闪 transition，相位窗起点挪 0.02 —— 探针复验：解钉瞬间黑罩 opacity = **0**（黑屏完全消失才结束滚动拦截）。
2. **屏闪回归**（移除 transition 的代价，用户报障）：斜坡 0.17→**1.0**（整个 zone 线性渐变），每档滚轮 Δopacity 0.19→0.032（正常滚动 ~7 lum，N13 阈值 15 之下）；快甩 ~25 lum 残余（用户知情）。
3. **codeboard 阴影截断**：根因 = 900 设计画布在 16:9 视口比 100vh 高 80px，卡片底占视口 98%、投影被场景 overflow 裁。修 = `--canvas-fit` 等比适配（useDesignCanvasHeight 新增 canvasFit，`.home-scene--film .home-scene-canvas` scale）+ 投影 0 20u 48u→0 16u 40u。探针三档视口（1440×900/1280×720/2560×1080）1.5σ 可见投影零裁切。

调色板（用户两轮裁决）：蜜桃粉→琥珀金→陶土橙→奶油 四家族单向迁移（粉色按用户要求移除）；锚色即跟随采样源，面板色随滚动连续过渡（实测面板 R−B 32-62、lum 195-236，逐幕家族可辨）。
