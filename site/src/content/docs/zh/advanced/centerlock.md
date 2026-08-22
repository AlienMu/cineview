---
title: center-lock 与 zone
eyebrow: SCROLL OWNERSHIP
---

center-lock 是真实的滚动段，不是第二套虚拟页面坐标系。

## 输入次序

一次大输入按次序消费：先抵达锚点，再消费 zone progress，最后把剩余距离交还给原生文档流。反向重入会复用已完成的段，从 100 回到 0。

## Zone progress

onZoneProgress 无 debounce 地上报发生变化的 zone 快照，并保留精确的 0 与 1 边界。
