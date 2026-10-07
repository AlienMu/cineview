---
title: 性能
eyebrow: ADVANCED / PERFORMANCE
---

连续变化的视觉值使用 MotionValue，掉帧时结合浏览器性能工具检查。Cineview 的监控提供页面级帧时间采样。

## 运行时监控

设置 `monitor` 后开始采集帧数据。要在页面显示数据，从 `cineview/dev` 引入 `PerfPanel`，并引入面板样式。scroll 模式的 `debug` 只在 DOM 上添加布局诊断属性，不会启动采样或显示面板。

启用 `monitor`，通过 Cineview ref 读取结果：

```tsx
import { useState } from 'react';
import { Cineview, Scene, type CineviewRef } from 'cineview';
import { PerfPanel } from 'cineview/dev';
import 'cineview/dev/style.css';

export default function Demo() {
  const [source, setSource] = useState<CineviewRef | null>(null);
  return (
    <>
      <Cineview monitor callbacks={{ onReady: setSource }}>
        <Scene sceneId="example">
          <h1>示例</h1>
        </Scene>
      </Cineview>
      <PerfPanel source={source} lang="zh" />
    </>
  );
}
```

自定义展示时，可调用 `source?.getPerformanceMetrics()`，或使用 `cineview/dev` 中的 `usePerfMonitor`。至少一个实例开启 `monitor` 后才会采集帧样本。读取数据时无需保持监控开启；尚无样本时帧数据为零，停止监控后保留最近的样本。

## 指标字段

| 字段           | 含义                                                          |
| -------------- | ------------------------------------------------------------- |
| `fps`          | 根据平均帧时间估算，上限 60，保留一位小数                     |
| `avgFrameTime` | 最近至多 60 个帧间隔的均值，单位 ms                           |
| `memoryUsage`  | 至多八次采样的 JavaScript 堆大小中位数，单位 MB；不支持时缺省 |
| `bundleSize`   | 整个页面报告的代码与 CSS 资源大小，单位 KB                    |

FPS 上限无法反映高刷新率屏幕是否被充分利用。平均值可能掩盖单次停顿，具体停顿应通过浏览器性能记录或 `PerformanceObserver` 检查。

`bundleSize` 包含应用代码与依赖，在监控开始时采样，结果为零时可再次读取。Cineview 自身的体积应查看构建输出。

## 页面共享的读数

所有 Cineview 实例共享页面监控。第一个开启监控的实例启动采样，最后一个释放监控的实例停止采样。

因此两个实例返回相同读数，数据不会将渲染成本归属到某个 Scene 或 Cineview。

## 检查移动端拖拽

在生产构建页面中记录正向拖动、反向拖动和松手切幕的过程。每个 Scene 都测量首次进入和返回：挂载内容与解码媒体可能产生不同的开销。对比修改前后时，保持视口、设备像素比、素材和操作顺序一致。

除平均帧率外，还要检查最长帧间隔和超过 50ms 的任务。即使多数帧接近 16.7ms，切幕时的短暂停顿仍可能被感知。浏览器记录可以帮助区分脚本执行、布局、绘制和媒体处理的开销。

CPU 限速有助于暴露耗时操作，但桌面模拟无法复现手机的 GPU、内存限制和浏览器。完成本地测量后，在目标设备上确认受影响的交互。

自定义 Canvas 在 Scene 不活动后仍持续绘制时，应根据时间线阶段停止动画帧循环。容器尺寸变化时测量一次，绘制时使用保存的尺寸。避免在进度回调或随动画文字频繁触发的观察器中读取布局。

Canvas 完全透明时，绘制循环仍可能运行。应检查退出动画已不可见、但手势停在 Scene 离开之前的情况。手势反向使内容重新可见时，需要恢复绘制。

需要在手机上缩小的页面，保持 `minWidth` 未设置。较大的下限会保留宽布局，也可能增加绘制表面的尺寸。详见[响应式布局](/docs/05-responsive)。

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

密集关键帧不能消除重复定位的开销。缓慢和反向拖动时，对比 `currentTime` 写入、`seeked` 事件和实际显示的帧。多个目标时间可能位于同一源视频帧内，需要通过浏览器记录判断重复请求是否延迟了画面更新。

视频 Blob 缓存大小表示压缩下载数据，不包含解码帧或 GPU 纹理；JavaScript 堆读数也不包含这些分配。

scroll 锁定区中的 `releaseOnLeave` 可在视频距离较远时释放解码帧，返回时恢复，详见[媒体播放](/docs/06-media-ownership)。

## 包体积

ES 模块应用使用 `cineview`，其中包含两套引擎，由 `mode` 选择。

CommonJS 应用可使用按模式子路径。应用提供 peer 运行时后，也可通过脚本加载独立的 UMD 文件。详见[安装](/docs/02-installation)。
