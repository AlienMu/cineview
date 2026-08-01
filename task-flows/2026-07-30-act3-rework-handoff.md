# 五幕返工 · 交接归档（2026-07-30）

分支 `codex/drag-release-dual-gate`。站点五幕拖拽时序体验返工。
**范围铁律：只改 `site/`，不动 `src/` 框架代码。**

---

## 一、当前编译状态：失败

`site/src/components/temporal-drag/SceneSync.tsx` 引用了不存在的 `ClipDemo` 组件，
`tsc --noEmit` 报未定义。另有一批 `DEMO_*` 常量已声明未使用。
**新会话第一件事就是补完它**（见 §四.1）。

---

## 二、已落盘且真机实测过的

### act2 `SceneSlate.tsx` / `clapperboard/ClapperboardCanvas.tsx`
- 倒计时 **216ms/字 → 720ms/字**。根因不是数值写错：`BOARD_ENTER_MS` 原本在
  `SceneSlate.tsx` 本地声明为 2400，而 canvas 把每个节拍写成它的**分数**（0.09）。
  授权时长在一个文件、分母在另一个文件，当初有人把 8000 改成 2400 适配 `scale: 10`
  时钟，倒计时就被静默重定价，两边都不报错。修法：canvas 用毫秒授权每段并导出总和
  `BOARD_ENTER_MS`，`SceneSlate` 反过来消费 —— 算术只能在一处陈述。
- `LIGHT_GATE_MS` **2800 → 1600**。被 tSelf 5200 的上限逼出来的，不是独立调参：
  倒计时要 3×720 = 2160ms，旧的 2800+2400 分法塞不下。1600 + 3600 = 5200 不变。
  锁定顺序（灯光入场 → 再出现 canvas）靠把 `s02-light-set` 同步缩到 1600 保住。
- 灯组移到场景级（原来在 `<main>` 里被舞台上边缘硬裁，造成「内容明显分层」）。
- board 补了框架 `infiniteAnimation`（±0.6% scale，9s 循环）。
- `HeaderHUD` / `FooterBar` / eyebrow / title 已删。**用户明确：不恢复。**
- 灯光色相与亮度递进真机验证过成立（A 暗铜 → N 暖白，只用暗金），不要动。

### act3 `SceneSync.tsx` / `styles/temporal-scenes-03-05.css`
- 三轨占屏 **66.2% → 18.3%**，单轨 **1.73:1 → 6.72:1**。
  `.s03-tracks` 从 `repeat(3, minmax(0,1fr))` 改成 `repeat(3, clamp(30px, 12cqw, 56px))`
  —— 轨高改由**宽度**导出，和它自己的边框/标签/齿孔同一把尺子。原来三层 `1fr` 串联，
  屏越高轨越粗而 `cqw` 细节不跟着长，这是「纵向拉伸」那类问题的根子。
  跨 390×844 / 390×640 / 430×932 三视口验过，比例恒定 6.72 / 6.72 / 6.73。
- 版面裂缝修掉：`.s03-cut-stage` 行序曾被我改成 `minmax(0,1fr) auto`，导致预览窗顶天、
  bed 贴地、中间几百像素纯空。现为 `auto auto` + `align-content: center`，两块紧贴居中。
- 预览窗 `aspect-ratio` **2.35:1 → 1.62:1**，414×896 下实测 384×237（原 163）。
- clip 过冲实测 **−36 → +7.88 → 0**，三片段按 300ms 错开，峰值帧 11/29/47。
  逐帧：`−13.1 → −7.5 → −1.3 → +4.2 → +6.8 → +3.7 → +0.5 → 0`。
- V2 字幕轨也加了过冲（`SUBTITLE_OVERSHOOT_PX = 6`，机制同 V1）。
- 两阶段已拆：stage 1 = clip 原地出现（`opacity` + `scale 0.9→1`，**无 x 位移**），
  stage 2 = 独立的 `-demo` lane，在所有 clip 展示完之后才启动。`clipDemoLaneProps` 已写。

### act4 `ProgressRing.tsx` / `aperture/*` / css
- 日冕已删：`corona/CoronaCanvas.tsx`、`corona/coronaField.ts` 两个文件，
  以及 `ProgressRing.tsx` 的四处引用（导入、`CoronaStage`、`animateId`、shell）。
