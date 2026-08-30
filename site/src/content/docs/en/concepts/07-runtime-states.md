---
title: Runtime states
eyebrow: CONCEPTS / STATES
---

The framework maintains a runtime state reading for every scene, consumed by `Animate` and by pointer events. It decides whether a scene animates and whether it can be clicked, and it is one of the mechanisms that keeps continuous animation from spinning off-screen.

## The six values

| Runtime state | Meaning                                                  | Interactive |
| ------------- | -------------------------------------------------------- | ----------- |
| `inactive`    | The scene at the current position, not yet active        | No          |
| `entering`    | Entering                                                 | Yes         |
| `active`      | Arrived and settled                                      | Yes         |
| `exiting`     | Exiting (when an exit animation exists)                  | Yes         |
| `covered`     | Covered by a scene stacked above                         | No          |
| `parked`      | Already scrolled past or released, resting at a boundary | No          |

Both `covered` and `parked` mean the scene no longer receives pointer events (the framework sets `pointer-events` to `none`). The difference is semantic: `covered` means _another scene is on top_; `parked` means _this one has retreated past its boundary_.

## Continuous animation stops automatically in these states

**When the runtime state is `covered`, `inactive`, `parked`, or `exiting`, continuous animation stops by default.**

This is one of the key differences between `loopAnimation` and CSS `animation: … infinite`. A CSS infinite animation is bound by no runtime state and keeps repainting every frame after the element has left; with `loopAnimation` the framework decides from the runtime state together with viewport intersection, and it stops the moment the element leaves its own phase or scrolls out of view.

So the inconsistent behavior of "every other element has exited but this one is still moving" usually comes from a hand-rolled CSS loop used instead of `loopAnimation`. See [Troubleshooting](/docs/07-common-pitfalls).

## In scroll, the state is derived from the phase

In scroll mode the runtime state derives from the scene timeline's phase rather than from index distance:

| Scene phase | Derived runtime state                                   |
| ----------- | ------------------------------------------------------- |
| `enter`     | `entering`                                              |
| `exit`      | With an exit animation → `exiting`; otherwise `covered` |
| `hold`      | The active scene → `active`; otherwise `covered`        |
| `after`     | With an exit animation → `parked`; otherwise `covered`  |

Whether an exit animation exists changes the outcome: a scene with no exit never passes through `exiting` or `parked` and counts as `covered` directly. Separately, when a scene above stacks in cover mode, the one underneath is also judged `covered`.

## How this differs from sceneState

The framework also keeps an internal `sceneState` (`initial` / `entering` / `active` / `exiting`). The two are often confused:

|         | `sceneState`                                   | Runtime state                                 |
| ------- | ---------------------------------------------- | --------------------------------------------- |
| Nature  | Internal React state                           | **Derived reading**                           |
| Writer  | One writer per mode                            | No writer; derived from inputs                |
| Purpose | Drives the scene's own visuals and transitions | Handed to `Animate`, decides `pointer-events` |
| Values  | Four                                           | Six (adds `covered` / `parked`)               |

Neither value is directly readable through the public API. What you can observe from outside is `Scene.callbacks.onVisibilityChange` (visibility and progress) plus the element-side phase, see [The Animate timeline](/docs/02-timeline).

## Related pages

- [The Animate timeline](/docs/02-timeline): how element-level phases relate to runtime state
- [Visibility conditions](/docs/03-visibility-conditions): enter and exit criteria for non-zone elements
- [DOM and layout contract](/docs/06-dom-contract): where `pointer-events` and stacking actually land
- [Troubleshooting](/docs/07-common-pitfalls): why CSS infinite animations are unbound
