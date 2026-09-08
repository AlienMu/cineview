# Bilingual README and documentation redesign

## User scope

Continue the recovered project work, finish its browser acceptance, and then rebuild the English/Chinese README with natural technical prose, a detailed and verified framework introduction, measured unit-test coverage, truthful status badges, and the site address. Find and apply a writing guide from GitHub that removes formulaic AI phrasing. Perform an adversarial review.

Redesign the entire `/docs` interface and layout, retaining only the current Hero theme color as a visual reference. Review the historical task flows and both language trees for stiff or inaccurate explanations. Preserve current public API semantics, bilingual page/slugs/frontmatter alignment, and existing user changes.

## Evidence and constraints

- Repository guides: `AGENTS.md`, `DESIGN.md`, `AGENT_SELF_REVIEW.md`, and `site/src/content/docs/WRITING.md`.
- Current implementation and public types take precedence over historical review notes.
- The approved homepage has seven scenes. Its outstanding acceptance is tracked in `2026-09-08-home-acceptance-closure.md`.
- The existing README contains unverified install instructions and stale coverage/build counts. Replace them with current metadata and executed commands.
- GitHub project `AlienMu/cineview` has no configured homepage URL. A public site address has been requested from the user; do not invent a deployment or publish one without scope.
- The existing docs contain 40 English and 40 Chinese pages in six groups. Keep routes and translated structures aligned.
- `AGENT_SELF_REVIEW.md` requires an independent browser agent for visual/input changes; browser review is a separate verification step.

## Nodes

- [x] Finish the previous homepage browser acceptance and independent review.
- [x] Review current README, documentation history, public APIs, package metadata, workflows, and deployment evidence.
- [x] Find GitHub writing guides, read the relevant instructions, and record the exact sources/revisions used.
- [x] Run framework coverage and applicable static/build gates; record dated evidence for status claims.
- [x] Write matching English and Chinese READMEs with runnable examples, framework explanations, verified badges, and site/documentation links.
- [x] Define and implement a new `/docs` navigation, reading layout, typography, code/table treatment, search, and mobile experience using the Hero accent.
- [x] Review all documentation pages for natural wording and current API behavior; update both language versions together.
- [x] Correct the mixed-language terminology residue found in final screenshots, then recheck the affected pages.
- [x] Run documentation contracts, formatting, types, lint, builds, link/example checks, and independent desktop/mobile browser acceptance.
- [x] Perform an adversarial factual/style/UX review, resolve actionable findings, and write final evidence.

## Working ownership

The main agent owns README, interface changes, and integration. A separate content agent first reviewed all pages, then applied the documented prose and example corrections. An independent browser reviewer verifies frozen homepage and `/docs` versions using separate browser contexts and evidence directories; that reviewer only changes its harnesses and evidence.

## Documentation design

Use a warm paper reading surface, dark ink, and the Hero accent `#d59273`. The new type pairing is Newsreader for article titles and Source Sans 3 for body/navigation, with a separate monospace code face. Replace the multi-row category header and exposed slug metadata with a compact header, a persistent guide index, an article column, and a quiet section index. At narrow widths, navigation moves into a native dialog and the section index becomes an inline disclosure.

Rebuild code blocks with working copy controls and preserve real table columns in a keyboard-scrollable region. Search uses a native modal dialog with keyboard selection, Escape, and focus return. Keep all 40 routes, legacy redirects, in-page links, and language switching. The old docs CSS is replaced by a dedicated stylesheet, scoped away from the homepage and drag route.

Content review runs separately in the forked context requested by `docs-check-style`; Markdown pages stay unchanged until its report is complete, preventing the stale-citation problem recorded in the historical task flows.

## Evidence collected

