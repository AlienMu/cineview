---
title: 双模式引擎
eyebrow: CONCEPTS / MODES
---

`mode` 选择 drag 或 scroll，默认值为 `'drag'`。drag 在全屏场景之间切换；scroll 使用原生滚动容器，也可配置随滚动距离推进动画的锁定区。详见[选择模式](/docs/04-choosing-mode)。

## drag：分页引擎

手势期间，当前场景与相邻场景保持挂载。松手后，由速度和位移决定切换场景或返回原位。

页面位移和元素动画可以在不同时间完成，详见[页面位移与元素时间线](/docs/03-two-track)：

- 页面位移决定何时提交场景切换。
- 各 Scene 的元素按自身动画时长运行，切换完成后仍可继续入场。

### drag 配置

| prop                 | 类型                                               | 默认                    | 说明                                                 |
| -------------------- | -------------------------------------------------- | ----------------------- | ---------------------------------------------------- |
| `direction`          | `'x' \| 'y'`                                       | `'y'`                   | 拖拽方向                                             |
| `transitionDuration` | number                                             | 800                     | `ref.goToScene()` 的程序化导航时序；手势时序单独计算 |
| `threshold`          | `{ minVelocity, maxVelocity, minRatio, maxRatio }` | `0 / 1000 / 0.15 / 0.3` | 手势提交阈值，详见[手势](/docs/02-gestures)          |
| `unit`               | `'time' \| 'percent'`                              | `'time'`                | Scene 元素时间轴的拖拽映射单位                       |
| `scale`              | number                                             | time=10 / percent=1     | 每拖拽 1% 的映射量                                   |
| `firstSceneTimeout`  | number                                             | 3000                    | 首屏优先图等待上限（ms）                             |

`unit` 和 `scale` 决定拖拽距离怎么换算成元素时间轴：`unit: 'time'` 下每拖 1% 推进 10ms 入场时间轴，`unit: 'percent'` 下直接映射 1% 进度。场景级可用 `Scene.drag` 覆盖单位与比例（见 [Scene 参考](/docs/02-scene)）。

等待超过 `firstSceneTimeout` 后，框架报告 `FIRST_SCENE_TIMEOUT`，并将首场景显示为完成态。在 `onError` 中调用 `detail.preventDefault?.()` 可取消该默认处理，由应用继续处理等待。

## scroll：真实文档流与锁定区

场景通常随内容滚动。声明了锁定区且动画时长预算大于零时，场景会保持位置，由滚动距离推进内部动画。同一时刻只有一个锁定区处于活动状态。

### 锁定区与时长预算

锁定区的时长预算对应真实的滚动距离：**1ms = 1px**。`duration: { enter: 2000 }` 表示该元素在 2000px 的实际滚动过程中完成入场。反向滚动进入锁定区时，进度由 100% 连续递减至 0%。过大的单次输入会被限制在当前区段的有效范围内，因此不会跳过整个区域。完整机制详见 [center-lock 滚动](/docs/01-centerlock)。

### scroll 配置

| prop                         | 类型                    | 默认            | 说明                                |
| ---------------------------- | ----------------------- | --------------- | ----------------------------------- |
| `direction`                  | `'x' \| 'y'`            | `'y'`           | 滚动方向                            |
| `zoneTrigger`                | `'center-lock'`         | `'center-lock'` | 支持的触发方式                      |
| `sceneSizing`                | `'content' \| 'screen'` | `'content'`     | 场景尺寸策略                        |
| `enterMargin` / `exitMargin` | number                  | 50              | 可见性条件的全局默认边距（设计 px） |

`enterMargin` 和 `exitMargin` 设置可见性动画的视窗边距，单个 Animate 可通过 `visibility.enterMargin` 和 `visibility.exitMargin` 覆盖。具体判定及超高元素的规则见[可见性条件](/docs/03-visibility-conditions)。

```tsx
<CineView mode="scroll" designWidth={750} direction="y" sceneSizing="content">
  <Scene sceneId="intro">
    <article>普通滚动内容。</article>
  </Scene>
  <Scene sceneId="seq" scroll={{ zoneId: 'seq', trigger: 'center-lock' }}>
    <Animate enterAnimation="fade-in" duration={{ enter: 800 }}>
      <h1>动画片段</h1>
    </Animate>
  </Scene>
</CineView>
```
