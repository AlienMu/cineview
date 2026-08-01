# Task Flow — /drag 五屏整体重设计（2026-07-29）

> **本文档是唯一交接来源。** 新 agent 只读本文即可接手任何一个 act，无需回溯对话。
> 每条决策都带「为什么」与「不能怎么做」——后者是返工成本最高的部分，务必先读 §8。

---

## 0. 一句话现状

设计已全部封闭，实现尚未开始。五个 act 的 lane 预算表已定（§4），
两项框架依赖已移交框架修复组（§6），一项待回归（§7）。

---

## 1. 全局时间模型（最关键的前置，先读这节）

### 1.1 `scale` 的真实语义（已实测确认，非推断）

消费点：`src/utils/dragTimelineMapping.ts:86-88`

```js
const msPerDragPercent = config.unit === 'time' ? config.scale : (tSelf * config.scale) / 100;
return Math.min(tSelf, Math.max(0, finitePercent * msPerDragPercent));
```

- `scale` 属于 `SceneDragConfig` / `DragModeConfig`，**直接喂元素时间轴**，不是 render 轨。
- `unit: 'time'`（默认）→ `msPerDragPercent = scale`，单位 ms。默认 `scale: 10`。
- `unit: 'percent'` → `msPerDragPercent = tSelf * scale / 100`，与绝对 ms 解耦。
- `Math.min(tSelf, ...)` 兜底，所以超出不会越界，**改 scale 不会导致视觉错误**。

### 1.2 本次决定：`/drag` 改用框架默认 `scale: 10`

`site/src/components/temporal-drag/TemporalDragExperience.tsx:353` 现为 `scale: 100`，**改为删除该覆写**（回落默认 10）。

换算表（`scale: 10`）：

| 拖拽 %             | 元素时钟 |
| ------------------ | -------- |
| 15%（commit 最早） | 150ms    |
| 30%（典型）        | 300ms    |
| 45%（大幅）        | 450ms    |
| 100%（满程）       | 1000ms   |

### 1.3 编排原则（用户原话定调）

> 「拖拽只是动画执行的一部分，还有一部分是自动补完，相辅相成。」
> 「即使拖拽到了 100%，也需要留给剩余的动画时间。」

采用 **编法 B**：

- **0–300ms = 起手反馈区**。每个 act 必须有 1–3 条 lane 落在此区间内，保证手指一动就有回应。
- **300ms 之后 = 主体**，由框架 settle 自动补完（`useElementTrack` 的 `release.mode === 'settle'`，从当前 elapsed 继续推进到 T，**不是从 0 重播**，见 `useElementTrack.ts:26-27`）。
- **不设总时长上限。** 用户裁决：「压缩时间代表动画观赏不佳」「叙事长，只要内容够多也能接受」。

### 1.4 「5 秒上限」的正确形式（曾被误解，已修正）

用户原话是「30% 松开手指后剩余时间不超过 5 秒」，但后续澄清为：

> 成本不是时长，是**空等**。

**正确约束：任一时刻画面上必须有正在发生的动画；不允许出现「全部 lane 已结束但场景未切走」的静止段。**

据此重新审视，只有 act5 存在真空洞（5800–7500ms 影厅已演完、THE END 未开始），
解法是给影厅加持续动画，**不是**把 THE END 提前。act3 的 5200+6000=11 秒合规，因为无一帧空等。

### 1.5 通用动画规则（全站适用）

1. **淡入前 10% 完成，位移走满全程。** 现状是 opacity 与 y 共享同一 duration 曲线，字在半透明状态下一路飘上来，显虚。改为 per-property `times`：
   ```js
   opacity: [0, 1], times: [0, 0.1]   // y 仍跑满全程
   ```
   适用：act5 credits、act3 字幕轨、所有位移+淡入组合。
2. **`infiniteAnimation` 关键帧必须从 `enterAnimation` 的落点出发。** 写 `opacity: [1, 0.9, 1]`，不是 `[0.88, 1, 0.88]`。act2 六层曾因此在交接帧跳变，实测 beam 0.119 / spill 0.180 / pool 0.140。
3. **全部改用绝对 delay，禁用 `waitFor`。** 理由见 §8.2。
4. **带 `infiniteAnimation` 的 `<Animate>` 会多渲染一层匿名 `motion.div`**，该层默认 shrink-wrap 到高度 0，百分比位移解析成 0px（动画在跑但不动）。CSS 必须给该层补 `position: absolute; inset: 0`。已知踩坑：`.s02-light`、`.s04-streams`、`.s02-clapper`。

---

## 2. 全局改动

| 项             | 动作                                                                   |
| -------------- | ---------------------------------------------------------------------- |
| 顶部 HUD       | 全部删除                                                               |
| 底部 FooterBar | 全部删除                                                               |
| 场次标签       | 全部删除（`s01`/`s02`/`s03`/`s04`/`s05` 五个 slate + `01 ROLLING` 等） |
| act2 取景框    | 删除 `.s02-light__viewfinder`（含 `::before`/`::after`）               |
| `waitFor`      | 全站拆成绝对 delay                                                     |
| `scale: 100`   | 删除覆写，回落默认 10                                                  |

