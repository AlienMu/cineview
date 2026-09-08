---
title: Animate
eyebrow: COMPONENTS / ANIMATE
---

Animate adds entrance, exit, and loop animations to content. Its progress follows the Scene by default, or uses an independent clock when configured with `timeline.driver: 'clock'`.

```tsx
<Animate enterAnimation="fade-in" duration={{ enter: 800 }}>
  <h1>Hello</h1>
</Animate>
```

## Props

| Prop                                    | Type                              | Default                | Behavior                                                                        |
| --------------------------------------- | --------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| `animateId`                             | string                            | Generated per instance | Needed when another Animate references it through `after`                       |
| `enterAnimation`                        | AnimationType                     | none                   | Provide this, `loopAnimation`, or both                                          |
| `exitAnimation`                         | AnimationType                     | none                   | Exit visuals; ignored by drag's clock driver                                    |
| `loopAnimation`                         | AnimationType                     | none                   | Loop while the element is eligible and visible                                  |
| `duration.enter` / `duration.exit`      | number, ms                        | 600                    | Animation duration; scene-driven locked-zone values correspond to scroll pixels |
| `timeline.driver`                       | `'scene' \| 'clock'`              | `'scene'`              | Progress source                                                                 |
| `timeline.delay`                        | number, ms                        | 0                      | Entrance delay                                                                  |
| `timeline.after`                        | string                            | none                   | Wait for another `animateId` to enter                                           |
| `timeline.zoneId`                       | string                            | Inherited zone         | Explicit locked-zone binding                                                    |
| `timeline.phase.start` / `end`          | number                            | Whole range            | Fraction of the zone's total budget                                             |
| `visibility.replay`                     | boolean                           | true                   | Replay after exiting and becoming visible again                                 |
| `visibility.enterMargin` / `exitMargin` | number, design px                 | Root value, then 50    | Visibility margins                                                              |
| `stagger`                               | `{ each?, from? }`                | none                   | Reveal direct children at intervals                                             |
| `enterRef` / `exitRef`                  | Mutable ref to a function or null | none                   | Manual triggers on supported drivers                                            |
| `children`                              | ReactNode or render function      | Required               | With stagger, a single ReactElement                                             |

Duplicate identifiers report `INVALID_COMPONENT_HIERARCHY`. Missing or incompatible `after` targets report `INVALID_ANIMATION`; dependency cycles report `CIRCULAR_DEPENDENCY`.

## AnimationType forms

Animation props accept a preset name, a custom object, or a composition:

- `PresetAnimation`: one of the 43 [preset names](/docs/08-presets).
- `CustomAnimation`: `{ initial?, animate?, exit? }`. Ordinary entrance and exit animations support ten mapped properties: opacity, translation, scale, rotation, skew, and filter. See [Custom animations](/docs/05-custom-animation) for the exact list.
- `ComposedAnimation`: `{ animations, mode: 'sequential' | 'parallel', delays? }`.

```tsx
<Animate
  enterAnimation={{ initial: { y: '10%', opacity: 0 }, animate: { y: 0, opacity: 1 } }}
  duration={{ enter: 800 }}
>
  <article>Content</article>
</Animate>
```

## Driver behavior

| Driver    | Context               | Behavior                                                       |
| --------- | --------------------- | -------------------------------------------------------------- |
| `'scene'` | Scroll locked zone    | Follows zone scroll progress                                   |
| `'scene'` | Scroll outside a zone | Starts through visibility conditions                           |
| `'scene'` | Drag                  | Follows the Scene's element timeline                           |
| `'clock'` | Scroll                | Uses visibility conditions, including inside a zone            |
| `'clock'` | Drag                  | Plays after arrival; no `after` dependencies or exit animation |

In drag mode, a forward exit uses `exitAnimation`, while moving back toward the previous scene reverses the entrance. Without a forward exit animation, the element holds its entered state while the page moves.

## When loopAnimation runs

Use `loopAnimation` when a repeating effect needs to stop with the element or Scene. CSS animations do not automatically follow CineView's visibility and lifecycle conditions.

A loop can follow `enterAnimation`, or run alone. For a loop-only element, omit `enterAnimation`.

## Staggered children

```tsx
<Animate enterAnimation="fade-in" stagger={{ each: 40, from: 'first' }}>
  <ul>
    <li>First</li>
    <li>Second</li>
  </ul>
</Animate>
```

`each` is the interval in ms (default 40). `from` accepts `'first'` (default), `'last'`, or `'center'`.

Stagger uses Framer Motion's child animation support, including properties such as `clipPath` and `width`. It plays by elapsed time, even when the surrounding Scene follows scroll or drag. For progress-driven child reveals, use separate Animate elements or derive their styles from the timeline.

## Render-prop children

```tsx
<Animate enterAnimation="fade-in">
  {({ enterProgress, phase }) => (
    <div style={{ width: `${enterProgress * 100}%` }} data-phase={phase} />
  )}
</Animate>
```

The render function receives `enterProgress` (0–1) and `phase` (`idle`, `waiting`, `entering`, `entered`, `exiting`, or `exited`). Progress changes rerender this content.

For a scene-driven entrance or exit in a locked zone, phase stays at `idle`; clock-driven elements use visibility phases and loop-only elements rest at `entered`. Use [useAnimateTimeline](/docs/09-use-animate-timeline) for MotionValue bindings that avoid React rendering.

## Manual entrance and exit

Visibility-driven scroll animations support both refs. Drag with `driver: 'clock'` supports `enterRef` only. Scene-driven drag and locked-zone animations ignore both refs and report `INVALID_ANIMATION`.

Calling `enterRef.current?.()` starts entrance immediately. An authored `after` or positive `timeline.delay` remains a fallback where that option is supported. Without a fallback, manual invocation is required.

Passing `exitRef` disables the supported animation's automatic exit. Call it to exit; there is no timeout fallback. It does not change Scene visibility or mounting.

This example displays response text as soon as it arrives, with a delay fallback after the visibility condition is met:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Animate, CineView, Scene } from 'cineview';

function Message() {
  const [message, setMessage] = useState('');
  const enter = useRef<(() => void) | null>(null);
  const exit = useRef<(() => void) | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/message')
      .then((response) => {
        if (!response.ok) throw new Error('Request failed');
        return response.text();
      })
      .then((text) => {
        if (!active) return;
        setMessage(text);
        enter.current?.();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <Animate
      enterAnimation="fade-in"
      exitAnimation="fade-out"
      timeline={{ driver: 'clock', delay: 3000 }}
      enterRef={enter}
      exitRef={exit}
    >
      <div>
        <p>{message || 'Message unavailable.'}</p>
        <button onClick={() => exit.current?.()}>Close</button>
      </div>
    </Animate>
  );
}

export default function App() {
  return (
    <CineView mode="scroll">
      <Scene sceneId="message">
        <Message />
      </Scene>
    </CineView>
  );
}
```

## Entrance and exit ordering

`after` orders entrances only. `duration.exit` changes an exit's length, not its start time. Add ordered exits when needed, using the controls supported by the chosen driver. See [Timeline](/docs/04-orchestration).
