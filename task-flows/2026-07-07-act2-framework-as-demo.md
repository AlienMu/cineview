# Task Flow — Act 2 重做（frontend-design × 框架优先，2026-07-07）

**日期**: 2026-07-07
**前置**: 2026-07-06-act2-capability-redesign.md（现版，已验收 N0-N7，未验收 N8；用户对设计与方案均不满意，要求重做）

---

## 零、诊断（实测，非猜测）

按 CLAUDE.md 规则 1「不靠猜测修问题」，先读框架 + 实测，根因已坐实：

### 根因
- **框架预算模型**（`sceneScrollBudget.ts` L38, L122-161）：`SCROLL_PX_PER_MS=1`，
  `totalBudgetPx = totalDurationMs × 1`，`totalDurationMs = 各 Animate 的 (delay + enterDuration)
  沿 waitFor 链累加`。即 **`duration.enter` 和 `timeline.delay` 的「毫秒数」直接 = 锁定滚动像素**。
- **现版作者按毫秒写**（400-1000，照搬 HeroScene 的 visibility 时间语义）→ 每镜 totalBudgetPx ≈ 6370-7300px
  = **~7 屏**。滚动要锁 7 屏才演完一镜 → 看着像「动画不动」。
- **实测证据**（Playwright 探针，localhost:4000）：动画**确实在跑**——`cap1-frame-3` 在滚动中
  opacity 0.455→1、`cap1-code` 0.43→1，按 waitFor 顺序进场，console 0 error。**不是动画坏了，是预算太大**。
- **Scene 在 center-lock 下**：`position:sticky; height=Scene.layout.height`（`DirectScrollCineView.tsx`
  L1246-1254），`flowSpan = visualSpan + totalBudgetPx`（L310-312）。两个独立旋钮：
  可视舞台高度（100vh，框架能力，**不动**）vs 锁定滚动距离（totalBudgetPx，靠写小 duration/delay 调）。

### 越界根因（次要，但用户点名要修）
- `<Position>` 用 1440×900 设计坐标经 `convertX/Y` 落绝对定位（`Position.tsx`）；
  `.capability-full` 是 `position:relative; height:100%`。元素越界 = 作者把内容放到 y:800 又叠加自身高度，
  没留安全区。修：每镜内容在 900 画布内、上下留 80px 安全区、`overflow:hidden` 兜底。

### 清障
- `Animate.stagger.test.tsx`（未追踪 `??`、写一半、重复 `Listener` 类型）→ `pnpm type-check` 直接红。
  会掩盖重做时的类型错误。**删除**（未追踪无损失）。

---

## 一、设计计划（frontend-design 两遍法）

### 主题（brief 钉死项，不重造）
- CineView = 「滚动即胶片推进」的 React 叙事框架。Act 2 唯一职责：把三个能力
  （场景编排 / 声明式时间轴 waitFor / 开箱即用预设）演示到「demo 本身就是证明」。
- 调色板/字体/LUT 色带全部沿用 tokens.css + global.css（dawn→mint 全站色彩旅程透出）。

### 概念方向（已与用户对齐）：框架即演示
每镜的**排版就是一段真实框架结构**、**动画就是框架在装配/结算/切换自己**——三者同一物，
最直接满足「排版与动画强相关」，且最框架原生。

### 统一签名（已对齐）：时间码轴
- 顶部贯穿三镜的 mono 读数（`00:00:12 → 00:00:24`，随 `useScrollProgress` 全局进度递增）+
  `▶▶│` 走片符号 + `NN/NN` 镜号。这是 CineView 自身论题「滚动 = 胶片推进」的字面化，
  是唯一记忆点（不是整面电影 chrome，避开用户不满意的重型场记）。
- 排版（读数）与动画（随滚动递增）天然相关，三镜读作一条连续长镜。
- **boldness 花在这一处**，其余克制：标题只在 `em` 上着陶土色，无粒子/网格/浮动装饰。

### 三镜概念（已对齐，各不重复）

**SHOT 01 — SCENE ORCHESTRATION（装配）**
- 排版：一段真实的嵌套 `<Scene scroll>` → `<Animate>` 结构树（活的结构图）。
- 动画概念：滚动把结构树**逐节点装配起来**——Scene 容器边框 `draw-in` → Animate 叶子节点 `pop` →
  waitFor 连线 `stroke-dashoffset` 收拢。
