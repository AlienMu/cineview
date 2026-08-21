# 首页五幕「文字」重设计提案（文案 + 表现形式）

日期：2026-08-14 · 性质：只读提案，不改码，待用户拍板
语气红线（沿用 08-09 裁决）：**示范给你看，不是告诉你它很好**——克制、可核对、点破事实，不写成宣传语。
中英成对设计但**不是翻译关系**：两种语言各自成立、各自有节奏。

---

## 先行裁决请求（3 个结构性选择）

在逐幕提案之前，有 3 个跨幕的机制级选择影响所有 B 方向，需要用户先表态：

1. **act2 卡片 desc 是否恢复动效？** 08-12 用户裁决「代码框里面的内容不要有动画，只有代码框在真正的切换」，现状是纯内容替换。act2-B（词间开拍）的核心是「九个 preset 各演自己」，**只动 caption 行（`film-caption__title`，在框外）**，不碰 codecard 内任何元素——与裁决不冲突。但若是想连 caption 的「预设名标签」也做成每帧不同形态，那就是动到既有机制，需要确认放行范围。
2. **act4 `demoVideo.desc` 现状是死 key**（zh.ts:174 有文案但全站无挂载点）。所有 act4 方案都建议把它删掉，或借这次设计把它落到副标题下方新挂载。倾向删除——幕内已经有 title+intro+code 三层文字，再加一层是噪音。
3. **act3-B（帧号先走）依赖「stagger 的 exit 自动反向」从中间锚点起步**（帧号在 BLOCKS_END 时刻是半程态，需从半程走到 0）。这是框架宣称支持的镜像语义但**无先例挂载**，落地前需要一个探针验证节点；若验证不成立，act3-B 降级为 act3-A。

另注：`idea.*`（eyebrow/title/body）三个 key 在现行五幕首页**无挂载点**（HomePage 只挂 hero / cap-film / cap-shot3 / demo-video / cinema-entrance），本提案不为其设计文案；`hero.ctaStart/ctaApi/ctaGithub` 三个按钮文案维持不动（功能标签，无叙事任务）。

---

## act1 Hero

**现状锚点**：`hero.slogan`（最大字号 Fraunces，两行 nowrap，自带非对称 ±44px 静态错位 + 流光接力扫掠）、`hero.intro`（小字，逐字 stagger y:15% 上探，32ms/字）、`hero.scrollHint`（infinite 浮动）。title（CINEVIEW 等宽大写）不动。

行长约束：slogan 两行 nowrap，每行 ≤ 7 个全角字（现行 6/5 字）；intro `max-width: 42ch`，两行。

### 方向 A 「分镜表的两栏」

- 文案 zh（`hero.slogan`）：`你滚动，它走位\n你拖拽，它倒带`
- 文案 en（`hero.slogan`）：`You scroll — it moves\nYou drag — it rewinds`
- 文案 zh（`hero.intro`）：`滚动是胶片,拖拽是分镜。\n这一页的每一步,都在演示它。`
- 文案 en（`hero.intro`）：`Scroll is the film; drag is the cut.\nThis page is the demonstration.`
- 表现形式：slogan 维持现行双行 slide 视差入场（机制不动）；intro 逐字 stagger 把 `y:15%` 压到 `y:10%`（审查建议落位，字不再「跳上来」而是「浮上来」），其余不动。
- 为什么更好：slogan 从「夸用户是导演」（宣传句式）改为「你动 → 它应」的因果对仗，两句各是一个可核对的事实，且与 intro 首句「滚动是胶片,拖拽是分镜」形成「比喻 → 操作」的递进而非同义重复；intro 末句「这一页的每一步,都在演示它」点破全站方法论，替代现行末句（与 act2 旧 title 语义重复的那句）。

### 方向 B 「打板即入场」

