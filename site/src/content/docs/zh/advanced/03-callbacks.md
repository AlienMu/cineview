---
title: 回调
eyebrow: ADVANCED / CALLBACKS
---

CineView 接收扁平的 `callbacks` 对象，TypeScript 按 `mode` 检查可用字段。两种模式都支持公共回调，drag 与 scroll 事件仅在对应模式可用。

## 回调速查

公共回调（两种模式都可用）：

| 回调             | detail / 参数                        | 说明                                       |
| ---------------- | ------------------------------------ | ------------------------------------------ |
| `onReady`        | `api: CineViewRef`                   | 挂载后 ref API 可用，不等待资源            |
| `onLoadProgress` | `progress: number`                   | 队列请求完成比例，整数 0–100，包含失败请求 |
| `onSceneEnter`   | `{ fromIndex, toIndex, direction? }` | 场景切换通知，手势切换在提交时通知         |
| `onSceneLeave`   | `{ fromIndex, toIndex, direction? }` | 场景切换的后续通知，不代表子动画已完成     |
| `onError`        | `CineViewErrorDetail`                | 错误统一出口，见「onError 与错误码」小节   |

`direction` 为 `'forward'`、`'backward'` 或 `null`。手势与程序化导航的时机见 [drag 回调](/docs/05-callbacks)。

drag 专属：

| 回调             | detail                                                                                  | 说明                                       |
| ---------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ |
| `onDragStart`    | `{ sceneIndex, progress, direction }`                                                   | 首次方向确认的手势才发；`direction` 必有值 |
| `onDragProgress` | `{ sceneIndex, progress, direction? }`                                                  | 拖拽进行中                                 |
| `onDragBlocked`  | `{ fromIndex, targetSceneIndex, direction }`                                            | 拖拽被阻断（如目标不可达）                 |
| `onDragEnd`      | `{ sceneIndex, progress, direction?, targetSceneIndex, elapsedMs, timelineDurationMs }` | 拖拽提交切换，携带目标场景与时间轴数据     |
| `onDragCancel`   | `{ sceneIndex, progress, direction? }`                                                  | 拖拽未达阈值，回落原场景                   |

scroll 专属：

| 回调                      | detail                               | 说明                                                |
| ------------------------- | ------------------------------------ | --------------------------------------------------- |
| `onZoneEnter`             | `{ zoneId, sceneIndex }`             | 进入锁定区（locked zone）                           |
| `onZoneLeave`             | `{ zoneId, sceneIndex }`             | 离开锁定区                                          |
| `onZoneProgress`          | `{ zoneId, sceneIndex, progress }`   | 锁定区进度，详见 [center-lock](/docs/01-centerlock) |
| `onSceneVisibilityChange` | `{ sceneIndex?, visible, progress }` | 场景可见性变化                                      |

## 判别联合：写错模式编不过

`mode="drag"` 时传 scroll 回调（或反之）是类型错误：

示例中的回调不属于 drag 模式，因此产生类型错误：

```tsx
<CineView mode="drag" callbacks={{ onZoneProgress: () => {} }}>
  <Scene sceneId="example">内容</Scene>
</CineView>
```

先将回调对象保存到变量，也会受到同一检查。

按模式正确拆开的写法：

```tsx
<CineView
  mode="scroll"
  callbacks={{
    onReady: (api) => api.preload(['intro']),
    onError: ({ code, message }) => console.error(code, message),
  }}
>
  <Scene sceneId="intro" assets={{ preloadImages: ['/intro.jpg'] }}>
    内容
  </Scene>
</CineView>
```

## onError 与错误码

`CineViewErrorDetail` 包含 `code`、`message` 及可选的 `context` 和 `preventDefault`。switch 需要穷尽处理时，可加入 `never` 检查。

| code                          | 含义                                    | 可恢复性       |
| ----------------------------- | --------------------------------------- | -------------- |
| `EMPTY_SCENES`                | CineView 没有 Scene，或 Scene 没有内容  | 添加内容       |
| `IMAGE_LOAD_FAILED`           | drag 模式的队列资源失败                 | 处理资源错误   |
| `FIRST_SCENE_TIMEOUT`         | 初始优先资源等待超时                    | 可控制默认处理 |
| `INVALID_ANIMATION`           | 依赖缺失或不兼容，或不支持手动控制      | 修正报告的配置 |
| `CIRCULAR_DEPENDENCY`         | `after` 链有循环                        | 不可恢复       |
| `INVALID_COMPONENT_HIERARCHY` | `animateId` 或锁定区标识重复            | 不可恢复       |
| `INVALID_DRAG_CONFIG`         | drag 的 unit / scale / enabled 配置非法 | 可恢复         |
| `ANIMATION_ASSET_LOAD_FAILED` | 动画预设资源加载失败                    | 可重试         |

`FIRST_SCENE_TIMEOUT` 提供 `preventDefault`。应用提供其他等待或重试界面时才调用它；否则默认将首场景显示为完成态。

```tsx
import type { CineViewErrorDetail } from 'cineview';

export function handleError(detail: CineViewErrorDetail) {
  if (detail.code === 'FIRST_SCENE_TIMEOUT') {
    // 保留默认显示行为，并报告超时。
    console.warn(detail.message);
    return;
  }
  console.error(detail.code, detail.message);
}
```

应用自行处理时，在显示界面前调用 `detail.preventDefault?.()`。公共错误类型不会根据 code 收窄此方法，因此需要可选调用。

## 两条行为须知

- `onDragStart` 只在**首次方向确认**的拖拽手势上触发，轻微触碰不算。
- 回调里读值没问题，把每帧回调（`onDragProgress`、`onZoneProgress`）的值写进 React state 才是性能问题，见[性能](/docs/01-performance)。
