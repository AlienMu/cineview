# Task Flow — 屏2（act2）背景打光柔化重做（2026-07-27）

## 归属

本任务是 `2026-07-25-drag-cinematic-redesign.md` 的**屏2（SceneSlate / 02 SLATE）**门禁项，
对应该文件中三条已存在但未收口的条款：

- 「2026-07-27 用户最新五项纠偏」第 3 条：**屏2背景** —— 补充不抢主光的背景元素与空间层次。
- 屏2 静态审计：**「聚光被关在 canvas 盒子里，无法『打进黑场』」**（定稿第 30 行要的是全画面那一拍）。
- 屏2 静态审计：canvas 每帧 `createRadialGradient` 新建（每帧分配）。

## 用户本轮原话（唯一验收口径）

> act2 的合板动画美了，背景的打光太简陋和粗糙，要柔和、景深、边缘不要这么锐利，
> 并且要有持续的动态效果。优先看框架提供的内容，在框架基础上使用，不要自己造轮子，
> 确认框架没有的时候才自己写。做完需要派发子 agent 自测通过后才算任务完成。

**不得触碰**：粒子合板本体（`particleField.ts` 的靶点/开合/炸散公式）——用户已认可其观感。

## 读码定位的「粗糙」根因（动手前核对，file:line）

1. `temporal-drag.css:755-770` `.s02-set__cone`：`clip-path: polygon(43% 0,57% 0,94% 100%,6% 100%)`
   - `filter: blur(9px)`。CSS 里 **filter 先应用、clip-path 后裁剪** → 模糊结果被硬边裁掉，
     两条直线锐边就是「边缘锐利」的来源。
2. `ClapperboardCanvas.tsx:112-127`：canvas 里的锥光用 `ctx.clip()` 多边形裁剪后填渐变 →
   同一个「先柔化再硬裁」的错误，且被关在 canvas 盒子里（照不到 slate/HUD/footer 带）。
3. 整个 `.s02-set` **零动态**：静态剪影 + 静态渐变，无任何持续动效（用户要「持续的动态效果」）。
4. 无景深：`__stand` / `__viewfinder` 是 1px 实线、`__scene-number` 是清晰字形，
   与前景同焦 → 没有「远处失焦」的空间层次。
5. `ClapperboardCanvas.tsx` 每帧 `createRadialGradient`（审计已列）。

## 框架能力盘点（先框架、后自写；这是硬约束）

| 需求               | 框架是否已有                                                                      | 结论                                                  |
| ------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 持续/循环动效      | ✅ `Animate.infiniteAnimation`（`Animate.tsx:368-405`，`shouldRunInfinite` 门控） | **用框架**，禁止 CSS `animation … infinite`（规则 6） |
| 进/退场绑定 drag   | ✅ `Animate.enterAnimation/exitAnimation` + `duration` + `timeline.delay`         | **用框架**                                            |
| 逐层错峰进/退场    | ✅ `timeline.delay` + 递减 exit 预算                                              | **用框架**                                            |
| reduced-motion     | ✅ 站点 `useTemporalMotion()`（`timing.reduced/seconds/duration/delay`）          | **用现成 hook**                                       |
| 柔光形状（无锐边） | ❌ 框架不做视觉绘制                                                               | 自写 CSS 渐变/遮罩（框架无此能力，属允许自写的部分）  |
| 景深（远景失焦）   | ❌ 同上                                                                           | 自写**静态** `filter: blur()`（静态 → 只栅格化一次）  |

**不新增任何自建 rAF / 自建 spring / 站点直接 import framer-motion 的动效**（规则 6）。
唯一保留的 rAF 是既有 canvas 自绘（DESIGN.md §0 已豁免，且已订阅 phase）。

## 执行节点

- [x] L0. 读码定位根因 + 框架能力盘点（本文件上两节）
- [x] L1. 新建 `SlateLightRig.tsx`：灯组各层全部走 `<Animate>`
      （enter/exit 绑 drag + `infiniteAnimation` 持续动效 + reduced 降级）
- [x] L2. CSS 重做 `.s02-light`：删 `clip-path` 硬裁 → conic/radial 柔边 + 遮罩衰减；
      远景硬件层加静态 blur 做景深；补 `.cineview-animate` full-bleed 规则（infinite lane 收缩包裹坑）
- [x] L3. `ClapperboardCanvas`：删 `ctx.clip()` 硬边锥光（DOM 灯组接管全画面柔光），
      改板上柔光核心 + 接触光池；渐变改 resize 缓存 + `globalAlpha` 调光（消每帧分配）
