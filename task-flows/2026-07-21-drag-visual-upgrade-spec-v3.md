# /drag 视觉升级增补设计稿 v3

> 日期: 2026-07-21 | 状态: 设计规范（待审，先审后实现）
> 基于: v2（`2026-07-21-drag-visual-upgrade-spec.md`）+ 4 屏实拍评定 + 本轮新指令
> 范围: site/src/components/temporal-drag/* + temporal-drag.css + i18n（框架 src/ 零改动）
> 本轮核心新增:
> 1. **三幕节奏重构 + 扩为 5 屏**: action（打板）→ 拍摄内容 → 片尾
> 2. **新增第二屏 🎬 场记板 canvas 粒子**（纯程序生成，吃拖拽入场+退场 scrub）——
>    插在 01 之后，原 02/03/04 整体后移为 03/04/05
> 3. **Hero（首屏）重做** —— 现状太丑，四角"不明意味"元素重做成取景器仪表
> 4. **原 Scene 02 编排轴（新 Scene 03）修改后保留** —— 修语义不清 / 文字太小 / 中间太空，不删
> 5. **原 Scene 03 时间瀑布（新 Scene 04）增强** —— 现状简陋
> 6. **修两个技术 bug**: 动画未被拖拽 scrub（时长 vs dragTimeScale 不匹配）、还原是重跑而非原路退回

---

## 0.1 屏数与场景映射（本轮最终决策，全局重排）

场记板插入 01 之后成为新第二屏，现有 02/03/04 整体后移 → **5 屏**。

| 新序 | sceneId | className | 幕 | 主题 | 叙事偏重色（非独占，见 §2 调色台） | 来源 |
|------|---------|-----------|----|------|---------|------|
| 01 | `rolling` | `--01` | ACTION | 显影盘 / 开机校准 | 琥珀（校准基准）+ 暖白（文本成形） | 现有 01 重做 |
| 02 | `slate` | `--02` | ACTION | 🎬 场记板粒子（打板 = action 高潮） | 磷光青（板体/数据）+ 暖白（成形高光） | **全新** |
| 03 | `sync` | `--03` | 拍摄内容 | 编排轴 | 琥珀（激活基准）+ 品红（点睛）+ 青（仅 delay 读数） | 现有 02 修改保留 |
| 04 | `flux` | `--04` | 拍摄内容 | 时间瀑布 | 磷光青 + 深波形蓝（信号层次） | 现有 03 增强 |
| 05 | `cut` | `--05` | 片尾 | 定格 CUT | REC 红（定格）+ 暖白（字幕） | 现有 04 |

> **"叙事偏重色"≠"一屏一色"**（对齐 §2 调色台规则）：每屏有 1~2 个主导取色作叙事识别，但**全五色板全站可用**，
> 各元素按语义（基准/文本/数据/深度/警示）自由取色、同屏多色共存。此列只标"这屏观感偏向哪个色"，非独占限制。**无绿色。**

> 重排影响面: `TemporalDragExperience.tsx` Scene 挂载顺序 + 新增 slate scene；各 Scene 的
> `tp-scene--0X` className 顺移；HUD 时码基准（startFrame）顺移；FooterBar `FRAME 0X / 05`（总数 4→5）；
> slate 场号文案（`0X / NAME`）；i18n 新增 slate 屏 key（清单见 §10.1）。sceneId 内部 waitFor 链是每屏独立的，
> 顺移不破坏链（waitFor 只在同屏内引用）。

> 相邻屏色彩区分度：03/04 都偏磷光青，靠"03 加品红点睛、04 加深波形蓝层次"拉开区分；收口真机核对。

---

## 0. 架构边界（关键，先钉死）

**框架不包装 canvas 层。** CineView 只暴露它本职的驱动信号——拖拽进度 / 方向 / 相位，
这些是 `useAnimateTimeline()` 暴露的三个只读 **MotionValue**（`progress` / `signedProgress` / `phase`）。

- canvas 粒子模块（物理、汇聚成场记板、渲染循环）是 **site 层独立模块**，放
  `site/src/components/temporal-drag/clapperboard/`，**不进框架 `src/`**。
- **进度分发一律走 MotionValue，禁用 render-prop 的 number（P1-2 修正）**：粒子模块订阅
  `useAnimateTimeline().progress`（`MotionValue<number>`），在自己的 `requestAnimationFrame`
  循环里 `progress.get()` 读值驱动 canvas；框架对 canvas 一无所知，接口面只有"读一个 MotionValue"。
- **为什么不用 render-prop 的 `enterProgress`（number）**：render-prop 桥（`AnimateRenderBridge.tsx`）
  用 `useMotionValueEvent + setState`，**拖拽每帧一次 setState** → 每帧重渲染 render 子树。这直接违反
  §11.2 自定热路径规则，也违背框架自身先例——框架的 canvas 类 scrub 消费者 `AnimateVideo.tsx` 正是用
  `useAnimateTimeline().progress`（MotionValue）放进**普通子节点**、在 rAF 里 `.get()`，绕开每帧 setState。
- **禁止用 React context 下发 number**：若 context value 每帧变，全体消费者每帧重渲染（热路径灾难）。
  要跨组件共享就下发 **MotionValue 本身**（引用稳定），消费者各自 `useTransform` 派生 / rAF 读 `.get()`。
- render-prop 的 number 仅用于**极少数直接进 JSX 的静态文本节点**（非每帧 scrub 的场合）。
- 职责边界: 框架给进度 MotionValue，canvas 自己消费。互不渗透。

```tsx
// 用法骨架（site 层）—— canvas 放普通子节点，内部取 MotionValue（对齐 AnimateVideo 先例）
<Animate animateId="s02-clapper" enterAnimation="fade-in" exitAnimation={{ exit:{opacity:0} }}
         duration={{ enter: SWEEP_MS /* = 100×dragTimeScale，见 §4.2.1 */ }}>
  <ClapperboardCanvas />   {/* 内部: const { progress } = useAnimateTimeline(); rAF 里 progress.get() */}
