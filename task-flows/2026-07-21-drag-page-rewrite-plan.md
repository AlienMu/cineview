# /drag 重写 — 退场编排设计

## 退场机制杠杆（drag mode）

outgoing 元素每帧：`localProgress = (renderProgress × 720) / exitDuration`，
lerp `animate → exit`。所以：

- exitDuration 越小 → 越早演完退场（cascade 排序的主杠杆）。
- exit 变体的 transform 决定「往哪退」（distinct 的主杠杆）。
- 反向拖拽（backward）自动 lerp `animate → initial`，即反演各自 enter，天然 distinct。

## 每 Scene 退场编排（enter 保留现有，新增 exit）

### 公共
- HUD / hud-meta / footer / timecode：exit = fade-out + 轻微 y 位移，exitDuration 480（整块先淡出）。
- timecode 逐位 stagger 的 exit 用逐位 fade+slide。

### Scene 01 Rolling（前景内容先走、骨架后走的 cascade）
| 元素 | exit 动作 | exitDuration |
|---|---|---|
| drag-hint | fade + scale-down 0.6 | 240（最先消失）|
| subtitle | slide-up + fade | 300 |
| title | blur(10px) + y -24 + fade | 380 |
| eyebrow | fade | 300 |
| center-number "01" | zoom-out scale 1.4 + blur + fade | 460 |
| hands | rotate 继续扫过 + fade（second→90°, minute→30°）| 520 |
| inner-ring | scale 1.3 + fade | 560 |
| dial-ticks | scale 0.4 + fade（逐 tick，随 stagger）| 640（最后，骨架收束）|
| corners | fade | 240 |

### Scene 02 Choreograph（时间轴从右往左「收线」）
| 元素 | exit | exitDuration |
|---|---|---|
| eyebrow / title | slide-up + fade | 320 / 380 |
| nodes（T→C）| scale 0 + fade，node-cta 先走 → node-title 后走（用递减 exitDuration 制造反向收束）| 300..460 |
| lights | fade | 200 |
| timeline-base | scaleX→0（transform-origin right）| 520 |
| panel | slide-down + fade | 360 |

### Scene 03 Flux（时间坍缩）
| 元素 | exit | exitDuration |
|---|---|---|
| label | fade | 280 |
| equation | slide-down + fade | 320 |
| main-timecode | 逐位 flip-out + fade | 420 |
| ring | fade + scale 0.9 | 460 |
| tickbar | 逐 tick scaleY→0 | 520 |

### Scene 04 Cut（末场；退场只在反向 04→03 触发 → animate→initial 反演，无需显式 exit，但仍补 exit 以防 goToScene/未来扩展并让反向更克制）
| 元素 | exit | exitDuration |
|---|---|---|
| cut-title | zoom-out + blur + fade | 480 |
| accent-line | scaleX→0 | 300 |
| the-end | fade | 260 |
| buttons | slide-down + fade | 320 |
| sprockets | fade | 240 |

## 命令式 DOM hack 处理

- `is-shaking`（秒针震颤）：保留（CSS class toggle，非每帧 JS，符合热路径规范）——
  但改为更克制，或评估用 dial 已有的 motionValue 旋转反馈替代。倾向保留（低成本、非 React 渲染）。
- `is-calibrating`（释放后刻度校准闪）：保留（一次性 CSS animation，onDragCommit 触发）。
- `data-drag-direction`（tick 扇区高亮）：保留（dataset 写一次/方向变化，非每帧）。
  这些都不是每帧热路径，符合 CLAUDE.md 性能规范，删除会损失反馈质感。
  → 结论：不删 hack，因为它们本就是「非 React 渲染的低频 DOM 反馈」，是框架推荐做法。
  重点新增的是 exitAnimation。

## 不改动
- TemporalMotion（reduced-motion 适配）保持。
- useTimecode RAF ref 写法保持（热路径安全）。
- CineView 配置（size 390 / dragTimeScale 16 / threshold）保持。

## 验证
- pnpm --dir .. type-check（site 无独立 lint，走根）+ site build。
- 真机验收（独立 agent）：#/drag 正向逐场切，观察每个元素退场各自不同、
  非整块随页面滑走；反向重入；回弹；并发掉帧。
