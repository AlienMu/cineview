# 最终验收 — 2026-08-15（scroll 首页 zh/en + /drag 五幕）

独立真机验收 agent（第 3 实例，前两实例死于 503/配额）。全部探针只读，真实滚轮/指针
输入，headless Chromium，dev server `localhost:4000`（dist 构建于 08-15 06:06，晚于全部
src 改动 06:04，站点消费 dist 有效）。

**总判定：10/11 项 PASS。唯一 FAIL 为「帧间隔对照降到 ≈0」的预期——实测 act4 段长帧
中位 30/run（基线 26），未降；根因分析见第 8 项：本轮落地的 releaseOnLeave 在 raw 场景
（视频播完立即倒回）结构上不可能把段内长帧清零，非回归。**

| # | 验收项 | 判定 | 证据 |
|---|---|---|---|
| 1 | 首屏 LUT[0] 奶白桃 #fcede4 | **PASS** | zh/en 两轮首帧 `--bg-grad-top` 均 `#fcede4`、accent `#d59273`（CSS 就绪即读，等待 0ms）；settle 后不变；`.bg-ribbon` 渐变顶色同源 |
| 2 | N3 样式 19 项 | **PASS** | 21 项 computed 断言全绿（accent 派生族 hover 光晕/胶片 perf/分隔线/圆点、act3 投影 0.05+0.10 双层、act5 glow、act4 warmAt 色带、zh 伪斜体→w600），逐值见 `final-scroll.raw.json` assertions |
| 3 | act5 标题/副标题手动控制迁移 + IO 取消 freeze | **PASS** | closing-verify 复跑两轮均 6/6（见第 6 项）；分栏标题/副标题/CTA/footer 时序与反向退场全部正确 |
| 4 | act5 text-col 500u/36vw（zh 不裁切） | **PASS** | is-split 下 computed width 498px@1440（≈500u 名义值，36vw 上限 518.4 未触及）；zh 标题 scrollW=clientW=498、副标题 496，零裁切 |
| 5 | hint zh 字距 0.10em | **PASS** | zh `letter-spacing: 1.2px`（12px × 0.10em）；en 1.92px（0.16em 默认）——注意 headless 默认 en，zh 为显式切换后采样（`documentElement.lang=zh-CN` 断言通过） |
| 6 | 收尾层 CTA(1.7s)/footer(2.0s)，退场最先出 | **PASS** | `_rv-20260815-closing-verify.mjs` 复跑两轮均 6/6：副标题 0.6–1.2s、CTA 1.0–1.6s 至满、footer settled；反向 commit 发 `cineview-embed-unfinished`、CTA/footer 有退场 tween 且归零。全文 `final-closing-verdict.txt` |
| 7 | releaseOnLeave 复跑 | **PASS** | `_rv-20260814-release-onleave.mjs` 4/4：播完(hasSrc:true cur=10.04/10.04)→深 act5 释放(hasSrc:false)→回 act3 保持释放→接近 act4 预热(hasSrc:true, readyState 4, catch-up seek) |
| 8 | **帧间隔对照（重点）** | **FAIL（对照预期）** | 见下表与根因分析。基线复现成功、无回归，但「降到接近 ctrlA(0)」未发生 |
| 9 | act4 teal 化五幕色温行程 | **PASS** | 连拖四幕 `--tp-sig` hue：37°(amber)→37°→37°→**189°(teal #5cb8c9)**→33°(amber #e1a45b)。行程 = amber×3→teal→amber 成立，契约「No blue, no magenta」恢复 |
| 10 | act1 CTA rec 化 + drag 底色 | **PASS** | `.tp-btn--primary` bg `rgb(230,69,54)`= #e64536；`.drag-page` bg `rgb(12,10,12)`= #0c0a0c、token `--tp-bg` 同值 |
| 11 | console 零报错（两页） | **PASS** | scroll zh/en 与 /drag 全程 0 error/pageerror（404 过滤后为空数组；drag 页连已知静态 404 也未再触发） |

## 第 8 项：帧间隔对照表（>30ms 长帧，每 run 计数，3 次取中位）

方法论与基线完全同源（`_rv-20260815-final-frames.mjs` 复刻 `_rv-20260814-zone-retest.mjs`
raw 组：offsetTop 实测段边界、rAF 帧间隔 + passive scrollTop 缓存、page.mouse.wheel 真实
滚轮、正向 scrub 至 act4 段末视频播完（cur 9.69/10.04）→ 反向倒回 act3 前 900px）。

| zone | 基线 raw（0814） | 基线 ctrlA（卸载） | 基线 ctrlB（仅段内） | **本轮 raw（0815）** |
|---|---|---|---|---|
| act4-demo | 29/26/22，中位 **26**（~25.7） | 0/0/0 | 19/23/20（~20.7） | 30/30/27，中位 **30** |
| act3-shot3 | 7–9，中位 8 | 9–13，中位 12 | —（路径不进） | 14/10/14，中位 14 |
| 边界带 | 0 | 0 | — | 0 |

**判定：FAIL（对照「应降到接近 ctrlA（0）」的预期）；同时确认无回归**（30 vs 26 在
run 间波动带内，act3 14 vs 8–12 同侧偏高但旧报告已证 act3 段为反推镜自身成本、组间差
落在自然波动内）。

### 根因分析（为什么 raw 不可能降到 0）

- 本轮对视频侧的唯一改动是 `VideoFrameRenderer` 的 residency control
  （`release()/warmUp()`，`git diff` 核实）——**没有任何改动触碰段内反向 scrub 的
  每帧 seek/解码成本**。
- 基线自己的数据（ctrlB）已证明：视频在段内被反向 scrub 时长帧 ~20.7/run，是
  「帧在 + 在段内 scrub」的组合成本，沿全段均匀分布，不是某点毛刺。
- raw 场景（播完立即倒回）中，反向驱动全程都在 act4 段内合法 scrub 视频，直到越过
  act4.start 1.5 视口后 release 才触发——**那时 75% 的长帧已经发生**。releaseOnLeave
  对症的路径是「离开 act4 后再回来/继续远走」的驻留压力（第 7 项 4/4 已验证生效），
  结构上治不了 raw 的段内 scrub 成本。
- 若要把 raw 的 act4 段长帧压向 0，需要的不是驻留控制，而是段内反向 scrub 的降本
  （如 seek 节流/关键帧对齐/降分辨率解码），属新的待办，不是本轮改动的验收缺口。

## 五幕色温行程判定

**PASS。** 逐幕 computed `--tp-sig`（390×844 真实指针连拖 0.84h→0.42h，每幕 settle
6.5s + 2.2s commit 后采样）：

| 幕 | --tp-sig | hue | 判定 |
|---|---|---|---|
| act1 | #d8a24a | 37° | amber（CTA 另立 rec #e64536，终拍信号） |
| act2 | #d8a24a | 37° | amber（钨丝灯定则） |
| act3 | #d8a24a | 37° | amber |
| act4 | #5cb8c9 | **189°** | teal（原蓝紫家族收编回冷极，hue 187±） |
| act5 | #e1a45b | 33° | amber（谢幕回暖） |

行程 amber×3 → teal(4) → amber(5) 成立。截图：`scripts/shots-final/drag-act1..5.png`。

## 复验过的探针缺陷修正（不影响产品，仅记录）

- 前实例探针死于 `.btn--primary` strict-mode（hero 与 act5 CTA 同类名）→ 改用
  `.home-scene--hero` 作用域选择器。
- headless 默认 en：zh 轮必须显式切换并断言 `documentElement.lang === 'zh-CN'`（首轮
  因此出现 zh/en 断言整体倒置的假 FAIL）。
- warmAt 逐字暖色画在 `backgroundImage`（background-clip:text），采 `color` 恒透明。
- act4 退场尾帧 blur 位于轴尾 f≈1（实测 `blur(5.9px)` ≈ 0.42vw@1440），倒穿段起点后
  已回落，须在段末采样。
- act3 竖线 0.14em×0.74×15px = 1.55px，Blink computed 取整为 1px（色值 accent 70% 正确）。
- wheelTo 容差导致「回不到顶」假 FAIL：单独验证小档滚轮可达 scrollTop=0
  （`_rv-20260815-final-topcheck.mjs`）。

## 产物清单

- 报告：本文件；原始断言与采样 `final-scroll.raw.json` / `final-frames.raw.json` /
  `final-drag.raw.json` / `final-act5col.raw.json` / `final-closing-verdict.txt`
- 探针：`site/scripts/_rv-20260815-final-{scroll,frames,drag,act5col,topcheck}.mjs`
  （复跑 `_rv-20260815-closing-verify.mjs`、`_rv-20260814-release-onleave.mjs`）
- 截图：`site/scripts/shots-final/`（首页 zh/en 逐幕 + 首帧 + 回顶复验、/drag 五幕
  390×844 共 20 张）
- 旧基线（未覆盖）：`zone-retest.raw.json` 原样保留