</Animate>
```

> `progress` MotionValue 在 drag 下天然被 scrub: 拖入→0→1（粒子汇聚），松手 settle 续跑到 1，
> 松手 bounce 退回 0（粒子打散），反向拖出→1→0。**汇聚/消散全程跟手、零每帧 setState**——这才是
> "接入拖拽"的正解。canvas 的 rAF 循环本就每帧跑，`progress.get()` 是纯读，不触发 React 渲染。

---

## 1. 三幕节奏（整页叙事重构）

现状是 4 个并列场景，无叙事递进。重构为电影拍摄三幕、扩为 5 屏:

| 幕 | 屏 | 主题 | 主信号色 | 视觉母题 |
|----|----|------|---------|---------|
| **ACTION** | Scene 01 | 显影盘 / 开机校准 | 琥珀金 | 显影盘（保留）→ 取景器 HUD |
| **ACTION** | Scene 02 | 场记板成形（打板高潮） | 磷光青 + 暖白 | 🎬 canvas 粒子汇聚成场记板 |
| **拍摄内容** | Scene 03 | 编排轴 | 琥珀 + 品红数据色 | 时间轴编排（修改保留） |
| **拍摄内容** | Scene 04 | 时码流动 | 波形青 | 时间瀑布（增强） |
| **片尾** | Scene 05 | 定格杀青 | REC 红 | CUT / 片尾字幕 |

> "action" 那一幕跨两屏递进: Scene 01 显影盘校准 = 开机前时基校准（预备），
> Scene 02 场记板打板 = 场记喊 "action" 的视觉高潮。之后 03/04 是"拍摄内容"（编排 + 时码），
> 05 是"片尾"。三幕递进而非并列。

---

## 2. 信号色体系（本轮重构：调色台，非一屏一色）

**去掉绿色**（你的指令）。规则修正：**不是"每屏分配死一个主色"，而是定义一套统一的信号色板
（5 主色 + 1 点睛），每一屏都能按元素语义自由搭配取用板里的多个色**（调色台逻辑）。之前"一屏一主色"
的约束是我做窄了，反而是单调/AI 味的根源之一 —— 本轮废除。黑底为主不变，饱和度 = **器材级中饱和**（黑底上干净、不霓虹、不暗淡）。

### 2.1 信号色板（5 主色 + 1 点睛，共 6 token；全站共用，任何屏可搭配）

```css
/* 器材信号调色台 —— 每个色有明确语义分工，全站任何屏按元素语义取用 */
--tp-sig-amber:  #d8a24a;  --tp-sig-amber-glow:  rgba(216,162,74,0.30);   /* 基准/校准/主强调 */
--tp-sig-warm:   #ece3d0;  --tp-sig-warm-glow:   rgba(236,227,208,0.22);  /* 钨丝暖白：主文本高光/成形 */
--tp-sig-cyan:   #5ec8d0;  --tp-sig-cyan-glow:   rgba(94,200,208,0.26);   /* 磷光青：数据/时码/信号活跃 */
--tp-sig-blue:   #4a7fb5;  --tp-sig-blue-glow:   rgba(74,127,181,0.24);   /* 深波形蓝：次级数据/深度层 */
--tp-sig-rec:    #e0574a;  --tp-sig-rec-glow:    rgba(224,87,74,0.30);    /* REC 红：警示/录制/定格 */
--tp-sig-magenta:#c86fd4;  --tp-sig-magenta-glow:rgba(200,111,212,0.22);  /* 辅助品红：极少量点睛 */

