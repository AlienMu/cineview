# Scroll 首页五幕 · 样式/动画细节微调审计清单（2026-08-14）

> 只读审计，逐点位引用 file:line。权力边界：不改排版（布局/栅格/字号档位）、不改场景规划（元素增删/编排拓扑/相位窗）；只动颜色质感与动画细节（easing/stagger/duration±20%/位移量/opacity 曲线）。
> 前提（用户 2026-08-14 裁决）：首屏 LUT[0] 即将回奶白桃 `#fcede4/#faf8f4`，审计配色建议以此为前提，不建议改 LUT 本身。
> 通用硬约束（每项默认核对，不逐条重复）：`scrolling-ribbon-makes-tint-visible`（全屏表面必须中性或渐变派生）、`css-var-opacity-repaints-fullscreen`、`zindex-dead-under-transform-ancestor`、CLAUDE.md 规则 6（常驻循环走 infiniteAnimation）。

---

## act1 hero（HomeSceneCanvas + HeroScene）

### 点位 1: 按钮 hover 光晕色写死暖琥珀，首屏回暖桃后与 accent 脱钩
- 现状: `site/src/design/global.css:377-379`（`.btn--primary:hover`）、`:388-390`（`.btn--ghost:hover`）、`:343-344`（基态双层零阴影）—— 全部写死 `rgba(201,138,106,…)`；同色值还出现在 `.lang-toggle:hover`（`:149-150`）。
- 改法: 光晕色改用 `color-mix(in srgb, var(--accent) N%, transparent)`（N 按现有 alpha 等效换算：0.22→22% 等）。`--accent` 由 BackgroundRibbon 随滚动写入（`BackgroundRibbon.tsx:57-60`），hover 光晕即随镜头流动，与投影「中性墨」不冲突（光晕是强调件不是投影）。
- 风险: 光晕仅在 hover 时出现，非每帧路径，无性能代价；color-mix 浏览器支持同 `--a3-plate` 已用值（`Act3DollyScene.css:74-76`），无新兼容面。
- 中英差异: 无（纯装饰层，两语同一按钮组）。
- 历史裁决: 与 2026-08-14「面板配色根据渐变来」同向（初版 f164470 的写死色值是「无 accent 流动」时代的残留）；不与「中性墨投影」裁决冲突（该裁决对象是 drop shadow，不是 glow）。
- 边界: [绿]

### 点位 2: intro 逐字揭示的 per-char 位移 `y: '15%'` 对 CJK 与拉丁视觉权重不同
- 现状: `site/src/components/HeroScene.tsx:78`（`introCharVariant`，`initial: { opacity: 0, y: '15%' }`），`CHAR_INTERVAL=32`（:57）、`CHAR_DUR=460`（:58）。
- 改法: 仅微调，不动拓扑。zh 的「，。」在 reveal 瞬间随 `y` 浮动，基线跳动比拉丁明显（CJK 标点居中占位、拉丁标点沉在基线上）；把 zh 下的振幅压到 10%、en 保持 15%（`data-lang` 已在 `.hero__intro` 上，`global.css:244`）。实现为 `introCharVariant(reduced, lang)` 读取 `lang`。
- 风险: 振幅改动在 duration±20%/位移量权限内；不动 stagger 间隔与 waitFor 链。
- 中英差异: zh「滚动是胶片，拖拽是分镜。」含两个 CJK 标点，浮动感最强；en「Scroll becomes film, drag becomes frame.」标点贴基线，15% 读起来恰是精致。
- 历史裁决: 无冲突（首屏入场链 waitFor 结构不动；memory「Smoothing layer masks scrub value」不涉本 lane）。
- 边界: [绿]

### 点位 3: scroll hint 常驻动效的位移/透明度摆幅
- 现状: `site/src/components/HeroScene.tsx:303-305`（`y: [0, 6, 0], opacity: [0.5, 1, 0.5]`，duration 2s）。
- 改法: opacity 谷底 0.5 → 0.65（hint 是功能指示不是氛围件，0.5 在奶白桃首屏底色上对比度约 2.1:1，谷底瞬间接近不可读）；位移 6px 保持。纯数值微调。
- 风险: 无；infiniteAnimation 由 phase 门控（合规）。
- 中英差异: zh「向下滚动,胶片开始走动」12 字、en「Scroll down — the film starts rolling」35 字符——en 行长约为 zh 的 2.4 倍，letter-spacing 0.16em（`global.css:397`）在 en 上是报纸小标题感，在 zh 上是 CJK 灾难边缘（0.16em × 全角字 = 字间加 0.16 字宽）；建议 zh 下压到 0.10em（`[data-lang]` 覆写），en 保持。
- 历史裁决: 无冲突；hint 样式自 2026-06-30 站点初版以来未改过。
- 边界: [绿]

