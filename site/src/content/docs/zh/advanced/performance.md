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

## 全关键帧视频编码

被 AnimateVideo 擦洗的视频必须全关键帧编码（与 README Video Scrubbing 一节同一硬约束）。关键帧稀疏时，每次 seek 都要从最近关键帧长程解码，解码线程被打满，擦洗掉帧。

```bash
ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264 out.mp4
```

dev 构建会逐源测量 seek 延迟，中位数超过 50ms 时告警一次，编码错误的视频在开发期就会自报身份。

## 并发观测

单测抓不到热路径回归。验收探针在两条路径上各连续驱动六秒（scroll 首页走 wheel、drag 页走真实指针来回拖拽），同时在页内采样 rAF 帧间隔与长任务。通过线：驱动期间 rAF 帧间隔 P95 < 25ms；超过 25ms 的帧占比 < 10%；长任务（>50ms）至多 2 个，基线为 0；console 错误与警告为 0。

rAF 间隔反映的是主线程，不是 GPU 管线。headless 探针抓的是 JS 侧回归（每帧 setState、长任务），抓不到光栅开销。

## motionValue 纪律

每帧都在变的量（progress、elapsed、offset）一律走 MotionValue；React state 只留给结构性变化。两条实测经验：

- 独立轨道写不进已被 Animate 的 style MotionValue 持有的属性（`opacity`、`x`、`y`、`scale`、`rotate`、`filter` 等）：MotionValue 绑定优先于 `controls.start()`，冲突写入会被静默忽略。改驱动 CSS 自定义属性，再用纯 CSS 映射。
- 在回调里读 progress 没问题，写进 state 才有问题。经 ref 投影，或在自定义渲染器里直接消费 `useAnimateTimeline()` 的 MotionValue。

