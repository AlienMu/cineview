# 2026-07-10 · Act2 视觉整改（胶片带 + 舞台抽屉）

用户对 SHOT01/SHOT02 的视觉提出大量具体不满（grill-me 澄清后落地）。
本轮在 **Bash 安全分类器基础设施故障**期间进行：Read/Edit/Write 可用，Bash（浏览器验收）间歇不可用 → 编辑先行，整批留待分类器恢复后一次性浏览器验收。

## 已定地基（grill-me 澄清）
- 胶带：**缩短居中、包住更大的帧**（不再半空）
- SHOT01 标题：**顶部 header 行**（与 REC 同带），文案 `40+ 预设｜一个 prop 切换`
- SHOT02 标题：`声明式时间轴｜先后与坐标交给框架`，**放画面正中央**
- 文案：一律"对功能总结"，不描述本次 demo 任务

## 节点

### A. 已修 bug（前序，代码完成待验收）
- [x] A1 胶带"长到一半仍半透明"：`film-growth` fade-in → `solidShellVariant()`（opacity 恒 1，宽度独立生长）

### B. i18n 文案（低风险）
- [ ] B1 zh.ts：`cap.shot1.title` → `40+ 预设|一个 prop 切换`
- [ ] B2 zh.ts：`cap.shot2.title` → `声明式时间轴|先后与坐标交给框架`
- [ ] B3 zh.ts：`cap.shot2.summary` → 功能总结版（waitFor/stagger/Position 三能力，不描述抽屉动作）
- [ ] B4 en.ts：三条对齐

### C. SHOT01 胶片带（中低风险，含节奏）
- [ ] C1 标题移到顶部 header 行（Position y→顶部、字号调为 header 尺度）
- [ ] C2 胶带缩短居中：STRIP_WIDTH 1140→~1070，帧改**固定更大宽度**填满（修 flex:1 挂错元素导致的左半塌缩）
- [ ] C3 帧卡片丰富化（更大图标盘、编号徽标、活跃态强高亮），去单调
- [ ] C4 节奏紧凑：growth 7560→~900 快速展开；帧 waitFor growth 后逐个紧凑入场
- [ ] C5 代码卡扩大 + 加描述（code 行 + 预设一句话说明），去简陋

### D. SHOT02 舞台抽屉（含高风险 opacity gating）
- [ ] D1 去掉 `.stage-frame` 虚线占位框
- [ ] D2 面板放大（640×480→~720×520），抽屉飞入偏移同步
- [ ] D3 标题+结语移到画面正中央（原 x:1020 右侧 → center-x）
- [ ] D4 **内容满不透明才显形**（高风险）：host `solidShellVariant`（opacity 恒 1）+ 内层相位感知快速 ramp；不动面板间 waitFor 时序，退场相位内层保持 opacity 1 防内容消失
- [ ] D5 面板内代码框扩大丰富化
- [ ] D6 面板内演示动画丰富化（tree/stagger/coords 视觉升级）

### E. 收口
- [ ] E1 `pnpm type-check` 通过
- [ ] E2 【待分类器恢复】独立 agent 浏览器验收：SHOT01 胶带不透明+居中+节奏、SHOT02 面板不透明+居中标题+抽屉，全程截图
- [ ] E3 用户复核视觉

## 风险登记
- D4 面板 opacity gating：无法即时浏览器验证，作为验收头号项；错了易回退（改回 panelEnterVariant）。
- C4 节奏：改 scroll 时间轴预算，需真机确认无跳过/无空窗。
