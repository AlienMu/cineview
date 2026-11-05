# Words and pictures on a screen

Most screens come down to a relationship between words and a picture: they sit side by side, one
lies over the other, one follows the other. Choosing the relationship first, then the
arrangement, keeps a page from defaulting to the same two-column screen. Each relationship below
gives what it says, what can vary, how it behaves in each mode, and what changes on a phone.
Sizes and reading limits are in `ranges.md`.

## Side by side

- **Says:** the words explain the picture, and the reader moves between the two.
- **Can vary:** which side the picture is on, and whether that alternates down the page; the
  ratio of the columns (an even split is calm, an uneven one gives the picture weight); how the
  two align (centres, tops, a shared baseline); a picture that bleeds off the edge.
- **Scroll:** the picture arrives from the side of its words (a wipe from that side). **Held
  scene:** the picture is a demo that changes while the words stay. **Drag:** usually too wide
  for one phone screen, so it becomes a stack.
- **On phones:** a stack. Decide which comes first: the picture when it carries the point, the
  words when the picture needs explaining.
- **Watch for:** every screen becoming the same two columns.

## Words over the picture

- **Says:** the picture is the subject and the mood; the words are its title or caption. The
  reader feels the picture first, then reads.
- **Can vary:** where the words sit (a corner, the centre, along a line inside the picture); how
  they stay readable (a gradient, a blur, a solid band, or letters cut from the picture, reference
  34); whether the picture moves (a slow push, still, a video).
- **Scroll:** the picture can drift behind still words. **Held scene:** a slow push while the
  words arrive in parts. **Drag:** one picture per screen, brought in by the finger; the words
  follow after release.
- **On phones:** recrop to portrait. Keep the words above the thumb area and clear of the screen's
  rounded corners and bars (`phone.md`).
- **Watch for:** words over the subject's face; contrast that changes as the picture moves.

## One after the other

- **Says:** first this, then that. Cause and effect, or a reveal.
- **Can vary:** what comes first (the picture as a question and the words as the answer, or the
  reverse); the gap between them; whether the second replaces the first or joins it.
- **Scroll:** order in space as the reader scrolls on. **Held scene:** order in time, set with
  `after`. **Drag:** the finger brings in the first, and the second plays after release.
- **On phones:** the same, and often clearer, since one thing fills the screen at a time.
- **Watch for:** a second element that arrives so late the reader has already moved on.

## Comparison

- **Says:** these two differ, as before and after, this or that, or then and now.
- **Can vary:** side by side or one over the other; a divider the reader moves (reference 31); two
  states that swap; the same frame and angle for both, so only the difference changes.
- **Scroll:** two pictures entering together. **Held scene:** one picture changing into the other
  as the reader scrolls. **Drag:** the two as consecutive screens, with a cover between them.
- **On phones:** one over the other, or the swap.
- **Watch for:** pairs shot differently, so the reader compares the photography rather than the
  subject.

## Focus on a detail

- **Says:** look closer, this part matters.
- **Can vary:** a push into the detail; a crop that enlarges it; a callout line with a label;
  everything else blurred or dimmed.
- **Scroll:** a push or focus as the picture passes. **Held scene:** a push that follows the scroll,
  with labels arriving as each part is reached. **Drag:** the screen opens on the whole picture,
  and the push and labels follow after release.
- **On phones:** labels below the picture, or one detail per screen.
- **Watch for:** labels that cover the detail they name.

## A set of items

- **Says:** there are several of a kind.
- **Can vary:** a grid of equal tiles; a grid of unequal tiles where one leads; a sideways row
  (reference 05); a stack of cards (06); one item per screen.
- **Scroll:** a grid entering with a short stagger, or a sideways row. **Held scene:** cards
  stacking one after another. **Drag:** one item per screen, or a row that moves on the scene's
  time.
- **On phones:** one column, a sideways row with panels of a fixed width, or one per screen.
- **Watch for:** a set with no lead item, where the eye has nowhere to start.

## A process

- **Says:** this happens, then this, then this.
- **Can vary:** numbered steps; a line connecting them (reference 09); cards that stack; the
  product itself changing step by step.
- **Scroll:** steps arriving in order. **Held scene:** the process playing out as the reader
  scrolls, with each step lit as it is reached. **Drag:** one step per screen, or a short process
  drawn under the finger.
- **On phones:** steps stacked vertically, with the connecting line running down.
- **Watch for:** more steps than a reader can hold; three or four usually read at a glance.

## A number as proof

- **Says:** this is measurable and true.
- **Can vary:** one large number or two or three side by side; the number counting up (reference
  13); the unit beside it; a label and a source underneath.
- **Scroll:** the count plays as it comes into view. **Held scene:** the count follows the
  scroll. **Drag:** the count starts under the finger and finishes after release.
- **On phones:** one number per row, large.
- **Watch for:** invented numbers, numbers without a unit or a source, and more than three at once.

## Arranging it

- Any of these can be centred, flush to one side, set on a strict grid, or broken on purpose. The
  style in `styles.md` usually decides which.
- Layout for an animated group, such as a row of buttons or a label with an icon, goes on an
  element inside the `<cv-animate>`. Layout set on the `cv-animate` itself does not reach its
  children (`framework.md`).
- Decoration under the content (`z-index: 0`), with the content above it, keeps text readable. On
  phones, decoration that would sit under text is often better hidden.