- 文案 zh（`hero.slogan`）：同 A（`你滚动，它走位\n你拖拽，它倒带`）
- 文案 en（`hero.slogan`）：同 A
- 文案 zh（`hero.intro`）：同 A
- 文案 en（`hero.intro`）：同 A
- 表现形式：**slogan 升级为逐字 stagger**——zh 12 字 / en ~34 字符拆 char span（复用 `buildIntroItems` 机制），变体 `{opacity:0, y:'30%', filter:'blur(6px)'} → {opacity:1, y:0, filter:'blur(0px)'}`，each ≈55ms，两行错峰接续（row1 在 row0 播到 60% 起身，沿用 SLOGAN_OVERLAP 语义）。逐字落定后**流光扫掠照旧**（infiniteAnimation 已在，不受影响——它投影的是 background-position CSS 变量，逐字拆分不吃它）。intro 不变（A 的逐字浮上）。
- 为什么更好：首屏第一句话本身用「逐字对焦」演出来——框架最拿手的字符级错峰，第一次亮相就示范；blur→清晰与 act3 收尾显影、act4 对焦同源，五幕文字共享一套「对焦」语汇。

**推荐：B**。流光保留意味着风险面只在「入场那 1.5 秒」，而首屏恰恰是唯一一个「纯时间轨（visibility 入场）、不受滚动 scrub」的文字场——逐字 stagger 在这里最便宜、最被看见。

---

## act2 能力展示（胶片带镜）

**现状锚点**：`cap.shot1.title`（`|` 前后分段，后段 Fraunces 斜体陶土强调，单行 header）、`cap.shot1.intro`（副标题在首个逗号处换行成两行）、九个 `cap.shot1.preset.*.title/.desc`（caption 行 + codecard desc 行，后者无动画纯替换）。

行长约束：title 单行 header 档，zh ≤ ~18 字；intro 两行、每行 ≤ ~24 字（`film-titleblock` 居中）；preset title 4 字档（caption 槽位），desc ≤ ~24 字一行。

### 方向 A 「删形容，留参数」

- 文案 zh（`cap.shot1.title`）：`挑一个动词|给它` ／ en（`cap.shot1.title`）：`Pick a verb|hand it over`
- 文案 zh（`cap.shot1.intro`）：`四十余种进场预设内置——从淡入到震颤，\n改一个 prop 便从容切换，不必手写一行动画曲线。`（**仅删「其中」**，其余不动）／ en：`Forty-odd entrance presets — from fade to shake,\nswapped with a single prop, no motion curve hand-written.`
- 九个 preset zh 描述（`cap.shot1.preset.*.desc`）逐条提纯（删「最/一分/一点/顽皮」等评价词，每条补一个可核对参数或行为事实）：
  - fadeIn：`透明度 0 → 1，400ms 线性淡入。`
  - slideUp：`自下方 100% 位移入场，带分量感。`
  - zoomIn：`scale 0.3 → 1，如镜头推近。`
  - rotateIn：`rotate -12° 回正，带一点戏剧性。`
  - bounce：`末段三次回弹，收束有弹性。`
  - shake：`水平 ±8px 震颤三次，提示与警示用。`
  - flip：`绕 Y 轴翻转 90° 入场，卡片翻面。`
  - elastic：`scale 过冲 1.08 再落定，轻轻回弹。`
  - blur：`blur 12px → 0，镜头对上焦。`
  en 同步重写为同结构短句（每句一个参数一个比喻，如 `Opacity 0 → 1, a 400ms linear fade.` / `Blur 12px → 0 — the lens finds focus.`）。
- 表现形式：完全不动（caption 交叉淡化、codecard 无动画维持 08-12 裁决）。
- 为什么更好：desc 从「带一点位移的分量感」这种读感形容变成「±8px / 0.3→1 / 三次」的可核对参数——语气红线本来就是「只陈述可核对的事实」，现行 desc 里残留的形容词是最后一处越线。

### 方向 B 「九个词，九种开拍」

