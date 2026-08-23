---
title: center-lock 与 zone
eyebrow: SCROLL OWNERSHIP
---

center-lock 是真实的滚动段，不是第二套虚拟页面坐标系。

## 输入次序

一次大输入按次序消费：先抵达锚点，再消费 zone progress，最后把剩余距离交还给原生文档流。反向重入会复用已完成的段，从 100 回到 0。

## Zone progress

onZoneProgress 无 debounce 地上报发生变化的 zone 快照，并保留精确的 0 与 1 边界。

## phase 窗口

`timeline.phase`（`{ start?, end? }`）以 0..1 比例把元素的入场窗口安放在 zone 内部。不写 `phase` 时，窗口默认取 waitFor 链算出的元素自身入场段；只要写了任一边界，窗口就重标定为整个 zone 预算，`{ start: 0, end: 0.5 }` 意即「在 zone 总滚动距离的前半段内完成入场」。解析后的窗口不会窄于 1px；且带 phase 时退场端会被重新钉住：退场终点恒锚在 zone 末端。

## phase 窗口与 waitFor 链

两者可以组合（2026-08-23 起语义闭合）：当链条 leader 带 phase 窗口，`waitFor` 跟随者以 **leader 的 phase 窗口关闭处**为起动点，预算编译器经不动点迭代联立「phase 分数引用 zone 总量、链终点反哺总量」（`phase.end < 1` 几何收敛）。历史上此处曾是双时钟分裂缺口（跟随者在 leader 14% 时起动，真机实证后修复）。纯 waitFor 链与纯 phase 窗口仍是各自最简单的编写形态。

## 大 flick 防跳过

一次本会整段跨过接管段的 wheel / 触摸增量，会被钳到 `segmentStart + 1`（正向）或 `segmentEnd - 1`（反向），至少有一帧落进段内，zone 的帧永远会被播到而不是被跳过。试图冲出当前活动段的跳跃则钳到段边界；文档流只在进度恰好 0% 或 100% 时交还给原生滚动。

