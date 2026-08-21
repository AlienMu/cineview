# Site 侧对抗复审结论（2026-08-13 · ask1 背景/组件色 + ask2 黑幕）

> 由独立 Explore 子 agent 产出，父 agent 落盘。原始任务：清点组件色面、评估 RGB 跟随机制、解读「相邻暖色」、ask2 根级黑层可行性。

## A. 组件色面清点（五幕全量）

### A1. 应跟随的「板/head/bar」类实色面（用户所指）

| # | 选择器 | 文件:行 | 当前值 | 来源变量 | 用户语义 |
|---|---|---|---|---|---|
| 1 | `.film-codecard__bar` | CapabilityScene.css:445-452 | `var(--scene-plate-bar, #fbefe6)` → act2 台阶 #fbefe6 | global.css `--scene-plate-bar` | **「codeboard head」**（窗口条） |
| 2 | `.film-codecard` | :433-442 | `var(--scene-plate, #f8e7da)` | global.css `--scene-plate` | codeboard 底板 |
| 3 | `.a3-panel__bar` | Act3DollyScene.css:102-109 | `var(--a3-plate-bar)` #f9e7da | `--a3-plate-bar` | **「panel head」**（顶栏） |
| 4 | `.a3-panel` | :81-99 | `var(--a3-plate)` #f5e0d1 | `--a3-plate`（C9 硬约束面） | panel 底板 |
| 5 | `.a3-panel__code` | :150-163 | `var(--a3-plate-foot)` #f2dbcb | `--a3-plate-foot` | 代码脚（bar 类面） |

注：`.film-codecard__head`（CapabilityScene.css:481）只是 body 内 prompt 行 flex 容器，无背景色，不是色面。

### A2. 半透明面（靠 alpha 透出跟随，豁免逐帧改实色）

- `.tc-capsule`（CapabilityScene.css:62-82）：rgba(250,248,244,0.72) + backdrop-filter——半透磨砂天然透出背后色带。
- `.film-track`（:199-206）：rgba(250,248,244,0.4) + backdrop-filter——胶片带本体。

### A3. 不应跟随

- REC 信号红（--rec #c4453f）、codecard 三圆点（装饰写死）、`.film-track__perf` 陶土基边（线框色）、中性墨分隔线/投影（历史裁决：中性件任何色相底上成立）、`.bg-grid` 点阵、demo-video 整幕（无实色面板）、Act5 手机屏内 UI（黑场语境）。

### A4. 台阶变量现状（global.css:45-86，C5 已建）

`.home-scene--hero/film/shot3/demo/cinema` 各定义 `--scene-accent/accent-ink/plate/plate-bar`；Act3 另有本地 `--a3-plate/bar/foot`。消费方只有 A1 五处 + accent 族小元素。

## B. RGB 跟随机制评估（每帧代价论证）

### B1. 机制 1（每帧写 CSS 变量 `--bg-now`）——否决

- head/bar 是小面，`background-color` 消费不触发全屏重绘（memory 的 opacity 全屏重绘是 opacity 专属）。
- 真正的雷：变量写在滚动容器（五幕共同祖先）时，继承型 custom property 每帧变更 = 整棵子树 style 失效重算（首页 1500–2500 节点，JS profiler 看不见，低端机 0.5–2ms/帧）。写各 Scene 根 = 5 次 setProperty/帧；收到消费者自身 = 机制 2 加一层间接。没有理由选它。

### B2. 机制 2（HomeBackdrop rAF 投影直写 style.backgroundColor）——推荐

- 扩展 HomeBackdrop 现有 `write()`（HomeBackdrop.tsx:106-113）：每帧已有 progress p，为每个注册消费元素算 `bandFraction = (docOffset + p·bandTravel) / bandH`，查锚色 LUT + 固定提亮变换，**仅在量化后 RGB 变化时**写 `el.style.backgroundColor`。
- 代价：JS N≈5–8 × (LUT 插值 + 字符串拼接) < 0.1ms/帧；无 setState、无 React render、无布局读（docOffset 挂载/resize 测一次）。
- 样式失效：inline style 写叶子元素 = 仅该元素局部重算，零子树扩散（对机制 1 的决定性优势）。
- 重绘：小面可忽略；唯一实质成本 = Act3 六块 panel 放大铺满时（已提层），量化写把实际写入频率压到「颜色真实可见变化」≈ 每 5–10px 一次；低端机由 N3 探针 paintCount 定论。兜底：阈值写 + 消费面 CSS `transition: background-color 250ms linear`。
- 单一写者：site 侧 scrollTop 唯一读者 = HomeBackdrop.tsx:110，机制 2 保住该不变量。
- 单一真源：挂载时 `getComputedStyle(band).backgroundImage` 解析渐变停靠点构建 LUT，与 CSS 锚色表零复制；配 parity 探针防漂移。
- 耦合面：`[data-bg-follow]` 属性契约 + 每帧 querySelectorAll（~0.05ms）；最小可行版 = HomeBackdrop 内硬编码 5 个选择器。

### B3. 机制 3（幕级台阶）——现状，用户要的不是它

用户原话「按滚动位置调整 RGB 参数」「根据背景色同步过渡」= 连续跟随；台阶在幕边界才跳一次，必然再次被判「没跟随」。台阶保留为 CSS 兜底基线，逐帧写覆盖其上。

### B4. 硬约束核对

