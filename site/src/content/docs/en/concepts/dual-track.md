---
title: Dual-track model & single ownership
eyebrow: OWNERSHIP
---

The drag engine splits "page displacement" from "element orchestration" into two independent tracks, and each track has exactly one writer. This single-writer invariant is the most important behavioral boundary in drag mode: once you understand it, "who writes which state, and when" always has one answer, and debugging broken animation no longer requires guesswork.

## The two tracks

**The render track (global) — `renderProgress`**

The page-displacement track. It drives the translate of the whole scene track and is the sole trigger of commit (scene-change submission). Only a session holding formal drag ownership and the release lane may write it. `renderProgress` is progress relative to the current Scene and must be rebased with `currentScene` in the same React commit; syncing a reset to zero on its own is forbidden.

**The element track (owned by each Scene) — `elementElapsedMotion`**

The scene-orchestration track. Every Scene instance holds its own MotionValue, written only by that Scene's `useElementTrack`, with zero sharing across scenes. It consumes only what the current `DragSceneTransaction` froze — the registry snapshot, `T_self`, the mapping, and the visual variants — and never falls back to the live registry.

**`dragRelease` — a global read-only directive**

After a release, `useSceneManager` writes one `dragRelease` directive (settle or bounce, and to which target), broadcasting "continue in this mode" to every element track. Element tracks read it and each drives its own completion; no consumer ever writes it back.

## The single-writer invariant

| State                 | Sole writer                     | Primary readers                      |
| --------------------- | ------------------------------- | ------------------------------------ |
| `renderProgress`      | render lane (drag ownership + release) | page translate, the commit gate      |
| `elementElapsedMotion` | the Scene's own `useElementTrack` | every scene-driven Animate in that Scene |
| `dragRelease`         | `useSceneManager`               | all element tracks (read-only directive) |

Prepared snapshots and transactions provide read-only inputs only. An implementation that shares an element-elapsed writer across scenes, reads the live registry inside a transaction, or lets incoming and outgoing each compute their own release elapsed has broken the invariant and must stop immediately.

Every follow-finger sample and every release seed shares one resolved result:

```ts
// Resolved once per transaction; consumers never re-derive it.
T_self = max(calculatedDelay + effectiveEnterDuration); // over scene-driven Animate
msPerDragPercent = unit === 'time' ? scale : (T_self * scale) / 100;
map(dragPercent) = clamp(dragPercent * msPerDragPercent, 0, T_self);
localProgress = clamp((elementElapsedMs - calculatedDelay) / enterDuration, 0, 1);
```

`T_self` is the Scene's pure element-orchestration total: the drag registry floor is fixed at 0, and the page-level `modes.drag.transitionDuration` never raises it. `sceneControlled=false`, pure `infiniteAnimation`, and static content do not enter `T_self`.

## How Animate consumes the two tracks

Animate does not copy track values into React state. `useAnimateDrag` consumes the element track through a single-input MotionValue mapping: it writes the visual state — resolved for the scene state (rest / outgoing / enter / hidden) — into one MotionValue, and every animated property derives from that single layer. Delay is gated by the `localProgress` formula: while `elementElapsedMs <= calculatedDelay`, the element holds its initial frame.

```tsx
<CineView mode="drag" config={{ size: 750 }}>
  <Scene sceneId="act-1" layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
    <Animate animateId="headline" enterAnimation="fade-in" duration={{ enter: 800 }}>
      <h2>Chapter one</h2>
    </Animate>
    <Animate
      animateId="subline"
      enterAnimation="slide-up"
      duration={{ enter: 600 }}
      timeline={{ waitFor: 'headline', delay: 200 }}
    >
      <p>This line follows the headline on the element track.</p>
    </Animate>
  </Scene>
</CineView>
```

Both Animate elements above hang off Scene 1's element track: as the finger drags, `elementElapsedMs` follows the gesture, and `subline` only starts after `headline` finishes entering (`waitFor`) plus its own `delay`. Drag back and the same track decreases — the entrance rewinds symmetrically. None of this requires you to write any state; the ownership of the tracks lives inside the framework.