> ⚠️ 删场次标签会**断掉所有 `waitFor: 's0N-slate'` 链**（act4 的 label/main-timecode/equation、act5 的 credits×5 + the-end）。这是「全部拆绝对 delay」的直接动因，不是可选优化。

---

## 3. 各 act 设计决策

### 3.1 act1 — 校准表盘

**立意**：指针是刻度的**因**。序入不是编排出来的假象，是机械动作的自然结果。

- 圆圈 + 指针**先同时**入场。
- 指针从**系统时间秒针角度 θ₀ 起步**，顺时针转满 360° 回到 θ₀（**起点即终点**，闭环，系统时间从第一帧就是对的）。
- 指针扫到哪根刻度，哪根刻度亮。
- 指针是**活的时间**（继续跟随真实时钟）。
- 退场 = 倒放。
- 删除 subtitle。
- 语言切换按钮（`LangToggle`）从 `App.tsx` 顶层**移进 act1 的 `<Scene>` 内并包 `<Animate>`**。

**刻度 delay 公式**（60 根，各自独立 `animateId`，绝对 delay）：

```
SWEEP_MS = 3000
θ₀ = 系统时间秒针角度
tick N 的 delay = SWEEP_MS × (((N × 6 − θ₀ + 360) mod 360) / 360)
```

`mod 360` 保证从 θ₀ 往后数一圈。每根间隔 3000/60 = 50ms，所以**任何 θ₀ 下 300ms 内都会亮约 6 根**，起手反馈自动成立。

> ❗ **禁止带回方向扇区高亮**。详见 §8.1 —— 那才是历史「亮右弧」的真凶，分段序入是被连坐的。

### 3.2 act2 — 打板

- **删除 `.s02-light__spill`**。实测：隐藏 spill 使 band-vs-floor 亮度差从 7.39 降到 **3.76**，优于把它拉长得到的 4.94。纯收益，不会让「分层台阶」回归。
- `haze` / `pool` **去掉 scale，只留淡入**（原为 1.14→1 / 0.78→1，会看到渐变边缘扩张，读作「蒙版」）。
- **退场预算改为 enter 的 40–50%**（原 380–700ms vs enter 3400–7000ms，差 10 倍，drag 下几乎一帧灭掉）。落地值见 §4 act2 表：beam 1920 / pool·haze·bokeh 1960 均为本层 enter 的 40%，set 480 为 43.6%（gate 压到 1100 后随之从 720 下调，720/1100 = 65% 已出界；详见 §4 act2 表下的 set exit 说明）。
- **ACTION 换 7×9 双格笔画字模**（原 5×7 单格，笔画/字高 = 1/7 ≈ 14%；电影字卡通常 20–25%，双格为 2/9 ≈ 22%）。纵向加高**免费**，见 §8.3。已落地：六个字模每行宽恒为 7、共 9 行，笔画由 2×2 连通块构成（居中竖干 T/I 为 3 格宽——7 是奇数，双格竖干无法居中，偏心竖干在点阵里读作缺陷）。
- **ACTION 六字母同色系亮度梯度**（不破「暗金不要青色」decree）：
  ```
  A 96,70,34  → C 150,112,54 → T 190,146,74
  → I 216,162,74 → O 236,215,150 → N 245,238,220
  ```
- **粒子保持成字，绕圆改随机游走**（现为每粒子绕自身目标画圆，有周期性；改为无周期游走，像浮在空气里的尘）。
- **装饰：上下双轨刻度 + 外围散落金点。砍掉两侧对称装饰线** —— 理由见 §8.3（width 是绑定维度）。落地结构：两条轨各 25 个刻度位，每 4 个为一个长刻（长刻 = 主点 + 2 段内向延伸，短刻 = 主点 + 1 段），单轨 57 点、双轨 114 点，外加 22 颗散点 = 136。刻度向内（朝字）延伸，向外会把下轨再压低 0.019 且无可读性收益。

### 3.3 act3 — 剪辑台（**重写，非修改**）

**删除 5 条代码胶片（`STRIPS`）的全部 15 条 lane。** 用户已知其中 6 条上不了屏；随 strips 一并消失。

**布局**（390×844）：上部预览窗 + 下部时间线床，**无标题带**。

```
┌──────────────────────────┐  0
│                          │   留黑 ~60px
├──────────────────────────┤  60
│  ┌────────────────────┐  │
│  │   预览窗 390×160    │  │   宽银幕画幅（2.35:1 取向）
│  └────────────────────┘  │
├──────────────────────────┤  280
│ 00:00:00  00:00:01 00:02 │   时间标尺
├──────────────────────────┤  330
│ V1 ▐███▌ ▐██▌  ▐████▌   │   视频轨（scrub 缩略图）
│ A1 ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿  │   波形轨（canvas，纯视觉）
│ V2 ▐░░▌  ▐░░▌  ▐░░░▌    │   字幕轨（模糊字）
├──────────────────────────┤  620
│         │ 00:01:14        │   播放头竖线 + 时间码
└──────────────────────────┘  844
```

