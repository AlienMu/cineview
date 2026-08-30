# Third independent style review — `site/src/content/docs/{zh,en}` (80 files)

Reviewer: third-round independent agent. Method: SKILL.md rule table walked as a checklist,
every rule given an explicit verdict. Vale **not installed** (`which vale` → not found), so all
findings are manual. Prior-round reports were not read (per instructions).

Findings are appended live as they are confirmed.

## Confirmed findings (running log)

### Word choice — `whitelist` (Avoid list: use `allowlist`)

- `en/advanced/05-custom-animation.md:87` — code-comment prose `/* Whitelist-only rise: ...`
- `en/advanced/05-custom-animation.md:127` — `Two sanctioned ways past the whitelist:`
- `en/reference/07-container.md:27` — `converted by a key whitelist covering:`
- `en/reference/03-animate.md:95` — `bypassing the 10-property whitelist`
- `zh/reference/03-animate.md:95`, `zh/reference/07-container.md:27`, `zh/advanced/05-custom-animation.md:87` — `白名单` / `Whitelist-only`
  Suggestion: `allowlist` / `允许清单`（or drop the metaphor: `10 属性受支持列表`）. Not a source
  identifier (see verification note in the checklist below).

### Word choice — `abort` (Avoid: use cancel/stop)

- `en/scroll/03-inputs.md:80` — `whose corrective scrollTo would abort the smooth animation`
  → `would cancel the smooth animation`. (`AbortController` at `en/advanced/02-preload.md:100`
  is a Web API identifier in monospace — compliant, not a finding.)

### Voice/tone — Avoid `could` / `currently` / `now`

- `en/drag/05-callbacks.md:16` — `no moment exists at which you could "prepare for..."` → `can`
- `en/drag/06-drag-pitfalls.md:14` — `gesture paging duration is currently not configurable`
  → drop `currently` (`is not configurable`). zh parity: `zh/drag/06-drag-pitfalls.md:14` `目前不可配`.
- `en/scroll/04-fixed-layer.md:55` — `the frame of reference is now the fixed-layer host` → drop `now`
- `en/advanced/06-media-ownership.md:45` — `a seek to the currently mapped position` → `to the mapped position`

### Grammar — Oxford comma missing (en only)

- `en/concepts/06-dom-contract.md:69` — `` `id`, `data-*`, `aria-*`, `role` and `onClick` all work `` →
  comma before `and`. (zh:69 uses `、` throughout — no equivalent rule, compliant.)
- `en/drag/05-callbacks.md:43` — `` with `progress: 1`, `elapsedMs: 0` and `timelineDurationMs: 0` `` →
  comma before `and`.
- `en/drag/06-drag-pitfalls.md:46` — `so effects re-run, state resets and the element timeline restarts at 0`
  → three-item clause list, comma before `and`.

### Word choice — `hit` (Avoid: noun `visits`; verb `click`/`press`)

- `en/drag/04-ownership.md:28` — `Step 3 is the one you hit in practice` → `run into` / `encounter`
- `en/advanced/02-preload.md:69` — `Signed URLs and CDN transcoding endpoints hit this most often` → `run into this`
- `en/scroll/03-inputs.md:72` — `On a hit it defers entirely` → `On a match it defers`
  (`cache hit` at `en/advanced/02-preload.md:57`, `en/reference/04-animate-video.md:78`,
  `en/reference/06-image.md:31` is established computing terminology — judged compliant.)

### Word choice — `type` as a verb (Avoid: use `enter`)

- `en/scroll/03-inputs.md:59` — `(typing)` and `Space typed into a text field` → `(text entry)` /
  `Space entered in a text field`. zh:59 parity `（打字）` is fine (rule is en-specific phrasing).

### Formatting — numbers 1–9 in prose written as digits

- `en/advanced/06-media-ownership.md:83` — `takes the median once 6 samples have accumulated` → `six samples`
- `en/concepts/06-dom-contract.md:58` — `a Fragment holding two more finds 1` → `finds one`
  (mixes a spelled-out `two` and a digit `1` in the same clause)
