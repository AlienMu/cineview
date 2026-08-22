---
title: 冷启动与预加载
eyebrow: COLD START
---

首场景由优先媒体的完成情况门控；后台场景继续加载，不阻塞页面。

## 预加载契约

优先级完成只触发一次。后台加载由共享媒体缓存去重。Ref.preload 可在之后补充指定 scene 或 zone 的资源。
