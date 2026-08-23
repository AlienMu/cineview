---
title: Scene-scoped fixed layers
eyebrow: FIXED
---

In scroll mode, `Position`'s `layer.fixed` has one fixed meaning: the **scene-scoped fixed layer**. A pinned layer belongs only to the Scene that declares it; visibility, clipping, and release all key off the scene boundary, and it never floats across chapters. This is the framework's ruling on the word "fixed" — not a bare passthrough of browser semantics, but pinning with an ownership boundary.

This page covers the rules, boundaries, and common traps of that semantics; the full `Position` props (coordinates, anchors, the relative chain) live on the Position page in the components group.

## Declaring a fixed layer

```tsx
<CineView mode="scroll" config={{ size: 750 }}>
  <Scene sceneId="chapter-2" layout={{ width: '100%', height: '240vh' }}>
    {/* Pinned caption: design-viewport coordinates, held while the scene is in view. */}
    <Position at={{ x: 0, y: 90, anchor: 'center-x' }} layer={{ fixed: true }}>
      <Container width={640} height={72}>
        <h3>Chapter 2 — pinned caption</h3>
      </Container>
    </Position>

    <Container width={640} height={1600}>
      <p>The chapter body scrolls through the scene while the caption holds still.</p>
    </Container>
  </Scene>
</CineView>
```

Coordinates are design px against the design viewport (converted through the `config.size` single ruler), and `x` / `y` are never reinterpreted when the host's clip height changes. The `at.anchor` centering anchors work as usual; a fixed layer shares the same coordinate system as any other Position.

Note that chapter-2 above is not a takeover scene: the scene-scoped fixed host mounts for every Scene in scroll mode, and ordinary document-flow scenes can pin titles, progress marks, or corner badges the same way. When the scene scrolls out of the viewport, the layer is clipped and released at the scene boundary, so it cannot scroll into the next chapter.

## Resolution: three cases

The final behavior of `layer.fixed` depends on context:

| Case                          | Resolution                                                          |
| ----------------------------- | ------------------------------------------------------------------- |
| scroll mode + inside a Scene  | portals into that Scene's fixed host — the standard scene-scoped behavior |
| scroll mode + no Scene host   | degrades to `position: sticky` pinning                              |
| drag mode                     | no scene-scoped semantics; renders as in-scene positioning (scenes are full-viewport replacements anyway) |

The third case is not worth relying on: under drag, scenes are full-viewport page swaps with no document-flow scrolling, so "pinning" carries no distinct meaning. The semantic difference exists only in scroll mode, and `layer.fixed` is worth writing only there.

## When to use a fixed layer

The right use for a fixed layer is **chapter-level pinned UI**: titles, chapter numbers, corner badges, decorative HUDs pinned to this chapter. The test is "should this thing live and die with this chapter". If yes, use a fixed layer; its visibility, clipping, and release will align with the scene boundary automatically.

Two kinds of needs should not use fixed layers:

- **Cross-chapter persistent UI** (site nav, language switch, global progress bar): these belong to no scene. Implement them outside CineView with plain React/CSS; ordinary DOM outside the framework is naturally full-screen fixed and untouched by any scene lifecycle.
- **Frame-by-frame scrub visuals** (scroll-erased sequences, scrubbed graphics): that is the job of `Animate`'s scrub semantics or a `useAnimateTimeline()` custom renderer. A fixed layer answers "where is it pinned", not "how does it move". Mixing both into a hand-written fixed layer means rebuilding an animation driver outside the framework.

The one-line test: **placement problems use fixed layers, animation problems use Animate, cross-chapter UI lives outside the framework**.

## Scope rules

The boundary rules of scene-scoped fixed layers are fixed as follows:

1. A layer belongs only to its own scene.
2. A layer is only visible within its own scene's visible range.
3. A layer must not follow into the next scene.
4. Fixed layers of different scenes must not enter the same visible overlay domain.
5. The fixed host owns ownership, visibility clipping, and scene-boundary release.
6. The design coordinate frame stays the design viewport; `x / y` are never reinterpreted by the host's clip height.
7. When the scene releases at its bottom, the layer stops at the boundary position inside the scene instead of following into the next scene.

The framework's fixed host enforces these rules; there is no author-facing switch to loosen them, and no "let this layer drift one extra chapter" parameter exists.

## Why layers never float across scenes

The chapter is the ownership boundary. If fixed layers could float across scenes, two classes of breakage appear:

- **Stale content lingering**: chapter 1's pinned title covering chapter 3's body, leaving the reader looking at UI from a chapter that already ended.
- **Overlay-domain collisions**: the fixed layers of two adjacent scenes entering the same visible overlay domain at once, where stacking order is decided by mount order rather than author intent, with unpredictable results.

Scene-scoped semantics removes both: the layer lives and dies with its scene, and visibility has exactly one rule, "is my scene in the viewport". For authors this also keeps the mental model minimal: every scene is a self-contained stage; the pinned things belong to the stage and leave with it at curtain fall.