- `en/drag/06-drag-pitfalls.md:58` — `The framework finds 1` → `finds one`
  (`scene 3`, `Step 3`, `progress 1`, `1px`, `0 to 100` are labels/values/dimensions — compliant.)

### Grammar/Spelling — British spelling (American English required)

- `en/drag/05-callbacks.md:27` — `a cancelled drag` → `canceled`
- `en/drag/05-callbacks.md:39` — `"the user cancelled"` → `canceled`
- `en/reference/01-cineview.md:91` — table cell `Gesture cancelled, back to the original scene` → `canceled`
  Note: no `canceled` spelling appears anywhere in `en/`, so this is uniformly British — a whole
  class the earlier rounds' checklist item 6 (British spelling) did not close.

### Grammar — hyphenated `-ly` adverb (no hyphen after adverbs ending in -ly)

- `en/advanced/02-preload.md:73` — `evicting least-recently-used entries` → `least recently used entries`

### Voice/tone — contraction mixing within one page

- `en/advanced/07-common-pitfalls.md` — `doesn't` (40, 44) / `isn't` (30, 46) alongside
  `does not` (28, 46) / `is not` (14, 54); line 46 carries both `does not` and `isn't`.
- `en/concepts/04-orchestration.md` — `doesn't` (10, 70) vs `does not` (38, 62, 92, 111).
- `en/advanced/02-preload.md` — `do not` (46) vs `don't` (77).
  Suggestion: pick one register per page. Nice-to-have severity, not must-fix.

### Grammar — quotation-mark punctuation placement (whole unexamined class)

SKILL.md: "Place commas and periods **inside** closing quotation marks." **26 instances place them
outside**, against only 5 compliant instances — i.e. the codebase convention is the wrong one:

`en/drag/03-two-track.md:38`, `en/advanced/07-common-pitfalls.md:14`,
`en/scroll/02-zones-budget.md:46` (×2), `en/scroll/06-scroll-pitfalls.md:26`,
`en/scroll/06-scroll-pitfalls.md:44`, `en/scroll/06-scroll-pitfalls.md:76`,
`en/drag/05-callbacks.md:16`, `en/scroll/01-centerlock.md:68`,
`en/scroll/04-fixed-layer.md:59` (×2), `en/getting-started/02-installation.md:44`,
`en/drag/01-layout.md:52`, `en/scroll/03-inputs.md:65`, `en/concepts/04-orchestration.md:38`,
`en/concepts/04-orchestration.md:123`, `en/drag/06-drag-pitfalls.md:24`,
`en/drag/06-drag-pitfalls.md:46`, `en/drag/02-gestures.md:19`, `en/drag/02-gestures.md:87`,
`en/concepts/06-dom-contract.md:62`, `en/concepts/03-visibility-conditions.md:38`,
`en/concepts/03-visibility-conditions.md:51`, `en/concepts/07-runtime-states.md:19` (×2),
`en/reference/09-use-animate-timeline.md:25`.
Suggestion: move the trailing `.` / `,` inside the closing quote.

### Grammar — quotation marks used for code and for section names

- `en/scroll/05-scrollbar.md:10` — `` the resolution rule is "`typeof scrollbar === 'object'` and
  `scrollbar.enabled !== false`" `` — quotation marks wrapping code. Rule: use monospace, not quotes.
- Cross-references quote a section heading instead of linking or italicizing it:
  `en/scroll/01-centerlock.md:68` (`see "Programmatic navigation"`),
  `en/getting-started/02-installation.md:44` (`described in "The per-mode entries…"`),
  `en/drag/01-layout.md:52` (`listed under "Styles the framework hardcodes"`),
  `en/drag/02-gestures.md:19` (`using the mechanism in "Interactive elements are exempt automatically"`),
  `en/advanced/03-callbacks.md:18` (`see "onError and error codes"`).
  Suggestion: use an in-page anchor link, or italics for a resource title. Nice-to-have.

