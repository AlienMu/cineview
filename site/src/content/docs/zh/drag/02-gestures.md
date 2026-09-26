---
title: 手势与阈值
eyebrow: DRAG / GESTURES
---

drag 支持指针手势和键盘导航。指针手势是否提交场景切换，由速度与位移共同决定。

## 阈值：速度越快，需要的位移越少

释放时的速度越快，完成切换所需的拖拽距离越短。这里使用速度（px/s），没有单独计算加速度（px/s²）。先加速再停住，释放时仍按低速判定。

默认情况下，停住后松手需要超过 30% 视窗长度；以 500px/s 释放需要超过 22.5%；达到 1000px/s 时需要超过 15%。恰好达到阈值仍会还原。

这只决定是否切换场景。拖拽怎样推进元素时间由 `unit` 与 `scale` 决定，释放速度不会另外给元素时间线添加加速过程。

阈值随速度线性下降：

| 字段          | 默认   | 含义                     |
| ------------- | ------ | ------------------------ |
| `minVelocity` | `0`    | 速度下限（px/s）         |
| `maxVelocity` | `1000` | 速度上限（px/s）         |
| `minRatio`    | `0.15` | 达到速度上限时的位移阈值 |
| `maxRatio`    | `0.3`  | 处于速度下限时的位移阈值 |

```text
threshold(v) = maxRatio − (clamp(v) − minVelocity) / (maxVelocity − minVelocity) × (maxRatio − minRatio)
```

默认配置下，慢速拖拽需要超过 30% 屏，达到 1000 px/s 的快划需要超过 15%。速度为非有限值时，阈值取 `maxRatio`。**`minVelocity` 与 `maxVelocity` 相等时，阈值固定为 `maxRatio`。**

以下行为不受 `threshold` 配置影响：

- 手指以超过 600 px/s 的速度反向移动时，即使位移足够，松手仍会取消切换。
- 首屏向后、末屏向前拖拽时，回弹耗时 150 ms。普通回弹按位移比例 × 800 ms 计算，上限为 300 ms。
- 脱离 Cineview 的独立 Scene 使用固定阈值 0.5。

手势进度按 `window.innerHeight` 或 `window.innerWidth` 计算。容器小于窗口时，拖动距离达到容器尺寸也可能尚未达到切换阈值。

## 让控件独立处理拖动

在自定义控件的交互区域加上 `data-cineview-ignore-drag`，该区域的指针事件就不会启动场景切换。以下卡片可在纵向拖动切换的 Scene 内横向移动：

```tsx
import { useRef, type PointerEvent } from 'react';
import { Cineview, Scene } from 'cineview';

export default function App() {
  const card = useRef<HTMLDivElement>(null);
  const x = useRef(0);
  const start = useRef<{ pointerX: number; x: number } | null>(null);

  function begin(event: PointerEvent<HTMLDivElement>) {
    start.current = { pointerX: event.clientX, x: x.current };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!start.current || !card.current) return;
    x.current = Math.max(
      -120,
      Math.min(120, start.current.x + event.clientX - start.current.pointerX)
    );
    card.current.style.transform = `translateX(${x.current}px)`;
  }

  function end() {
    start.current = null;
  }

  return (
    <Cineview mode="drag" direction="y" designWidth={750}>
      <Scene sceneId="controls">
        <div
          data-cineview-ignore-drag
          onPointerDown={begin}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          style={{ touchAction: 'none', padding: 80 }}
        >
          <div ref={card} style={{ width: 160, padding: 24, background: '#e8edf0' }}>
            横向拖动卡片
          </div>
        </div>
      </Scene>
      <Scene sceneId="next">
        <h2>下一个场景</h2>
      </Scene>
    </Cineview>
  );
}
```

该标记让 Cineview 忽略区域内的按压。`touchAction: 'none'` 让控件接收触屏指针移动；祖先元素的 `touch-action` 可能限制手势。拖动区域外的内容仍可切换场景。`<input type="range">` 等原生输入控件会自动避开场景拖动。

## 指针与键盘输入

聚焦 Cineview 容器后，竖向模式使用上下方向键，横向模式使用左右方向键，也可使用 PageUp、PageDown、Home 和 End。Scene 内的控件保留自己的按键处理。drag 不提供滚轮翻页，程序化导航使用 `ref.goToScene(index, animated?)`。

Scene 的 `touch-action` 随 `direction` 设置，允许另一轴上的原生手势与双指缩放：

| `direction`   | `touch-action`     |
| ------------- | ------------------ |
| `'y'`（默认） | `pan-x pinch-zoom` |
| `'x'`         | `pan-y pinch-zoom` |

内层控件可以退出 Cineview 手势处理，但这不会改变祖先元素的 CSS `touch-action` 限制。

## pointerdown 的四项检查

开始拖拽判定前，按压需满足四项条件：

1. 该场景允许开始手势（当前场景，或转场进行中时任意场景）
2. `event.isPrimary !== false`：多指触摸里的后续手指不进入
3. `event.button === 0`：右键与中键永不拖拽
4. 按下的位置不在交互元素内（见「交互元素自动豁免」）

### 交互元素自动豁免

按下的位置命中以下选择器时，手势不启动：

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

小于一个像素或另一轴占优的移动不会开始拖拽。某个方向被拒绝后，同一次按压不会再次尝试该方向。指针越过起始位置、改向另一侧移动时，会重新判定。

## 拖拽距离怎么变成元素时间

`unit` 与 `scale` 决定手势位移如何换算成元素时间轴的推进量：

| `unit`           | 默认 `scale` | 换算                                      |
| ---------------- | ------------ | ----------------------------------------- |
| `'time'`（默认） | `10`         | 每拖 1% 推进 `scale` 毫秒                 |
| `'percent'`      | `1`          | 每拖 1% 推进元素时间轴的 `scale` 个百分点 |

默认 `time + 10` 下，拖动一整屏推进 1000 ms 元素时间。6.5 秒的入场时间线因此推进约 15%，提交切换后继续播放剩余部分。使用 `unit: 'percent'`、`scale: 1` 时，拖动 50% 对应时间线的 50%。

`Scene.drag` 中的 `unit` 与 `scale` 成组配置。写了其中一个，未写的另一个取框架默认值。例如根配置为 `percent + 0.5`，场景仅写 `scale: 2` 时，实际使用 `time + 2`。

不支持的 `unit` 会把映射重置为 `time` 及其默认 scale。不支持的 `scale` 保留 unit，只恢复比例的默认值。两种情况都报告 `INVALID_DRAG_CONFIG`。

## drag.enabled 控制能否拖入目标场景

`Scene.drag.enabled` 默认为 `true`，对目标 Scene 生效。

在场景 3 上设置 `enabled: false` 后，相邻场景无法通过拖拽进入它；离开场景 3 及程序化导航仍可使用。每次按压中，每个尝试方向最多触发一次 `onDragBlocked`。

## 相关页面

- [drag 场景布局](/docs/01-layout)：默认尺寸与容器样式
- [拖拽的开始与继续](/docs/04-ownership)：手势开始与中途继续
- [drag 回调时序](/docs/05-callbacks)：手势会发出哪些回调、在什么时刻
- [Cineview 参考](/docs/01-cineview)：drag 模式全表