- 三种动画各异：边框 draw / 叶子 pop / 连线 stroke（**不重复**）。
- 视差：叶子节点 y 位移分层（50/120/200px）+ 相位切片错峰交叠。

**SHOT 02 — DECLARATIVE TIMELINE（结算链）**
- 排版：左 = 真实 waitFor 代码块；右 = cue 节点列。**左代码行 ↔ 右节点同 index = 同一 cue 步**。
- 动画概念：滚动把 waitFor 链**从左到右结算**——当前触发行 `fill-highlight` + 对应节点 `ring-light` +
  连线 `stroke`。三者同 index、靠相位切片天然同步。
- 三种动画各异：代码行 fill / 节点 ring / 连线 stroke（与 SHOT01 的边框/叶子/连线**视觉不同**）。
- 视差：代码块与节点列用 `offsetY` 相对累加分层，入场相位错峰。

**SHOT 03 — READY TO USE（预设剧场）**
- 排版：**单大舞台** + 底部 9 段擦洗轴。滚动位置 = 当前播放的预设。
- 动画概念：滚动擦洗过 9 个预设，每个用**各自原生的 enter**（fade/slide/zoom/rotate/flip/
  bounce/shake/blur/elastic）——9 种全不同。
- 视差：舞台前景 vs 背景轴用不同 y 位移幅度 + 相位切片。
- 唯一环境循环动画：时间码轴的 `▶▶` 走片（克制，全局唯一）。

### 节奏（已对齐）：一屏 × 视差交叠
- 每镜 `totalBudgetPx ≈ 100vh`（~900px@900vh）——靠写小 `duration.enter`/`delay`（~120-200 量级）凑。
- 元素**不串行排队**，靠 `timeline.phase={start,end}` 相位切片**错峰交叠**（A 0-40% / B 15-55% / C 30-70%…）
  + y 位移幅度分层（50/120/200px）做视差，把那一屏填满、读起来从容。
- Act 2 总锁定滚动 ≈ 3×100vh（现版 ≈19×100vh，**减约 6x**）。

### 边界约束（已对齐）：设计画布内布列
- 每镜 1440×900 设计画布（与 `config={{width:1440,height:900}}` 一致），所有 Position 坐标算在内，
  上下留 80px 安全区。`.capability-full { position:relative; width:100%; height:100%; overflow:hidden }` 兜底。
- 与 HeroScene 同一坐标系、框架原生 `convertX/Y` 换算。

### 克制自检（Chanel「出门前摘一件」）
- 每镜最多一个签名（时间码轴）。无粒子/网格/浮动装饰。标题只 `em` 着陶土色。
- reduced-motion：Animate duration/delay 归零（瞬间到位），CSS keyframes 由媒体查询关闭。

---

## 二、框架能力优先级（用户要求：框架优先，自定义仅兜底）

| 需求 | 用法 | 框架/自定义 |
|---|---|---|
| 滚动驱动进场 | `<Scene scroll={{trigger:'center-lock'}}>` + `<Animate>` 无 exit | **框架** |
| waitFor 链结算 | `<Animate timeline={{waitFor:'id'}}>` | **框架** |
| 视差相位切片 | `<Animate timeline={{phase:{start,end}}}>`（公共 API） | **框架** |
| y 位移分层 | 自定义 variant `{initial:{y},animate:{y:0}}`（预设幅度太大） | **自定义（必要）** |
| 边框 draw-in / 连线 stroke | SVG `stroke-dashoffset` + 自定义 variant | **自定义（框架无）** |
| 节点 pop / ring / fill-highlight | 自定义 variant（scale/box-shadow/background） | **自定义（框架预设不够）** |
| 9 预设擦洗 | 9 个 `<Animate enterAnimation={preset}>` + phase 切片 | **框架（用原生预设）** |
| 时间码轴读数 | `useScrollProgress` + 普通 DOM 文本 | **框架（useScrollProgress）+ 普通 React** |
| 双轴定位 | `<Position at={{x,y,anchor,offsetY}}>` | **框架** |
| stagger | `<Animate stagger={{each}}>` | **框架** |
| render-prop（代码行 is-active） | `<Animate>{({enterProgress})=>...}</Animate>` | **框架** |

