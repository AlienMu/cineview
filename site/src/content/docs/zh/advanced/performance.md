---
title: 性能
eyebrow: FRAME BUDGET
---

让每帧的工作留在 MotionValue 上，把布局读取挡在连续滚动帧之外。

## 书写清单

编排型变换用 Animate；自定义渲染器用 useAnimateTimeline；不要在 progress 回调里测量布局；发布前对多元素并发场景做性能剖析。

## 验证命令

仓库对覆盖率、类型安全、重复度、包消费方式、构建体积与浏览器性能预算设置了门禁。

```bash
pnpm verify
pnpm --dir site type-check
pnpm --dir site build
pnpm --dir examples/performance-test test
```
