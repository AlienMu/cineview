---
title: Responsive
eyebrow: ONE RULER
---

CineView scales lengths from the design width. It does not infer a second height scale.

## Design-width conversion

Set config.size to the width of the design file. Position coordinates and Container box lengths are converted against the current viewport width. Percentages, auto, and CSS functions retain their authored meaning.

```tsx
<CineView config={{ size: 750 }}>
  <Scene>
    <Position at={{ x: 96, y: 160 }}>
      <Container width={420} height={240} />
    </Position>
  </Scene>
</CineView>
```
