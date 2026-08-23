---
title: CineView
eyebrow: ROOT
---

CineView selects the mode engine, provides the design-width context, schedules preload, and exposes imperative navigation.

## When to use

- You want a cinematic narrative page — content organized into chapters (`Scene`) with enter/exit choreography between them — rather than an ordinary scrolling document.
- You need one of the two mode engines — drag (paged dragging, full-screen stack semantics) or scroll (real document-flow takeover with center-lock segments) — as the root of the whole page.
- You want one site-wide design-draft ruler (`config.size`, width-only) or unified preload scheduling — even without the scene stack, do not build a second ruler.

## Modes and the scrollbar

`mode` and `callbacks` form a discriminated union: passing a scroll callback in drag mode (or vice versa) is a type error — both the inline-literal and the extracted-variable assignment paths are closed. Once the mode is chosen, the runtime dispatches to the matching engine (`CineView` is the single entry; both engines ship in the package — UMD consumers who care about size can use the per-mode entries `cineview/drag` / `cineview/scroll`).

The scrollbar overlay is a scroll-mode option: passing an object enables it; theming (thickness / radius / colors / inset) and the autoHide behaviour are covered field-by-field in the API reference. Beyond hiding the native bar, it also takes drag navigation and keyboard interaction.

## Ref API

The common methods are always available. goToZone is scroll-only and is required by CineViewScrollRef.

```tsx
const ref = useRef<CineViewScrollRef>(null);

ref.current?.goToScene(2, true);
ref.current?.goToZone('sequence', { animated: true });
ref.current?.refreshLayout();
ref.current?.preload(['hero']);
```

## Common misuse

- **Passing `scroll` callbacks in drag mode** (or the reverse) — the discriminated union reports a type error; it is not silently ignored at runtime.
- **Treating `config.size` as a zoom knob** — it is the draft basis, not a theme parameter; changing the ruler changes the meaning of every design px.
- **Omitting `Scene` from `children`** — CineView recognizes only Scene children; zero of them reports `NO_SCENES`.

---

For the complete field reference see the [CineView API](/docs/cineview-api).
