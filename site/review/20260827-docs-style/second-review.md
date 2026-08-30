# Second independent style review — docs (zh/en, 40 pages each)

Date: 2026-08-28. Reviewer: independent agent #2 (did not read task-flows/ or round-1 report).
Scope: `site/src/content/docs/{zh,en}/**/*.md` only, against `.agents/skills/docs-check-style/SKILL.md`
plus the de-metaphor standard.

## Part 1 — Re-verification of round-1 must-fix items

| # | Item | Verdict |
|---|---|---|
| 1 | `zh/advanced/04-direction-x.md` `换算尺` → `换算基准` | CLOSED — zero hits for `换算尺`/`尺子`/`量尺` anywhere in zh/ |
| 2 | `en/reference/03-animate.md` `("bundled rollback")` | CLOSED — zero hits for `bundled rollback` in either tree |
| 3 | `zh/advanced/07-common-pitfalls.md` `收摊`/`打包收摊` | CLOSED — zero hits for `收摊`; remaining `打包` hits are literal bundler usage (`打包器`, `包里打包`), correct technical sense |
| 4 | `en/concepts/01-modes.md` frontmatter Title Case | CLOSED — now `title: Dual-mode engines` (sentence case) |
| 5 | en British spellings | CLOSED — zero hits for serialis/recognis/neighbour/behaviour/colour/analyse/centre/organis/initialis/normalis/optimis/licence/catalogue/favour/labour/artefact across en/ |
| 6 | en positional references (4 sites) | CLOSED — `reference/10-types.md`, `09-use-animate-timeline.md`, `05-position.md` all show zero positional `above/below/table above` constructs; remaining `above`/`below`/`later` hits in en/ are all legitimate (numeric comparison, z-index ordering, temporal "later frames", stacking "stacked above") |
| 7 | `en/reference/01-cineview.md` `the frame applies` | CLOSED — line 132 now reads `the framework applies its default fallback` |

### Fact check: `onLoadProgress` value range

Source truth, `src/hooks/useImagePreloader.ts:219`:
`const newProgress = safeTotal > 0 ? Math.round((safeLoaded / safeTotal) * 100) : 100;`

Integer 0–100 confirmed, including the no-assets → 100 shortcut. Docs match:
- `zh/reference/01-cineview.md:78` "整数 0-100" / `en/reference/01-cineview.md:78` "integer 0-100"
- `zh|en/advanced/03-callbacks.md:15`, `advanced/02-preload.md:77`, `drag/05-callbacks.md:63` all state integer 0..100
CORRECT.

### Named cross-reference audit

All 12 en `see "…"` and 16 zh `见「…」` targets resolve to a real h2/h3 on the same page
(scripted check: heading-set match after stripping numeric prefixes and backticks). Zero dangling.

## Part 2 — Independent findings

### A. Grammar/Spelling — Oxford comma (real violation, systemic)

SKILL.md: "**Oxford comma**: Always use in lists of three or more." The en tree uses `, and` /
`, or` 231 times, so the convention is intended, but ~30 three-item lists omit it. Scripted
audit; the clear cases (three genuine coordinate items, not two-clause `so … and …`):

