---
title: drag 排错
eyebrow: DRAG / TROUBLESHOOTING
---

以下六项问题只出现在 drag 模式。跨模式通用问题见[排错](/docs/07-common-pitfalls)。

## 1. `transitionDuration` 不影响手势翻页速度

`transitionDuration` 配置程序化导航。手势位移使用单独的计时基准，普通回弹时长随位移计算，上限为 300ms。

调整元素节奏时，修改 `duration`、`timeline.delay`，或通过 `unit` 与 `scale` 改变拖拽映射。详见[手势](/docs/02-gestures)。

## 2. 反向拖拽时不执行 `exitAnimation`

元素声明 `exitAnimation` 后，正向拖拽会执行该动画，反向拖拽则会逆向播放入场动画。反向过程按 `1 - progress` 对 `initial → animate` 做连续插值。未声明 `exitAnimation` 时，正向拖拽只移动场景，元素保持完成后的状态。

正向和反向移动使用两套行为。若两个方向需要一致的视觉变化，将 `exitAnimation` 定义为入场动画的反向配置。若反向拖拽应当撤销刚才的动作，则保持未配置即可。

## 3. 首屏跳过入场动画

如果场景在首轮渲染后才加入，首屏可能直接显示完成态，而后续场景仍能正常播放入场动画。首屏入场判断在初次挂载时执行。初次挂载时场景数量为零，会让这次挂载周期不再播放首屏入场动画。

首轮渲染就包含 Scene。数据或动态导入尚未完成时，先显示占位 Scene，不要推迟全部 Scene 声明。

## 4. `driver: 'clock'` 元素不会退场

drag 模式下，`timeline.driver: 'clock'` 会在 Scene 到场后按真实时间独立播放。元素不参与 `after` 顺序，不执行 `exitAnimation`，自身时长也不计入场景时间线。开发构建会报告这些被忽略的配置。

元素需要跟随手势退场或参与 `after` 依赖时，使用 `driver: 'scene'`。需要到达后独立播放的动效时，使用 clock 驱动。

## 5. 远处场景的定时器和本地状态丢失

drag 模式只保持当前场景和相邻场景挂载。距离当前位置超过一屏的场景会卸载，返回时重新挂载实例，因此 effect 会重新执行，组件 state 会重置，时间线游标会回到零。

需要跨场景保留的状态放到 `CineView` 外部，例如父组件 state、Context 或外部 Store。场景内部的 effect 只处理当前呈现逻辑。场景身份由数组位置决定，结构重排会改变每个位置对应的实例。

## 6. 包裹后的 `Scene` 不显示

`CineView` 只检查直接子节点来发现 `Scene`。React 会展平数组，因此 `{list.map(...)}` 可以使用。Fragment 不会展平，在自定义组件的 render 函数内返回 `Scene` 也会隐藏内部节点。`memo` 和 `forwardRef` 包装最多向内解包六层。直接子节点和 Fragment 混用时，框架只发现直接子节点中的场景，也不会发出空场景警告。

将 Scene 直接声明在 CineView 下。复用一组场景时，可让函数返回 Scene 元素数组，在 CineView 的 children 中调用；不要再用组件包裹这些 Scene。

## 相关页面

- [drag 布局契约](/docs/01-layout)：场景挂载范围与忽略的属性
- [拖拽的开始与继续](/docs/04-ownership)：早期手势可能无效的原因
- [drag 回调时序](/docs/05-callbacks)：回调时刻与命名
- [排错](/docs/07-common-pitfalls)：跨模式通用问题