- 文案：title/intro/desc 同 A（文案面不变得更激进，表现力全部落在形式上）。
- 表现形式：**caption 的「预设标题」四字（`film-caption__title`）逐帧演自己的 preset**——九个 caption slot 各挂一条 keyframe variant（在既有 `filmSelectionVariant` 的 fade/blur/scale 投影之外，按帧追加该 preset 的签名形态）：blur 帧的 caption 从 `blur(8px)` 聚到 0、slideUp 帧的 caption 多一段 `y:60%→0`、shake 帧的 caption 落定后追加两记 `x:±3px` 震颤、rotate 帧带 `rotate:-6°→0`。全部走 Animate 白名单属性（opacity/x/y/scale/rotate/filter），相位锚点与现行 SELECTION_MS 切换点严格同轴；**codecard 内一律不碰**（08-12 裁决框内无动画）。
- 为什么更好：胶带帧格里的图标在演 preset，而「念出这个 preset 名字的那四个字」纹丝不动——这是现行结构里唯一「说的和演的不一致」的缝隙；让词自己演一遍，act2 从「陈列九个 preset」变成「九个 preset 各自签字画押」。

**推荐：A 保底、B 加分**。A 是纯粹的文案质量修正，零风险；B 在框架能力内（九个 variant 都是白名单 keyframes），但要先过「相位锚点密采」探针验证 caption 切换窗不撞车。若只拍一个，先 A。

---

## act3 推镜（dolly in）

**现状锚点**：六块 panel 的 `cap.shot3.card.*.label`（bar 内 4 字标签，bar 是「图标 + label + 01/06 序号」的 slate 结构，label 宽度余量约 ±2 字）、收尾 `cap.shot3.title`（单行主标题档）+ `cap.shot3.summary`（逗号处两行）。

行长约束：panel label ≤ 6 字；title zh 单行 ≤ ~16 字；summary 两行、每行 ≤ ~14 字。

### 方向 A 「收束到一条胶片」

- 文案 zh（`cap.shot3.title`）：`六个镜头，一条时间轴` ／ en（`cap.shot3.title`）：`Six shots, one timeline`
- 文案 zh（`cap.shot3.summary`）：`各自登场，依次离场，\n这一页正在演。` ／ en：`Each enters, each exits —\nthis page is playing it.`
- 六块 label 不动（`链式编排/错峰级联/单尺子定位/尺寸换算/滚动接管/资源预加载` 已是功能实名，无提纯空间）。
- 表现形式：维持 developVariant（虚焦→实焦 + scale 0.92→1）不动。
- 为什么更好：现行 title「时间随滚动流转，画面随叙事前行」是两半同义反复（流转≈前行），且与 act1 intro 旧末句同源；改后上句点名刚看完的六块（六个镜头）、下句点名机制（一条时间轴），summary 末句「这一页正在演」把它从描述句收成示范句——总结标题的职责是收束，不是再铺一层抒情。

### 方向 B 「帧号先走，画面显影」

- 文案：同 A。
- 表现形式：panel bar 内的 `01 / 06`–`06 / 06` 序号从静态文本升级为 **stagger 逐位演显**——六块序号各包 char span（`01`、`/`、`06` 三段），在所属 panel 的 dolly lane 上用 `stagger:{each:120}` 做 `opacity 0.25→1` 的逐级点亮（stagger 的 exit 自动反向 ⇒ 无需写退场编排）；panel 放大淡出时序号随块一起收。收尾标题保持 A 的显影，**summary 追加一条 scrub 轨逐字投影**：复用 act4 `TimeSubtitle` 的逐字 read-only 色带机制（墨色→暖琥珀），summary 的 12 个字随最后 1800ms 滚动逐字「洗」出来，反向滚动原路洗回去。
- 为什么更好：本幕六块在动、标题在显影，唯独「01/06」这组最像电影 slate 的元素是死的——让帧号成为第七个会动的元素，且它动的方式（逐位点亮）正是 stagger 能力的现场示范；summary 的逐字洗色与 act4 副标题同语汇，两幕遥相呼应。

**推荐：A**。B 的序号 stagger「从半程锚点反向走到 0」无先例挂载（见先行裁决 3），summary 逐字洗色则是把 act4 最重的投影机制复制一份——为一句 12 字的副标题不值。A 的文案修正独立成立。

---

## act4 滚动驱动视频

