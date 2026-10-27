---
title: Setup
eyebrow: GETTING STARTED / SETUP
---

Install the package from npm, or load it straight from a content delivery network (CDN). Either way a page needs three things in `<head>`: a short script, the startup styles and the runtime module.

## Install

```bash
npm install cineview
```

The package has no dependencies. Its files are in `node_modules/cineview/dist/`:

| File | Contents |
| --- | --- |
| `cineview.js` | The runtime module; what the first screen needs stays under 44 KiB gzip |
| `chunks/` | Modules loaded on demand: split text, picture treatments, counts, keyframes, drag |
| `cineview.css` | Startup styles: structure and first-screen states before the module runs |
| `head.js` | The short script for `<head>`, with its content security policy hash |
| `dev/cineview.js` | The development build, which prints warnings and errors in the console |
| `types/` | Type declarations, including `jsx.d.ts` for JSX |

## Load it in a page

All three go in `<head>`, in this order. From a CDN:

```html
<!-- 1. the contents of head.js: adds cv-js to <html> when the browser qualifies -->
<script>(function(s){if(s&&s('selector(:has(*))')&&s('width:1lh')&&s('color:color-mix(in srgb,red,red)'))document.documentElement.classList.add('cv-js')})(window.CSS&&CSS.supports);</script>
<!-- 2. startup styles -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/cineview@2/dist/cineview.css">
<!-- 3. the runtime -->
<script type="module" src="https://cdn.jsdelivr.net/npm/cineview@2/dist/cineview.js"></script>
```

To serve the files yourself, copy `dist/` to the site and point the two URLs at it.

Without the first two, every animated element paints in its finished state and jumps back to its start when the module runs: a flash on every load.

A browser that does not qualify gets no `cv-js` class and shows the page as static content, with its text and pictures readable. The requirement is Safari 16.4, Chrome 111 or Firefox 128 and later.

## With a bundler

Import the module once, anywhere in the page's script; the elements register themselves:

```js
import 'cineview';
```

Keep the head script and `cineview/cineview.css` in the page's `<head>` as above, so the first screen is right before the script runs. Turn on code splitting (Vite and Rollup do it by default; esbuild needs `--splitting`), so the modules loaded on demand stay separate files.

## Content security policy

On a page with a content security policy, allow the inline script by its hash, which is on the first line of `head.js`.

## Checks during development

Load `dev/cineview.js` while building a page: misspelled attributes and names that do not match get an explanation in the console. Both builds dispatch a `cv-error` event on the element at fault, so one listener covers them:

```js
document.addEventListener('cv-error', (e) => {
  console.warn(e.detail.code, e.detail.message, e.detail.element);
});
```

The error codes are listed in [states and events](/docs/07-states-and-events).
