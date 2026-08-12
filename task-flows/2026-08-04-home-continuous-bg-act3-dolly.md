# 2026-08-04 · 首页无级色带 + 第三幕推镜重构 + 四/五幕交接

规格来源：用户 grill-me 逐项确认（本文件「决策清单」即冻结规格，实现不得偏离）。
读过 DESIGN.md（§0 canvas 豁免、§Animate 闸门/infinite 裁决、`timeline.phase` 语义）。

---

## 决策清单（已冻结）

### D1 全站背景无级色带

- 载体：`<CineView>` 内一个 passthrough `<div className="home-ribbon">`（非 Scene 子元素，
  `ScrollSceneStack.tsx:26-29` 走 Fragment 分支原样渲染），`position:absolute; inset:0;
  height:4800vh; z-index:0`，随内容滚动。
- 结构 = 两层合成：
  - **长带层**（随滚动的 div）：8 锚色 `linear-gradient(180deg, …)`，色标用 **vh** 单位
    （单屏内可见上→下渐变），铺满 4800vh。
  - **静态明度层**（`position:fixed` 覆盖层，不随滚动）：固定上→下明暗 falloff
    → 每屏自带渐变且**结构上不可能有接缝**。
- 色相弧线：暖 → 冷谷 → 暖收束；**谷底压第三幕中段**；明度全程 L≈93–96%（克制振幅）。
- **任意前缀必须成立**：色带按最长情况（矮窗 ≈4770vh）铺，1440px 高屏上末段永不出现。
- `.home-scene` 的 `background` 全部清空为 transparent。
- `--scene-accent` / `--scene-accent-ink` 保持**台阶式**（不每帧插值），取值 = 该幕背景
  经过区间的中点色相，台阶落在幕边界。
- 零 JS、零每帧成本。不复活 `BackgroundRibbon`/`lut.ts`/`useScrollProgress`（每帧 setState）。

### D2 第四幕视频 blur 入场 + 尾部收束

- `duration.enter=4000` 同时是帧擦洗跨度 → blur 不能独占时间，必须用 `times` 压在同一轴上。
- 入场（轴前 12%）：`opacity 0→1` + `filter blur(N)→blur(0)` + `scale 1.04→1`（对焦浮现）。
- 收尾（轴尾 12%）：`opacity → 0.85` + `filter → 中等 blur`（虚化底片，交给第五幕黑幕吞掉）。
- 文字同刻收束：`demo-title` + 4 条 `demo-subtitle-line-*` 补 exit 编排，**逐行反向淡出**
  （末行先走），修掉 CLAUDE.md 规则 6 第四条违规（现状只有 enter，退场是打包回滚）。

### D3 第四/五幕交接（消除间隔）

- `cinema` scene `150vh → 100vh`（消掉 `.scene5-cinema__stage` top:50% 造成的上下各 25vh 空白）。
- 两个**独立** fixed 暗场层，各自唯一所有者（规则 2）：
  - 第四幕层：`opacity 0 → 0.45`（轴尾段，"灯光渐暗前半段"）
  - 第五幕层：`opacity 0 → 0.94`（progress 0→0.4；终点 0.94 而非 1，让暖底极微透出）
- ⚠️ **待实测**：fixed 在 scroll 场景内是否相对视口（祖先若有 transform/filter 会降级为
  absolute）。若降级 → 退回备选：保留 150vh、只改 `.scene5-cinema__stage` 的 top 让内容
  贴顶，尾部 50vh 作 overlay 余量。**必须实测后再定，不猜。**

### D4 第五幕标题（放映机字幕卡）

- 位置：手机上沿之上的空档；`phone-mockup` `max-height: 75vh → 68vh` 腾出稳定空档。
- 形态：`--font-display`（Fraunces）中等字号 + 开字距；入场 = 虚焦→实焦（blur + 轻微
  scale），与 D2 的对焦语汇同源。
- 常驻：两条**互质周期**独立 infinite lane（规则 6 第一条，禁 CSS infinite）：
  - `cinema-title-beam` ~7s：`background-clip:text` 渐变位置漂移（同 hero slogan
    `--hero-beam-row-*` 既有范式，`global.css:210-233`）
  - `cinema-title-shadow` ~4s：柔性投影脉冲
  - 互质周期 → 永不同相（同相呼吸正是 AI 味特征）
  - 两条均 `waitFor` 挂在标题 enter lane 之后（虚焦阶段不叠流光）
- 第五幕总预算 `1600 → 2200`；标题窗口 `phase {0.08, 0.38}`。

### D5 第五幕背景（星光 + 光锥）

- 图层：星光层在**暗场之上、手机之下**。
- 载体：CSS 多层 `radial-gradient`（星点位置写死，零运行时成本）+ 每层一条 infinite lane
  驱动该层 opacity 起伏，各层周期不同 → 观感是"部分星点忽明忽暗"。**零 canvas、零 rAF**。
- 设计元素：加**一道** CSS `clip-path` 梯形放映机光锥（静态或极缓漂移），复用 `/drag`
  `ProjectorBeam` 概念。不加齿孔、不加尘埃粒子。

### D6 第三幕全部重构（真推镜 dolly in）

- **拆除**：`CapabilityStageDrawerScene` 及其全部私有资产（`ChainTreePanelBody` /
  `StaggerPanelBody` / `PositionPanelBody` / `TypewriterCode` / `resolveTypedLines` /
  `panelDockRow` / `panelContentTimeline` / `STAGE_PANELS` / `TREE_NODE_DELAYS` /
  `TREE_WIRE_DELAYS` / `.stage-*` CSS / zh+en 的 `cap.shot2.*` 键）。
  `CapabilityFilmStripScene`（第二幕）不动。收口时全仓 grep 确认零残留。
