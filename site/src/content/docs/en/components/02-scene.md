---
title: Scene
eyebrow: COMPONENTS / SCENE
---

Scene groups content that shares layout, transitions, and preloaded assets. Declare Scenes directly inside Cineview. In scroll mode, `scroll` declares a locked zone that holds the Scene in place during its animation. Each 1ms of authored animation adds 1px of real scroll distance. A zone with no participating entrance or exit adds no animation distance. An entrance explicitly set to `duration.enter: 0` still occupies at least 1px.

## Props

| prop            | type                                                               | default  | notes                                                             |
| --------------- | ------------------------------------------------------------------ | -------- | ----------------------------------------------------------------- |
| `sceneId`       | `string`                                                           | none     | Target for `preload`; fallback identifier for `scroll.zoneId`     |
| `layout`        | object, see the layout section                                     | none     | Layout boundary and stacking                                      |
| `transition`    | object, see the transition section                                 | none     | Scene-level enter/exit                                            |
| `assets`        | `{ preloadImages?: string[] }`                                     | none     | Images preloaded with the scene                                   |
| `drag`          | `SceneDragConfig`                                                  | none     | Per-scene drag mapping, see the drag section                      |
| `scroll`        | `{ zoneId?: string }`                                              | none     | Scroll-mode only; **configuring `scroll` declares a locked zone** |
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
  scroll={{ zoneId: 'hero-seq' }}
>
  ...
</Scene>
```

### layout

| field      | type                              | default                              | notes                                                                |
| ---------- | --------------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| `width`    | `number \| string`                | `'100vw'`                            | Scene width                                                          |
| `height`   | `number \| string`                | drag: `'100vh'`; scroll: `'auto'`    | Content box height; does not change the fixed drag navigation height |
| `anchor`   | `SceneAnchor`                     | `'top-left'`                         | Nine-grid anchor                                                     |
| `overflow` | `'hidden' \| 'visible' \| 'clip'` | `'hidden'`                           | Overflow handling                                                    |
| `overlap`  | `SceneStackMode`                  | drag: `'replace'`; scroll: `'cover'` | New scene replaces the old or covers it                              |
| `zIndex`   | `number`                          | none                                 | Stacking z-order                                                     |

In drag mode, each Scene's navigation height is fixed at one viewport (`100vh`) and cannot be changed with `layout.height`. That field sizes only the inner content box; a taller box does not create native vertical scrolling. Numeric `layout.width` and `layout.height` are CSS px; `designWidth` does not scale them. Use scroll mode or more Scenes for long content. See [Drag scene layout](/docs/01-layout).

Scroll uses only the horizontal part of `anchor`. In drag mode, `overlap` does not change the transition. `zIndex` orders content within a scene frame; the framework orders the frames.

`SceneStackMode` values: `'replace' \| 'cover'`.

Nine-grid values: `top-left / top-center / top-right / center-left / center / center-right / bottom-left / bottom-center / bottom-right`.

### transition

| field            | type            | notes                                                                           |
| ---------------- | --------------- | ------------------------------------------------------------------------------- |
| `enterAnimation` | `AnimationType` | Whole-scene entrance in scroll mode                                             |
| `exitAnimation`  | `AnimationType` | Whole-scene exit in scroll mode                                                 |
| `exitDuration`   | `number`        | Scene exit timing in ms; see [Drag layout](/docs/01-layout) for its drag effect |

Scene transitions affect the whole scene. Composed animations supply merged property values; their `sequential` steps and `delays` do not create timed stages in the transition. In drag mode, configure element entrance and exit on [Animate](/docs/03-animate); Scene entrance and exit variants are ignored.

### drag

Use `drag.unit` and `drag.scale` to adjust how drag distance changes this Scene's animation progress. Omitting both fields inherits the Cineview configuration. Declaring either field makes the other use its per-Scene default: `'time'` for `unit`, and `10` or `1` for time or percent `scale`.

| field     | type                  | default                   | notes                                        |
| --------- | --------------------- | ------------------------- | -------------------------------------------- |
| `enabled` | `boolean`             | `true`                    | Whether this scene can be a drag target      |
| `unit`    | `'time' \| 'percent'` | `'time'`                  | Mapping unit                                 |
| `scale`   | `number`              | `time: 10` / `percent: 1` | Milliseconds / percent mapped per 1% of drag |

```tsx
<Scene drag={{ unit: 'percent', scale: 1 }}>
  <Animate enterAnimation="slide-up" duration={{ enter: 1200 }}>
    <h2>Drag to reveal the content</h2>
  </Animate>
</Scene>
```

Dragging by 1% of the viewport span advances this Scene's element timeline by 1%. For gesture thresholds and nested controls, see [Gestures](/docs/02-gestures). For custom drawing, see [useAnimateTimeline](/docs/09-use-animate-timeline).

### scroll

| field    | type     | default                                  | notes         |
| -------- | -------- | ---------------------------------------- | ------------- |
| `zoneId` | `string` | falls back to `sceneId`, then an auto id | Zone identity |

Scene-driven child animations determine the locked zone's duration budget at `1ms = 1px`. Reverse scrolling reverses their progress. A loop-only scene has no animation travel; see [Zones and scroll budgets](/docs/02-zones-budget).

Use a unique `zoneId` for each zone. A duplicate reports `INVALID_COMPONENT_HIERARCHY`, and the later scene becomes ordinary scrolling content.

## Related pages

- [Cineview](/docs/01-cineview): root component and callbacks
- [The two modes](/docs/01-modes): what a Scene means in drag vs scroll
- [Preloading](/docs/02-preload): declare image and video resources
