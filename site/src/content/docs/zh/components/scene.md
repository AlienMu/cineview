---
title: Scene
eyebrow: CHAPTER
---

Scene 是布局、资源、可见性回调与 scene-scoped fixed layer 的章节边界。

## When to use

- 内容需要按「幕」切分：一幕有独立的布局锚点、进退场编排与资源声明，而不是一张长画布上的一段。
- scroll 模式下需要声明接管 zone——一段真实滚动距离归这个章节的动画时间轴所有（center-lock 模型）。
- 需要场景级可视性信号（`callbacks.onVisibilityChange`）或 scene-scoped fixed layer 宿主时。

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

写了 `scroll.zoneId` 的 Scene 把自己声明为接管 zone：zone 跨度按 `1ms = 1px` 折算成真实滚动距离（`Animate` 的 `duration`/`delay` 在这里就是滚动 px），滚动经过时视口被锁定在该段内逐帧驱动内部动画，反向回滚天然倒放。`zoneId` 缺省时回落 `sceneId` 作为标识；两处都不写则该 Scene 不声明接管。

## 布局与堆叠

`layout.anchor` 决定场景在视口内的九宫格锚点；`layout.height` 的默认值随模式分叉——scroll 模式 `'auto'`（文档流自然高度），drag 模式 `'100vh'`（全屏栈）。`stack.mode` 同样随模式分叉：drag 默认 `'replace'`（新场景替换旧的），scroll 默认 `'cover'`（新场景覆盖旧的）。

## 常见误用

- **把 zone 当坐标或样式声明用**——它只声明时间轴所有权；布局归 `layout`，动画归内部 `Animate`。
- **两个 Scene 写同一个 `zoneId`**——上报 `INVALID_COMPONENT_HIERARCHY`，首个声明者胜出。
- **在 Scene 上做细粒度动画编排**——Scene 级 `transition` 只有进出场整块语义；逐元素编排（delay/waitFor/stagger）是 `Animate` 的职责。

---

完整字段参考见 [Scene API](/docs/scene-api)。
