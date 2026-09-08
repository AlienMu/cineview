---
title: 手势与阈值
eyebrow: DRAG / GESTURES
---

drag 支持指针手势和键盘导航。指针手势是否提交场景切换，由速度与位移共同决定。

## 指针与键盘输入

聚焦 CineView 容器后，竖向模式使用上下方向键，横向模式使用左右方向键，也可使用 PageUp、PageDown、Home 和 End。Scene 内的控件保留自己的按键处理。drag 不提供滚轮翻页，程序化导航使用 `ref.goToScene(index, animated?)`。

场景上的 `touch-action` 按方向预设，交出交叉轴、占用拖拽轴：

| `direction`   | `touch-action`     |
| ------------- | ------------------ |
| `'y'`（默认） | `pan-x pinch-zoom` |
| `'x'`         | `pan-y pinch-zoom` |

Scene 的触控处理保留拖拽轴，并允许另一轴上的浏览器手势。内层控件可以退出 CineView 手势处理，但这不会改变祖先元素的 CSS `touch-action` 限制。

## pointerdown 的四项检查

开始拖拽判定前，按压需满足四项条件：

1. 该场景允许开始手势（当前场景，或转场进行中时任意场景）
2. `event.isPrimary !== false`：多指触摸里的后续手指不进入
3. `event.button === 0`：右键与中键永不拖拽
4. 按下的位置不在交互元素内（见「交互元素自动豁免」）

### 交互元素自动豁免

按下的位置命中以下选择器时，手势根本不启动：

```text
a, button, input, textarea, select, option, summary,
[contenteditable="true"], [data-cineview-ignore-drag]
```

为交互区域添加 `data-cineview-ignore-drag`，可阻止它触发场景导航，适用于滑块、可拖拽画布与自定义控件。

Scene 的自定义 `onPointerDown` 与框架处理器组合执行，在其中调用 `event.preventDefault()` 可阻止框架手势。

## 方向判定：轻点与拖拽的分界

开始拖拽前，移动需满足：

```text
|主轴位移| >= 1 && |主轴位移| > |交叉轴位移|
```

小于一个像素或另一轴占优的移动不会开始拖拽。某个方向被拒绝后，本次按压会保留该结果，直到指针越过起始位置并尝试另一方向。

## 阈值：速度越快，需要的位移越少

松手时用位移比例与阈值比较。阈值随速度线性下降：

| 字段          | 默认   | 含义                     |
| ------------- | ------ | ------------------------ |
| `minVelocity` | `0`    | 速度下限（px/s）         |
| `maxVelocity` | `1000` | 速度上限（px/s）         |
| `minRatio`    | `0.15` | 达到速度上限时的位移阈值 |
| `maxRatio`    | `0.3`  | 处于速度下限时的位移阈值 |

```text
threshold(v) = maxRatio − (clamp(v) − minVelocity) / (maxVelocity − minVelocity) × (maxRatio − minRatio)
```

慢速拖拽要过 30% 屏，1000 px/s 以上的快划只要 15%。两个边界行为要知道：速度非有限值时直接返回 `maxRatio`；**把 `minVelocity` 与 `maxVelocity` 设成相等会让阈值一直是 `maxRatio`**（分母为零，走同一条兜底）。

三个内置固定常量不属于 `threshold` 配置：

- 方向反转否决速度 600 px/s：位移够了但手指在快速回甩时，提交被否决。
- 边界回弹固定 150 ms：首屏往前、末屏往后时用这个值，不随拖了多远变化；普通回弹按位移比例 × 800 计算，上限 300 ms。
- **脱离 CineView 的独立 Scene 阈值固定为 0.5**，此时 `threshold` 配置整体被忽略。

手势进度使用当前执行窗口的 `innerHeight` 或 `innerWidth` 计算。容器小于该窗口时，完成手势可能需要超过容器尺寸的移动距离。

## 拖拽距离怎么变成元素时间

`unit` 与 `scale` 决定手势位移如何换算成元素时间轴的推进量：

| `unit`           | 默认 `scale` | 换算                                      |
| ---------------- | ------------ | ----------------------------------------- |
| `'time'`（默认） | `10`         | 每拖 1% 推进 `scale` 毫秒                 |
| `'percent'`      | `1`          | 每拖 1% 推进元素时间轴的 `scale` 个百分点 |

默认配置组合 `time + 10` 的计算特征为：**拖拽完整一屏对应推进 1000 毫秒元素时间**，与场景时间轴总时长无关。若入场时间线总长为 6.5 秒，拖拽到底仅映射推进约 15%，剩余部分在释放后按实际速率播放完成。若需使手势比例与时间轴百分比直接对应，需将配置指定为 `unit: 'percent'`。

场景级 `Scene.drag` 可以覆盖，但是整组覆盖：只要写了 `unit` 或 `scale` 任一个，这一组就不再继承根配置，未写的那个回落到框架默认值而不是根的值。所以根配置 `percent + 0.5` 时，场景只写 `scale: 2` 会解析成 `time + 2`。

不支持的 `unit` 会把映射重置为 `time` 及其默认 scale。不支持的 `scale` 保留 unit，只恢复比例的默认值。两种情况都报告 `INVALID_DRAG_CONFIG`。

## drag.enabled 判的是目标场景

`Scene.drag.enabled` 默认为 `true`，对目标 Scene 生效。

在场景 3 上设置 `enabled: false` 后，相邻场景无法通过拖拽进入它；离开场景 3 及程序化导航仍可使用。每次按压中，每个尝试方向最多触发一次 `onDragBlocked`。

## 相关页面

- [drag 布局契约](/docs/01-layout)：默认尺寸与引擎内置固定样式
- [拖拽的开始与继续](/docs/04-ownership)：手势开始与中途继续
- [drag 回调时序](/docs/05-callbacks)：手势会发出哪些回调、在什么时刻
- [CineView 参考](/docs/01-cineview)：drag 模式全表
