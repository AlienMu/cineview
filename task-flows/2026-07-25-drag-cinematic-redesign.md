# Task Flow — Drag 体验电影级重做（2026-07-25）

## 背景与用户裁决（已锁定，不再反复确认）

用户核心诉求："目前的完善还是很丑陋"。要同时修**静态视觉**与**动效**问题。逐屏重做，
每屏改完**必须派独立子 agent 真机验收**（Puppeteer/Playwright + 真实 Chromium，390px），
禁止自改自验。验收关注点：错位、样式、配色、拖拽动画是否跟随、排版是否空旷、
背景是否太暗单调（黑底可以但要加辅助元素）。

### 全局铁律
- **所有元素的进/退场动画都必须绑定 drag**（scrub in、release 播完剩余、reverse 反向）。
- 环境光（ambient）**只在第一屏**，且随 drag 沉入场景；不要每屏千篇一律。
- 配色重做（当前"特别丑"）。
- 四角暗淡文字要能看清（当前被 vignette rgba(0,0,0,.72) @ z:50 压死）。
- 装饰层 z-index 过高需下压（texture/vignette z:50 盖在内容 z:10 之上）。

### 逐屏裁决
- **屏1（SceneRolling / 01 ROLLING）**：刻度太丑、和圆形框完全没对齐。根因：DialTicks 用
  硬编码 radius=46% 定位、`--tick-angle` 只做扇区染色不做径向旋转（刻度都竖着不指向圆心）；
  且 dial 尺寸基 `min(58cqw,300px)` 与 inner-ring 基 `45cqw/max234px` 是两套，永不对齐。
  ambient 只此屏。**追加（已锁）**：删掉廉价的 "DRAG TO ROLL" 提示（s01-scroll-hint），太丑。
- **屏2（SceneSlate / 02 SLATE）**：**粒子开合场记板**。核心表达 = 场记板上片（clapper stick）
  从张开 →**合上**那一下 snap = 电影"开拍/ACTION"。板子本体由粒子构成（已有
  ClapperboardCanvas）。**开合动作必须同步绑定 drag 的进场与退场**：
  - 进场（scrub in）：粒子聚合成板 + 上片**合上**（snap 到闭合）= 开拍。
  - 退场（reverse drag）：上片**张开** + 粒子散开 = 收拍/回退。
  - release 播完剩余开合时间；反向 drag 反向开合（跟手）。
  - 加**聚焦灯**主要打在 🎬 粒子板上（spotlight/focus light）。
  **定稿（已锁）**：
  - **动画流程（严格顺序，全程流畅无明显间隔）**：先**聚光**（spotlight 打进黑场）→ 再**出现粒子并组成开合板**（粒子重组成板体）→ 再**开合**（上片合上，snap=ACTION）→ 动画**完成后**才**出现文字提示**。
  - **总时长控制 6s**，干净利落，各段之间不留明显停顿。
  - 退场：粒子**炸散**（不是反向张开，是爆散解体）。
  - 粒子**组成板子实体**，开合时粒子**跟着刚体旋转**（不是环绕点缀/尘埃）。
  - 聚焦灯主要打在这块开合的板子上。
- **屏3（SceneSync / 03 CHOREOGRAPH）→ 完全重构**：5 个左右散落、大小不一的**胶带式代码框**，
  每个在原散落位**原地** small→large 缩放，透明度联动（小=60%，scale1.0=100%，继续放大同时降透明→0 消失）；
  单个 small→消失周期 1s；连续（一个消失下一个立即开始）= 推镜淡出多张持续推进；
  进退场类型绑定 drag（scrub/release/reverse）；**只在可见时播放**；给定延迟让拖拽先执行前
  ~65% 胶片段，再 delay 到后段文案；结尾文案"屏幕不空旷"靠散落错峰 + 文案下方保留低透残影层。
  **入场铁律（已锁）**：一定是**先淡入出现"缩小"的元素，再依次放大**（不是直接出现大图）；
  5 个元素**大小必须不一致、错落有致**，保持**屏幕高占比**（不空旷）。
  **结尾文案（已定稿 = A 剪辑台版）**见下。
- **屏4（SceneFlux / 04 FLUX）**：可控性、修丑配色、背景滚动太暗、**时间码要真正跟随拖拽**
  （现 MAIN_TIMECODE 是硬编码静态串，只有 flip 入场，没订阅 dragProgress）。