**三条轨道各有独立拖拽语义**（同一手势指挥整条时间线）：

| 轨      | 语义             | 实现                                           |
| ------- | ---------------- | ---------------------------------------------- |
| V1 视频 | 拖拽控制视频进度 | `AnimateVideo` scrub（依赖 §6.1）              |
| A1 音频 | 拖拽控制滤波     | **纯视觉波形，canvas**。音频已砍，见下         |
| V2 字幕 | 拖拽字幕跟着跳动 | 三词「剪辑 / 调度 / 控制」，**模糊不可辨风格** |

- **音频：不做。** 曾设计 Web Audio 合成 WAV + 低通滤波，用户裁决改为纯视觉滤波表达。
  - 附带结论（若将来恢复）：`<audio>` 的 `playbackRate` 不接受负值，反向播放需 Web Audio 反转 buffer；音频 scrub（`currentTime` 每帧跳）听感是断续爆音，不可用；网页自动发声需用户手势且须提供静音控制，建议默认静音。
- **「调度」不再是静态标题**，并入 V2 字幕轨滑过。
- **波形用 canvas 而非 CSS 竖条**：波形本质是连续曲线，离散竖条会丢掉滤波的平滑感；40–60 个 `motion.span` 各自订阅的成本也高于单 canvas。
- **收尾**：预览窗播完整 6 秒，播放头 / 时间码 / 三轨全部跟随。**视频自身为时钟**（`requestVideoFrameCallback`，rAF 降级读 `video.currentTime`；`timeupdate` 约 250ms 一次太粗）。理由：视频是唯一有真实时间的东西，让它当时钟则不会漂移。
- **预览窗改为站点自持 `<video>`**，不走 `AnimateVideo` —— 因为它需要 scrub + 播放两种行为，而 `AnimateVideo` 的定义是「progress 是唯一权威，progress 一动就 pause 并对齐」。V1 轨道那三个只需 scrub 的缩略图仍用 `AnimateVideo`。

> 🔒 **铁律（用户原话「这是铁律」）**：收尾播放期间用户拖拽 → **暂停 + 瞬跳终局 + 走退场，无中间态**。
> 具体：`video.pause()`；`video.currentTime = duration`；播放头瞬移到右端；时间码瞬跳 `00:00:06:00`；三轨置完成态；然后框架接管退场。
> **不要做平滑过渡** —— 任何「平滑跳到终局」都会和紧接着的退场动画抢同一批属性。

**持续动画**：波形流动（canvas rAF）+ 播放头呼吸。
波形 canvas 在 `<Scene>` **内部**，有 phase，**必须在 act3 离开时停 rAF**（不同于 `tp-ambient` 那种常驻 chrome）。

### 3.4 act4 — 日全食

**立意**：不是进度环，是一次日全食。手指推着月影走，推到完全遮蔽时松手，日冕炸开。跟手是过程，释放是回报。

- **环**：跟手段由 `dragProgress` 驱动弧长；**释放后由框架 settle 自动补满 360°**。
  - 关键：补满**不是** progress 的函数（松手时 progress 可能只有 0.3，环却要跑满）。这正是 settle 的语义，所以环走框架 `Animate` enter lane 即可，**站点不需要自己写补满逻辑**（待实现时验证）。
- **日冕**（参考日全食照片：放射状丝，长短不齐、亮度不均，向外渐隐）：
  - canvas 粒子系统。几十条从圆边缘向外的射线，各随机长度/宽度/亮度，向外 alpha 衰减；每条缓慢向外漂移+淡出，边缘不断补新丝。
  - `conic-gradient` 做不出来（只能规则辐射），必须 canvas。
  - **环补满后才出现**（delay 排在环 enter 结束之后）。
  - phase 门控 rAF。
- **配色：整个 act4 从 teal 换成「深夜里的荧光绿」**（高饱和偏冷绿，如 `#39ff88` 一族，非墨绿）。
  - 替换范围：环、日冕、时间码、`SMPTE TIME CODE` 标签、背景三列时间码流、刻度尺 —— **全部**。
  - 理由：日冕炸开会主导画面，周围留青会读成两个色系打架；且暗金(act2) / 荧光绿(act4) / 红(act5) 形成清晰三段色彩叙事。
- **入场编排**：圆圈 + 时间码**同时**入场；背景三列时间码**从下往上**升起。
  - 入场位移与持续滚动都用框架 `Animate`：外层 `enterAnimation` 做位移，内层 `infiniteAnimation` 做滚动。两个 `y` 在不同 DOM 层，互不干扰。
- **删除 `TickBar` 整个组件**（20 根刻度 + 跟随 marker）。进度表达已归于环，留刻度尺会重复。

### 3.5 act5 — 影厅谢幕

**新时序（反转）**：字幕 → 打灯 → 舞台背景 → THE END。

