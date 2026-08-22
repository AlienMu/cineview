---
title: Quick Start
eyebrow: QUICK START
---

A complete minimal app: one declarative tree that runs under both engines, with a `waitFor` cascade.

> The code on this page is excerpted from the living example at
> `examples/minimal/src/App.tsx`. Change them together, never apart — the
> example is the source of truth, this page is its mirror.

## Run the example

```bash
git clone <repo> && cd cineview
pnpm install && pnpm build   # the example consumes the built dist package
pnpm --dir examples/minimal install
pnpm --dir examples/minimal dev   # http://localhost:4100
```

## The cascade

Two `Animate` elements in one scene: `subline` declares `waitFor: 'headline'`,
so it cannot start until the headline has finished entering. The registry
resolves the chain from each element's own `delay` and `duration` — no timers,
no manual state.

```tsx
<Scene
  sceneId="story"
  layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
  transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out', exitDuration: 360 }}
  scroll={{ zoneId: 'story', trigger: 'center-lock' }}
>
  <div style={stage}>
    <Animate animateId="headline" enterAnimation="fade-in" duration={{ enter: 800 }}>
      <h2>Scene 02 — cascade</h2>
    </Animate>
    <Animate
      animateId="subline"
      enterAnimation="slide-up"
      exitAnimation="fade-out"
      duration={{ enter: 600, exit: 300 }}
      timeline={{ waitFor: 'headline' }}
    >
      <p>This line waits for the headline to finish entering.</p>
    </Animate>
  </div>
</Scene>
```

## One tree, two engines

The `scroll` declaration on the scene above is read by both engines: drag
ignores it (the scene is just a page), while scroll turns the scene into a
`center-lock` zone whose real scroll distance (1ms = 1px) drives the cascade.

Mode is a root-level declaration, not a hot-swappable prop — the two engines
own different DOM and runtime state. The example switches modes by remounting
the whole tree with `key={mode}`, which is the only honest switch: every scene
re-enters from its initial state.

```tsx
const [mode, setMode] = useState<ScrollMode>('drag');

<CineView key={mode} config={{ size: 750 }} mode={mode}>
  {/* scenes */}
</CineView>
```
