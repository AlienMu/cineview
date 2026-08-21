# act4→act3 反向掉帧 zone 归属复测（2026-08-14）

只读复测。探针 `site/scripts/_rv-20260814-zone-retest.mjs`（可重复跑），原始数据
`site/review/20260814-adv/zone-retest.raw.json`（每 run 落盘，含全部长帧的 {ts, frameMs, scrollTop, zone}）。

## 目的

区分 act4→act3 反向掉帧主因：
- **(a)** act4 段内反向擦洗（AnimateVideo 逐帧 seek）本身的 raster/解码成本
- **(b)** 倒回 act3 段时 act3 面板反推镜 + act4 视频解码帧驻留的合成压力

## 调试通道核查（任务前置线索的实测校正）

任务线索称 `window.__CINEVIEW_SCROLL_DEBUG__` 运行时暴露 segment start/end。
**实测该通道在站点环境是死代码**，先后两种挂载时机均不生效：

- 框架 dist 构建 `vite.config.ts:31-36` 用 define 把 `process.env.NODE_ENV` 写死
  `'production'`；`isScrollDebugEnabled()`（`src/components/CineView/directScrollHelpers.ts:43`）
  首行 `production → return false`，minify 后内联为常量。
- 佐证：dist 全文 `grep __CINEVIEW_SCROLL_DEBUG__` **零命中**；编译产物里
  `exposeTakeoverDebugData:!1` 硬编码。
- 页面实测（`_rv-dbg-check.mjs` / `-check2/3/5.mjs`，已留档）：flag 在 addInitScript
  （页面脚本运行前）与首次渲染后两种时机下，4 个 takeover shell 全程只有 2 个属性
  （`data-cineview-takeover-shell` + `style`）；正反向各 60 档滚轮驱动后
  `data-cineview-takeover-segment-start` 依旧 null。
- 附带校正：`home-scene--*` 类挂在 Scene 组件渲染的 div（takeover content 内层），
  **不在 `[data-scene-index]` slot 上**；按 slot className 匹配 act 归属会全空。

**替代边界来源（无标志、纯 DOM 实测）**：takeover slot 的
`paddingTop = (flowSpan − viewport)/2`（锁段居中），故
`segmentStart = slot.offsetTop + computed(paddingTop)`，
`segmentEnd = segmentStart + (offsetHeight − viewport − 2×paddingTop)`。
（本页所有 slot 实测 padTop=0。）

## zone 边界实测值（1440×900 视口，来自 slot DOM）

| zone | slot | segmentStart | segmentEnd | 预算 px | flow px |
|---|---|---|---|---|---|
| act1 hero（非 takeover） | 0 | 0 | 0 | — | 900 |
| act2 film | 1 | 900 | 14140 | 13240 | 14140 |
| act3 shot3 | 2 | 15040 | 25060 | 10020 | 10920 |
| act4 demo | 3 | 25960 | 30600 | 4640 | 5540 |
| act5 cinema | 4 | 31500 | 33700 | 2200 | 3100 |

## 方法

- 真实滚轮（Playwright `page.mouse.wheel` = CDP Input.dispatchMouseEvent），不直设 scrollTop；
  指针居视口中心，wheel 卡死即抛错。
- rAF 直测帧间隔（相邻 rAF 时间戳差），scrollTop 由 passive scroll 监听缓存（rAF 内零 layout 读）。
- 长帧阈值 >30ms，按 scrollTop 所在 zone 分桶；边界带（act4.start−150 .. act3.end+150）单列。
- 用户路径复现：先正向 scrub 穿过 act4 整段到 segmentEnd+40（视频 cur 9.99s/10.04s 确认播完），
  停段末−200px 平息 1.2s，再反向驱动。
- 每组 3 次独立页面，取合计与中位。

## 组设计

| 组 | 视频帧 | 反向路径 | 目的 |
|---|---|---|---|
| raw | 播完保留（hasSrc:true, cur 9.69s） | 30400 → 14140（穿 act4 全段+边界带+act3 前 900px） | 基线 |
| ctrlA 驻留消除 | 播完后 pause+removeAttribute('src')+load()（hasSrc:false, cur 0 确认） | 同 raw | 消 (b) 中的驻留成分 |
| ctrlB 擦洗隔离 | 播完保留 | 30400 → act4.start+120（只反向 scrub act4 段，不进 act3） | 隔离 (a) |

## 长帧归属表（3 次合计 / 每次均值）