### 点位 4: `.hero__title` 的 `letter-spacing: 0.3em` + `text-transform: uppercase` 对两语实际效果不对称
- 现状: `global.css:221-232`（mono、0.3em、uppercase、`padding-left: 0.3em` 补偿尾字空白）。
- 改法: 文案两语同为拉丁 'CineView'（`zh.ts:14` / `en.ts:13`），uppercase 两语同效、无差异项。仅指出：`padding-left: 0.3em` 的补偿在 zh 字体栈（PingFang fallback 时）下 letter-spacing 渲染与 Roboto Mono 度量不同，补偿值 0.3em 是按「每字后加 0.3em 含末字」的正确写法，无需改。**本点位结论：无改动建议，仅记录核对。**
- 边界: [绿]（零改动核对项）

---

## act2 capability film strip（CapabilityScene / CapabilityFilmStripScene）

### 点位 1: `.bg-grid` 点阵用 `--frame-line`（暖灰 #e4dfd6）+ opacity 0.5，回暖桃底上偏「脏」
- 现状: `site/src/components/CapabilityScene.css:35-46`（radial-gradient `var(--frame-line)` 1px 点、32px 栅格、`opacity: 0.5`）。
- 改法: 点色改为中性墨底 `rgba(26,24,20,0.10)` 直接写死（不再经 `--frame-line` × 0.5 opacity 的两步衰减，视觉等效但色彩中性）。暖灰点压在暖桃渐变上会产生局部「暖+暖」的浊斑（同 `scrolling-ribbon-makes-tint-visible` 机制：固定暖面 vs 流动暖底）；中性墨点在任何 LUT 段都读作「变暗的网点」。
- 风险: 点阵是全屏静态背景层，opacity 0.5→等效 alpha 直写后仍是静态值，不进每帧路径；仅本幕使用（act3 复用 `.capability-full` 但 `.bg-grid` 只在 act2 挂载，见 `CapabilityScene.tsx:358` vs `Act3DollyScene.tsx:508`——act3 未挂 `.bg-grid`，改动只影响 act2）。
- 中英差异: 无。
- 历史裁决: 与 act3/act4 的「中性墨投影」裁决（`CapabilityScene.css:404-410` 注释）同机制同方向；2026-08-14「面板配色根据渐变来」不涉网点层。
- 边界: [绿]

### 点位 2: 齿孔条流光色 `rgba(232,190,165,0.85)` 写死，与 LUT 谷段色温有漂
- 现状: `CapabilityScene.css:228-233`（`--film-flow` 定位的流光层）+ `:234`（基底 `#c98a6a → #b0764f` 写死渐变）。
- 改法: 流光色改 `color-mix(in srgb, var(--accent) 55%, white)` 类派生（视觉等效现有 #e8bea5 邻域），基底渐变两端改 `var(--accent)` / `color-mix(in srgb, var(--accent), black 14%)`——齿孔条是「胶片」签名件，accent 家族色让它在 12%→40% LUT 行程内始终与镜头色同族（现状写死色在琥珀金段吻合、在陶土橙段偏粉）。`--film-flow` 定位机制不动。
- 风险: `--film-flow` 每帧改 background-position 是既有机制（不新增每帧成本）；color-mix 在渐变停靠里是静态求值（accent 变时由 BackgroundRibbon 的滚动写入驱动，~每 60-100px 一次量化去重，见 `BackgroundRibbon.tsx:28`），非每帧。
- 中英差异: 无。
- 历史裁决: 与 2026-08-14 用户裁决「面板配色是根据渐变来的」同向延伸；需核对：齿孔基底色 2026-07-09 v3 重做时定「暖陶土基边不再深黑」（`CapabilityScene.css:214-215` 注释）——改为 accent 派生仍是暖陶土族，不反转该裁决。
- 边界: [绿]

