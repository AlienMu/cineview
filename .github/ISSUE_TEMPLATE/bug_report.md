---
name: Bug report
about: Something behaves differently from what the docs say
labels: bug
---

## What happens

<!-- Observed behaviour. If it is a visual/motion bug, describe what you see on
     screen — "the scene jumps" is more useful than "it breaks". -->

## What you expected

<!-- And where the docs led you to expect it, if applicable. -->

## Environment

|                   |                                                  |
| ----------------- | ------------------------------------------------ |
| cineview          |                                                  |
| react / react-dom |                                                  |
| framer-motion     |                                                  |
| mode              | `drag` / `scroll`                                |
| browser + OS      |                                                  |
| bundler           | Vite / webpack / Next.js / other                 |
| entry             | `cineview` / `cineview/drag` / `cineview/scroll` |

## Minimal reproduction

The smallest `<CineView>` tree that shows it. Paste code rather than a
screenshot — motion bugs usually hinge on a prop combination.

```tsx

```

## Notes

- Unit tests passing is not evidence the motion is right; if you can, say what a
  real browser does.
- `cineview/drag` and `cineview/scroll` are CommonJS/UMD-only subpaths. An ESM
  `import` from them fails by design — use the root `cineview` entry instead.