- [x] L4. `SceneSlate` 接线（`.s02-set` → `<SlateLightRig />`）
- [x] L5. 静态门：site type-check、format:check、site build
- [x] L6. 自测探针（仅作 L7 输入，不当验收结论）
- [x] L7. **派独立子 agent 真机验收**（实现 agent 不得自验）→ 第一轮 `VERDICT: PASS`
- [x] L7b. **终审独立子 agent 真机验收**（完整手势路径 + 反向重入重播 + reduced-motion + 无回归）→ `VERDICT: PASS`
- [x] L8. 收口自检（AGENTS.md 完成后自检四条）+ 更新本文件与母 task-flow

## 验收判据（子 agent 必须逐条断言）

1. **边缘不锐利**：沿光锥左右边界横切采样，亮度不得出现单像素跳变；
   DOM 中 `.s02-set__cone` 必须不存在（旧 clip-path 光锥已删）。
2. **柔和/不抢主光**：板体（canvas 中心区）平均亮度 > 背景灯层区域平均亮度。
3. **景深**：远景层 computed `filter` 含 `blur`，且分级（scene-number > viewfinder > stand）。
4. **持续动态**：settle（progress 停在 1）后连续采样，背景区域像素有变化（infinite lane 在跑）；
   离开该幕后停止（phase 门控）。
5. **进退场绑 drag**：正向 scrub 灯层 opacity 单调上升；reverse scrub 单调下降；
   退场有反向编排（不是所有层同帧走），且最慢的灯层不长于合板 exit 700ms。
6. **无 console error / pageerror**。

## 执行记录

### L1–L4 实现（2026-07-27）

**新文件** `site/src/components/temporal-drag/SlateLightRig.tsx` —— 六层，每层都是一个
`<Animate>` 的直接子层，站点侧**零** framer-motion import、零 rAF、零 CSS infinite：

| 层                    | 形状来源                                    | 持续动效（infinite lane）    | enter / exit / delay |
| --------------------- | ------------------------------------------- | ---------------------------- | -------------------- |
| `__haze`（远景大气）  | 2 个大 radial + 底部地面平面渐变            | x/y 反向缓漂 21s             | 760 / 440 / 220      |
| `__set`（硬件剪影）   | 灯架/取景框/场号，**静态 blur 分级 = 景深** | 无（刚体不该自己晃）         | 700 / 480 / 260      |
| `__beam`（主光锥）    | 28° conic 宽楔 + 12° 热核 + radial 遮罩衰减 | opacity 呼吸 + 微 scale 9.5s | 620 / 700 / 0        |
| `__spill`（灯头溢光） | 顶部 radial 光斑                            | opacity 起伏 6.5s            | 560 / 600 / 90       |
| `__pool`（地面光池）  | 扁 radial，78% 处归零                       | opacity + scale 13s          | 680 / 520 / 160      |
| `__bokeh`（散焦光点） | 4 个 radial 圆点，静态 blur 6–11px          | x/y 缓漂 27s                 | 620 / 380 / 300      |

- 进场错峰用 `timeline.delay`（beam 0 → spill 90 → pool 160 → haze 220 → set 260 → bokeh 300）
  = 先聚光、再有空间，符合定稿第 30 行顺序。
- 退场用递减 exit 预算做**反向编排**：bokeh 380 < haze 440 < set 480 < pool 520 < spill 600 < beam 700。
  beam 不超过合板 exit(700)，避免 A2「景撤了工作灯还开着」。
- `timing.reduced` 时 `infiniteAnimation` 一律 `undefined`（静态柔光，drag 进退场保留）。

**CSS**（`temporal-drag.css` 屏2 段重写）

- 删净 `.s02-set*`（含 `clip-path` 光锥与静态 floor），换 `.s02-light*`；全仓 grep 确认无残留引用。
- 柔边做法：所有形状以渐变收尾到全透明，光锥另叠 `mask-image: radial-gradient(...)` 做距离衰减 →
  **没有任何一处裁剪**（`clip-path`/`ctx.clip`）。
- 动的只有 transform/opacity；`filter: blur` 只出现在**静态**远景硬件与 bokeh 上（栅格化一次）。
- 补 infinite lane full-bleed 三层规则（照抄 `.s01-hands` 成例），否则匿名 wrapper 收缩包裹 →
  百分比位移解析为 0px（台账 E 行同一个坑）。

