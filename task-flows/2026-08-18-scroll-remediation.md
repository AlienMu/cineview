# 2026-08-18 Scroll Review Remediation

## Scope

修复独立代码对抗复审发现的 `BackgroundRibbon` 过期滚动跨度、`ScrollbarOverlay` 活跃拖拽旧几何，以及 scroll 动画/同步热路径风险。媒体文件不在本子任务范围内。

## 节点

- [x] 1. 读取规格、审查报告和当前 task-flow
- [x] 2. 先写失败回归测试并确认反例
- [x] 3. 实施最小生产修复
- [x] 4. 定向测试与静态自检
- [x] 5. 回读代码并记录未覆盖风险

## 证据

节点 2（红测，2026-08-18）：

- `pnpm test -- --runInBand src/__tests__/site/backgroundRibbon.test.tsx src/components/CineView/ScrollbarOverlay.test.tsx src/components/Animate/useAnimateScroll.hotpath.test.tsx`
- 结果：3 suites / 3 tests failed，分别复现 overflow-only `scrollHeight` 增长后 LUT 仍用旧分母、内容收缩后旧 pointermove 仍调用旧回调、无 infiniteAnimation 的 scroll hook 在 endpoint 触发额外 React render。
- 回读：失败均对应代码复审中的可执行反例；未修改媒体文件。

节点 3（实现，2026-08-18）：

- `site/src/components/BackgroundRibbon.tsx`：每次 scroll 投影前刷新 `scrollHeight - clientHeight`；same-container MutationObserver 回调也重新投影。
- `src/components/CineView/ScrollbarOverlay.tsx`：direction/span/rail/thumb/callback 几何依赖变化时清理活动 pointer 会话。
- `src/components/Animate/useAnimateScroll.ts` + `src/components/Animate/Animate.tsx`：仅在存在已解析 infinite variant 时建立 infinite gate 的 zone subscription；visual scrub subscription 保持唯一连续值写者。
- `src/components/CineView/useNativeScrollController.ts`：在 frame-store/fixed-layer 写入前读取 native content extent，消除写后读布局顺序。
- 未触碰 `src/media/*`。

节点 4（部分验证，待 lint 重跑）：

- 定向 scroll/animate/site 测试：6 suites / 253 tests passed。
- `pnpm type-check:framework`：passed。
- 首次 lint 命令错误地把 `--quiet` 作为文件模式传给脚本，需改用 `pnpm lint` 重跑。

节点 4 收口（主线程复验，2026-08-18）：

- `pnpm test -- --runInBand src/__tests__/site/backgroundRibbon.test.tsx src/components/CineView/ScrollbarOverlay.test.tsx src/components/Animate/useAnimateScroll.hotpath.test.tsx`：3 suites / 14 tests **PASS**。
- `pnpm lint`：**PASS**（exit 0）。
- `git diff --check`：**PASS**。

节点 5 回读与自检（主线程）：

- `BackgroundRibbon` 在每个 scroll 投影前重新读取 `scrollHeight/clientHeight`，并在同容器 MutationObserver 回调中重算；不再依赖只观察容器 box 的 ResizeObserver 作为唯一分母来源。
- `ScrollbarOverlay` 的 pointer 会话由 ref 唯一持有，direction/span/rail/thumb/callback 几何改变时立即清理；后续 pointermove 不再调用旧几何闭包。offset store 只直接写 thumb/ARIA，不把每帧变化送进 React。
- `useAnimateScroll` 的连续 zone 状态只通过 keyed store -> MotionValue -> visual scrub 链路消费；无 `infiniteAnimation` 时不建立第二条 endpoint gate subscription，避免重复每帧消费者。
- `useNativeScrollController` 在 frame-store/fixed-layer 写入前读取 native extent，避免同一热路径同步写后读布局。
- 未覆盖风险：真实浏览器中的内容异步增高、活动 scrollbar 拖拽中 resize、键盘/原生 scrollbar 混合输入及多动画并发仍需独立 browser lane；本子任务不宣称浏览器 PASS。

### 子 Agent 复核补充（2026-08-18）

- `pnpm test:site-contracts`：10 suites / 53 tests passed。
- Animate 全套：22 suites / 297 tests passed。
- 全量 `pnpm exec jest --runInBand`：120 suites / 1581 tests passed。
- `pnpm type-check:framework`、`pnpm type-check:site`、`pnpm lint`、相关文件 `pnpm exec prettier --check`：均 passed。
- 代码回读确认 `BackgroundRibbon` 已删除跨事件 `maxScroll` 缓存；native scroll extent 与 viewport 在 frame-store/fixed-layer 写入前读取；没有新增每帧 React state 或第二个 progress 写者。
- 首次全量命令 `pnpm test -- --runInBand` 因脚本参数转发把 `--runInBand` 当成 Jest pattern 而报 No tests found；随后使用等价直接命令 `pnpm exec jest --runInBand` 得到上述完整结果。