- **运动 = 原位放大（v2 修订，用户纠正后的最终口径）**：
  ```
  initial: { scale: base, opacity: 1, filter: blur(0) }      ← 静息即全部可见，六块 base 各不相同
  animate: { scale: base → peak, opacity: 1→0, filter: →blur } ← 在原位放大到铺满，然后淡出
  x / y 恒为 0
  ```
  ⚠️ **v1（向外扩张）已被用户否掉**，此处保留对照以免再犯：v1 写
  `animate: { x: X0*K, y: Y0*K, scale: 2 }`，是「摄影机推近、边缘物体被推出画框」的物理。
  用户要的是另一件事 —— 原话：「理想中的样式就是一张图片，在原位逐渐放大，甚至占据了屏幕，
  然后淡出消失」。主体自身占据画面，而非被挤出画面，**不需要任何平移**。
  同一轮用户还纠正了两点：入场默认就有 6 个元素、大小不一地摆在那（v1 是
  `opacity:[0,1,1,0]` 隐藏后再出现）；块要有背景 panel、填充细节内容、加大高度。
- `peak` 由 `resolvePeakScale()` 反解，不是拍脑袋常数：取
  `max(到最远视口角所需缩放 × 0.82, 自身宽/高撑到视口 0.98 所需缩放)`。
  后一项（地板值）是实测补上的：只用前一项时 `max(needW,needH)*0.82` 只保证较紧那一轴，
  长宽比接近正方的块（stagger 372×288）另一轴会掉到视口以下，画面两侧漏底色。
- 数据仍只有每块一组 `x/y/base` + 盒尺寸，零运行时 layout 测量。
- **三段曲线**（`times [0, .30, .74, 1]`，全属性对齐同一进度轴）：
  `0–30%` 保持静息尺寸、清晰可读（读内容的时间）/ `30–100%` 原位放大到 peak +
  淡出 + 末段轻微失焦（推过焦平面）。
- **N=6**，接力点 `t≈0.62`（放大已明显、主体还没铺满，衔接不空）→ `DOLLY_MS=2000`、
  `DOLLY_STEP=1240`、`BLOCKS_END=8200`。
- **z 序**：panel 有实体底板，放大时会盖住其他块；正在放大的必须在最上层 →
  静态 `zIndex: 6 - index`（z-index 不在框架 10 属性白名单内，且无需动画）。
- **布局**：三列两排、纵向刻意错开（不读成规整网格），中心留白给收尾标题。
  ⚠️ 两条实测硬约束：① 左上角有常驻 chrome（REC 胶囊 y≈100–137 + `.cap-slate`
  top:92·cv-u）→ 静息态 y 安全区 ≥ 190，首版 chain 放 y=−256 直接盖住了它们；
  ② 设计画布 1440×900 按「认宽不认高」换算，窄高视口下画布高会超过视口
  （1280 宽 → 800 > 700）、底部被裁 → 底排 |y| ≤ 220。
- **块形态（v2 修订）**：用户要求「加入背景panel、填充细节内容、加大panel高度」→
  半透明暖白底板 + 1px 描边 + 双层阴影 + `backdrop-filter`，顶栏（图标/能力名/序号）
  + 主体示意图 + 代码脚三段式。内容用 `em` 跟随 panel 字号，放大时细节等比变清楚。
  仍**不做** mac 三圆点窗口栏（典型 AI 素材特征）。
- **无常驻动效**（推镜本身是运动；省 6 条 infinite lane）。
- **六块内容**（顺序 = 出场顺序 = 空间顺序，视线不跳）：
  1. `waitFor` 链式编排
  2. `stagger` 级联
  3. `Position` 单尺子定位
  4. `Container` 尺寸换算
  5. 自定义 Scrub 接管（`Scene.scroll` center-lock + `Animate timeline.phase`）
  6. `Image` 资源预加载
- **标签本地化 + API 代码英文**：`cap.shot3.card.*.label` 走 zh/en；代码片段两语言共用常量。
- **窄屏**：位置/尺寸走 `--cv-u` 天然等比，**不减块数**、不改时间轴（用户明确要求保留
  6 块）。字号见 D8 —— 原「只抬高字号下限」的做法窄屏下会撑破 panel，已改 clamp。
- **预算分配**：总 10000（`shot3-clock`，原 `stage-clock` 15000）。代码段 `0→0.72`，
  收尾 `0.72→1`。
- **收尾 = 中心显影**：标题 `blur-in + scale 0.92→1 + opacity`，副标题 `waitFor` 延迟显现；
  两者停留到本幕结束；**不用打字机**（避免与第一幕逐字、旧第三幕 typewriter 重复）。
- **文案**（用户定稿）：
  - zh 主标题：`时间随滚动流转，画面随叙事前行`
  - zh 副标题：`元素共享一条时间轴，登场、绽放、离场。`
  - en title：`Time flows with scroll, scenes move with the story`
  - en subtitle：`Every element shares one timeline — entering, blooming, and leaving.`
- `HomePage` 的 `cap-stage` scene 保持 100vh + center-lock，`zoneId` → `cap-shot3-zone`。

### D7 全场景单一背景（用户复述的红线，v2 追加）

用户带截图指出「场景3和4的分割这么明显」，并重申「我说过全场景都只有一个背景，不允许分割」。
根因不在 D1 的色带，而在**幕自己的不透明底色**：

- `.demo-video` 曾填 `var(--film-white)`（不透明 `#faf8f4`）铺满整个第四幕 →
  在第三/四幕边界切出一条硬缝。改 `transparent`。video 自身 `object-fit:cover` 铺满，
  不存在 letterbox，兜底色无必要。
