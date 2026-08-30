---
title: 双模式引擎
eyebrow: CONCEPTS / MODES
---

CineView 有两套引擎。`drag` 是全屏分页引擎，一次手势翻一个场景。`scroll` 落在真实文档流上，原生滚动照常工作，只有声明了 `Scene.scroll` 的 zone 才被接管。`mode` 默认 `'drag'`。不确定选哪个，先看[选择模式](/docs/04-choosing-mode)。

## drag：分页引擎

场景像幻灯片一样出栈入栈。手势进行中相邻场景保持挂载，松手后要么提交切换、要么回弹。

翻页涉及两份进度，各管一件事（详见[页面位移与元素时间线](/docs/03-two-track)）：

- **场景位移**：整屏跟随手势的位移。只有它提交完成，场景才真正切换。
- **元素进度**：每个 Scene 自持的一份 MotionValue，驱动本场景内 `Animate` 元素的入场进度。场景之间不共享。

### drag 配置

| prop                 | 类型                                               | 默认                | 说明                                                                                                                                              |
| -------------------- | -------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `direction`          | `'x' \| 'y'`                                       | 无                  | 滑动方向                                                                                                                                          |
| `transitionDuration` | number                                             | 800                 | **仅程序化导航生效**。手势翻页的位移与回弹时长由引擎内部写死为 800，公共 prop 到不了；这里只决定 `ref.goToScene()` 之后 `onSceneLeave` 的触发时机 |
| `threshold`          | `{ minVelocity, maxVelocity, minRatio, maxRatio }` | 无                  | 手势提交阈值                                                                                                                                      |
| `unit`               | `'time' \| 'percent'`                              | `'time'`            | Scene 元素时间轴的拖拽映射单位                                                                                                                    |
| `scale`              | number                                             | time=10 / percent=1 | 每拖拽 1% 的映射量                                                                                                                                |
| `firstSceneTimeout`  | number                                             | 3000                | 首屏优先图等待上限（ms）                                                                                                                          |

`unit` 和 `scale` 决定拖拽距离怎么换算成元素时间轴：`unit: 'time'` 下每拖 1% 推进 10ms 入场时间轴，`unit: 'percent'` 下直接映射 1% 进度。场景级可用 `Scene.drag` 覆盖单位与比例（见 [Scene 参考](/docs/02-scene)）。

`firstSceneTimeout` 超时会派发 `FIRST_SCENE_TIMEOUT`：默认回退为把首场景静态放置在 rest 态（不等资源、直接摆好），`onError` 里调用 `preventDefault` 可拦截这个回退。

## scroll：真实文档流接管

页面就是普通文档流，长内容交给原生滚动和浏览器自己的滚动手感。只有声明了 `scroll={{ zoneId, trigger: 'center-lock' }}` 的 Scene 会成为锁定区（locked zone）：一段区别于普通区域的「叙事片段」，滚动进入后由它接管进度。同一时刻只有一个场景在驱动进度，不并行。

### zone 与预算

zone 的时间预算就是真实滚动距离：**1ms = 1px**。`duration: { enter: 2000 }` 意味着这个元素要在 2000px 的真实滚动里完成入场。反向滚回 zone 时进度天然从 100% 退回 0%，不留跳变；过大的单次输入会被钳到段内帧，不会跳过整个 zone。center-lock 的完整语义见 [center-lock 接管](/docs/01-centerlock)。

### scroll 配置

| prop                         | 类型                    | 默认 | 说明                                |
| ---------------------------- | ----------------------- | ---- | ----------------------------------- |
| `direction`                  | `'x' \| 'y'`            | 无   | 滚动方向                            |
| `zoneTrigger`                | `'center-lock'`         | 无   | 唯一的 trigger                      |
| `sceneSizing`                | `'content' \| 'screen'` | 无   | 场景尺寸策略                        |
| `enterMargin` / `exitMargin` | number                  | 50   | 可见性条件的全局默认边距（设计 px） |

`enterMargin` / `exitMargin` 是可见性驱动的默认判定边距：元素距离视口 50（设计 px）以内才开始入场。单个 `Animate` 可用 `visibility.enterMargin/exitMargin` 覆盖（见 [Animate 参考](/docs/03-animate)）。

```tsx
<CineView mode="scroll" designWidth={750} direction="y" sceneSizing="content">
  <article>普通文档内容，原生滚动。</article>
  <Scene sceneId="seq" scroll={{ zoneId: 'seq', trigger: 'center-lock' }}>
    {/* zone 内：进度 = 真实滚动距离 */}
  </Scene>
</CineView>
```
