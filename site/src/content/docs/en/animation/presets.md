---
title: Preset animations
eyebrow: CATALOG
---

CineView ships 43 preset animations, organized into 11 categories. A preset is referenced by its string name, type-checked at compile time, and loaded lazily by category.

## The catalog

The category of every preset is fixed by `animationCategoryMap` in `src/animations/presets/index.ts`; the names themselves are the `PresetAnimation` union in `src/types/index.ts`. Counts below are verified against both.

| Category | Presets | Count |
| --- | --- | --- |
| fade | `fade`, `fade-in`, `fade-out` | 3 |
| slide | `slide-up`, `slide-down`, `slide-left`, `slide-right` | 4 |
| zoom | `zoom-in`, `zoom-out`, `scale-up`, `scale-down` | 4 |
| rotate | `rotate`, `rotate-in`, `rotate-out`, `spin` | 4 |
| flip | `flip`, `flip-x`, `flip-y` | 3 |
| bounce | `bounce`, `bounce-in`, `bounce-out` | 3 |
| blink | `blink`, `flash`, `pulse` | 3 |
| shake | `shake`, `shake-x`, `shake-y`, `vibrate`, `jello` | 5 |
| blur | `blur-in`, `blur-out`, `focus-in` | 3 |
| elastic | `elastic`, `rubber-band`, `wobble`, `swing` | 4 |
| special | `heartbeat`, `tada`, `wave`, `roll-in`, `roll-out`, `hinge`, `jack-in-the-box` | 7 |
| **Total** | | **43** |

## Names are compile-checked

A preset name is not a loose string. It is a member of the `PresetAnimation` string union, and `AnimationType` (what `enterAnimation` / `exitAnimation` / `infiniteAnimation` accept) is `PresetAnimation | CustomAnimation | ComposedAnimation`. Passing a typo such as `"fade-i"` is a type error before it is ever a runtime error.

```tsx
<Animate
  animateId="title"
  enterAnimation="slide-up"
  exitAnimation="fade-out"
  duration={{ enter: 800, exit: 400 }}
>
  <h1>Opening title</h1>
</Animate>
```

The same name works for enter, exit, and infinite lanes — each lane resolves the name to its own `initial` / `animate` / `exit` variant record.

## What a preset actually is

Each preset resolves to a triple of variant records — `initial`, `animate`, `exit` — and **where the motion lives** decides what the preset is for:

- `-in` forms (e.g. `fade-in`, `bounce-in`, `roll-in`) put the motion on `animate`: `initial` is the hidden state, `animate` is the reveal, `exit` is a no-op holding the visible state. They are enter presets.
- `-out` forms (e.g. `fade-out`, `bounce-out`, `roll-out`) are the mirror: `initial`/`animate` hold still, the motion sits on `exit`. They are exit presets.
- Generic forms (`fade`, `bounce`, `flip`) have motion on both ends — a full round trip.

```tsx
// 'fade-in' as authored in src/animations/presets/fade.ts
{
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 1 },   // holds; 'fade-out' moves the motion here instead
}
```

One consequence for scrub lanes: presets may carry Framer transitions — `bounce` ships a spring (`type: 'spring', bounce: 0.5`). On time-driven lanes (visibility, drag arrival) the spring plays as authored; on scrub lanes (scroll takeover, drag element track) the runtime resolves values by position and ignores transition timing, so a spring preset reads as a linear sweep between its endpoints. Springy categories keep their character on time-driven lanes; for scrubbed enters prefer geometry presets (fade/slide/zoom/blur) or explicit keyframes.

## Lazy loading by category

Presets are not bundled into the main chunk. Each category lives in its own module (`fade.ts`, `slide.ts`, …) that is fetched with a dynamic `import()` the first time any of its presets is used, so an application that only fades and slides never downloads the elastic module.

The loading coordinator (`src/animations/presets/index.ts`) guarantees:

- **Shared across roots** — successful modules and permanent failures are cached process-wide, shared by every CineView instance on the page.
- **Coalesced requests** — concurrent requests for the same category reuse one in-flight promise instead of racing.
- **Timeout** — a category load that exceeds 3000 ms fails with `ANIMATION_ASSET_LOAD_FAILED`. This is a *transient* failure: it is never permanently cached, so a later request may retry.
- **Permanent failures** — an unknown preset name, an unknown category, or a preset missing from its category module fails with `INVALID_ANIMATION` and is cached permanently (the same name will not re-load until the cache is cleared).

## Failure reporting

Preset load failures surface through the CineView `onError` callback, not by crashing the tree. The two codes relevant to presets:

| Code | Meaning | Retryable |
| --- | --- | --- |
| `INVALID_ANIMATION` | Unknown preset name (or name missing from its category module). | No — permanent |
| `ANIMATION_ASSET_LOAD_FAILED` | Category chunk failed to load or timed out. | Yes — transient |

```tsx
<CineView
  mode="scroll"
  callbacks={{
    onError: (detail) => {
      if (detail.code === 'ANIMATION_ASSET_LOAD_FAILED') {
        // A category chunk failed; the next request for that category retries.
      }
    },
  }}
>
  <Scene sceneId="hero">
    <Animate enterAnimation="zoom-in">
      <div>Hero content</div>
    </Animate>
  </Scene>
</CineView>
```

## Choosing presets

Two practical notes for picking from the catalog:

- **Enter vs exit symmetry.** Many categories pair an enter-oriented and exit-oriented form (`fade-in` / `fade-out`, `bounce-in` / `bounce-out`, `roll-in` / `roll-out`); generic forms like `fade` and `bounce` cover the round trip. When you author a cascade, give exits the mirrored counterpart so the reverse pass reads as an intentional unwind (see the waitFor page for cascade choreography).
- **Attention presets belong on the infinite lane.** `blink`, `flash`, `pulse`, `heartbeat`, `tada`, `wave` and friends express continuous life. Author them via `infiniteAnimation`, which the runtime gates to the element's own phase and viewport visibility — a CSS `animation: … infinite` keeps running through exit and past unmount, which is exactly what the gating exists to prevent.

```tsx
<Animate
  animateId="rec-dot"
  enterAnimation="fade-in"
  infiniteAnimation={{ animate: { opacity: [1, 0.3, 1], transition: { duration: 1.2, repeat: Infinity } } }}
>
  <span className="rec-dot" />
</Animate>
```

## Where each category reads best

The catalog is free to mix — these are authoring habits, not API rules:

| Category | Reads best on |
| --- | --- |
| fade / slide / zoom / blur | Scrubbed enters and exits — pure geometry, position-driven. |
| rotate / flip | Enter accents; `spin` as a slow infinite on dials and reels. |
| bounce / elastic | Time-driven lanes (visibility, arrival) — the spring is the point. |
| blink / shake | Attention and reaction moments; `vibrate`/`jello` as short feedback. |
| special | Theatrical beats — `roll-in`/`hinge` for exits with personality, `heartbeat`/`tada`/`wave` on the infinite lane. |

A full scene mixing lanes, with the scrub span stated in real scroll px:

```tsx
<Scene sceneId="hero" scroll={{ zoneId: 'hero-seq', trigger: 'center-lock' }}>
  <Animate
    animateId="hero-bg"
    enterAnimation="zoom-in"
    duration={{ enter: 1600 }}
  >
    <div className="hero-bg" />
  </Animate>
  <Animate
    animateId="hero-title"
    enterAnimation="slide-up"
    exitAnimation="fade-out"
    duration={{ enter: 800, exit: 400 }}
    timeline={{ waitFor: 'hero-bg', delay: 200 }}
  >
    <h1>CineView</h1>
  </Animate>
</Scene>
```

When a preset's shape does not fit, the next page covers authoring custom variants.
