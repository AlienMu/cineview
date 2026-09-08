---
title: Animate
eyebrow: COMPONENTS / ANIMATE
---

Animate 为内容添加入场、退场和循环动画。默认进度跟随 Scene，设置 `timeline.driver: 'clock'` 后使用独立计时。

```tsx
<Animate enterAnimation="fade-in" duration={{ enter: 800 }}>
  <h1>你好</h1>
</Animate>
```

## Props

| 属性                                    | 类型                       | 默认值           | 行为                                          |
| --------------------------------------- | -------------------------- | ---------------- | --------------------------------------------- |
| `animateId`                             | string                     | 每个实例自动生成 | 被其他 Animate 的 `after` 引用时需要声明      |
| `enterAnimation`                        | AnimationType              | 无               | 与 `loopAnimation` 至少提供一个，也可同时提供 |
| `exitAnimation`                         | AnimationType              | 无               | 退场效果，drag 独立计时元素忽略该配置         |
| `loopAnimation`                         | AnimationType              | 无               | 元素处于可播放阶段且可见时循环                |
| `duration.enter` / `duration.exit`      | number，ms                 | 600              | 动画时长；锁定区内跟随场景的动画对应滚动像素  |
| `timeline.driver`                       | `'scene' \| 'clock'`       | `'scene'`        | 进度来源                                      |
| `timeline.delay`                        | number，ms                 | 0                | 入场延迟                                      |
| `timeline.after`                        | string                     | 无               | 等待另一个 `animateId` 入场                   |
| `timeline.zoneId`                       | string                     | 继承所在锁定区   | 显式绑定锁定区                                |
| `timeline.phase.start` / `end`          | number                     | 完整区间         | 占锁定区总时长预算的比例区间                  |
| `visibility.replay`                     | boolean                    | true             | 退场后再次可见时重播                          |
| `visibility.enterMargin` / `exitMargin` | number，设计 px            | 根配置，其次 50  | 可见性边距                                    |
| `stagger`                               | `{ each?, from? }`         | 无               | 按间隔显示直接子元素                          |
| `enterRef` / `exitRef`                  | 保存函数或 null 的可变 ref | 无               | 在支持的驱动方式上手动触发                    |
| `children`                              | ReactNode 或渲染函数       | 必填             | 使用 stagger 时为单个 ReactElement            |

重复标识报告 `INVALID_COMPONENT_HIERARCHY`，缺失或不兼容的 `after` 目标报告 `INVALID_ANIMATION`，循环依赖报告 `CIRCULAR_DEPENDENCY`。

## AnimationType 的形式

动画属性接受预设名、自定义对象或组合配置：

- `PresetAnimation`：43 个[预设名称](/docs/08-presets)之一。
- `CustomAnimation`：`{ initial?, animate?, exit? }`。普通入退场支持十个映射属性，涵盖透明度、位移、缩放、旋转、倾斜与滤镜，完整列表见[自定义动画](/docs/05-custom-animation)。
- `ComposedAnimation`：`{ animations, mode: 'sequential' | 'parallel', delays? }`。

```tsx
<Animate
  enterAnimation={{ initial: { y: '10%', opacity: 0 }, animate: { y: 0, opacity: 1 } }}
  duration={{ enter: 800 }}
>
  <article>内容</article>
</Animate>
```

## 驱动行为

| driver    | 使用位置        | 行为                                              |
| --------- | --------------- | ------------------------------------------------- |
| `'scene'` | scroll 锁定区内 | 跟随锁定区滚动进度                                |
| `'scene'` | scroll 锁定区外 | 由可见性条件触发                                  |
| `'scene'` | drag            | 跟随场景的元素时间线                              |
| `'clock'` | scroll          | 使用可见性条件，在锁定区内也一样                  |
| `'clock'` | drag            | 到达后播放，不参与 `after` 依赖，也不执行退场动画 |

drag 正向退场使用 `exitAnimation`，返回前一个场景时则反向播放入场。未声明正向退场动画时，页面移动，元素保持入场完成态。

## loopAnimation 何时运行

重复动效需要随元素或 Scene 停止时，使用 `loopAnimation`。CSS 动画不会自动跟随 CineView 的可见性与生命周期条件。

循环可以在 `enterAnimation` 完成后运行，也可以单独使用。仅需要循环的元素省略 `enterAnimation`。

## 子元素依次显示

```tsx
<Animate enterAnimation="fade-in" stagger={{ each: 40, from: 'first' }}>
  <ul>
    <li>第一项</li>
    <li>第二项</li>
  </ul>
</Animate>
```

`each` 为间隔毫秒数，默认 40。`from` 可取 `'first'`（默认）、`'last'` 或 `'center'`。

stagger 使用 Framer Motion 的子元素动画能力，支持 `clipPath`、`width` 等属性。它按经过的时间播放，即使所在 Scene 跟随滚动或拖拽。子元素需要跟随进度显示时，可分别使用 Animate，或从时间线派生样式。

## render-prop children

```tsx
<Animate enterAnimation="fade-in">
  {({ enterProgress, phase }) => (
    <div style={{ width: `${enterProgress * 100}%` }} data-phase={phase} />
  )}
</Animate>
```

渲染函数接收 `enterProgress`（0–1）与 `phase`（`idle`、`waiting`、`entering`、`entered`、`exiting` 或 `exited`）。进度变化时，这部分内容会重新渲染。

锁定区内跟随场景的入退场动画，其 phase 保持 `idle`；独立计时元素使用可见性阶段，仅配置循环的元素处于 `entered`。需要避免 React 渲染的 MotionValue 绑定时，使用 [useAnimateTimeline](/docs/09-use-animate-timeline)。

## 手动入场与退场

可见性驱动的 scroll 动画支持两个 ref。drag 的 `driver: 'clock'` 仅支持 `enterRef`。跟随场景的 drag 动画和跟随锁定区进度的动画会忽略两个 ref，并报告 `INVALID_ANIMATION`。

调用 `enterRef.current?.()` 会立即入场。在相应选项受支持时，已声明的 `after` 或大于零的 `timeline.delay` 仍可自动触发。没有自动触发条件时，必须手动调用。

传入 `exitRef` 会关闭受支持动画的自动退场，需要调用它才能退场，没有超时兜底。它不会改变场景的可见性或挂载规则。

示例在收到响应文本后立即显示；没有收到时，在满足可见性条件后按延迟自动入场：

```tsx
import { useEffect, useRef, useState } from 'react';
import { Animate, CineView, Scene } from 'cineview';

function Message() {
  const [message, setMessage] = useState('');
  const enter = useRef<(() => void) | null>(null);
  const exit = useRef<(() => void) | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/message')
      .then((response) => {
        if (!response.ok) throw new Error('请求失败');
        return response.text();
      })
      .then((text) => {
        if (!active) return;
        setMessage(text);
        enter.current?.();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <Animate
      enterAnimation="fade-in"
      exitAnimation="fade-out"
      timeline={{ driver: 'clock', delay: 3000 }}
      enterRef={enter}
      exitRef={exit}
    >
      <div>
        <p>{message || '暂时无法获取消息。'}</p>
        <button onClick={() => exit.current?.()}>关闭</button>
      </div>
    </Animate>
  );
}

export default function App() {
  return (
    <CineView mode="scroll">
      <Scene sceneId="message">
        <Message />
      </Scene>
    </CineView>
  );
}
```

## 入场与退场顺序

`after` 只设置入场顺序，`duration.exit` 改变退场时长，不决定开始时间。需要有序退场时，使用当前驱动方式支持的控制方法。详见[时间线](/docs/04-orchestration)。
