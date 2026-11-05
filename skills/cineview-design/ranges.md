# Numbers that hold

Facts and common ranges, so that a design choice does not break reading or timing. Inside these
ranges, the choices belong to the page.

## Reading

- **Contrast.** Body text 4.5:1 against what is behind it; large titles 3:1 (WCAG AA).
- **Line length.** About 45-75 characters for Latin text, about 20-35 characters for Chinese.
- **Line height.** About 1.4-1.7 for body text; titles often tighter, around 1.0-1.2.
- **Body size on phones.** About 16 CSS px or more. On a portrait phone, one screen holds a title,
  a line or two and one picture before it feels crowded (`phone.md`).

## Timing

- **Entrances played on time.** Commonly 300-900 ms. Much shorter reads closer to a cut, and much
  longer makes the reader wait for the content.
- **Stagger between lines, words or cards.** Commonly 60-150 ms.
- **Loops.** Commonly 4-20 s per cycle. Slow enough not to pull the eye from the text.
- **Held scenes (`zone`).** 1 ms of timeline is 1 px of scroll, so a scene of 3000 ms takes three
  screens of scrolling on a 1000 px tall window.

## Drag

These hold with the default settings (`drag.md`):
- **Mapping.** 1% of the screen height dragged is 10 ms of the next scene, so a full screen is
  1000 ms.
- **Switching.** A swipe shorter than 300 ms switches at 8% of the screen height. A slower drag
  switches past half the screen. An authored `threshold` replaces both rules.
- **What the finger covers.** A quick swipe brings in only the first 80-300 ms of the next scene.
  The rest plays at normal speed after release.
- **Exits.** The leaving scene's exits run over `transition-duration` (800 ms by default) of page
  travel. An exit longer than that never finishes on screen. One around half of it finishes while
  the scene is still in view.