原时序是「灯先亮再出字」，新时序是「字先在黑暗中浮现，灯才打亮」—— 真实剧场谢幕顺序（演员先在暗处就位，追光才亮）。

- **删除主标题**（五个词五条 lane 全删）、删 slate、删 kicker（`FINAL CUT`）。
- **「字幕」= 现有五条 credits**（导演/剪辑/摄影/表演/主演），保持从下往上升起，套用 §1.5 淡入解耦规则。
- **舞台背景 = 电影院影厅**（用户原话「电影院的布局」），按纵深从远到近：
  - 银幕（正面亮矩形）
  - 侧墙（两侧向内收的透视线 + 吸音板竖向纹理）
  - 观众席（下方几排座椅剪影，只有轮廓）
- **打灯 = 放映机投影光束**，替换 `.s05-spotlight` 的顶部锥光几何。
  - 理由：影厅里出现舞台追光空间逻辑不对；且投影光束贴 CineView 之名，叙事闭合（片子放完了，光束还亮着）。
- **持续动画（新增，用于填补 5800–7500ms 空洞）**：光束尘埃流动 + 银幕微弱闪烁（像胶片放映抖动）。
  - **观众席不动** —— 影厅里真实会动的只有光束里的尘和银幕。

---

## 4. lane 预算表（实现直接照抄）

> 全部绝对 delay。0–300ms 为起手反馈区。

### act1 — tSelf ≈ 3240ms

| lane          | delay        | enter  |
| ------------- | ------------ | ------ |
| 圆圈 ring     | 0            | 420    |
| 指针 second   | 0            | 880    |
| 指针 minute   | 0            | 880    |
| 中心数字 01   | 60           | 460    |
| eyebrow       | 80           | 440    |
| 标题 CineView | 140          | 560    |
| 语言切换      | 200          | 400    |
| actions 按钮  | 300          | 460    |
| 刻度 ×60      | 见 §3.1 公式 | 各 240 |
| subtitle      | —            | **删** |

### act2 — tSelf = 5200ms（由 bokeh 层封顶，**不是** gate + board）

**以下为已落地并实测可跑的最终预算**（与代码 1:1，不是提案）。exit 一律取本层 enter 的 40–50%。

| lane                                 | delay              | enter    | exit    |
| ------------------------------------ | ------------------ | -------- | ------- |
| beam                                 | 0                  | 4800     | 1920    |
| spill                                | —                  | **删**   | —       |
| pool                                 | 160                | 4900     | 1960    |
| haze                                 | 220                | 4900     | 1960    |
| set（仅灯架，删取景框与 `02`）= gate | 260                | **1100** | **480** |
| bokeh                                | 300                | 4900     | 1960    |
| clapper canvas                       | **1100**（= gate） | **3560** | 900     |

**tSelf 是 `max(delay + enter)` 取遍全部 lane = bokeh 的 300 + 4900 = 5200**，由环境光层封顶。
`gate + board` 只是其中一条链（1100 + 3560 = **4660**），**不是** act 的时钟上限。这条区分很重要，
因为它决定了「board 差 40ms」是不是问题：**不是**。board 4660 结束时，环境光还有 540ms 在继续爬升，
这正是「board 出现后关键光仍在可测地变亮」的设计意图，末尾没有空等。

> ⚠️ **本节曾有一版写成「tSelf 5200 是 gate + board 的上限，所以 gate 只能是 5200 − 3600 = 1600」。
> 该等式已失效，勿据此把 board 补回 3600。** 它在 gate=1600 且 board=3600 的那一版里数值上恰好成立，
> 但把「环境光封顶得出的 5200」误读成了「gate+board 必须凑满的预算」。按它去补 40ms 会得到
> 1100 + 3600 = 4700，对不上任何一个有意义的数。

**gate 1600 → 1100 与 form 900 → 620 是同一次返工的两半**（「继续加快act2画板入场时间」）：

```
form 620 + settle 240 + 3×720 + reform 100 + clap 180 + word 260 = 3560  ← board，求和导出
gate 1100 + board 3560 = 4660                                            ← 派生量，非上限
bokeh 300 + 4900       = 5200 = tSelf                                    ← 真正封顶的那条
```

gate 是 board 眼中的纯等待时间，压掉 500ms 直接让第一颗粒子早 500ms 出现；form 压掉 280ms 让收敛本身
更快。两者相加即「入场」从 2500ms → 1720ms。**锁定顺序照旧成立**：gate 就是 `s02-light-set` 的 enter，
灯架 260ms 起、1360ms 完成，gate 1100ms 抬起 —— 260ms 重叠，与 1600/1860、2800/3060 两版完全一致
（重叠是 `delayMs` 的性质，与 enter 长度无关）。

**set 的 exit 随之 720 → 480**：全 rig 守「exit = enter 的 40–50%」可逆预算，720/1100 = 65% 会让退场
比它该完成于其中的滑动更长；480/1100 = 43.6%，回到其余四层所在的区间。