- `.demo-video__scrim` 曾常驻满强度：它是 video 的兄弟节点、**不继承** video 的淡入，
  视频还没出来就把上下两端压成暖白 —— 第二条缝。改静息 `opacity:0` +
  新增 `demo-scrim` lane 跟随视频同步淡入/收尾。
- 验收判据 = 边界带逐行比色：单行最大色差 ≤ 6 视为渐变连续。

### D8 窄屏边界（用户常驻约束「边界问题、屏幕分辨率问题」，v3 追加）

来源：用户站规「一定要遵循框架的设计上进行开发……并且需要考虑边界问题，屏幕分辨率问题」。
本轮把第三幕从 1440×900 单点扩到 **10 档宽度**实测（390 / 430 / 480 / 540 / 600 / 768 /
900 / 1024 / 1440 / 1920），发现两件事 —— 一件是第三幕的真 bug，一件是全站架构事实。

**① （已修）px 字号下限撑破 panel。** panel 的 `width/height` 走 `--cv-u` 等比缩，
字号一旦被 px 下限钉死就**不再跟着缩** → 窄屏下字比盒子大，内容撑破 panel。
panel 是 `overflow:hidden`，表现为文字互相压叠、被裁掉半行（`chain` 三行压到 code 脚上）。
实测纵溢（内容高 − body 高，`scripts/act3-overflow-check.mjs`）：

| 宽度 | 下限/等比 | 撑破的块 |
| --- | --- | --- |
| 1024 / 900 / 768 / 600 / 540 | ≤1.51 | 无 |
| 480 | 1.70 | chain +7、scrub +2 |
| 430 | 1.89 | chain +36、scrub +12 |
| 390 | 2.09 | chain +46、container +4、scrub +18 |

修法 = **px 下限再被等比值的倍数上限夹住**，`clamp(fluid, 10px, fluid × 1.35)`：
宽屏走等比（1440→15px、1920→20px）、中屏走 px 下限（768/900→10px）、
窄屏走倍数上限（600→8.44px、390→5.48px）。倍数取 1.35 是因为 540 档的 1.51 已只剩
4px 余量。副作用：窄屏字确实更小 —— 但**同幕放大 ×5.4–6.7 时会放大到可读**，
而且全站其余部分本来就纯按 `--cv-u` 等比缩（唯一另一处 px 下限是 Scene5Cinema 的 19px），
故「下限」才是异常项，不是窄视口。顺带删掉 `@media (max-width:600px)` 的下限覆盖
（clamp 已收敛，media query 冗余）。`.act3-summary` 同样处理（`max-width` 也走 `--cv-u`，
只有 px 下限时窄屏折行暴增、撑出画布底）。

**② （不在本轮范围，全站架构事实）窄高视口下画布只占视口高的一部分。**
`config.size=1440` +「认宽不认高」⇒ `--cineview-unit = 视口宽/1440`，`HomeSceneCanvas`
声明 1440×900 ⇒ 画布实际 rect = `视口宽 × (900 × 视口宽/1440)`。故 390×844 上画布只有
**390×244**，占视口高 29%，其余 600px 是纯背景。实测五幕**全都如此**（第一幕 Hero、
第二幕胶片带同样只占顶部一条带），不是第三幕引入的，改它要动全站布局 + 重验五幕，
**超出本轮 D1–D6 范围**，记录待专项。

由此纠正探针一处**基准错误**：`act3-wheel-check.mjs` B 段原用**裸视口**判「铺满」，
在 390×844 上报 `~ 单向铺满`。但 `resolvePeakScale` 是按 1440×900 算的，块铺满画布时
高度天然只占视口 43% —— 用裸视口当基准会把架构事实报成第三幕的 bug。改为**按设计画布
rect 判定**，同时打印视口占比不掩盖差距。改后 390×844 六块全 `✓ 铺满画布`
（占视口 98–136% × 35–48%），1440×900 同为 `✓ 铺满画布`（占视口 98–136% × 121–165%）——
同一个画布铺满率，视口占比的差异纯来自宽高比。

---

## 执行节点

- [x] **N0 基线确认**：framework + site `type-check` 均 0 错误；`pnpm test` 有 **5 个
      预存在失败**（`sceneSync.motion-contract` ×4 + `temporalDragW0.contract` ×1），
      全部只读 `temporal-drag/SceneSync.tsx`（会话开始时 git status 已列为 M，非本轮引入）。
      已 grep 证实两个失败套件不读本轮任何文件。**本轮不修，属既有 PR 范围。**
- [x] **N1 fixed 降级实测**（结论已定，无需浏览器）：`ScrollSceneSlot.tsx:246-262` 对
      takeover scene **恒定**给 `data-cineview-takeover-content` 加 `transform:
      translateY(...)`；任何非 `none` 的 transform 都会成为 `position:fixed` 的包含块
      → **fixed 在 takeover 内必然降级**。但几何上无关紧要：scene 改 100vh 后 sticky 壳
      正好一个视口、钉在 top:0 且 `overflow:hidden`，`absolute inset:0` 即等价视口铺满。
      **D3/D5 全部改用 absolute，不用 fixed。**
- [x] **N2 D1 背景色带**（实现优于原计划：省掉一个 DOM 节点）：
      发现 scroll 容器内**没有内容包裹层**（scene wrapper 是直接子元素），原计划的
      `absolute; height:4800vh` passthrough div 会把 4800vh 计入可滚动溢出、凭空多出
      几十屏空白。改为**同一元素两层 background-image 靠 attachment 分工**：
      `fixed` 明度纱（视口锁定 → 每屏自带渐变且结构上不可能有接缝）+ `local` 色相长带
      （随内容滚动，9 锚色铺 4800vh）。零 JS、零每帧成本、零额外 DOM。
      实测：`attachment: fixed, local`、`size: 100% 100%, 100% 43200px`、
      屏内可见上→下渐变、全程色相 暖(253,245,240) → 冷(243,246,248) → 暖(244,236,230)。
