---
title: center-lock & zones
eyebrow: SCROLL OWNERSHIP
---

center-lock is a real scroll segment, not a second virtual page coordinate system.

## Input order

A large input is consumed in order: reach the anchor, consume the zone progress, then return leftover distance to native document flow. Reverse entry reuses the completed segment from 100 back to 0.

## Zone progress

onZoneProgress reports the changed zone snapshot without debounce and retains exact 0 and 1 boundaries.