- **屏5（SceneCut / 05 FINAL CUT）→ 谢幕式重构**。**定稿（已锁）**：
  - **Q1=B 谢幕式 credits**：把框架能力写成**演职员表**（导演/剪辑/摄影/主演… = 框架能力名），
    庄重竖滚，不做视频站弹幕主体。
  - **Q2=A 绑定 drag**：飘动/竖滚元素的进退都绑定 drag——scrub 进场时 credits/致意元素飞入或
    升起，reverse 退场时反向飞出/回收。符合全局铁律。
  - **Q3（黑幕合拢在黑底上看不见，已否；改用能在黑底立住的光+实体）= A 打底 + E 穿插**：
    - **A 暖色追光池 + 舞台地面**：一束追光在黑底打出暖光圆池，谢幕 credits 在光池里竖滚；
      光池边缘隐约舞台木纹地面；光随 drag 收束（scrub 到底聚成一点=关灯谢幕）。
    - **E 弹幕致意穿插**：warm 致意弹幕（"封神""帧听你的""一镜到底"…）横向飘过谢幕光池，
      呼应最初"弹幕划过"概念；绑定 drag（见 Q2）。
    - 三者叠成有光、有动、不空旷的谢幕场。
  - **Q4=C 去掉首页/文档按钮**：纯谢幕收尾，不留导航按钮。

### 屏3 结尾文案（定稿 A · 剪辑台）
- Eyebrow: `THE CUTTING ROOM` / `剪辑台`
- Title: `One timeline directs every frame.` / `一条时间线，调度每一帧。`
- Body①: `Every shot enters, holds, and leaves on the same reel — no keyframe left to chase.` / `每个镜头的进、停、出都排在同一条胶片上——没有一帧需要你去追。`
- Body②: `Scale, fade, and stagger, written once; a single progress value walks them forward, or winds them back.` / `缩放、淡出、错峰，只写一次；一个进度值带它们前进，也带它们倒回。`
- Sign-off: `You author the sequence. CineView runs the take.` / `你编排镜头，CineView 负责这一条长镜。`

## 类名/叙事编号错位（重构时一并修）
s02-scene 类被 03/CHOREOGRAPH 用，s03-scene 被 04/FLUX 用 → 收口时对齐。

## 执行节点

- [ ] N0. 基线：真机截图 5 屏现状（settle 后 + 退场 scrub filmstrip），记录问题清单
- [ ] N1. 全局配色 + z-index 分层 + 四角文字可读性（temporal-drag.css tokens/texture/vignette）
- [x] N2. 屏1 刻度与圆框对齐重做（DialTicks 径向 + 单一尺寸基）+ ambient 仅此屏 sink-on-drag
      → 真机 probe 已验（roll-probe.mjs）：settle 刻度 nonZero=60（重播）、reenterHold 段
      opacity 梯度 [1,1,1,1,0.98,0.86,0.7,0.54] descendingSteps=3（顺时针渐显）、replaySettle
      title/ticks 全回 1。刻度改为 12 段 plain <Animate>（弃 timeline.progress——该信号=
      state.localProgress，在 outgoing/idle-release 会塌到 0，即视觉仍在 rest；改用逐段
      <Animate> opacity/scale，与 title 同一条被证明可重播的 drag-scrub 源）。指针常驻自转+
      drag 叠加、退场绑定 drag、删除 DRAG TO ROLL 提示均已落地。
      ⚠️ 仍需独立子 agent 真机视觉验收（配色/错位/空旷）。
- [ ] N3. 屏2 粒子开合场记板：进场粒子重组→100%合上(snap=ACTION)、退场炸散、粒子刚体随开合旋转、
      开合绑定 drag(scrub/release/reverse)、聚焦灯打在 🎬 上 → 子 agent 真机验收
- [ ] N4. 屏3 完全重构：5 散落胶带代码框推镜淡出 + 绑定 drag + 可见才播 + 结尾文案 A
      → 子 agent 真机验收
- [ ] N5. 屏4 时间码跟随拖拽 + 配色 + 背景 + 可控性 → 子 agent 真机验收
- [ ] N6. 屏5 闭幕式 + 弹幕重设计 → 子 agent 真机验收
- [ ] N7. 收口：类名/叙事编号对齐、grep 死代码、type-check/lint/test、全局回读自检

## 验收协议（每个 N2–N6 收口前）
派独立子 agent，Playwright 真实 Chromium，viewport 390px，跑通完整手势路径
（正向 scrub → release → reverse），产出结构化报告：错位 / 样式 / 配色 / 拖拽是否跟随 /
排版空旷 / 背景单调。实现 agent 不得自验。