**现状锚点**：`demoVideo.title`（`|` 分段，前句 + 斜体追问，max-width 720 设计 px 居中块）、`demoVideo.intro`（四行，画面正中主角，行级 blur→清晰 Animate lane + 逐字暖色只读投影，行 nowrap、zh 每行 ≤ 10 字 / en ≤ ~38 字符 @2rem）、`demoVideo.desc`（**死 key，无挂载**）。

行长约束：title 一行（zh ≤ ~12 字 / en ≤ ~40 字符）；intro 每行 nowrap——**每行长度即硬上限**，zh 每行 ≤ 10 字、en 每行 ≤ ~38 字符，行数维持四行。

### 方向 A 「四行，各答一个问题」

- 文案 zh（`demoVideo.title`）：不动（`或许，|也能驱动视频？`——它是全站唯一带疑问语气的标题，「或许」的谦逊恰好是「示范给你看」的语气本身）。
- 文案 zh（`demoVideo.intro`）：
  ```
  一行 JSX，
  滚动即时间轴——
  反向滚动，天然倒放；
  这一屏的每一帧，都由你擦过。
  ```
  字数 6/6/9/12（现行 6/6/9/10），末行略长但 < 860 设计 px 容器的单行容量。
- 文案 en（`demoVideo.intro`）：
  ```
  One line of JSX,
  and scroll is the timeline —
  scroll back, it rewinds by nature;
  every frame here passed under your hand.
  ```
  （四行抑扬与 zh 不对译：zh 是「陈述—破折—分号—收束」的剪辑句式，en 是「one line—and—back—every」的递进。）
- 表现形式：机制不动（行级 blur 显影 + 逐字暖色带）。**删掉死 key `demoVideo.desc`**（zh.ts:174/en.ts:180——「滚动即时间轴」已被新 intro 第二行说掉，desc 活着也是重复）。
- 为什么更好：现行四行诗「从逐帧跳动，到光影长卷——所有动态，共用一种节奏；解锁画面，让故事自由上演」是意象铺陈，第四行「让故事自由上演」已滑向宣传语；改后四行各落一个可核对事实（一行代码 / 滚动=时间轴 / 反向=倒放 / 你正在擦），且第二行恰好是死 key desc 的核心句——把死掉的好文案复活进主角位置。

### 方向 B 「追问随帧改写」

- 文案 zh（`demoVideo.title`）：`滚动，|它现在听你擦放？` ／ en（`demoVideo.title`）：`Scroll —|it scrubs when you say so?`
  （硬约束内：zh 11 字、en 37 字符。）
- 文案 zh（`demoVideo.intro`）：
  ```
  这一行字显影时，
  视频正被滚动擦到这一帧——
  你停，它停；
  你退，它倒带。
  ```
  字数 7/11/5/6。en：`As this line develops,\nthe video sits at the frame you scrolled to —\nyou stop, it stops;\nyou pull back, it rewinds.`
- 表现形式：intro 的逐字暖色投影**从「按字位置固定取色」升级为「色带锚定视频帧进度」**——`TimeSubtitle` 的 `warmAt(t)` 输入从「字符序号 / 总字数」换成「字符 reveal 时刻对应的 zone progress」，于是逐字洗过的暖色带与视频当前帧严格同相：观众看到的字幕颜色流，就是时间轴本身的可视化。行级 blur 显影机制不动。
- 为什么更好：这一幕的核心陈述是「滚动即时间轴」，B 让字幕本身的显影进度与视频帧共用一个量——文案说「你停，它停」的同时，字幕颜色也真的停在原地，形式即证据。

**推荐：A**。A 以零机制风险修掉「第四行宣传语 + 死 key」两个真实问题；B 的标题改写（「听你擦放」）比现行「或许」多了卖弄，且色带锚定改造要重写 `buildSubtitleModel` 的取色模型，收益落在观众未必察觉的同相性上。B 留作备选。

---

## act5 Cinema Entrance

**现状锚点**：`scene5.title`（分栏态右栏标题，zh 单行 nowrap 硬上限 567px@46px ≈ **12 个全角字**；en 允许两行 `text-wrap:balance`）、`scene5.subtitle`（等宽小字 + accent 竖线，`\n` 两行 pre-line，每行 ≤ ~20 字）。出现机制：纯 CSS transition 分方向 delay 串行（手机位移 1.1s → 标题 fade+上浮 → 副标题晚 0.25s），退场镜像——**这是 CSS 状态切换轨，非 Animate lane**。

