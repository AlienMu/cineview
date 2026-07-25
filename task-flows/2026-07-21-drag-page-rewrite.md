# Task Flow — /drag 页面重写（入场 + 退场动画双向使用）

> 日期: 2026-07-21 | 范围: site/src/components/temporal-drag/* + temporal-drag.css
> 目标: 保留暗调电影剪辑室主题，重新编排 4 个 Scene 的 Animate 时间轴，
>       **每个有意义的元素都同时声明 enterAnimation + exitAnimation**，
>       让 drag 正向切场时当前场景元素播放各自不同的退场（distinct per-element exit），
>       反向拖拽时反向重演入场。尽量走框架能力，减少命令式 DOM 操作。

## 背景裁决（已核实）

- drag 模式下，退场仅由 outgoing（active、被拖走）场景的 Animate 元素播放，
  由 renderProgress 驱动（useAnimateDrag.ts:192-296）。
- **无 exitAnimation ⇒ 元素退场时保持 animate 态、随页面滑走，没有独立退场**（line 289）。
- 当前 /drag 全部元素零 exitAnimation → 这正是要修的核心。
- outgoing localProgress = (renderProgress × sceneTransitionDuration) / exitDuration。
  → 用不同 exitDuration 可制造 cascade：exitDuration=360 在 renderProgress≈0.5 完成退场，
    =720 在 renderProgress≈1.0 完成。这是「distinct per-element exit」的主要杠杆。
- 方向语义：forward → active 场景 lerp animate→exit（播放 exitAnimation）；
  backward → active 场景 lerp animate→initial（反向重演 enter）。
- 默认 exit duration = DEFAULT_ANIMATION_DURATION（若未显式给）。

## 用户决策

1. 保留主题（暗调剪辑室 / dial / timeline / flux / cut），重新编排动画。
2. 退场风格：distinct per-element exits（每个元素各自不同的退场，非统一整块退场）。

## 节点

- [x] N1. 建立退场编排规范：为 4 个 Scene 的每个 Animate 元素设计
      enterAnimation + exitAnimation + exitDuration（cascade 时序表）。见 -plan.md。
- [x] N2. 公共组件加退场：HeaderHUD（hud + hud-meta）/ FooterBar / TimecodeDisplay
      补 exitAnimation + exit duration。RecBadge 无 Animate（纯 CSS），随 HUD 整块退。
- [x] N3. Scene 01 (Rolling) 重编：dial-ticks / inner-ring / center-number / hands（second+minute）/
      eyebrow / title / subtitle / drag-hint / corners(tl/tr/bl/br) 全部补 exit；
      命令式 DOM hack 经评估保留（非每帧、CSS toggle，框架推荐做法）。
- [x] N4. Scene 02 (Choreograph)：eyebrow / title / timeline-base / 5 nodes（递减 exitDuration 反向收束）/
      lights / panel(原本零动画，补 enter+exit) 全部补 exit。
- [x] N5. Scene 03 (Flux)：label / main-timecode(rotateX flip-out) / equation / progress-ring / tickbar 补 exit。
- [x] N6. Scene 04 (Cut)：cut-title-blur / cut-title / accent-line / the-end / 2 buttons / sprockets 补 exit
      （末场，退场主要在反向拖拽 04→03 走 animate→initial 反演；显式 exit 供 goToScene）。
- [x] N7. CSS 对齐：s03-clock 加 perspective 让 main-timecode rotateX 退场读作 3D flip；无死样式新增。
- [x] N8. 收口自检：type-check ✅ / site build ✅ / grep 确认 33/33 Animate 皆有 enter+exit ✅ /
      非白名单 drag 属性 0 处 ✅。
- [x] N9. 真机验收（独立 agent，headless Chromium + Playwright，路由 `/drag` 非 `#/drag`）：
      **7/7 全 PASS**。证据：正向 01→02 mid-drag 各元素 computed style 各异（inner-ring
      opacity .57/scale 1.13、center-01 opacity .48/scale 1.21/blur 5.2px、eyebrow opacity
      .20/y −14.4px、ticks 仍 ~1.0 最后散）= 真·独立退场，非整块滑走；02→03→04 正向到达
      FINAL CUT；反向 04→03→02→01 逐场反演重入；<阈值回弹归零、>阈值提交；性能 ~1100 帧
      p50 17ms / p95 19ms / 0 长任务 / 0 帧 >50ms。0 console error。

## 追加轮（2026-07-21）：i18n 接入 + 多视口验收

用户反馈：中英文切换对 /drag 无反应；兼容性未测。

- 根因：temporal-drag/ 全部组件文本硬编码，零 useI18n() 调用 → LangToggle 切
  I18nProvider 的 lang state，组件不消费，纹丝不动（GPT 遗留、动画重写轮也未接）。
- [x] N9. 新增 18 个 dragTemporal.* 字典 key（en/zh 各一份，key 完全对齐）。
      电影术语母题（REC/SMPTE/ISO/FPS/slate 场号/FRAME/DRAG/CUT/THE END/节点 T·S·B·I·C/
      面板 WAIT·DELAY·DURATION/DRAG DISTANCE = TIME）两版保留英文；只译叙事文案 + 全部 aria-label。
- [x] N10. 8 个组件接入 t()：SceneRolling/SceneSync/SceneFlux/SceneCut/HeaderHUD/
      DragHint/ParamPanel/TickBar；FooterBar 经各 Scene 传入已译 hint。统一走字典入口。
- [x] N11. 验证：type-check ✅ / build ✅ / format ✅ / 残留英文自然语言字面量 0（仅 hint="END" 术语保留）。
- [x] N12. 独立 agent 真机验收（localhost:4001/drag，headless Chromium 实测 DOM）：
      A. 中英切换实时响应、无刷新、可回切、术语保持英文、html lang en↔zh-CN、localStorage 持久化、0 console 错误 —— PASS。
      B. 4 视口（375×812 / 430×932 / 768×1024 / 1440×900）零溢出、dial 居中、toggle 在界内 —— PASS（宽屏为居中移动稿+留白，属预期）。
      C. 拖拽回归：正向逐场推进 01→02→03→04、按钮双语正确、0 console 错误 —— PASS。
      未覆盖：拖拽中入退场逐帧帧率（上一轮已单独测过，本轮未重复 profile）。

## 自检清单（每节点收口）

1. 该元素是否真的既有 enter 又有 exit，且退场在 drag 时可见（非随页面滑走）。
2. 是否引入命令式 DOM 操作 / 死样式 / 零消费字段。
3. 热路径：退场靠框架 renderProgress 驱动，不新增每帧 setState / 每帧换引用 useMemo。
4. 单一所有者不变量不破坏。
