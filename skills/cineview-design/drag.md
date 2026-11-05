# Drag mode

`<cv-stage input="drag">`: every scene is one screen. The reader drags up for the next scene and
down for the previous one. Drag pages are made for phones (`phone.md`). On a computer, dragging
with the mouse works, and so do the arrow keys after a click; the wheel and the trackpad do
nothing.

## What the reader does

- They drag up or down, and the page follows the finger.
- They let go. Past the threshold the page switches; short of it, the page springs back.
- They can also use the keys (once the stage has focus), links to a scene's id, or a button that
  calls `stage.goTo()`.
- A press that starts on a button, link, text field, `cv-pause` or an element with
  `data-cv-ignore-drag` does not drag the page. A scrolling area inside a scene keeps the finger
  for as long as it can still scroll that way.

## Two scenes at once

While the reader drags, the leaving scene and the arriving scene share the screen. Several things
happen at once:

1. **The page** follows the finger.
2. **The arriving scene's timeline** follows the finger too: by default, 1% of the screen is 10 ms
   of that scene.
3. **The leaving scene**, when the reader drags on to the next scene: elements that have an
   `exit` play it as the page travels. Elements without one move with the page as they are.
4. **Dragging back** toward the previous scene: elements of the current scene that have an `exit`
   run their entrance backwards instead. The previous scene plays its entrance again from the
   start, following the finger.
5. **After release, if the page switches**: it slides the rest of the way, and the arriving
   scene's timeline carries on at normal speed from wherever the finger left it. The scene that
   was left returns to its start, so dragging back to it plays its entrance again. Elements with
   `replay="false"` are the exception: after one complete entrance they stay entered, also on the
   way back.
6. **After release, if the page springs back**: the arriving scene's timeline runs back to zero.
   The current scene stays, and any entrance the drag interrupted plays on to its end.

## Time, in numbers

- **Mapping.** `unit` and `scale` turn finger travel into the arriving scene's time.
  - The default, `unit="time" scale="10"`, makes 1% of the screen 10 ms, so a full screen is
    1000 ms.
  - With `unit="percent"`, it is the share of the screen × `scale` × the scene's length: with
    `scale="1"` a full screen plays the whole scene, and with `scale="2"` half a screen does.
  - Set either on the stage, or on one scene.
- **Switching**, with no `threshold`:
  - a swipe shorter than 300 ms switches at 8% of the screen height;
  - a slower drag switches past half the screen;
  - movement within 5 px is not a drag;
  - a fast flick back the other way cancels.

  An authored `threshold="slow fast speed"` (for example `"0.3 0.15 1000"`) replaces both rules
  with the older one: a release at rest needs the slow share, and a release at `speed` px/s needs
  only the fast share.
- **What the finger covers.** With the defaults, a quick swipe brings in only the first
  80-300 ms of the next scene, and a slow drag past half the screen brings in 500 ms or more. The
  rest plays after release, at normal speed.
- **The slide.** After a switch, the page slides the remaining distance in remaining travel ×
  `transition-duration` (800 ms by default), easing out.
- **Exits** run over travel × `transition-duration`. An exit longer than that never finishes on
  screen. One around half of it finishes while the leaving scene is still in view.
- **Clock elements** (`on="clock"`) in the arriving scene wait until the page has landed. Under the
  finger they are still hidden.
- **Loops** start once an element's entrance has finished. They stop when its scene leaves the
  rendered range: the current scene and one on each side.
- **Easing** applies to progress, whatever drives it, so under the finger an entrance follows its
  curve, not the finger. At 10% of a screen dragged into a one-second entrance:
  - most presets default to `settle`, which starts fast, so the frame is already about 45% in;
  - wipes, `push`, `draw` and `reveal` default to `pan`, which is gentle at both ends;
  - `from`/`to` and raw `exit` values default to `ease-in-out`, and `ease-in` is similar: the frame
    is barely 2% in, so the start feels late;
  - `ease="linear"` keeps the frame exactly where the finger is, about 10%.

  Choose by how the first moments should feel under the finger. After release, the same curve
  shapes the rest of the entrance.

## Designing with that

These are ideas with their reasons, not rules.
- **The finger controls each scene's first moments.** Something that should feel pulled into view
  (the picture, a large shape, the new ground colour) works best at the start of the scene's
  timeline. Details such as secondary lines, labels and counts can come later, since they play
  after release anyway.
- **Short scene timelines suit drag.** The rest of the entrance plays after every swipe. A long
  one keeps the reader waiting, or is cut off by the next swipe.