### 点位 3: caption 切换变体的 blur 量 `blur(0.833vw)` 与 scale 0.98 的读感
- 现状: `CapabilityScene.tsx:175`（`blur = 'blur(0.833333vw)'`）、`:199-202`（scale 0.98）。
- 改法: blur 0.833vw → 0.55vw（12px→8px @1440）。现状谷底 opacity 0 + 12px 虚焦 + 420ms 窗口（`SELECTION_FADE_MS`，:152）在慢速滚动下读作「失焦融化」，与整幕「定格逐帧」的机械语汇不符；8px 保持「换帧闪一下」的打孔感。scale 0.98 保持（位移量已克制）。
- 风险: 触及的是既有变体数值，不动 times 结构、不动 420ms 窗口（那是 2026-08-10 C4 防闪裁决值）；blur 缩小对合成成本只降不升。
- 中英差异: caption 的 zh 标题（如「淡入登场」4 字）比 en（'Fade into view' 13 字符）短得多，blur 谷底的「糊团」面积 zh 更小——缩小 blur 对 en 的可读性改善更明显，对 zh 是精致度改善。两语同改无风险。
- 历史裁决: 2026-08-12 末帧不淡出裁决（`CapabilityScene.tsx:162-167` 注释）只涉锚点结构，不涉 blur 深度；不冲突。
- 边界: [绿]

### 点位 4: codecard 三圆点第二颗 `#dcab6e` 在琥珀段与窗口条 tint 撞色
- 现状: `CapabilityScene.css:466-474`（dots: `#d98a6a` / `#dcab6e` / `#b0764f` 写死；bar 背景 `rgba(201,138,106,0.1)`）。
- 改法: 三颗点改 accent 派生：`var(--accent)` / `color-mix(in srgb, var(--accent), white 18%)` / `color-mix(in srgb, var(--accent), black 12%)`——保持「橙-浅金-棕」的 mac 交通灯隐喻排序，但随镜头流动。
- 风险: 极小（11px 装饰点）。
- 中英差异: 无。
- 历史裁决: 2026-08-13 对抗复审把三圆点列为「装饰写死、不应跟随」（`site/review/20260813-adv/site-review.md` A3）——**该裁决语境是「不应逐帧跟随」；本项不是逐帧跟随，是 accent 变量静态派生**（与 `--a3-plate` 同一机制，变量由 ribbon 量化写入）。仍建议标注让 LO 拍板，避免被读作静默推翻。
- 边界: [红]（与 2026-08-13 A3「codecard 三圆点写死」裁决表述有表面冲突，需拍板）

### 点位 5: 帧格竖直分隔线 `rgba(176,118,79,0.5)` 写死陶土
- 现状: `CapabilityScene.css:260-264`（repeating-linear-gradient 分隔线）。
- 改法: 同点位 2 方向：`color-mix(in srgb, var(--accent-ink) 50%, transparent)` 等效派生。理由与齿孔条一致（同族流动）。
- 风险: 无每帧成本（见点位 2）。
- 中英差异: 无。
- 历史裁决: `:251` 注释「分隔线用陶土色（与齿孔边框同调，缩小色差，不再深黑）」——派生后仍同调，不反转裁决意图。
- 边界: [绿]

---

## act3 dolly（Act3DollyScene）

### 点位 1: panel 静息投影偏弱，六块「大小不一」散落时浮起感不足
- 现状: `site/src/components/Act3DollyScene.css:96-98`（`box-shadow: 0 0.15em 0.5em rgba(26,24,20,0.05), 0 1.1em 2.6em rgba(26,24,20,0.07)`）。
- 改法: 第二层 alpha 0.07 → 0.10、扩散 2.6em → 3.2em（第一层保持）。六块静息 base 0.58–1.02（`Act3DollyScene.tsx:114-121`），小块（0.58-0.68）在奶白桃→琥珀行程上读作「贴底的纸」而非「悬浮的卡」；投影仍是中性墨，符合历史裁决。em 单位随 panel 字号缩，窄屏自动等比。
- 风险: 投影 alpha +0.03 在放大铺满段（scale→peak 3.35-4.30）会随之放大——但铺满段 panel opacity 已在 0.92→0 淡出（`dollyVariant`，`Act3DollyScene.tsx:314`），投影不可见期重合；T1 色温翻转风险零（投影中性）。
- 中英差异: 无（panel 内示意图全 DOM，投影与语言无关）。
- 历史裁决: T1/C9 硬约束（`Act3DollyScene.css:46-61` 注释：底板色温必须与色带谷段同族）只约束底板色，不约束投影；中性墨投影是 2026-08-06 起的锁定裁决（`CapabilityScene.css:404-410` 同源），本项加强而非反转。
- 边界: [绿]