- [x] **N3 D6 第三幕重构**：新增 `Act3DollyScene.tsx` + `.css`；`CapabilityScene.tsx`
      850→500 行（SHOT02 全量拆除）、`.css` 823→465 行；共享 `riseVariant`/`solidVariant`/
      `SplitTitle`/`renderIntroLines` 改为 export 供跨文件复用（不重复实现）。
      i18n 换为 `cap.shot3.*`（zh/en 各 9 键）。全仓 grep：`cap.shot2.*` / `stage-*` /
      `CapabilityStageDrawerScene` 在**活代码、测试、脚本中零残留**（仅历史 task-flow 文档提及）。
      ⚠️ **本节点首版的运动模型（向外扩张）被用户否掉，已由 N3b 重做**；当时的实测
      「六块全部向外推、|位移| 646→1171」证明的正是错的那件事 —— 探针断言了实现、
      没断言意图（memory `probe-must-assert-intent` 的又一例）。
- [x] **N3b D6 v2 原位放大（用户纠正后重做）**：`x/y` 恒 0、`opacity` 起点 1、
      `scale base→peak`（`resolvePeakScale` 反解 + 地板值）、六块加实体 panel 与细节内容。
      **真实滚轮**实测（`act3-wheel-check.mjs` 用 `page.mouse.wheel()`，回答用户
      「你真机测试过滑动吗？」——上一版探针直接赋值 `scrollTop`，绕过了 wheel 事件路径、
      防跳过钳 `resolveScrollIntentOffset`、center-lock 手势分支和 `isScrolling` 门控，
      「scrollTop 能跑」不等于「滚轮能跑」）：
      - 静息态 1440×900 / 1280×700 / 1920×1080 三档全绿：六块 opacity 1.00、
        6/6 不同位置、6/6 不同面积、0 对重叠、四边全在视口内。
      - 推进段：六块 ×5.4–×6.8 全部铺满视口，**扣掉整幕平移后位移恒 (0,0)**（原位 ✓）。
      - 收尾时序：`maxBlock` k=15 掉到 0.02 → k=16 title 0.83 → 副标题随后，无抢跑。
      过程中修掉两个真 bug：① 六块曾全叠在正中 —— `anchor:'center'` 下偏移必须走
      `at.x/at.y`（`Position.tsx:102` `calc(50% + offsetPx)`），`at.offsetX/offsetY` 是
      「相对上一个 Position」的语义、传了等于没传；② `peak` 只用 max 反解时近正方块
      单向铺满、两侧漏底色 → 补地板值。
      探针自身也修了三处假信号：读 lane transform 而非 panel 屏幕矩形（会把「全叠在正中」
      判成原位 ✓）、把整幕 sticky 平移误报成块漂移、静息态在 center-lock 就位前采样
      （把「幕没滚到位」误报成「块出界」）。
- [x] **N3c D7 第三/四幕硬缝**（用户带截图指出）：`.demo-video` 的不透明
      `var(--film-white)` 底 → `transparent`；`.demo-video__scrim` 常驻满强度 →
      静息 `opacity:0` + 新增 `demo-scrim` lane 跟随视频淡入/收尾。
      边界带逐行比色实测：单行最大色差 **6** → 无硬缝（三档视口一致）。
- [x] **N4 D2 第四幕视频 blur/收束 + 文字反向淡出**：`times` 压在同一 4000ms 轴上
      （入场前 12%、收尾后 12%），不挤占帧擦洗。标题新增 `demo-title-out` lane
      （640ms 入场轴不能改——其他 lane 靠 waitFor 挂在它后面），四行副标题反向淡出
      （末行 0.86 起、首行最后），标题 0.95 最后走 → 由内向外收束。
- [x] **N5 D3 四/五幕交接**：`cinema` 150vh→100vh。实测交界 13 个采样点
      `demo% + cinema%` 恒 ≈100，**无空白帧**（原 25vh×2 死白已消除）。
      overlay 终点 0.94 实测命中（非纯黑）。
- [x] **N6 D4 第五幕标题**：Fraunces 实测生效、位于手机上沿之上（title 底 148 ≤ phone 顶 187）、
      阴影脉冲实测在跑（10px/0.18 静息 → 实测 24.8px/0.46）。预算 1600→2200、窗口 0.08–0.38。
- [x] **N7 D5 星光 + 光锥**：三层 `radial-gradient` + 每层一条 infinite lane，零 canvas/rAF。
      **踩坑并修正**：infinite lane **不能驱动 opacity** —— `useAnimateScroll` 恒定返回含
      `opacity/x/y/scale/filter` 的 MotionValue `style`，`Animate` 用
      `style={scrollResult.style}` 绑定，framer 中 style 上的 MotionValue 优先级高于
      `controls.start()`，实测 opacity 永远停在 1。改为 lane 写 `--twinkle`、CSS 用
      `calc()` 映射到各层 lo→hi 区间（与 PhoneMockup 的 `--glow-pulse` 同范式）。
      实测三层 0.706→0.283 / 0.720→0.743 / 0.332→0.590，同刻取值 0.28/0.74/0.59 **不同相**。
