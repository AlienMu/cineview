---
title: 回调与错误处理
eyebrow: OBSERVABILITY
---

回调按语义时机分组：实时采样、边界、生命周期与错误。

## 边界回调

onReady 对每个挂载的根只触发一次。onSceneWillChange 在有效切换发生前触发。onSceneDidChange 在 render commit 时触发。同一次手势中 onDragCommit 与 onDragCancel 互斥。

## 实时回调

onDragProgress 与 onZoneProgress 在所有者边界处采样，无尾随 debounce，保留终值。

## onZoneProgress 的正确读数

onZoneProgress 在 zone 有移动的每一帧都会上报——绝不把它镜像进 state。并发滚动下扛得住的模式：回调身份保持稳定（空依赖）、过滤到你关心的 zone、再经 ref 把数值投影进 DOM。

```tsx
const readoutRef = useRef<ZoneReadoutHandle>(null);

const handleZoneProgress = useCallback((detail: ZoneProgressDetail): void => {
  if (detail.zoneId !== 'demo-scroll-zone') return;
  readoutRef.current?.project(detail.progress);
}, []);
```

`project` 直接写 `style.transform` 与 `textContent`——每帧零重渲染；React 只渲染一次读数外壳。Demo 页的 ZoneReadout 就是这一模式的活例。

## 错误上报与 dev 告警

onError 收到带类型的 `code`（`CineViewErrorCode` 联合）、message 与 `context` 对象；可恢复的错误额外带 `preventDefault()`。同样的条件在非生产构建下还会向 console 打出 `[CineView]` 前缀的诊断——console 行是回调在开发期的镜像，不是第二个可供解析的通道。生产产物会整体丢弃 console 输出，所以程序化处理一律走 `onError`。