- Independent homepage report: `output/playwright/2026-09-08-home-independent/REPORT.md`; five browser commands passed, including 72 supplemental assertions. Native screenshots and offscreen Canvas reads proved deterministic reverse frames; direct pixel reads were isolated as a Chrome GPU/CPU measurement effect.
- GitHub writing sources: `blader/humanizer` revision `9862685f575c65a8247f90369951df1b3416e3d6` and `op7418/Humanizer-zh` revision `91f3d394db8419c20d67ebe22a96cf8fee0a404b`. Used as writing guidance without installing runtime dependencies.
- Framework coverage: 118 suites / 1,582 tests; statements 94.85%, branches 90.22%, functions 95.15%, lines 96.27%. Build verification passed 17/17, including a real packed consumer.
- Both READMEs contain three matching TSX blocks. All six compiled against current package declarations; heading levels match, local links exist, and all six badge URLs returned HTTP 200.
- Independent README review confirmed metadata, examples, badge scope, and links. Its one required correction (root dependency installation in standalone site/verification instructions) and all three wording/scope clarifications were applied in both languages. Review: `review/readme-docs-2026-09-08/readme-adversarial-review.md`.
- New docs screenshots at 1440px, 390px, and 320px show no page overflow. Headers measure 76px desktop / 64px mobile. The native heading link now preserves the heading's exact accessible name, with no decorative text appended.
- Browser style probe updated to deduplicate desktop/mobile navigation links and identify the redesigned 404 state. No wording or content checks were removed.
- Main-agent browser checks confirmed search keyboard selection, Escape restoring trigger focus, clipboard text matching the complete code block, and section headings settling at 104px with a 76px header. Native smooth scrolling and asynchronous clipboard completion are awaited before assertions.
- Full content review covered 40 paired pages and recorded 30 finding groups in `review/readme-docs-2026-09-08/content-review.md`. The authoring pass resolved all groups; `content-resolution.md` records each correction and the 80-page handoff digests.

## Independent docs UI findings

- The first browser review found that keyboard selection reached search result 12 while the result remained below the visible list. The fix scrolls the active option into the nearest visible position when the selection or results change, while keeping focus in the search input. The independent browser regression will verify the actual option rectangle and scroll position.
- The browser review found that a quoted frontmatter title displayed its YAML wrapper quotes. Header parsing is now isolated from Vite's file glob so it can be regression-tested. Tests failed on quoted titles and escaped quotes before the correction; the parser now decodes the quoted scalar while preserving inner quotes and Markdown content.
- A language switch retained a known section hash from the previous language, leaving no matching target on refresh. Known translated section anchors now map through the aligned heading order and replace only the hash, keeping the page and query. Language switches without a hash keep their existing scroll behavior.
- Later language-switch coverage found the active sidebar link clipped after translated labels changed row heights. The existing nearest-scroll effect now also depends on language. At 320px, the redundant header section label is hidden to avoid a two-line Chinese label; the menu, product identity, search, and language control remain visible.
- A controlled keyboard probe showed that calling scrollIntoView on the active navigation link changed Chrome's sequential focus starting point, skipping the skip link/header on first Tab. Navigation positioning now adjusts only the owning index scroller's scrollTop. This shared routine runs on page/language changes and menu opening, without moving focus or adding frame-driven layout work.
- An in-place resize from 390px to 961px exposed the desktop sidebar without rerunning the route/language effect. The index now observes both content and scroller dimensions, with a resize fallback, and reuses the same scrollTop-only positioning. This also covers font-driven row-height changes; changing scrollTop does not change the observed boxes.
- Main-agent screenshot inspection found six Chinese uses of `locked 锁定区`, plus spaces and untranslated `identity` left by terminology replacement. A bounded independent content recheck also found one repeated `锁定区（锁定区）`. These were corrected during an agreed pause between browser scripts. Two Chinese troubleshooting headings were reworded; their hierarchy and order, route slugs, frontmatter, examples, and paired meanings remain aligned.
- The CineView component table still called `thumbHoverColor` a hover color although the detailed scrollbar page and implementation use it for the thumb border in every state. Both languages now describe the border; the English `inset` entry also names the container edge precisely.

## Final static and rendered-content checks