- 光圈叶片已建：`aperture/apertureBlades.ts`、`ApertureCanvas.tsx`、`ApertureIris.tsx`。
  占日冕原槽位 1300+2400，tSelf 3700 不变。单一自由度（镜筒曲柄角），
  `spin = 0.42rad × p` 匀速转，`stop = sin(spin/total × π/2)` 是曲柄滑块投影，
  开口由它 lerp 出来 —— 缓动来自连杆几何不是贝塞尔。六条硬边**向内**弓。
  §8.4 规避是结构性的（无任何 `clip-path`/`ctx.clip()`/`overflow`/混合模式），
  承重常数 `OPEN_INRADIUS = cos(π/6)`。数值自证：顶点半径吻合镜筒到 6 位小数、
  环带零未覆盖像素、贝塞尔中点误差 5.7e-14。
- CSS：`.s04-clock > [data-cineview-animate-id='s04-aperture'] { z-index: 2 }`
  **属正确性不是装饰** —— 不加会被 94% 不透明的 `.s04-eclipse__disc` 完全盖住。已落。
- 日冕的两条 CSS 类已删。

### act5 `SceneCut.tsx` / `Auditorium.tsx` / css
- `CREDIT_START_MS` 0 → 1000，`THE_END_START_MS` 3900 → 3300。
  THE END 前的死等 **1700ms → 100ms**，整幕 5200 → 4600ms（反而缩短）。
- 「字幕没有淡入」是误判：淡入 lane 本来就有（`s05-credit-fade-*`，120ms，五条都有），
  只是 0–3 的淡入窗口在**离屏时已走完**（上屏帧在 lane 时钟约 898ms，
  旧窗口 0–120/250–370/500–620/750–870 全部早于它）。修的是偏移不是淡入。
- `SEAT_ROWS` [7,6,5] → **[17,15,13]**。上限由 flex shrink 决定（座位是 flex item 带
  `flex-shrink: 1` 和显式宽高，塞不下时浏览器只压宽度、高度不变，会破掉 1.5 恒定比例）。
  硬上限 18/16/14，故意每行留一个余量。
- 银幕 `min(66cqw,420px)` → `min(78cqw,480px)`；三档座位宽高同比缩小，每档保持
  height = width/1.5。缩小后 shrink 上限升到约 24/21/18，所以还能再加密。
- 全子树扫 `|m11 − m22| > 0.005` 返回空表：act5 无任何非等比缩放。

---

## 三、框架事实（已验证，不要重新推导）

- 拖拽驱动只认十个属性：`opacity, x, y, scale, rotate, rotateX, rotateY, skewX, skewY, filter`
  （`animateInterpolation.ts:17-27`）。`scaleX`/`scaleY` 授权了会被**静默丢弃**
  （`useAnimateDrag.ts:767-779` 是按 key 逐个构建 style，不是展开 variant）。
- **数组关键帧在拖拽 lane 上会让元素永久不可见**：lane 用单标量走
  `lerpTransformValue(initial, animate, p)`，从不读 `transition`，
  给它 `opacity: [0,1]` 会字符串匹配成 `"0,1"` 再被 `parseNumericValue` 读成 0。
  act3 和 act5 都实测过。所以「淡入前 10% 完成、位移走满全程」必须靠两层 lane 预算相乘。
- **嵌套 lane 不共享 p** —— 这是过冲能实现的根据。
  `resolveEnterLocalProgress = clamp((m − calculatedDelay) / enterDuration, 0, 1)`：
  所有 lane 读同一个元素时钟 `m`，各自按己的 delay/duration 换算。
  嵌套 transform 相加，两条**首尾相接**的窗口 → 合成非单调。
  踩过的坑：两条窗口若**并发**（外层给全长 500 而中层 375→500），两条斜坡相抵，
  合成退化成单调 `−36 → 0`，实测峰值 0.00。外层必须在中层开始前走完（375ms）。
- 阈值 `= 0.32 − |v|/1200 × 0.17`。`minRatio 0.15` 是渐近下限，**p ≤ 0.15 任何速度都不 commit**。
  实测分叉：快放 (0.1386, 0.1540)，慢放 (0.290, 0.331)。
- settle 时长 `= 剩余进度 × 800`，**不含释放速度**。所以 flick 越快落定越慢：
  2036px/s 在 0.16 松手要 682ms，631px/s 在 0.52 松手只要 390ms。