- **Exits read best as clearing moves**, such as a fade or a short rise, at around half the
  `transition-duration` so they are seen in full. Information in an exit is easily missed.
- **Elements that should run backwards** when the reader drags back need an `exit`. Elements
  without one ride the page, which suits backgrounds and frames.
- **A scene built only from clock elements looks empty while it is dragged in.** At least one
  element on the scene's own time, which is the default, gives the finger something to bring.
- **More of a scene under the finger**: `unit="percent"` with a `scale` above 1, for example a
  product that assembles as the reader pulls. The default keeps the finger for the opening and
  lets the rest play.
- The kinds of change between scenes (push, cover, joining at the boundary, a palette change) are
  in `handovers.md`.

## The first scene

- **On load** it plays its entrance on the clock, with no finger involved, continuing from
  wherever the CSS-first entrance had got to.
- **`<cv-scene preload>`** holds it until its images and videos are ready, for at most
  `first-scene-timeout` (3000 ms by default). A drag during that wait ends it: clock entrances
  start at once, and if the drag ends without a switch, the scene's entrance plays even if the
  assets are still loading.
- **Showing readers that they can drag.** A few options:
  - a short line that says so;
  - a small mark that drifts upward on a `loop` (loops start after the entrance);
  - a composition that points up, such as a line leading off the top or an arrow in the picture.

## The last scene

There is no next scene, so dragging up does nothing. The last scene usually holds the action:
buttons and links work normally, and a press on them never drags.

## Reading and access

- **Screen readers.** Scenes outside the current one are `inert` and hidden from assistive
  technology, and scene changes are announced politely. Screen-reader users cannot drag, so
  visible previous and next buttons (`stage.goTo`) or a list of links to the scenes give them a
  way through (references 16 and 17 in `motion.md`).
- **Keys.** The arrows, Page Up, Page Down, Home and End work once the stage has focus, after a
  click or Tab. They do nothing while focus is in a text field.
- **Reduced motion.** Motion that follows the finger stays, and loops stop. A scene reached
  without the finger (on load, from the keys, a link or `goTo`) shows its entrances as an opacity
  change of at most 200 ms, and `on="clock"` elements do the same. After a release, the rest of an
  entrance ends within 200 ms.
- **Pausing.** `<cv-pause>`, `stage.pause()` or the `paused` attribute holds each scene's time
  and its loops. Dragging and the keys still change scenes; entrances go on when the stage plays.
- **Copying text.** The drag stage turns off text selection, so addresses and codes cannot be
  selected. To make them copyable:

  ```html
  <p class="copyable" data-cv-ignore-drag>12 Harbour Road, Room 5</p>
  ```

  ```css
  .copyable { -webkit-user-select: text; user-select: text; }
  ```

  `data-cv-ignore-drag` stops a press on the text from paging. A copy button works too.

## On a computer

A drag page opened on a desktop responds to dragging with the mouse and, after a click, to the
keys. The wheel and the trackpad do nothing. If desktop readers matter, add previous and next
buttons, or use the two-device setup in `phone.md`, which gives desktops a scroll page.

## In the hand

- **Rotation.** The mode is fixed when the page loads, and each scene is clipped to one screen.
  Turned sideways, a portrait composition loses its lower part unless it also fits a landscape
  screen.
- **System gestures** at the screen edges (back, home) cancel a drag, and the page springs back.
- **Chat apps and other in-app browsers** have their own bars and gestures. Test there
  (`phone.md`).

## Settings and events

| Attribute | On | Does |
|---|---|---|
| `transition-duration` | `cv-stage` | The page slide, and the time base of exits (ms, default 800) |
| `threshold` | `cv-stage`, `cv-scene` | The older release rule: `"slow fast speed"` |
| `unit`, `scale` | `cv-stage`, `cv-scene` | How finger travel maps to the arriving scene's time |
| `drag="off"` | `cv-scene` | The scene cannot be dragged into; links and `goTo` still reach it |

Events:
- `cv-dragstart`, `cv-dragend`, `cv-dragcancel` and `cv-dragblocked` (a drag toward a
  `drag="off"` scene).
- `cv-progress` with `kind: 'page'` (the page position).
- `cv-activate` and `cv-deactivate`, when a scene enters or leaves the rendered range. These are a
  good place to start and stop drawing of your own.

## Remembering the scene across a reload

A drag page does not write the current scene into the address. Writing it on each change lets a
reload return to the same scene, and so does a chat app that discarded the tab, because the stage
starts at the scene the hash names:

```js
stage.addEventListener('cv-enter', (e) => {
  if (e.target.localName === 'cv-scene') history.replaceState(history.state, '', '#' + e.target.id);
});
```