### 点位 2: `.a3-panel__code` 的左侧 accent 竖线在静息小块上视觉占比过重
- 现状: `Act3DollyScene.css:159`（`border-left: 0.2em solid var(--accent)`）。
- 改法: 0.2em → 0.14em，颜色改 `color-mix(in srgb, var(--accent) 70%, transparent)`。静息最小块（image，base 0.58）的代码脚渲染高约 24px，0.2em 竖线 ≈ 2.6px 实心 accent 是整块的视觉锚点，比顶栏图标还跳；细化后代码脚回归「注释感」，accent 仍随 LUT 流动。
- 风险: 零（单边框宽度微调，不改盒模型——`border-left` 参与布局宽度，0.2em→0.14em 会让 code 行可用宽度 +0.06em≈1px，不触发任何折行变化；窄屏短版代码行 ≤18 字符余量充足，见 `Act3DollyScene.tsx:481-488`）。
- 中英差异: 无（code 行两语同为 API 字面量）。
- 历史裁决: 与 2026-08-14「面板配色根据渐变来」（同文件 :69-76 注释）同向；竖线语汇与第五幕副标题左线同源（`Scene5Cinema.css:338` 注释自述「呼应 .a3-panel__code 的竖线语汇」）——只改粗细透明度不改色相，语汇不破。
- 边界: [绿]

### 点位 3: `developVariant` 收尾标题的入场曲线——0.72 前的 opacity/filter 线性段可读性
- 现状: `Act3DollyScene.tsx:333-341`（opacity/scale/filter 同 times `[0, 0.72, 1]`，scaleFrom 0.92，blur 0.55vw）。
- 改法: 不动 times 结构（相位窗），只把 blur 起点 0.55vw → 0.42vw、scaleFrom 0.92 → 0.95。现状标题在 reveal 前 20% 行程里是一团 0.92 缩放的糊影，与「显影（develop）」的摄影语汇吻合但偏「肉」；收尾段是全幕唯一静止阅读时刻，起点清晰度抬一点让观众更早开始读标题。两值都在 ±20% 权限内。
- 风险: 零（纯关键帧数值；TITLE_MS=900 不变、BLOCKS_END 接力点不变）。
- 中英差异: zh 标题一行（`cap.shot3.title` 13 字）、en 两行（'Time flows with scroll, scenes move with the story' 46 字符，`en.ts:82`）——en 的阅读时间需求更长，起点更清晰的收益 en > zh；`.act3-titleblock` 的 flex-gap 布局（`Act3DollyScene.css:474-479`）已对两语折行鲁棒，无联动。
- 历史裁决: 2026-08-06 v3 运动模型（文件头注释）只管 panel 推进，不管收尾标题数值；无冲突。
- 边界: [绿]

### 点位 4: `.a3-stagger__bar` 渐变尾端写死 `rgba(201,138,106,0.35)`
- 现状: `Act3DollyScene.css:245`（`linear-gradient(180deg, var(--accent), rgba(201,138,106,0.35))`）。
- 改法: 尾端改 `color-mix(in srgb, var(--accent) 35%, transparent)`——同一 accent、同一 35% 不透明度，消除「起点流动、终点写死」的半跟随状态。
- 风险: 零。
- 中英差异: 无。
- 历史裁决: 同 act2 点位 2 的机制延伸；无冲突。
- 边界: [绿]

### 点位 5: `.a3-chain__dot.is-on` 的 glow `rgba(201,138,106,0.45)` 写死
- 现状: `Act3DollyScene.css:196`。
- 改法: `color-mix(in srgb, var(--accent) 45%, transparent)`（同点位 4 机制）。
- 风险: 零。
- 中英差异: 无。
- 历史裁决: 同上。
- 边界: [绿]