## Why fixed degrades inside a takeover scene

One constraint deserves its own headline: **hand-written `position: fixed` inevitably degrades inside a takeover scene**.

The shell of a takeover scene (one with a `Scene.scroll` declaration, entering center-lock) always carries a transform and moves with the scrub. And per the CSS specification, `position: fixed` inside a transformed ancestor positions relative to that ancestor, not the viewport. The result is "pinning" that pins to a moving container: visually identical to absolute, plus offset bugs that are hard to trace.

There are two correct routes. The first is this page's `layer.fixed`: the framework portals the layer into the scene's own fixed host and restores the pinning semantics for you. The second is to avoid fixed entirely, with a full-viewport scene plus an absolutely positioned overlay:

```tsx
{/* Inside a takeover scene the shell always carries a transform:
    raw CSS position: fixed pins to the transformed ancestor, not the viewport.
    The full-bleed pattern is a 100vh scene plus an absolute inset layer. */}
<Scene
  sceneId="hero"
  layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
  scroll={{ zoneId: 'hero', trigger: 'center-lock' }}
>
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    <Overlay />
  </div>
</Scene>
```

The trade-off: `layer.fixed` gives you the design-viewport coordinate system and automatic boundary clipping; the absolute inset overlay gives you full manual control (good for full-screen overlays, masks, light effects), at the cost of keeping it inside the scene's `overflow: hidden` yourself.

Using `layer.fixed` inside a takeover scene carries one framework-level guarantee as well: for the whole time scene progress is being consumed, the Scene shell and the scene-scoped fixed layer must stay within the viewport. However the center-lock segment scrubs, the pinned layer never vanishes or jumps out of view. It follows the zone's frame, not the raw document-flow position. That guarantee makes "a takeover chapter with a pinned HUD" a safe combination, with no author-side visibility compensation needed.

## Where z-index lives

A sibling discipline with the same root: the wrappers of Animate and Position always carry a transform, and a transform creates a stacking context, so **a child's `z-index` is dead code**. It has no effect; the stacking relationship is decided by the wrapper. The only valid host is Position's own `style`:

```tsx
{/* z-index belongs on the Position wrapper; a child's z-index is dead
    inside the transform-based stacking context the wrapper creates. */}
<Position at={{ x: 0, y: 0 }} layer={{ fixed: true }} style={{ zIndex: 4 }}>
  <Overlay />
</Position>
```

When investigating "why can't this element cover that one", first check whether the z-index sits on a child of Position; that is the most common cause of this class of problem.

## Fixed-layer coordinate quick reference

| Field                       | Meaning                                                                   |
| --------------------------- | ------------------------------------------------------------------------- |
| `at.x` / `at.y`             | absolute coordinates in design px, against the design viewport            |
| `at.anchor`                 | `'center' \| 'center-x' \| 'center-y'`; on a centered axis, `x`/`y` become offsets from center |
| `at.offsetX` / `at.offsetY` | the relative chain: accumulated from the previous Position's position     |

For fixed layers, prefer explicit absolute coordinates (or anchor centering). The relative chain depends on the parent Position's context, while a pinned layer's DOM has been portaled into the scene's fixed host, so a relative chain crossing the portal boundary easily ends up with an unexpected base. To lay out a group of pinned elements relative to each other, wrap them inside one Position's children so the relative relationships happen inside the layer, never across its boundary.

## Measurement and release

The existence of fixed layers never changes the scene's geometry. In scroll mode, scene height is measured by layout footprint: normal layout content participates in measurement; fixed layer scaffolding, overlay / portal hosts, debug infrastructure, and runtime-only helper nodes do not; no `Math.max(measuredHeight, viewportHeight)` one-screen floor is applied. Newly mounted nodes, async resources, and layout changes re-trigger measurement, and for scenes containing positioned elements, the minimal displayable height is derived from real layout footprint combined with the content bounds that must be shown.

So no matter how many fixed layers a 240vh scene pins, they never stretch or shrink it, and the appearance or disappearance of pinned layers does not re-measure scene height.

Release behavior is equally deterministic: when the scene releases at its bottom, the layer stops at the boundary position inside the scene (rule 7); when a scene that completed to 100% is scrolled back into from behind, the visual shell and the fixed layer must stay within the viewport, with any visual offset existing only for rendering compensation and never creating a second set of virtual scroll metrics. The layer you see when scrolling back is the same one that stopped at the boundary when it left forward.

## In summary

Five notes to keep: `layer.fixed` has scene-scoped semantics only in scroll mode, where declaring pins it and the boundary releases it; the layer belongs to the Scene that declared it, never a cross-chapter float, and layers of different scenes share no overlay domain; hand-written `position: fixed` inevitably degrades inside a takeover scene, so use `layer.fixed` or 100vh + `absolute inset: 0`; z-index goes on Position's `style`, since a child's z-index is dead code; fixed scaffolding is excluded from scene height measurement, so no number of pinned layers changes the scene's geometry.
