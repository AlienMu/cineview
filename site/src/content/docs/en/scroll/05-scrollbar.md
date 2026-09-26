---
title: Scrollbar theming
eyebrow: SCROLL / SCROLLBAR
---

Pass a `scrollbar` object in scroll mode to display a custom scrollbar. It replaces the native scrollbar and supports track, thumb, size, and color options.

## Only an object enables it

Use an object to enable the scrollbar and `false` to disable it:

| Written as                       | Result                                                               |
| -------------------------------- | -------------------------------------------------------------------- |
| prop omitted entirely            | nothing is injected: no overlay, the native scrollbar shows as usual |
| `scrollbar={{}}`                 | enabled, all defaults                                                |
| `scrollbar={{ enabled: false }}` | disabled                                                             |
| `scrollbar={false}`              | disabled                                                             |
| `scrollbar={true}`               | TypeScript error; in JavaScript, same as omitting it                 |

Use `scrollbar={{}}` to enable the default appearance.

When enabled, Cineview hides the native scrollbar. When disabled, the native scrollbar remains visible.

## Fields and defaults

The overlay uses these defaults and limits:

| Field             | Type      | Default                       | Clamp          | Renders as                                               |
| ----------------- | --------- | ----------------------------- | -------------- | -------------------------------------------------------- |
| `enabled`         | `boolean` | `true`                        | none           | overlay on/off, see "Only an object enables it"          |
| `width`           | `number`  | `6`                           | floored at `4` | rail and thumb thickness (px)                            |
| `radius`          | `number`  | `999`                         | floored at `0` | rail and thumb corner radius (px)                        |
| `inset`           | `number`  | `0`                           | floored at `0` | gap from the scroll container edge (px)                  |
| `trackColor`      | `string`  | `'transparent'`               | none           | the rail's `background`                                  |
| `thumbColor`      | `string`  | `'rgba(255, 255, 255, 0.28)'` | none           | the thumb's `background`                                 |
| `thumbHoverColor` | `string`  | same as `thumbColor`          | none           | thumb fill while the pointer hovers over it              |
| `autoHide`        | `boolean` | `true`                        | none           | fade out when idle, see "autoHide timing"                |
| `ariaLabel`       | `string`  | `'CineView scroll position'`  | none           | accessible name of the rail                              |

The rail and thumb have no border by default. `thumbHoverColor` changes the thumb fill only while the pointer hovers over it.

The thumb is at least 40px long, or the track length when shorter. The overlay is hidden when scrollable distance is at most one pixel. Keyboard focus keeps a separate visible outline.

The overlay's `z-index` is 80, above the fixed layer (20) and the active locked-zone shell (30).

## Drag and keyboard

The focusable scrollbar supports ArrowUp/ArrowDown, PageUp/PageDown, Space, Home, and End. Its steps match other keyboard scrolling; see [Input paths](/docs/03-inputs).

A gesture starting on the thumb drags it; pressing the empty rail jumps once. Dragging the bar passes through the same zone limits as other input, so it cannot skip a locked zone. A second finger does not interrupt a thumb drag.

## CSS variable linkage

Color options accept CSS colors and custom-property references. For example, `thumbColor: 'var(--accent)'` follows the current value of `--accent`.

```tsx
<Cineview
  mode="scroll"
  designWidth={1440}
  scrollbar={{
    enabled: true,
    width: 8,
    autoHide: true,
    trackColor: 'rgba(26, 24, 20, 0.06)',
    thumbColor: 'var(--accent)',
  }}
>
  <Scene sceneId="content">Scrollable content</Scene>
</Cineview>
```

## autoHide timing

The scrollbar appears over 80ms when scrolling begins. After 120ms without scroll input, it waits another 150ms and fades over 500ms.

Keyboard focus keeps it visible. These timings are not configurable.

## Related pages

- [The four input paths](/docs/03-inputs): the clamp shared by scrollbar drag and every other input
- [Cineview reference](/docs/01-cineview): where `scrollbar` sits among the root props
- [Horizontal direction: 'x'](/docs/04-direction-x): the rail hugs the bottom rather than the right edge
