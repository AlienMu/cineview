---
title: Scene
eyebrow: API REFERENCE
---

`<Scene>` 是章节边界：布局、资源、可见性回调与 scene-scoped fixed layer 的所有权都焊在这一层。本页是全量字段参考；用法与教程见 [Scene 组件指南](/docs/scene)。

## Props

字段与默认值逐项核对自 `src/types/index.ts` 的 `SceneProps` 与 Scene 实现。`Scene` 还接受原生 `div` 属性（`Omit<HTMLAttributes, 'children'>`）。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `sceneId` | `string` | — | 章节唯一标识。scroll 模式下作为 `preload` 的字符串目标，也在 `scroll.zoneId` 缺省时兜底作为 zone 标识。 |
| `layout.width` | `number \| string` | `'100vw'` | 场景宽度。数字按设计 px 经单尺子换算。 |
| `layout.height` | `number \| string` | `'auto' / '100vh'` | 场景高度。scroll 模式默认 `'auto'`（内容自然高度），drag 模式默认 `'100vh'`。 |
| `layout.anchor` | `SceneAnchor` | `'top-left'` | 场景在视口内的锚点，九宫格九个取值（见下方类型表）。 |
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
| `callbacks.onVisibilityChange` | `(detail: SceneVisibilityDetail) => void` | — | 场景进出视口时触发——见下节专述。 |
| `children` | `ReactNode` | `required` | 章节内容。 |

## Callbacks：onVisibilityChange

场景进出视口时触发，载荷是 `SceneVisibilityDetail`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `visible` | `boolean` | 场景当前是否在视口内。 |
| `progress` | `number` | 场景可视进度 `0..1`。 |
| `sceneIndex` | `number` | （可选）场景下标——根级聚合路径携带；Scene 自身的声明式路径下可缺省。 |

```tsx
<Scene
  sceneId="act-2"
  callbacks={{
    onVisibilityChange: ({ visible, progress }) => {
      // Imperative side effects only — for render state, prefer
      // useAnimateTimeline() inside an <Animate> child.
      telemetry.track('act-2', { visible, progress });
    },
  }}
>
  ...
</Scene>
```

两个注意点：

- **这是事件回调，不是渲染状态源**。`progress` 随滚动逐帧变化，直接 `setState` 会让整个宿主组件每帧重渲染——需要读进度的渲染器用 `useAnimateTimeline()`（见 [该页](/docs/use-animate-timeline)）。
- **与根级 `onSceneVisibilityChange` 同源同载荷**。scroll 模式下，同一份可见性事件同时扇出到 Scene 级回调与 CineView 根级 `callbacks.onSceneVisibilityChange`——Scene 上写只收本场景，根上写收全部场景。不要两处都做重活。

## 类型

### SceneAnchor

`layout.anchor` 的九个取值，九宫格相对视口：

| 取值 | 语义 |
| --- | --- |
| `'top-left'` | 顶左（默认） |
| `'top-center'` | 顶中 |
| `'top-right'` | 顶右 |
| `'center-left'` | 中左 |
| `'center'` | 正中 |
| `'center-right'` | 中右 |
| `'bottom-left'` | 底左 |
| `'bottom-center'` | 底中 |
| `'bottom-right'` | 底右 |

### SceneStackMode

`stack.mode` 的两个取值：`'replace'`——新场景替换旧场景（drag 默认，退场后旧场景卸载渲染）；`'cover'`——新场景覆盖在旧场景之上（scroll 默认，滚动文档流语义）。

### 共享类型

- `AnimationType`（`transition.enterAnimation` / `exitAnimation` 的类型）→ [类型字典](/docs/types)；预设名目录 → [预设动画](/docs/presets)
- `SceneVisibilityDetail` 的逐字段说明（含根级差异）→ [类型字典](/docs/types)
- `SceneTimelinePhase`（scroll 场景的五态相位词表）→ [类型字典](/docs/types)

## FAQ

**`scroll.zoneId` 不写会怎样？**
缺省时回落到 `sceneId` 作为 zone 标识。两处都不写则该 Scene 不声明接管 zone（scroll 模式下其内容按普通文档流滚动，内部 `Animate` 走 visibility 轨）。

**两个 Scene 声明了同一个 `zoneId`？**
上报 `INVALID_COMPONENT_HIERARCHY`（可恢复，载荷含 `ownerSceneIndex` / `rejectedSceneIndex`）；未接管时首个声明者胜出，后声明方的 zone 声明被拒绝。

**`drag.unit` / `drag.scale` 的继承规则？**
两字段任一显式提供即停止继承 root `modes.drag` 的映射；都缺省时整组继承。只想覆盖 `scale` 也要意识到 `unit` 同时脱离继承——需要保住默认单位就显式写 `unit: 'time'`。

**场景高度到底谁说了算？**
`layout.height`。scroll 模式默认 `'auto'`（内容自然高度，文档流语义），drag 模式默认 `'100vh'`（全屏栈语义）；`modes.scroll.sceneSizing` 是 scroll 侧的全局语义开关（`'content'` / `'screen'`）。