### Accessibility / Grammar — link text does not match the target page's own title

Descriptive-link-text plus single-name-per-concept. The three "troubleshooting" pages are titled
`Troubleshooting` / `Scroll troubleshooting` / `Drag troubleshooting` (and zh `排错` / `scroll 排错` /
`drag 排错`), but every inbound link calls them "pitfalls" / `常见故障`:

- en `pitfalls` labels: `en/scroll/04-fixed-layer.md:68`, `en/drag/04-ownership.md:66`,
  `en/scroll/03-inputs.md:89`, `en/scroll/02-zones-budget.md:91`, `en/drag/06-drag-pitfalls.md:6`,
  `en/drag/06-drag-pitfalls.md:67`, `en/scroll/01-centerlock.md:114`,
  `en/concepts/04-orchestration.md:123`, `en/concepts/07-runtime-states.md:27`,
  `en/concepts/07-runtime-states.md:60`
- zh `常见故障` labels: `zh/drag/06-drag-pitfalls.md:6`, `:67`, `zh/concepts/04-orchestration.md:129`,
  `zh/concepts/07-runtime-states.md:27`, `:60`, `zh/reference/03-animate.md:168` — while
  `zh/scroll/06-scroll-pitfalls.md:6` and `:83` call the same page `排错`. So zh is inconsistent
  with itself as well as with the page title.
- Same page, two labels in en: `[Timeline concepts]` (`en/advanced/07-common-pitfalls.md:22`, `:30`)
  vs `[Timeline concept]` singular (`en/concepts/04-orchestration.md:128`) vs the page's actual
  title `The Animate timeline`.
- `/docs/05-responsive` carries four different labels in each language:
  en `Responsive` / `Responsive conversion base` / `responsive model` / `Responsive scaling`;
  zh `响应式` / `响应式换算` / `响应式换算基准` / `响应式模型`. The title is
  `Responsive conversion base` / `响应式换算基准`.
- `/docs/01-centerlock` en: `center-lock` / `Center-lock` / `center-lock & zones` /
  `center-lock scroll takeover` / `Center-lock takeover`; the `& zones` variant misdescribes the
  target (zones live on `/docs/02-zones-budget`).
- `/docs/08-presets` en label case split: `presets` (lowercase) vs `Presets`.
  Suggestion: use each page's own title as the link label, or one agreed short form per target.

### Terminology — zh internal single-name-per-concept violations

- `预载` vs `预加载` co-occur inside the same file: `zh/advanced/02-preload.md` (3 vs 2),
  `zh/reference/06-image.md` (3 vs 3), `zh/reference/04-animate-video.md` (3 vs 2).
  The page title is `预加载`. Pick one.
- `折算` vs `换算` co-occur for the same conversion operation in six files:
  `zh/reference/05-position.md` (4 vs 4), `zh/reference/06-image.md` (3 vs 6),
  `zh/reference/07-container.md` (2 vs 7), `zh/reference/01-cineview.md` (1 vs 4),
  `zh/scroll/04-fixed-layer.md` (1 vs 1), `zh/advanced/04-direction-x.md` (1 vs 1).
  en uses one verb (`converted`) throughout, so zh/en are not in one-to-one correspondence.
- `设计稿基准` / `设计稿宽度基准` / `设计宽度基准` — three spellings of the design base:
  `zh/reference/01-cineview.md:14`, `:26`, `:28` and `zh/reference/07-container.md:6`.

### Formatting — code-fence language labels inconsistent

Nineteen opening fences per language carry no language label while two identical-purpose blocks
are labeled `text`. SKILL.md requires syntax highlighting / consistency in code samples.