---

## act4 demo video（DemoVideoScene）

### 点位 1: 副标题逐字暖色带的 hue 行程与首屏奶白桃前提的衔接
- 现状: `site/src/components/DemoVideoScene.tsx:38-41`（`warmAt`：hue 40→14、sat 46+sin×10、light 50→45）。
- 改法: 不动算法，只把起点 hue 40 → 36（金→更偏杏）。用户裁决首屏回 `#fcede4`（hue≈24 的奶白桃），副标题的 hue 40 起点在色带 0.55-0.7 段（陶土橙，hue≈28 底）上偏「黄金」；36 让逐字渐变的起点与本幕底色 hue 差收窄，中段仍到 14 的玫瑰陶土（不变）。light/sat 不动（振幅裁决外）。
- 风险: 极小（起点色单参数）；`warmAt` 是纯函数、`buildSubtitleModel` 按文案 memo，不进每帧路径（每帧只有 `mix` 插值，`DemoVideoScene.tsx:162-183`）。
- 中英差异: zh 副标题 4 行 28 字（`zh.ts:170-171`）、en 4 行 84 字符（`en.ts:176-177`）——en 的 t 轴更长、经过 hue 行程的颜色样本更密，起点调整在 en 上更可辨；zh 字数少、相邻字 hue 步进更大，微调后衔接仍平滑（hue 步进由 `t ± 0.14` 窗口平滑，:135-136）。
- 历史裁决: 色带算法是 2026-07-14 时光副标题版引入（文件头注释），无后续裁决锁定具体 hue；不与 LUT 停靠裁决冲突（本项不改 LUT）。
- 边界: [绿]

### 点位 2: 退场 blur 尾帧复用入场值——「失焦远去」不必和「对焦浮现」同深度
- 现状: `DemoVideoScene.tsx:202`（退场 filter 尾帧复用 `SUBTITLE_BLUR = blur(0.5556vw)`，:72）；标题退场 `TITLE_OUT_START=0.94 → 1`（:100-101）、副标题 `0.72–0.80` 起（:113-114）。
- 改法: 退场 blur 尾帧 0.5556vw → 0.42vw。退场是「失焦远去」不是「对焦失败」，8px→6px @1440 让离场更快读作「暗下去」而非「又糊一遍」；入场 blur 保持 0.5556vw 不动（对焦浮现是入场主角）。
- 风险: 触及既有退场编排数值，但不动窗口边界（0.72/0.80/0.94/1.00 都是 2026-08-04 D2 + 实测裁决值，不碰）；只动尾帧深度。
- 中英差异: 无（blur 是行级 lane，两语同行数）。
- 历史裁决: 退场次序「由内向外、背景最后」是 2026-08-04 用户反馈裁决（`DemoVideoScene.tsx:83-99` 注释）——本项不动次序不动窗口，只动单帧 blur 深度，不冲突。
- 边界: [绿]

### 点位 3: scrim 渐变的暖白写死 `rgba(250,248,244,·)`，与 LUT 行程色温脱钩
- 现状: `site/src/components/DemoVideoScene.css:59-67`（六段渐变全部 `rgba(250,248,244,…)` = --film-white）。
- 改法: scrim 的暖白改 `color-mix(in srgb, var(--bg-grad-bot, #fbf5ea) 72%, transparent)` 派生（opacity 结构 0.72/0.24/0/0/0.26/0.72 不变，改的是色相来源）。scrim 的职责是「把上下两端压回底色」——写死 #faf8f4 在 LUT 0.55-0.7 段（陶土橙 bot #f8ebdc→#f7e6d8）上是略冷的奶白，接缝感正是 08-08 注释里修的那类问题；派生后 scrim 永远 = 当前底色提亮，机制上与 `--a3-plate` 同源。
- 风险: scrim 的 opacity 由 demo-scrim lane scrub（`DemoVideoScene.tsx:273-288`）——本项只改 background 的色值来源，不动 opacity 曲线；`--bg-grad-bot` 由 ribbon 量化写入（非每帧），scrim 不是每帧重绘面。
- 中英差异: 无。
- 历史裁决: `DemoVideoScene.css:46-53` 的「scrim 曾写 opacity:0 从未显形」修复记录说明 scrim 的效果此前从未被真机看到过——本项改色值是在「效果刚复活」的面上做，没有历史观感基线可推翻；与 `scrolling-ribbon-makes-tint-visible` 同向（固定色全屏面 → 派生面）。
- 边界: [绿]

