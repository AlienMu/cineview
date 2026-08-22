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

An acceptance-tested constraint: do not mix the two in one cascade. When a chain leader carries an authored phase window, its px-clock end gets the phase correction while `waitFor` followers still key off the ms-clock chain end — the clocks split and a follower can start early (observed: a follower firing while its leader was at 14 percent). Pure waitFor chains are strictly ordered; pure phase windows compose by fractions. Pick one per cascade.

## Large-flick anti-skip

A wheel or touch delta that would jump entirely across a takeover segment is clamped to `segmentStart + 1` going forward or `segmentEnd - 1` going backward — at least one frame lands inside the segment, so the zone's frames always play instead of being skipped. A jump that would leave the active segment clamps to the segment boundary; the document is only handed back to native flow from exactly 0 or 100 percent.

