---
title: Setup
eyebrow: GETTING STARTED / SETUP
---

2.0 is not on npm yet. Build the runtime in the repository and serve it where the page can load it.

## Build the runtime

```bash
node v2/build.mjs
```

The output is in `v2/dist/`:

| File | Contents |
| --- | --- |
| `cineview.js` | The runtime module; what the first screen needs stays under 40 KiB gzip |
| `chunks/` | Modules loaded on demand: split text, picture treatments, counts, keyframes, drag |
| `cineview.css` | Startup styles: structure and first-screen states before the module runs |
| `head.js` | A short script for `<head>` |
| `dev/cineview.js` | The development build, which prints warnings and errors in the console |
| `types/` | Type declarations, including `jsx.d.ts` for JSX |

## Load it in a page

All three go in `<head>`, in this order:

```html
<!-- 1. the contents of head.js: adds cv-js to <html> when the browser qualifies -->
<script>(function(s){if(s&&s('selector(:has(*))')&&s('width:1lh')&&s('color:color-mix(in srgb,red,red)'))document.documentElement.classList.add('cv-js')})(window.CSS&&CSS.supports);</script>
<!-- 2. startup styles -->
<link rel="stylesheet" href="/v2/cineview.css">
<!-- 3. the runtime -->
<script type="module" src="/v2/cineview.js"></script>
```

Without the first two, every animated element paints in its finished state and jumps back to its start when the module runs: a flash on every load.

A browser that does not qualify gets no `cv-js` class and shows the page as static content, with its text and pictures readable. The requirement is Safari 16.4, Chrome 111 or Firefox 128 and later.

## Content security policy

On a page with a content security policy, allow the inline script by its hash, which is on the first line of `head.js`.

## Checks during development

Load `dev/cineview.js` while building a page: misspelled attributes and names that do not match get an explanation in the console. Both builds dispatch a `cv-error` event on the element at fault, so one listener covers them:

```js
document.addEventListener('cv-error', (e) => {
  console.warn(e.detail.code, e.detail.message, e.detail.element);
});
```

The error codes are listed in [states and events](/docs/v2/07-states-and-events).