**自定义只在三处**：y 位移幅度、SVG stroke 动画、节点 pop/ring/fill——均因框架预设无法表达这些
「服务于该能力演示」的语义性动画。不用 setInterval / 不用 window scrollY / 不绕预算。

---

## 三、i18n
现版 `cap.*` 键（shot1/2/3.slate/title/...）大部分可复用，按新概念补键：
- `cap.tc.fmt`（时间码模板 `00:00:{ss}`）、`cap.shot{N}.step{K}`（节点/cue 文案）、
- SHOT03 九预设名走 preset 字面量（中英一致，不抽 i18n）。
- 中英同构校验（`i18n/types.ts` 现有机制）。

---

## 四、实施节点

- [x] N0 清障：删 `Animate.stagger.test.tsx` -> type-check 回绿
- [x] N1 i18n：`zh.ts`/`en.ts` 补 `cap.tc.*` / `cap.shot{N}` 键（中英同构）
- [x] N2 重写 `CapabilityScene.css`：1440×900 画布 + 安全区 + 时间码轴 + 三镜语义类 + 背景辅助元素（胶片帧号/网格点）
- [x] N3 SHOT 01 装配：活结构树（4 节点 + 双连线）+ 边框装配/叶子就位/连线接通 + 视差 y 分层
- [x] N4 SHOT 02 结算链：左代码 + 中连线区 + 右节点列（填满右半）+ render-prop 同步高亮
- [x] N5 SHOT 03 预设剧场：单大舞台 + 9 预设原生 enter 交替 + 底部擦洗轴 + 占位防空白
- [x] N6 时间码轴：每镜独立 00:00:00->00:00:09，offsetTop 直读段内进度，游标流畅跟随
- [x] N7 预算精调：每镜 ~4.3-5.2 屏（从容），探针实测三镜 scrub 正常
- [x] N8 type-check 0 错误 + lint 0 错误 0 警告（修复 setPhase 依赖）
- [x] N9 vite build 通过
- [ ] N10 **独立 agent 真实浏览器验收**（localhost:4000 滚动实测）

### 实现记录（关键修复）

1. **框架 bug（P0）**：`DirectScrollCineView.tsx` setZoneState skip-compare 漏比 sceneIndex -> zone 后期修正 index 时更新被丢 -> cap 元素读 scene0 layout -> progressPx 饱和 -> 动画卡 entered。修：compare 加 sceneIndex。113 测试全绿。
2. **预算模型纠偏**：phase 是 totalBudgetPx 的分数，非独立预算。初版 phase-only 无链 -> budget=32px -> 全饱和。修：用真实 waitFor 链累加预算。
3. **render-prop 注册陷阱**：函数 children 但无 enterAnimation -> 不注册 zone -> waitFor 断裂 + enterProgress 不更新。修：所有 render-prop 加 enterAnimation="fade-in"。
4. **SVG stroke 不可行**：白名单不含 strokeDashoffset。修：用 scale+opacity + CSS non-scaling-stroke。
5. **lint**：setPhase 升级为稳定 useCallback 后，runEnter/Exit/Visibility 依赖数组漏补。修。
6. **dev server 双 React**：旧 vite 从 root 解析 react，site 从 site/node_modules 解析 -> Invalid hook call。修：kill 旧进程 + 清缓存 + site 目录重启。

## 五、验收标准（按 CLAUDE.md 规则 4，须独立 agent 真机实测）

- [ ] 每镜 center-lock 接管，~1 屏（~900px）演完，无 7 屏拖沓
- [ ] 元素无越界（1440×900 画布内，overflow:hidden 兜底无溢出）
- [ ] 三镜动画概念各异（装配/结算链/预设剧场），无重复
- [ ] 视差：元素相位切片错峰交叠 + y 位移分层（至少 2 层深度）
- [ ] 时间码轴贯穿三镜、随滚动递增、读作连续长镜
- [ ] SHOT01 结构树逐节点装配（边框→叶子→连线三阶段）
- [ ] SHOT02 左代码行与右节点同 index 同步点亮（fill ↔ ring）
- [ ] SHOT03 九预设各自原生 enter，滚动擦洗过 9 段
- [ ] 反向滚动三镜重新揭示，无永久消失
- [ ] 中英文切换文案正确
- [ ] console 0 error / 0 warning（除 React Router future flag）
- [ ] reduced-motion 下瞬间到位、CSS 动画关闭