- `en/getting-started/01-introduction.md:6` — Grammar/Spelling — two lists in one sentence, both missing it: "scenes, animations and a design width" and "transitions, timelines and responsive scaling" → "scenes, animations, and a design width"; "transitions, timelines, and responsive scaling"
- `en/advanced/01-performance.md:41` — "your application code, third-party libraries and CSS" → "…, third-party libraries, and CSS"
- `en/advanced/01-performance.md:85` — "a `setState`, a DOM write or a layout read" → "…, a DOM write, or a layout read"
- `en/advanced/01-performance.md:93` — "The full rules, thresholds and ffmpeg command" → "…, thresholds, and ffmpeg command"
- `en/advanced/02-preload.md:75` (heading) — "Progress, timeouts and errors" → "Progress, timeouts, and errors"
- `en/advanced/02-preload.md:112` — "Video ownership, `releaseOnLeave` and encoding requirements" → add comma
- `en/advanced/04-direction-x.md:38` — "ArrowDown and PageDown move forward along `'x'`, ArrowUp and PageUp move backward" → comma splice, not an Oxford case; use a semicolon
- `en/concepts/02-timeline.md:37` (heading) — "delay, waitFor and phase ranges" → "delay, waitFor, and phase ranges"
- `en/concepts/06-dom-contract.md:69` — "`aria-*`, `role` and `onClick` all work" → add comma
- `en/concepts/07-runtime-states.md:23` — "`covered`, `inactive`, `parked` or `exiting`" → "…, `parked`, or `exiting`"
- `en/drag/01-layout.md:42` — "Subscriptions, timers and videos" → add comma
- `en/drag/01-layout.md:54` — "`width`, `radius`, `trackColor`, `thumbColor`, `autoHide` and `ariaLabel`" → add comma
- `en/drag/04-ownership.md:17` — "taps, link clicks and text selection" → add comma
- `en/drag/04-ownership.md:21` — "a transaction get created, the dragging flag set, the click suppressed and `onDragStart` fired" → four items, add comma
- `en/drag/04-ownership.md:40` — two lists: "delays, durations, variants, mapping conversion rule and total timeline length"; "Follow-finger, post-release continuation, bounce and re-grab continuation" → add comma to both
- `en/drag/04-ownership.md:46` — "`delay`, `duration`, `waitFor` or the entrance variant" → add comma
- `en/drag/05-callbacks.md:43` — three-item code list missing it → add comma
- `en/drag/06-drag-pitfalls.md:46` — "effects re-run, state resets and the element timeline restarts at 0" → add comma
- `en/getting-started/04-choosing-mode.md:16` — "native scrolling, keyboard and scrollbar" → add comma
- `en/reference/07-container.md:35` — "`zIndex`, `opacity`, `fontWeight`, `lineHeight` and similar" → add comma
- `en/scroll/05-scrollbar.md:75` — "flips the scrolling flag false, waits 0.15s and drifts out over 0.5s" → add comma

Note the same page family is inconsistent internally: `en/scroll/05-scrollbar.md:42` correctly
writes "outer ring, drop shadow, and keyboard-focus outline" while `:75` omits it. Not zh-applicable.

### B. Voice/Tone — first person (real violation)

- `en/advanced/05-custom-animation.md:97` — Voice/Tone — `"I need a timeline lane … but no visual animation of my own"`. SKILL.md: "Never use I/me/my." Also a quotation mark used for a paraphrased inner voice, not an error message or first-use term (Formatting). Suggestion: "`solidVariant()` is the idiom for an element that needs a timeline lane (for render-props, `useAnimateTimeline` consumers, or a `waitFor` anchor) without a visual animation of its own." The zh line 97 is the mirror and carries `同一招` separately (see D).
- `en/concepts/06-dom-contract.md:6` — Voice/Tone — "why does my CSS not work" → "why your CSS does not work". zh:6 has the same `我的 CSS`. (`.my-panel` in the code sample at :36 is fine — it is example code.)
- `en/scroll/02-zones-budget.md:46` — Voice/Tone — `"halfway through my own entry"` → "halfway through the element's own entry". zh:46 `「自身入场走到一半」` is already impersonal, so this is also a zh/en parity gap.
- `en/scroll/02-zones-budget.md:76` — Voice/Tone — `"one of my zones stopped locking"` → "one zone stopped locking". zh:76 `「其中一个 zone 不锁了」` is already impersonal.

### C. Voice/Tone — future/hedge modals (real violation, minor)

SKILL.md: "Write in present tense. Avoid will, would, should, currently."

- `en/drag/06-drag-pitfalls.md:14` — "gesture paging duration is currently not configurable" → "is not configurable"
- `en/advanced/01-performance.md:76` — "you will watch it sit still" → "it sits still"
- `en/drag/05-callbacks.md:27` — "A progress bar driven by `onDragProgress` will freeze" → "freezes"
- `en/drag/05-callbacks.md:33` — "Analytics that count gestures through `onDragStart` will miss every re-grab" → "miss every re-grab"
- `en/concepts/02-timeline.md:58` — "leaving a scroll zone or switching away in drag mode will not exit the element" → "does not exit"
- `en/concepts/04-orchestration.md:44` — "will not return it to incomplete" → "does not return it"
- `en/scroll/05-scrollbar.md:50` — "a second finger will not interrupt the first" → "does not interrupt"

(Counterfactual `would` — `en/advanced/01-performance.md:87`, `en/scroll/01-centerlock.md:103`,
`en/scroll/03-inputs.md:59`, `en/scroll/06-scroll-pitfalls.md:58`, `en/drag/04-ownership.md:54`,
`en/getting-started/02-installation.md:79` — is explaining a rejected alternative, which present
tense cannot express. Judged compliant.)

### D. De-metaphor — remaining figurative terms not in the cleared list

The cleared list covers lane/zone/takeover/scrub/center-lock/phase/commit/gate/clamp/标尺/design
base/render track+lane. These are outside it and are still figure-of-speech, not mechanism names:

