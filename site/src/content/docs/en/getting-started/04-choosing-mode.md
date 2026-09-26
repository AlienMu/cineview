---
title: Choosing a mode
eyebrow: GETTING STARTED / CHOOSING A MODE
---

Use drag for full-screen pages with discrete scene changes. Use scroll for continuous reading with animated sections along the way.

## Choose by interaction

| Page requirement                                  | Suggested mode | Reason                                                                                         |
| ------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| Full-screen product demo or scene-based story     | drag           | Release completes the move or returns to the current scene                                     |
| Animated sections within a long article           | scroll         | Plain content and locked zones can follow one another                                          |
| Video or Canvas controlled during a drag          | drag           | Custom visuals can follow element animation progress                                           |
| Pause within a video range to inspect a frame     | scroll         | Scroll position determines locked-zone progress; source video after the range can keep playing |
| Embedded slider or independently draggable canvas | Either         | Local controls can handle their own pointer input                                              |

`AnimateVideo` and `useAnimateTimeline()` work in both modes. Choose based on page navigation; video and custom drawing do not require a particular mode.

## Dragging and releasing

Each drag Scene's navigation height is fixed at one viewport and cannot be edited through `Scene.layout.height`. That field only sizes the inner content box. Use scroll for pages of different heights or continuous reading. See [Drag scene layout](/docs/01-layout).

During a drag, the page and its element animations move together. By default, dragging 1% of the viewport length advances element animation by 10ms. Release velocity and distance determine whether the scene changes.

Once a scene arrives, unfinished element entrances can continue playing. This allows a short gesture to start a longer presentation. See [Page movement and element time](/docs/03-two-track).

Keyboard input and `ref.goToScene()` also change scenes. See [Gestures](/docs/02-gestures) for pointer input in nested controls.

## Continuous scrolling and locked zones

An ordinary Scene scrolls with the content. Declare a locked zone on a Scene when video frames or animation need to follow scroll position. Other Scenes remain ordinary content.

```tsx
import { AnimateVideo, Cineview, Scene } from 'cineview';

<Cineview mode="scroll" designWidth={750}>
  <Scene sceneId="intro" layout={{ height: '100vh' }}>
    <h1>Product overview</h1>
  </Scene>
  <Scene sceneId="details" layout={{ height: '100vh' }} scroll={{ zoneId: 'details' }}>
    <AnimateVideo
      src="/clip.mp4"
      aria-label="Product details"
      scrubRange={[0, 6]}
      duration={{ enter: 2400 }}
      width="100%"
    />
  </Scene>
</Cineview>;
```

The example needs a `/clip.mp4` at least six seconds long. The zone's animation duration determines its scrolling distance; see [Center-lock](/docs/01-centerlock). Wheel, touch, keyboard, and scrollbar input can all change progress.

## Configuration differences

| Configuration or behavior    | drag                                                             | scroll                                                      |
| ---------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| Default                      | Used when `mode` is omitted                                      | Set `mode="scroll"` explicitly                              |
| Scene size                   | Navigation height fixed at one viewport; no per-Scene adjustment | Can follow content or viewport size                         |
| Navigation duration          | `transitionDuration` sets ref navigation duration                | Zone duration determines scrolling distance                 |
| Input callbacks              | `onDragStart`, `onDragEnd`, `onDragCancel`                       | `onZoneEnter`, `onZoneProgress`, `onZoneLeave`              |
| Independent element playback | `timeline.driver: 'clock'`, after scene arrival                  | `timeline.driver: 'clock'`, when visibility conditions hold |

Both modes support composed animations, preloading, and responsive positioning. See [Modes and animation progress](/docs/01-modes) for configuration details and [Installation](/docs/02-installation) for package entries.
