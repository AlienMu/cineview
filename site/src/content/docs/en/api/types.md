---
title: Types
eyebrow: API REFERENCE
---

The type dictionary: field-by-field tables for every callback payload, the full `CineViewErrorCode` table (recoverability and `preventDefault` semantics included), and brief entries for the cross-component shared types. The source of truth is `src/types/index.ts` (public surface via `src/public-api.ts`).

## Callback payloads

Nine payload types cover all 14 framework callbacks. For trigger timing and mutual exclusion of the callbacks themselves, see the [CineView API](/docs/cineview-api) and the [callbacks deep-dive](/docs/callbacks).

### SceneChangeDetail

The payload of `onSceneWillChange` / `onSceneDidChange` (common).

| Field | Type | Description |
| --- | --- | --- |
| `fromIndex` | `number` | Scene index before the switch. |
| `toIndex` | `number` | Scene index after the switch. |
| `direction` | `'forward' \| 'backward' \| null` | Switch direction; `null` when no direction applies (e.g. first-scene initialization). |

### DragDetail

The payload of `onDragProgress` / `onDragCancel` (drag-only). Note there is no separate `DragCancelDetail`; cancel reuses this type.

| Field | Type | Description |
| --- | --- | --- |
| `sceneIndex` | `number` | Index of the scene the drag started from. |
| `progress` | `number` | Drag progress (signed; the direction sets the sign). |
| `direction` | `'forward' \| 'backward' \| null` | Drag direction; `null` while undetermined (contrast `DragStartDetail.direction`, which is always present). |

### DragStartDetail

The payload of `onDragStart` (drag-only). Structurally `DragDetail` with the nullable `direction` replaced by a required one; at start time the direction has already settled.

| Field | Type | Description |
| --- | --- | --- |
| `sceneIndex` | `number` | Index of the scene the drag started from. |
| `progress` | `number` | Progress at start. |
| `direction` | `'forward' \| 'backward'` | **Required.** Determined when the first direction-qualified move acquires ownership. |

### DragBlockedDetail

The payload of `onDragBlocked` (drag-only): a drag toward a blocked boundary is rejected.

| Field | Type | Description |
| --- | --- | --- |
| `fromIndex` | `number` | Index of the scene the blocked drag is on. |
| `targetSceneIndex` | `number` | The out-of-bounds target (past the first scene forward, or past the last backward). |
| `direction` | `'forward' \| 'backward'` | The rejected out-of-bounds direction. |

### DragCommitDetail

The payload of `onDragCommit` (drag-only). Structurally `DragDetail` plus three fields.

| Field | Type | Description |
| --- | --- | --- |
| `sceneIndex` | `number` | Scene index before the commit. |
| `progress` | `number` | Progress at release. |
| `direction` | `'forward' \| 'backward' \| null` | Commit direction. |
| `targetSceneIndex` | `number` | The scene index committed to. |
| `elapsedMs` | `number` | Total duration of the drag gesture (ms). |
| `timelineDurationMs` | `number` | Timeline budget of the settle animation (ms). |

### ZoneDetail

The payload of `onZoneEnter` / `onZoneLeave` (scroll-only).

| Field | Type | Description |
| --- | --- | --- |
| `zoneId` | `string` | Zone identity (`scroll.zoneId`, falling back to `sceneId`). |
| `sceneIndex` | `number` | Index of the scene declaring the zone. |

### ZoneProgressDetail

The payload of `onZoneProgress` (scroll-only). Structurally `ZoneDetail` plus `progress`.

| Field | Type | Description |
| --- | --- | --- |
| `zoneId` | `string` | Zone identity. |
| `sceneIndex` | `number` | Index of the scene declaring the zone. |
| `progress` | `number` | In-zone progress `0..1` (a pure function of real scroll px, `1ms = 1px`). |

### SceneVisibilityDetail

The shared payload of `onSceneVisibilityChange` (scroll root-level) and `Scene.callbacks.onVisibilityChange` (Scene-level).

| Field | Type | Description |
| --- | --- | --- |
| `sceneIndex` | `number` | (optional) Scene index — carried on the root-level aggregate path; may be absent on the Scene's declarative path. |
| `visible` | `boolean` | Whether the scene is inside the viewport. |
| `progress` | `number` | Scene visibility progress `0..1`. |

### CineViewErrorDetail

The payload of `onError` (common).