- `zh/advanced/05-custom-animation.md:97` — `同一招` (literally "the same move/trick"). en:97 mirrors it with "the same trick". Suggestion: zh `内部用的就是同一种写法`; en "uses the same construction internally".
- `zh/drag/04-ownership.md:57` — `提交定时器一并重新武装` — `武装` (to arm, weapons imagery). en:57 says "the commit timer is re-armed", which is a normal timer term in English; the zh calque is not. Suggestion: `提交定时器一并重新计时` or `重新启动`.
- `en/scroll/01-centerlock.md:29` — "the real scroll distance the audience **burns**" — consumption-as-combustion. zh:29 uses the neutral `消耗掉`. Suggestion: "consumes" / "spends".
- `en/scroll/02-zones-budget.md:10`, `en/scroll/03-inputs.md:40`, `en/scroll/05-scrollbar.md:42` — "hard-wired" (physical wiring) for "not configurable". zh uses the plain `写死` at all three. Suggestion: "fixed at 1, not configurable" / "fixed, not configurable".
- `en/advanced/07-common-pitfalls.md:16` — heading "After **wiring** `exitRef`" → "After passing `exitRef`". zh:18 heading is `调了 exitRef 后`, plain.
- `en/advanced/06-media-ownership.md:44`, `:71`, `en/reference/04-animate-video.md:73` — "cannot **flap** between play and pause" / "never **flaps**" (relay-contact imagery). zh uses `不会反复 play/pause` and `不会抖动`. Suggestion: "cannot oscillate between play and pause".
- `en/drag/04-ownership.md:54`, `en/scroll/01-centerlock.md:66` — "**teleport** the whole scene stack" / "instead of **teleporting** past it". zh:54/:66 use `瞬移`, the same figure. Both languages: "jump the whole scene stack in one frame" / "jumping past it".
- `en/reference/05-position.md:52`, `en/scroll/03-inputs.md:59` — "gets **swallowed** by the ancestor transform" / "would be **swallowed** by `preventDefault`". zh:56/:59 use `吃掉` / `吞掉` — the same eating metaphor in both. Suggestion: "resolves against the ancestor transform instead"; "would be consumed by `preventDefault`".
- `en/advanced/06-media-ownership.md:6` — "its three **sharp edges**". zh:6 already says the plain `三处边界`. This is also a zh/en term split. Suggestion: "three boundary behaviors".
- `en/concepts/06-dom-contract.md:62` — "These keys are **always the engine's**" is fine, but zh:62 `以下键**总是**引擎说了算` uses the colloquial `说了算` (has the final say, anthropomorphic). Suggestion: `以下键**总是**由引擎决定`.
- `zh/scroll/04-fixed-layer.md:12` — `症状对上了就别再回头查自己的 CSS` — `对上了` is colloquial. Suggestion: `症状一致时不必再排查自己的 CSS`.
- `zh/scroll/01-centerlock.md:66` / `zh/drag/05-callbacks.md:18` — `最要紧的一条` / `更要紧的是`. Colloquial intensifier; en uses "the most consequential rule" / "More importantly". Suggestion: `最关键的一条` / `更重要的是`.
- `en/scroll/03-inputs.md:74` — "consumes the wheel until it reaches its own end" is fine, but "the **audience** sees a picture that has stopped moving" pairs with `en/scroll/01-centerlock.md:29/41/66`, `en/scroll/02-zones-budget.md:10`, `en/drag/06-drag-pitfalls.md:14`: **"the audience"** is used throughout for "the user". Cinema framing is the product's domain, so this is arguably deliberate and consistent (zh `观众` matches 1:1), but it is a persona metaphor where "the user"/"用户" is the plain term. Flagging as nice-to-have, consistent either way.
- `en/scroll/03-inputs.md:6`, heading `:8` "## The **funnel**" — physical-object metaphor as a section name. zh:8 is `## 汇聚点` (convergence point), already neutral, so this is also a term split. Suggestion: "## The single entry point" or "## Where the four paths converge".

### E. Terminology consistency (zh/en drift)