- 授权的 `transitionDuration: 720` **到不了渲染 lane**，实际是 800
  （`DragSceneStack` 的 `cloneElement` 既不传 `slideDuration` 也不传 `sceneTransitionDuration`，
  `helpers.ts:229` 与 `:158` 双双回落 `DEFAULT_SLIDE_DURATION`；
  全 src 里唯一读 720 的 `CineView.tsx:99` 只喂 `setAnimating(false)` 定时器）。
  V1 真机 + V2 源码双路径确证。**用户明确：这是框架侧，不要动，越界。**
- 测量工具：Playwright 只能从 `site/` 目录内解析；dev server 已在 4000；
  `page.screenshot()` 会卡住渲染器约 450ms，**测时序时不能同时截图**（第一遍数据会全废）。

---

## 四、未完成（按优先级）

1. **`ClipDemo` 接缝元素** —— 编译阻塞项。
   clip2 向左推 `DEMO_PUSH_FRACTION = 0.09`（左缘 0.34 → 0.25），clip1 右缘 0.31，
   重叠带 = 0.25–0.31 共 6%（`DEMO_SEAM_LEFT/WIDTH` 已定）。
   循环 5.2s，关键帧 `[0, 0.16, 0.34, 0.62, 0.78, 1]` = 静止/推入/**在重叠处停住**/退回/静止，
   那个 hold 是给接缝元素被看见的时间。
   用户原话：「被拖拽的时候，故意拖到重叠位置，然后在重叠交界处出现新的元素。
   然后拖拽到非重叠又消失。」
   **待用户说明**：接缝那个新元素具体是什么。未收到答复前按「转场标记 + 重叠区高亮」做。
2. **clip 选中态** —— 用户原话「轨道选中不是应该有选中效果吗」。现在三轨三片段全静态。
3. **act1 `SceneRolling.tsx` 四项**（这一幕是 `SceneRolling` 不是 `SceneSlate`）：
   - `:260` 硬编的 `<h1 className="s01-title">CineView</h1>` → 具体时间文本
   - 下方加月份
   - **C 和 V 两个字母**单字颜色渐变后还原的持续动画（拆 span 才能单独驱动；
     入场完成后启动、退场淡出，不做永不停的自走 loop；V 比 C 延后 300ms 错开；
     颜色只在暗金域内走，§8.4 色相约束）
   - eyebrow / 字标 / 按钮组三者间距太挤（用户截图指的是 act1，不是站点首页 hero）
   - 已做好的部分别动：秒针/分针已改成框架 `infiniteAnimation` 的机械步进
     （`createMechanicalRotation(60)`，每格停 92% 再跳，秒针 60s、分针 3600s 一圈），
     刻度门控已成立（`readDialEpoch()` 只读一次系统时间，`tickSweepDelay` 从指针角推出
     60 个刻度延时，`mod 360` 重基，指针下方那格延时为 0 —— 刻度是指针的因）。
4. **act3 预览窗是全黑空板** —— 384×237 是整幕最大元素，里面只有极淡扫描线和 `PGM` 标签。
   它是 W6 的 `<video>` 挂载点（`data-s03-preview-surface`），现在是占位状态。
   整幕读起来「空」的主因。
5. **act3 clip1 入场有 63% 在离屏走完** —— 实测首帧 `x = −13.14` 而非 −36
   （clip2/clip3 首帧完整）。成因 `CLIP_START_MS = 600` 太早。
   往后推会连带影响 A1、V2 的排布，需要重排整幕时序，**未擅自动**。
6. **整幕占屏仍偏空** —— 414×896 下内容约 412px，上下留白 410px。
7. **删掉 cron `32413254`** —— 每 5 分钟触发同一段 V1 验收提示词，本会话被它吃掉几十轮。

---

## 五、工作方式（用户明确要求，违反过多次）

- **动作轮只发工具调用，不输出任何文字；汇报轮只说话不调工具。** 这是铁律。
- 不要用 `tsc` / Prettier 通过冒充「验证通过」—— 那只证明能编译。
  视觉改动必须 **414×896 真机截图并实际打开看**，报实测数字。
- 不要为了一个待确认的小问题阻塞整批工作：实现细节自己拍，记录下来等用户回归。
  只有影响面超出站点、或不同答案会做出完全不同东西的，才停下来问。
- 派 subagent 的教训：写成「你去查清楚然后改」的卡有 6/7 空转（探查完就停），
  必须写成「数字在此，照改」并明确「只读不改视为失败」。
