---
title: Scene
eyebrow: CHAPTER
---

Scene 是布局、资源、可见性回调与 scene-scoped fixed layer 的章节边界。

## Scroll zone

scroll zone 声明的是时间轴所有权，不声明动画样式，也没有虚拟坐标系。

```tsx
<Scene
  sceneId="hero-sequence"
  layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
  scroll={{ zoneId: 'hero-sequence', trigger: 'center-lock' }}
>
  <Position layer={{ fixed: true }}>...</Position>
</Scene>
```

## 属性

字段与默认值逐项核对自 `src/types/index.ts` 的 `SceneProps` 与 Scene 实现。`Scene` 还接受原生 `div` 属性（`Omit<HTMLAttributes, 'children'>`）。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `sceneId` | `string` | — | 章节唯一标识。scroll 模式下作为 `preload` 的字符串目标，也在 `scroll.zoneId` 缺省时兜底作为 zone 标识。 |
| `layout.width` | `number \| string` | `'100vw'` | 场景宽度。数字按设计 px 经单尺子换算。 |
| `layout.height` | `number \| string` | `'auto' / '100vh'` | 场景高度。scroll 模式默认 `'auto'`（内容自然高度），drag 模式默认 `'100vh'`。 |
| `layout.anchor` | `SceneAnchor` | `'top-left'` | 场景在视口内的锚点，九宫格九个取值（如 `'top-left'`、`'center'`）。 |
| `layout.overflow` | `'hidden' \| 'visible' \| 'clip'` | `'hidden'` | 场景容器溢出策略。 |
| `stack.mode` | `'replace' \| 'cover'` | `'replace' / 'cover'` | 场景堆叠语义。drag 模式默认 `'replace'`，scroll 模式默认 `'cover'`。 |
| `stack.zIndex` | `number` | — | 场景层叠顺序。 |
| `transition.enterAnimation` | `AnimationType` | — | 场景级入场动画（预设名 / 自定义 variant / 组合）。 |
| `transition.exitAnimation` | `AnimationType` | — | 场景级退场动画。 |
| `transition.exitDuration` | `number` | `800` | 场景退场/切换动画时长（ms）。 |
| `assets.preloadImages` | `string[]` | — | 预声明的场景图片。drag 模式当前场景（scroll 模式首场景）的图片进首屏优先队列，其余进后台队列。 |
| `drag.enabled` | `boolean` | `true` | 该 Scene 是否可成为拖拽目标（仅 drag 模式）。 |
| `drag.unit` | `'time' \| 'percent'` | `'time'` | 该场景的拖拽映射单位。提供 `unit` 或 `scale` 任一即停止继承 root `modes.drag` 的映射。 |
| `drag.scale` | `number` | `10 / 1` | `time` 单位下每 1% 拖拽进度的毫秒数（默认 `10`）；`percent` 单位下占编译时间轴的百分比（默认 `1`）。 |
| `scroll.zoneId` | `string` | — | 声明该 Scene 为 scroll 接管 zone 并指定标识；缺省时回落到 `sceneId`。 |
| `scroll.trigger` | `'center-lock'` | `'center-lock'` | zone 触发模型（当前唯一取值）。 |
| `callbacks.onVisibilityChange` | `(detail: SceneVisibilityDetail) => void` | — | 场景进出视口时触发，携带 `visible` 与 `progress`。 |
| `children` | `ReactNode` | `required` | 章节内容。 |
