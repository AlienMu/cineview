---
title: Center-lock scrolling
eyebrow: SCROLL / CENTER-LOCK
---

Ordinary content moves with the page. In a locked zone, the Scene stays centered while further scrolling advances its animations. Once they finish, the page continues downward. Scroll back to revisit the same frames.

Declare `scroll` on a `Scene` to create a locked zone. The zone needs at least one scene-driven entrance or exit animation with a duration. Compare the three scenes in [Quick start](/docs/03-quickstart).

## Move from ordinary content into a locked zone

These three Scenes show ordinary content, a locked zone, and continued reading. Only the middle `Scene` declares `scroll`; the first and last have no extra animation interval.

```tsx
import { Animate, Cineview, Scene } from 'cineview';

export function ScrollReadingExample() {
  return (
    <Cineview mode="scroll" designWidth={750}>
      <Scene sceneId="intro" layout={{ height: '100vh' }}>
        <section style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <Animate
            enterAnimation={{ initial: { opacity: 0, y: 36 }, animate: { opacity: 1, y: 0 } }}
            duration={{ enter: 1400 }}
            timeline={{ driver: 'clock' }}
          >
            <h1>Read at your own pace</h1>
          </Animate>
        </section>
      </Scene>

      <Scene sceneId="details" layout={{ height: '100vh' }} scroll={{ zoneId: 'details' }}>
        <section style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
            <h1>The scene stays here</h1>
          </Animate>
          <Animate
            animateId="detail"
            enterAnimation="fade-in"
            duration={{ enter: 400 }}
            timeline={{ after: 'title', delay: 100 }}
          >
            <p>Keep scrolling to reveal the next line.</p>
          </Animate>
        </section>
      </Scene>

      <Scene sceneId="outro" layout={{ height: '100vh' }}>
        <section style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <Animate
            enterAnimation={{ initial: { opacity: 0, y: 36 }, animate: { opacity: 1, y: 0 } }}
            duration={{ enter: 1400 }}
            timeline={{ driver: 'clock' }}
          >
            <h1>Keep reading</h1>
          </Animate>
        </section>
      </Scene>
    </Cineview>
  );
}
```

When the middle Scene reaches the viewport center, the first 600 px fade in the title. After another 100 px, the detail begins its 400 px fade. Stop scrolling to hold the current frame, or scroll up to reverse it. After those 1100 px, the next Scene moves with the page.

## Play an ordinary entrance independently of scrolling

The first and last titles use `timeline={{ driver: 'clock' }}`. Once their visibility conditions are met, they fade and move into place over 1400ms. Stopping scroll does not pause that entrance, and scrolling back does not reverse it frame by frame.

Outside a locked zone, omitting `driver` also selects a visibility entrance. The example writes `clock` explicitly to contrast it with the middle Scene. Inside a locked zone, animations follow scroll by default; an Animate with `clock` can still enter independently, without adding to the zone's scroll distance.

Entrances replay on reentry by default. Adjust `visibility.replay` and the entrance/exit margins through [Visibility conditions](/docs/03-visibility-conditions).

## Animate a title and video in sequence

```tsx
<Cineview designWidth={750} mode="scroll" direction="y">
  <Scene sceneId="product" scroll={{ zoneId: 'product' }}>
    <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
      <h1>Scroll to explore the product</h1>
    </Animate>
    <AnimateVideo
      src="/product.mp4"
      duration={{ enter: 2000 }}
      timeline={{ after: 'title' }}
      aria-label="Product demonstration"
    />
  </Scene>
</Cineview>
```

Within the locked zone, the first 600 px fade in the title. The next 2000 px scrub the video from beginning to end. The total scroll distance is 2600 px, regardless of the media file's playback duration.

`AnimateVideo.scrubRange` selects a video interval in seconds. See [AnimateVideo](/docs/04-animate-video) for playback after the interval ends and encoding advice. For a canvas or other custom drawing, subscribe to progress through [useAnimateTimeline](/docs/09-use-animate-timeline) in a child of `Animate`.

## When the Scene becomes centered

Locking starts when the Scene's center reaches the viewport's center. Vertical scrolling uses heights and `scrollTop`; horizontal scrolling uses widths and `scrollLeft`.

| Quantity           | Formula                                                    | Meaning                                       |
| ------------------ | ---------------------------------------------------------- | --------------------------------------------- |
| `visualSpan`       | declared `vh`/`vw` length, otherwise measured from the DOM | Visible Scene size along the scroll direction |
| `centerLockOffset` | `max(sceneStart + visualSpan / 2 - viewportSpan / 2, 0)`   | Scroll position where locking begins          |
| `segmentStart`     | `centerLockOffset`                                         | Zone start                                    |
| `segmentEnd`       | `centerLockOffset + totalBudgetPx`                         | Zone end                                      |

