# adversarial-round2 — 独立对抗复审（2026-08-15 晚）

复审对象：act5 收尾层 v2 / act3 反向重排 v4 / /drag 快门写实+CTA 回 amber / 主会话 CSS
（bg-grid 8% mask、tokens 回退色）。**只读 + 真机探针**（localhost:4000，dev server 200）。

增量注记：复审期间主会话又落了三处改动（act3 标题 34ch→24ch 两轮 + 标题 z 移除、
stagger 静息位 +30/-240、bg-grid mask）。act3 探针跑了三轮（A=z7 旧态、B=34ch、
C=24ch 终态），判定以 round-C（当前工作树）为准；A/B 数据留作轨迹。

探针产物（本目录）：`adv2-act3{,-v2,-v3}.json`、`adv2-act3-ab.json`（像素 A/B）、
`adv2-act3-{peak,term}-{zh,en}-{desktop,mobile}.png`、`adv2-act5.json`、
`adv2-act5-{en-1440,zh-1440,en-390}.png`、`adv2-drag.json`、`adv2-drag-act4.png`、
`adv2-bggrid.json`、`adv2-bggrid-ramp{,-bottom}.png`。脚本：`site/scripts/adv2-*.mjs`。

---

## 七维逐项

### 1. 排版超出

**act3 桌面 — CONFIRMED（24ch 终态修复成立）**
- en-desktop：标题 balance 两行 325/386px（行盒 x527-913），与六块静息 panel
  内容盒（__bar/__body/__code）**零相交**；标题带 136/136 网格点无任何遮挡。
- zh-desktop：单行 468px，零相交（62/62）。
- 轨迹佐证：34ch 中间态曾复测出 chain body 交集 81×39px（标题带 74/96、被 chain
  截走 22 点）——24ch 后清零，修法有效。
- 中间态遗留修正：round-A（z7 态）en 行1 与 chain **__body 内容盒**交集 69×54px、
  垂直整行高落在 body 盒内——实现报告「~84px 底缘条带、视觉更小」当时已低估
  （该态已被后续迭代 supersede，仅记录）。

**act3 移动端 — FAIL（见维度 4：重叠 + z 序 ⇒ 静息态不可读）**
- zh/en mobile 标题两行与 position/container 两卡的 __body 内容盒交集
  703-1737px²/行，且标题 z 已在 panel 之下（用户裁决），重叠变成遮挡。

**act5 — CONFIRMED**
- en 宽标签三钮 124/141/148px（1440）/ 86/102/108px（390）全部单行、不换行不截断。
- 收尾层全部元素在列盒内且在视口内（en-390 列底 818 < 844）。

### 2. 换行

**act3 — CONFIRMED**：4/4 配置常驻期（elapsed 1200→9900，每 600ms 档）行数与行宽
恒定：en-desktop 2 行/386px、zh-desktop 1 行/468px、mobile 2 行——全程无闪跳、
无 balance 重排。

**act5 — CONFIRMED（附小反驳）**：footer en 在 390 两行居中、在视口内。但
**en-1440 footer 也是两行（h=73px）**——实现报告「footer 桌面单行」的说法不成立
（en tagline 长文案在 1440 同样折行）。无溢出、列盒恰好容纳（列底 703 = 视口内），
纯记录性偏差。

### 3. 层级

**act3 — CONFIRMED（新裁决语义）+ 移动端 FAIL**：标题 z 已按 20:17 用户裁决移除
（panel zIndex 1-6 在前）。桌面静息零重叠，层级无实际影响；transit（elapsed≈450）
峰值块从标题前方过（elementFromPoint 命中 scrub 块、titleOp 0.725）——预期行为。
移动端静息态被压（见维度 4）。act5：scrub lane（包装层 opacity）与子元素 CSS
入场两层叠乘正确——挂载时包装层立即 1、子元素从 0 上升，滚回时子元素已 settle 1、
包装层 scrub 恢复，无层间打架。