### 点位 4: 主标题 text-shadow 暖白写死，同点位 3 机制
- 现状: `DemoVideoScene.css:87`（`text-shadow: 0 1u 20u rgba(250,248,244,0.6)`）。
- 改法: 同点位 3 派生（`color-mix(in srgb, var(--bg-grad-bot, #fbf5ea) 60%, transparent)`）。text-shadow 是标题在视频亮帧上的「光晕衬底」，写死奶白在 LUT 谷段偏冷。
- 风险: 零。
- 中英差异: 无。
- 历史裁决: 同点位 3。
- 边界: [绿]

### 点位 5: `demoVideo.title` 的 `|` 斜体尾巴——zh 的「也能驱动视频？」用斜体是英文专属语汇
- 现状: `DemoVideoScene.tsx:16-31`（VideoTitle：`|` 后半段 `<em>` 斜体 + accent-ink）；`DemoVideoScene.css:92-96`（`font-style: italic; font-weight: 500`）。
- 改法: **不改斜体本身**（排版权限外），仅指出中英差异供拍板：zh「或许，|也能驱动视频？」的尾巴在 Songti SC 下被强制伪斜体（算法倾斜），CJK 伪斜体笔画粘连、在 text-3xl 档位可读性明显下降；en 'Perhaps|it can drive video too?' 的 Fraunces 真斜体是精致点题。可选绿色改法：zh 下 `em` 不斜体、改用 `font-weight: 600` + accent-ink 保持强调（`[data-lang='zh'] .demo-video__title-tail { font-style: normal; }`），en 保持 italic。
- 风险: zh 尾巴失去「斜体点题」的语汇，但 CJK 本来就没有斜体传统；视觉强调由字重 + 颜色承担，层级不丢。
- 中英差异: 本点位本身就是中英差异项（见上）。
- 历史裁决: SplitTitle/em 的 `|` 约定在 act2 `CapabilityScene.tsx:69-94` 同用（`cap-title em` 同样 italic，`CapabilityScene.css:144-148`）——若改 act4 不改 act2 会语汇不一致；act2 的 zh 尾巴（「挑一种入场」）同样吃伪斜体。两处同一改法可一并做。
- 边界: [绿]（zh-only 覆写、en 不动、不动排版档位；若 LO 认为斜体是品牌语汇则降级为「明确不动」）

---

## act5 cinema（Scene5Cinema）

### 点位 1: `.phone-mockup__frame` 的呼吸 box-shadow 峰值 alpha 0.40 在近黑场上偏「灯箱」
- 现状: `site/src/components/Scene5Cinema.css:396-398`（`rgba(225,164,91, calc(0.2 + 0.2 × var(--phone-breathe)))`，3s lane）。
- 改法: 峰值 alpha 0.40 → 0.32、blur 峰值 20px → 16px、spread 峰值 5px → 4px（即 `calc(0.2+0.12×breathe)` / `calc(12+4×breathe)` / `calc(3+1×breathe)`）。熄灯 0.94 黑场下 90vh 手机的呼吸光晕是全屏唯一脉动高亮面，现状峰值读作「招牌灯箱」而非「影院里待机设备的余光」；收窄后星光（lo/hi 0.04-1 的逐星振幅）重新成为最闪的面，层级正确。
- 风险: 触及的是 `--phone-breathe` 消费端的 calc 系数，不动 3s lane 本身；PhoneMockup 呼吸机制（`PhoneMockup.tsx:49-59`）零改动。
- 中英差异: 无。
- 历史裁决: 2026-08-06「不要灯光只要星光」裁决（`Scene5Cinema.css:100-105` 注释）的精神是「氛围由星光承担」——本项把手机 glow 压到星光之下正是该裁决的延伸，不是反转。
- 边界: [绿]