| zone | raw（帧保留全程） | ctrlA（帧卸载全程） | ctrlB（帧保留仅 act4 段） |
|---|---|---|---|
| act4-demo | **77 / 25.7**（max 50.1） | **0 / 0** | **62 / 20.7**（max 34.3，p50 33.3） |
| act3-shot3 | 24 / 8.0（max 49.9） | 34 / 11.3（max 66.9） | 0（路径不进） |
| 边界带 | **0** | **0** | — |
| act2-film-past | 1 / 0.3 | 0 | — |
| 总帧数 | 1964 | 2104 | 479 |
| 长帧密度（每 100 帧） | act4 段 3.9，act3 段 1.2 | act3 段 1.6 | act4 段 12.9 |

逐帧验证：raw 的 act3 段长帧 scrollTop 分布（16840–21880）与 ctrlA 的（16600–23200）
**同区间同密度**，且两组在这些帧时的 act4 视频一驻留一卸载——act3 段长帧与视频驻留无相关性。
raw 与 ctrlB 的 act4 段长帧沿反向路径均匀分布（段末→段首 8 等分桶两侧形态一致），
不是某一点位的毛刺，是全段性成本。

## 结论（全部有上面数据支撑）

1. **act4 段内长帧 100% 由「反向擦洗 + 解码帧驻留」驱动，且无法拆成两个独立成分**：
   - 帧保留时 scrub act4 段：每 run 20.7–25.7 个长帧（raw 与 ctrlB 同量级，沿全段均匀）。
   - 帧卸载后（ctrlA）同区段长帧 = **0**。没有「擦洗」就不可能有成本——unload 同时把
     scrub 的目标（currentTime seek）和驻留帧一起消掉了，二者在本探针结构上是同一开关。
   - 所以「(a) 擦洗本身」不是独立成本源：**没有独立的 (a)，只有「帧在 + 在段内 scrub」
     这个组合**，其代价 ≈ 每 run 21–26 长帧（headless 30fps 节拍下表现为每 3 帧吞 1 帧，
     即持续 ~2.6ms/帧的超额渲染时间）。

2. **act3 段长帧与视频帧驻留无关**：ctrlA 卸载后 act3 段长帧不归零（34 vs raw 24，
   密度 1.6 vs 1.2/100 帧，同区间），反略升——说明 act3 段成本来自 **act3 自身反推镜
   （面板缩放/透明度反 scrub 的每帧 raster）**，不是 (b) 描述的「面板 + 驻留合成压力」。
   (b) 的驻留成分被 ctrlA 证伪：驻留消除后 act3 段没有改善。

3. **边界带无长帧**：raw 全程 3 次，act4.start−150 .. act3.end+150 区间 0 个长帧。
   「倒回 act3 的那一刻合成器被双场景夹击」不成立——交界本身免费。

4. **主因排序**：反向掉帧的绝大多数长帧发生在 **act4 段内**（raw 77/102 = 75%），
   由视频帧驻留 + 反向 scrub 驱动；act3 段的是第二成本源（24/102 = 24%），
   由 act3 反推镜自身驱动，与视频无关。

5. **方案 A「远离释放、靠近预热」对症度**：对症的是 act4 段那 75%——
   在用户离开 act4 段向下时提前卸载解码帧（远离释放），等价于 ctrlA 的效果
   （同区段长帧 77 → 0）。但它**治不了 act3 段那 24%**（ctrlA 实测无改善），
   act3 反推镜的 raster 成本需要独立手段（如反推镜的 transform/opacity 提升合成层、
   或减少反 scrub 时每帧重绘面积）。另外注意「靠近预热」的方向别做反：若预热把视频帧
   在 act3 段内重新挂上，raw 数据提示长帧会跟着帧回到 act4 段（帧在 = 段内每 100 帧 3.9 长帧）。

## 口径与局限（不夸大）

- headless Chromium 反向滚动被钳到 30fps 节拍：33.3ms 长帧 = 每 3 帧吞 1 帧。
  本报告所有「长帧数」是**组间相对比较**口径；绝对值不映射真机 60Hz。
  但三个对照在同一环境下跑，77→0 与 24→34 的组间差异是硬信号。
- 真机（用户报告的 >30ms 长帧 10 个）与 headless 节拍不同，但因果方向
  （卸载即消 act4 段长帧、act3 段无动于衷）在两套环境一致——与上一轮
  `_rv-video-residency.mjs` 的「卸载后 0 长帧」互证。
- 每组 n=3，act3 段组间差（24 vs 34）落在 run 间自然波动内（raw 7–9，ctrlA 9–13），
  结论 2 只主张「无改善」，不主张「变差」。
