---
title: Callbacks & errors
eyebrow: OBSERVABILITY
---

Callbacks are grouped by semantic timing: realtime samples, boundaries, lifecycle, and errors.

## Boundary callbacks

onReady fires once per mounted root. onSceneWillChange fires before a valid transition. onSceneDidChange fires at render commit. onDragCommit and onDragCancel are mutually exclusive for one gesture.

## Realtime callbacks

onDragProgress and onZoneProgress are sampled at the owner boundary without trailing debounce, preserving terminal values.