- [x] **N8 收口自检**：framework + site `type-check` 0 错误；`lint` 0 错误 0 警告；
      `prettier` 已格式化；site `build` 通过（CSS 71.31 kB / gzip 14.48 kB）。
      `pnpm test` 1501/1506 通过，5 个失败为 N0 记录的预存在失败。
      CLAUDE.md 四条自检：
      1. **整改真完成**：无 TODO 占位、无注释掉的旧逻辑；六块推镜/背景色带/交接/标题/星光
         全部在真机采样验证行为符合意图（非仅测试变绿）。星光那处「绿了但实际没动」被
         探针抓到并修掉（见 N7），正是本条的意义。
      2. **无冗余**：净减 ~700 行（CapabilityScene .tsx −350 / .css −358）；
         `panelEnterVariant`/`panelDockRow` 等死代码删净；共享变体改 export 而非复制；
         全仓 grep 确认旧键零残留。
      3. **结构可控**：850 行巨石拆成 500（第二幕）+ ~360（第三幕新文件，含六块示意图
         子组件与详注）；第三幕布局数据只有每块一组 x/y/base + 盒尺寸，`peak` 由纯函数
         反解，零运行时 layout 测量。
      4. **每帧热路径代价**：背景色带零 JS（纯 CSS 两层背景）；第三幕六块无常驻动效
         （省 6 条 infinite lane），全部走 Animate lane 的 MotionValue 单输入映射；
         星光零 canvas/rAF，只有 3 条 infinite lane 写 CSS 变量。
         ⚠️ **但每帧实测仍归 N9**：第三幕 6 块并发 4 属性 scrub（含 filter）+ 第五幕
         iframe 满载（clapperboard/aperture/waveform canvas）的掉帧/长任务，
         性能回归单测发现不了，必须真机 Profiler。
- [x] **N8b D8 窄屏边界十档实测**（用户常驻约束「边界问题、屏幕分辨率问题」）：
      从 1440×900 单点扩到 390/430/480/540/600/768/900/1024/1440/1920 十档。
      - **修掉一个真 bug**：`--a3-fs` 的 px 下限不跟盒子缩 → ≤480 宽撑破 panel
        （390 宽 chain 纵溢 +46px，文字压叠+裁行）。改 `clamp(fluid, 10px, fluid×1.35)`，
        十档全部 `✓`；顺带删掉已冗余的 `@media (max-width:600px)` 下限覆盖。
        `.act3-summary` 同因同修。详见 D8 ①。
      - **修掉一个探针 bug**：`act3-wheel-check.mjs` 写死 `page.mouse.move(720,450)`，
        在 390 宽视口是**视口外** → wheel 不派发到滚动容器，全程 `scrollTop=0`。
        而 `wheelToLocked` 的「幕不再平移」判据在幕从没动过时**天然成立** → 打出
        `center-lock 就位 ✓` 后接一串 `cy≈12900` 的文档坐标，读起来像「六块全被切」的
        站点 bug。修：指针改视口中心 + `wheelTo` 连续 40 notch `scrollTop` 不动即抛错
        （不再静默转完 6000 圈；这也是那次 >600s 超时的真因）。
      - **纠正探针一处基准错误**：B 段「铺满」原以裸视口为基准，窄高视口下必然
        `~ 单向铺满`。改按设计画布 rect 判定 + 附打视口占比（详见 D8 ②）。
      - 改后 390×844 全绿：`center-lock ✓`、六块 `opacity 1.00`、6/6 异位、6/6 异面积、
        0 对重叠、四边全在视口内；推进 ×5.4–6.7 全部 `✓ 铺满画布`、
        `扣掉整幕平移后 (0,0) 原位`；三/四幕接缝单行最大色差 6；console 零错误。
        1440×900 复跑无回归（同上，占视口 121–165%）。
      - ⚠️ **记录待专项（不在本轮范围）**：窄高视口下 `HomeSceneCanvas` 1440×900 只占
        视口高 29%（390×844 → 画布 390×244），其余是纯背景。实测**五幕全都如此**，
        非第三幕引入；改它要动全站布局 + 重验五幕。见 D8 ②。
- [x] **N8c 重建 dist（N9 前置）+ 发现 UMD 体积门已破**：
      `site` 经 `link:../` 消费 `dist`（memory `site-consumes-dist-not-src`），而 `dist`
      是 8月2 的产物、本分支的 framework src 已改（`animateInterpolation.ts` /
      `useAnimateDrag.ts` / `useAnimateScroll.ts` / `videoPlaybackOwnership.ts`）→
      **此前所有浏览器验证都跑在旧框架上**。已 `pnpm build` 重建。
      ⚠️ 注：我上一轮判定「dist 比 src 新，无需重建」是**错的** —— 我拿
      `find src -newer dist/index.js` 比对，而 `dist/index.js` 并不存在（实际是
      `dist/cineview.es.mjs` / `dist/cineview.umd.js`），`find` 对不存在的基准不报错、
      直接返回空，看起来就像「没有更新的文件」。比对 mtime 前先确认基准文件真的存在。
      - **重建后 `build:verify` 12/12 项全过但整体判失败**：UMD gzip **50.19 KB**
        超 50 KB 门（`scripts/verify-build.js:20` `MAX_BUNDLE_SIZE_KB`）。
      - **溯源**：`git stash push -- src/` 后用 HEAD 版重建 = **49.94 KB**（差 0.06 KB
        贴线通过）。故本分支 framework 改动净增 ~0.25 KB 越线。
      - **不是本轮引入**：本轮我只改 site CSS + 探针（`Act3DollyScene.css` /
        `CapabilityScene.css` / `Act3DollyScene.tsx` / `scripts/*`），零 framework src。
        越线来自本 PR 中先于本任务的 framework 改动。
      - ⚠️ **待处理（超出本轮 D1–D6 范围）**：属发布阻断门，须由改那四个文件的一方决定
        （压缩、拆 chunk、或复核 50 KB 门是否仍合理）。`pnpm build` 本身成功、dist 可用，
        故不阻塞 N9 真机验收。
