# Select drag or scroll

Applies to `cineview@1.0.1`. Cineview has two page modes. `timeline.driver` separately selects how an element advances; it is not a third page mode.

## Match the interaction

| Requirement                                                    | Select                                                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A fixed sequence of full-screen scenes, controlled by gestures | `mode="drag"`                                                                                   |
| Continuous reading with variable content heights               | `mode="scroll"`                                                                                 |
| Animation tied to a specific scroll interval                   | Scroll mode plus `Scene.scroll`                                                                 |
| An entrance that plays by itself                               | Animate with `timeline={{ driver: 'clock' }}`; read its [mode-specific behavior](./timeline.md) |

## Configure drag

Start from the [complete drag App](./quickstart.md#run-a-drag-example).

Each navigation scene is fixed at one viewport high. `Scene.layout.height` controls its inner content box; it cannot change navigation height or create a vertically scrolling drag scene. Select scroll mode for taller content.

`unit="percent" scale={1}` maps drag percentage to the target Scene's timeline percentage. Without these properties, the default mapping is `unit="time"` with `scale={10}`: each 1% of viewport drag advances 10ms. Each Scene calculates its own duration.

Distance and release velocity decide whether to complete or cancel a scene change. A committed release continues unfinished element animations. Cancellation restores the target scene. Page arrival and completion of all element animations are separate events.

## Configure scroll

Use the [scroll narrative recipe](./recipes.md#scroll-through-a-narrative).

Ordinary Scenes remain in flow. Add `scroll={{ zoneId: 'story' }}` to a Scene to create a locked zone. The Scene stays centered while scrolling advances its scene-driven animations, then the page continues. Stopping holds the frame; scrolling back reverses it.

One millisecond of authored zone duration corresponds to one pixel of real scroll distance. A 1100ms timeline adds 1100px. `designWidth` and viewport height do not rescale that distance. Clock-driven animations add no zone distance.

`Animate` inherits its Scene's zone. `goToZone('story', { animated: true })` belongs to a scroll ref. Use `CineviewScrollRef` when typing a ref that requires this method.

## Keep mode configuration consistent

- Root drag settings such as `unit`, `scale`, and `threshold` belong to drag mode. Keep scroll-only callbacks and settings in the scroll branch.
- Give Scenes stable identifiers. Give authored scroll zones distinct identifiers.
- A `Position fixed` belongs to its Scene and follows that Scene's visibility. Put persistent navigation outside Cineview.
- When offering a mode switch, remount Cineview using a different React `key`. Use separate literal `mode="drag"` and `mode="scroll"` branches to preserve TypeScript checks. The [minimal example](../../examples/minimal/src/App.tsx) demonstrates this pattern.

Do not generate the removed root `zoneTrigger`, `Scene.scroll.trigger`, `Animate.timeline.zoneId`, or `goToZone` option `align`. The zone declaration is sufficient; navigation still accepts `animated`.

Check [mode documentation](../../site/src/content/docs/en/concepts/01-modes.md) for input behavior and [public types](../../src/types/index.ts) for the complete property lists.
