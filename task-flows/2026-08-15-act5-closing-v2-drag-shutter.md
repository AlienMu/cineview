# 2026-08-15 act5 收尾层 v2 + 退场 scrub 化 + /drag 快门写实化

## 需求（用户 grill 反馈，六项）

1. act4 标题逗号多余：「或许，也能驱动视频？」→「或许|也能驱动视频？」
2. footer 行从视口底挪进右栏 cta.body 下方
3. act5 CTA 按钮丑（黑字不可读/阴影截断/AI 味）——frontend-design 重做黑场语境按钮
4. act5 文字无跟手退场——**用户拍板：scrub 语义**（文字/CTA/footer 透明度 = progress 函数，窗宽 **0.85–1.0**；列收拢阈值 **0.90**；入场保留串行）
5. /drag act4 快门卡通——写实金属叶片（近黑钢色+边缘高光+低饱和 teal 反射）
6. /drag act1 CTA 红→回 amber（rec 实物被否决，翻案 2026-08-15 上午的 A-3a 裁决）

## 关键架构裁决

同一 lane 不能手动入场+scrub 退场 ⇒ 混合方案：**挂载门控在 finished latch + 透明度 scrub lane（phase 0.85-1.0）+ 串行入场改一次性 CSS 动画（delay 0/0.25/0.6/0.9s，规则 6 允许）**。旧 enterRef/exitRef 编排全删。split state = latch && progress > 0.90（handleProgress 内，仅阈值穿越 setState）。unfinished 只清 latch。

## 节点

- [x] N7a act5 agent：四项全落地 + 双语六组合布局全 PASS（`impl-act5-closing-v2.md`；scrub 退场逐位吻合理论值；按钮零阴影设计）。
- [x] N7b /drag agent：快门写实（近黑淬火钢+亮缘+暖 rim，亮度 −27% 对拍）+ CTA 回 amber（`impl-drag-shutter-cta.md`）。
- [x] N8a act3 agent：反向重排完成（`impl-act3-reverse.md`；死在最终汇报消息，产物完好）；手势链路复证 closing-v2 11/11 PASS；页面健康零报错。
  - ⚠️ 已知权衡（待用户裁决）：en 两行标题行1 695px 与 chain panel 底缘 ~84px 重叠带（对比 16.2:1 + z 序化解，可读性无碍）；零重叠需标题带 ≤600px（en 单行 ≤26 字符）或压字号——文案/字号是拍板项未动。
- [x] N8b 点阵截断：`.bg-grid` 上下 8% mask 渐隐（用户裁决边缘溶解，act1→act2/act2→act3 两处硬边一起修）。
- [x] N7c 对抗复审 **PASS-with-notes**（`adversarial-round2.md`，七维 + 双语）。跟进项已全部当场修复复验：
  - **HIGH act3 移动端静息遮挡**（标题压在 position/container 两卡上，0/26 网格点）→ 手机 titleY 0.446H → **0.86H 底部空带**（2×3 网格空带只在顶/底，顶部与 cap-slate 打架）。复验 25/25 网格点可见、零相交、在视口内。
  - **dist 陈旧** → `pnpm build` 重建 + dev server 重启 + releaseOnLeave 4/4 + closing-v2 11/11 复验全绿。
  - note（不改）：act5 footer en 桌面折两行（h73）——无溢出，接受；「暖 rim」实测不可观测（冷 4113 vs 暖 9 像素）——写实冷钢成立，rim 若要强化另议。
  - 复审确认：act3 桌面 24ch 两行 136/136 网格点净空、zh 单行同净；/drag 手势链路 3/3 修复；bg-grid mask 双缘渐隐无硬边；零 console 报错；零每帧 setState；旧机制 grep 删净。
- [ ] N7d 用户现场验收（移动端标题新位置 + act3 反向 + act5 scrub 退场 + /drag 快门/CTA）。
