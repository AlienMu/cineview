---
title: Scene
eyebrow: API REFERENCE
---

`<Scene>` is the chapter boundary: layout, assets, the visibility callback, and scene-scoped fixed layers are all owned at this level. This page is the complete field reference; usage and tutorials live in the [Scene guide](/docs/scene).

## Props

Every field and default below is checked against `SceneProps` in `src/types/index.ts` and the Scene implementation. `Scene` also accepts native `div` attributes (`Omit<HTMLAttributes, 'children'>`).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `sceneId` | `string` | — | Unique chapter identifier. In scroll mode it serves as a string `preload` target and falls back as the zone identity when `scroll.zoneId` is omitted. |
| `layout.width` | `number \| string` | `'100vw'` | Scene width. Numbers are design px converted through the single ruler. |
| `layout.height` | `number \| string` | `'auto' / '100vh'` | Scene height. Defaults to `'auto'` (natural content height) in scroll mode and `'100vh'` in drag mode. |
| `layout.anchor` | `SceneAnchor` | `'top-left'` | Scene anchor within the viewport; nine grid positions (see the type table below). |
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
| `callbacks.onVisibilityChange` | `(detail: SceneVisibilityDetail) => void` | — | Fires when the scene enters/leaves the viewport — see the dedicated section below. |
| `children` | `ReactNode` | `required` | Chapter content. |

## Callbacks: onVisibilityChange

Fires when the scene enters/leaves the viewport, with a `SceneVisibilityDetail` payload:

| Field | Type | Description |
| --- | --- | --- |
| `visible` | `boolean` | Whether the scene is currently inside the viewport. |
| `progress` | `number` | Scene visibility progress `0..1`. |
| `sceneIndex` | `number` | (optional) Scene index — carried on the root-level aggregate path; may be absent on the Scene's own declarative path. |

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

Two caveats:

- **This is an event callback, not a render-state source.** `progress` changes frame by frame with the scroll; setting state on it directly re-renders the whole host every frame, so renderers that need the progress should use `useAnimateTimeline()` (see [its page](/docs/use-animate-timeline-api)).
- **Same source and payload as the root-level `onSceneVisibilityChange`.** In scroll mode, one visibility event fans out to both the Scene-level callback and the root-level `callbacks.onSceneVisibilityChange`: declared on the Scene it fires for this scene only, declared on the root it fires for every scene. Do not do heavy work in both places.

## Types

### SceneAnchor

The nine values of `layout.anchor`, gridded against the viewport:

| Value | Meaning |
| --- | --- |
| `'top-left'` | Top-left (default) |
| `'top-center'` | Top-center |
| `'top-right'` | Top-right |
| `'center-left'` | Middle-left |
| `'center'` | Dead center |
| `'center-right'` | Middle-right |
| `'bottom-left'` | Bottom-left |
| `'bottom-center'` | Bottom-center |
| `'bottom-right'` | Bottom-right |

### SceneStackMode

The two values of `stack.mode`: `'replace'`: the new scene replaces the old (drag default; the old scene unmounts from rendering after exit); `'cover'`: the new scene covers the old (scroll default; document-flow semantics).

### Shared types

- `AnimationType` (the type of `transition.enterAnimation` / `exitAnimation`) → [type dictionary](/docs/types); the preset-name catalogue → [animation presets](/docs/presets)
- Field-by-field `SceneVisibilityDetail` (including the root-level difference) → [type dictionary](/docs/types)
- `SceneTimelinePhase` (the five-state phase vocabulary for scroll scenes) → [type dictionary](/docs/types)

## FAQ

**What if `scroll.zoneId` is omitted?**
It falls back to `sceneId` as the zone identity. With neither authored the Scene declares no takeover zone (in scroll mode its content scrolls as ordinary document flow, and inner `Animate` elements take the visibility lane).

**Two Scenes declare the same `zoneId`?**
An `INVALID_COMPONENT_HIERARCHY` error is reported (recoverable, payload carrying `ownerSceneIndex` / `rejectedSceneIndex`); unhandled, the first declarant wins and the later declaration is rejected.

**The inheritance rule for `drag.unit` / `drag.scale`?**
Providing either field explicitly stops inheriting the root `modes.drag` mapping; with neither, the whole group is inherited. Overriding only `scale` also detaches `unit` from inheritance; to keep the default unit, write `unit: 'time'` explicitly.

**Who decides the scene height?**
`layout.height`. Defaults to `'auto'` (natural content height, document-flow semantics) in scroll mode and `'100vh'` (full-screen stack semantics) in drag mode; `modes.scroll.sceneSizing` is the scroll-side global switch (`'content'` / `'screen'`).

