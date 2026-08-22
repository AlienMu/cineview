---
title: Scene
eyebrow: CHAPTER
---

Scene is the chapter boundary for layout, assets, visibility callbacks, and scene-scoped fixed layers.

## Scroll zone

A scroll zone declares timeline ownership. It does not declare animation style or a virtual coordinate system.

```tsx
<Scene
  sceneId="hero-sequence"
  layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
  scroll={{ zoneId: 'hero-sequence', trigger: 'center-lock' }}
>
  <Position layer={{ fixed: true }}>...</Position>
</Scene>
```

## Props

Every field and default below is checked against `SceneProps` in `src/types/index.ts` and the Scene implementation. `Scene` also accepts native `div` attributes (`Omit<HTMLAttributes, 'children'>`).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `sceneId` | `string` | — | Unique chapter identifier. In scroll mode it serves as a string `preload` target and falls back as the zone identity when `scroll.zoneId` is omitted. |
| `layout.width` | `number \| string` | `'100vw'` | Scene width. Numbers are design px converted through the single ruler. |
| `layout.height` | `number \| string` | `'auto' / '100vh'` | Scene height. Defaults to `'auto'` (natural content height) in scroll mode and `'100vh'` in drag mode. |
| `layout.anchor` | `SceneAnchor` | `'top-left'` | Scene anchor within the viewport; nine grid positions (e.g. `'top-left'`, `'center'`). |
| `layout.overflow` | `'hidden' \| 'visible' \| 'clip'` | `'hidden'` | Overflow strategy of the scene container. |
| `stack.mode` | `'replace' \| 'cover'` | `'replace' / 'cover'` | Scene stacking semantics. Defaults to `'replace'` in drag mode and `'cover'` in scroll mode. |
| `stack.zIndex` | `number` | — | Scene stacking order. |
| `transition.enterAnimation` | `AnimationType` | — | Scene-level enter animation (preset name / custom variant / composed). |
| `transition.exitAnimation` | `AnimationType` | — | Scene-level exit animation. |
| `transition.exitDuration` | `number` | `800` | Scene exit/switch duration (ms). |
| `assets.preloadImages` | `string[]` | — | Declared scene images. The active scene's images (drag) or the first scene's (scroll) go into the first-screen priority queue; the rest go to the background queue. |
| `drag.enabled` | `boolean` | `true` | Whether this Scene may become a drag target (drag mode only). |
| `drag.unit` | `'time' \| 'percent'` | `'time'` | Drag mapping unit for this scene. Providing either `unit` or `scale` stops inheriting the root `modes.drag` mapping. |
| `drag.scale` | `number` | `10 / 1` | Milliseconds per 1% of drag progress under `time` (default `10`); percent of the compiled timeline under `percent` (default `1`). |
| `scroll.zoneId` | `string` | — | Declares this Scene a scroll takeover zone and sets its identity; falls back to `sceneId` when omitted. |
| `scroll.trigger` | `'center-lock'` | `'center-lock'` | Zone trigger model (currently the only value). |
| `callbacks.onVisibilityChange` | `(detail: SceneVisibilityDetail) => void` | — | Fires when the scene enters/leaves the viewport, carrying `visible` and `progress`. |
| `children` | `ReactNode` | `required` | Chapter content. |
