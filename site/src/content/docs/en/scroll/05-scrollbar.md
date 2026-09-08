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
| `scrollbar={true}`               | **ineffective**, fails the object test, same as omitting it          |

`scrollbar={true}` is not supported. Use `scrollbar={{}}` to enable the default appearance.

When enabled, the framework injects CSS that hides the native scrollbar on the container (`scrollbar-width: none` plus zeroed `::-webkit-scrollbar`) and sets the container's `scrollbarGutter` to `auto`; when disabled the gutter is `stable`.

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
| `thumbHoverColor` | `string`  | `'rgba(255, 255, 255, 0.42)'` | none           | a 1px ring around the thumb (box-shadow), always present |
| `autoHide`        | `boolean` | `true`                        | none           | fade out when idle, see "autoHide timing"                |
| `ariaLabel`       | `string`  | `'CineView scroll position'`  | none           | accessible name of the rail                              |

`thumbHoverColor` colors the thumb's one-pixel border in every state. It does not change only on hover.

The thumb is at least 40px long, or the track length when shorter. The overlay is hidden when scrollable distance is at most one pixel. Its outer border, shadow, and focus outline are fixed.

The overlay's `z-index` is 80, above the fixed layer (20) and the active locked-zone shell (30).

## Drag and keyboard

The focusable scrollbar supports ArrowUp/ArrowDown, PageUp/PageDown, Space, Home, and End. Its steps match other keyboard scrolling; see [Input paths](/docs/03-inputs).

A gesture starting on the thumb becomes a drag; a press on empty rail is a single jump and starts no drag. The offsets a drag writes run through the same intent clamp as the other three paths, so dragging the bar cannot skip a locked segment either. Only one pointer owns the thumb at a time, and a second finger does not interrupt the first.

## CSS variable linkage

Color options accept CSS colors and custom-property references. For example, `thumbColor: 'var(--accent)'` follows the current value of `--accent`.

```tsx
<CineView
  mode="scroll"
  designWidth={1440}
  scrollbar={{
    enabled: true,
    width: 8,
    autoHide: true,
    trackColor: 'rgba(26, 24, 20, 0.06)',
    thumbColor: 'var(--accent)',
    thumbHoverColor: 'rgba(255, 255, 255, 0.9)',
  }}
>
  <Scene sceneId="content">Scrollable content</Scene>
</CineView>
```

## autoHide timing

The scrollbar appears over 80ms when scrolling begins. After 120ms without scroll input, it waits another 150ms and fades over 500ms.

Keyboard focus keeps it visible. These timings are not configurable.

## Related pages

- [The four input paths](/docs/03-inputs): the clamp shared by scrollbar drag and every other input
- [CineView reference](/docs/01-cineview): where `scrollbar` sits among the root props
- [Horizontal direction: 'x'](/docs/04-direction-x): the rail hugs the bottom rather than the right edge
