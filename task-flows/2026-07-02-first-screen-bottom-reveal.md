# 2026-07-02 首屏底部元素进场缺失（hero__scroll-hint）

## 现象

官网首页 `hero__scroll-hint`（下滑提示）在首屏不展示。使用方 `HeroScene.tsx` 把它钉在
`<Position at={{ anchor: 'center-x', y: 840 }}>`（设计基准高 900），即首屏底部。

## 根因（框架 bug，非使用方）

`useAnimateScroll.ts` 的 visibility gate 进场闸门（常规元素）要求：
`relTop >= 0 && relBottom <= vh - enterMargin`（enterMargin 默认 50）。

底部 `enterMargin` 是为**从视窗底部滚动进入**的元素设计的余量（别太早触发）。但对
**首屏初次揭示**——尚无任何滚动——一个被作者钉在首屏底部的元素（正是"下滑提示"），
其 `relBottom ≈ 840·scaleY + 文字高`，要满足 `relBottom <= vh - 50` 需 `scaleY` 偏大
（视口高需 > ~1050px）。普通屏幕上闸门永不满足 → 首屏永不进场，且无滚动可触发后续测量。

`runVisibilityUpdate` 的首次测量分支（`!initializedRef.current`）此前只处理了
"元素已滚过视窗顶部 → 直接落终态"，未处理"首屏初次揭示时元素完整落在视窗内"。

## 修复

在首次测量分支补一条：**仅 scene 0**（`firstSceneEnterReady === true`）、元素首次测量若
**完整落在视窗内**（`relTop >= 0 && relBottom <= vh`，不减 enterMargin），播一次正常进场
（`runEnterTween`，天然沿用 waitFor 链的 delay）。只影响首屏冷启动初帧，不改后续滚动语义。

**为何限 scene 0**：初版未限 scope，广撒到所有 visibility Animate 的首帧，破坏了
`enterMargin` override 测试——那证明「显式 margin 是作者意图，首帧也须遵守」。非首屏 scene 的
`firstSceneEnterReady` 为 `undefined`，保持严格 scroll-in margin；`firstSceneEnterReady===false`
冷启动 hold 早于本分支返回，assets 就绪后首帧才触发本分支。两者天然组合。

## 节点

- [x] 读 useAnimateScroll gate 语义 + design.md L154-158 + phase 测试骨架
- [x] 核实 firstSceneEnterReady 在 scroll 模式下 plumb 到 scene 0
- [x] 写失败测试（首屏底部元素 rect(900,990)/vh1000，pre-fix 停 0）— 已见红
- [x] 实施修复（首次测量分支补 scene-0 within-viewport 进场）
- [x] pnpm test 全绿（1161/1161, 80 suites）+ 改动文件 type-check 0 错误
      注：type-check 全仓有 5 错，全在未跟踪 WIP 文件 Animate.stagger.test.tsx（重复
      Listener/makeStub，行 17/158），与本次改动无关
- [ ] 独立 agent 浏览器实测 localhost:3000（首屏 hint 出现，滚动语义无回归）