- Labeled `text`: `en/reference/09-use-animate-timeline.md:12`, `zh/reference/09-use-animate-timeline.md:12`
- Unlabeled, same kind of plain-text content (ASCII trees, formulas, attribute lists):
  `{en,zh}/advanced/02-preload.md:65`, `{en,zh}/concepts/03-visibility-conditions.md:27`, `:46`,
  `{en,zh}/concepts/04-orchestration.md:28`, `:40`, `{en,zh}/concepts/06-dom-contract.md:10`, `:64`,
  `:102`, `{en,zh}/drag/02-gestures.md:34`, `:47`, `:64`, `{en,zh}/drag/03-two-track.md:24`,
  `{en,zh}/drag/05-callbacks.md:10`, `:53`, `{en,zh}/scroll/01-centerlock.md:25`, `:47`,
  `{en,zh}/scroll/02-zones-budget.md:56`, `{en,zh}/scroll/03-inputs.md:10`, `:23`.
  Suggestion: label all of them `text`. Nice-to-have.

### Accessibility — device-specific verbs where the mechanism is pointer-generic

Source truth: the gate is `pointerEvents` (`src/components/Scene/Scene.tsx:876`), and the whole
gesture layer is pointer events, not mouse clicks — so "click" over-specifies the input device.

- `en/concepts/07-runtime-states.md:6` — `whether it can be clicked` → `whether it accepts pointer input`
- `en/concepts/06-dom-contract.md:58` and `en/scroll/06-scroll-pitfalls.md:14` — `invisible and
  unclickable` → `invisible and inert to pointer input`
- `en/scroll/04-fixed-layer.md:37` — `The pin itself is clickable` → `accepts pointer input`
  Nice-to-have; the docs are otherwise consistently device-neutral (`pointer`, `gesture`, `press`).

### Voice/tone — `should` used for prescription (present-tense/directness)

`should` appears 10 times; the instructional ones read as hedged advice where the docs elsewhere
state rules directly:

- `en/advanced/05-custom-animation.md:87`, `:127` — `custom variants on scrub lanes should stick to`
  → `stick to` / `must stick to`
- `en/advanced/06-media-ownership.md:77` — `Scrub videos should be encoded all-keyframe` → `Encode
  scrub videos all-keyframe` (active + imperative; the same page's `:55` heading already calls it
  "a hard constraint", so `should` understates it)
- `en/drag/06-drag-pitfalls.md:48` — `Effects inside a scene should only handle` → `handle only`
  Nice-to-have.

### Formatting — relative time term `today`

- `en/getting-started/02-installation.md:44` — `The only way to avoid that weight today`
- `en/concepts/01-modes.md:45`, `en/reference/01-cineview.md:46`, `en/reference/02-scene.md:79` —
  table cells `the only trigger today` / `The only trigger today`
  SKILL.md: avoid relative terms. Suggestion: drop `today` (`the only trigger`). zh parity uses
  `目前` at the same four places (`zh/.../01-modes.md:45`, `zh/reference/01-cineview.md:46`,
  `zh/reference/02-scene.md:79`, `zh/drag/06-drag-pitfalls.md:14`).

---

## Rule-table checklist — every rule, explicit verdict

Vale: **not run** (not installed). All verdicts below are manual.

### Voice and tone

| Rule | Checked | Result |
|---|---|---|
| Active voice | Yes — regex for `be`-verb + past participle, 187 hits reviewed | **PASS with note.** Nearly all are adjectival predicates or accurate statements about framework-performed action (`is clamped`, `are ignored`), where naming the actor would be noise. No agentless passive hiding a required actor. Not reported. |
| Present tense; avoid will/would/should/could/currently/now | Yes — per-token grep | **FAIL.** `could` ×1, `currently` ×1, `now` ×2, `should` ×4 prescriptive. `will` (8) and `would` (11) reviewed individually: all are legitimate hypothetical/counterfactual ("would starve the callback", "you will watch it sit still") — compliant. |
| Second person; never I/me/my | Yes | **PASS.** The only `I`/`My` hits are `I-frame` (video term) and the `My` component/`.my-panel` code identifiers. |
| No "please" | Yes (en + zh `请`) | **PASS.** Zero in en; all 8 zh `请` are inside `请求` (request). |
| Contractions consistent, non-ambiguous | Yes — per-file contraction/expansion pairing | **FAIL (nice-to-have).** Three pages mix both registers. No ambiguous contractions (`there'd`/`it'll`/`they'd`) anywhere. |
| ≤2 conjunctions per sentence; sentence length | Yes — per-sentence conjunction/word count | **FAIL (nice-to-have).** 11 sentences at 4–5 conjunctions; worst `en/getting-started/02-installation.md:79` (5 conjunctions, 52 words). Also `en/concepts/06-dom-contract.md:113` at 51 words. |
| Gerunds in prose / prepositional phrases | Yes | **PASS.** `on waiting`/`on scrubbing`/`on ordering` occur only inside table cells as noun phrases ("cap on waiting for priority assets"), not as "on configuring"-style titles. |
| Informational tone | Yes | **PASS.** Uniformly direct and neutral; no marketing register. |

