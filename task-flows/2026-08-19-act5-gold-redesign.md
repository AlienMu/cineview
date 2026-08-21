# 2026-08-19 Act5 黑金改版

## 任务来源

用户指令：「act5 文案太紧凑，整体占用高度需要对标左侧手机的高度。黑色背景星星去掉，增加淡淡的黑金，金色不要太明显渐变背景，背景设计持续动画。」

## 节点

- [x] 1. 删星星：tsx 星光块（TWINKLE_CHANNELS/buildStars/makeRng/Star/stars useMemo/9 层嵌套 Animate JSX）+ CSS star 规则全删，全仓 grep star/twinkle 零残留
- [x] 2. 黑金渐变底：`.scene5-cinema__overlay` 纯黑 `#0a0909` → `linear-gradient(145deg, rgba(212,175,105,0.05) → 近黑)` 叠加，金色 alpha ≤0.05（淡而不显）
- [x] 3. 背景持续动画：两层 radial 金雾 `.scene5-cinema__gold-mist-layer--a/--b`（z2，alpha ≤0.055，`translateZ(0)` 合成层），两条互质周期 infinite lane（9s/14s）写 `--gold-drift-1/2` 映射 opacity 极慢异相呼吸（CLAUDE.md 规则 6 正确姿势；遵守 memory `infinite-lane-cannot-drive-whitelist-props` + `css-var-opacity-repaints-fullscreen`）
- [x] 4. 文案高度对标手机：is-split 态 text-col `min-height:90vh` + `justify-content:space-between`（四拍沿手机全高分布）；窄屏纵向回退 `flex-start`/`min-height:auto` 防泄漏
- [x] 5. 真机验证：探针 4/4 PASS
- [x] 6. 全量回归：site tsc 0、site contracts 10/53 PASS、全量 jest 120 suites/1581 tests PASS、`pnpm lint` 0 错 0 警

## 真机证据（site/scripts/act5-gold-verify.mjs，headed 1440×900）

- **A** 星星 DOM 0 个（star/star-field/stars 全无）
- **B** overlay 黑金渐变生效（computed backgroundImage 含 linear-gradient，base rgb(10,9,9)）
- **C** 金雾持续动画生效（2 层，2.5s 采样窗口内 o1 0.936→0.919、o2 0.771→0.529 呼吸移动）
- **D** text-col 高度对标手机（col=810px / phone=810px，ratio=1.000，justify=space-between）——split 经真实指针 iframe 拖拽触发 finished

## 关键裁决记录

- 一条 infinite lane 写两个变量必然同周期——嵌套两条 lane（9s/14s 互质）才能异相呼吸、合成波不复现（初版单 lane 已纠正）。
- 金雾层是全屏 gradient + 每帧变量改写 → 必须 `translateZ(0)` 提合成层（与旧三层星幕同一教训，memory 已有）。
- overlay 的 145deg 渐变 alpha 色标：0.05/0.028/0/1（右上暖金 → 38% 处铜金 → 72% 转纯黑 → 左下实黑），直视不可辨、暗适应后隐约有暖。
- `prefers-reduced-motion` 下金雾呼吸停摆（opacity 钉 1），渐变保留（静态氛围非动效）。

## 遗留

- frontend-design 视觉复审（分类器恢复后补）。
- lint 最终轮（tsx 改动后；CSS 不经 eslint）。