**新增 settle 240（「需要完全展示后才执行倒计时」）**：`form` 在此窗口被 clamp 在 1，粒子原地不动，
静止本身就是内容；倒计时锚点从 `FORM_END` 改挂 `SETTLE_END`，否则最后到位的粒子会立刻被征去组成
数字「3」，板子作为板子存在 0 帧。240ms ≈ 25fps 下 6 帧，够读成「定格」而非「迟疑」。
**这 240 是自身立意定的，不是用来凑总额的**——board 总额是求和的结果，自由随表移动，不需要凑整。

**gate 与 set 是同一个数字，代码里只有一份**：`ACT2_LIGHT_GATE_MS` 由 `SlateLightRig` 导出，
既作为 `s02-light-set` 的 `enterMs`，又由 `SceneSlate` 用作 clapper lane 的 `timeline.delay`。
不要在任何一侧写字面量 1100 —— 两处字面量各自「内部自洽」时，单独调任一侧都能让全部断言保持绿，
而实际效果是破掉「灯光入场 → 再出现 canvas」（灯变短 → 出现空等；灯变长 → 粒子在没打光的台上聚集）。

**board 预算同理只有一份**：`BOARD_ENTER_MS` 由 `ClapperboardCanvas` 以上面那张 ms 表求和导出，
`SceneSlate` 消费。禁止在 SceneSlate 再声明一个 enter 数字——这正是 倒计时太快 的成因（budget
8000 → 2400 时把每拍从 720ms 静默重定价成 216ms，两个文件都没有矛盾可查）。

**其余四层刻意不动**（4800–4900）：它们要活得比 gate 长，board 出现后关键光仍在可测地变亮，
这就是全 act 不读作「两步幻灯片」的原因。把它们跟着 gate 一起压短，会让「灯光无入场动画」复发。

原始六层参数存档（改前）：beam 0/6000/700、spill 90/5400/600、pool 160/6200/520、haze 220/6600/440、set 260/3400/480、bokeh 300/7000/380。
中间一轮（gate 2800 / board 2400）已废弃，勿回滚到该表。

### act3 — 剪辑序列 tSelf ≈ 5200ms，+ 收尾视频 6000ms

| lane       | delay              | enter                |
| ---------- | ------------------ | -------------------- |
| 预览窗框   | 0                  | 500                  |
| 时间标尺   | 120                | 400                  |
| V1 轨道底  | 200                | 400                  |
| V1 clip ×3 | 600 / 900 / 1200   | 各 500               |
| A1 轨道底  | 1500               | 400                  |
| A1 波形    | 1800               | 800                  |
| V2 轨道底  | 2400               | 400                  |
| V2 字幕 ×3 | 2700 / 3000 / 3300 | 各 500               |
| 播放头     | 3800               | 600                  |
| 时间码     | 4000               | 500                  |
| 收尾播放   | 5000               | 6000（视频自身时钟） |

### act4 — tSelf ≈ 3700ms

| lane                 | delay                 | enter  |
| -------------------- | --------------------- | ------ |
| 环                   | 0                     | 1200   |
| 时间码               | 0                     | 1200   |
| 背景三列（从下往上） | 100                   | 1400   |
| SMPTE 标签           | 240                   | 500    |
| 日冕                 | 1300（环 enter 之后） | 2400   |
| TickBar              | —                     | **删** |

### act5 — tSelf ≈ 5200ms

| lane                    | delay | enter  |
| ----------------------- | ----- | ------ |
| credit 1                | 0     | 1200   |
| credit 2                | 250   | 1200   |
| credit 3                | 500   | 1200   |
| credit 4                | 750   | 1200   |
| credit 5                | 1000  | 1200   |
| 投影光束                | 1400  | 2200   |
| 影厅银幕                | 1700  | 1800   |
| 侧墙                    | 1850  | 1900   |
| 观众席                  | 2000  | 1800   |
| THE END                 | 3900  | 1300   |
| 主标题 / slate / kicker | —     | **删** |

### 持续动画覆盖（防空等）

| act  | 静止风险段        | 补法                              | 状态 |
| ---- | ----------------- | --------------------------------- | ---- |
| act1 | 3240ms 后         | 指针继续走（活时间）              | 已定 |
| act2 | 尾段              | canvas 粒子随机游走 + 六层灯 loop | 已有 |
| act3 | 剪辑完成→播放交接 | 波形流动 + 播放头呼吸             | 已定 |
| act4 | 3700ms 后         | 日冕持续飘散                      | 已定 |
| act5 | 影厅演完→THE END  | **光束尘埃 + 银幕闪烁（新增）**   | 已定 |

---

## 5. 素材

| 项        | 规格                                         | 状态                 |
| --------- | -------------------------------------------- | -------------------- |
| act3 视频 | 6 秒 / 沙滩与月亮 / 黑金调 / 原始 1080p 10MB | 用户提供，**待转码** |

**必须转成全关键帧**，否则 scrub 必掉帧：

```bash
ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4
```