### Word choice (full Avoid/Caution table, every word)

Every row of the table was grepped. Zero occurrences: `blacklist`, `boot`, `choose`, `easy/easily`,
`e.g.`, `hack`, `i.e.`, `etc.`, `kill`, `launch`, `please`, `simple/simply`, `terminate`, `utilize`,
`duplicate`, `clone`. Present and **compliant**: `add`, `can`, `cancel`, `cannot/can't`, `create`,
`delete`, `enable`, `enter`, `open`, `remove`, `select`, `start`, `view`, `edit`, `disable`,
`app` (absent), `unable` (absent), `begin` (absent), `copy`.

| Word | Result |
|---|---|
| abort | **FAIL** ×1 prose (`en/scroll/03-inputs.md:80`); `AbortController` is an API name — compliant. |
| above / below | **PASS.** All 12 en hits are geometric/numeric ("below 40px", "above 1000 px/s", "z-index above the fixed layer", "in from below the viewport") — never positional cross-references. |
| could | **FAIL** ×1. |
| hit | **FAIL** ×3 prose; `cache hit` ×3 judged compliant computing idiom. |
| invalid | **FAIL** ×1 prose (`en/advanced/06-media-ownership.md:14`, `duration` is invalid → `is not valid`). Other 21 hits are the `INVALID_ANIMATION`/`INVALID_CONFIG` error-code identifiers — compliant. |
| may | **PASS.** All 6 uses are genuine permissibility/optionality ("may be an array", "may be `null`", "may only point at"), which the table sanctions. |
| type (verb) | **FAIL** ×1 (`en/scroll/03-inputs.md:59`). All other 67 are the noun (data type / TypeScript) — compliant. |
| whitelist | **FAIL** ×4 en + ×3 zh `白名单`. Verified **not** a source identifier: `grep -ri 'whitelist' src/` finds it only in a test description, never as an exported API name — so no naming-fidelity exemption applies. |
| via | **PASS.** Zero occurrences. |
| click | **FAIL (nice-to-have)** ×4 as `clickable`/`unclickable`/`can be clicked` where source gates on `pointerEvents`. |

### Grammar and spelling

| Rule | Checked | Result |
|---|---|---|
| American English | Yes — targeted -ise/-yse/-our/-re/-ence list | **FAIL.** `cancelled` ×3, with zero `canceled` anywhere. Everything else American (`normalized`, `recognized`, `color`, `center`, `behavior`, `hardcoded`). |
| Oxford comma | Yes — programmatic 3+ item list detector | **FAIL** ×3. |
| Abbreviations spelled out on first use | Yes — enumerated every acronym + its first occurrence per file | **PASS.** All are standard web/CS terms whose expansion adds nothing for the audience (API, CSS, DOM, ESM, UMD, CJS, IIFE, JSX, GPU, LRU, CDN, KB, MB, CSSOM, URL). Judged compliant, not reported. |
| No apostrophes in plurals | Yes | **PASS.** Only `URLs`; zero `API's`-style forms. |
| Sentence-style capitalization in headings | Yes — all `##`/`###` **and** every frontmatter `title:` in both languages | **PASS.** 80/80 titles and every heading are sentence case; product/identifier names (`CineView`, `AnimateVideo`, `useAnimateTimeline`, `DOM`, `TypeScript`) correctly capitalized. |
| Hyphens: compound adjectives / two vowels / -ly / predicate | Yes | **FAIL** ×1 (`least-recently-used`, `-ly` adverb hyphenated). `re-` words all correctly closed (`reattach`, `reuse`, `reorder` — no double-vowel case present). No `up-to-date`-style predicate error. |
| Gerunds in titles | Yes | **PASS.** Top-level task pages use gerunds (`Preloading`, `Choosing a mode`), reference pages use nouns. |
| Noun vs. verb compounds | Yes | **PASS.** Zero occurrences of backup/back up, login/log in, setup/set up, startup/start up in any form. |
| Quotation marks: purpose, punctuation placement, single quotes | Yes | **FAIL.** 26 comma/period-outside violations vs 5 compliant; quotes around code ×1; quotes for section names ×5. Single quotes appear only inside code — compliant. |

