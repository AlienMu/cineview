# T1.8 验收笔记（fresh agent，随做随写防中断）

仓库: /Users/alienmu/Documents/alien/cineView/cineview
分支: codex/drag-release-dual-gate
时间: 2026-08-23

## Part A: API 断言对齐审计（静态）

### 事实源读取
- src/types/index.ts（全文）
- src/public-api.ts（全文）
- src/components/Animate/AnimateVideo.tsx（AnimateVideoProps 全部字段）
- src/components/Image/Image.tsx（ImageProps 全部字段）
- examples/minimal/src/App.tsx（全文）
- 实现处默认值核对：helpers.ts(Scene)、animateSemantics.ts、dragTimelineMapping.ts、
  useDragSceneEngine.ts(threshold)、CineView.tsx、DirectScrollCineView.tsx、
  ScrollbarOverlay.tsx、sceneScrollBudget.ts、useAnimateScroll.ts、Position.tsx、Container.tsx

### 审计范围
- 实际存在的文档页：19 页 × 2 语言 = 38 md（start 3、concepts 5、components 7、advanced 4）
  任务描述写"22 页"，实际在册 19 页/语言（animation 组是 T2 范围，目录尚不存在）。

### 逐页审计表（页 × 提取断言数 × 异常数）

| 页面 | 提取的 API 断言(字段/示例/默认值) | 异常 |
| --- | --- | --- |
| zh+en components/cineview | Props 表 26 字段 + callbacks 14 + Ref 6 + 代码块 1 | 0 |
| zh+en components/scene | Props 表 18 字段 + 代码块 1 | 0 |
| zh+en components/animate | Props 表 22 字段 + 轨道矩阵 + 代码块 1 | 0 |
| zh+en components/position | Props 表 9 字段 + 代码块 1 | 0 |
| zh+en components/image | Props 表 6 字段 + 代码块 1 | 0 |
| zh+en components/container | Props 表 5 字段 + 代码块 1 | 0 |
| zh+en components/use-animate-timeline | 接口 6 字段 + AnimatePhase 6 态 + Frame 4 字段 + Source 6 值 + 代码块 3 | 0 |
| zh+en start/quickstart | 代码块 3（与 minimal App.tsx 镜像核对） | 0 |
| zh+en start/installation | 导入清单 7 名 + peer 声明 | 0 |
| zh+en start/introduction | 代码块 1 | 0 |
| zh+en concepts/responsive | 代码块 1 | 0 |
| zh+en concepts/modes | 代码块 2 | 0 |
| zh+en concepts/timeline | 代码块 1 + 只读契约断言 3 | **1**（见下） |
| zh+en concepts/dual-track | 代码块 1 + 内部不变式断言（dragRelease 写者/T_self 公式/calculatedDelay/incompatible-driver） | 0 |
| zh+en concepts/fixed-layer | 代码块 3 + 速查表 3 行 | 0 |
| zh+en advanced/centerlock | 无代码块，纯语义断言（onZoneProgress 无 debounce、0/1 边界） | 0 |
| zh+en advanced/preload | 纯语义断言（priorityComplete 一次、Ref.preload 目标语义） | 0 |
| zh+en advanced/callbacks | 纯语义断言（onReady 一次、commit/cancel 互斥） | 0 |
| zh+en advanced/performance | 命令 4 条（pnpm verify / site type-check / site build / performance-test test 均存在） | 0 |

### 关键默认值逐项核对（全部 PASS）
- CineView: config.size 750 / transitionDuration 800 / firstSceneTimeout 3000 / threshold
  (0,1000,0.15,0.3 useDragSceneEngine.ts:32-35) / drag unit time+scale 10|1
  (dragTimelineMapping.ts:3-7) / drag direction 'y' (DragSceneStack.tsx:180) / scroll
  direction 'y' zoneTrigger center-lock sceneSizing content (DirectScrollCineView.tsx:65-67) /
  enter/exitMargin 50 / scrollbar 全默认（width 6 floor 4、radius 999、inset 0、
  ariaLabel 'CineView scroll position'、trackColor transparent、thumb/hover rgba、
  autoHide true、enabled!==false→true，ScrollbarOverlay.tsx:46-53 + DirectScrollCineView.tsx:456）
- Scene: width '100vw' / height scroll 'auto' drag '100vh' / anchor 'top-left' / overflow
  'hidden' / stack scroll 'cover' drag 'replace' (helpers.ts:193-202) / exitDuration 800
  (helpers.ts:157-158) / zoneId ?? sceneId (DirectScrollCineView.tsx:92)