- `scrolling-ribbon-makes-tint-visible`：跟随色与色带同源同函数，结构上不可能出现「固定暖面 vs 变色带」色温劈叉——比台阶近似更安全。前提：锚色表全暖无冷段。
- Act3 同色温硬约束（C9）：板色=面板 doc 位采样 + 提亮变换。提亮若向白 lerp 会压缩 R−B（20% 白化把 +36 压到 +29），C9 要求 R−B≈35——提亮应**只提 L 或系数 ≤8%**。C9 残留（屏内色带横跨 ~12 R−B，平色板无法同时匹配屏顶屏底，残余 ~8 单位摆动）不因跟随改善也不恶化——用户明确「纯色非渐变」，此为接受残留。

## C. 「从相邻暖色过渡」解读与锚色建议

### C1. 当前锚色实测（HomeBackdrop.css:69-80）

| 锚 | 0% | 12% | 24% | 33% | 40% | 52% | 68% | 84% | 100% |
|---|---|---|---|---|---|---|---|---|---|
| 色 | #fdf0e7 | #fae4d5 | #f6d8c4 | #f0c9b1 | #e9bb9f | #eec4a9 | #f4d3bd | #f9e1cf | #f7dfcc |
| lum | 242 | 232 | 221 | 208 | 195 | 203 | 216 | 229 | 227 |
| R−B | 22 | 37 | 50 | 63 | 74 | 69 | 55 | 42 | 43 |

相邻步进：lum 8–14、R−B 5–15。

### C2. 四种可能解读

1. 字面（最可能）：「从一个相邻的暖色过渡到下一个」= 相邻锚点间插值、全程暖色——现有 linear-gradient 已在做。若用户以此重提，说明不满不在机制而在观感，指向 2。
2. 避免深谷：40% 锚 #e9bb9f（lum 195、R−B 74）观感是烧陶/土橘，可读作「脏」而非「暖」。
3. 幕间相邻：幕交界过渡要自然（幕间构图缺口历史上报过暖橙一闪 N14）。
4. 单纯重申需求。

### C3. 建议锚色策略（须用户拍板）

- 保留 9 锚/单向暖扫掠；**抬谷**：谷底 lum 195→≈205–210、R−B 74→≤55，全带 min R−B ≥ +20（无冷段）；
- 相邻步进 lum ≤12、R−B ≤15（现 0%→12% 的 R−B +15 已到上限）；
- 全页摆幅 ≥25 lum（08-12 教训：11 不够；47 可能过火，25–35 是「可察觉但不成污斑」区间）——用户决策点。

## D. ask2 黑幕退场——site 侧核查

### D1. 根与 z 序实测

- `.drag-temporal`：`--tp-bg: #0c0a0c`（微冷近黑）、position:relative、isolation:isolate、overflow:hidden、height:100svh；`.cineview-container` 同为 `--tp-bg !important`。
- 第五幕黑幕 = `.tp-scene--05` 自身背景（temporal-scenes-03-05.css:916-927）`linear-gradient(180deg, #050506, #08090c 68%, #0c0d11)`——挂在场景框内随 DragSceneStack 每帧 translate3d 下移。
- z 序：内容 z45–47，`.tp-texture`（颗粒/扫描线/暗角）z50。`.drag-temporal` 隔离上下文 → `position:absolute; inset:0; z-index:60` 兄弟层可盖住全部框含颗粒。✅（已复核：texture z=50、--tp-bg #0c0a0c）

### D2. callbacks 接线（公开契约够用，零框架改动）

- `onDragStart {sceneIndex, direction}`——所有权取得时发（CineView.tsx:617）。
- `onDragProgress`——**仅输入驱动期**逐帧发（dragSessionActiveRef 门控，CineView.tsx:632），松手补间期不发。
- `onDragCommit {sceneIndex, targetSceneIndex, …}`——release 结算起点（CineView.tsx:1007）。
- `onSceneDidChange`——onAfterChange 派生（CineView.tsx:370/385）。
- **方案 A 编排**：
  1. 黑层渲染在 live 分支（CineView 之后），`z-index:60`、`pointer-events:none`、`opacity:0` 默认；背景复用 `.tp-scene--05` 同款渐变（抽共享 custom property 防双源）。
  2. `onDragCommit(targetSceneIndex < 4)` → 黑层 `opacity:1`（无过渡，瞬间盖住即将开始的 720ms settle 下移；拖拽本身不受影响——用户只反对松手后的补间）。
  3. `onSceneDidChange(toIndex < 4)` → `transition: opacity 700ms`（与 COPY_EXIT_MS=700 同预算）淡出至 0。净观感：黑幕持住 → 淡出露出已就位第四幕 = 「只淡出」。
  4. cancel 路径无需处理（commit 才开层）。
- 残余/风险：s05-copy-exit 字幕淡出在黑层后空跑（无害）；黑层压颗粒 ≤720ms（0.11 透明度不可察）；需框架侧确认 `onSceneDidChange` 精确发射点（settle 完成 vs commit）——若在 commit 就发，改兜底 `setTimeout(720ms)` 从 onDragCommit 起算。
- 壳态分支：preload/frozen 返回裸 `.drag-temporal`（:108-110），黑层只在 live 分支、随 cineview-freeze 卸载——零影响。

## 决策点汇总（需用户拍板）

1. 跟随范围：A1 五面（推荐）vs 含 accent 族。
2. 锚色表：抬谷收幅（lum 谷 ≈205–210、R−B≤55、全幅 25–35，推荐）vs 保现状 47 摆幅/深谷。
3. 采样模型：逐元素 docOffset 采样（推荐）vs 视口中点单色。
4. 提亮变换：只提 L 或系数 ≤8%。
5. 写入策略：每帧量化直写（推荐）vs 阈值写 + CSS transition 兜底。
6. ask2：确认「720ms 蒙版持住 + 700ms 淡出」节奏；确认 site 根级黑层方案（vs 框架原生，待框架 agent）。