- **`trap` vs `pitfall` vs `failure`** (en): `en/concepts/02-timeline.md:35` "hides a trap", `en/reference/03-animate.md:74` "is a trap", `en/concepts/04-orchestration.md:111` "this trap", `:129` "trap list", `en/advanced/07-common-pitfalls.md:56` "is this trap", `en/scroll/06-scroll-pitfalls.md:6`/`:83` "Traps". The zh counterparts all use the neutral `需要留意` / `故障` / `不受此影响` — never a `陷阱` metaphor. So `trap` is both a metaphor (pit/snare) and an en-only drift. Standardize on the page titles' own word: the two troubleshooting pages are titled "Troubleshooting", and the body word should be "failure mode" or "mistake".
- **`independent track` vs `independent lane`** (en): `en/drag/03-two-track.md:6` "two independent tracks" (correct — the two-track state model), but `en/drag/06-drag-pitfalls.md:40` and `en/reference/09-use-animate-timeline.md:64` say "the independent lane" for the `sceneControlled: false` driver. Per the cleared render track/lane pairing, `track` = state and `lane` = writer, so a driver is a lane — but `03-two-track.md:6` then uses `track` for the same distinction the page title makes. Reads as drift; confirm which noun the `sceneControlled: false` driver takes and use it in all three.
- **`design width` vs `design base` vs `conversion base`** (en): `conversion base` 16x, `design base` 1x (`en/reference/01-cineview.md:28`), `design width` 6x. The brief clears `design base` as intentionally distinct from `conversion base`, and `design width` is the plain gloss of `config.size`, so this trio is defensible — but `en/reference/01-cineview.md:26` puts "Design width base" and "the single conversion base" in one table cell, i.e. three of the four spellings within two lines. Nice-to-have: pick one gloss per position.
- **`/docs/07-common-pitfalls` link text** (both langs): titled "Troubleshooting" / `排错`, linked as "Common pitfalls" (x4), "Pitfalls" (x4) / `常见故障` (x6). Same for `/docs/06-scroll-pitfalls` (title "Scroll troubleshooting", linked "Scroll pitfalls" x4) and `/docs/06-drag-pitfalls`. A reader following "Pitfalls" lands on a page headed "Troubleshooting". Also `/docs/01-modes` (title "Dual-mode engines" / `双模式引擎`) is linked as "Modes", "The two modes" / `模式`, `定位模式` — and `定位模式` ("positioning modes") is a different concept name entirely, the worst of the set (`zh/concepts/05-responsive.md:54`). Nice-to-have overall, except `定位模式`, which is misleading.

### F. Considered and judged compliant (not violations)

- **Paragraph ≤ 7 lines**: zero violations. All 52 scripted hits were markdown tables or list runs; re-run excluding those returned nothing.
- **Lists ≥ 2 items, parallel, capitalized first letter**: zero single-item lists; zero lowercase-opening en list items outside code identifiers (an identifier-leading item is correct monospace usage).
- **Headings sentence-case**: all 40 en frontmatter `title:` values pass. `en/advanced/04-direction-x.md:2` `"Horizontal direction: 'x'"` is quoted for YAML colon-escaping, not emphasis. Body headings: only `en/reference/10-types.md:24` "The three layers of AnimationType" capitalizes mid-heading, and `AnimationType` is an exported type name, so correct.
- **Latin abbreviations**: zero `e.g.`, `i.e.`, `etc.`, `via`, `vs.` in either tree.
- **Avoid-list words**: zero `simply`/`easily`/`launch`/`terminate`/`kill`/`please`/`choose`/`hit` (as a verb)/`blacklist`. `whitelist` appears 4x (`en/advanced/05-custom-animation.md:87,127`, `en/reference/03-animate.md:95`, `en/reference/07-container.md:27`) — SKILL.md says use `allowlist`. **This is a real violation** but a borderline one: it names an internal implementation concept, and zh mirrors it with `白名单` (`zh/reference/07-container.md:27`, `zh/reference/03-animate.md:95`). Listing under nice-to-have. `abort` at `en/scroll/03-inputs.md:80` and `AbortController` at `en/advanced/02-preload.md:100` are the literal DOM API and the literal verb for it; `execute` at `en/advanced/06-media-ownership.md:16` describes a reducer executing commands against the DOM, a real term of art here; `invalid` at `en/advanced/06-media-ownership.md:14` is the HTMLMediaElement `duration` NaN state.
- **Positional references**: no `above`/`below`/`下文`/`上表` used positionally. Every hit is a numeric comparison (`below 40px`, `at or below 1px`), a stacking-order fact (`stacked above`, `z-index is 80, above the fixed layer`), a temporal ordering (`later frames`, `earlier frames`, `fill it in later`), or a viewport-geometry fact (`rising in from below the viewport`) — all legitimate. zh hits are `以下键`/`落点命中以下选择器` introducing an immediately following code block, which is a colon-introduced list, not a cross-page pointer.
- **Named cross-references**: all resolve (see Part 1).
- **Quotation marks for emphasis**: the quoted strings in en are literal prop values in code (`"drag"`, `"reel-01"`), quoted paraphrases of author intent (`"halfway through my own entry"`, `"rewind to 2s and stop"`), or first-use terms — the paraphrases are the accepted "quote what a reader would say" pattern rather than emphasis. Only the first-person ones (Part B) are flagged.
- **Contractions**: consistently light and non-ambiguous (`doesn't` 8, `Don't`/`don't` 8, `isn't` 2, `haven't` 2, one each of `you're`/`you'll`/`won't`/`didn't`/`can't`). SKILL.md warns against *mixing* contractions with spelled-out equivalents in the same context; the spelled-out forms dominate 150+ to 22 and are not co-located with contractions in the same sentence. Judged compliant, though the ratio suggests contractions are incidental rather than deliberate.
- **Cleared metaphors confirmed as used consistently**: `lane`/`轨`, `gate`/`门`, `clamp`/`钳`, `zone`, `takeover`, `scrub`, `center-lock`, `phase`, `commit`, `band` (hysteresis band, a signal-processing term, not a physical strap), `latch`/`置真` (a real digital-logic primitive matching `endpointLatched` in source), `budget`/`预算` (an accounting term for an allocated quantity, mechanism-accurate). Not flagged.
- **`orchestration` vs `choreography`** (en, 45 total): `orchestration` is the page title and the API-adjacent term; `choreography` appears 12x for the same concept (`en/drag/03-two-track.md:22,30`, `en/drag/04-ownership.md:6,38,44`, `en/drag/05-callbacks.md:18`, `en/reference/06-image.md:31`, `en/advanced/07-common-pitfalls.md:30,54`, `en/concepts/04-orchestration.md`). Both are performing-arts metaphors and zh uses the single word `编排` for both, so this is a one-to-two mapping. However `编排` is itself the framework's own API-domain word (`Orchestration` is a doc section and `waitFor` chains are literally orchestration), so I judge `orchestration` cleared as a domain term and only note `choreography` as **redundant drift**, not a metaphor violation. Nice-to-have: collapse to `orchestration`.
- **`audience`/`观众`**: see D; consistent across both languages and on-domain. Nice-to-have only.