--tp-bg-deep: #08070a;  --tp-bg: #0c0a0c;  --tp-bg-elevated: #15131a;
```

> 色板经你确认（琥珀基准 / 钨丝暖白 / 磷光青 / 深波形蓝 / REC 红 + 品红点睛）。**无绿色。**

### 2.2 用色规则（语义分工，非位置分配）

- **静态/基准结构**（刻度、边框、rule、未激活文字）：`--tp-ink-*` 灰 —— 保持克制底子。
- **按元素语义取色**（同屏可多色共存）：
  - 基准/校准态 → amber；主文本成形/高光 → warm；数据/时码/信号 → cyan；深度/次级数据 → blue；
    警示/录制/定格 → rec；关键点睛 → magenta（极少）。
- 每屏仍可有一个"叙事偏重色"做主调（如 05 片尾偏 rec），但**不禁止**其它色作数据/点缀共存。
- 防彩虹化靠"语义分工 + 共用同一块板"而非"限制数量"：色多但各有其位，就不杂。

### 2.3 文字色动画（本轮新增维度）

**框架事实（已核实）**：drag 属性白名单是 10 个 transform/opacity/filter，**不含 `color`** —— 文字色
不能直接走 `Animate` 变体 lerp。三条实现路（本站层，框架零改动）：
1. **`useTransform` 从下发的 progress MotionValue 派生色（主用，scrub 场景）**：与 §4.2.2 同一个
   下发的 progress **MotionValue**（非 render-prop number），组件内 `useTransform(progress, [θ→], [灰, 目标色])`
   写 `motion.*` 的 `style.color`（framer 原生支持 color MotionValue 插值），或渐变文字用
   `background: linear-gradient(...)` + `background-clip:text` 动 `background-position`。
   **走 MotionValue 绕过 React 渲染管线，与位移/缩放同源同步、零每帧 setState**（对齐 §11.2 热路径规则）。
2. **`filter: hue-rotate()`**：白名单内单函数 filter，可被拖拽 lerp，做"灰→琥珀"色相偏移最省。
   （注：`animateInterpolation` 只匹配**单**函数 filter，`sepia()+brightness()` 多函数同写会 snap 不平滑，勿叠。）
3. **CSS `transition: color`**：非 scrub 的状态切换（激活染色）用 class toggle 兜底。
- 叙事用法：文字"显影"感 —— 入场时色从基准灰渐变到暖白/琥珀（像相纸显影），激活时染磷光青，
  退场反向褪回。**色值过渡本身即动画**，纳入下节组合动画设计。

---

## 3. 质感层（沿用 v2，强度=明显）

`.drag-temporal` 内、CineView 之上加 `pointer-events:none` 装饰 overlay（不进框架树）:
- 胶片颗粒（SVG feTurbulence data-uri，opacity 0.11，抖动动画）
- 扫描线（repeating-linear-gradient，0.030）
- 暗角（radial，角落 0.72 黑）

风险: 明显质感可能"显脏"，收口须验证不劣化文字可读性、不产生 moiré。

---

## 4. Scene 01 Hero 重做（重点：指针角度门控 + 组合动画）

### 4.1 诊断
实拍问题:
1. **四角元素不明意味、无点缀作用**: SCENE 01/TAKE 01、DIRECTOR'S CUT/CineView、散落齿孔——
   孤立飘在四角，和中心显影盘无视觉关联，纯装饰噪音。
2. **中心显影盘太空**: 只有细刻度+两针+数字，中间大片纯黑。
3. **入场平平无奇**: 各元素单一预设（fade-in / slide-up）独立计时入场，没戏、没关联。
4. **竖向大留白**: 标题区与 DRAG 提示之间空一大块（钉顶绝对定位所致）。

### 4.2 核心机制：指针角度门控（本轮新叙事，A1 拖拽直驱）

**你的指令**：开机 = 指针转动，指针转到某刻度位置就浮现该位置对应的元素；退场 = 指针反向转、
元素逆序消失。**A1：指针角度 = 拖拽 progress 的直接映射**（完全跟手），根数维持现状（秒针琥珀 + 分针灰）。

#### 4.2.1 框架地基（已读源码核实，P0-1）

审查 P0-1 点破："指针门控模式下 Scene 01 的 timeline duration 如何计算"是 A1 成立的地基。核实结果：

- **进度推进速率**：drag 下 `useElementTrack` 的 follow-finger 把 element 轨 pegged 到
  `elapsed = clamp(r × dragTimeScale×100, 0, T_self)`（`r` = 拖拽比率 0..1）。`useAnimateDrag` 读它算
  `localProgress = clamp((elapsed − calculatedDelay) / enterDuration, 0, 1)`，即 `useAnimateTimeline().progress` 的值。
- **T_self 的公式**（`registry.ts::buildAnimationTimeline`）：`T_self = max over 所有注册 Animate of (calculatedDelay + duration)`。
  即**最后一个 waitFor 链成员**决定 T_self。
- **闭环设计（本稿定义）**：Scene 01 挂**一个"主门控 Animate"**（`animateId="s01-pointer-driver"`），
  它的 `duration = SWEEP_MS = 100 × dragTimeScale`（当前 dragTimeScale=16 → **1600ms**），无 waitFor、delay=0，
  且它是本屏 duration 最大的注册项 → **`T_self = SWEEP_MS = 1600ms`**。
  incoming/rest 相位下 `progress(主门控) = clamp(elapsed/1600) = clamp(r×1600/1600) = r` —— **progress 恒等于拖拽比率 r，完全线性跟手**，不坍缩、不一拖到底。
- **进度分发用 MotionValue，非 render-prop number（P1-2 修正）**：主门控**不用 render-prop**（render-prop 桥 `AnimateRenderBridge` 每帧 `setState`，会每帧重渲染子树，违反 §11.2 与框架 `AnimateVideo` 先例）。而是把主门控 `Animate` 作为**普通子节点**渲染，内部用 `useAnimateTimeline().progress`（只读 MotionValue）拿进度，经 **React context 下发这个 MotionValue（引用稳定，不是每帧变的 number）**。子元素 / 秒针 / canvas 都订阅同一 MotionValue：子元素用 `useTransform` 派生、canvas 在自己的 rAF 里 `.get()` 读。全程零 setState。
- **其它元素不再各自注册长 waitFor 链**（避免顶大 T_self）：不用独立 `Animate` 计时，共享下发的 progress MotionValue，各自用 `θ_trigger` 派生局部进度。全屏一个进度源、一个 T_self。

> ⚠️ 约束：Scene 01 内**任何**带 waitFor 长链或大 duration 的 `Animate` 都会顶大 T_self、破坏 `progress≈r` 线性。
> 因此持续微动画（秒针慢扫、校准环旋转）必须走**纯 CSS**（不注册进 registry），四角仪表若要 scrub 入场也共享主门控进度，不各自计时。

#### 4.2.2 指针角度 θ 的三态信号源（P1-1 修正 —— 之前只覆盖 incoming/rest）

审查 P1-1 点破：`progress ≡ r` 只在 incoming/rest 相位成立。核实 `useAnimateDrag.ts:192-203`：Scene 01 作为 **active 被拖出（outgoing）** 时，`useAnimateTimeline().progress` 会从 rest 的 1 塌到 ~0（变成 renderProgress 驱动的退场进度）。若 θ 盲目 = `progress × SWEEP_DEG`，则正向切屏时指针会先塌回 0 再扫回，与 §4.3.1① "指针不反转"冲突。**必须按相位选信号源**：

| 相位（由 `useAnimateTimeline().phase` 判定） | θ 读什么 | 指针行为 |
|------|---------|---------|
| **incoming / rest / 回弹**（phase ∈ idle/entering/entered，且非 outgoing） | `progress`（= r） | θ = r × SWEEP_DEG，拖入正转、回弹反转、反向重入正转（②③ 跟手可逆） |
| **outgoing 正向切屏**（phase = exiting，sceneOffset 0 且 renderProgress 上行） | **锁定 SWEEP_DEG**（θ 不再读 progress，freeze 在满扫） | 指针**停在满扫不反转**，整屏随 renderProgress 上滑离场（① 成立） |

- 实现：Scene 01 主门控组件内 `useTransform([progress, phase], ...)` 计算 θ MotionValue —— exiting 相位输出恒 SWEEP_DEG，否则输出 `progress × SWEEP_DEG`。这样 θ 在三态各读正确信号，不再有"outgoing 时指针塌回"的 bug。
- **元素门控**：每个元素分配"触发角" `θ_trigger`，局部进度 `p_local = clamp((θ − θ_trigger)/BAND, 0, 1)`（BAND = 单元素角度带宽）。θ ≥ θ_trigger → 按 p_local 播组合入场；θ 回退跌破 → p_local 反向原路褪回（②③）。
- **布局维持现状（B2）**：元素**不做钟面辐射重排**，仍在现有位置；θ 只作**门控信号**，不改元素落点。
- 注：① 正向切屏时 θ 锁 SWEEP_DEG、元素 p_local 停在 1（入场完成态），元素退场改由各自的 **outgoing exitAnimation**（renderProgress 驱动）接管——见 §4.3.1①。θ 门控只负责 ②③ 的可逆。

> 触发角次序（示例，θ 从 12 点顺时针）：刻度点亮环(0°起) → 内环(60°) → 中心"01"(120°) →
> eyebrow(180°) → 主标题 CineView(220°) → 副标题(260°) → DRAG 提示(290°)。指针扫到哪，哪个浮现。

### 4.3 组合动画设计（本轮重点：用 `animations:[...]` 叠加，非单预设）

**你的指令**：入场要用**组合动画**（多动画叠加），不是每个元素只用一个预设。以下每个元素的入场都是
**2~3 个动画的组合**，并叠加**文字色动画**（§2.3，共用下发的 progress MotionValue → `useTransform` 派生色）。

**实现选择（P0-3 澄清 —— 同元素的位移+色值共用一个进度源，可行且必须）**：
Scene 01 的元素既要指针门控入场、又要文字色渐变，两者**都由同一个 `progress` MotionValue（§4.2.1 下发的那个）派生 `p_local`**，
再由 `p_local` 同时驱动 transform（`useTransform(p_local, ...)`）和色值（`useTransform(p_local, [0,1], [灰, 目标色])`）。
一个进度源、多路 `useTransform` 派生，绝不撞源、天然同步、零 setState。**这就是"组合动画叠加"在 scrub 场景下的落地方式**
（非声明式 ComposedAnimation —— 见下方分工的框架事实澄清）。

| 元素 | 组合入场（p_local 叠加驱动） | 文字色动画（p_local 派生） |
|------|-----------------|-----------|
| 中心 "01" | blur(14→0) + scale(0.6→1) 并行，末段叠 rotateY(-40→0) 定格 | 灰→琥珀→暖白（显影） |
| eyebrow | fade + y(12→0) + 字距收拢 | 灰→琥珀 |
| 主标题 CineView | blur-in → (slide-up + scale 0.92→1) → skewX 回正，分三段 p_local 区间 | 灰→暖白，末段微染青 |
| 副标题 | fade + y(16→0) + 渐变文字 background-position 扫过 | 渐变扫光 |
| 刻度环 | 逐刻度顺时针点亮：scale(0.3→1) + 辉光 opacity（每刻度自己的 θ_trigger） | 扇区染琥珀 |
| 内环校准环 | scale(0→1) → dash 旋转就位 | — |
| DRAG 提示 | fade + scale(0.7→1)，rest 后叠持续呼吸（CSS） | 琥珀脉冲 |

**组合动画在 drag 模式的真实行为（P1-3 修正 —— 已读 `composer.ts` 核实，之前论述有误）**：
- **框架事实**：`composer.ts` 把 ComposedAnimation 的 sequential 分段/`delays` **烘焙进 framer 的 `transition.delay`**，
  再 `mergeVariants` 合并成单个 `{initial, animate}`。但 drag 路径（`useAnimateDrag`）**只读合并后的
  `initial`/`animate` 两个端点、按 localProgress 做 lerp，完全不消费 `transition.delay`**。
  ⟹ **drag 下 ComposedAnimation 的分段时序（sequential、delays）被丢弃**，只剩「合并后的多属性端点做单曲线并行 lerp」。
- **结论（改口）**：drag 下"组合动画" = **多属性并行叠加**（blur+scale+y+rotate 同时 lerp，确实比单预设丰富、可用），
  但**拿不到 scrub 下的分段时序**。全站（01~05）在 drag 模式下的"组合"都是这个含义。
- **要真正的分段时序**（A 演完再 B），只能在 site 层用 `p_local` 手动切区间（如 `p_local∈[0,0.5]` 驱 blur、`[0.5,1]` 驱 slide），
  即 §4.3 表格里"分三段 p_local 区间"的写法——这是 site 层自己切，不是框架 ComposedAnimation 给的。
- 因此上表的"组合入场"列，凡写"→"表示分段的，均需 site 层 p_local 区间实现；写"+"表示并行叠加的，可直接多属性 lerp。

#### 4.3.1 退场：三态区分（P0-2 修正 —— 之前把三条路混为一谈是错的）

审查 P0-2 点破并经源码核实（`useAnimateDrag.ts:192-256`），drag 下 Scene 01 有**三条不同退场路径**，
必须分别 author，不能都说成"指针反转逆放"：

| 触发 | 框架路径（核实） | 视觉设计 |
|------|-----------------|---------|
| **① 正向切屏 01→02（过阈值）** | Scene 01 = outgoing，`mode:'outgoing'`，由 **renderProgress** 驱动 `localProgress`，lerp `animate→exit` | 指针**不反转**，整屏随 renderProgress 上滑离场；需**显式 author exitAnimation**（快门收拢：刻度向心 + 中心数字放大冲出 + 整屏 fade），exitDuration 短（如 400）让退场在 renderProgress 前半段就演完 |
| **② 回弹（拖了没过阈值）** | element 轨 `animate→0`（bounce），renderProgress→0 | enterProgress 回退 → **指针反向、元素逆序原路褪回**（p_local 反向）。天然可逆，无需额外 author |
| **③ 反向拖回（从 02 拖回 01）** | Scene 01 变 incoming，`mode:'enter'`，enterProgress 重新 0→1 | 指针重新正向扫、元素依次重现（= 入场重放）。这是 incoming enter，非"退场" |

> 关键结论：**"指针反转逆放"只对 ②（回弹）成立**；① 正向切屏是 renderProgress 驱动的 outgoing lerp，
> 必须单独写 exitAnimation（快门收拢），指针在这条路上不反转。③ 是重新入场。
> 这三态是"接入拖拽 + 原路退回"能否真正成立的闭环 —— 之前反馈的"还原重跑"根因就在没区分 ①②。
> 收口真机验收必须**分别**验证这三态（见 §11）。

### 4.4 四角 → 取景器仪表（重做，删无意义文案）
删除 SCENE/TAKE/DIRECTOR'S CUT 文案齿孔，四角改为**单反取景器 HUD**，每个角是有真实语义的相机读数:

| 角 | 重做为 | 内容 | 取色（调色板） |
|----|--------|------|--------------|
| 左上 | 曝光模式组 | `● M  f/2.8  1/50` | 琥珀（基准），激活微亮 |
| 右上 | 电量/存储 | `[▮▮▮▮] 96%  ⬡ 128GB` | 电量条暖白，低电用 rec 红（语义示范多色） |
| 左下 | 白平衡/ISO | `WB 5600K  ISO 800` | 色温值用 cyan（冷）↔ amber（暖）示意 |
| 右下 | 水平仪 | mini 双轴水平仪（十字 + 气泡，随 dial 旋转微动） | 居中锁定用 cyan（磷光青），偏移时 amber。**无绿色。** |

- **取景框四角 L 形角标**: 四角各一 L 形描边，把整屏框成"取景器视野"，散落元素统一进取景框叙事。
- rangefinder 十字分划从盘心延伸，与四角 L 角标呼应。

### 4.5 显影盘加层次（点缀）
- 双环: inner-ring 外加一圈**虚线校准环**（stroke-dasharray，极淡琥珀，极慢反向旋转 40s/圈）。
- 中心 "01" 下方加 mono 副读数 `f/2.8 · 1/50 · ISO800` + 2px 曝光条（呼吸微动画）。
- 盘心 pin 加十字分划。

### 4.6 布局修正
`s01-stage` 从"钉顶绝对定位"改三段式: 盘面偏上 / 标题区紧随 / DRAG 锚底，压缩中间留白，视觉重心居中偏上。

### 4.7 持续微动画（全 CSS/motionValue，不碰热路径）
- 秒针在 rest（enterProgress=1）后**极慢连续扫动**叠加在门控角度上（非入场即静止）。
- 虚线校准环极慢反向旋转、曝光条呼吸、电量条呼吸。
- 减少动态偏好下全部静止。

---

## 5. Scene 02 场记板 canvas 粒子（本轮核心新增）

### 5.1 概念
第二屏中心是一块 🎬 **场记板（clapperboard）**，由**纯程序生成的粒子**汇聚而成。
拖入时粒子从四散状态汇聚成清晰场记板（打板闭合），拖出时打散消散。

### 5.2 实现（site 层独立模块，框架零改动）
`site/src/components/temporal-drag/clapperboard/`:
- `ClapperboardCanvas.tsx`: 组件，接 `progress: MotionValue<number>`（来自 `useAnimateTimeline().progress`，
  **非** render-prop number，见 §0 / P1-2）+ `phase: MotionValue<AnimatePhase>`。canvas 在自己的 rAF 里
  `progress.get()` 读最新值，**不经 React state、不每帧重渲染**。
- `particleField.ts`: 纯函数/类，程序生成粒子目标位置 = 场记板轮廓采样点
  （顶部斜条纹的对角线、板身矩形边框、SCENE/TAKE/ROLL 字格线）。
- 渲染循环: canvas 2D，`requestAnimationFrame`；每帧 `p = progress.get()`，
  粒子位置 = lerp(散开随机位, 目标位, easeInOut(p))；p→1 时汇聚成形。挂法：场记板 canvas 是
  `Animate` 的**普通子节点**（非 render-prop），组件内自己 `useAnimateTimeline()` 取 MotionValue
  —— 对齐框架 `AnimateVideo.tsx` 的 scrub 消费先例。

### 5.3 粒子物理
- N ≈ 600~900 粒子（移动端性能预算内，收口须真机测帧率）。
- 散开态: 每粒子一个随机起点（种子固定，避免每帧抖动）+ 轻微噪声漂移。
- 汇聚态: 目标 = 场记板线框采样点。
- progress 中段: 粒子在起点↔目标间 lerp，带每粒子相位差（错峰汇聚，像铁屑被磁化）。
- 成形后（progress>0.85）: 场记板线框点亮为**磷光青** `--tp-sig-cyan`，顶部斜条纹可闪一次**暖白** `--tp-sig-warm` "打板"高光。
- 颜色: 粒子散开态低透明**磷光青**，汇聚时提亮；成形高光叠**暖白**。**无绿色。**

### 5.4 拖拽 scrub（关键，本轮决策）
- 进度源: `useAnimateTimeline().progress`（MotionValue，非 render-prop number；见 §0/P1-2）。canvas rAF 内 `.get()` 读。
- 拖入 Scene 02: progress 0→1，粒子汇聚（跟手）。
- 松手 commit: settle 续跑 progress→1，汇聚完成。
- 松手 bounce（未过阈值）: progress 退回 0，粒子打散（原路，见 §9 bug 修复）。
- 反向拖出（02→01）: Scene 02 变 outgoing，`progress`（= `useAnimateTimeline`）此时是 renderProgress 驱动的
  退场进度；粒子消散读它即可（canvas 只需"一个 0..1"，不关心它是入场还是退场语义）。
  注：Scene 02 若要指针门控式的"停在满扫"处理（如 Scene 01 §4.2.2），场记板无指针、无此需求 —— 粒子直接跟 progress 散开即可。

### 5.5 canvas 之外的 Scene 02 内容
Scene 02 是**纯场记板屏**（新增屏，原编排轴后移为 Scene 03，不在此屏）:
场记板 canvas（主体，占中心）+ 极简标题区（eyebrow「SLATE · ACTION」磷光青 + 一行 title 暖白）+ footer。
不放时间轴、不放 ParamPanel——那些是 Scene 03（编排轴）的内容。

### 5.6 性能
- canvas 尺寸按 devicePixelRatio 上限 2 限制，避免 retina 下 4x 像素。
- 粒子数上限 + 离屏（Scene 未激活）暂停 rAF。
- 收口真机验收: 场记板汇聚 + 并发拖拽下帧率，专项测。

---

## 6. Scene 03 编排轴（原 02，修改后保留 —— 本轮重点）

### 6.1 诊断（你的反馈）
实拍问题:
1. **一眼看不清在表达什么**: 5 个圆节点 + 一条线，没有说明"这是声明式时间轴/waitFor 编排"的语境，抽象到无法解读。
2. **语义不明**: T/S/B/I/C 缩写 + 底下小字，观者不知道这是"元素按 delay 依次入场"的可视化。
3. **描述文字太小**: 节点标签、参数面板文字 2xs，几乎读不到。
4. **中间特别空**: 时间轴钉在上部，中段大片空白（同 01 的钉顶问题）。
5. **实拍 bug**: CTA（第 5 节点）右半被视口切边；ParamPanel 在 rest 态整个不见。

### 6.2 处理:修改后保留（不删、不换场记板）
保留"声明式时间轴"这个母题（它是框架 waitFor 编排的核心卖点），但重做可读性与布局:

**A. 加语境标题（解决"看不清在表达什么"）**
- 顶部一句明确的 title: 「按 delay 依次入场」/ 「Elements arrive by waitFor」（琥珀 eyebrow + display 大标题），
  让观者一眼知道下面的时间轴在演示什么。

**B. 节点重做（解决语义/文字太小）**
- 节点从"孤立圆圈 + 2xs 小字"改为**带明确标签的胶片轨道站点**: 圆节点放大，标签字号提到 sm，
  节点下方直接标 `+0ms / +240ms / +480ms...` 的 delay 值（这才是"编排"的实证），文字可读。
- 节点数保持 5 个（TITLE/SUBTITLE/BODY/IMAGE/CTA 代表被编排的元素），但用**真实语义标签**而非单字母缩写。

**C. 修 CTA 切边 bug**
- 时间轴容器宽度收窄 + 节点分布从 `0/25/50/75/100%` 改为**内缩留边**（如 `6/28/50/72/94%`），
  末节点不再压边缘；节点圆 + 标签整体不溢出视口。

**D. ParamPanel 修复 + 提可读性**
- 核实其缺失是"enter 动画未触发"还是"定位 bug"（实现时验证），修好让它在 rest 态可见。
- 面板文字放大到可读（≥ xs），作为"当前激活节点的 waitFor/delay/duration 参数读数"，与时间轴联动。

**E. 布局填空**
- 时间轴 + 参数面板重新分布，压缩中段留白，视觉重心居中。

**F. 叙事偏重色**: 琥珀（基准/编排就位）+ 品红做当前激活节点的点睛数据色；delay 读数用磷光青。**无绿色。**

---

## 7. Scene 04 时间瀑布（原 03，增强 —— 你说太简陋）

### 7.1 诊断
实拍是四屏里点缀最少的: 一个环 + 一行大时码 + 背景飘的时码流，中心孤立、无仪表深度。

### 7.2 增强（波形青主色）
在 v2 已有（进度环 + 巨型时码 + 三列背景时码流 + SMPTE 标签 + 方程 + 底部刻度条）基础上加料。
**驱动方式统一标注**（避免重蹈"没接入拖拽"）：吃拖拽 scrub 的走 `useAnimateTimeline().progress`
**MotionValue** → `useTransform` 派生（对齐 §0/§4/§11.2，禁 render-prop number）；纯氛围微动走 CSS（不注册进 registry）。

- **示波器/波形层**: 环内或环侧加一条**音频波形 / 时码脉冲波**（程序生成的 sine/noise 波形，波形青），
  强化"信号监视器"叙事，填补环中心到时码之间的空。**驱动**：纯 CSS 循环（氛围，不吃拖拽）。
- **环的径向刻度**: 进度环外圈加 60 格径向刻度（像秒表/示波器刻度盘）。**驱动**：随进度点亮 =
  `useTransform(progress, ...)` MotionValue（吃拖拽 scrub）。
- **绕环扫描点**: 一个沿环运动的辉光扫描点。**驱动**：纯 CSS 极慢自转（氛围，不吃拖拽），避免顶大 T_self。
- **时码 RGB 色差**: 巨型时码加轻微 RGB 通道分离（CRT/信号失真质感，青为主）。**驱动**：静态 CSS
  `text-shadow` 三色偏移（不动画），或极淡 CSS 抖动；不走拖拽。
- **数据副读数**: 中心时码旁补 `24fps · REC 709 · 4K` 等拍摄规格副读数（术语，保留英文，不进 i18n）。
- **底部刻度条**: 保留 v2 已有 TickBar。**驱动统一**：marker 位置从 `useAnimateTimeline().progress`
  MotionValue 派生（**替换现有手动 `dragProgress` motionValue**，收敛为框架单一进度源，消除第二套进度）。

---

## 8. Scene 05 片尾（原 04，收紧）

CUT + accent 线 + THE END + 双按钮 + 片尾胶片尾料（END OF REEL）。REC 红升为主色。
上半屏补**空胶片尾料 + "END OF REEL" 标记**填空，CUT 标题收紧居中（修实拍的"挤在下半屏"）。

---

## 9. 技术 bug 修复（本轮核实，非审美）

### 9.1 动画未被拖拽 scrub —— 时长 vs dragTimeScale 不匹配
**核实**: `useElementTrack` follow-finger 确实把 element 轨 pegged 到 `r × dragTimeScale×100`，
框架层接了拖拽。但 `/drag` 配 `dragTimeScale: 16` → 拖满 100% 只推进 1600ms element 轨，
而现有编排 delay+duration 链排到 8000ms+（Scene01 甘特图到 9300ms）→ 拖拽全程只 scrub 到时间轴最前一小段，
后面元素靠松手 settle 补跑 → 体感"没接入拖拽"。
**修**: 压缩每屏编排总时长到与 `dragTimeScale` 匹配的量级（目标: 拖满能 scrub 完主要入场），
或调大 dragTimeScale。两者权衡（dragTimeScale 太大→拖一点点就跳很多）。目标区间: 每屏主入场链 ≤ 100×dragTimeScale。

### 9.2 还原是重跑而非原路退回 —— 真 bug
**核实**: bounce 分支 `animate(motion,0)` 把 element 轨拉回 0（理论原路）。但 outgoing 退场用
renderProgress、backward 走 `animate→initial` 的另一条 lerp，加上我这轮加的 exitAnimation 全为
forward 设计 → backward/bounce 时视觉是"重跑"而非"原路缩回"。
**修**: 验证 backward 方向的视觉路径，让 exit/enter 在同一属性轴上可逆（backward 退回 = enter 的逆放），
确保 bounce 与反向拖拽都是原路 scrub 回退，不重启动画。收口须真机专项验证正向/反向/回弹三态。

### 9.3 进度源统一裁决（两套并存的架构一致性）

**现状核实**：`TemporalDragExperience.tsx` 手动维护 `dragProgress` / `signedDragProgress` 两个 motionValue，
靠 `onDragProgress` 回调 `.set()`，喂给 TickBar（marker 位置）和 SceneRolling（dial 旋转反馈）。
这是一套与框架 `useAnimateTimeline().progress` **并存的第二进度源**。

- **它不违反单一所有者**：是回调驱动的只读派生 motionValue，不回写框架 `renderProgress`/`elementElapsed`，
  且用 motionValue 非每帧 setState，热路径安全。
- **但形成两套并行体系** → 架构一致性隐患。**裁决**：
  - **屏内元素的入场/门控/文字色**（Scene 01 指针门控、02 场记板、04 波形/刻度）→ 一律走
    **`useAnimateTimeline().progress`**（屏级 element 轨，各屏独立、天然吃 scrub/settle/bounce）。
  - **CineView 级的全局拖拽反馈**（跨屏、非某一屏 element 轨语义的，如根容器 `data-drag-direction`
    扇区高亮、以及若确需的全局位移视差）→ 才用 `TemporalDragExperience` 的回调 motionValue。
  - **TickBar 归属修正**：它是 Scene 04 屏内元素，marker 应改吃该屏 `useAnimateTimeline().progress`，
    从 `TemporalDragExperience` 的手动 `dragProgress` 解耦（§7.2 已标注）。解耦后评估
    `dragProgress`（非 signed）是否还有消费者；若无则删，避免留一个半死的并行进度源。
  - **SceneRolling 的 dial 旋转**用 `signedDragProgress`（需要方向符号做 ±5° 反馈）——这是全局手势
    方向语义、非 element 轨进度，**保留**走回调 motionValue，合理。
- 收口须确认：屏内不存在"同一元素同时被两套进度源驱动"，且删除无消费者的并行源。

---

## 10. i18n key 增删清单（P1-6，前几轮全漏的血教训）

**术语 vs 叙事划分原则**（沿用已落地规则）：电影/摄影术语保留英文（REC/SMPTE/ISO/FPS/f-stop/快门/场号
slate/FRAME/SCENE/TAKE/CUT/END OF REEL/节点缩写 T·S·B·I·C/面板字段 WAIT·DELAY·DURATION/`f/2.8 · 1/50 · ISO800`
等仪表读数）；叙事文案翻译（副标题、footer 提示、编排轴语境标题、按钮）。

### 10.1 新增 key（Scene 02 slate 屏 + 各屏文案）

| key | 类型 | en | zh |
|-----|------|----|----|
| `dragTemporal.s02.eyebrow` | 叙事 | `SLATE · ACTION` | `场记板 · ACTION`（ACTION 术语保留） |
| `dragTemporal.s02.title` | 叙事 | 待定（打板叙事一句） | 待定 |
| `dragTemporal.s02.footerHint` | 叙事 | 待定 | 待定 |
| `dragTemporal.s02.slateLabel` | 术语 | `02 / SLATE`（不翻） | `02 / SLATE` |
| `dragTemporal.s02.clapperLabel` | 叙事 | canvas aria-label | 场记板 aria-label |

### 10.2 改动 key（原 02/03/04 → 03/04/05 顺移，值随语义微调）

- slate 场号文案：原 `02 / CHOREOGRAPH` → `03 / CHOREOGRAPH`；`03 / FLUX` → `04 / FLUX`；`04 / FINAL CUT` → `05 / FINAL CUT`。
- FooterBar `FRAME 0X / 04` → `/ 05`（总屏数 4→5），逐屏 frame 序号顺移。
- 编排轴（新 03）新增语境标题 key（解决"看不清在表达什么"）：`dragTemporal.s03.contextTitle`
  = en「Elements arrive by waitFor」/ zh「元素按 waitFor 依次入场」（叙事，翻译）。
- Scene 01 若标题/副标题因指针门控叙事改文案，对应 `dragTemporal.s01.*` 值更新（key 名不变）。

### 10.3 四角取景器仪表文案

`f/2.8`、`1/50`、`ISO 800`、`WB 5600K`、`96%`、`128GB` 等**全是术语/数值，保留英文、不进 i18n**
（作为静态 JSX 或术语常量）。仅当某仪表带叙事性 label 时才加 key。

> ⚠️ 实现规则：每加一个新可见文案，**同步在 en.ts + zh.ts 两个字典加 key**（前几轮就是漏了 zh 或漏接 `t()`）。
> 收口验收须专项确认中英切换对 5 屏所有叙事文案生效（§13）。

---

## 11. 性能预算（P2-7，同屏最坏情况）

各处单独提"收口测帧率"不够，须有同屏最坏情况整体预算 + 降级策略。

### 11.1 最坏叠加场景（Scene 02 拖拽中）

同屏同时跑：① 场记板 600~900 粒子 canvas rAF；② 全屏胶片颗粒 rAF 抖动（质感层 opacity 0.11）；
③ 扫描线 + 暗角（静态 CSS，compositor，可忽略）；④ 拖拽 renderProgress + element 轨每帧驱动；
⑤ `useAnimateTimeline().progress` MotionValue → 粒子/门控派生（motionValue 订阅，**非** setState）。

### 11.2 预算与降级分档

| 项 | 预算 | 降级策略 |
|----|------|---------|
| 粒子数 | 桌面 900 / 移动 ≤600 / 窄屏(≤380px) ≤400 | 按 `min(innerWidth, devicePixelRatio)` 分档，运行时定 N |
| canvas 分辨率 | DPR 上限 2 | retina 下不渲 4x |
| 颗粒抖动 | 0.5s steps(4) | reduced-motion → 静止；低端可整层关 |
| 离屏暂停 | Scene 02 非激活时停粒子 rAF | 用 `phase`/可见性门控 |
| 每帧 setState | **禁止** | 粒子进度走 motionValue/ref，canvas 自读，绝不 setState |

### 11.3 硬指标（收口真机测）

- 拖拽全程 p95 帧时 ≤ 20ms、无 >50ms 长任务（沿用前轮标准）。
- 明显质感（颗粒 0.11）不劣化文字可读性、无 moiré。
- Scene 02 场记板汇聚 + 并发拖拽下无掉帧。

---

## 12. 实现优先级

| P | 内容 |
|---|------|
| P0 | §9 两个技术 bug（拖拽 scrub 时长匹配 + 反向原路退回）——这是"接入拖拽"的地基 |
| P0 | §2 信号色 token（调色台，无绿）+ §3 质感层（五屏共享基础） |
| P0 | §4 Hero 重做（指针角度门控 + 组合动画 + 四角取景器仪表 + 布局修正） |
| P1 | §5 Scene 02 场记板 canvas 粒子（site 独立模块，`useAnimateTimeline().progress` MotionValue 驱动）+ §11 性能分档 |
| P1 | §6/§7/§8 Scene 03/04/05 升级 + §10 i18n key 增删（en+zh 同步） |
| P2 | 动画补充（微动画、退场戏剧化） |
| P2 | 减少动态偏好适配（粒子/颗粒/信号动画在 reduce 下静止） |

---

## 13. 收口验收（CLAUDE.md 规则 4，独立 agent 真机 + 多维度）

必须专项确认（前几轮漏的），验收维度不止逻辑，含设计/主题/框架契合度:
1. **视觉还原度**: 逐屏截图对照本稿，不只查功能。
2. **设计风格是否单一 / 是否杂**: 五色调色台是否统一克制、无彩虹化，一眼是同一套设计语言。
3. **是否切电影/摄影主题**: 显影盘/场记板/时码/取景器 HUD/片尾是否形成连贯的"拍摄"叙事。
4. **是否契合框架 / 基于框架开发**: drag 下组合动画=多属性并行叠加，分段时序由 site 层按 `p_local`
   区间自切（**非**声明式 ComposedAnimation sequencing，drag lerp 丢弃 `transition.delay`）；指针门控 +
   进度分发统一走 `useAnimateTimeline().progress` MotionValue → `p_local` 派生（**禁** render-prop
   enterProgress number，避免每帧 setState）；canvas 只订阅框架进度 MotionValue。核验点：全程基于框架
   能力、框架 src/ 零改动，未绕开框架另起炉灶。
5. **拖拽 scrub**: 主入场在拖拽全程被 scrub（非松手才跑）。
6. **反向原路退回**: 正向切屏(outgoing exit) / 反向拖回(incoming enter) / 回弹(逆放) 三态分别正确。
7. **场记板粒子**: 汇聚/打散跟手 + 帧率（并发拖拽下无掉帧，§11 硬指标）。
8. **质感明显但不脏**: 颗粒不劣化文字、无 moiré。
9. **多视口 + 中英切换**: 沿用上轮标准，5 屏所有叙事文案切换生效。

---

*增补稿 v3 完。核心: 三幕节奏 + 第二屏 canvas 场记板粒子（框架不包装、进度走 `useAnimateTimeline().progress` MotionValue、site 独立实现）
+ Hero 四角重做为取景器仪表 + 修拖拽 scrub 与反向退回两个技术 bug。黑底电影感不动，多信号色 + 明显质感去暗淡与 AI 味。*
