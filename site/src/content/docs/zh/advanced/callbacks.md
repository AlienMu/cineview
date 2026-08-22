---
title: 回调与错误处理
eyebrow: OBSERVABILITY
---

回调按语义时机分组：实时采样、边界、生命周期与错误。

## 边界回调

onReady 对每个挂载的根只触发一次。onSceneWillChange 在有效切换发生前触发。onSceneDidChange 在 render commit 时触发。同一次手势中 onDragCommit 与 onDragCancel 互斥。

## 实时回调

onDragProgress 与 onZoneProgress 在所有者边界处采样，无尾随 debounce，保留终值。
