---
title: drag 回调时序
eyebrow: DRAG / CALLBACKS
---

drag 回调用于观察已接受的手势和已提交的场景切换。指针手势与 ref 导航的通知时机不同，参数定义见[回调](/docs/03-callbacks)。

## 手势提交时的场景切换回调

```text
onSceneEnter ──┐
                    ├── 同一批次，页面位移到达目标的那一刻
onSceneLeave ───┘
```

手势路径中，页面位移提交切换时，`onSceneEnter` 与 `onSceneLeave` 在同一个同步批次执行。它们不提供手势切换前的通知。

新 Scene 的元素此时可能仍在入场，页面位移和元素动画可以按任意顺序完成。`onDragEnd` 报告提交时目标的 `elapsedMs` 与 `timelineDurationMs`，并不会持续更新动画完成情况。

## onDragProgress 在回弹时发，在提交后不发

| 松手结果         | 是否继续收到 `onDragProgress`       |
| ---------------- | ----------------------------------- |
| 回弹（未过阈值） | 会，回弹补间期间持续上报递减的进度  |
| 提交（过阈值）   | 不会，release 之后直接静默到 commit |

所以一次被取消的拖拽会留下一串下降的进度事件，而一次成功的拖拽在松手瞬间就不再上报。按 `onDragProgress` 画进度条的话，提交路径上它会停在松手时的值。

## re-grab 不发 onDragStart

转场进行中时用户再次按下并拖动（原地接管那次位移），不会发 `onDragStart`：拖拽会话在提交或复位前一直处于活跃状态，而 `onDragStart` 只在「此前没有活跃会话」时才发。

`onDragStart` 统计拖拽会话，同一会话中恢复移动不会再次触发开始事件。

## pointercancel 永不提交

`pointercancel`（例如来电、浏览器手势中断或通知栏下拉）会强制走回弹，无论位移与速度，然后以 `onDragCancel` 收口。

用户取消和浏览器中断都报告 `onDragCancel`，参数中没有单独的中断原因。

## 程序化导航会发 onDragEnd

`ref.goToScene(index)` 在真正切换之前会先发一次 `onDragEnd`，参数是 `progress: 1`、`elapsedMs: 0`、`timelineDurationMs: 0`。

埋点需要区分程序化导航与手势时，在应用中记录 ref 调用。`elapsedMs` 为零不能作为可靠的来源判据，手势也可能进入没有元素时长的 Scene。

`goToScene(index, false)` 直接将目标显示为入场完成态，不播放入场顺序。需要播放入场时，使用默认的 `animated: true`。

## 一次会话恰好一个终止回调

已接受的拖拽会话报告一个终止结果：提交切换时为 `onDragEnd`，返回原位时为 `onDragCancel`。

```text
onDragStart → onDragProgress* → onDragEnd 或 onDragCancel
```

在首个 Scene 尝试返回更早场景，或在最后一个 Scene 尝试继续前进时，会执行边界返回，报告的进度为零。

首次尝试就被拒绝的按压尚未开始拖拽会话，可以只报告 `onDragBlocked` 而不再报告取消。动画未准备好时，仅有开发环境诊断，没有公共拖拽回调。

## onReady 提供 API

`onReady` 在挂载后提供 ref API，不等待资源。队列请求的完成情况使用 `onLoadProgress`（整数 0–100），资源失败另行处理。该比例包含失败请求，不表示场景已可拖拽。

## 相关页面

- [回调总览](/docs/03-callbacks)：全部回调的参数形状与错误码
- [拖拽的开始与继续](/docs/04-ownership)：手势开始与中途继续
- [页面位移与元素时间线](/docs/03-two-track)：为什么 commit 与元素补完是两件事
- [性能](/docs/01-performance)：每帧回调的消费纪律
