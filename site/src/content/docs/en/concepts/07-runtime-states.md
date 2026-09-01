---
title: Runtime states
eyebrow: CONCEPTS / STATES
---

The framework maintains a runtime state for every scene, consumed by `Animate` and event handling pipelines. It coordinates motion activation and interactivity, preventing off-screen elements from consuming redundant rendering resources.

## Six possible states

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

## Deriving state from timeline phase in scroll mode

In scroll mode, runtime states derive from the scene timeline's lifecycle phase rather than index distance:

| Scene phase | Derived runtime state                                   |
| ----------- | ------------------------------------------------------- |
| `enter`     | `entering`                                              |
| `exit`      | With an exit animation → `exiting`; otherwise `covered` |
| `hold`      | The active scene → `active`; otherwise `covered`        |
| `after`     | With an exit animation → `parked`; otherwise `covered`  |

Whether an exit animation exists changes the outcome: a scene with no exit never passes through `exiting` or `parked` and counts as `covered` directly. Separately, when a scene above stacks in cover mode, the one underneath is also judged `covered`.

## Differences from sceneState

The framework also keeps an internal `sceneState` (`initial` / `entering` / `active` / `exiting`). The two are often confused:

|         | `sceneState`                                   | Runtime state                                 |
| ------- | ---------------------------------------------- | --------------------------------------------- |
| Nature  | Internal React state                           | **Derived reading**                           |
| Writer  | One writer per mode                            | No writer; derived from inputs                |
| Purpose | Drives the scene's own visuals and transitions | Handed to `Animate`, decides `pointer-events` |
| Values  | Four                                           | Six (adds `covered` / `parked`)               |

Neither value is directly exposed through the public API. Observable properties from the outside include `Scene.callbacks.onVisibilityChange` (visibility and progress) and element-side phases, see [Animate timeline](/docs/02-timeline).

## Related pages

- [Animate timeline](/docs/02-timeline): how element-level phases relate to runtime state
- [Visibility conditions](/docs/03-visibility-conditions): enter and exit criteria for non-zone elements
- [DOM and layout contract](/docs/06-dom-contract): where `pointer-events` and stacking actually land
- [Troubleshooting](/docs/07-common-pitfalls): why CSS infinite animations are unbound
