# Designing for phones

A phone page is held in one hand and read in a portrait screen, often in a chat app's browser on
the move. These notes cover drag pages, phone-only scroll pages, and the phone side of pages made
for both devices.

## One screen at a time

- **What fits.** A portrait screen comfortably holds a title, a line or two, and one picture. On a
  drag page that is the whole scene, because each scene is clipped to one screen. On a scroll
  page, more than that becomes reading, which is fine when the page is meant to be read.
- **Where the thumb reaches.** The lower half of the screen is easiest to reach. Actions (a
  button, a link, a form) sit well there. The top corners are the hardest to reach.
- **Edges.** Leave room at the screen's rounded corners and at the system bars. With
  `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, the
  page can use `env(safe-area-inset-top)` and the other insets to keep content clear.

## Units and sizes

- **`design-width="750"`**, the default, makes `--cv-unit` one design pixel. It is the scene's
  width divided by 750, and never more than 1 CSS px. On a 390 px phone, 40 design px of text is
  about 21 CSS px.
- **Plain CSS** works too: `rem`, `clamp()`, and `vw` for large type.
- **A unit based on a 1920-wide design** shrinks to about 0.2 CSS px on a phone. That suits pages
  designed for desktops first and only scaled down; a phone design needs its own sizes.
- **Body text** of about 16 CSS px or more stays readable. Titles can be very large, since a phone
  shows few words per line (`ranges.md`).

## Material for a portrait screen

- **Photos** cropped to portrait (4:5, 9:16) fill a phone screen. Landscape photos either sit as a
  band with space around them, or are recropped for phones.
- **Video** for phones is usually portrait, and sized to the phone: a 9:16 clip about 720 px wide
  is plenty. Video that follows the reader's finger or scroll needs every frame to be a keyframe
  (`video.md`).
- **Screenshots** of a phone app read best at their real proportions, perhaps in a phone frame.

## Performance

- **No scroll-driven animations.** Browsers without them, such as older iOS Safari, some in-app
  browsers and Firefox, compute scroll motion in script. Pages that lean on many effects tied to
  where an element sits on screen cost more there. Effects on a held scene's time, or played on
  time, cost less.
- **Moving textures.** Paper grain, collage shadows and large blurs on scenes that move every frame
  (drag pages, held scenes) cost frames on phones. Keep textures on still layers.
- **Chinese web fonts** are several megabytes per weight. Subset them to the characters used, or
  let phones use the system fonts.
- **Size check.** Test on a real phone, or at least with the CPU throttled.
  `<cv-stage fallback>` forces the scripted path (`checks.md`).

## Drag or scroll on a phone

- **Drag suits** one idea per screen: a picture and a line, read like a short film, where each
  gesture is a step.
- **Scroll suits** longer reading, many items, forms, and readers who expect an ordinary page.
- **Drag pages get opened on computers too**, through links shared in desktop chat apps. There,
  only dragging with the mouse and the keys after a click work (`drag.md`).

## In chat apps and other in-app browsers

Links shared in chat apps open in the app's own browser. It has its own top bar, its own
back gesture, and sometimes a pull-down gesture at the top of the page. Check the page there:
- the first and last scene, where pulling past the edge can set off the app's own gesture;
- a drag that starts near the screen edge;
- copying an address or a code (`drag.md`, "Copying text").

## Both devices

**A: one scroll page.** Each scene is designed for the desktop and also given a phone
arrangement. Usually that is a stack in the order the reader needs, with the type resized and
decoration that would sit under text hidden. `relationships.md` says how each relationship
changes on a phone.

**B: the same scenes, drag on phones and scroll on desktops.** The scenes, their composition and
their motion are shared, and only the way of moving between scenes differs.
- **Choose the mode before anything is shown.** A classic script placed right after the stage, or
  one that runs at `DOMContentLoaded`, opens the page in that mode with its first entrance. Set
  after the page has been shown, the current scene stays at its end. Set `design-width` in the same
  script:

  ```html
  <cv-stage id="story">...</cv-stage>
  <script>
    (function () {
      var stage = document.getElementById('story');
      var phone = matchMedia('(hover: none) and (pointer: coarse)').matches &&
        Math.min(screen.width, screen.height) <= 500;
      stage.setAttribute('input', phone ? 'drag' : 'scroll');
      stage.setAttribute('design-width', phone ? '750' : '1920');
      stage.style.setProperty('--cv-dw', phone ? '750' : '1920');
    })();
  </script>
  ```

- **One screen per scene.** Drag clips anything taller. Design each scene to fit a phone screen,
  and on desktops let it fill the window (`height: 100svh`).
- **Leave `on` at its default.** Ordinary scroll scenes refuse `on="scene"`, and drag refuses
  `on="enter(partial)"`. The defaults are valid in both modes.
- **Held scenes differ.** On a desktop, `zone` holds the screen while the scroll plays the
  timeline. On a phone in drag, the same scene is one screen whose timeline is its entrance. A
  long held scene therefore becomes a long entrance on phones, so keep held timelines short on B
  pages.
- **Drag-only settings** (`transition-duration`, `threshold`, `unit`, `scale`, `drag="off"`) do
  nothing on desktops. They do no harm either.
- **Sizes.** `--cv-unit` is the scene's width divided by `design-width`, so the same number of
  design units is a different share of each screen: 700 units at `design-width="750"` is most of a
  phone's width, and at 1920 a third of a 1440 px window. Give each device its own sizes (a media
  query, or `clamp()`), or scale type with the screen's width.
- **Before the module runs**, the startup styles assume a design width of 750. A page that sets
  another `design-width` (in the script above, or in its markup) can also set `--cv-dw` to the same
  number in an inline style or in CSS, so sizes in design units do not jump when Cineview starts:
  `stage.style.setProperty('--cv-dw', phone ? '750' : '1920')`.
- **Rotation** does not switch the mode. A phone turned sideways keeps drag.
