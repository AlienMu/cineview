# Scroll Takeover Reducer — Rewrite Plan

Status: **scoped, model reconciled, ready to implement**.
Decision owner: user picked "scope it as its own pass with runtime verification"
(not a same-session patch) on 2026-06-23, given this code's regression history.
Model reconciliation and project-standard alignment done 2026-06-23.

Spec authority: `design.md` §"Scene Scroll 规则" + §"Root Scroll 运行规则";
`requirements.md` §7 (AC 5–21). History of failed attempts: `AGENT_SELF_REVIEW.md`.

---

## 1. Why this exists

`pnpm test -- DirectScrollCineView`: **46 failing / 25 passing / 71 total**. Every
failure lives in `src/components/CineView/DirectScrollCineView.test.tsx`. The rest of the
817-test suite is green.

Per user direction: **fix these bugs to green BEFORE chasing the 90% coverage gate.**

---

## 2. Root cause (single architectural fact)

The scroll runtime derives takeover progress as a **pure function of scroll position**,
but the spec requires **ownership memory with preserved progress**.

The offending line — `DirectScrollCineView.tsx`, `syncZoneStatesFromNativeOffset` (~969):

```ts
const rawProgressPx = clamp(nativeOffset - layout.segmentStart, 0, state.totalBudgetPx);
```

Progress = `scrollTop − segmentStart`. With no memory of which scene currently owns input,
which direction it was entered, or whether it has completed, this function cannot express:
preserved completion (design rule 6/7), reverse re-acquisition from `segmentEnd`
(rule 8), the no-skip guarantee (rule 13), or native/scrollbar jitter immunity (rule 11).

---

## 3. Model reconciliation (the decision that unblocks this)

There is an apparent contradiction between the prior plan, the test vocabulary, and the
self-review log. It is resolved as follows — **read this before writing code**:

- `design.md` rules 8 & 10 and `requirements.md` AC 11/13 **mandate ownership memory**:
  a completed scene must preserve `100%`, and reverse re-entry must restore ownership and
  run `100% → 0%`. Ownership is real and required.