Keep the two directions apart: **entering and continuation** are driven by the Scene's own `elementElapsedMotion`; **exit visuals** are driven by the outgoing state mapping `renderProgress` — exit follows the page-displacement track, so dragging back rewinds the exit in real time instead of playing it one-way by clock. This also explains an orchestration rule: an entrance cascaded with `waitFor` + `delay` needs a mirrored exit orchestration (staggered `exitDuration` per element), or every element will roll back in the same packed frame.

## How waitFor chains resolve on the element track

`waitFor` is not a runtime poll of "has the leader finished". The registry folds the whole dependency chain into each element's `calculatedDelay` at snapshot time:

```ts
calculatedDelay(follower) = follower.delay
  + calculatedDelay(leader)
  + leader.effectiveEnterDuration;
```

Chained waits accumulate level by level: for `A → B → C`, C's `calculatedDelay` is the sum of all three delays plus each predecessor's enter duration. From there the element track needs a single subtraction — `localProgress = clamp((elementElapsedMs − calculatedDelay) / enterDuration, 0, 1)` — to know which frame each element should be on. Forward scrub, reverse rewind, and release completion are all symmetric by construction.

Resolution also runs two static checks: circular dependencies (`A waits B waits A`) and missing dependencies (`waitFor` pointing at a nonexistent `animateId`) land in registry issues instead of surfacing at runtime as "never starts". A scene-driven follower waiting on a non-scene-driven leader reports the public `INVALID_ANIMATION` (internal reason `incompatible-driver`).

## Why a second writer is forbidden

The core of development principle 2: **the visual position of a scrub track is a pure function of its sole owner** — finger displacement under drag, zone `progressPx` under scroll. A second writer's value does not error; it is simply recomputed and overwritten by the sole owner on the next frame. The animation "looks broken" when in fact the write never took effect.

Concretely on the API surface: `enterRef` / `exitRef` manual control exists only on time-driven lanes (the visibility lane and drag's arrival lane). Passing a ref on a scrub lane (scroll takeover, or drag's scene-controlled lane) reports `INVALID_ANIMATION` and is ignored, rather than pretending to work.

Debuggability depends on the single writer just as much. The first question when investigating a drag chain is always: **who is writing this MotionValue right now** — the single-writer rule gives that question exactly one answer. Fixing behavior by "trying a few more branches" or "guessing what some progress should be" abandons the ownership model.

## Debugging posture: four questions first

Never fix by guessing (development principle 1). When the drag chain misbehaves, use the key-node logs to answer these four questions before touching code:

1. Who is writing this scene's `elementElapsedMotion` right now? (must be the scene itself, and only it)
2. Has the current `renderProgress` slid into place? (should commit fire?)
3. Of the current and the target scene, which one should be animatable?
4. Why did this specific element not start, get skipped, or jump straight to its final state?

These four questions map onto track ownership, the commit gate, scene handover, and element gating — precisely the four failure surfaces of the dual-track model. Logs cover drag start, release render ticks, element track ticks, commit start/done, and element settle complete, so you can answer from the beginning instead of reverse-engineering from the symptom.

## Commit does not release the element track

A render commit only switches the current page; it does not release an element transaction still completing. After the finger crosses the threshold and the page has turned, the incoming scene's element animations keep completing from the release seed (settle toward `T_self`, bounce back to 0), possibly across the commit boundary.

When a still-running settle is re-grabbed, the framework creates a reversible suspension: it pauses, preserving the remaining duration; if the gate passes it takes over in place as the new ownership, while a tap or cancel restores the original continuation. There is no flush-style single-frame teleport of the whole stack.

## The transaction lifecycle

Cross-scene consistency between the two tracks is guaranteed by immutable snapshots, with an explicit state machine:

```ts
// DragSceneTransaction states
driving -> settling | bouncing | retargeted | aborted -> released;
```