- Animate: duration enter/exit 600 / sceneControlled true / replayOnReenter true / delay 0
  (animateSemantics.ts:66-80) / animateId 自动 animate-{n} (Animate.tsx:224) /
  enter|infinite 缺二者→INVALID_ANIMATION (Animate.tsx:573-581) / scrub 轨 enterRef/exitRef
  →INVALID_ANIMATION 忽略 (Animate.tsx:439-475) / drag arrival 轨 waitFor+exitAnimation
  被忽略并上报 (Animate.tsx:369-394)
- Position: 绝对优先于 offset 链、未给轴补 0 (Position.tsx:61-76) / sticky 降级 (line 52) /
  居中 transform 在前合并 (lines 131-134)
- Image: preload 默认 true、loading='lazy' 强制关、loading 推导 eager/lazy (Image.tsx:47-48)
- Container: 开发模式缺上下文抛错 (Container.tsx:26-31)
- useAnimateTimeline: 抛错文案逐字一致 (animateTimeline.tsx:30)

### zh/en 同构性
- 38 文件全部成对存在；代码围栏除 quickstart 的 bash 注释本地化外字节级一致；
  全部 Props 表的 字段/类型/默认值 三列 md5 一致（仅描述文案翻译）。

### 异常明细
1. **真 API 错误**：`site/src/content/docs/zh/concepts/timeline.md:26` 与
   `site/src/content/docs/en/concepts/timeline.md:26`
   ——「phase 是共享的**五态**相位词表 / the shared **five-state** phase vocabulary」。
   事实：`AnimatePhase = 'idle' | 'waiting' | 'entering' | 'entered' | 'exiting' | 'exited'`
   （src/types/index.ts:604）共 **六** 态；同站 components/use-animate-timeline.md:58
   自己写的也是「六个状态 / six states」。正确值：六态（timeline.md 是 legacy 迁移残留，
   'waiting' 相位加入后未更新计数）。

### 非异常观察（不算错误）
- AnimateVideo 无任何文档页覆盖（38 md 零提及）——属 T2 计划范围（动画组），非断言错误。
- timeline.md 示例用 framer-motion 的 useMotionValueEvent（读订阅，许可用法，示例隐含 import）。

## Part B: 浏览器 lane（进行中）

（server 启动记录见下）

## Part B 记录（server + 探针数据）

### server 记录
- 4024 dev server：`BROWSER=none pnpm --dir site dev --host 127.0.0.1 --port 4024 --strictPort`
  后台启动（PID 73600，日志 /tmp/t18-server-4024.log），Vite 5.4.21 ready in 112ms，
  无 EPERM。dist 新鲜度核过：dist mtime(1787429474) > 最新 src(1787428873)，即 dist 晚于全部 src 改动。
- 4100 minimal server：见 M4 段落。

### B.2 文档站探针（/tmp/t18-docs-probe.mjs，输出全部 PASS）
| 判据 | 实测 | 结果 |
| --- | --- | --- |
| zh 侧边栏 19 条 | count=19 | PASS |
| zh 19 页路由全 200 且 article 非空 | 19/19 逐页核 | PASS |
| zh hljs 高亮 | 1/1 code block 带 hljs class（animate 页） | PASS |
| zh GFM 表格 | animate 页 tables=2 | PASS |
| zh TOC id 与 h2/h3 id 一致 | toc=4 headings=4，逐一同源 | PASS |
| zh TOC 点击滚动到位 | 点 #Ref-方法 → top=415px 在视口内 | PASS |
| zh→en 切换 | 标题「快速开始」→Quick Start、lead、侧边栏首条「01安装」→01Installation、htmlLang=en、无 CJK 残留 | PASS |
| en→zh 回切 | 回到「快速开始」 | PASS |
| en 侧同套 9 项 | 全部同 PASS（TOC 点 #Ref-methods top=678px 可见） | PASS |
| console error/warning | 0（两语言全套路由） | PASS |

截图：/tmp/t18-shots/docs-animate-zh.png、docs-animate-en.png

### B.3 Demo Hub 探针（/tmp/t18-demo-probe.mjs；scroll 模式，1280×800，90px/步小步 wheel 穿段，110ms settle，98 采样）
| 判据 | 实测 | 结果 |
| --- | --- | --- |
| zone progress 读数 0→100% 单调 | max=100 start=0 回退次数=0（98 样本） | PASS |
| 链序：subline 晚于 title 起动 | titleFirstMove=step13, subFirstMove=step15 | PASS |
| 链序严格判据：title 完成(≥0.95)前 subline 不动 | subFirstMove=step15(op=0.18) 时 title 尚未完成；title≥0.95 在 step31(op=0.99) | **FAIL** |
| 链序：subline 完成前 video 不 scrub | subDone=step21, videoFirstScrub=step21（恰好相邻） | PASS |
| AnimateVideo 正向帧擦洗（rVFC 真信号） | rVFC count=68、mediaTime=10s、currentTime=10.04s | PASS |
| manual 卡点击前停 initial | 98 样本 maxOpacity=0.000 | PASS |
| enterRef 点击入场 | 点击后 cardOpacity=1 | PASS |
| AnimateVideo 反向倒放 | 峰值 10.04s → 回滚后 0s（rVFC mediaTime=0） | PASS |
| enterRef 滚出再回重播 | cardOp 滚出=1、回来=1（**未见重播迹象——待 trace 复核是否真离开过视口**） | 待定 |
| console error/warning（含 [CineView]） | 0 | PASS |