理由（`VideoFrameRenderer.tsx` 文件头注释）：H.264 的 P/B 帧是相对前帧的差分，seek 到任意帧须从最近 I 帧起逐帧解码。默认关键帧密度约每 250 帧一个，往回 seek 时解码线程吃满。这是编码问题，组件无解。dev 环境下 seek 延迟中位数 > 50ms 会 `console.warn`（`SLOW_SCRUB_SEEK_MS`，样本数 ≥ 6）。

**同时降到 720p**：全 I 帧会让文件显著变大（1080p 可能涨到 30–50MB）；且 V1 clip 块在 390px 竖屏里只有约 200×40px，1080p 解码成本全付、显示只用 2%。720p 全 I 帧约 8–15MB。

**首屏门控**：用 `preload={false}` + `Scene.assets` 后台队列接管（`AnimateVideoProps.preload` 注释明写「后场景可设为 false」），避免 act1 就等 10MB。另给 V1 一个 `poster` 占位帧。

**待定**：仓库放置路径。

---

## 6. 框架依赖（已移交框架修复组）

### 6.1 `AnimateVideo` 补齐原生能力

**已查证结论：drag 通路本来就是完整的，不存在断点。**「预设了但没做 tsx」的说法不准确。证据链：

1. `Animate.tsx:420-437` — drag 分支订阅 `dragResult.visualState`，把 `localProgress` 写进 `publicProgress`
2. `Animate.tsx:448-457` — `publicTimeline` 无条件带 `progress`，非 scroll 时 `driver` 直接是 `'drag'`
3. `animateTimeline.tsx` — `useAnimateTimeline()` 纯读 context，**mode 无关**
4. `AnimateVideo.tsx:66-71` — 调 `useAnimateTimeline()` 拿 `timeline.progress` 喂 `VideoFrameRenderer`
5. `VideoFrameRenderer` — `currentTime = progress × duration`

所以 **drag 下已能 scrub**。真正缺的是原生能力，`<video>` 上现在只落了 8 个属性（`src`/`muted` 硬编码/`playsInline` 硬编码/`preload`/`aria-label`/`width`/`height`/`style`）。

待补清单：

1. `forwardRef` 到底层 `<video>`（**用户裁决：命令式 ref，方案 A**；不加 `playOnComplete` 之类声明式糖）
2. `poster` 透传
3. `duration.exit` 透传（现仅 `enter`，`AnimateVideoProps.duration` 类型里也只声明了 `enter` → 退场无预算）
4. `exitAnimation` 支持（现仅 `NEUTRAL_ENTER` 恒等变体 → 退场不淡出）
5. 事件回调透传：`onEnded` / `onPlay` / `onPause` / `onTimeUpdate` / `onError`
6. `playbackRate` 透传
7. **所有权规则**：progress 变化 → 先 `pause()` 再 seek。
   - 用户定调：「progress 启动时自动暂停动画并重置进度到 progress 的进度，如果希望自己播放，大可直接写 video。」
   - 即 `AnimateVideo` 的定义就是 progress-scrub，**不是通用播放器**。
   - ⚠️ 但 drag 的 **settle 段**不该抢权（settle 期间 progress 每帧都变，会反复打断站点的 `.play()`）。框架已能区分（`state.mode` 有 `settling`/`incoming`/`outgoing`），规则应精确为「手势驱动的 progress 变化才 pause+seek」。scroll 下无 settle，可无条件生效。
8. `scrubRange?: [number, number]` — 把 scrub 区间与视频总长解耦。
   - 现在 `currentTime = progress × duration` 写死，无法表达「scrub 只覆盖前 6 秒，剩下 10 秒自己播」。
   - 改为 `currentTime = start + progress × (end − start)`。
   - 顺带解掉：只 scrub 中段 `[3,9]`、反向 scrub `[6,0]`。

### 6.2 未采纳的方案（记录理由，避免重提）

- **收尾播放用 6 秒 tween 推 progress 0→1**：那是每秒 60 次 seek、共约 360 次，直接撞流畅性要求。原生播放的解码是前向连续的，本就更优。
- **图片序列 / 雪碧图替代视频 scrub**：最丝滑（切图无 seek 延迟，6s×25fps=150 帧约 1MB），但等于在框架外自建 scrub。官网的职责是演示框架能力，不该绕开 `AnimateVideo`。备选：若真机实测 seek 顿，退到此方案。
- **`unit: 'percent'` + `scale: 1`**：能让预算与 scale 解耦、满程拖拽保证跑完每个 act。**用户明确不要** —— 「本身我就不需要确保拖拽跑完动画」。

---

## 7. 待回归项

### 7.1 指针 `infiniteAnimation` 角度重置

**根因**：`Animate.tsx` 的 infinite effect 在 `shouldRunInfinite` 变 false 时调 `dragInfiniteControls.stop()`，重新变 true 时调 `start(...)`，而 `start` **从关键帧序列第一帧重新开始**。指针的 loop 是 `rotate: [0, ..., 360]` 的 60 步机械序列，所以掉一次就回 0°。

**用户补充的关键观察**：重置发生在**释放后**，拖拽期间角度是跟手的。所以：