- [x] **N8d 产物集改动后的站点自查**（浏览器，非 Node SSR）：本轮把产物集从 5 个改成
      4 个、`cineview.umd.js` 从「仅拖拽」换回「全量派发」。`build:verify` 14/14 与四种
      CJS/ESM 消费路径此前都实测过，但那是 **Node 里的 SSR 渲染**；`site` 经 `link:../`
      消费 `dist`，浏览器路径未验。已重建 dist（基准文件 `dist/cineview.es.mjs` 确认存在
      后再比 mtime —— N8c 那次 `find -newer` 拿不存在的基准静默返回空，教训见 N8c）+
      清 `node_modules/.vite` 依赖缓存 + 重启 dev server。
      探针 `site/scripts/n8d-selfcheck.mjs`（四断言：A 实际加载的产物 / B 错模式抛错
      不得触发 / C 零 console 错误 / D 五幕布局根与 drag 首幕几何）。
      - **结论：1440×900 / 1920×1080 / 390×844 三档 8/8 全绿。** 浏览器实际加载
        `dist/cineview.es.mjs` —— 正是本轮**未改**的那个产物；零 UMD / 单引擎产物被
        请求（`exports` 的子路径只有 `require` 条件，bundler 路径不受影响，这条现在
        有实测而非推断）。两条路由 console/pageerror 均为 0。
      - **断言可红性已验**（否则探针只是装饰）：A 的判据对四个产物名逐一试过
        （es 不flag、三个 umd 全flag）；D 在首版就真的报红过一次 —— 见下条。
      - ⚠️ **修掉一处探针假信号（第 7 类）**：首版 D 断言要求五幕**都**有
        `.home-scene-canvas`，于是把第五幕报成「画布 rect 为 0」。实为**设计如此** ——
        `HomePage.tsx:127` 的注释写明第五幕不走 `HomeSceneCanvas`（overlay 需盖满整个
        场景、手机以视口带为基准居中），其布局根是 `.scene5-cinema`。已改为按幕取各自
        的布局根。**旧探针 `act3-canvas-check.mjs` 至今打着 `画布 none`**，那行同样是
        假信号，不是站点缺陷。（memory `probe-must-assert-intent`：断言实现会全绿，
        断言错了的规格会假红。）
      - ⚠️ **纠正 CLAUDE.md 的端口记载**：站点 canonical 端口是 **4000**
        （`site/vite.config.ts:12`），CLAUDE.md 与本文件此前写的 `localhost:3000` 是
        过期信息。本次自查跑在 4008，因 4000–4007 被 7月23–29 的 8 个陈旧 dev server
        占着（同项目 Vite 进程；清理需你授权，我未擅自 kill）。
      - **不覆盖帧性能**：仍归 N9。本探针只回答「构建改动有没有弄坏站点」。
- [x] **N9 独立 agent 真机验收**（CLAUDE.md 规则 4；由独立 agent 完成，实现者未自收）：
      桌面端首页 scroll，`localhost:4008`（4000–4007 被陈旧进程占用）。
      **判定：有条件 PASS。** 功能正确性 60/60（1440×900 与 1920×1080 各 30 条，
      dev + 生产构建各一遍）；第一至第四幕帧性能全绿；console/pageerror 全程 0。
      - **第三幕不是瓶颈**（推翻本文件风险清单第 2 条的判断）：1160 帧慢扫、
        notch=300 flick、峰值驻留、峰值往复 scrub 四种压法**零帧 >32ms**。
        并发度扫描 51 点显示同时放大的块最多 2 个（接力点 t≈0.62 与 scale 前 30%
        静息使相邻窗口几乎不重叠）。`backdrop-filter` 确认 6/6 生效，关掉无实质差异。
        ⚠️ 该检测器判据是 `scale > base×1.02`，hold 段的块测不到，故「2 块」是
        **可见放大重叠数**而非活跃 lane 数（六条 lane 始终挂载并每帧被驱动）。
      - **真正的瓶颈是第五幕，且与 iframe 无关**：三态归因（1920×1080）
        无 iframe 48.3 / iframe 壳态 46.5 / canvas 全速 46.3 fps —— iframe 与
        canvas 只是边际成本。风险清单第 2 条把嫌疑指向「iframe 内 canvas 满载」，
        方向错了。
      - **验收 agent 自己修掉 4 处探针假信号**（第 8–11 类，已并入下方清单）：
        `longtask` observer 抓不到 rAF 内的工作（注入 220ms 忙等：rAF 报 199.9、
        LoAF 报 240、longtask 只报 83）⇒ 改以 LoAF 为主证据；CDP `PipelineReporter`
        的 state 在 `args.frame_reporter.state` 而非 `args.state`，读错会打出
        「呈现帧 0 / 丢帧 0」的假绿；`snap()` 构建了 `blocks` 却忘 `return`，
        消费侧 `?? {}` 兜底成空集，而「不重叠 0 对」「最小 opacity Infinity」
        在空集上天然为真；CDP 丢帧率整体弃用（第一幕纯静态对照即报 29.2%，
        本机假阳性底噪太高）。
      - **残余风险（未解释）**：第一轮出现过一次 533ms 长帧，7 次尝试仅 1 次复现。
        3 轮真冷启动（隔离 dev server + 空 cacheDir）确有 255/314/1234ms 长帧，
        但全部落在加载/首屏阶段（scrollTop 0，用户尚未开始滚），同轮 cinema 幕
        rAF max 仅 33ms。故**不是**已确认的 dev 工件，也**不是**已确认的滚动路径缺陷。
      - 未验到：真实人手输入（全用 CDP 合成滚轮）、iframe 内实际拖拽、手机视口、
        其他浏览器、iOS Safari 的 `background-attachment: fixed`（风险 5）。
      - 探针 `site/scripts/n9-*.mjs`（15 支）+ 证据 `site/scripts/n9-shots/`（35 PNG
        + 11 JSON）。验收 agent 全程未改产品代码；其生产构建改写了 `site/dist/`，
        该目录被 `site/.gitignore:3` 排除，不会进提交。
