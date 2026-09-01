---
title: Scrollbar theming
eyebrow: SCROLL / SCROLLBAR
---

Scroll mode ships a self-drawn scrollbar overlay. Enabling it hides the native gutter; the rail and thumb are plain DOM elements with full field-by-field theme customization.

## Only an object enables it

`scrollbar` is typed `false | ScrollbarConfig`, and the resolution rule is "`typeof scrollbar === 'object'` and `scrollbar.enabled !== false`":

| Written as                       | Result                                                               |
| -------------------------------- | -------------------------------------------------------------------- |
| prop omitted entirely            | nothing is injected: no overlay, the native scrollbar shows as usual |
| `scrollbar={{}}`                 | enabled, all defaults                                                |
| `scrollbar={{ enabled: false }}` | disabled                                                             |
| `scrollbar={false}`              | disabled                                                             |
| `scrollbar={true}`               | **ineffective**, fails the object test, same as omitting it          |

`scrollbar={true}` is a type error, but code that skips the type check (a JS caller, an `as any`) gets a silent no-op. To enable it, pass an object; the smallest form is `scrollbar={{}}`.

When enabled, the framework injects CSS that hides the native scrollbar on the container (`scrollbar-width: none` plus zeroed `::-webkit-scrollbar`) and sets the container's `scrollbarGutter` to `auto`; when disabled the gutter is `stable`.

## Fields and defaults

Every field listed here is resolved inside the overlay component, defaults applied, and clamps enforced.

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

The `thumbHoverColor` row is a case where the field name does not match the behavior: it is not a hover color, it is the thumb's permanent ring color, present in every interaction state. Implementing dynamic hover effects requires external CSS on an ancestor.

Three invariants are fixed by the engine: the thumb never shrinks below 40px (bounded by the rail when the rail is shorter); the overlay does not render at all when the content fits the viewport (scrollable span at or below 1px); and the rail's outer ring, drop shadow, and keyboard-focus outline are all fixed styling.

The overlay's `z-index` is 80, above the fixed layer (20) and the active locked-zone shell (30).

## Drag and keyboard

The rail carries `role="scrollbar"` and `tabIndex={0}`, so once focused it accepts arrow keys, PageUp/PageDown, Space, and Home/End, sharing the step table with the wheel path (see [The four input paths](/docs/03-inputs)).

A gesture starting on the thumb becomes a drag; a press on empty rail is a single jump and starts no drag. The offsets a drag writes run through the same intent clamp as the other three paths, so dragging the bar cannot skip a locked segment either. Only one pointer owns the thumb at a time, and a second finger does not interrupt the first.

## CSS variable linkage

Color strings are written verbatim into `background`, so any CSS color value works, including `var()` references. A custom property that other parts of the page rewrite live re-themes the thumb with zero JS coupling.

The site root does exactly this: the accent token is overwritten per scroll position by the background ribbon, and the thumb follows it frame by frame.

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
```

## autoHide timing

The fade is asymmetric on purpose: the bar snaps visible within 80ms of scrolling starting, then, after a 120ms idle timer flips the scrolling flag false, waits 0.15s and drifts out over 0.5s.

The asymmetry is a requirement, not a style preference. A single symmetric duration either fails to appear instantly, or, on a short scroll, never reaches full opacity before fading, because the visible window itself is only about 120ms. Keyboard focus on the rail keeps the bar visible regardless of scroll state. The timings are fixed, not configurable.

## Related pages

- [The four input paths](/docs/03-inputs): the clamp shared by scrollbar drag and every other input
- [CineView reference](/docs/01-cineview): where `scrollbar` sits among the root props
- [Horizontal direction: 'x'](/docs/04-direction-x): the rail hugs the bottom rather than the right edge
