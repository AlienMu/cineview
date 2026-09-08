---
title: DOM and layout contract
eyebrow: CONCEPTS / DOM
---

Use the rendered wrappers to diagnose positioning, clipping, and stacking. Scene styles control its layout, while Position handles design-coordinate placement.

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
      ├ (scroll) fixed element host, three divs, z-index 20
      └ declared children
        └ Animate's wrappers
            in scroll an extra div[data-cineview-animate-host]
            the inner motion.div[data-cineview-animate-id] applies animation styles
```

## --cineview-unit: unified viewport scaling baseline

The outermost wrapper carries a length-typed CSS variable equal to one design px at the current viewport:

```css
.my-panel {
  padding: calc(24 * var(--cineview-unit));
  border-radius: calc(12 * var(--cineview-unit));
}
```

Use `--cineview-unit` in ordinary CSS to share CineView's responsive scale. The wrapper is a real DOM element, so include it when writing direct-child selectors.

## Scene must be a direct child

The framework walks exactly one level of children to discover scenes:

| Form                                    | Discovered                                   |
| --------------------------------------- | -------------------------------------------- |
| `<CineView><Scene/><Scene/></CineView>` | Yes                                          |
| `{list.map(s => <Scene key={s.id}/>)}`  | Yes (React flattens arrays)                  |
| `<><Scene/><Scene/></>`                 | No (Fragments are not flattened)             |
| `memo(Scene)` / `forwardRef` wrappers   | Yes (the type is unwrapped up to six levels) |
| `function My() { return <Scene/> }`     | No (the framework sees `My`)                 |

Declare Scene nodes directly under CineView. Setting a wrapper's `displayName` to `Scene` does not make it discoverable. A mix of direct Scenes and hidden nested Scenes can leave content missing without an empty-scene error; `EMPTY_SCENES` reports when no valid Scene is found.

## Style cascading and engine overrides

Scene merges styles in the order "spread custom `style`, then apply engine-managed properties." These properties are always managed by the engine:

```text
width  height  position  overflow  willChange  contain
transform  userSelect  touchAction  zIndex  pointerEvents  + anchor keys
```

Other custom styles remain in place. Standard HTML props such as `id`, `data-*`, `aria-*`, `role`, and `onClick` are forwarded to the scene node.

## Stacking contexts and z-index constraints

Each Scene establishes a stacking context through `contain: layout`. Child z-index values stay inside it and cannot change the Scene's order relative to sibling Scenes. Additional transforms or explicit z-index values can create stacking contexts inside a Scene.

On top of that sit four engine-managed stacking levels:

| Layer                    | z-index                   |
| ------------------------ | ------------------------- |
| Drag scene frame         | `10` current / `1` others |
| Scene fixed layer clip   | `20`                      |
| Active locked zone shell | `30`                      |
| Scrollbar overlay        | `80`                      |

Set `style.zIndex` on sibling Position components to control their order. Check their ancestor stacking contexts when a larger value has no visible effect.

## Positioning boundaries for position: fixed in scroll mode

In scroll mode, Scene applies `transform: translateZ(0)`, which causes the transformed element to act as the containing block for any descendant styled with `position: fixed`. Consequently, direct `position: fixed` declarations inside a scroll scene content position relative to the scene rather than the viewport.

Two standard approaches resolve this: pass the `fixed` prop to `Position` to mount onto the scene-scoped fixed layer, or set the scene height to `100vh` combined with `position: absolute; inset: 0`. See [Scene-scoped fixed layer](/docs/04-fixed-layer).

## Default root background colors by mode

Drag defaults to `#0d1624` and scroll to `#ffffff`. CineView has no `className` or `style` prop. An external `.cineview-container` rule can override the inline background with `!important`; scope that rule to the intended instance.

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
[data-cineview-animate-id]     the layer applying Animate styles
```

`data-cineview-scroll-zone` can contain a plain Scene's `sceneId`, so its presence does not establish a locked zone. An automatically generated `animateId` remains stable while its instance is mounted. Set `animateId` explicitly for selectors that must remain stable across remounts.

## Related pages

- [Runtime states](/docs/07-runtime-states): when `pointer-events` is set to none
- [Scene-scoped fixed layer](/docs/04-fixed-layer): the correct approach to fixed, and its boundaries
- [Responsive conversion base](/docs/05-responsive): the conversion model behind `--cineview-unit`
- [Drag layout contract](/docs/01-layout): layout rules in drag mode