**canvas**（`ClapperboardCanvas.tsx`）

- 删掉 `ctx.clip()` 多边形锥光（硬边根因之一，且与 DOM 光锥重复）→ 板上柔光核心 + 接触光池。
- 两个渐变改为 `resize()` 时缓存，每帧只 `globalAlpha = spot` 调光 → 消除每帧 `createRadialGradient`。
- `window.resize` → `ResizeObserver`（canvas 是 grid 行的拉伸子项，盒子会在窗口不变时变；
  盒子变了缓存渐变也要重建）。
- 粒子/开合/炸散公式**一行未改**，`dataset.openDeg/exiting/progress/form/spot` 全部保留
  （既有探针 `c-clap-exit.mjs` / `slate-probe.mjs` 判据不失效）。

**接线**：`SceneSlate.tsx` 用 `<SlateLightRig />` 替换内联 `.s02-set` 剪影块；
`02 / SLATE` 改读 `t('dragTemporal.s02.slateLabel')`（该 i18n key 原本零消费）。

### L5 静态门（实测）

- `pnpm --dir site type-check` → exit 0（tsc --noEmit 无错）
- `pnpm exec prettier --check`（4 个改动的 src/css 文件）→ 全部 pass
- `pnpm --dir site build` → 成功（唯一告警是历史的 chunk >500KB 提示）

### L6 自测探针（实现 agent 自跑，仅作 L7 输入）

`site/scripts/act2-light-probe.mjs`（Playwright 真 Chromium，390×844，dpr2，preview :4010）。
判据 15 条全绿（`FAILED=[]`，`pageErrors=none`）：

- `legacyConeRemoved`（`.s02-set*` 节点 0）/ `sixLayersMounted` / `noZeroSizedWrappers`（wrapper 高度非 0）
- `noClipPathInRig`（rig 内 computed clipPath 全为 none）/ `beamHasSoftMask`
- `depthOfFieldGraded`：sceneNumber 3.4 > viewfinder 2.0 > stand 1.1（组层 1.6）
- `softEdge`：光锥横切最大单步亮度跳变 **2.3–2.56**（隐藏 `.tp-texture` 颗粒层后测）
- `controlDetectsLegacyCone`：把旧 clip-path 光锥注回 DOM，同一判据报 **8.74** → 判据能抓到它声称能排除的缺陷
- `allLoopsLive`：5 个带 loop 的层 inline opacity/transform 4 次采样全不同；`loopsFreezeOffPhase`：离幕后冻结
- `boardBrighterThanBackground`：板体 60.6 vs 背景 24.4
- `enterFollowsFinger` / `exitFollowsFinger` / `exitReversesOrder`：手指按住持续移动时
  beam 0.834→0.480 单调降、bokeh 0.805→0.142（更早清场）

**两次自测失败并修正（记下来，属判据设计错误而非实现错误）**：

1. `softEdge` 初版阈值把 `.tp-ambient`/grain 颗粒噪声算成硬边（maxStep 4.22）。颗粒是装饰、不属灯组 →
   测量时临时隐藏 `.tp-texture`，且**对照与实测同条件**。
2. `exitTrace` 初版全 0：探针在多次来回拖拽后已不在第二幕，测的是**已退场**的 rig（永久 0）。
   → 加 `resetToAct2()`（reload + 单次提交 + 等 `.s02-light`）保证起点确定。
   教训与台账同一条：**断言必须跑在该分支真正可达的状态上**，否则是空过。

### L7 独立子 agent 真机验收 → PASS

独立 agent（未看我的结论，自建 `audit-*` 探针 + 自截图）判定 `VERDICT: PASS`，8 条全过：

- 边缘：自测像素法测得当前最大跳变 **7.26**（其取样带更靠下、含更多层叠加），
  阳性对照（注回 clip-path 光锥、不加 blur）**65.61** → 相差 9 倍，判据有效且当前无硬边。
- 景深：computed blur 3.4 / 2.0 / 1.1（+组层 1.6）分级成立，截图上远景确实虚、板体实。
- 持续动态：settle 后 6 层中 5 层 inline style 持续变化（`__set` 按设计无 loop）；
  回到第一幕后 **0 层**继续变化 → `shouldRunInfinite` phase 门控成立。