## Part 3 — Verdict

All seven round-1 must-fix items are genuinely closed, and the `onLoadProgress` correction matches
the source. Round 1 evidently did not audit the Oxford comma rule, first person, or present tense,
and reached only some of the metaphor compound forms; those are the new findings.

### must-fix

1. **Oxford comma** — ~22 sites (section A). The rule is stated as "always" and the tree already
   follows it 231 times, so these are inconsistencies, not a style choice. `en/scroll/05-scrollbar.md`
   violates it at :75 and honors it at :42, in the same page.
2. **First person** — 4 sites (section B): `en/advanced/05-custom-animation.md:97`,
   `en/concepts/06-dom-contract.md:6` (+ zh:6), `en/scroll/02-zones-budget.md:46`, `:76`.
   The last two are also zh/en parity gaps, since zh is already impersonal.
3. **De-metaphor residue** — section D. The load-bearing ones: `武装`
   (`zh/drag/04-ownership.md:57`, weapons imagery), `同一招` / "the same trick"
   (`{zh,en}/advanced/05-custom-animation.md:97`), "hard-wired" x3, "flap"/"flaps" x3,
   "burns" (`en/scroll/01-centerlock.md:29`), "swallowed"/`吃掉`/`吞掉` x2 pairs,
   "sharp edges" (`en/advanced/06-media-ownership.md:6`), "teleport"/`瞬移` x2 pairs,
   `说了算` (`zh/concepts/06-dom-contract.md:62`), "wiring" (`en/advanced/07-common-pitfalls.md:16`),
   "The funnel" (`en/scroll/03-inputs.md:8`).
4. **`trap` as a term** — 7 sites (section E). Both a metaphor and an en-only drift: zh never uses
   `陷阱` for these, and the pages are titled "Troubleshooting".
5. **`定位模式` link text** (`zh/concepts/05-responsive.md:54`) — names a concept the target page
   does not cover. Should be `模式` or the page's own `双模式引擎`.

### nice-to-have

- Present tense: 7 `will`/`currently` sites (section C).
- `whitelist` → `allowlist`, 4 en sites + 2 zh `白名单` (section F).
- `choreography` → `orchestration`, 12 en sites.
- Link text vs page title drift, ~30 pairs per language (section E) — mostly harmless synonyms
  (`Presets` for "Preset animations"), worth one pass for the pitfalls/troubleshooting family
  and the `/docs/01-modes` family.
- `design width` / `design base` / `conversion base` colliding within `en/reference/01-cineview.md:26-28`.
- `audience`/`观众` as the standing word for the user (defensible, consistent).

VERDICT: FAIL
