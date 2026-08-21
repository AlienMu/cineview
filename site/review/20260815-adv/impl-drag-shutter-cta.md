# impl — /drag 两项修正（act4 快门写实化 + act1 CTA 回归 amber）

- 日期：2026-08-15
- 分支：codex/drag-release-dual-gate
- 触发：用户原话「镜头是青色，但是快门的颜色你并没有改，可以改成写实的那种，现在的快门太卡通了」；「首屏的按钮是红色，我不希望，改回以前的颜色」

## 改动文件（仅 3 个，未触碰 scroll 页 / 框架 src/）

1. `site/src/components/temporal-drag/aperture/ApertureCanvas.tsx` — 仅颜色/绘制质感，几何与动画机制零改动
2. `site/src/styles/temporal-drag.css` — CTA 回 amber + rec 死别名清理
3. `site/scripts/adv-20260815-shutter-cta.mjs` — 新增验收探针（只读）

## 1. act4 快门写实化

问题：今早 A-1 只把 `bladeSheen` 四档 stop 从蓝平移到 teal（0.95 alpha 起步的亮渐变盖在已饱和的蓝紫叶片体上），读作「卡通塑料片」。

修法（全部是常量/绘制层改动，叶片几何、phase 门、rAF 机制原样）：

- **叶片基体近黑钢**：`METAL_DARK [4,15,48]→[13,14,16]`、`METAL_LIT [29,132,220]→[26,29,33]`（#0d–#1a 区间中性偏冷淬火钢，淬火蓝只剩一丝）。`FACET_BASE_TONES` 的片间差保留 → 相邻片基体差 ~8 灰阶，钢片有微差但不显色。
- **分片靠 1px 级亮边缘**（金属倒角反光）：边缘色从饱和蓝 `EDGE_COOL [96,188,255]` 改为钢面 teal 反射 `[176,205,212]`，`EDGE_HOT [235,229,255]` 改暖白 `[242,234,219]`（= `--tp-sig-warm` 族）；edgeAlpha 公式整体压低（峰值 ~0.94→~0.77）。
- **光孔边缘暖 rim**：新增第二遍 stroke——同一条 leading edge（同三点，零几何变化），宽笔（`unit*0.011`）、暖白、alpha `0.08 + stop*0.24 + specular*0.12`，随快门收小而增亮（光集中在更小的孔）。九条 leading edge 即光孔九边形，这圈就是「光从孔透过来打在叶缘」。
- **sheen 压成薄反射**：四档 stop `0.95/0.5/0.12/0.72`（亮 teal）→ `0.14/0.07/0.10/0.45`（低饱和冷钢反射，外圈落近黑顺带收拢镜筒）。复合 alpha 0.48 不变 → 顶层有效 alpha ~0.067，只余一层薄薄 teal 环境反射呼应本幕冷极。
- 文件头 canvas 豁免注释原样保留。

## 2. act1 CTA 回归 amber

`.tp-btn--primary`（temporal-drag.css）恢复今早改动前的写法（git `41aae22` 逐字对拍）：

- `border/background: var(--tp-accent)`（amber #d8a24a 路径），hover 回 `--tp-accent-soft`；`color: var(--tp-bg)` 不变
- rec glow `box-shadow` 删除（amber 时代没有）
- 注释记录翻案：rec 信号色保留为契约终局/commit 信号的文档化角色，暂无消费者
- 随手净负：删掉 `--tp-rec-glow` 别名（A-3 注释自称「唯一消费者 = act1 主 CTA glow」，glow 没了即零消费者）；`--tp-sig-rec`/`--tp-sig-rec-glow` 按指示保留并更新注释；RecBadge/.tp-rec* 不恢复（本来就是死代码）

## 验收（真实浏览器，localhost:4000/drag，真实指针拖拽 0.84h→0.42h ×3，settle 6.5s）

探针：`node scripts/adv-20260815-shutter-cta.mjs [new|old]`；「old」= 临时换回 HEAD 版 ApertureCanvas 的对拍基线（已恢复、diff 校验）。

### CTA（act1）

| 项 | 实测 | 期望 |
|---|---|---|
| backgroundColor | `rgb(216, 162, 74)` = #d8a24a | amber ✓ |
| borderColor | `rgb(216, 162, 74)` | ✓ |
| color | `rgb(12, 10, 12)`（--tp-bg 暖黑） | ✓ |
| boxShadow | `none` | 无 rec glow ✓ |

### 快门（act4，settle 后；canvas dataset stop=0.800 / paused=0 → rAF 门与几何机制在跑）

| 采样 | 旧（卡通 teal） | 新（近黑钢） | 判读 |
|---|---|---|---|
| 全 canvas 平均亮度 | 62.6 | 45.4–45.6 | −27%，钢体主导 ✓ |
| 光孔区均值 | 88.7 | 51–53 | −42%，孔不再被亮渐变淹没 ✓ |
| 九角向楔均值（叶片体） | 64–131（整片亮） | 38–42（除左上 DOM 玻璃反射楔 81/83） | 近黑钢体 ✓ |
| 楔内峰值（倒角亮缘） | 154–191 | 154–178 | 亮边缘保留，分片感由它承担 ✓ |
| p99 | 195.9 | 195.9 | 高光不受损 ✓ |

左上 81/83 的两楔是 canvas 上方 DOM 玻璃反射层（`.s04-clock` 静态反光，非本次改动对象）叠出来的，两版同位同源。ASCII 亮度图（探针截图离线解码）肉眼复核：旧版叶片区域是一片连续亮块、片不可辨；新版是近黑盘 + 细亮边缘圈 + 暖 rim，符合写实光圈读法。截图存于 `site/scripts/shots-0815/{new,old}-act4.png`。

### 静态门

- `npx tsc --noEmit` 0 错误；prettier（两改动文件 + 探针）全绿
- 探针全程 console 零报错

## 残留 / 建议

- 「写实快门」最终裁量权在用户眼睛：若希望暖 rim 更亮或钢体更蓝一点，只需调 `rimAlpha` 公式与 `METAL_LIT` 两个常量，几何零风险。
- rec 色现为纯文档化 token（无消费者）；下次终局幕需要 commit 信号时优先消费 `--tp-sig-rec`，勿再新造别名。
