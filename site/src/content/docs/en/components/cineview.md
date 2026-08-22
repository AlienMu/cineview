---
title: CineView
eyebrow: ROOT
---

CineView selects the mode engine, provides the design-width context, schedules preload, and exposes imperative navigation.

## Ref API

The common methods are always available. goToZone is scroll-only and is required by CineViewScrollRef.

```tsx
const ref = useRef<CineViewScrollRef>(null);

ref.current?.goToScene(2, true);
ref.current?.goToZone('sequence', { animated: true });
ref.current?.refreshLayout();
ref.current?.preload(['hero']);
```
