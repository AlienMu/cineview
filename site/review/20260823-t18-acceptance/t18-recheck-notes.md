# T1.8 修复复审笔记（recheck，随做随写防中断）

仓库: /Users/alienmu/Documents/alien/cineView/cineview
分支: codex/drag-release-dual-gate
时间: 2026-08-23（复审轮）
判据口径: 沿用 /tmp/t18-acceptance-notes.md 原探针；探针基于 /tmp/t18-demo-probe.mjs 改造。

## 静态确认（场景 D）

| 项 | 实测 | 结果 |
| --- | --- | --- |
| timeline.md zh:26 | 「phase 是共享的六态相位词表」 | PASS |
| timeline.md en:26 | "the shared six-state phase vocabulary" | PASS |
| DemoPage 错误注释改正 | DemoPage.tsx:144-147 现文：「Animate 的 timeline 是扁平可选字段（waitFor 与 phase 可同传，无判别联合）；只有 AnimateVideo 的 timeline 是窄类型（仅 delay/waitFor）」——错误陈述（称互斥判别联合）已删除；「判别联合」字样仅存于该否定句（陈述正确事实），另两处在 components/cineview.md、animate.md 描述其他真实 union，非本判据对象 | PASS |
| DemoPage waitFor 链 leader 无 phase | title `timeline={{ delay: 0 }}`（无 phase 窗口）；subline waitFor title、video（AnimateVideo）waitFor subline，三级纯链（DemoPage.tsx:137-168） | PASS（待真机 A 确认） |
| ManualControlSlot 重做 | enter/exit 双按钮（DOM 前置于卡片，demo-manual__buttons z-index:1）；卡片 slide-up/fade-out、duration 640/400、sceneControlled:false、enterRef+exitRef；hint 教轨道支持矩阵（DemoPage.tsx:53-92 + global.css:1081-1087） | PASS（待真机 B 确认） |

## 环境记录

- dist 新鲜度：newest dist mtime 2026-08-23 04:11:14 > newest src 04:01:13，src newer than dist = 0。site 侧改动（DemoPage/CSS/timeline.md）由 vite dev 直出，无需重建。
- server 4025：见下节记录。

### server 4025

- `BROWSER=none pnpm --dir site dev --host 127.0.0.1 --port 4025 --strictPort`（PID 77669，
  日志 /tmp/t18-server-4025.log），Vite 5.4.21 ready in 108ms，`GET /demo` → 200。
- 用后已杀（kill 77669），curl 确认 connection refused、lsof 无监听。

## 真机复审（探针 /tmp/t18-recheck-probe.mjs，1280×800，scroll 模式，90px/步 × 110ms settle，98 采样）

### 场景 A：waitFor 三级链严格判据（原 FAIL 项）

| 判据 | 实测 | 结果 |
| --- | --- | --- |
| A1 STRICT：title op≥0.95 前 subline op 恒 0（无窗口重叠） | title 窗 step8-14（0.13→1.00）期间 sub 恒 **0.000**（14 样本 max=0.000）；titleDone=step14(op=1.00)，subFirst=step15(op=0.18) | **PASS** |
| A2 STRICT：subline 完成（≥0.95）前 video 不 scrub | sub 窗 step14-21（0.03→1.00）期间 video 恒 0.00s；subDone=step21，videoFirstScrub=step21（0.08s，恰在 sub 达 1.00 的同一步之后起动） | **PASS** |
| A3 链完整收尾 | title=1、sub=1、video=10.04s、pct=100% | PASS |
| [对照] 读数 0→100% 单调 | max=100，regressions=0（98 样本） | PASS |

链交接窗口逐样本（trace /tmp/t18-recheck-trace.json）：

```
step  pct  title  sub  video   ← 解读
  8    1%  0.13  0.00    0     title 起动，sub 恒 0
 14    9%  1.00  0.03    0     title 完成(op=1.00)当步 sub 才首动(0.03)
 21   17%  1.00  1.00  0.08    sub 完成当步 video 才首 scrub
 22   19%  1.00  1.00  0.23
```

与 minimal 例的零重叠级联同构（title[0,600]px → sub[600,1200]px → video[1200,7200]px）。
原缺陷（leader 带 phase 致双时钟分裂、sub 在 title 14% 时抢跑）已消除。

### 场景 B：手动控制真指针循环（原 FAIL + 拦截观察项）

| 判据 | 实测 | 结果 |
| --- | --- | --- |
| B0 点击前卡片停 initial | 98 样本 max cardOp=0.000 | PASS |
| B1 真指针 click 入场按钮（hit-test） | playwright click 成功（无超时、无 JS 兜底），cardOp=1；截图视觉确认卡片完整可见 | **PASS** |
| B2 真指针 click 退场按钮 → fade-out | click 成功，cardOp=0（<0.05）；截图视觉确认卡片消失、按钮仍在 | **PASS** |
| B3 再点入场 → 循环 | click 成功，cardOp=1；像素证据：reenter vs after-enter 差 0.31（近同）、reenter vs after-exit 差 2.53（与 enter/exit 基准差 2.24 同量级）→ 卡片视觉回归可见 | **PASS** |

原「initial transform 盖住按钮 hit-testing」拦截已由 DOM 前置 + z-index:1 修复——
三个状态（initial/entered/exited）下按钮均可真指针点击。

### 场景 C：console 卫生

| 判据 | 实测 | 结果 |
| --- | --- | --- |
| 全程 console error/warning = 0 | clean（覆盖 drag 初始加载 → tab 切 scroll → 穿段 → 三次真指针点击） | PASS |

### 场景 D：静态

见顶部表——timeline.md 双语六态 PASS；DemoPage 错误注释已改正（「判别联合」仅存于否定句
陈述正确事实，另两处命中在 components 文档描述其他真实 union，非本判据对象）。

## 复审判定

**VERDICT: PASS**

原 T1.8 终验三项 FAIL/观察全部闭合：
1. waitFor 三级链严格判据：FAIL → PASS（零重叠，交接恰好相邻）。
2. enterRef 卡片不可重播 + hint 教错规则：组件重做为 enter/exit 双按钮 visibility 轨
   （exitAnimation="fade-out" 使退场闸门可达），真指针循环 enter→exit→enter 实测成立；
   hint 改教轨道支持矩阵，与元素实际能力一致。
3. 真指针点击被 initial transform 拦截：按钮 DOM 前置 + z-index:1，三态下均可点。

server 已清理（4025 down）。
