---
title: CineView
eyebrow: ROOT
---

CineView 选择模式引擎、提供设计宽度上下文、调度预加载，并暴露命令式导航。

## Ref API

公共方法始终可用。goToZone 仅 scroll 模式提供，并且是 CineViewScrollRef 的必填项。

```tsx
const ref = useRef<CineViewScrollRef>(null);

ref.current?.goToScene(2, true);
ref.current?.goToZone('sequence', { animated: true });
ref.current?.refreshLayout();
ref.current?.preload(['hero']);
```