观察（非判据项）：真实指针点击 enterRef 按钮被拦截——卡片 slide-up 的 initial
transform（opacity 0 但占位偏移）盖住按钮 hit-testing；探针改用 JS click 触发同一
React onClick。截图：demo-zone-before/after-enterref.png、demo-scroll-reverse.png。
trace 全量数据：/tmp/t18-demo-trace.json

### B.3 深化分析一：waitFor 三级链 overlap（trace /tmp/t18-demo-trace.json 逐行）
判定：**真实缺陷（FAIL），非探针误读**。

关键采样（title=focus-in+phase{0.05,0.3}，subline=waitFor title，video=waitFor subline）：
```
step14: pct=9%  title=0.144 sub=0.033 video=0     ← subline 开始动，title 才 14%
step15: pct=10% title=0.194 sub=0.183 video=0
step21: pct=17% title=0.494 sub=1.000 video=0.08  ← subline 已完成，title 才 49%
step31: pct=30% title=0.994 sub=1.000 video=1.59  ← title 到这里才算完成
```
- 期望（demo 注释 + 验收判据）：title 入场完成（≥95%）前 subline 不动。
- 实际：subline 在 title 仅 ~14% 时开始入场、17% 时完成；title 30% 才完成。两级窗口完全嵌套重叠。
- 链路第二环无瑕：subline 完成（step21 op=1.000）与 video 首 scrub（step21 t=0.08s）恰好相邻——video 链 PASS。

根因（代码级，两读法任居其一）：
1. **框架缺口读法**：`sceneScrollBudget.ts` 的 `resolveTiming` 让 follower 链在 leader 的
   名义 ms 时序上（title: delay0+enter600 → totalEndMs=600 → subline startPx=600px）；
   而 leader 自撰的 `phase {0.05,0.3}` 把视觉窗口重映射为总预算 7200px 的 [360,2160]px。
   预算编译对 leader 的 px 级 totalEndPx 做了 phase 校正（line 231: totalEndPx=phaseEndPx=2160），
   却没有校正 follower 链使用的 ms 级 totalEndMs（600）——两只时钟分裂。
   waitFor 的文档语义（animate.md「等待另一 animateId 的入场完成后才开始入场」）在
   leader 带 phase 时按字面被违反。
2. **demo 作者用法读法**：DemoPage.tsx:121-135 给 waitFor 链的 leader（demo-scroll-title）
   授权了 phase，本身把 leader 从 registry 时钟上剥离；且该处代码注释称
   「waitFor 与 phase 是互斥的 timeline 形态（types 判别联合）」——**对公共类型的陈述不实**：
   `types/index.ts` AnimateBaseProps.timeline 是扁平可选字段对象（两者可同时传、无 union、
   运行时也无互斥告警）。窄类型只有 AnimateVideo.timeline（仅 delay/waitFor）。

精确复现：`localhost:4024/demo` → 02 scroll tab → 在 zone 内 90px/步小步 wheel →
观察 title 约 1/5 亮度时 subline 已开始上滑、并先于 title 完成。
期望 vs 实际：期望 subline 在 title op≥0.95 前保持 op=0；实际 title op=0.144 时 sub op=0.033。

### B.3 深化分析二：enterRef 卡片「滚出再回重播」（focused probe /tmp/t18-card-replay-probe.mjs）
判定：**demo 作者级缺陷（该元素结构上不可能重播），框架行为符合其自文档语义；非探针误读**（有 rect 证据）。

实测 rect 证据：
- zone 内 scrollTop=2700：卡片 box 在 stage 视口下方之外（cardBottom 1116 > stageBottom 943），
  点击前 op=0；点击后 op=1（enterRef 手动触发不依赖在视口内——符合手册）。
- 正向穿段全程（98 采样）：卡片路过视口期间 op 恒 0.000——「enterRef 且无 waitFor/delay →
  永不自动入场」语义实证成立（此半句 PASS）。