### Formatting

| Rule | Checked | Result |
|---|---|---|
| Bold for UI elements | Yes | **PASS (n/a).** No UI element names; bold used for emphasis labels (`**Root cause**`, `**Fix**`), which is acceptable outside UI writing. |
| Italic for new terms | Yes | **PASS.** Sparse and correct (`_is_`, `_up_`, `_elements_`). |
| Monospace for code/identifiers | Yes | **PASS.** Consistently applied to props, files, types, attributes, error codes. |
| Numbers: 1–9 spelled, 10+ numeral, numerals in tables/decimals/dimensions | Yes — programmatic scan of bare 1–9 in prose | **FAIL** ×3. |
| Thousands separators | Yes | **PASS.** All 4-digit values are px dimensions or ms durations (`1500px`, `1440`, `3000ms`), where separators do not apply. |
| Dates `Month DD, YYYY`; 12-hour AM/PM; UTC; no relative terms | Yes | **FAIL (relative terms).** `today` ×4 en / `目前` ×4 zh. No dates or clock times appear at all, so the format rules are n/a. |
| Lists: ≥2 items, parallel, capitalized, period consistency, introduced by colon | Yes — programmatic single-item and mixed-period detector | **PASS.** Zero single-item lists; zero lists mixing period/no-period; all introduced by a colon or heading. |
| Paragraphs under seven lines | Yes — char-length proxy | **PASS.** No paragraph exceeds ~9 rendered lines; none over 900 chars. |
| Single line break between elements | Yes | **PASS.** |
| Admonitions: purpose, no stacking, no overuse | Yes — searched `:::`, `> [!`, `**Note**`-style | **PASS (n/a).** The docs use **zero** admonitions, so no misuse, stacking, or overuse is possible. |
| Code samples: consistent indentation, runnable, comments before code, syntax highlighting | Yes | **FAIL (nice-to-have)** on labeling consistency (19 unlabeled fences vs 2 labeled `text`). Indentation is uniform 2-space; the tsx samples are copy-runnable; comments precede the code they explain. |
| Sensitive information | Yes — IPs, hostnames, localhost, ports, tokens, secrets, emails, customer data | **PASS.** Zero findings. Example URLs are generic (`/hero.jpg`, `/clip.mp4`, `/api/clip?fmt=mp4`); "token" hits refer to a requestId and a CSS custom property, not credentials. |

### Accessibility

