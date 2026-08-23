---
title: Scrollbar theming
eyebrow: OVERLAY
---

Scroll mode ships a self-drawn scrollbar overlay. Enabling it hides the native gutter; the rail and thumb are plain DOM whose look is yours to theme field by field.

## Fields and defaults

Every field below is resolved inside the overlay component, defaults applied and clamps enforced.

| Field | Default | Clamp | Renders as |
| --- | --- | --- | --- |
| `enabled` | `true` | — | Overlay on/off. Passing the `scrollbar` object at all enables it; only `enabled: false` inside the object disables it. |
| `width` | `6` | floored at `4` | Rail and thumb thickness (px). |
| `radius` | `999` | floored at `0` | Rail and thumb corner radius (px). |
| `inset` | `0` | floored at `0` | Gap from the scroll container edge (px). |
| `trackColor` | `'transparent'` | — | Rail background. |
| `thumbColor` | `'rgba(255, 255, 255, 0.28)'` | — | Thumb background. |
| `thumbHoverColor` | `'rgba(255, 255, 255, 0.42)'` | — | A 1px ring around the thumb (box-shadow), always present. |
| `autoHide` | `true` | — | Fade the bar out when idle (see below). |
| `ariaLabel` | `'CineView scroll position'` | — | Accessible name of the rail. |

Two limits are fixed rather than configurable: the thumb never shrinks below 40px of rail length, and the overlay unmounts entirely when the content fits the viewport (scrollable span at or below 1px). The rail's outer ring and drop shadow, and the keyboard-focus outline, are also fixed styling.

## CSS variable linkage

Color strings are written verbatim into `background`, so any CSS color value works, including `var()` references. A custom property that other parts of the page rewrite live re-themes the thumb with zero JS coupling.

The site root does exactly this: the accent token is overwritten per scroll position by the background ribbon, and the thumb follows it frame by frame.

```tsx
<CineView
  mode="scroll"
  config={{ size: 1440 }}
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

The fade is asymmetric on purpose: the bar snaps visible within 80ms of scrolling starting, then, after a 120ms idle timer flips the scrolling flag false, waits 0.15s and drifts out over 0.5s. A single symmetric duration cannot both appear instantly and linger after a short scroll. Keyboard focus on the rail keeps the bar visible regardless. The timings are fixed, not configurable.