### 4. 被遮挡

**act3 移动端静息态 — FAIL（本轮最高严重度）**
- 网格扫 0/26 点命中标题（zh/en 同），遮挡者为 position 卡的 `.a3-coord__label/
  __unit` 与两卡 `__body`（不透明实底，computed bg 无 alpha）。
- 像素 A/B 铁证（隐藏标题前后差分 + 逐列分析，`adv2-act3-ab.json`）：标题**只在
  x178-200（两卡之间 22px 缝）可见**，其余全部被不透明卡片覆盖——静息态标题
  实质不可读。
- 定性：用户裁决「panel 从标题前面过」的本意是 transit 穿心；静息态常驻可读性
  标准下这是缺陷。修法方向（二选一）：mobile 静息布局让开标题带（buildPhonePanels
  中排两块 y 挪出标题带），或静息态给标题局部 z（transit 仍穿前）。

**act3 峰值帧 — by-design**：标题在峰值块之后（opacity 0.725，scrub 块底板
#f9f4ea 不透明）——新裁决预期，非缺陷。

**act5 — CONFIRMED**：手机/列/文字三者干净——像素扫描 phone 右缘 x533 vs 列左缘
x693，160px 暗缝（y300-750 四行一致，缝内 maxLuma≤50 仅星点）；全部收尾元素在
列盒+视口内。

### 5. 视觉效果

**/drag 快门 — CONFIRMED 写实（暖 rim 子声明 REFUTED）**
- CTA：bg/border `rgb(216,162,74)`=#d8a24a amber、color `rgb(12,10,12)`、
  boxShadow `none`——回归 amber 确认。
- 快门（act4 hold，stop 0.800，rAF paused=0）：盘面 p50 39/均值 56；叶片体
  （6/9 楔）mean 31-36、max 35-42——近黑钢体；倒角亮缘 max 113-185——分片感
  由亮边缘承担。wedge 200/240 偏亮为 `.s04-clock` DOM 玻璃反射叠加（与实现
  报告同位同源）。**非卡通，写实读法成立**。
- ⚠️ 「光孔边缘暖 rim」未获观测证：光孔环带（luma>55）像素 **4113 冷 vs 9 暖**
  （R/B ±5% 判据）——rim 描边（EDGE_HOT，rimAlpha≈0.33@stop0.8）被冷钢体+teal
  sheen 支配，暖 rim 视觉上不存在（或仅 specular>0.45 高光瞬间）。机制在码、
  观测为零。若用户期待可见暖 rim，需调 `rimAlpha` 公式（实现报告自己也留了
  该旋钮）。

**act5 黑场按钮 — CONFIRMED**：主钮中心像素 luma 238.3（骨白实底）+ 深墨字
（对比 17.46 已由实现方验，颜色一致）；**无阴影像素环**——水平两侧 ring(4px)=
21.3/21.5 vs far(26px)=21.4/21.4，零光晕（首轮 ring 差 58 为上下方文字污染，
定向复测排除）；次钮描边态正常。

**bg-grid mask — CONFIRMED 渐隐无硬边**：顶缘逐深度点阵对比度 ramp（内容隐藏
后纯点阵采样，`adv2-bggrid-ramp.png`）：depth<44px 恒 0（首行点 46px 处 14），
78px 处满值 21——衰减比 14/21≈0.67≈46/72 的线性 alpha，与 8% mask 吻合；
底缘对称（边缘 22px 内对比 0-6 vs 满值 21）。pinned 态网格顶/底缘均无点阵硬切。

### 6. 框架能力应用

- **scrub lane 认领 — CONFIRMED**：en/zh 1440 + en 390 全程 console 零 error/
  warning（无 ignores 告警）；/drag 页亦零报错。
- **FOUC — CONFIRMED 无闪现**：latch 挂载首采样四子元素 computed op 全 0
  （CSS `both` delay 层）、包装层立即解析 1；footer 800ms 前 0 个违规样本。
