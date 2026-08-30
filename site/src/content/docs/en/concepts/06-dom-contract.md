---
title: DOM and layout contract
eyebrow: CONCEPTS / DOM
---

This page answers one question only: why your CSS does not work. The framework renders several wrapper layers around your content, each carrying styles with semantic consequences. Without knowing the shape of that tree, `position: fixed` and `z-index` fail in ways whose cause is invisible.

## The tree that actually renders

```text
div.cineview-responsive-container        ← carries --cineview-unit
└ div.cineview-container[data-cineview-container="true"]
  │   drag: height 100vh, overflow hidden, background #0d1624
  │   scroll: height 100vh, overflow-y scroll, background #ffffff
  └ div[data-scene-index="N"]            ← one per scene
    │   drag: position absolute, inset 0, z-index 10 (current) / 1
    │   scroll: position relative
    │   takeover scenes add two more layers:
    │     div[data-cineview-takeover-shell]   position sticky, overflow hidden, z-index 30 while active
    │     div[data-cineview-takeover-content] always carries a transform
    └ motion.div                        ← the Scene itself
      │   contain: 'layout style' (drag) / 'layout style paint' (scroll)
      │   always carries transform: translateZ(0) in scroll
      ├ (scroll) SceneFixedLayer, three divs, z-index 20
      └ your children
        └ Animate's wrappers
            in scroll an extra div[data-cineview-animate-host]
            the inner motion.div[data-cineview-animate-id] binds the property lanes
```

## --cineview-unit: sharing one conversion base

The outermost wrapper carries a length-typed CSS variable equal to one design px at the current viewport:

```css
.my-panel {
  padding: calc(24 * var(--cineview-unit));
  border-radius: calc(12 * var(--cineview-unit));
}
```

This is a publicly promised interface and the sanctioned way for ordinary CSS to share the framework's conversion base, instead of recomputing `viewport / size` yourself. The wrapper carries no layout styles of its own, but it is a real layer in the tree, so `>` child selectors must account for it.

## Scene must be a direct child

The framework walks exactly one level of children to discover scenes:

| Form                                    | Discovered                                   |
| --------------------------------------- | -------------------------------------------- |
| `<CineView><Scene/><Scene/></CineView>` | Yes                                          |
| `{list.map(s => <Scene key={s.id}/>)}`  | Yes (React flattens arrays)                  |
| `<><Scene/><Scene/></>`                 | No (Fragments are not flattened)             |
| `memo(Scene)` / `forwardRef` wrappers   | Yes (the type is unwrapped up to six levels) |
| `function My() { return <Scene/> }`     | No (the framework sees `My`)                 |

Discovery uses an internal static marker rather than `displayName`, so setting `displayName="Scene"` on your own component does not help (development warns about that pattern).

The hardest case to spot is the mixed one: a direct Scene plus a Fragment holding two more finds one, with **no error and no warning** (`EMPTY_SCENES` fires only when there are none at all). An undiscovered Scene falls back to the drag-mode defaults and renders as `position: absolute` with `pointer-events: none`: invisible and unclickable.

## The engine overrides your style

Scene merges styles in the order "spread your `style`, then write the engine's keys." These keys are always the engine's:

```text
width  height  position  overflow  willChange  contain
transform  userSelect  touchAction  zIndex  pointerEvents  + anchor keys
```

Everything else in `style` survives. Separately, Scene spreads any prop it does not recognize straight onto the underlying DOM node: `id`, `data-*`, `aria-*`, `role`, and `onClick` all work. Conversely a misspelled prop becomes a React unknown-attribute warning rather than being silently swallowed.

## Why z-index does nothing

A `z-index` on a child of `Animate` or `Position` is dead code. The cause is not that the wrappers carry a transform (a settled `Animate` wrapper reads `transform: none`); it is Scene's own `contain`:

`contain: layout` unconditionally establishes a stacking context and a containing block, in both modes, on every scene, permanently. A child's `z-index` resolves only inside that context and has no bearing on ordering between sibling scenes, or between siblings across separate `Position` wrappers.

On top of that sit four hardcoded levels:

| Layer                    | z-index                   |
| ------------------------ | ------------------------- |
| Drag scene frame         | `10` current / `1` others |
| Scene fixed layer clip   | `20`                      |
| Active locked zone shell | `30`                      |
| Scrollbar overlay        | `80`                      |

**The only effective host is `Position`'s `style.zIndex`** (`Position` spreads your style without overwriting `zIndex`, so passing it through is safe). To control paint order across sibling `Position` wrappers, set it on `Position`.

## position: fixed cannot work inside a scroll scene

In scroll, a Scene always carries `transform: translateZ(0)`, and **any non-`none` transform makes that element the containing block for `fixed` descendants**. A locked zone scene's content layer carries an additional unconditional transform. So `position: fixed` inside a scroll scene subtree is not relative to the viewport: it appears to "scroll away with the content" or lands in the wrong place, with no error at all.

Two correct approaches. One is `Position` with `fixed`, which portals into the scene-scoped fixed layer. The other is making the scene `100vh` and using `position: absolute; inset: 0`: the scene box then equals exactly one viewport, so absolute is viewport-equivalent. See [Scene-scoped fixed layer](/docs/04-fixed-layer).

## Root backgrounds are hardcoded and differ by mode

Drag uses `#0d1624`, scroll uses `#ffffff`, and neither is configurable (`CineView` accepts neither `className` nor `style`). Porting a page between modes changes this abruptly. To override, reach in from outside with the `.cineview-container` class or the `[data-cineview-container="true"]` attribute selector.

## Stable hooks you can select

These attributes work as anchors for tests and styling:

```text
[data-cineview-container]      root scroller / container
[data-scene-index]             each scene's outer wrapper
[data-cineview-scroll-zone]    a scene declaring a zone (also present on scenes without a locked zone; seeing it proves nothing)
[data-cineview-takeover-shell] the locked zone's sticky shell
[data-cineview-takeover-content]
[data-scene-fixed-layer]       the three fixed-layer divs, plus -role / -host
[data-cineview-animate-host]   Animate's outer layer in scroll
[data-cineview-animate-id]     the layer carrying Animate's property lanes
```

Two caveats: `data-cineview-scroll-zone` also falls back to `sceneId` on scroll scenes with no locked zone, so **its presence does not imply a registered zone**; and when `animateId` is not passed explicitly it comes from a module-level counter and is unstable across renders, so using it as a hook requires passing `animateId` yourself.

## Related pages

- [Runtime states](/docs/07-runtime-states): when `pointer-events` is set to none
- [Scene-scoped fixed layer](/docs/04-fixed-layer): the correct approach to fixed, and its boundaries
- [Responsive conversion base](/docs/05-responsive): the conversion model behind `--cineview-unit`
- [Drag layout contract](/docs/01-layout): the hardcoded styles on the drag side
