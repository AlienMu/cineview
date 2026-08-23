---
title: center-lock & zones
eyebrow: SCROLL OWNERSHIP
---

center-lock is a real scroll segment, not a second virtual page coordinate system.

## Input order

A large input is consumed in order: reach the anchor, consume the zone progress, then return leftover distance to native document flow. Reverse entry reuses the completed segment from 100 back to 0.

## Zone progress

onZoneProgress reports the changed zone snapshot without debounce and retains exact 0 and 1 boundaries.

## Phase windows

`timeline.phase` (`{ start?, end? }`) places an element's enter window inside the zone as 0..1 fractions. Without `phase`, the window defaults to the element's own enter segment from the waitFor chain; authoring either boundary rescales the window to the whole zone budget — `{ start: 0, end: 0.5 }` means "enter across the first half of the zone's total scroll distance". The resolved window is never narrower than 1px, and an authored phase also re-pins exit: the exit end anchors to the zone end no matter what.

## Phase windows vs waitFor chains

The two compose (semantics closed since 2026-08-23): when a chain leader carries an authored phase window, `waitFor` followers key off the **close of the leader's phase window** — the budget compiler resolves the circular dependency (phase fractions reference the zone total; chain extents feed the zone total) with a fixed-point iteration that converges geometrically for `phase.end < 1`. Historically this was a dual-clock split (a follower once fired while its leader was at 14 percent; measured on-device, then fixed). Pure waitFor chains and pure phase windows remain the simplest shapes to author on their own.

## Large-flick anti-skip

A wheel or touch delta that would jump entirely across a takeover segment is clamped to `segmentStart + 1` going forward or `segmentEnd - 1` going backward — at least one frame lands inside the segment, so the zone's frames always play instead of being skipped. A jump that would leave the active segment clamps to the segment boundary; the document is only handed back to native flow from exactly 0 or 100 percent.