- **一次性 CSS 动画 — CONFIRMED** 合规规则 6：四条 `scene5-closing-*`
  0/0.25/0.6/0.9s `both`，无 infinite；prefers-reduced-motion 关闭。
- **消息协议语义 — CONFIRMED**（修正探针方向错误——`contentWindow.postMessage`
  是发进 iframe——改为 iframe 内向 parent 发后复测）：unfinished → 收尾层卸载+
  收列；finished → 重挂+入场重播；latch 持有中重复 finished → 同一元素、op 保持
  1、不重播。自然 settle bounce（unfinished×3→finished）终态=最后消息，正确。
- **真实手势链路 — CONFIRMED 已修复**：3/3 配置真实 iframe 拖拽直达 finished
  ——实现报告遗留的「/drag 中间态手势不 commit」在当前树不复现（其遗留项 1 可销）。
- **act3 倒放纯函数 — CONFIRMED**：4/4 配置正程/反程同 offset 的 op 逐点相等
  （0 mismatch）。

### 7. 性能热路径

- **act5 无每帧 setState — CONFIRMED**（静态 + 行为）：handleProgress 收拢/开列
  全走 ref 单边翻转；scrub 采样值严格线性（0.636/0.273/0/0 与理论值相等到小数
  三位），无台阶/追赶痕迹。
- **act3 关键帧零增属性 — CONFIRMED**：dollyVariant/developVariant 属性集
  （x/y/scale/opacity/filter）与 times 结构未膨胀，无新 hook/状态。
- **旧机制删净 — CONFIRMED**：SPLIT_*/enterRef/exitRef/cap.shot3.summary/
  act3-summary/SUMMARY_MS/BLOCKS_END/--tp-rec-glow 全仓 grep 仅剩历史注释。
- ⚠️ **dist 时效（中等级别提醒，非本轮三摊缺陷）**：`dist/cineview.es.mjs` 构建
  于 06:06，框架 src（Animate.tsx/useAnimateScroll.ts/VideoFrameRenderer.tsx/
  sceneScrollRuntime.tsx 等）18:19 有未构建的工作树改动——本轮全部真机证据针对
  06:06 dist（site link:../dist）。18:19 的框架改动（manualExit sticky 等）未经
  浏览器验证；收口前须 `pnpm build` + 重跑关键探针（memory: site-consumes-dist-
  not-src）。

---

## 问题清单（按严重度）

1. **[HIGH·缺陷] act3 移动端静息态标题被遮挡**（zh/en mobile；维度 1/3/4）：
   两卡 __body 不透明底盖住标题带，仅 22px 缝可见（像素 A/B 铁证）。静息态
   常驻可读性不成立。修复方向见维度 4。
2. **[MED·提醒] dist 陈旧**（维度 7）：框架 src 18:19 改动未进 dist，真机证据
   全部针对 06:06 构建；重建 + 重验后才能收口。
3. **[LOW·反驳] 「快门暖 rim」不可观测**（维度 5）：4113 冷 vs 9 暖像素；
   写实主判不受影响，rim 需加大 rimAlpha 才可见（留用户裁量）。
4. **[LOW·记录] act5 footer en 在 1440 也折两行**（维度 2）：实现报告「桌面
   单行」说法不成立；无溢出，纯文案记录偏差。
5. **[INFO·已化解] /drag 手势链路**：实现报告遗留项 1（中间态手势不 commit）
   当前树 3/3 复测通过，可销项。

## 总判定

**PASS-with-notes** —— 桌面全部目标（act3 24ch 重叠清零、act5 收尾层语义/布局/
性能、/drag 快门写实+CTA、bg-grid mask）七维取证通过；唯一实质缺陷是
**act3 移动端静息态标题可读性**（HIGH，需一轮布局修复），另有一条 dist 重建
前置提醒。修复移动端遮挡 + 重建 dist 后即达 PASS。