- 不影响拖拽体验，优先级低于原先判断。
- act1 退场倒放的起点在手指按下那刻就确定，是确定值。

**同类影响**（未逐一验证）：act2 灯光六层 loop、act5 REC 红点、act3 名字呼吸。

**未确认**：`shouldRunInfiniteState` 的具体触发条件（`useAnimateDrag.ts:457`），即「是否每次拖拽都发生」。

**修法方向**：框架侧在 `stop()` 前记住当前值，`start()` 时把关键帧序列旋转到从该值开始。
不走站点侧（`RunningHand` 自己读 `useAnimateTimeline()` 算角度）—— 那是在框架外重建框架能力，正是 AGENTS.md 规则 6 禁止的。

---

## 8. 「不要这么做」——踩坑档案

> 本节是返工成本最高的部分。动手前必读。

### 8.1 act1 刻度序入：历史「亮右弧」的真凶不是分段

**背景**：`DialTicks.tsx` 现有注释声称十二段延迟入场「在第一次 commit 窗口露出亮的右侧弧线」，故合并成一条 lane。**这个归因是错的。**

实测（`git show f164470:site/src/components/temporal-drag/DialTicks.tsx`）：

- 历史十二段版是 `delay: seg * 42`ms，**绝对偏移，不是 `waitFor` 链**
- `duration.enter: 240`ms
- 最后一段 `11 × 42 = 462` + 240 = **总长 702ms**
- 按当时 scale 100，702ms = 拖拽 **7%**；commit 在 15–32% 才触发
- → **序列早已 100% 结束，不可能被切成残缺弧**

真凶在同一版本里被一起删掉的方向扇区高亮（`git show f164470:site/src/styles/temporal-drag.css`，第 468–489 行）：

```css
[data-drag-direction='forward'] .s01-tick.is-forward-sector .s01-tick__bar {
  opacity: 1;
  background: var(--tp-accent);
  box-shadow: 0 0 7px var(--tp-accent-glow);
}
```

`forwardSector: angularDistance(tickAngle, 90) <= 30` → 90° 正是**右侧**，±30° 共 60° 宽；对侧压到 opacity 0.3。绑在 `[data-drag-direction]` 上，该属性**只在拖拽期间存在**。

**「亮的右侧弧、只在拖拽时出现」——症状逐字对上。**

结论：分段序入可以做，唯一硬约束是**不要把扇区高亮带回来**。

### 8.2 `waitFor` 已在本项目翻车两次

**根因**（记录在 `SceneCut.tsx:168-174`）：链式 start 解析为 `prev_start + prev_REGISTERED_duration + delay`，而 registered duration 是**被 stagger 拉长后的预算**，不是单项 duration。误差逐环累积。

- act5 实测：authored 950ms 的间隔实际跑出 **299ms**
- act3 strips 同类失败

**另一层问题**：act4 的 `s04-label` / `s04-main-timecode` / `s04-equation` 全是 `waitFor` 前一个 lane 再配**负 delay** —— 那是在用 `waitFor` 模拟绝对偏移，不如直接写绝对 delay。

**且** `waitFor` 语义是「等前者跑完」，act1 刻度若用它，第一根刻度会等指针转完整圈才出现，顺序完全反。

→ **全站拆成绝对 delay。**

### 8.3 act3/act2 canvas 的绑定维度：真机截图推翻了推断

`ClapperboardCanvas.tsx` 的 `boxOf()`：整画（板体 + ACTION 带）先求包围盒 `EXTENT`，再 `s = min(width*0.96/EXTENT.w, height*0.96/EXTENT.h)` **整体等比缩放**塞进 canvas。

所以 ACTION **不抢**板子的布局空间（它在 `y > 1`，板下方空区），但**加高 ACTION 带会抬 `EXTENT.h` → `s` 变小 → 板子跟着缩小**。这是缩放耦合，不是空间争夺。

**真机截图实测**（390 竖屏，画面宽 614）：板体 x≈55→600 几乎贴边；上下各留约 215/250px 空白。

→ **绑定维度是 width**，`s = width*0.96/EXTENT.w`。

| 装饰方向                                | 代价                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------- |
| **纵向**（ACTION 上下加装饰、加高字模） | **免费**。hull 高仅占画布约 59%，`EXTENT.h` 还能长约 1.6 倍才成为绑定维度 |
| **横向**（ACTION 两侧装饰线）           | 直接抬 `EXTENT.w`，整块板等比缩小，付真金白银                             |

→ 这就是「砍掉两侧对称装饰线、保留上下双轨刻度 + 外围散点」的依据，也是「ACTION 换 7×9 双格字模无隐藏成本」的依据。

> ⚠️ 未来任何尺寸/位置调整必须用**多帧探针**核对，不能只看落位帧。已知教训：`.s02-light__scene-number` 的 size×blur sweep 在落位帧显示 30–54px 全部 0% 遮挡，据此恢复 54px，多帧探针立刻打回 5.08%。绑定姿态是**开板**，不是落位。脚本：`scripts/act2-scenenum-overlap.mjs`。