### 点位 2: 标题 text-shadow 暖光晕在分栏态与 phone glow 同色同明度，两层光晕互相糊
- 现状: `Scene5Cinema.css:287-289`（`text-shadow: 0 0 18px rgba(225,164,91,0.26), 0 0 42px rgba(225,164,91,0.1)`——静态，已是 2026-08-06 去脉冲后的版本）。
- 改法: 第一层 18px/0.26 → 14px/0.20。分栏态手机（含 0.08 径向 glow + 呼吸 frame glow）与标题同处一屏，两个 rgba(225,164,91) 光晕面相邻，标题字面本身 0.96 暖白已足够亮，光晕只需「把字从黑场里托起来」的最低量。
- 风险: 零。
- 中英差异: zh 标题 nowrap 单行（567px @46px）、en `text-wrap: balance` 两行（`Scene5Cinema.css:322-325` C10 裁决）——en 两行时光晕叠加面积更大，收窄收益 en > zh；两语同改无风险。
- 历史裁决: 2026-08-06 删除流光扫掠时保留静态 text-shadow 是明示裁决（`:262-264` 注释「保留 text-shadow 的暖光晕…但改为静态」）——本项只调数值不删结构，不冲突。
- 边界: [绿]

### 点位 3: 副标题左侧 accent 竖线 `rgba(225,164,91,0.55)` 与标题/手机光晕第三处同色面
- 现状: `Scene5Cinema.css:342`（`border-left: 2px solid rgba(225,164,91,0.55)`）。
- 改法: alpha 0.55 → 0.40。竖线是「系成一组」的编排记号（`:336-338` 注释自述），不是强调面；黑场上三处同 hue 高 alpha 面（手机 glow、标题光晕、竖线）互相抬亮度，0.40 让竖线回到「记号」层级。
- 风险: 零。
- 中英差异: zh 副标题 2 行各 15-16 字、en 2 行各 ~40 字符（`en.ts:126-127`）——en 行长更长，竖线旁的文本块更大，竖线 alpha 降低对 en 的平衡感改善更明显。
- 历史裁决: 竖线语汇与 act3 代码脚同源（注释自述）——act3 点位 2 同向改细改淡，两处语汇保持同步。
- 边界: [绿]

### 点位 4: 星光的暖星 `rgba(255,240,214,0.95)` 与黑场 hue 锚点核对
- 现状: `Scene5Cinema.css:96-98`（`.is-warm` 星，38% 占比，`Scene5Cinema.tsx:211`）。
- 改法: **无改动，核对记录**。暖星 #fff0d6（hue≈38）与 overlay #0a0909（近中性黑）无冲突；与 LUT 无耦合（黑场盖在色带之上）。逐星 lo/hi/双频道混合机制是 2026-08-08 对抗验收后的定稿，不动。
- 边界: [绿]（零改动核对项）

### 点位 5: 分栏过渡的时序链——标题入场 delay 1.1s 卡死的「位移段播完才起」
- 现状: `Scene5Cinema.css:297-299` + `:330`（基态退场 delay 0.25s / is-split 入场 delay 1.1s）、副标题 1.35s（`:356`/`:361`）、位移段 1.1s（`:140`/`:146`）。
- 改法: 标题入场 delay 1.1s → 0.95s（位移段的 86% 处起身，与 hero slogan 的 SLOGAN_OVERLAP 交叠手法同源，`HeroScene.tsx:56-58`）；副标题 1.35s → 1.20s 保持 +0.25s 间隔。位移段 1.1s 本身不动（编排拓扑），只让文字提前 150ms 接力——现状「手机完全停稳 → 文字才起」的硬切在 90vh 大位移后有一个可感的死拍。
- 风险: 时序是 2026-08-09 用户访谈裁决「严格串行」（`:290-294` 注释）——本项把「严格串行」改成「86% 交叠」，**字面上偏离该裁决**；但同一裁决的退场方向（副 0 → 标题 0.25 → 位移 1.05）本项不动。需 LO 确认「串行」是指「次序」还是「零交叠」。
- 中英差异: 无（时序与语言无关；en 标题两行折行使入场块更高，交叠后视觉更连贯）。
- 历史裁决: 2026-08-09「严格串行 + 镜像退场」访谈裁决（`Scene5Cinema.css:290-294`）；hero 的交叠先例（SLOGAN_OVERLAP=580ms）是同站既有语汇。
- 边界: [红]（字面偏离「严格串行」裁决，需拍板）

