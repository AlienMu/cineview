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

## Props

Every field and default below is checked against `ContainerProps` in `src/types/index.ts` and the Container implementation. `Container` also accepts native `div` attributes (`Omit<HTMLAttributes, 'children' | 'style' | 'className'>`), and it only works under a CineView (a missing context throws in development mode).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `width` | `number` | — | Container width (design px), converted through the single-ruler `convert`. |
| `height` | `number` | — | Container height (design px), same rule. |
| `children` | `ReactNode` | `required` | Content. |
| `style` | `React.CSSProperties` | — | Extra styles; every length inside (padding/margin/gap/borderRadius/fontSize/…) is converted as design px via `convertStyle` as one block. |
| `className` | `string` | — | CSS class name. |
