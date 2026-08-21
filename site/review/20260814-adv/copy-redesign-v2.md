# 首页五幕「文字」重设计提案 v2（文案优雅化修订）

日期：2026-08-14 · 二轮修订 · 只读提案，不改码，待用户拍板
一轮反馈：act1 不动；act2–5 的 A 方向「太单调」——方向不是更克制，而是**更有语感**。
红线不变：示范给你看（可核对、不宣传）；行长硬约束；中英成对非翻译；不滥用「你」、不堆砌形容词、不同义反复。

---

## 本轮的「优雅」操作定义

一轮 A 的病根是**电报体**——把句子压成参数清单，准确但无呼吸。本轮的抬法：

1. **光影语汇自带**：幕/镜/光/显影/就位/守/亮——动作词本身就是影语言汇，不需要额外形容词。
2. **句子有起伏，不停在半空**：允许一个动词带一个光影喻（「一字，一镜」「洗亮」），但每句必须落在一个可核对的事实上。
3. **「你」退到动词后面**：act5 保留对仗（用户未反对），其余幕让「你」作宾语或隐去，不作主语开头。
4. **zh 走四字/六字顿 + 破折收束；en 走轻动词 + 破折**，两语言各写各的节奏，不对译。

---

## act1 Hero

**用户裁决：整幕不动。** slogan/intro 文案与表现形式全部保持现行（`hero.slogan`「像导演一样\n控制每一帧」、`hero.intro`「滚动是胶片,拖拽是分镜。\n把每一次位移,都交给被编排的时间。」、逐字 stagger、流光接力，一个字不动）。本轮提案不含 act1。

---

## act2 能力展示（胶片带镜）

行长校验：title 单行 header 档 zh ≤~18 字 ✓；intro 两行、每行 ≤~24 字 ✓；preset desc 一行 ≤~24 字 ✓。

### 方向 「一字，一镜」

- 文案 zh（`cap.shot1.title`）：`挑一个动词|一字，一镜`
  - 行长：7+4 字，单行从容 ✓
  - 说明：`|` 后段渲染为 Fraunces 斜体陶土强调——「一字，一镜」落在斜体位，像场记板上的批注。
- 文案 en（`cap.shot1.title`）：`Pick a verb|every word, a shot`
  - 说明：zh 的「一字，一镜」是四字顿，en 不对译字面，取同构的轻陈述「every word, a shot」，尾词落在 shot 上与全幕 slate 语汇扣合。
- 文案 zh（`cap.shot1.intro`）：`四十余种进场预设置于库中,\n改一个 prop,便换一种登场。`
  - 行长：行1 12 字 / 行2 13 字 ✓（`renderIntroLines` 在**首个**逗号处换行，故行1 必须以逗号收尾——本稿首逗号落在「库中」后，切点正确。曾考虑长版「——淡入、震颤,皆在其列」作行1，但它把破折号与举例堆进同一句，呼吸反而乱了，弃。）
- 文案 en（`cap.shot1.intro`）：`Forty-odd entrances sit in the library,\na single prop swaps one arrival for another.`
- 九个 preset zh 描述（`cap.shot1.preset.*.desc`）——参数仍在，但句子给了谓语的呼吸：
  - fadeIn：`光从无形到有形:opacity 0 → 1。`（19 字符 ✓）
  - slideUp：`自画面下方升起,带着落幅。`
  - zoomIn：`由小及大,如镜头推近。`
  - rotateIn：`侧身而入,旋至正面。`
  - bounce：`落定之前,轻轻回弹三次。`
  - shake：`左右震颤 ±8px,提醒注意。`
  - flip：`绕 Y 轴翻面,如卡片转正。`
  - elastic：`越过终点半步,再坐回原地。`
  - blur：`从虚焦到清晰,如镜头对上焦。`
  - en 同构短句（不对译，各写各的喻）：`From nothing to lit: opacity 0 → 1.` / `Rises from below the frame, with follow-through.` / `Small to full, like a lens pushing in.` / `Enters sideways, turns to face you.` / `Settles only after three soft rebounds.` / `A ±8px tremor, left and right, for attention.` / `Flips around Y, a card turned face-up.` / `Overshoots by half a step, then sits back.` / `From blur to sharp — the lens finds focus.`