### 点位 6: iframe 屏幕底色 `#060507` 与 phone screen `#060507` / frame `#0b0a0c` 的三层黑
- 现状: `Scene5Cinema.css:405`（screen）、`:452`（iframe）、`:394`（frame 背景 #0b0a0c）。
- 改法: **无改动，核对记录**。三层黑在熄灯 0.94 的黑场上有可辨的「机身框 → 屏幕槽 → 内容」层级（0b0a0c vs 060507 vs overlay 外的 0a0909），是刻意的机身纵深感；色相全中性偏冷，与暖 glow 对比成立。不动。
- 边界: [绿]（零改动核对项）

---

## 明确不动的项（考虑过但决定不动）

1. **hero slogan 的流光 beam 关键帧编排**（`HeroScene.tsx:61` `BEAM_TIMES` + 9 段关键帧）——四段扫掠 + 停顿的接力结构是签名动效，改任何 times 都动编排拓扑；且 `text-fill-transparent-half-glyph` memory 确认当前实现（光束停屏外时回落纯 --ink）无 act5 当年的「缺一半」缺陷。
2. **hero slogan 中文 ±44 非对称静态偏移**（`HeroScene.tsx:207`）——排版范畴，授权外。
3. **act2 HOLD_MS=2600 / SELECTION_FADE_MS=420**（`CapabilityScene.tsx:146,152`）——2026-08-12 / 2026-08-10 两次真机实测裁决值，动它们就是动相位窗。
4. **act2 帧格 9 预设的播放顺序/链式 waitFor 拓扑**（`CapabilityScene.tsx:452-460`）——编排拓扑，授权外。
5. **act3 六块的 x/y/base/tilt 布局数据**（`Act3DollyScene.tsx:114-121`）——2026-08-06 用户「再凌乱一点」裁决的落点，排版范畴。
6. **act3 `--a3-plate` 74%/82%/66% 白混比例**（`Act3DollyScene.css:74-76`）——2026-08-14 用户裁决「面板配色根据渐变来」刚落定的值，无新证据不重开。
7. **act4 视频/scrim/title/subtitle 的退场窗口边界**（0.72/0.80/0.94/1.00，`DemoVideoScene.tsx:100-114`）——2026-08-04 D2 + 实测裁决的「由内向外」次序结构，授权外；本审计只动了窗口内的 blur 深度。
8. **act5 LIGHTS_OFF_RAMP_END=1 整 zone 线性斜坡**（`Scene5Cinema.tsx:105`）——2026-08-13 用户裁决值（频闪 vs 防闪的知情取舍），不重开。
9. **act5 星野 54 颗 / 9 频道 / LCG 种子**（`Scene5Cinema.tsx:153-215`）——2026-08-08 对抗验收定稿的随机性机制，无缺陷报告。
10. **act5 熄灯终点 0.94 留暖底**（`Scene5Cinema.tsx:33`）——用户明示「避免纯黑」裁决。
11. **滚动条三色配置**（`HomePage.tsx:60-67`）——thumb 已走 `var(--accent)` 随滚动流动，track 中性墨 0.06 符合中性件裁决；thumbHoverColor 写死 `rgba(255,255,255,0.9)` 在亮底上对比弱，但 hover 态是瞬态反馈、且框架 scrollbar API 只接受色值字符串（派生需框架侧支持），不值得为它动框架。
12. **`--rec` 信号红族**（tokens.css:36-37）——REC 是「不随镜头色变」的常驻信号色（注释明示），2026-08-13 A3 亦列为不应跟随。
13. **全局 `--font-display` 的 Songti SC fallback 与 `letter-spacing: -0.02em`**（tokens.css:40,117）——字距/字体栈属排版档位，授权外；CJK 负字距的潜在问题列入排版专项，不在本轮。
14. **act4 `demo-video__subtitle` 的 Playfair Display 首选项**（DemoVideoScene.css:105）——zh 下 Playfair 无 CJK 字形、回落 Songti SC，两语衬线观感不同但都是「电影衬线」语汇；改字体栈属排版档位，授权外。
