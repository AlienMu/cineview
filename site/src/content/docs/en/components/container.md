---
title: Container
eyebrow: BOX MODEL
---

Container converts width, height, and supported style lengths with the same design-width ruler.

## Size without a second ruler

Use Container for box dimensions. Do not use it as a coordinate owner; Position remains responsible for placement.

```tsx
<Container width={520} height={300} style={{ padding: 24 }}>
  <Card />
</Container>
```
