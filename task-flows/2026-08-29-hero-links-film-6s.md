# 2026-08-29 hero 首屏按钮降级 + 胶带幕 6s 重编排

用户裁决：
1. hero 三按钮砍掉层级混乱——留 `开始` 一个 primary，API 文档/GitHub 降为 mono 小字文本链接。
2. CapabilityScene 胶带幕重编排：预算 ≈6s，废 10s pan + 倒序 gapless 链，改"胶带就位 → 波浪正序播帧"。

顺手修复（还原尾巴）：
- `.lang-toggle` 恢复药丸 radius、hover 不出边框（像素轮残留）。
- `/drag` 第一幕标题 `CineView` → `cineview`。

## 节点

- [x] 1. hero：API/GitHub ghost pill → `.hero__link` mono 链接（保留入场 cascade 与 Animate id）
- [x] 2. 胶带幕常数重设：TAPE_IN 700 / FRAME_START 1100 / STAGGER 220 / FRAME_PLAY 600 / HOLD 2400 → SELECTION ≈ 5.9s
- [x] 3. 帧入场改正序 stagger（0→8），废掉倒序 + after 链
- [x] 4. caption 切换点 + fade 窗口重算（fade 100ms，2×fade < stagger 220）；末帧 caption 实心保持
- [x] 5. FilmTimelineProjection：active/done/flow 公式按新时间轴改；done 在播完点即真（hover 全域可用）
- [x] 6. film-clock TimecodeAxis seconds 10→6；film-hold 挂到最后一帧之后
- [x] 7. 注释/文档块与 code 同步（删掉倒序/10s pan 的描述；`infiniteAnimation` 注释顺带改 `loopAnimation`）
- [x] 8. probe 80 页 PASS ＋ `tsc --noEmit` 0 错 ＋ 全仓 1594 测试通过
- [x] 9. 真机验收（playwright DOM 断言，dev `:4003`）
  - hero：`.hero__cta` 内仅 1 个 primary 按钮 + 2 个 `.hero__link`（无边框无底色，mono）
  - 胶带幕：cum 3200→4800px 帧格 2→5→9 正序波浪入场；active caption 同步切（Zoom→Flip→Focus）
  - hold 段（cum≥4900）：codecard opacity 恒 1（2026-08-12 回归未复现）
  - hover 帧 4 → `is-active`/`is-paused`/caption 换「Springy bounce」全生效；移出复位
- [x] 10. 修验收暴露的真 bug：`FilmTimelineProjection` 原挂在 `film-pan` lane（旧 PAN_MS=10000）下，
  pan 时长改成 700 后投影 elapsed 全部失准（active 恒 -1）。**移至 SELECTION_MS 的 `film-clock` lane**
  并就近注释钉死：「投影必须挂在 SELECTION_MS 轴上」。
