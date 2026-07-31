# 2026-07-26 — D-F1 P0: settle 期「急抓」手势失效 / 元素冻结 / snap 链修复

## 失败链（评审确认，代码回读复核成立）

释放 settle（render lane 在飞）期间再次 pointerdown：

1. `handleDragStart` flush 分支同步 commit → currentScene 切换，旧 scene `isActive=false`。
2. pointer capture 钉在旧 scene 元素；Scene JSX 按 `isActive` 摘掉 pointer handlers →
   后续 move/up 无人处理（React 侧），gesture 死亡。
3. `globalIsDragging=true` → H2 preempt 停掉新 active scene 的 settle 补完动画，
   offset=0 非 incoming → 无人接管 → 元素冻结半入场。
4. window pointerup 持旧闭包完整跑 `handlePanEnd`（stale enabled/isActive/currentSceneIndex），
   dragProgressMotion 已同步为 0 → tiny-progress → `onDragReset` → `resetDragInteraction`
   清 dragRelease + join refs → `useAnimateDrag` settlePending → rest → 冻结元素瞬间 snap 终态。
   （注：同样的 tap-snap 在 commit **后**的再抓取也存在——步骤 3/4 不依赖 flush-commit。）

## 方案（方向 B + 全局 render-lane 槽位）

- 手势一旦被 active scene 的 engine 接受（pointerdown），**归该 engine 所有直到结束**
  （`ownsGestureRef`），不再以 `isActive` 快照做 move/end 门控；native 层回调走 ref 取最新闭包。
- render-lane 动画（settle 页面滑动 / bounce）收敛到 CineView 级**单一共享槽位**
  `DragRenderLane`（settle 带 flush=立即 commit）——任何 engine 的 handleDragStart 都能
  flush/stop 在飞 lane，消除「pendingRelease 落在旧 engine、下一次急抓在新 engine」的递归洞。
  standalone Scene 回退 engine 本地槽位。
- `resolveDragProgress` 边界判定改用 `currentSceneIndex`（commit 后继续的手势要按新 active
  场景判界），去掉 isActive 门控（调用方已按 ownership 门控）。
- `resetDragInteraction`：settle join 未闭合（`expectedSettleRef`）时保留 dragRelease + join refs，
  只清手势标量——tap 不再丢 release / 不再腐化 join。
- `useElementTrack` 新增 orphaned-settle resume effect：手势结束（isDragging→false）且
  settle 指令仍指向本 scene、track 被 preempt 停在半程且无人在驱动 → 从冻结点续跑到 T
  （无人接管则恢复补完；被新指令 supersede 则不恢复——避免旧 completion 污染新 join）。
- `useAnimateDrag`：active+isDragging 但 renderProgress≤ε 且 enter 在飞（settle/cold-start/
  programmatic）时维持 'enter' 读冻结 track，不闪跳 outgoing(=终态)；一旦真实位移交给 outgoing。

## 节点

- [x] 回读当前代码，确认失败链与行号漂移（全部成立；flush 分支的 `renderControls?.flush` 在
      framer animate() 返回值上确不存在，走 `pendingRelease.commit()` 同步 commit）
- [x] Scene/types.ts：`DragRenderLane` + `dragRuntime.renderLane`
- [x] useNativePointerDrag：回调 ref 化 + enabled 仅门控手势起点
- [x] useDragSceneEngine：共享 lane 槽位 + gesture ownership + tiny 分支 isActive 守卫
- [x] Scene.tsx：resolveDragProgress 重写 + drag 模式常绑 pointer/pan handlers + 透传 renderLane
- [x] useSceneManager：resetDragInteraction 保留未闭合 settle join
- [x] useElementTrack：orphaned-settle resume
- [x] useAnimateDrag：hold 期 enter 保持
- [x] CineView/DragSceneStack：创建并下发 renderLaneRef
- [x] 更新 useDragSceneEngine.branches.test（framer flush 建模已过时）
- [x] 新增 jsdom 回归测试（急抓续拖 / 急抓 tap / 急抓反向拖回），git stash 法验红
- [x] 全量 test + type-check + lint 绿；收口自检（冗余/热路径/唯一所有者）

## 验证

- 红证：工作树含其他任务的未提交改动，git stash 会连带回滚 → 改用「备份修复版 →
  精确逆向补丁还原 6 个行为文件的修复前逻辑 → 跑新测试」：3/3 失败，失败点即失败链断点
  （move 后页面 transform 停在 0%（手势死亡）/ tap 后无 resume 元素轨 animate（冻结+丢 release）
  / 反向拖回无效）。随后从备份恢复修复版，3/3 转绿。
- 修复后：全仓 92 suites / 1287 tests 全绿（基线 91/1282；+3 回归 +1 manager 保留语义
  +1 engine 共享槽位跨引擎净增）；type-check 0 错误；lint 0 错误 0 警告。
- 既有测试语义更新（非“改绿”）：
  - `useSceneManager.test` “reset 清 dragRelease”改为 bounce 场景（settle join 未闭合时保留是新语义），
    新增 D-F1 保留用例；
  - `useElementTrack` 双触发 onSettleComplete 由 `settleCompletedTokenRef` 防重（resume 不重复补完）；
  - `useDragSceneEngine.branches.test` 删除对 framer 不存在的 controls.flush 的建模
    （生产死路径），新增共享 lane 槽位跨引擎 flush + owner-only unmount 清理两用例。
- 待真机（浏览器 lane 验收，无法用 jsdom 覆盖）：
  1) 急抓 hold 期视觉连续性：冻结帧（enter 保持）→ 首次位移交接 outgoing 的观感；
  2) resume 补完速率是否自然（linear 余量补完）；
  3) 真实 pointer capture 下 move 事件持续钉在旧 scene 元素（jsdom 无 capture 重定向，
     测试是手动向旧元素派发模拟的）；
  4) 连续多次急抓（递归场景，共享槽位路径）无页面跳变/双写抖动。
