# act5 收尾层 v2 实现报告（2026-08-15）

任务：Scene5Cinema 收尾层重做（scrub 退场语义）+ 黑场 CTA 重设计 + footer 入右栏 + zh 标题逗号。
注：`frontend-design:frontend-design` 技能在本会话加载失败（Unknown skill；memory 有
「插件已 enable 但需重启会话」记录），按其方法（语境优先、层级用亮度/描边而非阴影、
排版变量）自行执行。

## 改动清单

### 1. zh 标题逗号（act4）

- `site/src/i18n/zh.ts:169` — `'demoVideo.title': '或许，|也能驱动视频？'` → `'或许|也能驱动视频？'`（en 不动；`|` 为 DemoVideoScene 的断行标记，机制不变）

### 2. 退场语义改 scrub（act5）

`site/src/components/Scene5Cinema.tsx`：

- 常量区（:43-66）：删 `SPLIT_ENTER_*`×4 / `SPLIT_EXIT_*`×4 / `splitTitleVariant` /
  `splitSubtitleVariant` / `splitCtaVariant` / `splitFooterVariant`；新增
  `SPLIT_SCRUB_START=0.85` / `SPLIT_SCRUB_END=1` / `SPLIT_COLLAPSE_AT=0.90`、
  `closingFadeVariant`（纯 opacity）；`FREEZE_COLLAPSE_MS/FREEZE_UNMOUNT_MS` 保留
- refs/state（:295-318）：删 8 个 enterRef/exitRef；新增 `closing` state +
  `closingRef`（finished latch）+ `progressRef` + `splitRef`；删
  `runSplitEnter`/`runSplitTextExit`
- `handleProgress`（:328-360）：记 `progressRef`；progress < 0.90 且 split 持有 →
  收列（单边翻转，零每帧 setState）
- 消息 handler（:364-403）：finished → latch 置位 + 开列（带 progress 守卫，
  progressRef 的真实消费者）；unfinished → 只清 latch + 收列（不再编排退场动画）；
  重复消息幂等（React bail out，子树不重挂、CSS 入场不重播）
- freeze effect（:405-462）：两级串行保留（700ms 收列 / 1400ms 卸载 iframe +
  重置 latch），删文字 exitRef 编排；<1.4s 滚回取消定时器，latch 保留、scrub 原样恢复
- JSX（:660-760）：收尾层四元素挂载门控 `{closing ? …}`；每个一条 scrub lane
  （`timeline={{ phase: { start: 0.85, end: 1 } }}`，sceneControlled 默认绑 zone
  takeover）；footer 从视口底 absolute 挪进 text-col（cta.body 下）；按钮换 scoped 类

`site/src/components/Scene5Cinema.css`：

- 一次性入场动画（`scene5-closing-rise/fade`，delay 0/0.25s/0.6s/0.9s，`both`
  填充，prefers-reduced-motion 关闭）——CLAUDE.md 规则 6 允许一次性插值
- footer 规则重写：去 absolute/视口钉底，改列内流式（发丝线 0.14 白分隔）；
  ≤900px 随列居中

### 3. 黑场 CTA 重设计（scoped，不动全局 .btn）

`Scene5Cinema.css` 新增 `.scene5-cinema__btn{,--primary,--ghost}`：

- 主钮：骨白实底（rgba(250,248,244,.96)）+ 深墨字（#16130f）——黑场唯一满亮度面，
  片头字幕卡层级；hover 提亮染 accent 暖（color-mix）
- 次钮：1px 骨白描边（.3）+ 浅字（.82）；hover 描边转 accent 琥珀 + 底透微白
- **零 box-shadow**：列容器 overflow:hidden 必裁阴影（旧 .btn hover 光晕被截断
  正是「丑」的来源之一），亮度/描边两级取代光晕层级

## 验收数据

### 探针 A/B/C（`site/scripts/_rv-20260815-closing-v2.mjs`，1440×900，默认 en）

- A 门控：finished 前 `cinema-split-cta` 不在 DOM — PASS
- A 串行入场：first-mid 采样序 title(1) < subtitle(3) < cta(6) < footer(9) — PASS；
  四元素 settled 全 1
- B scrub 跟手：外层滚轮 -120×4（iframe 内不拖），包装层 opacity
  1 → 0.636 → 0.273 → 0 → 0（**严格等于理论值**：窗 330px 线性，
  -120px 档 Δ=0.364）；滚回 +120×4 → 0 → 0.273 → 0.636 → 1 — 全 PASS