- Framework coverage remains the dated 118-suite / 1,582-test run. No framework runtime source was changed in this documentation pass.
- Current site contracts: 16 suites / 79 tests, including four new frontmatter regressions. Root, framework, site, and example type checks pass; root lint and explicit lint of the new docs owners pass without warnings.
- Current production site build passes. The existing large-chunk warning remains; no size threshold was changed.
- The final 80-page rendered style probe passes with 0 structural issues, 0 console issues, and 0 failed pages after the terminology corrections. Log: `review/readme-docs-2026-09-08/docs-style-final-content.log`.
- English/Chinese README code blocks, heading structure, links and badges were checked, and independent review R1–R4 is closed. A public domain was not supplied; the README accurately lists the site's configured local default and the commands to start it.
- The first full rendered style pass checked all 80 pages with zero console/structural issues. It found two stale video-section references, which were corrected in both languages, and four false capitalization reports for real names (`CommonJS`, `Scene's`, `MotionValues`, and `URLs`). These names now use the existing proper-name exemption; the sentence-case rule remains active.
- The authoring ledger remains a historical handoff snapshot. Final integration changed 17 of its 80 pages through the video references, terminology cleanup, and scrollbar table corrections. `review/readme-docs-2026-09-08/final-source-snapshot.json` records every changed page, its original digest prefix, and its final SHA-256, along with the docs UI and README hashes.
- Final frozen-source checks passed: site contracts (16 suites / 79 tests), site types, docs-owner lint, all Markdown formatting, production site build, and the 80-page rendered probe. Logs with `final` in their names are in `review/readme-docs-2026-09-08`; the build still reports the existing large-chunk warning.

## Implementation self-review

- Search and disclosure state change on input, navigation, or explicit actions. No per-frame React state, framework progress writer, or animation driver was added.
- Navigation resize observers and window listeners are removed on cleanup. The active-link correction reads its owning scroller and changes only that scroller's position; native dialogs retain focus handling.
- The new frontmatter parser is 30 lines and has four focused regressions. The header/search owner is 362 lines and the document-page owner is 377 lines. `Docs.css` is the large new owner at 963 lines, covering the full docs theme and responsive layouts; record navigation/dialog versus article styles as a future split if these areas expand independently.
- The final source snapshot covers 80 content pages, the docs UI and shared style/locale files, and both READMEs: 92 files total. All 92 digests still match after static and browser checks. Historical content-review digests remain preserved for comparison.
- The README's two heading sequences match, its three TSX examples match between languages, and its local links and fragments resolve. Earlier example compilation and public badge/link checks remain applicable because the examples and badge targets did not change.

## Final independent browser results

The final `/docs` runs against the actual `http://127.0.0.1:4010/` service passed all 2,206 assertions. `output/playwright/2026-09-08-docs-independent/routes-layout/report.json` records 80 localized pages, 68 legacy redirects, 54 layout cases, 18 in-place resizes, and 2,012 assertions. `interactions/report.json` adds 194 assertions across English/Chinese at 1440px, 390px, and 320px.

The interaction runs cover the initial skip-link focus, translated anchors and refresh, query preservation, search selection and focus return, mobile menus, code copying, horizontal table scrolling, and reduced motion. In-place resizing retains the visible active navigation item after crossing the desktop breakpoint. Both reports record zero console errors or source changes; their source hashes match the final integration snapshot.

The main agent also inspected the final Chinese mobile introduction and navigation screenshots and the desktop reading layout. The independent reviewer confirmed no unresolved functional findings. This acceptance is scoped to the recorded Chrome configurations and does not establish general WCAG conformance or all-browser compatibility.

Final evidence is in `output/playwright/2026-09-08-docs-independent/REPORT.md` and `completion.json`. The main agent compiled the report from the independent reviewer's two completed matrices and confirmation, and recorded the representative screenshots actually inspected. All 88 browser-reviewed source hashes and all 92 integration hashes match. The report preserves the limited visual-review scope instead of claiming separate manual inspection of every screenshot.

All nodes are complete. The local Vite preview remains available at `http://127.0.0.1:4010/docs`. Both READMEs link to the durable `VERIFICATION.md` snapshot and explain the configured local site address; no public deployment address was available in the repository metadata or supplied during this task.