- [ ] **N9a 第五幕星光掉帧（P1，需你定修法）**：见下方「第五幕星光」专节。
- [ ] **N10 每节点末尾**：FRESH 子 agent 对抗式复审返回显式 PASS
      （memory `node-gate-adversarial-subagent`）。

---

## 第五幕星光掉帧（N9 发现的 P1，修法待定）

**位置**：`site/src/components/Scene5Cinema.css:54`
```css
opacity: calc(var(--star-lo) + (var(--star-hi) - var(--star-lo)) * var(--twinkle, 0));
```

**机制**：三层 `.scene5-cinema__star-layer` 各铺满视口（`inset:0`），共 19 个
`radial-gradient`（far 8 / mid 6 / near 5）。`--twinkle` 由三条 infinite lane 每帧改写
（周期 3.7/5.3/8.1s 错相），opacity 是 `calc()` 的结果 ⇒ 每帧样式重算 + 该层 gradient
全屏重新光栅化，三层叠加 = 每帧三次全屏重绘。成本**不进 JS 时间**（LoAF 的 JS 恒 0ms），
只体现为帧间隔拉长 —— 正是 CLAUDE.md「每帧热路径」那类回归，单测发现不了。

为什么 opacity 走 CSS 变量而非 lane 直驱：opacity 属框架 10 个白名单属性，`Animate` 恒把
它作为 MotionValue 绑在 style 上，优先级高于 `controls.start()`，infinite 写不进去
（memory `infinite-lane-cannot-drive-whitelist-props`，`Scene5Cinema.tsx:128` 有注释）。

**不是本轮引入**：`Scene5Cinema.css` 至今**未被 git 跟踪**（`?? ` 状态），即第五幕从未提交。
故这是「首次发布前发现的潜在缺陷」，不是回归。

**候选修法实测**（`site/scripts/n9x-starfix.mjs`，同一进度点静止驻留 6000ms/候选，
每候选只改一个变量，跑两遍基线确认可重复；判据 rAF 帧间隔，`n9-selftest` 自证可红）：

两档各跑两轮基线（A / A'）确认可重复；`>32ms` 为 6000ms 驻留内的超标帧数。

| 候选 | 1920×1080 >32ms / fps | 2560×1440 >32ms / fps | 观感代价 |
| --- | --- | --- | --- |
| A 原样（基线） | 74–88 → 49–59 / 45.3–52 | **157–161 / 30.3–31**（串 74 帧） | — |
| B `will-change:opacity` | 0–2 / 59.8–60.2 | 6 / 59.2 | 无；但常驻 will-change 是反模式 |
| C 父层单点 opacity | **0 / 60.2** | 0–1 / 60 | **三层不再错相呼吸，星空整体同相** |
| D 层数 3→1（仍每帧改） | 0 / 60.2 | 34–36 / 54.1 | 星点密度降至 1/3 |
| E 冻结 opacity（对照） | 0 / 60.2 | 2–3 / 59.8 | 星星不闪，非可用修法 |
| **F 三层各提合成层** `translateZ(0)` | **0 / 60.2**（max 17.8） | **0 / 60.2**（max 17.7） | **无** |
| G F + `will-change` | 0 / 60.2 | 0 / 60.2 | 无；比 F 多一个反模式属性 |

**读法**：
- D 证明主因是**层数 × 全屏重绘面积**，不是「每帧改 opacity」本身 —— 3→1 就把 1920 档
  修好了，但 2560 档仍剩 34。
- **F 是推荐修法**：两档全绿、max 17.8ms、**且保住 3.7/5.3/8.1s 错相呼吸**（D5 星场的
  设计意图不受损）。机制：`translateZ(0)` 让每层成为独立合成层，opacity 变化交由合成器，
  不再触发 gradient 全屏重新光栅化。一行 CSS，无观感代价。
- G 与 F 同分 ⇒ `will-change` 是多余的，F 已足够。按「不加无收益的反模式属性」取 F。
- C 也能全绿，但要牺牲错相；既然 F 无代价，C 不必采。
- B（N9 原候选）在 2560×1440 仍剩 6 帧 —— 是缓解不是根治，F 严格优于它。

**F 的代价（需知情）**：三个全屏合成层常驻 GPU 显存，2560×1440 下约
`2560×1440×4B×3 ≈ 44 MB`。桌面端可接受；**手机端未验**（本次范围排除手机），
若采纳需补一轮手机视口实测再收口。

**修法（一行）**：`site/src/components/Scene5Cinema.css` 的 `.scene5-cinema__star-layer`
加 `transform: translateZ(0);`（`backface-visibility: hidden` 在本次实测中非必需，
F 已单独达标）。**我未擅自改** —— 它属第五幕规格作者的决定，且改后需重验手机视口。
- [ ] **N10 每节点末尾**：FRESH 子 agent 对抗式复审返回显式 PASS
      （memory `node-gate-adversarial-subagent`）。

---

## 探针工具

四支都在 `site/scripts/`，供 N9 验收 agent 直接用。⚠️ `site/.gitignore:24` 把整个
`scripts/` 目录排除（约定：该目录下全是一次性探针），故这四支**只存在于当前工作副本**，
新克隆拿不到 —— N9 agent 若在别处跑，需从本副本取或按本节描述重写。前三支都支持视口覆盖参数 —— 色带长度是
`4800vh`、随视口高变，而文档总高由动画预算（1ms=1px）决定、几乎与视口高无关，
所以「色带被用到的前缀比例」逐档不同，必须多档实测。