- C 列收拢：第 2 步（progress≈0.891 < 0.90）isSplit=false — PASS；
  滚回后不自动重开（isSplit 保持 false）— PASS
- 消息序列：unfinished×3（settle bounce）→ finished，重复消息幂等无副作用

### 双语 × 三视口（`_rv-20260815-closing-i18n-shots.mjs`）— 6/6 全 PASS

每组合断言：收尾层各块不溢出列盒 / 列高不超视口 / 按钮行不撞 cta.body /
主钮对比度 / footer 不溢出 / 主钮零 box-shadow（computed = none）。

| 组合 | 列盒 | 主钮对比度 | 结果 |
| --- | --- | --- | --- |
| zh 1440 | 500×383（top 258 / bottom 642 / vh 900） | 17.46 | 全 PASS |
| zh 1280 | 444×348（bottom 574 / vh 800） | 17.46 | 全 PASS |
| zh 390 | 343×218（bottom 796 / vh 844，纵排） | 17.46 | 全 PASS |
| en 1440 | 500×506（bottom 703 / vh 900） | 17.46 | 全 PASS |
| en 1280 | 444×464（bottom 632 / vh 800） | 17.46 | 全 PASS |
| en 390 | 343×262（bottom 819 / vh 844，纵排） | 17.46 | 全 PASS |

- en 三钮更宽（124/141/148px @1440 vs zh 103/117/148）仍单行放下、不换行不截断；
  en 右栏总高 506px 仍垂直居中于 900vh（390 纵排 262px < 844 可用高）。
- footer：en 长文案在 390 下两行居中（探针确认都在列盒/视口内），桌面单行。
- ⚠️ 探针降级说明：跑双语轮时 /drag 正被并行 agent 改动到中间态（真实手势
  pointerdown 可达但场景不 commit，实测 1280/1440 均无 finished/unfinished）。
  手势→finished 链路已由 closing-v2 探针在 /drag 稳态下全绿验证过；本轮在
  3 次真实手势尝试后从 iframe 内合成同源 finished 消息（source 校验通过）
  驱动收尾层，验收的是父层布局本身。

### 视觉审（视觉模型读图）

- zh 1440：主钮骨白实底黑字、次钮描边、全部圆角一致；footer 在列内、发丝线
  分隔、不钉视口底；无重叠/裁切/不可读；模型判「clean, cohesive, no defects」。
- en 390：三钮单行可读不溢出；footer 居中在视口内；无裁切/重叠。

### 截图

- `site/review/20260815-adv/act5-closing-{zh,en}-{1440,1280,390}.png`（6 张）

### 静态检查

- `npx tsc --noEmit`（site）0 错误；prettier 通过

## 设计决策记录

1. **同 lane 不能手动入场 + scrub 退场**（框架轨制）：故入场走子元素一次性 CSS
   动画、挂载门控在 latch；包装层只做 scrub 透明度——两层叠乘，职责不重叠。
2. **列不自动重开**（用户拍板）：progress 回升过 0.90 不重开列，重开只由 finished
   触发——opacity 仍随 scrub 恢复，布局保持收拢，防 0.90 临界抖动。
3. **scrub 窗 0.85–1**（330px @1440 档滚动）：-120px 滚轮档 Δopacity≈0.36，肉眼
   跟手连续；窗与 0.90 收拢阈值交叠（0.85–0.90 间列已开始收但文字仍部分可见，
   收列 1.1s 位移段与淡出并行，无突变）。
4. **progressRef 守卫**：finished 消息飞行期间用户已上滚跌破 0.90 时不强开列
   （同时消除零消费字段）。

## 截图

（已并入上方「双语 × 三视口」节）

## 遗留与移交

1. **/drag 并行 agent 中间态**（非本任务范围）：本轮验收时段 /drag 真实手势
   commit 不可用（pointerdown 进 iframe 但场景不前进，1280/1440 均复现；
   更早时段同 gesture 全绿）。act5 收尾层不依赖其具体行为，仅依赖 finished/
   unfinished 消息协议，已由 closing-v2 探针在稳态下验证。建议 /drag lane
   收口时重跑 `closing-v2.mjs` 确认手势链路。
2. `frontend-design` 技能本会话不可用（Unknown skill）——按 memory 记录需
   重启会话加载，本报告的设计裁决为手工执行其方法。
