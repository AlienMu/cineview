# act3 时间轴反向重排（v4）· 实现报告

日期：2026-08-15 ｜ 分支：`codex/drag-release-dual-gate` ｜ 探针：`site/scripts/_rv-20260815-act3-reverse.mjs`

## 定稿执行情况（全部按拍板方案，零自由发挥）

1. **步骤反转** ✅ — 原「panel 朝心汇聚接力（0–8200ms）→ 标题显影收尾（8200–10000ms）」
   改为「标题开局显影（0–900ms，`timeline.delay: 0`）→ 六块 panel 逐块运动倒放（0–8200ms 接力）→
   8200–10000 全场静息收尾」。
2. **运动倒放** ✅ — `dollyVariant` 关键帧逐帧镜像：
   - v3 `times [0,.30,.74,1]` / 值 [静息→峰值] ⇒ v4 `times [0,.26,.70,1]` / 值 [峰值→静息]；
   - `initial` 从 `{x:0,y:0,scale:base,opacity:1}` 改为 `{x:-块心偏移,y:-块心偏移,scale:peak,opacity:0}`；
   - `x/y`：`-(块心偏移)`（块心=画布中心）→ `0vw`（散落位）；`scale`：peak → base；
   - `opacity`：`[1,1,.92,0]` 反序为 `[0,.92,1,1]`——峰值出现带淡入（窗内前 26%），其后恒 ≥0.9 常驻；
   - `DOLLY_BLUR_OUT`（blur 0.34vw）保留但挪到**起点峰值**段：倒放着地前微糊 → 退到位清晰（对焦语汇倒放）；
   - 接力密度不变：`DOLLY_MS=2000`、`DOLLY_STEP=1240`，delay 仍 `index * DOLLY_STEP`。
3. **标题** ✅ — `developVariant`（虚焦 0.42vw→实焦 + scale 0.95→1）原样沿用，位置正中
   （桌面 y=372 / 手机 0.446H，块心 0.50H 不变）；`timeline={{ delay: 0 }}`，显影后 progress 钳 1
   **常驻整幕、永不退场**；`zIndex: panels.length + 1`（=7）挂 **Position 的 style**
   （挂 `.a3-panel` 会被 Animate/Position 双层 transform 层叠上下文囚禁——文件头实测记录维持有效）。
4. **副标题删除** ✅ — `shot3-summary` Animate 挂载、`SUMMARY_MS`/`BLOCKS_END` 零消费常量、
   `cap.shot3.summary` key（zh + en 双语）、`.act3-summary` CSS（桌面 + 手机断点）全部删净；
   `renderIntroLines`/`riseVariant` 从本文件 import 移除（定义仍归 CapabilityScene 自用）。
5. **终帧** ✅ — 标题居中 + 六块静息散落（散落布局数据未动一字）。
6. **预算不变** ✅ — `SHOT3_CLOCK_MS=10000` 不动，纯相位/次序重排；scrub 纯函数，反向滚动天然镜像。
7. **手机布局** ✅ — `PANELS_MOBILE`（`buildPhonePanels`）共用同一 `dollyVariant`，自动镜像；探针
   390×844 双语实测（见下）。

## z 序方向反转（v4 连带改动，非自由发挥）

v3 的 `zIndex: 6 - index` 前提是「已演完的块早已淡出」。v4 里已着地的块**常驻可见**（opacity 1），
沿用旧向会让先着地的块压在正在退回、仍铺满画布的巨型块之上。故改为 `zIndex: index + 1`
（出场越晚 z 越高，正在退回的块恒在已着地块之上），标题 `panels.length + 1` 再高一层。
宿主仍挂 Position style（层叠上下文囚禁问题不变）。

## 改动文件

| 文件 | 改动 |
| --- | --- |
| `site/src/components/Act3DollyScene.tsx` | v4 运动模型注释（保留 v1–v3 裁决史）、z 序注释反转、时间预算注释、`dollyVariant` 镜像、title delay 0 + zIndex、删 summary 挂载/常量/import |
| `site/src/components/Act3DollyScene.css` | 文件头契约改 v4 倒放描述；删 `.act3-summary`（桌面 + 手机）；`.act3-titleblock` 去掉死 gap、注释重写（保留类名：手机断点 `.cap-title` 字号覆盖的限定宿主） |
| `site/src/i18n/zh.ts` / `en.ts` | 删 `cap.shot3.summary`（双语同构，DictKey 随 zh 收窄） |
| `site/scripts/_rv-20260815-act3-reverse.mjs` | 新增探针（本报告数据源） |

`npx tsc --noEmit` 0 错误；prettier 全绿。未触碰框架 `src/`、Scene5Cinema/act4/act1、无 framer-motion import。

## 真机探针数据

探针 `_rv-20260815-act3-reverse.mjs`（首页 scroll lane `localhost:4000/#/`，dev server 实测；
scrollTop 25px/16ms 循环小步穿段防「防跳过钳大跳」；采样读 Animate 包装层
`[data-cineview-animate-id]`；每档静置 150–200ms 后采样）。四组配置 **ALL PASS（exit 0）**：
zh/en × desktop(1440×900)/mobile(390×844)。产物：`probe-act3-reverse-*.json` +
`terminal-*.png`（本目录）。

### A. 标题开局显影 + 常驻（四组同过）

- 显影窗 [0,900ms]：op 0.03 → 1（600ms 处到 1，窗内 11 采样单调升）；blur
  `blur(5.86px)`(=0.42vw@1440) → `blur(0px)`；scale 0.95→1。
