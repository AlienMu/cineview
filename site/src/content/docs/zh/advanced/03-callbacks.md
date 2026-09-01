---
title: 回调
eyebrow: ADVANCED / CALLBACKS
---

`CineView` 的 `callbacks` 是一个扁平对象，可用的键由 `mode` 判别：drag 模式只收公共 + drag 回调，scroll 模式只收公共 + scroll 回调。写错模式不是运行时静默忽略，而是 TypeScript 类型错误。

## 回调速查

公共回调（两种模式都可用）：

| 回调             | detail / 参数                        | 说明                                                             |
| ---------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `onReady`        | `api: CineViewRef`                   | 运行时就绪，携带 ref API                                         |
| `onLoadProgress` | `progress: number`                   | 预加载进度，**整数 0 到 100**（不是 0 到 1）；无资产时直接报 100 |
| `onSceneEnter`   | `{ fromIndex, toIndex, direction? }` | 场景切换前                                                       |
| `onSceneLeave`   | `{ fromIndex, toIndex, direction? }` | 场景切换后                                                       |
| `onError`        | `CineViewErrorDetail`                | 错误统一出口，见「onError 与错误码」小节                         |

`direction` 取 `'forward' | 'backward'`，可为 `null`。

drag 专属：

| 回调             | detail                                                                                  | 说明                                       |
| ---------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ |
| `onDragStart`    | `{ sceneIndex, progress, direction }`                                                   | 首次方向确认的手势才发；`direction` 必有值 |
| `onDragProgress` | `{ sceneIndex, progress, direction? }`                                                  | 拖拽进行中                                 |
| `onDragBlocked`  | `{ fromIndex, targetSceneIndex, direction }`                                            | 拖拽被阻断（如目标不可达）                 |
| `onDragEnd`      | `{ sceneIndex, progress, direction?, targetSceneIndex, elapsedMs, timelineDurationMs }` | 拖拽提交切换，携带目标场景与时间轴数据     |
| `onDragCancel`   | `{ sceneIndex, progress, direction? }`                                                  | 拖拽未达阈值，回落原场景                   |

scroll 专属：

| 回调                      | detail                               | 说明                                                        |
| ------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| `onZoneEnter`             | `{ zoneId, sceneIndex }`             | 进入锁定区（locked zone）                                   |
| `onZoneLeave`             | `{ zoneId, sceneIndex }`             | 离开锁定区                                                  |
| `onZoneProgress`          | `{ zoneId, sceneIndex, progress }`   | zone 进度（zone 语义见 [center-lock](/docs/01-centerlock)） |
| `onSceneVisibilityChange` | `{ sceneIndex?, visible, progress }` | 场景可见性变化                                              |

## 判别联合：写错模式编不过

`mode="drag"` 时传 scroll 回调（或反之）是类型错误：

```tsx
// ❌ 类型错误：scroll 专属回调进不了 drag 模式
<CineView
  mode="drag"
  callbacks={{
    onDragEnd: (d) => console.log(d.targetSceneIndex),
    onZoneProgress: (d) => console.log(d.progress), // ts 报错
  }}
>
```

这个封堵对两条赋值路径都生效：inline 对象字面量会被多余属性检查拦住；先提取到变量再传入的混合对象（`{ onDragEnd, onZoneProgress }`）也会被每个跨模式回调键上的 `never` 兜底拦下。不是约定，是类型系统强制执行。

按模式正确拆开的写法：

```tsx
<CineView
  mode="scroll"
  callbacks={{
    onReady: (api) => api.preload(['intro']),
    onZoneProgress: ({ zoneId, progress }) => {},
    onError: ({ code }) => {},
  }}
>
```

## onError 与错误码

`CineViewErrorDetail` 的形状是 `{ code, message, context?, preventDefault? }`。`code` 是 `CineViewErrorCode` 联合，switch 时有自动补全和穷尽性检查：

| code                          | 含义                                    | 可恢复性                      |
| ----------------------------- | --------------------------------------- | ----------------------------- |
| `EMPTY_SCENES`                | CineView 没有任何 Scene 子节点          | 不可恢复                      |
| `IMAGE_LOAD_FAILED`           | 预加载图片失败                          | 不可恢复                      |
| `FIRST_SCENE_TIMEOUT`         | 首屏优先资源等待超时                    | 可恢复（带 `preventDefault`） |
| `INVALID_ANIMATION`           | `after` 指向不存在的组件                | 不可恢复                      |
| `CIRCULAR_DEPENDENCY`         | `after` 链有循环                        | 不可恢复                      |
| `INVALID_COMPONENT_HIERARCHY` | 重复 `animateId`，或重复 zone identity  | 不可恢复                      |
| `INVALID_DRAG_CONFIG`         | drag 的 unit / scale / enabled 配置非法 | 可恢复                        |
| `ANIMATION_ASSET_LOAD_FAILED` | 动画预设资源加载失败                    | 可重试                        |

`preventDefault` 只在「框架有默认回退」的可恢复错误上出现（典型是 `FIRST_SCENE_TIMEOUT`）。调用该方法可拦截框架默认回退行为，交由外部逻辑自行处理（例如渲染自定义重试界面）；未调用时框架按默认回退继续执行。

```tsx
onError: ({ code, message, preventDefault }) => {
  if (code === 'FIRST_SCENE_TIMEOUT') {
    preventDefault(); // 拦截默认放置行为，交由外部逻辑接管
    showRetry();
    return;
  }
  reportToSentry(code, message); // 其余错误照常上报
};
```

## 两条行为须知

- `onDragStart` 只在**首次方向确认**的拖拽手势上触发，轻微触碰不算。
- 回调里读值没问题，把每帧回调（`onDragProgress`、`onZoneProgress`）的值写进 React state 才是性能问题，见[性能](/docs/01-performance)。
