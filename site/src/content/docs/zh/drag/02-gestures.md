---
title: 手势与阈值
eyebrow: DRAG / GESTURES
---

drag 的输入只有指针：没有滚轮，没有键盘。一次手势要通过四项检查才算拖拽，松手后由速度与位移共同决定提交还是回弹。本页列出全部判定条件的真实数值。

## 只认指针

框架不监听 wheel，也不监听 keydown。桌面端滚轮翻页不工作，键盘翻页也不工作；程序化导航只有 `ref.goToScene(index, animated?)` 一条路。

场景上的 `touch-action` 按方向写死，交出交叉轴、占用拖拽轴：

| `direction`   | `touch-action`     |
| ------------- | ------------------ |
| `'y'`（默认） | `pan-x pinch-zoom` |
| `'x'`         | `pan-y pinch-zoom` |

代价是**拖拽轴上的原生滚动在 drag 模式下不可用**。场景内需要同轴滚动的子区域，得靠「交互元素自动豁免」里的机制让出手势。

## pointerdown 的四项检查

四条全过才建立候选：

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

`data-cineview-ignore-drag` 是作者可用的退出机制：自定义滑块、可拖拽画布、需要同轴滚动的子区域，加这个属性即可让整个子树不触发翻页。

还有第二种退出机制：作者自己的 `onPointerDown` 与框架的处理器是组合关系而非替换，在你的处理器里调 `event.preventDefault()` 会让框架整体跳过这次手势。

## 方向判定：轻点与拖拽的分界

未取得所有权时，每次 move 都要满足：

```text
|主轴位移| >= 1 && |主轴位移| > |交叉轴位移|
```

亚像素移动和交叉轴占优的划动都算轻点，不是拖拽。所以纯横向划过一个竖向 drag 页面，永远不会接管手势。同一次按压里被拒过的方向会被锁定，直到手指越过原点才会预检反方向。

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

三个写死的数值不属于 `threshold` 配置：

- 方向反转否决速度 600 px/s：位移够了但手指在快速回甩时，提交被否决。
- 边界回弹 150 ms：首屏往前、末屏往后时的回弹时长，与普通回弹（位移比例 × 800，上限 300ms）不一致。
- **脱离 CineView 的独立 Scene 阈值固定为 0.5**，此时 `threshold` 配置整体被忽略。

进度的分母是 `window.innerHeight` / `window.innerWidth`，不是容器尺寸。嵌在 iframe、分栏或非满高父级里的 CineView，进度映射会失真：要走满进度 1 需要一整个窗口高度的位移。

## 拖拽距离怎么变成元素时间

`unit` 与 `scale` 决定手势位移如何换算成元素时间轴的推进量：

| `unit`           | 默认 `scale` | 换算                                      |
| ---------------- | ------------ | ----------------------------------------- |
| `'time'`（默认） | `10`         | 每拖 1% 推进 `scale` 毫秒                 |
| `'percent'`      | `1`          | 每拖 1% 推进元素时间轴的 `scale` 个百分点 |

默认组合 `time + 10` 有一个必须知道的后果：**拖满一整屏只推进 1000 毫秒元素时间**，与该场景时间轴总长无关。一个 6.5 秒的入场时间线，拖到底也只 scrub 了约 15%，其余在松手后按真实速率补完。想要「拖一半等于时间轴一半」，必须改用 `unit: 'percent'`。

场景级 `Scene.drag` 可以覆盖，但是整组覆盖：只要写了 `unit` 或 `scale` 任一个，这一组就不再继承根配置，未写的那个回落到框架默认值而不是根的值。所以根配置 `percent + 0.5` 时，场景只写 `scale: 2` 会解析成 `time + 2`。

非法值的回退不对称：非法 `unit` 会把 scale 一并重置为 `time` 的默认值（即使你写的是 percent）；非法 `scale` 保留 unit 只重置 scale。两者都上报 `INVALID_DRAG_CONFIG`。

## drag.enabled 判的是目标场景

`Scene.drag.enabled` 默认 `true`。它在取得所有权时读的是目标场景的值，不是手指所在的场景。

所以把 `enabled: false` 写在场景 3 上，不是「不能从场景 3 拖走」，而是场景 3 从场景 2 和场景 4 都到不了。被拦下时每次按压每个方向最多上报一次 `onDragBlocked`。程序化导航不受此限制。

## 相关页面

- [drag 布局契约](/docs/01-layout)：默认尺寸与写死的样式
- [所有权与事务](/docs/04-ownership)：候选、所有权、re-grab
- [drag 回调时序](/docs/05-callbacks)：手势会发出哪些回调、在什么时刻
- [CineView 参考](/docs/01-cineview)：drag 模式全表