**`act3-bg-probe.mjs`** — `node scripts/act3-bg-probe.mjs <url> [width] [height]`
采样 D1 色带两层 + 逐屏取色 / D6 六块位移+scale+收尾时序 / D3 交界空白帧 /
D4-D5 标题几何+字体+阴影+星光三层同相检查。

**`act3-wheel-check.mjs`** — `node scripts/act3-wheel-check.mjs <url> [outDir] [width] [height]`
**用 `page.mouse.wheel()` 真实滚轮驱动**（不是写 `scrollTop`）。A 静息态四断言 +
B 推进段铺满/原位 + C 第三/四幕接缝逐行比色，并输出截图。指针自动落**当前视口中心**
（写死坐标在窄视口是视口外，wheel 不派发 → 全程 `scrollTop=0`，见下方假信号 5）。

**`act3-overflow-check.mjs`** — `node scripts/act3-overflow-check.mjs <url> <width> <height>`
逐块量 **panel 内容 vs panel 盒子**：`纵溢 = 内容高 − body 高`、`横溢`、`盒溢`。
专抓「字号有 px 下限、盒子按 `--cv-u` 等比缩」导致的内容撑破（D8 ①）。
几何探针看不见这类 bug —— 六块位置/面积/不重叠可以全绿，而每块内部文字已经压叠成一团。

共同纪律（memory `scroll-zone-probe-technique`）：小步穿段绕防跳过钳、读框架包装层
`[data-cineview-animate-id]`、首页禁 networkidle。

⚠️ 探针写错比没写更危险 —— 本轮被抓到的六类假信号，改动前务必读注释：
1. 星光必须读**星层 div** 的 computed opacity（lane 包装元素恒为 1）。
2. 散落必须读 panel 的**屏幕矩形**，不是 lane 的 transform —— 散落是 Position 用
   `left/top` 实现的，不进 transform，只看 `translate==0` 会把「六块全叠在正中」
   判成「原位放大 ✓」。
3. 放大过程中必须扣掉**整幕 sticky 壳的平移**，否则六块齐刷刷报 60/100px「漂移」。
4. 静息态必须等 center-lock **就位后**再采样，否则「幕还没滚到位」会被误报成「块出界」；
   且就位判据要用「幕不再平移」而非「幕中心==视口中心」——窄高视口下设计画布比视口高，
   中心永远对不上。
5. 指针必须落**当前视口**内。写死 `mouse.move(720,450)` 在 390 宽视口是视口外 →
   wheel 不派发、`scrollTop` 恒 0，而「幕不再平移」判据在幕从没动过时天然成立 →
   打出 `center-lock ✓` + 一串文档坐标，像「六块全被切」。凡靠真实输入驱动的探针，
   都要有「输入完全没生效」的**抛错**分支，不能静默转圈。
6. 「铺满」的基准是**设计画布 rect**，不是裸视口。peak scale 按 1440×900 反解，
   窄高视口下画布本就比视口矮，用裸视口当基准会把架构事实报成幕的 bug（D8 ②）。
7. **第五幕没有 `.home-scene-canvas`，这是设计而非缺陷**（N8d 抓到）。`HomePage.tsx:127`
   的注释写明：Scene5 不走 `HomeSceneCanvas`，因为 overlay 需盖满整个场景、手机以视口带
   为基准居中，其布局根是 `.scene5-cinema`（`Scene5Cinema.tsx:256`）。凡「逐幕找同一个
   子选择器」的探针都会在这一幕拿到 `none`/`0x0` —— 旧探针 `act3-canvas-check.mjs` 至今
   打着 `画布 none`，那行是假信号。正确写法：每幕的布局根按 `.home-scene-canvas` →
   `.scene5-cinema` 顺序回退（见 `n8d-selfcheck.mjs`）。
（均属 memory `probe-must-assert-intent`：断言实现会全绿，必须断言规格的原话。）

---

## 风险 / 待验证

1. ~~**fixed 降级**~~ → N1 已定论：takeover 内 fixed 必然降级，D3/D5 全用 absolute。
2. **每帧代价**：第三幕 6 块 × 4 属性 scrub 并发；第五幕星光多层 infinite lane +
   iframe 内 canvas（clapperboard/aperture/waveform）满载。性能回归单测发现不了 → N9 真机。
3. ~~**色带前缀截断**~~ → 已在 **1920×1080 / 1920×700 / 1440×900** 三档逐屏取色实测：
   色带长度分别 51840 / 33600 / 43200 px，文档高 33400 / 31500 / 32500 px（前缀比例
   64% / 94% / 75%），三档都是「暖起 → 冷谷压第三幕 → 暖收 → 第五幕暗场」，
   无硬跳变、无末段缺失。注：700 高那档在 @7108–11846 的屏底取到 (182,123,85) 一类暖橙，
   是第二幕胶片格自身的色块入画，不是色带断层。
4. ~~**`cap.shot2.*` 残留**~~ → 已 grep 确认活代码/测试/脚本零残留。
5. **iOS Safari `background-attachment: fixed`**（新增）：明度纱层依赖它。
   该属性在 iOS Safari 历史上有实现缺陷。若真机异常 → 退回
   `.cineview-container::before` 承载 `position:fixed` 纱（::before 在树序最前，
   scene wrapper 会正常绘制其上）。已写进 `global.css` 注释。
6. **预存在的 5 个测试失败**（`SceneSync` / `temporalDragW0`）：不属本轮范围，
   但收口前应确认是否为本 PR 其他改动的遗留。