- 为什么这样更优雅：一轮 A 的 title「挑一个动词|给它」是祈使句半成品，话没说完；「一字，一镜」把同一层意思收成四字对仗——动词即镜头，正是这一幕九个 preset 在做的事。desc 不再是「参数，参数。」的电报体，每条留一个动词喻（升起/侧身/坐回/对上焦），参数只在该出现时出现（fade/blur/shake 三条带数字，其余不带——九条整齐划一带参数反而成了新的单调）。
- 表现形式：维持一轮 A（caption 交叉淡化不动、codecard 内无动画遵守 08-12 裁决）。**一轮 act2-B（九 caption 各演自己的 preset）倾向放行**：它只动框外 caption 行，是「词自己演一遍」的同义形式化，与本方向文案气质一致；但建议在文案定稿后单独排期，不与文案同批上。

---

## act3 推镜（dolly in）

行长校验：title zh 单行 ≤~16 字 ✓；summary 两行、每行 ≤~14 字 ✓（renderIntroLines 在首个逗号处切，故行1 以逗号收尾）。

### 方向 「轮番与俱在」

- 文案 zh（`cap.shot3.title`）：`六镜轮番登场,时间轴只有一条`
  - 行长：13 字 ✓
- 文案 en（`cap.shot3.title`）：`Six entrances in turn; the timeline is one`
- 文案 zh（`cap.shot3.summary`）：`你看到的是六个能力,\n它们共用一条胶片。`
  - 行长：行1 9 字 / 行2 9 字 ✓
- 文案 en（`cap.shot3.summary`）：`Six capabilities on screen,\none strip of film beneath them.`
- 备选（更隐去「你」）：zh summary `看似六处各演各的,\n底下是同一条胶片。` ／ en `Six performances above,\nthe same strip of film below.`
- 为什么这样更优雅：一轮 A「六个镜头,一条时间轴」是电报对仗——两个名词短语相碰，没有谓语。v2 给它谓语与转折：「轮番登场」先承认观众刚看完的六次推镜（可核对），「只有一条」的「只有」把数量对仗变成轻微的意外——六次运动，一条轴，这正是框架的陈述本身。summary 的「共用一条胶片」把抽象 time-axis 落回全站的第一比喻（胶片），与 act1 现行 intro「滚动是胶片」遥相呼应而不重复字面。备选取「各演各的」的口语顿挫，优雅度更低但临场感更强，供对照。
- 表现形式：维持现行 developVariant 显影。**一轮 act3-B（帧号 stagger 点亮 + summary 逐字洗色）倾向不放行**：stagger「从半程锚点反向走到 0」无先例挂载，需先排探针验证节点；为 bar 内 5 个字符的序号付一个验证轮不值——文案已经能把这一幕收住。

---

## act4 滚动驱动视频

行长校验：title 一行 zh ≤~12 字 ✓；intro 每行 nowrap、zh ≤10 字、维持四行 ✓；en 每行 ≤~38 字符 ✓。

### 方向 「光到现场」

- 文案 zh（`demoVideo.title`）：不动——`或许，|也能驱动视频？`（「或许」的谦逊是这一幕的语气资产，改写都是损耗）。
- 文案 zh（`demoVideo.intro`）：
  ```
  帧不再自行跳动，
  光随滚动显影——
  进是放映，退是倒带；
  胶片此刻在你手里。
  ```
  - 行长：7/7/9/8 字，全 ≤10 ✓
- 文案 en（`demoVideo.intro`）：
  ```
  Frames no longer run on their own,
  light develops as you scroll —
  forward is projection, back is rewind;
  the reel is in your hands now.
  ```
  - 行长：32/29/37/27 字符，全 ≤38 ✓
  - 不对译：zh 行2「光随滚动显影」用显影（develop）语汇，en 行2 直取同词 develops——两语言在这一个词上接头，其余各走各的句法（zh 四字顿「进是放映，退是倒带」；en 用 forward/back 的名词化对仗）。
- 为什么这样更优雅：一轮 A 首行「一行 JSX」是电报开场，且这一幕的主角不是代码（代码在下方的 code 块里，不需要 intro 再代言）。v2 首行「帧不再自行跳动」先否定一个默认预期——视频本该自己播，这是可核对的常识；次行给出替代机制（滚动擦动它），「显影」一词同时回扣本幕副标题的逐字显影机制与 act3 的收尾显影，三幕共用一个词族。第三行四字顿是全案唯一允许的对偶，因为「进/退」「放映/倒带」的对偶本身就是 scrub 可逆性的形式化。末行与 act5-A 标题「灯亮了,它在你手里」隔幕押韵（「在你手里」出现两次：act4 末行、act5 标题）——观众滚到 act5 时这个词已经听过一遍，收束更有回响。若觉得押韵太刻意，末行备选：`这一秒,由你擦过。`
- 表现形式：维持现行（行级 blur 显影 + 逐字暖色带）。一轮 act4-B（色带锚定视频帧进度）维持一轮判断：收益落在观众未必察觉的同相性上，不推。

