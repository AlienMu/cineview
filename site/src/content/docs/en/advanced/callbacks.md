---
title: Callbacks & errors
eyebrow: OBSERVABILITY
---

Callbacks are grouped by semantic timing: realtime samples, boundaries, lifecycle, and errors.

## Boundary callbacks

onReady fires once per mounted root. onSceneWillChange fires before a valid transition. onSceneDidChange fires at render commit. onDragCommit and onDragCancel are mutually exclusive for one gesture.

## Realtime callbacks

onDragProgress and onZoneProgress are sampled at the owner boundary without trailing debounce, preserving terminal values.

## Reading onZoneProgress

onZoneProgress fires per changed zone, every frame the zone moves — never mirror it into state. The pattern that holds up under concurrent scrolling: keep the callback identity stable (empty deps), filter to the zone you care about, and project the number into DOM through a ref.

```tsx
const readoutRef = useRef<ZoneReadoutHandle>(null);

const handleZoneProgress = useCallback((detail: ZoneProgressDetail): void => {
  if (detail.zoneId !== 'demo-scroll-zone') return;
  readoutRef.current?.project(detail.progress);
}, []);
```

`project` writes `style.transform` and `textContent` directly — zero re-renders per frame; React only renders the readout shell once. The demo page's ZoneReadout is the live instance of this pattern.

## Errors and dev warnings

onError receives a typed `code` (the `CineViewErrorCode` union), a message, and a `context` object; recoverable errors additionally carry `preventDefault()`. The same conditions also print `[CineView]`-prefixed diagnostics to the console outside production builds — the console line is the dev-time mirror of the callback, not a second channel to parse. Production bundles drop console output entirely, so programmatic handling belongs in `onError`.