| Field | Type | Description |
| --- | --- | --- |
| `code` | `CineViewErrorCode` | The error-code union (8 values, table below); switching on `code` gets exhaustiveness checking. |
| `message` | `string` | Human-readable message. |
| `context` | `Record<string, unknown>` | (optional) Error context (e.g. `FIRST_SCENE_TIMEOUT` carries `sceneIndex`/`timeoutMs`/`loadedCount`/`totalCount`; `IMAGE_LOAD_FAILED` carries `url`). |
| `preventDefault` | `() => void` | (optional) Present only on **recoverable** errors. Calling it takes over handling and suppresses the framework fallback; not calling it lets the fallback run. |

## The CineViewErrorCode table

| Code | preventDefault | Semantics and default behaviour when not handled |
| --- | --- | --- |
| `NO_SCENES` | scroll root yes; drag root no | CineView has no Scene children. Nothing to render (an authoring error); unhandled on the scroll root there is an additional dev-mode console warning. |
| `IMAGE_LOAD_FAILED` | No | A preloaded image failed; `context.url` names the address. The background queue continues; other resources are not blocked. |
| `FIRST_SCENE_TIMEOUT` | Yes | First-screen priority assets did not settle within `modes.drag.firstSceneTimeout` (default 3000ms). Default fallback: the framework settles the first scene **statically** (placed directly, without the enter animation); with `preventDefault()` you can take over (e.g. render a retry UI). `context` carries `sceneIndex`/`timeoutMs`/`loadedCount`/`totalCount`. |
| `INVALID_ANIMATION` | No | Invalid animation declaration: `waitFor` points at a nonexistent `animateId`, an unknown preset name, neither `enterAnimation` nor `infiniteAnimation` provided, or a manual-control ref passed on a scrub lane (reported and ignored). |
| `CIRCULAR_DEPENDENCY` | No | The `waitFor` chain contains a cycle. |
| `INVALID_COMPONENT_HIERARCHY` | Duplicate scroll zoneId yes; duplicate animateId no | Authoring error in the component tree. A duplicate `animateId` is a plain report; a duplicate `scroll.zoneId` is recoverable (`context` carries `reason: 'duplicate-scroll-zone'`/`zoneId`/`ownerSceneIndex`/`rejectedSceneIndex`), with the default fallback being first-declarant-wins plus a dev-mode console warning. |
| `INVALID_DRAG_CONFIG` | No | An illegal drag `unit` / `scale` / `enabled` config. The framework **substitutes safe defaults and continues** (`enabled` falls back to `true`); running is not interrupted. |
| `ANIMATION_ASSET_LOAD_FAILED` | No | An asset a preset depends on (Lottie/image-class assets) failed to load; retryable on the consumer side. |

## Shared-type briefs

### AnimationType

`AnimationType = PresetAnimation | CustomAnimation | ComposedAnimation`: a preset name, a custom variant, or a composed animation (sequential / parallel). It is what `enterAnimation` / `exitAnimation` / `infiniteAnimation` (`Animate`, `AnimateVideo`, `Scene.transition`) accept. Composition is covered in [custom & composed](/docs/custom).

### PresetAnimation

A string union of 43 preset names (eleven families: fade / slide / zoom / rotate / flip / bounce / blink / shake / blur / elastic / special). The full catalogue with visual effects → [animation presets](/docs/presets).

### AnimateTimeline

The return type of `useAnimateTimeline()`: six read-only fields (`mode` / `driver` / `progress` / `signedProgress` / `phase` / `frame`), the last four being MotionValues. Field-by-field docs → [useAnimateTimeline API](/docs/use-animate-timeline-api).

### ScrollTimelineState (internal)

The timeline-state snapshot of a scroll takeover zone: `phase` (the `SceneTimelinePhase` five states: `before | enter | hold | exit | after`) plus `enterProgress` / `exitProgress` / `sceneProgress` and `rangeStart` / `rangeEnd` / `rangeLength` / `enterLength` / `exitLength` (px budgets). **Not exported from the package**; the consumer-side counterpart is `useAnimateTimeline()`.

### SceneVariantRecords (internal)

The compiled variant records shared by the drag / scroll drivers, three fields: `enterInitial` / `enterAnimate` / `exitTarget`. The arrival lane deliberately keeps its own two-field shape (`{ initial, animate }`); it has no exit concept. **Not exported from the package**; listed here only to explain the lane difference.

## Related pages

- Per-component field tables → [CineView](/docs/cineview-api) · [Scene](/docs/scene-api) · [Animate](/docs/animate-api) · [AnimateVideo](/docs/animate-video-api) · [Position](/docs/position-api) · [Container](/docs/container-api) · [Image](/docs/image-api)
- Trigger timing, mutual exclusion, and the zero-rerender pattern for callbacks → [callbacks deep-dive](/docs/callbacks)
