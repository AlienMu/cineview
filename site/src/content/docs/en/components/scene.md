---
title: Scene
eyebrow: CHAPTER
---

Scene is the chapter boundary for layout, assets, visibility callbacks, and scene-scoped fixed layers.

## When to use

- The content splits into acts: each act has its own layout anchor, enter/exit choreography, and asset declarations, rather than being a stretch of one long canvas.
- In scroll mode you need a takeover zone — a stretch of real scroll distance owned by this chapter's animation timeline (the center-lock model).
- You need the scene-level visibility signal (`callbacks.onVisibilityChange`) or a scene-scoped fixed-layer host.

## Scroll zone

A scroll zone declares timeline ownership. It does not declare animation style or a virtual coordinate system.

```tsx
<Scene
  sceneId="hero-sequence"
  layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
  scroll={{ zoneId: 'hero-sequence', trigger: 'center-lock' }}
>
  <Position layer={{ fixed: true }}>...</Position>
</Scene>
```

A Scene with `scroll.zoneId` declares itself a takeover zone: the zone span converts to real scroll distance at `1ms = 1px` (an `Animate` `duration`/`delay` here is scroll px), and while scrolling through it the viewport is locked inside the segment, driving the inner animations frame by frame — scrolling back plays them backward naturally. When `zoneId` is omitted, `sceneId` falls back as the identity; with neither authored the Scene declares no takeover.

## Layout and stacking

`layout.anchor` sets the scene's nine-grid anchor within the viewport; the `layout.height` default forks by mode — `'auto'` (natural document-flow height) in scroll mode, `'100vh'` (full-screen stack) in drag mode. `stack.mode` forks the same way: drag defaults to `'replace'` (the new scene replaces the old), scroll to `'cover'` (the new scene covers the old).

## Common misuse

- **Using a zone as a coordinate or style declaration** — it only declares timeline ownership; layout belongs to `layout`, animation to the inner `Animate`.
- **Two Scenes sharing one `zoneId`** — reports `INVALID_COMPONENT_HIERARCHY`; the first declarant wins.
- **Doing fine-grained animation choreography on Scene** — the scene-level `transition` is whole-scene enter/exit only; per-element orchestration (delay/waitFor/stagger) is `Animate`'s job.

---

For the complete field reference see the [Scene API](/docs/scene-api).