行长约束：title zh **严格单行** ≤ 12 字（567px）；subtitle 两行、每行 ≤ ~20 字（420 设计 px 列宽）。

### 方向 A 「点亮的是谁」

- 文案 zh（`scene5.title`）：`灯亮了，它在你手里`（8 字，远低于 12 字上限）／ en（`scene5.title`）：`Lights up — it's live in your hands`（两行 balance）
- 文案 zh（`scene5.subtitle`）：`你拖完的，是 drag；\n你滚到的，是 scroll。` ／ en（`scene5.subtitle`）：`What you dragged is drag;\nwhat you scrolled is scroll.`
- 表现形式：完全不动（CSS 串行出现 + 镜像退场维持现行）。
- 为什么更好：现行「两种模式，一套体系」是概括句——它说的是框架的分类学，不是观众**此刻**的处境；此刻的客观事实是「观众刚在手机里亲手拖完了 drag 模式，而装着这台手机的这一页本身就是 scroll 模式」。A 的标题先接住熄灯语汇（灯亮了）再落到手里，副标题用两行对仗把双模式同框点成一句绕口令式的同义反复——「你拖完的是 drag，你滚到的是 scroll」近乎废话，但正因为它近乎废话，观众才会愣一下然后意识到：对，我刚才确实同时用了两种模式。

### 方向 B 「分镜表落款」

- 文案 zh（`scene5.title`）：`第五镜：两种模式同框`（10 字，含「镜」语汇）／ en（`scene5.title`）：`Shot five: both modes in frame`
- 文案 zh（`scene5.subtitle`）：`左：drag，已被你拖完\n右：scroll，正被你滚着` ／ en（`scene5.subtitle`）：`Left: drag — already dragged by you\nRight: scroll — being scrolled by you`
- 表现形式：subtitle 两行从「齐出」改为**逐行 stagger**（左行先行 120ms——观众先被引导看手机，再被点破自己），实现上把 subtitle 拆两行节点各走一条 CSS transition delay（基态/分栏态分方向 delay，与现行标题串行同一机制，不引入 Animate）；或保留整段一次出现，仅标题入场时追加一次 `blur(4px)→0` 对焦（CSS transition 加 filter 轨，与 act3/act4 对焦语汇闭环）。
- 为什么更好：现行副标题「指尖拖拽的是它，这一页滚动的也是它」主语是含糊的「它」；B 直接给左右两栏各写一行字幕卡（左：手机里的 drag，右：你脚下的 scroll），空间对位与「shot five」的场记语汇让这一幕变成全页的落款分镜。

**推荐：A**。副标题「你拖完的，是 drag；你滚到的，是 scroll」是全提案里语气最准的一句——它把 08-09 裁决「点破双模式同框」推到极致：不概括、不升华，只把观众刚做完的两件事原样念出来。B 的「左/右」在窄屏纵向布局（≤900px 改纵排）下空间指代会失效，需要按断点换文案，是额外机制负担。

---

## 五幕串读（推荐组合全 A + act1-B 的形式）

> **act1** 你滚动，它走位 / 你拖拽，它倒带 —— 这一页的每一步，都在演示它。
> **act2** 挑一个动词给它 —— 九个 preset，九行参数。
> **act3** 六个镜头，一条时间轴 —— 这一页正在演。
> **act4** 或许，也能驱动视频？ —— 你停，它停；你退，它倒带。
> **act5** 灯亮了，它在你手里 —— 你拖完的是 drag，你滚到的是 scroll。

一条暗线贯穿：**act1 立方法论（演示）→ act2/3 演机制（参数/时间轴）→ act4 把滚动说成「你」的动作 → act5 收束到「你刚做完的两件事」**。代词「你」的密度沿幕序递增，末幕完全交到观众手里——与「示范给你看」从方法论落为事实的路径同构。
