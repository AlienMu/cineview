---
title: Scene
eyebrow: COMPONENTS / SCENE
---

Scene groups content that shares layout, transitions, and preloaded assets. Declare Scenes directly inside CineView. In scroll mode, `scroll` adds a locked-zone declaration; a non-zero animation budget gives it locked travel.

## Props

| prop            | type                                                               | default  | notes                                                             |
| --------------- | ------------------------------------------------------------------ | -------- | ----------------------------------------------------------------- |
| `sceneId`       | `string`                                                           | none     | Target for `preload`; fallback identifier for `scroll.zoneId`     |
| `layout`        | object, see the layout section                                     | none     | Layout boundary and stacking                                      |
| `transition`    | object, see the transition section                                 | none     | Scene-level enter/exit                                            |
| `assets`        | `{ preloadImages?: string[] }`                                     | none     | Images preloaded with the scene                                   |
| `drag`          | `SceneDragConfig`                                                  | none     | Per-scene drag mapping, see the drag section                      |
| `scroll`        | `{ zoneId?: string; trigger?: 'center-lock' }`                     | none     | Scroll-mode only; **configuring `scroll` declares a locked zone** |
| `callbacks`     | `{ onVisibilityChange?: (detail: SceneVisibilityDetail) => void }` | none     | `detail = { sceneIndex?, visible, progress }`                     |
| everything else | `HTMLAttributes<HTMLDivElement>` (except `children`)               | none     | Passed through to the scene root element                          |
| `children`      | `ReactNode`                                                        | required | Scene content                                                     |

```tsx
<Scene
  sceneId="hero"
  layout={{
    width: '100%',
    height: '100vh',
    anchor: 'top-center',
    overflow: 'hidden',
    overlap: 'replace',
    zIndex: 1,
  }}
  transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out', exitDuration: 400 }}
  assets={{ preloadImages: ['/hero.jpg'] }}
  scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}
>
  ...
</Scene>
```

### layout

| field      | type                              | default                              | notes                                                                              |
| ---------- | --------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| `width`    | `number \| string`                | `'100vw'`                            | Scene width                                                                        |
| `height`   | `number \| string`                | drag: `'100vh'`; scroll: `'auto'`    | Scene height. In scroll mode it defaults to content height (natural document flow) |
| `anchor`   | `SceneAnchor`                     | `'top-left'`                         | Nine-grid anchor                                                                   |
| `overflow` | `'hidden' \| 'visible' \| 'clip'` | `'hidden'`                           | Overflow handling                                                                  |
| `overlap`  | `SceneStackMode`                  | drag: `'replace'`; scroll: `'cover'` | New scene replaces the old or covers it                                            |
| `zIndex`   | `number`                          | none                                 | Stacking z-order                                                                   |

`SceneStackMode` values: `'replace' \| 'cover'`.

Nine-grid values: `top-left / top-center / top-right / center-left / center / center-right / bottom-left / bottom-center / bottom-right`.

### transition

| field            | type            | notes                                                                           |
| ---------------- | --------------- | ------------------------------------------------------------------------------- |
| `enterAnimation` | `AnimationType` | Whole-scene entrance in scroll mode                                             |
| `exitAnimation`  | `AnimationType` | Whole-scene exit in scroll mode                                                 |
| `exitDuration`   | `number`        | Scene exit timing in ms; see [Drag layout](/docs/01-layout) for its drag effect |

Scene transitions affect the whole scene. In drag mode, configure element entrance and exit on [Animate](/docs/03-animate); Scene entrance and exit variants are ignored.

### drag

Per-scene drag mapping; overrides the root's `unit` / `scale`.

| field     | type                  | default                   | notes                                        |
| --------- | --------------------- | ------------------------- | -------------------------------------------- |
| `enabled` | `boolean`             | `true`                    | Whether this scene can be a drag target      |
| `unit`    | `'time' \| 'percent'` | `'time'`                  | Mapping unit                                 |
| `scale`   | `number`              | `time: 10` / `percent: 1` | Milliseconds / percent mapped per 1% of drag |

### scroll

| field     | type            | default                                  | notes            |
| --------- | --------------- | ---------------------------------------- | ---------------- |
| `zoneId`  | `string`        | falls back to `sceneId`, then an auto id | Zone identity    |
| `trigger` | `'center-lock'` | `'center-lock'`                          | The only trigger |

Scene-driven child animations determine the locked zone's duration budget at `1ms = 1px`. Reverse scrolling reverses their progress. A loop-only scene has no animation travel; see [Zones and scroll budgets](/docs/02-zones-budget).

Use a unique `zoneId` for each zone. A duplicate reports `INVALID_COMPONENT_HIERARCHY`, and the later scene becomes ordinary scrolling content.

## Related pages

- [CineView](/docs/01-cineview): root component and callbacks
- [The two modes](/docs/01-modes): what a Scene means in drag vs scroll
- [Preloading](/docs/02-preload): how `assets.preloadImages` is queued