- The `AGENT_SELF_REVIEW.md` entry **2026-06-09** ("Full center-lock segment crossing was
  not reduced") warns against the OLD implementation's `capture-offset` / `sceneEnd`
  ledger that behaved like a **second virtual scroll coordinate**. That warning is about a
  bad *mechanism*, not about ownership as a *concept*.

**Reconciled model — ownership is derived, never a parallel coordinate:**

1. There is exactly ONE scroll metric: native `scrollTop`. No virtual track, no global
   offset stored as state (design "Root Scroll 运行规则" 3).
2. Per-scene progress is a local px value in `[0, totalBudgetPx]` (`1ms = 1px`).
3. Ownership (`which zone, what direction, completed?`) is the minimal memory needed to
   satisfy rules 6–8 and 11. It is consulted to *interpret* an input delta; it never
   becomes an alternate position the page is scrolled to.
4. `globalOffset = scrollTop + progressPx` is a **derived read** computed on demand for the
   scrollbar thumb only (design "Scrollbar 规则" 5). It is never persisted or scrolled to.
5. Reverse re-entry into a completed scene re-acquires ownership when `scrollTop` returns to
   the rendered **`segmentEnd`** (NOT the center anchor `segmentStart`), then spends reverse
   delta into `progressPx` from the preserved `100%` (self-review 2026-06-08 "Old design
   text… anchor locking").

---

## 4. Target design — ownership-aware center-lock reducer

### 4.1 Runtime ownership state (a ref, not React state)

```ts
interface TakeoverOwnership {
  zoneId: string | null;            // current input owner, or null = document flow
  progressPx: number;               // 0..totalBudgetPx for the owned zone
  entryDirection: 'forward' | 'reverse' | null;
  status: 'idle' | 'active' | 'completed-forward' | 'completed-reverse';
}
```

- `active` — zone owns input, `scrollTop` pinned within its segment.
- `completed-forward` — parked at `100%`, released downward to document flow.
- `completed-reverse` — parked at `0%`, released upward to document flow.

The two completed states preserve `progressPx` + entry context so re-entry resumes
correctly. `status` is derived/maintained by the reducer, never authored.

### 4.2 Per-input reduce step (the core)

Each input path normalizes to one signed px `delta` (design "Root Scroll 运行规则" 6).
The reducer spends it in strict order:

```
forward (delta > 0):
  1. no active owner: advance scrollTop toward the next segmentStart.
     - on reaching a segmentStart: acquire ownership (entryDirection='forward',
       progressPx resumes preserved value if re-entering, else 0),
       spend remaining delta into progressPx. EMIT one in-segment frame.
  2. active owner: spend delta into progressPx up to totalBudgetPx.
     - on hitting 100%: status='completed-forward', release remainder to scrollTop.

reverse (delta < 0):
  1. no active owner: retreat scrollTop toward the prior segmentEnd.
     - on reaching segmentEnd of a completed zone: re-acquire at segmentEnd
       (entryDirection='reverse', progressPx = preserved 100%),
       spend remaining |delta| reducing progressPx. EMIT one in-segment frame.
  2. active owner: reduce progressPx toward 0.
     - on hitting 0%: status='completed-reverse', release remainder to scrollTop.
```

**No-skip guarantee (design rule 13, AC 21):** if one delta would cross an entire segment
(from after it to before it, or vice versa), clamp `scrollTop` at the boundary, force one
in-segment progress frame, and defer the remainder to the next input. A single wheel burst
must never land progress at exactly `0` or exactly `budget` after crossing a full segment —
it must land strictly inside `(0, budget)`.

### 4.3 Ownership while active

While `status === 'active'`, `scrollTop` is pinned at the segment edge that owns the lock
(`segmentStart` for forward entry, `segmentEnd` for reverse entry) — the visual center-lock.
Native scroll events that try to move it are reconciled back **through the same reducer**
(design "Root Scroll 运行规则" 12). Browser boundary bounce / tiny opposite-direction jitter
must NOT reset progress or rearm the opposite direction until progress actually reaches a
boundary (rule 11, self-review 2026-06-09 "Native capture-lock jitter").

---

## 5. Test-contract map (acceptance shape, from the failing specs)

All 46 failures cluster into six categories. The reducer must satisfy every one.

| # | Category | Representative tests (line) | Key assertion |
|---|----------|------------------------------|---------------|
| 1 | Preserved completion at 100% | L3398, L3295, L4135, L4060 | progress held at budget while `scrollTop` flows past `segmentEnd`; reverse re-entry pins at `segmentEnd`, **not** anchor |
| 2 | Reverse re-acquisition | L3128, L3210, L3994, L4263, L5370, L5314, L2801 | re-enter at `segmentEnd`, `onZoneEnter` re-fires, `goToZone` rearms to `0%`/opacity `0` |
| 3 | Delta waterfalling / no-skip | L1409, L1472, L1549, L1606, L1673, L3532, L3621, L3708, L3869, L4346 | one big delta lands strictly inside `(0, budget)`; multi-zone reverse runs in reverse doc order |
| 4 | Direction flip & jitter guard | L1913, L4438, L4531, L4630, L1748, L4726 | tiny forward jitter at high reverse progress freezes (no forward restart); newest crossed zone wins over stale owner |
| 5 | One reducer, all paths | wheel L2995/L3084, native L5155/L5231/L5189, keyboard L2923/L4871/L4914/L4960, listeners L5462 | identical ownership behavior across wheel/touch/keyboard/native |
| 6 | Continuous global-offset thumb | L1002, L1037, L1092, L1173, L2091, L2194, L2351, L2439, L2518, L2609 | thumb offset = `(scrollTop+progressPx)/(contentSpan+budget)·thumbTravel`, monotone across handoffs |

Numeric facts that pin the fix:

1. `wheelWithNativeDefaultAndFlush` **returns `true` (= takeover preventDefault'd)** on every
   reverse re-entry — the reducer MUST intercept reverse input from after a completed segment.
2. Reverse re-entry anchors at **`segmentEnd`**: L3295 asserts `scrollTop === 2000` AND
   `!== 1000`.
3. No-skip: L3708 — `−900` across a full 600 budget lands progress strictly in `(0, 600)`.
4. Full-delta spend: L4346 — second `−1200` reverse spends against remaining ~1316, lands
   `≤150`, `scrollTop` pinned at `segmentEnd` throughout (no anchor-overshoot clipping).
5. Jitter guard: L4438 — `+2.5px` forward at high reverse progress must keep progress within
   `(baseline−1, baseline+3]`.
6. `goToZone` rearm: L5370 — returning to anchor resets progress→`0` AND opacity→`0`.
7. Multi-zone: L3869 — reverse re-runs each crossed zone in reverse document order; L1748 —
   current reverse owner is not preempted by an earlier crossed anchor.

---

## 6. Files in blast radius

- `DirectScrollCineView.tsx`
  - `resolveScrollIntentOffset` (~139) — position-target math; keep as the segment-clamp
    helper but drive progress from ownership, not from `target − segmentStart`.
  - `syncZoneStatesFromNativeOffset` (~952) — read from the ownership ref, not raw position.
  - `applyNativeScrollDelta` (~1095) / `syncNativeScrollState` (~1037) — route through reducer.
  - wheel/touch handlers, keyboard, scrollbar — all call the one reduce path.
- `sceneScrollBudget.ts` — budget math is correct, **do not touch** (unit-tested green).
- `useSceneScrollTakeover.ts` / `sceneScrollRuntime.tsx` — consumer context; verify shape only.

---

## 7. Verification — REQUIRED, not optional

`AGENT_SELF_REVIEW.md` (2026-05-10, reaffirmed 2026-06-09) is explicit: Jest-green is
**insufficient** for this scroll/scene/layer class. After the suite passes, a **separate
acceptance agent** (not the implementer) runs the dev server and confirms in a browser:

- [ ] Forward scroll into a takeover scene locks at center, animates `0→100%` with scroll px
- [ ] Continuing past `100%` releases smoothly to document flow; progress stays at `100%`
- [ ] Scrolling back re-locks at the scene (`segmentEnd`) and reverse-plays `100%→0%`
- [ ] Flipping direction mid-takeover reverses progress immediately
- [ ] Same four behaviors via keyboard (PageUp/Down) and by dragging the custom scrollbar
- [ ] Fast flick (large delta) waterfalls — no visible skip past a scene
- [ ] Multi-zone: complete two takeovers, scroll to bottom, reverse — both replay in order
- [ ] No console warnings; 60fps during takeover

Per CLAUDE.md rule 4 ("实现与验收必须分 lane"), the implementer MUST NOT both write and
accept the scroll interaction path. The implementer hands this checklist to the acceptance
lane and does not claim "done" before that lane reports back.

---

## 8. Remaining audit findings (separate, lower priority — AFTER scroll is green)

| Sev | Finding | Location |
|-----|---------|----------|
| P1 | `VirtualScrollPhase` + `holdProgress`/`holdLength` are dead virtual-track concepts in public types | `types/index.ts:21`, `:381` |
| P1 | `CineViewContext` carries both legacy (`designSize`/`scale`/`convertSize`) and new (`scaleX`/`scaleY`) axes | `types/index.ts:432` |
| P1 | `SceneLegacyCompatProps` still lists `scrollSpeed`/`scrollEnterLength`/`scrollHoldLength`/`scrollExitLength` | `Scene/types.ts:13` |
| P2 | `framer-motion` is a hard `dependency`; should be `peerDependency` | `package.json:34` |
| P2 | `SceneInternalProps` has 18+ `global*` props — runtime state should flow via a new `SceneRuntimeContext` | `Scene/types.ts:102` |
| P2 | `CineViewRef.goToSceneAdvanced` exceeds requirements §14 surface | `types/index.ts:307` |
| P3 | Verify scroll height measurement excludes fixed-layer scaffolding per design §"Scene 高度测量规则" | `DirectScrollCineView.tsx` measure path |

User-confirmed decisions during grill-me (2026-06-23):
- Type cleanup: only remove types that are genuinely unconsumed — grep each before deleting.
- framer-motion: peer + keep as devDep for tests/build external.
- global* props: introduce a **new** `SceneRuntimeContext` (not reuse `CineViewRuntimeContext`).
- order: scroll bugs to green first, coverage second.

---

## 9. Execution order (this round)

1. `pnpm test -- DirectScrollCineView` to reconfirm the 46 failures. **(done — no drift)**
2. Implement §4 reducer behind the existing public API (no authoring-surface change),
   one test-contract category at a time, RED→GREEN per behavior (TDD).
3. Iterate to Jest-green on `DirectScrollCineView`, then full `pnpm test` + `pnpm type-check`.
4. Hand the §7 checklist to the acceptance agent — do NOT claim done before it reports.
5. Drag-engine audit (user requested) tracked separately.
