---
title: drag 回调时序
eyebrow: DRAG / CALLBACKS
---

drag 模式下的回调时序与常规生命周期钩子存在差异。本文说明回调的触发时机与频率，参数结构参考 [回调总览](/docs/03-callbacks)。

## 切场景回调发在转场结束，不是开始

```text
onSceneEnter ──┐
                    ├── 同一批次，页面位移到达目标的那一刻
onSceneLeave ───┘
```

页面位移到达目标即视为切换完成，两个回调在同一个同步批次里背靠背发出。手势路径下不存在「将要切换」的提前量：没有一个时刻可以用来做「切换前的准备」。

需要注意的是：**`onSceneLeave` 发出时，进场场景内的元素仍在执行入场动画**。释放指针后，页面位移与元素时间轴并行推进：位移按转场补间执行，元素依各自时间线播放，两者完成时机相互解耦。因此该回调不代表元素动画全部就绪；若需等待元素时间线播放完毕，可结合 `onDragEnd` 提供的 `elapsedMs` 与 `timelineDurationMs` 进行判定。

## onDragProgress 在回弹时发，在提交后不发

| 松手结果         | 是否继续收到 `onDragProgress`       |
| ---------------- | ----------------------------------- |
| 回弹（未过阈值） | 会，回弹补间期间持续上报递减的进度  |
| 提交（过阈值）   | 不会，release 之后直接静默到 commit |

所以一次被取消的拖拽会留下一串下降的进度事件，而一次成功的拖拽在松手瞬间就不再上报。按 `onDragProgress` 画进度条的话，提交路径上它会停在松手时的值。

## re-grab 不发 onDragStart

转场进行中时用户再次按下并拖动（原地接管那次位移），不会发 `onDragStart`：拖拽会话在提交或复位前一直处于活跃状态，而 `onDragStart` 只在「此前没有活跃会话」时才发。

用户视角是一次明确的新手势，消费者收不到通知。埋点若按 `onDragStart` 计数手势次数，会漏掉全部 re-grab。

## pointercancel 永不提交

`pointercancel`（例如来电、浏览器手势中断或通知栏下拉）会强制走回弹，无论位移与速度，然后以 `onDragCancel` 收口。

代价是：**公共回调无法区分「用户主动取消」与「系统中断」**，两者都只到达 `onDragCancel`。

## 程序化导航会发 onDragEnd

`ref.goToScene(index)` 在真正切换之前会先发一次 `onDragEnd`，参数是 `progress: 1`、`elapsedMs: 0`、`timelineDurationMs: 0`。

根据规格设计，drag 模式下的所有场景切换提交（包括手势滑动与 ref 调用）均通过 `onDragEnd` 派发。若以 `onDragEnd` 统计用户滑动行为，需注意 ref 导航也会包含在内。可通过检查 `elapsedMs` 是否为 0 或在业务层设置标记来区分两者。

另外 `goToScene(index, false)`（`animated: false`）**跳过整条入场时间轴**：不发布续跑指令，目标场景直接停在完成态，各元素的 delay 调度均被跳过。要使目标场景完整播放入场动画，建议使用默认的 `animated: true`。

## 一次会话恰好一个终止回调

这条是可以直接依赖的不变量：

```text
onDragStart → onDragProgress* → 恰好一个 onDragEnd 或 onDragCancel
```

一旦 `onDragStart` 发出，这个指针会话始终以恰好一次 commit 或 cancel 收口，不会两个都发、也不会都不发。边界回弹（首屏往前、末屏往后）进度始终是 0，未提交时同样按统一兜底发 `onDragCancel`。

`onDragBlocked` 不是终止回调：它在业务侧的准入条件拒绝这次拖拽时发，每次按压每个方向最多一次，之后该次按压仍会以 cancel 收口。内部就绪度不足导致的拒绝只有开发环境诊断，不发公共回调。

## onReady 与资源无关

`onReady` 是挂载即发的 API 交接，不等任何资源加载。用它关掉 loading 遮罩会过早。要等资源，看 `onLoadProgress` 到 100（注意是整数 0 到 100，不是 0 到 1）。

## 相关页面

- [回调总览](/docs/03-callbacks)：全部回调的参数形状与错误码
- [所有权与事务](/docs/04-ownership)：候选、所有权、re-grab 的完整语义
- [页面位移与元素时间线](/docs/03-two-track)：为什么 commit 与元素补完是两件事
- [性能](/docs/01-performance)：每帧回调的消费纪律
