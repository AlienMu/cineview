---
title: DOM and layout contract
eyebrow: CONCEPTS / DOM
---

This page outlines how custom styles interact with the engine's cascading rules and layout constraints. The framework renders several wrapper layers around user content, each carrying styles with specific layout semantics. Without understanding this DOM hierarchy, `position: fixed` and `z-index` may produce unexpected layout behaviors.

## Rendered DOM hierarchy

```text
div.cineview-responsive-container        ← carries --cineview-unit
└ div.cineview-container[data-cineview-container="true"]
  │   drag: height 100vh, overflow hidden, background #0d1624
  │   scroll: height 100vh, overflow-y scroll, background #ffffff
  └ div[data-scene-index="N"]            ← one per scene
    │   drag: position absolute, inset 0, z-index 10 (current) / 1
    │   scroll: position relative
    │   locked-zone scenes add two more layers:
    │     div[data-cineview-takeover-shell]   position sticky, overflow hidden, z-index 30 while active
    │     div[data-cineview-takeover-content] always carries a transform
    └ motion.div                        ← the Scene itself
      │   contain: 'layout style' (drag) / 'layout style paint' (scroll)
      │   always carries transform: translateZ(0) in scroll
      ├ (scroll) SceneFixedLayer, three divs, z-index 20
      └ declared children
        └ Animate's wrappers
            in scroll an extra div[data-cineview-animate-host]
            the inner motion.div[data-cineview-animate-id] binds the property channels
```

## --cineview-unit: unified viewport scaling baseline

The outermost wrapper carries a length-typed CSS variable equal to one design px at the current viewport:

```css
.my-panel {
  padding: calc(24 * var(--cineview-unit));
  border-radius: calc(12 * var(--cineview-unit));
}
```

This is a publicly promised interface and the standard way for ordinary CSS to share the framework's single-axis responsive scale, avoiding redundant viewport calculations. The wrapper carries no layout styles of its own, but it is a real element in the DOM hierarchy, so `>` child selectors must account for it.

## Scene must be a direct child

The framework walks exactly one level of children to discover scenes:

| Form                                    | Discovered                                   |
| --------------------------------------- | -------------------------------------------- |
| `<CineView><Scene/><Scene/></CineView>` | Yes                                          |
| `{list.map(s => <Scene key={s.id}/>)}`  | Yes (React flattens arrays)                  |
| `<><Scene/><Scene/></>`                 | No (Fragments are not flattened)             |
| `memo(Scene)` / `forwardRef` wrappers   | Yes (the type is unwrapped up to six levels) |
| `function My() { return <Scene/> }`     | No (the framework sees `My`)                 |

Discovery uses an internal static marker rather than `displayName`, so setting `displayName="Scene"` on custom components does not take effect (development warns about this pattern).

When mixing direct declarations with Fragment wrappers, Scenes inside Fragments are not recognized by the top-level walker. Undetected Scenes fall back to default positioning styles (`position: absolute` and `pointer-events: none`), rendering them non-interactive and hidden. The engine raises `EMPTY_SCENES` only when no valid Scenes are detected at all.

## Style cascading and engine overrides

Scene merges styles in the order "spread custom `style`, then apply engine-managed properties." These properties are always managed by the engine:

```text
width  height  position  overflow  willChange  contain
transform  userSelect  touchAction  zIndex  pointerEvents  + anchor keys
```

All other custom styles remain intact. Separately, Scene forwards unrecognized props directly onto the underlying DOM node: `id`, `data-*`, `aria-*`, `role`, and `onClick` function as expected. Misspelled props trigger standard React unknown-attribute warnings rather than being silently ignored.

## Stacking contexts and z-index constraints

Direct `z-index` declarations on child elements of `Animate` or `Position` cannot elevate stacking order across components. This occurs because Scene applies `contain: layout`, creating an isolated stacking context:

`contain: layout` establishes an isolated stacking context for every scene across both modes. A child's `z-index` resolves strictly within this context and does not alter ordering relative to sibling scenes or adjacent `Position` wrappers.

On top of that sit four engine-managed stacking levels:

| Layer                    | z-index                   |
| ------------------------ | ------------------------- |
| Drag scene frame         | `10` current / `1` others |
| Scene fixed layer clip   | `20`                      |
| Active locked zone shell | `30`                      |
| Scrollbar overlay        | `80`                      |

**The only effective host is `Position`'s `style.zIndex`** (`Position` spreads custom styles without overwriting `zIndex`). To control paint order across sibling `Position` wrappers, configure it directly on `Position`.

## Positioning boundaries for position: fixed in scroll mode

In scroll mode, Scene applies `transform: translateZ(0)`, which causes the transformed element to act as the containing block for any descendant styled with `position: fixed`. Consequently, direct `position: fixed` declarations inside a scroll scene subtree position relative to the scene rather than the viewport.

Two standard approaches resolve this: pass the `fixed` prop to `Position` to mount onto the scene-scoped fixed layer, or set the scene height to `100vh` combined with `position: absolute; inset: 0`. See [Scene-scoped fixed layer](/docs/04-fixed-layer).

## Default root background colors by mode

Drag defaults to `#0d1624` and scroll defaults to `#ffffff`. Neither provides direct props (`CineView` accepts neither `className` nor `style`). When migrating between modes, note this difference. To override, apply external styles via the `.cineview-container` class or the `[data-cineview-container="true"]` attribute selector.

## Stable attribute selectors

These attributes work as anchors for tests and styling:

```text
[data-cineview-container]      root scroller / container
[data-scene-index]             each scene's outer wrapper
[data-cineview-scroll-zone]    a scene declaring a zone (also present on scenes without a locked zone; seeing it proves nothing)
[data-cineview-takeover-shell] the locked zone's sticky shell
[data-cineview-takeover-content]
[data-scene-fixed-layer]       the three fixed-layer divs, plus -role / -host
[data-cineview-animate-host]   Animate's outer layer in scroll
[data-cineview-animate-id]     the layer carrying Animate's property channels
```

Two caveats: `data-cineview-scroll-zone` also falls back to `sceneId` on scroll scenes with no locked zone, so **its presence does not imply a registered zone**; and when `animateId` is omitted, it is generated by a module-level counter and is unstable across renders. Using it as a reliable selector requires passing `animateId` explicitly.

## Related pages

- [Runtime states](/docs/07-runtime-states): when `pointer-events` is set to none
- [Scene-scoped fixed layer](/docs/04-fixed-layer): the correct approach to fixed, and its boundaries
- [Responsive conversion base](/docs/05-responsive): the conversion model behind `--cineview-unit`
- [Drag layout contract](/docs/01-layout): layout rules in drag mode
