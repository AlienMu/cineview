---
title: Scene
eyebrow: COMPONENTS / SCENE
---

Scene is the chapter container: a CineView page is a stack of Scenes, each owning its layout, stacking, enter/exit transitions, and preloaded assets. In scroll mode, a Scene with `scroll` configured becomes a locked zone.

## Props

| prop            | type                                                               | default  | notes                                                                                |
| --------------- | ------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------ |
| `sceneId`       | `string`                                                           | none     | Scene identity, referenced by `preload`, callback details, and the `zoneId` fallback |
| `layout`        | object, see the layout section                                     | none     | Layout boundary and stacking                                                         |
| `transition`    | object, see the transition section                                 | none     | Scene-level enter/exit                                                               |
| `assets`        | `{ preloadImages?: string[] }`                                     | none     | Images preloaded with the scene                                                      |
| `drag`          | `SceneDragConfig`                                                  | none     | Per-scene drag mapping, see the drag section                                         |
| `scroll`        | `{ zoneId?: string; trigger?: 'center-lock' }`                     | none     | Scroll-mode only; **configuring `scroll` declares a locked zone**                    |
| `callbacks`     | `{ onVisibilityChange?: (detail: SceneVisibilityDetail) => void }` | none     | `detail = { sceneIndex?, visible, progress }`                                        |
| everything else | `HTMLAttributes<HTMLDivElement>` (except `children`)               | none     | Passed through to the scene root element                                             |
| `children`      | `ReactNode`                                                        | required | Scene content                                                                        |

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

| field            | type            | notes                                             |
| ---------------- | --------------- | ------------------------------------------------- |
| `enterAnimation` | `AnimationType` | Enter animation (preset name / Custom / Composed) |
| `exitAnimation`  | `AnimationType` | Exit animation                                    |
| `exitDuration`   | `number`        | Exit duration (ms)                                |

The scene-level `transition` is whole-scene enter/exit only; per-element timelines (delay / after / stagger) belong to [Animate](/docs/03-animate).

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

With `scroll` configured, this Scene declares itself a locked zone: a stretch of real scroll distance owned by its animation timeline, computed at `1ms = 1px`, so the inner Animate `duration` / `delay` in milliseconds is scroll px. Scrolling back through the segment replays 100%→0% on its own. Zone semantics: [Center-lock](/docs/01-centerlock).

A zone declares timeline ownership. It says nothing about animation style or coordinates. Two Scenes with the same `zoneId` create a duplicate zone identity and report `INVALID_COMPONENT_HIERARCHY`.

## Related pages

- [CineView](/docs/01-cineview): root component and callbacks
- [The two modes](/docs/01-modes): what a Scene means in drag vs scroll
- [Preloading](/docs/02-preload): how `assets.preloadImages` is queued
