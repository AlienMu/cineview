---
title: 性能
eyebrow: ADVANCED / PERFORMANCE
---

连续变化的视觉值使用 MotionValue，掉帧时结合浏览器性能工具检查。CineView 的监控提供页面级帧时间采样。

## 运行时监控

启用 `monitor`，通过 CineView ref 读取结果：

```tsx
import { useRef } from 'react';
import { CineView, Scene, type CineViewRef } from 'cineview';

export default function Demo() {
  const ref = useRef<CineViewRef>(null);
  return (
    <>
      <button onClick={() => console.table(ref.current?.getPerformanceMetrics())}>
        输出性能数据
      </button>
      <CineView monitor ref={ref}>
        <Scene sceneId="example">
          <h1>示例</h1>
        </Scene>
      </CineView>
    </>
  );
}
```

读取方法不要求开启 `monitor`，但至少一个实例开启后才会采集帧样本。尚无样本时帧数据为零，停止监控后保留最近的样本。

## 指标字段

| 字段           | 含义                                                          |
| -------------- | ------------------------------------------------------------- |
| `fps`          | 根据平均帧时间估算，上限 60，保留一位小数                     |
| `avgFrameTime` | 最近至多 60 个帧间隔的均值，单位 ms                           |
| `memoryUsage`  | 至多八次采样的 JavaScript 堆大小中位数，单位 MB；不支持时缺省 |
| `bundleSize`   | 整个页面报告的代码与 CSS 资源大小，单位 KB                    |

FPS 上限无法反映高刷新率屏幕是否被充分利用。平均值可能掩盖单次停顿，具体停顿应通过浏览器性能记录或 `PerformanceObserver` 检查。

`bundleSize` 包含应用代码与依赖，在监控开始时采样，结果为零时可再次读取。CineView 自身的体积应查看构建输出。

## 页面共享的读数

所有 CineView 实例共享页面监控。第一个开启监控的实例启动采样，最后一个释放监控的实例停止采样。

因此两个实例返回相同读数，数据不会将渲染成本归属到某个 Scene 或 CineView。

## 初始资源等待

首个 Scene 等待声明的优先资源请求完成。视频需要加入等待时，将 URL 写入 `Scene.assets.preloadImages`；视频自身的 `preload` 仅填充共享缓存。

默认等待上限为 3000ms。drag 可通过 `firstSceneTimeout` 配置，scroll 使用 3000ms。超时报告 `FIRST_SCENE_TIMEOUT`，并将首场景显示为完成态；应用调用 `preventDefault?.()` 时可取消该默认处理。详见[预加载](/docs/02-preload)。

## 使用 MotionValue 保存进度

将 MotionValue 绑定到 motion 样式。需要从进度直接映射位置或透明度时，使用 `useTransform`。

render-prop children 通过重新渲染提供普通数值，适合 JSX 需要变化值的情况，但不会避免 React 渲染。

额外的 `useSpring` 会改变时序，可能落后于拖拽或滚动。画面需要匹配进度时，直接派生视觉值。

## 读取变化的值

在 render 中调用一次 `.get()` 不会让 React 订阅后续变化。

MotionValue 绑定与订阅使用 [useAnimateTimeline](/docs/09-use-animate-timeline)。它的 `frame` 汇总同一次更新中的进度、阶段与来源；观察整个锁定区时使用 `onZoneProgress`。

## 回调的执行成本

| 回调                                 | 频率                                           |
| ------------------------------------ | ---------------------------------------------- |
| `Scene.callbacks.onVisibilityChange` | 可能在每个滚动帧执行                           |
| `onZoneProgress`                     | 与上次报告相差超过 0.5px，另包含初始值与端点值 |

保持回调内的工作量较小。仅需要偶尔更新时，可过滤重复的可见性值或对进度采样。回调中的 React state 更新和布局读取仍会产生相应成本。

锁定区阈值相对于上次上报值累计，因此缓慢移动也会在累计足够位移后发出通知。

## 视频定位与内存

密集关键帧可减少随机和反向定位的解码工作。开发构建在定位延迟样本的中位数超过 50ms 时提示，应同时检查素材和设备负载。

scroll 锁定区中的 `releaseOnLeave` 可在视频距离较远时释放解码帧，返回时恢复，详见[媒体播放](/docs/06-media-ownership)。

## 包体积

ES 模块应用使用 `cineview`，其中包含两套引擎，由 `mode` 选择。

CommonJS 应用可使用按模式子路径。应用提供 peer 运行时后，也可通过脚本加载独立的 UMD 文件。详见[安装](/docs/02-installation)。