### 8.4 `mix-blend-mode: screen` 图层不能加 `overflow: hidden`

`tp-ambient` 的教训：加了 clip 后，一旦施加 sink 变换（scale 0.96 + y 7%），clip 边缘自身从视口内拉进来，在 screen 混合层上渲染成一条硬亮线滑过画面（实测顶边 4 device px 内亮度 19.6 → 57.6）。

正解：**不 clip**。所有子层 overscan 20%，其渐变在自身边缘前就淡到全透明，本来就没有硬边界需要遮。变换要施加在**内层 rig** 上，不是混合层本身。

### 8.5 `container-type: inline-size` 下 `cqw` 看不到视口高度

`.s02-stage` 曾用 `auto auto` + `align-content: center`，board 行给固定 `clamp(420px, 138cqw, 580px)`。该高度**仅由宽度导出**，所以短视口上两行比 stage 更高，`align-content: center` 双向溢出。

实测 1280×720：stage 行约 602px 而内容想要 600+，`02 / SLATE` 被推到 y 55–75 压在 HUD 带（0–64）下面；HUD z46、label z2，`elementFromPoint` 在其中心返回 `tp-hud`。800px 高时同样 CSS 正常（label 在 y 95），所以表现为「视口相关」而非「坏了」。

正解：`grid-template-rows: auto minmax(0, 1fr)` —— 让溢出**不可能**，而非不太可能。

### 8.6 全局纹理层的强度会压死角落文字

`tp-texture__vignette` 原为 `rgba(0,0,0,0.72)` 终止stop，坐在 z50 压着 z10 的 chrome，把角落/footer 标签压到近黑。已改为 transparent 核心外推到 58%、边缘 stop 降到 0.46。scanline 同理从 0.7 降到 0.4（与 grain 叠加后读作浑浊 CRT 雾霾）。

---

## 9. 现存文件地图

| 路径                                                           | 说明                                                                               |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `site/src/components/temporal-drag/TemporalDragExperience.tsx` | /drag 根组件，`scale: 100` 在 353 行                                               |
| `site/src/components/temporal-drag/DialTicks.tsx`              | act1 刻度（现 1 条 lane 包 60 根）                                                 |
| `site/src/components/temporal-drag/SlateLightRig.tsx`          | act2 灯光六层 `LAYERS`                                                             |
| `site/src/components/temporal-drag/ClapperboardCanvas.tsx`     | act2 板子 canvas，768 行（**触碰时优先抽离，见 CLAUDE.md 自检 3**）                |
| `site/src/components/temporal-drag/particleField.ts`           | act2 粒子几何：`BOARD_GEOMETRY` / `WORD_BAND` / `WORD_GLYPHS` / `buildWordTargets` |
| `site/src/components/temporal-drag/AmbientStage.tsx`           | act1 环境光（全局 chrome，在 CineView 树外）                                       |
| `site/src/components/temporal-drag/TimeStreams.tsx`            | act4 背景三列时间码                                                                |
| `site/src/components/temporal-drag/ProgressRing.tsx`           | act4 环，127 行                                                                    |
| `site/src/styles/temporal-drag.css`                            | 全部样式，约 1750 行                                                               |
| `site/src/components/LangToggle.tsx`                           | 语言切换，现挂 `App.tsx` 顶层                                                      |
| `src/utils/dragTimelineMapping.ts`                             | `scale` 的唯一消费点                                                               |
| `src/components/Animate/AnimateVideo.tsx`                      | 113 行                                                                             |
| `src/media/VideoFrameRenderer.tsx`                             | 200 行                                                                             |
| `src/components/Scene/useElementTrack.ts`                      | settle / follow-finger 实现                                                        |

---

## 10. 项目硬规则（摘自 AGENTS.md / CLAUDE.md，与本任务相关的）

1. **规则 4：验收必须由独立 agent 在真实浏览器完成。** scroll/drag 交互路径不能由实现者自跑单测收口。单测全绿 ≠ 视觉正确。触及热路径的改动还须显式观测「并发滚动 + 多元素动画」下的掉帧/长任务。
2. **规则 6：站点组件禁止自建驱动。** 持续循环应走框架 infinite lane（`<Animate infiniteAnimation>`），以便 `shouldRunInfinite` 在场景离开其 phase 时冻结。
   - **已记录的合法豁免**：`tp-ambient` 四条 loop 与 `tp-texture__grain` —— 它们是挂在每个 `<Scene>` **外部**的全局 chrome，没有 phase 可被门控。**任何位于 `<Scene>` 内部的东西都不享有此豁免。**
   - act3 波形 canvas / act4 日冕 canvas 在 Scene 内 → **必须 phase 门控 rAF**。
3. **自检 3：触碰大文件时优先抽离而非追加。** `ClapperboardCanvas.tsx` 已 768 行；新增几何生成应放 `particleField.ts` 或新文件，canvas 只负责画（与 `buildWordTargets` 现有分工一致）。