The Scene content sits in a sticky container. The framework adjusts its position for the difference between Scene and viewport size, so larger and smaller Scenes use the same centering formula.

## Animation duration determines scroll distance

Locked zones convert animation duration to scroll distance at `1ms = 1px`. This distance is the scroll budget. The Scene's total space in the document also includes its content:

```text
flowSpan = max(visualSpan, viewportSpan) + totalBudgetPx
```

See [Zones and scroll budgets](/docs/02-zones-budget) for budget calculation and Scenes without entrance or exit animations.

## Scroll position determines animation progress

`nativeOffset` is `scrollTop` for vertical scrolling and `scrollLeft` for horizontal scrolling:

```text
progressPx = clamp(nativeOffset - segmentStart, 0, totalBudgetPx)
```

Reverse scrolling decreases progress through the same interval. Resize or layout changes recalculate the interval, and progress follows the updated position.

Within 0.01 px of an endpoint, progress becomes exactly zero or full to avoid floating-point error in the first and last frames.

## Large inputs stop within a locked zone

One wheel, touch, keyboard, or scrollbar input can request movement across a whole zone. Cineview limits the destination for that movement:

| Situation                                       | Final position                      |
| ----------------------------------------------- | ----------------------------------- |
| Forward, crossing the whole zone from outside   | `min(segmentStart + 1, segmentEnd)` |
| Forward, already inside, target past the end    | `segmentEnd`                        |
| Backward, crossing the whole zone from outside  | `max(segmentEnd - 1, segmentStart)` |
| Backward, already inside, target past the start | `segmentStart`                      |

After reaching an endpoint, the next input can continue moving. Ordinary scenes are unaffected. Only zones longer than 0.5 px apply this limit.

## Navigate to the start of a zone

The scroll-mode ref provides `goToZone`:

```tsx
import { useRef } from 'react';
import { AnimateVideo, Cineview, Scene } from 'cineview';
import type { CineviewScrollRef } from 'cineview';

export function ProductPage() {
  const ref = useRef<CineviewScrollRef>(null);

  return (
    <>
      <button onClick={() => ref.current?.goToZone('product', { animated: true })}>
        View product
      </button>
      <Cineview mode="scroll" ref={ref}>
        <Scene sceneId="intro">Introduction</Scene>
        <Scene scroll={{ zoneId: 'product' }}>
          <AnimateVideo src="/product.mp4" duration={{ enter: 2000 }} />
        </Scene>
      </Cineview>
    </>
  );
}
```

| Option     | Type       | Default | Notes                                                             |
| ---------- | ---------- | ------- | ----------------------------------------------------------------- |
| `animated` | `boolean`  | `true`  | Smooth scrolling; false positions immediately                     |

The destination is `centerLockOffset`, where progress is zero. Programmatic navigation can pass intermediate zones to reach its destination. See [Wheel, touch, keyboard, and scrollbar](/docs/03-inputs) for how user input interrupts smooth scrolling.

## Read locked-zone state

Set these scroll-only callbacks in `Cineview.callbacks`:

| Callback         | Parameter                          | Fires when                                                            |
| ---------------- | ---------------------------------- | --------------------------------------------------------------------- |
| `onZoneEnter`    | `{ zoneId, sceneIndex }`           | The zone becomes active                                               |
| `onZoneProgress` | `{ zoneId, sceneIndex, progress }` | Movement exceeds 0.5 px since the last report, or reaches an endpoint |
| `onZoneLeave`    | `{ zoneId, sceneIndex }`           | The zone becomes inactive                                             |

`progress` is `progressPx / totalBudgetPx`, from 0 to 1. The initial frame also reports progress.

A zone is active when the scroll position is inside the interval and more than 0.5 px from both ends. See [Callbacks](/docs/03-callbacks) for complete parameter definitions.

## Related pages

- [Zones and scroll budgets](/docs/02-zones-budget): durations, dependencies, and progress intervals
- [Wheel, touch, keyboard, and scrollbar](/docs/03-inputs): input rules and nested scrolling
- [Fixed elements within a Scene](/docs/04-fixed-layer): fixed controls and progress indicators
- [Scroll troubleshooting](/docs/06-scroll-pitfalls): common issues and changes to make