- 进退场：正向单调升、反向单调降；退场非同帧（exit 预算分级 380–700），最长 700ms 未超合板。
- 不抢主光：板体 62.81 vs 背景 34.76（1.81:1）。
- 框架优先合规（读码）：`SlateLightRig.tsx` 无 framer-motion import、无 rAF/setInterval；
  `.s02-light*` 规则内无 `animation:`（文件里仅剩的 infinite 在 `.tp-ambient*` / grain，属幕外 chrome）。
- 0 console error / 0 pageerror；site type-check exit 0。
- 审美：不再读作「简陋粗糙」，无可见硬边、不空旷、光有层次，合板本体未被误伤。

非阻塞建议（子 agent 提出，未改）：地面光池还可再亮一点以更「压住」板体——属偏好，非缺陷。

### L7b 终审真机验收（第二个独立子 agent，2026-07-28）→ PASS

在**重新 build 后的 preview（:4012）**上重跑，额外覆盖了第一轮没测的三项：
完整手势路径（1→2→反向回 1→再正向回 2→继续到 3）、reduced-motion 降级、跨幕无回归。
自建 `final-audit-*` 探针 + 自截图，判定 `VERDICT: PASS`，10 条全过：

| 判据             | 实测                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 完整手势路径     | 0 console error / 0 pageerror；beam settle 后 1.000，**反向回第一幕再回来仍 1.000**（可重播，不是死在 0 或卡中途）；无空白帧      |
| 边缘不锐利       | 最大单像素跳变 **5.07**；阳性对照（注回 clip-path 光锥，同条件）**63.73** = 12.6 倍                                               |
| 景深             | 含组层累积 blur：场号 **5.0px** > 取景框 **3.6px** > 灯架 **2.7px**，严格递减                                                     |
| 持续动态         | settle 后 4/5 带 loop 层 inline style 持续变化（`__set` 按设计无 loop）；回第一幕后 **5/5 冻结**                                  |
| 进退场绑 drag    | 入场 30 采样单调不降且有升（0.382→1.000）；退场 beam 单调不升（0.973→0.188）；退场 50% 处 bokeh 0.202 < beam 0.567 = 反向编排成立 |
| 不抢主光         | 板体 **55.3** vs 背景 **30.8**（1.80:1）                                                                                          |
| 框架合规（读码） | `SlateLightRig.tsx` 无 framer-motion import、无 rAF/setInterval；`.s02-light*` 规则内 0 处 `animation:`                           |
| 无回归           | 第一幕/第三幕截图元素齐全无错位无过亮；`site type-check` exit 0                                                                   |
| reduced-motion   | `reducedMotion:'reduce'` 下 0 报错、**5/5 循环冻结**、drag 进场仍在                                                               |
| 审美             | 不再读作「简陋粗糙」；无可见硬边；不空旷（六层光 + 硬件剪影）；层次清晰；合板本体未被误伤                                         |

两轮验收的边缘数值差异（7.26 / 5.07 vs 我自测 2.56）来自取样带高度与叠加层数不同；
三次测量的**共同结论**一致：当前值处于噪声量级，而阳性对照高出 9–25 倍。

### L8 收口自检（AGENTS.md 四条）

1. **整改是否真完成**：三处「先柔化再硬裁」的根因都被删除（CSS `clip-path`、canvas `ctx.clip()`），
   不是把阈值调过去；持续动效走框架 infinite lane 而非补一个 CSS 循环。无 TODO、无注释掉的旧逻辑。
2. **是否引入冗余**：旧 `.s02-set*` CSS 与 JSX 全删（grep 仅剩 `SlateLightRig.tsx` 文件头的历史说明注释）；
   canvas 里被锥光独用的 `cx`/`bodyBottom` 局部变量一并删掉；未新增零消费导出
   （`SlateLightRig` 不进 barrel，因该 barrel 本身只导出被 barrel 消费的组件）。
   `dragTemporal.s02.slateLabel` 从零消费变成被消费。
3. **项目是否仍可控**：新增 187 行独立文件，未把逻辑堆进 `SceneSlate.tsx`（该文件反而变短）；
   六层配置是数据表 + 一个 `map`，加层不需要改渲染代码。
4. **运行时性能**：每帧新增开销只有 5 条 framer transform/opacity 补间（合成层属性，不进 React 渲染管线，
   周期 6.5–27s）；**canvas 每帧少了 2 次 `createRadialGradient` 分配**；
   大面积 `filter: blur` 只在静态层上（不随帧变化 → 栅格化一次）。
   `boardBrighterThanBackground` 与 phase 冻结两项由真机实测，非推断。
