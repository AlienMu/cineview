---
title: First screen
eyebrow: CONCEPTS / FIRST SCREEN
---

The first screen is the riskiest part of a page: the module has not run, pictures have not arrived, and the reader is already looking. 2.0 covers that time with its startup styles and a first-screen wait.

## Before the module runs

`cineview.css` sets the page structure before the module runs, and decides how the first scene's elements show meanwhile:

- When every animated element of the first scene uses one built-in preset without arguments (`fx="rise"`, `fx="fade"`), those entrances play in CSS from the first frame. The module picks them up where they are; nothing restarts.
- Otherwise the first scene's animated elements start hidden and the runtime shows them. If the module has not run within 4 seconds, CSS shows them by itself so the content stays readable.
- When the module arrives after those 4 seconds, content already shown stays in its finished state, including `on="clock"` entrances. Later returns follow the element's `replay` setting.

Elements with `delay`, `after`, `at`, `stagger`, `split`, `from`, `to`, `duration`, `ease` or `target`, and scenes with `preload`, `zone`, `track` or `sequence`, take the second path. An explicit time source (`enter`, `enter(partial)`, `eye`, `clock` or `scene`) also takes the hidden path with the 4-second reveal. Position sources (`view`, `page`, `velocity` and `direction`) keep their authored appearance before the module runs.

All of this needs the head script and `cineview.css`; [setup](/docs/02-setup) shows how to load them.

## Wait for first-screen assets

With `preload` on the first scene, its entrances wait until the scene's images and videos are ready:

```html
<cv-stage first-scene-timeout="3000">
  <cv-scene preload="hero-2x.jpg">
    <img src="hero.jpg" alt="…">
    <cv-animate fx="rise(soft)"><h1>Title</h1></cv-animate>
  </cv-scene>
</cv-stage>
```

- Without a value, `preload` waits for the scene's images to decode and its videos to be seekable frame by frame; a list of addresses adds those files.
- Each finished asset dispatches `cv-progress` on the stage with `detail` `{ kind: 'load', progress, loaded, total }`, for a loading indicator.
- The wait lasts at most `first-scene-timeout` ms, 3000 by default. On timeout the stage dispatches a cancelable `cv-timeout`. Unless a listener calls `preventDefault()`, the entrances start; with it, the wait goes on until the assets arrive.
- An asset that fails counts as finished and dispatches an `asset-failed` `cv-error`.

## Reload in the middle of a page

On reload the browser restores the scroll position and the stage builds at that position. A locked zone gets its height when the stage builds, so a reload in the middle of a long zone can paint the top of the page for a frame first. Giving the zone the same height in CSS avoids it:

```css
/* a locked zone whose longest duration is 2400 */
#story { height: calc(2400px + 100svh); }
cv-stage, cv-scene { display: block; }
```

To restore the current scene's palette as well, a short script in `<head>` can save it and apply it early; the design skill described in [working with AI](/docs/04-working-with-ai) has the recipe (K3 in `checks.md`).
