# 2026-08-29 像素风统一到全局

目标：把 docs header 已验证的 16-bit 像素风（直角、2px 墨框、右下硬投影、按压位移）推广到全站 UI chrome。demo 场景里的打光/圆点等美术元素（`border-radius: 50%`、`filter: blur` 光斑）不动。

## 节点

- [x] 1. tokens 阴影换硬投影（`--shadow-sm/--shadow/--shadow-lg` → 无模糊 offset 投影）
- [x] 2. `.lang-toggle` 基础款方角
- [x] 3. `.btn` / `.btn--primary` / `.btn--ghost`：药丸 → 直角 + 硬投影 hover + active 按压（含 `.home-scene-canvas .btn` 换算层）
- [x] 4. docs 文章 chrome：行内 code、`.docs-code`、代码窗圆点改方点、裸 pre、移动端表卡、blockquote、`docs-search__panel/hit`、`.docs-pager__link` 全部直角
- [x] 5. Scene5Cinema 的 pill 按钮直角
- [x] 6. prettier + docs-style-probe 80 页 PASS
- [x] 7. 截图逐像素验收（首页 hero 按钮、docs 正文 code/pager/search、header 回归）

## 复审结论（2026-08-29 晚，用户提出「风格不一致」+ grill-me 探索后）

第一轮（节点 1-7）只改了形状没改色族，埋下观感散的问题。用户提出三点：① header 边框粗、body 细，不协调；② 背景不契合像素风；③ codecard 直角但报看。并给定参考 ekmas/neobrutalism-components，同时指出改动波及 hero 场景。

grill-me 已锁定裁决：
- **Q1 = b → 后用户翻案**：像素/neobrutalism 规格**排除 hero 首页**；`.btn` 全局恢复药丸+光晕原件，像素规格改挂 `.docs-page .btn` 作用域（docs 兜底页按钮仍是像素风）。
- **Q2 = a**：双层制。底帧 2px `--ink` 永远 ink；投影分层：静止卡 3px `--frame-line`；可交互件 2px hover 4px / active 按平 1px。
- **Q3 = 暖纸底**：渐变改纯色暖纸底。docs 正文画布落定为 `#fff9f2`。

## 二轮节点（整改复审发现的问题）

- [x] 8. docs 页背景 #ffffff → 暖纸色（Q4 定值）
- [x] 9. docs chrome 冷灰族清空替换为暖墨族（`#eceef1`/`#f3f4f6`/`#e5e7eb`/`#fafbfc`/`#f7f8fa` 全部替换为 tokens 变量或暖色派生；blockquote/`td:hover` 也一起改）
- [x] 10. 边框/投影按 Q2 规格统一：卡 2px ink + 3px frame-line；可交互件 2px ink + hover 4px、active 1px+位移。落点：`.docs-pager__link`、`.docs-code`、blockquote、行内 code、`.docs-search__panel/hit`、`.docs-crumbs__card`/docs-nav 若有框也一起
- [x] 11. codecard 重构：`docs-code` 头带 + 内容区按 neobrutalism 规格（2px 墨框、必要分层、内容区淡暖/深底对比）
- [x] 12. hero 场景、demo 场景（temporal-drag `tp-btn`、Scene5Cinema）和 `.btn` 保持纳入像素风，不归还
- [x] 13. 暗色场景（cinema 等）上的 ink/accent 对比核查，必要时局部 override
- [x] 14. prettier + docs-style-probe 80 页 PASS
- [x] 15. 截图验收：docs 正文全景（code/blockquote/pager/search）+ hero 首屏 + header + 920px 折行 + hover 态

## 三轮：暖线规格（用户裁决 2026-08-29）

「别用黑色粗线条和冷色粗线条」——全站 `2px solid var(--ink)` 九处 + logo 描边环统一改 `var(--accent-ink)`（#a86247 暖棕）；grep 复扫 `solid var(--ink)` 零残留。表格同步：thead 下边缘加 2px accent-ink 分隔线，th 底 `--film-white-2`、行 hover `--film-white`（上一轮已暖化）。像素级验证：代码块左框 x307-308 = (168,98,71) 双列棕线；thead 分隔线棕色整行确认。probe 80 页 PASS。

## 四轮：方向 A「编辑风回归」（用户裁决 2026-08-29）

像素/neobrutalism 尝试整体撤回，保留：直角、暖色系（#fff9f2 画布 / 冷灰族清零）、header logo（唯一像素记号）、导航纯文字化。docs chrome 全改 1px 暖线（--frame-line）、无硬投影；tokens 阴影恢复柔和（--shadow-sm/lg 回柔）；搜索面板 1px 线 + 柔影。`.btn` 恢复药丸+光晕原件（`.docs-page .btn` override 整块删除）；demo 场景 `tp-btn` / `Scene5Cinema` 按钮与 `s01-hand` 恢复 `--tp-radius-pill`（999px）。像素级验证：header 底线 1px frame-line 全宽；codecard 左框单像素暖线列；blockquote 3px 棕条竖带在位；搜索面板下缘渐变（柔影）确认；表格棕带清零。probe 80 页 PASS。
