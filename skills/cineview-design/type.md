# Type

> Reading this while planning is fine. Code from it goes into a page only after the user has
> confirmed the storyboard (`SKILL.md`).

Animated text stays real text: the copies the framework makes for animation are hidden from
screen readers, and the original stays selectable. The examples use `--font-display`,
`--font-body`, `--ink` and `--accent` (`styles.md`).

## Ways to set a title

Very different openings come from a few choices: how many lines, how they align, what moves, and
what sits beside them. Each of these says something different.

- **A centred stack** of two or three short lines, each rising out of its own clip. Neutral; it
  works with most styles.
- **One huge word**, as wide as the screen, with the explanation small beneath it. Loud; it suits
  posters and launches. It can gain weight as it enters (`axis`) or be wiped in.
- **The number first.** A large real figure leads, and the title is its caption.
- **A title over a picture.** The picture carries the mood, and the title enters once
  (`relationships.md`).
- **A title beside the product.** Flush left with a sentence, and the product on the other side.
- **Words that arrive one by one.** A manifesto line, or each word lit in turn as the reader
  scrolls (word scrub, reference 10).
- **Mixed weights.** One or two heavier or accent-coloured words inside a light title, for a
  single emphasised idea.

## Keeping a title's line breaks

Browsers break titles wherever they fit, which can strand one word or one Chinese character on a
line. Wrapping each intended line in a span that does not wrap keeps the breaks where they were
meant:

```html
<h2 class="title"><span class="nb">Small batches,</span> <span class="nb">roasted every week</span></h2>
<h2 class="title"><span class="nb">小批烘焙，</span><span class="nb">每周新鲜出炉</span></h2>
```

```css
.title .nb { display: inline-block; white-space: nowrap; }
```

Chinese needs no space between the spans, because the full-width comma already spaces it.
`display: block` on the spans keeps the lines at every width. On narrow screens the spans may need
`white-space: normal`. For titles of one or two lines, `text-wrap: balance` is a lighter
alternative.

## Lines that enter one after another

```html
<cv-animate split="lines" fx="rise(soft)" stagger="140" duration="700">
  <p>First line of a short passage,<br>the second follows,<br>then the third.</p>
</cv-animate>
```

This suits two to four lines. Lines are measured after the fonts load, so check them at each
width. After a language change, reload the page, or keep `split` off titles whose text changes.
`rise(line)` rises out of each line's own clip without fading.

## Weight that changes

```html
<cv-animate fx="axis(wght 250 650)" duration="1600"><span class="big">Stay</span></cv-animate>
```

It reads as emphasis arriving and is most visible on large words. It needs a font with that axis:
Inter, Fraunces, Recursive and Noto Serif SC have weight.

## A number that counts

```html
<cv-animate fx="count"><span class="big">12,800</span></cv-animate> <span class="unit">km</span>
<p class="label">ridden in testing</p>
```

The digits roll up to the real value, and the unit and the label stay still.

## Typing

This suits conversations, AI products and commands. The full text is in the page from the start,
and a few lines of script reveal it, so nothing reflows:

```js
function typewriter(el, msPerChar = 22) {
  const text = el.textContent, shown = document.createElement('span'), rest = document.createElement('span');
  rest.style.color = 'transparent'; rest.textContent = text; el.replaceChildren(shown, rest);
  let n = 0;
  return new Promise((done) => (function step() {
    shown.textContent = text.slice(0, ++n); rest.textContent = text.slice(n);
    n < text.length ? setTimeout(step, msPerChar) : done();
  })());
}
```

A "typing" indicator (three dots) before each answer reads as a conversation. Under reduced
motion the text can simply appear.

## On phones and drag pages

- A phone shows few words per line, so titles can be large; two to six words is a comfortable
  title. Check every title's break in each language at phone width.
- On a drag page, a title that should feel pulled in by the finger belongs at the start of the
  scene's timeline. A sentence that follows can play after release.