- 常驻：elapsed 1050→9900 共 88 档 op 恒 = 1（minOp 1）。永不退场 ✅。
- 区间起点 z0=15060（maxScroll 33680），两语言完全一致（显影与文案无关，符合预期）。

### B. 六块倒放接力（四组同过，桌面数据；手机见 JSON）

| panel | 相位窗(ms) | 峰值 scale（首采样） | 静息 scale | 窗内档数 | 单调性 |
| --- | --- | --- | --- | --- | --- |
| chain | 0–2000 | 3.47 | 1.02 | 21 | 严格降 ✓ |
| stagger | 1240–3240 | 4.02 | 0.68 | 20 | ✓ |
| position | 2480–4480 | 4.05 | 0.90 | 20 | ✓ |
| container | 3720–5720 | 3.37 | 0.72 | 20 | ✓ |
| image | 4960–6960 | 4.54 | 0.58 | 20 | ✓ |
| scrub | 6200–8200 | 3.58 | 0.96 | 21 | ✓ |

- 静息 scale 与 PANELS 数据 base **逐块精确吻合**（桌面 6/6、手机 6/6）。
- opacity：窗内前 28%（镜像 keyframe times 0.26）淡入单调升（如 chain
  0.04→0.21→0.39→0.57→0.74→0.92），其后窗内 min ≈ 0.929、窗后恒 = 1（六块一致）✅。
- 手机（390×844）峰值 4.46–5.12（画布高 3116 设计 px，peak 按 h 轴撑满），接力窗一致，
  静息 0.56–0.98 与 spec 吻合 ✅。

### C. 反向滚回镜像（四组同过）

- 反向从终态滚回，各元素 op 穿 0.5 的 elapsed：panels [200, 1400, 2600, 3950, 5150, 6350]、
  title 200 —— **panels 1–5 全部先于标题退场**，标题与 panel 0 同为 delay 0、同时退 ✅
  （panel 0 与标题先后不作断言：两者窗口起点重合是拍板方案 delay 0 的固有结果）。
- 镜像区间 elapsed≈1100：仅 title(op 1) + panel0(0.97) 在场，panels 1–5 op=0 ✅。

### D. 终帧不遮挡 + 标题带重叠（双语实测，数据呈报不挪位）

elementFromPoint（标题文本**每行**中心+四角，inset 6px）：

- zh-desktop：1 行 × 5 点 = 5/5 命中标题自身；en-desktop：2 行 × 5 点 = **10/10 命中**；
  zh/en-mobile：各 2 行 × 5 点 = 10/10 命中。**没有任何点被 panel 盖住** ✅。

标题带与静息 panel 的矩形重叠（含 tilt 外接盒放大，标题 z 在上、墨/底对比 16.2:1，重叠处标题可读）：

| 配置 | 标题带（px） | 重叠 panel | 重叠面积 |
| --- | --- | --- | --- |
| zh-desktop | x398–1042, y372–421（1 行 644×49） | chain 右下角 | 2250 px²（46×49 条带） |
| en-desktop | x360–1080, y372–471（2 行 720×99；行1 695 宽、行2 270 宽） | chain 右下角 / container 左下角 / scrub 左上角 | 8268 / 247 / 1085 px² |
| zh-mobile / en-mobile | x≈98–293, y≈375–412（2 行 ~195 宽） | position / container（中排两块） | 2896 / 3311 px² |

en-desktop 的实际可见重叠 = 行1 左端 ~84px 宽压在 chain 底缘（含 tilt 盒余量，视觉更小）；
container/scrub 各为角上 ≤28×8 / 111×10 px 的贴边擦角。**结论：可读性无碍（对比 16.2:1、
z 序化解），但「en 两行标题常驻 + 六块静息」确实共处**。若用户要零重叠：
桌面标题带需 ≤ ~600px 宽（当前 en 行1 695px ≈ 31 字符 ⇒ 单行上限 ≈ 26 字符/行，
或压字号），文案是拍板项未动。

### E. 峰值 panel 底板上标题可读性（双语各一帧，elapsed≈450）

标题墨 `rgb(26,24,20)` vs 峰值 panel 底板 `#f9f4ea` ≈ **对比度 16.21:1**（≥4.5 达标，
zh/en 相同——墨/板与语言无关）。注：C9 后 panel 底板为不透明实底，标题压在其上
等同压在浅色纸面，非「半透明底板」情形。

### 视觉复核

- terminal-zh-desktop.png：标题居中完整可见、六块散落、无遮挡、无破绽（视觉模型复核确认）。
- terminal-en-desktop.png：两行标题完整可见未被任何卡片盖住、六块散落（01–06 全在场）、
  无半绘制/层叠破绽（视觉模型复核逐项确认；卡片序号/位置与 PANELS 布局一致）。
- 其余两张截图（zh/en mobile）+ 全部逐档采样见本目录 JSON。


## 自检（CLAUDE.md 完成后自检四条）

1. 整改真完成：行为与意图一致——标题开局显影常驻、六块倒放接力、终帧静息散落，无半程状态。
2. 无冗余：summary 相关 TSX/CSS/i18n/常量/import 全仓 grep 删净（`cap.shot3.summary` 零残留）。
3. 可控性：改动为纯数据/相位重排，无新状态、无新 hook、无每帧路径变化；文件行数净减。
4. 运行时性能：不引入任何每帧新运算——仍是一条 Animate lane 的关键帧插值（属性数、times 数不变，
   仅数值重排）；z-index 仍为静态值。无新增 setState/motionValue。
