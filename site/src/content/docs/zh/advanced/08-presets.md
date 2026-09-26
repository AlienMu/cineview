---
title: 预设与动画组合
eyebrow: ADVANCED / PRESETS
---

Cineview 提供淡入、位移、缩放和循环等预设。单个预设不够用时，可与自定义属性组合。

## 将预设与自定义位移组合

下面的标题在 800ms 入场时间内同时淡入、上移。场景进度倒退时，两种变化也会一起倒退：

```tsx
import { Animate, Cineview, Scene } from 'cineview';

export default function App() {
  return (
    <Cineview mode="drag" designWidth={750}>
      <Scene sceneId="opening">
        <Animate
          enterAnimation={{
            animations: ['fade-in', { initial: { y: 32 }, animate: { y: 0 } }],
            mode: 'parallel',
          }}
          duration={{ enter: 800 }}
        >
          <h1>产品细节</h1>
        </Animate>
      </Scene>
      <Scene sceneId="next"><h2>下一个场景</h2></Scene>
    </Cineview>
  );
}
```

`animations` 数组可以混用预设名称与自定义动画对象。同一属性由多个配置指定时，后面的配置优先。普通 Animate 入退场（包括可见性与 clock 播放）将这些变化放在同一段进度中；`sequential` 和 `delays` 不会把这些动画拆成先后阶段。同一元素的阶段变化用关键帧，不同元素的入场顺序用 `timeline.after`。详见[动画组合](/docs/04-orchestration)。

## 预设目录

| 类型 | 预设                                                                           |
| ---- | ------------------------------------------------------------------------------ |
| 基础 | `fade`、`fade-in`、`fade-out`                                                  |
| 滑动 | `slide-up`、`slide-down`、`slide-left`、`slide-right`                          |
| 缩放 | `zoom-in`、`zoom-out`、`scale-up`、`scale-down`                                |
| 旋转 | `rotate`、`rotate-in`、`rotate-out`、`spin`                                    |
| 翻转 | `flip`、`flip-x`、`flip-y`                                                     |
| 弹跳 | `bounce`、`bounce-in`、`bounce-out`                                            |
| 闪烁 | `blink`、`flash`、`pulse`                                                      |
| 抖动 | `shake`、`shake-x`、`shake-y`、`vibrate`、`jello`                              |
| 模糊 | `blur-in`、`blur-out`、`focus-in`                                              |
| 弹性 | `elastic`、`rubber-band`、`wobble`、`swing`                                    |
| 特殊 | `heartbeat`、`tada`、`wave`、`roll-in`、`roll-out`、`hinge`、`jack-in-the-box` |

## 命名约定

以 `-in` 和 `-out` 结尾的名称通常分别用于入场和退场。`spin`、`pulse`、`shake` 等也可用于循环，播放受元素可见性与动画阶段约束，详见 [Animate](/docs/03-animate)。

## 组合入场、循环与退场

在同一个 Animate 上设置三个动画属性，即可在入场后循环，并在退场时播放离场效果。示例先上移并淡入，完成后循环缩放，再淡出：

```tsx
<Animate
  animateId="title"
  enterAnimation="slide-up"
  exitAnimation="fade-out"
  loopAnimation="pulse"
  duration={{ enter: 800, exit: 400 }}
>
  <h1>开场标题</h1>
</Animate>
```

将示例放在 drag 模式的 Scene，或 scroll 模式中按可见性播放的 Scene 内。默认 `driver: 'scene'` 支持 drag 退场；`driver: 'clock'` 在 drag 中忽略退场。scroll 锁定区的入场与退场随滚动距离变化，需要停留循环时应预留对应区间。驱动与循环条件见 [Animate](/docs/03-animate)。

预设也可用于 scroll 模式的 `Scene.transition`，对整个场景应用入场或退场效果。

## 配置参考

动画属性还接受以下两种配置：

- `CustomAnimation`：使用 `{ initial?, animate?, exit? }` 定义属性与关键帧。
- `ComposedAnimation`：在 `animations` 数组中混用预设名与自定义动画。`mode` 和 `delays` 为 `loopAnimation` 与 `stagger` 生成逐属性时间配置；普通入退场使用整体时长。

写法与组合规则见[自定义动画](/docs/05-custom-animation)；类型定义见[公共类型速查](/docs/10-types)。