- 文档末尾 scrollTop=8480：卡片 box 卡在 stage 顶边上（cardTop 360 < stageTop 399 < cardBottom 418），
  即卡片在文档最底也没有完全离开视口；op=1。
- 回滚进 zone：op 恒 1，无任何重播迹象（backIn/backSettled 均 1）。

代码级根因：`useAnimateScroll.ts` resolveGatePhaseAction line 106-111——`entered` 态仅在
`hasExplicitExit` 时才 exit（「no exitAnimation => stay visible」，注释明言这是对
snap-disappear bug 的刻意裁决）；replayOnReenter 只在 `exiting/exited` 态生效（line 112-115）。
demo 卡片（DemoPage.tsx:65-73）**没有授权 exitAnimation** ⇒ 永不退出 ⇒ replayOnReenter
结构上不可达。demo 提示文案「滚出视口再滚回来（replayOnReenter）」教了一条该元素无法演示的规则。
修法方向（供主会话裁决，未动码）：给卡片补 exitAnimation（重播可现），或改 hint 文案。

附带观察（真指针路径）：卡片 slide-up 的 initial transform（translateY 偏移、opacity 0）在
initial 帧盖住下方按钮的 hit-testing——真用户在卡片入场前点不到「手动入场」按钮
（playwright TimeoutError 实证 + JS click 对照）。demo 级 UX 缺陷。

### B.4 minimal example 冒烟（M4）（/tmp/t18-minimal-probe.mjs，全部 PASS）
server：`pnpm --dir examples/minimal dev --port 4100 --strictPort`（PID 76412；注意无 --host 时
只绑 IPv6 localhost，127.0.0.1 不通，用 http://localhost:4100/）。已按令杀掉。

| 判据 | 实测 | 结果 |
| --- | --- | --- |
| GET / → 200 | status=200 | PASS |
| drag 引擎挂载 + 首场景 Animate 可见 | kickerOp=1，container=1，按钮文案正确 | PASS |
| 真指针 swipe 提交到 scene 2，级联 settle 后可见 | headline=1 subline=1 | PASS |
| 模式切换 drag→scroll（key 重挂，真滚动容器） | scrollRoot=true scrollable=true scenes=3 | PASS |
| scroll waitFor 级联严格有序 | headlineDone=step23(op=1.00) → sublineFirstMove=step24(op=0.13) | PASS |
| 级联完整穿越 | sublineDone=step31（其后滚出 zone 因 fade-out 退场，语义正确） | PASS |
| 切回 drag 往返 | kickerOp=1，container=1 | PASS |
| console error/warning=0 | clean | PASS |

对照价值：minimal 的级联**严格有序**（leader 无 phase：headline[0,800]px→subline[800,1400]px
零重叠）——反证 Demo Hub 的链断裂正是 leader 带 phase 所致。

### server 清理
- 4024（PID 73600）：已杀，curl 确认 down。
- 4100（PID 76412）：已杀，curl 确认 down。
- 遗留进程 63906（examples/minimal vite --no-open，04:08 启动）非本任务所起，未动。

## 最终判定

**VERDICT: FAIL**

触发条款（满足其一即 FAIL，本报告命中两项）：
- A 有真 API 错误：zh/en concepts/timeline.md:26「五态/five-state phase vocabulary」——
  AnimatePhase 实为六态（types/index.ts:604），同站 use-animate-timeline.md:58 自己写的就是六态。
- B 场景 FAIL 项：
  1. Demo Hub waitFor 三级链严格判据 FAIL（title 14% 时 subline 已动、17% 已完成，title 30% 才完成）
     ——根因双读法见上（框架 waitFor×phase 时钟分裂 / demo 给链首授权 phase），并伴随 demo
     代码注释对公共类型的错误陈述（称 waitFor/phase 是「types 判别联合」，实为扁平可选字段）。
  2. Demo Hub enterRef 卡片「滚出视口再回来可重播」FAIL——卡片无 exitAnimation ⇒ 框架裁决
     「no exitAnimation => stay visible」⇒ replayOnReenter 结构性不可达；hint 文案教了一条
     该元素无法演示的规则（rect 证据：文档末尾卡片仍卡在 stage 顶边、op 恒 1）。
  3.（附带观察，非判据）真指针点击「手动入场」按钮被卡片 initial transform 拦截——initial
     帧阶段按钮对真用户不可点。

PASS 盘点：A 其余全部断言（~180 字段/默认值/示例/命令）与事实源一致；B 文档站 18 项全 PASS、
Demo Hub 其余 8 项 PASS（读数单调 0→100、video 链、rVFC 正/反向擦洗、卡片 initial 保持、
点击入场、console 三处全 0）、minimal 8 项全 PASS。