| Rule | Checked | Result |
|---|---|---|
| Alt text on all images/icons/media; no backticks in alt | Yes | **PASS (n/a).** Zero images, icons, `<img>`/`<svg>`/`<video>` embeds, or screenshots in any of the 80 pages — every `<video>`/`<img>` mention is prose about the HTML element. So no alt text is required and none is missing. |
| Descriptive link text; no "click here"/bare URLs | Yes | **FAIL (nice-to-have)** — labels do not match target titles (see finding above). Zero `click here`/`read more`/bare-URL cases; zero bare `http(s)://` links anywhere. |
| No directional language | Yes | **PASS.** No `on the left`/`right side`/`top of the page`; no `see below`/`section above` in either language. |
| Device-neutral verbs | Yes | **FAIL (nice-to-have)** ×4 `clickable`/`can be clicked`. |
| Plain language; acronyms expanded; parallel lists | Yes | **PASS** (with the sentence-length note above). |
| Gender-neutral | Yes | **PASS.** Zero gendered pronouns; audience is addressed as "you", "the audience", "the user", `观众`/`用户`. |
| No buzzwords, superhero terms, violent imagery, ableist language, non-specific superlatives | Yes | **PASS.** Zero hits for seamless/blazing/powerful/robust/magic/leverage/crazy/insane/dumb/master-slave/kill-shot etc. Only `dead center` in a code comment (`en/concepts/05-responsive.md:44`), which is a positioning idiom, not violent imagery — judged compliant. |

### UI writing

Not applicable: the docs describe a code API and contain no UI element names, buttons, checkboxes,
menus, tabs, text fields, toggles, keyboard-shortcut instructions, screenshots, procedures, or
Kibana chrome references. Checked for each of these and confirmed absent. **PASS (n/a).**

### zh-specific handling