---

## act5 Cinema Entrance

行长校验：title zh 单行 nowrap ≤12 全角字（567px@46px）✓；en 两行 balance ✓；subtitle 两行、每行 ≤~20 字 ✓（`\n` pre-line 断行）。

### 方向 A 「灯亮了」（对仗保留 + 首行加呼吸）

- 文案 zh（`scene5.title`）：`灯亮了,它在你手里`（8 字 ✓）
- 文案 en（`scene5.title`）：`Lights up — it's live in your hands`（36 字符，两行 balance ✓）
- 文案 zh（`scene5.subtitle`）：`你拖完的,是 drag;\n这一页,是 scroll。`
  - 行长：行1 8 字 / 行2 7 字 ✓
  - 说明：一轮 A「你拖完的，是 drag；你滚到的，是 scroll」用户未反对——保留对仗骨架，但把行2 的「你滚到的」换成「这一页」：观众此刻正在滚的这一页自己出庭作证，比第二个「你」更准，也避免「你」字两行连用。若用户更偏爱严格对仗，回退一轮原文即可（两版都合规）。
- 文案 en（`scene5.subtitle`）：`What you dragged is drag;\nthis page is scroll.`
- 为什么这样更优雅：现行「两种模式,一套体系」是分类学概括，说的是框架而不是此刻。v2 标题先接住本幕的熄灯机制（灯真的亮了一次——可核对），再落到「你手里」的手机（drag 刚被拖完——可核对），与 act4 末行押韵收束全页。副标题的对仗不再解释「同一套时间轴」的机制（观众刚在 act2–4 看了三幕机制，不需要第五幕再讲一遍），只点名两件事的存在。
- 表现形式：维持现行（CSS 分方向 delay 串行 + 镜像退场），一个字机制不动。

### 方向 B 「镜号落款」（备选，语汇更文雅、空间指代需注意）

- 文案 zh（`scene5.title`）：`第五镜:双模式同框`（9 字 ✓）／ en：`Shot five: both modes in frame`
- 文案 zh（`scene5.subtitle`）：`左:drag,已被你拖完\n右:scroll,正被你滚着`（每行 10 字 ✓）／ en：`Left: drag — already dragged\nRight: scroll — being scrolled`
- 为什么放在备选：「第五镜」的场记语汇比 A 更文雅，但「左/右」在 ≤900px 窄屏纵排布局下指代失效，需要按断点换文案（额外机制负担）；且「已被你拖完/正被你滚着」的时态对仗虽巧，「滚着」一词偏口语。若用户看重落款感可选 B，但需接受窄屏文案分支。

**推荐：A**。

---

## 先行裁决（随本提案一并表态）

1. **删死 key `demoVideo.desc`**（zh.ts:174 / en.ts:180，全站零挂载；其核心句「滚动即时间轴」已由 act4 新 intro 行2 覆盖）——**建议删除**。
2. **act2-B（九 caption 各演自己的 preset）**——**倾向放行，但文案定稿后单独排期**。只动框外 caption 行，不碰 08-12 裁决的 codecard 内部；落地前按现行 SELECTION_MS 锚点密采验证切换窗不撞车。
3. **act3-B（帧号 stagger + summary 逐字洗色）**——**倾向不放行**。stagger exit 从半程锚点起步无先例挂载，需先付一个探针验证轮；收益（bar 内序号点亮）配不上这个成本，act3 用文案即可收住。

---

## 五幕串读（act1 现行 + 本轮推荐组合）

> **act1（不动）** 像导演一样,控制每一帧 —— 把每一次位移,都交给被编排的时间。
> **act2** 挑一个动词,一字，一镜 —— 四十余种进场预设置于库中,改一个 prop,便换一种登场。
> **act3** 六镜轮番登场,时间轴只有一条 —— 它们共用一条胶片。
> **act4** 或许,也能驱动视频？ —— 进是放映,退是倒带。
> **act5** 灯亮了,它在你手里 —— 你拖完的,是 drag;这一页,是 scroll。

暗线：**胶片**一词在 act1（现行「滚动是胶片」）立、act3 回（「共用一条胶片」）、act5 收（灯亮后胶片散场，只剩你手里的实物）；**在你手里**在 act4 末行与 act5 标题两度出现，把全页从「看它演示」交到「你刚做完」。「你」全页出现四次（act3 summary 一次、act4 末行一次、act5 标题+副标题两次），全部在动词之后，无一处作主语开头。
