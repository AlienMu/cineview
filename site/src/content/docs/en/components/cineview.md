---
title: CineView
eyebrow: ROOT
---

CineView selects the mode engine, provides the design-width context, schedules preload, and exposes imperative navigation.

## When to use

- The page organizes content into chapters (`Scene`) with enter/exit choreography between them, rather than being an ordinary scrolling document.
- You need drag (paged dragging, full-screen stack semantics) or scroll (real document-flow takeover with center-lock segments) as the root of the whole page.
- You want one site-wide design-draft ruler (`config.size`, width-only) or unified preload scheduling. Even without the scene stack, do not build a second ruler.

## Modes and the scrollbar

`mode` and `callbacks` form a discriminated union: passing a scroll callback in drag mode (or vice versa) is a type error, and both the inline-literal and the extracted-variable assignment paths are closed. Once the mode is chosen, the runtime dispatches to the matching engine. `CineView` is the single entry; both engines ship in the package, and UMD consumers who care about size can use the per-mode entries `cineview/drag` / `cineview/scroll`.

The scrollbar overlay is a scroll-mode option: passing an object enables it, and its full fields for thickness, radius, colors, inset, and autoHide live in the API reference. Beyond hiding the native bar, it also takes drag navigation and keyboard interaction.

## Ref API

The common methods `goToScene` / `refreshLayout` / `preload` / `getCurrentScene` / `getPerformanceMetrics` exist in both modes, covering everything from scene jumps to layout refreshes as imperative calls. `goToZone` is scroll-only and is required by `CineViewScrollRef`. How to obtain the ref and the full signatures live in the API reference.

## Common misuse

- **Passing `scroll` callbacks in drag mode** (or the reverse): the discriminated union reports a type error; it is not silently ignored at runtime.
- **Treating `config.size` as a zoom knob**: it is the draft basis, not a theme parameter. Changing the ruler changes the meaning of every design px.
- **Omitting `Scene` from `children`**: CineView recognizes only Scene children; zero of them reports `NO_SCENES`.

---

For the complete field reference see the [CineView API](/docs/cineview-api).