- Once its presets are parsed and the registry is stable, a Scene publishes an immutable prepared snapshot (`instanceId + revision`, the resolved mapping, the compiled registry, and the visual variants) to CineView.
- When a drag happens, CineView builds a transaction from the target Scene's prepared snapshot, freezing the registry snapshot, `T_self`, mapping, variants, and the release seed; later revisions of the Scene do not modify an existing transaction.
- Every element-track action — follow-finger, settle, bounce, orphan resume, re-grab continuation — reads the frozen transaction only; falling back to the live registry is forbidden.
- A render commit does not release the transaction; only element settle completion does. Scene cleanup notifies the coordinator with `instanceId + revision + transactionId`, and a stale instance's cleanup must not terminate a newer transaction.

This freezing is the data plane of the single-writer invariant: the writer is unique not merely as discipline, but because the inputs the track consumes are immutable in the first place.

## How ownership is acquired: candidate and gate

The render track is not "pressed, therefore taken over". A plain pointer-down only creates a candidate: no global dragging flag, no element-track seizure, no default prevented, no drag callbacks. The first valid axial move decides the candidate Scene and evaluates the gate (business `drag.enabled` and internal readiness must both pass); only then, atomically: render-track ownership is taken, a transaction is built, dragging is set, the click is suppressed, and `onDragStart({ progress: 0, direction })` fires.

A rejected press leaves the page untouched: after one direction is rejected, that press is locked for the direction (even if the gate opens mid-press), while an explicit reversal may pre-check the other side; business rejections fire `onDragBlocked` at most once per direction, and internal-readiness rejections emit developer diagnostics only. Physical boundaries keep a render-only rubber band with boundary progress pinned to 0.

The intuition for authors: a light tap is never misread as the start of a drag; and once `onDragStart` fires, that pointer session must end with exactly one `onDragCommit` or `onDragCancel`.

## The same principle in scroll mode

Scroll mode does not use the dual tracks, but it obeys the same ownership discipline — the **sole scroll owner**: either a `Scene.scroll` progress owner or the native document flow, never both in parallel. Zone progress is a pure function of `scrollTop` (the center-lock segment is real scroll distance, `1ms = 1px`), and scrolling back rewinds progress naturally from `100%` to `0%` with no memory model.

Acquired ownership is likewise never recomputed mid-flight: the center-lock trigger only decides when a scene first gains progress ownership; during ownership, subsequent input consumes the remaining progress as real px deltas and is never shortened, throttled, or recomputed by another trigger crossing. "Anti-skip" for large flicks is the same ownership semantics — an oversized delta is clamped to the inside of the segment boundary, forcing the user through in-segment frames instead of jumping over the whole animation.

Any visual compensation affects rendering only and never creates a second set of virtual scroll metrics.

## Deleted models, kept deleted

Historically, drag used a global `sharedElapsedMs` scalar plus a `dragTransitionSnapshot` handoff: at commit, elapsed was "handed over" from outgoing to incoming. That model is deleted and must not return — it gave element elapsed a second writer, and every half-finished state at the handoff boundary was a historical bug source.

Also deleted: `dragTimeScale` / `dragTimeScalePer100` (replaced by the `unit + scale` mapping), the page `transitionDuration` as a drag `T_self` floor, and the entire idea of handing element elapsed over at commit. If you see them in old code or old documents, that is a historical record, not a recoverable API.

## In summary

Compress the dual-track model into three sentences:

1. "Which page are we on" asks the render track; "how far has this element played" asks that Scene's element track; "how does it continue after release" asks the `dragRelease` directive. Each has exactly one writer.
2. Authors have no "write progress" API — orchestration enters frozen snapshots purely through declarations (`duration` / `delay` / `waitFor`), and the runtime replays it from the tracks.
3. When animation misbehaves, first ask "who is writing right now", then "which snapshot did the declaration enter"; both questions have exactly one answer — only then start changing code.