Skipped as en-only per instructions: American spelling, Oxford comma, contractions, second person.
Checked on the zh side: metaphor clearance, positional references, terminology single-naming,
zh/en term correspondence, avoid-word equivalents (`简单`/`轻松`/`请`/`杀掉`/`非法` — all clean or
legitimate: `非法` ×6 and `无效` ×8 are used for invalid-configuration semantics matching the
framework's own error codes), heading sentence case, number formatting, code fences, admonitions.

---

## Re-verification of the two prior rounds' seven items

| # | Item | Closed? |
|---|---|---|
| 1 | Metaphors (`尺子`/`换算尺`/`闸门`/`死区`/`破窗`/`收摊`/`抢戏`/`bundled rollback`/`crash site`/`flap`/`sharp edges`/`trap(s)`/`武装`/`说了算`) | **CLOSED.** Case-insensitive grep of all 14 terms across both languages: zero hits, including the句首-capitalized `Traps` that leaked last round. Only survivor is `is trapped inside it` (`en/scroll/04-fixed-layer.md:10`) — a literal statement of CSS containment paired with zh `被框在这个祖先里`, i.e. descriptive, not the `trap`-as-gotcha metaphor. Judged compliant. |
| 2 | Positional references (`see below`/`section above`/`next section`/`pattern below`/`见下`/`见上`) | **CLOSED.** Zero in both languages. Remaining `above`/`below` are numeric/geometric; the zh `上下文` hits are "context". |
| 3 | First person (en `I`/`me`/`my`) | **CLOSED.** Only `I-frame` and the `My`/`.my-panel` code identifiers. |
| 4 | Oxford comma (en) | **NOT CLOSED.** 3 remaining: `en/concepts/06-dom-contract.md:69`, `en/drag/05-callbacks.md:43`, `en/drag/06-drag-pitfalls.md:46`. |
| 5 | Sentence-case headings incl. frontmatter `title:` | **CLOSED.** All 80 `title:` values and every `##`/`###` verified. |
| 6 | British spelling (en) | **NOT CLOSED.** `cancelled` ×3 (`en/drag/05-callbacks.md:27`, `:39`, `en/reference/01-cineview.md:91`). |
| 7 | Terminology consistency (single name per concept, zh/en correspondence) | **NOT CLOSED.** zh `预载`/`预加载`, `折算`/`换算`, three spellings of `设计稿基准`; en `Timeline concept(s)`, four labels for `/docs/05-responsive`, five for `/docs/01-centerlock`, `presets`/`Presets`; and both languages link the "Troubleshooting"/`排错` pages as "pitfalls"/`常见故障`. |

---

## Considered and judged compliant (not violations)

- Ruled-in-advance vocabulary: `轨`/lane, `zone`, `takeover`, `scrub`, `center-lock`, `phase`,
  `commit`, `门`/gate, `钳`/clamp, `标尺`, `design base`, `render track`+`render lane`,
  `hard-wired`/`写死`, `swallowed`/`吞掉`.
- `above`/`below` in numeric and geometric senses (12 en instances).
- `may` for permissibility (6 instances) — the table sanctions this reading.
- `will`/`would` in counterfactual and predictive-consequence clauses (19 instances).
- `cache hit` as computing terminology (3 instances).
- `AbortController`, `INVALID_*` error codes, `I-frame`, `My`/`.my-panel` — API and code identifiers.
- Passive constructions describing framework-performed action, where the agent is the framework
  and stating it would add noise (187 instances reviewed, none reported).
- Acronyms used without expansion — all are standard web-platform vocabulary for this audience.
- `dead center` in a code comment.
- Pervasive `src/...:LINE` source citations: verified accurate on spot-check
  (`SCRUB_SAMPLE_MIN = 6` at `src/media/VideoFrameRenderer.tsx:52`; the fps clamp formula at
  `src/utils/performanceMonitor.ts:101-106`), and they aid rather than harm the reader.
- Zero admonitions, zero images, zero UI references — these rule sections are inapplicable, not failed.

---

## Verdict

### Must-fix

1. **American spelling** — `cancelled` → `canceled`: `en/drag/05-callbacks.md:27`, `:39`,
   `en/reference/01-cineview.md:91`. (Prior item 6, still open.)
2. **Oxford comma** ×3 — `en/concepts/06-dom-contract.md:69`, `en/drag/05-callbacks.md:43`,
   `en/drag/06-drag-pitfalls.md:46`. (Prior item 4, still open.)
3. **Avoid-word `whitelist`** ×7 (4 en + 3 zh `白名单`) — not a source identifier, no exemption.
4. **Avoid-word `abort`** ×1 — `en/scroll/03-inputs.md:80`.
5. **Avoid-word `hit`** ×3 — `en/drag/04-ownership.md:28`, `en/advanced/02-preload.md:69`,
   `en/scroll/03-inputs.md:72`.
6. **Avoid-word `invalid`** ×1 prose — `en/advanced/06-media-ownership.md:14`.
7. **Avoid-word `type`** as a verb ×1 — `en/scroll/03-inputs.md:59`.
8. **`could` / `currently` / `now`** ×4 — `en/drag/05-callbacks.md:16`,
   `en/drag/06-drag-pitfalls.md:14` (+zh), `en/scroll/04-fixed-layer.md:55`,
   `en/advanced/06-media-ownership.md:45`.
9. **Quotation-mark punctuation** — 26 instances place the comma/period outside the closing quote;
   the codebase convention is inverted relative to the rule. Also quotes around code
   (`en/scroll/05-scrollbar.md:10`).
10. **Numbers 1–9 as digits in prose** ×3 — `en/advanced/06-media-ownership.md:83`,
    `en/concepts/06-dom-contract.md:58`, `en/drag/06-drag-pitfalls.md:58`.
11. **Hyphenated `-ly` adverb** — `en/advanced/02-preload.md:73` `least-recently-used`.
12. **Relative time `today`** ×4 en (+`目前` ×4 zh).
13. **Terminology single-naming** — zh `预载`/`预加载`, `折算`/`换算`, three spellings of the design
    base; en link labels contradicting page titles (Troubleshooting-as-"pitfalls" ×10 en / ×8 zh,
    `Timeline concept(s)`, `/docs/05-responsive` ×4, `/docs/01-centerlock` ×5, `presets`/`Presets`).
    (Prior item 7, still open.)

### Nice-to-have

- Contraction register mixing on three pages.
- 11 sentences with 4–5 conjunctions; two over 50 words.
- Quoting section headings instead of linking them ×5.
- `should` as hedged prescription ×4.
- `clickable`/`can be clicked` where the gate is `pointerEvents` ×4.
- Code-fence language labels: 19 unlabeled vs 2 labeled `text`.

VERDICT: FAIL
