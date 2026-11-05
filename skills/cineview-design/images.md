# Images

> Reading this while planning is fine. Code from it goes into a page only after the user has
> confirmed the storyboard (`SKILL.md`).

Choose the treatment from what the picture has to say, then the arrangement from
`relationships.md`.

| When the picture is meant to | A treatment that fits | Why |
|---|---|---|
| arrive with the sentence about it | a wipe from the side its words are on | the direction ties the picture to its sentence |
| look like one set with other photos | `duotone` | two shared inks make mixed photos one series |
| come into focus as the reader reaches it | `focus` on time, or `focus(band)` as it passes | sharpness shows where to look |
| keep its place while it loads | `develop` with a stand-in | the layout does not jump, and the picture develops |
| be looked at slowly, detail by detail | `push(from, to, focus)` | a slow push holds the eye on the chosen point |
| show a plan or a flow | small frames in a row with arrows | a sequence of thumbnails reads as steps |
| be one of several related items | cards, in a stack or a row | a set reads as a set |
| fill a phone screen on a drag page | a portrait crop, with the finger bringing it in | one picture per gesture |

## Preparing pictures

- Serve each picture at about twice its displayed CSS width. WebP or JPEG at quality 70-80.
- Pictures that share an arrangement share an aspect ratio. Crop to the subject.
- For phone pages, keep portrait crops (4:5, 9:16) as well as landscape ones (`phone.md`).
- For blur effects on large pictures, make a stand-in 16-32 px wide: `data-cv-blurred` for
  `focus`, `data-cv-standin` for `develop`.
- `duotone` reads each image's pixels, so the images must be on the same origin or served with
  CORS.

## The treatments, as markup

**Wiped in beside its sentence.** With the words on the left, the picture is wiped in from the
left, the side its sentence is on. Mirror both for the next pair.

```html
<cv-animate fx="rise(soft)" duration="700"><h3>Write the brief</h3><p>Say what the page must explain.</p></cv-animate>
<cv-animate fx="wipe(left), push(1.04, 1)" duration="1100" delay="120">
  <img src="brief.jpg" alt="A one-page brief" width="1120" height="720">
</cv-animate>
```

**One set, two inks.** The named pairs are `blue`, `orange`, `terracotta` and `mono`, or use any
dark and light colour from the page's palette. The print fades in over its window. Stagger several
pictures by shifting their windows.

```html
<cv-animate fx="duotone(var(--ink-dark), var(--ink-light))" at="20% 40%" ease="linear">
  <img src="a.jpg" alt=""><img src="b.jpg" alt=""><img src="c.jpg" alt="">
</cv-animate>
```

**Into focus.**
- On time, as it enters: `<cv-animate fx="focus" duration="900">`.
- As it passes the middle of the screen in an ordinary scroll section: `fx="focus(band)"`. On text,
  this leaves the words blurred for most of the passage.
- While it really loads:
  `<cv-animate fx="develop"><img src="big.jpg" data-cv-standin="tiny.jpg"></cv-animate>`.

**A slow look.** The third argument is the point that stays still. It pairs well with a caption
that enters late (`after`), and with only one push in view at a time.

```html
<cv-animate fx="push(1.06, 1, 30% 40%)" duration="3000" ease="linear">
  <img src="hall.jpg" alt="The hall at dusk">
</cv-animate>
```

**Frames of a plan.** Three to six small frames, as line drawings or crops, with arrows between
them and a caption under each. They suit a plan of scenes, a user journey, or "how it will go".

**Picture cards.** A thumbnail inside each card (fixed `aspect-ratio`, `object-fit: cover`), with
a title and two lines under it. The cards go in a `cv-stack` or a row.

## On drag pages

- One picture usually fills the screen. The finger brings it in (a rise, a wipe, a slow push that
  starts under the finger), and its caption plays after release.
- Pictures in a set can change by cover from one screen to the next (`handovers.md`).
- `focus(band)` depends on content passing the middle of the screen, which on a drag page happens
  only during the slide. A time-played `focus` suits drag scenes better.
